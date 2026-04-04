/**
 * ReadingToolbar — Floating toolbar for reading mode customization.
 *
 * Provides font size, line height, theme, and preset controls.
 * Auto-hides after 3s of inactivity (disabled when reduced motion is ON).
 * Settings persist to localStorage.
 *
 * @see E65-S02
 */

import { useState, useEffect, useCallback } from 'react'
import { Type, Minus, Plus, Palette, ChevronDown, MoveVertical } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { useAutoHide } from '@/hooks/useAutoHide'
import { shouldReduceMotion, getSettings } from '@/lib/settings'
import { cn } from '@/app/components/ui/utils'

// --- Types & Constants ---

const FONT_SIZE_LEVELS = [1, 1.25, 1.5, 2] as const
const LINE_HEIGHT_LEVELS = [1.5, 1.75, 2.0] as const
const THEMES = ['auto', 'sepia', 'hc'] as const
type ReadingTheme = (typeof THEMES)[number]

const THEME_LABELS: Record<ReadingTheme, string> = {
  auto: 'Auto',
  sepia: 'Sepia',
  hc: 'High Contrast',
}

interface ReadingPreset {
  label: string
  fontSize: number
  lineHeight: number
  dyslexiaFont?: boolean
}

const PRESETS: ReadingPreset[] = [
  { label: 'Compact', fontSize: 1, lineHeight: 1.5 },
  { label: 'Comfortable', fontSize: 1.25, lineHeight: 1.75 },
  { label: 'Large Print', fontSize: 1.5, lineHeight: 2.0 },
  { label: 'Dyslexia-Friendly', fontSize: 1.25, lineHeight: 2.0, dyslexiaFont: true },
]

interface ReadingSettings {
  fontSize: number
  lineHeight: number
  theme: ReadingTheme
  lastPreset: string | null
}

const STORAGE_KEY = 'reading-mode-settings'

const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 1,
  lineHeight: 1.5,
  theme: 'auto',
  lastPreset: null,
}

/** Map AppSettings readingFontSize string ('1.5x') to numeric (1.5) */
function fontSizeToNumber(s: string | undefined): number | undefined {
  if (!s) return undefined
  const n = parseFloat(s)
  return FONT_SIZE_LEVELS.includes(n as typeof FONT_SIZE_LEVELS[number]) ? n : undefined
}

/** Map AppSettings readingTheme to toolbar theme key */
function mapTheme(t: string | undefined): ReadingTheme | undefined {
  if (t === 'auto') return 'auto'
  if (t === 'sepia') return 'sepia'
  if (t === 'high-contrast') return 'hc'
  return undefined
}

function loadSettings(): ReadingSettings {
  // Priority: session localStorage > AppSettings defaults > hardcoded defaults
  const appSettings = getSettings()
  const appDefaults: ReadingSettings = {
    fontSize: fontSizeToNumber(appSettings.readingFontSize) ?? DEFAULT_SETTINGS.fontSize,
    lineHeight:
      appSettings.readingLineHeight &&
      LINE_HEIGHT_LEVELS.includes(appSettings.readingLineHeight as typeof LINE_HEIGHT_LEVELS[number])
        ? appSettings.readingLineHeight
        : DEFAULT_SETTINGS.lineHeight,
    theme: mapTheme(appSettings.readingTheme) ?? DEFAULT_SETTINGS.theme,
    lastPreset: null,
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return appDefaults
    const parsed = JSON.parse(raw) as Partial<ReadingSettings>
    return {
      fontSize: FONT_SIZE_LEVELS.includes(parsed.fontSize as typeof FONT_SIZE_LEVELS[number])
        ? (parsed.fontSize as number)
        : appDefaults.fontSize,
      lineHeight: LINE_HEIGHT_LEVELS.includes(parsed.lineHeight as typeof LINE_HEIGHT_LEVELS[number])
        ? (parsed.lineHeight as number)
        : appDefaults.lineHeight,
      theme: THEMES.includes(parsed.theme as ReadingTheme)
        ? (parsed.theme as ReadingTheme)
        : appDefaults.theme,
      lastPreset: typeof parsed.lastPreset === 'string' ? parsed.lastPreset : null,
    }
  } catch {
    // silent-catch-ok: localStorage unavailable in private browsing
    return appDefaults
  }
}

