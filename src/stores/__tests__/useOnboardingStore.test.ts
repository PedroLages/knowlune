import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock useCourseImportStore — onboarding checks for existing courses
vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: {
    getState: () => ({ importedCourses: [] }),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

const { useOnboardingStore } = await import('@/stores/useOnboardingStore')

beforeEach(() => {
  localStorage.clear()
  useOnboardingStore.setState({
    currentStep: 0,
    isActive: false,
    completedAt: null,
    skipped: false,
  })
})

describe('useOnboardingStore', () => {
  describe('initialize()', () => {
    it('shows wizard when no prior completion exists', () => {
      useOnboardingStore.getState().initialize()
      expect(useOnboardingStore.getState().isActive).toBe(true)
      expect(useOnboardingStore.getState().currentStep).toBe(1)
    })

    it('does not show wizard when already completed', () => {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00Z', skipped: false })
      )
      useOnboardingStore.getState().initialize()
      expect(useOnboardingStore.getState().isActive).toBe(false)
    })
  })

  describe('skipOnboarding()', () => {
    it('persists and does not re-appear on initialize', () => {
      useOnboardingStore.getState().initialize()
      useOnboardingStore.getState().skipOnboarding()
      expect(useOnboardingStore.getState().isActive).toBe(false)

      // Simulate page reload
      useOnboardingStore.setState({
        currentStep: 0,
        isActive: false,
        completedAt: null,
        skipped: false,
      })
      useOnboardingStore.getState().initialize()
      expect(useOnboardingStore.getState().isActive).toBe(false)
    })
  })

  describe('dismiss()', () => {
    it('persists dismissed state so wizard does not re-appear on initialize', () => {
      useOnboardingStore.getState().initialize()
      expect(useOnboardingStore.getState().isActive).toBe(true)

      useOnboardingStore.getState().dismiss()
      expect(useOnboardingStore.getState().isActive).toBe(false)

      // Simulate page reload — reset in-memory state
      useOnboardingStore.setState({
        currentStep: 0,
        isActive: false,
        completedAt: null,
        skipped: false,
      })
      useOnboardingStore.getState().initialize()

      // Wizard should NOT re-appear
      expect(useOnboardingStore.getState().isActive).toBe(false)
    })
  })

  describe('advanceStep()', () => {
    it('should advance from step 1 to 2', () => {
      useOnboardingStore.getState().initialize()
      expect(useOnboardingStore.getState().currentStep).toBe(1)

      useOnboardingStore.getState().advanceStep()
      expect(useOnboardingStore.getState().currentStep).toBe(2)
    })

    it('should advance from step 2 to 3', () => {
      useOnboardingStore.setState({ currentStep: 2, isActive: true })
      useOnboardingStore.getState().advanceStep()
      expect(useOnboardingStore.getState().currentStep).toBe(3)
    })

    it('should not advance beyond step 3', () => {
      useOnboardingStore.setState({ currentStep: 3, isActive: true })
      useOnboardingStore.getState().advanceStep()
      expect(useOnboardingStore.getState().currentStep).toBe(3)
    })
  })

  describe('completeOnboarding()', () => {
    it('should mark as completed with skipped=false', () => {
      useOnboardingStore.getState().initialize()
      useOnboardingStore.getState().completeOnboarding()

      const state = useOnboardingStore.getState()
      expect(state.isActive).toBe(false)
      expect(state.completedAt).toBeTruthy()
      expect(state.skipped).toBe(false)
      expect(state.currentStep).toBe(3)
    })

    it('should persist completion to localStorage', () => {
      useOnboardingStore.getState().completeOnboarding()
      const stored = JSON.parse(localStorage.getItem('knowlune-onboarding-v1')!)
      expect(stored.completedAt).toBeTruthy()
      expect(stored.skipped).toBe(false)
    })
  })

  describe('legacy key migration', () => {
    it('should migrate legacy key to new key', () => {
      localStorage.setItem(
        'levelup-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00Z', skipped: false })
      )

      useOnboardingStore.getState().initialize()

      // Should have migrated
      expect(localStorage.getItem('levelup-onboarding-v1')).toBeNull()
      expect(localStorage.getItem('knowlune-onboarding-v1')).toBeTruthy()
      expect(useOnboardingStore.getState().isActive).toBe(false)
    })

    it('should not overwrite existing new key with legacy', () => {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-03-01T00:00:00Z', skipped: true })
      )
      localStorage.setItem(
        'levelup-onboarding-v1',
        JSON.stringify({ completedAt: '2025-01-01T00:00:00Z', skipped: false })
      )

      useOnboardingStore.getState().initialize()

      // Should use new key, not legacy
      expect(useOnboardingStore.getState().completedAt).toBe('2026-03-01T00:00:00Z')
    })
  })

  describe('corrupted localStorage', () => {
    it('should handle corrupted data in localStorage', () => {
      localStorage.setItem('knowlune-onboarding-v1', 'not json')

      useOnboardingStore.getState().initialize()
      // Should show wizard (treat as fresh)
      expect(useOnboardingStore.getState().isActive).toBe(true)
    })

    it('should handle localStorage with missing fields', () => {
      localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ other: true }))

      useOnboardingStore.getState().initialize()
      // completedAt is null → show wizard
      expect(useOnboardingStore.getState().isActive).toBe(true)
    })
  })

  describe('existing user detection', () => {
    it('should skip onboarding when user has imported courses', async () => {
      // Re-mock with courses
      vi.doMock('@/stores/useCourseImportStore', () => ({
        useCourseImportStore: {
          getState: () => ({ importedCourses: [{ id: 'c1', name: 'Existing Course' }] }),
          subscribe: vi.fn(() => vi.fn()),
        },
      }))

      vi.resetModules()
      const { useOnboardingStore: freshStore } = await import('@/stores/useOnboardingStore')

      freshStore.getState().initialize()
      expect(freshStore.getState().isActive).toBe(false)
      expect(freshStore.getState().skipped).toBe(true)
      expect(freshStore.getState().completedAt).toBeTruthy()
    })
  })

  describe('localStorage persistence error', () => {
    it('should handle localStorage write failure', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded')
      })

      // Should not throw
      useOnboardingStore.getState().completeOnboarding()
      expect(useOnboardingStore.getState().completedAt).toBeTruthy()

      setItemSpy.mockRestore()
    })
  })
})
