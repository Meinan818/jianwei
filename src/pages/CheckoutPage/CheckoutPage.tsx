import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, MapPin, StickyNote, Utensils, CreditCard, Check, X, Minus, Plus, Ticket, Tag, ChevronDown, ShoppingCart, Clock, Wallet, Gift, Truck } from 'lucide-react'
import TopNavBar from '@/components/TopNavBar'
import { useCart } from '@/hooks/useCart'
import { useOrders } from '@/hooks/useOrders'
import { useAddresses } from '@/hooks/useAddresses'
import { useCoupons } from '@/hooks/useCoupons'
import { useShopStatus } from '@/hooks/useShopStatus'
import { useAuth } from '@/hooks/useAuth'
import { useWallet } from '@/hooks/useWallet'
import { useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { getAllShops, getShopActivities } from '@/data/shops'
import { calcCouponDiscount, calcShopDiscount } from '@/data/coupon'
import { toast } from 'sonner'
import { Image } from '@/components/ui/image'

export default function CheckoutPage() {
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const { cart, totalAmount, clearCart } = useCart()
  const { createPendingOrder } = useOrders()
  const { addresses, defaultAddress } = useAddresses()
  const { availableCoupons, markUsed, getCoupon } = useCoupons()
  const { isShopOpen } = useShopStatus()
  const { isLoggedIn, user } = useAuth()
  const { balance } = useWallet()

  const [selectedAddrId, setSelectedAddrId] = useState('')
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery')
  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'appointment'>('instant')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [remark, setRemark] = useState('')
  const [utensils, setUtensils] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('wechat')
  const [showAddrSheet, setShowAddrSheet] = useState(false)
  const [showCouponSheet, setShowCouponSheet] = useState(false)
  const [showAppointmentSheet, setShowAppointmentSheet] = useState(false)
  const [selectedCouponId, setSelectedCouponId] = useState('') // 空串表示不使用优惠券
  const [showSuccess, setShowSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (defaultAddress) {
      setSelectedAddrId(defaultAddress.id)
    }
  }, [defaultAddress])

  const selectedAddr = addresses.find(a => a.id === selectedAddrId)

  const shop = cart.shopId ? getAllShops().find(s => s.id === cart.shopId) : null
  const shopInfo = shop ? { id: shop.id, name: shop.name, cover: shop.cover } : null
  const deliveryFee = shop?.deliveryFee ?? 5
  const packingFee = shop?.packingFee ?? 0

  // 店铺营销活动（含 mock 默认 + 商家自定义，真实联动）
  const shopActivities = cart.shopId ? getShopActivities(cart.shopId) : []

  // 预约时段
  const appointmentSlots = shop?.appointmentSlots || generateAppointmentSlots()

  function generateAppointmentSlots() {
    const slots: { label: string; available: boolean }[] = []
    const now = new Date()
    const startHour = Math.max(now.getHours() + 1, 10)
    for (let h = startHour; h < 21; h++) {
      for (let m = 0; m < 60; m += 30) {
        const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}-${String(m + 30 >= 60 ? h + 1 : h).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`
        slots.push({ label, available: true })
      }
    }
    return slots.slice(0, 12)
  }

  // 新客立减
  const isNewUser = user && user.id ? user.id.startsWith('guest') : true
  const newUserActivity = shopActivities.find(a => a.type === 'newUser' && a.active)
  const newUserDiscount = isNewUser && newUserActivity ? (newUserActivity.newUserAmount || 0) : 0

  // 免配送费
  const freeDeliveryActivity = shopActivities.find(a => a.type === 'freeDelivery' && a.active)
  const freeDeliveryMin = freeDeliveryActivity?.freeDeliveryMin ?? 0
  const freeDeliveryDiscount = freeDeliveryActivity && totalAmount >= freeDeliveryMin ? deliveryFee : 0

  // 店铺折扣（整单折扣）
  const shopDiscountActivity = shopActivities.find(a => a.type === 'discount' && a.active)
  const shopDiscountRate = shopDiscountActivity?.discountRate || 1
  const shopDiscountAmount = shopDiscountActivity ? +(totalAmount * (1 - shopDiscountRate)).toFixed(2) : 0

  // 折扣菜（按菜品折扣，这里简化：购物车中若有折扣菜则按比例扣减）
  const discountDishActivity = shopActivities.find(a => a.type === 'discountDish' && a.active)
  const discountDishAmount = useMemo(() => {
    if (!discountDishActivity) return 0
    const dish = cart.items.find(i => i.dishId === discountDishActivity.dishId)
    if (!dish) return 0
    const rate = discountDishActivity.dishDiscountRate || 1
    return +(dish.basePrice * dish.quantity * (1 - rate)).toFixed(2)
  }, [cart.items, discountDishActivity])

  // 满减计算（从 activities 取）
  const fullReduceActivity = shopActivities.find(a => a.type === 'fullReduce' && a.active)
  const shopPromotion = fullReduceActivity
    ? { thresholds: fullReduceActivity.thresholds || [], discounts: fullReduceActivity.discounts || [], description: fullReduceActivity.description }
    : null
  const promoResult = shopPromotion ? calcShopDiscount(shopPromotion, totalAmount - shopDiscountAmount - discountDishAmount) : { discount: 0, currentTierIndex: -1, nextTierAmount: 0 }
  const promoDiscount = promoResult.discount

  // 优惠券计算
  const selectedCoupon = selectedCouponId ? getCoupon(selectedCouponId) : undefined
  const couponDiscount = selectedCoupon ? calcCouponDiscount(selectedCoupon, totalAmount) : 0

  // 满减 vs 优惠券取最优（不同享）
  const usePromoOnly = promoDiscount >= couponDiscount
  const finalPromoDiscount = usePromoOnly ? promoDiscount : 0
  const finalCouponDiscount = usePromoOnly ? 0 : couponDiscount
  // 总折扣 = 店铺折扣 + 折扣菜 + 满减/优惠券 + 新客立减 + 免配送费
  const totalDiscount = shopDiscountAmount + discountDishAmount + finalPromoDiscount + finalCouponDiscount + newUserDiscount + freeDeliveryDiscount
  const finalAmount = Math.max(0, totalAmount + deliveryFee + packingFee - totalDiscount)
  const finalDeliveryFee = Math.max(0, deliveryFee - freeDeliveryDiscount)

  const canUseCoupon = (couponId: string) => {
    const c = getCoupon(couponId)
    if (!c) return false
    return totalAmount >= c.minAmount
  }

  const handleSubmit = () => {
    if (submitting) return
    if (!isLoggedIn) {
      toast.info('请先登录')
      navigateReplace('/login')
      return
    }
    if (!shopInfo || cart.items.length === 0) {
      toast.info('购物车为空，无法下单')
      return
    }
    if (!isShopOpen(shopInfo.id)) {
      toast.info('商家休息中，暂不可下单')
      return
    }
    if (!selectedAddr && deliveryType === 'delivery') {
      toast.info('请选择收货地址')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      const order = createPendingOrder({
        shopId: shopInfo.id,
        shopName: shopInfo.name,
        shopCover: shopInfo.cover,
         items: cart.items.map(i => ({
           dishId: i.dishId,
           dishName: i.dishName,
           basePrice: i.basePrice,
           finalPrice: i.finalPrice,
           quantity: i.quantity,
           image: i.image,
           specs: i.specs,
           extras: i.extras,
           skuKey: i.skuKey,
         })),
        totalAmount,
        deliveryFee,
        discount: totalDiscount,
        promoDiscount: finalPromoDiscount,
        couponDiscount: finalCouponDiscount,
        couponInfo: finalCouponDiscount > 0 && selectedCoupon
          ? { couponId: selectedCoupon.id, couponName: selectedCoupon.name, discount: finalCouponDiscount }
          : undefined,
        promoInfo: finalPromoDiscount > 0 && shopPromotion
          ? { type: 'fullReduce' as const, description: shopPromotion.description, discount: finalPromoDiscount }
          : { type: 'none' as const, description: '', discount: 0 },
         finalAmount,
         address: selectedAddr
           ? { name: selectedAddr.name, phone: selectedAddr.phone, address: selectedAddr.address, detail: selectedAddr.detail }
           : { name: '到店自取', phone: '', address: '', detail: '' },
         remark,
         utensils,
         packingFee,
         newUserDiscount,
         freeDeliveryDiscount,
          discountDetail: {
            fullReduce: finalPromoDiscount || undefined,
            coupon: finalCouponDiscount || undefined,
            newUser: newUserDiscount || undefined,
            freeDelivery: freeDeliveryDiscount || undefined,
            shopDiscount: shopDiscountAmount || undefined,
            discountDish: discountDishAmount || undefined,
          },
         deliveryMode,
         appointmentTime: deliveryMode === 'appointment' ? appointmentTime : undefined,
         paymentMethod, // 预设支付方式，收银台可更改
         customerId: user.id || 'guest',
      })
      // 注意：优惠券在支付成功后才核销，此处只冻结（不扣），
      // 为简化演示这里暂不冻结，支付成功时再 markUsed
      setSubmitting(false)
      toast.success('订单已创建，请完成支付')
      clearCart()
      navigatePush(`/payment?orderId=${order.id}`)
    }, 600)
  }

  if (!shopInfo) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <TopNavBar title="确认订单" />
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6">
          <div className="size-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <ShoppingCart className="size-10 opacity-40" />
          </div>
          <p className="text-sm text-foreground/60 mb-1">购物车空空如也</p>
          <p className="text-xs text-muted-foreground mb-5">快去挑选美食吧</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigateReplace('/')}
            className="px-6 h-9 rounded-full bg-foreground text-background text-sm font-medium"
          >
            去逛逛
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopNavBar title="确认订单" />
      <div className="flex-1 overflow-y-auto pb-24">
        {/* 地址卡片 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => deliveryType === 'delivery' && setShowAddrSheet(true)}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50"
        >
          {deliveryType === 'delivery' && selectedAddr ? (
            <div className="flex items-start gap-3">
              <MapPin className="size-5 text-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{selectedAddr.name}</span>
                  <span className="text-sm text-muted-foreground">{selectedAddr.phone}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedAddr.address} {selectedAddr.detail}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="size-5" />
              <span className="text-sm">选择收货地址</span>
              <ChevronRight className="size-4 ml-auto" />
            </div>
          )}
        </motion.div>

        {/* 配送方式 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="size-5" />
            <span className="font-semibold text-sm text-foreground">配送方式</span>
          </div>
          <div className="flex gap-2 mb-3">
            {(['delivery', 'pickup'] as const).map(type => (
              <motion.button
                key={type}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDeliveryType(type)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  deliveryType === type
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {type === 'delivery' ? '外卖配送' : '到店自取'}
              </motion.button>
            ))}
          </div>
          {deliveryType === 'delivery' && (
            <div className="pt-3 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">送达时间</span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDeliveryMode('instant')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    deliveryMode === 'instant'
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-muted text-muted-foreground border border-transparent'
                  }`}
                >
                  立即送出
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAppointmentSheet(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                    deliveryMode === 'appointment'
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-muted text-muted-foreground border border-transparent'
                  }`}
                >
                  {deliveryMode === 'appointment' ? appointmentTime : '预约送达'}
                  <ChevronDown className="size-3" />
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>

        {/* 订单备注 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50"
        >
          <div className="flex items-center gap-3 mb-2">
            <StickyNote className="size-4 text-muted-foreground" />
            <span className="text-sm text-foreground">订单备注</span>
          </div>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value.slice(0, 50))}
            placeholder="口味、忌口等特殊要求"
            className="w-full h-9 px-3 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <div className="text-right text-xs text-muted-foreground mt-1">{remark.length}/50</div>
        </motion.div>

        {/* 餐具份数 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Utensils className="size-4 text-muted-foreground" />
              <span className="text-sm text-foreground">餐具份数</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setUtensils(Math.max(0, utensils - 1))}
                className="size-6 rounded-full border border-border flex items-center justify-center"
              >
                <Minus className="size-3 text-muted-foreground" />
              </motion.button>
              <span className="w-6 text-center text-sm font-medium tabular-nums">{utensils}</span>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => setUtensils(utensils + 1)}
                className="size-6 rounded-full bg-foreground flex items-center justify-center text-background"
              >
                <Plus className="size-3" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* 商品列表 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50"
        >
          <div className="text-sm font-semibold text-foreground mb-3">{shopInfo.name}</div>
          <div className="space-y-3">
            {cart.items.map(item => {
              const specText = item.specs?.length ? item.specs.map(s => s.optionLabel).join(' / ') : ''
              const extraText = item.extras?.length ? item.extras.map(e => e.name).join('、') : ''
              return (
                <div key={item.skuKey} className="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image src={item.image} alt={item.dishName} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{item.dishName}</div>
                    {(specText || extraText) && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {specText}{specText && extraText ? ' · ' : ''}{extraText && `加${extraText}`}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">×{item.quantity}</div>
                  </div>
                  <div className="text-sm font-medium text-foreground tabular-nums">
                    ¥{(item.finalPrice * item.quantity).toFixed(1)}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* 支付方式 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50"
        >
          <div className="flex items-center gap-3 mb-3">
            <CreditCard className="size-4 text-muted-foreground" />
            <span className="text-sm text-foreground">支付方式</span>
          </div>
           <div className="space-y-1">
             {[
               { id: 'wechat', label: '微信支付', icon: '💚' },
               { id: 'alipay', label: '支付宝', icon: '💙' },
               { id: 'balance', label: '余额支付', icon: '💰', sub: `可用 ¥${balance.toFixed(2)}` },
             ].map(pm => (
               <motion.button
                 key={pm.id}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => setPaymentMethod(pm.id)}
                 className="w-full flex items-center gap-2 py-2.5"
               >
                 <span>{pm.icon}</span>
                 <div className="flex-1 text-left">
                   <span className="text-sm text-foreground">{pm.label}</span>
                   {pm.sub && <div className="text-[10px] text-muted-foreground">{pm.sub}</div>}
                 </div>
                 <div>
                   {paymentMethod === pm.id ? (
                     <div className="size-5 rounded-full bg-foreground flex items-center justify-center">
                       <Check className="size-3 text-background" />
                     </div>
                   ) : (
                     <div className="size-5 rounded-full border-2 border-border" />
                   )}
                 </div>
               </motion.button>
             ))}
           </div>
        </motion.div>

        {/* 优惠券选择 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setShowCouponSheet(true)}
          className="mx-4 mt-3 p-4 bg-card rounded-xl border border-border/50 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-foreground/70" />
            <span className="text-sm text-foreground">优惠券</span>
          </div>
          <div className="flex items-center gap-1">
            {selectedCoupon ? (
              <span className="text-sm font-medium text-foreground">
                {selectedCoupon.name} · 减¥{finalCouponDiscount.toFixed(1)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {availableCoupons.length > 0
                  ? `${availableCoupons.filter(c => totalAmount >= c.minAmount).length} 张可用`
                  : '暂无可用'}
              </span>
            )}
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </motion.div>

         {/* 费用明细 */}
         <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="mx-4 mt-3 mb-4 p-4 bg-card rounded-xl border border-border/50"
         >
           <div className="space-y-2">
             <div className="flex justify-between text-sm">
               <span className="text-muted-foreground">商品金额</span>
               <span className="text-foreground tabular-nums">¥{totalAmount.toFixed(1)}</span>
             </div>
             {packingFee > 0 && (
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground">打包费</span>
                 <span className="text-foreground tabular-nums">¥{packingFee.toFixed(1)}</span>
               </div>
             )}
             <div className="flex justify-between text-sm">
               <span className="text-muted-foreground">配送费</span>
               <span className="text-foreground tabular-nums">
                 {freeDeliveryDiscount > 0 ? (
                   <span className="line-through text-muted-foreground text-xs mr-1">¥{deliveryFee.toFixed(1)}</span>
                 ) : null}
                 ¥{finalDeliveryFee.toFixed(1)}
               </span>
             </div>
             {finalPromoDiscount > 0 && (
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground flex items-center gap-1">
                   <Tag className="size-3" />
                   满减优惠
                 </span>
                 <span className="text-destructive tabular-nums">-¥{finalPromoDiscount.toFixed(1)}</span>
               </div>
             )}
             {newUserDiscount > 0 && (
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground flex items-center gap-1">
                   <Gift className="size-3" />
                   新客立减
                 </span>
                 <span className="text-destructive tabular-nums">-¥{newUserDiscount.toFixed(1)}</span>
               </div>
             )}
             {freeDeliveryDiscount > 0 && (
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground flex items-center gap-1">
                   <Truck className="size-3" />
                   免配送费
                 </span>
                 <span className="text-destructive tabular-nums">-¥{freeDeliveryDiscount.toFixed(1)}</span>
               </div>
             )}
             {finalCouponDiscount > 0 && selectedCoupon && (
               <div className="flex justify-between text-sm">
                 <span className="text-muted-foreground flex items-center gap-1">
                   <Ticket className="size-3" />
                   优惠券 · {selectedCoupon.name}
                 </span>
                 <span className="text-destructive tabular-nums">-¥{finalCouponDiscount.toFixed(1)}</span>
               </div>
             )}
             {promoDiscount > 0 && couponDiscount > 0 && (
               <div className="text-[10px] text-muted-foreground pt-0.5 pb-1">
                 * 满减与优惠券不同享，已自动按最优（{usePromoOnly ? '满减' : '优惠券'}）计算
               </div>
             )}
             <div className="h-px bg-border/50 my-2" />
             <div className="flex justify-between items-center">
               <span className="text-sm text-foreground">合计</span>
               <div className="text-right">
                 <span className="text-[11px] text-muted-foreground mr-1">已优惠 ¥{totalDiscount.toFixed(1)}</span>
                 <span className="text-xl font-bold text-foreground tabular-nums">¥{finalAmount.toFixed(1)}</span>
               </div>
             </div>
           </div>
         </motion.div>
      </div>

      {/* 底部提交 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md">
        <div className="px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-border/30 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 bg-foreground text-background rounded-full text-base font-semibold disabled:opacity-50 flex items-center justify-center"
          >
            {submitting ? '提交中...' : `提交订单  ¥${finalAmount.toFixed(1)}`}
          </motion.button>
        </div>
      </div>

      {/* 地址选择弹窗 */}
      <AnimatePresence>
        {showAddrSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddrSheet(false)}
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
                <span className="font-semibold text-foreground">选择收货地址</span>
                <button onClick={() => setShowAddrSheet(false)}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {addresses.map(addr => (
                  <motion.button
                    key={addr.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedAddrId(addr.id); setShowAddrSheet(false) }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selectedAddrId === addr.id
                        ? 'border-foreground bg-foreground/5'
                        : 'border-border/50 bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{addr.name}</span>
                      <span className="text-xs text-muted-foreground">{addr.phone}</span>
                      {addr.isDefault && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">默认</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {addr.address} {addr.detail}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
       </AnimatePresence>

      {/* 优惠券选择弹窗 */}
      <AnimatePresence>
        {showCouponSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCouponSheet(false)}
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
                <span className="font-semibold text-foreground">选择优惠券</span>
                <button onClick={() => setShowCouponSheet(false)}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* 不使用优惠券 */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedCouponId(''); setShowCouponSheet(false) }}
                  className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    selectedCouponId === ''
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border/50 bg-card'
                  }`}
                >
                  <span className="text-sm text-foreground">不使用优惠券</span>
                  {selectedCouponId === '' && (
                    <Check className="size-4 text-foreground" />
                  )}
                </motion.button>
                {availableCoupons.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    暂无可用优惠券
                  </div>
                )}
                {availableCoupons.map(coupon => {
                  const usable = totalAmount >= coupon.minAmount
                  const discount = calcCouponDiscount(coupon, totalAmount)
                  const isSelected = selectedCouponId === coupon.id
                  return (
                    <motion.button
                      key={coupon.id}
                      whileTap={usable ? { scale: 0.98 } : {}}
                      onClick={() => {
                        if (!usable) return
                        setSelectedCouponId(coupon.id)
                        setShowCouponSheet(false)
                      }}
                      className={`relative w-full text-left rounded-xl border overflow-hidden transition-colors ${
                        isSelected
                          ? 'border-foreground bg-foreground/5'
                          : usable
                          ? 'border-border/80 bg-card'
                          : 'border-border/40 bg-card opacity-60'
                      }`}
                    >
                      <div className="flex">
                        <div className="relative w-24 shrink-0 bg-foreground text-background flex flex-col items-center justify-center py-4">
                          <div className="flex items-baseline gap-0.5">
                            {coupon.type !== 'discount' && <span className="text-xs">¥</span>}
                            <span className="text-2xl font-bold">{coupon.type === 'discount' ? Math.round(coupon.value * 10) : coupon.value}</span>
                            {coupon.type === 'discount' && <span className="text-xs">折</span>}
                          </div>
                          <div className="text-[10px] text-background/70 mt-0.5">
                            {coupon.minAmount > 0 ? `满${coupon.minAmount}元可用` : '无门槛'}
                          </div>
                          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 size-3 rounded-full bg-card" />
                        </div>
                        <div className="flex-1 p-3 min-w-0">
                          <div className="text-sm font-semibold text-foreground">{coupon.name}</div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{coupon.scope}</p>
                          <div className="text-[10px] text-muted-foreground mt-1">有效期至 {coupon.expireDate}</div>
                          {!usable && (
                            <div className="text-[10px] text-destructive mt-1">
                              还差 ¥{(coupon.minAmount - totalAmount).toFixed(1)} 可用
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="size-4 text-foreground" />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
       </AnimatePresence>

      {/* 预约时段选择弹窗 */}
      <AnimatePresence>
        {showAppointmentSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAppointmentSheet(false)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl max-h-[60vh] overflow-hidden flex flex-col mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-foreground">选择送达时段</span>
                <button onClick={() => setShowAppointmentSheet(false)}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-muted-foreground mb-3">请选择您方便的送达时间，骑手将在预约时段内送达</p>
                <div className="grid grid-cols-3 gap-2">
                  {appointmentSlots.map((slot, i) => (
                    <motion.button
                      key={i}
                      whileTap={slot.available ? { scale: 0.95 } : {}}
                      disabled={!slot.available}
                      onClick={() => {
                        setAppointmentTime(slot.label)
                        setDeliveryMode('appointment')
                        setShowAppointmentSheet(false)
                      }}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        appointmentTime === slot.label
                          ? 'bg-primary text-primary-foreground'
                          : slot.available
                          ? 'bg-muted text-foreground hover:bg-muted/80'
                          : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                      }`}
                    >
                      {slot.label}
                      {!slot.available && <span className="block text-[10px]">已约满</span>}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 下单成功动画 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
              className="relative"
            >
              <svg width="80" height="80" viewBox="0 0 80 80">
                <motion.circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="226"
                  strokeDashoffset="226"
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="text-foreground"
                />
              </svg>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Check className="size-10 text-foreground" strokeWidth={3} />
              </motion.div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="mt-6 text-xl font-bold text-foreground"
            >
              下单成功
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
              className="mt-2 text-sm text-muted-foreground"
            >
              正在为您处理订单...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}