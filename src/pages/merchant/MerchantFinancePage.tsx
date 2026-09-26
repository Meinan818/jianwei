import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, ArrowRight,
  Calendar, ChevronRight, CreditCard, AlertCircle, Info,
} from 'lucide-react'
import TopNavBar from '@/components/TopNavBar'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useShopStatus } from '@/hooks/useShopStatus'
import { usePageBack, useNavigatePush } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TabKey = 'overview' | 'bill' | 'settlement'

export default function MerchantFinancePage() {
  const pageBack = usePageBack()
  const navigatePush = useNavigatePush()
  const { user } = useAuth()
  const { getShopStats, orders } = useOrders()
  const { getFinanceWithdrawRecords, requestFinanceWithdraw } = useShopStatus()

  const shopId = user.shopId || '1'
  const stats = getShopStats(shopId)
  const withdrawRecords = getFinanceWithdrawRecords(shopId)

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [withdrawSheetOpen, setWithdrawSheetOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAccount, setWithdrawAccount] = useState('微信商户号')
  const [accountType, setAccountType] = useState<'alipay' | 'wechat' | 'bank'>('wechat')

  // 结算相关计算
  const settlement = useMemo(() => {
    const delivered = orders.filter(o => o.shopId === shopId && o.status === 'delivered')
    const totalRevenue = delivered.reduce((s, o) => s + o.finalAmount, 0)
    // 退款金额：商家同意的售后退款（refundRequest.status === 'approved'），按申请退款金额计
    const refundedOrders = orders.filter(o => o.shopId === shopId && o.refundRequest?.status === 'approved')
    const refundAmount = refundedOrders.reduce((s, o) => s + (o.refundRequest!.amount || o.finalAmount), 0)
    const refundCount = refundedOrders.length
    const withdrawTotal = withdrawRecords.filter(r => r.status === 'success').reduce((s, r) => s + r.amount, 0)
    const withdrawPending = withdrawRecords.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
    const withdrawFee = withdrawRecords.filter(r => r.status === 'success').reduce((s, r) => s + r.fee, 0)
    // 可提现余额 = 已送达订单收入 - 已提现 - 手续费 - 退款
    const available = Math.max(0, +(totalRevenue - withdrawTotal - withdrawFee - refundAmount).toFixed(2))
    return {
      totalRevenue,
      refundAmount,
      refundCount,
      withdrawTotal,
      withdrawFee,
      withdrawPending,
      available,
      orderCount: delivered.length,
    }
  }, [orders, shopId, withdrawRecords])

  // 账单明细（按天聚合：已送达收入 + 售后退款支出）
  const billByDay = useMemo(() => {
    const dayMap = new Map<string, { income: number; refund: number; count: number; refundCount: number }>()
    // 已送达订单计收入
    const deliveredOrders = orders.filter(o => o.shopId === shopId && o.status === 'delivered')
    deliveredOrders.forEach(o => {
      const date = new Date(o.createdAt).toLocaleDateString('zh-CN')
      const existing = dayMap.get(date) || { income: 0, refund: 0, count: 0, refundCount: 0 }
      existing.income += o.finalAmount
      existing.count += 1
      dayMap.set(date, existing)
    })
    // 商家同意的退款计支出（按退款处理时间归类）
    const refundedOrders = orders.filter(o => o.shopId === shopId && o.refundRequest?.status === 'approved')
    refundedOrders.forEach(o => {
      const date = new Date(o.refundRequest!.handledAt || o.createdAt).toLocaleDateString('zh-CN')
      const existing = dayMap.get(date) || { income: 0, refund: 0, count: 0, refundCount: 0 }
      existing.refund += o.refundRequest!.amount || o.finalAmount
      existing.refundCount += 1
      dayMap.set(date, existing)
    })
    return Array.from(dayMap.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, data]) => ({ date, ...data }))
  }, [orders, shopId])

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.info('请输入有效的提现金额')
      return
    }
    if (amount > settlement.available) {
      toast.info('可提现余额不足')
      return
    }
    const result = requestFinanceWithdraw(shopId, amount, withdrawAccount, accountType)
    if (result.success) {
      toast.success(result.msg)
      setWithdrawSheetOpen(false)
      setWithdrawAmount('')
    } else {
      toast.error(result.msg)
    }
  }

  const TABS = [
    { key: 'overview' as const, label: '概览' },
    { key: 'bill' as const, label: '账单明细' },
    { key: 'settlement' as const, label: '提现记录' },
  ]

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopNavBar title="财务账单" onBack={pageBack} />

      {/* Tab */}
      <div className="px-4 py-2 border-b border-border/30 bg-card/50">
        <div className="flex gap-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-1.5 text-sm transition-colors ${
                activeTab === tab.key ? 'text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="merchant-finance-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
          {/* 概览 */}
          {activeTab === 'overview' && (
            <div className="p-4 space-y-4">
              {/* 可提现余额卡片 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-foreground text-background rounded-2xl p-5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-background/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-background/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                <p className="text-xs text-background/70 mb-1">可提现余额</p>
                <p className="text-4xl font-bold tabular-nums mb-4">¥{settlement.available.toFixed(2)}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWithdrawSheetOpen(true)}
                    className="flex-1 h-10 rounded-full bg-background text-foreground text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Wallet className="size-4" />
                    立即提现
                  </button>
                  <button
                    onClick={() => setActiveTab('bill')}
                    className="flex-1 h-10 rounded-full bg-background/20 text-background text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Calendar className="size-4" />
                    查看账单
                  </button>
                </div>
              </motion.div>

              {/* 今日数据 */}
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">今日数据</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">今日营业额</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">¥{stats.todayRevenue.toFixed(1)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stats.todayOrderCount} 笔订单</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">今日有效订单</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{stats.todayOrderCount}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">客单价 ¥{stats.avgOrderValue.toFixed(1)}</p>
                  </div>
                </div>
              </div>

              {/* 统计口径说明 */}
              <div className="bg-card/60 border border-border/40 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted-foreground leading-relaxed space-y-0.5">
                    <p className="text-foreground/80 font-medium">统计口径说明</p>
                    <p>• 营业收入：所有状态为「已送达」的订单实付金额</p>
                    <p>• 退款金额：商家「同意退款」的售后申请金额（按申请退款额计入）</p>
                    <p>• 可提现余额 = 营业收入 - 退款金额 - 已提现 - 提现手续费</p>
                    <p>• 今日数据含进行中订单，累计数据以已送达为准</p>
                  </div>
                </div>
              </div>

              {/* 累计数据 */}
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">累计收支</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <TrendingUp className="size-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">营业收入</p>
                        <p className="text-[11px] text-muted-foreground">{settlement.orderCount} 单已完成</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums">+¥{settlement.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="size-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">退款金额</p>
                         <p className="text-[11px] text-muted-foreground">{settlement.refundCount} 笔售后退款</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600 tabular-nums">-¥{settlement.refundAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <CreditCard className="size-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">已提现</p>
                        <p className="text-[11px] text-muted-foreground">手续费 ¥{settlement.withdrawFee.toFixed(2)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums">-¥{settlement.withdrawTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                        <Wallet className="size-4 text-foreground/70" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">可提现余额</p>
                        <p className="text-[11px] text-muted-foreground">待审核 ¥{settlement.withdrawPending.toFixed(2)}</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-foreground tabular-nums">¥{settlement.available.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 账单明细 */}
          {activeTab === 'bill' && (
            <div className="p-4">
              {billByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Calendar className="size-12 mb-3 opacity-30" />
                  <p className="text-sm">暂无账单记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {billByDay.map((day, idx) => (
                    <motion.div
                      key={day.date}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs text-muted-foreground">{day.date}</span>
                        <span className="text-xs text-foreground/70 tabular-nums">
                          收入 ¥{day.income.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <TrendingUp className="size-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-foreground">营业收入</p>
                              <p className="text-[11px] text-muted-foreground">{day.count} 单</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-green-600 tabular-nums">+¥{day.income.toFixed(2)}</span>
                        </div>
                        {day.refundCount > 0 && (
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <TrendingDown className="size-4 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm text-foreground">退款</p>
                                <p className="text-[11px] text-muted-foreground">{day.refundCount} 笔</p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-red-600 tabular-nums">-¥{day.refund.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 提现记录 */}
          {activeTab === 'settlement' && (
            <div className="p-4">
              {withdrawRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Wallet className="size-12 mb-3 opacity-30" />
                  <p className="text-sm">暂无提现记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawRecords.map((record, idx) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-card rounded-xl border border-border/50 px-4 py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-foreground/10 flex items-center justify-center">
                          <Wallet className="size-4 text-foreground/70" />
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            提现到{record.accountType === 'wechat' ? '微信' : record.accountType === 'alipay' ? '支付宝' : '银行卡'}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          -¥{record.amount.toFixed(2)}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${
                          record.status === 'success' ? 'text-green-600'
                          : record.status === 'failed' ? 'text-red-600'
                          : 'text-amber-600'
                        }`}>
                          {record.status === 'success' ? '到账成功' : record.status === 'failed' ? '提现失败' : '处理中'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* 提现弹层 */}
      <Sheet open={withdrawSheetOpen} onOpenChange={setWithdrawSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 pb-0 pt-4">
              <SheetTitle>申请提现</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">可提现余额</p>
                <p className="text-3xl font-bold text-foreground tabular-nums">¥{settlement.available.toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">提现金额</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="请输入提现金额"
                  className="h-11 text-lg font-semibold"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setWithdrawAmount(settlement.available.toFixed(2))}
                    className="text-xs text-primary"
                  >
                    全部提现
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    手续费 {(parseFloat(withdrawAmount) * 0.01 || 0).toFixed(2)} 元（1%）
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">到账账户</Label>
                <div className="space-y-2">
                  {[
                    { value: 'wechat' as const, label: '微信商户号', icon: '💚' },
                    { value: 'alipay' as const, label: '支付宝商户号', icon: '💙' },
                    { value: 'bank' as const, label: '银行卡', icon: '🏦' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setAccountType(opt.value)
                        setWithdrawAccount(opt.label)
                      }}
                      className={`w-full px-4 h-11 rounded-xl border text-left flex items-center gap-2 transition-colors ${
                        accountType === opt.value
                          ? 'border-foreground bg-foreground/5'
                          : 'border-border/50 bg-card'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-3 flex gap-2">
                <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700">
                  提现金额按 1% 收取手续费，最低 0.1 元。预计 1-3 个工作日到账。
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border/30">
              <Button className="w-full h-11 rounded-full" onClick={handleWithdraw}>
                确认提现
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
