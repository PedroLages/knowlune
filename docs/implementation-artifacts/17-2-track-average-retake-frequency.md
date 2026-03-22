---
story_id: E17-S02
story_name: "Track Average Retake Frequency"
status: reviewed
started: 2026-03-22
completed: 2026-03-22
reviewed: true
review_started: 2026-03-22
review_gates_passed:
  - build
  - lint
  - typecheck
  - prettier
  - unit-tests
  - e2e-smoke
  - e2e-story
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 17.2: Track Average Retake Frequency

## Story

As a learner,
I want to see how often I retake quizzes on average,
so that I can understand my learning persistence.

## Acceptance Criteria

**Given** I have completed multiple quizzes
**When** I view the analytics section
**Then** I see my average retake frequency per quiz
**And** the calculation is: total attempts / unique quizzes

**Given** I completed Quiz A 3 times and Quiz B 2 times
**When** calculating average retake frequency
**Then** the result is (3 + 2) / 2 = 2.5 attempts per quiz

**Given** the retake frequency is 1.0
**When** viewing the metric
**Then** I see the interpretation: "No retakes yet — each quiz taken once."

**Given** the retake frequency is between 1.1 and 2.0
**When** viewing the metric
**Then** I see the interpretation: "Light review — you occasionally revisit quizzes."

**Given** the retake frequency is between 2.1 and 3.0
**When** viewing the metric
**Then** I see the interpretation: "Active practice — you retake quizzes 2-3 times on average for mastery."

**Given** the retake frequency is above 3.0
**When** viewing the metric
**Then** I see the interpretation: "Deep practice — strong commitment to mastery through repetition."

**Given** the retake frequency is displayed
**When** viewing the metric
**Then** I see it rounded to 1 decimal place (e.g., "2.5 attempts per quiz")

## Tasks / Subtasks

- [x] Task 1: Add `calculateRetakeFrequency()` to `src/lib/analytics.ts` (AC: 1, 2)
  - [x] 1.1 Import `db` from `@/db`
  - [x] 1.2 Implement async function querying `db.quizAttempts.toArray()`
  - [x] 1.3 Calculate `averageRetakes = totalAttempts / uniqueQuizzes` (0 if no quizzes)
  - [x] 1.4 Export `RetakeFrequencyResult` type
- [x] Task 2: Add `interpretRetakeFrequency()` to `src/lib/analytics.ts` (AC: 3, 4, 5, 6)
  - [x] 2.1 Pure function mapping float → string for the 4 bands (≤1.0, ≤2.0, ≤3.0, >3.0)
- [x] Task 3: Wire into `Reports.tsx` (AC: 1, 7)
  - [x] 3.1 Add `retakeData` state with `{ averageRetakes, totalAttempts, uniqueQuizzes }`
  - [x] 3.2 Add `useEffect` with ignore flag calling `calculateRetakeFrequency()`
  - [x] 3.3 Add "Average Retake Frequency" Card (Row 5 in study tab)
  - [x] 3.4 Display `averageRetakes.toFixed(1)` + interpretation text
  - [x] 3.5 Add `data-testid="quiz-retake-card"` for E2E selectors
  - [x] 3.6 Handle empty state: "No quizzes attempted yet"
  - [x] 3.7 Update `hasActivity` guard to include `retakeData.totalAttempts > 0`
- [x] Task 4: Unit tests in `src/lib/__tests__/analytics.test.ts` (AC: 1–6)
  - [x] 4.1 `calculateRetakeFrequency` — various distributions
  - [x] 4.2 `calculateRetakeFrequency` — single quiz multiple attempts
  - [x] 4.3 `calculateRetakeFrequency` — zero attempts returns 0
  - [x] 4.4 `interpretRetakeFrequency` — all 4 boundary values (1.0, 1.5, 2.5, 4.0)
- [x] Task 5: E2E tests in `tests/e2e/regression/story-e17-s02.spec.ts` (AC: 1–7)
  - [x] 5.1 Same quiz 4 times → retake frequency = 4.0 (Deep practice, > 3.0)
  - [x] 5.2 Two different quizzes once each → retake frequency = 1.0
  - [x] 5.3 Zero attempts → empty state shown, no retake card metric visible
  - [x] 5.4 Interpretation text renders correctly for 2.5 scenario

## Design Guidance

Display follows the same Card pattern used throughout Reports.tsx:

```tsx
<Card data-testid="quiz-retake-card">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
      Average Retake Frequency
    </CardTitle>
  </CardHeader>
  <CardContent>
    {retakeData.totalAttempts === 0 ? (
      <p className="text-sm text-muted-foreground">No quizzes attempted yet</p>
    ) : (
      <>
        <div className="text-3xl font-bold">{retakeData.averageRetakes.toFixed(1)}</div>
        <p className="text-sm text-muted-foreground mt-1">attempts per quiz</p>
        <p className="text-sm text-muted-foreground mt-2">
          {interpretRetakeFrequency(retakeData.averageRetakes)}
        </p>
      </>
    )}
  </CardContent>
</Card>
```

