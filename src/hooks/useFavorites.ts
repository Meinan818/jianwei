import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'

const FAVORITES_KEY = 'food_delivery_favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    const stored = scopedStorage.getItem(FAVORITES_KEY)
    if (stored) {
      try {
        setFavorites(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  const save = useCallback((list: string[]) => {
    setFavorites(list)
    scopedStorage.setItem(FAVORITES_KEY, JSON.stringify(list))
  }, [])

  const isFavorite = useCallback((shopId: string) => favorites.includes(shopId), [favorites])

  const toggleFavorite = useCallback((shopId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(shopId)
        ? prev.filter(id => id !== shopId)
        : [...prev, shopId]
      scopedStorage.setItem(FAVORITES_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return {
    favorites,
    isFavorite,
    toggleFavorite,
  }
}

export type UseFavoritesReturn = ReturnType<typeof useFavorites>
