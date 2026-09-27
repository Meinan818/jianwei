import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { ICoupon } from '@/data/coupon'
import { MOCK_COUPONS } from '@/data/coupon'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchCouponsForUser,
  claimCouponRemote,
  markUsedRemote,
} from '@/data/coupons-remote'

const COUPONS_KEY = 'food_delivery_coupons'

export function useCoupons() {
  const { user, isLoggedIn } = useAuth()
  const [coupons, setCoupons] = useState<ICoupon[]>(() => {
    // 原行为保留：先读本地缓存并合并 MOCK 新增券；登录后下面的 effect 以数据库为准
    const stored = scopedStorage.getItem(COUPONS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ICoupon[]
        const merged = [...parsed]
        MOCK_COUPONS.forEach(mc => {
          if (!parsed.find(p => p.id === mc.id)) {
            merged.push(mc)
          }
        })
        return merged
      } catch {
        return MOCK_COUPONS
      }
    }
    return MOCK_COUPONS
  })

  // 第 2 期 2f：登录后从数据库拉券模板 + 本人领取记录，拼成扁平列表（数据库为准）
  useEffect(() => {
    if (!supabase || !isLoggedIn || !user?.id) return
    let cancelled = false
    void (async () => {
      const remote = await fetchCouponsForUser(user.id)
      if (cancelled || !remote) return // 未配置 / 读失败 → 保持本地兜底
      setCoupons(prev => {
        if (JSON.stringify(prev) === JSON.stringify(remote)) return prev
        return remote
      })
      scopedStorage.setItem(COUPONS_KEY, JSON.stringify(remote))
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, user?.id])

  const saveCoupons = useCallback((list: ICoupon[]) => {
    setCoupons(list)
    scopedStorage.setItem(COUPONS_KEY, JSON.stringify(list))
  }, [])

  const claimCoupon = useCallback(
    (couponId: string) => {
      setCoupons(prev => {
        const updated = prev.map(c => (c.id === couponId ? { ...c, claimed: true } : c))
        scopedStorage.setItem(COUPONS_KEY, JSON.stringify(updated))
        return updated
      })
      // 数据库券模板 id 是 uuid；MOCK 的 c1~c6 仅本地生效
      if (supabase && isLoggedIn && user?.id) {
        void claimCouponRemote(couponId, user.id)
      }
    },
    [isLoggedIn, user?.id],
  )

  const markUsed = useCallback(
    (couponId: string) => {
      setCoupons(prev => {
        const updated = prev.map(c => (c.id === couponId ? { ...c, used: true } : c))
        scopedStorage.setItem(COUPONS_KEY, JSON.stringify(updated))
        return updated
      })
      if (supabase && isLoggedIn && user?.id) {
        void markUsedRemote(couponId, user.id)
      }
    },
    [isLoggedIn, user?.id],
  )

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
