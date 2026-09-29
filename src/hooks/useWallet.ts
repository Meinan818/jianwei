import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import React from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import type { IMemberInfo, IWalletRecord, IWithdrawRecord } from '@/data/member'
import { MOCK_MEMBER_INFO, MOCK_WALLET_RECORDS, MEMBER_LEVELS, MOCK_WITHDRAW_RECORDS } from '@/data/member'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  fetchWalletSnapshot,
  applyWalletTxn,
  applyWalletTxnOnce,
  payOrderWithBalanceRemote,
  syncWalletStats,
  insertWithdrawRecord,
  completeWithdrawRecord,
} from '@/data/wallet-remote'

const MEMBER_KEY = 'food_delivery_member'
const WALLET_KEY = 'food_delivery_wallet_records'
const WITHDRAW_KEY = 'food_delivery_withdraw_records'
const PAY_PASSWORD_KEY = 'food_delivery_pay_password'
const DEFAULT_PAY_PASSWORD = '123456'

interface WalletContextValue {
  // 会员
  memberInfo: IMemberInfo
  currentLevelInfo: typeof MEMBER_LEVELS[number]
  nextLevelInfo: typeof MEMBER_LEVELS[number] | null
  levelProgress: number // 0~1
  openVip: (months?: number) => void
  addPointsAndGrowth: (amount: number, orderId?: string) => void

  // 钱包
  balance: number
  walletRecords: IWalletRecord[]
  recharge: (amount: number, method: string | undefined, idempotencyKey: string) => Promise<boolean>
  consumeBalance: (amount: number, title: string, orderId?: string) => boolean
  payOrderWithBalance: (orderId: string, amount: number) => Promise<boolean>
  refundBalance: (amount: number, title: string, orderId?: string) => boolean

  // 支付密码
  hasPayPassword: boolean
  verifyPayPassword: (pwd: string) => boolean
  setPayPassword: (pwd: string) => boolean

