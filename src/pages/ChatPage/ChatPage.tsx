import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Phone, Star, ShoppingBag, RefreshCw, MessageCircle } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { Button } from '@/components/ui/button'
import { Image } from '@/components/ui/image'
import { useMessages, getConversationId, getPeerInfo } from '@/hooks/useMessages'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { getAllShops } from '@/data/shops'
import { QUICK_PHRASES } from '@/data/messages'
import { usePageBack, useNavigatePush } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import { formatChatTime } from '@/lib/utils'
import { logger } from '@lark-apaas/client-toolkit-lite'

/**
 * 聊天页（三端共用）
 *
 * 入参优先级：
 * 1. conversationId（推荐，直接定位会话，保证列表→聊天一一对应）
 * 2. 语义参数（type=shop+shopId 或 type=order+orderId+peerRole），自动生成 ID
 *
 * 只负责读消息、发消息，不允许创建新 ID 导致"空会话"——
 * 若会话不存在，显示空状态让用户发第一条消息时再创建。
 */
export default function ChatPage() {
  return (
    <ErrorBoundary
      FallbackComponent={({ resetErrorBoundary }) => (
        <ChatErrorFallback onRetry={resetErrorBoundary} />
      )}
      onError={(error) => {
        logger.error('ChatPage error:', String(error))
      }}
    >
      <ChatPageInner />
    </ErrorBoundary>
  )
}

function ChatErrorFallback({ onRetry }: { onRetry: () => void }) {
  const navigateBack = usePageBack()
  return (
    <div className="flex flex-col w-full min-h-[420px] bg-background items-center justify-center gap-3 px-8 py-16">
      <div className="size-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <MessageCircle className="size-6 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground">聊天加载失败</p>
      <p className="text-xs text-muted-foreground text-center">
        聊天数据可能损坏，点击重试可恢复
      </p>
      <div className="flex gap-2 mt-2">
        <Button variant="secondary" size="sm" onClick={navigateBack}>
          返回
        </Button>
        <Button size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="size-3.5" />
          重试
        </Button>
      </div>
    </div>
  )
}

