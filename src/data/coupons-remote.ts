/**
 * 第 2 期 2f：优惠券读写数据库（Supabase）
 *
 * 前端的 ICoupon 是「模板 + 领取状态」的扁平合并体（claimed/used/expired 布尔），
 * 数据库拆成两张表：coupons（券模板，seed 预置 6 张）+ user_coupons（领取记录，
 * unique(user_id, coupon_id)，status: claimed/used/expired）。
 * 本模块负责把两张表重新拼回前端扁平列表；useCoupons 对外接口不变。
 *
 * 约束：
 *   1. 数据库券模板的 id 是 uuid。前端内置 MOCK_COUPONS 的 'c1'~'c6' 不是 uuid，
 *      领取/核销这类 id 时只走本地（登录后列表整体来自数据库，MOCK 仅未登录兜底）。
 *   2. 领取用「先 INSERT，遇 23505 视为已领取」——unique 约束保证一人一券一张。
 *   3. expired 不入库，读取时按 expire_date 与当天比较现算。
 *   4. 券模板由运营在 Supabase 控制台维护（coupons_select 登录可读，无前端写入口）。
 */
import { supabase } from '@/lib/supabase'
import type { ICoupon, CouponType } from './coupon'

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)
const TYPES: CouponType[] = ['fullReduce', 'discount', 'noThreshold']

/** 两张表 → 前端扁平 ICoupon 列表；券模板读取失败返回 null（走本地兜底） */
export async function fetchCouponsForUser(userId: string): Promise<ICoupon[] | null> {
  const sb = supabase
  if (!sb) return null
  const [tplRes, claimRes] = await Promise.all([
    sb.from('coupons').select('*').eq('active', true).order('created_at', { ascending: true }),
    sb.from('user_coupons').select('*').eq('user_id', userId),
  ])
  if (tplRes.error || !tplRes.data) {
    console.warn('[coupons] 读取券模板失败', tplRes.error)
    return null
  }
  if (claimRes.error) {
    // 领取记录读失败按「全部未领取」兜底，不阻断券中心展示
    console.warn('[coupons] 读取领取记录失败', claimRes.error)
  }
  const claims = new Map<string, Record<string, any>>()
  for (const c of claimRes.data ?? []) claims.set(c.coupon_id, c)
  const today = new Date().toISOString().slice(0, 10)
  return tplRes.data.map(t => {
    const claim = claims.get(t.id)
    const expireDate = String(t.expire_date ?? '')
    return {
      id: t.id,
      name: t.name ?? '',
      type: TYPES.includes(t.type) ? (t.type as CouponType) : 'noThreshold',
      value: Number(t.value) || 0,
      minAmount: Number(t.min_amount) || 0,
      expireDate,
      scope: t.scope ?? '',
      description: t.description ?? '',
      claimed: Boolean(claim),
      used: claim?.status === 'used',
      expired: expireDate !== '' && expireDate < today,
    }
  })
}

/** 领券：先 INSERT，23505（一人一券一张）视为已领取的幂等成功 */
export async function claimCouponRemote(couponId: string, userId: string): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(couponId)) return false
  try {
    const ins = await sb.from('user_coupons').insert({ user_id: userId, coupon_id: couponId })
    if (ins.error) {
      if (ins.error.code === '23505') return true
      console.warn('[coupons] 领取失败', couponId, ins.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[coupons] 领取异常', err)
    return false
  }
}

/** 核销（支付成功时调用）：更新领取记录状态；没有领取记录时无可核销，忽略 */
export async function markUsedRemote(couponId: string, userId: string): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(couponId)) return false
  try {
    const upd = await sb
      .from('user_coupons')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('coupon_id', couponId)
    if (upd.error) {
      console.warn('[coupons] 核销失败', couponId, upd.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[coupons] 核销异常', err)
    return false
  }
}
