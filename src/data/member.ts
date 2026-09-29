// EXPORTS: IMemberInfo, IMemberPrivilege, IWalletRecord, IMemberLevelInfo, IWithdrawRecord, MEMBER_LEVELS, MOCK_MEMBER_INFO, MOCK_WALLET_RECORDS, MOCK_WITHDRAW_RECORDS

export interface IMemberPrivilege {
  id: string
  name: string
  desc: string
  icon: string
}

export interface IMemberInfo {
  level: number // 1=普通 2=白银 3=黄金 4=铂金 5=钻石
  points: number // 当前成长值
  balance: number // 钱包余额（元）
  totalSpent: number // 累计消费（元）
  isVip: boolean // 是否开通会员
  vipExpireDate?: string
  vipExpiresAt?: string // 精确有效期，供到期判定；日期字段只用于展示
}

export interface IWalletRecord {
  id: string
  // 与数据库 wallet_txn_type 枚举一致（第 2 期 2g）：earn 为骑手收入
  type: 'recharge' | 'consume' | 'refund' | 'reward' | 'withdraw' | 'earn'
  amount: number
  balanceAfter: number
  title: string
  desc?: string
  createdAt: number
  orderId?: string
}

export interface IWithdrawRecord {
  id: string
  amount: number
  fee: number
  arriveAmount: number
  status: 'pending' | 'success' | 'failed'
  account: string
  accountType: 'alipay' | 'wechat' | 'bank'
  createdAt: number
  arriveAt?: number
  remark?: string
}

export interface IMemberLevelInfo {
  level: number
  name: string
  threshold: number // 成长值门槛
  color: string
  privileges: string[]
}

export const MEMBER_LEVELS: IMemberLevelInfo[] = [
  { level: 1, name: '普通会员', threshold: 0, color: '#9ca3af', privileges: ['新人专享券', '生日券'] },
  { level: 2, name: '白银会员', threshold: 200, color: '#94a3b8', privileges: ['每周一张配送券', '积分 1.2 倍'] },
  { level: 3, name: '黄金会员', threshold: 1000, color: '#f59e0b', privileges: ['每月 2 张 5 元券', '积分 1.5 倍', '专属客服'] },
  { level: 4, name: '铂金会员', threshold: 3000, color: '#64748b', privileges: ['每月 3 张 8 元券', '免配送费 3 次', '积分 2 倍', '生日双倍积分'] },
  { level: 5, name: '钻石会员', threshold: 8000, color: '#0f172a', privileges: ['每月 5 张 10 元券', '免配送费不限次数', '积分 3 倍', '专属客服优先响应', '专属会员价'] },
]

export const MOCK_MEMBER_INFO: IMemberInfo = {
  level: 2,
  points: 380,
  balance: 52.8,
  totalSpent: 1268.5,
  isVip: false,
}

export const MOCK_WALLET_RECORDS: IWalletRecord[] = [
  {
    id: 'wr1',
    type: 'recharge',
    amount: 50,
    balanceAfter: 52.8,
    title: '余额充值',
    desc: '微信支付充值',
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'wr2',
    type: 'consume',
    amount: -28.5,
    balanceAfter: 2.8,
    title: '订单支付',
    desc: '饭否外卖',
    createdAt: Date.now() - 86400000 * 1,
    orderId: 'ORD2025091000001',
  },
  {
    id: 'wr3',
    type: 'withdraw',
    amount: -50,
    balanceAfter: 0,
    title: '提现到微信',
    desc: '预计 1-3 个工作日到账',
    createdAt: Date.now() - 86400000 * 5,
  },
]

export const MOCK_WITHDRAW_RECORDS: IWithdrawRecord[] = [
  {
    id: 'wd1',
    amount: 100,
    fee: 1,
    arriveAmount: 99,
    status: 'success',
    account: '微信零钱',
    accountType: 'wechat',
    createdAt: Date.now() - 86400000 * 7,
    arriveAt: Date.now() - 86400000 * 6,
  },
  {
    id: 'wd2',
    amount: 50,
    fee: 0,
    arriveAmount: 50,
    status: 'pending',
    account: '支付宝',
    accountType: 'alipay',
    createdAt: Date.now() - 3600000 * 2,
  },
]
