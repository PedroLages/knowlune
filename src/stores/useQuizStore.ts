import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quiz, QuizProgress, QuizAttempt } from '@/types/quiz'
import { db } from '@/db'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateQuizScore } from '@/lib/scoring'
import { toastError } from '@/lib/toastHelpers'
import { useContentProgressStore } from '@/stores/useContentProgressStore'

interface QuizState {
  currentQuiz: Quiz | null
  currentProgress: QuizProgress | null
  attempts: QuizAttempt[]
  isLoading: boolean
  error: string | null

  startQuiz: (lessonId: string) => Promise<void>
  submitAnswer: (questionId: string, answer: string | string[]) => void
  submitQuiz: (courseId: string) => Promise<void>
  retakeQuiz: (lessonId: string) => Promise<void>
  loadAttempts: (quizId: string) => Promise<void>
  resumeQuiz: () => void
  clearQuiz: () => void
  goToNextQuestion: () => void
  goToPrevQuestion: () => void
  navigateToQuestion: (index: number) => void
  toggleReviewMark: (questionId: string) => void
  clearError: () => void
}

/** Fisher-Yates shuffle — returns a new array */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      currentQuiz: null,
      currentProgress: null,
      attempts: [],
      isLoading: false,
      error: null,

      startQuiz: async (lessonId: string) => {
        set({ isLoading: true, error: null })

        try {
          const quiz = await db.quizzes.where('lessonId').equals(lessonId).first()
          if (!quiz) {
            set({
              currentQuiz: null,
              currentProgress: null,
              isLoading: false,
              error: 'Quiz not found',
            })
            return
          }

          const questionOrder = quiz.shuffleQuestions
            ? shuffleArray(quiz.questions.map(q => q.id))
            : quiz.questions.map(q => q.id)

          const progress: QuizProgress = {
            quizId: quiz.id,
            currentQuestionIndex: 0,
            answers: {},
            startTime: Date.now(),
            // TODO(E15-S02): Apply timerAccommodation multiplier when timer accommodations are implemented
            timeRemaining: quiz.timeLimit ?? null,
            isPaused: false,
            markedForReview: [],
            questionOrder,
            timerAccommodation: 'standard',
          }

          set({ currentQuiz: quiz, currentProgress: progress, isLoading: false })
        } catch (err) {
          console.error('[useQuizStore] startQuiz failed:', err)
          set({ isLoading: false, error: 'Failed to load quiz' })
        }
      },

      submitAnswer: (questionId: string, answer: string | string[]) => {
        set(state => ({
          currentProgress: state.currentProgress
            ? {
                ...state.currentProgress,
                answers: { ...state.currentProgress.answers, [questionId]: answer },
              }
            : null,
        }))
      },

      submitQuiz: async (courseId: string) => {
        const { currentQuiz, currentProgress } = get()
        if (!currentQuiz || !currentProgress) return

        // Snapshot for rollback on failure
        const snapshot = { currentQuiz, currentProgress }

        const result = calculateQuizScore(currentQuiz, currentProgress.answers)

        const attempt: QuizAttempt = {
          id: crypto.randomUUID(),
          quizId: currentQuiz.id,
          answers: result.answers,
          score: result.score,
          percentage: result.percentage,
          passed: result.passed,
          timeSpent: Date.now() - currentProgress.startTime,
          completedAt: new Date().toISOString(),
          startedAt: new Date(currentProgress.startTime).toISOString(),
          timerAccommodation: currentProgress.timerAccommodation,
        }

        set({ isLoading: true })

        try {
          await persistWithRetry(async () => {
            await db.quizAttempts.add(attempt)
          })

          // Cross-store: mark lesson complete only after successful DB write.
          // Isolated in its own try/catch — a failure here does NOT roll back the
          // already-persisted quiz attempt.
          if (result.passed) {
            try {
              const course = await db.courses.get(courseId)
              const modules = course?.modules ?? []
              await useContentProgressStore
                .getState()
                .setItemStatus(courseId, currentQuiz.lessonId, 'completed', modules)
            } catch (err) {
              console.error('[useQuizStore] setItemStatus failed after quiz submit:', err)
            }
          }

          set({
            attempts: [...get().attempts, attempt],
            currentProgress: null,
            isLoading: false,
          })
        } catch (err) {
          console.error('[useQuizStore] submitQuiz failed:', err)
          set({ ...snapshot, isLoading: false, error: 'Failed to save quiz attempt' })
          toastError.saveFailed(
            err instanceof Error
              ? err.message
              : 'Quiz attempt could not be saved. Your answers are preserved.'
          )
        }
      },

      retakeQuiz: async (lessonId: string) => {
        await get().startQuiz(lessonId)
      },

      loadAttempts: async (quizId: string) => {
        try {
          const attempts = await db.quizAttempts
            .where('quizId')
            .equals(quizId)
            .sortBy('completedAt')
          set({ attempts })
        } catch (err) {
          console.error('[useQuizStore] loadAttempts failed:', err)
          set({ error: 'Failed to load quiz history' })
        }
      },

      resumeQuiz: () => {
        // No-op — persist middleware rehydrates currentProgress automatically on store init
      },

      clearQuiz: () => {
        set({ currentQuiz: null, currentProgress: null, attempts: [], error: null })
      },

      goToNextQuestion: () => {
        const { currentProgress, currentQuiz } = get()
        if (!currentProgress || !currentQuiz) return
        if (currentProgress.currentQuestionIndex >= currentQuiz.questions.length - 1) return
        set({
          currentProgress: {
            ...currentProgress,
            currentQuestionIndex: currentProgress.currentQuestionIndex + 1,
          },
        })
      },

      goToPrevQuestion: () => {
        const { currentProgress } = get()
        if (!currentProgress || currentProgress.currentQuestionIndex <= 0) return
        set({
          currentProgress: {
            ...currentProgress,
            currentQuestionIndex: currentProgress.currentQuestionIndex - 1,
          },
        })
      },

      navigateToQuestion: (index: number) => {
        if (!Number.isInteger(index)) return
        const { currentProgress, currentQuiz } = get()
        if (!currentProgress || !currentQuiz) return
        if (!Number.isFinite(index) || index < 0 || index >= currentQuiz.questions.length) return
        set({
          currentProgress: { ...currentProgress, currentQuestionIndex: index },
        })
      },

      toggleReviewMark: (questionId: string) => {
        set(state => {
          if (!state.currentProgress) return {}
          const marked = state.currentProgress.markedForReview
          const next = marked.includes(questionId)
            ? marked.filter(id => id !== questionId)
            : [...marked, questionId]
          return {
            currentProgress: { ...state.currentProgress, markedForReview: next },
          }
        })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'levelup-quiz-store',
      partialize: state => ({
        currentProgress: state.currentProgress,
        currentQuiz: state.currentQuiz,
      }),
      onRehydrateStorage: () => state => {
        if (!state?.currentProgress || !state?.currentQuiz) return
        const maxIndex = state.currentQuiz.questions.length - 1
        if (maxIndex < 0) {
          state.currentProgress = null
          return
        }
        // Ensure markedForReview exists (pre-E13-S02 persisted state may lack it)
        if (!Array.isArray(state.currentProgress.markedForReview)) {
          state.currentProgress = {
            ...state.currentProgress,
            markedForReview: [],
          }
        }
        if (state.currentProgress.currentQuestionIndex > maxIndex) {
          state.currentProgress = {
            ...state.currentProgress,
            currentQuestionIndex: maxIndex,
          }
        } else if (state.currentProgress.currentQuestionIndex < 0) {
          state.currentProgress = {
            ...state.currentProgress,
            currentQuestionIndex: 0,
          }
        }
      },
    }
  )
)

// Individual selectors — usage: const quiz = useQuizStore(selectCurrentQuiz)
export const selectCurrentQuiz = (state: QuizState) => state.currentQuiz
export const selectCurrentProgress = (state: QuizState) => state.currentProgress
export const selectAttempts = (state: QuizState) => state.attempts
export const selectIsLoading = (state: QuizState) => state.isLoading
export const selectError = (state: QuizState) => state.error
