// EXPORTS: IShop, IShopCategory, IDish, IDishSpec, IDishExtra, IShopPromotion, IShopActivity, MOCK_SHOPS, MOCK_BANNERS, getAllShops, getShopActivities

export interface IDishSpec {
  id: string
  name: string      // 规格组名，如「辣度」「份量」「甜度」
  options: { id: string; label: string; priceDelta?: number }[]
}

export interface IDishExtra {
  id: string
  name: string      // 加料名，如「加蛋」「加芝士」「加大份」
  price: number     // 加价
}

export interface IDish {
  id: string
  name: string
  description: string
  price: number     // 基础价（默认规格）
  image: string
  sales: number
  categoryId: string
  specs?: IDishSpec[]       // 单选规格组（如辣度、份量）
  extras?: IDishExtra[]     // 可选加料（多选，每项加价）
  // —— 第 2 期 2h：商家侧配置的「可上云字段」（数据库 dishes 表的同名列）——
  // 从数据库读回来的店铺会带上它们；内置演示店铺（MOCK_SHOPS）没有这几个字段，
  // 读取方一律按 onShelf ?? true / soldOut ?? false / stock ?? -1 兜底。
  onShelf?: boolean         // 是否上架
  soldOut?: boolean         // 是否售罄
  stock?: number            // -1 表示不限库存
}

export interface IShopCategory {
  id: string
  name: string
  dishes: IDish[]
  isCustom?: boolean
}

export interface IShopPromotion {
  type: 'fullReduce'
  thresholds: number[]
  discounts: number[]
  description: string
}

export interface IShopActivity {
  id: string
  type: 'fullReduce' | 'newUser' | 'discount' | 'freeDelivery' | 'discountDish' // 折扣菜为菜品级
  name: string
  description: string
  active: boolean
  // 满减
  thresholds?: number[]
  discounts?: number[]
  // 新客立减
  newUserAmount?: number
  // 折扣
  discountRate?: number // 0~1，如 0.8 = 8折
  // 免配送费门槛
  freeDeliveryMin?: number
  // 折扣菜
  dishId?: string
  dishDiscountRate?: number
  createdAt: number
}

export interface IAppointmentSlot {
  label: string  // "10:30-11:00"
  available: boolean
}

export interface IShop {
  id: string
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
  categories: IShopCategory[]
  promotion?: IShopPromotion
  packingFee?: number         // 打包费（订单级）
  freeDeliveryMin?: number    // 免配送费门槛
  activities?: IShopActivity[] // 全部营销活动
  appointmentSlots?: IAppointmentSlot[] // 预约时段
  supportAppointment?: boolean // 是否支持预约
  isOpen?: boolean            // 营业开关（第 2 期 2h：从数据库 shops.is_open 读回）
}

export interface IBanner {
  id: string
  image: string
  title: string
}

// 使用 Vite 原生 BASE_URL（在沙箱中由 index.html 的 <base href> 注入）
// 兼容 dev（base=/app/<id>/）和线上部署
const IMG_BASE = (import.meta.env.BASE_URL || '/') + 'images/'

const B1 = IMG_BASE + 'banner-1.jpg'
const B2 = IMG_BASE + 'banner-2.jpg'
const B3 = IMG_BASE + 'banner-3.jpg'
const S1 = IMG_BASE + 'dish-hongshaorou.jpg'
const S2 = IMG_BASE + 'dish-shuizhuniurou.jpg'
const S3 = IMG_BASE + 'dish-gongbaojiding.jpg'
const S4 = IMG_BASE + 'dish-naicha.jpg'
const S5 = IMG_BASE + 'dish-sushi.jpg'
const S6 = IMG_BASE + 'dish-malaxiangguo.jpg'
const S7 = IMG_BASE + 'dish-suancaiyu.jpg'
const S8 = IMG_BASE + 'dish-lamian.jpg'

export const MOCK_BANNERS: IBanner[] = [
  { id: 'b1', image: B1, title: '品质美食 即刻送达' },
  { id: 'b2', image: B2, title: '新鲜食材 匠心烹饪' },
  { id: 'b3', image: B3, title: '温暖一餐 从指尖开始' },
]

