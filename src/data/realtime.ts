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
 * ⚠️ 数据库侧的前提：表必须加入 supabase_realtime publication，变更事件才会发出。
 *   init 脚本已包含 orders / order_items / messages 等；
 *   conversations 与商家侧配置表（shops / categories / dishes / shop_activities / 规格加料）
 *   由 supabase/migrations/20260927000000_realtime_conversations.sql 与
 *   20260927010000_realtime_shop_config.sql 补上（两段都可重复执行）。
 *
 *   注：**不需要** REPLICA IDENTITY FULL——本项目收到推送一律重新查库、不读事件载荷；
 *   这一点用 scripts/verify-realtime.mjs 对真实数据库实测确认过（见 docs/交接说明.md）。
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** 需要「收到变化后重拉」的数据类别 */
export type RealtimeKind = 'orders' | 'messages' | 'shops'

type RefreshHandler = () => void | Promise<void>

const handlers: Record<RealtimeKind, Set<RefreshHandler>> = {
  orders: new Set(),
  messages: new Set(),
  shops: new Set(),
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
    // 第 2 期 2h：商家侧配置（上下架、改价、活动、店铺公告…）变化后重拉店铺数据，
    // 这样商家在商家端改完，顾客端不刷新就能看到新价格/下架状态。
    for (const table of ['shops', 'categories', 'dishes', 'shop_activities', 'dish_spec_groups', 'dish_spec_options', 'dish_extras']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule('shops'))
    }
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.info('[realtime] 已订阅订单、消息与店铺配置的实时变更')
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
