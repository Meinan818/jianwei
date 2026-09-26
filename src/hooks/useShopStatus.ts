import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { SHOP_STATUS_KEY, FINANCE_WITHDRAW_KEY, USER_SHOPS_KEY } from '@/data/shop-status'
import type { IShopStatus, ICustomCategory, IShopActivity, IFinanceWithdrawRecord, IDishSpecOverride, IDishExtraOverride, IUserCreatedShop, IUserCreatedDish } from '@/data/shop-status'
import type { IDish, IDishSpec, IDishExtra, IShop, IShopCategory } from '@/data/shops'
import { MOCK_SHOPS, getAllShops } from '@/data/shops'

// 读取用户创建的店铺
function readUserShops(): IUserCreatedShop[] {
  try {
    const raw = scopedStorage.getItem(USER_SHOPS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveUserShops(shops: IUserCreatedShop[]) {
  scopedStorage.setItem(USER_SHOPS_KEY, JSON.stringify(shops))
}

// 初始化默认店铺状态（从 getAllShops() 推导）
function getInitialStatus(): IShopStatus {
  const allShops = getAllShops()
  const status: IShopStatus = {}
  allShops.forEach(shop => {
    const dishes: IShopStatus[string]['dishes'] = {}
    shop.categories.forEach(cat => {
      cat.dishes.forEach(dish => {
        dishes[dish.id] = {
          price: dish.price,
          soldOut: false,
          onShelf: true,
          stock: -1,
          sales: dish.sales || 0,
        }
      })
    })
    status[shop.id] = {
      isOpen: true,
      announcement: shop.announcement || '欢迎光临本店~',
      businessHours: shop.businessHours || '09:00 - 21:00',
      minOrder: shop.minOrder,
      deliveryFee: shop.deliveryFee,
      monthSales: shop.monthSales || 0,
      customCategories: [],
      dishes,
      promotion: null,
      activities: [],
    }
  })
  return status
}

export function useShopStatus() {
  const [shopStatus, setShopStatus] = useState<IShopStatus>({})

  useEffect(() => {
    const stored = scopedStorage.getItem(SHOP_STATUS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as IShopStatus
        // 数据迁移：老数据补 customCategories 字段
        let migrated = false
        Object.keys(parsed).forEach(shopId => {
          if (!parsed[shopId].customCategories) {
            parsed[shopId].customCategories = []
            migrated = true
          }
          if (!parsed[shopId].businessHours) {
            const mockShop = getAllShops().find(s => s.id === shopId)
            parsed[shopId].businessHours = mockShop?.businessHours || '09:00 - 21:00'
            migrated = true
          }
          if (!parsed[shopId].activities) {
            parsed[shopId].activities = []
            // 老 promotion 迁移到新 activities 列表
            const oldPromo = parsed[shopId].promotion
            if (oldPromo) {
              parsed[shopId].activities.push({
                id: 'promo_migrated',
                type: 'fullReduce',
                name: '满减活动',
                description: oldPromo.description,
                active: true,
                thresholds: oldPromo.thresholds,
                discounts: oldPromo.discounts,
                createdAt: Date.now() - 86400000 * 7,
              })
            }
            migrated = true
          }
        })
        if (migrated) {
          scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(parsed))
        }
        setShopStatus(parsed)
      } catch {
        const init = getInitialStatus()
        setShopStatus(init)
        scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(init))
      }
    } else {
      const init = getInitialStatus()
      setShopStatus(init)
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(init))
    }
  }, [])

  const save = useCallback((s: IShopStatus) => {
    setShopStatus(s)
    scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(s))
  }, [])

  // 获取单个店铺状态
  const getShopStatus = useCallback((shopId: string) => {
    return shopStatus[shopId] || null
  }, [shopStatus])

  // 切换营业状态
  const toggleShopOpen = useCallback((shopId: string, isOpen: boolean) => {
    setShopStatus(prev => {
      const updated = {
        ...prev,
        [shopId]: {
          ...prev[shopId],
          isOpen,
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 更新店铺基础信息
  const updateShopInfo = useCallback((shopId: string, info: Partial<Pick<IShopStatus[string], 'announcement' | 'minOrder' | 'deliveryFee' | 'businessHours'>>) => {
    setShopStatus(prev => {
      const updated = {
        ...prev,
        [shopId]: {
          ...prev[shopId],
          ...info,
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 更新满减活动（老接口，同时更新 activities 以保持兼容）
  const updatePromotion = useCallback((shopId: string, promotion: IShopStatus[string]['promotion']) => {
    setShopStatus(prev => {
      const existing = prev[shopId] || { isOpen: true, announcement: '', minOrder: 20, deliveryFee: 3, monthSales: 0, customCategories: [], dishes: {}, promotion: null, activities: [] }
      let newActivities = [...(existing.activities || [])]
      if (promotion) {
        const idx = newActivities.findIndex(a => a.type === 'fullReduce')
        if (idx >= 0) {
          newActivities[idx] = { ...newActivities[idx], thresholds: promotion.thresholds, discounts: promotion.discounts, description: promotion.description, active: true }
        } else {
          newActivities.unshift({
            id: `act_${Date.now()}`,
            type: 'fullReduce',
            name: '满减活动',
            description: promotion.description,
            active: true,
            thresholds: promotion.thresholds,
            discounts: promotion.discounts,
            createdAt: Date.now(),
          })
        }
      }
      const updated = {
        ...prev,
        [shopId]: { ...existing, promotion, activities: newActivities },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 获取店铺活动列表
  const getActivities = useCallback((shopId: string): IShopActivity[] => {
    return shopStatus[shopId]?.activities || []
  }, [shopStatus])

  // 新增/编辑活动
  const saveActivity = useCallback((shopId: string, activity: Omit<IShopActivity, 'createdAt'> & { id?: string }) => {
    setShopStatus(prev => {
      const existing = prev[shopId] || { isOpen: true, announcement: '', minOrder: 20, deliveryFee: 3, monthSales: 0, customCategories: [], dishes: {}, promotion: null, activities: [] }
      const activities = [...(existing.activities || [])]
      if (activity.id) {
        const idx = activities.findIndex(a => a.id === activity.id)
        if (idx >= 0) {
          activities[idx] = { ...activities[idx], ...activity }
        }
      } else {
        activities.unshift({ ...activity, id: `act_${Date.now()}`, createdAt: Date.now() } as IShopActivity)
      }
      const updated = { ...prev, [shopId]: { ...existing, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 切换活动启停状态
  const toggleActivity = useCallback((shopId: string, activityId: string, active: boolean) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const activities = (existing.activities || []).map(a =>
        a.id === activityId ? { ...a, active } : a
      )
      const updated = { ...prev, [shopId]: { ...existing, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 删除活动
  const deleteActivity = useCallback((shopId: string, activityId: string) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const activities = (existing.activities || []).filter(a => a.id !== activityId)
      const updated = { ...prev, [shopId]: { ...existing, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 更新单个菜品状态
  const updateDishStatus = useCallback((shopId: string, dishId: string, patch: Partial<IShopStatus[string]['dishes'][string]>) => {
    setShopStatus(prev => {
      const existing = prev[shopId] || {
        isOpen: true,
        announcement: '欢迎光临本店~',
        minOrder: 20,
        deliveryFee: 3,
        monthSales: 0,
        customCategories: [],
        dishes: {},
        promotion: null,
        activities: [] as IShopActivity[],
      }
      const curDish = existing.dishes[dishId] || {
        price: 0,
        soldOut: false,
        onShelf: true,
        stock: -1,
        sales: 0,
      }
      const updated = {
        ...prev,
        [shopId]: {
          ...existing,
          dishes: {
            ...existing.dishes,
            [dishId]: {
              ...curDish,
              ...patch,
            },
          },
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 菜品上下架
  const toggleDishShelf = useCallback((shopId: string, dishId: string, onShelf: boolean) => {
    updateDishStatus(shopId, dishId, { onShelf })
  }, [updateDishStatus])

  // 设置售罄
  const toggleDishSoldOut = useCallback((shopId: string, dishId: string, soldOut: boolean) => {
    updateDishStatus(shopId, dishId, { soldOut })
  }, [updateDishStatus])

  // 修改价格
  const setDishPrice = useCallback((shopId: string, dishId: string, price: number) => {
    updateDishStatus(shopId, dishId, { price })
  }, [updateDishStatus])

  // 设置库存
  const setDishStock = useCallback((shopId: string, dishId: string, stock: number) => {
    updateDishStatus(shopId, dishId, { stock })
  }, [updateDishStatus])

  // 设置菜品图片（base64）
  const setDishImage = useCallback((shopId: string, dishId: string, image: string) => {
    updateDishStatus(shopId, dishId, { image })
  }, [updateDishStatus])

  // 设置菜品名称和描述
  const setDishInfo = useCallback((shopId: string, dishId: string, info: { name?: string; description?: string }) => {
    updateDishStatus(shopId, dishId, info)
  }, [updateDishStatus])

  // 新增自定义菜品
  const addDish = useCallback((shopId: string, categoryId: string, dish: { name: string; description: string; price: number; image: string }) => {
    const dishId = `custom_${Date.now()}`
    setShopStatus(prev => {
      const existing = prev[shopId] || {
        isOpen: true,
        announcement: '欢迎光临本店~',
        minOrder: 20,
        deliveryFee: 3,
        monthSales: 0,
        customCategories: [],
        dishes: {},
        promotion: null,
        activities: [] as IShopActivity[],
      }
      const updated = {
        ...prev,
        [shopId]: {
          ...existing,
          dishes: {
            ...existing.dishes,
            [dishId]: {
              price: dish.price,
              soldOut: false,
              onShelf: true,
              stock: -1,
              sales: 0,
              image: dish.image,
              name: dish.name,
              description: dish.description,
              categoryId,
            },
          },
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    return dishId
  }, [])

  // 设置菜品规格组（覆盖原菜品规格）
  const setDishSpecs = useCallback((shopId: string, dishId: string, specs: IDishSpecOverride[]) => {
    updateDishStatus(shopId, dishId, { specs })
  }, [updateDishStatus])

  // 设置菜品加料（覆盖原菜品加料）
  const setDishExtras = useCallback((shopId: string, dishId: string, extras: IDishExtraOverride[]) => {
    updateDishStatus(shopId, dishId, { extras })
  }, [updateDishStatus])

  // 获取合并后的菜品（基础数据 + 商家覆盖的规格/加料/价格等）
  const getMergedDish = useCallback((shopId: string, baseDish: IDish): IDish & { stock: number; soldOut: boolean; onShelf: boolean } => {
    const override = shopStatus[shopId]?.dishes[baseDish.id]
    const specs: IDishSpec[] = override?.specs
      ? override.specs.map(s => ({ id: s.id, name: s.name, options: s.options }))
      : (baseDish.specs || [])
    const extras: IDishExtra[] = override?.extras
      ? override.extras.map(e => ({ id: e.id, name: e.name, price: e.price }))
      : (baseDish.extras || [])
    return {
      ...baseDish,
      name: override?.name || baseDish.name,
      description: override?.description || baseDish.description,
      price: override?.price ?? baseDish.price,
      image: override?.image || baseDish.image,
      sales: (override?.sales ?? baseDish.sales) || 0,
      specs,
      extras,
      stock: override?.stock ?? -1,
      soldOut: override?.soldOut ?? false,
      onShelf: override?.onShelf ?? true,
    }
  }, [shopStatus])

  // 判断店铺是否营业
  const isShopOpen = useCallback((shopId: string) => {
    return shopStatus[shopId]?.isOpen ?? true
  }, [shopStatus])

  // 判断菜品是否可加购（上架中、未售罄、有库存）
  const isDishAvailable = useCallback((shopId: string, dishId: string) => {
    const shop = shopStatus[shopId]
    if (!shop) return true
    const dish = shop.dishes[dishId]
    if (!dish) return true
    if (!dish.onShelf) return false
    if (dish.soldOut) return false
    if (dish.stock === 0) return false
    return true
  }, [shopStatus])

  // 新增自定义分类
  const addCategory = useCallback((shopId: string, name: string) => {
    const catId = `cat_${Date.now()}`
    setShopStatus(prev => {
      const existing = prev[shopId] || {
        isOpen: true,
        announcement: '欢迎光临本店~',
        minOrder: 20,
        deliveryFee: 3,
        monthSales: 0,
        customCategories: [],
        dishes: {},
        promotion: null,
        activities: [] as IShopActivity[],
      }
      const newCat: ICustomCategory = {
        id: catId,
        name: name.trim() || '新分类',
        sort: (existing.customCategories?.length || 0) + 1,
      }
      const updated = {
        ...prev,
        [shopId]: {
          ...existing,
          customCategories: [...(existing.customCategories || []), newCat],
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    return catId
  }, [])

  // 重命名分类
  const renameCategory = useCallback((shopId: string, categoryId: string, name: string) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const cats = [...(existing.customCategories || [])]
      const idx = cats.findIndex(c => c.id === categoryId)
      if (idx >= 0) {
        cats[idx] = { ...cats[idx], name: name.trim() || '未命名' }
      }
      const updated = {
        ...prev,
        [shopId]: { ...existing, customCategories: cats },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 删除分类
  const deleteCategory = useCallback((shopId: string, categoryId: string) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const cats = (existing.customCategories || []).filter(c => c.id !== categoryId)
      // 该分类下的自定义菜品也一并移除（或归到默认分类，这里选择移除）
      const newDishes = { ...existing.dishes }
      Object.keys(newDishes).forEach(dishId => {
        if (newDishes[dishId].categoryId === categoryId) {
          delete newDishes[dishId]
        }
      })
      const updated = {
        ...prev,
        [shopId]: { ...existing, customCategories: cats, dishes: newDishes },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 获取所有分类（原始 + 自定义）
  const getAllCategories = useCallback((shopId: string) => {
    const shop = getAllShops().find(s => s.id === shopId)
    if (!shop) return []
    const status = shopStatus[shopId]
    const baseCats = shop.categories.map(c => ({ id: c.id, name: c.name, sort: 0, isCustom: false }))
    const customCats = (status?.customCategories || [])
      .sort((a, b) => a.sort - b.sort)
      .map(c => ({ ...c, isCustom: true }))
    return [...baseCats, ...customCats]
  }, [shopStatus])

  // 订单送达后累加店铺月售和菜品销量（幂等：同一订单只加一次）
  // 调用方需在订单上标记 salesCounted，此处按传入 items 累加
  const addSalesFromOrder = useCallback((
    shopId: string,
    items: { dishId: string; quantity: number }[],
    totalQuantity: number,
  ) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const newDishes = { ...existing.dishes }
      items.forEach(item => {
        const cur = newDishes[item.dishId]
        if (cur) {
          newDishes[item.dishId] = {
            ...cur,
            sales: (cur.sales || 0) + item.quantity,
          }
        }
      })
      const updated = {
        ...prev,
        [shopId]: {
          ...existing,
          monthSales: (existing.monthSales || 0) + totalQuantity,
          dishes: newDishes,
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 财务提现相关
  const [financeWithdrawRecords, setFinanceWithdrawRecords] = useState<IFinanceWithdrawRecord[]>([])

  useEffect(() => {
    const raw = scopedStorage.getItem(FINANCE_WITHDRAW_KEY)
    if (raw) {
      try { setFinanceWithdrawRecords(JSON.parse(raw)) } catch { setFinanceWithdrawRecords([]) }
    } else {
      // 初始演示数据
      const demo: IFinanceWithdrawRecord[] = [
        { id: 'wdr1', shopId: '1', amount: 500, fee: 5, arriveAmount: 495, status: 'success', account: '微信商户号', accountType: 'wechat', createdAt: Date.now() - 86400000 * 7, arriveAt: Date.now() - 86400000 * 6 },
        { id: 'wdr2', shopId: '1', amount: 200, fee: 2, arriveAmount: 198, status: 'success', account: '支付宝商户号', accountType: 'alipay', createdAt: Date.now() - 86400000 * 3, arriveAt: Date.now() - 86400000 * 2 },
      ]
      setFinanceWithdrawRecords(demo)
      scopedStorage.setItem(FINANCE_WITHDRAW_KEY, JSON.stringify(demo))
    }
  }, [])

  const getFinanceWithdrawRecords = useCallback((shopId: string) => {
    return financeWithdrawRecords.filter(r => r.shopId === shopId).sort((a, b) => b.createdAt - a.createdAt)
  }, [financeWithdrawRecords])

  const requestFinanceWithdraw = useCallback((shopId: string, amount: number, account: string, accountType: 'alipay' | 'wechat' | 'bank'): { success: boolean; msg: string; record?: IFinanceWithdrawRecord } => {
    if (amount <= 0) return { success: false, msg: '提现金额无效' }
    const fee = Math.max(0.1, +(amount * 0.01).toFixed(2))
    const arriveAmount = +(amount - fee).toFixed(2)
    const record: IFinanceWithdrawRecord = {
      id: `wdr_${Date.now()}`,
      shopId,
      amount,
      fee,
      arriveAmount,
      status: 'pending',
      account,
      accountType,
      createdAt: Date.now(),
    }
    const updated = [record, ...financeWithdrawRecords]
    setFinanceWithdrawRecords(updated)
    scopedStorage.setItem(FINANCE_WITHDRAW_KEY, JSON.stringify(updated))
    // 模拟2秒后到账
    setTimeout(() => {
      setFinanceWithdrawRecords(prev => {
        const list = prev.map(r => r.id === record.id ? { ...r, status: 'success' as const, arriveAt: Date.now() } : r)
        scopedStorage.setItem(FINANCE_WITHDRAW_KEY, JSON.stringify(list))
        return list
      })
    }, 2000)
    return { success: true, msg: '提现申请已提交', record }
  }, [financeWithdrawRecords])

  // —— 创建用户自定义店铺（商家建店）——
  // 返回 { shopId, shop }，shop 是转换成 IShop 格式的完整对象
  const createUserShop = useCallback((params: {
    ownerPhone: string
    name: string
    tagline: string
    category: string
    cover: string
    address: string
    phone: string
    businessHours: string
    minOrder: number
    deliveryFee: number
    description: string
    announcement: string
  }): { shopId: string; shop: IShop } => {
    const now = Date.now()
    const shopId = `user_shop_${now}`

    // 建一个分类 + 3 道初始菜
    const catId = `cat_${now}_1`
    const dishes: IUserCreatedDish[] = [
      {
        id: `dish_${now}_1`,
        name: '招牌套餐',
        description: '本店招牌，必点推荐',
        price: 28,
        image: params.cover,
        sales: 0,
        categoryId: catId,
      },
      {
        id: `dish_${now}_2`,
        name: '经典主食',
        description: '实惠之选，分量十足',
        price: 22,
        image: params.cover,
        sales: 0,
        categoryId: catId,
      },
      {
        id: `dish_${now}_3`,
        name: '招牌饮品',
        description: '清爽解腻',
        price: 12,
        image: params.cover,
        sales: 0,
        categoryId: catId,
      },
    ]

    const userShop: IUserCreatedShop = {
      id: shopId,
      ownerPhone: params.ownerPhone,
      name: params.name,
      cover: params.cover,
      tagline: params.tagline,
      rating: 5.0,
      monthSales: 0,
      minOrder: params.minOrder,
      deliveryFee: params.deliveryFee,
      deliveryTime: '25-35分钟',
      distance: '1.2km',
      category: params.category,
      address: params.address,
      phone: params.phone,
      description: params.description,
      businessHours: params.businessHours,
      announcement: params.announcement,
      categories: [{ id: catId, name: '招牌推荐', dishes }],
      createdAt: now,
    }

    // 保存到用户店铺列表
    const userShops = readUserShops()
    userShops.push(userShop)
    saveUserShops(userShops)

    // 同步更新 shopStatus（新建的店铺默认营业中）
    setShopStatus(prev => {
      const updated = { ...prev }
      const dishStatus: IShopStatus[string]['dishes'] = {}
      dishes.forEach(d => {
        dishStatus[d.id] = {
          price: d.price,
          soldOut: false,
          onShelf: true,
          stock: -1,
          sales: 0,
        }
      })
      updated[shopId] = {
        isOpen: true,
        announcement: params.announcement,
        businessHours: params.businessHours,
        minOrder: params.minOrder,
        deliveryFee: params.deliveryFee,
        monthSales: 0,
        customCategories: [],
        dishes: dishStatus,
        promotion: null,
        activities: [],
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })

    const shop: IShop = {
      id: userShop.id,
      name: userShop.name,
      cover: userShop.cover,
      tagline: userShop.tagline,
      rating: userShop.rating,
      monthSales: userShop.monthSales,
      minOrder: userShop.minOrder,
      deliveryFee: userShop.deliveryFee,
      deliveryTime: userShop.deliveryTime,
      distance: userShop.distance,
      category: userShop.category,
      address: userShop.address,
      phone: userShop.phone,
      description: userShop.description,
      businessHours: userShop.businessHours,
      announcement: userShop.announcement,
      categories: userShop.categories.map(c => ({
        id: c.id,
        name: c.name,
        dishes: c.dishes.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.price,
          image: d.image,
          sales: d.sales,
          categoryId: d.categoryId,
        })),
      })),
    }

    return { shopId, shop }
  }, [])

  return {
    shopStatus,
    getShopStatus,
    toggleShopOpen,
    updateShopInfo,
    updatePromotion,
    updateDishStatus,
    toggleDishShelf,
    toggleDishSoldOut,
    setDishPrice,
    setDishStock,
    setDishImage,
    setDishInfo,
    setDishSpecs,
    setDishExtras,
    getMergedDish,
    addDish,
    addCategory,
    renameCategory,
    deleteCategory,
    getAllCategories,
    isShopOpen,
    isDishAvailable,
    addSalesFromOrder,
    // 活动管理
    getActivities,
    saveActivity,
    toggleActivity,
    deleteActivity,
    // 财务提现
    financeWithdrawRecords,
    getFinanceWithdrawRecords,
    requestFinanceWithdraw,
    // 用户自建店铺
    createUserShop,
    getAllShops,
    save,
  }
}

export type UseShopStatusReturn = ReturnType<typeof useShopStatus>
