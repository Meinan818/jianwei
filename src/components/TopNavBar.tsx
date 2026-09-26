import { usePageBack } from '@/hooks/useNavigationStack'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

interface TopNavBarProps {
  title: string
  onBack?: () => void
  rightContent?: React.ReactNode
}

export default function TopNavBar({ title, onBack, rightContent }: TopNavBarProps) {
  const pageBack = usePageBack()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      pageBack()
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 flex items-center h-12 px-4 bg-background/85 backdrop-blur-xl border-b border-border/40"
    >
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleBack}
        className="flex items-center justify-center w-8 h-8 -ml-2 rounded-full text-foreground active:bg-muted"
        aria-label="返回"
      >
        <ChevronLeft className="size-5" />
      </motion.button>
      <h1 className="flex-1 text-center text-base font-semibold text-foreground truncate">
        {title}
      </h1>
      <div className="flex items-center w-8 justify-end">
        {rightContent}
      </div>
    </motion.header>
  )
}