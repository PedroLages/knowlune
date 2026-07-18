/**
 * Zustand store for Courses page filter state with sessionStorage persistence.
 *
 * Manages source, track visibility, tag, and status filters for the Courses
 * page. Follows the BookFilters setFilter(key, value) single-dimension setter
 * pattern to prevent one filter change from silently clearing others.
 *
 * Persists to sessionStorage so filter state survives SPA navigation but
 * resets on full page reload (R12).
 *
 * @module useCourseFilterStore
 * @since feat: courses-content-separation
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CourseSource, Difficulty, LearnerCourseStatus } from '@/data/types'

const STORAGE_KEY = 'knowlune-courses-filter-v2'

export type CourseSourceFilter = 'all' | CourseSource

export interface CourseFilters {
  source: CourseSourceFilter
  showTrackCourses: boolean
  selectedTags: string[]
  selectedStatuses: LearnerCourseStatus[]
  selectedDifficulties: Difficulty[]
  selectedCategories: string[]
  selectedAuthorIds: string[]
}

interface CourseFilterState {
  source: CourseSourceFilter
  showTrackCourses: boolean
  selectedTags: string[]
  selectedStatuses: LearnerCourseStatus[]
  selectedDifficulties: Difficulty[]
  selectedCategories: string[]
  selectedAuthorIds: string[]

  setFilter: <K extends keyof CourseFilters>(key: K, value: CourseFilters[K]) => void
  clearFilter: <K extends keyof CourseFilters>(key: K) => void
  clearAllFilters: () => void
  isAnyFilterActive: () => boolean
}

const DEFAULT_FILTERS: CourseFilters = {
  source: 'all',
  showTrackCourses: false,
  selectedTags: [],
  selectedStatuses: [],
  selectedDifficulties: [],
  selectedCategories: [],
  selectedAuthorIds: [],
}

export const useCourseFilterStore = create<CourseFilterState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_FILTERS,

      /**
       * Single-dimension setter — changes only the specified filter dimension.
       * Follows the BookFilters pattern to prevent silently clearing other filters.
       */
      setFilter: (key, value) => {
        set({ [key]: value })
      },

      /**
       * Clear a single filter dimension back to its default.
       */
      clearFilter: key => {
        set({ [key]: DEFAULT_FILTERS[key] })
      },

      /**
       * Reset all filter dimensions to defaults.
       * Used by the empty state "Clear all filters" button.
       */
      clearAllFilters: () => {
        set({ ...DEFAULT_FILTERS })
      },

      /**
       * Returns true when any advanced filter is active. Status is intentionally
       * excluded because it is always visible in the primary toolbar.
       */
      isAnyFilterActive: () => {
        const state = get()
        return (
          state.source !== 'all' ||
          state.showTrackCourses !== DEFAULT_FILTERS.showTrackCourses ||
          state.selectedTags.length > 0 ||
          state.selectedDifficulties.length > 0 ||
          state.selectedCategories.length > 0 ||
          state.selectedAuthorIds.length > 0
        )
      },
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => sessionStorage),
      // Only persist filter dimensions — not derived selectors or actions
      partialize: state => ({
        source: state.source,
        showTrackCourses: state.showTrackCourses,
        selectedTags: state.selectedTags,
        selectedStatuses: state.selectedStatuses,
        selectedDifficulties: state.selectedDifficulties,
        selectedCategories: state.selectedCategories,
        selectedAuthorIds: state.selectedAuthorIds,
      }),
    }
  )
)
