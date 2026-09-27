import { useState, useEffect, useCallback, useRef } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IAddress } from '@/data/address'
import { MOCK_ADDRESSES } from '@/data/address'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchMyAddresses,
  insertAddress,
  updateAddressRow,
  deleteAddressRow,
  clearOtherDefaults,
} from '@/data/addresses-remote'

const ADDRESSES_KEY = 'food_delivery_addresses'

// 地址 id 生成（第 2 期 2d）：数据库 addresses.id 是 uuid，与订单 id 同规则
function newAddressId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `addr${Date.now()}`
}

export function useAddresses() {
  const { user, isLoggedIn } = useAuth()
  const [addresses, setAddresses] = useState<IAddress[]>(() => {
    // 原行为保留：未登录 / 未配 Supabase 时读本地缓存，没有则用内置演示地址兜底。
    // 登录后下面的 effect 会用数据库（RLS 限定本人）覆盖，数据库为准。
    const stored = scopedStorage.getItem(ADDRESSES_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        // ignore
      }
    }
    return MOCK_ADDRESSES
  })
  // 挂载期间用户做过本地改动就跳过迟到的数据库回包，防止把新加的地址弹回去
  const mutatedRef = useRef(false)

  // 第 2 期 2d：登录后从数据库拉一遍（地址只在顾客端用、无跨端联动需求，
  // 不进 Realtime publication；换账号/刷新时以数据库为准重拉）
  useEffect(() => {
    if (!supabase || !isLoggedIn) return
    let cancelled = false
    void (async () => {
      const remote = await fetchMyAddresses()
      if (cancelled || !remote) return // 未配置 / 读失败 → 保持本地兜底
      if (mutatedRef.current) return // 本地已有更新的改动，别用旧回包覆盖
      setAddresses(prev => {
        if (JSON.stringify(prev) === JSON.stringify(remote)) return prev
        return remote
      })
      scopedStorage.setItem(ADDRESSES_KEY, JSON.stringify(remote))
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, user?.id])

  const saveAddresses = useCallback((list: IAddress[]) => {
    setAddresses(list)
    scopedStorage.setItem(ADDRESSES_KEY, JSON.stringify(list))
  }, [])

  const defaultAddress = addresses.find(a => a.isDefault) ?? addresses[0]

  const setDefault = useCallback(
    (id: string) => {
      mutatedRef.current = true
      const target = addresses.find(a => a.id === id)
      saveAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })))
      // 数据库有「每账号至多一个默认」的部分唯一索引：先清旧默认，再写新默认
      if (supabase && isLoggedIn && target) {
        void (async () => {
          await clearOtherDefaults(id)
          await updateAddressRow({ ...target, isDefault: true })
        })()
      }
    },
    [addresses, saveAddresses, isLoggedIn, user?.id],
  )

  const addAddress = useCallback(
    (addr: Omit<IAddress, 'id'>) => {
      mutatedRef.current = true
      const newAddr: IAddress = { ...addr, id: newAddressId() }
      const newList = addr.isDefault
        ? addresses.map(a => ({ ...a, isDefault: false })).concat(newAddr)
        : addresses.concat(newAddr)
      saveAddresses(newList)
      if (supabase && isLoggedIn) {
        void insertAddress(newAddr, user?.id ?? '')
      }
    },
    [addresses, saveAddresses, isLoggedIn, user?.id],
  )

  const deleteAddress = useCallback(
    (id: string) => {
      mutatedRef.current = true
      saveAddresses(addresses.filter(a => a.id !== id))
      if (supabase && isLoggedIn) {
        void deleteAddressRow(id)
      }
    },
    [addresses, saveAddresses, isLoggedIn, user?.id],
  )

  const updateAddress = useCallback(
    (id: string, data: Partial<IAddress>) => {
      mutatedRef.current = true
      const old = addresses.find(a => a.id === id)
      // 本地视图：改目标行；本次把目标设为默认时，其余行取消默认
      saveAddresses(
        addresses.map(a => {
          if (a.id === id) return { ...a, ...data }
          return data.isDefault ? { ...a, isDefault: false } : a
        }),
      )
      // 数据库：同样先清旧默认再写目标行；失败只记日志，不阻塞界面
      if (supabase && isLoggedIn && old) {
        const merged: IAddress = { ...old, ...data }
        void (async () => {
          if (merged.isDefault && !old.isDefault) {
            await clearOtherDefaults(id)
          }
          await updateAddressRow(merged)
        })()
      }
    },
    [addresses, saveAddresses, isLoggedIn, user?.id],
  )

  return {
    addresses,
    defaultAddress,
    setDefault,
    addAddress,
    deleteAddress,
    updateAddress,
  }
}