  // 提现
  withdrawRecords: IWithdrawRecord[]
  requestWithdraw: (amount: number, account: string, accountType: 'alipay' | 'wechat' | 'bank', payPwd: string) => { success: boolean; msg: string }
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn } = useAuth()
  const [memberInfo, setMemberInfo] = useState<IMemberInfo>(MOCK_MEMBER_INFO)
  const [walletRecords, setWalletRecords] = useState<IWalletRecord[]>([])
  const [withdrawRecords, setWithdrawRecords] = useState<IWithdrawRecord[]>([])
  const [hasPayPassword, setHasPayPassword] = useState(true)
  // 登录拉取期间有本地改动就跳过迟到的回包（与 useAddresses 同一套防护）
  const mutatedRef = useRef(false)

  // 初始化（原行为保留：未登录/未配库时读本地，没有则用 Mock 兜底）
  useEffect(() => {
    try {
      const mRaw = scopedStorage.getItem(MEMBER_KEY)
      if (mRaw) {
        const parsed = JSON.parse(mRaw) as IMemberInfo
        setMemberInfo(parsed)
      }
    } catch {
      // ignore
    }
    try {
      const wRaw = scopedStorage.getItem(WALLET_KEY)
      if (wRaw) {
        setWalletRecords(JSON.parse(wRaw) as IWalletRecord[])
      } else {
        setWalletRecords(MOCK_WALLET_RECORDS)
        scopedStorage.setItem(WALLET_KEY, JSON.stringify(MOCK_WALLET_RECORDS))
      }
    } catch {
      setWalletRecords([])
    }
    try {
      const wdRaw = scopedStorage.getItem(WITHDRAW_KEY)
      if (wdRaw) {
        setWithdrawRecords(JSON.parse(wdRaw) as IWithdrawRecord[])
      } else {
        setWithdrawRecords(MOCK_WITHDRAW_RECORDS)
        scopedStorage.setItem(WITHDRAW_KEY, JSON.stringify(MOCK_WITHDRAW_RECORDS))
      }
    } catch {
      setWithdrawRecords([])
    }
    const pwd = scopedStorage.getItem(PAY_PASSWORD_KEY)
    setHasPayPassword(!!pwd || true) // 默认真，演示用123456
  }, [])

  // 第 2 期 2g：登录后以数据库为准拉一遍（profiles + 流水 + 提现记录）
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return
    let cancelled = false
    void (async () => {
      const snap = await fetchWalletSnapshot(user.id)
      if (cancelled || !snap) return // 未配置 / 读失败 → 保持本地
      if (mutatedRef.current) return // 本地已有更新的改动，别用旧回包覆盖
      setMemberInfo(snap.memberInfo)
      setWalletRecords(snap.records)
      setWithdrawRecords(snap.withdraws)
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(snap.memberInfo))
      scopedStorage.setItem(WALLET_KEY, JSON.stringify(snap.records))
      scopedStorage.setItem(WITHDRAW_KEY, JSON.stringify(snap.withdraws))
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, user?.id])

  const saveMember = useCallback((info: IMemberInfo) => {
    setMemberInfo(info)
    scopedStorage.setItem(MEMBER_KEY, JSON.stringify(info))
  }, [])

  const saveRecords = useCallback((records: IWalletRecord[]) => {
    setWalletRecords(records)
    scopedStorage.setItem(WALLET_KEY, JSON.stringify(records))
  }, [])

  // 用数据库返回的流水替换本地临时记录（拿到 uuid 与权威 balance_after）
  const patchRecord = useCallback((tempId: string, dbRecord: IWalletRecord) => {
    setWalletRecords(prev => {
      const upd = prev.map(r => (r.id === tempId ? dbRecord : r))
      scopedStorage.setItem(WALLET_KEY, JSON.stringify(upd))
      return upd
    })
  }, [])

  // 数据库确认成功后再把权威余额和流水写进页面；相同流水 id 重试不会重复展示。
  const commitConfirmedRecord = useCallback((dbRecord: IWalletRecord) => {
    mutatedRef.current = true
    setMemberInfo(prev => {
      const updated = { ...prev, balance: dbRecord.balanceAfter }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      return updated
    })
    setWalletRecords(prev => {
      const updated = [dbRecord, ...prev.filter(r => r.id !== dbRecord.id)]
      scopedStorage.setItem(WALLET_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 当前等级 / 下一等级 / 进度
  const currentLevelInfo = MEMBER_LEVELS.find(l => l.level === memberInfo.level) || MEMBER_LEVELS[0]
  const nextLevelInfo = MEMBER_LEVELS.find(l => l.level === memberInfo.level + 1) || null
  const levelProgress = nextLevelInfo
    ? Math.min(1, (memberInfo.points - currentLevelInfo.threshold) / (nextLevelInfo.threshold - currentLevelInfo.threshold))
    : 1

  // 开通会员
  const openVip = useCallback((months = 1) => {
    mutatedRef.current = true
    setMemberInfo(prev => {
      const updated: IMemberInfo = {
        ...prev,
        isVip: true,
        vipExpireDate: new Date(Date.now() + months * 30 * 86400000).toISOString().slice(0, 10),
      }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // 增加积分与成长值（每消费 1 元 = 1 成长值，会员按倍率）
  const addPointsAndGrowth = useCallback((amount: number, _orderId?: string) => {
    mutatedRef.current = true
    setMemberInfo(prev => {
      const rate = [1, 1.2, 1.5, 2, 3][prev.level - 1] || 1
      const gained = Math.floor(amount * rate)
      let newLevel = prev.level
      for (let i = MEMBER_LEVELS.length - 1; i >= 0; i--) {
        if (prev.points + gained >= MEMBER_LEVELS[i].threshold) {
          newLevel = MEMBER_LEVELS[i].level
          break
        }
      }
      const updated: IMemberInfo = {
        ...prev,
        points: prev.points + gained,
        level: newLevel,
        totalSpent: +(prev.totalSpent + amount).toFixed(2),
      }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      // 数据库同步成长值/累计消费（余额不在这里动）；失败只记日志
      if (isLoggedIn && user?.id) {
        void syncWalletStats(user.id, updated.points, updated.totalSpent)
      }
      return updated
    })
  }, [isLoggedIn, user?.id])

  // 充值
  const recharge = useCallback(async (
    amount: number,
    method = 'wechat',
    idempotencyKey: string,
  ): Promise<boolean> => {
    if (amount <= 0) return false
    const title = '余额充值'
    const desc = `${method === 'wechat' ? '微信支付' : method === 'alipay' ? '支付宝' : '其他方式'}`

    // 已配置真实后端时以数据库为准。请求失败不改本地余额，留在当前页供同 key 重试。
    if (supabase && isLoggedIn && user?.id) {
      const dbRecord = await applyWalletTxnOnce(
        'recharge', amount, title, desc, undefined, `recharge:${idempotencyKey}`,
      )
      if (!dbRecord) return false
      commitConfirmedRecord(dbRecord)
      return true
    }

    // 未配置 Supabase 的离线演示保持原来的本地 Mock 行为。
    mutatedRef.current = true
    const time = Date.now()
    const record: IWalletRecord = {
      id: `wr_${time}`,
      type: 'recharge',
      amount,
      balanceAfter: 0, // 下面算
      title,
      desc,
      createdAt: time,
    }
    setMemberInfo(prev => {
      const updated = { ...prev, balance: +(prev.balance + amount).toFixed(2) }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      record.balanceAfter = updated.balance
      return updated
    })
    setWalletRecords(prev => {
      const updated = [record, ...prev]
      scopedStorage.setItem(WALLET_KEY, JSON.stringify(updated))
      return updated
    })
    return true
  }, [isLoggedIn, user?.id, commitConfirmedRecord])

  // 消费
  const consumeBalance = useCallback((amount: number, title: string, orderId?: string): boolean => {
    let ok = false
    let tempId: string | null = null
    mutatedRef.current = true
    setMemberInfo(prev => {
      if (prev.balance < amount) return prev
      const updated = { ...prev, balance: +(prev.balance - amount).toFixed(2) }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      ok = true
      // 同时写记录
      const record: IWalletRecord = {
        id: `wr_${Date.now()}`,
        type: 'consume',
        amount: -amount,
        balanceAfter: updated.balance,
        title,
        desc: orderId ? `订单 ${orderId.slice(-6)}` : undefined,
        createdAt: Date.now(),
        orderId,
      }
      tempId = record.id
      setWalletRecords(prev2 => {
        const updated = [record, ...prev2]
        scopedStorage.setItem(WALLET_KEY, JSON.stringify(updated))
        return updated
      })
      return updated
    })
    if (ok && tempId && isLoggedIn && user?.id) {
      void applyWalletTxn('consume', -amount, title, orderId ? `订单 ${orderId.slice(-6)}` : undefined, orderId).then(dbRec => {
        if (dbRec) patchRecord(tempId as string, dbRec)
      })
    }
    return ok
  }, [isLoggedIn, user?.id, patchRecord])

  // 余额支付由服务端事务保证：扣款、流水、订单状态要么一起成功，要么全部回滚。
  const payOrderWithBalance = useCallback(async (orderId: string, amount: number): Promise<boolean> => {
    if (amount <= 0) return false
    if (supabase && isLoggedIn && user?.id) {
      const dbRecord = await payOrderWithBalanceRemote(orderId, `balance-order:${orderId}`)
      if (!dbRecord) return false
      commitConfirmedRecord(dbRecord)
      return true
    }
    if (memberInfo.balance < amount) return false
    return consumeBalance(amount, `订单支付 ${orderId.slice(-6)}`, orderId)
  }, [memberInfo.balance, isLoggedIn, user?.id, commitConfirmedRecord, consumeBalance])

  const refundBalance = useCallback((amount: number, title: string, orderId?: string): boolean => {
    if (amount <= 0) return false
    mutatedRef.current = true
    let tempId: string | null = null
    setMemberInfo(prev => {
      const updated = { ...prev, balance: +(prev.balance + amount).toFixed(2) }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      const record: IWalletRecord = {
        id: `wr_${Date.now()}`,
        type: 'refund',
        amount,
        balanceAfter: updated.balance,
        title,
        desc: orderId ? `订单 ${orderId.slice(-6)}` : undefined,
        createdAt: Date.now(),
        orderId,
      }
      tempId = record.id
      setWalletRecords(prev2 => {
        const updated = [record, ...prev2]
        scopedStorage.setItem(WALLET_KEY, JSON.stringify(updated))
        return updated
      })
      return updated
    })
    if (tempId && isLoggedIn && user?.id) {
      void applyWalletTxn('refund', amount, title, orderId ? `订单 ${orderId.slice(-6)}` : undefined, orderId).then(dbRec => {
        if (dbRec) patchRecord(tempId as string, dbRec)
      })
    }
    return true
  }, [isLoggedIn, user?.id, patchRecord])

  // 支付密码
  const verifyPayPassword = useCallback((pwd: string): boolean => {
    const stored = scopedStorage.getItem(PAY_PASSWORD_KEY)
    if (stored) return stored === pwd
    return pwd === DEFAULT_PAY_PASSWORD
  }, [])

  const setPayPassword = useCallback((pwd: string): boolean => {
    if (!/^\d{6}$/.test(pwd)) return false
    scopedStorage.setItem(PAY_PASSWORD_KEY, pwd)
    setHasPayPassword(true)
    return true
  }, [])

  // 提现
  const requestWithdraw = useCallback((amount: number, account: string, accountType: 'alipay' | 'wechat' | 'bank', payPwd: string): { success: boolean; msg: string } => {
    if (!verifyPayPassword(payPwd)) {
      return { success: false, msg: '支付密码错误' }
    }
    if (amount < 10) return { success: false, msg: '最低提现 10 元' }
    if (amount > memberInfo.balance) return { success: false, msg: '余额不足' }
    const fee = amount >= 100 ? 0 : 1
    if (amount + fee > memberInfo.balance) return { success: false, msg: '余额不足以支付手续费' }

    mutatedRef.current = true
    const totalDeduct = amount + fee
    const time = Date.now()
    const withdrawTitle = `提现到${accountType === 'wechat' ? '微信' : accountType === 'alipay' ? '支付宝' : '银行卡'}`
    const withdrawDesc = fee > 0 ? `含 ${fee} 元手续费` : '免手续费'
    const withdrawRecord: IWithdrawRecord = {
      id: `wd_${time}`,
      amount,
      fee,
      arriveAmount: amount - fee,
      status: 'pending',
      account,
      accountType,
      createdAt: time,
    }

    let ok = false
    setMemberInfo(prev => {
      if (prev.balance < totalDeduct) return prev
      const updated = { ...prev, balance: +(prev.balance - totalDeduct).toFixed(2) }
      scopedStorage.setItem(MEMBER_KEY, JSON.stringify(updated))
      const record: IWalletRecord = {
        id: `wr_${time}`,
        type: 'withdraw',
        amount: -totalDeduct,
        balanceAfter: updated.balance,
        title: withdrawTitle,
        desc: withdrawDesc,
        createdAt: time,
      }
      setWalletRecords(prev2 => {
        const upd = [record, ...prev2]
        scopedStorage.setItem(WALLET_KEY, JSON.stringify(upd))
        return upd
      })
      ok = true
      return updated
    })

    if (!ok) return { success: false, msg: '余额不足' }

    setWithdrawRecords(prev => {
      const upd = [withdrawRecord, ...prev]
      scopedStorage.setItem(WITHDRAW_KEY, JSON.stringify(upd))
      return upd
    })

    // 数据库：余额扣减走原子 RPC，提现记录单独写表（uuid 由数据库生成）
    let currentWithdrawId = withdrawRecord.id // id 换成数据库 uuid 后，3 秒后的到账更新仍要能命中
    if (isLoggedIn && user?.id) {
      void applyWalletTxn('withdraw', -totalDeduct, withdrawTitle, withdrawDesc).then(dbRec => {
        if (dbRec) patchRecord(`wr_${time}`, dbRec)
      })
      void insertWithdrawRecord(withdrawRecord, user.id).then(dbId => {
        if (!dbId) return
        currentWithdrawId = dbId
        setWithdrawRecords(prev => {
          const upd = prev.map(r => (r.id === `wd_${time}` ? { ...r, id: dbId } : r))
          scopedStorage.setItem(WITHDRAW_KEY, JSON.stringify(upd))
          return upd
        })
      })
    }

    // 演示加速：3 秒后到账（本地状态 + 数据库状态一起更新）
    setTimeout(() => {
      setWithdrawRecords(prev => {
        const upd = prev.map(r => r.id === currentWithdrawId ? { ...r, status: 'success' as const, arriveAt: Date.now() } : r)
        scopedStorage.setItem(WITHDRAW_KEY, JSON.stringify(upd))
        return upd
      })
      void completeWithdrawRecord(currentWithdrawId)
    }, 3000)

    return { success: true, msg: '提现申请已提交' }
  }, [memberInfo.balance, verifyPayPassword, isLoggedIn, user?.id, patchRecord])

  const value: WalletContextValue = {
    memberInfo,
    currentLevelInfo,
    nextLevelInfo,
    levelProgress,
    openVip,
    addPointsAndGrowth,
    balance: memberInfo.balance,
    walletRecords,
    recharge,
    consumeBalance,
    payOrderWithBalance,
    refundBalance,
    hasPayPassword,
    verifyPayPassword,
    setPayPassword,
    withdrawRecords,
    requestWithdraw,
  }

  return React.createElement(WalletContext.Provider, { value }, children)
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return ctx
}
