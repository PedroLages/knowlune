import { forwardRef } from 'react'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import type { CompletionStatus } from '@/data/types'

interface StatusIndicatorProps {
  status: CompletionStatus
  itemId: string
  onClick?: (e: React.MouseEvent) => void
  /** "interactive" renders a clickable button. "display" renders a non-interactive span with tooltip. */
  mode?: 'interactive' | 'display'
}

const statusConfig: Record<CompletionStatus, { label: string; className: string }> = {
  'not-started': {
    label: 'Not Started',
    className: 'text-muted-foreground/60',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'text-blue-600',
  },
  completed: {
    label: 'Completed',
    className: 'text-green-600',
  },
}

export const StatusIndicator = forwardRef<
  HTMLButtonElement | HTMLSpanElement,
  StatusIndicatorProps
>(function StatusIndicator({ status, itemId, onClick, mode = 'interactive', ...rest }, ref) {
  const config = statusConfig[status]
  const icon =
    status === 'completed' ? (
      <Check className="size-4" />
    ) : (
      <Circle className={cn('size-4', status === 'in-progress' && 'fill-current')} />
    )

  if (mode === 'display') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            ref={ref as React.Ref<HTMLSpanElement>}
            data-testid={`status-indicator-${itemId}`}
            data-status={status}
            aria-label={config.label}
            className={cn('shrink-0 rounded-full p-0.5', config.className)}
            {...rest}
          >
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      data-testid={`status-indicator-${itemId}`}
      data-status={status}
      aria-label={config.label}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center shrink-0 rounded-full min-h-11 min-w-11 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        config.className
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})
