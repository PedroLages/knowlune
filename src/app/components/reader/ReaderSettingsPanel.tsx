/**
 * ReaderSettingsPanel — reading appearance controls for the EPUB reader.
 *
 * Renders as a Sheet from the bottom (mobile-first, works on all screen sizes).
 * Contains:
 * - Theme selector: Light / Sepia / Dark radio pill cards
 * - Font size: Slider (80–200%, step 10) with A- / A+ buttons
 * - Font family: Select (System / Serif / Sans / Mono)
 * - Line height: Select (Compact / Normal / Relaxed / Spacious)
 *
 * All settings are immediately applied to the EPUB rendition via useReaderStore.
 * State is persisted to localStorage automatically by the store.
 *
 * @module ReaderSettingsPanel
 */
import { Sun, Moon, BookOpen } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/app/components/ui/utils'
import { useReaderStore } from '@/stores/useReaderStore'
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore'
import { getReaderChromeClasses, useAppColorScheme } from './readerThemeConfig'

interface ReaderSettingsPanelProps {
  open: boolean
  onClose: () => void
}

// Theme metadata (icons/labels) — colors resolved dynamically from shared config
const THEME_META: { id: ReaderTheme; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Sun className="size-3.5" aria-hidden="true" /> },
  { id: 'sepia', label: 'Sepia', icon: <BookOpen className="size-3.5" aria-hidden="true" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="size-3.5" aria-hidden="true" /> },
]

const FONT_FAMILIES: { value: ReaderFontFamily; label: string }[] = [
  { value: 'default', label: 'System' },
  { value: 'serif', label: 'Serif (Georgia)' },
  { value: 'sans', label: 'Sans (Inter)' },
  { value: 'mono', label: 'Mono (Courier)' },
]

const LINE_HEIGHTS: { value: number; label: string }[] = [
  { value: 1.2, label: 'Compact (1.2)' },
  { value: 1.5, label: 'Snug (1.5)' },
  { value: 1.6, label: 'Normal (1.6)' },
  { value: 1.8, label: 'Relaxed (1.8)' },
  { value: 2.0, label: 'Spacious (2.0)' },
]

const FONT_SIZE_MIN = 80
const FONT_SIZE_MAX = 200
const FONT_SIZE_STEP = 10

