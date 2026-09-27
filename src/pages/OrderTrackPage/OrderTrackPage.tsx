import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Clock, Bike, ChefHat, Package, Home, ChevronRight, Star, Tag, Ticket, Timer,
  Phone, MessageCircle, AlertCircle, ShoppingCart, RefreshCcw, Store, User, MapPin,
  Utensils, StickyNote, Gift, Truck,
} from 'lucide-react'
import TopNavBar from '@/components/TopNavBar'
import { useOrders } from '@/hooks/useOrders'
import { formatOrderNo } from '@/data/order'
import { useReviews } from '@/hooks/useReviews'
import { useCart } from '@/hooks/useCart'
import { useNavigatePush, usePageBack } from '@/hooks/useNavigationStack'
import { Image } from '@/components/ui/image'
import { toast } from 'sonner'
import ContactActionSheet from '@/components/ContactActionSheet'
import CallModal from '@/components/CallModal'
import UrgeModal from '@/components/UrgeModal'
import { useAuth } from '@/hooks/useAuth'
import { avatarImages } from '@lark-apaas/client-toolkit-lite'

// 6 节点完整时间线
const TIMELINE_NODES = [
  { status: 'pending', label: '已下单', Icon: Clock, desc: '等待商家接单' },
  { status: 'preparing', label: '商家接单', Icon: ChefHat, desc: '商家正在备餐' },
  { status: 'ready', label: '商家出餐', Icon: Package, desc: '餐品已备好，等待骑手取餐' },
  { status: 'picked', label: '骑手取餐', Icon: Bike, desc: '骑手已取餐，即将出发' },
  { status: 'delivering', label: '配送中', Icon: MapPin, desc: '骑手正在飞速为您配送' },
  { status: 'delivered', label: '已送达', Icon: Home, desc: '订单已送达，祝您用餐愉快' },
] as const

