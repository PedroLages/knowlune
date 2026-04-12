/**
 * SleepTimer — sleep timer selector for the audiobook player.
 *
 * Renders a Moon icon trigger button (with a remaining-time badge when active)
 * and a Popover with timer options: 15 min, 30 min, 45 min, 60 min,
 * Custom, End of chapter, and Off.
 *
 * @module SleepTimer
 * @since E87-S03
 */
import { useState, useRef } from 'react'
import { Moon, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Button } from '@/app/components/ui/button'
import type { SleepTimerOption } from '@/app/hooks/useSleepTimer'

interface SleepTimerProps {
  activeOption: SleepTimerOption | null
  badgeText: string | null
  onSelect: (option: SleepTimerOption) => void
}

const PRESET_OPTIONS: { value: SleepTimerOption; label: string }[] = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
]

const SUFFIX_OPTIONS: { value: SleepTimerOption; label: string }[] = [
  { value: 'end-of-chapter', label: 'End of chapter' },
  { value: 'off', label: 'Off' },
]

export function SleepTimer({ activeOption, badgeText, onSelect }: SleepTimerProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const customInputRef = useRef<HTMLInputElement>(null)

  const isCustomActive =
    typeof activeOption === 'number' && ![15, 30, 45, 60].includes(activeOption)

  const handleCustomSubmit = () => {
    const minutes = parseInt(customValue, 10)
    if (!minutes || minutes < 1) return
    const capped = Math.min(minutes, 999)
    onSelect(capped)
    setShowCustom(false)
    setCustomValue('')
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCustomSubmit()
    if (e.key === 'Escape') {
      setShowCustom(false)
      setCustomValue('')
    }
  }

  const renderOption = (opt: { value: SleepTimerOption; label: string }) => {
    const isActive =
      opt.value === activeOption || (opt.value === 'off' && activeOption === null)
    return (
      <li key={String(opt.value)} role="option" aria-selected={isActive}>
        <button
          onClick={() => {
            onSelect(opt.value)
            setShowCustom(false)
          }}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${isActive ? 'text-brand font-medium' : 'text-foreground'}`}
        >
          <span>{opt.label}</span>
          {isActive && <Check className="size-4 text-brand" aria-hidden="true" />}
        </button>
      </li>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative min-h-[44px] min-w-[44px] px-3 text-muted-foreground hover:text-foreground"
          aria-label={activeOption ? `Sleep timer: ${badgeText ?? 'active'}` : 'Sleep timer'}
        >
          <Moon className="size-5" aria-hidden="true" />
          {badgeText && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground tabular-nums"
              aria-hidden="true"
            >
              {badgeText}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="center">
        <ul role="listbox" aria-label="Sleep timer">
          {PRESET_OPTIONS.map(renderOption)}

          {/* Custom option */}
          <li role="option" aria-selected={isCustomActive}>
            {showCustom ? (
              <div className="flex items-center gap-1.5 px-3 py-2">
                <input
                  ref={customInputRef}
                  type="number"
                  min={1}
                  max={999}
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  onKeyDown={handleCustomKeyDown}
                  placeholder="min"
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground tabular-nums placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                  aria-label="Custom minutes"
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">min</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium"
                  onClick={handleCustomSubmit}
                >
                  Set
                </Button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowCustom(true)
                  setCustomValue('')
                  setTimeout(() => customInputRef.current?.focus(), 50)
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${isCustomActive ? 'text-brand font-medium' : 'text-foreground'}`}
              >
                <span>{isCustomActive ? `Custom (${activeOption}m)` : 'Custom'}</span>
                {isCustomActive && (
                  <Check className="size-4 text-brand" aria-hidden="true" />
                )}
              </button>
            )}
          </li>

          {SUFFIX_OPTIONS.map(renderOption)}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
