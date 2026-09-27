/**
 * 第 2 期 2g：钱包/会员/提现读写数据库（Supabase）
 *
 * 数据库设计（init_schema）：
 *   · 余额以 profiles.balance 为准，流水 wallet_transactions 只追加不改写；
 *   · 改余额 + 写流水必须原子完成 → 走现成 RPC apply_wallet_txn
 *     （SECURITY DEFINER 内 auth.uid() 定位本人，余额不足直接抛错回滚）；
 *   · 提现写 withdraw_records（uuid 主键由数据库生成）；
 *   · 会员等级不入库，按 profiles.growth_points 用前端阈值现算。
 *
 * 与前端模型的对应：
 *   memberInfo.balance   ↔ profiles.balance
 *   memberInfo.points    ↔ profiles.growth_points（成长值）
 *   memberInfo.totalSpent↔ profiles.total_spent
 *   isVip/vipExpireDate  ↔ profiles.is_vip / vip_expire_at
 *   IWalletRecord.type 六种取值与 wallet_txn_type 枚举一一对应
 *
 * 降级口径（与 2a~2f 一致）：未配置 / 未登录 / RPC 失败时保持原本地行为，只记日志；
 * 支付密码继续用本地 Mock（profiles.pay_password 保留默认值，不参与校验）。
 * point_records 表暂不写（前端无积分明细展示，留给后续）。
 */
import { supabase } from '@/lib/supabase'
import type { IMemberInfo, IWalletRecord, IWithdrawRecord } from './member'
import { MEMBER_LEVELS } from './member'

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)
const ts = (v: unknown): number | undefined => (v ? Date.parse(String(v)) : undefined)

const WALLET_TYPES = ['recharge', 'consume', 'refund', 'reward', 'withdraw', 'earn'] as const
type DbWalletType = (typeof WALLET_TYPES)[number]

/** 数据库行 → 前端 IWalletRecord */
export function rowToWalletRecord(row: Record<string, any>): IWalletRecord {
  const type = WALLET_TYPES.includes(row.type) ? (row.type as DbWalletType) : 'recharge'
  const base: IWalletRecord = {
    id: row.id,
    type,
    amount: Number(row.amount) || 0,
    balanceAfter: Number(row.balance_after) || 0,
    title: row.title ?? '',
    createdAt: ts(row.created_at) ?? Date.now(),
  }
  if (row.description) base.desc = row.description
  if (row.order_id) base.orderId = row.order_id
  return base
}

/** 数据库行 → 前端 IWithdrawRecord */
export function rowToWithdrawRecord(row: Record<string, any>): IWithdrawRecord {
  const base: IWithdrawRecord = {
    id: row.id,
    amount: Number(row.amount) || 0,
    fee: Number(row.fee) || 0,
    arriveAmount: Number(row.arrive_amount) || 0,
    status: row.status === 'success' ? 'success' : row.status === 'failed' ? 'failed' : 'pending',
    account: row.account ?? '',
    accountType: row.account_type === 'alipay' ? 'alipay' : row.account_type === 'bank' ? 'bank' : 'wechat',
    createdAt: ts(row.created_at) ?? Date.now(),
  }
  const arriveAt = ts(row.arrive_at)
  if (arriveAt) base.arriveAt = arriveAt
  if (row.remark) base.remark = row.remark
  return base
}

/** growth_points 按前端会员阈值推导等级（数据库不存 level） */
function deriveLevel(growthPoints: number): number {
  let level = MEMBER_LEVELS[0].level
  for (const l of MEMBER_LEVELS) {
    if (growthPoints >= l.threshold) level = l.level
  }
  return level
}

/** profiles 行 → 前端 IMemberInfo（level 现算） */
function profileToMemberInfo(row: Record<string, any>): IMemberInfo {
  const growthPoints = Math.max(0, Math.round(Number(row.growth_points) || 0))
  const info: IMemberInfo = {
    level: deriveLevel(growthPoints),
    points: growthPoints,
    balance: Number(row.balance) || 0,
    totalSpent: Number(row.total_spent) || 0,
    isVip: Boolean(row.is_vip),
  }
  const vipExpire = ts(row.vip_expire_at)
  if (vipExpire) info.vipExpireDate = new Date(vipExpire).toISOString().slice(0, 10)
  return info
}