export default function OrderTrackPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigatePush = useNavigatePush()
  const pageBack = usePageBack()
  const { orders, advanceOrder, getOrder, customerCancel, urgeOrder, applyRefund } = useOrders()
  const { getReviewByOrder } = useReviews()
  const { addItem: addToCart } = useCart()
  const { user } = useAuth()
  const [showSuccess, setShowSuccess] = useState(params.get('from') === 'success')
  const [tick, setTick] = useState(0)

  // 联系相关
  const [contactSheetOpen, setContactSheetOpen] = useState(false)
  const [contactTarget, setContactTarget] = useState<'merchant' | 'rider'>('merchant')
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [urgeModalOpen, setUrgeModalOpen] = useState(false)
  const [urgeTick, setUrgeTick] = useState(0)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundDesc, setRefundDesc] = useState('')

  const order = getOrder(id || '')
  const urgeCooldownLeft = order?.lastUrgeAt
    ? Math.max(0, Math.ceil(60 - (Date.now() - order.lastUrgeAt) / 1000) - urgeTick)
    : 0

  // 每秒刷新倒计时
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [showSuccess])

  useEffect(() => {
    if (!urgeModalOpen && urgeCooldownLeft <= 0) return
    const timer = setInterval(() => setUrgeTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [urgeModalOpen, urgeCooldownLeft])

  // 所有派生状态（基于 order）—— 必须在 early return 之前定义以满足 hooks 规则
  const currentIdx = order ? TIMELINE_NODES.findIndex(s => s.status === order.status) : -1
  const isDelivered = order?.status === 'delivered'
  const hasRider = order && (order.status === 'picked' || order.status === 'delivering' || order.status === 'delivered')
  const showContactBar = order && !isDelivered && order.status !== 'cancelled' && order.status !== 'rejected'

  // 预计送达倒计时（秒）
  const deliveryCountdown = useMemo(() => {
    if (!order || isDelivered || order.status === 'cancelled' || order.status === 'rejected') return 0
    const match = order.estimatedTime?.match(/(\d+)/)
    if (!match) return 0
    const totalSec = parseInt(match[1]) * 60
    const elapsed = Math.floor((Date.now() - order.createdAt) / 1000)
    return Math.max(0, totalSec - elapsed)
  }, [order, tick, isDelivered])

  const countdownText = useMemo(() => {
    const m = Math.floor(deliveryCountdown / 60)
    const s = deliveryCountdown % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [deliveryCountdown])

  const estimatedDeliveryTime = useMemo(() => {
    if (!order) return '--:--'
    if (isDelivered && order.deliveredAt) {
      const d = new Date(order.deliveredAt)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    const match = order.estimatedTime?.match(/(\d+)/)
    if (match) {
      const maxMin = parseInt(match[1])
      const d = new Date(order.createdAt + maxMin * 60 * 1000)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return '--:--'
  }, [order, isDelivered])

  // 骑手在路线上的位置比例（0~1，0=商家，1=顾客）
  const riderRouteProgress = useMemo(() => {
    if (!order) return 0
    if (order.status === 'pending' || order.status === 'preparing' || order.status === 'ready') return 0
    if (order.status === 'picked') return 0.15
    if (order.status === 'delivering') return 0.55
    if (order.status === 'delivered') return 1
    return 0
  }, [order])

  if (!order) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <TopNavBar title="订单跟踪" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          订单不存在
        </div>
      </div>
    )
  }

  const handleAdvance = () => {
    if (isDelivered) return
    const result = advanceOrder(order.id)
    if (result) {
      toast.success('订单状态已更新')
    }
  }

  const handleCancel = () => {
    const result = customerCancel(order.id)
    if (result) {
      toast.success('订单已取消')
    }
  }

  const handleReorder = () => {
    if (!order) return
    order.items.forEach(item => {
      addToCart(
        order.shopId,
        order.shopName,
        { id: item.dishId, name: item.dishName, price: item.basePrice, image: item.image },
        { specs: item.specs, extras: item.extras, quantity: item.quantity },
      )
    })
    toast.success('已加入购物车，规格已回填')
    navigatePush(`/customer/shop/${order.shopId}`)
  }

  const refundReasons = ['配送超时', '餐品错送/漏送', '餐品质量问题', '骑手态度差', '不想吃了', '其他原因']
  const handleSubmitRefund = () => {
    if (!refundReason) {
      toast.info('请选择退款原因')
      return
    }
    const result = applyRefund(order.id, { reason: refundReason, description: refundDesc })
    if (result) {
      toast.success('退款申请已提交')
      setRefundOpen(false)
      setRefundReason('')
      setRefundDesc('')
    }
  }

  const canCancel = order.status === 'pending'
  const canRefund = !canCancel && order.status !== 'cancelled' && order.status !== 'rejected' && !order.refundRequest
  const canReorder = order.status === 'delivered' || order.status === 'cancelled' || order.status === 'rejected'

  const handleOpenContact = (target: 'merchant' | 'rider') => {
    setContactTarget(target)
    setContactSheetOpen(true)
  }

  const handleGoChat = () => {
    const peerRole = contactTarget
    const peerName = contactTarget === 'merchant' ? order.shopName : (order.riderName || '骑手')
    const peerAvatar = contactTarget === 'merchant' ? order.shopCover : ''
    navigatePush(`/chat?orderId=${order.id}&peerRole=${peerRole}&peerName=${encodeURIComponent(peerName)}&peerAvatar=${encodeURIComponent(peerAvatar)}&type=order`)
  }

  const handleCall = () => {
    setCallModalOpen(true)
  }

  const handleUrge = (reason: string) => {
    const ok = urgeOrder(order.id, reason)
    if (ok) {
      toast.success('已提醒商家，请耐心等待')
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopNavBar title="订单跟踪" />
      <div className="flex-1 overflow-y-auto pb-6">
        {/* 订单状态头部（带配送地图） */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary text-primary-foreground relative overflow-hidden"
        >
          {/* 配送地图 SVG */}
          <div className="relative h-52 w-full bg-gradient-to-b from-primary/60 via-primary to-orange-600">
            {/* 背景装饰：建筑剪影 */}
            <svg viewBox="0 0 400 180" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
              {/* 远景建筑 */}
              <g fill="rgba(255,255,255,0.08)">
                <rect x="20" y="80" width="30" height="100" />
                <rect x="55" y="60" width="25" height="120" />
                <rect x="85" y="90" width="40" height="90" />
                <rect x="130" y="50" width="35" height="130" />
                <rect x="170" y="75" width="28" height="105" />
                <rect x="203" y="55" width="45" height="125" />
                <rect x="253" y="85" width="30" height="95" />
                <rect x="288" y="65" width="38" height="115" />
                <rect x="331" y="80" width="28" height="100" />
                <rect x="364" y="70" width="30" height="110" />
              </g>
              {/* 道路 */}
              <g fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" strokeLinecap="round">
                <path d="M 0 140 Q 100 100 200 110 T 400 90" />
                <path d="M 60 0 L 80 180" strokeWidth="6" />
                <path d="M 280 0 L 295 180" strokeWidth="6" />
                <path d="M 180 180 L 170 0" strokeWidth="5" />
              </g>
              {/* 主配送路径（亮色） */}
              <path
                id="delivery-path"
                d="M 50 130 Q 120 80 200 95 T 360 85"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="4"
                strokeDasharray="6 6"
                strokeLinecap="round"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;24"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>

              {/* 商家标记 */}
              <g transform="translate(50, 130)">
                <circle r="14" fill="white" fillOpacity="0.25" />
                <circle r="10" fill="white" />
                <text x="0" y="3" textAnchor="middle" fontSize="10" fill="#f97316" fontWeight="bold">商</text>
              </g>

              {/* 顾客标记 */}
              <g transform="translate(360, 85)">
                <circle r="14" fill="white" fillOpacity="0.25" />
                <circle r="10" fill="white" />
                <text x="0" y="3" textAnchor="middle" fontSize="10" fill="#f97316" fontWeight="bold">家</text>
              </g>

              {/* 骑手动画（沿路径移动） */}
              {hasRider && !isDelivered && (
                <g>
                  {/* 骑手光点外圈 */}
                  <circle r="20" fill="white" fillOpacity="0.15">
                    <animateMotion dur="0.001s" fill="freeze" keyTimes="0;1" keyPoints={`${riderRouteProgress};${riderRouteProgress}`}>
                      <mpath href="#delivery-path" />
                    </animateMotion>
                    <animate attributeName="r" values="16;24;16" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                  </circle>
                  {/* 骑手图标本体 */}
                  <g>
                    <animateMotion
                      dur="0.001s"
                      fill="freeze"
                      keyTimes="0;1"
                      keyPoints={`${riderRouteProgress};${riderRouteProgress}`}
                    >
                      <mpath href="#delivery-path" />
                    </animateMotion>
                    <circle r="13" fill="white" />
                    <text x="0" y="4" textAnchor="middle" fontSize="14">🛵</text>
                  </g>
                  {/* 配送中持续移动效果：用第二层慢慢漂移 */}
                  {order.status === 'delivering' && (
                    <circle r="28" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.4">
                      <animateMotion
                        dur="0.001s"
                        fill="freeze"
                        keyTimes="0;1"
                        keyPoints={`${riderRouteProgress};${riderRouteProgress}`}
                      >
                        <mpath href="#delivery-path" />
                      </animateMotion>
                      <animate attributeName="r" values="18;32" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              )}

              {/* 待接单/备餐时，骑手在商家处等单 */}
              {!hasRider && !isDelivered && order.status !== 'cancelled' && order.status !== 'rejected' && (
                <g transform="translate(50, 130)">
                  <circle r="22" fill="white" fillOpacity="0.1">
                    <animate attributeName="r" values="18;28" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" values="0.2;0" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}
            </svg>

            {/* 距离/时间浮层 */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs">
                <span className="opacity-80">配送距离</span>
                <span className="ml-1.5 font-semibold">{order.distance || '2.5'} km</span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs">
                <span className="opacity-80">预计</span>
                <span className="ml-1.5 font-semibold">{estimatedDeliveryTime} 送达</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 px-4 pb-5 pt-2">
            <div className="flex items-center gap-3">
              {(() => {
                const currentNode = TIMELINE_NODES[Math.max(0, currentIdx)]
                const Icon = currentNode.Icon
                return (
                  <motion.div
                    key={order.status}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="size-12 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <Icon className="size-6" />
                  </motion.div>
                )
              })()}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold">{TIMELINE_NODES[Math.max(0, currentIdx)].label}</h2>
                <p className="text-sm opacity-70 mt-0.5">
                  {TIMELINE_NODES[Math.max(0, currentIdx)].desc}
                </p>
                {!isDelivered && order.status !== 'cancelled' && order.status !== 'rejected' && deliveryCountdown > 0 && order.status !== 'pending' && (
                  <div className="flex items-center gap-3 mt-2 text-xs opacity-80">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      <span className="tabular-nums">还剩 {countdownText}</span>
                    </div>
                  </div>
                )}
                {isDelivered && order.deliveredAt && (
                  <div className="flex items-center gap-1 mt-2 text-xs opacity-80">
                    <Check className="size-3.5" />
                    <span>已于 {estimatedDeliveryTime} 送达</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* 骑手信息卡 */}
        {hasRider && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-4 -mt-3 bg-card rounded-xl border border-border/50 p-4 shadow-sm relative z-10"
          >
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full overflow-hidden bg-muted shrink-0">
                <Image src={avatarImages.avatarImg2} alt="骑手" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {order.riderName || '骑手小哥'}
                  </span>
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                    骑手
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {order.riderPhone || '139****6666'} · 评分 4.9
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setContactTarget('rider'); setCallModalOpen(true) }}
                  className="size-9 rounded-full bg-muted flex items-center justify-center"
                >
                  <Phone className="size-4 text-foreground/70" />
                </button>
                <button
                  onClick={() => { setContactTarget('rider'); setContactSheetOpen(true) }}
                  className="size-9 rounded-full bg-muted flex items-center justify-center"
                >
                  <MessageCircle className="size-4 text-foreground/70" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 异常信息提示 */}
        {order.deliveryExceptions && order.deliveryExceptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">配送异常提醒</p>
                {order.deliveryExceptions.map((ex, i) => (
                  <p key={i} className="text-xs text-muted-foreground mt-1">
                    {ex.type === 'customer_unreachable' && '联系不上顾客'}
                    {ex.type === 'merchant_slow' && '商家出餐较慢'}
                    {ex.type === 'bad_weather' && '天气原因延误'}
                    {ex.type === 'wrong_address' && '地址有误'}
                    {ex.type === 'other' && '其他异常'}
                    {ex.description && `：${ex.description}`}
                    <span className="text-[10px] ml-1 text-muted-foreground/70">
                      {new Date(ex.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 6 节点时间线 */}
        <div className="px-4 py-5">
          <div className="text-sm font-semibold text-foreground mb-4">订单进度</div>
          <div className="relative">
            {TIMELINE_NODES.map((item, i) => {
              const completed = i <= currentIdx
              const isCurrent = i === currentIdx
              const Icon = item.Icon
              const node = order.statusTimeline[i]
              return (
                <div key={item.status} className="relative flex gap-3 pb-5 last:pb-0">
                  {/* 连接线 */}
                  {i < TIMELINE_NODES.length - 1 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: i < currentIdx ? 'calc(100% - 24px)' : 0 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      className={`absolute left-[15px] top-8 w-0.5 ${
                        i < currentIdx ? 'bg-foreground' : 'bg-border'
                      }`}
                    />
                  )}
                  {/* 节点 */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
                    className={`relative z-10 size-8 rounded-full flex items-center justify-center shrink-0 ${
                      completed
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCurrent && !isDelivered && (
                      <div className="absolute inset-0 rounded-full bg-foreground/30 animate-ping" />
                    )}
                    {completed ? (
                      <Check className="size-4" strokeWidth={3} />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </motion.div>
                  {/* 内容 */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    className="flex-1 min-w-0 pb-1"
                  >
                    <div className={`font-medium text-sm ${completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.label}
                    </div>
                    {node?.time && completed && (
                      <div className="text-xs text-muted-foreground mt-0.5">{node.time}</div>
                    )}
                    {isCurrent && !isDelivered && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.desc}
                      </div>
                    )}
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 模拟推进按钮 */}
        {!isDelivered && order.status !== 'cancelled' && order.status !== 'rejected' && (
          <div className="px-4 mb-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAdvance}
              className="w-full h-10 bg-foreground/10 text-foreground rounded-full text-sm font-medium flex items-center justify-center gap-1"
            >
              <RefreshCcw className="size-4" />
              模拟推进状态（演示用）
            </motion.button>
          </div>
        )}

        {/* 已送达评价入口 */}
        {isDelivered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-4 bg-card rounded-xl border border-border/50 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="size-5 text-foreground/80" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {order.reviewed || getReviewByOrder(order.id) ? '已评价' : '订单已送达，评价一下吧'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {order.reviewed || getReviewByOrder(order.id) ? '感谢您的评价与反馈' : '您的评价能帮助其他顾客做出选择'}
                  </div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigatePush(`/customer/review?orderId=${order.id}&mode=${order.reviewed || getReviewByOrder(order.id) ? 'view' : 'new'}`)}
                className="px-4 h-8 rounded-full bg-foreground text-background text-xs font-medium flex items-center gap-1"
              >
                {order.reviewed || getReviewByOrder(order.id) ? '查看评价' : '去评价'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* 再来一单 */}
        {canReorder && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-4 mb-4"
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleReorder}
              className="w-full h-11 bg-foreground text-background rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            >
              <ShoppingCart className="size-4" />
              再来一单（规格自动回填）
            </motion.button>
          </motion.div>
        )}

        {/* 退款申请入口 */}
        {canRefund && (
          <div className="mx-4 mb-4">
            <button
              onClick={() => setRefundOpen(true)}
              className="w-full h-10 border border-border rounded-full text-sm text-muted-foreground flex items-center justify-center gap-1"
            >
              <AlertCircle className="size-4" />
              申请退款
            </button>
          </div>
        )}

        {/* 退款进度 */}
        {order.refundRequest && (
          <div className="mx-4 mb-4 bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                <AlertCircle className="size-4 text-warning" />
                退款申请
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                order.refundRequest.status === 'pending'
                  ? 'bg-warning/10 text-warning'
                  : order.refundRequest.status === 'approved'
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
              }`}>
                {order.refundRequest.status === 'pending' ? '处理中' :
                 order.refundRequest.status === 'approved' ? '已同意' : '已拒绝'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">原因：{order.refundRequest.reason}</p>
            {order.refundRequest.description && (
              <p className="text-xs text-muted-foreground mt-1">说明：{order.refundRequest.description}</p>
            )}
            <p className="text-xs text-foreground mt-1">
              退款金额：<span className="font-medium tabular-nums">¥{order.refundRequest.amount.toFixed(1)}</span>
            </p>
            {order.refundRequest.handleRemark && (
              <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/30">
                商家回复：{order.refundRequest.handleRemark}
              </p>
            )}
          </div>
        )}

        {/* 订单信息 */}
        <div className="mx-4 bg-card rounded-xl border border-border/50 p-4">
          <div className="text-sm font-semibold text-foreground mb-3">订单信息</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">订单号</span>
              <span className="text-foreground text-xs tabular-nums">{formatOrderNo(order)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">下单时间</span>
              <span className="text-foreground text-xs">
                {new Date(order.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">配送地址</span>
              <div className="text-right">
                <div className="text-foreground text-xs">
                  {order.address.name} {order.address.phone}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {order.address.address} {order.address.detail}
                </div>
              </div>
            </div>
            {/* 配送信息：预约/餐具/备注 */}
            <div className="pt-2 mt-2 border-t border-border/30 space-y-1.5">
              {order.deliveryMode === 'appointment' && order.appointmentTime && (
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">预约送达</span>
                  <span className="text-foreground ml-auto font-medium">{order.appointmentTime}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <Utensils className="size-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">餐具</span>
                <span className="text-foreground ml-auto">{order.utensils || 1} 份</span>
              </div>
              {order.remark && (
                <div className="flex items-start gap-2 text-xs">
                  <StickyNote className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">备注</span>
                  <span className="text-foreground ml-auto text-right max-w-[180px] line-clamp-2">{order.remark}</span>
                </div>
              )}
            </div>
            {/* 优惠明细 */}
             {(order.promoDiscount > 0 || order.couponDiscount > 0 || (order.packingFee ?? 0) > 0 || (order.newUserDiscount ?? 0) > 0 || (order.freeDeliveryDiscount ?? 0) > 0) && (
               <div className="pt-2 mt-2 border-t border-border/30 space-y-1.5">
                 <div className="text-xs font-medium text-foreground">费用明细</div>
                 <div className="flex justify-between text-xs">
                   <span className="text-muted-foreground">商品小计</span>
                   <span className="text-foreground tabular-nums">¥{order.totalAmount.toFixed(1)}</span>
                 </div>
                 {(order.packingFee ?? 0) > 0 && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground">打包费</span>
                     <span className="text-foreground tabular-nums">¥{(order.packingFee ?? 0).toFixed(1)}</span>
                   </div>
                 )}
                 <div className="flex justify-between text-xs">
                   <span className="text-muted-foreground">配送费</span>
                   <span className="text-foreground tabular-nums">
                     {(order.freeDeliveryDiscount ?? 0) > 0 ? (
                       <span className="line-through text-muted-foreground text-[10px] mr-1">¥{order.deliveryFee.toFixed(1)}</span>
                     ) : null}
                     ¥{(order.deliveryFee - (order.freeDeliveryDiscount ?? 0)).toFixed(1)}
                   </span>
                 </div>
                 {order.promoDiscount > 0 && order.promoInfo && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground flex items-center gap-1">
                       <Tag className="size-3" />
                       {order.promoInfo.description}
                     </span>
                     <span className="text-destructive tabular-nums">-¥{order.promoDiscount.toFixed(1)}</span>
                   </div>
                 )}
                 {(order.newUserDiscount ?? 0) > 0 && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground flex items-center gap-1">
                       <Gift className="size-3" />
                       新客立减
                     </span>
                     <span className="text-destructive tabular-nums">-¥{(order.newUserDiscount ?? 0).toFixed(1)}</span>
                   </div>
                 )}
                 {(order.freeDeliveryDiscount ?? 0) > 0 && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground flex items-center gap-1">
                       <Truck className="size-3" />
                       免配送费活动
                     </span>
                     <span className="text-destructive tabular-nums">-¥{(order.freeDeliveryDiscount ?? 0).toFixed(1)}</span>
                   </div>
                 )}
                 {order.couponDiscount > 0 && order.couponInfo && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Tag className="size-3" />
                      {order.promoInfo.description}
                    </span>
                    <span className="text-destructive tabular-nums">-¥{order.promoDiscount.toFixed(1)}</span>
                  </div>
                )}
                {order.couponDiscount > 0 && order.couponInfo && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Ticket className="size-3" />
                      优惠券 · {order.couponInfo.couponName}
                    </span>
                    <span className="text-destructive tabular-nums">-¥{order.couponDiscount.toFixed(1)}</span>
                  </div>
                )}
                {(order.promoDiscount > 0 && order.couponDiscount > 0) && (
                  <div className="text-[10px] text-muted-foreground pt-0.5">
                    * 满减与优惠券不同享，系统已自动取最优
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 商品摘要 */}
        <div
          onClick={() => pageBack()}
          className="mx-4 mt-3 bg-card rounded-xl border border-border/50 p-4 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-foreground">
              {order.shopName}
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {order.items.slice(0, 3).map((item, idx) => (
              <div key={`${item.dishId}-${item.skuKey}-${idx}`} className="flex items-center gap-2">
                <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  <Image src={item.image} alt={item.dishName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.dishName}</p>
                  {item.specs && item.specs.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.specs.map(s => `${s.specName}:${s.optionLabel}`).join(' · ')}
                      {item.extras && item.extras.length > 0 && ` · ${item.extras.map(e => e.name).join('+')}`}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-foreground tabular-nums">
                    ¥{item.finalPrice.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">×{item.quantity}</p>
                </div>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                共 {order.items.length} 件商品
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
            <span className="text-xs text-muted-foreground">合计</span>
            <span className="text-base font-bold text-foreground tabular-nums">
              ¥{order.finalAmount.toFixed(1)}
            </span>
          </div>
        </div>

        {/* 取消订单按钮（仅待接单） */}
        {canCancel && (
          <div className="mx-4 mt-4">
            <button
              onClick={handleCancel}
              className="w-full h-10 border border-destructive/30 rounded-full text-sm text-destructive flex items-center justify-center"
            >
              取消订单
            </button>
          </div>
        )}
      </div>

      {/* 底部操作栏：联系商家/骑手/催单 */}
      {showContactBar && (
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          className="border-t border-border/50 bg-background px-4 py-3 flex items-center gap-2"
        >
          <button
            onClick={() => handleOpenContact('merchant')}
            className="flex-1 h-10 rounded-full border border-border flex items-center justify-center gap-1.5 text-sm"
          >
            <MessageCircle className="size-4" />
            联系商家
          </button>
          {hasRider && (
            <button
              onClick={() => handleOpenContact('rider')}
              className="flex-1 h-10 rounded-full border border-border flex items-center justify-center gap-1.5 text-sm"
            >
              <Phone className="size-4" />
              联系骑手
            </button>
          )}
          <button
            onClick={() => {
              if (urgeCooldownLeft > 0) {
                toast.info(`请等待 ${urgeCooldownLeft}s 后再催单`)
                return
              }
              setUrgeModalOpen(true)
            }}
            className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Clock className="size-4" />
            {urgeCooldownLeft > 0 ? `${urgeCooldownLeft}s` : '催单'}
          </button>
        </motion.div>
      )}

      {/* 联系操作弹层 */}
      <ContactActionSheet
        open={contactSheetOpen}
        onClose={() => setContactSheetOpen(false)}
        peerName={contactTarget === 'merchant' ? order.shopName : (order.riderName || '骑手')}
        peerAvatar={contactTarget === 'merchant' ? (order.shopCover || '') : avatarImages.avatarImg2}
        peerRole={contactTarget}
        onMessage={handleGoChat}
        onCall={handleCall}
      />

      {/* 拨打弹窗 */}
      <CallModal
        open={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        peerName={contactTarget === 'merchant' ? order.shopName : (order.riderName || '骑手')}
        peerAvatar={contactTarget === 'merchant' ? (order.shopCover || '') : avatarImages.avatarImg2}
        peerRole={contactTarget}
        peerPhone={contactTarget === 'merchant' ? '138****8888' : (order.riderPhone || '139****6666')}
      />

      {/* 催单弹窗 */}
      <UrgeModal
        open={urgeModalOpen}
        onClose={() => setUrgeModalOpen(false)}
        onConfirm={handleUrge}
        cooldownLeft={urgeCooldownLeft}
      />

      {/* 退款申请弹窗 */}
      <AnimatePresence>
        {refundOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setRefundOpen(false)}
          >
            <div className="absolute inset-0 bg-foreground/40" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md bg-background rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">申请退款</h3>
                <button
                  onClick={() => setRefundOpen(false)}
                  className="size-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <ChevronRight className="size-4 -rotate-90 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">退款原因</label>
                  <div className="flex flex-wrap gap-2">
                    {refundReasons.map(r => (
                      <button
                        key={r}
                        onClick={() => setRefundReason(r)}
                        className={`px-3 h-8 rounded-full text-xs border ${
                          refundReason === r
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background text-foreground border-border'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">补充说明（选填）</label>
                  <textarea
                    value={refundDesc}
                    onChange={e => setRefundDesc(e.target.value.slice(0, 200))}
                    placeholder="请描述具体情况，方便商家更快处理"
                    rows={4}
                    className="w-full p-3 bg-muted rounded-xl text-sm outline-none resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground text-right mt-1">
                    {refundDesc.length}/200
                  </p>
                </div>

                <div className="p-3 bg-muted/50 rounded-xl">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">预计退款金额</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      ¥{order.finalAmount.toFixed(1)}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitRefund}
                  className="w-full h-11 rounded-full bg-foreground text-background text-sm font-medium"
                >
                  提交退款申请
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 下单成功弹层 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card rounded-2xl shadow-xl p-6 flex flex-col items-center gap-3 pointer-events-auto"
            >
              <div className="size-16 rounded-full bg-success/10 flex items-center justify-center">
                <Check className="size-8 text-success" />
              </div>
              <p className="text-base font-semibold">下单成功</p>
              <p className="text-xs text-muted-foreground">商家正在确认订单</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
