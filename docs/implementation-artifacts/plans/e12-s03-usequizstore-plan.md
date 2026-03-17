# Plan: E12-S03 — Create useQuizStore with Zustand

## Context

Story 12.3 creates the Zustand state store for the LevelUp quiz system. It is a pure developer-facing story (no UI) that establishes the state management foundation all subsequent quiz stories depend on. The store handles: loading quiz data from Dexie, tracking in-progress answers via optimistic updates, persisting crash-recovery state to localStorage, submitting attempts with retry/rollback, and cross-store integration with useContentProgressStore.

**Key findings from research:**
- All Quiz types exist in `src/types/quiz.ts` (E12-S01 ✅)
- E12-S02 quiz table schema changes are on branch `feature/e12-s02-...` and **NOT yet on main** — our E12-S03 branch was cut from main, so we must cherry-pick that schema commit first
- `src/lib/persistWithRetry.ts` exists: `(op: () => Promise<void>, maxRetries = 3) => Promise<void>` with 1s/2s/4s exponential backoff
- `src/lib/scoring.ts` does NOT exist — must be created as part of this story
- Only `useSuggestionStore` uses Zustand persist middleware; pattern is confirmed via `create<State>()(persist(..., { name, partialize }))`
- Toast errors use `src/lib/toastHelpers.ts` `toastError.saveFailed()` or direct `toast.error()`
- No quiz test factories exist yet — create in `tests/support/fixtures/factories/`
- Test isolation pattern: `fake-indexeddb/auto` + `Dexie.delete('ElearningDB')` + `vi.resetModules()` + dynamic import

---

## Implementation Plan

### Step 0: Bring in E12-S02 schema changes (prerequisite)

Cherry-pick the quiz table schema commit from E12-S02 branch:
```bash
git cherry-pick 0c9a6d2
```
This adds `quizzes` and `quizAttempts` tables to `src/db/schema.ts`.

Verify by reading `src/db/schema.ts` after cherry-pick to confirm:
- `quizzes: EntityTable<Quiz, 'id'>` in db type
- `quizAttempts: EntityTable<QuizAttempt, 'id'>` in db type
- `db.version(N).stores()` includes both table index strings

---

### Step 1: Create `src/lib/scoring.ts`

Required by `submitQuiz` action. Implement basic all-or-nothing scoring for MC, TF, FIB question types (MS partial credit is Epic 14 scope):

```typescript
import type { Quiz, Answer } from '@/types/quiz'

export interface QuizScoreResult {
  score: number       // raw points earned
  maxScore: number    // total possible points
  percentage: number  // 0-100
  passed: boolean     // >= quiz.passingScore
  answers: Answer[]   // with isCorrect and pointsEarned filled in
}

export function calculateQuizScore(
  quiz: Quiz,
  userAnswers: Record<string, string | string[]>
): QuizScoreResult
```

**Logic:**
- For each question: compare `userAnswer` to `question.correctAnswer` (case-insensitive for fill-in-blank)
- `pointsEarned = question.points` if correct, `0` otherwise (all-or-nothing for MC/TF/FIB)
- `multiple-select`: all-or-nothing for now (full partial credit deferred to Epic 14)
- `percentage = (score / maxScore) * 100`, rounded to 1 decimal
- `passed = percentage >= quiz.passingScore`

---

### Step 2: Create `src/stores/useQuizStore.ts`

**File:** `src/stores/useQuizStore.ts`

**Store structure using persist pattern:**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quiz, QuizProgress, QuizAttempt } from '@/types/quiz'
import { db } from '@/db'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateQuizScore } from '@/lib/scoring'
import { toast } from 'sonner'
import { toastError } from '@/lib/toastHelpers'
import type { Module } from '@/data/types'

