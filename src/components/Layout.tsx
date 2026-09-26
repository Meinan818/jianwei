import { Outlet, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import BottomTabBar from '@/components/BottomTabBar'
import PageErrorBoundary from '@/components/PageErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

/**
 * 顾客端布局：所有身份都可浏览顾客端页面。
 * - 未登录（游客）：正常浏览，部分功能（下单、地址等）会单独弹登录
 * - 顾客身份：正常使用
 * - 商家/骑手身份：以顾客视角浏览点餐页，个人中心显示对应工作台返回入口
 *
 * 动画策略（防抽搐）：
 * - Layout 层不再做路由级 AnimatePresence，避免 mode="wait" 导致的子树整体卸载重建 + 白帧
 * - Tab 切换由 Tab 组件自身做即时呈现（无淡入淡出）
 * - 页面 push/pop 动效由 useNavigationStack 在页面层控制（220ms / 180ms）
 */
export function Layout() {
  const location = useLocation()
  const { user } = useAuth()

  return (
    <div className="flex flex-col h-screen min-h-[640px] bg-background overflow-hidden">
      <MotionConfig reducedMotion="user">
        <main className="flex-[1_1_0%] min-h-0 overflow-y-auto w-full">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </MotionConfig>
      <BottomTabBar />
    </div>
  )
}
