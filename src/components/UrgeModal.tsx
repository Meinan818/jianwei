import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface UrgeModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  cooldownLeft: number // 剩余冷却秒数，> 0 表示在冷却中
}

const URGE_REASONS = [
  '等太久了，能不能快点',
  '还有多久能送到？',
  '餐品还没开始做吗？',
  '骑手怎么还没取餐？',
  '其他原因',
]

export default function UrgeModal({ open, onClose, onConfirm, cooldownLeft }: UrgeModalProps) {
  const [selected, setSelected] = useState<string>(URGE_REASONS[0])
  const isCooling = cooldownLeft > 0

  const handleConfirm = () => {
    if (isCooling) return
    onConfirm(selected)
    setSelected(URGE_REASONS[0])
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm bg-card rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-base font-semibold text-foreground">催单</h3>
              <button
                onClick={onClose}
                className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {isCooling ? (
              <div className="px-4 pb-5 pt-2 text-center">
                <p className="text-sm text-muted-foreground">
                  已提醒商家，请耐心等待
                </p>
                <p className="text-2xl font-bold text-foreground mt-3 tabular-nums">
                  {Math.floor(cooldownLeft / 60)}:{(cooldownLeft % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  后可再次催单
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 pb-2">
                  <p className="text-xs text-muted-foreground mb-2">选择催单原因（可选）</p>
                  <div className="space-y-2">
                    {URGE_REASONS.map(reason => (
                      <button
                        key={reason}
                        onClick={() => setSelected(reason)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          selected === reason
                            ? 'bg-foreground/10 text-foreground border border-foreground/20'
                            : 'bg-muted/50 text-foreground/80 border border-transparent hover:bg-muted'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 pt-2">
                  <button
                    onClick={handleConfirm}
                    className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    提醒商家
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
