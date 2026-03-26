import { create } from 'zustand'

// --- Types ---

export type ImportPhase = 'scanning' | 'processing' | 'complete' | 'cancelled'

export interface CourseImportProgress {
  courseId: string
  courseName: string
  phase: ImportPhase
  /** Number of files processed so far */
  filesProcessed: number
  /** Total files discovered (null if still scanning) */
  totalFiles: number | null
  /** Timestamp when this course started importing */
  startedAt: number
  /** Error message if failed */
  error?: string
}

interface ImportProgressState {
  /** Whether any import is currently active */
  isActive: boolean
  /** Whether the overlay is visible (user can dismiss but import continues) */
  isVisible: boolean
  /** Map of courseId → progress for each importing course */
  courses: Map<string, CourseImportProgress>
  /** Cancellation signal — checked by import loops */
  cancelRequested: boolean

  // Actions
  startImport: (courseId: string, courseName: string) => void
  updateScanProgress: (courseId: string, filesProcessed: number, totalFiles: number | null) => void
  updateProcessingProgress: (courseId: string, filesProcessed: number, totalFiles: number) => void
  completeCourse: (courseId: string) => void
  failCourse: (courseId: string, error: string) => void
  cancelImport: () => void
  confirmCancellation: () => void
  dismissOverlay: () => void
  showOverlay: () => void
  reset: () => void
}

export const useImportProgressStore = create<ImportProgressState>((set, _get) => ({
  isActive: false,
  isVisible: false,
  courses: new Map(),
  cancelRequested: false,

  startImport: (courseId: string, courseName: string) => {
    set(state => {
      const courses = new Map(state.courses)
      courses.set(courseId, {
        courseId,
        courseName,
        phase: 'scanning',
        filesProcessed: 0,
        totalFiles: null,
        startedAt: Date.now(),
      })
      return { courses, isActive: true, isVisible: true, cancelRequested: false }
    })
  },

  updateScanProgress: (courseId: string, filesProcessed: number, totalFiles: number | null) => {
    set(state => {
      const courses = new Map(state.courses)
      const existing = courses.get(courseId)
      if (existing && existing.phase !== 'complete' && existing.phase !== 'cancelled') {
        courses.set(courseId, {
          ...existing,
          phase: 'scanning',
          filesProcessed,
          totalFiles,
        })
      }
      return { courses }
    })
  },

  updateProcessingProgress: (courseId: string, filesProcessed: number, totalFiles: number) => {
    set(state => {
      const courses = new Map(state.courses)
      const existing = courses.get(courseId)
      if (existing && existing.phase !== 'complete' && existing.phase !== 'cancelled') {
        courses.set(courseId, {
          ...existing,
          phase: 'processing',
          filesProcessed,
          totalFiles,
        })
      }
      return { courses }
    })
  },

  completeCourse: (courseId: string) => {
    set(state => {
      const courses = new Map(state.courses)
      const existing = courses.get(courseId)
      if (existing) {
        courses.set(courseId, {
          ...existing,
          phase: 'complete',
        })
      }
      // Check if all courses are done
      const allDone = [...courses.values()].every(
        c => c.phase === 'complete' || c.phase === 'cancelled' || c.error
      )
      return { courses, isActive: !allDone }
    })
  },

  failCourse: (courseId: string, error: string) => {
    set(state => {
      const courses = new Map(state.courses)
      const existing = courses.get(courseId)
      if (existing) {
        courses.set(courseId, {
          ...existing,
          error,
        })
      }
      const allDone = [...courses.values()].every(
        c => c.phase === 'complete' || c.phase === 'cancelled' || c.error
      )
      return { courses, isActive: !allDone }
    })
  },

  cancelImport: () => {
    set({ cancelRequested: true })
  },

  confirmCancellation: () => {
    set(state => {
      const courses = new Map(state.courses)
      for (const [id, course] of courses) {
        if (course.phase !== 'complete' && !course.error) {
          courses.set(id, { ...course, phase: 'cancelled' })
        }
      }
      return {
        courses,
        isActive: false,
        cancelRequested: false,
      }
    })
  },

  dismissOverlay: () => {
    set({ isVisible: false })
  },

  showOverlay: () => {
    set({ isVisible: true })
  },

  reset: () => {
    set({
      isActive: false,
      isVisible: false,
      courses: new Map(),
      cancelRequested: false,
    })
  },
}))
