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

export type ReaderTheme = 'light' | 'sepia' | 'dark'
export type ReaderFontFamily = 'default' | 'serif' | 'sans' | 'mono'

const STORAGE_KEY = 'knowlune-reader-settings-v1'

interface ReaderSettings {
  theme: ReaderTheme
  fontSize: number // 80–200 (percentage)
  fontFamily: ReaderFontFamily
  lineHeight: number // 1.2–2.0
  letterSpacing: number // 0–0.3 (em)
  wordSpacing: number // 0–0.5 (em)
  readingRulerEnabled: boolean
  scrollMode: boolean
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontSize: 100,
  fontFamily: 'default',
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  readingRulerEnabled: false,
  scrollMode: false,
}

function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    return {
      theme: (['light', 'sepia', 'dark'] as ReaderTheme[]).includes(parsed.theme as ReaderTheme)
        ? (parsed.theme as ReaderTheme)
        : DEFAULT_SETTINGS.theme,
      fontSize:
        typeof parsed.fontSize === 'number' && parsed.fontSize >= 80 && parsed.fontSize <= 200
          ? parsed.fontSize
          : DEFAULT_SETTINGS.fontSize,
      fontFamily: (['default', 'serif', 'sans', 'mono'] as ReaderFontFamily[]).includes(
        parsed.fontFamily as ReaderFontFamily
      )
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
    },

    setFontSize: size => {
      const clamped = Math.max(80, Math.min(200, size))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), fontSize: clamped })
      set({ fontSize: clamped })
    },

    setFontFamily: family => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), fontFamily: family })
      set({ fontFamily: family })
    },

    setLineHeight: height => {
      const clamped = Math.max(1.2, Math.min(2.0, height))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), lineHeight: clamped })
      set({ lineHeight: clamped })
    },

    setLetterSpacing: spacing => {
      const clamped = Math.max(0, Math.min(0.3, spacing))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), letterSpacing: clamped })
      set({ letterSpacing: clamped })
    },

    setWordSpacing: spacing => {
      const clamped = Math.max(0, Math.min(0.5, spacing))
      const s = get()
      saveSettings({ ...getSettingsFromState(s), wordSpacing: clamped })
      set({ wordSpacing: clamped })
    },

    setReadingRulerEnabled: enabled => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), readingRulerEnabled: enabled })
      set({ readingRulerEnabled: enabled })
    },

    setScrollMode: enabled => {
      const s = get()
      saveSettings({ ...getSettingsFromState(s), scrollMode: enabled })
      set({ scrollMode: enabled })
    },

    resetSettings: () => {
      saveSettings(DEFAULT_SETTINGS)
      set({ ...DEFAULT_SETTINGS })
    },
  }
})
