import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, MessageSquare, Send, User, X, Check, Edit3 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useReviews } from '@/hooks/useReviews'
import { Image } from '@/components/ui/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

const TABS = [
  { id: 'all', label: '全部' },
  { id: 'good', label: '好评' },
  { id: 'mid', label: '中评' },
  { id: 'bad', label: '差评' },
]

export default function MerchantReviewsPage() {
  const { user } = useAuth()
  const { reviews, getShopAvgScore, replyToReview } = useReviews()

  const shopId = user.shopId || '1'
  const [activeTab, setActiveTab] = useState('all')
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')

  const shopReviews = useMemo(() => {
    return reviews.filter(r => r.shopId === shopId)
  }, [reviews, shopId])

  const avgScore = getShopAvgScore(shopId)

  const filtered = useMemo(() => {
    if (activeTab === 'all') return shopReviews
    if (activeTab === 'good') return shopReviews.filter(r => r.overallScore >= 4)
    if (activeTab === 'mid') return shopReviews.filter(r => r.overallScore === 3)
    if (activeTab === 'bad') return shopReviews.filter(r => r.overallScore <= 2)
    return shopReviews
  }, [shopReviews, activeTab])

  const handleReply = (reviewId: string) => {
    if (!replyContent.trim()) {
      toast.info('请输入回复内容')
      return
    }
    replyToReview(reviewId, replyContent.trim())
    toast.success('回复已发送')
    setReplyReviewId(null)
    setReplyContent('')
  }

  const StarRow = ({ value, size = 'sm', variant = 'light' }: { value: number; size?: 'sm' | 'md'; variant?: 'light' | 'dark' }) => {
    const sizeCls = size === 'sm' ? 'size-3' : 'size-4'
    const fillCls = variant === 'dark'
      ? 'fill-background text-background'
      : 'fill-foreground text-foreground'
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            className={`${sizeCls} ${
              n <= value ? fillCls : 'text-border/50'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部评分总览 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-foreground text-background"
      >
        {/* 页头标题 */}
        <div className="px-4 pt-3 pb-2 flex items-center">
          <h1 className="text-lg font-semibold">评价管理</h1>
        </div>
        <div className="px-4 pb-5">
        <div className="flex items-end gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold tabular-nums">{avgScore.count > 0 ? avgScore.overall : '5.0'}</p>
            <div className="flex justify-center mt-1">
              <StarRow value={Math.round(avgScore.overall || 5)} variant="dark" />
            </div>
            <p className="text-xs text-background/60 mt-1">共 {shopReviews.length} 条评价</p>
          </div>
          <div className="flex-1 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-background/70">口味</span>
              <span className="font-medium">{avgScore.taste || 5.0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-background/70">包装</span>
              <span className="font-medium">{avgScore.packaging || 5.0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-background/70">配送</span>
              <span className="font-medium">{avgScore.delivery || 5.0}</span>
            </div>
          </div>
        </div>
        </div>
      </motion.div>

      {/* Tab 切换 */}
      <div className="px-4 py-3 bg-background/85 backdrop-blur-xl border-b border-border/30 flex gap-4">
        {TABS.map(tab => {
          const count = tab.id === 'all'
            ? shopReviews.length
            : tab.id === 'good'
            ? shopReviews.filter(r => r.overallScore >= 4).length
            : tab.id === 'mid'
            ? shopReviews.filter(r => r.overallScore === 3).length
            : shopReviews.filter(r => r.overallScore <= 2).length
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm transition-colors ${
                activeTab === tab.id ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </div>

      {/* 评价列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-card rounded-xl border border-border/50 p-4"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={review.userAvatar} alt={review.userName} />
                      <AvatarFallback>
                        <User className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{review.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div className="mt-1">
                        <StarRow value={review.overallScore} />
                      </div>
                    </div>
                  </div>

                  {/* 标签 */}
                  {review.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {review.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] bg-foreground/10 text-foreground rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 内容 */}
                  {review.content && (
                    <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                      {review.content}
                    </p>
                  )}

                  {/* 菜品 */}
                  <div className="text-xs text-muted-foreground mb-3">
                    菜品：{review.dishes.join('、')}
                  </div>

                  {/* 商家回复展示 */}
                  {review.merchantReply && (
                    <div className="mt-3 p-3 bg-muted/60 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">商家回复</span>
                        <span className="text-[10px] text-muted-foreground">
                          {review.merchantReplyAt && new Date(review.merchantReplyAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{review.merchantReply}</p>
                    </div>
                  )}

                  {/* 回复按钮/回复内容 */}
                  <div className="flex justify-end">
                    {!review.merchantReply ? (
                      <button
                        onClick={() => {
                          setReplyReviewId(review.id)
                          setReplyContent('')
                        }}
                        className="text-xs text-foreground flex items-center gap-1"
                      >
                        <MessageSquare className="size-3.5" />
                        回复评价
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyReviewId(review.id)
                          setReplyContent(review.merchantReply || '')
                        }}
                        className="text-xs text-muted-foreground flex items-center gap-1"
                      >
                        <Edit3 className="size-3.5" />
                        重新回复
                      </button>
                    )}
                  </div>

                  {/* 回复输入框 */}
                  {replyReviewId === review.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 pt-3 border-t border-border/30"
                    >
                      <div className="flex items-end gap-2">
                        <textarea
                          value={replyContent}
                          onChange={e => setReplyContent(e.target.value.slice(0, 200))}
                          placeholder="回复顾客评价..."
                          className="flex-1 h-20 p-2 bg-muted rounded-lg text-xs outline-none resize-none"
                        />
                        <button
                          onClick={() => handleReply(review.id)}
                          className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0"
                        >
                          <Send className="size-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageSquare className="size-14 mb-3 opacity-30" />
              <p className="text-sm">暂无评价</p>
            </div>
          )}
      </div>
    </div>
  )
}
