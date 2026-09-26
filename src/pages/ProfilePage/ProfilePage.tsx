import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, ChevronRight, MapPin, Ticket, Settings,
   HelpCircle, Info, Phone, Heart, Receipt,
   Clock, Star, Package, X, Plus, Check, MessageCircle,
   LogOut, Home, Building2, GraduationCap, Crown,
 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { useAddresses } from '@/hooks/useAddresses'
import { useFavorites } from '@/hooks/useFavorites'
import { useCoupons } from '@/hooks/useCoupons'
import { useMessages } from '@/hooks/useMessages'
import { useWallet } from '@/hooks/useWallet'
import { useNavigatePush, useNavigateTab, useNavigateReplace } from '@/hooks/useNavigationStack'
import { getAllShops } from '@/data/shops'
import { Image } from '@/components/ui/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { compressImage } from '@/lib/image'
import type { AddressTag } from '@/data/address'

const QUICK_ENTRIES = [
  { icon: Receipt, label: '全部', status: 'all' },
  { icon: Clock, label: '待接单', status: 'pending' },
  { icon: Package, label: '配送中', status: 'delivering' },
  { icon: Check, label: '已完成', status: 'done' },
  { icon: Star, label: '待评价', status: 'review' },
]

const TAG_OPTIONS: { value: AddressTag; label: string; Icon: typeof Home }[] = [
  { value: 'home', label: '家', Icon: Home },
  { value: 'company', label: '公司', Icon: Building2 },
  { value: 'school', label: '学校', Icon: GraduationCap },
  { value: 'none', label: '无', Icon: MapPin },
]

const getTagLabel = (tag?: AddressTag) => {
  const t = TAG_OPTIONS.find(o => o.value === (tag || 'none'))
  return t?.label || '无'
}

const getTagIcon = (tag?: AddressTag) => {
  const t = TAG_OPTIONS.find(o => o.value === (tag || 'none'))
  return t?.Icon || MapPin
}

