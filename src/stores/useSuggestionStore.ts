import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'levelup-dismissed-suggestions'

interface SuggestionState {
  /** Keys are completedCourseIds that have been dismissed */
  dismissed: Record<string, true>
  dismiss: (completedCourseId: string) => void
  isDismissed: (completedCourseId: string) => boolean
  /** Reset all dismissals — used in tests */
  reset: () => void
}

export const useSuggestionStore = create<SuggestionState>()(
  persist(
    (set, get) => ({
      dismissed: {},

      dismiss: (completedCourseId: string) => {
        set(state => ({
          dismissed: { ...state.dismissed, [completedCourseId]: true },
        }))
      },

      isDismissed: (completedCourseId: string) => {
        return !!get().dismissed[completedCourseId]
      },

      reset: () => {
        set({ dismissed: {} })
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
)
