import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Crown, Gift, Wallet, ChevronRight, Star, Shield,
  Zap, Clock, Award, Plus, Minus, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useWallet } from '@/hooks/useWallet'
import { useCoupons } from '@/hooks/useCoupons'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { usePageBack, useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'

const RECHARGE_OPTIONS = [20, 50, 100, 200, 500, 1000]

export default function MemberCenterPage() {
  const pageBack = usePageBack()
  const navigateReplace = useNavigateReplace()
  const navigatePush = useNavigatePush()
  const {
    memberInfo, currentLevelInfo, nextLevelInfo, levelProgress,
    openVip, balance, walletRecords, recharge,
  } = useWallet()
  const { availableCoupons, usedCoupons, expiredCoupons, claimCoupon, unclaimedCoupons } = useCoupons()
  const [tab, setTab] = useState('available')
  const [showRecharge, setShowRecharge] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState(50)

  const couponList = useMemo(() => {
    if (tab === 'available') return availableCoupons
    if (tab === 'used') return usedCoupons
    return expiredCoupons
  }, [tab, availableCoupons, usedCoupons, expiredCoupons])

  const handleClaim = (id: string) => {
    claimCoupon(id)
    toast.success('领取成功')
  }

  const handleRecharge = () => {
    if (rechargeAmount <= 0) return
    // 充值走收银台：type=recharge + amount，支付成功后由收银台调用 recharge 到账
    navigateReplace(`/payment?type=recharge&amount=${rechargeAmount}`)
    setShowRecharge(false)
  }

  const handleOpenVip = () => {
    openVip(1)
    toast.success('已开通会员，享受更多权益')
  }

  const recordsRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col h-dvh bg-muted/30">
      {/* Header */}
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={pageBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">会员中心</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* 会员卡片 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4"
        >
          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-primary to-orange-400 text-white shadow-md">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
            <div className="absolute -right-16 top-10 size-24 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Crown className="size-5" />
                  <span className="text-sm font-semibold">{currentLevelInfo.name}</span>
                </div>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {memberInfo.points} <span className="text-sm font-normal opacity-80">成长值</span>
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs">
                {memberInfo.isVip ? 'VIP 会员' : '普通用户'}
              </span>
            </div>

            {/* 进度条 */}
            <div className="relative mt-5">
              <div className="flex items-center justify-between text-xs opacity-80 mb-1.5">
                <span>成长值 {memberInfo.points}</span>
                <span>{nextLevelInfo ? `距 ${nextLevelInfo.name} 还差 ${nextLevelInfo.threshold - memberInfo.points}` : '已达最高等级'}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-white rounded-full"
                />
              </div>
            </div>

            {!memberInfo.isVip && (
              <button
                onClick={handleOpenVip}
                className="mt-4 w-full h-10 rounded-full bg-white text-primary font-semibold text-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
              >
                <Star className="size-4" />
                立即开通会员 · ¥15/月
              </button>
            )}
          </div>
        </motion.div>

        {/* 钱包余额 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-4 mt-4 bg-card rounded-2xl border border-border/50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">我的余额</p>
                <p className="text-xl font-bold tabular-nums">¥{balance.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full h-9 px-4" onClick={() => setShowRecharge(true)}>
                充值
              </Button>
              <Button size="sm" variant="outline" className="rounded-full h-9 px-4" onClick={() => recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                账单
              </Button>
            </div>
          </div>
        </motion.div>

        {/* 会员权益 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 mt-4"
        >
          <h3 className="text-sm font-semibold mb-3 px-1">会员权益</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Gift, name: '专属红包', desc: '每月领券' },
              { icon: Zap, name: '配送优惠', desc: '免配送费' },
              { icon: Shield, name: '专属客服', desc: '优先响应' },
              { icon: Award, name: '积分加速', desc: `${[1, 1.2, 1.5, 2, 3][memberInfo.level - 1] || 1} 倍` },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <div
                  key={item.name}
                  className="bg-card rounded-xl border border-border/50 p-3 text-center"
                >
                  <div className="size-8 mx-auto rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* 红包 Tab */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-4 mt-6"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-semibold">我的红包</h3>
            <button
              onClick={() => navigatePush('/customer/coupon-center')}
              className="text-xs text-primary flex items-center gap-0.5"
            >
              去领券 <ChevronRight className="size-3.5" />
            </button>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-muted/50">
              <TabsTrigger value="available" className="text-xs">
                未使用 · {availableCoupons.length}
              </TabsTrigger>
              <TabsTrigger value="used" className="text-xs">
                已使用 · {usedCoupons.length}
              </TabsTrigger>
              <TabsTrigger value="expired" className="text-xs">
                已过期 · {expiredCoupons.length}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-3 space-y-3">
              {couponList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  暂无{tab === 'available' ? '可用' : tab === 'used' ? '已使用' : '已过期'}红包
                </div>
              ) : (
                couponList.map(coupon => (
                  <div
                    key={coupon.id}
                    className={`relative bg-card rounded-xl border overflow-hidden flex ${
                      tab !== 'available' ? 'opacity-50' : 'border-border/50'
                    }`}
                  >
                    {/* 左侧金额 */}
                    <div className="w-24 bg-primary/5 border-r border-dashed border-border flex flex-col items-center justify-center py-3 relative">
                      <span className="text-xs text-primary">¥</span>
                      <span className="text-2xl font-bold text-primary tabular-nums leading-none">
                        {coupon.type === 'discount' ? `${coupon.value * 10}折` : coupon.value}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">
                        {coupon.minAmount > 0 ? `满${coupon.minAmount}可用` : '无门槛'}
                      </span>
                    </div>
                    {/* 右侧信息 */}
                    <div className="flex-1 p-3 min-w-0">
                      <p className="text-sm font-medium truncate">{coupon.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{coupon.scope}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">有效期至 {coupon.expireDate}</p>
                    </div>
                    {tab === 'available' && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary">
                        可用
                      </div>
                    )}
                    {tab === 'used' && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                        已使用
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* 等级列表 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mx-4 mt-6"
        >
          <h3 className="text-sm font-semibold mb-3 px-1">等级说明</h3>
          <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/40">
            {currentLevelInfo.privileges.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Check className="size-4 text-primary shrink-0" />
                <span className="text-sm">{p}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 最近交易 */}
        {walletRecords.length > 0 && (
          <motion.div
            ref={recordsRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mx-4 mt-6"
          >
            <h3 className="text-sm font-semibold mb-3 px-1">最近交易</h3>
            <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/40">
              {walletRecords.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                    r.amount > 0 ? 'bg-success/10' : 'bg-muted'
                  }`}>
                    {r.amount > 0 ? <Plus className="size-4 text-success" /> : <Minus className="size-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(r.createdAt, 'yyyy-MM-dd HH:mm')}
                      {r.desc ? ` · ${r.desc}` : ''}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${
                    r.amount > 0 ? 'text-success' : 'text-foreground'
                  }`}>
                    {r.amount > 0 ? '+' : ''}{r.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* 充值弹窗 */}
      <AnimatePresence>
        {showRecharge && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowRecharge(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card rounded-t-3xl z-50 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold">余额充值</h3>
                <button
                  onClick={() => setShowRecharge(false)}
                  className="size-8 flex items-center justify-center text-muted-foreground"
                >
                  ✕
                </button>
              </div>

              <p className="text-3xl font-bold mb-4 tabular-nums">¥{rechargeAmount.toFixed(2)}</p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {RECHARGE_OPTIONS.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setRechargeAmount(amt)}
                    className={`py-3 rounded-xl text-center border transition-all ${
                      rechargeAmount === amt
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/60 text-foreground active:bg-muted/50'
                    }`}
                  >
                    <p className="text-base font-semibold tabular-nums">¥{amt}</p>
                    {amt >= 100 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">充{amt}送{Math.floor(amt / 50)}</p>
                    )}
                  </button>
                ))}
              </div>

              <Button
                className="w-full h-12 rounded-full text-base font-medium"
                onClick={handleRecharge}
              >
                确认充值
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
