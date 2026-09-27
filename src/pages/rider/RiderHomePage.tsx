import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Bike, TrendingUp, Clock, DollarSign, Zap, MapPin,
  ChevronRight, LogOut, Bell, Settings, AppWindow, Package,
  Target, Award, Timer, Route,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useNavigateTab, useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { isTabRoot } from '@/data/navigation'
import { useRiderStatus } from '@/hooks/useRiderStatus'
import { toast } from 'sonner'

export default function RiderHomePage() {
  const navigateTab = useNavigateTab()
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const { user, logout } = useAuth()
  const { orders, getRiderStats, poolOrders, getRiderActiveOrders } = useOrders()
  const { riderStatus, toggleRiderOnline } = useRiderStatus()

  // 2026-09-28 修复：订单过滤/统计用的骑手身份改成 profiles.id（uuid），工号只用于展示。
  const riderKey = user.id || user.riderId || 'r1'
  const riderNo = user.riderId || 'R0000'
  const status = riderStatus[riderKey]
  const isOnline = status?.isOnline ?? true

  const stats = getRiderStats(riderKey)
  const pool = poolOrders
  const activeOrders = getRiderActiveOrders(riderKey)

  // 今日跑单卡片数据
  const todayStats = [
    { label: '今日接单', value: stats.todayCount, Icon: Package, unit: '单' },
    { label: '今日收入', value: stats.todayEarnings || Math.round(stats.todayDelivered * 3.5 * 10) / 10, Icon: DollarSign, unit: '元', prefix: '¥' },
    { label: '配送时长', value: stats.avgDuration || 22, Icon: Timer, unit: '分钟' },
    { label: '累计完成', value: stats.totalDelivered, Icon: Award, unit: '单' },
  ]

  const handleToggleOnline = () => {
    toggleRiderOnline(riderKey, !isOnline)
    toast.success(isOnline ? '已切换为下线休息' : '已上线，开始接单吧！')
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* 顶部骑手信息 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-8 pb-6 bg-foreground text-background"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-background/20 flex items-center justify-center overflow-hidden">
              <Bike className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{user.nickname || '骑手小王'}</h1>
              <p className="text-xs text-background/70 mt-0.5">骑手 · {riderNo}</p>
            </div>
          </div>
          <button
            onClick={() => navigatePush('/rider/messages')}
            className="relative size-9 rounded-full bg-background/10 flex items-center justify-center"
          >
            <Bell className="size-5" />
            {activeOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-background text-[10px] font-bold flex items-center justify-center">
                {activeOrders.length > 99 ? '99+' : activeOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* 接单状态开关 */}
        <div className="flex items-center justify-between bg-background/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bike className={`size-5 ${isOnline ? '' : 'opacity-50'}`} />
              {isOnline && (
                <div className="absolute inset-0 size-5 rounded-full bg-background/30 animate-ping" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{isOnline ? '上线接单中' : '下线休息'}</p>
              <p className="text-[11px] text-background/60">
                {isOnline ? '新订单将自动推送给您' : '下线期间不接收新订单'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleOnline}
            className={`relative size-11 rounded-full transition-colors ${
              isOnline ? 'bg-background' : 'bg-background/30'
            }`}
          >
            <motion.div
              animate={{ x: isOnline ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 size-5 rounded-full bg-foreground"
            />
          </button>
        </div>
      </motion.div>

      {/* 今日跑单数据 */}
      <motion.div
        initial={{ opacity: 0.98, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-4 -mt-4 bg-card rounded-xl border border-border/50 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-foreground">今日跑单</span>
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('zh-CN')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {todayStats.map((s, i) => {
            const Icon = s.Icon
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="p-3 rounded-xl bg-muted/30 border border-border/40"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="size-4 text-foreground/70" />
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {s.prefix || ''}{s.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{s.unit}</span>
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* 累计数据 */}
        <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">累计单量</p>
            <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
              {stats.totalDelivered} 单
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">累计收入</p>
            <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
              ¥{stats.totalEarnings || Math.round(stats.totalDelivered * 3.5 * 10) / 10}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">平均时长</p>
            <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">
              {stats.avgDuration || 22} 分
            </p>
          </div>
        </div>
      </motion.div>

      {/* 进行中订单高亮入口 */}
      {activeOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-4 mt-4"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateTab('/rider/tasks')}
            className="w-full flex items-center justify-between p-4 bg-card border border-foreground/20 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="relative size-10 rounded-full bg-foreground/10 flex items-center justify-center">
                <Package className="size-5 text-foreground" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-background text-[10px] font-bold flex items-center justify-center">
                  {activeOrders.length}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">有 {activeOrders.length} 单正在配送</p>
                <p className="text-xs text-muted-foreground mt-0.5">点击查看配送任务</p>
              </div>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </motion.button>
        </motion.div>
      )}

      {/* 抢单大厅入口 */}
      {isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 mt-4"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateTab('/rider/hall')}
            className="w-full flex items-center justify-between p-4 bg-foreground text-background rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="relative size-10 rounded-full bg-background/20 flex items-center justify-center">
                <Zap className="size-5" />
                {pool.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-background text-[10px] font-bold flex items-center justify-center">
                    {pool.length > 99 ? '99+' : pool.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">抢单大厅</p>
                <p className="text-xs text-background/70 mt-0.5">
                  {pool.length > 0 ? `有 ${pool.length} 单可抢` : '暂无新订单，耐心等待'}
                </p>
              </div>
            </div>
            <ChevronRight className="size-5" />
          </motion.button>
        </motion.div>
      )}

      {/* 下线提示 */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 mt-4 p-4 bg-muted/40 border border-border/50 rounded-xl text-center"
        >
          <Zap className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">当前已下线</p>
          <p className="text-xs text-muted-foreground mt-1">打开上线开关即可开始接单</p>
        </motion.div>
      )}

      {/* 快捷功能 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mx-4 mt-4 grid grid-cols-4 gap-3"
      >
        {[
          { label: '收入明细', Icon: DollarSign, onClick: () => navigatePush('/rider/record') },
          { label: '配送记录', Icon: Route, onClick: () => navigatePush('/rider/record') },
          { label: '我的评价', Icon: Award, onClick: () => toast.info('暂无评价，继续加油！') },
          { label: '设置', Icon: Settings, onClick: () => navigatePush('/rider/settings') },
        ].map((item, i) => {
          const Icon = item.Icon
          return (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + i * 0.04 }}
              onClick={item.onClick}
              className="flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border/40"
            >
              <Icon className="size-5 text-foreground/70" />
              <span className="text-[10px] text-foreground/80">{item.label}</span>
            </motion.button>
          )
        })}
      </motion.div>

      {/* 出口：切换 App / 退出登录 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mx-4 mt-6 space-y-3"
      >
        <button
          onClick={() => {
            logout()
            navigateReplace('/')
          }}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border/50 rounded-xl text-left"
        >
          <AppWindow className="size-5 text-foreground/70" />
          <span className="flex-1 text-sm text-foreground">切换 App</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => {
            logout()
            navigateReplace('/login')
          }}
          className="w-full h-10 rounded-full border border-border text-sm text-muted-foreground flex items-center justify-center gap-2"
        >
          <LogOut className="size-4" />
          退出登录
        </button>
      </motion.div>

      <div className="h-6" />
    </div>
  )
}
