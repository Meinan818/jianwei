import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, MapPin, Clock, Phone, MessageCircle, AlertTriangle,
  Navigation, Store, CheckCircle, Bike, ChevronRight, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrders, STATUS_FLOW } from '@/hooks/useOrders'
import { useNavigatePush, useNavigateTab } from '@/hooks/useNavigationStack'
import { isTabRoot } from '@/data/navigation'
import { toast } from 'sonner'
import { formatOrderTime } from '@/lib/utils'
import type { IOrder, DeliveryExceptionType } from '@/data/order'

const EXCEPTION_TYPES: { value: DeliveryExceptionType; label: string }[] = [
  { value: 'customer_unreachable', label: '联系不上顾客' },
  { value: 'merchant_slow', label: '商家出餐慢' },
  { value: 'wrong_address', label: '地址错误' },
  { value: 'bad_weather', label: '天气原因' },
  { value: 'other', label: '其他原因' },
]

export default function RiderTasksPage() {
  const navigatePush = useNavigatePush()
  const navigateTab = useNavigateTab()
  const { user } = useAuth()
  const { orders, getRiderActiveOrders, getRiderHistoryOrders, riderArriveAtStore, riderConfirmPickup, riderStartDelivery, riderDeliver, reportDeliveryException } = useOrders()

  // 2026-09-28 修复：订单里的骑手身份用 profiles.id（uuid），工号只用于展示。
  const riderKey = user.id || user.riderId || 'r1'

  const [navOrder, setNavOrder] = useState<IOrder | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [exceptionOrderId, setExceptionOrderId] = useState<string | null>(null)
  const [exceptionType, setExceptionType] = useState<DeliveryExceptionType>('other')
  const [exceptionDesc, setExceptionDesc] = useState('')

  const activeOrders = getRiderActiveOrders(riderKey)
  const historyOrders = getRiderHistoryOrders(riderKey)

  const displayOrders = activeTab === 'active' ? activeOrders : historyOrders

  // 判断订单当前配送步骤（1:到店 2:取餐 3:配送中 4:已送达）
  const getDeliveryStep = (order: IOrder): number => {
    if (order.status === 'delivered') return 4
    if (order.status === 'delivering') return 3
    if (order.pickedAt && order.arrivedAt && order.pickedAt > order.arrivedAt) return 2
    if (order.arrivedAt) return 1
    return 1  // 抢单后默认第一步=前往商家
  }

  const handleArrive = (orderId: string) => {
    const result = riderArriveAtStore(orderId)
    if (result) {
      toast.success('已确认到店')
    }
  }

  const handlePickup = (orderId: string) => {
    const result = riderConfirmPickup(orderId)
    if (result) {
      toast.success('已确认取餐')
    }
  }

  const handleStartDelivery = (orderId: string) => {
    const result = riderStartDelivery(orderId)
    if (result) {
      toast.success('开始配送')
    }
  }

  const handleDeliver = (orderId: string) => {
    const result = riderDeliver(orderId)
    if (result) {
      toast.success('订单已送达，辛苦了！')
    }
  }

  const handleSubmitException = () => {
    if (!exceptionOrderId) return
    const result = reportDeliveryException(exceptionOrderId, {
      type: exceptionType,
      description: exceptionDesc,
      reporterId: riderKey,
      reporterName: user.nickname || '骑手',
    })
    if (result) {
      toast.success('异常已上报')
      setExceptionOrderId(null)
      setExceptionDesc('')
      setExceptionType('other')
    }
  }

  const goToOrderDetail = (order: IOrder) => {
    const path = `/rider/order/${order.id}`
    if (isTabRoot(path, user.role)) {
      navigateTab(path)
    } else {
      navigatePush(path)
    }
  }

  const renderStepIndicator = (step: number) => {
    const steps = ['到店', '取餐', '配送', '送达']
    return (
      <div className="flex items-center gap-1">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i + 1 <= step ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}>
              {i + 1 <= step ? <CheckCircle className="size-3" /> : i + 1}
            </div>
            <span className={`text-[10px] ${i + 1 <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-3 h-px ${i + 1 < step ? 'bg-foreground/40' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶部 */}
      <div className="px-4 pt-8 pb-3 bg-foreground text-background flex-shrink-0">
        <h1 className="text-lg font-bold">配送任务</h1>
        <p className="text-xs text-background/60 mt-0.5">
          {activeTab === 'active' ? `当前有 ${activeOrders.length} 个进行中订单` : `已完成 ${historyOrders.length} 单`}
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-border/30 bg-background flex-shrink-0">
        {[
          { key: 'active', label: '进行中', count: activeOrders.length },
          { key: 'history', label: '已完成', count: historyOrders.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'active' | 'history')}
            className={`flex-1 py-3 text-sm relative transition-colors ${
              activeTab === tab.key ? 'text-foreground font-semibold' : 'text-muted-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1 text-xs ${activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground'}`}>
                ({tab.count})
              </span>
            )}
            {activeTab === tab.key && (
              <motion.div
                layoutId="rider-task-tab"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-foreground rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeTab === 'active' ? '暂无进行中的订单' : '暂无历史订单'}
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => navigateTab('/rider')}
                className="mt-4 px-6 h-10 rounded-full bg-foreground text-background text-sm"
              >
                去抢单
              </button>
            )}
          </div>
        ) : (
          displayOrders.map((order, idx) => {
            const step = getDeliveryStep(order)
            const isActive = order.status === 'picked' || order.status === 'delivering'
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card rounded-xl border border-border/50 overflow-hidden"
              >
                {/* 订单头部 */}
                <div
                  onClick={() => goToOrderDetail(order)}
                  className="px-4 py-3 border-b border-border/30 cursor-pointer active:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Store className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{order.shopName}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'delivered'
                        ? 'bg-muted/60 text-muted-foreground'
                        : 'bg-foreground/10 text-foreground'
                    }`}>
                      {STATUS_FLOW.find(s => s.status === order.status)?.label || order.status}
                    </span>
                  </div>
                  {activeTab === 'active' && renderStepIndicator(step)}
                </div>

                {/* 配送地址 */}
                <div className="px-4 py-3 border-b border-border/30">
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">
                        {order.address.name} {order.address.phone}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {order.address.address} {order.address.detail}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 订单摘要 */}
                <div className="px-4 py-2 border-b border-border/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    共 {order.items.reduce((s, i) => s + i.quantity, 0)} 件商品
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    ¥{order.finalAmount.toFixed(1)}
                  </span>
                </div>

                {/* 操作按钮 - 只有进行中订单显示 */}
                {isActive && (
                  <div className="px-4 py-3 space-y-2">
                    {/* 四步操作按钮 */}
                    <div className="flex gap-2">
                      {step === 1 && order.status === 'picked' && !order.arrivedAt && (
                        <button
                          onClick={() => handleArrive(order.id)}
                          className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <Store className="size-4" />
                          确认到店
                        </button>
                      )}
                      {step === 1 && order.arrivedAt && order.status === 'picked' && (
                        <button
                          onClick={() => handlePickup(order.id)}
                          className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <Package className="size-4" />
                          确认取餐
                        </button>
                      )}
                      {step === 2 && order.status === 'picked' && (
                        <button
                          onClick={() => handleStartDelivery(order.id)}
                          className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <Navigation className="size-4" />
                          开始配送
                        </button>
                      )}
                      {order.status === 'delivering' && (
                        <button
                          onClick={() => handleDeliver(order.id)}
                          className="flex-1 h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="size-4" />
                          确认送达
                        </button>
                      )}
                      {isActive && (
                        <button
                          onClick={() => {
                            setExceptionOrderId(order.id)
                            setExceptionType('other')
                            setExceptionDesc('')
                          }}
                          className="h-10 px-3 rounded-full border border-border text-sm text-foreground flex items-center justify-center gap-1"
                        >
                          <AlertTriangle className="size-4" />
                          异常
                        </button>
                      )}
                    </div>

                    {/* 联系按钮 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNavOrder(order)}
                        className="flex-1 h-9 rounded-full border border-border text-xs text-foreground flex items-center justify-center gap-1"
                      >
                        <Navigation className="size-3.5" />
                        {step <= 2 ? '到店导航' : '送达导航'}
                      </button>
                      <button
                        onClick={() => navigatePush(`/chat?peerName=${encodeURIComponent(order.shopName)}&peerRole=merchant&orderId=${order.id}&type=order`)}
                        className="flex-1 h-9 rounded-full border border-border text-xs text-foreground flex items-center justify-center gap-1"
                      >
                        <MessageCircle className="size-3.5" />
                        联系商家
                      </button>
                    </div>
                  </div>
                )}

                {/* 历史订单显示送达时间 */}
                {order.status === 'delivered' && (
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                                            送达时间：{order.deliveredAt ? formatOrderTime(order.deliveredAt) : '-'}
                    </span>
                    <span className="text-xs text-success flex items-center gap-1">
                      <CheckCircle className="size-3" />
                      配送费 ¥{order.riderEarning?.toFixed(1) || (order.deliveryFee * 0.6).toFixed(1)}
                    </span>
                  </div>
                )}
              </motion.div>
            )
          })
        )}
        <div className="h-6" />
      </div>

      {/* 异常上报弹层 */}
      <AnimatePresence>
        {exceptionOrderId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExceptionOrderId(null)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-sm text-foreground">配送异常上报</span>
                <button
                  onClick={() => setExceptionOrderId(null)}
                  className="size-7 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-foreground mb-2">异常类型</div>
                  <div className="flex flex-wrap gap-2">
                    {EXCEPTION_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setExceptionType(t.value)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          exceptionType === t.value
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-muted/50 text-foreground border-border/50'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-2">补充说明（选填）</div>
                  <textarea
                    value={exceptionDesc}
                    onChange={e => setExceptionDesc(e.target.value.slice(0, 200))}
                    placeholder="请描述具体情况..."
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-lg resize-none focus:outline-none focus:border-foreground/30 text-foreground"
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1">
                    {exceptionDesc.length}/200
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-border/30 bg-card">
                <button
                  onClick={handleSubmitException}
                  className="w-full h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                >
                  <AlertTriangle className="size-4" />
                  提交异常
                </button>
              </div>
            </motion.div>
          </>
        )}
       </AnimatePresence>

      {/* 导航指引弹层 */}
      <AnimatePresence>
        {navOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavOrder(null)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl max-h-[75vh] overflow-hidden flex flex-col mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-sm text-foreground">
                  {getDeliveryStep(navOrder) <= 2 ? '到店导航' : '送达导航'}
                </span>
                <button
                  onClick={() => setNavOrder(null)}
                  className="size-7 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-4 py-4 space-y-4">
                {/* 简化版导航指引 */}
                <div className="bg-foreground text-background rounded-xl p-4 relative overflow-hidden aspect-video">
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-foreground/90" />
                  <div className="absolute top-4 left-4 right-4 flex items-center gap-2">
                    <Navigation className="size-4 text-background/70" />
                    <span className="text-xs text-background/70">
                      {getDeliveryStep(navOrder) <= 2 ? `前往 ${navOrder.shopName}` : `送往 ${navOrder.address.address}`}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        {getDeliveryStep(navOrder) <= 2 ? '约 3 分钟' : '约 12 分钟'}
                      </p>
                      <p className="text-xs text-background/60">
                        {getDeliveryStep(navOrder) <= 2 ? '距离 800 米' : `距离 ${navOrder.distance || '2.5 公里'}`}
                      </p>
                    </div>
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="size-10 rounded-full bg-background text-foreground flex items-center justify-center"
                    >
                      <Bike className="size-5" />
                    </motion.div>
                  </div>
                  {/* 路线 SVG */}
                  <svg className="absolute bottom-1/4 left-8 right-8 h-8" viewBox="0 0 200 40">
                    <path
                      d="M 0 30 Q 50 5 100 20 T 200 10"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <motion.circle r="4" fill="white">
                      <animateMotion
                        dur="2.5s"
                        repeatCount="indefinite"
                        path="M 0 30 Q 50 5 100 20 T 200 10"
                      />
                    </motion.circle>
                  </svg>
                </div>

                {/* 导航步骤 */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">导航指引</p>
                  {getDeliveryStep(navOrder) <= 2 ? (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="size-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</div>
                        <p className="text-sm text-foreground">沿主路直行 500 米后右转</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="size-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</div>
                        <p className="text-sm text-muted-foreground">右转后直行 200 米到达 {navOrder.shopName}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="size-5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</div>
                        <p className="text-sm text-foreground">沿大路直行 1 公里</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="size-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</div>
                        <p className="text-sm text-muted-foreground">过红绿灯后左转进入 {navOrder.address.address}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="size-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</div>
                        <p className="text-sm text-muted-foreground">找到 {navOrder.address.detail}</p>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    toast.info('已开启导航（模拟）')
                    setNavOrder(null)
                  }}
                  className="w-full h-11 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Navigation className="size-4" />
                  开始导航
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
