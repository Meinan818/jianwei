// EXPORTS: IShopStatus, ICustomCategory, IShopActivity, IFinanceWithdrawRecord, IDishSpecOverride, IDishExtraOverride, SHOP_STATUS_KEY, FINANCE_WITHDRAW_KEY, IUserCreatedShop, USER_SHOPS_KEY, USER_SHOP_RELATION_KEY

export interface ICustomCategory {
  id: string
  name: string
  sort: number
}

export type ActivityType = 'fullReduce' | 'newUser' | 'discount' | 'discountDish' | 'freeDelivery'

export interface IShopActivity {
  id: string
  type: ActivityType
  name: string
  description: string
  active: boolean
  // 满减
  thresholds?: number[]
  discounts?: number[]
  // 新客立减
  newUserAmount?: number
  // 店铺折扣率（0~1）
  discountRate?: number
  // 折扣菜
  dishId?: string
  dishDiscountRate?: number // 0~1，如 0.8 = 8折
  // 免配送费门槛
  freeDeliveryMin?: number
  createdAt: number
}

export interface IFinanceWithdrawRecord {
  id: string
  shopId: string
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

export interface IDishSpecOverride {
  id: string
  name: string
  options: { id: string; label: string; priceDelta?: number }[]
}

export interface IDishExtraOverride {
  id: string
  name: string
  price: number
}

export interface IShopStatus {
  [shopId: string]: {
    isOpen: boolean // 营业中 / 休息中
    announcement: string
    businessHours?: string // 营业时间
    minOrder: number
    deliveryFee: number
    monthSales: number // 店铺月售（动态累加）
    /**
     * 第 2 期 2h：本机改过、还没成功写入数据库的店铺级字段。
     *
     * 店铺级字段（营业开关/公告/营业时间/起送价/配送费）在数据库里也有对应列，
     * 本机覆盖层只是「改的瞬间先顶上」；写库成功后标记会被清掉，
     * 之后每次重拉数据库都会用新值刷新本机——否则客户端会一直显示登录那一刻的旧公告。
     */
    localEdited?: Partial<Record<'isOpen' | 'announcement' | 'businessHours' | 'minOrder' | 'deliveryFee', boolean>>
    // 自定义分类（商家新增的分类，叠加在原始分类后）
    customCategories: ICustomCategory[]
    // 菜品覆盖配置: dishId -> { price, soldOut, onShelf, stock, image?, sales? }
    dishes: {
      [dishId: string]: {
        price: number
        soldOut: boolean
        onShelf: boolean
        stock: number // -1 表示不限库存
        sales: number // 菜品月售（动态累加）
        image?: string // 自定义图片（base64 或 URL），undefined 表示用原图
        name?: string  // 自定义名称，undefined 表示用原名称
        description?: string // 自定义描述
        categoryId?: string // 新增菜品所属分类
        specs?: IDishSpecOverride[] // 自定义规格组（覆盖原菜品）
        extras?: IDishExtraOverride[] // 自定义加料（覆盖原菜品）
      }
    }
    // 满减活动（老字段，保留兼容）
    promotion: {
      type: 'fullReduce'
      thresholds: number[]
      discounts: number[]
      description: string
    } | null
    // 营销活动列表（新字段，支持多种活动类型）
    activities: IShopActivity[]
  }
}

export const SHOP_STATUS_KEY = 'food_delivery_shop_status'
export const FINANCE_WITHDRAW_KEY = 'food_delivery_finance_withdraw'

// —— 用户自定义店铺（商家账号注册后创建的店铺）——
// 存储键：每个用户创建的店铺作为独立 IShop 对象存到数组里。
// 账号与店铺 1:1 关系（商家账号唯一对应一家店铺）。
export interface IUserCreatedShop {
  id: string            // 店铺 ID，前缀 'user_shop_' 保证与 mock 店铺不冲突
  ownerPhone: string    // 所属商家账号手机号
  name: string
  cover: string
  tagline: string
  rating: number
  monthSales: number
  minOrder: number
  deliveryFee: number
  deliveryTime: string
  distance: string
  category: string
  address: string
  phone: string
  description: string
  businessHours: string
  announcement: string
  categories: { id: string; name: string; dishes: IUserCreatedDish[] }[]
  createdAt: number
}

export interface IUserCreatedDish {
  id: string
  name: string
  description: string
  price: number
  image: string
  sales: number
  categoryId: string
}

export const USER_SHOPS_KEY = 'food_delivery_user_shops'

// 商家账号 <-> 店铺 关系表（1:1，但通过这个表显式记录，便于将来接后端时直接映射 shop_id）
export const USER_SHOP_RELATION_KEY = 'food_delivery_user_shop_relation'
