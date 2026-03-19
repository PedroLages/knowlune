---
story_id: E12-S06
story_name: "Calculate and Display Quiz Score"
status: done
started: 2026-03-19
completed: 2026-03-19
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 12.6: Calculate and Display Quiz Score

Status: done

## Story

As a learner,
I want to submit my quiz and immediately see my score,
so that I know how well I performed.

**FRs Fulfilled:** QFR5 (results display), QFR17 (scoring calculation), QFR23 (non-judgmental messaging), QFR6 (retake)

## Acceptance Criteria

**Given** I have answered all required questions in a quiz
**When** I click "Submit Quiz"
**Then** the quiz is submitted via `useQuizStore.submitQuiz(courseId, modules)`
**And** my score is calculated as a percentage of total possible points
**And** I see an animated circular SVG score indicator with my percentage in `text-5xl font-bold text-foreground`
**And** I see the number of questions correct (e.g., "10 of 12 correct")
**And** I see pass/fail status: "Congratulations! You passed!" or "Keep Going! You got X of Y correct"
**And** the word "Failed" MUST NOT appear anywhere on the results screen (QFR23)
**And** I see the total time spent (e.g., "Completed in 8m 32s") — sourced from `QuizAttempt.timeSpent`

**Given** I have NOT answered all questions
**When** I click "Submit Quiz"
**Then** I see a confirmation dialog (shadcn/ui AlertDialog): "You have N unanswered questions. Submit anyway?"
**And** I can click "Continue Reviewing" (outline variant) to return to the quiz
**And** I can click "Submit Anyway" (default variant) to submit with unanswered questions scored as 0

**Given** the quiz results screen
**When** I view my results
**Then** I see a "Retake Quiz" button (`variant="outline" rounded-xl`)
**And** I see a "Review Answers" button (`variant="default" bg-brand rounded-xl`) — links to placeholder (Epic 16 scope)
**And** I see a "Back to Lesson" text link below the buttons

**Given** the submitQuiz store action fails (Dexie write error after retries)
**When** the error occurs
**Then** I see an error toast via Sonner (already handled by the store)
**And** I remain on the quiz page with my answers intact (currentProgress preserved)

## Tasks / Subtasks

- [ ] Task 1: Add "Submit Quiz" button to Quiz page and wire navigation (AC: 1, 2)
  - [ ] 1.1 Add navigation footer below `QuestionDisplay` in `Quiz.tsx` with Prev/Next/Submit buttons
  - [ ] 1.2 "Submit Quiz" button appears on last question (or always as secondary action)
  - [ ] 1.3 Count unanswered questions; show AlertDialog confirmation if unanswered > 0
  - [ ] 1.4 On submit, call `useQuizStore.submitQuiz(courseId, modules)` then navigate to results
- [ ] Task 2: Add quiz results route to `routes.tsx` (AC: 1)
  - [ ] 2.1 Lazy-import `QuizResults` page
  - [ ] 2.2 Add route: `courses/:courseId/lessons/:lessonId/quiz/results`
- [ ] Task 3: Create `ScoreSummary` component (AC: 1, 3)
  - [ ] 3.1 Create `src/app/components/quiz/ScoreSummary.tsx`
  - [ ] 3.2 Animated circular SVG progress ring with percentage text
  - [ ] 3.3 Pass message: "Congratulations! You passed!" / Not pass: "Keep Going! You got X of Y correct."
  - [ ] 3.4 Display "X of Y correct" and time spent ("Completed in Xm Ys")
  - [ ] 3.5 Ensure no "Failed" word anywhere (QFR23)
- [ ] Task 4: Create `QuizResults` page (AC: 1, 3, 4)
  - [ ] 4.1 Create `src/app/pages/QuizResults.tsx`
  - [ ] 4.2 Read most recent attempt from `useQuizStore.selectAttempts`
  - [ ] 4.3 Render ScoreSummary with attempt data
  - [ ] 4.4 "Retake Quiz" button → navigates to quiz start (calls retakeQuiz)
  - [ ] 4.5 "Review Answers" button → placeholder/disabled (Epic 16)
  - [ ] 4.6 "Back to Lesson" link → `/courses/:courseId/lessons/:lessonId`
  - [ ] 4.7 Handle edge case: no attempt data (redirect back to quiz)
