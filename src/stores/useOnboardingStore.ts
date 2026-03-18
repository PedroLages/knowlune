import { create } from 'zustand'

const STORAGE_KEY = 'levelup-onboarding-v1'

export type OnboardingStep = 0 | 1 | 2 | 3

interface OnboardingState {
  /** 0 = not started, 1-3 = active steps, 3 = final step before completion */
  currentStep: OnboardingStep
  /** Whether the overlay is currently visible */
  isActive: boolean
  /** ISO timestamp when onboarding was completed or skipped */
  completedAt: string | null
  /** Whether onboarding was skipped rather than completed */
  skipped: boolean
}

interface OnboardingActions {
  /** Initialize onboarding — show overlay if not previously completed */
  initialize: () => void
  /** Advance to the next step */
  advanceStep: () => void
  /** Skip onboarding entirely */
  skipOnboarding: () => void
  /** Mark onboarding as completed (all 3 steps done) */
  completeOnboarding: () => void
  /** Dismiss the overlay without changing completion state */
  dismiss: () => void
}

type OnboardingStore = OnboardingState & OnboardingActions

function loadPersistedState(): Pick<OnboardingState, 'completedAt' | 'skipped'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        completedAt: parsed.completedAt ?? null,
        skipped: parsed.skipped ?? false,
      }
    }
  } catch {
    // Corrupted data — treat as fresh start
  }
  return { completedAt: null, skipped: false }
}

function persistCompletion(completedAt: string, skipped: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedAt, skipped }))
  } catch {
    // localStorage full or unavailable — non-blocking
  }
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  currentStep: 0,
  isActive: false,
  completedAt: null,
  skipped: false,

  initialize: () => {
    const persisted = loadPersistedState()
    if (persisted.completedAt) {
      // Already completed or skipped — don't show
      set({ completedAt: persisted.completedAt, skipped: persisted.skipped })
      return
    }
    set({ isActive: true, currentStep: 1 })
  },

  advanceStep: () => {
    const { currentStep } = get()
    if (currentStep < 3) {
      set({ currentStep: (currentStep + 1) as OnboardingStep })
    }
  },

  skipOnboarding: () => {
    const now = new Date().toISOString()
    persistCompletion(now, true)
    set({ isActive: false, completedAt: now, skipped: true })
  },

  completeOnboarding: () => {
    const now = new Date().toISOString()
    persistCompletion(now, false)
    set({ isActive: false, completedAt: now, skipped: false, currentStep: 3 })
  },

  dismiss: () => {
    set({ isActive: false })
  },
}))
