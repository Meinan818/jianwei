import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, MapPin, Clock, DollarSign, Store,
  User, ChevronRight, Bike, ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useRiderStatus } from '@/hooks/useRiderStatus'
import { toast } from 'sonner'

export default function RiderHallPage() {
  const { user } = useAuth()
  const { poolOrders, riderClaim } = useOrders()
  const { riderStatus, toggleRiderOnline } = useRiderStatus()

  // 2026-09-28 修复：订单里的骑手身份用 profiles.id（uuid）——数据库 orders.rider_id 是 uuid 列，
  // 写工号（R0003）进去会被数据库拒掉、抢单根本存不下来；工号只用于展示。
  const riderKey = user.id || user.riderId || 'r1'
  const isOnline = riderStatus[riderKey]?.isOnline ?? true

  const handleClaim = (orderId: string) => {
    if (!isOnline) {
      toast.info('请先上线再接单')
      return
    }
    const result = riderClaim(orderId, riderKey, user.nickname || '骑手', user.phone || '')
    if (result) {
      toast.success('抢单成功！快去取餐吧')
    } else {
      toast.error('手慢了，订单已被抢走')
    }
  }

  const handleToggleOnline = () => {
    toggleRiderOnline(riderKey, !isOnline)
    toast.success(!isOnline ? '已上线接单' : '已下线休息')
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30 flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">抢单大厅</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isOnline ? `当前 ${poolOrders.length} 单可抢` : '已下线，暂无订单推送'}
          </p>
        </div>
        <button
          onClick={handleToggleOnline}
          className={`relative size-11 rounded-full transition-colors ${
            isOnline ? 'bg-foreground' : 'bg-muted'
          }`}
        >
          <motion.div
            animate={{ x: isOnline ? 22 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 size-5 rounded-full bg-background"
          />
        </button>
      </motion.div>

      {/* 订单列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {poolOrders.length > 0 && isOnline ? (
            <div className="space-y-3">
              {poolOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-card rounded-xl border border-border/50 p-4"
                >
                  {/* 顶部：距离 + 配送费 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-foreground/70" />
                      <span className="text-xs font-medium text-foreground">
                        {order.distance || '1.5km'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · 约 25 分钟送达
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        ¥{order.riderEarning?.toFixed(1) || '5.0'}
                      </span>
                      <p className="text-[10px] text-muted-foreground">配送费</p>
                    </div>
                  </div>

                  {/* 地址信息 */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <div className="size-1.5 rounded-full bg-foreground mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Store className="size-3 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground truncate">
                            {order.shopName}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 ml-4">
                          商家已出餐，等候取餐
                        </p>
                      </div>
                    </div>
                    <div className="w-px h-3 ml-0.5 bg-border" />
                    <div className="flex items-start gap-2">
                      <div className="size-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <User className="size-3 text-muted-foreground" />
                          <p className="text-sm text-foreground truncate">
                            {order.address.name} {order.address.phone}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 ml-4 truncate">
                          {order.address.address} {order.address.detail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 订单简况 */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <span className="text-xs text-muted-foreground">
                      共{order.items.reduce((s, i) => s + i.quantity, 0)}件商品
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleClaim(order.id)}
                      className="h-8 px-5 rounded-full bg-foreground text-background text-sm font-medium flex items-center gap-1"
                    >
                      <Zap className="size-3.5" />
                      抢单
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : !isOnline ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bike className="size-10 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-foreground font-medium">你已下线</p>
              <p className="text-xs text-muted-foreground mt-1">上线后才能看到可抢订单</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleOnline}
                className="mt-6 h-10 px-8 rounded-full bg-foreground text-background text-sm font-medium flex items-center gap-1"
              >
                <Zap className="size-4" />
                上线接单
              </motion.button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <Zap className="size-14 mb-3 text-muted-foreground/30" />
              <p className="text-sm text-foreground font-medium">暂无新订单</p>
              <p className="text-xs text-muted-foreground mt-1">有新订单会自动出现在这里</p>
            </div>
          )}
      </div>
    </div>
  )
}
