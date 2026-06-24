import { Unlock } from 'lucide-react'
import { Switch } from '@/app/components/ui/switch'
import type { PathProgressionMode } from '@/data/types'

interface ProgressionModeToggleProps {
  mode: PathProgressionMode
  onChange: (mode: PathProgressionMode) => void
  disabled?: boolean
}

export function ProgressionModeToggle({ mode, onChange, disabled }: ProgressionModeToggleProps) {
  return (
    <div className="flex items-center gap-2.5">
      <Unlock className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <label
          htmlFor="progression-mode-toggle"
          className="text-sm font-medium text-foreground cursor-pointer"
        >
          Free access
        </label>
        <p
          id="progression-mode-description"
          className="text-xs text-muted-foreground"
        >
          Start any course without completing previous ones
        </p>
      </div>
      <Switch
        id="progression-mode-toggle"
        checked={mode === 'free'}
        onCheckedChange={checked => onChange(checked ? 'free' : 'sequential')}
        disabled={disabled}
        aria-label="Enable free access mode"
        aria-describedby="progression-mode-description"
      />
    </div>
  )
}
