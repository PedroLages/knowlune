/**
 * ReadingFocusModesSection — Settings panel for reading mode defaults
 * and focus mode auto-activation toggles.
 *
 * @see E65-S05
 */

import { cn } from '@/app/components/ui/utils'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import type { AppSettings, ReadingFontSize, ReadingLineHeight, ReadingTheme } from '@/lib/settings'

interface ReadingFocusModesSectionProps {
  settings: AppSettings
  onSettingsChange: (updates: Partial<AppSettings>) => void
}

const FONT_SIZE_OPTIONS: { value: ReadingFontSize; label: string }[] = [
  { value: '1x', label: '1x (Default)' },
  { value: '1.25x', label: '1.25x' },
  { value: '1.5x', label: '1.5x' },
  { value: '2x', label: '2x' },
]

const LINE_HEIGHT_OPTIONS: { value: ReadingLineHeight; label: string }[] = [
  { value: 1.5, label: '1.5 (Default)' },
  { value: 1.75, label: '1.75' },
  { value: 2.0, label: '2.0' },
]

const THEME_CIRCLES: { value: ReadingTheme; label: string; bg: string; border: string }[] = [
  { value: 'auto', label: 'White', bg: 'bg-[#ffffff]', border: 'border-[#d4d4d4]' },
  { value: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]', border: 'border-[#e0d5b8]' },
  { value: 'gray', label: 'Gray', bg: 'bg-[#e5e5e5]', border: 'border-[#cccccc]' },
  { value: 'dark', label: 'Dark', bg: 'bg-[#383a56]', border: 'border-[#4e5070]' },
  { value: 'high-contrast', label: 'Black', bg: 'bg-[#000000]', border: 'border-[#000000]' },
]

export function ReadingFocusModesSection({
  settings,
  onSettingsChange,
}: ReadingFocusModesSectionProps) {
  return (
    <>
      {/* Reading Mode Defaults */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Reading Mode
        </h4>
        <div
          className="bg-card rounded-xl shadow-sm overflow-hidden p-4 lg:p-6"
          data-testid="reading-focus-modes-section"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Font Size */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reading-font-size" className="text-xs text-muted-foreground">
                Font Size
              </Label>
              <Select
                value={settings.readingFontSize ?? '1x'}
                onValueChange={(value: string) =>
                  onSettingsChange({ readingFontSize: value as ReadingFontSize })
                }
              >
                <SelectTrigger id="reading-font-size" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line Height */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reading-line-height" className="text-xs text-muted-foreground">
                Line Height
              </Label>
              <Select
                value={String(settings.readingLineHeight ?? 1.5)}
                onValueChange={(value: string) =>
                  onSettingsChange({ readingLineHeight: parseFloat(value) as ReadingLineHeight })
                }
              >
                <SelectTrigger id="reading-line-height" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_HEIGHT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reading Theme Circles */}
          <div className="mt-6">
            <Label className="text-xs text-muted-foreground mb-3 block">Reading Theme</Label>
            <div
              className="flex flex-wrap gap-6"
              role="radiogroup"
              aria-label="Reading theme"
            >
              {THEME_CIRCLES.map(opt => {
                const isSelected = (settings.readingTheme ?? 'auto') === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSettingsChange({ readingTheme: opt.value })}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={cn(
                        'size-14 rounded-full border-2 transition-all',
                        opt.bg,
                        isSelected
                          ? 'border-brand ring-2 ring-brand/10'
                          : `${opt.border} group-hover:border-brand/50`
                      )}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Focus Mode Auto-Activation */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Focus Mode
        </h4>
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
            <div>
              <p className="text-sm font-medium">Auto-activate for quizzes</p>
              <p className="text-xs text-muted-foreground">
                Automatically enter focus mode when starting a quiz
              </p>
            </div>
            <Switch
              checked={settings.focusAutoQuiz ?? true}
              onCheckedChange={(checked: boolean) => onSettingsChange({ focusAutoQuiz: checked })}
              aria-label="Auto-activate focus mode for quizzes"
            />
          </div>

          <div className="h-px mx-4 bg-border/50" />

          <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
            <div>
              <p className="text-sm font-medium">Auto-activate for flashcards</p>
              <p className="text-xs text-muted-foreground">
                Automatically enter focus mode when reviewing flashcards
              </p>
            </div>
            <Switch
              checked={settings.focusAutoFlashcard ?? true}
              onCheckedChange={(checked: boolean) =>
                onSettingsChange({ focusAutoFlashcard: checked })
              }
              aria-label="Auto-activate focus mode for flashcards"
            />
          </div>
        </div>
      </section>
    </>
  )
}
