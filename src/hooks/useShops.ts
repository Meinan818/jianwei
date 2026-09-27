/**
 * 店铺数据 hook（第 2 期）
 *
 * 数据来源优先级：数据库（登录后加载）→ 内置演示店铺。
 * 登录后自动触发一次加载；加载完成会触发 SHOPS_CHANGE_EVENT，
 * 本 hook 订阅后重渲染，并把 dataVersion 交给调用方做派生状态的依赖。
 *
 * 用法：把原来直接调用 getAllShops() 的地方改成 const { shops } = useShops()，
 * 若有 useState 缓存了派生列表，把 dataVersion 加进那个 effect 的依赖里。
 *
 * 第 2 期 2h：再叠一层 Realtime 订阅——商家在商家端改了菜品/店铺/活动，
 * 顾客端不刷新就能拿到新数据（未配置 Supabase / 未登录时订阅是空操作）。
 */
import { useEffect, useState } from 'react'
import { SHOPS_CHANGE_EVENT, getAllShops, type IShop } from '@/data/shops'
import { ensureShopsLoaded, reloadShops } from '@/data/shops-remote'
import { registerRealtimeRefresh } from '@/data/realtime'
import { useAuth } from '@/hooks/useAuth'

export function useShops(): { shops: IShop[]; dataVersion: number } {
  const { isLoggedIn } = useAuth()
  const [dataVersion, setDataVersion] = useState(0)

  useEffect(() => {
    const onChange = () => setDataVersion(v => v + 1)
    window.addEventListener(SHOPS_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(SHOPS_CHANGE_EVENT, onChange)
  }, [])

  useEffect(() => {
    // 没登录时读不到（RLS 只允许 authenticated 读店铺），登录后再拉
    if (isLoggedIn) void ensureShopsLoaded()
  }, [isLoggedIn])

  // 第 3 期 / 2h：数据库里店铺配置有变化时立即重拉（多个页面同时注册也无妨，
  // reloadShops 内部会合并成同一个请求）
  useEffect(() => {
    if (!isLoggedIn) return
    return registerRealtimeRefresh('shops', () => reloadShops())
  }, [isLoggedIn])

  return { shops: getAllShops(), dataVersion }
}
