import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Home, Receipt, Clock, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/hooks/useOrders'

export default function PaymentSuccessPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const orderId = params.get('orderId') || ''
  const { orders } = useOrders()
  const [showContent, setShowContent] = useState(false)

  const order = useMemo(() => orders.find(o => o.id === orderId), [orders, orderId])

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 600)
    return () => clearTimeout(t)
  }, [])

  const payMethodLabel = (method: string) => {
    const map: Record<string, string> = {
      wechat: '微信支付',
      alipay: '支付宝',
      balance: '余额支付',
      cod: '货到付款',
    }
    return map[method] || method
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部成功动画区 */}
      <div className="flex flex-col items-center justify-center pt-16 pb-10">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="relative size-24 rounded-full bg-foreground flex items-center justify-center"
        >
          <motion.svg
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
            viewBox="0 0 48 48"
            className="size-12"
          >
            <motion.path
              d="M12 24 L21 33 L36 15"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 100 }}
            />
          </motion.svg>
          {/* 涟漪 */}
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0.3, 0], scale: [1, 1.4] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
            className="absolute inset-0 rounded-full border-2 border-foreground/30"
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 text-xl font-bold"
        >
          支付成功
        </motion.p>
        {order && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="mt-2 text-3xl font-bold tabular-nums tracking-tight"
          >
            ¥{order.finalAmount.toFixed(2)}
          </motion.p>
        )}
      </div>

      {/* 订单信息卡 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-4 bg-card rounded-2xl border border-border/50 p-4 space-y-3"
      >
        {order && (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <span className="text-sm text-muted-foreground">订单号</span>
              <span className="text-sm font-medium tabular-nums">{order.id}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Clock className="size-4 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">预计送达</p>
                <p className="text-xs text-muted-foreground">
                  {order.estimatedTime || '约 30-45 分钟'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                <MapPin className="size-4 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{order.address.name} · {order.address.phone}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {order.address.address} {order.address.detail}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-sm text-muted-foreground">支付方式</span>
              <span className="text-sm font-medium">{payMethodLabel(order.paymentMethod)}</span>
            </div>
            {order.paidAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">支付时间</span>
                <span className="text-sm tabular-nums">
                  {new Date(order.paidAt).toLocaleString('zh-CN', { hour12: false })}
                </span>
              </div>
            )}
          </>
        )}
      </motion.div>

      <div className="flex-1" />

      {/* 底部按钮 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        className="px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-3"
      >
        <Button
          variant="outline"
          className="flex-1 h-12 rounded-full"
          onClick={() => navigate('/customer', { replace: true })}
        >
          <Home className="size-4 mr-2" />
          再逛逛
        </Button>
        <Button
          className="flex-1 h-12 rounded-full"
          onClick={() => navigate(`/customer/order/${orderId}/track`, { replace: true })}
        >
          <Receipt className="size-4 mr-2" />
          查看订单
        </Button>
      </motion.div>
    </div>
  )
}
