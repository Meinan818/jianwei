import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Check, Wallet, CreditCard, Clock, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useOrders } from '@/hooks/useOrders'
import { useWallet } from '@/hooks/useWallet'
import { useCoupons } from '@/hooks/useCoupons'
import { MEMBERSHIP_DAYS, MEMBERSHIP_PRICE } from '@/data/membership'
import { toast } from 'sonner'
import { useNavigateReplace, usePageBack } from '@/hooks/useNavigationStack'

const PAYMENT_METHODS = [
  { id: 'wechat', name: '微信支付', desc: '推荐使用', icon: '💬' },
  { id: 'alipay', name: '支付宝', desc: '快捷支付', icon: '🅰️' },
  { id: 'balance', name: '余额支付', desc: '钱包余额', icon: '💰' },
  { id: 'cod', name: '货到付款', desc: '送达后支付', icon: '📦' },
]

export default function PaymentPage() {
  const navigateReplace = useNavigateReplace()
  const pageBack = usePageBack()
  const [params, setParams] = useSearchParams()
  const orderId = params.get('orderId') || ''
  const payType = params.get('type') || 'order' // order / recharge / membership
  const rechargeAmountRaw = params.get('amount') || '0'
  const rechargeAmount = Number(rechargeAmountRaw) || 0
  const rechargeAttempt = params.get('attempt') || ''
  const { orders, payOrder, cancelPendingOrder, cleanupExpiredPending } = useOrders()
  const { balance, payOrderWithBalance, addPointsAndGrowth, verifyPayPassword, recharge, purchaseMembership } = useWallet()
  const { getCoupon, markUsed } = useCoupons()

  const isRecharge = payType === 'recharge'
  const isMembership = payType === 'membership'
  const isOrderPayment = !isRecharge && !isMembership
  // 支付金额：订单模式取订单实付；充值模式取 amount 参数
  const payAmount = isMembership ? MEMBERSHIP_PRICE : isRecharge ? rechargeAmount : (orders.find(o => o.id === orderId)?.finalAmount || 0)

  const [method, setMethod] = useState('wechat')
  const [processing, setProcessing] = useState(false)
  const paymentInFlight = useRef(false)
  const rechargeAttemptRef = useRef(
    rechargeAttempt || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `legacy-${rechargeAmount}-${Date.now()}`),
  )
  const [showPayPwd, setShowPayPwd] = useState(false)
  const [payPwdValue, setPayPwdValue] = useState('')
  const pwdRef = useRef<HTMLInputElement>(null)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (isMembership && !rechargeAttempt) {
      const next = new URLSearchParams(params)
      next.set('attempt', rechargeAttemptRef.current)
      setParams(next, { replace: true })
    }
  }, [isMembership, rechargeAttempt, params, setParams])

  const order = useMemo(() => {
    if (!isOrderPayment) return null
    return orders.find(o => o.id === orderId) || null
  }, [isOrderPayment, orders, orderId])

  // 充值模式下的支付方式：禁用余额支付（不能用余额充余额）
  const availableMethods = isRecharge
    ? PAYMENT_METHODS.filter(m => m.id !== 'balance' && m.id !== 'cod')
    : isMembership ? PAYMENT_METHODS.filter(m => m.id !== 'cod') : PAYMENT_METHODS

  // 倒计时
  useEffect(() => {
    if (!order || order.status !== 'pending_payment' || !order.payExpireAt) return
    const tick = () => {
      const remain = Math.max(0, Math.floor((order.payExpireAt! - Date.now()) / 1000))
      setCountdown(remain)
      if (remain <= 0) {
        cleanupExpiredPending()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [order, cleanupExpiredPending])

  // 自动清理超时
  useEffect(() => {
    cleanupExpiredPending()
  }, [cleanupExpiredPending])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const handlePay = async () => {
    if (processing) return
    if (isOrderPayment && !order) return
    if (method === 'balance') {
      if (balance < payAmount) {
        toast.info('余额不足，请选择其他支付方式')
        return
      }
      // 余额支付先验密码
      setShowPayPwd(true)
      setPayPwdValue('')
      setTimeout(() => pwdRef.current?.focus(), 100)
      return
    }
    await doPay()
  }

  const confirmPayWithPwd = async () => {
    if (payPwdValue.length !== 6) return
    if (!verifyPayPassword(payPwdValue)) {
      toast.error('支付密码错误')
      setPayPwdValue('')
      return
    }
    setShowPayPwd(false)
    await doPay()
  }

  const doPay = async () => {
    // state 禁用按钮要等重渲染，ref 当场拦住同一帧内的重复点击。
    if (paymentInFlight.current) return
    paymentInFlight.current = true
    setProcessing(true)
    try {
      // 模拟支付处理延时
      await new Promise(r => setTimeout(r, 1200))
      if (isMembership) {
        const result = await purchaseMembership(method, rechargeAttempt || rechargeAttemptRef.current)
        if (!result.success) { toast.error(result.msg); return }
        navigateReplace('/customer/member')
        toast.success(result.msg)
        return
      }
      let balanceConfirmed = false
      if (method === 'balance') {
        if (!order) return
        const ok = await payOrderWithBalance(order.id, payAmount)
        if (!ok) {
          toast.error('付款未确认，请检查网络后重试')
          return
        }
        balanceConfirmed = true
      }
      if (isRecharge) {
        // 充值模式：支付成功后调用 recharge 到账
        const ok = await recharge(rechargeAmount, method, rechargeAttemptRef.current)
        if (!ok) {
          toast.error('充值未确认，请检查网络后重试')
          return
        }
        // 充值成功 → 跳回会员中心
        navigateReplace('/customer/member')
        setTimeout(() => {
          try { toast.success(`充值成功 ¥${rechargeAmount.toFixed(2)}`) } catch { /* ignore */ }
        }, 0)
        return
      }
      // 订单支付模式
      if (!order) {
        return
      }
      const paid = payOrder(order.id, method)
      // 余额支付的订单已经由数据库事务推进；Realtime 比本地更早返回时，payOrder 可能得到 null。
      if (!paid && !balanceConfirmed) {
        toast.error('支付失败，请重试')
        return
      }
      // ✅ 支付成功立即跳转，任何后置动作失败都不能阻断跳转
      const targetOrderId = order.id
      navigateReplace(`/payment/success?orderId=${targetOrderId}`)
      // 后置动作：各自 try/catch 隔离，失败不影响主流程
      setTimeout(() => {
        try {
          if (order.couponInfo?.couponId) {
            markUsed(order.couponInfo.couponId)
          }
        } catch {
          /* ignore */
        }
        try {
          addPointsAndGrowth(order.finalAmount, targetOrderId)
        } catch {
          /* ignore */
        }
        try {
          toast.success('支付成功')
        } catch {
          /* ignore */
        }
      }, 0)
    } catch {
      toast.error(isMembership ? '会员开通未确认，请检查网络后重试' : '付款未确认，请稍后重试')
    } finally {
      paymentInFlight.current = false
      setProcessing(false)
    }
  }

  const handleCancel = () => {
    if (!order) return
    cancelPendingOrder(order.id, '用户取消')
    toast.info('订单已取消')
    navigateReplace('/customer/orders')
  }

  // ✅ 守卫逻辑：
  // 充值模式：amount>0 正常显示；amount<=0 → 返回会员中心
  // 订单模式：pending_payment → 正常；已支付→成功页；取消/不存在→订单列表
  useEffect(() => {
    if (isMembership) return
    if (isRecharge) {
      if (rechargeAmount <= 0) {
        navigateReplace('/customer/member')
      }
      return
    }
    if (!order) {
      navigateReplace('/customer/orders')
      return
    }
    if (order.status === 'pending_payment') return
    // 已支付或已完成 → 去成功页；已取消 → 去订单列表
    if (order.status === 'cancelled') {
      navigateReplace('/customer/orders')
    } else {
      navigateReplace(`/payment/success?orderId=${order.id}`)
    }
  }, [isMembership, isRecharge, rechargeAmount, order, navigateReplace])

  if (isOrderPayment && !order) {
    return (
      <div className="flex flex-col h-dvh bg-muted/30">
        <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50">
          <Button variant="ghost" size="icon" className="size-8" onClick={pageBack}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="flex-1 text-center text-sm font-medium">收银台</h1>
          <div className="w-8" />
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="size-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
        </div>
      </div>
    )
  }

  // 充值模式：直接进入支付态；订单模式：pending_payment 才显示收银台
  const isPayable = isMembership || (isRecharge
    ? rechargeAmount > 0
    : !!order && order.status === 'pending_payment')

  const couponDiscount = order?.couponDiscount || 0
  const promoDiscount = order?.promoDiscount || 0

  return (
    <div className="flex flex-col h-dvh bg-muted/30">
      {/* Header */}
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" disabled={processing} onClick={pageBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">收银台</h1>
        <div className="w-8" />
      </div>

      {!isPayable && isOrderPayment ? (
        // 状态异常或跳转中：显示骨架 loading，由 useEffect 自动重定向，绝不出现「订单状态已变更」死页
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="size-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
          <p className="text-xs text-muted-foreground">加载中...</p>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto pb-28">
        {/* 金额 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border-b border-border/50 py-8 text-center"
        >
          <p className="text-xs text-muted-foreground mb-2">支付金额（元）</p>
          <p className="text-4xl font-bold tabular-nums tracking-tight">¥{payAmount.toFixed(2)}</p>
          {isMembership && <div className="mt-3 text-sm"><p>会员开通 · {MEMBERSHIP_DAYS} 天</p><p className="mt-1 text-xs text-muted-foreground">演示支付，不产生真实扣费，不自动续费</p></div>}
          {isOrderPayment && countdown > 0 && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="size-3.5" />
              支付剩余 {formatTime(countdown)}，超时自动取消
            </p>
          )}
          {isOrderPayment && countdown === 0 && (
            <p className="mt-2 text-xs text-destructive flex items-center justify-center gap-1">
              <AlertTriangle className="size-3.5" />
              支付已超时
            </p>
          )}
        </motion.div>

        {/* 订单摘要（仅订单模式显示） */}
        {isOrderPayment && order && (
          <div className="mx-3 mt-3 bg-card rounded-xl border border-border/50 px-4 py-3 text-sm space-y-2">
            <p className="text-xs text-muted-foreground">订单号 {order.id}</p>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">商品金额</span>
            <span className="tabular-nums">¥{order.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">配送费</span>
            <span className="tabular-nums">¥{order.deliveryFee.toFixed(2)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">满减优惠</span>
              <span className="tabular-nums text-foreground">-¥{promoDiscount.toFixed(2)}</span>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">红包/优惠券</span>
              <span className="tabular-nums text-foreground">-¥{couponDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="font-medium">实付</span>
            <span className="text-lg font-semibold tabular-nums">¥{order.finalAmount.toFixed(2)}</span>
          </div>
        </div>
        )}

        {/* 支付方式 */}
        <div className="mx-3 mt-4">
          <h3 className="text-xs text-muted-foreground mb-2 px-1">选择支付方式</h3>
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            {availableMethods.map((m, i) => {
              const disabled = m.id === 'balance' && balance < payAmount
              return (
                <button
                  key={m.id}
                  disabled={disabled || processing}
                  onClick={() => !disabled && setMethod(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 last:border-0 text-left transition-colors ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'active:bg-muted/50'
                  }`}
                >
                  <span className="text-xl shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.id === 'balance'
                        ? `余额 ¥${balance.toFixed(2)}${disabled ? '（余额不足）' : ''}`
                        : m.desc}
                    </p>
                  </div>
                  <div
                    className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      method === m.id ? 'border-foreground bg-foreground' : 'border-border'
                    }`}
                  >
                    {method === m.id && <Check className="size-3 text-background" strokeWidth={4} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

          {/* 取消支付 */}
          {isOrderPayment ? (
            <div className="mx-3 mt-4">
              <button
                onClick={handleCancel}
                disabled={processing}
                className="w-full py-3 text-sm text-muted-foreground active:opacity-70"
              >
                取消订单
              </button>
            </div>
          ) : (
            <div className="mx-3 mt-4">
              <button
                onClick={() => isMembership ? navigateReplace('/customer/member') : pageBack()}
                disabled={processing}
                className="w-full py-3 text-sm text-muted-foreground active:opacity-70"
              >
                {isMembership ? '取消开通' : '取消充值'}
              </button>
            </div>
          )}
      </div>
      )}

      {/* 底部确认 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border/50 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-20">
        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30"
            >
              <div className="flex items-center gap-3">
                <div className="size-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
                <span className="text-sm">支付处理中...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          className="w-full h-12 rounded-full text-base font-medium"
          onClick={handlePay}
          disabled={processing || (isOrderPayment && countdown === 0) || !method}
        >
          {isOrderPayment && countdown === 0 ? '订单已超时' : `确认支付 ¥${payAmount.toFixed(2)}`}
        </Button>
      </div>
      {/* /isPayable 条件结束 — 底部按钮栏在骨架态也不显示，统一由 loading 层接管 */}
      <Dialog open={showPayPwd} onOpenChange={setShowPayPwd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>输入支付密码</DialogTitle>
            <DialogDescription>余额支付 ¥{payAmount.toFixed(2)}，演示支付密码为 123456</DialogDescription>
          </DialogHeader>
          <input
            ref={pwdRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            aria-label="支付密码"
            placeholder="请输入6位支付密码"
            value={payPwdValue}
            onChange={e => setPayPwdValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter') void confirmPayWithPwd() }}
            className="h-12 w-full rounded-xl border border-border bg-muted/30 px-4 text-center text-lg tracking-widest outline-none focus:border-primary"
          />
          <Button onClick={confirmPayWithPwd} disabled={processing || payPwdValue.length !== 6}>
            确认付款
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
