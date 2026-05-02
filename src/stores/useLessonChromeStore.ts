import { create } from 'zustand'

const STORAGE_KEY = 'lesson-theater-mode'

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
  /** Register the toggle callback from useReadingMode. */
  registerReadingModeToggle: (fn: () => void) => void

  /** Whether the notes panel is open. */
  notesOpen: boolean
  /** Toggle the notes panel open/closed. */
  toggleNotes: () => void
  /** Whether the current lesson has notes content. */
  hasNotes: boolean
  /** Set whether the current lesson has notes content. */
  setHasNotes: (value: boolean) => void

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

  registerReadingModeToggle: (fn: () => void) => {
    readingModeToggleFn = fn
  },

  notesOpen: false,

  toggleNotes: () => {
    set(s => ({ notesOpen: !s.notesOpen }))
  },

  hasNotes: false,

  setHasNotes: (value: boolean) => {
    set({ hasNotes: value })
  },

  reset: () => {
    readingModeToggleFn = null
    document.documentElement.removeAttribute('data-theater-mode')
    set({
      isTheater: false,
      isReadingMode: false,
      notesOpen: false,
      hasNotes: false,
    })
  },
}))
