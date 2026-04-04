/**
 * ReadingFocusModesSection — Settings panel for reading mode defaults
 * and focus mode auto-activation toggles.
 *
 * @see E65-S05
 */

import { BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Separator } from '@/app/components/ui/separator'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import type {
  AppSettings,
  ReadingFontSize,
  ReadingLineHeight,
  ReadingTheme,
} from '@/lib/settings'

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

const THEME_OPTIONS: { value: ReadingTheme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'high-contrast', label: 'High Contrast' },
]

export function ReadingFocusModesSection({
  settings,
  onSettingsChange,
}: ReadingFocusModesSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <BookOpen className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display leading-none">Reading & Focus Modes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure default settings for reading and focus modes
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6" data-testid="reading-focus-modes-section">
        {/* Reading Mode Defaults */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">Reading Mode Defaults</p>

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

          {/* Theme — full width */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reading-theme" className="text-xs text-muted-foreground">
              Theme
            </Label>
            <Select
              value={settings.readingTheme ?? 'auto'}
              onValueChange={(value: string) =>
                onSettingsChange({ readingTheme: value as ReadingTheme })
              }
            >
              <SelectTrigger id="reading-theme" className="min-h-[44px] sm:max-w-[calc(50%-0.5rem)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Focus Mode Auto-Activation */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">Focus Mode</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm">Auto-activate for quizzes</p>
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm">Auto-activate for flashcards</p>
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
      </CardContent>
    </Card>
  )
}
