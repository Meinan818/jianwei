import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, Bell, Shield, Info, HelpCircle,
  LogOut, Trash2, ArrowLeft, Bike, Banknote,
  FileText, Award, Settings as SettingsIcon, X, Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { compressImage } from '@/lib/image'

const NOTIF_KEY = 'food_delivery_rider_notif_settings'
const THEME_KEY = 'food_delivery_theme'

const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * 骑手端设置页
 */
export default function RiderSettingsPage() {
  const navigateReplace = useNavigateReplace()
  const navigatePush = useNavigatePush()
  const { user, logout, updateProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notifOrder, setNotifOrder] = useState(true)
  const [notifSound, setNotifSound] = useState(true)
  const [autoAccept, setAutoAccept] = useState(false)
  const [cacheSize, setCacheSize] = useState('计算中...')
  const [showSheet, setShowSheet] = useState<'privacy' | 'about' | 'level' | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  // 加载接单设置 + 主题
  useEffect(() => {
    const raw = scopedStorage.getItem(NOTIF_KEY)
    if (raw) {
      try {
        const n = JSON.parse(raw)
        setNotifOrder(n.order ?? true)
        setNotifSound(n.sound ?? true)
        setAutoAccept(n.auto ?? false)
      } catch { /* ignore */ }
    }
    const theme = scopedStorage.getItem(THEME_KEY)
    setDarkMode(theme === 'dark')
    applyTheme(theme === 'dark')
  }, [])

  const saveSettings = (partial: Record<string, boolean>) => {
    const current = { order: notifOrder, sound: notifSound, auto: autoAccept, ...partial }
    scopedStorage.setItem(NOTIF_KEY, JSON.stringify(current))
  }

  const handleToggleOrder = (v: boolean) => {
    setNotifOrder(v)
    saveSettings({ order: v })
    toast.success(v ? '已开启新单提醒' : '已关闭新单提醒')
  }
  const handleToggleSound = (v: boolean) => {
    setNotifSound(v)
    saveSettings({ sound: v })
    toast.success(v ? '已开启声音提醒' : '已关闭声音提醒')
  }
  const handleToggleAuto = (v: boolean) => {
    setAutoAccept(v)
    saveSettings({ auto: v })
    toast.success(v ? '已开启自动取餐' : '已关闭自动取餐')
  }

  const handleToggleDark = (v: boolean) => {
    setDarkMode(v)
    applyTheme(v)
    scopedStorage.setItem(THEME_KEY, v ? 'dark' : 'light')
    toast.success(v ? '已开启深色模式' : '已关闭深色模式')
  }

  useEffect(() => {
    try {
      let total = 0
      for (let i = 0; i < scopedStorage.length; i++) {
        const key = scopedStorage.key(i)
        if (key) {
          const val = scopedStorage.getItem(key) || ''
          total += val.length
        }
      }
      const sizeKB = (total * 2) / 1024
      setCacheSize(sizeKB < 1024 ? `${sizeKB.toFixed(1)} KB` : `${(sizeKB / 1024).toFixed(2)} MB`)
    } catch {
      setCacheSize('0 KB')
    }
  }, [])

  const handleClearCache = () => {
    const authData = scopedStorage.getItem('food_delivery_auth')
    const notifData = scopedStorage.getItem(NOTIF_KEY)
    scopedStorage.clear()
    if (authData) scopedStorage.setItem('food_delivery_auth', authData)
    if (notifData) scopedStorage.setItem(NOTIF_KEY, notifData)
    setCacheSize('0 KB')
    toast.success('缓存已清除')
  }

  const handleLogout = () => {
    logout()
    toast.success('已退出登录')
    navigateReplace('/')
  }

  const settingsGroups = [
    {
      title: '骑手资料',
      items: [
        { icon: Award, label: '骑手等级', value: '金牌骑手 · Lv.5', onClick: () => setShowSheet('level') },
        { icon: Banknote, label: '收入明细', onClick: () => navigatePush('/rider/record') },
        { icon: FileText, label: '配送记录', onClick: () => navigatePush('/rider/record') },
      ],
    },
    {
      title: '接单设置',
      items: [
        { icon: Bell, label: '新单提醒', value: '抢单大厅新单推送', switchValue: notifOrder, onSwitch: handleToggleOrder },
        { icon: Bell, label: '声音提醒', value: '新单响铃+震动', switchValue: notifSound, onSwitch: handleToggleSound },
        { icon: Bike, label: '自动取餐', value: '到达取餐点自动确认', switchValue: autoAccept, onSwitch: handleToggleAuto },
      ],
    },
    {
      title: '通用',
      items: [
        { icon: Moon, label: '深色模式', value: darkMode ? '已开启' : '已关闭', switchValue: darkMode, onSwitch: handleToggleDark },
        { icon: Trash2, label: '清除缓存', value: cacheSize, onClick: handleClearCache },
      ],
    },
    {
      title: '其他',
      items: [
        { icon: HelpCircle, label: '帮助与反馈', onClick: () => navigatePush('/rider/messages') },
        { icon: Shield, label: '隐私政策', onClick: () => setShowSheet('privacy') },
        { icon: Info, label: '关于骑手版', value: 'v2.0.0', onClick: () => setShowSheet('about') },
      ],
    },
  ]

  return (
    <div className="flex flex-col h-dvh bg-muted/20">
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateReplace('/rider')}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">设置</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        <motion.div
          initial={{ opacity: 0.98, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mx-4 bg-card rounded-xl border border-border/50 p-4"
        >
          <div className="flex items-center gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="relative group">
              <Avatar className="size-14">
                <AvatarImage src={user.avatar} alt={user.nickname} />
                <AvatarFallback className="bg-muted">
                  <Bike className="size-6" />
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                更换
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const compressed = await compressImage(file, 400, 0.8)
                  updateProfile({ avatar: compressed })
                  toast.success('头像已更新')
                } catch {
                  toast.error('头像更新失败')
                }
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-foreground truncate">{user.nickname}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{user.phone}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background rounded">骑手</span>
                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-700 rounded">金牌</span>
              </div>
            </div>
            <SettingsIcon className="size-5 text-muted-foreground" />
          </div>
        </motion.div>

        {settingsGroups.map((group, gi) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * gi }}
            className="mx-4"
          >
            <h3 className="text-xs text-muted-foreground mb-2 px-1">{group.title}</h3>
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 last:border-0 text-left ${
                      item.onClick ? 'active:bg-muted/50' : ''
                    }`}
                  >
                    <Icon className="size-5 text-foreground/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.label}</p>
                      {item.value && <p className="text-xs text-muted-foreground mt-0.5">{item.value}</p>}
                    </div>
                    {item.switchValue !== undefined && item.onSwitch ? (
                      <Switch checked={item.switchValue} onCheckedChange={item.onSwitch} />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        ))}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={handleLogout}
          className="mx-4 h-11 rounded-xl bg-card border border-destructive/20 text-destructive text-sm font-medium flex items-center justify-center gap-1.5 active:bg-destructive/5"
        >
          <LogOut className="size-4" />
          退出登录
        </motion.button>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          onClick={() => navigateReplace('/')}
          className="mx-4 h-11 rounded-xl bg-card border border-border/50 text-muted-foreground text-sm flex items-center justify-center gap-1.5 active:bg-muted/50"
        >
          切换 App / 返回桌面
        </motion.button>

        <div className="h-6" />
      </div>

      {/* 底部 Sheet */}
      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowSheet(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card rounded-t-3xl z-50 max-h-[75vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
                <h3 className="text-base font-semibold">
                  {showSheet === 'privacy' ? '骑手隐私政策' : showSheet === 'about' ? '关于骑手版' : '骑手等级'}
                </h3>
                <button
                  onClick={() => setShowSheet(null)}
                  className="size-8 flex items-center justify-center text-muted-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-muted-foreground leading-relaxed space-y-3">
                {showSheet === 'privacy' && (
                  <>
                    <p className="text-foreground font-medium">饭否外卖骑手版 · 隐私政策</p>
                    <p>更新日期：2025年1月1日</p>
                    <p>我们深知骑手个人信息的重要性，将严格保护您的隐私与配送数据。</p>
                    <p className="text-foreground font-medium mt-2">一、信息收集</p>
                    <p>本应用为本地演示原型，所有骑手数据（个人信息、配送记录、收入明细等）仅存储在您的设备浏览器本地存储中，不会上传至任何服务器。</p>
                    <p className="text-foreground font-medium mt-2">二、信息使用</p>
                    <p>收集的信息仅用于：抢单接单、配送任务管理、收入结算统计、跑单数据分析。</p>
                    <p className="text-foreground font-medium mt-2">三、位置信息</p>
                    <p>原型演示版本不获取真实位置信息；配送定位为模拟数据，仅用于演示导航功能。</p>
                    <p className="text-foreground font-medium mt-2">四、数据安全</p>
                    <p>您的所有配送数据保存在本地浏览器中，清除浏览器数据或卸载应用将导致数据丢失。</p>
                  </>
                )}
                {showSheet === 'about' && (
                  <>
                    <p className="text-foreground font-medium">饭否外卖骑手版 v2.0.0</p>
                    <p>面向配送骑手的一站式接单管理工具。</p>
                    <p className="text-foreground font-medium mt-2">核心功能</p>
                    <p>• 抢单大厅：实时查看可抢订单，一键抢单</p>
                    <p>• 配送任务：四步配送流程（到店→取餐→配送→送达）</p>
                    <p>• 异常上报：配送异常一键上报，记录留痕</p>
                    <p>• 跑单统计：完成单量、收入明细、准时率、好评率</p>
                    <p>• 收入管理：可提现余额、一键提现、提现记录</p>
                    <p>• 消息中心：系统通知、订单通知、顾客/商家IM</p>
                    <p className="text-foreground font-medium mt-2">技术栈</p>
                    <p>React 19 + TypeScript + Vite + Tailwind CSS</p>
                    <p className="text-foreground font-medium mt-2">特别说明</p>
                    <p>本应用为原型演示版本，所有配送与收入均为模拟，不涉及真实资金结算。</p>
                    <p className="text-xs text-muted-foreground/60 mt-6 text-center">
                      © 2025 饭否外卖骑手版 · 原型演示
                    </p>
                  </>
                )}
                {showSheet === 'level' && (
                  <>
                    <div className="flex items-center gap-4 p-4 bg-amber-500/10 rounded-xl">
                      <div className="size-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Award className="size-8 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">金牌骑手 Lv.5</p>
                        <p className="text-xs text-muted-foreground mt-1">距离下一等级还差 72 单</p>
                      </div>
                    </div>
                    <p className="text-foreground font-medium mt-4">等级权益</p>
                    <p>• 优先接单权：金牌骑手优先展示新订单</p>
                    <p>• 更高分成：配送费分成比例 +5%</p>
                    <p>• 月度奖励：完成目标单量享额外奖金</p>
                    <p>• 专属客服：金牌客服通道，问题快速响应</p>
                    <p className="text-foreground font-medium mt-4">升级条件</p>
                    <p>• 月完成订单 ≥ 200 单</p>
                    <p>• 准时率 ≥ 95%</p>
                    <p>• 好评率 ≥ 90%</p>
                    <p>• 无重大违规记录</p>
                  </>
                )}
              </div>
              <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
                <Button className="w-full h-11" onClick={() => setShowSheet(null)}>
                  我知道了
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
