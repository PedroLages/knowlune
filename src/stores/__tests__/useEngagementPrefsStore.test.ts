import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock saveSettings since it touches the full settings module
vi.mock('@/lib/settings', () => ({
  saveSettings: vi.fn(),
}))

import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'
import { saveSettings } from '@/lib/settings'

const mockSaveSettings = vi.mocked(saveSettings)

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  useEngagementPrefsStore.setState({
    achievements: true,
    streaks: true,
    badges: true,
    animations: true,
    colorScheme: 'professional',
  })
})

describe('useEngagementPrefsStore initial state', () => {
  it('should have default values', () => {
    const state = useEngagementPrefsStore.getState()
    expect(state.achievements).toBe(true)
    expect(state.streaks).toBe(true)
    expect(state.badges).toBe(true)
    expect(state.animations).toBe(true)
    expect(state.colorScheme).toBe('professional')
  })
})

describe('setPreference', () => {
  it('should update a boolean preference', () => {
    useEngagementPrefsStore.getState().setPreference('achievements', false)
    expect(useEngagementPrefsStore.getState().achievements).toBe(false)
  })

  it('should persist to localStorage', () => {
    useEngagementPrefsStore.getState().setPreference('streaks', false)
    const stored = JSON.parse(localStorage.getItem('levelup-engagement-prefs-v1')!)
    expect(stored.streaks).toBe(false)
  })

  it('should bridge colorScheme to AppSettings', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    useEngagementPrefsStore.getState().setPreference('colorScheme', 'vibrant')

    expect(mockSaveSettings).toHaveBeenCalledWith({ colorScheme: 'vibrant' })
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event))
  })

  it('should not call saveSettings for non-colorScheme preferences', () => {
    useEngagementPrefsStore.getState().setPreference('badges', false)
    expect(mockSaveSettings).not.toHaveBeenCalled()
  })
})

describe('resetToDefaults', () => {
  it('should reset all preferences to defaults', () => {
    useEngagementPrefsStore.getState().setPreference('achievements', false)
    useEngagementPrefsStore.getState().setPreference('animations', false)
    useEngagementPrefsStore.getState().setPreference('colorScheme', 'vibrant')

    useEngagementPrefsStore.getState().resetToDefaults()

    const state = useEngagementPrefsStore.getState()
    expect(state.achievements).toBe(true)
    expect(state.animations).toBe(true)
    expect(state.colorScheme).toBe('professional')
  })

  it('should persist defaults to localStorage', () => {
    useEngagementPrefsStore.getState().setPreference('badges', false)
    useEngagementPrefsStore.getState().resetToDefaults()

    const stored = JSON.parse(localStorage.getItem('levelup-engagement-prefs-v1')!)
    expect(stored.badges).toBe(true)
  })

  it('should bridge colorScheme reset to AppSettings', () => {
    useEngagementPrefsStore.getState().resetToDefaults()
    expect(mockSaveSettings).toHaveBeenCalledWith({ colorScheme: 'professional' })
  })
})

describe('loadPersistedPrefs', () => {
  it('should load saved prefs from localStorage on fresh import', async () => {
    localStorage.setItem(
      'levelup-engagement-prefs-v1',
      JSON.stringify({
        achievements: false,
        streaks: false,
        badges: true,
        animations: false,
        colorScheme: 'vibrant',
      })
    )

    vi.resetModules()
    const { useEngagementPrefsStore: fresh } = await import('@/stores/useEngagementPrefsStore')
    const state = fresh.getState()
    expect(state.achievements).toBe(false)
    expect(state.streaks).toBe(false)
    expect(state.animations).toBe(false)
    expect(state.colorScheme).toBe('vibrant')
  })

  it('should use defaults for corrupted localStorage', async () => {
    localStorage.setItem('levelup-engagement-prefs-v1', 'not json')

    vi.resetModules()
    const { useEngagementPrefsStore: fresh } = await import('@/stores/useEngagementPrefsStore')
    expect(fresh.getState().achievements).toBe(true)
  })

  it('should use defaults for invalid boolean values', async () => {
    localStorage.setItem(
      'levelup-engagement-prefs-v1',
      JSON.stringify({
        achievements: 'yes', // not boolean
        streaks: 42, // not boolean
        colorScheme: 'invalid', // not vibrant
      })
    )

    vi.resetModules()
    const { useEngagementPrefsStore: fresh } = await import('@/stores/useEngagementPrefsStore')
    const state = fresh.getState()
    expect(state.achievements).toBe(true) // default
    expect(state.streaks).toBe(true) // default
    expect(state.colorScheme).toBe('professional') // default
  })

  it('should use defaults when localStorage is empty', async () => {
    vi.resetModules()
    const { useEngagementPrefsStore: fresh } = await import('@/stores/useEngagementPrefsStore')
    expect(fresh.getState().achievements).toBe(true)
  })
})
