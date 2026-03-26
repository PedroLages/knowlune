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
})
