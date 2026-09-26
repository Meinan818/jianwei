import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus } from 'lucide-react'
import { Image } from '@/components/ui/image'
import { Button } from '@/components/ui/button'
import type { IDishSpec, IDishExtra } from '@/data/shops'
import type { ICartItemSpec, ICartItemExtra } from '@/data/cart'
import { cn } from '@/lib/utils'

interface DishSpecSheetProps {
  open: boolean
  onClose: () => void
  dish: {
    id: string
    name: string
    description: string
    basePrice: number
    image: string
    specs?: IDishSpec[]
    extras?: IDishExtra[]
  }
  onConfirm: (params: {
    specs: ICartItemSpec[]
    extras: ICartItemExtra[]
    quantity: number
    finalPrice: number
  }) => void
}

export default function DishSpecSheet({ open, onClose, dish, onConfirm }: DishSpecSheetProps) {
  // 规格默认选第一个选项
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    dish.specs?.forEach(s => {
      if (s.options.length > 0) init[s.id] = s.options[0].id
    })
    return init
  })
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())
  const [quantity, setQuantity] = useState(1)

  const finalPrice = useMemo(() => {
    let price = dish.basePrice
    // 规格加价
    dish.specs?.forEach(spec => {
      const optId = selectedSpecs[spec.id]
      const opt = spec.options.find(o => o.id === optId)
      if (opt?.priceDelta) price += opt.priceDelta
    })
    // 加料加价
    dish.extras?.forEach(extra => {
      if (selectedExtras.has(extra.id)) price += extra.price
    })
    return price
  }, [dish, selectedSpecs, selectedExtras])

  const handleConfirm = () => {
    const specs: ICartItemSpec[] = (dish.specs || []).map(spec => {
      const optId = selectedSpecs[spec.id]
      const opt = spec.options.find(o => o.id === optId) || spec.options[0]
      return {
        specId: spec.id,
        specName: spec.name,
        optionId: opt.id,
        optionLabel: opt.label,
        priceDelta: opt.priceDelta || 0,
      }
    })
    const extras: ICartItemExtra[] = (dish.extras || [])
      .filter(e => selectedExtras.has(e.id))
      .map(e => ({ extraId: e.id, name: e.name, price: e.price }))

    onConfirm({ specs, extras, quantity, finalPrice })
    // 重置状态
    setQuantity(1)
    setSelectedExtras(new Set())
  }

  const toggleExtra = (id: string) => {
    setSelectedExtras(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const noSpecs = (!dish.specs || dish.specs.length === 0) && (!dish.extras || dish.extras.length === 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-50 bg-card rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col mx-auto max-w-md"
          >
            {/* 顶部菜品信息 */}
            <div className="relative px-4 pt-4 pb-3">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 size-7 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground z-10"
              >
                <X className="size-4" />
              </button>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  {dish.image ? (
                    <Image src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                      <Plus className="size-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-base font-semibold text-foreground">{dish.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{dish.description}</p>
                  <div className="mt-2 text-xl font-bold text-foreground">
                    ¥<span className="tabular-nums">{finalPrice.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            {noSpecs ? (
              <div className="flex-1 px-4 py-6 text-center text-sm text-muted-foreground">
                该菜品暂无规格选项
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
                {/* 规格组（单选） */}
                {dish.specs?.map(spec => (
                  <div key={spec.id}>
                    <div className="text-sm font-medium text-foreground mb-2">{spec.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {spec.options.map(opt => {
                        const active = selectedSpecs[spec.id] === opt.id
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setSelectedSpecs(prev => ({ ...prev, [spec.id]: opt.id }))}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs border transition-colors',
                              active
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-muted/50 text-foreground border-border/50',
                            )}
                          >
                            {opt.label}
                            {opt.priceDelta ? <span className="ml-1 opacity-80">+¥{opt.priceDelta}</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* 加料（多选） */}
                {dish.extras && dish.extras.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-foreground mb-2">加料</div>
                    <div className="flex flex-wrap gap-2">
                      {dish.extras.map(extra => {
                        const active = selectedExtras.has(extra.id)
                        return (
                          <button
                            key={extra.id}
                            onClick={() => toggleExtra(extra.id)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs border transition-colors',
                              active
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-muted/50 text-foreground border-border/50',
                            )}
                          >
                            {active ? '✓ ' : ''}{extra.name}
                            <span className="ml-1 opacity-80">+¥{extra.price}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 底部操作 */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-card">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">数量</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="size-7 rounded-full border border-foreground flex items-center justify-center text-foreground"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="text-sm font-medium min-w-[24px] text-center tabular-nums">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="size-7 rounded-full bg-foreground flex items-center justify-center text-background"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              <Button
                onClick={handleConfirm}
                size="sm"
                className="h-9 px-5 rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                加入购物车 · ¥{(finalPrice * quantity).toFixed(1)}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