function saveSettings(s: ReadingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // silent-catch-ok: localStorage unavailable in private browsing
  }
}

// --- CSS Variable Helpers ---

function applyFontSize(size: number): void {
  document.documentElement.style.setProperty('--reading-font-size', `${size}rem`)
}

function applyLineHeight(lh: number): void {
  document.documentElement.style.setProperty('--reading-line-height', `${lh}`)
}

function applyTheme(theme: ReadingTheme): void {
  const root = document.documentElement
  root.classList.remove('reading-sepia', 'reading-hc')
  if (theme === 'sepia') root.classList.add('reading-sepia')
  if (theme === 'hc') root.classList.add('reading-hc')
}

function applyDyslexiaFont(enabled: boolean): void {
  const root = document.documentElement
  if (enabled) {
    root.classList.add('reading-dyslexia')
  } else {
    root.classList.remove('reading-dyslexia')
  }
}

// --- Component ---

export function ReadingToolbar() {
  const reduceMotion = shouldReduceMotion()
  const { isVisible, containerRef } = useAutoHide(3000, reduceMotion)

  const [settings, setSettings] = useState<ReadingSettings>(loadSettings)

  // Apply settings to DOM on mount and changes
  useEffect(() => {
    applyFontSize(settings.fontSize)
    applyLineHeight(settings.lineHeight)
    applyTheme(settings.theme)
    // Check if current preset is dyslexia
    const preset = PRESETS.find((p) => p.label === settings.lastPreset)
    applyDyslexiaFont(!!preset?.dyslexiaFont)
    saveSettings(settings)
  }, [settings])

  // Cleanup CSS vars and classes on unmount (reading mode exit)
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--reading-font-size')
      document.documentElement.style.removeProperty('--reading-line-height')
      document.documentElement.classList.remove('reading-sepia', 'reading-hc', 'reading-dyslexia')
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<ReadingSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      // Only update lastPreset when explicitly provided; manual tweaks preserve the last applied preset label
      ...(Object.prototype.hasOwnProperty.call(patch, 'lastPreset') ? {} : {}),
      lastPreset: Object.prototype.hasOwnProperty.call(patch, 'lastPreset')
        ? (patch.lastPreset ?? null)
        : prev.lastPreset,
    }))
  }, [])

  // Font size step
  const changeFontSize = useCallback(
    (dir: 1 | -1) => {
      const idx = FONT_SIZE_LEVELS.indexOf(settings.fontSize as typeof FONT_SIZE_LEVELS[number])
      const next = idx + dir
      if (next >= 0 && next < FONT_SIZE_LEVELS.length) {
        updateSettings({ fontSize: FONT_SIZE_LEVELS[next] })
      }
    },
    [settings.fontSize, updateSettings],
  )

  // Line height step
  const changeLineHeight = useCallback(
    (dir: 1 | -1) => {
      const idx = LINE_HEIGHT_LEVELS.indexOf(settings.lineHeight as typeof LINE_HEIGHT_LEVELS[number])
      const next = idx + dir
      if (next >= 0 && next < LINE_HEIGHT_LEVELS.length) {
        updateSettings({ lineHeight: LINE_HEIGHT_LEVELS[next] })
      }
    },
    [settings.lineHeight, updateSettings],
  )

  // Theme toggle
  const cycleTheme = useCallback(() => {
    const idx = THEMES.indexOf(settings.theme)
    const next = THEMES[(idx + 1) % THEMES.length]
    updateSettings({ theme: next })
  }, [settings.theme, updateSettings])

  // Apply preset
  const applyPreset = useCallback(
    (preset: ReadingPreset) => {
      setSettings((prev) => ({
        ...prev,
        fontSize: preset.fontSize,
        lineHeight: preset.lineHeight,
        lastPreset: preset.label,
      }))
    },
    [],
  )

  const fontSizeLabel = `${settings.fontSize}x`
  const lineHeightLabel = settings.lineHeight.toFixed(2).replace(/0$/, '')
  const isMinFont = settings.fontSize === FONT_SIZE_LEVELS[0]
  const isMaxFont = settings.fontSize === FONT_SIZE_LEVELS[FONT_SIZE_LEVELS.length - 1]
  const isMinLH = settings.lineHeight === LINE_HEIGHT_LEVELS[0]
  const isMaxLH = settings.lineHeight === LINE_HEIGHT_LEVELS[LINE_HEIGHT_LEVELS.length - 1]

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-40',
        'bg-card border border-border rounded-2xl shadow-lg',
        'p-2 flex items-center gap-1',
        'max-w-[500px]',
        // Mobile: full width
        'max-sm:left-2 max-sm:right-2 max-sm:translate-x-0 max-sm:bottom-0 max-sm:rounded-b-none max-sm:max-w-none max-sm:pb-[calc(0.5rem+env(safe-area-inset-bottom))]',
        // Visibility / fade
        reduceMotion
          ? isVisible
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
          : 'transition-opacity duration-150',
        !reduceMotion && (isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'),
      )}
      role="toolbar"
      aria-label="Reading toolbar"
      data-testid="reading-toolbar"
    >
      {/* Font size controls */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Font size">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => changeFontSize(-1)}
          disabled={isMinFont}
          aria-label="Decrease font size"
          className="min-w-[44px] min-h-[44px]"
        >
          <Type className="size-3" aria-hidden="true" />
          <Minus className="size-3" aria-hidden="true" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center select-none" aria-live="polite">
          {fontSizeLabel}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => changeFontSize(1)}
          disabled={isMaxFont}
          aria-label="Increase font size"
          className="min-w-[44px] min-h-[44px]"
        >
          <Type className="size-4" aria-hidden="true" />
          <Plus className="size-3" aria-hidden="true" />
        </Button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border" aria-hidden="true" />

      {/* Line height controls */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Line height">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => changeLineHeight(-1)}
          disabled={isMinLH}
          aria-label="Decrease line height"
          className="min-w-[44px] min-h-[44px]"
        >
          <MoveVertical className="size-3" aria-hidden="true" />
          <Minus className="size-3" aria-hidden="true" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center select-none" aria-live="polite">
          {lineHeightLabel}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => changeLineHeight(1)}
          disabled={isMaxLH}
          aria-label="Increase line height"
          className="min-w-[44px] min-h-[44px]"
        >
          <MoveVertical className="size-3" aria-hidden="true" />
          <Plus className="size-3" aria-hidden="true" />
        </Button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border" aria-hidden="true" />

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleTheme}
        aria-label={`Reading theme: ${THEME_LABELS[settings.theme]}. Click to change.`}
        className="min-w-[44px] min-h-[44px] gap-1"
      >
        <Palette className="size-4" aria-hidden="true" />
        <span className="text-xs max-sm:hidden">{THEME_LABELS[settings.theme]}</span>
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-border max-sm:hidden" aria-hidden="true" />

      {/* Preset dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reading presets"
            className="min-w-[44px] min-h-[44px] gap-1 max-sm:hidden"
          >
            <span className="text-xs">
              {settings.lastPreset ?? 'Preset'}
            </span>
            <ChevronDown className="size-3" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" sideOffset={8}>
          {PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className={cn(
                settings.lastPreset === preset.label && 'bg-accent',
              )}
            >
              <span>{preset.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {preset.fontSize}x / {preset.lineHeight}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
