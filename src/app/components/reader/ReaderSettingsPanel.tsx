/**
 * ReaderSettingsPanel — reading appearance controls for the EPUB reader.
 *
 * Renders as a Sheet from the bottom (mobile-first, works on all screen sizes).
 * Contains:
 * - Page tone: White / Sepia / Gray / Dark / Black swatches
 * - Font size: Slider (80–200%, step 10) with A- / A+ buttons
 * - Font family: Select with live type preview and short descriptions
 * - Line height: Select (Compact / Normal / Relaxed / Spacious)
 *
 * App-wide color scheme (Professional / Vibrant / Clean) is configured in global Settings only.
 * All settings are immediately applied to the EPUB rendition via useReaderStore.
 * State is persisted to localStorage automatically by the store.
 *
 * @module ReaderSettingsPanel
 */
import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { cn } from '@/app/components/ui/utils'
import { useReaderStore } from '@/stores/useReaderStore'
import type { ReaderFontFamily, ReaderTheme } from '@/stores/useReaderStore'
import { getReaderFontOption, READER_FONT_OPTIONS } from './readerFontOptions'

interface ReaderSettingsPanelProps {
  open: boolean
  onClose: () => void
}

const PAGE_TONES: {
  id: ReaderTheme
  label: string
  bg: string
  border: string
}[] = [
  { id: 'white', label: 'White', bg: 'bg-[#ffffff]', border: 'border-[#d4d4d4]' },
  { id: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]', border: 'border-[#e0d5b8]' },
  { id: 'gray', label: 'Gray', bg: 'bg-[#e5e5e5]', border: 'border-[#cccccc]' },
  { id: 'dark', label: 'Dark', bg: 'bg-[#383a56]', border: 'border-[#4e5070]' },
  { id: 'black', label: 'Black', bg: 'bg-[#000000]', border: 'border-[#000000]' },
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
  const [isMd, setIsMd] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
  const dualPage = useReaderStore(s => s.dualPage)
  const setDualPage = useReaderStore(s => s.setDualPage)
  const showPageNumbers = useReaderStore(s => s.showPageNumbers)
  const setShowPageNumbers = useReaderStore(s => s.setShowPageNumbers)
  const showProgressBar = useReaderStore(s => s.showProgressBar)
  const setShowProgressBar = useReaderStore(s => s.setShowProgressBar)

  const selectedFontOption = getReaderFontOption(fontFamily) ?? READER_FONT_OPTIONS[0]

  const handleDecrease = () => {
    setFontSize(fontSize - FONT_SIZE_STEP)
  }

  const handleIncrease = () => {
    setFontSize(fontSize + FONT_SIZE_STEP)
  }

  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        overlayClassName="z-[130]"
        className={cn(
          'z-[130] overflow-y-auto px-4 pb-6 pt-0',
          isMd ? 'w-80 sm:max-w-80' : 'max-h-[85vh] rounded-t-2xl'
        )}
        data-testid="reader-settings-panel"
      >
        <SheetHeader className="py-4 border-b border-border/50 mb-4">
          <SheetTitle className="text-base font-semibold text-center">Reading Settings</SheetTitle>
          <SheetDescription className="sr-only">
            Adjust reader colors, typography, spacing, and page display preferences.
          </SheetDescription>
        </SheetHeader>

        {/* Page Tone Selector */}
        <section aria-labelledby="theme-label" className="mb-6">
          <p
            id="theme-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Page Tone
          </p>
          <div role="radiogroup" aria-label="Reading theme" className="flex flex-wrap gap-5">
            {PAGE_TONES.map(t => {
              const isSelected = theme === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setTheme(t.id)}
                  data-testid={`theme-${t.id}`}
                  className={cn(
                    'group flex cursor-pointer flex-col items-center gap-2',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  )}
                >
                  <span
                    className={cn(
                      'size-14 rounded-full border-2 transition-all',
                      t.bg,
                      isSelected
                        ? 'border-brand ring-2 ring-brand/10'
                        : `${t.border} group-hover:border-brand/50`
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
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

        {/* Font family — Select with preview + description; stacks match EPUB via readerFontOptions */}
        <section aria-labelledby="font-family-label" className="mb-6">
          <p
            id="font-family-label"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3"
          >
            Font family
          </p>
          <Select
            value={fontFamily}
            onValueChange={val => setFontFamily(val as ReaderFontFamily)}
          >
            <SelectTrigger
              className="h-11 w-full min-w-0 cursor-pointer rounded-xl *:data-[slot=select-value]:sr-only"
              aria-labelledby="font-family-label"
              data-testid="font-family-select"
            >
              <span
                className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                style={{ fontFamily: selectedFontOption.previewFontFamily }}
                aria-hidden
              >
                {selectedFontOption.label}
              </span>
              <SelectValue placeholder="Choose a font" />
            </SelectTrigger>
            <SelectContent className="z-[200]">
              {READER_FONT_OPTIONS.map(opt => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  textValue={opt.label}
                  className="cursor-pointer items-start py-2"
                  data-testid={`font-family-option-${opt.value}`}
                >
                  <span className="flex w-full min-w-0 max-w-[min(100%,20rem)] flex-col gap-0.5 pr-1 text-left">
                    <span
                      className="truncate text-sm font-medium leading-tight"
                      style={{ fontFamily: opt.previewFontFamily }}
                    >
                      {opt.label}
                    </span>
                    <span className="line-clamp-2 text-left text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </span>
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
              className="h-11 w-full cursor-pointer rounded-xl"
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

        {/* Two-Page Spread */}
        <section aria-labelledby="dual-page-label" className="mb-6">
          <div className="flex items-center justify-between">
            <Label
              id="dual-page-label"
              htmlFor="dual-page-switch"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Two-Page Spread
            </Label>
            <Switch
              id="dual-page-switch"
              checked={dualPage}
              onCheckedChange={setDualPage}
              disabled={scrollMode}
              aria-label="Toggle two-page spread layout"
              data-testid="dual-page-switch"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {scrollMode
              ? 'Not available in continuous scroll mode'
              : 'Show two pages side by side on wider screens'}
          </p>
        </section>

        {/* Page Numbers */}
        <section aria-labelledby="show-page-numbers-label" className="mb-6">
          <div className="flex items-center justify-between">
            <Label
              id="show-page-numbers-label"
              htmlFor="show-page-numbers-switch"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Page Numbers
            </Label>
            <Switch
              id="show-page-numbers-switch"
              checked={showPageNumbers}
              onCheckedChange={setShowPageNumbers}
              aria-label="Toggle page numbers in footer"
              data-testid="show-page-numbers-switch"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Show page indicator at the bottom of the reader
          </p>
        </section>

        {/* Progress Bar */}
        <section aria-labelledby="show-progress-bar-label" className="mb-6">
          <div className="flex items-center justify-between">
            <Label
              id="show-progress-bar-label"
              htmlFor="show-progress-bar-switch"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Progress Bar
            </Label>
            <Switch
              id="show-progress-bar-switch"
              checked={showProgressBar}
              onCheckedChange={setShowProgressBar}
              aria-label="Toggle progress bar in footer"
              data-testid="show-progress-bar-switch"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Show reading progress bar at the bottom of the reader
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
