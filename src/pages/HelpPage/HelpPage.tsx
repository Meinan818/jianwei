import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, HelpCircle, MessageSquarePlus, ChevronDown, ChevronUp, Send, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'

const FEEDBACK_KEY = 'food_delivery_feedback'

const FAQ_ITEMS = [
  {
    q: '如何下单？',
    a: '在首页选择喜欢的店铺，进入店铺后将菜品加入购物车，满足起送价后点击"去结算"提交订单即可。',
  },
  {
    q: '配送时间大概多久？',
    a: '一般为30-45分钟，具体以店铺出餐速度和骑手配送距离为准。订单跟踪页可实时查看配送进度。',
  },
  {
    q: '如何联系商家或骑手？',
    a: '在订单详情页或订单跟踪页，点击"联系商家"或"联系骑手"按钮，可直接发起在线对话。',
  },
  {
    q: '订单可以取消吗？',
    a: '商家未接单前可直接取消；商家已接单后需联系商家协商，同意后由商家取消。',
  },
  {
    q: '如何申请退款？',
    a: '在订单详情页点击"申请退款"，填写原因后提交，商家审核通过后退款将原路返回。',
  },
  {
    q: '优惠券怎么使用？',
    a: '结算时系统会自动匹配可用的优惠券，选择后即可抵扣相应金额。可在"我的-优惠券"中查看全部券。',
  },
  {
    q: '地址如何管理？',
    a: '在"我的"页面点击"地址管理"，可新增、编辑、删除收货地址，并设置默认地址。',
  },
]

/**
 * 顾客端帮助与反馈页：FAQ 折叠列表 + 意见反馈
 */
export default function HelpPage() {
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toggleFaq = (i: number) => {
    setOpenIndex(openIndex === i ? null : i)
  }

  const handleSubmit = () => {
    if (!feedback.trim()) {
      toast.info('请输入反馈内容')
      return
    }
    try {
      const existing = JSON.parse(scopedStorage.getItem(FEEDBACK_KEY) || '[]')
      existing.unshift({
        id: `fb_${Date.now()}`,
        content: feedback.trim(),
        createdAt: Date.now(),
        status: 'pending',
      })
      scopedStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing))
    } catch {
      // ignore
    }
    setSubmitted(true)
    setFeedback('')
    toast.success('反馈已提交，感谢您的建议')
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="flex flex-col h-dvh bg-muted/20">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateReplace('/customer/profile')}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">帮助与反馈</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* 常见问题 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <HelpCircle className="size-4" />
            常见问题
          </h2>
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            {FAQ_ITEMS.map((item, i) => {
              const open = openIndex === i
              return (
                <button
                  key={item.q}
                  onClick={() => toggleFaq(i)}
                  className="w-full text-left border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm text-foreground font-medium pr-3">{item.q}</span>
                    {open ? (
                      <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-3.5 text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* 意见反馈 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <MessageSquarePlus className="size-4" />
            意见反馈
          </h2>
          <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              您遇到的问题或建议对我们很重要，我们会认真对待每一条反馈。
            </p>
            <Textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="请描述您遇到的问题或建议..."
              className="min-h-[100px] resize-none bg-muted border-0 text-sm"
            />
            {submitted ? (
              <div className="flex items-center justify-center gap-2 py-2 text-success text-sm">
                <Check className="size-4" />
                反馈提交成功，感谢您的支持
              </div>
            ) : (
              <Button onClick={handleSubmit} className="w-full h-10" disabled={!feedback.trim()}>
                <Send className="size-4 mr-2" />
                提交反馈
              </Button>
            )}
          </div>
        </motion.div>

        {/* 客服信息 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 bg-card rounded-xl border border-border/50 p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-2">联系客服</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>客服热线：400-888-8888</p>
            <p>服务时间：09:00 - 22:00</p>
            <p>邮箱：support@fanfou.delivery</p>
          </div>
        </motion.div>

        <div className="h-6" />
      </div>
    </div>
  )
}
