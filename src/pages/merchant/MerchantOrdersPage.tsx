import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import {
  ChefHat, Package, Check, X, Clock, AlertTriangle,
  Phone, MessageSquare, MapPin, ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigateTab, useNavigatePush } from '@/hooks/useNavigationStack'
import { useOrders } from '@/hooks/useOrders'
import { useShopStatus } from '@/hooks/useShopStatus'
import { toast } from 'sonner'
import { formatOrderTime, formatCountdown } from '@/lib/utils'

const TABS = [
  { id: 'pending', label: '待接单' },
  { id: 'preparing', label: '制作中' },
  { id: 'ready', label: '待取餐' },
  { id: 'delivering', label: '配送中' },
  { id: 'done', label: '已完成' },
  { id: 'refund', label: '售后' },
]

const STATUS_MAP: Record<string, string[]> = {
  pending: ['pending'],
  preparing: ['preparing'],
  ready: ['ready'],
  delivering: ['picked', 'delivering'],
  // 2026-09-28 修复：以前这里只有 delivered，于是商家拒单 / 顾客取消之后，
  // 订单会从一个标签里消失、又不出现在任何别的标签（既不在「待接单」也不在「已完成」），
  // 看起来就像订单凭空不见了。现在归到「已完成」标签里，并显示原因。
  done: ['delivered', 'rejected', 'cancelled'],
}

