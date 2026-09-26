import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Gift, Clock, Tag, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useCoupons } from '@/hooks/useCoupons'
import { useWallet } from '@/hooks/useWallet'
import { toast } from 'sonner'
import { calcCouponDiscount } from '@/data/coupon'
import { usePageBack } from '@/hooks/useNavigationStack'

const CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'newbie', name: '新人专享' },
  { id: 'fullReduce', name: '满减' },
  { id: 'delivery', name: '配送券' },
  { id: 'vip', name: '会员专享' },
]

// 给 mock 券加类别和图标
function getCategoryOfCoupon(id: string, name: string): string {
  if (name.includes('新人')) return 'newbie'
  if (name.includes('配送') || id.startsWith('delivery')) return 'delivery'
  if (id.startsWith('vip')) return 'vip'
  return 'fullReduce'
}

export default function CouponCenterPage() {
  const pageBack = usePageBack()
  const { unclaimedCoupons, claimCoupon, availableCoupons, usedCoupons, expiredCoupons } = useCoupons()
  const { memberInfo } = useWallet()
  const [category, setCategory] = useState('all')
  const [tab, setTab] = useState('plaza')

  const filtered = useMemo(() => {
    const list = tab === 'plaza' ? unclaimedCoupons : availableCoupons
    if (category === 'all') return list
    return list.filter(c => getCategoryOfCoupon(c.id, c.name) === category)
  }, [tab, unclaimedCoupons, availableCoupons, category])

  const handleClaim = (id: string) => {
    const coupon = unclaimedCoupons.find(c => c.id === id)
    if (!coupon) return
    if (getCategoryOfCoupon(coupon.id, coupon.name) === 'vip' && !memberInfo.isVip) {
      toast.info('请先开通会员后再领取')
      return
    }
    claimCoupon(id)
    toast.success('领取成功')
  }

  const myCoupons = tab === 'my' ? availableCoupons : usedCoupons
  const myLabel = tab === 'my' ? '未使用' : '已使用'

  return (
    <div className="flex flex-col h-dvh bg-muted/30">
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={pageBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">领券中心</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="sticky top-12 bg-background/80 backdrop-blur-md z-10 border-b border-border/40">
            <TabsList className="w-full grid grid-cols-2 bg-transparent h-12 rounded-none">
              <TabsTrigger value="plaza" className="text-sm">领券广场</TabsTrigger>
              <TabsTrigger value="my" className="text-sm">
                我的红包 · {availableCoupons.length}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 分类标签（仅广场） */}
          {tab === 'plaza' && (
            <div className="px-4 py-3 overflow-x-auto">
              <div className="flex gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                      category === cat.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground border border-border/60'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <TabsContent value={tab} className="mt-0 pt-4 space-y-3 px-4">
            {filtered.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground text-sm">
                <Gift className="size-12 mx-auto mb-3 opacity-30" />
                <p>暂无可领红包</p>
              </div>
            ) : (
              filtered.map((coupon, i) => {
                const cat = getCategoryOfCoupon(coupon.id, coupon.name)
                const isVipOnly = cat === 'vip' && !memberInfo.isVip
                const discount = coupon.type === 'discount'
                  ? `${coupon.value * 10}折`
                  : `¥${coupon.value}`
                return (
                  <motion.div
                    key={coupon.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`relative bg-card rounded-xl border overflow-hidden flex ${
                      isVipOnly ? 'opacity-60' : ''
                    }`}
                  >
                    {/* 左：金额 */}
                    <div className="w-28 bg-gradient-to-br from-primary to-orange-400 text-white flex flex-col items-center justify-center py-4 relative">
                      <span className="text-xs opacity-80">
                        {coupon.type === 'discount' ? '折扣' : ''}
                      </span>
                      <span className="text-3xl font-bold tabular-nums leading-none">
                        {discount}
                      </span>
                      <span className="text-[10px] opacity-80 mt-1">
                        {coupon.minAmount > 0 ? `满${coupon.minAmount}可用` : '无门槛'}
                      </span>
                      {/* 锯齿边 */}
                      <div className="absolute right-0 top-2 bottom-2 w-px">
                        {[...Array(6)].map((_, idx) => (
                          <div
                            key={idx}
                            className="absolute w-1.5 h-1.5 -right-[3px] rounded-full bg-muted/30"
                            style={{ top: `${idx * 20}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* 右：信息+按钮 */}
                    <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-sm font-semibold truncate">{coupon.name}</p>
                          {cat === 'newbie' && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-destructive/10 text-destructive rounded">
                              新人
                            </span>
                          )}
                          {cat === 'vip' && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/10 text-yellow-700 rounded">
                              会员
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{coupon.scope}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="size-3" />
                          有效期至 {coupon.expireDate}
                        </p>
                      </div>
                      {tab === 'plaza' ? (
                        <button
                          onClick={() => handleClaim(coupon.id)}
                          disabled={isVipOnly}
                          className={`ml-auto px-4 h-7 rounded-full text-xs font-medium ${
                            isVipOnly
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary text-primary-foreground active:scale-95 transition-transform'
                          }`}
                        >
                          {isVipOnly ? '会员专享' : '立即领取'}
                        </button>
                      ) : (
                        <div className="ml-auto text-xs text-muted-foreground">
                          可抵扣 ¥{calcCouponDiscount(coupon, 100).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })
            )}
          </TabsContent>
        </Tabs>

        {/* 底部说明 */}
        <div className="mt-6 px-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            · 红包与店铺满减可叠加使用<br />
            · 每笔订单仅限使用一张红包<br />
            · 红包过期自动失效，不退还<br />
            · 会员专享红包需开通会员后领取
          </p>
        </div>
      </div>
    </div>
  )
}