export default function ProfilePage() {
  const navigatePush = useNavigatePush()
  const navigateTab = useNavigateTab()
  const navigateReplace = useNavigateReplace()
  const { user, isLoggedIn, logout, updateProfile } = useAuth()
  const { balance } = useWallet()
  const { orders } = useOrders()
  const { addresses, setDefault, addAddress, deleteAddress, updateAddress } = useAddresses()
  const { favorites } = useFavorites()
  const { coupons } = useCoupons()
  const { totalUnread } = useMessages()

  const [showAddr, setShowAddr] = useState(false)
  const [editAddr, setEditAddr] = useState<null | {
    id?: string
    name: string
    phone: string
    address: string
    detail: string
    isDefault: boolean
    tag: AddressTag
  }>(null)
  const [showFavorites, setShowFavorites] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.info('请选择图片文件')
      return
    }
    try {
      const compressed = await compressImage(file, 400, 0.8)
      updateProfile({ avatar: compressed })
      toast.success('头像已更新')
    } catch {
      toast.error('头像更新失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const favoriteShops = useMemo(
    () => favorites.map(id => getAllShops().find(s => s.id === id)).filter(Boolean) as ReturnType<typeof getAllShops>,
    [favorites],
  )

  const stats = useMemo(() => {
    const deliveredCount = orders.filter(o => o.status === 'delivered').length
    const pendingReview = orders.filter(o => o.status === 'delivered' && !o.reviewed).length
    return {
      orders: orders.length,
      favorites: favorites.length,
      coupons: coupons.length,
      pendingReview,
      delivered: deliveredCount,
    }
  }, [orders, favorites.length, coupons.length])

  const handleMenuClick = (key: string) => {
    if (key === 'messages') {
      navigateTab('/customer/messages')
    } else if (key === 'address') {
      if (!isLoggedIn) {
        navigateReplace('/login?role=customer')
        return
      }
      setShowAddr(true)
    } else if (key === 'coupon') {
      navigatePush('/customer/coupons')
    } else if (key === 'member') {
      navigatePush('/customer/member')
    } else if (key === 'favorite') {
      setShowFavorites(true)
    } else if (key === 'settings') {
      navigatePush('/customer/settings')
    } else if (key === 'help') {
      navigatePush('/customer/help')
    } else if (key === 'about') {
      navigatePush('/customer/settings')
    } else {
      navigatePush('/customer/help')
    }
  }

  const handleSaveAddr = () => {
    if (!editAddr) return
    if (!editAddr.name || !editAddr.phone || !editAddr.address || !editAddr.detail) {
      toast.info('请填写完整信息')
      return
    }
    if (editAddr.id) {
      updateAddress(editAddr.id, {
        name: editAddr.name,
        phone: editAddr.phone,
        address: editAddr.address,
        detail: editAddr.detail,
        isDefault: editAddr.isDefault,
        tag: editAddr.tag,
      })
      toast.success('地址已更新')
    } else {
      addAddress({
        name: editAddr.name,
        phone: editAddr.phone,
        address: editAddr.address,
        detail: editAddr.detail,
        isDefault: editAddr.isDefault,
        tag: editAddr.tag,
      })
      toast.success('地址已添加')
    }
    setEditAddr(null)
  }

   const handleLogin = () => {
     navigateReplace('/login?role=customer')
   }

  const handleLogout = () => {
    logout()
    toast.success('已退出登录')
    // 三端独立：退出后回到启动选择器
    navigateReplace('/')
  }

  const MENU_ITEMS = [
    { icon: Crown, label: '会员中心', key: 'member' },
    { icon: MessageCircle, label: '消息中心', key: 'messages', badge: totalUnread },
    { icon: MapPin, label: '地址管理', key: 'address' },
    { icon: Ticket, label: '优惠券', key: 'coupon', badge: stats.coupons },
    { icon: Heart, label: '我的收藏', key: 'favorite', badge: stats.favorites },
    { icon: Settings, label: '设置', key: 'settings' },
    { icon: HelpCircle, label: '帮助与反馈', key: 'help' },
    { icon: Info, label: '关于我们', key: 'about' },
  ]

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* 用户信息卡片 */}
      <motion.div
        initial={{ opacity: 0.98, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-8 pb-6 bg-foreground text-background"
      >
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isLoggedIn) fileInputRef.current?.click()
                else handleLogin()
              }}
              className="relative"
            >
              <Avatar className="size-14 border-2 border-background/30">
                <AvatarImage src={user.avatar} alt={user.nickname} />
                <AvatarFallback className="bg-background/20">
                  <User className="size-6" />
                </AvatarFallback>
              </Avatar>
              {isLoggedIn && (
                <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-background border-2 border-foreground flex items-center justify-center">
                  <Plus className="size-3 text-foreground" />
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarPick}
            />
          <div className="flex-1 min-w-0">
            {isLoggedIn ? (
              <>
                <h2 className="text-lg font-bold truncate">{user.nickname}</h2>
                <p className="text-sm text-background/70 mt-0.5">{user.phone}</p>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="text-lg font-bold text-background underline underline-offset-2"
              >
                立即登录 / 注册
              </button>
            )}
          </div>
          {isLoggedIn && <ChevronRight className="size-5 text-background/50" />}
        </div>

        {/* 数据统计 */}
        {isLoggedIn && (
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">{stats.orders}</p>
              <p className="text-xs text-background/60 mt-0.5">订单数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">{stats.favorites}</p>
              <p className="text-xs text-background/60 mt-0.5">收藏</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">{stats.coupons}</p>
              <p className="text-xs text-background/60 mt-0.5">优惠券</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* 我的订单快捷入口 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-4 -mt-4 bg-card rounded-xl border border-border/50 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-foreground">我的订单</span>
          <button
            onClick={() => {
              if (!isLoggedIn) {
                navigateReplace('/login')
                return
              }
              navigateTab('/customer/orders')
            }}
            className="flex items-center gap-0.5 text-xs text-muted-foreground"
          >
            全部订单
            <ChevronRight className="size-3" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_ENTRIES.map((entry, i) => {
            const Icon = entry.icon
            // 「全部」和「已完成」永远不显示角标；其余只统计进行中/待处理
            const showBadge = entry.status !== 'all' && entry.status !== 'done'
            const count = showBadge
              ? entry.status === 'pending'
              ? orders.filter(o => o.status === 'pending' || o.status === 'preparing').length
              : entry.status === 'delivering'
              ? orders.filter(o => o.status === 'ready' || o.status === 'picked' || o.status === 'delivering').length
              : entry.status === 'review'
              ? stats.pendingReview
              : 0
            : 0
            return (
              <motion.button
                key={entry.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (!isLoggedIn) {
                    navigateReplace('/login?role=customer')
                    return
                  }
                  navigateTab('/customer/orders')
                }}
                className="relative flex flex-col items-center gap-1"
              >
                <div className="relative">
                  <Icon className="size-5 text-foreground/80" />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-background text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">{entry.label}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* 菜单列表 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-4 mt-3 bg-card rounded-xl border border-border/50 overflow-hidden"
      >
        {MENU_ITEMS.map((item, i) => {
          const Icon = item.icon
          return (
            <motion.button
              key={item.key}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMenuClick(item.key)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.03 }}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 last:border-0 text-left"
            >
              <Icon className="size-5 text-foreground/70" />
              <span className="flex-1 text-sm text-foreground">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="text-xs text-muted-foreground">{item.badge}</span>
              )}
              <ChevronRight className="size-4 text-muted-foreground" />
            </motion.button>
          )
        })}
      </motion.div>

      {/* 退出登录 */}
      {isLoggedIn && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          onClick={handleLogout}
          className="mx-4 mt-3 h-10 rounded-full border border-border text-sm text-muted-foreground flex items-center justify-center gap-1.5"
        >
          <LogOut className="size-4" />
          退出登录
        </motion.button>
      )}

      <div className="h-8" />

      {/* 地址管理弹窗 */}
      <AnimatePresence>
        {showAddr && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddr(false); setEditAddr(null) }}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl max-h-[75vh] overflow-hidden flex flex-col mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-foreground">地址管理</span>
                <button onClick={() => { setShowAddr(false); setEditAddr(null) }}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {addresses.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    暂无收货地址
                  </div>
                ) : (
                  addresses.map(addr => {
                    const TagIcon = getTagIcon(addr.tag)
                    return (
                      <div key={addr.id} className="p-3 rounded-xl border border-border/50 bg-card">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground text-sm">{addr.name}</span>
                          <span className="text-xs text-muted-foreground">{addr.phone}</span>
                          {addr.tag && addr.tag !== 'none' && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-foreground/10 text-foreground rounded">
                              <TagIcon className="size-3" />
                              {getTagLabel(addr.tag)}
                            </span>
                          )}
                          {addr.isDefault && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-foreground text-background rounded">默认</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{addr.address} {addr.detail}</p>
                        <div className="flex items-center justify-between mt-2">
                          <button
                            onClick={() => setDefault(addr.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground"
                          >
                            <div className={`size-4 rounded-full border ${addr.isDefault ? 'border-foreground bg-foreground' : 'border-border'}`}>
                              {addr.isDefault && <Check className="size-3 text-background" />}
                            </div>
                            设为默认
                          </button>
                          <button
                            onClick={() => deleteAddress(addr.id)}
                            className="text-xs text-destructive"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="p-4 border-t border-border/30">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setEditAddr({ name: '', phone: '', address: '', detail: '', isDefault: false, tag: 'none' })}
                  className="w-full h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Plus className="size-4" />
                  新增地址
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 编辑地址表单弹窗 */}
      <AnimatePresence>
        {editAddr && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditAddr(null)}
              className="fixed inset-0 z-[60] bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-[60] bg-card rounded-t-2xl mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-foreground">{editAddr.id ? '编辑地址' : '新增地址'}</span>
                <button onClick={() => setEditAddr(null)}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">收货人</label>
                  <input
                    value={editAddr.name}
                    onChange={(e) => setEditAddr({ ...editAddr, name: e.target.value })}
                    placeholder="请输入收货人姓名"
                    className="w-full h-9 mt-1 px-3 bg-muted rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">手机号</label>
                  <input
                    value={editAddr.phone}
                    onChange={(e) => setEditAddr({ ...editAddr, phone: e.target.value })}
                    placeholder="请输入手机号"
                    className="w-full h-9 mt-1 px-3 bg-muted rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">地址</label>
                  <input
                    value={editAddr.address}
                    onChange={(e) => setEditAddr({ ...editAddr, address: e.target.value })}
                    placeholder="如：朝阳区望京SOHO"
                    className="w-full h-9 mt-1 px-3 bg-muted rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">门牌号</label>
                  <input
                    value={editAddr.detail}
                    onChange={(e) => setEditAddr({ ...editAddr, detail: e.target.value })}
                    placeholder="如：T1 A座 1206室"
                    className="w-full h-9 mt-1 px-3 bg-muted rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">标签</label>
                  <div className="flex gap-2">
                    {TAG_OPTIONS.map(opt => {
                      const Icon = opt.Icon
                      const isSel = editAddr.tag === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setEditAddr({ ...editAddr, tag: opt.value })}
                          className={`flex-1 h-9 rounded-lg text-xs flex items-center justify-center gap-1 border transition-colors ${
                            isSel
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-background text-muted-foreground border-border'
                          }`}
                        >
                          <Icon className="size-3.5" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-foreground">设为默认地址</span>
                  <button
                    onClick={() => setEditAddr({ ...editAddr, isDefault: !editAddr.isDefault })}
                    className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      editAddr.isDefault ? 'border-foreground bg-foreground' : 'border-border'
                    }`}
                  >
                    {editAddr.isDefault && <Check className="size-3.5 text-background" />}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveAddr}
                  className="w-full h-10 rounded-full bg-foreground text-background text-sm font-medium"
                >
                  保存
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 我的收藏弹窗 */}
      <AnimatePresence>
        {showFavorites && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFavorites(false)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl max-h-[75vh] overflow-hidden flex flex-col mx-auto max-w-md"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-foreground">我的收藏 ({favorites.length})</span>
                <button onClick={() => setShowFavorites(false)}>
                  <X className="size-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {favoriteShops.length === 0 ? (
                  <div className="py-16 flex flex-col items-center text-muted-foreground">
                    <Heart className="size-12 mb-3 opacity-30" />
                    <p className="text-sm">还没有收藏的店铺</p>
                  </div>
                ) : (
                  favoriteShops.map(shop => (
                    <motion.button
                      key={shop.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowFavorites(false)
                         navigatePush(`/customer/shop/${shop.id}`)
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 text-left"
                    >
                      <div className="size-14 rounded-lg overflow-hidden bg-muted shrink-0">
                        <Image src={shop.cover} alt={shop.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{shop.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="size-3 fill-foreground text-foreground" />
                          <span className="text-xs text-foreground">{shop.rating}</span>
                          <span className="text-xs text-muted-foreground">· 月售{shop.monthSales}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {shop.categories[0]?.name || ''}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
