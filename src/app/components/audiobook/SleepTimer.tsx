/**
 * SleepTimer — sleep timer selector for the audiobook player.
 *
 * Renders a Moon icon trigger button (with a remaining-time badge when active)
 * and a Popover with timer options: 15 min, 30 min, 45 min, 60 min,
 * End of chapter, and Off.
 *
 * @module SleepTimer
 * @since E87-S03
 */
import { Moon, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Button } from '@/app/components/ui/button'
import type { SleepTimerOption } from '@/app/hooks/useSleepTimer'

interface SleepTimerProps {
  activeOption: SleepTimerOption | null
  badgeText: string | null
  onSelect: (option: SleepTimerOption) => void
}

const TIMER_OPTIONS: { value: SleepTimerOption; label: string }[] = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 'end-of-chapter', label: 'End of chapter' },
  { value: 'off', label: 'Off' },
]

export function SleepTimer({ activeOption, badgeText, onSelect }: SleepTimerProps) {
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
      <PopoverContent className="w-44 p-1" align="center">
        <ul role="listbox" aria-label="Sleep timer">
          {TIMER_OPTIONS.map(opt => {
            const isActive =
              opt.value === activeOption ||
              (opt.value === 'off' && activeOption === null)
            return (
              <li key={String(opt.value)} role="option" aria-selected={isActive}>
                <button
                  onClick={() => onSelect(opt.value)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${isActive ? 'text-brand font-medium' : 'text-foreground'}`}
                >
                  <span>{opt.label}</span>
                  {isActive && <Check className="size-4 text-brand" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
