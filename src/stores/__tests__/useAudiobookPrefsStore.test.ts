import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAudiobookPrefsStore } from '@/stores/useAudiobookPrefsStore'

const STORAGE_KEY = 'knowlune:audiobook-prefs-v1'

beforeEach(() => {
  localStorage.clear()
  useAudiobookPrefsStore.setState({
    defaultSpeed: 1.0,
    skipSilence: false,
    defaultSleepTimer: 'off',
    autoBookmarkOnStop: false,
  })
})

describe('useAudiobookPrefsStore initial state', () => {
  it('should have default values', () => {
    const state = useAudiobookPrefsStore.getState()
    expect(state.defaultSpeed).toBe(1.0)
    expect(state.skipSilence).toBe(false)
    expect(state.defaultSleepTimer).toBe('off')
    expect(state.autoBookmarkOnStop).toBe(false)
  })
})

describe('setDefaultSpeed', () => {
  it('should update default speed', () => {
    useAudiobookPrefsStore.getState().setDefaultSpeed(1.5)
    expect(useAudiobookPrefsStore.getState().defaultSpeed).toBe(1.5)
  })

  it('should clamp speed to valid range', () => {
    useAudiobookPrefsStore.getState().setDefaultSpeed(5.0)
    expect(useAudiobookPrefsStore.getState().defaultSpeed).toBe(3.0)

    useAudiobookPrefsStore.getState().setDefaultSpeed(0.1)
    expect(useAudiobookPrefsStore.getState().defaultSpeed).toBe(0.5)
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
