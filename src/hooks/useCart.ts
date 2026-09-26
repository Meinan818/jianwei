import { useState, useEffect, useCallback, useMemo } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { ICart, ICartItem, ICartItemSpec, ICartItemExtra } from '@/data/cart'

const CART_KEY = 'food_delivery_cart'

/** 生成规格唯一key，用于区分同一菜品的不同规格组合 */
export function buildSkuKey(
  dishId: string,
  specs: ICartItemSpec[],
  extras: ICartItemExtra[],
): string {
  const specPart = specs
    .slice()
    .sort((a, b) => a.specId.localeCompare(b.specId))
    .map(s => `${s.specId}:${s.optionId}`)
    .join('|')
  const extraPart = extras
    .slice()
    .sort((a, b) => a.extraId.localeCompare(b.extraId))
    .map(e => e.extraId)
    .join(',')
  return `${dishId}__${specPart}__${extraPart}`
}

export function useCart() {
  const [cart, setCart] = useState<ICart>({ shopId: '', shopName: '', items: [] })

  useEffect(() => {
    const stored = scopedStorage.getItem(CART_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // 兼容旧数据：没有 skuKey 的旧购物车项补齐
        if (parsed.items?.length > 0) {
          parsed.items = parsed.items.map((item: ICartItem & { price?: number }) => ({
            ...item,
            specs: item.specs || [],
            extras: item.extras || [],
            basePrice: item.basePrice ?? item.price ?? 0,
            finalPrice: item.finalPrice ?? item.price ?? 0,
            skuKey: item.skuKey || buildSkuKey(item.dishId, item.specs || [], item.extras || []),
          }))
        }
        setCart(parsed)
      } catch {
        // ignore
      }
    }
  }, [])

  const saveCart = useCallback((newCart: ICart) => {
    setCart(newCart)
    scopedStorage.setItem(CART_KEY, JSON.stringify(newCart))
  }, [])

  /**
   * 添加商品到购物车（带规格版本）
   * 无规格菜品可以不传 specs/extras，等价于默认规格直接加购
   */
  const addItem = useCallback(
    (
      shopId: string,
      shopName: string,
      dish: { id: string; name: string; price: number; image: string },
      options?: {
        specs?: ICartItemSpec[]
        extras?: ICartItemExtra[]
        quantity?: number
      },
    ) => {
      const specs = options?.specs || []
      const extras = options?.extras || []
      const quantity = options?.quantity || 1
      const specDelta = specs.reduce((sum, s) => sum + s.priceDelta, 0)
      const extraDelta = extras.reduce((sum, e) => sum + e.price, 0)
      const finalPrice = dish.price + specDelta + extraDelta
      const skuKey = buildSkuKey(dish.id, specs, extras)

      setCart(prev => {
        let newCart: ICart
        if (prev.shopId && prev.shopId !== shopId) {
          newCart = {
            shopId,
            shopName,
            items: [
              {
                dishId: dish.id,
                dishName: dish.name,
                basePrice: dish.price,
                finalPrice,
                image: dish.image,
                quantity,
                specs,
                extras,
                skuKey,
              },
            ],
          }
        } else {
          const existing = prev.items.find(i => i.skuKey === skuKey)
          if (existing) {
            newCart = {
              shopId,
              shopName,
              items: prev.items.map(i =>
                i.skuKey === skuKey ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            }
          } else {
            newCart = {
              shopId,
              shopName,
              items: [
                ...prev.items,
                {
                  dishId: dish.id,
                  dishName: dish.name,
                  basePrice: dish.price,
                  finalPrice,
                  image: dish.image,
                  quantity,
                  specs,
                  extras,
                  skuKey,
                },
              ],
            }
          }
        }
        scopedStorage.setItem(CART_KEY, JSON.stringify(newCart))
        return newCart
      })
    },
    [],
  )

  /** 按 skuKey 减少数量 */
  const decreaseItem = useCallback((skuKey: string) => {
    setCart(prev => {
      const newItems = prev.items
        .map(i => (i.skuKey === skuKey ? { ...i, quantity: i.quantity - 1 } : i))
        .filter(i => i.quantity > 0)
      const newCart: ICart = { ...prev, items: newItems }
      if (newItems.length === 0) {
        newCart.shopId = ''
        newCart.shopName = ''
      }
      scopedStorage.setItem(CART_KEY, JSON.stringify(newCart))
      return newCart
    })
  }, [])

  /** 按 dishId 获取该菜品的总数量（所有规格合计） */
  const getDishTotalQuantity = useCallback(
    (dishId: string) =>
      cart.items
        .filter(i => i.dishId === dishId)
        .reduce((sum, i) => sum + i.quantity, 0),
    [cart.items],
  )

  /** 清空购物车 */
  const clearCart = useCallback(() => {
    const empty: ICart = { shopId: '', shopName: '', items: [] }
    saveCart(empty)
  }, [saveCart])

  const totalCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items],
  )

  const totalAmount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0),
    [cart.items],
  )

  /** 兼容旧 API，按 dishId 查数量（所有规格合计） */
  const getItemQuantity = (dishId: string) => getDishTotalQuantity(dishId)

  /** 按 skuKey 获取单项 */
  const getItemBySku = (skuKey: string) => cart.items.find(i => i.skuKey === skuKey)

  return {
    cart,
    addItem,
    decreaseItem,
    clearCart,
    totalCount,
    totalAmount,
    getItemQuantity,
    getDishTotalQuantity,
    getItemBySku,
  }
}

export type UseCartReturn = ReturnType<typeof useCart>
