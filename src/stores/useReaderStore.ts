/**
 * Reader store for EPUB reading state.
 *
 * Manages current CFI position, reading progress, theme, font settings,
 * and UI visibility. Reader settings (theme, font) are persisted to
 * localStorage. Position is persisted by E84-S04.
 *
 * @module useReaderStore
 */
import { create } from 'zustand'
import { saveSettingsToSupabase } from '@/lib/settings'

export type ReaderTheme = 'white' | 'sepia' | 'gray' | 'dark' | 'black'
export type ReaderFontFamily =
  | 'default'
  | 'literata'
  | 'inter'
  | 'atkinson'
  | 'serif'
  | 'sans'
  | 'mono'

const STORAGE_KEY = 'knowlune-reader-settings-v1'
const VALID_READER_THEMES: ReaderTheme[] = ['white', 'sepia', 'gray', 'dark', 'black']

/** Maps reader Page Tone → `readingTheme` values stored in Supabase / AppSettings. */
const READER_THEME_TO_CLOUD_READING_THEME: Record<ReaderTheme, string> = {
  white: 'auto',
  sepia: 'sepia',
  gray: 'gray',
  dark: 'dark',
  black: 'high-contrast',
}

interface ReaderSettings {
  theme: ReaderTheme
  fontSize: number // 80–200 (percentage)
  fontFamily: ReaderFontFamily
  lineHeight: number // 1.2–2.0
  letterSpacing: number // 0–0.3 (em)
  wordSpacing: number // 0–0.5 (em)
  readingRulerEnabled: boolean
  scrollMode: boolean
  dualPage: boolean // true = epub spread: 'auto', false = spread: 'none'
  showPageNumbers: boolean // page counter in footer
  showProgressBar: boolean // progress bar in footer
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'sepia',
  fontSize: 100,
  fontFamily: 'default',
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  readingRulerEnabled: false,
  scrollMode: false,
  dualPage: true,
  showPageNumbers: true,
  showProgressBar: true,
}

export function normalizeReaderTheme(raw: unknown): ReaderTheme {
  if (raw === 'light' || raw === 'auto') return 'white'
  if (raw === 'high-contrast') return 'black'
  return VALID_READER_THEMES.includes(raw as ReaderTheme)
    ? (raw as ReaderTheme)
    : DEFAULT_SETTINGS.theme
}

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    return {
      theme: normalizeReaderTheme(parsed.theme),
      fontSize:
        typeof parsed.fontSize === 'number' && parsed.fontSize >= 80 && parsed.fontSize <= 200
          ? parsed.fontSize
          : DEFAULT_SETTINGS.fontSize,
      fontFamily: (
        [
          'default',
          'literata',
          'inter',
          'atkinson',
          'serif',
          'sans',
          'mono',
        ] as ReaderFontFamily[]
      ).includes(parsed.fontFamily as ReaderFontFamily)
        ? (parsed.fontFamily as ReaderFontFamily)
        : DEFAULT_SETTINGS.fontFamily,
      lineHeight:
        typeof parsed.lineHeight === 'number' &&
        parsed.lineHeight >= 1.2 &&
        parsed.lineHeight <= 2.0
          ? parsed.lineHeight
          : DEFAULT_SETTINGS.lineHeight,
      letterSpacing:
        typeof parsed.letterSpacing === 'number' &&
        parsed.letterSpacing >= 0 &&
        parsed.letterSpacing <= 0.3
          ? parsed.letterSpacing
          : DEFAULT_SETTINGS.letterSpacing,
      wordSpacing:
        typeof parsed.wordSpacing === 'number' &&
        parsed.wordSpacing >= 0 &&
        parsed.wordSpacing <= 0.5
          ? parsed.wordSpacing
          : DEFAULT_SETTINGS.wordSpacing,
      readingRulerEnabled:
        typeof parsed.readingRulerEnabled === 'boolean'
          ? parsed.readingRulerEnabled
          : DEFAULT_SETTINGS.readingRulerEnabled,
      scrollMode:
        typeof parsed.scrollMode === 'boolean' ? parsed.scrollMode : DEFAULT_SETTINGS.scrollMode,
      dualPage: typeof parsed.dualPage === 'boolean' ? parsed.dualPage : DEFAULT_SETTINGS.dualPage,
      showPageNumbers:
        typeof parsed.showPageNumbers === 'boolean'
          ? parsed.showPageNumbers
          : DEFAULT_SETTINGS.showPageNumbers,
      showProgressBar:
        typeof parsed.showProgressBar === 'boolean'
          ? parsed.showProgressBar
          : DEFAULT_SETTINGS.showProgressBar,
    }
  } catch {
    // silent-catch-ok: corrupted storage, use defaults
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // silent-catch-ok: storage full or unavailable
  }
}

