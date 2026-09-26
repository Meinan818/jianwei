import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Ticket, Tag, Percent, Gift, Clock, CheckCircle, Lock } from 'lucide-react'
import { useCoupons } from '@/hooks/useCoupons'
import { usePageBack } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import type { ICoupon } from '@/data/coupon'

const TABS = [
  { key: 'claim', label: '可领取' },
  { key: 'available', label: '未使用' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已过期' },
]

export default function CouponPage() {
  const pageBack = usePageBack()
  const { unclaimedCoupons, availableCoupons, usedCoupons, expiredCoupons, claimCoupon } = useCoupons()
  const [activeTab, setActiveTab] = useState('claim')

  const getList = () => {
    switch (activeTab) {
      case 'claim': return unclaimedCoupons
      case 'available': return availableCoupons
      case 'used': return usedCoupons
      case 'expired': return expiredCoupons
      default: return []
    }
  }

  const list = getList()

  const handleClaim = (id: string, name: string) => {
    claimCoupon(id)
    toast.success(`已领取「${name}」`)
  }

  const CouponCard = ({ coupon, showClaim }: { coupon: ICoupon; showClaim: boolean }) => {
    const isDisabled = coupon.used || coupon.expired
    const valueText = coupon.type === 'discount'
      ? `${Math.round(coupon.value * 10)}折`
      : `¥${coupon.value}`
    const conditionText = coupon.minAmount > 0 ? `满${coupon.minAmount}元可用` : '无门槛'
    const CouponIcon = coupon.type === 'discount' ? Percent : coupon.type === 'fullReduce' ? Tag : Gift

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative flex rounded-xl border overflow-hidden ${
          isDisabled ? 'opacity-50 border-border/50' : 'border-border/80 bg-card'
        }`}
      >
        {/* 左侧金额区 */}
        <div className="relative w-28 shrink-0 bg-foreground text-background flex flex-col items-center justify-center py-4">
          <div className="flex items-baseline gap-0.5">
            {coupon.type !== 'discount' && <span className="text-sm font-medium">¥</span>}
            <span className="text-3xl font-bold tracking-tight">{coupon.type === 'discount' ? Math.round(coupon.value * 10) : coupon.value}</span>
            {coupon.type === 'discount' && <span className="text-sm font-medium">折</span>}
          </div>
          <div className="text-xs text-background/70 mt-0.5">{conditionText}</div>
          {/* 锯齿 */}
          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 size-3 rounded-full bg-background" />
        </div>

        {/* 右侧信息区 */}
        <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <CouponIcon className="size-3.5 text-foreground/70" />
              <span className="text-sm font-semibold text-foreground truncate">{coupon.name}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">{coupon.scope}</p>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">有效期至 {coupon.expireDate}</span>
            {showClaim ? (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => handleClaim(coupon.id, coupon.name)}
                className="px-3 h-7 rounded-full bg-foreground text-background text-xs font-medium flex items-center gap-1"
              >
                <Gift className="size-3" />
                领取
              </motion.button>
            ) : coupon.used ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="size-3" />
                已使用
              </span>
            ) : coupon.expired ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" />
                已过期
              </span>
            ) : null}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 border-b border-border/30 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => pageBack()}
          className="size-8 rounded-full flex items-center justify-center -ml-1"
        >
          <ChevronLeft className="size-5 text-foreground" />
        </motion.button>
        <h1 className="flex-1 text-center text-base font-semibold text-foreground">优惠券</h1>
        <div className="size-8" />
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-border/30 bg-card">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm relative transition-colors ${
              activeTab === tab.key ? 'text-foreground font-semibold' : 'text-muted-foreground'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="couponTabUnderline"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-foreground rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {list.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center pt-20 text-muted-foreground"
            >
              <Ticket className="size-12 mb-3 opacity-30" />
              <p className="text-sm">
                {activeTab === 'claim' && '暂无可领取的优惠券'}
                {activeTab === 'available' && '暂无可用优惠券'}
                {activeTab === 'used' && '暂无已使用的优惠券'}
                {activeTab === 'expired' && '暂无已过期的优惠券'}
              </p>
              {activeTab === 'available' && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('claim')}
                  className="mt-4 px-5 h-9 rounded-full bg-foreground text-background text-sm font-medium"
                >
                  去领券
                </motion.button>
              )}
            </motion.div>
          ) : (
            list.map(coupon => (
              <CouponCard key={coupon.id} coupon={coupon} showClaim={activeTab === 'claim'} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
