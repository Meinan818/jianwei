import { useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { isTabRoot, getParentPath, TAB_ROOTS } from '@/data/navigation'
import type { UserRole } from '@/data/auth'

/**
 * 导航系统 —— 以浏览器真实 history 为唯一事实来源。
 *
 * 核心原则：
 * 1. 前进到任何二级页一律真实 push，history 栈记录完整路径。
 * 2. 底部 Tab 之间切换用 replace（Tab 互为兄弟，不互相入栈）。
 * 3. 登录成功 / 退出登录 / 跨端进入 / 支付成功 这类"不允许返回回去"的跳转用 replace。
 * 4. 左上角返回箭头 = window.history.back()，与物理返回键行为完全一致。
 * 5. 物理返回键（popstate）：
 *    - 二级页完全交给浏览器原生 history，逐页原路返回，不拦截。
 *    - 只在"当前端 Tab 根页"拦截：第一次按提示"再按一次退出应用"，
 *      并 history.forward() 阻止离开；2 秒内再按一次才允许退出。
 * 6. 深链/刷新落在二级页（history 栈为空无法回退）：兜底到该端对应 Tab 根。
 */

const EXIT_GAP_MS = 2000

let lastExitPress = 0

/**
 * 顶层 hook：挂在 App 层，全局唯一。
 * 负责：监听 popstate、在 Tab 根页时拦截双击退出。
 */
export function useNavigationStack() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // popstate 触发时已经退了一格，我们需要判断：
  // - 如果退到 Tab 根页 → 正常，不处理
  // - 如果退到 Tab 根页之前（launcher 页或应用外） → 拦截并提示
  const popTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handlePopState = () => {
      // popstate 已经回退了一格，等 React Router 同步完 location 再判断
      if (popTimerRef.current) window.clearTimeout(popTimerRef.current)
      popTimerRef.current = window.setTimeout(() => {
        handleBackPress()
      }, 0)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (popTimerRef.current) window.clearTimeout(popTimerRef.current)
    }
  }, [])

  function handleBackPress() {
    const path = window.location.pathname
    const role = user.role as UserRole

    // 在当前端的 Tab 根页：
    // - 如果 history.length > 2（还有历史），正常放行让浏览器自己退
    // - 如果 history.length <= 2（退到根就没了），拦截并提示双击退出
    if (isTabRoot(path, role)) {
      // Tab 根页按返回 → 要离开应用或回到 launcher，做双击退出
      const now = Date.now()
      if (now - lastExitPress < EXIT_GAP_MS) {
        lastExitPress = 0
        // 第二次按：允许退出
        try { window.close() } catch { /* ignore */ }
        return
      }
      lastExitPress = now
      toast('再按一次退出应用', { duration: 2000 })
      // 已经 pop 出去了一格，forward 回来
      window.history.forward()
      return
    }

    // 在启动选择器 / 登录页 / 其他非 Layout 根路径：
    // 不在任何端的 Tab 根里，且不是 launcher → 不处理，让浏览器自己退
    // （二级页完全交给原生 history 逐页返回）
  }

  return null
}

/**
 * 前进到二级页：真实 push 到 history 栈。
 */
export function useNavigatePush() {
  const navigate = useNavigate()

  return useCallback((path: string) => {
    navigate(path) // 默认就是 push
  }, [navigate])
}

/**
 * Tab 切换：replace + 不入历史栈。
 */
export function useNavigateTab() {
  const navigate = useNavigate()

  return useCallback((path: string) => {
    navigate(path, { replace: true })
  }, [navigate])
}

/**
 * 清栈式 replace（登录、退出、跨端跳转、支付成功等用）。
 */
export function useNavigateReplace() {
  const navigate = useNavigate()

  return useCallback((path: string) => {
    navigate(path, { replace: true })
  }, [navigate])
}

/**
 * 页面返回（左上返回箭头）：等价于浏览器 history.back()。
 * 兜底：如果 history 栈为空（深链直接进来的情况），回到该端 Tab 根。
 */
export function usePageBack() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  return useCallback(() => {
    const path = location.pathname
    const role = user.role as UserRole

    // Tab 根页不响应返回
    if (isTabRoot(path, role)) {
      return
    }

    // 正常情况：走浏览器原生 back
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    // 兜底：history 栈为空（深链/刷新直接落在二级页），回父级或 Tab 根
    const parent = getParentPath(path) ?? TAB_ROOTS[role][0]
    navigate(parent, { replace: true })
  }, [navigate, location.pathname, user.role])
}

/**
 * 跨端跳转 / 登录成功等需要彻底换基线的场景（replace）。
 * 保留函数名兼容旧调用。
 */
export function resetNavForRole(_role: UserRole) {
  // 新方案以 replace 跳转即切换基线，无需额外清栈操作
  // 保留函数避免 import 报错
}
