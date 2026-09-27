import { motion } from 'framer-motion'
import { UtensilsCrossed, Store, Bike, ChevronRight, Sparkles } from 'lucide-react'
import { useNavigateReplace } from '@/hooks/useNavigationStack'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Image } from '@/components/ui/image'
import { editionLabel } from '@/data/app-meta'

/**
 * App 启动选择器：相当于手机桌面，三个独立 App 入口。
 * - 选择某端 → 该端自己的登录（一键体验） → 该端独立界面
 * - 三端账号完全独立，端内无跨端入口，换端回选择器
 */
export default function LauncherPage() {
  const navigateReplace = useNavigateReplace()
  const { quickLogin, user, isLoggedIn, logout } = useAuth()

  const handleEnter = (role: 'customer' | 'merchant' | 'rider') => {
    // 如果当前已登录且就是目标角色，直接进对应端
    if (isLoggedIn && user.role === role) {
      // 商家端：若无店铺，先去建店向导
      if (role === 'merchant' && !user.shopId) {
        navigateReplace('/merchant/create-shop')
      } else {
        navigateReplace(getRoleHome(role))
      }
      return
    }
    // 否则走正式登录页
    navigateReplace(`/login?role=${role}`)
  }

  const handleLogoutAll = () => {
    logout()
    toast.success('已退出所有账号')
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部品牌区 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex flex-col items-center justify-center px-8"
      >
        <div className="relative">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="size-20 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-xl"
          >
            <UtensilsCrossed className="size-10" />
          </motion.div>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute -top-2 -right-2 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          >
            <Sparkles className="size-4" />
          </motion.div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-foreground tracking-tight">饭否外卖</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          顾客 · 商家 · 骑手 三端联动
          <br />
          选择一个身份开始体验
        </p>

        {isLoggedIn && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            当前账号：{user.nickname}（{user.role === 'customer' ? '顾客' : user.role === 'merchant' ? '商家' : '骑手'}）
          </motion.p>
        )}
      </motion.div>

      {/* 三端入口卡片 */}
      <div className="px-6 pb-12 space-y-4">
        {APPS.map((app, i) => {
          const Icon = app.icon
          return (
            <motion.button
              key={app.role}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleEnter(app.role)}
              className="w-full flex items-center gap-4 p-5 bg-card rounded-2xl border border-border/60 shadow-sm text-left hover:border-foreground/20 transition-colors relative overflow-hidden group"
            >
              {/* 背景装饰 */}
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-foreground/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div
                className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${
                  app.role === 'customer'
                    ? 'bg-foreground text-background'
                    : app.role === 'merchant'
                    ? 'bg-muted text-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <Icon className="size-6" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">{app.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{app.desc}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {isLoggedIn && user.role === app.role ? '继续使用' : '登录 / 体验'}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </motion.button>
          )
        })}

        {isLoggedIn && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={handleLogoutAll}
            className="w-full py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            退出当前账号
          </motion.button>
        )}
      </div>

      {/* 底部版权 */}
      <div className="pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-center">
        {/* 彩蛋文案：版次由 src/data/app-meta.ts 的 APP_EDITION 驱动，每完成一次改动 +1 */}
        <p className="text-[10px] text-muted-foreground/60">大野鸡{editionLabel()}原型演示版本</p>
      </div>
    </div>
  )
}

function getRoleHome(role: 'customer' | 'merchant' | 'rider'): string {
  if (role === 'merchant') return '/merchant'
  if (role === 'rider') return '/rider'
  return '/customer'
}

const APPS = [
  {
    role: 'customer' as const,
    name: '顾客端',
    desc: '点餐、下单、跟踪配送、评价',
    icon: UtensilsCrossed,
  },
  {
    role: 'merchant' as const,
    name: '商家端',
    desc: '接单出餐、商品管理、店铺经营',
    icon: Store,
  },
  {
    role: 'rider' as const,
    name: '骑手端',
    desc: '抢单配送、任务管理、收入记录',
    icon: Bike,
  },
]
