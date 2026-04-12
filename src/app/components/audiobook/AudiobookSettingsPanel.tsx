/**
 * AudiobookSettingsPanel — slide-in sheet for configuring global audiobook preferences.
 *
 * Settings: default speed, skip silence, default sleep timer, auto-bookmark on stop.
 * All preferences are persisted to localStorage via useAudiobookPrefsStore.
 *
 * @module AudiobookSettingsPanel
 * @since E108-S04
 */
import { Check } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/app/components/ui/sheet'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { Separator } from '@/app/components/ui/separator'
import {
  useAudiobookPrefsStore,
  VALID_SPEEDS,
  type SleepTimerDefault,
} from '@/stores/useAudiobookPrefsStore'

interface AudiobookSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Use the canonical speed list from the store to keep UI and validation in sync */
const SPEED_OPTIONS = VALID_SPEEDS

const SLEEP_TIMER_OPTIONS: { value: SleepTimerDefault; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 'end-of-chapter', label: 'End of chapter' },
]

function formatSpeed(rate: number): string {
  return `${Number.isInteger(rate) ? rate.toFixed(1) : rate}x`
}

export function AudiobookSettingsPanel({ open, onOpenChange }: AudiobookSettingsPanelProps) {
  const {
    defaultSpeed,
    skipSilence,
    defaultSleepTimer,
    autoBookmarkOnStop,
    setDefaultSpeed,
    toggleSkipSilence,
    setDefaultSleepTimer,
    toggleAutoBookmark,
  } = useAudiobookPrefsStore()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-label="Audiobook settings">
        <SheetHeader>
          <SheetTitle>Audiobook Settings</SheetTitle>
          <SheetDescription>
            Configure default playback preferences for all audiobooks.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4 overflow-y-auto">
          {/* Playback section */}
          <section aria-labelledby="settings-playback">
            <h3
              id="settings-playback"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
            >
              Playback
            </h3>

            {/* Default speed */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Speed</Label>
              <p className="text-xs text-muted-foreground">
                Applied to new audiobook sessions (per-book overrides are preserved).
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                role="radiogroup"
                aria-label="Default playback speed"
              >
                {SPEED_OPTIONS.map(rate => {
                  const isActive = rate === defaultSpeed
                  return (
                    <button
                      key={rate}
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setDefaultSpeed(rate)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                        isActive
                          ? 'bg-brand text-brand-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      }`}
                      data-testid={`speed-preset-${rate}`}
                    >
                      {formatSpeed(rate)}
                      {isActive && <Check className="size-3.5" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <Label htmlFor="skip-silence" className="text-sm font-medium">
                  Skip Silence
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically skip silent sections during playback.
                </p>
              </div>
              <Switch
                id="skip-silence"
                checked={skipSilence}
                onCheckedChange={toggleSkipSilence}
                aria-label="Toggle skip silence"
                data-testid="skip-silence-toggle"
              />
            </div>
          </section>

          <Separator />

          {/* Sleep Timer section */}
          <section aria-labelledby="settings-sleep-timer">
            <h3
              id="settings-sleep-timer"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
            >
              Sleep Timer
            </h3>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Sleep Timer</Label>
              <p className="text-xs text-muted-foreground">
                Automatically start a sleep timer when you begin listening.
              </p>
              <div
                className="flex flex-col gap-1"
                role="radiogroup"
                aria-label="Default sleep timer duration"
              >
                {SLEEP_TIMER_OPTIONS.map(opt => {
                  const isActive = opt.value === defaultSleepTimer
                  return (
                    <button
                      key={String(opt.value)}
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setDefaultSleepTimer(opt.value)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-brand-soft text-brand-soft-foreground font-medium'
                          : 'text-foreground hover:bg-muted/60'
                      }`}
                      data-testid={`sleep-timer-${opt.value}`}
                    >
                      <span>{opt.label}</span>
                      {isActive && <Check className="size-4" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <Separator />

          {/* Bookmarks section */}
          <section aria-labelledby="settings-bookmarks">
            <h3
              id="settings-bookmarks"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
            >
              Bookmarks
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-bookmark" className="text-sm font-medium">
                  Auto-Bookmark on Stop
                </Label>
                <p className="text-xs text-muted-foreground">
                  Create a bookmark at the current position when playback stops.
                </p>
              </div>
              <Switch
                id="auto-bookmark"
                checked={autoBookmarkOnStop}
                onCheckedChange={toggleAutoBookmark}
                aria-label="Toggle auto-bookmark on stop"
                data-testid="auto-bookmark-toggle"
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
