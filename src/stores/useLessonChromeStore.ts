import { create } from 'zustand'

const STORAGE_KEY = 'lesson-theater-mode'
const AUTO_PLAY_KEY = 'lesson-auto-play'

function readStoredTheater(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'true'
  } catch {
    // silent-catch-ok — localStorage unavailable (private browsing); default to false
    return false
  }
}

function persistTheater(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // silent-catch-ok — storage full or blocked; degrade gracefully
  }
}

function readStoredAutoPlay(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_PLAY_KEY)
    // Default to true (enabled) when no stored preference exists
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

function persistAutoPlay(value: boolean): void {
  try {
    localStorage.setItem(AUTO_PLAY_KEY, String(value))
  } catch {
    // silent-catch-ok
  }
}

/**
 * Module-level reference to the reading mode toggle callback registered
 * by useReadingMode. Stored outside Zustand state because function references
 * do not belong in serialized state and would cause stale-closure issues.
 */
let readingModeToggleFn: (() => void) | null = null

export interface LessonChromeState {
  /** Whether theater mode is active (hides sidebar, expands content). */
  isTheater: boolean
  /** Toggle theater mode. Updates data-theater-mode DOM attribute and persists. */
  toggleTheater: () => void

  /** Whether reading mode is active. Read-only from the store — use syncReadingMode() to update. */
  isReadingMode: boolean
  /** Toggle reading mode. Delegates to a callback registered by useReadingMode. */
  toggleReadingMode: () => void
  /** Sync isReadingMode without side effects (DOM managed by useReadingMode hook). */
  syncReadingMode: (value: boolean) => void
  /** Register the toggle callback from useReadingMode. Pass null to unregister. */
  registerReadingModeToggle: (fn: (() => void) | null) => void

  /** Whether the notes panel is open. */
  notesOpen: boolean
  /** Toggle the notes panel open/closed. */
  toggleNotes: () => void
  /** Set the notes panel open/closed to a specific value (used for deep-linking, theater mode close). */
  setNotesOpen: (open: boolean) => void
  /** Whether the current lesson has notes content. */
  hasNotes: boolean
  /** Set whether the current lesson has notes content. */
  setHasNotes: (value: boolean) => void

  /** Whether auto-play after auto-advance is enabled. Persisted to localStorage. */
  autoPlay: boolean
  /** Toggle auto-play preference. Updates localStorage. */
  toggleAutoPlay: () => void

  /** Whether the QA chat panel is open. */
  qaPanelOpen: boolean
  /** Toggle the QA chat panel open/closed. */
  toggleQAPanel: () => void
  /** Set the QA panel open/closed to a specific value (matches Radix onOpenChange contract). */
  setQAPanelOpen: (open: boolean) => void

  /** Mobile floating notes panel state: closed pill, expanded panel, or fullscreen overlay. */
  mobileNotesPanel: 'closed' | 'expanded' | 'fullscreen'
  /** Set the mobile notes panel to a specific state. */
  setMobileNotesPanel: (state: 'closed' | 'expanded' | 'fullscreen') => void
  /** Convenience: open the mobile notes panel to expanded state. */
  openMobileNotesPanel: () => void
  /** Convenience: close the mobile notes panel to closed (pill) state. */
  closeMobileNotesPanel: () => void
  /** Convenience: maximize the mobile notes panel to fullscreen overlay. */
  maximizeMobileNotesPanel: () => void

  /** Reset all state to defaults. Called on route change when leaving a lesson page. */
  reset: () => void
}

export const useLessonChromeStore = create<LessonChromeState>((set, get) => ({
  isTheater: readStoredTheater(),

  toggleTheater: () => {
    const next = !get().isTheater
    if (next) {
      document.documentElement.setAttribute('data-theater-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-theater-mode')
    }
    persistTheater(next)
    set({ isTheater: next })
  },

  isReadingMode: false,

  toggleReadingMode: () => {
    if (readingModeToggleFn) {
      readingModeToggleFn()
    }
  },

  syncReadingMode: (value: boolean) => {
    set({ isReadingMode: value })
  },

  registerReadingModeToggle: (fn: (() => void) | null) => {
    readingModeToggleFn = fn
  },

  notesOpen: false,

  toggleNotes: () => {
    set(s => ({ notesOpen: !s.notesOpen }))
  },

  setNotesOpen: (open: boolean) => {
    set({ notesOpen: open })
  },

  hasNotes: false,

  setHasNotes: (value: boolean) => {
    set({ hasNotes: value })
  },

  autoPlay: readStoredAutoPlay(),

  toggleAutoPlay: () => {
    const next = !get().autoPlay
    persistAutoPlay(next)
    set({ autoPlay: next })
  },

  qaPanelOpen: false,

  toggleQAPanel: () => {
    set(s => ({ qaPanelOpen: !s.qaPanelOpen }))
  },

  setQAPanelOpen: (open: boolean) => {
    set({ qaPanelOpen: open })
  },

  mobileNotesPanel: 'closed',

  setMobileNotesPanel: (state: 'closed' | 'expanded' | 'fullscreen') => {
    set({ mobileNotesPanel: state })
  },

  openMobileNotesPanel: () => {
    set({ mobileNotesPanel: 'expanded' })
  },

  closeMobileNotesPanel: () => {
    set({ mobileNotesPanel: 'closed' })
  },

  maximizeMobileNotesPanel: () => {
    set({ mobileNotesPanel: 'fullscreen' })
  },

  reset: () => {
    readingModeToggleFn = null
    document.documentElement.removeAttribute('data-theater-mode')
    set({
      isTheater: false,
      isReadingMode: false,
      notesOpen: false,
      hasNotes: false,
      qaPanelOpen: false,
      mobileNotesPanel: 'closed',
    })
  },
}))

// H2: Initialize DOM data-theater-mode attribute from persisted state on page load.
// The toggleTheater() handler manages the attribute during toggles, but the initial
// value from localStorage must also be reflected in the DOM.
if (useLessonChromeStore.getState().isTheater) {
  document.documentElement.setAttribute('data-theater-mode', 'true')
}
