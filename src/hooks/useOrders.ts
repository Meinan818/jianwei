import { useState, useEffect, useCallback, useRef } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IOrder, OrderStatus, IRefundRequest, RefundStatus, IDeliveryException, DeliveryExceptionType } from '@/data/order'
import { SHOP_STATUS_KEY } from '@/data/shop-status'
import type { IShopStatus } from '@/data/shop-status'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { fetchVisibleOrders, upsertOrder } from '@/data/orders-remote'
import { registerRealtimeRefresh } from '@/data/realtime'

const ORDERS_KEY = 'food_delivery_orders'
const ORDERS_CHANGE_EVENT = 'food_delivery_orders_change'

/**
 * 订单 id 生成（第 2 期 2b）。
 * 数据库 orders.id 是 uuid，原来用的 `ORD+时间戳` 写不进去，所以新订单改用 uuid；
 * 界面上的"订单号"由 formatOrderNo() 用数据库自增列 order_seq 展示。
 */
function newOrderId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `ORD${Date.now()}`
}

// ========== 订单字段归一化（防御脏数据，避免整页 ErrorBoundary） ==========
function normalizeOrder(raw: any): IOrder {
  const o = (raw || {}) as any
  const createdAt = Number(o.createdAt) || Date.now()
  const status: OrderStatus =
    (['pending', 'preparing', 'ready', 'picked', 'delivering', 'delivered', 'cancelled'].includes(o.status)
      ? o.status
      : 'pending') as OrderStatus

  // address 归一化：兼容 address 对象 / deliveryAddress 字符串 / 无地址
  let address = { name: '', phone: '', address: '', detail: '' }
  if (o.address && typeof o.address === 'object') {
    address = {
      name: String(o.address.name || o.customerName || ''),
      phone: String(o.address.phone || o.customerPhone || ''),
      address: String(o.address.address || ''),
      detail: String(o.address.detail || ''),
    }
  } else if (typeof o.deliveryAddress === 'string') {
    address.name = String(o.customerName || '')
    address.phone = String(o.customerPhone || '')
    address.detail = o.deliveryAddress
  } else if (o.customerName) {
    address.name = String(o.customerName)
    address.phone = String(o.customerPhone || '')
  }
  if (!address.name && o.customerName) address.name = String(o.customerName)
  if (!address.phone && o.customerPhone) address.phone = String(o.customerPhone)

  // items 归一化：兼容 IOrderItem 结构 / { name, price, quantity } 简结构
  const rawItems = Array.isArray(o.items) ? o.items : []
  const items: IOrder['items'] = rawItems.map((it: any, idx: number) => ({
    dishId: String(it.dishId || it.id || `item_${idx}`),
    dishName: String(it.dishName || it.name || '商品'),
    basePrice: Number(it.basePrice ?? it.price ?? 0),
    finalPrice: Number(it.finalPrice ?? it.price ?? it.basePrice ?? 0),
    quantity: Number(it.quantity ?? 1),
    image: String(it.image || it.imageUrl || ''),
    specs: Array.isArray(it.specs) ? it.specs : [],
    extras: Array.isArray(it.extras) ? it.extras : [],
    skuKey: String(it.skuKey || ''),
  }))

  // 金额归一化
  const totalAmount = Number(o.totalAmount ?? 0)
  const packingFee = Number(o.packingFee ?? o.packAmount ?? 0)
  const deliveryFee = Number(o.deliveryFee ?? 0)
  const discount = Number(o.discount ?? 0)
  const finalAmount = Number(o.finalAmount ?? o.payAmount ?? totalAmount + packingFee + deliveryFee - discount)

  // 时间线：如果没有就按 status 现造
  let statusTimeline: IOrder['statusTimeline'] = Array.isArray(o.statusTimeline) && o.statusTimeline.length > 0
    ? o.statusTimeline
    : buildTimeline(status, createdAt)

  return {
    id: String(o.id || `ORD_${createdAt}`),
    shopId: String(o.shopId || ''),
    shopName: String(o.shopName || ''),
    shopCover: String(o.shopCover || o.cover || ''),
    items,
    totalAmount,
    packingFee,
    deliveryFee,
    discount,
    promoDiscount: Number(o.promoDiscount ?? 0),
    couponDiscount: Number(o.couponDiscount ?? 0),
    newUserDiscount: Number(o.newUserDiscount ?? 0),
    freeDeliveryDiscount: Number(o.freeDeliveryDiscount ?? 0),
    couponInfo: o.couponInfo,
    promoInfo: o.promoInfo,
    finalAmount,
    address,
    remark: String(o.remark || ''),
    utensils: Number(o.utensils ?? 1),
    paymentMethod: String(o.paymentMethod || 'wechat'),
    paidAt: o.paidAt ? Number(o.paidAt) : undefined,
    payExpireAt: o.payExpireAt ? Number(o.payExpireAt) : undefined,
    acceptExpireAt: o.acceptExpireAt ? Number(o.acceptExpireAt) : undefined,
    appointmentTime: o.appointmentTime,
    deliveryMode: o.deliveryMode === 'appointment' ? 'appointment' : 'instant',
    status,
    customerId: String(o.customerId || ''),
    statusTimeline,
    createdAt,
    reviewed: Boolean(o.reviewed || o.rated),
    riderId: o.riderId ? String(o.riderId) : undefined,
    riderName: o.riderName ? String(o.riderName) : undefined,
    riderPhone: o.riderPhone ? String(o.riderPhone) : undefined,
    riderEarning: o.riderEarning != null ? Number(o.riderEarning) : undefined,
    distance: o.distance != null ? String(o.distance) : undefined,
    estimatedTime: o.estimatedTime || o.estimatedDeliveryTime,
    rejectReason: o.rejectReason,
    cancelReason: o.cancelReason,
    cancelledBy: o.cancelledBy,
    readyAt: o.readyAt ? Number(o.readyAt) : undefined,
    arrivedAt: o.arrivedAt ? Number(o.arrivedAt) : undefined,
    pickedAt: o.pickedAt ? Number(o.pickedAt) : undefined,
    deliveringAt: o.deliveringAt ? Number(o.deliveringAt) : undefined,
    deliveredAt: o.deliveredAt ? Number(o.deliveredAt) : undefined,
    urgeCount: o.urgeCount != null ? Number(o.urgeCount) : undefined,
    lastUrgeAt: o.lastUrgeAt ? Number(o.lastUrgeAt) : undefined,
    urgeReason: o.urgeReason,
    refundRequest: o.refundRequest,
    deliveryExceptions: o.deliveryExceptions,
  }
}

