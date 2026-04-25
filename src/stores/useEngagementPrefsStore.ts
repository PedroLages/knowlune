import { create } from 'zustand'
import { saveSettings, saveSettingsToSupabase } from '@/lib/settings'

const STORAGE_KEY = 'levelup-engagement-prefs-v1'

export type ColorScheme = 'professional' | 'vibrant' | 'clean'
export type CourseViewMode = 'grid' | 'list' | 'compact'
export type CourseGridColumns = 'auto' | 2 | 3 | 4 | 5

const VALID_COURSE_VIEW_MODES: CourseViewMode[] = ['grid', 'list', 'compact']
const VALID_COURSE_GRID_COLUMNS: CourseGridColumns[] = ['auto', 2, 3, 4, 5]

export interface EngagementPrefs {
  /** Show achievement banners and completion celebrations */
  achievements: boolean
  /** Show study streak calendar and streak statistics */
  streaks: boolean
  /** Show momentum and milestone badges */
  badges: boolean
  /** Enable page transitions and celebratory effects */
  animations: boolean
  /** Color scheme: professional (default) or vibrant */
  colorScheme: ColorScheme
  /**
   * Courses page view mode (E99-S01).
   * Default 'grid'. List/compact renderers ship in S03/S04 — until then
   * all three values render the existing grid container.
   */
  courseViewMode: CourseViewMode
  /**
   * Courses grid column count (E99-S02).
   * Default 'auto' preserves the responsive grid; concrete values cap the
   * column count at lg+ breakpoints. Mobile (< 640px) is always 1 column.
   */
  courseGridColumns: CourseGridColumns
}

interface EngagementPrefsStore extends EngagementPrefs {
  setPreference: <K extends keyof EngagementPrefs>(key: K, value: EngagementPrefs[K]) => void
  resetToDefaults: () => void
}

const defaults: EngagementPrefs = {
  achievements: true,
  streaks: true,
  badges: true,
  animations: true,
  colorScheme: 'professional',
  courseViewMode: 'grid',
  courseGridColumns: 'auto',
}

function loadPersistedPrefs(): EngagementPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        achievements:
          typeof parsed.achievements === 'boolean' ? parsed.achievements : defaults.achievements,
        streaks: typeof parsed.streaks === 'boolean' ? parsed.streaks : defaults.streaks,
        badges: typeof parsed.badges === 'boolean' ? parsed.badges : defaults.badges,
        animations:
          typeof parsed.animations === 'boolean' ? parsed.animations : defaults.animations,
        colorScheme: ['professional', 'vibrant', 'clean'].includes(parsed.colorScheme)
          ? parsed.colorScheme
          : 'professional',
        courseViewMode: VALID_COURSE_VIEW_MODES.includes(parsed.courseViewMode)
          ? parsed.courseViewMode
          : 'grid',
        courseGridColumns: VALID_COURSE_GRID_COLUMNS.includes(parsed.courseGridColumns)
          ? parsed.courseGridColumns
          : 'auto',
      }
    }
  } catch {
    // Corrupted data — use defaults
  }
  return { ...defaults }
}

function persistPrefs(prefs: EngagementPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage full or unavailable — non-blocking
  }
}

export const useEngagementPrefsStore = create<EngagementPrefsStore>((set, get) => ({
  ...loadPersistedPrefs(),

  setPreference: (key, value) => {
    set({ [key]: value })
    const state = get()
    const prefs: EngagementPrefs = {
      achievements: state.achievements,
      streaks: state.streaks,
      badges: state.badges,
      animations: state.animations,
      colorScheme: state.colorScheme,
      courseViewMode: state.courseViewMode,
      courseGridColumns: state.courseGridColumns,
    }
    persistPrefs(prefs)
    // Bridge colorScheme to AppSettings so useColorScheme hook picks it up
    if (key === 'colorScheme') {
      saveSettings({ colorScheme: value as ColorScheme })
      window.dispatchEvent(new Event('settingsUpdated'))
    }
    // Bridge courseViewMode to AppSettings so non-React consumers can read it.
    if (key === 'courseViewMode') {
      saveSettings({ courseViewMode: value as CourseViewMode })
      window.dispatchEvent(new Event('settingsUpdated'))
    }
    // Bridge courseGridColumns to AppSettings (E99-S02).
    if (key === 'courseGridColumns') {
      saveSettings({ courseGridColumns: value as CourseGridColumns })
      window.dispatchEvent(new Event('settingsUpdated'))
    }
    // Supabase sync — only for keys in the JSONB field map.
    // badges and animations remain localStorage-only.
    if (key === 'achievements') {
      void saveSettingsToSupabase({ achievementsEnabled: value as boolean })
    } else if (key === 'streaks') {
      void saveSettingsToSupabase({ streaksEnabled: value as boolean })
    } else if (key === 'colorScheme') {
      void saveSettingsToSupabase({ colorScheme: value as ColorScheme })
    } else if (key === 'courseViewMode') {
      void saveSettingsToSupabase({ courseViewMode: value as CourseViewMode })
    } else if (key === 'courseGridColumns') {
      void saveSettingsToSupabase({ courseGridColumns: value as CourseGridColumns })
    }
  },

  resetToDefaults: () => {
    set({ ...defaults })
    persistPrefs({ ...defaults })
    // Bridge reset to AppSettings
    saveSettings({
      colorScheme: defaults.colorScheme,
      courseViewMode: defaults.courseViewMode,
      courseGridColumns: defaults.courseGridColumns,
    })
    window.dispatchEvent(new Event('settingsUpdated'))
  },
}))
