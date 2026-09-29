import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { SHOP_STATUS_KEY, FINANCE_WITHDRAW_KEY, USER_SHOPS_KEY } from '@/data/shop-status'
import type { IShopStatus, ICustomCategory, IShopActivity, IFinanceWithdrawRecord, IDishSpecOverride, IDishExtraOverride, IUserCreatedShop, IUserCreatedDish } from '@/data/shop-status'
import type { IDish, IDishSpec, IDishExtra, IShop, IShopCategory } from '@/data/shops'
import { MOCK_SHOPS, getAllShops, isRemoteShopsLoaded, patchRemoteShops, SHOPS_CHANGE_EVENT } from '@/data/shops'
import { ensureShopsLoaded, reloadShops } from '@/data/shops-remote'
import { useAuth } from '@/hooks/useAuth'
import {
  updateDishRemote,
  updateShopRemote,
  saveActivityRemote,
  setActivityActiveRemote,
  deleteActivityRemote,
  createDishRemote,
  replaceDishOptionsRemote,
  createCategoryRemote,
  renameCategoryRemote,
  deleteCategoryRemote,
  isUuid,
  remoteWritableDishKeys,
  type ActivityPayload,
  type DishConfigPatch,
  type ShopConfigPatch,
} from '@/data/shop-config-remote'

/**
 * 第 2 期 2h：把本地菜品补丁同步进内存里的店铺缓存。
 *
 * 商家改菜品时先改本地覆盖层（界面立刻响应），同时尽力写数据库；
 * 写成功后用同一个值更新缓存，界面就不会「闪回旧值、等下次重拉才变」。
 * 补丁字段名与 IDish 上架后的字段一一对应（price / soldOut / onShelf / stock / name / description / image）。
 */
function patchCachedDish(shopId: string, dishId: string, patch: DishConfigPatch): boolean {
  let touched = false
  const ok = patchRemoteShops(shops => {
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i]
      if (shop.id !== shopId) continue
      let hit = false
      // 用「替换对象」而不是就地改字段：页面的 useMemo 依赖对象身份，
      // 就地改会让派生列表保持旧值（改了价格但界面不更新）。
      const categories = shop.categories.map(cat => {
        const idx = cat.dishes.findIndex(d => d.id === dishId)
        if (idx < 0) return cat
        const dishes = cat.dishes.slice()
        dishes[idx] = { ...dishes[idx], ...patch }
        hit = true
        return { ...cat, dishes }
      })
      if (hit) {
        shops[i] = { ...shop, categories }
        touched = true
      }
    }
  })
  return ok && touched
}

function patchCachedDishOptions(
  shopId: string,
  dishId: string,
  specs: IDishSpecOverride[],
  extras: IDishExtraOverride[],
): boolean {
  let touched = false
  patchRemoteShops(shops => {
    for (let i = 0; i < shops.length; i++) {
      if (shops[i].id !== shopId) continue
      const categories = shops[i].categories.map(cat => ({
        ...cat,
        dishes: cat.dishes.map(dish => {
          if (dish.id !== dishId) return dish
          touched = true
          return { ...dish, specs, extras }
        }),
      }))
      if (touched) shops[i] = { ...shops[i], categories }
    }
  })
  return touched
}

function patchCachedCategory(shopId: string, categoryId: string, name?: string): void {
  patchRemoteShops(shops => {
    const index = shops.findIndex(shop => shop.id === shopId)
    if (index < 0) return
    const shop = shops[index]
    const categories = name === undefined
      ? shop.categories.filter(cat => cat.id !== categoryId)
      : shop.categories.map(cat => cat.id === categoryId ? { ...cat, name } : cat)
    shops[index] = { ...shop, categories }
  })
}

/** 把店铺基础信息同步进内存缓存（字段名与 IShop 一致） */
function patchCachedShop(shopId: string, patch: Record<string, unknown>): boolean {
  let touched = false
  const ok = patchRemoteShops(shops => {
    for (let i = 0; i < shops.length; i++) {
      if (shops[i].id !== shopId) continue
      shops[i] = { ...shops[i], ...patch }
      touched = true
    }
  })
  return ok && touched
}

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