- Use `RotateCcw` from lucide-react (or `RefreshCw`) for the icon
- Encouraging tone: retakes reflect persistence, which is good
- No progress bar needed (unlike completion rate which had a 0–100% scale)
- If E17-S01 is already merged, consider a 2-column grid for the two quiz metric cards

## Implementation Notes

**Plan:** [docs/implementation-artifacts/plans/e17-s02-implementation-plan.md](plans/e17-s02-implementation-plan.md)

**Key architectural decision:** `calculateRetakeFrequency()` is async because it reads from Dexie IndexedDB (`db.quizAttempts.toArray()`). This matches the E17-S01 pattern for `calculateCompletionRate()`.

**E17-S01 branch status:** E17-S01 (`feature/e17-s01-track-and-display-quiz-completion-rate`) is NOT yet merged to main. Building E17-S02 on main means:
- `analytics.ts` currently lacks `import { db }` — must add it
- `Reports.tsx` doesn't have the Quiz Completion Rate card yet
- Place the Retake Frequency card as its own row (Row 5), same position E17-S01 would use for Completion Rate

**When E17-S01 merges:** If E17-S01 merges before this story's PR, there will be a merge conflict in `analytics.ts` (db import) and `Reports.tsx` (card placement). Resolution: keep both cards in a 2-column grid layout.

**DB schema:** `quizAttempts` table indexed on `id, quizId, [quizId+completedAt], completedAt` (see `src/db/schema.ts:413`). The compound index `[quizId+completedAt]` is useful for per-quiz queries if needed.

**QuizAttempt type** (`src/types/quiz.ts:191`): `{ id, quizId, answers, score, percentage, passed, timeSpent, completedAt, startedAt, timerAccommodation }`.

**Unit test pattern:** Pure functions (`interpretRetakeFrequency`) tested with vitest directly. Async functions (`calculateRetakeFrequency`) need Dexie mock or test via the integration test approach — check how E17-S01 handled this.

**E2E test pattern:** Seed `quizAttempts` store via `page.evaluate` IndexedDB injection (same pattern as `story-e16-s01.spec.ts`). Navigate to `/reports`, check `data-testid="quiz-retake-card"`.

## Testing Notes

Unit tests for `calculateRetakeFrequency` need a Dexie mock since the function reads from DB. Check `src/lib/__tests__/analytics.test.ts` — existing tests for `analyzeTopicPerformance`, `calculateImprovement`, `calculateNormalizedGain` are pure functions (no DB). For `calculateRetakeFrequency`, use vitest `vi.mock('@/db')`.

E2E tests seed the `quizAttempts` IndexedDB store and navigate to `/reports`. Since Reports.tsx has a `hasActivity` guard (shows EmptyState if no activity), the E2E tests must seed enough data to pass the guard — either seed `quizAttempts` with ≥1 entry (which updates `hasActivity`) or seed lessons data.

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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Dev Agent Record

### File List

- `src/lib/analytics.ts` — Added `db` import, `RetakeFrequencyResult` type, `calculateRetakeFrequency()`, `interpretRetakeFrequency()`
- `src/app/pages/Reports.tsx` — Added `RotateCcw` icon, analytics imports, `retakeData` state, useEffect, updated `hasActivity`, added Row 5 card
- `src/lib/__tests__/analytics.test.ts` — Added `vi`, `beforeEach` imports, `vi.mock('@/db')`, 8 new tests for both functions
- `tests/e2e/regression/story-e17-s02.spec.ts` — New E2E spec with 4 tests covering all ACs

### Completion Notes

- All 5 tasks complete. 2159 unit tests pass (8 new). 4 E2E tests pass.
- **Key fix:** Plan test expected "Deep practice" for 3.0 average, but `3.0 <= 3.0` maps to "Active practice". Changed to 4 attempts (avg 4.0) to correctly test the `> 3.0` band.
- Used `vi.mock('@/db')` at file level (hoisted by Vitest) with `beforeEach(() => vi.clearAllMocks())` for isolation.
- Used `seedQuizAttempts` + `clearIndexedDBStore` helpers from `tests/support/helpers/indexeddb-seed.ts` (correct `../../` import path, not `../` used in broken E16 specs).

### Change Log

- 2026-03-22: Implemented E17-S02 — Average Retake Frequency metric on Reports page

## Challenges and Lessons Learned

- **Import path bug in E16 E2E specs:** `story-e16-s0*.spec.ts` all use `'../support/fixtures'` which resolves to the non-existent `tests/e2e/support/fixtures`. The correct path is `'../../support/fixtures'`. Used the correct path in this story's spec.
- **Interpretation band boundary:** `3.0` maps to "Active practice" (≤ 3.0), not "Deep practice" (> 3.0). Plan test data was incorrect. Need `> 3.0` (e.g., 4 attempts) to trigger "Deep practice".
