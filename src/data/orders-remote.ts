/**
 * 第 2 期 2b：订单读写数据库（Supabase）
 *
 * 设计思路（与 2a 一致，尽量少动现有逻辑）：
 *   useOrders 里 19 处都在改同一个 state，所以不去逐个改写入点，
 *   而是把 state 当成"本地视图"，在它之上加一层镜像：
 *     · 登录后从数据库拉一遍（RLS 自动限定可见范围：顾客看自己的、商家看自家店的、骑手看自己的）
 *     · state 变化后，把与会话基线不一致的订单 upsert 回数据库
 *   这样订单状态机、时间线、金额计算等既有逻辑完全不动。
 *
 * 两个必须知道的约束：
 *   1. orders.id 是 uuid。前端原来用 `ORD${Date.now()}`，无法写入 uuid 主键，
 *      因此新建订单改用 crypto.randomUUID()；人类可读单号用数据库的 order_seq 展示。
 *   2. guard_order_transition 触发器会校验状态流转，非法跳转会写失败（这是好事，会打日志）。
 */
import { supabase } from '@/lib/supabase'
import type { IOrder, IOrderItem, IRefundRequest, IDeliveryException } from './order'

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const ts = (v: unknown): number | undefined => (v ? Date.parse(String(v)) : undefined)
const iso = (v: number | undefined): string | null => (v ? new Date(v).toISOString() : null)
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

/** 数据库行（orders + order_items + 售后 + 异常）→ 前端 IOrder */
export function rowToOrder(
  row: Record<string, any>,
  items: Record<string, any>[],
  refund?: Record<string, any> | null,
  exceptions?: Record<string, any>[],
): IOrder {
  const mappedItems: IOrderItem[] = items
    .slice()
    .sort((a, b) => num(a.sort) - num(b.sort))
    .map(it => ({
      dishId: it.dish_id ?? '',
      dishName: it.dish_name,
      basePrice: num(it.base_price),
      finalPrice: num(it.final_price),
      quantity: num(it.quantity, 1),
      image: it.image_url ?? '',
      specs: it.specs ?? [],
      extras: it.extras ?? [],
      skuKey: it.sku_key ?? '',
    }))

  return {
    id: row.id,
    orderSeq: row.order_seq ?? undefined,
    shopId: row.shop_id,
    shopName: row.shop_name ?? '',
    shopCover: row.shop_cover_url ?? '',
    items: mappedItems,
    totalAmount: num(row.total_amount),
    packingFee: num(row.packing_fee),
    deliveryFee: num(row.delivery_fee),
    discount: num(row.discount),
    promoDiscount: num(row.promo_discount),
    couponDiscount: num(row.coupon_discount),
    newUserDiscount: num(row.new_user_discount),
    freeDeliveryDiscount: num(row.free_delivery_discount),
    ...(row.discount_detail ? { discountDetail: row.discount_detail } : {}),
    ...(row.coupon_info ? { couponInfo: row.coupon_info } : {}),
    ...(row.promo_info ? { promoInfo: row.promo_info } : {}),
    finalAmount: num(row.final_amount),
    address: row.address ?? { name: '', phone: '', address: '', detail: '' },
    remark: row.remark ?? '',
    utensils: num(row.utensils),
    paymentMethod: row.payment_method ?? 'wechat',
    paidAt: ts(row.paid_at),
    payExpireAt: ts(row.pay_expire_at),
    ...(row.appointment_time ? { appointmentTime: row.appointment_time } : {}),
    deliveryMode: row.delivery_mode === 'appointment' ? 'appointment' : 'instant',
    status: row.status,
    customerId: row.customer_id,
    statusTimeline: row.status_timeline ?? [],
    createdAt: ts(row.created_at) ?? Date.now(),
    reviewed: Boolean(row.reviewed),
    ...(row.rider_id ? { riderId: row.rider_id } : {}),
    ...(row.rider_name ? { riderName: row.rider_name } : {}),
    ...(row.rider_phone ? { riderPhone: row.rider_phone } : {}),
    ...(row.rider_earning != null ? { riderEarning: num(row.rider_earning) } : {}),
    ...(row.distance ? { distance: row.distance } : {}),
    ...(row.estimated_time ? { estimatedTime: row.estimated_time } : {}),
    ...(row.reject_reason ? { rejectReason: row.reject_reason } : {}),
    ...(row.cancel_reason ? { cancelReason: row.cancel_reason } : {}),
    ...(row.cancelled_by ? { cancelledBy: row.cancelled_by } : {}),
    readyAt: ts(row.ready_at),
    arrivedAt: ts(row.arrived_at),
    pickedAt: ts(row.picked_at),
    deliveringAt: ts(row.delivering_at),
    deliveredAt: ts(row.delivered_at),
    salesCounted: Boolean(row.sales_counted),
    urgeCount: num(row.urge_count),
    lastUrgeAt: ts(row.last_urge_at),
    ...(row.urge_reason ? { urgeReason: row.urge_reason } : {}),
    ...(refund
      ? {
          refundRequest: {
            id: refund.id,
            orderId: refund.order_id,
            shopId: refund.shop_id,
            customerId: refund.customer_id,
            reason: refund.reason ?? '',
            description: refund.description ?? '',
            amount: num(refund.amount),
            status: refund.status,
            createdAt: ts(refund.created_at) ?? Date.now(),
            handledAt: ts(refund.handled_at),
            ...(refund.handle_remark ? { handleRemark: refund.handle_remark } : {}),
            // handled_by 列是 uuid（处理人用户 id），不要当昵称展示——昵称走 handle_remark/本地
            ...(refund.handled_by ? { handledById: refund.handled_by } : {}),
          } as IRefundRequest,
        }
      : {}),
    ...(exceptions && exceptions.length > 0
      ? {
          deliveryExceptions: exceptions.map(ex => ({
            id: ex.id,
            orderId: ex.order_id,
            type: ex.type,
            description: ex.description ?? '',
            reportedBy: ex.reporter_role ?? 'rider',
            reporterId: ex.reporter_id ?? '',
            reporterName: ex.reporter_name ?? '',
            createdAt: ts(ex.created_at) ?? Date.now(),
            resolved: ex.resolved ?? undefined,
            resolvedAt: ts(ex.resolved_at),
            ...(ex.resolution ? { resolution: ex.resolution } : {}),
          })) as IDeliveryException[],
        }
      : {}),
  }
}

