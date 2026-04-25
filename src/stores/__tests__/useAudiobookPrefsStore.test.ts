import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAudiobookPrefsStore } from '@/stores/useAudiobookPrefsStore'

// ── Mock saveSettingsToSupabase for dual-write tests (E95-S01) ────────────────
// vi.hoisted() ensures the variable is initialized before vi.mock factory runs.
const { mockSaveSettingsToSupabase } = vi.hoisted(() => ({
  mockSaveSettingsToSupabase: vi.fn(),
}))
vi.mock('@/lib/settings', () => ({
  saveSettingsToSupabase: mockSaveSettingsToSupabase,
}))

const STORAGE_KEY = 'knowlune:audiobook-prefs-v1'

beforeEach(() => {
  localStorage.clear()
  mockSaveSettingsToSupabase.mockReset()
  useAudiobookPrefsStore.setState({
    defaultSpeed: 1.0,
    skipSilence: false,
    defaultSleepTimer: 'off',
    autoBookmarkOnStop: false,
    showRemainingTime: false,
    skipBackSeconds: 15,
    skipForwardSeconds: 30,
  })
})

describe('useAudiobookPrefsStore initial state', () => {
  it('should have default values', () => {
    const state = useAudiobookPrefsStore.getState()
    expect(state.defaultSpeed).toBe(1.0)
    expect(state.skipSilence).toBe(false)
    expect(state.defaultSleepTimer).toBe('off')
    expect(state.autoBookmarkOnStop).toBe(false)
    expect(state.showRemainingTime).toBe(false)
    expect(state.skipBackSeconds).toBe(15)
    expect(state.skipForwardSeconds).toBe(30)
  })
})

describe('setDefaultSpeed', () => {
  it('should update default speed', () => {
    useAudiobookPrefsStore.getState().setDefaultSpeed(1.5)
    expect(useAudiobookPrefsStore.getState().defaultSpeed).toBe(1.5)
  })

  it('should fall back to 1.0 for non-preset speed values', () => {
    // Values not in VALID_SPEEDS preset list fall back to default (1.0)
    useAudiobookPrefsStore.getState().setDefaultSpeed(5.0)
    expect(useAudiobookPrefsStore.getState().defaultSpeed).toBe(1.0)

    useAudiobookPrefsStore.getState().setDefaultSpeed(0.1)
    expect(useAudiobookPrefsStore.getState().defaultSpeed).toBe(1.0)
  })

  it('should persist to localStorage', () => {
    useAudiobookPrefsStore.getState().setDefaultSpeed(2.0)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.defaultSpeed).toBe(2.0)
  })
})

describe('toggleSkipSilence', () => {
  it('should toggle skip silence', () => {
    useAudiobookPrefsStore.getState().toggleSkipSilence()
    expect(useAudiobookPrefsStore.getState().skipSilence).toBe(true)

    useAudiobookPrefsStore.getState().toggleSkipSilence()
    expect(useAudiobookPrefsStore.getState().skipSilence).toBe(false)
  })

  it('should persist to localStorage', () => {
    useAudiobookPrefsStore.getState().toggleSkipSilence()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.skipSilence).toBe(true)
  })
})

describe('setDefaultSleepTimer', () => {
  it('should update default sleep timer', () => {
    useAudiobookPrefsStore.getState().setDefaultSleepTimer(30)
    expect(useAudiobookPrefsStore.getState().defaultSleepTimer).toBe(30)
  })

  it('should accept end-of-chapter', () => {
    useAudiobookPrefsStore.getState().setDefaultSleepTimer('end-of-chapter')
    expect(useAudiobookPrefsStore.getState().defaultSleepTimer).toBe('end-of-chapter')
  })

  it('should persist to localStorage', () => {
    useAudiobookPrefsStore.getState().setDefaultSleepTimer(45)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.defaultSleepTimer).toBe(45)
  })
})

