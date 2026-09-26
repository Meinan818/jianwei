import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Store, MapPin, Clock, DollarSign, Bike, ChevronLeft,
  Upload, Camera, UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'
import { Image } from '@/components/ui/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { useShopStatus } from '@/hooks/useShopStatus'
import { compressImage } from '@/lib/image'
import { useNavigateReplace, usePageBack } from '@/hooks/useNavigationStack'

const CATEGORIES = [
  '快餐便当', '中式炒菜', '汉堡披萨', '奶茶饮品',
  '日韩料理', '烧烤炸串', '轻食沙拉', '粥粉面点',
  '甜品烘焙', '火锅麻辣烫',
]

const DEFAULT_DISHES = [
  { name: '招牌套餐', desc: '本店招牌，必点推荐', price: 28 },
  { name: '经典主食', desc: '实惠之选，分量十足', price: 22 },
  { name: '招牌饮品', desc: '清爽解腻', price: 12 },
]

/**
 * 商家「创建店铺」向导页
 * 商家账号注册/登录后，如果还没有店铺，跳转到这里创建。
 * 一账号一店铺：创建完成后绑定到当前商家账号，下次登录直接进控制台。
 */
export default function MerchantCreateShopPage() {
  const navigateReplace = useNavigateReplace()
  const pageBack = usePageBack()
  const { user, bindShop } = useAuth()
  const { createUserShop } = useShopStatus()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1) // 1: 基础信息  2: 经营设置
  const [name, setName] = useState('')
  const [category, setCategory] = useState('快餐便当')
  const [cover, setCover] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState(user.phone || '')
  const [businessHours, setBusinessHours] = useState('09:00 - 21:00')
  const [minOrder, setMinOrder] = useState('20')
  const [deliveryFee, setDeliveryFee] = useState('3')
  const [description, setDescription] = useState('')
  const [tagline, setTagline] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canNext = name.trim() && address.trim()

  const handleChooseCover = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file, 600, 0.75)
      setCover(compressed)
    } catch {
      toast.info('图片上传失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleNext = () => {
    if (!canNext) {
      toast.info('请填写店铺名称和地址')
      return
    }
    setStep(2)
  }

  const handleSubmit = () => {
    if (!/^\d+(\.\d{1,2})?$/.test(minOrder) || Number(minOrder) <= 0) {
      toast.info('请输入正确的起送价')
      return
    }
    if (!/^\d+(\.\d{1,2})?$/.test(deliveryFee) || Number(deliveryFee) < 0) {
      toast.info('请输入正确的配送费')
      return
    }
    setSubmitting(true)

    // 构造店铺
    const { shopId, shop } = createUserShop({
      ownerPhone: user.phone,
      name: name.trim(),
      tagline: tagline.trim() || '用心做好每一餐',
      category,
      cover,
      address: address.trim(),
      phone: phone.trim() || user.phone,
      businessHours,
      minOrder: Number(minOrder),
      deliveryFee: Number(deliveryFee),
      description: description.trim() || `${name.trim()}坚持新鲜食材，用心烹制每一道菜品。`,
      announcement: '欢迎光临本店~',
    })

    // 绑定到当前账号
    bindShop(shopId, name.trim())

    toast.success('店铺创建成功！欢迎来到饭否商家版')

    // 跳商家控制台
    setTimeout(() => {
      navigateReplace('/merchant')
    }, 600)
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 shrink-0 border-b border-border/50">
        <button
          onClick={() => step === 1 ? pageBack() : setStep(1)}
          className="size-8 -ml-1 flex items-center justify-center"
          aria-label="返回"
        >
          <ChevronLeft className="size-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-sm font-medium">创建店铺</h1>
        <div className="w-8" />
      </div>

      {/* 步骤指示 */}
      <div className="flex items-center gap-2 px-6 py-3">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`size-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              step >= s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}>
              {s}
            </div>
            <span className={`text-xs ${step >= s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {s === 1 ? '基础信息' : '经营设置'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
          {step === 1 ? (
            <div className="space-y-5 pt-2">
              {/* 封面上传 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">店铺封面</label>
                <button
                  type="button"
                  onClick={handleChooseCover}
                  className="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-border/60 bg-card flex flex-col items-center justify-center gap-2 relative overflow-hidden"
                >
                  {cover ? (
                    <>
                      <Image src={cover} alt="封面" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-2 text-white text-xs">
                        <Camera className="size-4" />
                        点击更换
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="size-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">点击上传店铺封面</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* 店铺名称 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">店铺名称 *</label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 30))}
                    placeholder="请输入店铺名称"
                    className="w-full h-11 pl-10 pr-4 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors"
                  />
                </div>
              </div>

              {/* 经营品类 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">经营品类</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`h-8 px-3 rounded-full text-xs transition-colors ${
                        category === cat
                          ? 'bg-foreground text-background'
                          : 'bg-card border border-border/50 text-foreground/70'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 店铺地址 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">店铺地址 *</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                  <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value.slice(0, 100))}
                    placeholder="请输入详细地址"
                    rows={2}
                    className="w-full pl-10 pr-3 py-2.5 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors resize-none"
                  />
                </div>
              </div>

              {/* 联系电话 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">联系电话</label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    placeholder="店铺联系电话"
                    className="w-full h-11 pl-10 pr-4 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors"
                  />
                </div>
              </div>

              {/* 一句话 slogan */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">店铺 slogan</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value.slice(0, 20))}
                  placeholder="一句话介绍你的店（选填）"
                  className="w-full h-11 px-4 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              {/* 营业时间 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">营业时间</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={businessHours}
                    onChange={e => setBusinessHours(e.target.value)}
                    placeholder="如 09:00 - 21:00"
                    className="w-full h-11 pl-10 pr-4 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors"
                  />
                </div>
              </div>

              {/* 起送价 + 配送费 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">起送价（元）</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={minOrder}
                      onChange={e => setMinOrder(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
                      placeholder="20"
                      className="w-full h-11 pl-10 pr-4 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">配送费（元）</label>
                  <div className="relative">
                    <Bike className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={deliveryFee}
                      onChange={e => setDeliveryFee(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
                      placeholder="3"
                      className="w-full h-11 pl-10 pr-4 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* 店铺简介 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">店铺简介</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 200))}
                  placeholder="介绍一下你的店铺..."
                  rows={4}
                  className="w-full px-4 py-3 bg-card border border-border/50 rounded-xl text-sm outline-none focus:border-foreground transition-colors resize-none"
                />
              </div>

              {/* 初始菜品提示 */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-foreground" />
                  <span className="text-xs font-medium text-foreground">初始菜品</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  我们会为您自动创建 3 道初始菜品和 1 个分类，进入商家控制台后可随时编辑、新增或下架菜品。
                </p>
                <div className="flex gap-2 pt-1">
                  {DEFAULT_DISHES.map(d => (
                    <div key={d.name} className="text-[10px] text-foreground/60 bg-background/60 px-2 py-1 rounded-md">
                      {d.name} · ¥{d.price}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
      </div>

      {/* 底部操作 */}
      <div className="px-6 py-4 border-t border-border/50 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {step === 1 ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center"
          >
            下一步
          </motion.button>
        ) : (
          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep(1)}
              className="flex-1 h-12 rounded-full bg-card border border-border/50 text-foreground text-sm font-medium"
            >
              上一步
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-12 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center disabled:opacity-50"
            >
              {submitting ? '创建中...' : '完成创建'}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}

// 简单的步骤切换动画容器
import { type ReactNode } from 'react'

// 步骤切换即时呈现，无动画（避免表单卸载重建、输入焦点丢失和白帧）
