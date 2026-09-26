import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IReview } from '@/data/review'

const REVIEWS_KEY = 'food_delivery_reviews'

export function useReviews() {
  const [reviews, setReviews] = useState<IReview[]>([])

  useEffect(() => {
    const stored = scopedStorage.getItem(REVIEWS_KEY)
    if (stored) {
      try {
        setReviews(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  const saveReviews = useCallback((list: IReview[]) => {
    setReviews(list)
    scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(list))
  }, [])

  const addReview = useCallback((review: Omit<IReview, 'id' | 'createdAt'>) => {
    const newReview: IReview = {
      ...review,
      id: `R${Date.now()}`,
      createdAt: Date.now(),
    }
    setReviews(prev => {
      const updated = [newReview, ...prev]
      scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(updated))
      return updated
    })
    return newReview
  }, [])

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

  const replyToReview = useCallback((reviewId: string, reply: string) => {
    setReviews(prev => {
      const updated = prev.map(r =>
        r.id === reviewId
          ? { ...r, merchantReply: reply, merchantReplyAt: Date.now() }
          : r,
      )
      scopedStorage.setItem(REVIEWS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

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
