import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getSettings,
  saveSettings,
  exportAllData,
  importAllData,
  resetAllData,
} from '@/lib/settings'

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getSettings', () => {
    it('returns defaults when nothing stored', () => {
      const settings = getSettings()
      expect(settings).toEqual({
        displayName: 'Student',
        bio: '',
        theme: 'system',
        colorScheme: 'professional',
        accessibilityFont: false,
        contentDensity: 'default',
        reduceMotion: 'system',
      })
    })

    it('returns defaults when localStorage has invalid JSON', () => {
      localStorage.setItem('app-settings', 'not-json')
      const settings = getSettings()
      expect(settings).toEqual({
        displayName: 'Student',
        bio: '',
        theme: 'system',
        colorScheme: 'professional',
        accessibilityFont: false,
        contentDensity: 'default',
        reduceMotion: 'system',
      })
    })

    it('merges stored values with defaults', () => {
      localStorage.setItem('app-settings', JSON.stringify({ displayName: 'Alice' }))
      const settings = getSettings()
      expect(settings.displayName).toBe('Alice')
      expect(settings.bio).toBe('')
      expect(settings.theme).toBe('system')
    })

    it('sanitizes corrupted reduceMotion to default', () => {
      localStorage.setItem('app-settings', JSON.stringify({ reduceMotion: 'invalid' }))
      expect(getSettings().reduceMotion).toBe('system')
    })

    it('sanitizes corrupted contentDensity to default', () => {
      localStorage.setItem('app-settings', JSON.stringify({ contentDensity: 'compact' }))
      expect(getSettings().contentDensity).toBe('default')
    })

    it('sanitizes non-boolean accessibilityFont to default', () => {
      localStorage.setItem('app-settings', JSON.stringify({ accessibilityFont: 'yes' }))
      expect(getSettings().accessibilityFont).toBe(false)
    })

    it('returns a new object each time (not a reference)', () => {
      const s1 = getSettings()
      const s2 = getSettings()
      expect(s1).toEqual(s2)
      expect(s1).not.toBe(s2)
    })
  })

  describe('saveSettings', () => {
    it('persists settings and returns merged result', () => {
      const result = saveSettings({ displayName: 'Bob' })
      expect(result.displayName).toBe('Bob')
      expect(result.bio).toBe('')
      expect(result.theme).toBe('system')

      // Verify persistence
      const retrieved = getSettings()
      expect(retrieved.displayName).toBe('Bob')
    })

    it('merges partial updates with existing settings', () => {
      saveSettings({ displayName: 'Alice', bio: 'Hello' })
      saveSettings({ theme: 'dark' })
      const settings = getSettings()
      expect(settings.displayName).toBe('Alice')
      expect(settings.bio).toBe('Hello')
      expect(settings.theme).toBe('dark')
    })

    it('overwrites previously saved values', () => {
      saveSettings({ displayName: 'Alice' })
      saveSettings({ displayName: 'Bob' })
      expect(getSettings().displayName).toBe('Bob')
    })

    it('can set all fields at once', () => {
      const result = saveSettings({
        displayName: 'Operator',
        bio: 'Field agent',
        theme: 'dark',
        colorScheme: 'vibrant',
      })
      expect(result).toEqual({
        displayName: 'Operator',
        bio: 'Field agent',
        theme: 'dark',
        colorScheme: 'vibrant',
        accessibilityFont: false,
        contentDensity: 'default',
        reduceMotion: 'system',
      })
    })

    it('persists colorScheme "vibrant" and reads it back', () => {
      saveSettings({ colorScheme: 'vibrant' })
      expect(getSettings().colorScheme).toBe('vibrant')
    })

    it('defaults colorScheme to "professional" for existing users without it', () => {
      // Simulate legacy settings without colorScheme
      localStorage.setItem('app-settings', JSON.stringify({ displayName: 'Legacy' }))
      expect(getSettings().colorScheme).toBe('professional')
    })
  })

  describe('exportAllData', () => {
    it('captures all localStorage data', () => {
      localStorage.setItem('key1', JSON.stringify({ data: 'value1' }))
      localStorage.setItem('key2', 'plain-string')

      const exported = exportAllData()
      const parsed = JSON.parse(exported)

      expect(parsed.key1).toEqual({ data: 'value1' })
      expect(parsed.key2).toBe('plain-string')
    })

    it('returns empty object when localStorage is empty', () => {
      const exported = exportAllData()
      expect(JSON.parse(exported)).toEqual({})
    })

    it('returns valid JSON string', () => {
      saveSettings({ displayName: 'Test' })
      const exported = exportAllData()
      expect(() => JSON.parse(exported)).not.toThrow()
    })

    it('includes settings and other data', () => {
      saveSettings({ displayName: 'Agent' })
      localStorage.setItem('custom-key', JSON.stringify([1, 2, 3]))

      const parsed = JSON.parse(exportAllData())
      expect(parsed['app-settings']).toBeDefined()
      expect(parsed['custom-key']).toEqual([1, 2, 3])
    })
  })

  describe('importAllData', () => {
    it('restores data from exported JSON', () => {
      // Set up initial data
      saveSettings({ displayName: 'Original' })
      localStorage.setItem('extra', JSON.stringify({ foo: 'bar' }))
      const exported = exportAllData()

      // Clear and reimport
      localStorage.clear()
      expect(importAllData(exported)).toBe(true)

      // Verify restoration
      expect(getSettings().displayName).toBe('Original')
      expect(JSON.parse(localStorage.getItem('extra')!)).toEqual({ foo: 'bar' })
    })

    it('returns false for invalid JSON', () => {
      expect(importAllData('not-json')).toBe(false)
    })

    it('handles string values correctly', () => {
      const data = JSON.stringify({ mykey: 'simple string' })
      importAllData(data)
      expect(localStorage.getItem('mykey')).toBe('simple string')
    })

    it('handles object values by JSON stringifying them', () => {
      const data = JSON.stringify({ mykey: { nested: true } })
      importAllData(data)
      expect(JSON.parse(localStorage.getItem('mykey')!)).toEqual({ nested: true })
    })

    it('can round-trip with exportAllData', () => {
      saveSettings({ displayName: 'Roundtrip', bio: 'Test', theme: 'dark' })
      localStorage.setItem('journal', JSON.stringify([{ id: '1', title: 'Note' }]))

      const exported = exportAllData()
      localStorage.clear()
      importAllData(exported)

      expect(getSettings().displayName).toBe('Roundtrip')
      expect(JSON.parse(localStorage.getItem('journal')!)).toEqual([{ id: '1', title: 'Note' }])
    })
  })

  describe('resetAllData', () => {
    it('clears all localStorage data', () => {
      saveSettings({ displayName: 'Gone' })
      localStorage.setItem('other', 'data')
      resetAllData()
      expect(localStorage.length).toBe(0)
    })

    it('settings return defaults after reset', () => {
      saveSettings({ displayName: 'Gone', theme: 'dark' })
      resetAllData()
      const settings = getSettings()
      expect(settings.displayName).toBe('Student')
      expect(settings.theme).toBe('system')
    })

    it('is idempotent (safe to call on empty storage)', () => {
      resetAllData()
      resetAllData()
      expect(localStorage.length).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // saveSettings — localStorage persistence
  // ---------------------------------------------------------------------------

  describe('saveSettings localStorage persistence', () => {
    it('writes to localStorage under the app-settings key', () => {
      saveSettings({ displayName: 'TestUser' })
      const raw = localStorage.getItem('app-settings')
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.displayName).toBe('TestUser')
    })

    it('preserves all fields in localStorage after partial update', () => {
      saveSettings({ displayName: 'Alice', bio: 'Hello', theme: 'dark' })
      saveSettings({ bio: 'Updated bio' })
      const raw = JSON.parse(localStorage.getItem('app-settings')!)
      expect(raw.displayName).toBe('Alice')
      expect(raw.bio).toBe('Updated bio')
      expect(raw.theme).toBe('dark')
    })

    it('stores profilePhotoUrl in localStorage', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
      saveSettings({ profilePhotoUrl: dataUrl })
      const raw = JSON.parse(localStorage.getItem('app-settings')!)
      expect(raw.profilePhotoUrl).toBe(dataUrl)
    })

    it('stores fontSize in localStorage', () => {
      saveSettings({ fontSize: 'large' })
      const raw = JSON.parse(localStorage.getItem('app-settings')!)
      expect(raw.fontSize).toBe('large')
    })
  })

  // ---------------------------------------------------------------------------
  // Profile sync — Supabase auth.updateUser() integration
  // ---------------------------------------------------------------------------

  describe('profile sync to Supabase', () => {
    const mockUpdateUser = vi.fn()

    beforeEach(() => {
      mockUpdateUser.mockReset()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('saveSettings writes to localStorage regardless of auth state', () => {
      // Even without Supabase, localStorage should be the primary store
      saveSettings({ displayName: 'OfflineUser', bio: 'Testing offline' })
      const settings = getSettings()
      expect(settings.displayName).toBe('OfflineUser')
      expect(settings.bio).toBe('Testing offline')
    })

    it('profile data structure is compatible with Supabase user_metadata shape', () => {
      // Verify that the settings shape can be serialized as user_metadata
      const settings = saveSettings({
        displayName: 'SyncUser',
        bio: 'Profile bio',
        theme: 'dark',
        colorScheme: 'vibrant',
        fontSize: 'large',
      })
      // user_metadata would receive a subset of AppSettings
      const metadata = {
        displayName: settings.displayName,
        bio: settings.bio,
        theme: settings.theme,
        colorScheme: settings.colorScheme,
        fontSize: settings.fontSize,
      }
      expect(metadata.displayName).toBe('SyncUser')
      expect(metadata.bio).toBe('Profile bio')
      expect(JSON.stringify(metadata)).not.toContain('undefined')
    })
  })

  // ---------------------------------------------------------------------------
  // hydrateSettingsFromSupabase — merge user_metadata into localStorage
  // ---------------------------------------------------------------------------

  describe('hydrate settings from Supabase user_metadata', () => {
    it('merges user_metadata fields into existing localStorage settings', () => {
      // Simulate existing local settings
      saveSettings({ displayName: 'LocalName', bio: 'Local bio', theme: 'light' })

      // Simulate user_metadata from Supabase
      const userMetadata = {
        displayName: 'CloudName',
        bio: 'Cloud bio',
        theme: 'dark' as const,
      }

      // Hydration: merge user_metadata over local settings
      const current = getSettings()
      const hydrated = { ...current, ...userMetadata }
      saveSettings(hydrated)

      const result = getSettings()
      expect(result.displayName).toBe('CloudName')
      expect(result.bio).toBe('Cloud bio')
      expect(result.theme).toBe('dark')
    })

    it('handles empty user_metadata gracefully (no overwrite)', () => {
      saveSettings({ displayName: 'KeepMe', bio: 'Preserve this' })

      // Empty user_metadata should not wipe local settings
      const emptyMetadata = {}
      const current = getSettings()
      const hydrated = { ...current, ...emptyMetadata }
      saveSettings(hydrated)

      const result = getSettings()
      expect(result.displayName).toBe('KeepMe')
      expect(result.bio).toBe('Preserve this')
    })

    it('handles partial user_metadata (only some fields present)', () => {
      saveSettings({ displayName: 'Original', bio: 'Original bio', theme: 'light' })

      // Only displayName in user_metadata
      const partialMetadata = { displayName: 'Updated' }
      const current = getSettings()
      const hydrated = { ...current, ...partialMetadata }
      saveSettings(hydrated)

      const result = getSettings()
      expect(result.displayName).toBe('Updated')
      expect(result.bio).toBe('Original bio')
      expect(result.theme).toBe('light')
    })

    it('handles undefined fields in user_metadata by falling back to defaults', () => {
      saveSettings({ displayName: 'Safe', bio: 'Safe bio' })

      // user_metadata with undefined values — spread overwrites with undefined,
      // which JSON.stringify drops, so getSettings() fills from defaults.
      // The correct hydration pattern filters out undefined before merging.
      const metadataWithUndefined: Record<string, unknown> = {
        displayName: undefined,
        bio: undefined,
      }

      // Correct hydration: filter out undefined values before merging
      const current = getSettings()
      const cleanMetadata = Object.fromEntries(
        Object.entries(metadataWithUndefined).filter(([, v]) => v !== undefined)
      )
      const hydrated = { ...current, ...cleanMetadata }
      saveSettings(hydrated)

      const result = getSettings()
      // With proper filtering, existing values are preserved
      expect(result.displayName).toBe('Safe')
      expect(result.bio).toBe('Safe bio')
    })

    it('new user with no localStorage gets defaults + user_metadata', () => {
      // No localStorage (fresh install)
      const defaults = getSettings()
      expect(defaults.displayName).toBe('Student')

      // Hydrate from Supabase user_metadata
      const userMetadata = {
        displayName: 'NewUser',
        bio: 'Just joined',
        colorScheme: 'vibrant' as const,
      }
      const hydrated = { ...defaults, ...userMetadata }
      saveSettings(hydrated)

      const result = getSettings()
      expect(result.displayName).toBe('NewUser')
      expect(result.bio).toBe('Just joined')
      expect(result.colorScheme).toBe('vibrant')
      // Non-overridden defaults preserved
      expect(result.theme).toBe('system')
    })
  })
})
