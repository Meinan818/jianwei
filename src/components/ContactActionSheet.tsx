import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Phone, X } from 'lucide-react'
import { Image } from '@/components/ui/image'

interface ContactActionSheetProps {
  open: boolean
  onClose: () => void
  peerName: string
  peerAvatar: string
  peerRole: 'customer' | 'merchant' | 'rider'
  onMessage: () => void
  onCall: () => void
}

export default function ContactActionSheet({
  open,
  onClose,
  peerName,
  peerAvatar,
  peerRole,
  onMessage,
  onCall,
}: ContactActionSheetProps) {
  const roleLabel = peerRole === 'customer' ? '顾客' : peerRole === 'merchant' ? '商家' : '骑手'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-md bg-card rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            onClick={e => e.stopPropagation()}
          >
            {/* 顶部把手 */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* 对方信息 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
              <div className="size-11 rounded-full overflow-hidden bg-muted shrink-0">
                {peerAvatar ? (
                  <Image src={peerAvatar} alt={peerName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MessageCircle className="size-5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{peerName}</div>
                <div className="text-[11px] text-muted-foreground">{roleLabel}</div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
                aria-label="关闭"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* 操作选项 */}
            <div className="p-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onMessage()
                  onClose()
                }}
                className="flex flex-col items-center gap-2 py-4 rounded-xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors"
              >
                <div className="size-11 rounded-full bg-foreground/10 flex items-center justify-center">
                  <MessageCircle className="size-5 text-foreground" />
                </div>
                <span className="text-xs font-medium text-foreground">发消息</span>
              </button>

              <button
                onClick={() => {
                  onCall()
                  onClose()
                }}
                className="flex flex-col items-center gap-2 py-4 rounded-xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors"
              >
                <div className="size-11 rounded-full bg-success/10 flex items-center justify-center">
                  <Phone className="size-5 text-success" />
                </div>
                <span className="text-xs font-medium text-foreground">打电话</span>
              </button>
            </div>

            {/* 取消 */}
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-muted/30 text-sm text-foreground font-medium active:bg-muted/60 transition-colors"
              >
                取消
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