export interface WalletSnapshot {
  memberInfo: IMemberInfo
  records: IWalletRecord[]
  withdraws: IWithdrawRecord[]
}

/** 登录后拉取：profiles + 本人钱包流水 + 本人提现记录；任一主数据失败返回 null 走本地 */
export async function fetchWalletSnapshot(userId: string): Promise<WalletSnapshot | null> {
  const sb = supabase
  if (!sb) return null
  const [profileRes, recordsRes, withdrawRes] = await Promise.all([
    sb.from('profiles').select('balance,growth_points,total_spent,is_vip,vip_expire_at').eq('id', userId).single(),
    sb.from('wallet_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    sb.from('withdraw_records').select('*').eq('actor_id', userId).order('created_at', { ascending: false }),
  ])
  if (profileRes.error || !profileRes.data) {
    console.warn('[wallet] 读取钱包资料失败', profileRes.error)
    return null
  }
  if (recordsRes.error) console.warn('[wallet] 读取钱包流水失败', recordsRes.error)
  if (withdrawRes.error) console.warn('[wallet] 读取提现记录失败', withdrawRes.error)
  return {
    memberInfo: profileToMemberInfo(profileRes.data),
    records: (recordsRes.data ?? []).map(rowToWalletRecord),
    withdraws: (withdrawRes.data ?? []).map(rowToWithdrawRecord),
  }
}

/**
 * 原子记账（改余额 + 写流水）：recharge/consume/refund/withdraw/earn/reward。
 * orderId 非 uuid（旧本地单）自动置空。成功返回数据库生成的流水记录；失败返回 null。
 */
export async function applyWalletTxn(
  type: DbWalletType,
  amount: number,
  title: string,
  description?: string,
  orderId?: string,
): Promise<IWalletRecord | null> {
  const sb = supabase
  if (!sb) return null
  try {
    const { data, error } = await sb.rpc('apply_wallet_txn', {
      p_type: type,
      p_amount: amount,
      p_title: title,
      p_description: description ?? '',
      p_order_id: orderId && isUuid(orderId) ? orderId : null,
    })
    if (error || !data) {
      console.warn('[wallet] 记账失败', type, amount, error?.message)
      return null
    }
    return rowToWalletRecord(Array.isArray(data) ? data[0] : data)
  } catch (err) {
    console.warn('[wallet] 记账异常', err)
    return null
  }
}

/** 同步成长值与累计消费到 profiles（余额不在这里改，走 applyWalletTxn） */
export async function syncWalletStats(
  userId: string,
  growthPoints: number,
  totalSpent: number,
): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(userId)) return false
  try {
    const upd = await sb
      .from('profiles')
      .update({ growth_points: Math.max(0, Math.round(growthPoints)), total_spent: Math.max(0, totalSpent) })
      .eq('id', userId)
    if (upd.error) {
      console.warn('[wallet] 同步成长值失败', upd.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[wallet] 同步成长值异常', err)
    return false
  }
}

/** 提现：写 withdraw_records（uuid 由数据库生成），成功返回数据库 id */
export async function insertWithdrawRecord(
  rec: Omit<IWithdrawRecord, 'id'>,
  userId: string,
): Promise<string | null> {
  const sb = supabase
  if (!sb) return null
  try {
    const ins = await sb
      .from('withdraw_records')
      .insert({
        actor_id: userId,
        actor_role: 'customer',
        amount: rec.amount,
        fee: rec.fee,
        arrive_amount: rec.arriveAmount,
        status: 'pending',
        account: rec.account,
        account_type: rec.accountType,
      })
      .select('id')
    if (ins.error || !ins.data || ins.data.length === 0) {
      console.warn('[wallet] 提现记录写入失败', ins.error?.message)
      return null
    }
    return (ins.data[0] as Record<string, any>).id
  } catch (err) {
    console.warn('[wallet] 提现记录写入异常', err)
    return null
  }
}

/** 提现到账（演示 3 秒后成功）：更新状态与到账时间 */
export async function completeWithdrawRecord(recordId: string): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(recordId)) return false
  try {
    const upd = await sb
      .from('withdraw_records')
      .update({ status: 'success', arrive_at: new Date().toISOString() })
      .eq('id', recordId)
    if (upd.error) {
      console.warn('[wallet] 提现到账更新失败', recordId, upd.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[wallet] 提现到账更新异常', err)
    return false
  }
}
