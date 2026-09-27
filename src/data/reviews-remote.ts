/**
 * 第 2 期 2e：评价读写数据库（Supabase）
 *
 * 设计思路（与 2a/2b/2c/2d 一致，尽量少动现有逻辑）：
 *   useReviews 保持对外接口不变（ReviewPage / OrderListPage / MerchantReviewsPage 零改动）：
 *     · 登录后拉一遍（reviews_select：所有登录用户可读——店铺页/商家端要展示全量评价）
 *     · 顾客提交按行 INSERT（reviews_insert RLS：customer_id 必须是本人且角色为顾客）
 *     · 商家回复走数据库现成 RPC reply_review（reviews 没有 UPDATE 策略，
 *       SECURITY DEFINER 的 RPC 里校验 is_shop_owner，这是 init 设计好的唯一回复通道）
 *   未配置 Supabase / 未登录 / 读写失败时静默退回原 localStorage 行为，不会白屏。
 *
 * 必须知道的约束：
 *   1. reviews.id / order_id / shop_id 都是 uuid。旧本地数据的 `R+时间戳` 评价、
 *      `ORD+时间戳` 订单、`'1'~'8'` 演示店铺都写不进库——用 isUuid 预判，直接保持本地（记日志）。
 *   2. order_id 有唯一约束（一单只能一条评价）；提交入口已被订单 reviewed 标记挡住，
 *      若真撞 23505（如双开页面重复提交）以库里已有的一条为准，不覆盖。
 *   3. 评价图仍是 base64（第 4 期迁 Storage），text[] 列装得下，注意体积即可。
 *   4. 评价不进 Realtime publication（评价查看主要在进店/进页时拉取，跨端实时收益低）。
 */
import { supabase } from '@/lib/supabase'
import type { IReview, IReviewDishScore } from './review'

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)
const ts = (v: unknown): number | undefined => (v ? Date.parse(String(v)) : undefined)
const score = (v: unknown): number => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 5
}

/** 数据库行 → 前端 IReview（防御式：分数非法兜底 5，缺省字段兜底空值） */
export function rowToReview(row: Record<string, any>): IReview {
  const dishScores: IReviewDishScore[] = Array.isArray(row.dish_scores)
    ? row.dish_scores
        .filter((d: any) => d && typeof d === 'object')
        .map((d: any) => ({
          dishId: String(d.dishId ?? d.dish_id ?? ''),
          dishName: String(d.dishName ?? d.dish_name ?? ''),
          score: score(d.score),
        }))
    : []
  const base: IReview = {
    id: row.id,
    orderId: row.order_id ?? '',
    shopId: row.shop_id ?? '',
    userId: row.customer_id ?? '',
    userName: row.user_name ?? '匿名用户',
    userAvatar: row.user_avatar_url ?? '',
    overallScore: score(row.overall_score),
    tasteScore: score(row.taste_score),
    packagingScore: score(row.packaging_score),
    deliveryScore: score(row.delivery_score),
    tags: Array.isArray(row.tags) ? row.tags : [],
    content: row.content ?? '',
    dishScores,
    dishes: Array.isArray(row.dishes) ? row.dishes : [],
    createdAt: ts(row.created_at) ?? Date.now(),
    ...(row.anonymous ? { anonymous: true } : {}),
  }
  if (Array.isArray(row.images) && row.images.length > 0) base.images = row.images
  if (row.merchant_reply) {
    base.merchantReply = row.merchant_reply
    base.merchantReplyAt = ts(row.merchant_reply_at)
  }
  return base
}

/** 读取全部可见评价（RLS：登录即可读；按时间倒序），失败返回 null 走本地兜底 */
export async function fetchVisibleReviews(): Promise<IReview[] | null> {
  const sb = supabase
  if (!sb) return null
  const { data, error } = await sb
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) {
    console.warn('[reviews] 读取评价失败', error)
    return null
  }
  return data.map(rowToReview)
}

/** 前端 IReview → 数据库行（不含 customer_id，由调用方补） */
function reviewToRow(r: IReview) {
  return {
    order_id: r.orderId,
    shop_id: r.shopId,
    user_name: r.userName || null,
    user_avatar_url: r.userAvatar || null,
    overall_score: r.overallScore,
    taste_score: r.tasteScore,
    packaging_score: r.packagingScore,
    delivery_score: r.deliveryScore,
    tags: r.tags ?? [],
    content: r.content ?? '',
    images: r.images ?? [],
    dish_scores: r.dishScores ?? [],
    dishes: r.dishes ?? [],
    anonymous: Boolean(r.anonymous),
  }
}

/**
 * 顾客提交评价。订单/店铺 id 不是 uuid（旧本地单、演示店铺）时不写库、保持本地，
 * 演示流程里从「演示小店」下的真实订单两者都是 uuid，正常入库。
 */
export async function insertReview(review: IReview, customerId: string): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  if (!isUuid(review.orderId) || !isUuid(review.shopId)) {
    console.warn('[reviews] 订单/店铺 id 不是 uuid，评价仅保留在本地', review.orderId, review.shopId)
    return false
  }
  try {
    const row = { id: review.id, customer_id: customerId, ...reviewToRow(review) }
    const ins = await sb.from('reviews').insert(row)
    if (ins.error) {
      // 一单一条：以库里已有的一条为准，不覆盖（提交入口有 reviewed 标记挡重复）
      if (ins.error.code === '23505') {
        console.warn('[reviews] 该订单已有评价，保留数据库版本', review.orderId)
        return false
      }
      console.warn('[reviews] 写入评价失败', review.id, ins.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[reviews] 写入评价异常', err)
    return false
  }
}

/**
 * 商家回复评价：走 init_schema 提供的 reply_review RPC（SECURITY DEFINER 内校验店主身份）。
 * 本地旧评价（R+时间戳）写不进库，仅保留本地回复。
 * 成功返回更新后的评价（含 merchant_reply / merchant_reply_at），失败返回 null。
 */
export async function replyReviewRemote(
  reviewId: string,
  reply: string,
): Promise<IReview | null> {
  const sb = supabase
  if (!sb) return null
  if (!isUuid(reviewId)) {
    console.warn('[reviews] 评价 id 不是 uuid，回复仅保留在本地', reviewId)
    return null
  }
  try {
    const { data, error } = await sb.rpc('reply_review', {
      p_review_id: reviewId,
      p_reply: reply,
    })
    if (error || !data) {
      console.warn('[reviews] 回复评价失败', reviewId, error?.message)
      return null
    }
    return rowToReview(Array.isArray(data) ? data[0] : data)
  } catch (err) {
    console.warn('[reviews] 回复评价异常', err)
    return null
  }
}
