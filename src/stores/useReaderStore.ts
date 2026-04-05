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
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontSize: 100,
  fontFamily: 'default',
  lineHeight: 1.6,
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
  resetSettings: () => void
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
      const settings: ReaderSettings = {
        theme,
        fontSize: get().fontSize,
        fontFamily: get().fontFamily,
        lineHeight: get().lineHeight,
      }
      saveSettings(settings)
      set({ theme })
    },

    setFontSize: size => {
      const clamped = Math.max(80, Math.min(200, size))
      const settings: ReaderSettings = {
        theme: get().theme,
        fontSize: clamped,
        fontFamily: get().fontFamily,
        lineHeight: get().lineHeight,
      }
      saveSettings(settings)
      set({ fontSize: clamped })
    },

    setFontFamily: family => {
      const settings: ReaderSettings = {
        theme: get().theme,
        fontSize: get().fontSize,
        fontFamily: family,
        lineHeight: get().lineHeight,
      }
      saveSettings(settings)
      set({ fontFamily: family })
    },

    setLineHeight: height => {
      const clamped = Math.max(1.2, Math.min(2.0, height))
      const settings: ReaderSettings = {
        theme: get().theme,
        fontSize: get().fontSize,
        fontFamily: get().fontFamily,
        lineHeight: clamped,
      }
      saveSettings(settings)
      set({ lineHeight: clamped })
    },

    resetSettings: () => {
      saveSettings(DEFAULT_SETTINGS)
      set({ ...DEFAULT_SETTINGS })
    },
  }
})
