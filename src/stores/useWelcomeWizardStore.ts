import { create } from 'zustand'

const STORAGE_KEY = 'knowlune-welcome-wizard-v1'

interface WelcomeWizardState {
  /** Whether the wizard dialog is visible */
  isOpen: boolean
  /** ISO timestamp when the wizard was completed or dismissed */
  completedAt: string | null
}

interface WelcomeWizardActions {
  /** Show the wizard if it hasn't been completed before */
  initialize: () => void
  /** Mark wizard as completed and close it */
  complete: () => void
  /** Dismiss (skip) the wizard */
  dismiss: () => void
}

type WelcomeWizardStore = WelcomeWizardState & WelcomeWizardActions

function loadPersisted(): { completedAt: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { completedAt: parsed.completedAt ?? null }
    }
  } catch (err) {
    // Corrupted data — treat as fresh
    console.error('[useWelcomeWizardStore] Failed to load persisted state, using defaults:', err)
  }
  return { completedAt: null }
}

function persist(completedAt: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedAt }))
  } catch (err) {
    // localStorage full — non-blocking
    console.error('[useWelcomeWizardStore] Failed to persist state:', err)
  }
}

export const useWelcomeWizardStore = create<WelcomeWizardStore>(set => ({
  isOpen: false,
  completedAt: null,

  initialize: () => {
    const persisted = loadPersisted()
    if (persisted.completedAt) {
      set({ completedAt: persisted.completedAt })
      return
    }
    set({ isOpen: true })
  },

  complete: () => {
    const now = new Date().toISOString()
    persist(now)
    set({ isOpen: false, completedAt: now })
  },

  dismiss: () => {
    const now = new Date().toISOString()
    persist(now)
    set({ isOpen: false, completedAt: now })
  },
}))
