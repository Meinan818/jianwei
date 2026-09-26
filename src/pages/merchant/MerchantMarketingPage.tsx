import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag, Percent, UserPlus, Truck, Plus, X, Check, Trash2,
  ChevronRight, ArrowLeft, ToggleLeft, ToggleRight,
} from 'lucide-react'
import TopNavBar from '@/components/TopNavBar'
import { useShopStatus } from '@/hooks/useShopStatus'
import { useAuth } from '@/hooks/useAuth'
import { usePageBack } from '@/hooks/useNavigationStack'
import { getAllShops } from '@/data/shops'
import type { IShopActivity, ActivityType } from '@/data/shop-status'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ACTIVITY_TYPES: { value: ActivityType; label: string; desc: string; Icon: typeof Tag }[] = [
  { value: 'fullReduce', label: '满减活动', desc: '满多少减多少，多档优惠', Icon: Tag },
  { value: 'discount', label: '店铺折扣', desc: '全店统一折扣率', Icon: Percent },
  { value: 'newUser', label: '新客立减', desc: '新用户首单立减', Icon: UserPlus },
  { value: 'freeDelivery', label: '免配送费', desc: '满额免配送费', Icon: Truck },
  { value: 'discountDish', label: '折扣菜品', desc: '指定菜品特价', Icon: Percent },
]

