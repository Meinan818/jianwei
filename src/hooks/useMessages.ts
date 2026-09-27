import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { scopedStorage, avatarImages } from '@lark-apaas/client-toolkit-lite'
import type { IMessage, IConversation } from '@/data/messages'
import { MESSAGE_STORAGE_KEY } from '@/data/messages'
import { useAuth } from './useAuth'
import { getAllShops } from '@/data/shops'
import { supabase } from '@/lib/supabase'
import {
  fetchVisibleMessages,
  upsertConversation,
  insertMessage,
  canSyncConversation,
} from '@/data/messages-remote'

const MESSAGES_CHANGE_EVENT = 'food_delivery_messages_change'

function notifyMessagesChange() {
  try {
    window.dispatchEvent(new CustomEvent(MESSAGES_CHANGE_EVENT))
  } catch {
    // ignore
  }
}

type UserRole = 'customer' | 'merchant' | 'rider'
type ChatType = 'shop' | 'om' | 'or' | 'rm'

interface MessagesState {
  conversations: IConversation[]
  messages: Record<string, IMessage[]> // conversationId -> messages
}

// ========== 会话 ID 生成（唯一纯函数，全 App 唯一出口） ==========

/**
 * 会话 ID 规则（精简、唯一、不依赖调用方参数顺序）：
 * - shop:{shopId}       下单前店铺咨询（顾客↔商家）
 * - om:{orderId}        订单·顾客↔商家
 * - or:{orderId}        订单·顾客↔骑手
 * - rm:{orderId}        订单·骑手↔商家
 */
export function getConversationId(params:
  | { type: 'shop'; shopId: string }
  | { type: 'om' | 'or' | 'rm'; orderId: string }
): string {
  if (params.type === 'shop') return `shop:${params.shopId}`
  return `${params.type}:${params.orderId}`
}

// 从会话 ID 反推类型
function getChatType(convId: string): ChatType {
  if (convId.startsWith('shop:')) return 'shop'
  if (convId.startsWith('om:')) return 'om'
  if (convId.startsWith('or:')) return 'or'
  if (convId.startsWith('rm:')) return 'rm'
  return 'shop'
}

// 会话涉及的角色（用于过滤当前用户可见会话）
function getRolesInConversation(conv: IConversation): UserRole[] {
  const type = getChatType(conv.id)
  if (type === 'shop' || type === 'om') return ['customer', 'merchant']
  if (type === 'or') return ['customer', 'rider']
  if (type === 'rm') return ['merchant', 'rider']
  return ['customer', 'merchant']
}

function isRoleInConversation(conv: IConversation, role: UserRole): boolean {
  return getRolesInConversation(conv).includes(role)
}

// 对方角色（用于未读数累加）
function getPeerRole(convId: string, myRole: UserRole): UserRole | null {
  const roles = getRolesInConversation({ id: convId } as IConversation)
  return roles.find(r => r !== myRole) || null
}

function getUnreadField(role: UserRole): 'unreadCustomer' | 'unreadMerchant' | 'unreadRider' {
  if (role === 'customer') return 'unreadCustomer'
  if (role === 'merchant') return 'unreadMerchant'
  return 'unreadRider'
}

// ========== 旧数据迁移 + 合并去重 ==========

/**
 * 一次性规整：
 * 1. 老格式 ID（shop-xxx、xxx-customer-merchant 等）→ 新格式（shop:xxx、om:xxx 等）
 * 2. 同语义多条会话合并（消息按时间归并、未读取各自角色最大值）
 * 3. 空壳会话（无消息且无 lastMessageAt）清除
 * 幂等：多次执行结果一致
 */
