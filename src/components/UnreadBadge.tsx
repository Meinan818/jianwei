import { cn } from '@/lib/utils'

interface UnreadBadgeProps {
  count: number
  className?: string
}

export default function UnreadBadge({ count, className }: UnreadBadgeProps) {
  if (count <= 0) return null
  const display = count > 99 ? '99+' : String(count)
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5',
        'text-[11px] font-medium text-white',
        'bg-destructive rounded-full',
        className,
      )}
    >
      {display}
    </span>
  )
}
