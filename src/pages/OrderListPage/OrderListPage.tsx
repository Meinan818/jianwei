import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Package, Clock, ChevronRight, RefreshCcw, Star, MessageSquare, X, ShoppingBag, AlertTriangle, Bell } from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useReviews } from '@/hooks/useReviews'
import { useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { Image } from '@/components/ui/image'
import { useCart } from '@/hooks/useCart'
import { getAllShops } from '@/data/shops'
import { toast } from 'sonner'
import { formatOrderTime, formatCountdown } from '@/lib/utils'

const TABS = [
  { id: 'pending', label: '待支付' },
  { id: 'ongoing', label: '进行中' },
  { id: 'history', label: '历史订单' },
]

const STATUS_LABELS: Record<string, string> = {
  pending_payment: '待支付',
  pending: '待接单',
  preparing: '备餐中',
  ready: '待骑手取餐',
  picked: '骑手取餐',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消',
  rejected: '已拒单',
}

export default function OrderListPage() {
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const { orders, customerCancel, cancelPendingOrder, cleanupExpiredPending, cleanupExpiredPendingAccept, urgeOrder, markReviewed } = useOrders()
  const { getReviewByOrder } = useReviews()
  const { addItem } = useCart()
  const [activeTab, setActiveTab] = useState('ongoing')
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)
  const [, forceTick] = useState(0)

  // 挂载时执行超时校准（支付超时 + 接单超时）
  useEffect(() => {
    cleanupExpiredPending()
    cleanupExpiredPendingAccept()
  }, [cleanupExpiredPending, cleanupExpiredPendingAccept])

  // 倒计时刷新 tick（每秒触发重渲染以更新倒计时显示）
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const pendingOrders = useMemo(
    () => orders.filter(o => o.status === 'pending_payment'),
    [orders],
  )

  const ongoingOrders = useMemo(
    () => orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready' || o.status === 'picked' || o.status === 'delivering'),
    [orders],
  )

  const historyOrders = useMemo(
    () => orders.filter(o => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'rejected'),
    [orders],
  )

  const list = activeTab === 'ongoing'
    ? ongoingOrders
    : activeTab === 'pending'
      ? pendingOrders
      : historyOrders

  const handleConfirmCancel = () => {
    if (cancelOrderId) {
      const order = orders.find(o => o.id === cancelOrderId)
      if (order?.status === 'pending_payment') {
        cancelPendingOrder(cancelOrderId)
      } else {
        customerCancel(cancelOrderId)
      }
      toast.success('订单已取消')
      setCancelOrderId(null)
    }
  }

  const handleReorder = (order: (typeof orders)[number]) => {
    const shop = getAllShops().find(s => s.id === order.shopId)
    if (!shop) {
      toast.info('商家不存在')
      return
    }
    order.items.forEach(item => {
      addItem(
        shop.id,
        shop.name,
        { id: item.dishId, name: item.dishName, price: item.basePrice, image: item.image },
        { specs: item.specs, extras: item.extras, quantity: item.quantity },
      )
    })
    toast.success('已加入购物车，规格已回填')
    navigatePush(`/customer/shop/${order.shopId}`)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30"
      >
        <h1 className="text-lg font-semibold text-foreground">我的订单</h1>
      </motion.div>

      {/* Tab 切换 */}
      <div className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30">
        <LayoutGroup>
          <div className="flex gap-6">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative pb-1.5"
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="order-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      {/* 订单列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {list.length > 0 ? (
          <div className="space-y-3">
            {list.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigatePush(`/customer/order/${order.id}/track`)}
                className="bg-card rounded-xl border border-border/50 p-4 cursor-pointer"
              >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{order.shopName}</span>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        order.status === 'delivered'
                          ? 'text-muted-foreground'
                          : order.status === 'cancelled' || order.status === 'rejected'
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    {order.items.slice(0, 3).map(item => (
                      <div key={item.dishId} className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                        <Image src={item.image} alt={item.dishName} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        +{order.items.length - 3}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>
                        {formatOrderTime(order.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground text-xs">实付 </span>
                      <span className="font-semibold text-foreground tabular-nums">
                        ¥{order.finalAmount.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  {order.status === 'pending_payment' && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex justify-end gap-2">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCancelOrderId(order.id)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 h-8 rounded-full border border-border text-xs text-muted-foreground"
                      >
                        取消订单
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigatePush(`/payment?orderId=${order.id}`)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 h-8 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                      >
                        去支付
                      </motion.button>
                    </div>
                  )}
                  {order.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      {order.acceptExpireAt && order.acceptExpireAt < Date.now() ? (
                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-warning/10 text-xs text-warning-foreground">
                          <AlertTriangle className="size-3.5" />
                          <span>商家暂未接单，您可催单或取消订单</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                          <Clock className="size-3.5" />
                          <span>商家接单中，预计接单剩余 {order.acceptExpireAt ? formatCountdown(order.acceptExpireAt - Date.now()) : '--'}</span>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            const ok = urgeOrder(order.id)
                            if (ok) toast.success('已提醒商家尽快接单')
                            else toast.info('催单过于频繁，请稍后再试')
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 h-8 rounded-full border border-border text-xs text-muted-foreground"
                        >
                          <Bell className="size-3.5" />
                          催单
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setCancelOrderId(order.id)
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 h-8 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                        >
                          取消订单
                        </motion.button>
                      </div>
                    </div>
                  )}
                  {order.status === 'delivered' && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex justify-end gap-2">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (order.reviewed || getReviewByOrder(order.id)) {
                            navigatePush(`/customer/review?orderId=${order.id}&mode=view`)
                          } else {
                            navigatePush(`/customer/review?orderId=${order.id}&mode=new`)
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 h-8 rounded-full bg-foreground text-background text-xs font-medium"
                      >
                        <Star className="size-3.5" />
                        {order.reviewed || getReviewByOrder(order.id) ? '查看评价' : '去评价'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReorder(order)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 h-8 rounded-full bg-foreground/10 text-foreground text-xs font-medium"
                      >
                        <RefreshCcw className="size-3.5" />
                        再来一单
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="relative mb-4">
                <div className="size-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <ShoppingBag className="size-10 opacity-40" />
                </div>
              </div>
              <p className="text-sm text-foreground/60 mb-1">
                {activeTab === 'ongoing' ? '暂无进行中的订单' : '暂无历史订单'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {activeTab === 'ongoing' ? '快去挑选喜欢的美食吧' : '下单记录会保存在这里'}
              </p>
              {activeTab === 'ongoing' && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigateReplace('/')}
                  className="px-6 h-9 rounded-full bg-foreground text-background text-sm font-medium"
                >
                  去点餐
                </motion.button>
              )}
            </div>
          )}
        </div>
      {/* 取消订单确认弹窗 */}
      <AnimatePresence>
        {cancelOrderId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCancelOrderId(null)}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-xs bg-card rounded-2xl overflow-hidden"
            >
              <div className="p-5 text-center">
                <h3 className="text-base font-semibold text-foreground mb-2">确认取消订单？</h3>
                <p className="text-xs text-muted-foreground">取消后订单将无法恢复，菜品将从购物车移除</p>
              </div>
              <div className="flex border-t border-border/30">
                <button
                  onClick={() => setCancelOrderId(null)}
                  className="flex-1 h-11 text-sm text-muted-foreground border-r border-border/30"
                >
                  再想想
                </button>
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 h-11 text-sm text-foreground font-medium"
                >
                  确认取消
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}