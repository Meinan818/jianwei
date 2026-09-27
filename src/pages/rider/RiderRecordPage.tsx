import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import {
  History, DollarSign, Calendar,
  Bike, TrendingUp, Wallet, Clock, Star, Target, Award,
  AlertCircle,
} from 'lucide-react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useRiderStatus } from '@/hooks/useRiderStatus'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatOrderTime } from '@/lib/utils'

const TABS = [
  { id: 'stats', label: '数据统计' },
  { id: 'history', label: '配送记录' },
  { id: 'income', label: '收入明细' },
  { id: 'withdraw', label: '提现记录' },
]

const RIDER_WALLET_KEY = 'food_delivery_rider_wallet'
const RIDER_WITHDRAW_KEY = 'food_delivery_rider_withdraw'

interface IRiderWithdrawRecord {
  id: string
  riderId: string
  amount: number
  fee: number
  arriveAmount: number
  status: 'pending' | 'success' | 'failed'
  account: string
  accountType: 'alipay' | 'wechat' | 'bank'
  createdAt: number
  arriveAt?: number
  remark?: string
}

export default function RiderRecordPage() {
  const { user } = useAuth()
  const { getRiderHistoryOrders, getRiderStats, orders } = useOrders()

  // 2026-09-28 修复：骑手身份用 profiles.id（uuid），工号只用于展示；钱包/提现的本机存储键随之改用 riderKey。
  const riderKey = user.id || user.riderId || 'R001'
  const [activeTab, setActiveTab] = useState('stats')
  const [withdrawSheetOpen, setWithdrawSheetOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [accountType, setAccountType] = useState<'alipay' | 'wechat' | 'bank'>('wechat')
  const [withdrawAccount, setWithdrawAccount] = useState('微信钱包')

  const [riderBalance, setRiderBalance] = useState(0)
  const [withdrawRecords, setWithdrawRecords] = useState<IRiderWithdrawRecord[]>([])

  const historyOrders = getRiderHistoryOrders(riderKey)
  const stats = getRiderStats(riderKey)

  // 加载骑手钱包数据
  useEffect(() => {
    try {
      const w = scopedStorage.getItem(`${RIDER_WALLET_KEY}_${riderKey}`)
      if (w) {
        setRiderBalance(parseFloat(w) || 0)
      } else {
        // 初始：已送达订单的累计收入 - 已提现（初始为0）
        const totalEarn = historyOrders.reduce((s, o) => s + (o.riderEarning || 5), 0)
        setRiderBalance(+totalEarn.toFixed(2))
        scopedStorage.setItem(`${RIDER_WALLET_KEY}_${riderKey}`, String(+totalEarn.toFixed(2)))
      }
    } catch {
      setRiderBalance(0)
    }
    try {
      const wr = scopedStorage.getItem(`${RIDER_WITHDRAW_KEY}_${riderKey}`)
      if (wr) {
        setWithdrawRecords(JSON.parse(wr))
      } else {
        const demo: IRiderWithdrawRecord[] = [
          { id: 'rw1', riderId: riderKey, amount: 100, fee: 1, arriveAmount: 99, status: 'success', account: '微信钱包', accountType: 'wechat', createdAt: Date.now() - 86400000 * 7, arriveAt: Date.now() - 86400000 * 6 },
        ]
        setWithdrawRecords(demo)
        scopedStorage.setItem(`${RIDER_WITHDRAW_KEY}_${riderKey}`, JSON.stringify(demo))
      }
    } catch {
      setWithdrawRecords([])
    }
  }, [riderKey, historyOrders.length])

  // 按月分组
  const grouped = useMemo(() => {
    const groups: Record<string, typeof historyOrders> = {}
    historyOrders.forEach(o => {
      const month = new Date(o.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
      if (!groups[month]) groups[month] = []
      groups[month].push(o)
    })
    return groups
  }, [historyOrders])

  const totalEarnings = stats.totalEarnings

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.info('请输入有效的提现金额')
      return
    }
    if (amount > riderBalance) {
      toast.info('可提现余额不足')
      return
    }
    if (amount < 10) {
      toast.info('最低提现金额为 10 元')
      return
    }
    const fee = Math.max(0.1, +(amount * 0.01).toFixed(2))
    const arriveAmount = +(amount - fee).toFixed(2)
    const record: IRiderWithdrawRecord = {
      id: `rwd_${Date.now()}`,
      riderId: riderKey,
      amount,
      fee,
      arriveAmount,
      status: 'pending',
      account: withdrawAccount,
      accountType,
      createdAt: Date.now(),
    }
    // 更新余额
    const newBalance = +(riderBalance - amount).toFixed(2)
    setRiderBalance(newBalance)
    scopedStorage.setItem(`${RIDER_WALLET_KEY}_${riderKey}`, String(newBalance))
    // 更新提现记录
    const newRecords = [record, ...withdrawRecords]
    setWithdrawRecords(newRecords)
    scopedStorage.setItem(`${RIDER_WITHDRAW_KEY}_${riderKey}`, JSON.stringify(newRecords))
    // 模拟到账
    setTimeout(() => {
      const updated = newRecords.map(r => r.id === record.id ? { ...r, status: 'success' as const, arriveAt: Date.now() } : r)
      setWithdrawRecords(updated)
      scopedStorage.setItem(`${RIDER_WITHDRAW_KEY}_${riderKey}`, JSON.stringify(updated))
    }, 2000)
    toast.success('提现申请已提交')
    setWithdrawSheetOpen(false)
    setWithdrawAmount('')
  }

  const STAT_CARDS = [
    { label: '准时率', value: stats.onTimeRate !== null ? `${stats.onTimeRate}%` : '暂无', Icon: Clock, color: 'text-green-600', bg: 'bg-green-500/10' },
    { label: '好评率', value: stats.goodRate !== null ? `${stats.goodRate}%` : '暂无', Icon: Star, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    { label: '累计单量', value: String(stats.totalDelivered), Icon: Award, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: '平均时长', value: `${stats.avgDuration || 0}分钟`, Icon: Target, color: 'text-purple-600', bg: 'bg-purple-500/10' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-8 pb-6 bg-foreground text-background"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-background/60">可提现余额</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">¥{riderBalance.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setWithdrawSheetOpen(true)}
            className="h-9 px-4 rounded-full bg-background text-foreground text-sm font-medium flex items-center gap-1"
          >
            <Wallet className="size-4" />
            提现
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-background/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-background/70 mb-1">
              <TrendingUp className="size-3.5" />
              <span className="text-xs">累计收入</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              ¥{totalEarnings.toFixed(1)}
            </p>
          </div>
          <div className="bg-background/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-background/70 mb-1">
              <Bike className="size-3.5" />
              <span className="text-xs">累计单量</span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {historyOrders.length}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab */}
      <div className="px-4 py-2 bg-background/85 backdrop-blur-xl border-b border-border/30">
        <LayoutGroup>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative pb-1.5 shrink-0"
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="rider-record-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
          {/* 数据统计 */}
          {activeTab === 'stats' && (
            <div className="p-4 space-y-4">
              {/* 4 个统计卡片 */}
              <div className="grid grid-cols-2 gap-3">
                {STAT_CARDS.map((card, i) => {
                  const Icon = card.Icon
                  return (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card rounded-xl border border-border/50 p-4"
                    >
                      <div className={`size-9 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                        <Icon className={`size-5 ${card.color}`} />
                      </div>
                      <p className="text-2xl font-bold text-foreground tabular-nums">{card.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                    </motion.div>
                  )
                })}
              </div>

              {/* 今日跑单 */}
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">今日跑单</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{stats.todayDelivered}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">完成单量</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">¥{stats.todayEarnings?.toFixed(1) || '0.0'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">今日收入</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground tabular-nums">{stats.avgDuration || 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">平均(分钟)</p>
                  </div>
                </div>
              </div>

              {/* 服务数据说明 */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-xs font-medium text-foreground mb-2">数据说明</p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• 准时率：按预计送达时间内完成的订单比例</li>
                  <li>• 好评率：顾客 5 星好评订单占比</li>
                  <li>• 数据由真实配送订单自动聚合计算</li>
                </ul>
              </div>
            </div>
          )}

          {/* 配送记录 */}
          {activeTab === 'history' && (
            <div className="px-4 py-3">
              {Object.keys(grouped).length > 0 ? (
                Object.entries(grouped).map(([month, orders]) => (
                  <div key={month} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{month}</span>
                      <span className="text-xs text-muted-foreground">
                        {orders.length} 单 · ¥{orders.reduce((s, o) => s + (o.riderEarning || 5), 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {orders.map(order => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-card rounded-xl border border-border/50 p-3 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {order.shopName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {order.address.address} {order.address.detail}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatOrderTime(order.createdAt)} 送达
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-sm font-bold text-foreground tabular-nums">
                              +¥{order.riderEarning?.toFixed(1) || '5.0'}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <History className="size-14 mb-3 opacity-30" />
                  <p className="text-sm">暂无配送记录</p>
                </div>
              )}
            </div>
          )}

          {/* 收入明细 */}
          {activeTab === 'income' && (
            <div className="px-4 py-3">
              {Object.keys(grouped).length > 0 ? (
                Object.entries(grouped).map(([month, orders]) => {
                  const monthIncome = orders.reduce((s, o) => s + (o.riderEarning || 5), 0)
                  return (
                    <div key={month} className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Wallet className="size-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{month}</span>
                        </div>
                        <span className="text-sm font-bold text-foreground tabular-nums">
                          +¥{monthIncome.toFixed(1)}
                        </span>
                      </div>
                      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                        {orders.map((order, i) => (
                          <div
                            key={order.id}
                            className={`px-4 py-3 flex items-center justify-between ${
                              i !== orders.length - 1 ? 'border-b border-border/30' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                                <Bike className="size-4 text-foreground/70" />
                              </div>
                              <div>
                                <p className="text-sm text-foreground">配送收入</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  订单 {order.id.slice(-6)}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-foreground tabular-nums">
                              +¥{order.riderEarning?.toFixed(1) || '5.0'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <DollarSign className="size-14 mb-3 opacity-30" />
                  <p className="text-sm">暂无收入明细</p>
                </div>
              )}
            </div>
          )}

          {/* 提现记录 */}
          {activeTab === 'withdraw' && (
            <div className="px-4 py-3">
              {withdrawRecords.length > 0 ? (
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
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Wallet className="size-12 mb-3 opacity-30" />
                  <p className="text-sm">暂无提现记录</p>
                </div>
              )}
            </div>
          )}
        </div>

      {/* 提现弹层 */}
      <Sheet open={withdrawSheetOpen} onOpenChange={setWithdrawSheetOpen}>
        <SheetContent side="bottom" className="h-[65vh] rounded-t-2xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 pb-0 pt-4">
              <SheetTitle>申请提现</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">可提现余额</p>
                <p className="text-3xl font-bold text-foreground tabular-nums">¥{riderBalance.toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">提现金额</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="最低 10 元"
                  className="h-11 text-lg font-semibold"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setWithdrawAmount(riderBalance.toFixed(2))}
                    className="text-xs text-primary"
                  >
                    全部提现
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    手续费 1%（最低 0.1 元）
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">到账账户</Label>
                <div className="space-y-2">
                  {[
                    { value: 'wechat' as const, label: '微信钱包', icon: '💚' },
                    { value: 'alipay' as const, label: '支付宝', icon: '💙' },
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
                  最低提现 10 元，按 1% 收取手续费。预计 1-3 个工作日到账。
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