/**
 * 初始化店铺状态（从 getAllShops() 推导）。
 *
 * ⚠️ 第 2 期 2h 起：**不再给每一道菜预置一份默认覆盖**。
 * 老做法会把 onShelf:true / soldOut:false / stock:-1 写进本机覆盖层，
 * 于是「数据库里被别处改成下架」之后，本机覆盖仍然盖着它，永远看不到更新。
 * 现在覆盖层只在商家真的动过某道菜时才有记录，读不到就落到数据库的基础数据。
 */
function getInitialStatus(): IShopStatus {
  const allShops = getAllShops()
  const status: IShopStatus = {}
  allShops.forEach(shop => {
    status[shop.id] = {
      isOpen: shop.isOpen ?? true,
      announcement: shop.announcement || '欢迎光临本店~',
      businessHours: shop.businessHours || '09:00 - 21:00',
      minOrder: shop.minOrder,
      deliveryFee: shop.deliveryFee,
      monthSales: shop.monthSales || 0,
      customCategories: [],
      dishes: {},
      promotion: null,
      activities: [],
    }
  })
  return status
}

/**
 * 一次性迁移：抹掉老版本「按默认值铺满每一道菜」的冗余覆盖。
 *
 * 只清理与初始种子完全一致的记录（价格=基础价、未售罄、已上架、不限库存、无自定义图片/名字/规格），
 * 商家真正改过的记录原样保留。返回是否发生了改动（需要写回 localStorage）。
 */
function pruneSeededDishOverrides(parsed: IShopStatus): boolean {
  let changed = false
  const shops = getAllShops()
  for (const shopId of Object.keys(parsed)) {
    const status = parsed[shopId]
    if (!status?.dishes) continue
    const shop = shops.find(s => s.id === shopId)
    if (!shop) continue
    const baseDishes = new Map<string, IDish>()
    shop.categories.forEach(c => c.dishes.forEach(d => baseDishes.set(d.id, d)))
    for (const dishId of Object.keys(status.dishes)) {
      const o = status.dishes[dishId]
      const base = baseDishes.get(dishId)
      if (!base) continue
      const isPristineSeed =
        o.price === base.price &&
        o.soldOut === false &&
        o.onShelf === true &&
        o.stock === -1 &&
        (o.sales ?? 0) === (base.sales || 0) &&
        !o.image && !o.name && !o.description && !o.categoryId && !o.specs && !o.extras
      if (isPristineSeed) {
        delete status.dishes[dishId]
        changed = true
      }
    }
  }
  return changed
}

/**
 * 本机覆盖层的初始值：取数据库基础数据。
 *
 * 覆盖层记录只用来放「商家本机改过的字段」，但历史上有些代码会直接读
 * `status.dishes[id].price`，所以新建记录时仍把基础值填进去；
 * 只有改动写进数据库成功后，这些与基础值相同的冗余字段才会被清掉（见 releaseDishOverride）。
 */
function baseDishOverride(shopId: string, dishId: string) {
  const base = getAllShops()
    .find(s => s.id === shopId)
    ?.categories.flatMap(c => c.dishes)
    .find(d => d.id === dishId)
  return {
    price: base?.price ?? 0,
    soldOut: base?.soldOut ?? false,
    onShelf: base?.onShelf ?? true,
    stock: base?.stock ?? -1,
    sales: base?.sales ?? 0,
  }
}

/** 店铺级字段：数据库里都有对应列（见 shop-config-remote.updateShopRemote） */
const SHOP_LEVEL_KEYS = ['isOpen', 'announcement', 'businessHours', 'minOrder', 'deliveryFee'] as const

/**
 * 用数据库基础数据刷新本机覆盖层里「这台设备没改过」的店铺级字段。
 *
 * 为什么需要：顾客端的店铺页/详情页读的就是这份覆盖层。如果覆盖层一直保留
 * 登录那一刻的公告、营业时间，那么商家在另一台设备改完之后，这台设备永远看不到。
 * 商家本机刚改、还没写库成功的字段（localEdited 标记为 true）保持不动。
 */