/** 读取当前账号可见的全部订单（RLS 决定范围） */
export async function fetchVisibleOrders(): Promise<IOrder[] | null> {
  const sb = supabase
  if (!sb) return null
  const { data: rows, error } = await sb.from('orders').select('*').order('created_at', { ascending: false })
  if (error || !rows) {
    console.warn('[orders] 读取订单失败', error)
    return null
  }
  if (rows.length === 0) return []

  const ids = rows.map(r => r.id)
  const [itemsRes, refundsRes, exRes] = await Promise.all([
    sb.from('order_items').select('*').in('order_id', ids),
    sb.from('refund_requests').select('*').in('order_id', ids),
    sb.from('delivery_exceptions').select('*').in('order_id', ids),
  ])
  const itemsByOrder = new Map<string, Record<string, any>[]>()
  for (const it of itemsRes.data ?? []) {
    const list = itemsByOrder.get(it.order_id) ?? []
    list.push(it)
    itemsByOrder.set(it.order_id, list)
  }
  const refundByOrder = new Map<string, Record<string, any>>()
  for (const r of refundsRes.data ?? []) refundByOrder.set(r.order_id, r)
  const exByOrder = new Map<string, Record<string, any>[]>()
  for (const e of exRes.data ?? []) {
    const list = exByOrder.get(e.order_id) ?? []
    list.push(e)
    exByOrder.set(e.order_id, list)
  }

  return rows.map(r => rowToOrder(r, itemsByOrder.get(r.id) ?? [], refundByOrder.get(r.id), exByOrder.get(r.id)))
}