export function ReaderSettingsPanel({ open, onClose }: ReaderSettingsPanelProps) {
  const colorScheme = useAppColorScheme()
  const theme = useReaderStore(s => s.theme)
  const setTheme = useReaderStore(s => s.setTheme)
  const fontSize = useReaderStore(s => s.fontSize)
  const setFontSize = useReaderStore(s => s.setFontSize)
  const fontFamily = useReaderStore(s => s.fontFamily)
  const setFontFamily = useReaderStore(s => s.setFontFamily)
  const lineHeight = useReaderStore(s => s.lineHeight)
  const setLineHeight = useReaderStore(s => s.setLineHeight)
  const letterSpacing = useReaderStore(s => s.letterSpacing)
  const setLetterSpacing = useReaderStore(s => s.setLetterSpacing)
  const wordSpacing = useReaderStore(s => s.wordSpacing)
  const setWordSpacing = useReaderStore(s => s.setWordSpacing)
  const readingRulerEnabled = useReaderStore(s => s.readingRulerEnabled)
  const setReadingRulerEnabled = useReaderStore(s => s.setReadingRulerEnabled)
  const scrollMode = useReaderStore(s => s.scrollMode)
  const setScrollMode = useReaderStore(s => s.setScrollMode)
  const resetSettings = useReaderStore(s => s.resetSettings)

  const handleDecrease = () => {
    setFontSize(fontSize - FONT_SIZE_STEP)
  }

  const handleIncrease = () => {
    setFontSize(fontSize + FONT_SIZE_STEP)
  }

  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] rounded-t-2xl px-4 pb-6 pt-0 overflow-y-auto"
        data-testid="reader-settings-panel"
      >
        <SheetHeader className="py-4 border-b border-border/50 mb-4">
          <SheetTitle className="text-base font-semibold text-center">Reading Settings</SheetTitle>
        </SheetHeader>

        {/* Theme Selector */}
        <section aria-labelledby="theme-label" className="mb-6">
          <p
            id="theme-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Theme
          </p>
          <div role="radiogroup" aria-label="Reading theme" className="grid grid-cols-3 gap-2">
            {THEME_META.map(t => {
              const classes = getReaderChromeClasses(t.id, colorScheme)
              return (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  data-testid={`theme-${t.id}`}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    classes.bg,
                    classes.text,
                    theme === t.id
                      ? 'border-brand shadow-sm'
                      : 'border-border/30 hover:border-border'
                  )}
                >
                  {t.icon}
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Font Size */}
        <section aria-labelledby="font-size-label" className="mb-6">
          <p
            id="font-size-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Font Size — {fontSize}%
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleDecrease}
              disabled={fontSize <= FONT_SIZE_MIN}
              aria-label="Decrease font size"
              className="size-9 min-h-[44px] min-w-[44px] shrink-0 text-muted-foreground font-bold text-base"
              data-testid="font-size-decrease"
            >
              A-
            </Button>
            <Slider
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={FONT_SIZE_STEP}
              value={[fontSize]}
              onValueChange={([val]) => setFontSize(val)}
              className="flex-1"
              aria-label="Font size"
              aria-valuemin={FONT_SIZE_MIN}
              aria-valuemax={FONT_SIZE_MAX}
              aria-valuenow={fontSize}
              data-testid="font-size-slider"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleIncrease}
              disabled={fontSize >= FONT_SIZE_MAX}
              aria-label="Increase font size"
              className="size-9 min-h-[44px] min-w-[44px] shrink-0 text-muted-foreground font-bold text-base"
              data-testid="font-size-increase"
            >
              A+
            </Button>
          </div>
        </section>

        {/* Font Family */}
        <section aria-labelledby="font-family-label" className="mb-6">
          <p
            id="font-family-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Font Family
          </p>
          <Select value={fontFamily} onValueChange={val => setFontFamily(val as ReaderFontFamily)}>
            <SelectTrigger
              className="w-full"
              aria-label="Font family"
              data-testid="font-family-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map(f => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Line Height */}
        <section aria-labelledby="line-height-label" className="mb-6">
          <p
            id="line-height-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Line Height
          </p>
          <Select value={String(lineHeight)} onValueChange={val => setLineHeight(Number(val))}>
            <SelectTrigger
              className="w-full"
              aria-label="Line height"
              data-testid="line-height-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_HEIGHTS.map(lh => (
                <SelectItem key={lh.value} value={String(lh.value)}>
                  {lh.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Letter Spacing */}
        <section aria-labelledby="letter-spacing-label" className="mb-6">
          <p
            id="letter-spacing-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Letter Spacing — {letterSpacing.toFixed(2)}em
          </p>
          <Slider
            min={0}
            max={0.3}
            step={0.02}
            value={[letterSpacing]}
            onValueChange={([val]) => setLetterSpacing(val)}
            className="w-full"
            aria-label="Letter spacing"
            aria-valuemin={0}
            aria-valuemax={0.3}
            aria-valuenow={letterSpacing}
            data-testid="letter-spacing-slider"
          />
        </section>

        {/* Word Spacing */}
        <section aria-labelledby="word-spacing-label" className="mb-6">
          <p
            id="word-spacing-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Word Spacing — {wordSpacing.toFixed(2)}em
          </p>
          <Slider
            min={0}
            max={0.5}
            step={0.02}
            value={[wordSpacing]}
            onValueChange={([val]) => setWordSpacing(val)}
            className="w-full"
            aria-label="Word spacing"
            aria-valuemin={0}
            aria-valuemax={0.5}
            aria-valuenow={wordSpacing}
            data-testid="word-spacing-slider"
          />
        </section>

        {/* Reading Ruler */}
        <section aria-labelledby="reading-ruler-label" className="mb-6">
          <div className="flex items-center justify-between">
            <Label
              id="reading-ruler-label"
              htmlFor="reading-ruler-switch"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Reading Ruler
            </Label>
            <Switch
              id="reading-ruler-switch"
              checked={readingRulerEnabled}
              onCheckedChange={setReadingRulerEnabled}
              aria-label="Toggle reading ruler"
              data-testid="reading-ruler-switch"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            A guide line that follows your cursor to help track reading position
          </p>
        </section>

        {/* Continuous Scroll Mode (E114-S02) */}
        <section aria-labelledby="scroll-mode-label" className="mb-6">
          <div className="flex items-center justify-between">
            <Label
              id="scroll-mode-label"
              htmlFor="scroll-mode-switch"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Continuous Scroll
            </Label>
            <Switch
              id="scroll-mode-switch"
              checked={scrollMode}
              onCheckedChange={setScrollMode}
              aria-label="Toggle continuous scroll mode"
              data-testid="scroll-mode-switch"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scroll through content continuously instead of turning pages
          </p>
        </section>

        {/* Reset */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSettings}
            className="text-muted-foreground text-xs"
            data-testid="reader-settings-reset"
          >
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
