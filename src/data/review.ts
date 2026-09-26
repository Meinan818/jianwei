// EXPORTS: IReview, IReviewDishScore

export interface IReviewDishScore {
  dishId: string
  dishName: string
  score: number // 1-5
}

export interface IReview {
  id: string
  orderId: string
  shopId: string
  userId: string
  userName: string
  userAvatar: string
  overallScore: number // 1-5 整体星级
  tasteScore: number   // 口味
  packagingScore: number // 包装
  deliveryScore: number  // 配送
  tags: string[]          // 快捷标签
  content: string         // 文字评价
  images?: string[]       // 评价图片（base64 或 URL）
  dishScores: IReviewDishScore[] // 菜品打分
  dishes: string[]        // 所点菜品名称（展示用）
  createdAt: number       // 时间戳
  anonymous?: boolean     // 匿名
  merchantReply?: string  // 商家回复内容
  merchantReplyAt?: number // 商家回复时间
}
