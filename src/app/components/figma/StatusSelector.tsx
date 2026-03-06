import { Circle, Check } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import type { CompletionStatus } from '@/data/types'

interface StatusSelectorProps {
  currentStatus: CompletionStatus
  onSelect: (status: CompletionStatus) => void
}

const options: {
  status: CompletionStatus
  label: string
  icon: React.ReactNode
  className: string
}[] = [
  {
    status: 'not-started',
    label: 'Not Started',
    icon: <Circle className="size-4" />,
    className: 'text-muted-foreground/60',
  },
  {
    status: 'in-progress',
    label: 'In Progress',
    icon: <Circle className="size-4 fill-current" />,
    className: 'text-blue-600',
  },
  {
    status: 'completed',
    label: 'Completed',
    icon: <Check className="size-4" />,
    className: 'text-green-600',
  },
]

export function StatusSelector({ currentStatus, onSelect }: StatusSelectorProps) {
  return (
    <div data-testid="status-selector" className="flex flex-col gap-1 min-w-[140px]">
      {options.map(opt => (
        <button
          key={opt.status}
          type="button"
          onClick={() => onSelect(opt.status)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-3 text-sm transition-colors hover:bg-accent',
            currentStatus === opt.status && 'bg-accent font-medium'
          )}
        >
          <span className={opt.className}>{opt.icon}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
