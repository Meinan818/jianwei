// EXPORTS: IAuthUser, UserRole, IRegisteredAccount, SIMULATED_CODE, ACCOUNTS_KEY_PREFIX

export type UserRole = 'customer' | 'merchant' | 'rider'

export interface IAuthUser {
  id: string
  role: UserRole
  phone: string
  nickname: string
  avatar: string
  shopId?: string  // 商家身份绑定的店铺ID（一账号一店铺）
  shopName?: string // 店铺名称，方便快速展示
  riderId?: string // 骑手工号
  loggedIn: boolean
}

// 注册账号（按角色独立存储）
export interface IRegisteredAccount {
  phone: string
  password: string
  nickname: string
  avatar: string
  shopId?: string   // 商家账号绑定的店铺 ID（一账号一店铺）
  shopName?: string // 店铺名称冗余，便于快速读取
  riderId?: string  // 骑手编号
  createdAt: number
}

// 模拟验证码：固定 123456，原型演示用
export const SIMULATED_CODE = '123456'

// 注册账号存储 key 前缀（按角色区分，三端账号独立）
export const ACCOUNTS_KEY_PREFIX = 'food_delivery_accounts_'

// 用户-店铺关系表存储 key（商家账号与店铺 1:1 映射，显式记录便于将来接后端）
export const USER_SHOP_RELATION_KEY = 'food_delivery_user_shop_relation'