describe('toggleAutoBookmark', () => {
  it('should toggle auto-bookmark', () => {
    useAudiobookPrefsStore.getState().toggleAutoBookmark()
    expect(useAudiobookPrefsStore.getState().autoBookmarkOnStop).toBe(true)

    useAudiobookPrefsStore.getState().toggleAutoBookmark()
    expect(useAudiobookPrefsStore.getState().autoBookmarkOnStop).toBe(false)
  })

  it('should persist to localStorage', () => {
    useAudiobookPrefsStore.getState().toggleAutoBookmark()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.autoBookmarkOnStop).toBe(true)
  })
})

describe('localStorage persistence', () => {
  it('should load saved prefs from localStorage on fresh import', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        defaultSpeed: 1.5,
        skipSilence: true,
        defaultSleepTimer: 60,
        autoBookmarkOnStop: true,
      })
    )

    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    const state = fresh.getState()
    expect(state.defaultSpeed).toBe(1.5)
    expect(state.skipSilence).toBe(true)
    expect(state.defaultSleepTimer).toBe(60)
    expect(state.autoBookmarkOnStop).toBe(true)
  })

  it('should use defaults for corrupted localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json')

    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    expect(fresh.getState().defaultSpeed).toBe(1.0)
  })

  it('should use defaults for invalid values', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        defaultSpeed: 999,
        skipSilence: 'yes',
        defaultSleepTimer: 'invalid',
        autoBookmarkOnStop: 42,
      })
    )

    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    const state = fresh.getState()
    expect(state.defaultSpeed).toBe(1.0)
    expect(state.skipSilence).toBe(false)
    expect(state.defaultSleepTimer).toBe('off')
    expect(state.autoBookmarkOnStop).toBe(false)
  })

  it('should use defaults when localStorage is empty', async () => {
    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    expect(fresh.getState().defaultSpeed).toBe(1.0)
    expect(fresh.getState().autoBookmarkOnStop).toBe(false)
  })
})

describe('per-book speed preservation (AC-7)', () => {
  it('should not affect useAudioPlayerStore when global default changes', async () => {
    // Import audio player store to verify independence
    const { useAudioPlayerStore } = await import('@/stores/useAudioPlayerStore')

    // Set a per-book speed
    useAudioPlayerStore.getState().setPlaybackRate(1.75)

    // Change global default
    useAudiobookPrefsStore.getState().setDefaultSpeed(2.0)

    // Per-book speed should be unchanged
    expect(useAudioPlayerStore.getState().playbackRate).toBe(1.75)
  })
})

// ── E95-S01: Supabase dual-write ─────────────────────────────────────────────

describe('Supabase dual-write (E95-S01)', () => {
  it('setDefaultSpeed calls saveSettingsToSupabase with validated speed', () => {
    useAudiobookPrefsStore.getState().setDefaultSpeed(1.5)
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ defaultSpeed: 1.5 })
  })

  it('setDefaultSpeed with invalid speed saves validated value (1.0)', () => {
    useAudiobookPrefsStore.getState().setDefaultSpeed(99)
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ defaultSpeed: 1.0 })
  })

  it('toggleSkipSilence calls saveSettingsToSupabase with toggled value', () => {
    useAudiobookPrefsStore.getState().toggleSkipSilence()
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ skipSilence: true })

    mockSaveSettingsToSupabase.mockClear()
    useAudiobookPrefsStore.getState().toggleSkipSilence()
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ skipSilence: false })
  })

  it('setDefaultSleepTimer calls saveSettingsToSupabase', () => {
    useAudiobookPrefsStore.getState().setDefaultSleepTimer(30)
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ defaultSleepTimer: 30 })
  })

  it('toggleAutoBookmark calls saveSettingsToSupabase with toggled value', () => {
    useAudiobookPrefsStore.getState().toggleAutoBookmark()
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ autoBookmarkOnStop: true })
  })
})

// ── 2026-04-25 audiobook player polish: showRemainingTime + skip intervals ──

