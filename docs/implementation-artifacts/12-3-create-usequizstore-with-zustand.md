---
story_id: E12-S03
story_name: "Create useQuizStore with Zustand"
status: in-progress
started: 2026-03-17
completed:
reviewed: in-progress    # false | in-progress | true
review_started: 2026-03-17  # YYYY-MM-DD — set when /review-story begins
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, web-design-guidelines-skipped]
burn_in_validated: false # true if burn-in testing (10 iterations) passed
---

# Story 12.3: Create useQuizStore with Zustand

## Story

As a developer,
I want a Zustand store for quiz state management following LevelUp patterns,
So that quiz state is managed consistently with individual selectors and optimistic updates.

**FRs Fulfilled:** QFR1 (quiz start), QFR2 (answer selection), QFR4 (resume), QFR6 (retake), QFR49 (crash recovery via localStorage persist), QFR55 (progress integration)

## Acceptance Criteria

**Given** the LevelUp Zustand patterns (individual selectors, optimistic updates)
**When** I create `src/stores/useQuizStore.ts`
**Then** it follows the `create<State>()(persist(...))` TypeScript pattern
**And** it exports individual selectors (never destructure full store)
**And** it implements optimistic update pattern (Zustand → Dexie → retry with backoff → rollback on exhaustion)
**And** persist middleware auto-saves `currentProgress` to localStorage with key `levelup-quiz-store`
**And** it includes actions: startQuiz, submitAnswer, submitQuiz, retakeQuiz, loadAttempts, resumeQuiz, clearQuiz, toggleReviewMark, clearError

**Given** the startQuiz action
**When** a learner starts a quiz
**Then** it loads the quiz from Dexie by lessonId (resolving the quiz associated with the lesson)
**And** applies Fisher-Yates shuffle if quiz.shuffleQuestions is true
**And** persists the shuffled question order in `currentProgress.questionOrder` (for deterministic crash recovery)
**And** initializes QuizProgress state (currentQuestionIndex=0, empty answers, start time, empty markedForReview)
**And** sets timeRemaining based on quiz.timeLimit × timerAccommodation multiplier

**Given** the submitAnswer action
**When** a learner selects an answer
**Then** it stores the answer in `currentProgress.answers[questionId]`
**And** updates Zustand state optimistically (instant UI feedback)
**And** localStorage auto-saves via persist middleware (debounced)
**And** does NOT write to Dexie (wait until quiz submission to avoid write amplification)

**Given** the submitQuiz action
**When** a learner submits the completed quiz
**Then** it calculates total score and percentage using `calculateQuizScore` from `src/lib/scoring.ts`
**And** creates QuizAttempt record with all answers and metrics
**And** writes attempt to Dexie `quizAttempts` table with retry (3 attempts: 1s, 2s, 4s backoff per Architecture convention)
**And** ONLY AFTER Dexie write succeeds: triggers cross-store updates
**And** clears `currentProgress` from localStorage
**And** on Dexie retry exhaustion: reverts Zustand state, shows error toast, preserves currentProgress for retry

**Given** cross-store communication on quiz submission
**When** the Dexie write succeeds and the quiz score meets the passing threshold
**Then** it calls `useContentProgressStore.getState().setItemStatus(courseId, lessonId, 'completed', modules)` to mark the lesson complete

**Given** the retakeQuiz action
**When** a learner chooses to retake a quiz
**Then** it calls `startQuiz` with the same lessonId, generating a fresh shuffle order and resetting all progress

**Given** the resumeQuiz action
**When** the store rehydrates from localStorage on page load
**Then** it restores `currentProgress` including answers, questionOrder, markedForReview, and timerAccommodation
**And** the quiz displays questions in the persisted `questionOrder` (NOT re-shuffled)

**Given** the toggleReviewMark action
**When** a learner marks/unmarks a question for review
**Then** it adds/removes the questionId from `currentProgress.markedForReview`

## Tasks / Subtasks

- [ ] Task 1: Create `src/stores/useQuizStore.ts` with full state structure and persist middleware (AC: 1)
  - [ ] 1.1 Define QuizState interface with all fields and actions
  - [ ] 1.2 Set up `create<QuizState>()(persist(...))` with `partialize` for currentProgress only
  - [ ] 1.3 Export individual selectors (never destructure full store)
- [ ] Task 2: Implement `startQuiz` action (AC: 2)
  - [ ] 2.1 Load quiz from Dexie by lessonId
  - [ ] 2.2 Apply Fisher-Yates shuffle if quiz.shuffleQuestions is true
  - [ ] 2.3 Initialize QuizProgress with shuffled questionOrder, timeRemaining, empty answers
- [ ] Task 3: Implement `submitAnswer` action — optimistic Zustand-only update (AC: 3)
- [ ] Task 4: Implement `submitQuiz` action with Dexie retry and rollback (AC: 4, 5)
  - [ ] 4.1 Calculate score via `calculateQuizScore` from `src/lib/scoring.ts`
  - [ ] 4.2 Write QuizAttempt to Dexie with `persistWithRetry` (3 attempts, 1s/2s/4s backoff)
  - [ ] 4.3 On success: cross-store call to useContentProgressStore, clear currentProgress
  - [ ] 4.4 On exhaustion: revert state, show Sonner error toast, preserve currentProgress
- [ ] Task 5: Implement `retakeQuiz`, `loadAttempts`, `resumeQuiz`, `clearQuiz`, `toggleReviewMark`, `clearError` (AC: 6, 7, 8)
- [ ] Task 6: Create `src/lib/scoring.ts` with `calculateQuizScore` function
- [ ] Task 7: Write unit tests in `src/stores/__tests__/useQuizStore.test.ts`

## Design Guidance

N/A — store only, no UI changes.

## Implementation Plan

See [plan](plans/e12-s03-usequizstore-plan.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

N/A — store only, no UI changes.

## Code Review Feedback

To be populated by /review-story.

## Web Design Guidelines Review

N/A — store only, no UI changes.

## Challenges and Lessons Learned

Story in progress — lessons to be documented during implementation.
