import { useState } from 'react'
import { motion } from 'framer-motion'
import { Store, Tag, Megaphone, DollarSign, Truck, Plus, X, Check, ChevronRight, Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useShopStatus } from '@/hooks/useShopStatus'
import { getAllShops } from '@/data/shops'
import { toast } from 'sonner'

export default function MerchantShopPage() {
  const { user } = useAuth()
  const { shopStatus, updateShopInfo, updatePromotion } = useShopStatus()

  const shopId = user.shopId || '1'
  const shop = getAllShops().find(s => s.id === shopId)
  const status = shopStatus[shopId]

  const [editing, setEditing] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState(status?.announcement || '')
  const [minOrder, setMinOrder] = useState(status?.minOrder?.toString() || '20')
  const [deliveryFee, setDeliveryFee] = useState(status?.deliveryFee?.toString() || '5')
  const [businessHours, setBusinessHours] = useState(status?.businessHours || shop?.businessHours || '09:00 - 21:00')

  // 满减档位
  const [promoThresholds, setPromoThresholds] = useState<number[]>(
    status?.promotion?.thresholds || [30, 50, 80],
  )
  const [promoDiscounts, setPromoDiscounts] = useState<number[]>(
    status?.promotion?.discounts || [3, 6, 12],
  )
  const [promoEnabled, setPromoEnabled] = useState(!!status?.promotion)
  const [newThreshold, setNewThreshold] = useState('')
  const [newDiscount, setNewDiscount] = useState('')

  const handleSaveAnnouncement = () => {
    updateShopInfo(shopId, { announcement })
    toast.success('公告已更新')
    setEditing(null)
  }

  const handleSaveMinOrder = () => {
    const val = parseFloat(minOrder)
    if (isNaN(val) || val < 0) {
      toast.info('请输入有效起送价')
      return
    }
    updateShopInfo(shopId, { minOrder: val })
    toast.success('起送价已更新')
    setEditing(null)
  }

  const handleSaveDeliveryFee = () => {
    const val = parseFloat(deliveryFee)
    if (isNaN(val) || val < 0) {
      toast.info('请输入有效配送费')
      return
    }
    updateShopInfo(shopId, { deliveryFee: val })
    toast.success('配送费已更新')
    setEditing(null)
  }

  const handleSaveBusinessHours = () => {
    if (!businessHours.trim()) {
      toast.info('请输入营业时间')
      return
    }
    updateShopInfo(shopId, { businessHours: businessHours.trim() })
    toast.success('营业时间已更新')
    setEditing(null)
  }

  const handleAddTier = () => {
    const t = parseFloat(newThreshold)
    const d = parseFloat(newDiscount)
    if (isNaN(t) || isNaN(d) || t <= 0 || d <= 0) {
      toast.info('请输入有效的满减档位')
      return
    }
    // 插入排序
    const newTs = [...promoThresholds, t].sort((a, b) => a - b)
    const newDs = [...promoDiscounts, d].sort((a, b) => a - b)
    setPromoThresholds(newTs)
    setPromoDiscounts(newDs)
    setNewThreshold('')
    setNewDiscount('')
  }

  const handleRemoveTier = (idx: number) => {
    setPromoThresholds(promoThresholds.filter((_, i) => i !== idx))
    setPromoDiscounts(promoDiscounts.filter((_, i) => i !== idx))
  }

  const handleSavePromotion = () => {
    if (!promoEnabled) {
      updatePromotion(shopId, null)
      toast.success('已关闭满减活动')
      return
    }
    if (promoThresholds.length === 0) {
      toast.info('请至少添加一个满减档位')
      return
    }
    const desc = promoThresholds.map((t, i) => `满${t}减${promoDiscounts[i]}`).join('，')
    updatePromotion(shopId, {
      type: 'fullReduce',
      thresholds: promoThresholds,
      discounts: promoDiscounts,
      description: desc,
    })
    toast.success('满减活动已保存')
  }

  if (!shop) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 bg-background">
        <Store className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">未找到对应店铺</p>
        <p className="text-xs text-muted-foreground/70">请检查账号权限后重试</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* 顶部 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30"
      >
        <h1 className="text-lg font-semibold text-foreground">店铺设置</h1>
      </motion.div>

      <div className="p-4 space-y-4">
        {/* 店铺信息 */}
        <motion.div
          initial={{ opacity: 0.98, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-card rounded-xl border border-border/50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <Store className="size-4 text-foreground/70" />
            <span className="text-sm font-semibold text-foreground">店铺信息</span>
          </div>

          {/* 店铺公告 */}
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-muted-foreground" />
                <span className="text-sm text-foreground">店铺公告</span>
              </div>
              {editing !== 'announcement' ? (
                <button
                  onClick={() => {
                    setAnnouncement(status?.announcement || shop.announcement || '')
                    setEditing('announcement')
                  }}
                  className="text-xs text-foreground underline underline-offset-2"
                >
                  编辑
                </button>
              ) : null}
            </div>
            {editing === 'announcement' ? (
              <div className="space-y-2">
                <textarea
                  value={announcement}
                  onChange={e => setAnnouncement(e.target.value.slice(0, 100))}
                  placeholder="输入店铺公告"
                  className="w-full h-20 p-2 bg-muted rounded-lg text-sm outline-none resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="h-7 px-3 rounded-full border border-border text-xs text-muted-foreground"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveAnnouncement}
                    className="h-7 px-3 rounded-full bg-foreground text-background text-xs flex items-center gap-1"
                  >
                    <Check className="size-3" />
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {status?.announcement || shop.announcement || '暂无公告'}
              </p>
            )}
          </div>

          {/* 起送价 */}
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-muted-foreground" />
                <span className="text-sm text-foreground">起送价</span>
              </div>
              {editing === 'minOrder' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minOrder}
                    onChange={e => setMinOrder(e.target.value)}
                    className="w-20 h-7 px-2 bg-muted rounded text-xs text-right outline-none"
                  />
                  <button
                    onClick={handleSaveMinOrder}
                    className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center"
                  >
                    <Check className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMinOrder((status?.minOrder ?? shop.minOrder).toString())
                    setEditing('minOrder')
                  }}
                  className="text-sm font-medium text-foreground tabular-nums"
                >
                  ¥{status?.minOrder ?? shop.minOrder}
                </button>
              )}
            </div>
          </div>

          {/* 配送费 */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-muted-foreground" />
                <span className="text-sm text-foreground">配送费</span>
              </div>
              {editing === 'deliveryFee' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={e => setDeliveryFee(e.target.value)}
                    className="w-20 h-7 px-2 bg-muted rounded text-xs text-right outline-none"
                  />
                  <button
                    onClick={handleSaveDeliveryFee}
                    className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center"
                  >
                    <Check className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDeliveryFee((status?.deliveryFee ?? shop.deliveryFee).toString())
                    setEditing('deliveryFee')
                  }}
                  className="text-sm font-medium text-foreground tabular-nums"
                >
                  ¥{status?.deliveryFee ?? shop.deliveryFee}
                </button>
              )}
            </div>
          </div>
          {/* 营业时间 */}
          <div className="px-4 py-3 border-t border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm text-foreground">营业时间</span>
              </div>
              {editing === 'businessHours' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={businessHours}
                    onChange={e => setBusinessHours(e.target.value.slice(0, 30))}
                    placeholder="如 09:00 - 21:00"
                    className="w-36 h-7 px-2 bg-muted rounded text-xs text-right outline-none"
                  />
                  <button
                    onClick={handleSaveBusinessHours}
                    className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center"
                  >
                    <Check className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setBusinessHours(status?.businessHours || shop.businessHours || '')
                    setEditing('businessHours')
                  }}
                  className="text-sm font-medium text-foreground"
                >
                  {status?.businessHours || shop.businessHours || '设置营业时间'}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* 满减活动 */}
        <motion.div
          initial={{ opacity: 0.98, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-card rounded-xl border border-border/50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-foreground/70" />
              <span className="text-sm font-semibold text-foreground">满减活动</span>
            </div>
            <button
              onClick={() => setPromoEnabled(!promoEnabled)}
              className={`relative size-9 rounded-full transition-colors ${
                promoEnabled ? 'bg-foreground' : 'bg-muted'
              }`}
            >
              <motion.div
                animate={{ x: promoEnabled ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 size-5 rounded-full bg-background"
              />
            </button>
          </div>

          {promoEnabled && (
            <div className="px-4 py-3 space-y-3">
              <div className="space-y-2">
                {promoThresholds.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm text-foreground">
                      满 <span className="font-semibold">¥{t}</span> 减{' '}
                      <span className="font-semibold">¥{promoDiscounts[i]}</span>
                    </span>
                    <button
                      onClick={() => handleRemoveTier(i)}
                      className="text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 新增档位 */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newThreshold}
                  onChange={e => setNewThreshold(e.target.value)}
                  placeholder="满多少"
                  className="flex-1 h-8 px-3 bg-muted rounded-lg text-xs outline-none"
                />
                <span className="text-xs text-muted-foreground">减</span>
                <input
                  type="number"
                  value={newDiscount}
                  onChange={e => setNewDiscount(e.target.value)}
                  placeholder="减多少"
                  className="flex-1 h-8 px-3 bg-muted rounded-lg text-xs outline-none"
                />
                <button
                  onClick={handleAddTier}
                  className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSavePromotion}
                className="w-full h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
              >
                <Check className="size-4" />
                保存活动
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      <div className="h-6" />
    </div>
  )
}
