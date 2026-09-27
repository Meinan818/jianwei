/**
 * 第 2 期收尾（2h）：商家侧「配置类写操作」写入数据库
 *
 * 背景：2a 已经把 shops / categories / dishes / 营销活动改成**从数据库读**，
 * 但商家在商家端的修改（上下架、改价、库存、售罄、店铺公告、营销活动…）
 * 仍然只写在本机 localStorage，所以「一台设备改、另一台设备看不到」。
 * 本模块把这些写操作补上云端：改完写入 Supabase，别端刷新（或订阅到 Realtime）即可看到。
 *
 * 设计原则（与 2b/2c/2d 一致，尽量不动现有逻辑）：
 *   1. **先本地、后云端**：调用方（useShopStatus）照原样先改本地状态，界面立刻响应；
 *      本模块只负责「尽力写库」，写成功返回 true，失败/未登录/未配置返回 false。
 *   2. **绝不抛错**：所有函数内部 try/catch，失败只 console.warn，不影响页面。
 *   3. **不假装成功**：UPDATE / DELETE 都带 `.select('id')` 回读，
 *      RLS 拒绝时会返回 0 行——按失败处理，让调用方保留本地覆盖（离线兜底）。
 *   4. 写库失败时行为退回改造前：只在本机生效，用户无感知。
 *
 * ⚠️ 两个必须知道的约束：
 *   · 前端内置演示店铺的 id 是 '1'~'8'、内置分类 id 也不是 uuid；这类数据**没有对应数据库行**，
 *     本模块会直接返回 false（不报错），保持纯本地行为。只有 uuid（数据库 id）才尝试写库。
 *   · 菜品换图目前是 base64，写进 text 列会让库迅速膨胀；超过阈值的 data URL 不上云
 *     （判为 false，保持本机可见），等第 4 期图片走 Supabase Storage 再一起解决。
 */
import { supabase } from '@/lib/supabase'
import type { IShopActivity } from './shop-status'

/** 是否是数据库 uuid 主键（内置演示数据的 '1' / 'act_xx' 之类都不是） */
export function isUuid(v: string | undefined | null): boolean {
  if (!v) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/** base64 图片写库的上限（约 700KB 的字符串），超过就只留本机 */
const MAX_REMOTE_IMAGE_LEN = 700_000

/** 菜品配置补丁：字段名与 useShopStatus 的本地覆盖层保持一致 */
export interface DishConfigPatch {
  name?: string
  description?: string
  price?: number
  image?: string
  stock?: number
  soldOut?: boolean
  onShelf?: boolean
}

/** 本地覆盖字段 → 数据库列名（未列出的字段（specs/extras/categoryId/sales）不上云） */
const DISH_FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  description: 'description',
  price: 'price',
  image: 'image_url',
  stock: 'stock',
  soldOut: 'sold_out',
  onShelf: 'on_shelf',
}

/** 把本地补丁翻译成数据库行；不认识的字段忽略，undefined 不下发 */
function dishPatchToRow(patch: DishConfigPatch): Record<string, unknown> | null {
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    const column = DISH_FIELD_TO_COLUMN[key]
    if (!column || value === undefined) continue
    if (key === 'image' && typeof value === 'string' && value.startsWith('data:') && value.length > MAX_REMOTE_IMAGE_LEN) {
      // 大图只留本机，避免把 base64 灌进数据库（第 4 期改 Storage 后放开）
      return null
    }
    row[column] = value
  }
  return Object.keys(row).length > 0 ? row : null
}

/** 本地覆盖里「能上云」的字段名，写库成功后调用方可用它清理本地覆盖 */
export function remoteWritableDishKeys(patch: DishConfigPatch): string[] {
  return Object.keys(patch).filter(
    k => k in DISH_FIELD_TO_COLUMN && (patch as Record<string, unknown>)[k] !== undefined,
  )
}

/**
 * 更新菜品配置（上下架 / 售罄 / 价格 / 库存 / 名称 / 描述 / 图片）。
 * 返回是否真的写进了数据库（未登录、非店主、非 uuid 都返回 false）。
 */
export async function updateDishRemote(dishId: string, patch: DishConfigPatch): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(dishId)) return false
  const row = dishPatchToRow(patch)
  if (!row) return false
  try {
    // .select('id') 回读：RLS 拒绝时 rows 为空而不是报错，必须靠它判断真实结果
    const res = await sb.from('dishes').update(row).eq('id', dishId).select('id')
    if (res.error) {
      console.warn('[shop-config] 更新菜品失败', res.error.message)
      return false
    }
    return (res.data?.length ?? 0) > 0
  } catch (err) {
    console.warn('[shop-config] 更新菜品异常', err)
    return false
  }
}

/** 更新店铺基础信息（营业开关 / 公告 / 营业时间 / 起送价 / 配送费） */
export interface ShopConfigPatch {
  isOpen?: boolean
  announcement?: string
  businessHours?: string
  minOrder?: number
  deliveryFee?: number
}

const SHOP_FIELD_TO_COLUMN: Record<string, string> = {
  isOpen: 'is_open',
  announcement: 'announcement',
  businessHours: 'business_hours',
  minOrder: 'min_order',
  deliveryFee: 'delivery_fee',
}

