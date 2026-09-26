import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Star, Send, CheckCircle, X, Image as ImageIcon, EyeOff } from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useReviews } from '@/hooks/useReviews'
import { useUser } from '@/hooks/useUser'
import { usePageBack, useNavigateReplace } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import { Image } from '@/components/ui/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { compressImage, readFileAsDataURL } from '@/lib/image'

const TASTE_TAGS = ['味道好', '分量足', '新鲜', '性价比高', '包装好', '配送快', '推荐', '下次还点']

export default function ReviewPage() {
  const pageBack = usePageBack()
  const navigateReplace = useNavigateReplace()
  const location = useLocation()
  const { getOrder, markReviewed } = useOrders()
  const { addReview, getReviewByOrder } = useReviews()
  const { user } = useUser()

  const searchParams = new URLSearchParams(location.search)
  const orderId = searchParams.get('orderId') || ''
  const mode = searchParams.get('mode') || 'new' // new | view
  const order = getOrder(orderId)
  const existingReview = useMemo(() => getReviewByOrder(orderId), [orderId, getReviewByOrder])

  const [overall, setOverall] = useState(5)
  const [taste, setTaste] = useState(5)
  const [packaging, setPackaging] = useState(5)
  const [delivery, setDelivery] = useState(5)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 查看模式下，初始化已有评价数据
  useEffect(() => {
    if (mode === 'view' && existingReview) {
      setOverall(existingReview.overallScore)
      setTaste(existingReview.tasteScore)
      setPackaging(existingReview.packagingScore)
      setDelivery(existingReview.deliveryScore)
      setSelectedTags(existingReview.tags)
      setContent(existingReview.content)
      setImages(existingReview.images || [])
      setAnonymous(!!existingReview.anonymous)
    }
  }, [mode, existingReview])

  // 已评价的订单自动进入查看模式
  useEffect(() => {
    if (mode === 'new' && order?.reviewed) {
      navigateReplace(`/customer/review?orderId=${orderId}&mode=view`)
    }
  }, [mode, order, orderId, navigateReplace])

  const isViewMode = mode === 'view'

  const dishScores = useMemo(() => {
    if (!order) return []
    if (isViewMode && existingReview) {
      const scoreMap: Record<string, number> = {}
      existingReview.dishScores.forEach(d => { scoreMap[d.dishId] = d.score })
      return order.items.map(item => ({
        dishId: item.dishId,
        dishName: item.dishName,
        score: scoreMap[item.dishId] || 5,
      }))
    }
    return order.items.map(item => ({
      dishId: item.dishId,
      dishName: item.dishName,
      score: 5,
    }))
  }, [order, isViewMode, existingReview])

  const [dishScoreState, setDishScoreState] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    dishScores.forEach(d => { init[d.dishId] = d.score })
    return init
  })

  // 查看模式下同步菜品分数
  useEffect(() => {
    if (isViewMode && dishScores.length > 0) {
      const obj: Record<string, number> = {}
      dishScores.forEach(d => { obj[d.dishId] = d.score })
      setDishScoreState(obj)
    }
  }, [isViewMode, dishScores])

  const toggleTag = (tag: string) => {
    if (isViewMode) return
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    )
  }

  const setDishScore = (dishId: string, score: number) => {
    if (isViewMode) return
    setDishScoreState(prev => ({ ...prev, [dishId]: score }))
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const remaining = 6 - images.length
    const toAdd = Array.from(files).slice(0, remaining)
    const results: string[] = []
    for (const f of toAdd) {
      try {
        const dataUrl = await readFileAsDataURL(f)
        const compressed = await compressImage(dataUrl, 800, 0.8)
        results.push(compressed)
      } catch {
        // ignore
      }
    }
    setImages(prev => [...prev, ...results])
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    if (!order) {
      toast.info('订单信息不存在')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      addReview({
        orderId: order.id,
        shopId: order.shopId,
        userId: 'user1',
        userName: anonymous ? '匿名用户' : user.nickname,
        userAvatar: anonymous ? '' : user.avatar,
        overallScore: overall,
        tasteScore: taste,
        packagingScore: packaging,
        deliveryScore: delivery,
        tags: selectedTags,
        content,
        images,
        anonymous,
        dishScores: Object.entries(dishScoreState).map(([dishId, score]) => {
          const item = order.items.find(i => i.dishId === dishId)
          return { dishId, dishName: item?.dishName || '', score }
        }),
        dishes: order.items.map(i => i.dishName),
      })
       // 标记订单已评价
       markReviewed(order.id)
       setSubmitting(false)
      toast.success('评价提交成功')
      setTimeout(() => pageBack(), 800)
    }, 600)
  }

  const StarRow = ({ value, onChange, size = 'md', disabled = false }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md'; disabled?: boolean }) => {
    const sizeCls = size === 'sm' ? 'size-4' : 'size-6'
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          disabled ? (
            <Star
              key={n}
              className={`${sizeCls} ${
                n <= value ? 'fill-foreground text-foreground' : 'text-border'
              }`}
            />
          ) : (
            <motion.button
              key={n}
              whileTap={{ scale: 0.8 }}
              onClick={() => onChange?.(n)}
              className="p-0.5"
            >
              <Star
                className={`${sizeCls} transition-colors ${
                  n <= value ? 'fill-foreground text-foreground' : 'text-border'
                }`}
              />
            </motion.button>
          )
        ))}
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <div className="flex items-center h-12 px-3 border-b border-border/30">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => pageBack()} className="size-8 -ml-1">
            <ChevronLeft className="size-5 text-foreground" />
          </motion.button>
          <h1 className="flex-1 text-center text-base font-semibold">{isViewMode ? '我的评价' : '评价订单'}</h1>
          <div className="size-8" />
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">订单不存在</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 border-b border-border/30 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => pageBack()} className="size-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="size-5 text-foreground" />
        </motion.button>
        <h1 className="flex-1 text-center text-base font-semibold text-foreground">{isViewMode ? '我的评价' : '评价订单'}</h1>
        <div className="size-8" />
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* 整体评分 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 flex flex-col items-center border-b border-border/30 bg-card"
        >
          <p className="text-sm text-muted-foreground mb-2">整体评分</p>
          <StarRow value={overall} onChange={setOverall} disabled={isViewMode} />
          <p className="text-xs text-foreground mt-2">
            {['', '很差', '一般', '还行', '满意', '超赞'][overall]}
          </p>
          {isViewMode && (
            <div className="mt-3 flex items-center gap-1 text-xs text-foreground/70">
              <CheckCircle className="size-3.5" />
              <span>评价于 {new Date(existingReview?.createdAt || 0).toLocaleDateString('zh-CN')}</span>
            </div>
          )}
        </motion.div>

        {/* 分项评分 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="px-4 py-3 bg-card border-b border-border/30 space-y-2.5"
        >
          {[
            { label: '口味', value: taste, onChange: setTaste },
            { label: '包装', value: packaging, onChange: setPackaging },
            { label: '配送', value: delivery, onChange: setDelivery },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-foreground">{item.label}</span>
              <StarRow value={item.value} onChange={item.onChange} size="sm" disabled={isViewMode} />
            </div>
          ))}
        </motion.div>

        {/* 标签 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-4 py-3 bg-card border-b border-border/30"
        >
          <p className="text-sm text-foreground font-medium mb-2">快捷评价</p>
          <div className="flex flex-wrap gap-2">
             {TASTE_TAGS.map(tag => {
               const isSelected = selectedTags.includes(tag)
               return (
                 <motion.button
                   key={tag}
                   whileTap={{ scale: 0.92 }}
                   onClick={() => toggleTag(tag)}
                   disabled={isViewMode}
                   className={`px-3 py-1 rounded-full text-xs border transition-colors ${isViewMode ? 'cursor-default' : ''} ${
                     isSelected
                       ? 'bg-foreground text-background border-foreground'
                       : 'bg-background text-muted-foreground border-border'
                   }`}
                 >
                   {tag}
                 </motion.button>
               )
             })}
          </div>
        </motion.div>

         {/* 图片区域（新建模式：上传） */}
        {!isViewMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.17 }}
            className="px-4 py-3 bg-card border-b border-border/30"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">晒图 <span className="text-xs text-muted-foreground font-normal">({images.length}/6)</span></p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <Image src={src} alt={`图${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImageIcon className="size-6 mb-1" />
                  <span className="text-[10px]">添加</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
          </motion.div>
        )}

        {/* 图片展示（查看模式） */}
        {isViewMode && images.length > 0 && (
          <div className="px-4 py-3 bg-card border-b border-border/30">
            <p className="text-sm font-medium mb-2">评价图片</p>
            <div className="grid grid-cols-4 gap-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewImg(src)}
                  className="aspect-square rounded-lg overflow-hidden bg-muted"
                >
                  <Image src={src} alt={`图${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

         {/* 文字评价 */}
        {isViewMode ? (
          content ? (
            <div className="px-4 py-3 bg-card border-b border-border/30">
              <p className="text-sm text-foreground font-medium mb-2">评价内容</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{content}</p>
            </div>
          ) : null
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="px-4 py-3 bg-card border-b border-border/30"
          >
            <p className="text-sm text-foreground font-medium mb-2">说说你的感受</p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value.slice(0, 200))}
              placeholder="味道怎么样？包装如何？配送快不快？"
              className="w-full h-24 p-3 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
            />
            <div className="text-right text-xs text-muted-foreground mt-1">{content.length}/200</div>
          </motion.div>
        )}

         {/* 匿名评价 */}
         {!isViewMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="px-4 py-3 bg-card border-b border-border/30 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <EyeOff className="size-4 text-muted-foreground" />
              <span className="text-sm">匿名评价</span>
            </div>
            <button
              onClick={() => setAnonymous(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                anonymous ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <motion.div
                animate={{ x: anonymous ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm"
              />
            </button>
          </motion.div>
        )}

         {/* 菜品打分 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-2 bg-card border-b border-border/30"
        >
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-sm text-foreground font-medium">菜品打分</p>
          </div>
          <div className="px-4 py-2 space-y-2">
            {order.items.map(item => (
              <div key={item.dishId} className="flex items-center gap-3 py-1.5">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  <Image src={item.image} alt={item.dishName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.dishName}</p>
                  <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                </div>
                <StarRow value={dishScoreState[item.dishId] || 5} onChange={v => setDishScore(item.dishId, v)} size="sm" disabled={isViewMode} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* 订单信息卡片 (查看模式) */}
        {isViewMode && (
          <div className="mt-2 px-4 py-3 bg-card border-b border-border/30">
            <p className="text-sm text-foreground font-medium mb-2">订单信息</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>商家</span>
                <span className="text-foreground">{order.shopName}</span>
              </div>
              <div className="flex justify-between">
                <span>下单时间</span>
                <span className="text-foreground">
                  {new Date(order.createdAt).toLocaleString('zh-CN', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>实付金额</span>
                <span className="text-foreground font-medium">¥{order.finalAmount.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 图片预览 */}
      <AnimatePresence>
        {previewImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setPreviewImg(null)}
          >
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-4 right-4 size-10 rounded-full bg-white/10 text-white flex items-center justify-center z-10"
            >
              <X className="size-5" />
            </button>
            <Image
              src={previewImg}
              alt="预览"
              className="max-w-full max-h-[80vh] object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部操作 (仅新建模式) */}
      {!isViewMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md bg-card border-t border-border/30 px-4 py-3">
           <motion.button
             whileTap={submitting ? {} : { scale: 0.98 }}
             onClick={handleSubmit}
             disabled={submitting}
             className={`w-full h-11 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity ${
               submitting ? 'opacity-70 cursor-not-allowed' : ''
             }`}
           >
             {submitting ? (
               <>
                 <motion.div
                   animate={{ rotate: 360 }}
                   transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                   className="size-4 border-2 border-background/30 border-t-background rounded-full"
                 />
                 提交中...
               </>
             ) : (
               <>
                 <Send className="size-4" />
                 提交评价
               </>
             )}
           </motion.button>
        </div>
      )}
    </div>
  )
}