- [ ] Task 5: Write unit tests (AC: all)
  - [ ] 5.1 ScoreSummary renders pass/not-pass messages correctly
  - [ ] 5.2 ScoreSummary never renders "Failed" in any state
  - [ ] 5.3 Time formatting helper (ms → "Xm Ys")
  - [ ] 5.4 QuizResults redirects when no attempt data
- [ ] Task 6: Write E2E tests (AC: 1, 2, 3)
  - [ ] 6.1 Submit quiz with all answered → results page with score, time, pass message
  - [ ] 6.2 Submit quiz with unanswered → AlertDialog, "Continue Reviewing" returns to quiz
  - [ ] 6.3 Submit quiz with unanswered → AlertDialog, "Submit Anyway" goes to results
  - [ ] 6.4 Results page: Retake button navigates to fresh quiz
  - [ ] 6.5 Results page: "Back to Lesson" link works
  - [ ] 6.6 Pass/fail message never contains "Failed"

## Dev Notes

### CRITICAL: `src/lib/scoring.ts` ALREADY EXISTS — DO NOT RECREATE

The scoring logic (`calculateQuizScore`) was implemented in E12-S03 and is fully tested (18 unit tests in `src/lib/__tests__/scoring.test.ts`). The store's `submitQuiz` action already calls it. **This story only creates UI** — the results page and score display.

### Existing Infrastructure to Reuse

| What | Where | Notes |
|------|-------|-------|
| `calculateQuizScore()` | `src/lib/scoring.ts` | Returns `QuizScoreResult` with `score`, `maxScore`, `percentage`, `passed`, `answers` |
| `useQuizStore.submitQuiz()` | `src/stores/useQuizStore.ts` | Accepts `(courseId, modules)`, handles scoring + Dexie write + error rollback |
| `selectAttempts` selector | `src/stores/useQuizStore.ts` | Returns `QuizAttempt[]` — read most recent after submit |
| `useQuizStore.retakeQuiz()` | `src/stores/useQuizStore.ts` | Accepts `lessonId`, resets progress |
| AlertDialog component | `src/app/components/ui/alert-dialog.tsx` | shadcn/ui — already installed |
| Quiz route params | `useParams<{ courseId, lessonId }>` | Already used in `Quiz.tsx` |
| Quiz page wrapper | `src/app/pages/Quiz.tsx` | Modify to add Submit button + navigation |

### Component Architecture

```
QuizResults.tsx (new page)
├── ScoreSummary.tsx (new component)
│   ├── Animated SVG ring (percentage)
│   ├── Score text ("10 of 12 correct")
│   ├── Pass/fail message (encouraging only)
│   └── Time spent ("Completed in 8m 32s")
├── Action buttons (Retake, Review, Back)
└── aria-live region for score announcement

Quiz.tsx (modify existing)
├── QuizNavigation footer (new — Prev/Next/Submit)
└── AlertDialog for unanswered confirmation
```

### Store Flow for Submit

```
User clicks "Submit Quiz"
→ Check unanswered count
→ If unanswered > 0: show AlertDialog
→ On confirm: call submitQuiz(courseId, modules)
  → Store calculates score via calculateQuizScore()
  → Store writes QuizAttempt to Dexie
  → Store clears currentProgress
  → Store sets attempt in attempts[]
→ Navigate to /courses/:courseId/lessons/:lessonId/quiz/results
→ QuizResults reads attempts[last] from store
```

### Design Tokens (from theme.css)