export async function updateShopRemote(shopId: string, patch: ShopConfigPatch): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(shopId)) return false
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    const column = SHOP_FIELD_TO_COLUMN[key]
    if (column && value !== undefined) row[column] = value
  }
  if (Object.keys(row).length === 0) return false
  try {
    const res = await sb.from('shops').update(row).eq('id', shopId).select('id')
    if (res.error) {
      console.warn('[shop-config] 更新店铺失败', res.error.message)
      return false
    }
    return (res.data?.length ?? 0) > 0
  } catch (err) {
    console.warn('[shop-config] 更新店铺异常', err)
    return false
  }
}

/** 前端活动 → shop_activities 行（不含 id / shop_id，由调用方按需补） */
/**
 * 写活动时的入参：新增时没有 id（数据库生成 uuid），编辑/启停时带上 uuid。
 * 不能直接用 IShopActivity，因为它要求 id 必填。
 */
export type ActivityPayload = Omit<IShopActivity, 'createdAt' | 'id'> & { id?: string }

function activityToRow(a: ActivityPayload) {
  return {
    type: a.type,
    name: a.name ?? '',
    description: a.description ?? '',
    active: a.active !== false,
    thresholds: a.thresholds ?? [],
    discounts: a.discounts ?? [],
    new_user_amount: a.newUserAmount ?? null,
    discount_rate: a.discountRate ?? null,
    // dish_id 是 uuid 列：折扣菜指向本地内置菜品时写 null，避免类型错误
    dish_id: isUuid(a.dishId) ? a.dishId : null,
    dish_discount_rate: a.dishDiscountRate ?? null,
    free_delivery_min: a.freeDeliveryMin ?? null,
  }
}

/**
 * 新增 / 更新营销活动。
 * 返回数据库里的活动 id（uuid）：新增成功返回新 id，更新成功返回原 id，失败返回 null。
 * 刻意不用 .upsert()：ON CONFLICT 的更新分支在 RLS 下会被拒（见 orders-remote 注释）。
 */
export async function saveActivityRemote(
  shopId: string,
  activity: ActivityPayload,
): Promise<string | null> {
  const sb = supabase
  if (!sb || !isUuid(shopId)) return null
  const row = activityToRow(activity)
  try {
    if (isUuid(activity.id)) {
      const res = await sb.from('shop_activities').update(row).eq('id', activity.id).select('id')
      if (res.error || (res.data?.length ?? 0) === 0) {
        console.warn('[shop-config] 更新活动失败或没有权限', res.error?.message)
        return null
      }
      return activity.id as string
    }
    const res = await sb.from('shop_activities').insert({ shop_id: shopId, ...row }).select('id')
    if (res.error || !res.data?.[0]?.id) {
      console.warn('[shop-config] 新增活动失败', res.error?.message)
      return null
    }
    return res.data[0].id as string
  } catch (err) {
    console.warn('[shop-config] 保存活动异常', err)
    return null
  }
}

/** 启停活动 */
export async function setActivityActiveRemote(activityId: string, active: boolean): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(activityId)) return false
  try {
    const res = await sb.from('shop_activities').update({ active }).eq('id', activityId).select('id')
    if (res.error) {
      console.warn('[shop-config] 启停活动失败', res.error.message)
      return false
    }
    return (res.data?.length ?? 0) > 0
  } catch (err) {
    console.warn('[shop-config] 启停活动异常', err)
    return false
  }
}

/** 删除活动 */
export async function deleteActivityRemote(activityId: string): Promise<boolean> {
  const sb = supabase
  if (!sb || !isUuid(activityId)) return false
  try {
    const res = await sb.from('shop_activities').delete().eq('id', activityId).select('id')
    if (res.error) {
      console.warn('[shop-config] 删除活动失败', res.error.message)
      return false
    }
    return (res.data?.length ?? 0) > 0
  } catch (err) {
    console.warn('[shop-config] 删除活动异常', err)
    return false
  }
}

/**
 * 新增菜品（写进商家自己的店铺）。
 * 返回数据库生成的 uuid；失败返回 null（调用方保留原来的本机自定义菜品行为）。
 */
export async function createDishRemote(input: {
  shopId: string
  categoryId?: string
  name: string
  description: string
  price: number
  image?: string
}): Promise<string | null> {
  const sb = supabase
  if (!sb || !isUuid(input.shopId)) return null
  try {
    const row: Record<string, unknown> = {
      shop_id: input.shopId,
      // 分类必须是 uuid；自定义分类还没上云时归到「无分类」，避免类型报错
      category_id: isUuid(input.categoryId) ? input.categoryId : null,
      name: input.name,
      description: input.description ?? '',
      price: input.price,
      image_url: input.image && input.image.length <= MAX_REMOTE_IMAGE_LEN ? input.image : null,
      stock: -1,
      sold_out: false,
      on_shelf: true,
    }
    const res = await sb.from('dishes').insert(row).select('id')
    if (res.error || !res.data?.[0]?.id) {
      console.warn('[shop-config] 新增菜品失败', res.error?.message)
      return null
    }
    return res.data[0].id as string
  } catch (err) {
    console.warn('[shop-config] 新增菜品异常', err)
    return null
  }
}
