import type { IMemberInfo } from './member'

export const MEMBERSHIP_PRICE = 15
export const MEMBERSHIP_DAYS = 30
export type MembershipPaymentMethod = 'wechat' | 'alipay' | 'balance'

export function isMembershipPaymentMethod(value: string): value is MembershipPaymentMethod {
  return value === 'wechat' || value === 'alipay' || value === 'balance'
}

/** 资格以精确到期时间为准；旧缓存只有日期时也不能永久保留 VIP。 */
export function hasActiveMembership(info: Pick<IMemberInfo, 'isVip' | 'vipExpiresAt' | 'vipExpireDate'>, now = Date.now()): boolean {
  const expiry = Date.parse(info.vipExpiresAt || info.vipExpireDate || '')
  return info.isVip && Number.isFinite(expiry) && expiry > now
}
