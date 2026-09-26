import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ShoppingBag, Megaphone, Settings, CheckCheck, RefreshCw, AlertTriangle } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TopNavBar from '@/components/TopNavBar'
import UnreadBadge from '@/components/UnreadBadge'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/hooks/useAuth'
import { usePageBack, useNavigatePush } from '@/hooks/useNavigationStack'
import { logger } from '@lark-apaas/client-toolkit-lite'
import type { NotificationCategory } from '@/data/messages'

const CATEGORIES: { value: 'all' | NotificationCategory; label: string; Icon: typeof Bell }[] = [
  { value: 'all', label: '全部', Icon: Bell },
  { value: 'order', label: '订单', Icon: ShoppingBag },
  { value: 'activity', label: '活动', Icon: Megaphone },
  { value: 'system', label: '系统', Icon: Settings },
]

export default function NotificationCenterPage() {
  return (
    <ErrorBoundary
      FallbackComponent={({ resetErrorBoundary }) => (
        <NotificationErrorFallback onRetry={resetErrorBoundary} />
      )}
      onError={(error) => {
        logger.error('NotificationCenterPage error:', String(error))
      }}
    >
      <NotificationCenterInner />
    </ErrorBoundary>
  )
}

function NotificationErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col w-full min-h-[420px] bg-background items-center justify-center gap-3 px-8 py-16">
      <div className="size-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground">通知加载失败</p>
      <p className="text-xs text-muted-foreground text-center">
        通知数据可能异常，点击重试可恢复正常
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        className="mt-2 gap-1.5"
      >
        <RefreshCw className="size-3.5" />
        点击重试
      </Button>
    </div>
  )
}

function NotificationCenterInner() {
  const pageBack = usePageBack()
  const navigatePush = useNavigatePush()
  const { user } = useAuth()
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications()
  const [activeTab, setActiveTab] = useState<'all' | NotificationCategory>('all')

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications
    return notifications.filter(n => n.category === activeTab)
  }, [notifications, activeTab])

  const unreadByCategory = useMemo(() => {
    return {
      all: notifications.filter(n => !n.read).length,
      order: notifications.filter(n => !n.read && n.category === 'order').length,
      activity: notifications.filter(n => !n.read && n.category === 'activity').length,
      system: notifications.filter(n => !n.read && n.category === 'system').length,
    }
  }, [notifications])

  const handleItemClick = (n: typeof notifications[0]) => {
    if (!n.read) markAsRead(n.id)
    if (n.actionUrl) {
      navigatePush(n.actionUrl)
    } else if (n.orderId) {
      if (user.role === 'merchant') {
        navigatePush('/merchant/orders')
      } else if (user.role === 'rider') {
        navigatePush('/rider/tasks')
      } else {
        navigatePush(`/customer/order/${n.orderId}/track`)
      }
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead(activeTab === 'all' ? undefined : activeTab)
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    const min = Math.floor(diff / 60000)
    if (min < 1) return '刚刚'
    if (min < 60) return `${min}分钟前`
    const hour = Math.floor(min / 60)
    if (hour < 24) return `${hour}小时前`
    const day = Math.floor(hour / 24)
    if (day < 7) return `${day}天前`
    return new Date(ts).toLocaleDateString()
  }

  const getCategoryLabel = (cat: NotificationCategory) => {
    switch (cat) {
      case 'order': return '订单通知'
      case 'activity': return '活动通知'
      case 'system': return '系统通知'
    }
  }

  return (
    <div className="flex flex-col min-h-[500px] bg-background">
      <TopNavBar
        title="消息通知"
        onBack={pageBack}
        rightContent={
          unreadCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={handleMarkAllRead}>
              <CheckCheck className="size-4 mr-1" />
              全部已读
            </Button>
          ) : undefined
        }
      />

      {/* 分类 Tab */}
      <div className="px-0 border-b border-border/40 bg-card/50 sticky top-12 z-20">
        <div className="flex">
          {CATEGORIES.map(cat => {
            const Icon = cat.Icon
            const isActive = activeTab === cat.value
            const count = unreadByCategory[cat.value]
            return (
              <button
                key={cat.value}
                onClick={() => setActiveTab(cat.value)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 relative transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Icon className="size-4" />
                  <span className="text-sm font-medium">{cat.label}</span>
                  {count > 0 && (
                    <UnreadBadge count={count} />
                  )}
                </div>
                {isActive && (
                  <motion.div
                    layoutId="notif-tab-indicator"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 px-6">
              <div className="size-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Bell className="size-10 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-foreground/60 mb-1">暂无通知</p>
              <p className="text-xs text-muted-foreground">有新消息会第一时间通知你</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.02, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleItemClick(n)}
                  className="px-4 py-3 bg-card/30 hover:bg-muted/30 cursor-pointer active:bg-muted/50 transition-colors relative"
                >
                  {!n.read && (
                    <span className="absolute left-2 top-5 size-2 rounded-full bg-primary" />
                  )}
                  <div className="flex gap-3 pl-3">
                    <div className={`size-10 rounded-full shrink-0 flex items-center justify-center ${
                      n.category === 'order' ? 'bg-primary/10 text-primary' :
                      n.category === 'activity' ? 'bg-warning/15 text-warning-foreground' :
                      'bg-info/10 text-info'
                    }`}>
                      {n.category === 'order' && <ShoppingBag className="size-5" />}
                      {n.category === 'activity' && <Megaphone className="size-5" />}
                      {n.category === 'system' && <Settings className="size-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{n.title}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(n.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.content}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                          {getCategoryLabel(n.category)}
                        </Badge>
                        {n.actionUrl && (
                          <span className="text-[10px] text-primary">查看详情 ›</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}
