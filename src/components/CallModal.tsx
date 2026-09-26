import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Mic, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Image } from '@/components/ui/image'

interface CallModalProps {
  open: boolean
  onClose: () => void
  peerName: string
  peerAvatar: string
  peerRole: 'customer' | 'merchant' | 'rider'
  peerPhone?: string
}

// 生成隐私中间号
function maskPhone(phone?: string): string {
  if (!phone) return '171****1234'
  if (phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export default function CallModal({ open, onClose, peerName, peerAvatar, peerRole, peerPhone }: CallModalProps) {
  const [callState, setCallState] = useState<'calling' | 'connected' | 'ended'>('calling')
  const [duration, setDuration] = useState(0)
  const [speakerOn, setSpeakerOn] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (!open) {
      setCallState('calling')
      setDuration(0)
      setSpeakerOn(false)
      setMuted(false)
      return
    }
    // 模拟 2.5s 后接通
    const connectTimer = setTimeout(() => {
      setCallState('connected')
    }, 2500)
    return () => clearTimeout(connectTimer)
  }, [open])

  useEffect(() => {
    if (callState !== 'connected') return
    const timer = setInterval(() => {
      setDuration(d => d + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [callState])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const handleHangUp = () => {
    setCallState('ended')
    setTimeout(() => {
      onClose()
    }, 800)
  }

  const roleLabel = peerRole === 'customer' ? '顾客' : peerRole === 'merchant' ? '商家' : '骑手'
  const maskedPhone = maskPhone(peerPhone)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-card rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
            onClick={e => e.stopPropagation()}
          >
            {/* 顶部把手 */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            <div className="px-6 py-6 flex flex-col items-center">
              {/* 头像 */}
              <div className="relative mb-4">
                <motion.div
                  animate={callState === 'calling' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                  transition={callState === 'calling' ? { duration: 1.5, repeat: Infinity } : {}}
                  className="size-20 rounded-full overflow-hidden bg-muted ring-4 ring-foreground/5"
                >
                  {peerAvatar ? (
                    <Image src={peerAvatar} alt={peerName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Phone className="size-8 text-muted-foreground/40" />
                    </div>
                  )}
                </motion.div>
              </div>

              {/* 对方信息 */}
              <h3 className="text-lg font-semibold text-foreground">{peerName}</h3>
              <p className="text-xs text-muted-foreground mt-1">{roleLabel} · {maskedPhone}</p>

              {/* 状态 */}
              <div className="mt-4 h-6">
                  {callState === 'calling' && (
                    <p className="text-sm text-muted-foreground">
                      正在呼叫...
                    </p>
                  )}
                  {callState === 'connected' && (
                    <p className="text-sm text-success font-medium">
                      通话中 · {formatDuration(duration)}
                    </p>
                  )}
                  {callState === 'ended' && (
                    <p className="text-sm text-muted-foreground">
                      通话结束
                    </p>
                  )}
              </div>

              {/* 号码保护提示 */}
              <p className="text-[11px] text-muted-foreground/70 text-center mt-3 max-w-[280px]">
                本号码为虚拟中间号，通话结束后失效。
                请勿保存，以免后续联系不上对方。
              </p>

              {/* 操作按钮 */}
              <div className="flex items-center gap-8 mt-8 mb-2">
                <button
                  className="flex flex-col items-center gap-1.5"
                  onClick={() => setSpeakerOn(v => !v)}
                >
                  <div className={`size-12 rounded-full flex items-center justify-center transition-colors ${
                    speakerOn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    <Volume2 className="size-5" />
                  </div>
                  <span className={`text-[10px] ${speakerOn ? 'text-primary font-medium' : 'text-muted-foreground'}`}>免提</span>
                </button>

                <button
                  className="flex flex-col items-center gap-1.5"
                  onClick={handleHangUp}
                >
                  <div className="size-14 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/30">
                    <PhoneOff className="size-6 text-destructive-foreground" />
                  </div>
                  <span className="text-[10px] text-destructive font-medium">挂断</span>
                </button>

                <button
                  className="flex flex-col items-center gap-1.5"
                  onClick={() => setMuted(v => !v)}
                >
                  <div className={`size-12 rounded-full flex items-center justify-center transition-colors ${
                    muted ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    <Mic className="size-5" />
                  </div>
                  <span className={`text-[10px] ${muted ? 'text-primary font-medium' : 'text-muted-foreground'}`}>静音</span>
                </button>
              </div>
            </div>

            {/* 关闭按钮（小屏备用） */}
            <button
              onClick={onClose}
              className="sr-only"
              aria-label="关闭"
            >
              <X className="size-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
