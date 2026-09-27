/**
 * 第 2 期：把店铺 / 分类 / 菜品 / 规格 / 加料 / 营销活动从 Supabase 读进内存缓存。
 *
 * 为什么用「缓存 + 事件」而不是把 getAllShops 改成异步：
 *   现有 15 个页面都在渲染期同步调用 getAllShops()，改成异步要动所有页面的加载态；
 *   这里保持同步签名，数据到达后通过 SHOPS_CHANGE_EVENT 通知，页面订阅 useShopsVersion() 自动重渲染。
 *
 * 注意：RLS 策略规定只有 authenticated 能读 shops/categories/dishes，因此**必须在登录后**加载。
 *
 * 字段映射：数据库列用 snake_case，前端模型用 camelCase；numeric 列统一 Number() 兜底。
 * 图片列存的是站点根相对路径（/images/xxx.jpg），与前端本地图片一致。
 */
import { supabase } from '@/lib/supabase'
import {
  setRemoteShops,
  type IShop,
  type IShopCategory,
  type IDish,
  type IDishSpec,
  type IDishExtra,
  type IShopActivity,
} from './shops'
import type { ActivityType } from './shop-status'

let inflight: Promise<void> | null = null
let loaded = false

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** 幂等：并发调用共用同一个请求；已加载过则直接返回 */
export function ensureShopsLoaded(): Promise<void> {
  if (!supabase || loaded) return Promise.resolve()
  if (inflight) return inflight
  inflight = (async () => {
    try {
      await loadShops()
      loaded = true
    } catch (err) {
      // 失败不抛给界面：保持内置演示数据可用，只打日志
      console.warn('[shops] 从数据库加载店铺失败，继续使用内置演示数据', err)
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 退出登录 / 切换账号时清空缓存，避免把上一个账号看到的数据留在内存里 */
export function resetShopsCache() {
  loaded = false
  inflight = null
  setRemoteShops(null)
}

async function loadShops(): Promise<void> {
  const sb = supabase
  if (!sb) return

  // 一次并发取回全部数据，避免按店铺循环查询（N+1）
  const [shopsRes, catsRes, dishesRes, groupsRes, optsRes, extrasRes, actsRes] = await Promise.all([
    sb.from('shops').select('*').order('month_sales', { ascending: false }),
    sb.from('categories').select('*').order('sort'),
    sb.from('dishes').select('*').order('sort'),
    sb.from('dish_spec_groups').select('*').order('sort'),
    sb.from('dish_spec_options').select('*').order('sort'),
    sb.from('dish_extras').select('*').order('sort'),
    sb.from('shop_activities').select('*'),
  ])

  const failed = [shopsRes, catsRes, dishesRes, groupsRes, optsRes, extrasRes, actsRes].find(r => r.error)
  if (failed?.error) throw failed.error

  const shops = shopsRes.data ?? []
  const cats = catsRes.data ?? []
  const dishes = dishesRes.data ?? []
  const groups = groupsRes.data ?? []
  const options = optsRes.data ?? []
  const extras = extrasRes.data ?? []
  const activities = actsRes.data ?? []

  // 规格组 → 选项（按 sort 排序）
  const optionsByGroup = new Map<string, { id: string; label: string; priceDelta?: number }[]>()
  for (const o of options) {
    const list = optionsByGroup.get(o.group_id) ?? []
    list.push({
      id: o.id,
      label: o.label,
      ...(o.price_delta != null ? { priceDelta: num(o.price_delta) } : {}),
    })
    optionsByGroup.set(o.group_id, list)
  }
  const specsByDish = new Map<string, IDishSpec[]>()
  for (const g of groups) {
    const list = specsByDish.get(g.dish_id) ?? []
    list.push({ id: g.id, name: g.name, options: optionsByGroup.get(g.id) ?? [] })
    specsByDish.set(g.dish_id, list)
  }

  const extrasByDish = new Map<string, IDishExtra[]>()
  for (const e of extras) {
    const list = extrasByDish.get(e.dish_id) ?? []
    list.push({ id: e.id, name: e.name, price: num(e.price) })
    extrasByDish.set(e.dish_id, list)
  }

  const dishesByCategory = new Map<string, IDish[]>()
  for (const d of dishes) {
    const specs = specsByDish.get(d.id)
    const exts = extrasByDish.get(d.id)
    const dish: IDish = {
      id: d.id,
      name: d.name,
      description: d.description ?? '',
      price: num(d.price),
      image: d.image_url ?? '',
      sales: num(d.sales),
      categoryId: d.category_id,
      ...(specs && specs.length > 0 ? { specs } : {}),
      ...(exts && exts.length > 0 ? { extras: exts } : {}),
    }
    const list = dishesByCategory.get(d.category_id) ?? []
    list.push(dish)
    dishesByCategory.set(d.category_id, list)
  }

  const catsByShop = new Map<string, IShopCategory[]>()
  for (const c of cats) {
    const list = catsByShop.get(c.shop_id) ?? []
    list.push({ id: c.id, name: c.name, dishes: dishesByCategory.get(c.id) ?? [] })
    catsByShop.set(c.shop_id, list)
  }

  const actsByShop = new Map<string, IShopActivity[]>()
  for (const a of activities) {
    const list = actsByShop.get(a.shop_id) ?? []
    list.push({
      id: a.id,
      type: a.type as ActivityType,
      name: a.name,
      description: a.description ?? '',
      active: Boolean(a.active),
      ...(a.thresholds ? { thresholds: (a.thresholds as unknown[]).map(v => num(v)) } : {}),
      ...(a.discounts ? { discounts: (a.discounts as unknown[]).map(v => num(v)) } : {}),
      ...(a.new_user_amount != null ? { newUserAmount: num(a.new_user_amount) } : {}),
      ...(a.discount_rate != null ? { discountRate: num(a.discount_rate) } : {}),
      ...(a.dish_id ? { dishId: a.dish_id } : {}),
      ...(a.dish_discount_rate != null ? { dishDiscountRate: num(a.dish_discount_rate) } : {}),
      ...(a.free_delivery_min != null ? { freeDeliveryMin: num(a.free_delivery_min) } : {}),
      createdAt: a.created_at ? Date.parse(a.created_at) : 0,
    })
    actsByShop.set(a.shop_id, list)
  }

  const mapped: IShop[] = shops.map(s => {
    const acts = actsByShop.get(s.id) ?? []
    // 兼容前端既有的 promotion 字段：由满减活动派生（前端部分老代码仍读它）
    const fullReduce = acts.find(a => a.type === 'fullReduce' && a.active)
    return {
      id: s.id,
      name: s.name,
      cover: s.cover_url ?? '',
      tagline: s.tagline ?? '',
      rating: num(s.rating),
      monthSales: num(s.month_sales),
      minOrder: num(s.min_order),
      deliveryFee: num(s.delivery_fee),
      deliveryTime: s.delivery_time ?? '',
      distance: s.distance ?? '',
      category: s.category ?? '',
      address: s.address ?? '',
      phone: s.phone ?? '',
      description: s.description ?? '',
      businessHours: s.business_hours ?? '',
      announcement: s.announcement ?? '',
      categories: catsByShop.get(s.id) ?? [],
      ...(s.packing_fee != null ? { packingFee: num(s.packing_fee) } : {}),
      ...(s.free_delivery_min != null ? { freeDeliveryMin: num(s.free_delivery_min) } : {}),
      ...(s.support_appointment != null ? { supportAppointment: Boolean(s.support_appointment) } : {}),
      ...(s.appointment_slots ? { appointmentSlots: s.appointment_slots as { label: string; available: boolean }[] } : {}),
      ...(acts.length > 0 ? { activities: acts } : {}),
      ...(fullReduce
        ? {
            promotion: {
              type: 'fullReduce' as const,
              thresholds: fullReduce.thresholds ?? [],
              discounts: fullReduce.discounts ?? [],
              description: fullReduce.description,
            },
          }
        : {}),
    }
  })

  setRemoteShops(mapped)
}
