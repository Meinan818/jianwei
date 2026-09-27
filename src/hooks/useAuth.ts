import React, { useState, useCallback, createContext, useContext, useEffect } from 'react'
import { scopedStorage, avatarImages } from '@lark-apaas/client-toolkit-lite'
import type { IAuthUser, UserRole, IRegisteredAccount } from '@/data/auth'
import { SIMULATED_CODE, ACCOUNTS_KEY_PREFIX } from '@/data/auth'
import { supabase, supabaseEnabled, phoneToAuthEmail, authEmailToPhone } from '@/lib/supabase'
import { resetShopsCache } from '@/data/shops-remote'
import { startRealtime, stopRealtime } from '@/data/realtime'

const AUTH_KEY = 'food_delivery_auth'
const PROFILE_KEY_PREFIX = 'food_delivery_profile_' // + role，按角色独立存昵称/头像

// —— 账号读写工具 ——
function readAccounts(role: UserRole): IRegisteredAccount[] {
  try {
    const raw = scopedStorage.getItem(`${ACCOUNTS_KEY_PREFIX}${role}`)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveAccounts(role: UserRole, accounts: IRegisteredAccount[]) {
  scopedStorage.setItem(`${ACCOUNTS_KEY_PREFIX}${role}`, JSON.stringify(accounts))
}

// —— 角色资料工具 ——
function readRoleProfile(role: UserRole): Partial<{ nickname: string; avatar: string }> {
  try {
    const raw = scopedStorage.getItem(`${PROFILE_KEY_PREFIX}${role}`)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

function saveRoleProfile(role: UserRole, profile: Partial<{ nickname: string; avatar: string }>) {
  scopedStorage.setItem(`${PROFILE_KEY_PREFIX}${role}`, JSON.stringify(profile))
}

// —— 演示账号 ——
const DEMO_ACCOUNTS: Record<UserRole, Omit<IAuthUser, 'loggedIn'>> = {
  customer: {
    id: 'customer_demo',
    role: 'customer',
    phone: '138****8888',
    nickname: '美食探索家',
    avatar: avatarImages.avatarImg1,
  },
  merchant: {
    id: 'merchant_demo',
    role: 'merchant',
    phone: '139****6666',
    nickname: '饭否店长',
    avatar: avatarImages.avatarImg2,
    shopId: '1', // 演示账号绑定默认店铺
    shopName: '饭否·品质快餐',
  },
  rider: {
    id: 'rider_demo',
    role: 'rider',
    phone: '137****9999',
    nickname: '骑手小王',
    avatar: avatarImages.avatarImg3,
    riderId: 'R001',
  },
}

const GUEST_USER: IAuthUser = {
  id: 'guest',
  role: 'customer',
  phone: '',
  nickname: '',
  avatar: '',
  loggedIn: false,
}

function getDefaultAvatar(role: UserRole): string {
  if (role === 'merchant') return avatarImages.avatarImg2
  if (role === 'rider') return avatarImages.avatarImg3
  return avatarImages.avatarImg1
}

// —— 首次渲染前同步读取，避免闪跳 ——
function readInitialUser(): IAuthUser {
  try {
    const stored = scopedStorage.getItem(AUTH_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as IAuthUser
      if (parsed && typeof parsed === 'object' && 'role' in parsed) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return GUEST_USER
}

// —— Context 类型 ——
interface AuthContextValue {
  user: IAuthUser
  isLoggedIn: boolean

  // 以下五个方法都可能走网络（Supabase Auth），因此是异步的；
  // 未配置环境变量时走本地模拟登录，同样返回 Promise，调用方写法统一。
  // 验证码登录
  loginWithCode: (phone: string, role: UserRole) => Promise<{ success: boolean; user?: IAuthUser; message?: string }>
  // 密码登录
  loginWithPassword: (phone: string, password: string, role: UserRole) => Promise<{ success: boolean; user?: IAuthUser; message?: string }>
  // 注册
  register: (phone: string, password: string, nickname: string, role: UserRole) => Promise<{ success: boolean; user?: IAuthUser; message?: string }>
  // 重置密码
  resetPassword: (phone: string, newPassword: string, role: UserRole) => Promise<{ success: boolean; message?: string }>
  // 检查是否已注册（有密码）
  isPhoneRegistered: (phone: string, role: UserRole) => boolean
  // 检查商家账号是否已有店铺
  hasShop: (phone: string) => boolean
  // 商家账号绑定店铺（一账号一店铺）
  bindShop: (shopId: string, shopName: string) => void
  // 一键体验
  quickLogin: (role: UserRole) => Promise<IAuthUser>
  // 退出
  logout: () => void
  // 更新资料
  updateProfile: (updates: Partial<Pick<IAuthUser, 'avatar' | 'nickname' | 'phone'>>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IAuthUser>(readInitialUser)

  // 跨 tab storage 事件同步
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.includes(AUTH_KEY) && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as IAuthUser
          setUser(parsed)
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const saveUser = useCallback((u: IAuthUser) => {
    setUser(u)
    scopedStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }, [])

  // 第 3 期：登录后建立 Supabase Realtime 订阅（订单 / 消息实时刷新），
  // 登出或切换账号时拆掉，避免上一个账号的推送漏进新会话。
  // 未配置 Supabase（本地模拟登录）时 startRealtime/stopRealtime 都是空操作。
  useEffect(() => {
    if (!supabase || !user.loggedIn || !user.id) {
      stopRealtime()
      return
    }
    startRealtime(user.id)
    return () => stopRealtime()
  }, [user.id, user.loggedIn])

  // 把注册账号转换成当前登录用户
  const accountToUser = useCallback((acc: IRegisteredAccount, role: UserRole): IAuthUser => {
    return {
      id: `${role}_${acc.phone}`,
      role,
      phone: acc.phone,
      nickname: acc.nickname,
      avatar: acc.avatar,
      shopId: acc.shopId,
      shopName: acc.shopName,
      riderId: acc.riderId,
      loggedIn: true,
    }
  }, [])

  // —— Supabase 会话 → 应用内用户 ——
  // 资料以 profiles 表为准（昵称/头像/工号），商家再查一次自己的店铺（一账号一店铺）。
  const buildUserFromSession = useCallback(async (
    userId: string,
    email: string | undefined,
    meta: Record<string, unknown>,
    fallbackRole?: UserRole,
  ): Promise<IAuthUser | null> => {
    const role = (meta?.role as UserRole) ?? fallbackRole
    if (!role) return null

    const phone = (meta?.phone as string) || authEmailToPhone(email)
    let nickname = (meta?.nickname as string) || `用户${phone.slice(-4)}`
    let avatar = (meta?.avatar_url as string) || getDefaultAvatar(role)
    let riderId: string | undefined
    let shopId: string | undefined
    let shopName: string | undefined

    if (supabase) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname,avatar_url,rider_no')
          .eq('id', userId)
          .maybeSingle()
        if (profile) {
          if (profile.nickname) nickname = profile.nickname
          if (profile.avatar_url) avatar = profile.avatar_url
          if (profile.rider_no) riderId = profile.rider_no
        }
        if (role === 'merchant') {
          const { data: shop } = await supabase
            .from('shops')
            .select('id,name')
            .eq('owner_id', userId)
            .maybeSingle()
          if (shop) {
            shopId = shop.id
            shopName = shop.name
          }
        }
      } catch (err) {
        console.warn('[auth] 读取 profiles/shops 失败，改用登录元数据', err)
      }
    }

    // 骑手工号兜底：与本地模拟登录保持一致的生成规则
    if (role === 'rider' && !riderId && phone) riderId = 'R' + phone.slice(-4)

    return { id: userId, role, phone, nickname, avatar, shopId, shopName, riderId, loggedIn: true }
  }, [])

  // —— 演示账号手机号（一键体验 / 验证码登录用；密码均为 123456）——
  const DEMO_PHONE: Record<UserRole, string> = {
    customer: '13800000001',
    merchant: '13800000002',
    rider: '13800000003',
  }

  // —— Supabase 会话恢复：刷新页面后保持登录；会话失效则回到未登录 ——
  // 未配置 Supabase 时不执行，本地模拟登录的行为完全不变。
  // 位置必须放在 saveUser / buildUserFromSession 声明之后。
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      const su = data.session?.user
      if (!su) {
        saveUser(GUEST_USER)
        return
      }
      const built = await buildUserFromSession(su.id, su.email, su.user_metadata ?? {})
      if (!cancelled && built) saveUser(built)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // 只在会话消失时兜底；建立会话由各登录方法负责，避免重复覆盖刚写入的 shopId 等信息
      if (!session) saveUser(GUEST_USER)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [saveUser, buildUserFromSession])

  // —— 验证码登录 ——
  // 短信验证码是前端演示 Mock（固定 SIMULATED_CODE = 123456），真实短信接入点见 LoginPage 的「发送验证码」。
  // 接上 Supabase 后：验证码校验仍在本地完成，通过后用演示密码换取真实会话，
  // 因此该入口只对演示账号有效（三个演示账号密码统一为 123456）。
  const loginWithCode = useCallback(async (phone: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: phoneToAuthEmail(phone),
        password: SIMULATED_CODE,
      })
      if (error || !data.user) {
        return {
          success: false,
          message: '验证码登录仅支持演示账号（13800000001 / 13800000002 / 13800000003），其他账号请用密码登录',
        }
      }
      const built = await buildUserFromSession(data.user.id, data.user.email, data.user.user_metadata ?? {}, role)
      if (!built) return { success: false, message: '该账号资料不完整，请用密码登录' }
      if (built.role !== role) {
        await supabase.auth.signOut()
        return { success: false, message: '该账号不属于当前端，请回到启动页选择正确的身份' }
      }
      saveUser(built)
      return { success: true, user: built }
    }

    // —— 以下为未配置 Supabase 时的本地模拟登录（原逻辑，保持不变）——
    const accounts = readAccounts(role)
    const existing = accounts.find(a => a.phone === phone)

    let nickname: string
    let avatar: string
    let shopId: string | undefined
    let shopName: string | undefined
    let riderId: string | undefined

    if (existing) {
      nickname = existing.nickname
      avatar = existing.avatar
      shopId = existing.shopId
      shopName = existing.shopName
      riderId = existing.riderId
    } else {
      // 首次验证码登录：创建轻量账号（无密码）
      nickname = `用户${phone.slice(-4)}`
      avatar = getDefaultAvatar(role)
      if (role === 'rider') riderId = 'R' + phone.slice(-4)
      const newAccount: IRegisteredAccount = {
        phone,
        password: '',
        nickname,
        avatar,
        createdAt: Date.now(),
        ...(role === 'rider' ? { riderId } : {}),
      }
      accounts.push(newAccount)
      saveAccounts(role, accounts)
    }

    const newUser: IAuthUser = {
      id: `${role}_${phone}`,
      role,
      phone,
      nickname,
      avatar,
      shopId,
      shopName,
      riderId,
      loggedIn: true,
    }
    saveUser(newUser)
    return { success: true, user: newUser }
  }, [saveUser, buildUserFromSession])

  // —— 密码登录 ——
  const loginWithPassword = useCallback(async (phone: string, password: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
    if (!password) return { success: false, message: '请输入密码' }

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: phoneToAuthEmail(phone),
        password,
      })
      if (error || !data.user) {
        // Supabase 不区分「账号不存在」和「密码错误」是出于防账号枚举的考虑，这里保持一致
        return { success: false, message: '手机号或密码不正确' }
      }
      const built = await buildUserFromSession(data.user.id, data.user.email, data.user.user_metadata ?? {}, role)
      if (!built) return { success: false, message: '该账号资料不完整，请联系管理员' }
      if (built.role !== role) {
        // 三端账号独立：顾客账号不能登商家端，反之亦然（硬约束 §4.1）
        await supabase.auth.signOut()
        return { success: false, message: '该账号不属于当前端，请回到启动页选择正确的身份' }
      }
      saveUser(built)
      return { success: true, user: built }
    }

    // —— 未配置 Supabase：本地模拟登录（原逻辑）——
    const accounts = readAccounts(role)
    const existing = accounts.find(a => a.phone === phone)

    if (!existing) return { success: false, message: '该手机号尚未注册' }
    if (!existing.password) return { success: false, message: '该账号未设置密码，请使用验证码登录' }
    if (existing.password !== password) return { success: false, message: '密码错误' }

    const newUser = {
      id: `${role}_${phone}`,
      role,
      phone,
      nickname: existing.nickname,
      avatar: existing.avatar,
      shopId: existing.shopId,
      shopName: existing.shopName,
      riderId: existing.riderId,
      loggedIn: true,
    } as IAuthUser
    saveUser(newUser)
    return { success: true, user: newUser }
  }, [saveUser, buildUserFromSession])

  // —— 注册 ——
  const register = useCallback(async (phone: string, password: string, nickname: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
    if (!password || password.length < 6) return { success: false, message: '密码至少6位' }
    if (!nickname.trim()) return { success: false, message: '请输入昵称' }

    if (supabase) {
      // role/nickname/phone 通过注册元数据传给数据库触发器 handle_new_user，
      // 由它自动建立 profiles 行（角色即由此带入）
      const { data, error } = await supabase.auth.signUp({
        email: phoneToAuthEmail(phone),
        password,
        options: { data: { role, nickname: nickname.trim(), phone } },
      })
      if (error) return { success: false, message: error.message || '注册失败，请稍后重试' }
      // Supabase 为防账号枚举，对已存在的邮箱会返回「成功但 identities 为空」的假象
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { success: false, message: '该手机号已注册，请直接登录' }
      }
      if (!data.user) return { success: false, message: '注册失败，请稍后重试' }
      const built = await buildUserFromSession(data.user.id, data.user.email, data.user.user_metadata ?? {}, role)
      if (!built) return { success: false, message: '注册成功但资料读取失败，请重新登录' }
      saveUser(built)
      return { success: true, user: built }
    }

    // —— 未配置 Supabase：本地模拟注册（原逻辑）——
    const accounts = readAccounts(role)
    const existing = accounts.find(a => a.phone === phone)

    if (existing && existing.password) {
      return { success: false, message: '该手机号已注册' }
    }

    const avatar = getDefaultAvatar(role)
    const now = Date.now()
    const riderId = role === 'rider' ? 'R' + phone.slice(-4) : undefined

    if (existing) {
      // 之前只有验证码登录（无密码），现在补设密码
      existing.password = password
      existing.nickname = nickname.trim()
      existing.avatar = avatar
      existing.createdAt = now
      if (riderId) existing.riderId = riderId
    } else {
      accounts.push({
        phone,
        password,
        nickname: nickname.trim(),
        avatar,
        createdAt: now,
        ...(riderId ? { riderId } : {}),
      })
    }
    saveAccounts(role, accounts)

    const newUser: IAuthUser = {
      id: `${role}_${phone}`,
      role,
      phone,
      nickname: nickname.trim(),
      avatar,
      ...(role === 'merchant' ? {} : {}), // 商家注册后暂无店铺，需要后续创建
      ...(role === 'rider' ? { riderId } : {}),
      loggedIn: true,
    }
    saveUser(newUser)
    return { success: true, user: newUser }
  }, [saveUser, buildUserFromSession])

  // —— 重置密码 ——
  const resetPassword = useCallback(async (phone: string, newPassword: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
    if (!newPassword || newPassword.length < 6) return { success: false, message: '新密码至少6位' }

    if (supabase) {
      // Supabase 改密码需要「先有会话」——只允许当前已登录账号改自己的密码。
      // 演示环境没有真实短信/邮件通道，因此找回密码对他人账号不可用（已在界面注明）。
      const { data: sessionData } = await supabase.auth.getSession()
      const current = sessionData.session?.user
      if (!current) {
        return { success: false, message: '演示环境请先登录后再修改密码（无真实短信通道）' }
      }
      if (authEmailToPhone(current.email) !== phone) {
        return { success: false, message: '只能修改当前登录账号的密码，请先用该账号登录' }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { success: false, message: error.message || '重置失败，请稍后重试' }
      return { success: true, message: '密码重置成功' }
    }

    // —— 未配置 Supabase：本地模拟重置（原逻辑）——
    const accounts = readAccounts(role)
    const idx = accounts.findIndex(a => a.phone === phone)
    if (idx < 0) return { success: false, message: '该手机号尚未注册' }

    accounts[idx].password = newPassword
    saveAccounts(role, accounts)
    return { success: true, message: '密码重置成功' }
  }, [])

  // —— 检查手机号是否已注册（有密码）——
  const isPhoneRegistered = useCallback((phone: string, role: UserRole): boolean => {
    const accounts = readAccounts(role)
    const existing = accounts.find(a => a.phone === phone)
    return !!(existing && existing.password)
  }, [])

  // —— 检查商家账号是否已有店铺 ——
  const hasShop = useCallback((phone: string): boolean => {
    const accounts = readAccounts('merchant')
    const existing = accounts.find(a => a.phone === phone)
    return !!(existing && existing.shopId)
  }, [])

  // —— 商家账号绑定店铺 ——
  const bindShop = useCallback((shopId: string, shopName: string) => {
    if (user.role !== 'merchant' || !user.phone) return

    // 更新登录态
    setUser(prev => {
      const updated = { ...prev, shopId, shopName }
      scopedStorage.setItem(AUTH_KEY, JSON.stringify(updated))
      return updated
    })

    // 持久化到账号记录
    const accounts = readAccounts('merchant')
    const idx = accounts.findIndex(a => a.phone === user.phone)
    if (idx >= 0) {
      accounts[idx].shopId = shopId
      accounts[idx].shopName = shopName
      saveAccounts('merchant', accounts)
    }
  }, [user])

  // —— 一键体验 ——
  // 接上 Supabase 后，「一键体验」= 用该端演示账号真实登录（密码 123456）；
  // 演示账号不可用时（例如数据库还没跑 seed）退回本地演示身份，保证界面能走通。
  const quickLogin = useCallback(async (role: UserRole): Promise<IAuthUser> => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: phoneToAuthEmail(DEMO_PHONE[role]),
        password: SIMULATED_CODE,
      })
      if (!error && data.user) {
        const built = await buildUserFromSession(data.user.id, data.user.email, data.user.user_metadata ?? {}, role)
        if (built) {
          saveUser(built)
          return built
        }
      } else {
        console.warn('[auth] 演示账号登录失败，退回本地演示身份', error)
      }
    }
    const base = DEMO_ACCOUNTS[role]
    const profile = readRoleProfile(role)
    const newUser: IAuthUser = {
      ...base,
      ...profile,
      loggedIn: true,
    }
    saveUser(newUser)
    return newUser
  }, [saveUser, buildUserFromSession])

  // —— 退出登录 ——
  const logout = useCallback(() => {
    saveUser(GUEST_USER)
    // 同时清掉 Supabase 会话，避免出现「界面已退出但会话还在」
    if (supabase) void supabase.auth.signOut()
    // 清空从数据库读到的店铺缓存，避免把上一个账号看到的数据留在内存里
    resetShopsCache()
  }, [saveUser])

  // —— 更新资料 ——
  const updateProfile = useCallback((updates: Partial<Pick<IAuthUser, 'avatar' | 'nickname' | 'phone'>>) => {
    setUser(prev => {
      const updated = { ...prev, ...updates }
      scopedStorage.setItem(AUTH_KEY, JSON.stringify(updated))

      // 按角色存自定义资料
      const roleProfile = readRoleProfile(prev.role)
      const toSave: Partial<{ nickname: string; avatar: string }> = { ...roleProfile }
      if (updates.nickname !== undefined) toSave.nickname = updates.nickname
      if (updates.avatar !== undefined) toSave.avatar = updates.avatar
      saveRoleProfile(prev.role, toSave)

      // 同步到注册账号库
      if (prev.phone && prev.loggedIn) {
        const accounts = readAccounts(prev.role)
        const idx = accounts.findIndex(a => a.phone === prev.phone)
        if (idx >= 0) {
          if (updates.nickname !== undefined) accounts[idx].nickname = updates.nickname
          if (updates.avatar !== undefined) accounts[idx].avatar = updates.avatar
          saveAccounts(prev.role, accounts)
        }
      }

      return updated
    })

    // 同步到 Supabase（第 1 期只同步昵称与头像；头像是 base64，第 4 期再迁到 Storage）
    if (supabase && /^[0-9a-f-]{36}$/i.test(user.id)) {
      const patch: { nickname?: string; avatar_url?: string } = {}
      if (updates.nickname !== undefined) patch.nickname = updates.nickname
      if (updates.avatar !== undefined) patch.avatar_url = updates.avatar
      if (Object.keys(patch).length > 0) {
        void supabase
          .from('profiles')
          .update(patch)
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.warn('[auth] 资料同步到 Supabase 失败', error)
          })
      }
    }
  }, [user.id])

  const value: AuthContextValue = {
    user,
    isLoggedIn: user.loggedIn,
    loginWithCode,
    loginWithPassword,
    register,
    resetPassword,
    isPhoneRegistered,
    hasShop,
    bindShop,
    quickLogin,
    logout,
    updateProfile,
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getRoleHomePath(role: UserRole): string {
  if (role === 'merchant') return '/merchant'
  if (role === 'rider') return '/rider'
  return '/customer'
}

export function getRoleLoginPath(role: UserRole): string {
  return `/login?role=${role}`
}

export function getRoleFromPath(pathname: string): UserRole | null {
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/rider')) return 'rider'
  if (pathname.startsWith('/customer')) return 'customer'
  return null
}

export type UseAuthReturn = ReturnType<typeof useAuth>
