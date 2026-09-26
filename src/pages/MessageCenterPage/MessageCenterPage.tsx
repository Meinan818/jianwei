import { useState, useRef, useCallback } from 'react'
import { Bell, ChevronRight, MessageCircle, Trash2, RefreshCw } from 'lucide-react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { ErrorBoundary } from 'react-error-boundary'
import { toast } from 'sonner'
import { useNavigatePush } from '@/hooks/useNavigationStack'
import { useMessages, getPeerInfo } from '@/hooks/useMessages'
import { useNotifications } from '@/hooks/useNotifications'
import UnreadBadge from '@/components/UnreadBadge'
import type { IConversation } from '@/data/messages'
import { formatRelativeTime } from '@/lib/utils'
import { Image } from '@/components/ui/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { logger } from '@lark-apaas/client-toolkit-lite'

interface MessageCenterProps {
  role: 'customer' | 'merchant' | 'rider'
}

// 三端空状态文案
const EMPTY_COPY = {
  customer: {
    title: '还没有消息',
    tip: '商家通知、骑手消息都在这里',
  },
  merchant: {
    title: '还没有消息',
    tip: '顾客咨询、骑手沟通都在这里',
  },
  rider: {
    title: '还没有消息',
    tip: '配送提醒、商家沟通都在这里',
  },
}

// 通知副文案
const NOTIFICATION_SUBTITLE = {
  customer: '系统通知、订单状态、活动福利',
  merchant: '新订单、营业通知、活动消息',
  rider: '新派单、配送提醒、系统公告',
}

export default function MessageCenterPage({ role }: MessageCenterProps) {
  return (
    <ErrorBoundary
      FallbackComponent={({ resetErrorBoundary }) => (
        <MessageErrorFallback onRetry={resetErrorBoundary} />
      )}
      onError={(error) => {
        logger.error('MessageCenterPage error:', String(error))
      }}
    >
      <MessageCenterInner role={role} />
    </ErrorBoundary>
  )
}

function MessageErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col w-full min-h-[420px] bg-background items-center justify-center gap-3 px-8 py-16">
      <div className="size-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <MessageCircle className="size-6 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground">消息加载失败</p>
      <p className="text-xs text-muted-foreground text-center">
        消息数据可能损坏，点击重试可恢复正常
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