interface ReaderStoreState extends ReaderSettings {
  // Current reading position (EPUB CFI string)
  currentCfi: string | null
  // Progress 0–1
  readingProgress: number
  // Current chapter title
  currentChapter: string
  // UI visibility
  headerVisible: boolean
  tocOpen: boolean
  settingsOpen: boolean
  // Actions
  setCurrentCfi: (cfi: string | null) => void
  setReadingProgress: (progress: number) => void
  setCurrentChapter: (chapter: string) => void
  setHeaderVisible: (visible: boolean) => void
  toggleHeader: () => void
  setTocOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setTheme: (theme: ReaderTheme) => void
  setFontSize: (size: number) => void
  setFontFamily: (family: ReaderFontFamily) => void
  setLineHeight: (height: number) => void
  setLetterSpacing: (spacing: number) => void
  setWordSpacing: (spacing: number) => void
  setReadingRulerEnabled: (enabled: boolean) => void
  setScrollMode: (enabled: boolean) => void
  setDualPage: (enabled: boolean) => void
  setShowPageNumbers: (show: boolean) => void
  setShowProgressBar: (show: boolean) => void
  resetSettings: () => void
}

/** Extract persisted settings fields from current state.
 *  Derived from DEFAULT_SETTINGS keys so new settings are automatically included
 *  without needing to manually list every field here. */
function getSettingsFromState(s: ReaderSettings): ReaderSettings {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof ReaderSettings)[]).reduce(
    (acc, key) => ({ ...acc, [key]: s[key] }),
    {} as ReaderSettings
  )
}

export const useReaderStore = create<ReaderStoreState>((set, get) => {
  const initialSettings = loadSettings()
  return {
    ...initialSettings,
    currentCfi: null,
    readingProgress: 0,
    currentChapter: '',
    headerVisible: true,
    tocOpen: false,
    settingsOpen: false,

    setCurrentCfi: cfi => set({ currentCfi: cfi }),

    setReadingProgress: progress => set({ readingProgress: Math.max(0, Math.min(1, progress)) }),

    setCurrentChapter: chapter => set({ currentChapter: chapter }),

    setHeaderVisible: visible => set({ headerVisible: visible }),

    toggleHeader: () => set(state => ({ headerVisible: !state.headerVisible })),

    setTocOpen: open => set({ tocOpen: open }),

    setSettingsOpen: open => set({ settingsOpen: open }),

    setTheme: theme => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), theme })
      set({ theme })
      void saveSettingsToSupabase({
        readingTheme: READER_THEME_TO_CLOUD_READING_THEME[theme],
      })
    },

    setFontSize: size => {
      const clamped = Math.max(80, Math.min(200, size))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), fontSize: clamped })
      set({ fontSize: clamped })
      void saveSettingsToSupabase({ readingFontSize: clamped })
    },

    setFontFamily: family => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), fontFamily: family })
      set({ fontFamily: family })
      // fontFamily is not in the JSONB field map — localStorage-only
    },

    setLineHeight: height => {
      const clamped = Math.max(1.2, Math.min(2.0, height))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), lineHeight: clamped })
      set({ lineHeight: clamped })
      void saveSettingsToSupabase({ readingLineHeight: clamped })
    },

    setLetterSpacing: spacing => {
      const clamped = Math.max(0, Math.min(0.3, spacing))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), letterSpacing: clamped })
      set({ letterSpacing: clamped })
      // letterSpacing is not in the JSONB field map — localStorage-only
    },

    setWordSpacing: spacing => {
      const clamped = Math.max(0, Math.min(0.5, spacing))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), wordSpacing: clamped })
      set({ wordSpacing: clamped })
      // wordSpacing is not in the JSONB field map — localStorage-only
    },

    setReadingRulerEnabled: enabled => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), readingRulerEnabled: enabled })
      set({ readingRulerEnabled: enabled })
      void saveSettingsToSupabase({ readingRuler: enabled })
    },

    setScrollMode: enabled => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), scrollMode: enabled })
      set({ scrollMode: enabled })
      void saveSettingsToSupabase({ scrollMode: enabled })
    },

    setDualPage: enabled => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), dualPage: enabled })
      set({ dualPage: enabled })
    },

    setShowPageNumbers: show => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), showPageNumbers: show })
      set({ showPageNumbers: show })
    },

    setShowProgressBar: show => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), showProgressBar: show })
      set({ showProgressBar: show })
    },

    resetSettings: () => {
      saveSettings(DEFAULT_SETTINGS)
      set({ ...DEFAULT_SETTINGS })
    },
  }
})
