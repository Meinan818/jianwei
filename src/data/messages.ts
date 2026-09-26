// EXPORTS: IMessage, IConversation, INotificationMessage, MESSAGE_STORAGE_KEY, NOTIFICATION_STORAGE_KEY, QUICK_PHRASES

export type NotificationCategory = 'system' | 'order' | 'activity'

export interface INotificationMessage {
  id: string
  category: NotificationCategory
  title: string
  content: string
  read: boolean
  createdAt: number
  orderId?: string
  actionUrl?: string
  icon?: string
}

export interface IMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar: string
  senderRole: 'customer' | 'merchant' | 'rider' | 'system'
  content: string
  type: 'text' | 'system'
  createdAt: number
  read: boolean
}

export interface IConversation {
  id: string
  orderId: string
  // 会话类型：order（订单会话） / shop（店铺咨询会话）
  convType?: 'order' | 'shop'
  // 双方身份
  customerId: string
  customerName: string
  customerAvatar: string
  merchantId: string
  merchantName: string
  merchantAvatar: string
  riderId?: string
  riderName?: string
  riderAvatar?: string
  // 最后消息
  lastMessage?: string
  lastMessageAt?: number
  // 未读按角色分账：分别记录三个角色各自的未读数
  unreadCustomer: number
  unreadMerchant: number
  unreadRider: number
  // 兼容老数据字段（读取时迁移，写入时不再使用）
  unreadCount?: number
  createdAt: number
}

export const MESSAGE_STORAGE_KEY = 'food_delivery_messages'
export const NOTIFICATION_STORAGE_KEY = 'food_delivery_notifications'

// 旧版全角色共用 mock（用于检测迁移），不再作为初始化数据
export const MOCK_NOTIFICATIONS: INotificationMessage[] = [
  {
    id: 'n1',
    category: 'order',
    title: '订单已接单',
    content: '商家「饭否·品质快餐」已接单，正在为您备餐，请耐心等待。',
    read: false,
    createdAt: Date.now() - 1000 * 60 * 5,
    orderId: 'ORD2025091000001',
  },
  {
    id: 'n2',
    category: 'order',
    title: '骑手已取餐',
    content: '骑手「张师傅」已取餐，预计 25 分钟内送达。',
    read: false,
    createdAt: Date.now() - 1000 * 60 * 15,
    orderId: 'ORD2025091000001',
  },
  {
    id: 'n3',
    category: 'activity',
    title: '新人专享红包已到账',
    content: '恭喜您获得 15 元新人专享红包，首单立减，快来下单吧！',
    read: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    actionUrl: '/customer/coupons',
  },
  {
    id: 'n4',
    category: 'system',
    title: '服务升级通知',
    content: '平台夜间配送服务已开通，22:00-06:00 安心点单。',
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'n5',
    category: 'activity',
    title: '满30减5 限时活动',
    content: '精选商家满减活动火热进行中，点击查看参与商家。',
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    actionUrl: '/customer',
  },
  {
    id: 'n6',
    category: 'order',
    title: '订单已送达',
    content: '您的订单已送达，感谢您的支持，期待您的评价。',
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
  },
]

// ✅ 按角色生成正确视角的 mock 通知
function nowMinus(ms: number): number {
  return Date.now() - ms
}

