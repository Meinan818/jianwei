import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, ChevronRight, Bell, Moon, Shield, Info, HelpCircle,
  LogOut, Trash2, ArrowLeft, Edit3, Phone, Tag, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { useNavigatePush, useNavigateReplace } from '@/hooks/useNavigationStack'
import { toast } from 'sonner'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'

const NOTIF_KEY = 'food_delivery_notif_settings'
const THEME_KEY = 'food_delivery_theme'

/**
 * 顾客端设置页：个人资料、消息通知、清除缓存、隐私、关于我们、退出登录
 */
export default function SettingsPage() {
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const { user, logout, updateProfile } = useAuth()
  const [notifOrder, setNotifOrder] = useState(true)
  const [notifPromo, setNotifPromo] = useState(false)
  const [notifSound, setNotifSound] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [cacheSize, setCacheSize] = useState('计算中...')
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState(user.nickname)
  const [showSheet, setShowSheet] = useState<'privacy' | 'about' | null>(null)

  // 加载通知设置和主题
  useEffect(() => {
    const notifRaw = scopedStorage.getItem(NOTIF_KEY)
    if (notifRaw) {
      try {
        const n = JSON.parse(notifRaw)
        setNotifOrder(n.order ?? true)
        setNotifPromo(n.promo ?? false)
        setNotifSound(n.sound ?? true)
      } catch { /* ignore */ }
    }
    const theme = scopedStorage.getItem(THEME_KEY)
    setDarkMode(theme === 'dark')
    applyTheme(theme === 'dark')
  }, [])

  // 持久化通知设置
  const saveNotif = (partial: Record<string, boolean>) => {
    const current = { order: notifOrder, promo: notifPromo, sound: notifSound, ...partial }
    scopedStorage.setItem(NOTIF_KEY, JSON.stringify(current))
  }

  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleToggleDark = (v: boolean) => {
    setDarkMode(v)
    applyTheme(v)
    scopedStorage.setItem(THEME_KEY, v ? 'dark' : 'light')
    toast.success(v ? '已切换深色模式' : '已切换浅色模式')
  }

  // 计算缓存大小（估算）
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
    const themeData = scopedStorage.getItem(THEME_KEY)
    scopedStorage.clear()
    if (authData) scopedStorage.setItem('food_delivery_auth', authData)
    if (notifData) scopedStorage.setItem(NOTIF_KEY, notifData)
    if (themeData) scopedStorage.setItem(THEME_KEY, themeData)
    setCacheSize('0 KB')
    toast.success('缓存已清除')
  }

  const handleLogout = () => {
    logout()
    toast.success('已退出登录')
    navigateReplace('/')
  }

  const handleSaveNickname = () => {
    if (!nicknameInput.trim()) {
      toast.info('昵称不能为空')
      return
    }
    updateProfile({ nickname: nicknameInput.trim() })
    setEditingNickname(false)
    toast.success('昵称已更新')
  }

  const settingsGroups = [
    {
      title: '账号与资料',
      items: [
        {
          icon: User,
          label: '个人资料',
          onClick: () => navigatePush('/customer/avatar-edit'),
          right: <ChevronRight className="size-4 text-muted-foreground" />,
        },
        {
          icon: Phone,
          label: '绑定手机',
          value: user.phone || '未绑定',
          onClick: () => toast.info('演示账号手机号不支持修改'),
          right: <ChevronRight className="size-4 text-muted-foreground" />,
        },
      ],
    },
    {
      title: '消息通知',
      items: [
        {
          icon: Bell,
          label: '订单通知',
          value: '接单/配送/送达提醒',
          switchValue: notifOrder,
          onSwitch: (v: boolean) => { setNotifOrder(v); saveNotif({ order: v }) },
        },
        {
          icon: Tag,
          label: '优惠活动',
          value: '优惠券、满减活动提醒',
          switchValue: notifPromo,
          onSwitch: (v: boolean) => { setNotifPromo(v); saveNotif({ promo: v }) },
        },
        {
          icon: Bell,
          label: '声音提醒',
          value: '消息到达时播放提示音',
          switchValue: notifSound,
          onSwitch: (v: boolean) => { setNotifSound(v); saveNotif({ sound: v }) },
        },
      ],
    },
    {
      title: '通用',
      items: [
        {
          icon: Moon,
          label: '深色模式',
          value: darkMode ? '已开启' : '已关闭',
          switchValue: darkMode,
          onSwitch: handleToggleDark,
        },
        {
          icon: Trash2,
          label: '清除缓存',
          value: cacheSize,
          onClick: handleClearCache,
          right: <ChevronRight className="size-4 text-muted-foreground" />,
        },
      ],
    },
    {
      title: '其他',
      items: [
        {
          icon: Shield,
          label: '隐私政策',
          onClick: () => setShowSheet('privacy'),
          right: <ChevronRight className="size-4 text-muted-foreground" />,
        },
        {
          icon: HelpCircle,
          label: '帮助与反馈',
          onClick: () => navigatePush('/customer/help'),
          right: <ChevronRight className="size-4 text-muted-foreground" />,
        },
        {
          icon: Info,
          label: '关于我们',
          value: 'v2.0.0',
          onClick: () => setShowSheet('about'),
          right: <ChevronRight className="size-4 text-muted-foreground" />,
        },
      ],
    },
  ]

  return (
    <div className="flex flex-col h-dvh bg-muted/20">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateReplace('/customer/profile')}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">设置</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* 用户资料卡 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 bg-card rounded-xl border border-border/50 p-4"
        >
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
              <AvatarImage src={user.avatar} alt={user.nickname} />
              <AvatarFallback className="bg-muted">
                <User className="size-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {editingNickname ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nicknameInput}
                    onChange={e => setNicknameInput(e.target.value)}
                    className="flex-1 h-8 px-2 bg-muted rounded text-sm outline-none"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveNickname()}
                  />
                  <button onClick={handleSaveNickname} className="text-xs text-foreground font-medium">
                    保存
                  </button>
                  <button onClick={() => { setEditingNickname(false); setNicknameInput(user.nickname) }} className="text-xs text-muted-foreground">
                    取消
                  </button>
                </div>
              ) : (
                <h2 className="text-base font-semibold text-foreground truncate">{user.nickname || '未登录'}</h2>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{user.phone || '顾客端'}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="px-1.5 py-0.5 text-[10px] bg-foreground/10 text-foreground rounded">顾客</span>
              </div>
            </div>
            <button onClick={() => setEditingNickname(true)} className="text-muted-foreground">
              <Edit3 className="size-4" />
            </button>
          </div>
        </motion.div>

        {/* 设置分组 */}
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
              {group.items.map((item, i) => {
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
                      item.right
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        ))}

        {/* 退出登录 */}
        {user.loggedIn && (
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
        )}

        {/* 切换App */}
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
                  {showSheet === 'privacy' ? '隐私政策' : '关于我们'}
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
                    <p className="text-foreground font-medium">饭否外卖 · 隐私政策</p>
                    <p>更新日期：2025年1月1日</p>
                    <p>我们深知个人信息对您的重要性，本应用将严格保护您的隐私安全。</p>
                    <p className="text-foreground font-medium mt-2">一、信息收集</p>
                    <p>本应用为本地演示原型，所有用户数据（账号信息、地址、订单等）仅存储在您的设备浏览器本地存储中，不会上传至任何服务器。</p>
                    <p className="text-foreground font-medium mt-2">二、信息使用</p>
                    <p>收集的信息仅用于：完成下单流程、配送地址管理、订单状态跟踪、个性化推荐展示。</p>
                    <p className="text-foreground font-medium mt-2">三、信息安全</p>
                    <p>您的所有数据保存在本地浏览器中，清除浏览器数据或卸载应用将导致数据丢失，请定期备份重要信息。</p>
                    <p className="text-foreground font-medium mt-2">四、联系我们</p>
                    <p>如对本隐私政策有任何疑问，可通过应用内"帮助与反馈"联系我们。</p>
                  </>
                ) : (
                  <>
                    <p className="text-foreground font-medium">饭否外卖 v2.0.0</p>
                    <p>一款面向用户体验演示的外卖点餐原型应用。</p>
                    <p className="text-foreground font-medium mt-2">产品特性</p>
                    <p>• 顾客端：浏览商家、在线点餐、订单跟踪、会员钱包</p>
                    <p>• 商家端：接单出餐、商品管理、营销活动、财务统计</p>
                    <p>• 骑手端：抢单配送、任务管理、收入明细</p>
                    <p>• 三端联动：订单状态实时同步，完整闭环体验</p>
                    <p className="text-foreground font-medium mt-2">技术栈</p>
                    <p>React 19 + TypeScript + Vite + Tailwind CSS</p>
                    <p className="text-foreground font-medium mt-2">特别说明</p>
                    <p>本应用为原型演示版本，所有交易、配送均为模拟，不涉及真实支付与服务。</p>
                    <p className="text-xs text-muted-foreground/60 mt-6 text-center">
                      © 2025 饭否外卖 · 原型演示
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
