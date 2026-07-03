import { Unlock, Lock } from 'lucide-react'
import { Switch } from '@/app/components/ui/switch'
import type { PathProgressionMode } from '@/data/types'

interface ProgressionModeToggleProps {
  mode: PathProgressionMode
  onChange: (mode: PathProgressionMode) => void
  disabled?: boolean
}

export function ProgressionModeToggle({ mode, onChange, disabled }: ProgressionModeToggleProps) {
  const isFree = mode === 'free'

  return (
    <div className="flex items-center gap-2.5">
      {isFree ? (
        <Unlock className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
      ) : (
        <Lock className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <label
          htmlFor="progression-mode-toggle"
          className="text-sm font-medium text-foreground cursor-pointer"
        >
          {isFree ? 'Free navigation' : 'Sequential mode'}
        </label>
        <p
          id="progression-mode-description"
          className="text-xs text-muted-foreground"
        >
          {isFree
            ? 'Start any course without completing previous ones.'
            : 'Complete each course to unlock the next one.'}
        </p>
      </div>
      <Switch
        id="progression-mode-toggle"
        checked={isFree}
        onCheckedChange={checked => onChange(checked ? 'free' : 'sequential')}
        disabled={disabled}
        aria-label={`Enable ${isFree ? 'sequential' : 'free navigation'} mode`}
        aria-describedby="progression-mode-description"
      />
    </div>
  )
}