export const MOCK_SHOPS: IShop[] = [
  {
    id: '1',
    name: '饭否·品质快餐',
    cover: S1,
    tagline: '精选食材 · 匠心烹制',
    rating: 4.7,
    monthSales: 3256,
    minOrder: 20,
    deliveryFee: 3,
    deliveryTime: '25-35分钟',
    distance: '0.8km',
    category: '快餐便当',
    address: '朝阳区望京SOHO T1 B1层',
    phone: '010-8888-1001',
    description: '饭否品质快餐坚持每日新鲜采购食材，所有餐品现点现做。我们承诺每一份餐品都经过严格的品质把控，从源头保证食品安全，让每一位顾客吃得放心、吃得满意。',
    businessHours: '09:00 - 21:00',
    announcement: '精选食材，每日新鲜烹制',
    promotion: { type: 'fullReduce', thresholds: [25, 45, 65], discounts: [3, 8, 15], description: '满25减3，满45减8，满65减15' },
    categories: [
      {
        id: '1-1', name: '热销',
        dishes: [
          { id: 'd1', name: '红烧肉套餐', description: '精选五花肉配时蔬', price: 28, image: S1, sales: 892, categoryId: '1-1' },
          { id: 'd2', name: '宫保鸡丁饭', description: '鸡丁花生经典搭配', price: 25, image: S2, sales: 756, categoryId: '1-1' },
          { id: 'd3', name: '糖醋里脊盖饭', description: '外酥里嫩酸甜可口', price: 26, image: S3, sales: 634, categoryId: '1-1' },
        ],
      },
      {
        id: '1-2', name: '套餐',
        dishes: [
          { id: 'd4', name: '两荤一素套餐', description: '任选两荤一素搭配', price: 22, image: S2, sales: 1203, categoryId: '1-2' },
          { id: 'd5', name: '三荤两素套餐', description: '丰盛搭配实惠之选', price: 32, image: S1, sales: 568, categoryId: '1-2' },
          { id: 'd6', name: '酸菜鱼套餐', description: '鲜嫩鱼片酸辣开胃', price: 35, image: S8, sales: 445, categoryId: '1-2' },
        ],
      },
      {
        id: '1-3', name: '小食饮品',
        dishes: [
          { id: 'd7', name: '紫菜蛋花汤', description: '清淡鲜美暖胃', price: 6, image: S8, sales: 2100, categoryId: '1-3' },
          { id: 'd8', name: '冰镇柠檬水', description: '清爽解渴', price: 8, image: S4, sales: 1876, categoryId: '1-3' },
        ],
      },
    ],
  },
  {
    id: '2',
    name: '川味轩',
    cover: S2,
    tagline: '地道川味 · 麻辣鲜香',
    rating: 4.8,
    monthSales: 4521,
    minOrder: 25,
    deliveryFee: 4,
    deliveryTime: '30-40分钟',
    distance: '1.3km',
    category: '中式炒菜',
    address: '朝阳区三里屯太古里南区3层',
    phone: '010-8888-2002',
    description: '川味轩传承正宗川味，由四川籍大厨掌勺，坚持使用原产地辣椒和花椒，还原最地道的麻辣鲜香。招牌水煮牛肉、毛血旺、酸菜鱼深受食客喜爱。',
    businessHours: '10:00 - 22:00',
    announcement: '地道川味，麻辣鲜香',
    promotion: { type: 'fullReduce', thresholds: [30, 60, 100], discounts: [5, 12, 25], description: '满30减5，满60减12，满100减25' },
    categories: [
      {
        id: '2-1', name: '热销',
        dishes: [
          { id: 'd9', name: '水煮牛肉', description: '麻辣鲜嫩牛肉片', price: 48, image: S2, sales: 1205, categoryId: '2-1',
            specs: [{ id: 'spicy', name: '辣度', options: [{ id: 'mild', label: '微辣', priceDelta: 0 }, { id: 'mid', label: '中辣' }, { id: 'hot', label: '特辣', priceDelta: 2 }] }],
            extras: [{ id: 'e1', name: '加粉丝', price: 5 }, { id: 'e2', name: '加豆皮', price: 4 }, { id: 'e3', name: '加午餐肉', price: 8 }] },
          { id: 'd10', name: '辣子鸡丁', description: '干辣椒爆炒鸡肉', price: 38, image: S1, sales: 987, categoryId: '2-1',
            specs: [{ id: 'spicy', name: '辣度', options: [{ id: 'mild', label: '微辣' }, { id: 'mid', label: '中辣' }, { id: 'hot', label: '特辣', priceDelta: 2 }] }] },
          { id: 'd11', name: '鱼香肉丝', description: '经典川味酸甜带辣', price: 32, image: S3, sales: 856, categoryId: '2-1' },
        ],
      },
      {
        id: '2-2', name: '招牌硬菜',
        dishes: [
          { id: 'd12', name: '毛血旺', description: '鸭血毛肚料足味浓', price: 58, image: S8, sales: 678, categoryId: '2-2',
            specs: [{ id: 'spicy', name: '辣度', options: [{ id: 'mild', label: '微辣' }, { id: 'mid', label: '中辣' }, { id: 'hot', label: '特辣', priceDelta: 3 }] }],
            extras: [{ id: 'e4', name: '加毛肚', price: 12 }, { id: 'e5', name: '加黄喉', price: 10 }, { id: 'e6', name: '加午餐肉', price: 8 }] },
          { id: 'd13', name: '酸菜鱼', description: '鲜嫩鱼片配酸菜', price: 52, image: S7, sales: 543, categoryId: '2-2',
            extras: [{ id: 'e7', name: '加鱼片', price: 15 }, { id: 'e1', name: '加粉丝', price: 5 }, { id: 'e8', name: '加豆腐', price: 4 }] },
          { id: 'd14', name: '回锅肉', description: '五花肉蒜苗经典', price: 36, image: S2, sales: 912, categoryId: '2-2' },
        ],
      },
      {
        id: '2-3', name: '主食',
        dishes: [
          { id: 'd15', name: '蛋炒饭', description: '粒粒分明蛋香十足', price: 15, image: S1, sales: 2340, categoryId: '2-3' },
          { id: 'd16', name: '担担面', description: '芝麻酱肉末拌面', price: 18, image: S8, sales: 1678, categoryId: '2-3' },
        ],
      },
    ],
  },
  {
    id: '3',
    name: '堡堡王',
    cover: S3,
    tagline: '现点现做 · 新鲜出炉',
    rating: 4.5,
    monthSales: 2876,
    minOrder: 25,
    deliveryFee: 5,
    deliveryTime: '20-30分钟',
    distance: '0.6km',
    category: '汉堡披萨',
    address: '朝阳区国贸商城B2层',
    phone: '010-8888-3003',
    description: '堡堡王坚持手工现做，所有肉饼选用优质牛肉，每日新鲜配送。现烤面包搭配秘制酱料，每一口都是满足。还有多款意式薄底披萨等您品尝。',
    businessHours: '08:00 - 22:30',
    announcement: '现点现做，新鲜出炉',
    promotion: { type: 'fullReduce', thresholds: [30, 50, 80], discounts: [5, 10, 18], description: '满30减5，满50减10，满80减18' },
    categories: [
      {
        id: '3-1', name: '热销',
        dishes: [
          { id: 'd17', name: '经典牛肉堡', description: '厚切牛肉饼配芝士', price: 32, image: S3, sales: 1654, categoryId: '3-1',
            specs: [{ id: 'size', name: '份量', options: [{ id: 'single', label: '单层' }, { id: 'double', label: '双层', priceDelta: 12 }] }],
            extras: [{ id: 'cheese', name: '加芝士', price: 4 }, { id: 'bacon', name: '加培根', price: 6 }, { id: 'egg', name: '加煎蛋', price: 4 }] },
          { id: 'd18', name: '双层芝士堡', description: '双层牛肉双重满足', price: 42, image: S1, sales: 1230, categoryId: '3-1',
            extras: [{ id: 'bacon', name: '加培根', price: 6 }, { id: 'egg', name: '加煎蛋', price: 4 }] },
          { id: 'd19', name: '辣味鸡腿堡', description: '香辣鸡腿鲜嫩多汁', price: 28, image: S2, sales: 987, categoryId: '3-1',
            specs: [{ id: 'spicy', name: '辣度', options: [{ id: 'mild', label: '微辣' }, { id: 'hot', label: '超辣', priceDelta: 1 }] }],
            extras: [{ id: 'cheese', name: '加芝士', price: 4 }] },
        ],
      },
      {
        id: '3-2', name: '披萨',
        dishes: [
          { id: 'd20', name: '意式经典披萨', description: '薄底番茄芝士罗勒', price: 48, image: S3, sales: 678, categoryId: '3-2' },
          { id: 'd21', name: '黑椒牛肉披萨', description: '黑椒牛肉彩椒芝士', price: 55, image: S2, sales: 432, categoryId: '3-2' },
        ],
      },
      {
        id: '3-3', name: '小食饮品',
        dishes: [
          { id: 'd22', name: '黄金薯条', description: '外酥里嫩金黄酥脆', price: 12, image: S6, sales: 3456, categoryId: '3-3' },
          { id: 'd23', name: '冰镇可乐', description: '经典冰爽', price: 8, image: S4, sales: 2890, categoryId: '3-3' },
        ],
      },
    ],
  },
  {
    id: '4',
    name: '茶颜茶语',
    cover: S4,
    tagline: '手作茶饮 · 每日鲜煮',
    rating: 4.9,
    monthSales: 6234,
    minOrder: 15,
    deliveryFee: 2,
    deliveryTime: '15-25分钟',
    distance: '0.4km',
    category: '奶茶饮品',
    address: '朝阳区望京街9号合生汇B1',
    phone: '010-8888-4004',
    description: '茶颜茶语坚持每日现煮茶汤，精选优质茶叶，手作每一杯好茶。招牌珍珠奶茶Q弹爽口，黑糖波波鲜奶浓郁焦香，还有多款果茶系列等您来尝。',
    businessHours: '10:00 - 22:00',
    announcement: '手作茶饮，每日鲜煮',
    promotion: { type: 'fullReduce', thresholds: [20, 35, 50], discounts: [2, 5, 8], description: '满20减2，满35减5，满50减8' },
    categories: [
      {
        id: '4-1', name: '招牌奶茶',
        dishes: [
          { id: 'd24', name: '经典珍珠奶茶', description: 'Q弹珍珠配醇香奶茶', price: 16, image: S4, sales: 3245, categoryId: '4-1',
            specs: [
              { id: 'sweet', name: '甜度', options: [{ id: 's0', label: '无糖' }, { id: 's1', label: '三分糖' }, { id: 's2', label: '五分糖' }, { id: 's3', label: '七分糖' }, { id: 's4', label: '全糖' }] },
              { id: 'ice', name: '冰度', options: [{ id: 'i0', label: '热' }, { id: 'i1', label: '去冰' }, { id: 'i2', label: '少冰' }, { id: 'i3', label: '正常冰' }] },
              { id: 'size', name: '杯型', options: [{ id: 'mid', label: '中杯' }, { id: 'big', label: '大杯', priceDelta: 4 }] },
            ],
            extras: [{ id: 'pearl', name: '加珍珠', price: 3 }, { id: 'coco', name: '加椰果', price: 3 }, { id: 'pudding', name: '加布丁', price: 4 }] },
          { id: 'd25', name: '黑糖波波鲜奶', description: '手炒黑糖浓郁焦香', price: 22, image: S2, sales: 2876, categoryId: '4-1',
            specs: [
              { id: 'sweet', name: '甜度', options: [{ id: 's0', label: '无糖' }, { id: 's1', label: '三分糖' }, { id: 's2', label: '五分糖' }, { id: 's3', label: '七分糖' }] },
              { id: 'ice', name: '冰度', options: [{ id: 'i0', label: '热' }, { id: 'i1', label: '去冰' }, { id: 'i2', label: '少冰' }, { id: 'i3', label: '正常冰' }] },
              { id: 'size', name: '杯型', options: [{ id: 'mid', label: '中杯' }, { id: 'big', label: '大杯', priceDelta: 5 }] },
            ],
            extras: [{ id: 'pearl', name: '加珍珠', price: 3 }, { id: 'pudding', name: '加布丁', price: 4 }] },
          { id: 'd26', name: '芋泥啵啵奶茶', description: '绵密芋泥香甜可口', price: 20, image: S1, sales: 2134, categoryId: '4-1',
            specs: [
              { id: 'sweet', name: '甜度', options: [{ id: 's1', label: '三分糖' }, { id: 's2', label: '五分糖' }, { id: 's3', label: '七分糖' }, { id: 's4', label: '全糖' }] },
              { id: 'ice', name: '冰度', options: [{ id: 'i0', label: '热' }, { id: 'i1', label: '去冰' }, { id: 'i2', label: '少冰' }] },
              { id: 'size', name: '杯型', options: [{ id: 'mid', label: '中杯' }, { id: 'big', label: '大杯', priceDelta: 4 }] },
            ],
            extras: [{ id: 'taro', name: '加芋泥', price: 5 }, { id: 'coco', name: '加椰果', price: 3 }] },
        ],
      },
      {
        id: '4-2', name: '果茶系列',
        dishes: [
          { id: 'd27', name: '满杯西柚', description: '鲜切西柚清爽解腻', price: 18, image: S7, sales: 1890, categoryId: '4-2' },
          { id: 'd28', name: '柠檬绿茶', description: '清新柠檬搭配绿茶', price: 14, image: S4, sales: 2345, categoryId: '4-2' },
          { id: 'd29', name: '百香果双响炮', description: '百香果椰果双重口感', price: 20, image: S3, sales: 1678, categoryId: '4-2' },
        ],
      },
      {
        id: '4-3', name: '纯茶',
        dishes: [
          { id: 'd30', name: '高山乌龙', description: '清雅花香回甘悠长', price: 12, image: S4, sales: 890, categoryId: '4-3' },
          { id: 'd31', name: '茉莉绿茶', description: '花香四溢清新淡雅', price: 10, image: S7, sales: 1203, categoryId: '4-3' },
        ],
      },
    ],
  },
  {
    id: '5',
    name: '樱花亭',
    cover: S5,
    tagline: '匠心日料 · 新鲜刺身',
    rating: 4.6,
    monthSales: 2156,
    minOrder: 30,
    deliveryFee: 5,
    deliveryTime: '30-45分钟',
    distance: '1.8km',
    category: '日韩料理',
    address: '朝阳区亮马桥外交公寓底商',
    phone: '010-8888-5005',
    description: '樱花亭是一家专注日式料理的精致餐厅，刺身每日空运到货，确保极致新鲜。主厨拥有15年日料经验，匠心制作每一道菜品，带给您地道的东瀛风味。',
    businessHours: '11:00 - 22:00',
    announcement: '匠心日料，新鲜刺身',
    promotion: { type: 'fullReduce', thresholds: [50, 80, 120], discounts: [8, 15, 28], description: '满50减8，满80减15，满120减28' },
    categories: [
      {
        id: '5-1', name: '热销',
        dishes: [
          { id: 'd32', name: '三文鱼刺身', description: '新鲜厚切三文鱼', price: 58, image: S5, sales: 678, categoryId: '5-1' },
          { id: 'd33', name: '鳗鱼饭', description: '蒲烧鳗鱼配米饭', price: 48, image: S1, sales: 543, categoryId: '5-1' },
          { id: 'd34', name: '豚骨拉面', description: '浓郁骨汤弹牙拉面', price: 35, image: S8, sales: 890, categoryId: '5-1' },
        ],
      },
      {
        id: '5-2', name: '寿司',
        dishes: [
          { id: 'd35', name: '综合寿司拼盘', description: '八种经典手握寿司', price: 68, image: S5, sales: 432, categoryId: '5-2' },
          { id: 'd36', name: '加州卷', description: '牛油果蟹棒经典', price: 38, image: S7, sales: 356, categoryId: '5-2' },
        ],
      },
      {
        id: '5-3', name: '小食',
        dishes: [
          { id: 'd37', name: '日式煎饺', description: '薄皮馅多外酥里嫩', price: 22, image: S6, sales: 567, categoryId: '5-3' },
          { id: 'd38', name: '味噌汤', description: '豆腐海带经典暖汤', price: 10, image: S8, sales: 890, categoryId: '5-3' },
        ],
      },
    ],
  },
  {
    id: '6',
    name: '串串香',
    cover: S6,
    tagline: '炭火现烤 · 滋滋冒油',
    rating: 4.4,
    monthSales: 5678,
    minOrder: 20,
    deliveryFee: 3,
    deliveryTime: '25-35分钟',
    distance: '0.9km',
    category: '烧烤炸串',
    address: '朝阳区望京西园三区东门',
    phone: '010-8888-6006',
    description: '串串香选用每日新鲜食材，炭火现烤，孜然飘香。招牌羊肉串外焦里嫩，还有多种烤串、炸物供您选择。深夜食堂，温暖每一个夜归人。',
    businessHours: '11:00 - 24:00',
    announcement: '炭火现烤，滋滋冒油',
    promotion: { type: 'fullReduce', thresholds: [30, 50, 80], discounts: [3, 8, 16], description: '满30减3，满50减8，满80减16' },
    categories: [
      {
        id: '6-1', name: '烤串',
        dishes: [
          { id: 'd39', name: '羊肉串(10串)', description: '炭烤羊肉串孜然飘香', price: 30, image: S6, sales: 2345, categoryId: '6-1' },
          { id: 'd40', name: '牛肉串(10串)', description: '精选牛肉嫩滑多汁', price: 35, image: S2, sales: 1876, categoryId: '6-1' },
          { id: 'd41', name: '烤鸡翅(5只)', description: '蜜汁奥尔良风味', price: 25, image: S3, sales: 1567, categoryId: '6-1' },
        ],
      },
      {
        id: '6-2', name: '炸物',
        dishes: [
          { id: 'd42', name: '炸鸡排', description: '台式大鸡排香酥脆', price: 18, image: S6, sales: 3210, categoryId: '6-2' },
          { id: 'd43', name: '薯条拼盘', description: '粗薯配番茄酱', price: 15, image: S7, sales: 2890, categoryId: '6-2' },
        ],
      },
      {
        id: '6-3', name: '主食',
        dishes: [
          { id: 'd44', name: '烤馒头片', description: '外酥里软奶香十足', price: 8, image: S1, sales: 1890, categoryId: '6-3' },
          { id: 'd45', name: '蛋炒方便面', description: '夜市经典炒面', price: 12, image: S8, sales: 2345, categoryId: '6-3' },
        ],
      },
    ],
  },
  {
    id: '7',
    name: '轻食主义',
    cover: S7,
    tagline: '新鲜有机 · 低卡健康',
    rating: 4.8,
    monthSales: 1890,
    minOrder: 25,
    deliveryFee: 4,
    deliveryTime: '20-30分钟',
    distance: '1.1km',
    category: '轻食沙拉',
    address: '朝阳区建国路88号SOHO现代城B座',
    phone: '010-8888-7007',
    description: '轻食主义专注健康饮食，所有食材均选用有机新鲜蔬菜和优质蛋白。我们相信健康饮食不等于乏味，用心搭配每一份轻食，让您吃得健康也吃得开心。',
    businessHours: '07:00 - 21:00',
    announcement: '新鲜有机，低卡健康',
    promotion: { type: 'fullReduce', thresholds: [35, 55, 85], discounts: [5, 10, 18], description: '满35减5，满55减10，满85减18' },
    categories: [
      {
        id: '7-1', name: '沙拉碗',
        dishes: [
          { id: 'd46', name: '凯撒沙拉', description: '罗马生菜帕玛森芝士', price: 32, image: S7, sales: 678, categoryId: '7-1' },
          { id: 'd47', name: '牛油果藜麦沙拉', description: '牛油果藜麦坚果', price: 38, image: S1, sales: 543, categoryId: '7-1' },
          { id: 'd48', name: '烟熏三文鱼沙拉', description: '三文鱼配芝麻菜', price: 45, image: S5, sales: 345, categoryId: '7-1' },
        ],
      },
      {
        id: '7-2', name: '三明治',
        dishes: [
          { id: 'd49', name: '全麦鸡胸三明治', description: '鸡胸肉生菜全麦面包', price: 28, image: S3, sales: 456, categoryId: '7-2' },
          { id: 'd50', name: '牛油果鸡蛋三明治', description: '牛油果太阳蛋组合', price: 32, image: S7, sales: 389, categoryId: '7-2' },
        ],
      },
      {
        id: '7-3', name: '鲜榨果汁',
        dishes: [
          { id: 'd51', name: '鲜榨橙汁', description: '现榨柳橙无添加', price: 18, image: S4, sales: 890, categoryId: '7-3' },
          { id: 'd52', name: '青瓜雪梨汁', description: '清爽排毒瘦身', price: 22, image: S4, sales: 567, categoryId: '7-3' },
        ],
      },
    ],
  },
  {
    id: '8',
    name: '面面俱到',
    cover: S8,
    tagline: '手工现做 · 汤鲜面滑',
    rating: 4.6,
    monthSales: 3890,
    minOrder: 15,
    deliveryFee: 2,
    deliveryTime: '20-30分钟',
    distance: '0.5km',
    category: '粥粉面点',
    address: '朝阳区呼家楼北街12号',
    phone: '010-8888-8008',
    description: '面面俱到传承北方面食文化，坚持手工制作每一份面点。汤底慢火熬制8小时以上，面条劲道爽滑。从红烧牛肉面到小笼包，总有一款满足您的味蕾。',
    businessHours: '06:00 - 22:00',
    announcement: '手工现做，汤鲜面滑',
    promotion: { type: 'fullReduce', thresholds: [25, 40, 60], discounts: [3, 7, 12], description: '满25减3，满40减7，满60减12' },
    categories: [
      {
        id: '8-1', name: '汤面',
        dishes: [
          { id: 'd53', name: '红烧牛肉面', description: '大块牛腩浓郁汤底', price: 28, image: S8, sales: 1890, categoryId: '8-1' },
          { id: 'd54', name: '酸辣粉', description: '红油酸辣红薯粉', price: 16, image: S2, sales: 2345, categoryId: '8-1' },
          { id: 'd55', name: '鲜虾云吞面', description: '大颗鲜虾云吞竹升面', price: 32, image: S1, sales: 1567, categoryId: '8-1' },
        ],
      },
      {
        id: '8-2', name: '拌面',
        dishes: [
          { id: 'd56', name: '炸酱面', description: '京味肉酱黄瓜丝', price: 18, image: S8, sales: 2123, categoryId: '8-2' },
          { id: 'd57', name: '葱油拌面', description: '葱香四溢简约经典', price: 14, image: S6, sales: 1890, categoryId: '8-2' },
        ],
      },
      {
        id: '8-3', name: '蒸点',
        dishes: [
          { id: 'd58', name: '鲜肉小笼包(8只)', description: '薄皮多汁轻轻一咬', price: 22, image: S3, sales: 2678, categoryId: '8-3' },
          { id: 'd59', name: '虾饺皇(4只)', description: '晶莹剔透虾肉饱满', price: 28, image: S5, sales: 1456, categoryId: '8-3' },
        ],
      },
    ],
  },
]

