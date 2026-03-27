import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWelcomeWizardStore } from '@/stores/useWelcomeWizardStore'

beforeEach(() => {
  localStorage.clear()
  useWelcomeWizardStore.setState({
    isOpen: false,
    completedAt: null,
  })
})

describe('useWelcomeWizardStore initial state', () => {
  it('should have correct defaults', () => {
    const state = useWelcomeWizardStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.completedAt).toBeNull()
  })
})

describe('initialize', () => {
  it('should open wizard when no prior completion exists', () => {
    useWelcomeWizardStore.getState().initialize()
    expect(useWelcomeWizardStore.getState().isOpen).toBe(true)
  })

  it('should not open wizard when already completed', () => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00Z' })
    )

    useWelcomeWizardStore.getState().initialize()
    expect(useWelcomeWizardStore.getState().isOpen).toBe(false)
    expect(useWelcomeWizardStore.getState().completedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('should handle corrupted localStorage gracefully', () => {
    localStorage.setItem('knowlune-welcome-wizard-v1', 'not valid json')

    useWelcomeWizardStore.getState().initialize()
    // Should open wizard (treat as fresh)
    expect(useWelcomeWizardStore.getState().isOpen).toBe(true)
  })

  it('should handle localStorage with missing completedAt', () => {
    localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ other: true }))

    useWelcomeWizardStore.getState().initialize()
    // completedAt is null → show wizard
    expect(useWelcomeWizardStore.getState().isOpen).toBe(true)
  })
})

describe('complete', () => {
  it('should close wizard and set completedAt', () => {
    useWelcomeWizardStore.setState({ isOpen: true })
    useWelcomeWizardStore.getState().complete()

    const state = useWelcomeWizardStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.completedAt).toBeTruthy()
  })

  it('should persist completedAt to localStorage', () => {
    useWelcomeWizardStore.getState().complete()

    const stored = JSON.parse(localStorage.getItem('knowlune-welcome-wizard-v1')!)
    expect(stored.completedAt).toBeTruthy()
  })

  it('should prevent wizard from re-appearing after initialize', () => {
    useWelcomeWizardStore.getState().complete()

    // Reset in-memory state to simulate page reload
    useWelcomeWizardStore.setState({ isOpen: false, completedAt: null })

    useWelcomeWizardStore.getState().initialize()
    expect(useWelcomeWizardStore.getState().isOpen).toBe(false)
  })
})

describe('dismiss', () => {
  it('should close wizard and set completedAt', () => {
    useWelcomeWizardStore.setState({ isOpen: true })
    useWelcomeWizardStore.getState().dismiss()

    const state = useWelcomeWizardStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.completedAt).toBeTruthy()
  })

  it('should persist to localStorage', () => {
    useWelcomeWizardStore.getState().dismiss()

    const stored = JSON.parse(localStorage.getItem('knowlune-welcome-wizard-v1')!)
    expect(stored.completedAt).toBeTruthy()
  })

  it('should prevent wizard from re-appearing', () => {
    useWelcomeWizardStore.getState().dismiss()

    useWelcomeWizardStore.setState({ isOpen: false, completedAt: null })
    useWelcomeWizardStore.getState().initialize()
    expect(useWelcomeWizardStore.getState().isOpen).toBe(false)
  })
})

describe('localStorage persistence errors', () => {
  it('should handle localStorage write failure in persist', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })

    // Should not throw
    useWelcomeWizardStore.getState().complete()
    expect(useWelcomeWizardStore.getState().completedAt).toBeTruthy()

    setItemSpy.mockRestore()
  })
})