function MessageCenterInner({ role }: MessageCenterProps) {
  const { myConversations, getPeerInfo, totalUnread, deleteConversation, myRole } = useMessages()
  const { unreadCount: notificationUnread } = useNotifications()
  const navigatePush = useNavigatePush()

  const totalBadge = totalUnread + notificationUnread
  const copy = EMPTY_COPY[role]
  const notifSubtitle = NOTIFICATION_SUBTITLE[role]

  const handleGoNotifications = () => {
    navigatePush(`/${role}/notifications`)
  }

  const handleGoChat = (conv: IConversation) => {
    const peer = getPeerInfo(conv)
    const params = new URLSearchParams()
    params.set('conversationId', conv.id)
    params.set('peerRole', peer.role)
    params.set('peerName', peer.name)
    navigatePush(`/chat?${params.toString()}`)
  }

  const handleDelete = useCallback((convId: string, peerName: string) => {
    deleteConversation(convId)
    toast(`已删除与「${peerName}」的会话`)
  }, [deleteConversation])

  return (
    <div className="flex flex-col min-h-[500px] bg-background">
      {/* 顶部标题 */}
      <div className="flex items-center h-12 px-4 flex-shrink-0 bg-card/50 border-b border-border/40">
        <h1 className="text-lg font-semibold text-foreground">消息</h1>
        {totalBadge > 0 && (
          <UnreadBadge count={totalBadge} className="ml-2" />
        )}
      </div>

      {/* 列表区 */}
      <div className="flex-1 overflow-y-auto">
        {/* 官方通知入口（与会话行同视觉节奏） */}
        <button
          onClick={handleGoNotifications}
          className="w-full flex items-center gap-3 px-4 py-3 bg-card/50 border-b border-border/40 active:bg-accent/50 transition-colors text-left"
        >
          <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground truncate">官方通知</span>
              <UnreadBadge count={notificationUnread} />
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {notifSubtitle}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </button>

         {/* 会话列表 */}
        {myConversations.length === 0 ? (
          <EmptyState copy={copy} />
        ) : (
          <div className="divide-y divide-border/40">
            {myConversations.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i, 6) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              >
                <SwipeableConversationRow
                  conv={conv}
                  peer={getPeerInfo(conv)}
                  onClick={() => handleGoChat(conv)}
                  onDelete={() => handleDelete(conv.id, getPeerInfo(conv).name)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 空态 ============
function EmptyState({ copy }: { copy: { title: string; tip: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8">
      <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <MessageCircle className="size-8 text-muted-foreground/60" />
      </div>
      <p className="text-base font-medium text-foreground">{copy.title}</p>
      <p className="text-xs text-muted-foreground mt-1 text-center">{copy.tip}</p>
    </div>
  )
}

// ============ 可左滑删除的会话行 ============
const SWIPE_THRESHOLD = 72

interface SwipeableRowProps {
  conv: IConversation
  peer: ReturnType<typeof getPeerInfo>
  onClick: () => void
  onDelete: () => void
}

function SwipeableConversationRow({ conv, peer, onClick, onDelete }: SwipeableRowProps) {
  const [showDelete, setShowDelete] = useState(false)
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD + 20], [1, 0])
  const contentRef = useRef<HTMLDivElement>(null)

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD / 2) {
      setShowDelete(true)
    } else {
      setShowDelete(false)
    }
  }, [])

  const handleContentClick = () => {
    if (showDelete) {
      setShowDelete(false)
      return
    }
    onClick()
  }

  const initial = peer.avatar ? '' : peer.name.charAt(0) || '?'
  // 未读数按「我自己的角色」取字段，跟 totalUnread 口径一致
  const { myRole } = useMessages()
  const unreadField =
    myRole === 'customer' ? conv.unreadCustomer :
    myRole === 'merchant' ? conv.unreadMerchant :
    conv.unreadRider
  const unread = unreadField ?? 0

  // 会话类型标签：订单 vs 咨询（防御：conv.id 可能为空串）
  const safeId = conv.id || ''
  const convType = conv.convType || (safeId.startsWith('shop:') ? 'shop' : 'order')
  const typeLabel = convType === 'shop' ? '咨询' : '订单'

  // 系统消息预览加前缀
  const preview = conv.lastMessage || '暂无消息'

  return (
    <div className="relative overflow-hidden bg-card/30">
      {/* 底部删除按钮 */}
      <motion.button
        style={{ opacity: deleteOpacity }}
        onClick={onDelete}
        className="absolute right-0 top-0 bottom-0 w-16 bg-destructive text-white flex items-center justify-center z-0"
        aria-label="删除会话"
      >
        <Trash2 className="size-5" />
      </motion.button>

      {/* 内容层 */}
      <motion.div
        ref={contentRef}
        drag="x"
        dragConstraints={{ left: -SWIPE_THRESHOLD, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        animate={{ x: showDelete ? -SWIPE_THRESHOLD : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={handleContentClick}
        className="relative z-10 bg-card/30 active:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* 头像 */}
          <div className="relative shrink-0">
            {peer.avatar ? (
              <Image
                src={peer.avatar}
                alt={peer.name}
                className="size-11 rounded-full object-cover bg-muted"
              />
            ) : (
              <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                {initial}
              </div>
            )}
            {unread > 0 && (
              <UnreadBadge
                count={unread}
                className="absolute -top-1 -right-1 z-10"
              />
            )}
          </div>

          {/* 文字信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {peer.name}
                </span>
                {typeLabel && (
                  <Badge
                    variant={convType === 'order' ? 'default' : 'secondary'}
                    className="shrink-0 px-1.5 py-0 text-[10px] font-normal rounded-sm"
                  >
                    {typeLabel}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                {conv.lastMessageAt ? formatRelativeTime(conv.lastMessageAt) : ''}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {preview}
            </p>
            <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
              {peer.sub}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
