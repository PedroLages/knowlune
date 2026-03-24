import { create } from 'zustand'

const STORAGE_KEY = 'levelup-engagement-prefs-v1'

export type ColorScheme = 'professional' | 'vibrant'

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
}

interface EngagementPrefsStore extends EngagementPrefs {
  setPreference: <K extends keyof EngagementPrefs>(
    key: K,
    value: EngagementPrefs[K]
  ) => void
  resetToDefaults: () => void
}

const defaults: EngagementPrefs = {
  achievements: true,
  streaks: true,
  badges: true,
  animations: true,
  colorScheme: 'professional',
}

function loadPersistedPrefs(): EngagementPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        achievements: typeof parsed.achievements === 'boolean' ? parsed.achievements : defaults.achievements,
        streaks: typeof parsed.streaks === 'boolean' ? parsed.streaks : defaults.streaks,
        badges: typeof parsed.badges === 'boolean' ? parsed.badges : defaults.badges,
        animations: typeof parsed.animations === 'boolean' ? parsed.animations : defaults.animations,
        colorScheme: parsed.colorScheme === 'vibrant' ? 'vibrant' : 'professional',
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
    }
    persistPrefs(prefs)
  },

  resetToDefaults: () => {
    set({ ...defaults })
    persistPrefs({ ...defaults })
  },
}))
