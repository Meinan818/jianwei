/**
 * 第 2 期 2c：会话与消息读写数据库（Supabase）
 *
 * 与店铺/订单同样的思路——在 useMessages 的 state 之上加镜像层，
 * 既有逻辑（会话 id 规则、三端未读分别计数、消息合并）完全不动。
 *
 * 会话 id 沿用前端语义前缀（shop: / om: / or: / rm:）直接作为数据库主键，
 * 因此前后端不需要再做一层 id 映射（数据库里 conversations.id 就是 text）。
 *
 * ⚠️ 限制：conversations 的 customer_id / merchant_id 是外键，必须指向真实 profile。
 *    内置演示店（owner_id 为空）没有对应商家账号，这类咨询会话无法入库，
 *    会保持"仅本地"——跨设备聊天只对「店铺有真实归属」的会话生效。
 */
import { supabase } from '@/lib/supabase'
import type { IConversation, IMessage } from './messages'

const uuidLike = (v?: string | null): boolean => !!v && /^[0-9a-f-]{36}$/i.test(v)
const ts = (v: unknown): number | undefined => (v ? Date.parse(String(v)) : undefined)
const iso = (v: number | undefined): string | null => (v ? new Date(v).toISOString() : null)

/** 数据库行 → 前端 IConversation */
function rowToConversation(r: Record<string, any>): IConversation {
  return {
    id: r.id,
    orderId: r.order_id ?? '',
    convType: r.conv_type === 'shop' ? 'shop' : 'order',
    customerId: r.customer_id,
    customerName: r.customer_name ?? '',
    customerAvatar: r.customer_avatar ?? '',
    merchantId: r.merchant_id,
    merchantName: r.merchant_name ?? '',
    merchantAvatar: r.merchant_avatar ?? '',
    ...(r.rider_id ? { riderId: r.rider_id } : {}),
    ...(r.rider_name ? { riderName: r.rider_name } : {}),
    ...(r.rider_avatar ? { riderAvatar: r.rider_avatar } : {}),
    ...(r.last_message ? { lastMessage: r.last_message } : {}),
    ...(r.last_message_at ? { lastMessageAt: ts(r.last_message_at) } : {}),
    unreadCustomer: Number(r.unread_customer ?? 0),
    unreadMerchant: Number(r.unread_merchant ?? 0),
    unreadRider: Number(r.unread_rider ?? 0),
    createdAt: ts(r.created_at) ?? Date.now(),
  }
}

/** 数据库行 → 前端 IMessage */
function rowToMessage(r: Record<string, any>): IMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name ?? '',
    senderAvatar: r.sender_avatar ?? '',
    senderRole: r.sender_role,
    content: r.content,
    type: r.msg_type === 'system' ? 'system' : 'text',
    createdAt: ts(r.created_at) ?? Date.now(),
    read: Boolean(r.is_read),
  }
}

/**
 * 会话能否入库：参与双方必须是真实 profile（内置演示店无商家账号，无法入库）。
 * 无法入库的会话保持纯本地行为，不影响单机演示。
 */
export function canSyncConversation(c: IConversation): boolean {
  return uuidLike(c.customerId) && uuidLike(c.merchantId)
}

/** 读取当前账号可见的会话与消息（RLS 限定为会话参与方） */
export async function fetchVisibleMessages(): Promise<
  { conversations: IConversation[]; messages: Record<string, IMessage[]> } | null
> {
  const sb = supabase
  if (!sb) return null
  const { data: convRows, error } = await sb
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error || !convRows) {
    console.warn('[messages] 读取会话失败', error)
    return null
  }
  const conversations = convRows.map(rowToConversation)
  const messages: Record<string, IMessage[]> = {}
  conversations.forEach(c => {
    messages[c.id] = []
  })
  if (convRows.length > 0) {
    const { data: msgRows, error: msgErr } = await sb
      .from('messages')
      .select('*')
      .in('conversation_id', convRows.map(c => c.id))
      .order('created_at')
    if (msgErr) console.warn('[messages] 读取消息失败', msgErr)
    for (const r of msgRows ?? []) {
      const m = rowToMessage(r)
      ;(messages[m.conversationId] ??= []).push(m)
    }
  }
  return { conversations, messages }
}

/** 写入/更新会话（含三端未读与最后一条消息） */
export async function upsertConversation(c: IConversation): Promise<boolean> {
  const sb = supabase
  if (!sb || !canSyncConversation(c)) return false
  try {
    const row = {
      id: c.id,
      conv_type: c.convType ?? 'order',
      order_id: uuidLike(c.orderId) ? c.orderId : null,
      customer_id: c.customerId,
      merchant_id: c.merchantId,
      rider_id: uuidLike(c.riderId) ? c.riderId : null,
      customer_name: c.customerName,
      customer_avatar: c.customerAvatar || null,
      merchant_name: c.merchantName,
      merchant_avatar: c.merchantAvatar || null,
      rider_name: c.riderName ?? null,
      rider_avatar: c.riderAvatar ?? null,
      last_message: c.lastMessage ?? null,
      last_message_at: iso(c.lastMessageAt),
      unread_customer: c.unreadCustomer ?? 0,
      unread_merchant: c.unreadMerchant ?? 0,
      unread_rider: c.unreadRider ?? 0,
    }
    // 刻意不用 .upsert()：upsert 走 INSERT ... ON CONFLICT DO UPDATE，
    // 冲突分支会改用「更新」策略判定，实测在 RLS 下会莫名被拒（同样的数据普通 INSERT 却能通过）。
    // 这里显式「先插、冲突再改」，两条路径各自只走自己那套策略。
    const ins = await sb.from('conversations').insert(row)
    if (!ins.error) return true
    if (ins.error.code === '23505') {
      const upd = await sb.from('conversations').update(row).eq('id', c.id)
      if (!upd.error) return true
      console.warn('[messages] 更新会话失败', c.id, upd.error.message)
      return false
    }
    console.warn('[messages] 写入会话失败', c.id, ins.error.message)
    return false
  } catch (err) {
    console.warn('[messages] 写入会话异常', err)
    return false
  }
}

/** 追加一条消息（消息是只增不改的，重复插入忽略即可） */
export async function insertMessage(m: IMessage): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  try {
    const row = {
      id: m.id,
      conversation_id: m.conversationId,
      sender_id: m.senderId,
      sender_role: m.senderRole,
      sender_name: m.senderName,
      sender_avatar: m.senderAvatar || null,
      content: m.content,
      msg_type: m.type ?? 'text',
      is_read: Boolean(m.read),
      created_at: iso(m.createdAt) ?? new Date().toISOString(),
    }
    const ins = await sb.from('messages').insert(row)
    if (!ins.error) return true
    // 23505 = 主键冲突：这条消息已经在库里了，视为成功（消息只增不改）
    if (ins.error.code === '23505') return true
    console.warn('[messages] 写消息失败', m.id, ins.error.message)
    return false
  } catch (err) {
    console.warn('[messages] 写消息异常', err)
    return false
  }
}
