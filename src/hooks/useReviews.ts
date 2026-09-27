import { useState, useEffect, useCallback, useRef } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IReview } from '@/data/review'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchVisibleReviews,
  insertReview,
  replyReviewRemote,
} from '@/data/reviews-remote'

const REVIEWS_KEY = 'food_delivery_reviews'

// 评价 id 生成（第 2 期 2e）：数据库 reviews.id 是 uuid，与订单/地址 id 同规则
function newReviewId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `R${Date.now()}`
}

export function useReviews() {
  const { user, isLoggedIn } = useAuth()
  const [reviews, setReviews] = useState<IReview[]>(() => {
    // 原行为保留：先读本地缓存；登录后下面的 effect 会用数据库覆盖（数据库为准）
    const stored = scopedStorage.getItem(REVIEWS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // ignore
      }
    }
    return []
  })
  // 挂载期间用户做过本地改动就跳过迟到的数据库回包，防止把刚提交的评价弹掉
  const mutatedRef = useRef(false)

  // 第 2 期 2e：登录后从数据库拉一遍（评价为三端共享数据池：店铺页展示、商家端回复都要读）
  useEffect(() => {
    if (!supabase || !isLoggedIn) return
    let cancelled = false
    void (async () => {
      const remote = await fetchVisibleReviews()
      if (cancelled || !remote) return // 未配置 / 读失败 → 保持本地
      if (mutatedRef.current) return // 本地已有更新的改动，别用旧回包覆盖
      setReviews(prev => {
        if (JSON.stringify(prev) === JSON.stringify(remote)) return prev
        return remote
      })
      scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(remote))
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, user?.id])

  const saveReviews = useCallback((list: IReview[]) => {
    setReviews(list)
    scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(list))
  }, [])

  const addReview = useCallback(
    (review: Omit<IReview, 'id' | 'createdAt'>) => {
      mutatedRef.current = true
      const newReview: IReview = {
        ...review,
        id: newReviewId(),
        createdAt: Date.now(),
      }
      setReviews(prev => {
        const updated = [newReview, ...prev]
        scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(updated))
        return updated
      })
      // 数据库写入：失败只记日志，不影响界面（下次登录重拉时以库为准）
      if (supabase && isLoggedIn) {
        void insertReview(newReview, user?.id ?? '')
      }
      return newReview
    },
    [isLoggedIn, user?.id],
  )

  const getReviewByOrder = useCallback(
    (orderId: string) => reviews.find(r => r.orderId === orderId),
    [reviews],
  )

  const getShopReviews = useCallback(
    (shopId: string) => reviews.filter(r => r.shopId === shopId),
    [reviews],
  )

  const getShopAvgScore = useCallback(
    (shopId: string) => {
      const shopReviews = reviews.filter(r => r.shopId === shopId)
      if (shopReviews.length === 0) return { overall: 0, taste: 0, packaging: 0, delivery: 0, count: 0 }
      const sum = shopReviews.reduce(
        (acc, r) => {
          acc.overall += r.overallScore
          acc.taste += r.tasteScore
          acc.packaging += r.packagingScore
          acc.delivery += r.deliveryScore
          return acc
        },
        { overall: 0, taste: 0, packaging: 0, delivery: 0 },
      )
      const n = shopReviews.length
      return {
        overall: +(sum.overall / n).toFixed(1),
        taste: +(sum.taste / n).toFixed(1),
        packaging: +(sum.packaging / n).toFixed(1),
        delivery: +(sum.delivery / n).toFixed(1),
        count: n,
      }
    },
    [reviews],
  )

  const replyToReview = useCallback(
    (reviewId: string, reply: string) => {
      mutatedRef.current = true
      // 乐观更新本地；数据库走 reply_review RPC，成功后用返回行覆盖（含回复时间）
      setReviews(prev => {
        const updated = prev.map(r =>
          r.id === reviewId
            ? { ...r, merchantReply: reply, merchantReplyAt: Date.now() }
            : r,
        )
        scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(updated))
        return updated
      })
      if (supabase && isLoggedIn) {
        void replyReviewRemote(reviewId, reply).then(row => {
          if (!row) return
          setReviews(prev => {
            const updated = prev.map(r => (r.id === reviewId ? row : r))
            scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(updated))
            return updated
          })
        })
      }
    },
    [isLoggedIn],
  )

  return {
    reviews,
    addReview,
    replyToReview,
    getReviewByOrder,
    getShopReviews,
    getShopAvgScore,
  }
}

export type UseReviewsReturn = ReturnType<typeof useReviews>