function reconcileShopFields(parsed: IShopStatus): boolean {
  let changed = false
  for (const shop of getAllShops()) {
    const status = parsed[shop.id]
    if (!status) {
      // 本机覆盖层是「内置演示店铺」那一版时，数据库里的店铺还没有记录，这里补一条。
      // （首次在干净浏览器里登录就会出现这种情况：覆盖层在数据库到达之前就初始化了。）
      parsed[shop.id] = {
        isOpen: shop.isOpen ?? true,
        announcement: shop.announcement || '欢迎光临本店~',
        businessHours: shop.businessHours || '09:00 - 21:00',
        minOrder: shop.minOrder,
        deliveryFee: shop.deliveryFee,
        monthSales: shop.monthSales || 0,
        customCategories: [],
        dishes: {},
        promotion: null,
        activities: [],
      }
      changed = true
      continue
    }
    for (const key of SHOP_LEVEL_KEYS) {
      if (status.localEdited?.[key]) continue
      const baseValue =
        key === 'isOpen'
          ? (shop.isOpen ?? true)
          : key === 'announcement'
            ? (shop.announcement || '欢迎光临本店~')
            : key === 'businessHours'
              ? (shop.businessHours || '09:00 - 21:00')
              : (shop[key] as number | undefined)
      if (baseValue === undefined) continue
      if (status[key] !== baseValue) {
        ;(status as Record<string, unknown>)[key] = baseValue
        changed = true
      }
    }
  }
  return changed
}