function normalizeOrders(raw: any[]): IOrder[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeOrder)
}

// ========== 超时常量（统一管理，便于修改） ==========
export const PAY_TIMEOUT_MS = 15 * 60 * 1000       // 待支付 15 分钟
// 商家接单超时：现场演示要切端、讲解，3 分钟容易在讲别的功能时误触发
// 顾客端「商家暂未接单，您可催单或取消订单」提示条与商家端「已超时」标签，看着像系统出问题。
// 放宽到 8 分钟作为演示保险；要专门演示「超时提醒」这个功能时，
// 把这里临时改成 20 * 1000（20 秒）即可，改完记得跑一次构建。
export const MERCHANT_ACCEPT_TIMEOUT_MS = 8 * 60 * 1000 // 商家接单 8 分钟（正式口径 15 分钟）

// 触发订单变更事件（同一页面内多组件 hook 实例同步）
function notifyOrdersChange() {
  try {
    window.dispatchEvent(new CustomEvent(ORDERS_CHANGE_EVENT))
  } catch {
    // ignore
  }
}

// 完整状态流转定义（6 节点，用于时间线展示和状态推进校验）
export const STATUS_FLOW: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: '已下单' },
  { status: 'preparing', label: '商家接单' },
  { status: 'ready', label: '商家出餐' },
  { status: 'picked', label: '骑手取餐' },
  { status: 'delivering', label: '配送中' },
  { status: 'delivered', label: '已送达' },
]

