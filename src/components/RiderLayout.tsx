import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import RiderTabBar from '@/components/RiderTabBar'
import PageErrorBoundary from '@/components/PageErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

/**
 * 骑手端布局（完全独立App）：
 * - 未登录 → 跳启动选择器
 * - 身份不对 → 跳启动选择器，杜绝串号
 * 端内绝不出现其他端的页面或跳转入口。
 */
export function RiderLayout() {
  const location = useLocation()
  const { isLoggedIn, user } = useAuth()

  // 未登录或身份不对 → 启动选择器（三端独立，杜绝串号）
  if (!isLoggedIn || user.role !== 'rider') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col h-screen min-h-[640px] bg-background overflow-hidden">
      <MotionConfig reducedMotion="user">
        <main className="flex-[1_1_0%] min-h-0 overflow-y-auto w-full">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </MotionConfig>
      <RiderTabBar />
    </div>
  )
}