function normalizeState(state: MessagesState): { state: MessagesState; changed: boolean } {
  let conversations = state.conversations
  let messages = state.messages
  let changed = false

  // ✅ Step 0: 脏数据防御 — 剔除无 id / 格式异常的会话，消息表缺省时置空
  if (!Array.isArray(conversations)) {
    conversations = []
    changed = true
  }
  const validConvs = conversations.filter(c => c && typeof c.id === 'string' && c.id.length > 0)
  if (validConvs.length !== conversations.length) {
    conversations = validConvs
    changed = true
  }
  if (!messages || typeof messages !== 'object') {
    messages = {}
    changed = true
  }

  // Step 1: ID 映射 + 按新 ID 分组合并
  const convMap = new Map<string, IConversation>()
  const msgMap = new Map<string, IMessage[]>()

  for (const conv of conversations) {
    const newId = normalizeConversationId(conv)
    if (newId !== conv.id) changed = true

    const existing = convMap.get(newId)
    if (!existing) {
      convMap.set(newId, {
        ...conv,
        id: newId,
        // 确保三未读字段都有数值
        unreadCustomer: conv.unreadCustomer ?? conv.unreadCount ?? 0,
        unreadMerchant: conv.unreadMerchant ?? conv.unreadCount ?? 0,
        unreadRider: conv.unreadRider ?? 0,
      })
    } else {
      // 合并：取各字段的"更完整值"，未读取最大值
      const merged: IConversation = {
        ...existing,
        customerName: existing.customerName || conv.customerName,
        customerAvatar: existing.customerAvatar || conv.customerAvatar,
        merchantName: existing.merchantName || conv.merchantName,
        merchantAvatar: existing.merchantAvatar || conv.merchantAvatar,
        riderId: existing.riderId || conv.riderId,
        riderName: existing.riderName || conv.riderName,
        riderAvatar: existing.riderAvatar || conv.riderAvatar,
        lastMessage: pickLater(existing.lastMessage, existing.lastMessageAt, conv.lastMessage, conv.lastMessageAt),
        lastMessageAt: Math.max(existing.lastMessageAt ?? 0, conv.lastMessageAt ?? 0) || undefined,
        unreadCustomer: Math.max(existing.unreadCustomer ?? 0, conv.unreadCustomer ?? conv.unreadCount ?? 0),
        unreadMerchant: Math.max(existing.unreadMerchant ?? 0, conv.unreadMerchant ?? conv.unreadCount ?? 0),
        unreadRider: Math.max(existing.unreadRider ?? 0, conv.unreadRider ?? 0),
        createdAt: Math.min(existing.createdAt, conv.createdAt),
      }
      convMap.set(newId, merged)
      changed = true
    }

    // 消息也合并（防御：消息必须是数组）
    const rawMsgs = messages[conv.id]
    const oldMsgs = Array.isArray(rawMsgs) ? rawMsgs.filter(m => m && typeof m.id === 'string') : []
    if (oldMsgs.length > 0) {
      const existingMsgs = msgMap.get(newId) || []
      const allMsgs = [...existingMsgs, ...oldMsgs]
      // 按 ID 去重 + 时间排序
      const seen = new Set<string>()
      const unique = allMsgs.filter(m => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      }).sort((a, b) => a.createdAt - b.createdAt)
      msgMap.set(newId, unique)
      // 只有发生了去重（合并时）才算 changed；首次塞入不算
      if (existingMsgs.length > 0 && unique.length !== existingMsgs.length + oldMsgs.length) {
        changed = true
      }
    }
  }

  // Step 2: 清除空壳会话（无消息且无 lastMessageAt 的空会话）
  const resultConvs: IConversation[] = []
  for (const [id, conv] of convMap) {
    const msgs = msgMap.get(id) || []
    const isEmpty = msgs.length === 0 && !conv.lastMessageAt
    if (isEmpty) {
      changed = true
      continue
    }
    // 补全 convType
    const type = getChatType(id)
    const convType = type === 'shop' ? 'shop' : 'order'
    if (conv.convType !== convType) {
      changed = true
    }
    // 补 orderId 字段（om:/or:/rm: 从 id 中提取，shop 类填空字符串保持类型）
    const orderId = type === 'shop' ? (conv.orderId || '') : id.slice(3)
    if (conv.orderId !== orderId) changed = true

    resultConvs.push({
      ...conv,
      convType,
      orderId,
      // 移除老字段
      unreadCount: undefined,
    })
  }

  const resultMsgs: Record<string, IMessage[]> = {}
  for (const [id, msgs] of msgMap) {
    if (resultConvs.some(c => c.id === id)) {
      resultMsgs[id] = msgs
    }
  }

  return {
    state: { conversations: resultConvs, messages: resultMsgs },
    changed,
  }
}

