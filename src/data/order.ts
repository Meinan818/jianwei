// EXPORTS: IOrderStatusNode, IOrder, IOrderCouponInfo, IOrderPromoInfo, IOrderItem, IRefundRequest, IDeliveryException, DeliveryExceptionType

import type { ICartItemSpec, ICartItemExtra } from './cart'

export type OrderStatus =
  | 'pending_payment' // 待支付（已下单未付款）
  | 'pending'      // 待接单（顾客已下单，等商家确认）
  | 'preparing'    // 备餐中（商家已接单，正在制作）
  | 'ready'        // 待取餐（商家出餐完成，等骑手抢单/取餐）
  | 'picked'       // 已取餐（骑手已取餐，正在配送）
  | 'delivering'   // 配送中（骑手前往顾客地址）
  | 'delivered'    // 已送达
  | 'cancelled'    // 已取消
  | 'rejected'     // 商家拒单

export type RefundStatus =
  | 'pending'      // 待商家处理
  | 'approved'     // 商家同意退款
  | 'rejected'     // 商家拒绝退款
  | 'processing'   // 退款处理中
  | 'completed'    // 退款完成

export type DeliveryExceptionType =
  | 'customer_unreachable'  // 联系不上顾客
  | 'merchant_slow'         // 商家出餐慢
  | 'wrong_address'         // 地址错误
  | 'bad_weather'           // 天气原因
  | 'other'                 // 其他

export interface IDeliveryException {
  id: string
  orderId: string
  type: DeliveryExceptionType
  description: string
  reportedBy: 'rider' | 'merchant' | 'customer'
  reporterId: string
  reporterName: string
  createdAt: number
  resolved?: boolean
  resolvedAt?: number
  resolution?: string
}

export interface IOrderItem {
  dishId: string
  dishName: string
  basePrice: number
  finalPrice: number
  quantity: number
  image: string
  specs: ICartItemSpec[]
  extras: ICartItemExtra[]
  skuKey: string
}

export interface IRefundRequest {
  id: string
  orderId: string
  shopId: string
  customerId: string
  reason: string          // 退款原因（选的快捷原因）
  description: string     // 补充说明
  amount: number          // 申请退款金额
  status: RefundStatus
  createdAt: number       // 申请时间
  handledAt?: number      // 处理时间
  handleRemark?: string   // 商家处理备注
  handledBy?: string      // 处理人（昵称，界面展示用）
  handledById?: string    // 处理人用户 id（uuid，写数据库 handled_by 列；第 2 期 2e）
}

export interface IOrderStatusNode {
  status: string
  label: string
  time: string
  completed: boolean
}

export interface IOrderCouponInfo {
  couponId: string
  couponName: string
  discount: number
}

export interface IOrderPromoInfo {
  type: 'fullReduce' | 'none'
  description: string
  discount: number
}

export interface IOrder {
  id: string
  /** 人类可读单号（数据库自增列 order_seq，第 2 期起用于界面展示） */
  orderSeq?: number
  shopId: string
  shopName: string
  shopCover: string
  items: IOrderItem[]
  totalAmount: number
  packingFee: number           // 打包费
  deliveryFee: number
  discount: number            // 总优惠金额（满减+优惠券）
  promoDiscount: number       // 满减优惠
  couponDiscount: number      // 优惠券优惠
  newUserDiscount: number     // 新客立减
  freeDeliveryDiscount: number // 免配送费优惠
  discountDetail?: {          // 优惠明细（方便展示）
    fullReduce?: number
    coupon?: number
    newUser?: number
    freeDelivery?: number
    shopDiscount?: number
    discountDish?: number
  }
  couponInfo?: IOrderCouponInfo
  promoInfo?: IOrderPromoInfo
  finalAmount: number
  address: { name: string; phone: string; address: string; detail: string }
  remark: string
  utensils: number
  paymentMethod: string
  paidAt?: number           // 支付时间
  payExpireAt?: number      // 支付过期时间（超时自动取消）
  acceptExpireAt?: number   // 商家接单过期时间（超时自动取消/标记）
  appointmentTime?: string  // 预约送达时段，如"12:00-12:30"，为空表示立即送出
  deliveryMode: 'instant' | 'appointment'
  isPickup?: boolean         // 到店自取：不进骑手抢单大厅，商家确认取餐即完成
  status: OrderStatus
  customerId: string           // 顾客ID（用于消息会话等关联）
  statusTimeline: IOrderStatusNode[]
  createdAt: number
  reviewed?: boolean
  // 三端联动扩展字段
  riderId?: string            // 接单骑手ID
  riderName?: string          // 骑手姓名
  riderPhone?: string         // 骑手电话
  riderEarning?: number       // 骑手配送费收入
  distance?: string           // 配送距离
  estimatedTime?: string      // 预计送达时长
  rejectReason?: string       // 拒单原因
  cancelReason?: string       // 取消原因
  cancelledBy?: 'customer' | 'merchant' | 'rider' | 'system'
  readyAt?: number            // 商家出餐完成时间戳
  arrivedAt?: number          // 骑手到店时间戳
  pickedAt?: number           // 骑手取餐时间戳
  deliveringAt?: number       // 骑手开始配送时间戳
  deliveredAt?: number        // 送达时间戳
  salesCounted?: boolean      // 是否已计入销量（幂等标记，送达时设置）
  urgeCount?: number          // 催单次数
  lastUrgeAt?: number         // 最后催单时间戳
  urgeReason?: string         // 催单原因
  // 售后
  refundRequest?: IRefundRequest  // 当前售后申请（一单一个进行中的售后）
  // 配送异常记录
  deliveryExceptions?: IDeliveryException[]
}

/**
 * 展示用订单号（第 2 期）。
 * 数据库里 orders.id 是 uuid，不再适合直接展示，因此用自增列 order_seq 生成人类可读单号；
 * 订单刚在本地创建、还没写回数据库拿到 order_seq 时，用 id 前 8 位兜底。
 */
export function formatOrderNo(o: Pick<IOrder, 'id' | 'orderSeq'>): string {
  return o.orderSeq ? `ORD${String(o.orderSeq).padStart(6, '0')}` : o.id.slice(0, 8).toUpperCase()
}
