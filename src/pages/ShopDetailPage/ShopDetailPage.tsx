import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import { Star, Clock, Bike, ChevronDown, Info, Minus, Plus, ShoppingCart, X, Trash2, Tag, MessageSquare, Heart, Moon, Phone, Store, Search } from 'lucide-react'
import { Image } from '@/components/ui/image'
import TopNavBar from '@/components/TopNavBar'
import DishSpecSheet from '@/components/DishSpecSheet'
import { useCart, buildSkuKey } from '@/hooks/useCart'
import { useReviews } from '@/hooks/useReviews'
import { useFavorites } from '@/hooks/useFavorites'
import { useShopStatus } from '@/hooks/useShopStatus'
import { useNavigatePush } from '@/hooks/useNavigationStack'
import { getAllShops, getShopActivities } from '@/data/shops'
import { useShops } from '@/hooks/useShops'
import type { IDishSpec, IDishExtra, IDish } from '@/data/shops'
import type { ICartItemSpec, ICartItemExtra } from '@/data/cart'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'

export default function ShopDetailPage() {
  const { id } = useParams()
  const navigatePush = useNavigatePush()
  // 订阅店铺数据变更：登录后从数据库加载完成会自动重渲染。
  // 否则首屏用的是内置演示数据，而路由里的 id 是数据库 UUID，会找不到店铺。
  useShops()
  const shop = getAllShops().find(s => s.id === id)
  const { cart, addItem, decreaseItem, clearCart, totalCount, totalAmount, getItemQuantity } = useCart()
  const { getShopReviews, getShopAvgScore } = useReviews()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { isShopOpen, isDishAvailable, getShopStatus, shopStatus } = useShopStatus()
  const shopOpen = shop ? isShopOpen(shop.id) : true

  // 店铺营销活动（合并 mock 默认 + 商家自定义，与结算页同口径）
  const shopActivities = shop ? getShopActivities(shop.id) : []
  const activeActivities = shopActivities.filter(a => a.active)

  // 店铺折扣（整单折扣率，1 = 不打折）
  const shopDiscountActivity = activeActivities.find(a => a.type === 'discount')
  const shopDiscountRate = shopDiscountActivity?.discountRate ?? 1

  // 折扣菜活动
  const discountDishActivity = activeActivities.find(a => a.type === 'discountDish')
  const discountDishId = discountDishActivity?.dishId
  const discountDishRate = discountDishActivity?.dishDiscountRate ?? 1

  // 计算某菜品的展示价格（原价 + 折后价）
  const getDishDisplayPrice = (dishId: string, basePrice: number) => {
    if (discountDishId && dishId === discountDishId) {
      const discounted = +(basePrice * discountDishRate).toFixed(2)
      return { originalPrice: basePrice, finalPrice: discounted, badge: '折扣菜' }
    }
    if (shopDiscountRate < 1) {
      const discounted = +(basePrice * shopDiscountRate).toFixed(2)
      return { originalPrice: basePrice, finalPrice: discounted, badge: '店折扣' }
    }
    return { originalPrice: basePrice, finalPrice: basePrice, badge: null }
  }

  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [specSheetDish, setSpecSheetDish] = useState<(IDish & { displayPrice: number; displaySales: number; onShelf: boolean; soldOut: boolean; stock: number }) | null>(null)
  const [flyBalls, setFlyBalls] = useState<{ id: number; x: number; y: number; image: string }[]>([])
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const dishListRef = useRef<HTMLDivElement>(null)
  const cartIconRef = useRef<HTMLDivElement>(null)
  const [cartBounce, setCartBounce] = useState(false)

  useEffect(() => {
    if (shop && shop.categories.length > 0) {
      setActiveCategoryId(shop.categories[0].id)
    }
  }, [shop])

  // 带状态覆盖的分类+菜品列表（支持自定义菜品、改价、改图、改名）+ 搜索过滤
  const displayCategories = useMemo(() => {
    if (!shop) return []
    const status = shopStatus[shop.id]
    const keyword = searchKeyword.trim().toLowerCase()
    return shop.categories.map(cat => {
       // 基础菜品 + 状态覆盖
      const baseDishes = cat.dishes.map(dish => {
        const ds = status?.dishes[dish.id]
        // 第 2 期 2h：本机没有覆盖时用数据库读回来的值，
        // 这样商家在另一台设备下架/售罄的菜，顾客端（刷新或收到推送后）会正确置灰
        return {
          id: dish.id,
          name: ds?.name || dish.name,
          description: ds?.description || dish.description,
          price: ds?.price ?? dish.price,
          image: ds?.image || dish.image,
          sales: ds?.sales ?? dish.sales,
          onShelf: ds?.onShelf ?? dish.onShelf ?? true,
          soldOut: ds?.soldOut ?? dish.soldOut ?? false,
          stock: ds?.stock ?? dish.stock ?? -1,
          isCustom: false,
          specs: ds?.specs?.length ? ds.specs.map(s => ({ id: s.id, name: s.name, options: s.options })) : dish.specs,
          extras: ds?.extras?.length ? ds.extras.map(e => ({ id: e.id, name: e.name, price: e.price })) : dish.extras,
          hasSpecs: ((ds?.specs?.length ? ds.specs.length : (dish.specs?.length || 0)) > 0) || ((ds?.extras?.length ? ds.extras.length : (dish.extras?.length || 0)) > 0),
        }
      })
      // 追加自定义菜品（从 status.dishes 中筛选 categoryId === cat.id 的）
      if (status?.dishes) {
        Object.entries(status.dishes).forEach(([dishId, ds]) => {
          if (ds.categoryId === cat.id) {
             baseDishes.push({
               id: dishId,
               name: ds.name || '自定义菜品',
               description: ds.description || '',
               price: ds.price,
               image: ds.image || '',
                sales: ds.sales ?? 0,
               onShelf: ds.onShelf ?? true,
               soldOut: ds.soldOut ?? false,
               stock: ds.stock ?? -1,
               isCustom: true,
               specs: undefined,
               extras: undefined,
               hasSpecs: false,
             })
          }
        })
      }
      // 搜索过滤：按菜品名、描述匹配
      const filteredDishes = keyword
        ? baseDishes.filter(d => d.name.toLowerCase().includes(keyword) || d.description.toLowerCase().includes(keyword))
        : baseDishes
      return { ...cat, dishes: filteredDishes }
    }).filter(cat => cat.dishes.length > 0) // 过滤掉无匹配菜品的分类
  }, [shop, shopStatus, searchKeyword])

  const handleAdd = useCallback((dish: { id: string; name: string; price: number; image: string }, event: React.MouseEvent) => {
    if (!shop || !shopOpen) {
      toast.info('商家休息中，暂不可下单')
      return
    }
    if (!isDishAvailable(shop.id, dish.id)) {
      toast.info('该菜品已售罄或下架')
      return
    }
    if (!shop) return
    addItem(shop.id, shop.name, dish)

    // 飞入动画
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const ballId = Date.now()
    setFlyBalls(prev => [...prev, { id: ballId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, image: dish.image }])

    // 购物车抖动
    setCartBounce(true)
    setTimeout(() => setCartBounce(false), 400)

    setTimeout(() => {
      setFlyBalls(prev => prev.filter(b => b.id !== ballId))
    }, 600)
  }, [shop, shopOpen, addItem])

  const handleDecrease = useCallback((dishId: string) => {
    // 2026-09-28 修复：菜单上的减号是"按菜品"显示的（数量 = 该菜各规格之和），
    // 但购物车是按 skuKey（菜品 + 规格 + 加料）存的，直接把 dishId 当 key 传进去
    // 永远匹配不到 → 点减号数量不变。这里先按 dishId 找到购物车里对应的那条明细再减。
    const line = [...cart.items].reverse().find(i => i.dishId === dishId || i.skuKey === dishId)
    if (line) decreaseItem(line.skuKey)
  }, [cart.items, decreaseItem])

  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId)
    const el = categoryRefs.current[catId]
    if (el && dishListRef.current) {
      dishListRef.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
    }
  }

  const handleDishScroll = useCallback(() => {
    if (!dishListRef.current || !shop) return
    const scrollTop = dishListRef.current.scrollTop
    for (let i = shop.categories.length - 1; i >= 0; i--) {
      const cat = shop.categories[i]
      const el = categoryRefs.current[cat.id]
      if (el && el.offsetTop - 20 <= scrollTop) {
        if (activeCategoryId !== cat.id) {
          setActiveCategoryId(cat.id)
        }
        break
      }
    }
  }, [shop, activeCategoryId])

  if (!shop) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <TopNavBar title="店铺详情" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">店铺不存在</div>
      </div>
    )
  }

  const canCheckout = totalAmount >= shop.minOrder && totalCount > 0 && shopOpen
  const diffToMin = shop.minOrder - totalAmount

  const handleCheckout = () => {
    if (!shopOpen) {
      toast.info('商家休息中，暂不可下单')
      return
    }
    if (!canCheckout) {
      toast.info(`还差 ¥${diffToMin.toFixed(1)} 起送`)
      return
    }
    navigatePush('/customer/checkout')
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopNavBar
        title={shop.name}
        rightContent={
          <button
            onClick={() => {
              toggleFavorite(shop.id)
              toast(isFavorite(shop.id) ? '已取消收藏' : '已收藏')
            }}
            className="size-8 flex items-center justify-center"
          >
            <Heart
              className={`size-5 transition-colors ${isFavorite(shop.id) ? 'fill-foreground text-foreground' : 'text-foreground/70'}`}
            />
          </button>
        }
      />

      {/* 店铺信息 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-3 border-b border-border/30"
      >
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
            <Image src={shop.cover} alt={shop.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground truncate">{shop.name}</h1>
              {!shopOpen && (
                <span className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                  <Moon className="size-2.5" />
                  休息中
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Star className="size-3 fill-foreground text-foreground" />
              <span className="text-foreground font-medium">{shop.rating}</span>
              <span>月售 {shopStatus[shop.id]?.monthSales ?? shop.monthSales}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Bike className="size-3" />
                <span>{shop.deliveryFee === 0 ? '免配送' : `¥${shop.deliveryFee}`}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="size-3" />
                <span>{shop.deliveryTime}</span>
              </div>
              <span>{shop.distance}</span>
            </div>
          </div>
        </div>
        {shop.announcement && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-lg">
            <Info className="size-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{shop.announcement}</span>
          </div>
        )}
        {/* 满减活动进度条（与结算页同口径） */}
        {(() => {
          const fullReduce = activeActivities.find(a => a.type === 'fullReduce' && a.thresholds && a.thresholds.length > 0)
          if (!fullReduce) return null
          const promo = { thresholds: fullReduce.thresholds!, discounts: fullReduce.discounts || [], description: fullReduce.description }
          let nextTier = 0
          let currentDiscount = 0
          let currentTierIdx = -1
          for (let i = 0; i < promo.thresholds.length; i++) {
            if (totalAmount >= promo.thresholds[i]) {
              currentTierIdx = i
              currentDiscount = promo.discounts[i]
            } else {
              nextTier = promo.thresholds[i]
              break
            }
          }
          const diff = nextTier > 0 ? nextTier - totalAmount : 0
          const progress = currentTierIdx < 0
            ? Math.min(100, (totalAmount / promo.thresholds[0]) * 100)
            : nextTier > 0
            ? Math.min(100, ((totalAmount - promo.thresholds[currentTierIdx]) / (nextTier - promo.thresholds[currentTierIdx])) * 100)
            : 100
          return (
            <div className="mt-2 px-2 py-2 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 text-foreground font-medium">
                  <Tag className="size-3" />
                  <span>{promo.description}</span>
                </div>
              </div>
              {totalAmount > 0 && (
                <div className="mt-1.5">
                  <div>
                    <div className="h-1 bg-border/60 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-foreground rounded-full"
                        initial={false}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {diff > 0 ? (
                        <span>再买 ¥{diff.toFixed(1)} 可享下一档（减¥{promo.discounts[currentTierIdx + 1]}）</span>
                      ) : (
                        <span>已享最高档优惠 ¥{currentDiscount}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* 店铺活动 */}
        {activeActivities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeActivities.map(activity => (
              <span
                key={activity.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-primary bg-primary/10 rounded"
              >
                <Tag className="size-2.5" />
                {activity.description || activity.name}
              </span>
            ))}
          </div>
        )}

        {/* 联系商家 / 店铺信息 */}
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              navigatePush(`/chat?type=shop&shopId=${shop.id}&shopName=${encodeURIComponent(shop.name)}&peerRole=merchant`)
            }}
            className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-muted/50 rounded-lg text-xs text-foreground active:bg-muted/80"
          >
            <MessageSquare className="size-3.5" />
            在线咨询
          </button>
          <button
            onClick={() => navigatePush(`/customer/shop-info/${shop.id}`)}
            className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-muted/50 rounded-lg text-xs text-foreground active:bg-muted/80"
          >
            <Store className="size-3.5" />
            商家信息
          </button>
        </div>
      </motion.div>

      {/* 左分类 + 右菜品 */}
       <div className="flex-1 flex overflow-hidden pb-20">
        {/* 左侧分类 */}
        <div className="w-20 shrink-0 bg-muted/30 overflow-y-auto scrollbar-hide">
          {displayCategories.map(cat => (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollToCategory(cat.id)}
              className={`relative w-full px-2 py-3.5 text-xs text-left transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-background text-foreground font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              <AnimatePresence>
                {activeCategoryId === cat.id && (
                  <motion.div
                    layoutId="cat-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground rounded-r"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </AnimatePresence>
              <span className="block">{cat.name}</span>
            </motion.button>
          ))}
        </div>

        {/* 右侧菜品列表 */}
        <div
          ref={dishListRef}
          onScroll={handleDishScroll}
          className="flex-1 overflow-y-auto pb-24"
        >
          {/* 搜索框 */}
          <div className="sticky top-0 z-20 px-3 py-2 bg-background/95 backdrop-blur-sm border-b border-border/20">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索店内菜品"
                className="h-8 pl-8 text-xs bg-muted/50 border-0"
              />
            </div>
          </div>

          {searchKeyword && displayCategories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="size-8 mb-2 opacity-30" />
              <p className="text-xs">未找到相关菜品</p>
            </div>
          )}

          {displayCategories.map(cat => (
            <div
              key={cat.id}
              ref={el => { categoryRefs.current[cat.id] = el }}
            >
              <div className="sticky top-0 z-10 px-3 py-2 bg-background/90 backdrop-blur-sm border-b border-border/20">
                <span className="text-sm font-semibold text-foreground">{cat.name}</span>
              </div>
              <div className="px-3 py-1">
                {cat.dishes.map((dish, idx) => {
                  const qty = getItemQuantity(dish.id)
                  const dishUnavailable = !dish.onShelf || dish.soldOut || dish.stock === 0
                  const offLabel = !dish.onShelf ? '已下架' : (dish.soldOut ? '已售罄' : (dish.stock === 0 ? '售罄' : ''))
                  return (
                    <motion.div
                      key={dish.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      className="flex gap-3 py-3 border-b border-border/30 last:border-0"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                        {dish.image ? (
                          <Image src={dish.image} alt={dish.name} className={`w-full h-full object-cover ${dishUnavailable ? 'grayscale opacity-50' : ''}`} />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${dishUnavailable ? 'opacity-40' : ''}`}>
                            <ShoppingCart className="size-6 text-muted-foreground/40" />
                          </div>
                        )}
                        {dishUnavailable && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] bg-foreground/60 text-background font-medium">
                            {offLabel}
                          </span>
                        )}
                        {(() => {
                          const dp = getDishDisplayPrice(dish.id, dish.price)
                          if (!dp.badge) return null
                          return (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-medium bg-destructive text-white rounded">
                              {dp.badge}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <h3 className={`text-sm font-medium truncate ${dishUnavailable ? 'text-muted-foreground' : 'text-foreground'}`}>{dish.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{dish.description}</p>
                        {dish.sales > 0 && <p className="text-[11px] text-muted-foreground mt-1">月售 {dish.sales}</p>}
                           <div className="mt-auto flex items-end justify-between">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-base font-semibold text-foreground">
                                ¥{getDishDisplayPrice(dish.id, dish.price).finalPrice.toFixed(1)}
                              </span>
                              {getDishDisplayPrice(dish.id, dish.price).badge && (
                                <span className="text-[10px] text-muted-foreground line-through">
                                  ¥{getDishDisplayPrice(dish.id, dish.price).originalPrice.toFixed(1)}
                                </span>
                              )}
                            </div>
                           {!dishUnavailable && shopOpen ? (
                            <div className="flex items-center gap-1.5">
                             {qty > 0 && (
                               <>
                                 <motion.button
                                   initial={{ scale: 0, opacity: 0 }}
                                   animate={{ scale: 1, opacity: 1 }}
                                   whileTap={{ scale: 0.8 }}
                                   onClick={() => {
                                     if (dish.hasSpecs) {
                                       setSpecSheetDish(dish as any)
                                     } else {
                                       handleDecrease(dish.id)
                                     }
                                   }}
                                   className="size-5 rounded-full border border-foreground flex items-center justify-center text-foreground"
                                 >
                                   <Minus className="size-3" />
                                 </motion.button>
                                 <motion.span
                                   key={qty}
                                   initial={{ scale: 1.3, opacity: 1 }}
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
                                 if (dish.hasSpecs) {
                                   setSpecSheetDish(dish as any)
                                 } else {
                                   handleAdd(dish, e)
                                 }
                               }}
                               className="size-5 rounded-full bg-foreground flex items-center justify-center text-background"
                             >
                               <Plus className="size-3" />
                             </motion.button>
                           </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">暂不可售</span>
                            )}
                         </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
          {/* 评价区 */}
          <div className="px-3 py-4 border-t-4 border-border/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="size-4 text-foreground/80" />
                <span className="text-sm font-semibold text-foreground">用户评价</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-foreground text-foreground" />
                <span className="text-foreground font-medium">{getShopAvgScore(shop.id).overall || shop.rating}</span>
                <span>· {getShopReviews(shop.id).length} 条</span>
              </div>
            </div>
            {/* 评分概览 */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: '口味', score: getShopAvgScore(shop.id).taste || (shop.rating - 0.1) },
                { label: '包装', score: getShopAvgScore(shop.id).packaging || (shop.rating - 0.2) },
                { label: '配送', score: getShopAvgScore(shop.id).delivery || (shop.rating - 0.3) },
              ].map(item => (
                <div key={item.label} className="text-center py-2 bg-muted/50 rounded-lg">
                  <div className="text-sm font-semibold text-foreground">{item.score.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            {/* 评价列表 */}
            {getShopReviews(shop.id).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                暂无评价，快来成为第一个评价的人吧
              </div>
            ) : (
              <div className="space-y-3">
                {getShopReviews(shop.id).slice(0, 5).map(review => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pb-3 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="size-7">
                        <AvatarImage src={review.userAvatar} alt={review.userName} />
                        <AvatarFallback className="text-xs bg-muted">
                          {review.userName.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground">{review.userName}</div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star
                              key={n}
                              className={`size-2.5 ${
                                n <= review.overallScore
                                  ? 'fill-foreground text-foreground'
                                  : 'text-border'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    {review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {review.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {review.content && (
                      <p className="text-xs text-foreground/80 leading-relaxed">{review.content}</p>
                    )}
                    {review.dishes.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                        所点菜品：{review.dishes.join('、')}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 飞入小球 */}
      <AnimatePresence>
        {flyBalls.map(ball => (
          <motion.div
            key={ball.id}
            initial={{ x: ball.x - 12, y: ball.y - 12, scale: 1, opacity: 1 }}
            animate={{
              x: cartIconRef.current ? cartIconRef.current.getBoundingClientRect().left + 12 : window.innerWidth - 80,
              y: cartIconRef.current ? cartIconRef.current.getBoundingClientRect().top + 12 : window.innerHeight - 40,
              scale: 0.3,
              opacity: 0.6,
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-0 top-0 z-50 size-6 rounded-full overflow-hidden pointer-events-none border border-white shadow-lg"
          >
            <Image src={ball.image} alt="" className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 购物车浮层遮罩 */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-40 bg-black/50"
            style={{ top: 0, bottom: 0 }}
          />
        )}
      </AnimatePresence>

      {/* 购物车浮层 */}
      <AnimatePresence>
        {cartOpen && cart.items.length > 0 && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-16 z-50 bg-card rounded-t-2xl max-h-[60vh] overflow-hidden flex flex-col mx-auto max-w-md"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <span className="font-semibold text-sm text-foreground">购物车</span>
              <button
                onClick={() => { clearCart(); setCartOpen(false) }}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
                清空
              </button>
            </div>
             <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0">
               {cart.items.map(item => {
                 const qty = item.quantity
                 const specText = item.specs.length > 0
                   ? item.specs.map(s => s.optionLabel).join(' / ')
                   : ''
                 const extraText = item.extras.length > 0
                   ? item.extras.map(e => e.name).join('、')
                   : ''
                 return (
                   <motion.div
                     key={item.skuKey}
                     layout
                     className="flex items-center gap-3 py-3 border-b border-border/20 last:border-0"
                   >
                     <div className="flex-1 min-w-0">
                       <div className="text-sm text-foreground truncate">{item.dishName}</div>
                       {(specText || extraText) && (
                         <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                           {specText}{specText && extraText ? ' · ' : ''}{extraText && `加${extraText}`}
                         </div>
                       )}
                       <div className="text-sm font-semibold text-foreground mt-1">¥{item.finalPrice.toFixed(1)}</div>
                     </div>
                     <div className="flex items-center gap-2">
                       <motion.button
                         whileTap={{ scale: 0.8 }}
                         onClick={() => decreaseItem(item.skuKey)}
                         className="size-6 rounded-full border border-foreground flex items-center justify-center text-foreground"
                       >
                         <Minus className="size-3.5" />
                       </motion.button>
                       <span className="text-sm font-medium min-w-[20px] text-center tabular-nums">{qty}</span>
                       <motion.button
                         whileTap={{ scale: 0.85 }}
                         onClick={() => addItem(
                           shop.id,
                           shop.name,
                           { id: item.dishId, name: item.dishName, price: item.basePrice, image: item.image },
                           { specs: item.specs, extras: item.extras, quantity: 1 },
                         )}
                         className="size-6 rounded-full bg-foreground flex items-center justify-center text-background"
                       >
                         <Plus className="size-3.5" />
                       </motion.button>
                     </div>
                   </motion.div>
                 )
               })}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部购物车栏 */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-2 mx-auto max-w-md">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between h-14 px-4 bg-foreground text-background rounded-full shadow-lg"
        >
          <motion.div
            ref={cartIconRef}
            animate={cartBounce ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => totalCount > 0 && setCartOpen(v => !v)}
            className="relative flex items-center gap-2 cursor-pointer"
          >
            <div className="relative">
              <ShoppingCart className="size-6" />
              <AnimatePresence>
                {totalCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-background text-[10px] font-semibold flex items-center justify-center tabular-nums"
                  >
                    {totalCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-base font-bold tabular-nums">¥{totalAmount.toFixed(1)}</span>
          </motion.div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCheckout}
            disabled={!canCheckout}
            className={`px-5 h-9 rounded-full text-sm font-semibold transition-colors ${
              canCheckout
                ? 'bg-background text-foreground'
                : 'bg-background/20 text-background/60'
            }`}
          >
            {canCheckout ? '去结算' : `差 ¥${diffToMin.toFixed(1)} 起送`}
          </motion.button>
        </motion.div>
       </div>

      {/* 规格选择弹层 */}
      {specSheetDish && (
        <DishSpecSheet
          open={!!specSheetDish}
          onClose={() => setSpecSheetDish(null)}
          dish={{
            id: specSheetDish.id,
            name: specSheetDish.name,
            description: specSheetDish.description,
            basePrice: specSheetDish.price,
            image: specSheetDish.image,
            specs: specSheetDish.specs as IDishSpec[] | undefined,
            extras: specSheetDish.extras as IDishExtra[] | undefined,
          }}
          onConfirm={({ specs, extras, quantity, finalPrice }) => {
            if (!shop) return
            for (let i = 0; i < quantity; i++) {
              addItem(
                shop.id,
                shop.name,
                { id: specSheetDish.id, name: specSheetDish.name, price: specSheetDish.price, image: specSheetDish.image },
                { specs, extras },
              )
            }
            setSpecSheetDish(null)
            // 购物车抖动提示
            setCartBounce(true)
            setTimeout(() => setCartBounce(false), 400)
            toast.success('已加入购物车')
          }}
        />
      )}
    </div>
  )
}