function normalizeConversationId(conv: IConversation): string {
  const id = conv.id

  // 已是新格式
  if (/^(shop|om|or|rm):/.test(id)) return id

  // shop-{shopId}[-customer][-merchant] 等老格式
  if (id.startsWith('shop-')) {
    const match = id.match(/^shop-([^-]+)/)
    if (match) return `shop:${match[1]}`
  }

  // 订单老格式：{orderId}-customer-merchant / {orderId}-customer-rider / {orderId}-rider-merchant
  const orderMatch = id.match(/^(.+)-(customer-merchant|merchant-customer|customer-rider|rider-customer|rider-merchant|merchant-rider)$/)
  if (orderMatch) {
    const orderId = orderMatch[1]
    const rolePair = orderMatch[2]
    if (rolePair.includes('customer') && rolePair.includes('merchant')) return `om:${orderId}`
    if (rolePair.includes('customer') && rolePair.includes('rider')) return `or:${orderId}`
    if (rolePair.includes('rider') && rolePair.includes('merchant')) return `rm:${orderId}`
  }

  // unknown-xxx 等未知格式，先保留原值（避免丢数据）
  return id
}

function pickLater(a: string | undefined, at: number | undefined, b: string | undefined, bt: number | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  return (bt ?? 0) > (at ?? 0) ? b : a
}

// ========== 读写 ==========

function readMessagesState(): MessagesState {
  try {
    const stored = scopedStorage.getItem(MESSAGE_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as MessagesState
      const { state: normalized, changed } = normalizeState(parsed)
      if (changed) {
        scopedStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(normalized))
      }
      return normalized
    }
  } catch {
    // ignore
  }
  return { conversations: [], messages: {} }
}

function saveMessagesState(state: MessagesState) {
  scopedStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(state))
  notifyMessagesChange()
}

// ========== 对方信息解析 ==========

export interface PeerInfo {
  name: string
  avatar: string
  role: UserRole
  sub: string // 副信息：店铺咨询 / 订单后6位
  shopId?: string
  orderId?: string
}

export function getPeerInfo(conv: IConversation, myRole: UserRole): PeerInfo {
  // ✅ 入参防御：任何字段缺失都保证返回可渲染的兜底值
  const convId = (conv && typeof conv.id === 'string') ? conv.id : 'unknown'
  const type = getChatType(convId)
  const shopId = type === 'shop' ? convId.slice(5) : undefined
  const orderId = type !== 'shop' ? convId.slice(3) : undefined

  let name = ''
  let avatar = ''
  let role: UserRole = 'customer'
  let sub = ''

  if (myRole === 'customer') {
    if (type === 'shop' || type === 'om') {
      name = conv.merchantName || '商家'
      avatar = conv.merchantAvatar || ''
      role = 'merchant'
      sub = type === 'shop' ? '店铺咨询' : `订单 ${orderId?.slice(-6)}`
    } else if (type === 'or') {
      name = conv.riderName || '骑手'
      avatar = conv.riderAvatar || ''
      role = 'rider'
      sub = `订单 ${orderId?.slice(-6)}`
    }
  } else if (myRole === 'merchant') {
    if (type === 'shop' || type === 'om') {
      name = conv.customerName || '顾客'
      avatar = conv.customerAvatar || ''
      role = 'customer'
      sub = type === 'shop' ? '店铺咨询' : `订单 ${orderId?.slice(-6)}`
    } else if (type === 'rm') {
      name = conv.riderName || '骑手'
      avatar = conv.riderAvatar || ''
      role = 'rider'
      sub = `订单 ${orderId?.slice(-6)}`
    }
  } else {
    // rider
    if (type === 'or') {
      name = conv.customerName || '顾客'
      avatar = conv.customerAvatar || ''
      role = 'customer'
      sub = `订单 ${orderId?.slice(-6)}`
    } else if (type === 'rm') {
      name = conv.merchantName || '商家'
      avatar = conv.merchantAvatar || ''
      role = 'merchant'
      sub = `订单 ${orderId?.slice(-6)}`
    }
  }

  return { name, avatar, role, sub, shopId, orderId }
}