// —— 运行时获取全部店铺（mock + 用户自建）——
// 注意：仅在运行时调用（组件内 / hook 内），不要在模块顶层调用
// 因为模块加载时 scopedStorage 可能还未就绪或数据未注入
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'

export function getAllShops(): IShop[] {
  let userShops: IShop[] = []
  try {
    const raw = scopedStorage.getItem('food_delivery_user_shops')
    if (raw) {
      const parsed = JSON.parse(raw) as any[]
      userShops = parsed.map(us => ({
        id: us.id,
        name: us.name,
        cover: us.cover,
        tagline: us.tagline,
        rating: us.rating ?? 5.0,
        monthSales: us.monthSales ?? 0,
        minOrder: us.minOrder,
        deliveryFee: us.deliveryFee,
        deliveryTime: us.deliveryTime || '25-35分钟',
        distance: us.distance || '1.2km',
        category: us.category,
        address: us.address,
        phone: us.phone,
        description: us.description,
        businessHours: us.businessHours,
        announcement: us.announcement,
        categories: us.categories || [],
        activities: us.activities || [],
      }))
    }
  } catch {
    // ignore
  }
  // 第 2 期：登录后从数据库读到的店铺会写进 remoteShops 缓存；
  // 读不到（未配置 Supabase / 未登录 / 请求失败）时退回内置演示店铺，界面行为不变。
  const base = remoteShops ?? MOCK_SHOPS
  return [...base, ...userShops]
}

