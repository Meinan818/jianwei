import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, MessageCircle, Check, ChevronLeft, Eye, EyeOff,
  UserCircle, Store, Bike, UserPlus, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, getRoleHomePath } from '@/hooks/useAuth'
import { SIMULATED_CODE } from '@/data/auth'
import type { UserRole } from '@/data/auth'
import AgreementSheet from '@/components/AgreementSheet'

const ROLE_META: Record<UserRole, { endName: string; Icon: typeof UserCircle }> = {
  customer: { endName: '顾客端', Icon: UserCircle },
  merchant: { endName: '商家端', Icon: Store },
  rider: { endName: '骑手端', Icon: Bike },
}

type PageMode = 'login' | 'register' | 'forgot'
type LoginTab = 'code' | 'password'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithCode, loginWithPassword, quickLogin, register, resetPassword, isPhoneRegistered } = useAuth()

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const initialRole = (searchParams.get('role') as UserRole) || 'customer'
  const initialMode: PageMode = (searchParams.get('mode') as PageMode) || 'login'
  const initialTab: LoginTab = searchParams.get('tab') === 'password' ? 'password' : 'code'

  const [role] = useState<UserRole>(initialRole)
  const [pageMode, setPageMode] = useState<PageMode>(initialMode)
  const [loginTab, setLoginTab] = useState<LoginTab>(initialTab)

  // 表单
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [nickname, setNickname] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 协议弹层
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementType, setAgreementType] = useState<'user' | 'privacy'>('user')

  const meta = ROLE_META[role]
  const RoleIcon = meta.Icon

  const pageTitle = {
    login: loginTab === 'code' ? '验证码登录' : '密码登录',
    register: '注册新账号',
    forgot: '找回密码',
  }[pageMode]

  const startCountdown = useCallback(() => {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleSendCode = useCallback(() => {
    if (!/^1\d{10}$/.test(phone)) {
      toast.info('请输入正确的手机号')
      return
    }
    startCountdown()
    toast.info(`演示验证码：${SIMULATED_CODE}`, { duration: 4000 })
  }, [phone, startCountdown])

  const switchMode = (mode: PageMode) => {
    setPageMode(mode)
    setCode('')
    setPassword('')
    setPassword2('')
    setNickname('')
    setAgreed(false)
    setSubmitting(false)
  }

  const openAgreement = (type: 'user' | 'privacy') => {
    setAgreementType(type)
    setShowAgreement(true)
  }

  const validatePhone = (): boolean => {
    if (!/^1\d{10}$/.test(phone)) {
      toast.info('请输入正确的手机号')
      return false
    }
    return true
  }

  // 验证码登录
  const handleCodeLogin = async () => {
    if (!agreed) { toast.info('请先阅读并同意用户协议和隐私政策'); return }
    if (!validatePhone()) return
    if (code !== SIMULATED_CODE) { toast.info('验证码错误'); return }
    setSubmitting(true)
    try {
      const result = await loginWithCode(phone, role)
      if (result.success && result.user) {
        toast.success('登录成功')
        // 商家账号且无店铺 → 先去建店向导
        if (result.user.role === 'merchant' && !result.user.shopId) {
          navigate('/merchant/create-shop', { replace: true })
        } else {
          navigate(getRoleHomePath(result.user.role), { replace: true })
        }
      } else {
        toast.info(result.message || '登录失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 密码登录
  const handlePasswordLogin = async () => {
    if (!agreed) { toast.info('请先阅读并同意用户协议和隐私政策'); return }
    if (!validatePhone()) return
    if (!password) { toast.info('请输入密码'); return }
    setSubmitting(true)
    try {
      const result = await loginWithPassword(phone, password, role)
      if (result.success && result.user) {
        toast.success('登录成功')
        // 商家账号且无店铺 → 先去建店向导
        if (result.user.role === 'merchant' && !result.user.shopId) {
          navigate('/merchant/create-shop', { replace: true })
        } else {
          navigate(getRoleHomePath(result.user.role), { replace: true })
        }
      } else {
        toast.info(result.message || '登录失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 注册
  const handleRegister = async () => {
    if (!agreed) { toast.info('请先阅读并同意用户协议和隐私政策'); return }
    if (!validatePhone()) return
    if (!nickname.trim()) { toast.info('请输入昵称'); return }
    if (code !== SIMULATED_CODE) { toast.info('验证码错误'); return }
    if (password.length < 6) { toast.info('密码至少6位'); return }
    if (password !== password2) { toast.info('两次输入的密码不一致'); return }
    if (isPhoneRegistered(phone, role)) { toast.info('该手机号已注册，请直接登录'); return }
    setSubmitting(true)
    try {
      const result = await register(phone, password, nickname, role)
      if (result.success && result.user) {
        toast.success('注册成功，已自动登录')
        // 商家账号 → 去建店向导（一账号一店铺）
        if (result.user.role === 'merchant') {
          navigate('/merchant/create-shop', { replace: true })
        } else {
          navigate(getRoleHomePath(result.user.role), { replace: true })
        }
      } else {
        toast.info(result.message || '注册失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 重置密码
  const handleResetPwd = async () => {
    if (!validatePhone()) return
    if (code !== SIMULATED_CODE) { toast.info('验证码错误'); return }
    if (password.length < 6) { toast.info('新密码至少6位'); return }
    if (password !== password2) { toast.info('两次输入的密码不一致'); return }
    setSubmitting(true)
    try {
      const result = await resetPassword(phone, password, role)
      if (result.success) {
        toast.success('密码重置成功，请用新密码登录')
        switchMode('login')
        setLoginTab('password')
      } else {
        toast.info(result.message || '重置失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 主按钮动作
  const handleMainAction = () => {
    if (pageMode === 'login') {
      if (loginTab === 'code') void handleCodeLogin()
      else void handlePasswordLogin()
    } else if (pageMode === 'register') {
      void handleRegister()
    } else {
      void handleResetPwd()
    }
  }

  // 一键体验
  const handleQuickLogin = async () => {
    setSubmitting(true)
    try {
      const demoUser = await quickLogin(role)
      toast.success(`已以${meta.endName}体验账号登录`)
      navigate(getRoleHomePath(demoUser.role), { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (pageMode !== 'login') {
      switchMode('login')
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="size-8 -ml-1 flex items-center justify-center"
          aria-label="返回"
        >
          <ChevronLeft className="size-5 text-foreground" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
          <div className="space-y-6">
            {/* 品牌 + 当前端 */}
            <div className="flex flex-col items-center pt-2">
              <div className="size-16 rounded-2xl bg-foreground flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-background">饭</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleIcon className="size-5 text-foreground" />
                <h1 className="text-xl font-bold text-foreground">{pageTitle}</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{meta.endName} · 饭否外卖</p>
            </div>

            {/* 登录 Tab 切换（仅登录模式显示） */}
            {pageMode === 'login' && (
              <div className="flex gap-6 border-b border-border/50">
                {(['code', 'password'] as LoginTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setLoginTab(tab)}
                    className={`relative pb-3 text-sm font-medium transition-colors ${
                      loginTab === tab ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {tab === 'code' ? '验证码登录' : '密码登录'}
                    {loginTab === tab && (
                      <motion.div
                        layoutId="loginTabIndicator"
                        className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* 表单区 */}
            <div className="space-y-4">
              {/* 手机号（所有模式都有） */}
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入手机号"
                  className="w-full h-12 pl-12 pr-4 bg-card border border-border/50 rounded-full text-sm outline-none focus:border-foreground transition-colors"
                />
              </div>

              {/* 昵称（仅注册） */}
              {pageMode === 'register' && (
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => setNickname(e.target.value.slice(0, 20))}
                    placeholder="请输入昵称"
                    className="w-full h-12 pl-12 pr-4 bg-card border border-border/50 rounded-full text-sm outline-none focus:border-foreground transition-colors"
                  />
                </div>
              )}

              {/* 验证码（登录-验证码 / 注册 / 忘记密码）*/}
              {(pageMode !== 'login' || loginTab === 'code') && (
                <div className="relative">
                  <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入验证码"
                    className="w-full h-12 pl-12 pr-28 bg-card border border-border/50 rounded-full text-sm outline-none focus:border-foreground transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {countdown === 0 ? (
                      <button
                        type="button"
                        onClick={handleSendCode}
                        className="h-8 px-3 rounded-full bg-foreground/10 text-foreground text-xs font-medium active:bg-foreground/20"
                      >
                        获取验证码
                      </button>
                    ) : (
                      <span className="h-8 px-3 flex items-center text-xs text-muted-foreground">
                        {countdown}s 后重发
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 密码（登录-密码 / 注册 / 忘记密码）*/}
              {(pageMode === 'login' && loginTab === 'password') || pageMode === 'register' || pageMode === 'forgot' ? (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value.slice(0, 20))}
                    placeholder={
                      pageMode === 'login' ? '请输入密码'
                      : pageMode === 'register' ? '设置密码（至少6位）'
                      : '新密码（至少6位）'
                    }
                    className="w-full h-12 pl-12 pr-12 bg-card border border-border/50 rounded-full text-sm outline-none focus:border-foreground transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-muted-foreground"
                    aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              ) : null}

              {/* 确认密码（注册 / 忘记密码）*/}
              {(pageMode === 'register' || pageMode === 'forgot') && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <input
                    type={showPwd2 ? 'text' : 'password'}
                    value={password2}
                    onChange={e => setPassword2(e.target.value.slice(0, 20))}
                    placeholder={pageMode === 'register' ? '确认密码' : '确认新密码'}
                    className="w-full h-12 pl-12 pr-12 bg-card border border-border/50 rounded-full text-sm outline-none focus:border-foreground transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd2(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-muted-foreground"
                    aria-label={showPwd2 ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd2 ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}

              {/* 忘记密码入口（仅密码登录模式） */}
              {pageMode === 'login' && loginTab === 'password' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-foreground/70 underline underline-offset-2"
                  >
                    忘记密码？
                  </button>
                </div>
              )}
            </div>

            {/* 协议勾选（登录和注册需要；忘记密码不需要） */}
            {pageMode !== 'forgot' && (
              <button
                type="button"
                onClick={() => setAgreed(!agreed)}
                className="flex items-start gap-2 text-left"
              >
                <div className={`size-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  agreed ? 'bg-foreground border-foreground' : 'border-border'
                }`}>
                  {agreed && <Check className="size-3.5 text-background" />}
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  我已阅读并同意
                  <button type="button" onClick={(e) => { e.stopPropagation(); openAgreement('user') }} className="text-foreground"> 《用户协议》</button>
                  和
                  <button type="button" onClick={(e) => { e.stopPropagation(); openAgreement('privacy') }} className="text-foreground"> 《隐私政策》</button>
                </span>
              </button>
            )}

            {/* 主按钮 */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleMainAction}
              disabled={submitting}
              className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center disabled:opacity-50"
            >
              {pageMode === 'login' ? '登录' : pageMode === 'register' ? '注册并登录' : '重置密码'}
            </motion.button>

            {/* 底部次要操作区 */}
            <div className="space-y-4 pt-2">
              {/* 模式切换 */}
              {pageMode === 'login' ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-xs text-foreground underline underline-offset-2"
                  >
                    新用户？立即注册 →
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs text-foreground underline underline-offset-2"
                  >
                    已有账号？去登录 →
                  </button>
                </div>
              )}

              {/* 一键体验分隔 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[11px] text-muted-foreground">演示快捷入口</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* 一键体验按钮 */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleQuickLogin}
                className="w-full h-11 rounded-full border border-border/50 bg-card text-foreground/80 text-sm font-medium flex items-center justify-center gap-2 active:bg-muted/50"
              >
                <span className="text-xs">✨</span>
                一键体验（{meta.endName}演示账号）
              </motion.button>
            </div>
          </div>
      </div>

      {/* 协议弹层 */}
      <AgreementSheet
        open={showAgreement}
        type={agreementType}
        onClose={() => setShowAgreement(false)}
      />
    </div>
  )
}
