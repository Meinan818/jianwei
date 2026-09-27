/**
 * 第 3 期：Supabase Realtime 订阅（跨设备实时推送）
 *
 * 设计思路（延续第 2 期「缓存 + 事件」的做法，把改动面压到最小）：
 *   不解析推送里的载荷，只把推送当成「这几张表有变化了」的信号；
 *   收到信号后调用各数据模块自己的「从数据库重拉」函数（普通 SELECT，RLS 照常生效），
 *   再由它们派发原有的 CustomEvent 让页面重渲染。
 *
 *   好处：页面代码与业务逻辑一行都不用改，也不需要为每张表写一套增量合并逻辑；
 *   跨设备的「谁改了哪一行」由数据库回答，客户端只负责重新读一遍。
 *
 * 降级：未配置 Supabase、未登录、断网或订阅失败时全部静默降级，
 *   退回第 2 期「要手动刷新才看得到」的行为，绝不阻断页面。
 *
 * ⚠️ 数据库侧的两个前提（见 supabase/migrations/20260927000000_realtime_replica_identity.sql）：
 *   1) 表必须加入 supabase_realtime publication（orders / messages 已有，conversations 本次补上）；
 *   2) orders 的 RLS 策略 reads orders.* 多列，需要 REPLICA IDENTITY FULL，
 *      否则订单更新的推送会被静默丢弃。
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** 需要「收到变化后重拉」的数据类别 */
export type RealtimeKind = 'orders' | 'messages'

type RefreshHandler = () => void | Promise<void>

const handlers: Record<RealtimeKind, Set<RefreshHandler>> = {
  orders: new Set(),
  messages: new Set(),
}

/**
 * 防抖窗口：一次写库常常连着动多张表
 * （下单 = orders + order_items；发消息 = conversations + messages），
 * 合并成一次重拉，避免同一秒里打三四个查询。
 */
const DEBOUNCE_MS = 300
const timers = new Map<RealtimeKind, ReturnType<typeof setTimeout>>()

let channel: RealtimeChannel | null = null
let currentUserId = ''

function runHandlers(kind: RealtimeKind) {
  timers.delete(kind)
  for (const fn of Array.from(handlers[kind])) {
    try {
      const result = fn()
      if (result && typeof result.then === 'function') {
        result.catch(err => console.warn('[realtime] 重拉数据失败', kind, err))
      }
    } catch (err) {
      console.warn('[realtime] 重拉数据异常', kind, err)
    }
  }
}

function schedule(kind: RealtimeKind) {
  const timer = timers.get(kind)
  if (timer) clearTimeout(timer)
  timers.set(
    kind,
    setTimeout(() => runHandlers(kind), DEBOUNCE_MS),
  )
}

/**
 * 注册某类数据的「从数据库重拉」回调，返回取消注册的函数
 * （React 的 useEffect cleanup 可以直接返回它）。
 */
export function registerRealtimeRefresh(kind: RealtimeKind, handler: RefreshHandler): () => void {
  handlers[kind].add(handler)
  return () => {
    handlers[kind].delete(handler)
  }
}

/**
 * 建立当前账号的实时订阅。同一个账号重复调用只会订阅一次；
 * 换成别的账号会先拆掉旧的再重连（避免上一个账号的推送漏进新会话）。
 */
export function startRealtime(userId: string): void {
  if (!supabase || !userId) return
  if (channel && currentUserId === userId) return
  stopRealtime()
  currentUserId = userId

  try {
    const ch = supabase.channel(`realtime:app:${userId}`)
    // 订单主表 + 明细表任一变化都重拉订单；会话与消息任一变化都重拉消息。
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => schedule('orders'))
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => schedule('orders'))
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => schedule('messages'))
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => schedule('messages'))
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.info('[realtime] 已订阅订单与消息的实时变更')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // 不弹提示：断线时功能退回「手动刷新」，用户无感知地继续可用
        console.warn(`[realtime] 订阅状态 ${status}，实时刷新暂停（不影响页面其他功能）`)
      }
    })
    channel = ch
  } catch (err) {
    console.warn('[realtime] 建立订阅失败，退回手动刷新', err)
    channel = null
    currentUserId = ''
  }
}

/** 拆掉实时订阅（登出、切换账号时调用） */
export function stopRealtime(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  const previous = channel
  channel = null
  currentUserId = ''
  if (previous && supabase) {
    try {
      void supabase.removeChannel(previous)
    } catch (err) {
      console.warn('[realtime] 关闭订阅失败', err)
    }
  }
}