export function getMockNotificationsByRole(role: 'customer' | 'merchant' | 'rider'): INotificationMessage[] {
  const base = [
    {
      id: `${role}_sys_1`,
      category: 'system' as const,
      title: '服务升级通知',
      content: '平台夜间配送服务已开通，22:00-06:00 安心点单。',
      read: true,
      createdAt: nowMinus(1000 * 60 * 60 * 24),
    },
    {
      id: `${role}_act_1`,
      category: 'activity' as const,
      title: '满30减5 限时活动',
      content: '精选商家满减活动火热进行中，点击查看参与商家。',
      read: true,
      createdAt: nowMinus(1000 * 60 * 60 * 48),
      actionUrl: role === 'merchant' ? '/merchant/shop' : role === 'rider' ? '/rider/tasks' : '/customer',
    },
  ]

  if (role === 'customer') {
    return [
      {
        id: 'cust_order_1',
        category: 'order',
        title: '订单已接单',
        content: '商家「饭否·品质快餐」已接单，正在为您备餐，请耐心等待。',
        read: false,
        createdAt: nowMinus(1000 * 60 * 8),
        orderId: 'ORD2025091000001',
      },
      {
        id: 'cust_order_2',
        category: 'order',
        title: '骑手已取餐',
        content: '骑手「张师傅」已取餐，预计 25 分钟内送达。',
        read: false,
        createdAt: nowMinus(1000 * 60 * 18),
        orderId: 'ORD2025091000001',
      },
      {
        id: 'cust_act_1',
        category: 'activity',
        title: '新人专享红包已到账',
        content: '恭喜您获得 15 元新人专享红包，首单立减，快来下单吧！',
        read: false,
        createdAt: nowMinus(1000 * 60 * 60 * 2),
        actionUrl: '/customer/coupons',
      },
      ...base,
      {
        id: 'cust_order_3',
        category: 'order',
        title: '订单已送达',
        content: '您的订单已送达，感谢您的支持，期待您的评价。',
        read: true,
        createdAt: nowMinus(1000 * 60 * 60 * 72),
        orderId: 'ORD2025090800023',
      },
    ]
  }

  if (role === 'merchant') {
    return [
      {
        id: 'merc_order_1',
        category: 'order',
        title: '您有一笔新订单待接单',
        content: '订单 ORD250915001 已下单，顾客已支付，请尽快出餐。',
        read: false,
        createdAt: nowMinus(1000 * 60 * 3),
        orderId: 'ORD250915001',
      },
      {
        id: 'merc_order_2',
        category: 'order',
        title: '顾客发起售后申请',
        content: '订单 ORD250914005 顾客提交了售后申请，请及时处理。',
        read: false,
        createdAt: nowMinus(1000 * 60 * 45),
        orderId: 'ORD250914005',
      },
      {
        id: 'merc_order_3',
        category: 'order',
        title: '骑手已取餐',
        content: '骑手「李师傅」已到店取走订单 ORD250914012。',
        read: true,
        createdAt: nowMinus(1000 * 60 * 60 * 3),
        orderId: 'ORD250914012',
      },
      ...base,
      {
        id: 'merc_sys_2',
        category: 'system',
        title: '营业资质审核通过',
        content: '您提交的营业执照更新已审核通过，营业状态已恢复正常。',
        read: true,
        createdAt: nowMinus(1000 * 60 * 60 * 36),
      },
    ]
  }

  // rider
  return [
    {
      id: 'rider_order_1',
      category: 'order',
      title: '附近有新订单待抢',
      content: '订单 ORD250915002，配送距离 2.1km，收入 ¥7.5，立即抢单。',
      read: false,
      createdAt: nowMinus(1000 * 60 * 2),
      orderId: 'ORD250915002',
    },
    {
      id: 'rider_order_2',
      category: 'order',
      title: '订单已出餐，可前往取餐',
      content: '商家「饭否·品质快餐」的订单 ORD250914020 已出餐，请尽快到店取餐。',
      read: false,
      createdAt: nowMinus(1000 * 60 * 12),
      orderId: 'ORD250914020',
    },
    {
      id: 'rider_order_3',
      category: 'order',
      title: '配送异常提醒',
      content: '您配送的订单 ORD250914018 顾客反馈未收到，请核实并联系客服。',
      read: true,
      createdAt: nowMinus(1000 * 60 * 60 * 5),
      orderId: 'ORD250914018',
    },
    ...base,
    {
      id: 'rider_sys_2',
      category: 'system',
      title: '骑手装备领取提醒',
      content: '您的秋季骑手装备已到店，请前往就近站点领取。',
      read: true,
      createdAt: nowMinus(1000 * 60 * 60 * 60),
    },
  ]
}

// 按角色区分的快捷短语
export const QUICK_PHRASES: Record<'customer' | 'merchant' | 'rider', string[]> = {
  customer: [
    '大概多久能到？',
    '到了放门口就行',
    '少放辣，谢谢',
    '不要香菜',
    '麻烦多给双筷子',
    '请问我的餐做好了吗？',
    '路上注意安全，不急',
  ],
  merchant: [
    '您好，请问有什么可以帮您？',
    '好的，马上为您处理',
    '餐品正在准备中，请稍等',
    '骑手已经取餐，正在配送',
    '非常抱歉给您带来不便',
    '感谢您的支持，祝您用餐愉快',
    '请问对本次服务满意吗？',
  ],
  rider: [
    '您好，我是您的骑手',
    '已到达商家，正在取餐',
    '大概10分钟左右送达',
    '已到达您的位置',
    '您的餐已送达，请查收',
    '好的，收到，马上到',
    '路上注意安全',
  ],
}