export default function MerchantMarketingPage() {
  const pageBack = usePageBack()
  const { user } = useAuth()
  const { getActivities, saveActivity, toggleActivity, deleteActivity } = useShopStatus()
  const shopId = user.shopId || '1'
  const shop = getAllShops().find(s => s.id === shopId)

  const activities = getActivities(shopId)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<IShopActivity | null>(null)
  const [activeType, setActiveType] = useState<ActivityType>('fullReduce')

  // 表单状态
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  // 满减
  const [thresholds, setThresholds] = useState<number[]>([30, 50, 80])
  const [discounts, setDiscounts] = useState<number[]>([3, 6, 12])
  const [newThreshold, setNewThreshold] = useState('')
  const [newDiscount, setNewDiscount] = useState('')
  // 新客立减
  const [newUserAmount, setNewUserAmount] = useState(5)
  // 店铺折扣
  const [discountRate, setDiscountRate] = useState(0.9)
  // 免配送费
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(30)
  // 折扣菜
  const [dishId, setDishId] = useState('')
  const [dishDiscountRate, setDishDiscountRate] = useState(0.8)

  const allDishes = useMemo(() => {
    if (!shop) return []
    const list: { id: string; name: string; price: number }[] = []
    shop.categories.forEach(cat => {
      cat.dishes.forEach(d => list.push({ id: d.id, name: d.name, price: d.price }))
    })
    return list
  }, [shop])

  const openCreate = (type: ActivityType) => {
    setEditingActivity(null)
    setActiveType(type)
    setFormName(ACTIVITY_TYPES.find(t => t.value === type)?.label || '')
    setFormDesc('')
    setThresholds([30, 50])
    setDiscounts([3, 6])
    setNewUserAmount(5)
    setDiscountRate(0.9)
    setFreeDeliveryMin(30)
    setDishId(allDishes[0]?.id || '')
    setDishDiscountRate(0.8)
    setSheetOpen(true)
  }

  const openEdit = (activity: IShopActivity) => {
    setEditingActivity(activity)
    setActiveType(activity.type)
    setFormName(activity.name)
    setFormDesc(activity.description)
    setThresholds(activity.thresholds || [30, 50])
    setDiscounts(activity.discounts || [3, 6])
    setNewUserAmount(activity.newUserAmount || 5)
    setDiscountRate(activity.discountRate || 0.9)
    setFreeDeliveryMin(activity.freeDeliveryMin || 30)
    setDishId(activity.dishId || allDishes[0]?.id || '')
    setDishDiscountRate(activity.dishDiscountRate || 0.8)
    setSheetOpen(true)
  }

  const handleAddTier = () => {
    const t = parseFloat(newThreshold)
    const d = parseFloat(newDiscount)
    if (isNaN(t) || isNaN(d) || t <= 0 || d <= 0) {
      toast.info('请输入有效的金额')
      return
    }
    const newTs = [...thresholds, t].sort((a, b) => a - b)
    const newDs = [...discounts, d].sort((a, b) => a - b)
    setThresholds(newTs)
    setDiscounts(newDs)
    setNewThreshold('')
    setNewDiscount('')
  }

  const handleRemoveTier = (idx: number) => {
    setThresholds(thresholds.filter((_, i) => i !== idx))
    setDiscounts(discounts.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!formName.trim()) {
      toast.info('请填写活动名称')
      return
    }
    const base: Partial<IShopActivity> = {
      name: formName.trim(),
      description: formDesc.trim(),
      active: editingActivity?.active ?? true,
    }
    let extra = {}
    switch (activeType) {
      case 'fullReduce':
        if (thresholds.length === 0) {
          toast.info('请至少添加一档满减')
          return
        }
        extra = {
          thresholds,
          discounts,
          description: formDesc.trim() || thresholds.map((t, i) => `满${t}减${discounts[i]}`).join('，'),
        }
        break
      case 'newUser':
        if (newUserAmount <= 0) {
          toast.info('请输入有效的立减金额')
          return
        }
        extra = { newUserAmount, description: formDesc.trim() || `新用户首单立减${newUserAmount}元` }
        break
      case 'discount':
        if (discountRate <= 0 || discountRate >= 1) {
          toast.info('折扣率必须在0~1之间')
          return
        }
        extra = { discountRate, description: formDesc.trim() || `全店${(discountRate * 10).toFixed(1)}折` }
        break
      case 'freeDelivery':
        if (freeDeliveryMin < 0) {
          toast.info('请输入有效的满减门槛')
          return
        }
        extra = { freeDeliveryMin, description: formDesc.trim() || `满${freeDeliveryMin}元免配送费` }
        break
      case 'discountDish':
        if (!dishId) {
          toast.info('请选择折扣菜品')
          return
        }
        const dish = allDishes.find(d => d.id === dishId)
        extra = { dishId, dishDiscountRate, description: formDesc.trim() || `${dish?.name || '指定菜品'}${(dishDiscountRate * 10).toFixed(1)}折` }
        break
    }
    saveActivity(shopId, {
      id: editingActivity?.id,
      type: activeType,
      ...base,
      ...extra,
    } as any)
    toast.success(editingActivity ? '活动已更新' : '活动已创建')
    setSheetOpen(false)
  }

  const handleToggle = (activity: IShopActivity) => {
    toggleActivity(shopId, activity.id, !activity.active)
    toast(activity.active ? '活动已停用' : '活动已启用')
  }

  const handleDelete = (activityId: string) => {
    deleteActivity(shopId, activityId)
    toast.success('活动已删除')
  }

  const getTypeMeta = (type: ActivityType) => ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[0]

  const getActivitySummary = (activity: IShopActivity): string => {
    switch (activity.type) {
      case 'fullReduce':
        return activity.thresholds?.map((t, i) => `满${t}减${activity.discounts?.[i] || 0}`).join('，') || ''
      case 'newUser':
        return `新客立减 ¥${activity.newUserAmount || 0}`
      case 'discount':
        return `全店 ${((activity.discountRate || 0) * 10).toFixed(1)} 折`
      case 'freeDelivery':
        return `满 ¥${activity.freeDeliveryMin || 0} 免配送费`
      case 'discountDish': {
        const dish = allDishes.find(d => d.id === activity.dishId)
        return `${dish?.name || '指定菜品'} ${((activity.dishDiscountRate || 0) * 10).toFixed(1)}折`
      }
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopNavBar title="营销活动" onBack={pageBack} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 活动类型快捷入口 */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">创建活动</p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_TYPES.map(type => {
              const Icon = type.Icon
              return (
                <motion.button
                  key={type.value}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openCreate(type.value)}
                  className="bg-card rounded-xl border border-border/50 p-3 text-left flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                      <Icon className="size-4 text-foreground/70" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{type.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{type.desc}</p>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* 活动列表 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">进行中的活动 ({activities.filter(a => a.active).length})</p>
          </div>
          {activities.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 flex flex-col items-center text-center">
              <Tag className="size-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">暂无活动</p>
              <p className="text-xs text-muted-foreground/70 mt-1">点击上方创建第一个活动</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, idx) => {
                const meta = getTypeMeta(activity.type)
                const Icon = meta.Icon
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-card rounded-xl border border-border/50 overflow-hidden"
                  >
                    <div
                      onClick={() => openEdit(activity)}
                      className="px-4 py-3 cursor-pointer active:bg-muted/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`size-8 rounded-lg flex items-center justify-center ${activity.active ? 'bg-foreground/10' : 'bg-muted opacity-50'}`}>
                            <Icon className={`size-4 ${activity.active ? 'text-foreground/70' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${activity.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {activity.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{meta.label}</p>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-foreground/70 ml-10">
                        {getActivitySummary(activity)}
                      </p>
                    </div>
                    <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between">
                      <button
                        onClick={() => handleDelete(activity.id)}
                        className="text-xs text-muted-foreground flex items-center gap-1"
                      >
                        <Trash2 className="size-3.5" />
                        删除
                      </button>
                      <button
                        onClick={() => handleToggle(activity)}
                        className="flex items-center gap-1"
                      >
                        {activity.active ? (
                          <>
                            <ToggleRight className="size-6 text-foreground" />
                            <span className="text-xs text-foreground/70">已启用</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="size-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">已停用</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 活动编辑弹层 */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 pb-0 pt-4">
              <SheetTitle>{editingActivity ? '编辑活动' : '创建活动'}</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* 活动名称 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">活动名称</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="请输入活动名称" />
              </div>

              {/* 活动描述 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">活动描述（可选）</Label>
                <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="简短描述活动内容" />
              </div>

              {/* 满减档位 */}
              {activeType === 'fullReduce' && (
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">满减档位</Label>
                  <div className="space-y-2">
                    {thresholds.map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-foreground">
                          满 <span className="font-semibold">¥{t}</span> 减 <span className="font-semibold">¥{discounts[i]}</span>
                        </span>
                        <button onClick={() => handleRemoveTier(i)} className="text-muted-foreground">
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} placeholder="满多少" className="h-9 text-sm" />
                    <span className="text-xs text-muted-foreground">减</span>
                    <Input type="number" value={newDiscount} onChange={e => setNewDiscount(e.target.value)} placeholder="减多少" className="h-9 text-sm" />
                    <Button size="sm" onClick={handleAddTier} className="h-9">
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* 新客立减 */}
              {activeType === 'newUser' && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">立减金额（元）</Label>
                  <Input type="number" value={newUserAmount} onChange={e => setNewUserAmount(parseFloat(e.target.value) || 0)} />
                  <p className="text-[11px] text-muted-foreground">新用户首次下单自动减免</p>
                </div>
              )}

              {/* 店铺折扣 */}
              {activeType === 'discount' && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">折扣率（0~1）</Label>
                  <Input type="number" step="0.05" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value) || 0.9)} />
                  <p className="text-[11px] text-muted-foreground">
                    当前折扣：{(discountRate * 10).toFixed(1)} 折，全店商品按此比例打折
                  </p>
                </div>
              )}

              {/* 免配送费 */}
              {activeType === 'freeDelivery' && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">最低消费（元）</Label>
                  <Input type="number" value={freeDeliveryMin} onChange={e => setFreeDeliveryMin(parseFloat(e.target.value) || 0)} />
                  <p className="text-[11px] text-muted-foreground">订单金额达到此门槛时免除配送费</p>
                </div>
              )}

              {/* 折扣菜 */}
              {activeType === 'discountDish' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">选择菜品</Label>
                    <select
                      value={dishId}
                      onChange={e => setDishId(e.target.value)}
                      className="w-full h-9 px-3 bg-muted rounded-lg text-sm outline-none border border-border/50"
                    >
                      {allDishes.map(d => (
                        <option key={d.id} value={d.id}>{d.name} (¥{d.price})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">折扣率（0~1）</Label>
                    <Input type="number" step="0.05" value={dishDiscountRate} onChange={e => setDishDiscountRate(parseFloat(e.target.value) || 0.8)} />
                    <p className="text-[11px] text-muted-foreground">
                      当前折扣：{(dishDiscountRate * 10).toFixed(1)} 折
                      {dishId && allDishes.find(d => d.id === dishId) && (
                        <>，折后价 ¥{(allDishes.find(d => d.id === dishId)!.price * dishDiscountRate).toFixed(1)}</>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border/30">
              <Button className="w-full h-11 rounded-full" onClick={handleSave}>
                <Check className="size-4 mr-1" />
                保存活动
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