interface QuizState {
  currentQuiz: Quiz | null
  currentProgress: QuizProgress | null
  attempts: QuizAttempt[]
  isLoading: boolean
  error: string | null
  // Actions
  startQuiz: (lessonId: string) => Promise<void>
  submitAnswer: (questionId: string, answer: string | string[]) => void
  submitQuiz: (courseId: string, modules: Module[]) => Promise<void>
  retakeQuiz: (lessonId: string) => Promise<void>
  loadAttempts: (quizId: string) => Promise<void>
  resumeQuiz: () => void
  clearQuiz: () => void
  toggleReviewMark: (questionId: string) => void
  clearError: () => void
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({ /* implementation */ }),
    {
      name: 'levelup-quiz-store',
      partialize: (state) => ({ currentProgress: state.currentProgress }),
    }
  )
)
```

**Action implementations:**

**`startQuiz(lessonId)`:**
1. `set({ isLoading: true, error: null })`
2. `const quiz = await db.quizzes.where('lessonId').equals(lessonId).first()`
3. If not found: `set({ isLoading: false, error: 'Quiz not found' })`, return
4. Apply Fisher-Yates shuffle if `quiz.shuffleQuestions` (inline, no external lib needed — simple enough)
5. Initialize `QuizProgress`: `{ quizId: quiz.id, currentQuestionIndex: 0, answers: {}, startTime: new Date().toISOString(), timeRemaining: quiz.timeLimit ?? null, isPaused: false, markedForReview: [], questionOrder: shuffledIds, timerAccommodation: 'standard' }`
6. `set({ currentQuiz: quiz, currentProgress: progress, isLoading: false })`

**`submitAnswer(questionId, answer)`:**
- Pure optimistic update: `set(state => ({ currentProgress: { ...state.currentProgress!, answers: { ...state.currentProgress!.answers, [questionId]: answer } } }))`
- No Dexie write (persist middleware handles localStorage debounce)

**`submitQuiz(courseId, modules)`:**
1. Snapshot state for rollback: `const snapshot = { currentQuiz: get().currentQuiz, currentProgress: get().currentProgress }`
2. Calculate score: `const result = calculateQuizScore(currentQuiz, currentProgress.answers)`
3. Build `QuizAttempt` record
4. Optimistic state update: `set({ isLoading: true })`
5. Wrap Dexie write in `persistWithRetry`:
   ```typescript
   try {
     await persistWithRetry(async () => {
       await db.quizAttempts.add(attempt)
     })
     // ONLY after success:
     if (result.passed) {
       useContentProgressStore.getState().setItemStatus(courseId, lessonId, 'completed', modules)
     }
     set({ attempts: [...get().attempts, attempt], currentProgress: null, isLoading: false })
   } catch {
     set({ ...snapshot, isLoading: false, error: 'Failed to save quiz attempt' })
     toastError.saveFailed('Quiz attempt could not be saved. Your answers are preserved.')
   }
   ```

**`retakeQuiz(lessonId)`:** Calls `get().startQuiz(lessonId)` — fresh shuffle, reset progress.

**`loadAttempts(quizId)`:** `const attempts = await db.quizAttempts.where('quizId').equals(quizId).sortBy('completedAt'); set({ attempts })`

**`resumeQuiz()`:** No-op — persist middleware rehydrates `currentProgress` automatically on store init.

**`clearQuiz()`:** `set({ currentQuiz: null, currentProgress: null, attempts: [], error: null })`

**`toggleReviewMark(questionId)`:** Toggle presence in `currentProgress.markedForReview[]`

**`clearError()`:** `set({ error: null })`

**Individual selectors** (exported after store):
```typescript
export const selectCurrentQuiz = (state: QuizState) => state.currentQuiz
export const selectCurrentProgress = (state: QuizState) => state.currentProgress
export const selectAttempts = (state: QuizState) => state.attempts
export const selectIsLoading = (state: QuizState) => state.isLoading
export const selectError = (state: QuizState) => state.error
// Usage: const quiz = useQuizStore(selectCurrentQuiz)
```

---

### Step 3: Create test factories

**File:** `tests/support/fixtures/factories/quiz-factory.ts`

```typescript
import type { Quiz, Question, QuizAttempt, QuizProgress } from '@/types/quiz'
import { FIXED_DATE } from '../../../utils/test-time'

export function makeQuestion(overrides: Partial<Question> = {}): Question
export function makeQuiz(overrides: Partial<Quiz> = {}): Quiz
export function makeAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt
export function makeProgress(quizId: string, overrides: Partial<QuizProgress> = {}): QuizProgress
```

---

### Step 4: Write unit tests

**File:** `src/stores/__tests__/useQuizStore.test.ts`

**Test setup:**
```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

let useQuizStore: typeof import('@/stores/useQuizStore')['useQuizStore']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const mod = await import('@/stores/useQuizStore')
  useQuizStore = mod.useQuizStore
})
```

**Tests to write (mapping to ACs):**
1. `startQuiz` — loads quiz, initializes progress with shuffled order when enabled
2. `startQuiz` — no shuffle when `shuffleQuestions: false`, order preserved
3. `startQuiz` — sets error state when quiz not found (no quiz for lessonId)
4. `submitAnswer` — updates `currentProgress.answers[questionId]` optimistically, no Dexie write
5. `submitQuiz` — creates QuizAttempt, persists to Dexie, clears currentProgress on success
6. `submitQuiz` — calls `useContentProgressStore.setItemStatus` only when score ≥ passingScore
7. `submitQuiz` — reverts state, shows toast, preserves currentProgress on Dexie failure (mock `db.quizAttempts.add` to throw)
8. `submitQuiz` — does NOT call cross-store if quiz failed (score < passingScore)
9. `retakeQuiz` — calls startQuiz internally, resets progress
10. `resumeQuiz` — is a no-op (persist handles rehydration)
11. `toggleReviewMark` — adds questionId when not present; removes when present
12. `loadAttempts` — queries Dexie and sets attempts array
13. `persist partialize` — only `currentProgress` serialized to localStorage, not `currentQuiz` or `attempts`

---

## Files Created / Modified

| Action | File |
|--------|------|
| Cherry-pick (Step 0) | `src/db/schema.ts` (quiz tables from E12-S02) |
| Create | `src/lib/scoring.ts` |
| Create | `src/stores/useQuizStore.ts` |
| Create | `tests/support/fixtures/factories/quiz-factory.ts` |
| Create | `src/stores/__tests__/useQuizStore.test.ts` |

---

## Verification

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Unit tests
npm run test:unit -- --testPathPattern=useQuizStore

# Build
npm run build
```

---

## Shipping Recommendation

**Quick ship** — `/finish-story` (auto-runs reviews)

This story has no UI changes, 7 tasks, and 1 file to create (store). Design review N/A. Code review will verify retry logic and cross-store communication correctness.
