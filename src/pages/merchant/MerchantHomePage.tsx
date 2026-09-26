import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import {
  Store, TrendingUp, Clock, DollarSign, User, ChevronRight, LogOut, Bell, Settings, AppWindow,
  ChefHat, Package, Zap, Tag, ListOrdered, Megaphone,
  BarChart3, Medal, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useShopStatus } from '@/hooks/useShopStatus'
import { useNotifications } from '@/hooks/useNotifications'
import { useNavigateTab, useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { isTabRoot } from '@/data/navigation'
import { getAllShops } from '@/data/shops'
import { toast } from 'sonner'
import { Image } from '@/components/ui/image'

const QUICK_ACTIONS = [
  { label: '待处理订单', desc: '接单 / 出餐', Icon: ChefHat, path: '/merchant/orders', highlight: true },
  { label: '商品管理', desc: '上下架 / 改价', Icon: Package, path: '/merchant/dishes', highlight: false },
  { label: '营业设置', desc: '开关店 / 公告', Icon: Zap, path: '/merchant/shop', highlight: false },
  { label: '营销活动', desc: '满减 / 折扣', Icon: Tag, path: '/merchant/marketing', highlight: false },
  { label: '财务账单', desc: '收入 / 提现', Icon: DollarSign, path: '/merchant/finance', highlight: false },
]

export default function MerchantHomePage() {
  const navigateTab = useNavigateTab()
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const { user, logout } = useAuth()
  const { getShopStats, getDishSalesRank } = useOrders()
  const { shopStatus, toggleShopOpen, getShopStatus } = useShopStatus()
  const { unreadCount: notificationUnread } = useNotifications()

  const shopId = user.shopId || '1'
  const shop = getAllShops().find(s => s.id === shopId)
  const status = getShopStatus(shopId)

  const isOpen = status?.isOpen ?? true
  const stats = getShopStats(shopId)
  const salesRank = getDishSalesRank(shopId, 5)

  const kpiCards = [
    { label: '今日订单', value: stats.todayOrderCount, unit: '单', Icon: ListOrdered, trend: stats.orderTrend.label, up: stats.orderTrend.up },
    { label: '今日营业额', value: stats.todayRevenue, prefix: '¥', unit: '', Icon: DollarSign, trend: stats.revenueTrend.label, up: stats.revenueTrend.up },
    { label: '客单价', value: stats.avgOrderValue || 0, prefix: '¥', unit: '', Icon: TrendingUp, trend: stats.avgTrend.label, up: stats.avgTrend.up },
    { label: '待处理', value: stats.pendingCount, unit: '单', Icon: ChefHat, highlight: stats.pendingCount > 0 },
  ]

  // ECharts 近7天趋势图
  const chartOption: EChartsOption = useMemo(() => {
    const orders = stats.trendData.map(d => d.orders)
    const revenues = stats.trendData.map(d => d.revenue)
    const maxOrder = Math.max(...orders, 0)
    const maxRevenue = Math.max(...revenues, 0)

    // 向上取整到合适的刻度步长，保证 0 刻度可见、顶部留 15% 余量
    const niceMax = (v: number, kind: 'order' | 'revenue') => {
      if (v <= 0) return kind === 'order' ? 3 : 10
      const padded = v * 1.15
      if (kind === 'order') {
        // 订单数：小值用 1 步长，大值用 5/10 步长
        if (padded <= 5) return 5
        if (padded <= 10) return 10
        return Math.ceil(padded / 10) * 10
      }
      // 金额：按数量级选步长
      let step = 10
      if (padded < 50) step = 10
      else if (padded < 200) step = 50
      else if (padded < 1000) step = 100
      else step = 500
      return Math.ceil(padded / step) * step
    }
    const orderMax = niceMax(maxOrder, 'order')
    const revenueMax = niceMax(maxRevenue, 'revenue')

    // 计算订单轴间隔（保证刻度是整数、0 到 max 均匀分布）
    const orderInterval = orderMax <= 5 ? 1 : orderMax <= 20 ? 5 : 10
    // 金额轴间隔
    const revenueInterval = revenueMax <= 50 ? 10 : revenueMax <= 200 ? 50 : 100

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        type: 'scroll',
        top: 0,
        right: 0,
        textStyle: { fontSize: 11 },
        itemWidth: 16,
        itemHeight: 8,
        itemGap: 16,
      },
      grid: {
        left: 12,
        right: 12,
        bottom: 24,
        top: 36,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: stats.trendData.map(d => d.date),
        axisLine: { lineStyle: { width: 1 } },
        axisLabel: { fontSize: 10, color: 'hsl(0 0% 50%)' },
        axisTick: { show: false },
        // 首尾留白：categoryGap + boundaryGap 保证柱子不贴边
        boundaryGap: true,
        axisPointer: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '订单',
          nameTextStyle: { fontSize: 10, color: 'hsl(0 0% 50%)' },
          nameLocation: 'start',
          axisLabel: { fontSize: 10, color: 'hsl(0 0% 50%)' },
          splitLine: { lineStyle: { type: 'dashed', color: 'hsl(0 0% 90%)' } },
          min: 0,
          max: orderMax,
          interval: orderInterval,
          minInterval: 1,
        },
        {
          type: 'value',
          name: '营业额(元)',
          nameTextStyle: { fontSize: 10, color: 'hsl(0 0% 50%)' },
          nameLocation: 'end',
          axisLabel: {
            fontSize: 10,
            color: 'hsl(0 0% 50%)',
            formatter: (v: number | string) => {
              const n = Number(v)
              return Number.isInteger(n) ? String(n) : ''
            }
          },
          splitLine: { show: false },
          min: 0,
          max: revenueMax,
          interval: revenueInterval,
          minInterval: 1,
        },
      ],
      series: [
        {
          name: '订单数',
          type: 'bar',
          data: orders,
          barMaxWidth: 20,
          barMinWidth: 8,
          barCategoryGap: '50%',
          barGap: '0%',
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        },
        {
          name: '营业额',
          type: 'line',
          yAxisIndex: 1,
          data: revenues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2 },
        },
      ],
    }
  }, [stats.trendData])

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* 顶部店铺信息 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-8 pb-6 bg-foreground text-background"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl overflow-hidden bg-background/20 flex items-center justify-center">
              {shop?.cover && <Image src={shop.cover} alt={shop.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{shop?.name || '店铺名称'}</h1>
              <p className="text-xs text-background/70 mt-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Store className="size-3" />
                  {shop?.category || '餐饮'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigatePush('/merchant/messages')}
            className="size-9 rounded-full bg-background/10 flex items-center justify-center relative"
          >
            <Bell className="size-5" />
            {notificationUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-background text-[10px] font-bold flex items-center justify-center">
                {notificationUnread > 99 ? '99+' : notificationUnread}
              </span>
            )}
          </button>
        </div>

        {/* 营业状态开关 */}
        <div className="flex items-center justify-between bg-background/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Store className={`size-5 ${isOpen ? '' : 'opacity-50'}`} />
            <div>
              <p className="text-sm font-medium">{isOpen ? '营业中' : '已打烊'}</p>
              <p className="text-[11px] text-background/60">
                营业时间 {status?.businessHours || shop?.businessHours || '09:00 - 21:00'}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleShopOpen(shopId, !isOpen)}
            className={`relative size-11 rounded-full transition-colors ${
              isOpen ? 'bg-background' : 'bg-background/30'
            }`}
          >
            <motion.div
              animate={{ x: isOpen ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 size-5 rounded-full bg-foreground"
            />
          </button>
        </div>
      </motion.div>

      {/* KPI 数据卡片 */}
      <motion.div
        initial={{ opacity: 0.98, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-4 -mt-4 bg-card rounded-xl border border-border/50 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
            <BarChart3 className="size-4" />
            今日经营概览
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date().toLocaleDateString('zh-CN')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {kpiCards.map((card, i) => {
            const Icon = card.Icon
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0.98, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`p-3 rounded-xl border ${
                  card.highlight
                    ? 'bg-foreground/5 border-foreground/20'
                    : 'bg-muted/30 border-border/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon className={`size-4 ${card.highlight ? 'text-foreground' : 'text-foreground/70'}`} />
                  {card.trend && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${
                      card.up ? 'text-success' : 'text-destructive'
                    }`}>
                      {card.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {card.trend}
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground">
                  {card.prefix || ''}{card.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{card.unit}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
              </motion.div>
            )
          })}
        </div>

        {/* 更多经营数据 */}
        <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">累计订单</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
              {stats.totalOrderCount} 单
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">累计净收入</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
              ¥{stats.totalNetRevenue.toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">已完成</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 tabular-nums">
              {stats.deliveredCount} 单
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">退款单数</p>
            <p className="text-sm font-semibold text-destructive mt-0.5 tabular-nums">
              {stats.totalRefundCount} 单
            </p>
          </div>
        </div>
      </motion.div>

      {/* 近7天趋势图 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-4 mt-4 bg-card rounded-xl border border-border/50 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
            <TrendingUp className="size-4" />
            近 7 天趋势
          </span>
        </div>
        <ReactECharts option={chartOption} theme="ud" className="h-[240px] w-full" />
      </motion.div>

      {/* 菜品销量榜 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-4 mt-4 bg-card rounded-xl border border-border/50 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
            <Medal className="size-4" />
            菜品销量榜
          </span>
          <button
            onClick={() => navigateTab('/merchant/dishes')}
            className="text-xs text-muted-foreground flex items-center gap-0.5"
          >
            全部 <ChevronRight className="size-3" />
          </button>
        </div>

        {salesRank.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <Package className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">暂无销售数据</p>
          </div>
        ) : (
          <div className="space-y-3">
            {salesRank.map((dish, i) => (
              <motion.div
                key={dish.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-center gap-3"
              >
                <div className={`size-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-foreground text-background' :
                  i === 1 ? 'bg-muted-foreground text-background' :
                  i === 2 ? 'bg-border text-foreground' :
                  'bg-muted/60 text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  <Image src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{dish.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">已售 {dish.quantity} 份</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* 快捷操作 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mx-4 mt-4 grid grid-cols-2 gap-3"
      >
        {QUICK_ACTIONS.map((action, i) => {
          const Icon = action.Icon
          return (
            <motion.button
              key={action.label}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.33 + i * 0.04 }}
              onClick={() => {
                const path = action.path
                if (isTabRoot(path, user.role)) {
                  navigateTab(path)
                } else {
                  navigatePush(path)
                }
              }}
              className={`p-4 rounded-xl border text-left ${
                action.highlight
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card border-border/50 text-foreground'
              }`}
            >
              <Icon className={`size-5 mb-2 ${action.highlight ? '' : 'text-foreground/70'}`} />
              <p className={`text-sm font-semibold ${action.highlight ? '' : ''}`}>{action.label}</p>
              <p className={`text-[10px] mt-0.5 ${action.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>
                {action.desc}
              </p>
            </motion.button>
          )
        })}
      </motion.div>

      {/* 出口：切换 App / 退出登录 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
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