/** 前端 IOrder → 数据库行（只写我们负责的字段，其余交由数据库默认值/其他角色维护） */
function orderToRow(o: IOrder) {
  return {
    id: o.id,
    shop_id: o.shopId,
    customer_id: o.customerId,
    ...(o.riderId ? { rider_id: o.riderId } : {}),
    status: o.status,
    shop_name: o.shopName,
    shop_cover_url: o.shopCover || null,
    total_amount: o.totalAmount,
    packing_fee: o.packingFee ?? 0,
    delivery_fee: o.deliveryFee ?? 0,
    discount: o.discount ?? 0,
    promo_discount: o.promoDiscount ?? 0,
    coupon_discount: o.couponDiscount ?? 0,
    new_user_discount: o.newUserDiscount ?? 0,
    free_delivery_discount: o.freeDeliveryDiscount ?? 0,
    discount_detail: o.discountDetail ?? null,
    coupon_info: o.couponInfo ?? null,
    promo_info: o.promoInfo ?? null,
    final_amount: o.finalAmount,
    address: o.address,
    remark: o.remark ?? '',
    utensils: o.utensils ?? 0,
    payment_method: o.paymentMethod ?? null,
    delivery_mode: o.deliveryMode ?? 'instant',
    appointment_time: o.appointmentTime ?? null,
    rider_name: o.riderName ?? null,
    rider_phone: o.riderPhone ?? null,
    rider_earning: o.riderEarning ?? null,
    distance: o.distance ?? null,
    estimated_time: o.estimatedTime ?? null,
    reject_reason: o.rejectReason ?? null,
    cancel_reason: o.cancelReason ?? null,
    cancelled_by: o.cancelledBy ?? null,
    status_timeline: o.statusTimeline ?? [],
    paid_at: iso(o.paidAt),
    pay_expire_at: iso(o.payExpireAt),
    ready_at: iso(o.readyAt),
    arrived_at: iso(o.arrivedAt),
    picked_at: iso(o.pickedAt),
    delivering_at: iso(o.deliveringAt),
    delivered_at: iso(o.deliveredAt),
    reviewed: Boolean(o.reviewed),
    sales_counted: Boolean(o.salesCounted),
    urge_count: o.urgeCount ?? 0,
    last_urge_at: iso(o.lastUrgeAt),
    urge_reason: o.urgeReason ?? null,
  }
}

/**
 * 把订单写入数据库（存在则更新，不存在则插入），并同步明细行。
 * 失败只记日志：不能让数据库问题把整个下单流程卡死。
 */
