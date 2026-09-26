import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Zap, ClipboardList, Receipt, MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useNotifications } from '@/hooks/useNotifications'
import { useMessages } from '@/hooks/useMessages'
import UnreadBadge from '@/components/UnreadBadge'
import { useNavigateTab } from '@/hooks/useNavigationStack'

const TABS = [
  { path: '/rider', label: '首页', Icon: Home, end: true, badgeKey: '' as const },
  { path: '/rider/hall', label: '抢单', Icon: Zap, end: false, badgeKey: 'pool' as const },
  { path: '/rider/tasks', label: '任务', Icon: ClipboardList, end: false, badgeKey: 'active' as const },
  { path: '/rider/messages', label: '消息', Icon: MessageCircle, end: false, badgeKey: 'messages' as const },
  { path: '/rider/record', label: '记录', Icon: Receipt, end: false, badgeKey: '' as const },
]

export default function RiderTabBar() {
  const location = useLocation()
  const { user } = useAuth()
  const navigateTab = useNavigateTab()
  const { poolOrders, getRiderActiveOrders } = useOrders()
  const { unreadCount: notificationUnread } = useNotifications()
  const { totalUnread: imUnread } = useMessages()
  const riderId = user.riderId || 'R001'
  const activeOrders = getRiderActiveOrders(riderId)

  // 只在 tab 根页显示（record 等详细页不显示）
  const isTabRoot = TABS.some(t => t.end
    ? location.pathname === t.path || location.pathname === `${t.path}/`
    : location.pathname === t.path || location.pathname === `${t.path}/`)

  const showTab = location.pathname.startsWith('/rider')
    && location.pathname !== '/rider/login'
    && isTabRoot

  const getBadge = (key?: string) => {
    if (key === 'pool') return poolOrders.length
    if (key === 'active') return activeOrders.length
    if (key === 'messages') return imUnread + notificationUnread
    return 0
  }

  const isActive = (path: string, end: boolean) => {
    if (end) return location.pathname === path || location.pathname === path + '/'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  const handleTabClick = (path: string) => {
    if (isActive(path, TABS.find(t => t.path === path)?.end || false)) return
    navigateTab(path)
  }

  return (
    <AnimatePresence>
      {showTab && (
        <motion.nav
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex items-center justify-around h-14">
            {TABS.map(({ path, label, Icon, end, badgeKey }) => {
              const badge = getBadge(badgeKey)
              const active = isActive(path, end)
              return (
                <button
                  key={path}
                  onClick={() => handleTabClick(path)}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scale: active ? 1.1 : 1,
                      y: active ? -2 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex flex-col items-center gap-0.5 relative"
                  >
                    <div className="relative">
                      <Icon
                        className={`size-5 transition-colors ${
                          active ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      />
                      <UnreadBadge count={badge} className="absolute -top-1.5 -right-2" />
                    </div>
                    <span
                      className={`text-[10px] transition-colors ${
                        active ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                    </span>
                  </motion.div>
                </button>
              )
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