export default function MerchantOrdersPage() {
  const navigateTab = useNavigateTab()
  const navigatePush = useNavigatePush()
  const { user } = useAuth()
  const { orders, getShopOrders, getShopRefundRequests, merchantAccept, merchantReject, merchantMarkReady, advanceToStatus, handleRefund, cleanupExpiredPendingAccept, isAcceptExpired } = useOrders()
  const { isShopOpen } = useShopStatus()

  // 挂载时执行超时订单校准
  useEffect(() => {
    cleanupExpiredPendingAccept()
  }, [cleanupExpiredPendingAccept])

  // 倒计时刷新 tick（每秒触发重渲染以更新倒计时显示）
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const shopId = user.shopId || '1'
  const [activeTab, setActiveTab] = useState('pending')
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [refundHandleId, setRefundHandleId] = useState<string | null>(null)
  const [refundHandleAction, setRefundHandleAction] = useState<'approve' | 'reject'>('approve')
  const [refundHandleRemark, setRefundHandleRemark] = useState('')

  const allOrders = getShopOrders(shopId)
  const filteredOrders = useMemo(() => {
    const statuses = STATUS_MAP[activeTab] || []
    return allOrders.filter(o => statuses.includes(o.status))
  }, [allOrders, activeTab])

  const pendingCount = allOrders.filter(o => o.status === 'pending').length

  const handleAccept = (orderId: string) => {
    merchantAccept(orderId)
    toast.success('已接单')
  }

  const handleReject = () => {
    if (!rejectOrderId) return
    if (!rejectReason.trim()) {
      toast.info('请填写拒单原因')
      return
    }
    merchantReject(rejectOrderId, rejectReason)
    toast.info('已拒单')
    setRejectOrderId(null)
    setRejectReason('')
  }

  /** 到店自取：商家确认顾客已取餐 → 订单直接完成（状态机允许 ready → delivered） */
  const handleCompletePickup = (orderId: string) => {
    const result = advanceToStatus(orderId, 'delivered')
    if (result) toast.success('已确认顾客取餐，订单完成')
    else toast.info('订单状态已变化，请刷新看看')
  }

  const handleMarkReady = (orderId: string) => {
    merchantMarkReady(orderId)
    toast.success('已通知骑手取餐')
  }

  const refundRequests = getShopRefundRequests(shopId)
  const pendingRefundCount = refundRequests.filter(r => r.status === 'pending').length

  const openRefundHandle = (orderId: string, action: 'approve' | 'reject') => {
    setRefundHandleId(orderId)
    setRefundHandleAction(action)
    setRefundHandleRemark('')
  }

  const submitRefundHandle = () => {
    if (!refundHandleId) return
    const result = handleRefund(refundHandleId, refundHandleAction, refundHandleRemark, user.nickname || '商家', user.id)
    if (result) {
      toast.success(refundHandleAction === 'approve' ? '已同意退款' : '已拒绝退款')
      setRefundHandleId(null)
      setRefundHandleRemark('')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30"
      >
        <h1 className="text-lg font-semibold text-foreground">订单管理</h1>
      </motion.div>

      {/* Tab 切换 */}
      <div className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30">
        <LayoutGroup>
          <div className="flex gap-5">
            {TABS.map(tab => {
                 const count = tab.id === 'pending'
                   ? pendingCount
                   : tab.id === 'refund'
                   ? pendingRefundCount
                   : allOrders.filter(o => (STATUS_MAP[tab.id] || []).includes(o.status)).length
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative pb-1.5 flex items-center gap-1.5"
                >
                  <span
                    className={`text-sm font-medium transition-colors ${
                      activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {tab.label}
                  </span>
                  {/* 仅待处理类 Tab 显角标；已完成/全部/售后类永不显示角标 */}
                  {count > 0 && (tab.id === 'pending' || tab.id === 'preparing' || tab.id === 'ready' || tab.id === 'refund') && (
                    <span
                      className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                        activeTab === tab.id
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="merchant-order-tab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      </div>

       {/* 订单列表 */}
       <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
         {activeTab === 'refund' ? (
           <>
             {refundRequests.length > 0 ? (
               <div className="space-y-3">
                 {refundRequests.map(req => {
                   const order = allOrders.find(o => o.id === req.orderId)
                   return (
                     <motion.div
                       key={req.id}
                       initial={{ opacity: 0, y: 12 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                       className="p-4 bg-card rounded-xl border border-border/40"
                     >
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-xs text-muted-foreground">
                           {new Date(req.createdAt).toLocaleString('zh-CN')}
                         </span>
                         <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                           req.status === 'pending' ? 'bg-warning/10 text-warning' :
                           req.status === 'approved' ? 'bg-success/10 text-success' :
                           'bg-destructive/10 text-destructive'
                         }`}>
                           {req.status === 'pending' && '待处理'}
                           {req.status === 'approved' && '已同意'}
                           {req.status === 'rejected' && '已拒绝'}
                         </span>
                       </div>
                       <div className="text-sm font-medium text-foreground mb-1">
                         订单号：{req.orderId.slice(-8)}
                       </div>
                       <div className="text-xs text-muted-foreground mb-2">
                         原因：{req.reason}
                       </div>
                       {req.description && (
                         <div className="text-xs text-muted-foreground mb-2">
                           说明：{req.description}
                         </div>
                       )}
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-xs text-muted-foreground">申请退款</span>
                         <span className="text-sm font-semibold text-foreground tabular-nums">
                           ¥{req.amount.toFixed(1)}
                         </span>
                       </div>
                       {req.handleRemark && (
                         <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/40 rounded-lg">
                           处理备注：{req.handleRemark}
                         </div>
                       )}
                       {req.status === 'pending' && (
                         <div className="flex gap-2">
                           <button
                             onClick={() => openRefundHandle(req.orderId, 'reject')}
                             className="flex-1 h-8 rounded-full border border-border text-xs text-foreground"
                           >
                             拒绝
                           </button>
                           <button
                             onClick={() => openRefundHandle(req.orderId, 'approve')}
                             className="flex-1 h-8 rounded-full bg-foreground text-background text-xs font-medium"
                           >
                             同意退款
                           </button>
                         </div>
                       )}
                   </motion.div>
                 )})}
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                 <AlertTriangle className="size-14 mb-3 opacity-30" />
                 <p className="text-sm">暂无售后申请</p>
               </div>
             )}
           </>
         ) : (
           <>
            {filteredOrders.length > 0 ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                   className={`bg-card rounded-xl border p-4 ${
                     order.status === 'pending'
                       ? isAcceptExpired(order.id)
                         ? 'border-destructive/50 shadow-sm bg-destructive/5'
                         : 'border-foreground/30 shadow-sm'
                       : 'border-border/50'
                   }`}
                 >
                  {/* 催单红色横幅 */}
                  {order.urgeCount && order.urgeCount > 0 && order.status !== 'delivered' && (
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30">
                        <div className="size-2 rounded-full bg-destructive shrink-0 animate-pulse" />
                      <span className="text-xs font-bold text-destructive">
                        顾客催单 · 第{order.urgeCount}次
                      </span>
                      {order.urgeReason && (
                        <span className="text-xs text-destructive/80 truncate flex-1">
                          {order.urgeReason}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          navigatePush(`/chat?peerName=${encodeURIComponent(order.address.name || '顾客')}&orderId=${order.id}&peerRole=customer&type=order`)
                        }}
                        className="shrink-0 text-xs font-medium text-destructive border border-destructive/40 rounded-full px-2.5 py-0.5"
                      >
                        联系
                      </button>
                    </div>
                  )}

                  {/* 新订单高亮脉冲 */}
                   {order.status === 'pending' && (
                     <motion.div
                       initial={{ scale: 0.8, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       className="flex items-center gap-1.5 mb-3"
                     >
                       {isAcceptExpired(order.id) ? (
                         <>
                           <AlertTriangle className="size-3.5 text-destructive" />
                           <span className="text-xs font-semibold text-destructive">接单超时</span>
                         </>
                       ) : (
                         <>
                            <div className="size-2 rounded-full bg-foreground animate-pulse" />
                           <span className="text-xs font-semibold text-foreground">新订单</span>
                         </>
                       )}
                       <span className={`ml-auto flex items-center gap-1 font-medium tabular-nums ${isAcceptExpired(order.id) ? 'text-destructive text-sm' : 'text-foreground text-sm'}`}>
                         <Clock className="size-3.5" />
                         {isAcceptExpired(order.id)
                           ? '接单超时'
                           : order.acceptExpireAt
                             ? `接单剩余 ${formatCountdown(order.acceptExpireAt - Date.now())}`
                             : formatOrderTime(order.createdAt)}
                       </span>
                     </motion.div>
                   )}

                  {order.status !== 'pending' && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-foreground">
                        {order.status === 'preparing' && '制作中'}
                        {order.status === 'ready' && '等待骑手取餐'}
                        {order.status === 'picked' && '骑手已取餐'}
                        {order.status === 'delivering' && '配送中'}
                        {order.status === 'delivered' && '已完成'}
                        {order.status === 'rejected' && ('已拒单' + (order.rejectReason ? ' · ' + order.rejectReason : ''))}
                        {order.status === 'cancelled' && ('已取消' + (order.cancelReason ? ' · ' + order.cancelReason : ''))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatOrderTime(order.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* 订单内容 */}
                   <div className="space-y-2.5 mb-3">
                     {order.items.map(item => (
                       <div key={item.dishId} className="space-y-0.5">
                         <div className="flex items-start justify-between gap-2">
                           <div className="flex-1 min-w-0">
                             <span className="text-sm text-foreground block truncate">
                               {item.dishName}
                             </span>
                             {((item.specs?.length ?? 0) + (item.extras?.length ?? 0)) > 0 && (
                               <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                                 {item.specs?.map(s => s.optionLabel).join(' / ')}
                                 {(item.extras?.length ?? 0) > 0 ? ` · 加${item.extras.map(e => e.name).join('、')}` : ''}
                               </span>
                             )}
                           </div>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="text-xs text-muted-foreground">
                             ×{item.quantity}
                           </span>
                           <span className="text-sm text-foreground tabular-nums">
                             ¥{(item.finalPrice * item.quantity).toFixed(1)}
                           </span>
                         </div>
                       </div>
                     ))}
                   </div>

                  {/* 备注 */}
                  {order.remark && (
                    <div className="text-xs text-muted-foreground mb-3 bg-muted/50 p-2 rounded-lg">
                      备注：{order.remark}
                    </div>
                  )}

                  {/* 合计 */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <span className="text-xs text-muted-foreground">共{order.items.reduce((s, i) => s + i.quantity, 0)}件商品</span>
                    <span className="text-base font-bold text-foreground tabular-nums">
                      ¥{order.finalAmount.toFixed(1)}
                    </span>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border/30">
                    {order.status === 'pending' && (
                      <>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setRejectOrderId(order.id)
                            setRejectReason('')
                          }}
                          className="h-8 px-4 rounded-full border border-border text-xs text-foreground"
                        >
                          拒单
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleAccept(order.id)}
                          className="h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium flex items-center gap-1"
                        >
                          <Check className="size-3.5" />
                          接单
                        </motion.button>
                      </>
                    )}
                    {order.status === 'preparing' && (
                      <div className="flex items-center justify-end gap-2 w-full">
                        <button
                          onClick={() => {
                            navigatePush(`/chat?peerName=${encodeURIComponent(order.address.name || '顾客')}&orderId=${order.id}&peerRole=customer&type=order`)
                          }}
                          className="h-8 px-3 rounded-full border border-border text-xs text-foreground flex items-center gap-1"
                        >
                          <Phone className="size-3" />
                          联系顾客
                        </button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleMarkReady(order.id)}
                          className="h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium flex items-center gap-1"
                        >
                          <Package className="size-3.5" />
                          出餐完成
                        </motion.button>
                      </div>
                    )}
                    {order.status === 'ready' && (order.isPickup ? (
                      <div className="flex items-center justify-end gap-2 w-full">
                        <span className="text-xs text-muted-foreground">到店自取 · 等顾客到店</span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleCompletePickup(order.id)}
                          className="h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium flex items-center gap-1"
                        >
                          <Check className="size-3.5" />
                          顾客已取餐
                        </motion.button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">等待骑手抢单...</span>
                    ))}
                    {(order.status === 'picked' || order.status === 'delivering') && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>骑手配送中</span>
                        {order.riderName && <span>· {order.riderName}</span>}
                      </div>
                    )}
                    {order.status === 'delivered' && (
                      <span className="text-xs text-muted-foreground">已送达</span>
                    )}
                  </div>
                 </motion.div>
               ))}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
               <Clock className="size-14 mb-3 opacity-30" />
               <p className="text-sm">暂无订单</p>
               <button
                 onClick={() => navigateTab('/merchant')}
                 className="mt-4 px-5 h-9 rounded-full bg-foreground text-background text-sm font-medium"
               >
                 返回工作台
               </button>
             </div>
           )}
           </>
         )}
       </div>

      {/* 拒单弹窗 */}
      <AnimatePresence>
        {rejectOrderId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectOrderId(null)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-foreground">拒单原因</span>
                <button onClick={() => setRejectOrderId(null)}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {['食材不足', '商家休息', '配送范围外', '太忙了'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setRejectReason(reason)}
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        rejectReason === reason
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-background text-muted-foreground border-border'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="请输入拒单原因"
                  className="w-full h-24 p-3 bg-muted rounded-lg text-sm outline-none resize-none"
                />
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReject}
                  className="w-full h-11 rounded-full bg-foreground text-background text-sm font-medium"
                >
                  确认拒单
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
       </AnimatePresence>

       {/* 售后处理弹窗 */}
       <AnimatePresence>
         {refundHandleId && (
           <>
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setRefundHandleId(null)}
               className="fixed inset-0 z-50 bg-black/50"
             />
             <motion.div
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               transition={{ type: 'spring', damping: 30, stiffness: 300 }}
               className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl mx-auto max-w-md"
             >
               <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                 <span className="font-semibold text-foreground">
                   {refundHandleAction === 'approve' ? '同意退款' : '拒绝退款'}
                 </span>
                 <button onClick={() => setRefundHandleId(null)}>
                   <X className="size-5 text-muted-foreground" />
                 </button>
               </div>
               <div className="p-4 space-y-3">
                 <textarea
                   value={refundHandleRemark}
                   onChange={e => setRefundHandleRemark(e.target.value)}
                   placeholder={refundHandleAction === 'approve' ? '退款说明（选填）' : '请输入拒绝原因'}
                   rows={3}
                   className="w-full px-3 py-2 text-sm bg-muted/30 border border-border/50 rounded-lg resize-none focus:outline-none focus:border-foreground/30 text-foreground"
                 />
                 <motion.button
                   whileTap={{ scale: 0.98 }}
                   onClick={submitRefundHandle}
                   className="w-full h-11 rounded-full bg-foreground text-background text-sm font-medium"
                 >
                   确认{refundHandleAction === 'approve' ? '同意' : '拒绝'}
                 </motion.button>
               </div>
             </motion.div>
           </>
         )}
       </AnimatePresence>
     </div>
   )
 }
