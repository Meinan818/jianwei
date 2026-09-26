// EXPORTS: ICoupon, CouponType, ICouponShopDiscount, MOCK_COUPONS, calcCouponDiscount

export type CouponType = 'fullReduce' | 'discount' | 'noThreshold'

export interface ICoupon {
  id: string
  name: string
  type: CouponType
  value: number           // 满减/无门槛: 减免金额; 折扣: 折扣率 0-1 (如 0.8 = 8折)
  minAmount: number       // 使用门槛 (满多少可用，0 表示无门槛)
  expireDate: string      // 有效期至，格式 YYYY-MM-DD
  scope: string           // 适用范围说明
  description: string     // 使用说明
  claimed: boolean        // 是否已领取
  used: boolean           // 是否已使用
  expired: boolean        // 是否已过期
}

export interface ICouponShopDiscount {
  thresholds: number[]    // 满减档位金额，升序
  discounts: number[]     // 对应档位减免金额
}

export const MOCK_COUPONS: ICoupon[] = [
  {
    id: 'c1',
    name: '新人专享券',
    type: 'noThreshold',
    value: 5,
    minAmount: 0,
    expireDate: '2026-12-31',
    scope: '全场通用',
    description: '新用户专享，无门槛立减 5 元',
    claimed: false,
    used: false,
    expired: false,
  },
  {
    id: 'c2',
    name: '满 25 减 5',
    type: 'fullReduce',
    value: 5,
    minAmount: 25,
    expireDate: '2026-12-31',
    scope: '全场通用',
    description: '单笔订单满 25 元可用',
    claimed: false,
    used: false,
    expired: false,
  },
  {
    id: 'c3',
    name: '满 45 减 10',
    type: 'fullReduce',
    value: 10,
    minAmount: 45,
    expireDate: '2026-12-31',
    scope: '全场通用',
    description: '单笔订单满 45 元可用',
    claimed: false,
    used: false,
    expired: false,
  },
  {
    id: 'c4',
    name: '满 60 减 15',
    type: 'fullReduce',
    value: 15,
    minAmount: 60,
    expireDate: '2026-12-31',
    scope: '全场通用',
    description: '单笔订单满 60 元可用',
    claimed: false,
    used: false,
    expired: false,
  },
  {
    id: 'c5',
    name: '8 折优惠券',
    type: 'discount',
    value: 0.8,
    minAmount: 30,
    expireDate: '2026-12-31',
    scope: '全场通用，最高减 20 元',
    description: '单笔订单满 30 元享 8 折，最高优惠 20 元',
    claimed: false,
    used: false,
    expired: false,
  },
  {
    id: 'c6',
    name: '无门槛 3 元券',
    type: 'noThreshold',
    value: 3,
    minAmount: 0,
    expireDate: '2026-12-31',
    scope: '全场通用',
    description: '无门槛立减 3 元',
    claimed: false,
    used: false,
    expired: false,
  },
]

/** 计算优惠券优惠金额 */
export function calcCouponDiscount(coupon: ICoupon, totalAmount: number): number {
  if (totalAmount < coupon.minAmount) return 0
  if (coupon.type === 'fullReduce' || coupon.type === 'noThreshold') {
    return Math.min(coupon.value, totalAmount)
  }
  if (coupon.type === 'discount') {
    const discount = totalAmount * (1 - coupon.value)
    return Math.min(discount, 20, totalAmount) // 最高减 20
  }
  return 0
}

/** 计算商家满减最优档 */
export function calcShopDiscount(
  promo: ICouponShopDiscount | null,
  totalAmount: number,
): { discount: number; currentTierIndex: number; nextTierAmount: number } {
  if (!promo || promo.thresholds.length === 0) {
    return { discount: 0, currentTierIndex: -1, nextTierAmount: 0 }
  }
  let idx = -1
  for (let i = 0; i < promo.thresholds.length; i++) {
    if (totalAmount >= promo.thresholds[i]) {
      idx = i
    } else {
      break
    }
  }
  const discount = idx >= 0 ? promo.discounts[idx] : 0
  const nextTierAmount = idx < promo.thresholds.length - 1 ? promo.thresholds[idx + 1] : 0
  return { discount, currentTierIndex: idx, nextTierAmount }
}
