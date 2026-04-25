/**
 * useAudiobookPrefsStore — global audiobook playback preferences (Zustand + localStorage).
 *
 * Stores user-level defaults for speed, skip silence, sleep timer, and auto-bookmark.
 * Per-book speed overrides live in useAudioPlayerStore and are NOT affected by these globals.
 *
 * @module useAudiobookPrefsStore
 * @since E108-S04
 */
import { create } from 'zustand'
import { saveSettingsToSupabase } from '@/lib/settings'

const STORAGE_KEY = 'knowlune:audiobook-prefs-v1'

export type SleepTimerDefault = 'off' | 5 | 10 | 15 | 30 | 45 | 60 | 'end-of-chapter'

export interface AudiobookPrefs {
  /** Default playback speed for new sessions (0.5–3.0, 0.25 increments) */
  defaultSpeed: number
  /** Skip silent sections during playback.
   *  Persisted for future Web Audio API AnalyserNode implementation. UI shows "Coming soon". */
  skipSilence: boolean
  /** Default sleep timer duration for new sessions */
  defaultSleepTimer: SleepTimerDefault
  /** Auto-create bookmark when playback stops */
  autoBookmarkOnStop: boolean
  /** Show remaining time (-1:20:07) instead of total duration on the scrubber */
  showRemainingTime: boolean
  /** Skip-back interval in seconds (button taps + keyboard + OS controls) */
  skipBackSeconds: number
  /** Skip-forward interval in seconds (button taps + keyboard + OS controls) */
  skipForwardSeconds: number
}

interface AudiobookPrefsStore extends AudiobookPrefs {
  setDefaultSpeed: (speed: number) => void
  toggleSkipSilence: () => void
  setDefaultSleepTimer: (timer: SleepTimerDefault) => void
  toggleAutoBookmark: () => void
  setShowRemainingTime: (value: boolean) => void
  setSkipBackSeconds: (seconds: number) => void
  setSkipForwardSeconds: (seconds: number) => void
}

const defaults: AudiobookPrefs = {
  defaultSpeed: 1.0,
  skipSilence: false,
  defaultSleepTimer: 'off',
  autoBookmarkOnStop: false,
  showRemainingTime: false,
  skipBackSeconds: 15,
  skipForwardSeconds: 30,
}

export const VALID_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
const VALID_SPEEDS_SET = new Set(VALID_SPEEDS)

export const VALID_TIMERS = new Set<SleepTimerDefault>(['off', 5, 10, 15, 30, 45, 60, 'end-of-chapter'])

/** Allowed skip-back intervals in seconds. Asymmetric (back < forward) preserved by default 15. */
export const VALID_SKIP_BACK = [5, 10, 15, 30, 45, 60] as const
const VALID_SKIP_BACK_SET = new Set<number>(VALID_SKIP_BACK)

/** Allowed skip-forward intervals in seconds. */
export const VALID_SKIP_FORWARD = [10, 15, 30, 45, 60, 90] as const
const VALID_SKIP_FORWARD_SET = new Set<number>(VALID_SKIP_FORWARD)

function loadPersistedPrefs(): AudiobookPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        defaultSpeed: VALID_SPEEDS_SET.has(parsed.defaultSpeed)
          ? parsed.defaultSpeed
          : defaults.defaultSpeed,
        skipSilence:
          typeof parsed.skipSilence === 'boolean' ? parsed.skipSilence : defaults.skipSilence,
        defaultSleepTimer: VALID_TIMERS.has(parsed.defaultSleepTimer)
          ? parsed.defaultSleepTimer
          : defaults.defaultSleepTimer,
        autoBookmarkOnStop:
          typeof parsed.autoBookmarkOnStop === 'boolean'
            ? parsed.autoBookmarkOnStop
            : defaults.autoBookmarkOnStop,
        showRemainingTime:
          typeof parsed.showRemainingTime === 'boolean'
            ? parsed.showRemainingTime
            : defaults.showRemainingTime,
        skipBackSeconds:
          typeof parsed.skipBackSeconds === 'number' &&
          VALID_SKIP_BACK_SET.has(parsed.skipBackSeconds)
            ? parsed.skipBackSeconds
            : defaults.skipBackSeconds,
        skipForwardSeconds:
          typeof parsed.skipForwardSeconds === 'number' &&
          VALID_SKIP_FORWARD_SET.has(parsed.skipForwardSeconds)
            ? parsed.skipForwardSeconds
            : defaults.skipForwardSeconds,
      }
    }
  } catch {
    // silent-catch-ok: corrupted localStorage data — fall through to defaults
  }
  return { ...defaults }
}

function persistPrefs(prefs: AudiobookPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // silent-catch-ok: localStorage full or unavailable — non-blocking
  }
}

function getPrefsFromState(state: AudiobookPrefsStore): AudiobookPrefs {
  return {
    defaultSpeed: state.defaultSpeed,
    skipSilence: state.skipSilence,
    defaultSleepTimer: state.defaultSleepTimer,
    autoBookmarkOnStop: state.autoBookmarkOnStop,
    showRemainingTime: state.showRemainingTime,
    skipBackSeconds: state.skipBackSeconds,
    skipForwardSeconds: state.skipForwardSeconds,
  }
}

export const useAudiobookPrefsStore = create<AudiobookPrefsStore>((set, get) => ({
  ...loadPersistedPrefs(),

  setDefaultSpeed: (speed: number) => {
    // Validate against known preset values to avoid persisting non-preset values
    // that would reset to default on reload
    const validated = VALID_SPEEDS_SET.has(speed) ? speed : defaults.defaultSpeed
    set({ defaultSpeed: validated })
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ defaultSpeed: validated })
  },

  toggleSkipSilence: () => {
    set(s => ({ skipSilence: !s.skipSilence }))
    // Read from get() after set() to capture the toggled value
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ skipSilence: get().skipSilence })
  },

  setDefaultSleepTimer: (timer: SleepTimerDefault) => {
    set({ defaultSleepTimer: timer })
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ defaultSleepTimer: timer })
  },

  toggleAutoBookmark: () => {
    set(s => ({ autoBookmarkOnStop: !s.autoBookmarkOnStop }))
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ autoBookmarkOnStop: get().autoBookmarkOnStop })
  },

  setShowRemainingTime: (value: boolean) => {
    const validated = typeof value === 'boolean' ? value : defaults.showRemainingTime
    set({ showRemainingTime: validated })
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ showRemainingTime: validated })
  },

  setSkipBackSeconds: (seconds: number) => {
    const validated = VALID_SKIP_BACK_SET.has(seconds) ? seconds : defaults.skipBackSeconds
    set({ skipBackSeconds: validated })
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ skipBackSeconds: validated })
  },

  setSkipForwardSeconds: (seconds: number) => {
    const validated = VALID_SKIP_FORWARD_SET.has(seconds) ? seconds : defaults.skipForwardSeconds
    set({ skipForwardSeconds: validated })
    persistPrefs(getPrefsFromState(get()))
    void saveSettingsToSupabase({ skipForwardSeconds: validated })
  },
}))
