import { motion } from 'framer-motion'

export function ShopCardSkeleton() {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border/60">
      <motion.div
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="w-full aspect-[16/9] bg-muted"
      />
      <div className="p-3 space-y-2">
        <div className="h-4 w-2/3 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    </div>
  )
}

export function DishSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <motion.div
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="size-20 bg-muted rounded-lg shrink-0"
      />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-1/3 bg-muted rounded" />
      </div>
    </div>
  )
}