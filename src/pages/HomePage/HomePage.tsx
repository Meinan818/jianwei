import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  MapPin, Search, ChevronRight, Plus, Minus, Gift, Zap, Wallet, Bike, Flame, Tag, ShoppingCart,
} from 'lucide-react'
import { Image } from '@/components/ui/image'
import ShopCard from '@/components/ShopCard'
import { ShopCardSkeleton } from '@/components/Skeleton'
import { getAllShops, MOCK_BANNERS, type IShop } from '@/data/shops'
import { useShops } from '@/hooks/useShops'
import { MOCK_CATEGORIES } from '@/data/search-page'
import { useNavigatePush } from '@/hooks/useNavigationStack'
import { useCart, buildSkuKey } from '@/hooks/useCart'
import { toast } from 'sonner'

interface RecommendedDish {
  id: string
  dishId: string
  name: string
  description: string
  price: number
  image: string
  sales: number
  shopId: string
  shopName: string
}

export default function HomePage() {
  const navigatePush = useNavigatePush()
  const { cart, addItem, decreaseItem, totalCount, totalAmount, getDishTotalQuantity, getItemBySku } = useCart()
  const [bannerIdx, setBannerIdx] = useState(0)
  const { shops, dataVersion } = useShops()
  const [displayShops, setDisplayShops] = useState(() => getAllShops().slice(0, 4))
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sortBy, setSortBy] = useState<'recommend' | 'distance' | 'sales' | 'rating'>('recommend')
  const scrollRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const cartFloatRef = useRef<HTMLDivElement>(null)
  const [flyBalls, setFlyBalls] = useState<{ id: number; x: number; y: number; image: string }[]>([])
  const [cartBounce, setCartBounce] = useState(false)

  // 为你推荐：前三家店各取一道招牌菜
  const recommendedDishes = useMemo<RecommendedDish[]>(() => {
    const dishes: RecommendedDish[] = []
    for (const shop of shops) {
      const firstCat = shop.categories[0]
      if (firstCat?.dishes?.[0]) {
        const d = firstCat.dishes[0]
        dishes.push({
          id: `${shop.id}_${d.id}`,
          dishId: d.id,
          name: d.name,
          description: d.description,
          price: d.price,
          image: d.image,
          sales: d.sales,
          shopId: shop.id,
          shopName: shop.name,
        })
      }
      if (dishes.length >= 3) break
    }
    return dishes
  }, [shops])

  // 判断当前购物车属于哪家店（用于推荐菜品是否显示本店铺数量）
  const currentCartShopId = cart.shopId

  const handleAddDish = useCallback((dish: RecommendedDish, event: React.MouseEvent) => {
    // 跨店时会自动替换购物车，先提示再执行
    const isCrossShop = currentCartShopId && currentCartShopId !== dish.shopId
    addItem(dish.shopId, dish.shopName, { id: dish.dishId, name: dish.name, price: dish.price, image: dish.image })
    if (isCrossShop) {
      toast.info('已切换购物车到新商家')
    }

    // 飞入购物车动画
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const ballId = Date.now()
    setFlyBalls(prev => [...prev, { id: ballId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, image: dish.image }])

    // 购物车弹跳
    setCartBounce(true)
    setTimeout(() => setCartBounce(false), 400)

    setTimeout(() => {
      setFlyBalls(prev => prev.filter(b => b.id !== ballId))
    }, 500)
  }, [currentCartShopId, addItem])

  const handleDecreaseDish = useCallback((dish: RecommendedDish) => {
    const skuKey = buildSkuKey(dish.dishId, [], [])
    decreaseItem(skuKey)
  }, [decreaseItem])

  const sortShops = (shops: IShop[], type: typeof sortBy) => {
    const copy = [...shops]
    switch (type) {
      case 'distance':
        copy.sort((a, b) => Number(a.distance) - Number(b.distance))
        break
      case 'sales':
        copy.sort((a, b) => b.monthSales - a.monthSales)
        break
      case 'rating':
        copy.sort((a, b) => Number(b.rating) - Number(a.rating))
        break
      default:
        break
    }
    return copy
  }

  const handleSortChange = (type: typeof sortBy) => {
    setSortBy(type)
    const sorted = sortShops(shops, type)
    setDisplayShops(sorted.slice(0, 4))
    setHasMore(sorted.length > 4)
  }

  const SORT_OPTIONS = [
    { value: 'recommend' as const, label: '推荐' },
    { value: 'distance' as const, label: '距离' },
    { value: 'sales' as const, label: '销量' },
    { value: 'rating' as const, label: '评分' },
  ]

  const ACTIVITY_ENTRIES = [
    { icon: Wallet, label: '会员红包', color: 'from-amber-400 to-orange-500', action: () => navigatePush('/customer/member') },
    { icon: Zap, label: '限时秒杀', color: 'from-red-400 to-rose-500', action: () => navigatePush('/customer/coupon-center') },
    { icon: Gift, label: '新人专享', color: 'from-orange-400 to-primary', action: () => navigatePush('/customer/coupon-center') },
    { icon: Bike, label: '免运费', color: 'from-sky-400 to-blue-500', action: () => navigatePush('/customer/coupon-center') },
  ]

  // Banner 自动轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIdx(prev => (prev + 1) % MOCK_BANNERS.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  // 数据源切换（内置演示数据 → 数据库）后重置列表，
  // 否则 displayShops 里会残留内置数据、与 shops 不一致
  useEffect(() => {
    const next = getAllShops()
    setDisplayShops(next.slice(0, 4))
    setHasMore(next.length > 4)
  }, [dataVersion])

  // 轮播同步滚动
  useEffect(() => {
    if (carouselRef.current) {
      const el = carouselRef.current
      el.scrollTo({ left: bannerIdx * el.clientWidth, behavior: 'smooth' })
    }
  }, [bannerIdx])

  // 上拉加载
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (bottom < 100 && !loading && hasMore) {
      loadMore()
    }
  }

  const loadMore = () => {
    setLoading(true)
    setTimeout(() => {
      const currentCount = displayShops.length
      const next = shops.slice(currentCount, currentCount + 4)
      if (next.length === 0) {
        setHasMore(false)
      } else {
        setDisplayShops(prev => [...prev, ...next])
      }
      setLoading(false)
    }, 800)
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto"
    >
      {/* 顶部定位 + 搜索 */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl px-4 pt-3 pb-2 border-b border-border/30"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 text-sm text-foreground">
            <MapPin className="size-4" />
            <span className="font-medium">望京SOHO</span>
            <ChevronRight className="size-3 text-muted-foreground" />
          </div>
        </div>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => navigatePush('/customer/search')}
          className="flex items-center gap-2 h-9 px-3 bg-muted rounded-full text-sm text-muted-foreground cursor-pointer"
        >
          <Search className="size-4 shrink-0" />
          <span>搜索商家、菜品</span>
        </motion.div>
      </motion.div>

      {/* 品类分类 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="px-4 py-3"
      >
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {MOCK_CATEGORIES.slice(1, 11).map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.03, duration: 0.3 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigatePush(`/customer/search?category=${cat.id}`)}
              className="flex flex-col items-center gap-1 w-14 shrink-0 cursor-pointer"
            >
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center text-2xl">
                {cat.icon}
              </div>
              <span className="text-[11px] text-foreground/80">{cat.name}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Banner 轮播 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="px-4 pb-3"
      >
        <div className="relative rounded-xl overflow-hidden aspect-[21/9] bg-muted">
          <div
            ref={carouselRef}
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {MOCK_BANNERS.map(banner => (
              <div
                key={banner.id}
                className="flex-none w-full h-full snap-center"
              >
                <Image src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          {/* 指示器 */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {MOCK_BANNERS.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === bannerIdx ? 16 : 6,
                  backgroundColor: i === bannerIdx ? 'white' : 'rgba(255,255,255,0.5)',
                }}
                transition={{ duration: 0.3 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* 活动入口 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="px-4 pb-3"
      >
        <div className="grid grid-cols-4 gap-2">
          {ACTIVITY_ENTRIES.map((entry, i) => {
            const Icon = entry.icon
            return (
              <motion.button
                key={entry.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + i * 0.04, duration: 0.3 }}
                whileTap={{ scale: 0.92 }}
                onClick={entry.action}
                className="flex flex-col items-center gap-1.5 py-2"
              >
                <div className={`size-12 rounded-2xl bg-gradient-to-br ${entry.color} flex items-center justify-center shadow-sm`}>
                  <Icon className="size-5 text-white" />
                </div>
                <span className="text-[11px] text-foreground/80">{entry.label}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* 新人专区横幅 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="px-4 pb-4"
      >
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => navigatePush('/customer/coupon-center')}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-amber-400 px-4 py-3 flex items-center justify-between cursor-pointer shadow-sm"
        >
          {/* 装饰圈 */}
          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-8 size-16 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2">
            <Gift className="size-5 text-white" />
            <div>
              <p className="text-sm font-bold text-white">新人首单立减 15 元</p>
              <p className="text-[11px] text-white/80 mt-0.5">注册即送，全场通用</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); navigatePush('/customer/coupon-center') }}
            className="relative h-7 px-3 rounded-full bg-white text-primary text-xs font-semibold flex items-center gap-1 shadow-sm"
          >
            立即领取
            <ChevronRight className="size-3" />
          </motion.button>
        </motion.div>
      </motion.div>

      {/* 为你推荐 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="px-4 pb-4"
      >
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="text-base font-semibold text-foreground">为你推荐</h2>
            <Flame className="size-4 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">根据你的口味精选</span>
        </div>
        <div className="space-y-3">
          {recommendedDishes.map((dish, i) => (
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.42 + i * 0.06, duration: 0.4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigatePush(`/customer/shop/${dish.shopId}`)}
              className="flex gap-3 p-2.5 rounded-xl bg-card border border-border/40 cursor-pointer"
            >
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                <Image src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <h3 className="text-sm font-medium text-foreground truncate">{dish.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dish.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Tag className="size-3" />
                    {dish.shopName}
                  </p>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-base font-bold text-primary tabular-nums">
                      ¥{dish.price.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">
                      月售 {dish.sales}
                    </span>
                  </div>
                  {(() => {
                    const skuKey = buildSkuKey(dish.dishId, [], [])
                    const qty = currentCartShopId === dish.shopId
                      ? (getItemBySku(skuKey)?.quantity ?? 0)
                      : 0
                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {qty > 0 && (
                          <>
                            <motion.button
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDecreaseDish(dish)
                              }}
                              className="size-6 rounded-full border border-foreground flex items-center justify-center text-foreground"
                            >
                              <Minus className="size-3.5" />
                            </motion.button>
                            <motion.span
                              key={qty}
                              initial={{ scale: 1.25, opacity: 1 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                              className="text-sm font-medium text-foreground min-w-[20px] text-center tabular-nums"
                            >
                              {qty}
                            </motion.span>
                          </>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddDish(dish, e)
                          }}
                          className="size-6 rounded-full bg-primary text-background flex items-center justify-center shadow-sm shrink-0"
                        >
                          <Plus className="size-3.5" />
                        </motion.button>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 推荐商家标题 + 排序 */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="px-4 py-2 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-foreground rounded-full" />
          <h2 className="text-base font-semibold text-foreground">推荐商家</h2>
        </div>
        <div className="flex gap-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                sortBy === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 商家列表 */}
      <div className="px-4 pb-6 space-y-3">
        {displayShops.map((shop, i) => (
          <ShopCard key={shop.id} shop={shop} index={i} />
        ))}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {[0, 1].map(i => <ShopCardSkeleton key={i} />)}
          </motion.div>
        )}
        {!hasMore && displayShops.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-muted-foreground py-4"
          >
            已经到底了 ~
          </motion.div>
        )}
      </div>

      {/* 浮动购物车栏（仅购物车有商品时显示） */}
      <motion.div
        animate={{
          y: totalCount > 0 ? 0 : 100,
          opacity: totalCount > 0 ? 1 : 0,
          pointerEvents: totalCount > 0 ? 'auto' : 'none',
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 mx-auto max-w-md pointer-events-none"
      >
            <motion.div
              ref={cartFloatRef}
              animate={cartBounce ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.35 }}
              onClick={() => navigatePush('/customer/checkout')}
              className="pointer-events-auto flex items-center justify-between h-12 px-4 bg-foreground text-background rounded-full shadow-md"
              whileTap={{ scale: 0.98 }}
            >
        <div className="relative flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  <motion.div
                    animate={{ scale: totalCount > 0 ? 1 : 0, opacity: totalCount > 0 ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-background text-[10px] font-semibold flex items-center justify-center tabular-nums border border-background"
                  >
                    {totalCount}
                  </motion.div>
                </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold tabular-nums">¥{totalAmount.toFixed(1)}</span>
                <span className="text-xs font-medium bg-background/10 px-2.5 py-1 rounded-full">去结算</span>
              </div>
            </motion.div>
          </motion.div>

      {/* 飞入购物车的小球 */}
      {flyBalls.map(ball => (
        <motion.div
          key={ball.id}
          initial={{ x: ball.x - 12, y: ball.y - 12, scale: 1, opacity: 1 }}
          animate={{
            x: (cartFloatRef.current?.getBoundingClientRect().left ?? 0) + 24,
            y: (cartFloatRef.current?.getBoundingClientRect().top ?? 0) + 24,
            scale: 0.3,
            opacity: 0.6,
          }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-0 left-0 z-[60] size-6 rounded-full bg-primary overflow-hidden pointer-events-none"
          style={{ borderRadius: '50%' }}
        >
          <Image src={ball.image} alt="" className="w-full h-full object-cover" />
        </motion.div>
      ))}
    </div>
  )
}
