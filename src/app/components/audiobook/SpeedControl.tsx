/**
 * SpeedControl — playback rate selector for the audiobook player.
 *
 * Renders a trigger button showing the current speed (e.g. "1.5×") and a
 * Popover with 11 speed options (0.5× to 3.0× in 0.25 increments, via VALID_SPEEDS).
 * Selecting a speed:
 *  - Updates `useAudioPlayerStore.playbackRate`
 *  - The useAudioPlayer hook syncs it to `audio.playbackRate` + `audio.preservesPitch`
 *
 * Options are native `<button type="button">` rows (same pattern as `SleepTimer`)
 * so taps register reliably on mobile WebKit inside portaled popovers.
 *
 * @module SpeedControl
 * @since E87-S03, updated E112-S01
 */
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useBookStore } from '@/stores/useBookStore'
import { VALID_SPEEDS } from '@/stores/useAudiobookPrefsStore'

function formatSpeed(rate: number): string {
  return `${rate % 1 === 0 ? rate.toFixed(1) : rate}×`
}

interface SpeedControlProps {
  bookId: string
}

export function SpeedControl({ bookId }: SpeedControlProps) {
  const [open, setOpen] = useState(false)
  const { playbackRate, setPlaybackRate } = useAudioPlayerStore()

  const handleSelect = (rate: number) => {
    setPlaybackRate(rate)
    useBookStore.getState().updateBookPlaybackSpeed(bookId, rate)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] min-w-10 px-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:min-w-[44px] sm:px-3"
          aria-label={`Playback speed: ${formatSpeed(playbackRate)}`}
          data-testid="speed-button"
        >
          {formatSpeed(playbackRate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[130] w-36 p-1" align="center">
        <ul role="listbox" aria-label="Playback speed">
          {VALID_SPEEDS.map(rate => {
            const isActive = rate === playbackRate
            return (
              <li key={rate} role="presentation" className="list-none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(rate)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive ? 'text-brand font-medium' : 'text-foreground'
                  )}
                  data-testid={`speed-option-${rate}`}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span>{formatSpeed(rate)}</span>
                    {rate === 1.0 && (
                      <span
                        className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium"
                        data-testid="speed-default-label"
                      >
                        Default
                      </span>
                    )}
                  </span>
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
