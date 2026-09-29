import test from 'node:test'
import assert from 'node:assert/strict'
import { hasActiveMembership, isMembershipPaymentMethod } from '../src/data/membership.ts'

test('会员仅在截止时间之前有效，到期和脏数据不会永久获得资格', () => {
  const now = Date.parse('2026-09-29T10:00:00Z')
  assert.equal(hasActiveMembership({ isVip: true, vipExpiresAt: '2026-09-29T10:00:01Z' }, now), true)
  assert.equal(hasActiveMembership({ isVip: true, vipExpiresAt: '2026-09-29T10:00:00Z' }, now), false)
  assert.equal(hasActiveMembership({ isVip: false, vipExpiresAt: '2026-10-29T10:00:00Z' }, now), false)
  assert.equal(hasActiveMembership({ isVip: true }, now), false)
  assert.equal(hasActiveMembership({ isVip: true, vipExpiresAt: 'invalid' }, now), false)
  assert.equal(hasActiveMembership({ isVip: true, vipExpireDate: '2026-10-01' }, now), true)
})
test('会员支持演示微信、支付宝和余额，不接受货到付款和任意参数', () => {
  for (const method of ['wechat', 'alipay', 'balance']) assert.equal(isMembershipPaymentMethod(method), true)
  for (const method of ['cod', '', 'cash']) assert.equal(isMembershipPaymentMethod(method), false)
})
