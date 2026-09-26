import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getPathRole } from '@/data/navigation'
import { getRoleHomePath } from '@/hooks/useAuth'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 404 兜底页：自动识别当前端并跳回对应首页，避免用户停留在空白 404。
 * - 顾客端未知路径 → /customer
 * - 商家端未知路径 → /merchant
 * - 骑手端未知路径 → /rider
 * - 其他（根域乱输）→ / （启动选择器）
 */
export default function NotFoundPage() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const role = getPathRole(location.pathname)
    // 顾客端但路径不在顾客端路由内 → 回顾客首页
    if (role === 'customer' && location.pathname !== '/' && !location.pathname.startsWith('/customer')) {
      // 路径像顾客端但没前缀，也回顾客首页
    }
    const homePath = getRoleHomePath(role)
    // 延迟一帧让用户看到 404 再跳转，避免闪屏
    const timer = setTimeout(() => {
      navigate(homePath, { replace: true })
    }, 1500)
    return () => clearTimeout(timer)
  }, [location.pathname, navigate])

  const role = getPathRole(location.pathname)
  const homePath = role === 'customer' ? '/customer' : role === 'merchant' ? '/merchant' : '/rider'

  const handleGoHome = () => {
    navigate(homePath, { replace: true })
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <h1 className="text-6xl font-bold mb-4 tracking-tight">404</h1>
      <p className="text-lg text-muted-foreground mb-2">页面不存在或已下线</p>
      <p className="text-xs text-muted-foreground mb-8">正在为您返回首页...</p>
      <Button onClick={handleGoHome} className="gap-2">
        <Home className="size-4" />
        返回首页
      </Button>
    </div>
  )
}