export async function upsertOrder(order: IOrder): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  try {
    const row = orderToRow(order)
    // 刻意不用 .upsert()：ON CONFLICT 的冲突分支会改用「更新」策略判定，
    // 实测在 RLS 下会被拒（同样数据普通 INSERT 通过）。显式「先插、冲突再改」更可靠。
    const ins = await sb.from('orders').insert(row)
    // 订单行是不是这次新建的：决定明细要不要写（详见下方明细段的注释）
    const isNewOrder = !ins.error
    if (ins.error) {
      if (ins.error.code === '23505') {
        const upd = await sb.from('orders').update(row).eq('id', order.id)
        if (!upd.error) {
          // 继续写明细
        } else {
          console.warn('[orders] 更新订单失败', order.id, upd.error.message)
          return false
        }
      } else {
        console.warn('[orders] 写入订单失败', order.id, ins.error.message)
        return false
      }
    }
    // ---- 订单明细 ----
    // ⚠️ 明细在本项目里是「下单快照」，刻意不可改：RLS 只给了 order_items 的 select / insert
    //    两条策略，没有 update / delete；表上也没有 (order_id, sort) 唯一约束。
    //    所以**每次回写都插一遍会造成成倍重复**（2026-09-28 实测：一笔订单被插成 96 条、
    //    另一笔 192 条，顾客端与商家端都显示成一长串同样的菜）。
    //    正确做法：只在新订单时写；老订单只在「库里确实一条明细都没有」时补写
    //    （覆盖 orders 插成功但明细没写上的极端情况）。
    let needItems = isNewOrder
    if (!needItems && order.items?.length) {
      const { data: existingItems, error: itemsQueryError } = await sb
        .from('order_items')
        .select('id')
        .eq('order_id', order.id)
        .limit(1)
      needItems = !itemsQueryError && (existingItems?.length ?? 0) === 0
    }
    if (needItems && order.items?.length) {
      const rows = order.items.map((it, idx) => ({
        order_id: order.id,
        dish_id: /^[0-9a-f-]{36}$/i.test(it.dishId) ? it.dishId : null,
        dish_name: it.dishName,
        image_url: it.image || null,
        base_price: it.basePrice,
        final_price: it.finalPrice,
        quantity: it.quantity,
        sku_key: it.skuKey || null,
        specs: it.specs ?? [],
        extras: it.extras ?? [],
        sort: idx,
      }))
      const ins2 = await sb.from('order_items').insert(rows)
      if (ins2.error && ins2.error.code !== '23505') {
        // 明细表没有唯一约束时会重复插入，这里按 order_id 去重兜底
        const { data: existing } = await sb.from('order_items').select('id,sku_key').eq('order_id', order.id)
        const seen = new Set((existing ?? []).map(r => r.sku_key))
        const missing = rows.filter(r => !seen.has(r.sku_key))
        if (missing.length > 0) {
          const { error: insErr } = await sb.from('order_items').insert(missing)
          if (insErr) console.warn('[orders] 写入订单明细失败', order.id, insErr.message)
        }
      }
    }
    // ---- 第 2 期 2e：售后退款单独写表（order_id 唯一：先插、冲突再改，处理结果更新走后者）----
    if (order.refundRequest && isUuid(order.refundRequest.id)) {
      const rf = order.refundRequest
      const rfRow = {
        order_id: order.id,
        shop_id: order.shopId,
        customer_id: order.customerId,
        reason: rf.reason ?? '',
        description: rf.description ?? '',
        amount: rf.amount,
        status: rf.status,
        created_at: iso(rf.createdAt),
        handled_at: iso(rf.handledAt),
        handle_remark: rf.handleRemark ?? null,
        handled_by: rf.handledById && isUuid(rf.handledById) ? rf.handledById : null,
      }
      const rfIns = await sb.from('refund_requests').insert(rfRow)
      if (rfIns.error) {
        if (rfIns.error.code === '23505') {
          const rfUpd = await sb.from('refund_requests').update(rfRow).eq('order_id', order.id)
          if (rfUpd.error) console.warn('[orders] 更新售后退款失败', order.id, rfUpd.error.message)
        } else {
          console.warn('[orders] 写入售后退款失败', order.id, rfIns.error.message)
        }
      }
    }
    // ---- 第 2 期 2e：配送异常单独写表（id 是 uuid 主键，重复插入按 23505 跳过）----
    if (order.deliveryExceptions?.length) {
      for (const ex of order.deliveryExceptions) {
        if (!isUuid(ex.id)) continue // 旧本地数据（EX+时间戳）不入库
        const exRow = {
          id: ex.id,
          order_id: order.id,
          type: ex.type,
          description: ex.description ?? '',
          reported_by: ex.reportedBy ?? 'rider',
          reporter_id: ex.reporterId && isUuid(ex.reporterId) ? ex.reporterId : null, // 骑手工号不是 uuid，置空
          reporter_name: ex.reporterName ?? null,
          resolved: Boolean(ex.resolved),
          resolved_at: iso(ex.resolvedAt),
          resolution: ex.resolution ?? null,
          created_at: iso(ex.createdAt),
        }
        const exIns = await sb.from('delivery_exceptions').insert(exRow)
        if (exIns.error && exIns.error.code !== '23505') {
          console.warn('[orders] 写入配送异常失败', ex.id, exIns.error.message)
        }
      }
    }
    return true
  } catch (err) {
    console.warn('[orders] 写入订单异常', err)
    return false
  }
}