| Element | Classes |
|---------|---------|
| Score text | `text-5xl font-bold text-foreground` |
| Pass icon | Green checkmark — use `text-success` |
| Not-pass icon | Orange neutral — use `text-warning` (NEVER red) |
| Pass message | `text-lg font-medium text-success` |
| Not-pass message | `text-lg font-medium text-warning` |
| SVG ring (pass) | `stroke: var(--color-success)` |
| SVG ring (not-pass) | `stroke: var(--color-warning)` |
| Retake button | `variant="outline"` with `rounded-xl` |
| Review button | `bg-brand text-brand-foreground rounded-xl` |
| Back link | `text-brand hover:underline text-sm` |
| Card wrapper | `bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm` |

### Time Formatting

Convert `QuizAttempt.timeSpent` (milliseconds) to human-readable:
- `formatDuration(timeSpentMs)` → "8m 32s" or "1m 5s" or "45s"
- Create as helper in `src/lib/formatDuration.ts` or inline in ScoreSummary

### Non-Judgmental Messaging (QFR23)

- Pass: "Congratulations! You passed!"
- Not pass: "Keep Going! You got X of Y correct."
- NEVER use: "Failed", "Wrong", "Incorrect", "Bad"
- Icon: checkmark for pass, neutral circle for not-pass (never red X)

### Previous Story Learnings (E12-S05)

- Design reviews caught: touch target < 44px, contrast issues, layout shift from border width changes
- Use `border-2` consistently on all states to prevent layout shift
- Test data factory: use `makeQuiz()` and `makeQuestion()` from `tests/support/fixtures/factories/quiz-factory.ts`
- E2E pattern: seed quiz via `seedQuizzes(page, [quiz])`, navigate, start quiz, then test
- Sidebar overlay: seed `localStorage.setItem('eduvi-sidebar-v1', 'false')` before navigation in E2E tests

### modules Parameter for submitQuiz

The store's `submitQuiz(courseId, modules)` requires a `Module[]` array for cross-store progress tracking. In the Quiz page, this can be fetched from the course data or passed as an empty array if not available — the store handles the `setItemStatus` call conditionally.

### References

- [Epic 12 definition](../planning-artifacts/epics.md) — Story 12.6 section
- [Quiz UX Specification](../planning-artifacts/quiz-ux-design-specification.md) — QFR5, QFR17, QFR23
- [Scoring logic](../../src/lib/scoring.ts) — DO NOT MODIFY
- [Scoring tests](../../src/lib/__tests__/scoring.test.ts) — 18 tests already passing
- [Quiz store](../../src/stores/useQuizStore.ts) — submitQuiz action
- [Quiz page](../../src/app/pages/Quiz.tsx) — modify for Submit button
- [AlertDialog](../../src/app/components/ui/alert-dialog.tsx) — shadcn/ui component
- [Quiz factory](../../tests/support/fixtures/factories/quiz-factory.ts) — test data

## Implementation Plan

See [plan](plans/e12-s06-calculate-display-quiz-score.md) for implementation approach.

## Challenges and Lessons Learned

1. **Navigate during render is a React anti-pattern**: Initial implementation called `navigate()` directly in the render body for redirect logic. Code review caught this as a blocker — React 18 Strict Mode fires it twice, and concurrent rendering makes it unpredictable. Fix: Use `<Navigate>` component for declarative redirects.

2. **Async handlers need error guards before navigation**: `handleSubmitConfirm` and `handleRetake` both called `navigate()` after `await storeAction()` with no try/catch. If the Dexie write fails, the user gets redirected to a page with no data. The store shows an error toast, but the component navigates away before the user sees it.

3. **Playwright strict mode catches duplicate text in aria-live regions**: E2E tests using `getByText(/X of Y correct/)` resolved to 3 elements: the sr-only aria-live announcement, the visible score text, and the encouraging message. Fix: use `{ exact: true }` matching or scoped locators (`data-testid` container).

4. **Responsive text sizing in SVG containers**: `text-5xl` (48px) inside a `size-24` (96px) ring overflows on mobile for "100%". Fix: `text-3xl sm:text-5xl` scales with the ring container.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
