// EXPORTS: IWalletRecord, IMembershipInfo, IPointRecord, WalletState, WALLET_STORAGE_KEY

export interface IWalletRecord {
  id: string
  type: 'recharge' | 'consume' | 'refund' | 'earn'
  amount: number
  balanceAfter: number
  description: string
  orderId?: string
  createdAt: number
}

export interface IMembershipInfo {
  level: number // 1=普通 2=银卡 3=金卡 4=黑金
  levelName: string
  growth: number // 当前成长值
  nextLevelGrowth: number // 下一级所需
  points: number // 积分余额
  expireAt?: number // 会员到期时间
  isActive: boolean
}

export interface IPointRecord {
  id: string
  type: 'earn' | 'spend' | 'expire'
  amount: number
  description: string
  orderId?: string
  createdAt: number
}

export interface WalletState {
  balance: number
  records: IWalletRecord[]
  membership: IMembershipInfo
  pointRecords: IPointRecord[]
}

export const WALLET_STORAGE_KEY = 'food_delivery_wallet'

export const MEMBERSHIP_LEVELS = [
  { level: 1, name: '普通会员', growth: 0, nextGrowth: 100, benefits: ['基础服务', '积分抵现1:100'] },
  { level: 2, name: '银卡会员', growth: 100, nextGrowth: 500, benefits: ['配送费9折', '专属客服', '积分抵现1:80'] },
  { level: 3, name: '金卡会员', growth: 500, nextGrowth: 2000, benefits: ['配送费8折', '专属红包', '双倍积分', '优先接单'] },
  { level: 4, name: '黑金会员', growth: 2000, nextGrowth: 99999, benefits: ['免配送费', '专属客服经理', '三倍积分', '生日礼遇', '极速配送'] },
]
