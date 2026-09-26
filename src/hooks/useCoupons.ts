import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { ICoupon } from '@/data/coupon'
import { MOCK_COUPONS } from '@/data/coupon'

const COUPONS_KEY = 'food_delivery_coupons'

export function useCoupons() {
  const [coupons, setCoupons] = useState<ICoupon[]>([])

  useEffect(() => {
    const stored = scopedStorage.getItem(COUPONS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ICoupon[]
        // 合并 mock 中新增但用户未领取的券
        const merged = [...parsed]
        MOCK_COUPONS.forEach(mc => {
          if (!parsed.find(p => p.id === mc.id)) {
            merged.push(mc)
          }
        })
        setCoupons(merged)
      } catch {
        setCoupons(MOCK_COUPONS)
      }
    } else {
      setCoupons(MOCK_COUPONS)
    }
  }, [])

  const saveCoupons = useCallback((list: ICoupon[]) => {
    setCoupons(list)
    scopedStorage.setItem(COUPONS_KEY, JSON.stringify(list))
  }, [])

  const claimCoupon = useCallback((couponId: string) => {
    setCoupons(prev => {
      const updated = prev.map(c => (c.id === couponId ? { ...c, claimed: true } : c))
      scopedStorage.setItem(COUPONS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const markUsed = useCallback((couponId: string) => {
    setCoupons(prev => {
      const updated = prev.map(c => (c.id === couponId ? { ...c, used: true } : c))
      scopedStorage.setItem(COUPONS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const availableCoupons = coupons.filter(c => c.claimed && !c.used && !c.expired)
  const unclaimedCoupons = coupons.filter(c => !c.claimed && !c.expired)
  const usedCoupons = coupons.filter(c => c.used)
  const expiredCoupons = coupons.filter(c => c.expired)

  const getCoupon = useCallback((id: string) => coupons.find(c => c.id === id), [coupons])

  return {
    coupons,
    availableCoupons,
    unclaimedCoupons,
    usedCoupons,
    expiredCoupons,
    claimCoupon,
    markUsed,
    getCoupon,
  }
}

export type UseCouponsReturn = ReturnType<typeof useCoupons>
