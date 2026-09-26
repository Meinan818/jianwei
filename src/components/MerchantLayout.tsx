import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import MerchantTabBar from '@/components/MerchantTabBar'
import PageErrorBoundary from '@/components/PageErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

/**
 * 商家端布局（完全独立App）：
 * - 未登录 → 跳启动选择器（/），用户从选择器重新进入
 * - 身份不对 → 跳启动选择器，杜绝串号
 * 端内绝不出现其他端的页面或跳转入口。
 */
export function MerchantLayout() {
  const location = useLocation()
  const { isLoggedIn, user } = useAuth()

  // 未登录或身份不对 → 启动选择器（三端独立，杜绝串号）
  if (!isLoggedIn || user.role !== 'merchant') {
    return <Navigate to="/" replace />
  }

  // 已登录商家但还没店铺 → 去建店向导（一账号一店铺）
  if (!user.shopId) {
    return <Navigate to="/merchant/create-shop" replace />
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
      <MerchantTabBar />
    </div>
  )
}