function ChatPageInner() {
  const [searchParams] = useSearchParams()
  const navigatePush = useNavigatePush()
  const navigateBack = usePageBack()

  const { user } = useAuth()
  const { orders } = useOrders()
  const shops = getAllShops()
  const {
    getOrCreateConversation,
    getMessages,
    sendMessage,
    markConversationRead,
    myRole,
    me,
    getInitial,
    getConversationByConvId,
    getPeerInfo,
  } = useMessages()

  // ====== 解析参数，计算会话 ID ======
  const conversationId = useMemo(() => {
    const id = searchParams.get('conversationId')
    if (id) return id

    const type = searchParams.get('type')
    const orderId = searchParams.get('orderId')
    const shopId = searchParams.get('shopId')
    const peerRole = searchParams.get('peerRole') as 'merchant' | 'rider' | 'customer' | null

    if (type === 'shop' && shopId) {
      return getConversationId({ type: 'shop', shopId })
    }
    if (type === 'order' && orderId && peerRole) {
      // 从 myRole + peerRole 推导出会话类型
      const pair = [myRole, peerRole].sort().join('-')
      if (pair === 'customer-merchant') return getConversationId({ type: 'om', orderId })
      if (pair === 'customer-rider') return getConversationId({ type: 'or', orderId })
      if (pair === 'merchant-rider') return getConversationId({ type: 'rm', orderId })
    }
    return ''
  }, [searchParams, myRole])

  // ====== 对方信息（统一用 getPeerInfo，保证消息列表、聊天头部、气泡头像三处一致） ======
  const fullConv = conversationId ? getConversationByConvId(conversationId) : null

  // ====== 上下文条数据 ======
  const orderIdFromConv = conversationId.startsWith('om:') || conversationId.startsWith('or:') || conversationId.startsWith('rm:')
    ? conversationId.slice(3)
    : ''
  const shopIdFromConv = conversationId.startsWith('shop:') ? conversationId.slice(5) : ''

  const order = orders.find(o => o.id === orderIdFromConv)
  const shop = shops.find(s => s.id === (shopIdFromConv || order?.shopId))

  const peerInfo = useMemo(() => {
    if (fullConv) {
      const p = getPeerInfo(fullConv)
      return {
        name: p.name,
        avatar: p.avatar,
        role: p.role,
      }
    }
    // 会话尚未创建时，从 URL 参数 + 订单/店铺数据兜底推导
    const peerRole = (searchParams.get('peerRole') as 'merchant' | 'rider' | 'customer') ||
      (conversationId.startsWith('shop:') || conversationId.startsWith('om:') ? 'merchant' :
       conversationId.startsWith('or:') ? 'rider' : 'merchant')
    const peerNameParam = searchParams.get('peerName') || ''
    const peerAvatarParam = searchParams.get('peerAvatar') || ''
    if (peerRole === 'merchant') {
      return {
        name: peerNameParam || shop?.name || order?.shopName || '商家',
        avatar: peerAvatarParam || shop?.cover || order?.shopCover || '',
        role: 'merchant' as const,
      }
    }
    if (peerRole === 'rider') {
      return {
        name: peerNameParam || order?.riderName || '骑手',
        avatar: peerAvatarParam || '',
        role: 'rider' as const,
      }
    }
    return {
      name: peerNameParam || order?.address.name || '顾客',
      avatar: peerAvatarParam || '',
      role: 'customer' as const,
    }
  }, [fullConv, conversationId, searchParams, shop, order])

  const roleLabel = { customer: '顾客', merchant: '商家', rider: '骑手' }[peerInfo.role]

  // ====== 懒创建会话：只有发第一条消息时才创建 ======
  const messages = conversationId ? getMessages(conversationId) : []
  const convExists = messages.length > 0

  // 进入会话标记已读
  useEffect(() => {
    if (!conversationId || !convExists) return
    const timer = setTimeout(() => {
      markConversationRead(conversationId, myRole)
    }, 300)
    return () => clearTimeout(timer)
  }, [conversationId, convExists, markConversationRead, myRole])

  // ====== 发送消息 ======
  const [inputValue, setInputValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const ensureConversation = useCallback(() => {
    if (!conversationId) return null
    if (convExists) {
      // 会话已存在，直接返回
      // 这里需要从 state 中拿完整 conv 对象，用 conversations 找
      return { id: conversationId }
    }
    // 构造 meta 并创建会话
    const customerId = (myRole === 'customer' ? user.phone : order?.address.phone) || 'C001'
    const customerName = (myRole === 'customer' ? user.nickname : order?.address.name) || '顾客'
    const customerAvatar = myRole === 'customer' ? user.avatar : ''
    const merchantId = (myRole === 'merchant' ? user.shopId : shop?.id || order?.shopId) || '1'
    const merchantName = (myRole === 'merchant' ? user.shopName : shop?.name || order?.shopName) || '商家'
    const merchantAvatar = (myRole === 'merchant' ? user.avatar : shop?.cover || order?.shopCover) || ''
    const riderId = myRole === 'rider' ? user.riderId : order?.riderId
    const riderName = myRole === 'rider' ? user.nickname : order?.riderName
    const riderAvatar = ''

    const params = conversationId.startsWith('shop:')
      ? {
          type: 'shop' as const,
          shopId: shopIdFromConv,
          meta: { customerId, customerName, customerAvatar, merchantId, merchantName, merchantAvatar },
        }
      : conversationId.startsWith('om:')
      ? {
          type: 'om' as const,
          orderId: orderIdFromConv,
          meta: { customerId, customerName, customerAvatar, merchantId, merchantName, merchantAvatar, riderId, riderName, riderAvatar },
        }
      : conversationId.startsWith('or:')
      ? {
          type: 'or' as const,
          orderId: orderIdFromConv,
          meta: { customerId, customerName, customerAvatar, merchantId, merchantName, merchantAvatar, riderId, riderName, riderAvatar },
        }
      : {
          type: 'rm' as const,
          orderId: orderIdFromConv,
          meta: { customerId, customerName, customerAvatar, merchantId, merchantName, merchantAvatar, riderId, riderName, riderAvatar },
        }

    return getOrCreateConversation(params)
  }, [conversationId, convExists, myRole, user, order, shop, shopIdFromConv, orderIdFromConv, getOrCreateConversation])

  const handleSend = useCallback(() => {
    const content = inputValue.trim()
    if (!content) return
    if (!conversationId) return

    const conv = ensureConversation()
    if (!conv) return

    sendMessage(conversationId, content, {
      id: me.id,
      name: me.name,
      avatar: me.avatar,
      role: me.role,
    })
    setInputValue('')
  }, [inputValue, conversationId, ensureConversation, sendMessage, me])

  const handleQuickPhrase = useCallback((phrase: string) => {
    setInputValue(phrase)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleCall = () => {
    toast('演示功能，已预留真实通话接入点')
  }

  // 上下文条点击跳转
  const handleContextClick = () => {
    if (order && orderIdFromConv) {
      if (myRole === 'customer') {
        navigatePush(`/customer/order/${orderIdFromConv}/track`)
      } else if (myRole === 'merchant') {
        navigatePush(`/merchant/orders`)
      } else {
        navigatePush(`/rider/tasks`)
      }
    } else if (shop && shopIdFromConv) {
      if (myRole === 'customer') {
        navigatePush(`/customer/shop/${shopIdFromConv}`)
      } else if (myRole === 'merchant') {
        navigatePush(`/merchant/shop`)
      }
    }
  }

  // 快捷短语（按当前用户角色取，不是对方角色）
  const quickPhrases = QUICK_PHRASES[myRole as keyof typeof QUICK_PHRASES] || []

  // 5 分钟分组
  const groupedMessages = useMemo(() => {
    if (messages.length === 0) return []
    const groups: { time: number; items: typeof messages }[] = []
    let currentGroup: { time: number; items: typeof messages } | null = null

    for (const msg of messages) {
      if (!currentGroup || msg.createdAt - currentGroup.time > 5 * 60 * 1000) {
        currentGroup = { time: msg.createdAt, items: [msg] }
        groups.push(currentGroup)
      } else {
        currentGroup.items.push(msg)
      }
    }
    return groups
  }, [messages])

  // 滚动到底部
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  return (
    <div className="flex flex-col min-h-[500px] h-full bg-background">
      {/* 顶部导航栏 */}
      <div className="flex items-center h-12 px-2 bg-card border-b border-border/40 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          onClick={navigateBack}
          aria-label="返回"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 text-center min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {peerInfo.name}
          </div>
          <div className="text-[11px] text-muted-foreground">{roleLabel}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          onClick={handleCall}
          aria-label="电话"
        >
          <Phone className="size-5" />
        </Button>
      </div>

      {/* 上下文条 */}
      {(order || shop) && (
        <button
          onClick={handleContextClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border-b border-border/40 text-left active:bg-primary/10 transition-colors"
        >
          {order ? (
            <>
              <div className="size-8 rounded-md bg-card flex items-center justify-center shrink-0">
                <ShoppingBag className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {order.shopName}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  订单 · {order.id.slice(-6)} · ¥{order.finalAmount}
                </div>
              </div>
            </>
          ) : (
            shop && (
              <>
                <div className="size-8 rounded-md bg-card flex items-center justify-center shrink-0">
                  <Star className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {shop.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {shop.rating} 分 · 月售 {shop.monthSales}
                  </div>
                </div>
              </>
            )
          )}
        </button>
      )}

      {/* 消息区 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="size-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
              <Send className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground">开始聊天吧</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {groupedMessages.map((group, gi) => (
              <motion.div
                key={gi}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                {/* 时间分组标 */}
                <div className="flex justify-center">
                  <span className="text-[11px] text-muted-foreground/70 px-2 py-0.5">
                    {formatChatTime(group.time)}
                  </span>
                </div>

                {group.items.map(msg => {
                  const isSystem = msg.type === 'system'
                  const mine = msg.senderRole === me.role

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                          {msg.content}
                        </span>
                      </div>
                    )
                  }

                  const initial = getInitial(msg.senderName)

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className={`flex gap-2 items-end ${mine ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* 头像 */}
                      {msg.senderAvatar ? (
                        <Image
                          src={msg.senderAvatar}
                          alt={msg.senderName}
                          className="size-8 rounded-full overflow-hidden bg-muted shrink-0 object-cover"
                        />
                      ) : (
                        <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                          {initial}
                        </div>
                      )}
                      {/* 气泡 */}
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                          mine
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-card text-foreground rounded-bl-md border border-border/40'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* 快捷短语栏（无短语时不渲染） */}
      {quickPhrases.length > 0 && (
        <div className="px-3 py-2 bg-card/50 border-t border-border/40 flex gap-2 overflow-x-auto scrollbar-hide">
          {quickPhrases.map(phrase => (
            <button
              key={phrase}
              onClick={() => handleQuickPhrase(phrase)}
              className="shrink-0 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors"
            >
              {phrase}
            </button>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="px-3 py-2.5 bg-card border-t border-border/40 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            className="flex-1 px-4 py-2.5 bg-muted rounded-full text-sm outline-none focus:ring-2 focus:ring-ring/20"
          />
          <Button
            size="icon"
            className="size-10 rounded-full shrink-0"
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
