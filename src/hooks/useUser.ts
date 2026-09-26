import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IUser } from '@/data/user'
import { MOCK_USER } from '@/data/user'

const USER_KEY = 'food_delivery_user'

export function useUser() {
  const [user, setUser] = useState<IUser>(MOCK_USER)

  useEffect(() => {
    const stored = scopedStorage.getItem(USER_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  const updateUser = useCallback((data: Partial<IUser>) => {
    setUser(prev => {
      const updated = { ...prev, ...data }
      scopedStorage.setItem(USER_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return { user, updateUser }
}