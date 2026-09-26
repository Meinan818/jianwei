import React, { useState, useCallback, createContext, useContext, useEffect } from 'react'
import { scopedStorage, avatarImages } from '@lark-apaas/client-toolkit-lite'
import type { IAuthUser, UserRole, IRegisteredAccount } from '@/data/auth'
import { SIMULATED_CODE, ACCOUNTS_KEY_PREFIX } from '@/data/auth'

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

  // 验证码登录
  loginWithCode: (phone: string, role: UserRole) => { success: boolean; user?: IAuthUser; message?: string }
  // 密码登录
  loginWithPassword: (phone: string, password: string, role: UserRole) => { success: boolean; user?: IAuthUser; message?: string }
  // 注册
  register: (phone: string, password: string, nickname: string, role: UserRole) => { success: boolean; user?: IAuthUser; message?: string }
  // 重置密码
  resetPassword: (phone: string, newPassword: string, role: UserRole) => { success: boolean; message?: string }
  // 检查是否已注册（有密码）
  isPhoneRegistered: (phone: string, role: UserRole) => boolean
  // 检查商家账号是否已有店铺
  hasShop: (phone: string) => boolean
  // 商家账号绑定店铺（一账号一店铺）
  bindShop: (shopId: string, shopName: string) => void
  // 一键体验
  quickLogin: (role: UserRole) => IAuthUser
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

  // —— 验证码登录 ——
  const loginWithCode = useCallback((phone: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
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
  }, [saveUser])

  // —— 密码登录 ——
  const loginWithPassword = useCallback((phone: string, password: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
    if (!password) return { success: false, message: '请输入密码' }

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
  }, [saveUser])

  // —— 注册 ——
  const register = useCallback((phone: string, password: string, nickname: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
    if (!password || password.length < 6) return { success: false, message: '密码至少6位' }
    if (!nickname.trim()) return { success: false, message: '请输入昵称' }

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
  }, [saveUser])

  // —— 重置密码 ——
  const resetPassword = useCallback((phone: string, newPassword: string, role: UserRole) => {
    if (!/^1\d{10}$/.test(phone)) return { success: false, message: '请输入正确的手机号' }
    if (!newPassword || newPassword.length < 6) return { success: false, message: '新密码至少6位' }

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
  const quickLogin = useCallback((role: UserRole): IAuthUser => {
    const base = DEMO_ACCOUNTS[role]
    const profile = readRoleProfile(role)
    const newUser: IAuthUser = {
      ...base,
      ...profile,
      loggedIn: true,
    }
    saveUser(newUser)
    return newUser
  }, [saveUser])

  // —— 退出登录 ——
  const logout = useCallback(() => {
    saveUser(GUEST_USER)
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
  }, [])

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