export function useShopStatus() {
  const { isLoggedIn } = useAuth()
  const [shopStatus, setShopStatus] = useState<IShopStatus>({})
  // 店铺基础数据（数据库）的版本号：挂载时缓存可能还没加载完，
  // 到位后需要再清一次老版本的冗余菜品覆盖（见下方 pruneSeededDishOverrides）
  const [shopsVersion, setShopsVersion] = useState(0)

  useEffect(() => {
    const onShops = () => setShopsVersion(v => v + 1)
    window.addEventListener(SHOPS_CHANGE_EVENT, onShops)
    return () => window.removeEventListener(SHOPS_CHANGE_EVENT, onShops)
  }, [])
  // 2026-09-28 修复：商家端的页面都不会调用 useShops()，因此没人触发「从数据库读店铺」，
  // getAllShops() 一直返回内置演示店铺（id 是 '1'~'8'），商家自己的 uuid 店铺找不到，
  // 「商品管理」等页面就会永远停在"店铺数据加载中..."。这里补上触发点。
  // ensureShopsLoaded 是幂等的：没登录 / 已加载过会直接短路，重复调用无副作用。
  useEffect(() => {
    if (isLoggedIn) void ensureShopsLoaded()
  }, [isLoggedIn])

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
        if (pruneSeededDishOverrides(parsed)) migrated = true
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

  // 数据库里的店铺基础数据到位后做两件事：
  //   1) 清掉「老版本铺满每一道菜」的冗余覆盖（会盖住别处的改动，属于脏数据）；
  //   2) 用最新数据库值刷新本机没改过的店铺级字段（公告/营业时间/营业开关…），
  //      这样商家在另一台设备改完，顾客端这边刷新/收到推送后就能看到。
  // 商家真正改过的记录与「本机改过未写库」的字段都不会被动。
  useEffect(() => {
    if (shopsVersion === 0) return
    setShopStatus(prev => {
      const copy = JSON.parse(JSON.stringify(prev)) as IShopStatus
      const pruned = pruneSeededDishOverrides(copy)
      const reconciled = reconcileShopFields(copy)
      if (!pruned && !reconciled) return prev
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(copy))
      return copy
    })
  }, [shopsVersion])

  const save = useCallback((s: IShopStatus) => {
    setShopStatus(s)
    scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(s))
  }, [])

  /**
   * 第 2 期 2h：写库成功后，把这些字段从本机覆盖层里删掉。
   *
   * 覆盖层是「本机优先」的：留着它就永远盖住数据库，别处（另一台设备 / 另一个账号）
   * 改过之后本机看不到新值。写库成功时数据库已经是同一个值、内存缓存也已同步，
   * 覆盖层不再需要，交还给数据库做唯一来源；写库失败则保留（离线兜底，行为同改造前）。
   */
  const releaseDishOverride = useCallback((shopId: string, dishId: string, keys: string[]) => {
    setShopStatus(prev => {
      const shop = prev[shopId]
      const cur = shop?.dishes?.[dishId]
      if (!shop || !cur) return prev
      const base = baseDishOverride(shopId, dishId) as Record<string, unknown>
      const nextDish = { ...cur } as Record<string, unknown>
      for (const key of keys) delete nextDish[key]
      // 顺带清掉「和数据库基础值相同」的字段：它们留着只会盖住别处的改动
      for (const [key, value] of Object.entries(nextDish)) {
        if (key in base && base[key] === value) delete nextDish[key]
      }
      const dishes = { ...shop.dishes }
      if (Object.keys(nextDish).length === 0) {
        delete dishes[dishId]
      } else {
        dishes[dishId] = nextDish as IShopStatus[string]['dishes'][string]
      }
      const updated = { ...prev, [shopId]: { ...shop, dishes } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  /**
   * 尽力把菜品改动写进数据库（未登录 / 未配置 / 内置演示菜品 / 写失败都静默返回）。
   * 成功则同步内存缓存并交还本地覆盖，让「另一台设备刷新后能看到」成立。
   */
  const writeDishThrough = useCallback(
    (shopId: string, dishId: string, patch: DishConfigPatch) => {
      const writable = remoteWritableDishKeys(patch)
      if (writable.length === 0 || !isUuid(dishId)) return
      void (async () => {
        const ok = await updateDishRemote(dishId, patch)
        if (!ok) return
        if (patchCachedDish(shopId, dishId, patch) && isRemoteShopsLoaded()) {
          releaseDishOverride(shopId, dishId, writable)
        }
      })()
    },
    [releaseDishOverride],
  )

  /** 清掉「本机改过」的标记（写库成功后调用：本机值已与数据库一致，交还给数据库做唯一来源） */
  const clearLocalEdited = useCallback((shopId: string, keys: readonly string[]) => {
    setShopStatus(prev => {
      const shop = prev[shopId]
      if (!shop?.localEdited) return prev
      const next = { ...shop.localEdited }
      for (const key of keys) delete next[key as keyof typeof next]
      const updated = { ...prev, [shopId]: { ...shop, localEdited: next } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  /**
   * 活动列表的「底稿」：本机覆盖层里有就用本机的，否则用数据库读回来的。
   *
   * 活动是 copy-on-write：本机一旦改过就整份存在覆盖层里，
   * 所以第一次改某个活动前必须先把数据库那份抄进来，否则会出现
   * 「改了 A 活动 → 本机列表只剩 A，B 活动凭空消失」。
   */
  const activityBase = useCallback((shopId: string, local: IShopActivity[] | undefined): IShopActivity[] => {
    if (local && local.length > 0) return local
    return getAllShops().find(s => s.id === shopId)?.activities || []
  }, [])

  /** 删掉本机的临时菜品记录（新建菜品成功写库后调用，避免同一道菜出现两次） */
  const removeLocalDish = useCallback((shopId: string, dishId: string) => {
    setShopStatus(prev => {
      const shop = prev[shopId]
      if (!shop?.dishes?.[dishId]) return prev
      const dishes = { ...shop.dishes }
      delete dishes[dishId]
      const updated = { ...prev, [shopId]: { ...shop, dishes } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  /**
   * 尽力把店铺级配置写进数据库（营业开关/公告/营业时间/起送价/配送费）。
   * 成功 → 同步内存缓存 + 清掉本机改过标记，让别端的改动以后能刷新回来。
   */
  const writeShopThrough = useCallback(
    (shopId: string, patch: ShopConfigPatch, keys: readonly string[]) => {
      if (keys.length === 0 || !isUuid(shopId)) return
      void (async () => {
        const ok = await updateShopRemote(shopId, patch)
        if (!ok) return
        patchCachedShop(shopId, patch as Record<string, unknown>)
        clearLocalEdited(shopId, keys)
      })()
    },
    [clearLocalEdited],
  )

  // 获取单个店铺状态
  const getShopStatus = useCallback((shopId: string) => {
    return shopStatus[shopId] || null
  }, [shopStatus])

  // 切换营业状态
  const toggleShopOpen = useCallback((shopId: string, isOpen: boolean) => {
    setShopStatus(prev => {
      const cur = prev[shopId]
      const updated = {
        ...prev,
        [shopId]: {
          ...cur,
          isOpen,
          localEdited: { ...(cur?.localEdited || {}), isOpen: true },
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    // 第 2 期 2h：本地先行，随后尽力写数据库（失败保留本机值，行为同改造前）
    writeShopThrough(shopId, { isOpen }, ['isOpen'])
  }, [writeShopThrough])

  // 更新店铺基础信息
  const updateShopInfo = useCallback((shopId: string, info: Partial<Pick<IShopStatus[string], 'announcement' | 'minOrder' | 'deliveryFee' | 'businessHours'>>) => {
    setShopStatus(prev => {
      const cur = prev[shopId]
      const flags = { ...(cur?.localEdited || {}) }
      for (const key of Object.keys(info)) flags[key as keyof typeof flags] = true
      const updated = {
        ...prev,
        [shopId]: {
          ...cur,
          ...info,
          localEdited: flags,
        },
      }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    // 第 2 期 2h：本地先行，随后尽力写数据库
    writeShopThrough(shopId, info as ShopConfigPatch, Object.keys(info))
  }, [writeShopThrough])

  /**
   * 本机活动的临时 id（`act_<时间戳>`）换成数据库生成的 uuid。
   * 新建活动/满减写库成功后调用，之后的启停、编辑、删除才会落到同一行。
   */
  const replaceActivityId = useCallback((shopId: string, fromId: string, toId: string) => {
    setShopStatus(prev => {
      const shop = prev[shopId]
      if (!shop?.activities) return prev
      let hit = false
      const activities = shop.activities.map(a => {
        if (a.id !== fromId) return a
        hit = true
        return { ...a, id: toId }
      })
      if (!hit) return prev
      const updated = { ...prev, [shopId]: { ...shop, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 更新满减活动（老接口，同时更新 activities 以保持兼容）
  const updatePromotion = useCallback((shopId: string, promotion: IShopStatus[string]['promotion']) => {
    setShopStatus(prev => {
      const existing = prev[shopId] || { isOpen: true, announcement: '', minOrder: 20, deliveryFee: 3, monthSales: 0, customCategories: [], dishes: {}, promotion: null, activities: [] }
      let newActivities = [...activityBase(shopId, existing.activities)]
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

    // 第 2 期 2h：满减在前端是 promotion 字段，在数据库里是 shop_activities 的一行
    const current = shopStatus[shopId]?.activities?.find(a => a.type === 'fullReduce')
    if (!promotion) {
      if (current && isUuid(current.id)) void setActivityActiveRemote(current.id, false)
      return
    }
    const editingRemote = Boolean(current && isUuid(current.id))
    void (async () => {
      const id = await saveActivityRemote(shopId, {
        ...(editingRemote && current ? { id: current.id } : {}),
        type: 'fullReduce',
        name: current?.name || '满减活动',
        description: promotion.description,
        active: true,
        thresholds: promotion.thresholds,
        discounts: promotion.discounts,
      })
      if (id && current && !editingRemote) replaceActivityId(shopId, current.id, id)
    })()
  }, [shopStatus, replaceActivityId, activityBase])

  // 获取店铺活动列表
  const getActivities = useCallback((shopId: string): IShopActivity[] => {
    // 本机改过就用本机的，否则落到数据库里读回来的活动（别端配置的也能看到）
    return activityBase(shopId, shopStatus[shopId]?.activities)
  }, [shopStatus, activityBase])

  // 新增/编辑活动
  const saveActivity = useCallback((shopId: string, activity: ActivityPayload) => {
    // 临时 id 提到外面算：写库成功后要把它换成数据库 uuid
    const localId = activity.id ?? `act_${Date.now()}`
    setShopStatus(prev => {
      const existing = prev[shopId] || { isOpen: true, announcement: '', minOrder: 20, deliveryFee: 3, monthSales: 0, customCategories: [], dishes: {}, promotion: null, activities: [] }
      const activities = [...activityBase(shopId, existing.activities)]
      if (activity.id) {
        const idx = activities.findIndex(a => a.id === activity.id)
        if (idx >= 0) {
          activities[idx] = { ...activities[idx], ...activity }
        } else {
          // 数据库里的活动本机还没抄过：补进来，避免编辑后它从列表里消失
          activities.unshift({ ...activity, createdAt: Date.now() } as IShopActivity)
        }
      } else {
        activities.unshift({ ...activity, id: localId, createdAt: Date.now() } as IShopActivity)
      }
      const updated = { ...prev, [shopId]: { ...existing, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    // 第 2 期 2h：尽力写数据库（店铺没有数据库归属 / 未登录 / 失败 → 保持原来的纯本机行为）
    void (async () => {
      const isNew = !activity.id
      const id = await saveActivityRemote(shopId, activity.id ? activity : { ...activity, id: undefined })
      if (!id) return
      if (isNew) replaceActivityId(shopId, localId, id)
    })()
  }, [replaceActivityId, activityBase])

  // 切换活动启停状态
  const toggleActivity = useCallback((shopId: string, activityId: string, active: boolean) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const activities = activityBase(shopId, existing.activities).map(a =>
        a.id === activityId ? { ...a, active } : a
      )
      const updated = { ...prev, [shopId]: { ...existing, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    // 第 2 期 2h：写数据库（本机临时 id 的活动本来就只在本机，跳过）
    void setActivityActiveRemote(activityId, active)
  }, [activityBase])

  // 删除活动
  const deleteActivity = useCallback((shopId: string, activityId: string) => {
    setShopStatus(prev => {
      const existing = prev[shopId]
      if (!existing) return prev
      const activities = activityBase(shopId, existing.activities).filter(a => a.id !== activityId)
      const updated = { ...prev, [shopId]: { ...existing, activities } }
      scopedStorage.setItem(SHOP_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
    // 第 2 期 2h：写数据库（本机临时 id 的活动本来就只在本机，跳过）
    void deleteActivityRemote(activityId)
  }, [activityBase])

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
      // 只改一个字段时，其余字段用数据库基础值兜底（否则会把价格抹成 0）
      const curDish = existing.dishes[dishId] || baseDishOverride(shopId, dishId)
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
    // 第 2 期 2h：本地先行，随后尽力写数据库（失败保留本地覆盖，行为同改造前）
    writeDishThrough(shopId, dishId, patch)
  }, [writeDishThrough])

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
    // 第 2 期 2h：分类来自数据库（uuid）时，把新菜品也写进数据库；
    // 写成功后重拉一遍、再删掉本机临时记录，让这道菜由数据库统一提供。
    if (isUuid(categoryId)) {
      void (async () => {
        const remoteId = await createDishRemote({
          shopId,
          categoryId,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          image: dish.image,
        })
        if (!remoteId) return
        await reloadShops()
        removeLocalDish(shopId, dishId)
      })()
    }
    return dishId
  }, [removeLocalDish])

  // 本机先显示完整的新配置；数据库将规格与加料作为一次原子操作保存。
  const saveDishOptions = useCallback(async (
    shopId: string,
    dishId: string,
    specs: IDishSpecOverride[],
    extras: IDishExtraOverride[],
  ): Promise<boolean> => {
    updateDishStatus(shopId, dishId, { specs, extras })
    const saved = await replaceDishOptionsRemote(dishId, specs, extras)
    if (!saved) return false
    if (patchCachedDishOptions(shopId, dishId, specs, extras)) {
      releaseDishOverride(shopId, dishId, ['specs', 'extras'])
    }
    await reloadShops()
    return true
  }, [updateDishStatus, releaseDishOverride])

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
      // 第 2 期 2h：本机没有覆盖时用数据库读回来的值（别的设备改的上下架/售罄/库存）
      stock: override?.stock ?? baseDish.stock ?? -1,
      soldOut: override?.soldOut ?? baseDish.soldOut ?? false,
      onShelf: override?.onShelf ?? baseDish.onShelf ?? true,
    }
  }, [shopStatus])

  // 判断店铺是否营业
  const isShopOpen = useCallback((shopId: string) => {
    // 本机覆盖（商家自己刚改的）优先，其次用数据库里的营业开关
    return shopStatus[shopId]?.isOpen ?? getAllShops().find(s => s.id === shopId)?.isOpen ?? true
  }, [shopStatus])

  // 判断菜品是否可加购（上架中、未售罄、有库存）
  const isDishAvailable = useCallback((shopId: string, dishId: string) => {
    const override = shopStatus[shopId]?.dishes[dishId]
    if (override) {
      if (!override.onShelf) return false
      if (override.soldOut) return false
      if (override.stock === 0) return false
      return true
    }
    // 本机没有覆盖 → 用数据库里的基础数据判断（别的设备下架/售罄也能生效）
    const base = getAllShops()
      .find(s => s.id === shopId)
      ?.categories.flatMap(c => c.dishes)
      .find(d => d.id === dishId)
    if (!base) return true
    if (base.onShelf === false) return false
    if (base.soldOut) return false
    if (base.stock === 0) return false
    return true
  }, [shopStatus])

  // 新增自定义分类
  const addCategory = useCallback(async (shopId: string, name: string) => {
    const remoteId = await createCategoryRemote(shopId, name.trim())
    const catId = remoteId || `cat_${Date.now()}`
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
    if (remoteId) await reloadShops()
    return { id: catId, synced: Boolean(remoteId) }
  }, [])

  // 重命名分类
  const renameCategory = useCallback(async (shopId: string, categoryId: string, name: string) => {
    if (isUuid(categoryId)) {
      const saved = await renameCategoryRemote(categoryId, name.trim())
      if (!saved) return false
    }
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
    if (isUuid(categoryId)) {
      patchCachedCategory(shopId, categoryId, name.trim())
      await reloadShops()
    }
    return true
  }, [])

  // 删除分类
  const deleteCategory = useCallback(async (shopId: string, categoryId: string) => {
    if (isUuid(categoryId)) {
      const deleted = await deleteCategoryRemote(categoryId)
      if (!deleted) return false
    }
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
    if (isUuid(categoryId)) {
      patchCachedCategory(shopId, categoryId)
      await reloadShops()
    }
    return true
  }, [])

  // 获取所有分类（原始 + 自定义）
  const getAllCategories = useCallback((shopId: string) => {
    const shop = getAllShops().find(s => s.id === shopId)
    if (!shop) return []
    const status = shopStatus[shopId]
    const baseIds = new Set(shop.categories.map(c => c.id))
    const baseCats = shop.categories.map(c => ({
      id: c.id,
      name: c.name,
      sort: 0,
      isCustom: Boolean(c.isCustom || status?.customCategories?.some(local => local.id === c.id)),
    }))
    const customCats = (status?.customCategories || [])
      .filter(c => !baseIds.has(c.id))
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
        const cur = newDishes[item.dishId] || baseDishOverride(shopId, item.dishId)
        newDishes[item.dishId] = {
          ...cur,
          sales: (cur.sales || 0) + item.quantity,
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
    saveDishOptions,
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
