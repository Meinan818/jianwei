import { ErrorBoundary } from 'react-error-boundary'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@lark-apaas/client-toolkit-lite'

interface PageErrorBoundaryProps {
  children: React.ReactNode
  title?: string
  description?: string
}

/**
 * 页面级 ErrorBoundary —— 包在 Outlet 外层。
 * 任何子页面渲染异常都在这里兜住，显示"加载失败 + 重试按钮"，
 * 绝不允许整片空白。
 */
export default function PageErrorBoundary({ children, title, description }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={({ resetErrorBoundary }) => (
        <PageErrorFallback
          onRetry={resetErrorBoundary}
          title={title}
          description={description}
        />
      )}
      onError={(error) => {
        logger.error('PageErrorBoundary caught error:', String(error))
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

function PageErrorFallback({
  onRetry,
  title,
  description,
}: {
  onRetry: () => void
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col w-full min-h-[420px] items-center justify-center gap-3 px-8 py-16 bg-background">
      <div className="size-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {title || '加载失败'}
      </p>
      <p className="text-xs text-muted-foreground text-center">
        {description || '页面内容加载异常，点击重试可恢复正常'}
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        className="mt-2 gap-1.5"
      >
        <RefreshCw className="size-3.5" />
        点击重试
      </Button>
    </div>
  )
}
