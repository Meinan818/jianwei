/**
 * 第 2 期 2d：地址读写数据库（Supabase）
 *
 * 设计思路（与 2a/2b/2c 一致，尽量少动现有逻辑）：
 *   useAddresses 保持同步返回本地列表（CheckoutPage / ProfilePage 零改动），
 *   数据库操作封装在本模块：
 *     · 登录后拉一遍（RLS addresses_owner 只允许读写本人地址）
 *     · 新增 / 删除 / 更新按行直接写库——地址是离散的小操作，
 *       不需要订单那种「整列表镜像 + 基线比对」的写回层。
 *   未配置 Supabase / 未登录 / 读写失败时静默退回原来的 localStorage 行为，不会白屏。
 *
 * 三个必须知道的约束：
 *   1. addresses.id 是 uuid，新地址用 crypto.randomUUID()（与订单 id 同规则）。
 *   2. 数据库有「每账号至多一个默认地址」的部分唯一索引 addresses_one_default，
 *      设默认必须先把其他地址的默认清掉、再写新默认，顺序不能反。
 *   3. 刻意不用 .upsert()：RLS 下 ON CONFLICT 的更新分支会被拒（见 orders-remote 注释）。
 *   4. 登录后数据库为空是正常初始状态（seed 不预置地址），地址由用户真实添加；
 *      内置 MOCK_ADDRESSES 只在未登录 / 无数据库时兜底展示，不写库。
 */
import { supabase } from '@/lib/supabase'
import type { IAddress, AddressTag } from './address'

const TAGS: AddressTag[] = ['home', 'company', 'school', 'none']

/** 数据库行 → 前端 IAddress（防御式：tag 非法值兜底为 none） */
export function rowToAddress(row: Record<string, any>): IAddress {
  const tag = TAGS.includes(row.tag) ? (row.tag as AddressTag) : 'none'
  return {
    id: row.id,
    name: row.name ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    detail: row.detail ?? '',
    isDefault: Boolean(row.is_default),
    tag,
  }
}

/** 前端 IAddress → 数据库行（不含 customer_id，由调用方补） */
function addressToRow(a: IAddress) {
  return {
    name: a.name,
    phone: a.phone,
    address: a.address,
    detail: a.detail ?? '',
    tag: a.tag ?? 'none',
    is_default: Boolean(a.isDefault),
  }
}

/** 读取当前登录顾客的全部地址（RLS 自动限定本人），失败返回 null 走本地兜底 */
export async function fetchMyAddresses(): Promise<IAddress[] | null> {
  const sb = supabase
  if (!sb) return null
  const { data, error } = await sb
    .from('addresses')
    .select('*')
    .order('created_at', { ascending: true })
  if (error || !data) {
    console.warn('[addresses] 读取地址失败', error)
    return null
  }
  return data.map(rowToAddress)
}

/** 新增地址（新建的是 uuid，正常不会冲突；23505 时退化为更新，防御脏数据） */
export async function insertAddress(addr: IAddress, customerId: string): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  try {
    const row = { id: addr.id, customer_id: customerId, ...addressToRow(addr) }
    const ins = await sb.from('addresses').insert(row)
    if (ins.error) {
      if (ins.error.code === '23505') {
        const upd = await sb.from('addresses').update(addressToRow(addr)).eq('id', addr.id)
        if (!upd.error) return true
        console.warn('[addresses] 更新地址失败', addr.id, upd.error.message)
        return false
      }
      console.warn('[addresses] 写入地址失败', addr.id, ins.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[addresses] 写入地址异常', err)
    return false
  }
}

/** 更新地址的可见字段（不改 id / customer_id） */
export async function updateAddressRow(addr: IAddress): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  try {
    const upd = await sb.from('addresses').update(addressToRow(addr)).eq('id', addr.id)
    if (upd.error) {
      console.warn('[addresses] 更新地址失败', addr.id, upd.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[addresses] 更新地址异常', err)
    return false
  }
}

/** 删除地址 */
export async function deleteAddressRow(id: string): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  try {
    const del = await sb.from('addresses').delete().eq('id', id)
    if (del.error) {
      console.warn('[addresses] 删除地址失败', id, del.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[addresses] 删除地址异常', err)
    return false
  }
}

/**
 * 清掉除 exceptId 外的所有默认地址（设默认前必须先调用，见文件头约束 2）。
 * RLS 已把范围限定在本人地址，无需（也不应）指定 customer_id。
 */
export async function clearOtherDefaults(exceptId: string): Promise<boolean> {
  const sb = supabase
  if (!sb) return false
  try {
    const upd = await sb
      .from('addresses')
      .update({ is_default: false })
      .eq('is_default', true)
      .neq('id', exceptId)
    if (upd.error) {
      console.warn('[addresses] 清除旧默认地址失败', upd.error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[addresses] 清除旧默认地址异常', err)
    return false
  }
}
