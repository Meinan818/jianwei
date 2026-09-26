import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IAddress } from '@/data/address'
import { MOCK_ADDRESSES } from '@/data/address'

const ADDRESSES_KEY = 'food_delivery_addresses'

export function useAddresses() {
  const [addresses, setAddresses] = useState<IAddress[]>([])

  useEffect(() => {
    const stored = scopedStorage.getItem(ADDRESSES_KEY)
    if (stored) {
      try {
        setAddresses(JSON.parse(stored))
      } catch {
        setAddresses(MOCK_ADDRESSES)
      }
    } else {
      setAddresses(MOCK_ADDRESSES)
      scopedStorage.setItem(ADDRESSES_KEY, JSON.stringify(MOCK_ADDRESSES))
    }
  }, [])

  const saveAddresses = useCallback((list: IAddress[]) => {
    setAddresses(list)
    scopedStorage.setItem(ADDRESSES_KEY, JSON.stringify(list))
  }, [])

  const defaultAddress = addresses.find(a => a.isDefault) ?? addresses[0]

  const setDefault = useCallback((id: string) => {
    saveAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })))
  }, [addresses, saveAddresses])

  const addAddress = useCallback((addr: Omit<IAddress, 'id'>) => {
    const newAddr: IAddress = { ...addr, id: `addr${Date.now()}` }
    const newList = addr.isDefault
      ? addresses.map(a => ({ ...a, isDefault: false })).concat(newAddr)
      : addresses.concat(newAddr)
    saveAddresses(newList)
  }, [addresses, saveAddresses])

  const deleteAddress = useCallback((id: string) => {
    saveAddresses(addresses.filter(a => a.id !== id))
  }, [addresses, saveAddresses])

  const updateAddress = useCallback((id: string, data: Partial<IAddress>) => {
    const newList = addresses.map(a => {
      if (a.id !== id) return a
      // 如果设为默认，其他全部取消默认
      if (data.isDefault && !a.isDefault) {
        return { ...a, ...data }
      }
      return { ...a, ...data }
    })
    // 如果新设置了默认，需要把其他地址的默认去掉
    if (data.isDefault) {
      const target = newList.find(a => a.id === id)
      if (target?.isDefault) {
        newList.forEach(a => { if (a.id !== id) a.isDefault = false })
      }
    }
    saveAddresses(newList)
  }, [addresses, saveAddresses])

  return {
    addresses,
    defaultAddress,
    setDefault,
    addAddress,
    deleteAddress,
    updateAddress,
  }
}