function buildTimeline(status: OrderStatus, createdAt: number, order?: IOrder): IOrder['statusTimeline'] {
  const currentIdx = STATUS_FLOW.findIndex(x => x.status === status)
  return STATUS_FLOW.map(s => {
    const thisIdx = STATUS_FLOW.findIndex(x => x.status === s.status)
    const completed = thisIdx <= currentIdx
    let time = ''
    if (s.status === 'pending') {
      time = new Date(createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (completed && order) {
      let timestamp: number | undefined
      if (s.status === 'preparing') timestamp = order.readyAt ? order.readyAt - 5 * 60 * 1000 : undefined
      else if (s.status === 'ready') timestamp = order.readyAt
      else if (s.status === 'picked') timestamp = order.pickedAt
      else if (s.status === 'delivering') timestamp = order.deliveringAt || order.pickedAt
      else if (s.status === 'delivered') timestamp = order.deliveredAt
      if (timestamp) {
        time = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      } else {
        const t = createdAt + thisIdx * 3 * 60 * 1000
        time = new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
    } else if (completed) {
      const t = createdAt + thisIdx * 3 * 60 * 1000
      time = new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return {
      status: s.status,
      label: s.label,
      time,
      completed,
    }
  })
}

export function useOrders() {
  const { user, isLoggedIn } = useAuth()
  // 已同步到数据库的订单快照（id → JSON），用于判断哪些订单发生了本地改动
  const syncedRef = useRef<Map<string, string>>(new Map())

  // ✅ 同步 lazy init：首渲染就有数据，避免 PaymentPage 等守卫在 orders 为空时误判跳转
  const [orders, setOrders] = useState<IOrder[]>(() => {
    try {
      const stored = scopedStorage.getItem(ORDERS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return normalizeOrders(parsed)
      }
    } catch {
      // ignore
    }
    return []
  })

  useEffect(() => {
    const handler = () => {
      const stored = scopedStorage.getItem(ORDERS_KEY)
      if (stored) {
         try {
           const parsed = JSON.parse(stored)
           const normalized = normalizeOrders(parsed)
           setOrders(prev => {
             if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev
             return normalized
           })
         } catch {
          // ignore
        }
      }
    }
    window.addEventListener(ORDERS_CHANGE_EVENT, handler)
    return () => window.removeEventListener(ORDERS_CHANGE_EVENT, handler)
  }, [])

  // ==========================================================================
  // 第 2 期 2b：订单与数据库的双向镜像
  //   读：登录后拉一遍（RLS 自动限定可见范围），以数据库为准，
  //       但保留数据库里还没有的本地订单（例如刚下单、尚未同步上去的）。
  //   写：orders 状态变化后，把与会话基线不一致的订单 upsert 回去。
  //   这样 19 处既有业务逻辑（状态机、时间线、金额）一行都不用改。
  //   第 3 期：数据库有变化时（Realtime 推送）同样走这里重拉一遍，参数 realtime 区分来源。
  // ==========================================================================
  const refreshOrdersFromRemote = useCallback(async (options?: { realtime?: boolean }) => {
    if (!supabase || !isLoggedIn) return
    // 合并前的基线快照：数据库是「真相」，但它可能比本地旧——
    // 本地刚点了接单/出餐、还没写进数据库时（基线对不上），必须以本地为准，
    // 否则这一次刷新会把刚做的操作弹回旧状态，而且再也写不回去。
    const baselineBefore = new Map(syncedRef.current)
    const remote = await fetchVisibleOrders()
    if (!remote) return
    const remoteIds = new Set(remote.map(o => o.id))
    // 基线始终指向「数据库里现在是什么」，写库逻辑靠它判断哪些订单还需要写
    remote.forEach(o => syncedRef.current.set(o.id, JSON.stringify(o)))
    setOrders(prev => {
      const localById = new Map(prev.map(o => [o.id, o]))
      const localOnly = prev.filter(o => !remoteIds.has(o.id))
      const fromRemote = remote.map(r => {
        const local = localById.get(r.id)
        const unsyncedLocal = local ? baselineBefore.get(r.id) !== JSON.stringify(local) : false
        // 首次拉取（登录/换账号）仍以数据库为准；
        // 实时刷新则保住本地尚未写库的改动，等写库逻辑把它推上去。
        return options?.realtime && unsyncedLocal && local ? local : r
      })
      const merged = [...localOnly, ...fromRemote].sort((a, b) => b.createdAt - a.createdAt)
      if (JSON.stringify(prev) === JSON.stringify(merged)) return prev
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(merged))
      return merged
    })
  }, [isLoggedIn, user.id])

  // 登录后拉一遍（原第 2 期行为）
  useEffect(() => {
    void refreshOrdersFromRemote()
  }, [refreshOrdersFromRemote])

  // 第 3 期：数据库有变化（别的端改了订单）时立即重拉，不再需要手动刷新
  useEffect(() => {
    if (!supabase || !isLoggedIn) return
    return registerRealtimeRefresh('orders', () => refreshOrdersFromRemote({ realtime: true }))
  }, [isLoggedIn, refreshOrdersFromRemote])

  // 把本地改动回写数据库（只写内容真的变了的订单，避免每次渲染都打库）
  useEffect(() => {
    if (!supabase || !isLoggedIn || orders.length === 0) return
    const dirty = orders.filter(o => syncedRef.current.get(o.id) !== JSON.stringify(o))
    if (dirty.length === 0) return
    let cancelled = false
    void (async () => {
      for (const o of dirty) {
        const ok = await upsertOrder(o)
        if (cancelled) return
        // 成功才记录基线；失败留待下次重试（例如状态流转被数据库守卫拒绝）
        if (ok) syncedRef.current.set(o.id, JSON.stringify(o))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orders, isLoggedIn])

  const saveOrders = useCallback((newOrders: IOrder[]) => {
    setOrders(newOrders)
    scopedStorage.setItem(ORDERS_KEY, JSON.stringify(newOrders))
    notifyOrdersChange()
  }, [])

  // 创建待支付订单（顾客端下单后先进入待支付状态）
  const createPendingOrder = useCallback((orderData: Omit<IOrder, 'id' | 'statusTimeline' | 'createdAt' | 'status' | 'paidAt' | 'payExpireAt'>): IOrder => {
    const now = Date.now()
    const id = newOrderId()
    const expireAt = now + PAY_TIMEOUT_MS // 待支付时效，统一由常量管理
    const newOrder: IOrder = {
      ...orderData,
      id,
      status: 'pending_payment',
      statusTimeline: [], // 待支付时还没开始履约时间线
      createdAt: now,
      payExpireAt: expireAt,
      riderEarning: orderData.deliveryFee || 5,
    }
    setOrders(prev => {
      const updated = [newOrder, ...prev]
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return newOrder
  }, [])

  // 支付订单（从 pending_payment 推进到 pending，记录支付时间 + 设置接单超时）
  const payOrder = useCallback((orderId: string, paymentMethod: string): IOrder | null => {
    let result: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'pending_payment') return o
        const now = Date.now()
        const paid: IOrder = {
          ...o,
          status: 'pending',
          paymentMethod,
          paidAt: now,
          payExpireAt: undefined,
          acceptExpireAt: now + MERCHANT_ACCEPT_TIMEOUT_MS,
          statusTimeline: buildTimeline('pending', now),
        }
        result = paid
        return paid
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return result
  }, [])

  // 取消待支付订单
  const cancelPendingOrder = useCallback((orderId: string, reason = '用户取消'): boolean => {
    let success = false
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'pending_payment') return o
        success = true
        return {
          ...o,
          status: 'cancelled' as const,
          cancelReason: reason,
          cancelledBy: 'customer' as const,
          payExpireAt: undefined,
        }
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return success
  }, [])

  // 清理超时未接单订单（商家端超时标记，顾客端可催单/取消）
  const cleanupExpiredPendingAccept = useCallback((): number => {
    let count = 0
    const now = Date.now()
    setOrders(prev => {
      let changed = false
      const updated = prev.map(o => {
        if (o.status === 'pending' && o.acceptExpireAt && o.acceptExpireAt < now) {
          changed = true
          count++
          // 超时未接单 → 标记超时（仍保持 pending 状态，让顾客可催单/取消；商家端显示"已超时"标签）
          return { ...o, acceptExpired: true } as IOrder & { acceptExpired?: boolean }
        }
        return o
      })
      if (changed) {
        scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
        notifyOrdersChange()
      }
      return changed ? updated : prev
    })
    return count
  }, [])

  // 判断订单是否接单超时（商家端/顾客端展示用）
  const isAcceptExpired = useCallback((orderId: string): boolean => {
    const o = orders.find(x => x.id === orderId)
    if (!o || o.status !== 'pending') return false
    if (o.acceptExpireAt && o.acceptExpireAt < Date.now()) return true
    return false
  }, [orders])
  const cleanupExpiredPending = useCallback((): number => {
    let count = 0
    const now = Date.now()
    setOrders(prev => {
      let changed = false
      const updated = prev.map(o => {
        if (o.status === 'pending_payment' && o.payExpireAt && o.payExpireAt < now) {
          changed = true
          count++
          return {
            ...o,
            status: 'cancelled' as const,
            cancelReason: '支付超时自动取消',
            cancelledBy: 'system' as const,
            payExpireAt: undefined,
          }
        }
        return o
      })
      if (changed) {
        scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
        notifyOrdersChange()
      }
      return changed ? updated : prev
    })
    return count
  }, [])

  // 创建订单（顾客端）——兼容旧逻辑，直接进入待接单（=已支付）
  const createOrder = useCallback((orderData: Omit<IOrder, 'id' | 'statusTimeline' | 'createdAt' | 'status'>): IOrder => {
    const now = Date.now()
    const id = newOrderId()
    const newOrder: IOrder = {
      ...orderData,
      id,
      status: 'pending',
      statusTimeline: buildTimeline('pending', now),
      createdAt: now,
      riderEarning: orderData.deliveryFee || 5,
    }
    setOrders(prev => {
      const updated = [newOrder, ...prev]
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return newOrder
  }, [])

  // 通用：推进到指定状态
  const advanceToStatus = useCallback((orderId: string, targetStatus: OrderStatus, extra?: Partial<IOrder>): IOrder | null => {
    let updatedOrder: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'delivered') return o
        const now = Date.now()
        const extraTimestamps: Partial<IOrder> = {}
        if (targetStatus === 'ready') extraTimestamps.readyAt = now
        if (targetStatus === 'picked') extraTimestamps.pickedAt = now
        if (targetStatus === 'delivering') extraTimestamps.deliveringAt = now
        if (targetStatus === 'delivered') {
          extraTimestamps.deliveredAt = now
        }
        const newOrder: IOrder = {
          ...o,
          status: targetStatus,
          statusTimeline: buildTimeline(targetStatus, o.createdAt, { ...o, ...extra, ...extraTimestamps }),
          ...extraTimestamps,
          ...extra,
        }
        // 送达时累加销量（幂等）
        if (targetStatus === 'delivered' && !o.salesCounted) {
          newOrder.salesCounted = true
          try {
            const stored = scopedStorage.getItem(SHOP_STATUS_KEY)
            if (stored) {
              const shopStatus = JSON.parse(stored) as IShopStatus
              const shop = shopStatus[o.shopId]
              if (shop) {
                const totalQty = o.items.reduce((s, i) => s + i.quantity, 0)
                const newDishes = { ...shop.dishes }
                o.items.forEach(item => {
                  const cur = newDishes[item.dishId]
                  if (cur) {
                    newDishes[item.dishId] = {
                      ...cur,
                      sales: (cur.sales || 0) + item.quantity,
                    }
                  }
                })
                shopStatus[o.shopId] = {
                  ...shop,
                  monthSales: (shop.monthSales || 0) + totalQty,
                  dishes: newDishes,
                }
                scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(shopStatus))
              }
            }
          } catch {
            // ignore
          }
        }
        updatedOrder = newOrder
        return newOrder
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return updatedOrder
  }, [])

  // 旧版模拟推进（兼容顾客端"模拟推进"按钮）
  const advanceOrder = useCallback((orderId: string): IOrder | null => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return null
    const currentIdx = STATUS_FLOW.findIndex(s => s.status === order.status)
    if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 1) return null
    const nextStatus = STATUS_FLOW[currentIdx + 1].status
    return advanceToStatus(orderId, nextStatus)
  }, [orders, advanceToStatus])

  // 商家接单
  const merchantAccept = useCallback((orderId: string): IOrder | null => {
    // 接单时清除接单超时标记
    let result: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'pending') return o
        const now = Date.now()
        const accepted: IOrder = {
          ...o,
          status: 'preparing',
          acceptExpireAt: undefined,
          statusTimeline: buildTimeline('preparing', now),
        }
        result = accepted
        return accepted
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return result
  }, [])

  // 商家拒单
  const merchantReject = useCallback((orderId: string, reason: string): IOrder | null => {
    let updatedOrder: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'pending') return o
        const updated: IOrder = {
          ...o,
          status: 'rejected',
          rejectReason: reason,
        }
        updatedOrder = updated
        return updated
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return updatedOrder
  }, [])

  // 商家出餐完成
  const merchantMarkReady = useCallback((orderId: string): IOrder | null => {
    return advanceToStatus(orderId, 'ready')
  }, [advanceToStatus])

  // 骑手抢单（抢到后状态变为 picked 即骑手已取餐状态）
  const riderClaim = useCallback((orderId: string, riderId: string, riderName: string, riderPhone: string): IOrder | null => {
    let updatedOrder: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'ready') return o
        const now = Date.now()
        const newOrder: IOrder = {
          ...o,
          status: 'picked',
          statusTimeline: buildTimeline('picked', o.createdAt, { ...o, pickedAt: now, arrivedAt: now }),
          riderId,
          riderName,
          riderPhone,
          arrivedAt: now,
          pickedAt: now,
        }
        updatedOrder = newOrder
        return newOrder
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return updatedOrder
  }, [])

  // 骑手确认送达
  const riderDeliver = useCallback((orderId: string): IOrder | null => {
    return advanceToStatus(orderId, 'delivered')
  }, [advanceToStatus])

  // 骑手：到店（标记 arrivedAt）
  const riderArriveAtStore = useCallback((orderId: string): IOrder | null => {
    let updatedOrder: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'picked') return o  // 只有已抢单（picked=已接单待取餐）状态才能到店
        const now = Date.now()
        const newOrder: IOrder = { ...o, arrivedAt: now }
        updatedOrder = newOrder
        return newOrder
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return updatedOrder
  }, [])

  // 骑手：确认取餐（从 picked 保持 picked 状态但标记 pickedAt 更新，或转为 delivering 前的一步）
  // 注：为了兼容现有 picked=已取餐 的逻辑，这里细化为：picked=骑手已抢单/在去商家路上，确认取餐后变为 delivering
  // 为了和现有系统兼容，我们保留 picked 状态，将「确认取餐」定义为 picked→delivering 的过渡
  // 实际流程：抢单 → 到店 → 确认取餐 → 开始配送 → 确认送达
  const riderConfirmPickup = useCallback((orderId: string): IOrder | null => {
    // 确认取餐 = 标记 pickedAt 并将状态保持在 picked（等待开始配送）
    let updatedOrder: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'picked') return o
        const now = Date.now()
        const newOrder: IOrder = {
          ...o,
          pickedAt: now,
          statusTimeline: buildTimeline('picked', o.createdAt, { ...o, pickedAt: now }),
        }
        updatedOrder = newOrder
        return newOrder
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return updatedOrder
  }, [])

  // 骑手：开始配送（picked → delivering）
  const riderStartDelivery = useCallback((orderId: string): IOrder | null => {
    return advanceToStatus(orderId, 'delivering')
  }, [advanceToStatus])

  // 骑手：配送异常上报
  const reportDeliveryException = useCallback((
    orderId: string,
    params: { type: DeliveryExceptionType; description: string; reporterId: string; reporterName: string },
  ): IDeliveryException | null => {
    let created: IDeliveryException | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        const exception: IDeliveryException = {
          id: `EX${Date.now()}`,
          orderId,
          type: params.type,
          description: params.description,
          reportedBy: 'rider',
          reporterId: params.reporterId,
          reporterName: params.reporterName,
          createdAt: Date.now(),
        }
        created = exception
        return {
          ...o,
          deliveryExceptions: [...(o.deliveryExceptions || []), exception],
        }
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return created
  }, [])

  // 骑手：跑单数据统计（今日/累计）
  const getRiderStats = useCallback((riderId: string) => {
    const riderOrders = orders.filter(o => o.riderId === riderId)
    const today = new Date().toDateString()
    const todayOrders = riderOrders.filter(o => new Date(o.createdAt).toDateString() === today)
    const todayDelivered = todayOrders.filter(o => o.status === 'delivered')
    const totalDelivered = riderOrders.filter(o => o.status === 'delivered')
    const todayEarnings = todayDelivered.reduce((s, o) => s + (o.riderEarning || 0), 0)
    const totalEarnings = totalDelivered.reduce((s, o) => s + (o.riderEarning || 0), 0)
    // 平均配送时长（分钟）
    const deliveredWithTime = totalDelivered.filter(o => o.pickedAt && o.deliveredAt)
    const avgDuration = deliveredWithTime.length > 0
      ? Math.round(deliveredWithTime.reduce((s, o) => s + ((o.deliveredAt! - o.pickedAt!) / 60000), 0) / deliveredWithTime.length)
      : 0
    const activeCount = riderOrders.filter(o => o.status === 'picked' || o.status === 'delivering').length
    // 准时率：实际配送时长在预计时长 1.25 倍以内算准时
    const onTimeCount = deliveredWithTime.filter(o => {
      if (!o.estimatedTime) return true
      const actual = (o.deliveredAt! - o.pickedAt!) / 60000
      // estimatedTime 可能是 "30分钟" 或 "30" 格式
      const match = String(o.estimatedTime).match(/(\d+)/)
      if (!match) return true
      const est = parseInt(match[1], 10)
      return actual <= est * 1.25
    }).length
    const onTimeRate = deliveredWithTime.length > 0
      ? Math.round((onTimeCount / deliveredWithTime.length) * 100)
      : null
    // 好评率：从 reviews 真实数据聚合（overallScore >= 4 算好评）
    const reviewMap = (() => {
      try {
        const raw = scopedStorage.getItem('food_delivery_reviews')
        if (!raw) return new Map<string, number>()
        const parsed = JSON.parse(raw) as Array<{ orderId: string; overallScore: number; riderId?: string }>
        const map = new Map<string, number>()
        parsed.forEach(r => {
          if (r.orderId) map.set(r.orderId, r.overallScore)
        })
        return map
      } catch {
        return new Map<string, number>()
      }
    })()
    const deliveredIds = new Set(totalDelivered.map(o => o.id))
    const reviewedCount = Array.from(deliveredIds).filter(id => reviewMap.has(id)).length
    const goodCount = Array.from(deliveredIds).filter(id => {
      const score = reviewMap.get(id)
      return score !== undefined && score >= 4
    }).length
    const goodRate = reviewedCount > 0
      ? Math.round((goodCount / reviewedCount) * 100)
      : null
    return {
      todayCount: todayOrders.length,
      todayDelivered: todayDelivered.length,
      todayEarnings,
      totalDelivered: totalDelivered.length,
      totalEarnings,
      avgDuration,
      activeCount,
      onTimeRate,
      goodRate,
      reviewedCount,
    }
  }, [orders])

  // 商家端：经营数据统计
  const getShopStats = useCallback((shopId: string) => {
    const shopOrders = orders.filter(o => o.shopId === shopId)
    const today = new Date().toDateString()
    const todayOrders = shopOrders.filter(o => new Date(o.createdAt).toDateString() === today)
    // 营业额 = 已送达 + 配送中 + 已出餐 的 finalAmount（已确认的收入）
    const validOrders = shopOrders.filter(o =>
      o.status === 'delivered' || o.status === 'delivering' || o.status === 'ready' || o.status === 'preparing',
    )
    const todayValid = todayOrders.filter(o =>
      o.status === 'delivered' || o.status === 'delivering' || o.status === 'ready' || o.status === 'preparing',
    )
    const todayRevenue = todayValid.reduce((s, o) => s + o.finalAmount, 0)
    const totalRevenue = validOrders.reduce((s, o) => s + o.finalAmount, 0)
    const totalOrderCount = shopOrders.length
    const todayOrderCount = todayOrders.length
    const pendingCount = shopOrders.filter(o => o.status === 'pending').length
    const preparingCount = shopOrders.filter(o => o.status === 'preparing').length
    const readyCount = shopOrders.filter(o => o.status === 'ready').length
    const deliveredCount = shopOrders.filter(o => o.status === 'delivered').length
    const avgOrderValue = deliveredCount > 0
      ? Math.round((shopOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.finalAmount, 0) / deliveredCount) * 10) / 10
      : 0

    // 退款统计（商家同意的退款 = approved 状态）
    const refundedOrders = shopOrders.filter(o => o.refundRequest?.status === 'approved')
    const todayRefundOrders = refundedOrders.filter(o => new Date(o.refundRequest!.handledAt!).toDateString() === today)
    const todayRefundAmount = todayRefundOrders.reduce((s, o) => s + (o.refundRequest!.amount || o.finalAmount), 0)
    const totalRefundAmount = refundedOrders.reduce((s, o) => s + (o.refundRequest!.amount || o.finalAmount), 0)
    const todayRefundCount = todayRefundOrders.length
    const totalRefundCount = refundedOrders.length

    // 净收入 = 营业额 - 退款金额
    const todayNetRevenue = +(todayRevenue - todayRefundAmount).toFixed(2)
    const totalNetRevenue = +(totalRevenue - totalRefundAmount).toFixed(2)

    // 昨日数据 + 环比
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toDateString()
    const yesterdayOrders = shopOrders.filter(o => new Date(o.createdAt).toDateString() === yesterdayStr)
    const yesterdayValid = yesterdayOrders.filter(o =>
      o.status === 'delivered' || o.status === 'delivering' || o.status === 'ready' || o.status === 'preparing',
    )
    const yesterdayRevenue = yesterdayValid.reduce((s, o) => s + o.finalAmount, 0)
    const yesterdayOrderCount = yesterdayOrders.length
    const yesterdayDelivered = yesterdayOrders.filter(o => o.status === 'delivered').length
    const yesterdayAvg = yesterdayDelivered > 0
      ? Math.round((yesterdayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.finalAmount, 0) / yesterdayDelivered) * 10) / 10
      : 0

    const calcTrend = (today: number, yest: number) => {
      // 昨日为 0 或基数极小（<3 单 或 <10 元）→ 显示「新」避免百分比夸张
      const tooSmall = yest === 0 || (yest < 3 && yest < 10)
      if (yest === 0) return { value: 0, up: true, label: today > 0 ? '新' : '—' }
      if (tooSmall && Math.abs(today - yest) / yest > 2) return { value: 0, up: today >= yest, label: '—' }
      const diff = ((today - yest) / yest) * 100
      return { value: Math.round(diff), up: diff >= 0, label: `${diff >= 0 ? '+' : ''}${Math.round(diff)}%` }
    }
    const orderTrend = calcTrend(todayOrderCount, yesterdayOrderCount)
    const revenueTrend = calcTrend(todayRevenue, yesterdayRevenue)
    const avgTrend = calcTrend(avgOrderValue, yesterdayAvg)
    // 近 7 天趋势数据（按天聚合订单数和营业额）
    const trendData: { date: string; orders: number; revenue: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toDateString()
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const dayOrders = shopOrders.filter(o => new Date(o.createdAt).toDateString() === dateStr)
      const dayRevenue = dayOrders
        .filter(o => o.status === 'delivered' || o.status === 'delivering' || o.status === 'ready')
        .reduce((s, o) => s + o.finalAmount, 0)
      trendData.push({ date: label, orders: dayOrders.length, revenue: Math.round(dayRevenue * 10) / 10 })
    }
    return {
      todayOrderCount,
      todayRevenue,
      totalOrderCount,
      totalRevenue,
      avgOrderValue,
      pendingCount,
      preparingCount,
      readyCount,
      deliveredCount,
      trendData,
      orderTrend,
      revenueTrend,
      avgTrend,
      // 退款相关
      todayRefundCount,
      totalRefundCount,
      todayRefundAmount,
      totalRefundAmount,
      todayNetRevenue,
      totalNetRevenue,
    }
  }, [orders])

  // 商家端：菜品销量榜
  const getDishSalesRank = useCallback((shopId: string, limit = 5) => {
    const dishMap = new Map<string, { name: string; quantity: number; image: string }>()
    const deliveredOrders = orders.filter(o => o.shopId === shopId && o.status === 'delivered')
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = dishMap.get(item.dishId)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          dishMap.set(item.dishId, {
            name: item.dishName,
            quantity: item.quantity,
            image: item.image,
          })
        }
      })
    })
    return Array.from(dishMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
  }, [orders])

  // 顾客取消订单（仅待接单状态可取消）
  const customerCancel = useCallback((orderId: string, reason = '用户取消'): IOrder | null => {
    let updatedOrder: IOrder | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status !== 'pending') return o
        const updated: IOrder = {
          ...o,
          status: 'cancelled',
          cancelReason: reason,
          cancelledBy: 'customer',
        }
        updatedOrder = updated
        return updated
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return updatedOrder
  }, [])

  const getOrder = useCallback((orderId: string): IOrder | undefined => {
    return orders.find(o => o.id === orderId)
  }, [orders])

  // 商家端：按状态过滤该商家订单
  const getShopOrders = useCallback((shopId: string, status?: OrderStatus): IOrder[] => {
    return orders.filter(o => {
      if (o.shopId !== shopId) return false
      if (status) return o.status === status
      return true
    })
  }, [orders])

  // 商家端：待处理售后
  const getShopRefundRequests = useCallback((shopId: string, status?: RefundStatus): IRefundRequest[] => {
    const list: IRefundRequest[] = []
    orders.forEach(o => {
      if (o.shopId !== shopId) return
      if (o.refundRequest) {
        if (!status || o.refundRequest.status === status) {
          list.push(o.refundRequest)
        }
      }
    })
    return list.sort((a, b) => b.createdAt - a.createdAt)
  }, [orders])

  // 骑手端：抢单大厅 = 所有 ready 状态订单
  const poolOrders = orders.filter(o => o.status === 'ready')

  // 骑手端：我的进行中订单
  const getRiderActiveOrders = useCallback((riderId: string): IOrder[] => {
    return orders.filter(o => o.riderId === riderId && (o.status === 'picked' || o.status === 'delivering'))
  }, [orders])

  // 骑手端：我的历史订单
  const getRiderHistoryOrders = useCallback((riderId: string): IOrder[] => {
    return orders.filter(o => o.riderId === riderId && o.status === 'delivered')
  }, [orders])

  const ongoingOrders = orders.filter(o =>
    o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'rejected',
  )
  const historyOrders = orders.filter(o =>
    o.status === 'delivered' || o.status === 'cancelled' || o.status === 'rejected',
  )

  // 标记订单已评价
  const markReviewed = useCallback((orderId: string) => {
    setOrders(prev => {
      const updated = prev.map(o =>
        o.id === orderId ? { ...o, reviewed: true } : o,
      )
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
  }, [])

  // 顾客催单：60秒内只能催一次，返回是否成功
  const urgeOrder = useCallback((orderId: string, reason?: string): boolean => {
    const now = Date.now()
    let success = false
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'rejected') return o
        if (o.lastUrgeAt && now - o.lastUrgeAt < 60 * 1000) return o
        success = true
        return {
          ...o,
          urgeCount: (o.urgeCount || 0) + 1,
          lastUrgeAt: now,
          urgeReason: reason,
        }
      })
      if (success) {
        scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
        notifyOrdersChange()
      }
      return updated
    })
    return success
  }, [])

  // 顾客：申请售后退款
  const applyRefund = useCallback((
    orderId: string,
    params: { reason: string; description: string; amount?: number },
  ): IRefundRequest | null => {
    let created: IRefundRequest | null = null
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.id !== orderId) return o
        // 待接单→直接走取消；已接单/配送中/已送达→售后
        if (o.status === 'cancelled' || o.status === 'rejected') return o
        if (o.refundRequest && o.refundRequest.status !== 'rejected') return o
        const request: IRefundRequest = {
          id: `RF${Date.now()}`,
          orderId,
          shopId: o.shopId,
          customerId: o.customerId,
          reason: params.reason,
          description: params.description,
          amount: params.amount ?? o.finalAmount,
          status: 'pending',
          createdAt: Date.now(),
        }
        created = request
        return { ...o, refundRequest: request }
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(updated))
      notifyOrdersChange()
      return updated
    })
    return created
  }, [])

  // 商家：处理售后退款（同意/拒绝）
  const handleRefund = useCallback((
    orderId: string,
    action: 'approve' | 'reject',
    remark: string,
    handlerName: string,
  ): IRefundRequest | null => {
    let updated: IRefundRequest | null = null
    setOrders(prev => {
      const list = prev.map(o => {
        if (o.id !== orderId) return o
        if (!o.refundRequest || o.refundRequest.status !== 'pending') return o
        const newReq: IRefundRequest = {
          ...o.refundRequest,
          status: action === 'approve' ? 'approved' : 'rejected',
          handledAt: Date.now(),
          handleRemark: remark,
          handledBy: handlerName,
        }
        updated = newReq
        return { ...o, refundRequest: newReq }
      })
      scopedStorage.setItem(ORDERS_KEY, JSON.stringify(list))
      notifyOrdersChange()
      return list
    })
    return updated
  }, [])

  return {
    orders,
    ongoingOrders,
    historyOrders,
    createOrder,
    advanceOrder,
    advanceToStatus,
    getOrder,
    // 商家端
    merchantAccept,
    merchantReject,
    merchantMarkReady,
    getShopOrders,
    getShopRefundRequests,
    handleRefund,
    // 骑手端
    riderClaim,
    riderDeliver,
    riderArriveAtStore,
    riderConfirmPickup,
    riderStartDelivery,
    reportDeliveryException,
    getRiderStats,
    poolOrders,
    getRiderActiveOrders,
    getRiderHistoryOrders,
    // 商家统计
    getShopStats,
    getDishSalesRank,
    // 顾客端
    customerCancel,
    markReviewed,
    urgeOrder,
    applyRefund,
    // 支付相关
    createPendingOrder,
    payOrder,
    cancelPendingOrder,
    cleanupExpiredPending,
    cleanupExpiredPendingAccept,
    isAcceptExpired,
    saveOrders,
  }
}

export type UseOrdersReturn = ReturnType<typeof useOrders>