// 首字头像（无真实头像时的占位）
function getInitial(name: string): string {
  if (!name) return '?'
  return name.charAt(0)
}

// ========== Hook ==========

export function useMessages() {
  const { user } = useAuth()
  const myRole = (user.role || 'customer') as UserRole
  const [state, setState] = useState<MessagesState>(() => readMessagesState())
  // 已同步到数据库的消息 id / 会话快照（第 2 期 2c）
  const syncedMsgIdsRef = useRef<Set<string>>(new Set())
  const syncedConvRef = useRef<Map<string, string>>(new Map())

  // ==========================================================================
  // 第 2 期 2c：会话与消息与数据库双向镜像
  //   读：登录后拉一遍（RLS 限定为会话参与方），数据库覆盖同名会话、
  //       本地独有的保留（例如内置演示店的咨询会话无法入库）。
  //   写：先确保会话行存在（消息外键指向它），再插入新消息，最后回写会话的未读/最后一条消息。
  //   既有逻辑（会话 id 规则、三端未读分别计数）完全不动。
  // ==========================================================================
  useEffect(() => {
    if (!supabase || !user.loggedIn) return
    let cancelled = false
    void (async () => {
      const remote = await fetchVisibleMessages()
      if (cancelled || !remote) return
      remote.conversations.forEach(c => syncedConvRef.current.set(c.id, JSON.stringify(c)))
      Object.values(remote.messages).flat().forEach(m => syncedMsgIdsRef.current.add(m.id))
      setState(prev => {
        const remoteIds = new Set(remote.conversations.map(c => c.id))
        const localOnly = prev.conversations.filter(c => !remoteIds.has(c.id))
        const conversations = [...localOnly, ...remote.conversations]
        const messages: Record<string, IMessage[]> = { ...prev.messages }
        for (const [cid, list] of Object.entries(remote.messages)) {
          const seen = new Set(list.map(m => m.id))
          const localKept = (prev.messages[cid] ?? []).filter(m => !seen.has(m.id))
          messages[cid] = [...localKept, ...list].sort((a, b) => a.createdAt - b.createdAt)
        }
        const merged: MessagesState = { conversations, messages }
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev
        saveMessagesState(merged)
        return merged
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user.id, user.loggedIn])

  // 回写数据库
  useEffect(() => {
    if (!supabase || !user.loggedIn) return
    let cancelled = false
    void (async () => {
      // 1) 会话必须先在库里存在，否则消息的 conversation_id 外键会失败
      const syncable = new Set<string>()
      for (const c of state.conversations) {
        if (!canSyncConversation(c)) continue
        syncable.add(c.id)
        const json = JSON.stringify(c)
        if (syncedConvRef.current.get(c.id) === json) continue
        const ok = await upsertConversation(c)
        if (cancelled) return
        if (ok) syncedConvRef.current.set(c.id, json)
      }
      // 2) 插入新消息（只增不改）
      const pending = Object.values(state.messages)
        .flat()
        .filter(m => syncable.has(m.conversationId) && !syncedMsgIdsRef.current.has(m.id))
        .sort((a, b) => a.createdAt - b.createdAt)
      for (const m of pending) {
        const ok = await insertMessage(m)
        if (cancelled) return
        if (ok) syncedMsgIdsRef.current.add(m.id)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state, user.id, user.loggedIn])

  // 同窗口 CustomEvent 同步
  useEffect(() => {
    const handler = () => {
      const newState = readMessagesState()
      setState(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newState)) return prev
        return newState
      })
    }
    window.addEventListener(MESSAGES_CHANGE_EVENT, handler)
    return () => window.removeEventListener(MESSAGES_CHANGE_EVENT, handler)
  }, [])

  // 跨标签页 storage 事件同步
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.includes(MESSAGE_STORAGE_KEY)) {
        const newState = readMessagesState()
        setState(prev => {
          if (JSON.stringify(prev) === JSON.stringify(newState)) return prev
          return newState
        })
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // 获取或创建会话（纯函数 ID 生成，保证同一语义永远同 ID）
  const getOrCreateConversation = useCallback((
    params:
      | { type: 'shop'; shopId: string; meta: { customerId: string; customerName: string; customerAvatar: string; merchantId: string; merchantName: string; merchantAvatar: string } }
      | { type: 'om' | 'or' | 'rm'; orderId: string; meta: { customerId: string; customerName: string; customerAvatar: string; merchantId: string; merchantName: string; merchantAvatar: string; riderId?: string; riderName?: string; riderAvatar?: string } },
  ): IConversation => {
    const convId = params.type === 'shop'
      ? getConversationId({ type: 'shop', shopId: params.shopId })
      : getConversationId({ type: params.type, orderId: params.orderId })

    const existing = state.conversations.find(c => c.id === convId)
    if (existing) return existing

    const newConv: IConversation = {
      id: convId,
      orderId: params.type === 'shop' ? '' : params.orderId,
      convType: params.type === 'shop' ? 'shop' : 'order',
      customerId: params.meta.customerId,
      customerName: params.meta.customerName,
      customerAvatar: params.meta.customerAvatar,
      merchantId: params.meta.merchantId,
      merchantName: params.meta.merchantName,
      merchantAvatar: params.meta.merchantAvatar,
      riderId: 'riderId' in params.meta ? params.meta.riderId : undefined,
      riderName: 'riderName' in params.meta ? params.meta.riderName : undefined,
      riderAvatar: 'riderAvatar' in params.meta ? params.meta.riderAvatar : undefined,
      unreadCustomer: 0,
      unreadMerchant: 0,
      unreadRider: 0,
      createdAt: Date.now(),
    }

    const newState: MessagesState = {
      conversations: [...state.conversations, newConv],
      messages: { ...state.messages, [convId]: [] },
    }
    saveMessagesState(newState)
    setState(newState)
    return newConv
  }, [state])

  // 获取某个会话的消息
  const getMessages = useCallback((conversationId: string): IMessage[] => {
    return state.messages[conversationId] || []
  }, [state.messages])

  // 发送消息
  const sendMessage = useCallback((
    conversationId: string,
    content: string,
    senderInfo: { id: string; name: string; avatar: string; role: UserRole },
  ): IMessage => {
    // 消息 id 用 uuid：数据库 messages.id 是 uuid，原来的 MSG-xxx 形态写不进去（第 2 期 2c）
    let msgId: string
    try {
      msgId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    } catch {
      msgId = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }
    const msg: IMessage = {
      id: msgId,
      conversationId,
      senderId: senderInfo.id,
      senderName: senderInfo.name,
      senderAvatar: senderInfo.avatar,
      senderRole: senderInfo.role,
      content,
      type: 'text',
      createdAt: Date.now(),
      read: false,
    }

    const peerRoleVal = getPeerRole(conversationId, senderInfo.role)

    setState(prev => {
      const convMessages = prev.messages[conversationId] || []
      const newMessages = [...convMessages, msg]
      const newConversations = prev.conversations.map(c => {
        if (c.id !== conversationId) return c
        const updates: Partial<IConversation> = {
          lastMessage: content,
          lastMessageAt: msg.createdAt,
        }
        if (peerRoleVal) {
          const field = getUnreadField(peerRoleVal)
          updates[field] = (c[field] ?? 0) + 1
        }
        return { ...c, ...updates }
      })
      const newState: MessagesState = {
        conversations: newConversations,
        messages: { ...prev.messages, [conversationId]: newMessages },
      }
      saveMessagesState(newState)
      return newState
    })

    return msg
  }, [])

  // 标记会话已读（只清当前查看者角色自己的未读）
  const markConversationRead = useCallback((conversationId: string, viewerRole: UserRole) => {
    setState(prev => {
      const field = getUnreadField(viewerRole)
      const changed = prev.conversations.find(c => c.id === conversationId && (c[field] ?? 0) > 0)
      if (!changed) return prev
      const newConversations = prev.conversations.map(c =>
        c.id === conversationId ? { ...c, [field]: 0 } : c,
      )
      const newState: MessagesState = { ...prev, conversations: newConversations }
      saveMessagesState(newState)
      return newState
    })
  }, [])

  // 删除会话（同时删除消息）
  const deleteConversation = useCallback((conversationId: string) => {
    setState(prev => {
      const newConversations = prev.conversations.filter(c => c.id !== conversationId)
      const newMessages = { ...prev.messages }
      delete newMessages[conversationId]
      const newState: MessagesState = { conversations: newConversations, messages: newMessages }
      saveMessagesState(newState)
      return newState
    })
  }, [])

  // 当前用户可管理的店铺 ID 列表（仅商家端有意义）
  // - 演示账号（merchant_demo）：所有 8 家演示店都能管
  // - 自建商家：只有 user.shopId 对应的那一家
  const manageableShopIds = useMemo((): string[] => {
    if (myRole !== 'merchant') return []
    if (user.id === 'merchant_demo') {
      return getAllShops().map(s => s.id)
    }
    return user.shopId ? [user.shopId] : []
  }, [myRole, user.id, user.shopId])

  // 当前用户视角的 IM 未读总数
  const totalUnread = useMemo((): number => {
    const field = getUnreadField(myRole)
    return state.conversations.reduce((sum, c) => {
      if (!isRoleInConversation(c, myRole)) return sum
      // 商家端只统计可管理店铺的会话
      if (myRole === 'merchant' && c.merchantId && !manageableShopIds.includes(c.merchantId)) return sum
      return sum + (c[field] ?? 0)
    }, 0)
  }, [state.conversations, myRole, manageableShopIds])

  // 当前用户视角的会话列表（按最后消息时间倒序）
  const myConversations = useMemo((): IConversation[] => {
    return state.conversations
      .filter(c => isRoleInConversation(c, myRole))
      .filter(c => {
        // 商家端额外按可管理店铺过滤：店铺咨询看 merchantId，订单会话也看 merchantId
        if (myRole === 'merchant' && c.merchantId) {
          return manageableShopIds.includes(c.merchantId)
        }
        return true
      })
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
  }, [state.conversations, myRole, manageableShopIds])

  // 系统消息（不加未读，仅作时间线提示）
  const sendSystemMessage = useCallback((conversationId: string, content: string) => {
    const msg: IMessage = {
      id: `SYS-${Date.now()}`,
      conversationId,
      senderId: 'system',
      senderName: '系统',
      senderAvatar: '',
      senderRole: 'system',
      content,
      type: 'system',
      createdAt: Date.now(),
      read: false,
    }
    setState(prev => {
      const convMessages = prev.messages[conversationId] || []
      const newMessages = [...convMessages, msg]
      const newConversations = prev.conversations.map(c =>
        c.id === conversationId
          ? { ...c, lastMessage: `[系统] ${content}`, lastMessageAt: msg.createdAt }
          : c,
      )
      const newState: MessagesState = {
        conversations: newConversations,
        messages: { ...prev.messages, [conversationId]: newMessages },
      }
      saveMessagesState(newState)
      return newState
    })
  }, [])

  // 工具：获取当前用户信息（用于发送消息时填充 senderInfo）
  const me = useMemo(() => {
    const id = user.id || `${myRole}_default`
    const name = user.nickname || (myRole === 'customer' ? '顾客' : myRole === 'merchant' ? '商家' : '骑手')
    const avatar = user.avatar || ''
    return { id, name, avatar, role: myRole }
  }, [user, myRole])

  return {
    conversations: state.conversations,
    getOrCreateConversation,
    getMessages,
    sendMessage,
    markConversationRead,
    deleteConversation,
    totalUnread,
    myConversations,
    getPeerInfo: (conv: IConversation) => getPeerInfo(conv, myRole),
    getConversationByConvId: (convId: string) => state.conversations.find(c => c.id === convId) || null,
    manageableShopIds,
    sendSystemMessage,
    myRole,
    me,
    getInitial,
  }
}