// =============================================================================
// 远程数据缓存（第 2 期）
//   保持 getAllShops() 同步签名，组件代码无需改成异步；
//   数据从数据库加载完成后通过事件通知，订阅了 useShopsVersion() 的页面自动重渲染。
// =============================================================================
let remoteShops: IShop[] | null = null

/** 店铺数据变更事件：加载完成或清空时触发 */
export const SHOPS_CHANGE_EVENT = 'food_delivery_shops_change'

/** 供数据加载层调用：写入/清空远程店铺缓存，并通知界面刷新 */
export function setRemoteShops(shops: IShop[] | null) {
  remoteShops = shops
  try {
    window.dispatchEvent(new CustomEvent(SHOPS_CHANGE_EVENT))
  } catch {
    // ignore（非浏览器环境）
  }
}

/** 当前是否已使用数据库中的店铺数据（供调试与测试断言用） */
export function isRemoteShopsLoaded(): boolean {
  return remoteShops !== null
}

/**
 * 第 2 期 2h：写库成功后的「本地即时回显」。
 *
 * 商家改配置时先改本地、再写数据库；数据库那一趟是异步的，
 * 这里直接用同一个值更新内存缓存并派发事件，界面就不会出现
 * 「改完闪回旧值、等下次重拉才变」的抖动。
 *
 * 缓存还没加载（未登录 / 未配置 Supabase）时返回 false，调用方据此保留本地覆盖。
 */
