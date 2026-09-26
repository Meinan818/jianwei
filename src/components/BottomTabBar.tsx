import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Receipt, MessageCircle, User } from 'lucide-react'
import { useNavigateTab } from '@/hooks/useNavigationStack'
import { useOrders } from '@/hooks/useOrders'
import { useNotifications } from '@/hooks/useNotifications'
import { useMessages } from '@/hooks/useMessages'
import UnreadBadge from '@/components/UnreadBadge'

const TABS = [
  { path: '/customer', label: '首页', Icon: Home, end: true, badgeKey: '' },
  { path: '/customer/orders', label: '订单', Icon: Receipt, end: false, badgeKey: 'ongoing' },
  { path: '/customer/messages', label: '消息', Icon: MessageCircle, end: false, badgeKey: 'messages' },
  { path: '/customer/profile', label: '我的', Icon: User, end: false, badgeKey: '' },
]

export default function BottomTabBar() {
  const location = useLocation()
  const navigateTab = useNavigateTab()
  const { ongoingOrders } = useOrders()
  const { unreadCount: notificationUnread } = useNotifications()
  const { totalUnread: imUnread } = useMessages()
  const showTab = TABS.some(t => t.end ? location.pathname === t.path : location.pathname.startsWith(t.path))

  const getBadge = (key?: string) => {
    if (key === 'ongoing') return ongoingOrders.length
    if (key === 'messages') return imUnread + notificationUnread
    return 0
  }

  const isActive = (path: string, end: boolean) => {
    if (end) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  const handleTabClick = (path: string) => {
    if (isActive(path, TABS.find(t => t.path === path)?.end || false)) return
    navigateTab(path)
  }

  return (
    <motion.nav
      animate={{
        y: showTab ? 0 : 80,
        opacity: showTab ? 1 : 0,
        pointerEvents: showTab ? 'auto' : 'none',
      }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
  )
}