describe('setShowRemainingTime', () => {
  it('updates state to true', () => {
    useAudiobookPrefsStore.getState().setShowRemainingTime(true)
    expect(useAudiobookPrefsStore.getState().showRemainingTime).toBe(true)
  })

  it('round-trips back to false', () => {
    useAudiobookPrefsStore.getState().setShowRemainingTime(true)
    useAudiobookPrefsStore.getState().setShowRemainingTime(false)
    expect(useAudiobookPrefsStore.getState().showRemainingTime).toBe(false)
  })

  it('persists to localStorage', () => {
    useAudiobookPrefsStore.getState().setShowRemainingTime(true)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.showRemainingTime).toBe(true)
  })

  it('calls saveSettingsToSupabase with the new value', () => {
    useAudiobookPrefsStore.getState().setShowRemainingTime(true)
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ showRemainingTime: true })
  })
})

describe('setSkipBackSeconds', () => {
  it('accepts an allow-listed value', () => {
    useAudiobookPrefsStore.getState().setSkipBackSeconds(45)
    expect(useAudiobookPrefsStore.getState().skipBackSeconds).toBe(45)
  })

  it('falls back to default 15 for an out-of-list value', () => {
    useAudiobookPrefsStore.getState().setSkipBackSeconds(7)
    expect(useAudiobookPrefsStore.getState().skipBackSeconds).toBe(15)
  })

  it('persists to localStorage and Supabase', () => {
    useAudiobookPrefsStore.getState().setSkipBackSeconds(60)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.skipBackSeconds).toBe(60)
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ skipBackSeconds: 60 })
  })
})

describe('setSkipForwardSeconds', () => {
  it('accepts an allow-listed value', () => {
    useAudiobookPrefsStore.getState().setSkipForwardSeconds(90)
    expect(useAudiobookPrefsStore.getState().skipForwardSeconds).toBe(90)
  })

  it('falls back to default 30 for an out-of-list value', () => {
    useAudiobookPrefsStore.getState().setSkipForwardSeconds(120)
    expect(useAudiobookPrefsStore.getState().skipForwardSeconds).toBe(30)
  })

  it('persists to localStorage and Supabase', () => {
    useAudiobookPrefsStore.getState().setSkipForwardSeconds(60)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.skipForwardSeconds).toBe(60)
    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({ skipForwardSeconds: 60 })
  })
})

describe('localStorage persistence — new fields', () => {
  it('hydrates showRemainingTime, skip-back/forward from localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        defaultSpeed: 1.0,
        skipSilence: false,
        defaultSleepTimer: 'off',
        autoBookmarkOnStop: false,
        showRemainingTime: true,
        skipBackSeconds: 30,
        skipForwardSeconds: 60,
      })
    )
    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    const state = fresh.getState()
    expect(state.showRemainingTime).toBe(true)
    expect(state.skipBackSeconds).toBe(30)
    expect(state.skipForwardSeconds).toBe(60)
  })

  it('falls through to defaults when persisted skip values are corrupted', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showRemainingTime: 'yes', // wrong type
        skipBackSeconds: 7, // not in allow-list
        skipForwardSeconds: NaN, // not in allow-list
      })
    )
    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    const state = fresh.getState()
    expect(state.showRemainingTime).toBe(false)
    expect(state.skipBackSeconds).toBe(15)
    expect(state.skipForwardSeconds).toBe(30)
  })

  it('accepts SleepTimerDefault values 5 and 10 (new presets)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        defaultSleepTimer: 5,
      })
    )
    vi.resetModules()
    const { useAudiobookPrefsStore: fresh } = await import('@/stores/useAudiobookPrefsStore')
    expect(fresh.getState().defaultSleepTimer).toBe(5)

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        defaultSleepTimer: 10,
      })
    )
    vi.resetModules()
    const { useAudiobookPrefsStore: fresh2 } = await import('@/stores/useAudiobookPrefsStore')
    expect(fresh2.getState().defaultSleepTimer).toBe(10)
  })
})