export function patchRemoteShops(mutate: (shops: IShop[]) => void): boolean {
  if (!remoteShops) return false
  try {
    mutate(remoteShops)
  } catch (err) {
    console.warn('[shops] 更新店铺缓存失败', err)
    return false
  }
  try {
    window.dispatchEvent(new CustomEvent(SHOPS_CHANGE_EVENT))
  } catch {
    // ignore（非浏览器环境）
  }
  return true
}

/**
 * 获取某店铺的有效营销活动（合并 mock 自带 + shopStatus 自定义）
 * 商家配置的活动以 shopStatus 为准，覆盖/补充 mock 店铺的默认活动
 */
export function getShopActivities(shopId: string): IShopActivity[] {
  const shop = getAllShops().find(s => s.id === shopId)
  if (!shop) return []
  const mockActivities = shop.activities || []
  // 老的 promotion 字段兼容转换
  const legacyPromo = shop.promotion
  const legacyActivity: IShopActivity | null = legacyPromo
    ? {
        id: `legacy_fullreduce_${shopId}`,
        type: 'fullReduce',
        name: '满减优惠',
        description: legacyPromo.description || '店铺满减',
        active: true,
        thresholds: legacyPromo.thresholds,
        discounts: legacyPromo.discounts,
        createdAt: 0,
      }
    : null

  // 尝试从 shopStatus 读商家自定义活动（scopedStorage）
  let customActivities: IShopActivity[] = []
  try {
    const raw = scopedStorage.getItem('food_delivery_shop_status')
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, any>
      if (parsed[shopId]?.activities) {
        customActivities = parsed[shopId].activities as IShopActivity[]
      }
    }
  } catch {
    // ignore
  }

  // 如果有自定义活动，用自定义的（fullReduce 类型覆盖老 promotion）
  if (customActivities.length > 0) {
    // 过滤掉与老 promotion 重复的 fullReduce 类型
    const hasCustomFullReduce = customActivities.some(a => a.type === 'fullReduce')
    const base = hasCustomFullReduce ? customActivities : [...customActivities, ...mockActivities, ...(legacyActivity ? [legacyActivity] : [])]
    return base.filter(a => a.active !== false)
  }

  // 无自定义，返回 mock + 老 promotion 转换
  const result = [...mockActivities, ...(legacyActivity ? [legacyActivity] : [])]
  return result.filter(a => a.active !== false)
}
