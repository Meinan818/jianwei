import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, ChevronRight, Bell, Shield, Info, HelpCircle,
  LogOut, Trash2, ArrowLeft, Store, Phone, Banknote,
  FileText, Settings as SettingsIcon, X, Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { compressImage } from '@/lib/image'
import { APP_BRAND, APP_VERSION, APP_YEAR } from '@/data/app-meta'

const NOTIF_KEY = 'food_delivery_merchant_notif_settings'
const THEME_KEY = 'food_delivery_theme'

const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * 商家端设置页
 */
export default function MerchantSettingsPage() {
  const navigateReplace = useNavigateReplace()
  const navigatePush = useNavigatePush()
  const { user, logout, updateProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notifOrder, setNotifOrder] = useState(true)
  const [notifSound, setNotifSound] = useState(true)
  const [cacheSize, setCacheSize] = useState('计算中...')
  const [showSheet, setShowSheet] = useState<'privacy' | 'about' | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  // 加载通知设置 + 主题
  useEffect(() => {
    const raw = scopedStorage.getItem(NOTIF_KEY)
    if (raw) {
      try {
        const n = JSON.parse(raw)
        setNotifOrder(n.order ?? true)
        setNotifSound(n.sound ?? true)
      } catch { /* ignore */ }
    }
    const theme = scopedStorage.getItem(THEME_KEY)
    setDarkMode(theme === 'dark')
    applyTheme(theme === 'dark')
  }, [])

  const saveNotif = (partial: Record<string, boolean>) => {
    const current = { order: notifOrder, sound: notifSound, ...partial }
    scopedStorage.setItem(NOTIF_KEY, JSON.stringify(current))
  }

  const handleToggleOrder = (v: boolean) => {
    setNotifOrder(v)
    saveNotif({ order: v })
    toast.success(v ? '已开启新订单提醒' : '已关闭新订单提醒')
  }

  const handleToggleSound = (v: boolean) => {
    setNotifSound(v)
    saveNotif({ sound: v })
    toast.success(v ? '已开启声音提醒' : '已关闭声音提醒')
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
      title: '店铺信息',
      items: [
        { icon: Store, label: '店铺资料', value: user.shopId ? '已认证' : '未认证', onClick: () => navigatePush('/merchant/shop') },
        { icon: Banknote, label: '账单与收入', onClick: () => navigatePush('/merchant/finance') },
        { icon: FileText, label: '经营数据', onClick: () => navigatePush('/merchant/finance') },
      ],
    },
    {
      title: '消息通知',
      items: [
        { icon: Bell, label: '新订单提醒', value: '接单/催单/取消提醒', switchValue: notifOrder, onSwitch: handleToggleOrder },
        { icon: Bell, label: '声音提醒', value: '新订单响铃+震动', switchValue: notifSound, onSwitch: handleToggleSound },
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
        { icon: HelpCircle, label: '帮助与反馈', onClick: () => navigatePush('/merchant/messages') },
        { icon: Shield, label: '隐私政策', onClick: () => setShowSheet('privacy') },
        { icon: Info, label: '关于商家版', value: APP_VERSION, onClick: () => setShowSheet('about') },
      ],
    },
  ]

  return (
    <div className="flex flex-col h-dvh bg-muted/20">
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateReplace('/merchant')}>
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
                  <Store className="size-6" />
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
                <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background rounded">商家</span>
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
                  {showSheet === 'privacy' ? '商家隐私政策' : '关于商家版'}
                </h3>
                <button
                  onClick={() => setShowSheet(null)}
                  className="size-8 flex items-center justify-center text-muted-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-muted-foreground leading-relaxed space-y-3">
                {showSheet === 'privacy' ? (
                  <>
                    <p className="text-foreground font-medium">饭否外卖商家版 · 隐私政策</p>
                    <p>更新日期：2025年1月1日</p>
                    <p>我们深知商家数据的重要性，将严格保护您的店铺信息与经营数据。</p>
                    <p className="text-foreground font-medium mt-2">一、信息收集</p>
                    <p>本应用为本地演示原型，所有商家数据（店铺信息、订单数据、菜品配置、营销活动等）仅存储在您的设备浏览器本地存储中，不会上传至任何服务器。</p>
                    <p className="text-foreground font-medium mt-2">二、信息使用</p>
                    <p>收集的信息仅用于：展示经营数据、处理订单流转、管理菜品与活动、计算财务收入。</p>
                    <p className="text-foreground font-medium mt-2">三、数据安全</p>
                    <p>您的所有经营数据保存在本地浏览器中，清除浏览器数据或卸载应用将导致数据丢失，请定期导出备份重要信息。</p>
                    <p className="text-foreground font-medium mt-2">四、权限说明</p>
                    <p>商家端可访问顾客端下单数据，用于接单、出餐、配送等业务操作；不可访问顾客端个人隐私信息（如收货地址真实姓名电话仅在订单中展示）。</p>
                  </>
                ) : (
                  <>
                    <p className="text-foreground font-medium">{APP_BRAND}商家版 {APP_VERSION}</p>
                    <p>面向餐饮商家的一站式经营管理工具。</p>
                    <p className="text-foreground font-medium mt-2">核心功能</p>
                    <p>• 订单管理：接单、拒单、出餐、售后全流程</p>
                    <p>• 商品管理：菜品上下架、分类管理、规格加料</p>
                    <p>• 营销中心：满减活动、新客立减、折扣菜、免配送费</p>
                    <p>• 经营数据：营业额、订单量、客单价、趋势图表</p>
                    <p>• 财务管理：收入明细、可提现余额、一键提现</p>
                    <p>• 评价管理：查看顾客评价、商家回复</p>
                    <p className="text-foreground font-medium mt-2">技术栈</p>
                    <p>React 19 + TypeScript + Vite + Tailwind CSS</p>
                    <p className="text-foreground font-medium mt-2">特别说明</p>
                    <p>本应用为原型演示版本，所有交易均为模拟，不涉及真实资金往来。</p>
                    <p className="text-xs text-muted-foreground/60 mt-6 text-center">
                      © {APP_YEAR} {APP_BRAND}商家版 · 原型演示
                    </p>
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
