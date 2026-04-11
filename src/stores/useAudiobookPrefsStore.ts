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

const STORAGE_KEY = 'knowlune:audiobook-prefs-v1'

export type SleepTimerDefault = 'off' | 15 | 30 | 45 | 60 | 'end-of-chapter'

export interface AudiobookPrefs {
  /** Default playback speed for new sessions (0.5–3.0, 0.25 increments) */
  defaultSpeed: number
  /** Skip silent sections during playback */
  skipSilence: boolean
  /** Default sleep timer duration for new sessions */
  defaultSleepTimer: SleepTimerDefault
  /** Auto-create bookmark when playback stops */
  autoBookmarkOnStop: boolean
}

interface AudiobookPrefsStore extends AudiobookPrefs {
  setDefaultSpeed: (speed: number) => void
  toggleSkipSilence: () => void
  setDefaultSleepTimer: (timer: SleepTimerDefault) => void
  toggleAutoBookmark: () => void
}

const defaults: AudiobookPrefs = {
  defaultSpeed: 1.0,
  skipSilence: false,
  defaultSleepTimer: 'off',
  autoBookmarkOnStop: false,
}

export const VALID_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
const VALID_SPEEDS_SET = new Set(VALID_SPEEDS)

const VALID_TIMERS = new Set<SleepTimerDefault>(['off', 15, 30, 45, 60, 'end-of-chapter'])

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
  },

  toggleSkipSilence: () => {
    set(s => ({ skipSilence: !s.skipSilence }))
    // Read from get() after set() to capture the toggled value
    persistPrefs(getPrefsFromState(get()))
  },

  setDefaultSleepTimer: (timer: SleepTimerDefault) => {
    set({ defaultSleepTimer: timer })
    persistPrefs(getPrefsFromState(get()))
  },

  toggleAutoBookmark: () => {
    set(s => ({ autoBookmarkOnStop: !s.autoBookmarkOnStop }))
    persistPrefs(getPrefsFromState(get()))
  },
}))
