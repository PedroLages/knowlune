# E15-S06: Track Time-to-Completion for Each Attempt — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display time-to-completion on quiz results (timed quizzes only) and show time comparison across attempts.

**Architecture:** The data layer is already complete — `QuizAttempt.timeSpent` (ms) is stored, `formatDuration(ms)` exists, and `ScoreSummary` already renders "Completed in X". This plan adds two missing display features: (1) conditional visibility guard for untimed quizzes, and (2) time comparison row for multi-attempt results. Then adds the E2E tests with Playwright clock mocking.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library (unit), Playwright + `page.clock` (E2E), Tailwind CSS v4 design tokens.

---

## Task 1: Add `showTimeSpent` prop to `ScoreSummary` (AC4)

**Files:**
- Modify: `src/app/components/quiz/ScoreSummary.tsx:1-175`

This hides the "Completed in X" line for untimed quizzes. Currently it always renders regardless of accommodation.

**Step 1: Write the failing unit test**

In `src/app/components/quiz/__tests__/ScoreSummary.test.tsx`, add inside the existing `describe('ScoreSummary', ...)` block:

```typescript
it('hides time display when showTimeSpent is false', () => {
  render(<ScoreSummary {...passProps} showTimeSpent={false} />)
  expect(screen.queryByText(/Completed in/)).not.toBeInTheDocument()
})

it('shows time display when showTimeSpent is true (default)', () => {
  render(<ScoreSummary {...passProps} />)
  expect(screen.getByText('Completed in 8m 32s')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes
npx vitest run src/app/components/quiz/__tests__/ScoreSummary.test.tsx
```
Expected: FAIL — `showTimeSpent={false}` has no effect yet.

**Step 3: Implement the prop in `ScoreSummary.tsx`**

Add to the `ScoreSummaryProps` interface:
```typescript
showTimeSpent?: boolean
```

Add to destructured props:
```typescript
export function ScoreSummary({
  percentage,
  score,
  maxScore,
  passed,
  passingScore,
  timeSpent,
  previousBestPercentage,
  showTimeSpent = true,   // ADD THIS
}: ScoreSummaryProps) {
```

Wrap the "Completed in" paragraph:
```typescript
{showTimeSpent && (
  <p className="text-sm text-muted-foreground">
    Completed in {formatDuration(Math.max(timeSpent, 1000))}
  </p>
)}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/components/quiz/__tests__/ScoreSummary.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/components/quiz/ScoreSummary.tsx src/app/components/quiz/__tests__/ScoreSummary.test.tsx
git commit -m "feat(E15-S06): hide time display for untimed quizzes in ScoreSummary"
```

---

## Task 2: Add `previousAttemptTimeSpent` prop to `ScoreSummary` (AC5)

**Files:**
- Modify: `src/app/components/quiz/ScoreSummary.tsx`

Shows time comparison when learner has taken the quiz before. Example: "Previous: 10m 15s" shown alongside the current time.

**Step 1: Write the failing unit test**

In `src/app/components/quiz/__tests__/ScoreSummary.test.tsx`, add:

```typescript
it('shows previous attempt time when previousAttemptTimeSpent is provided', () => {
  render(
    <ScoreSummary
      {...passProps}
      timeSpent={512000} // 8m 32s
      previousAttemptTimeSpent={615000} // 10m 15s
    />
  )
  expect(screen.getByText('Completed in 8m 32s')).toBeInTheDocument()
  expect(screen.getByText(/Previous: 10m 15s/)).toBeInTheDocument()
})

it('does not show previous time when previousAttemptTimeSpent is undefined', () => {
  render(<ScoreSummary {...passProps} timeSpent={512000} />)
  expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument()
})

it('does not show previous time when showTimeSpent is false', () => {
  render(
    <ScoreSummary
      {...passProps}
      showTimeSpent={false}
      previousAttemptTimeSpent={615000}
    />
  )
  expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/components/quiz/__tests__/ScoreSummary.test.tsx
```
Expected: FAIL — `previousAttemptTimeSpent` prop doesn't exist yet.

**Step 3: Implement the prop in `ScoreSummary.tsx`**

Add to `ScoreSummaryProps`:
```typescript
previousAttemptTimeSpent?: number
```

Add to destructured props:
```typescript
export function ScoreSummary({
  ...,
  showTimeSpent = true,
  previousAttemptTimeSpent,   // ADD THIS
}: ScoreSummaryProps) {
```

Replace the existing time display block with:
```typescript
{showTimeSpent && (
  <div className="flex flex-col items-center gap-1">
    <p className="text-sm text-muted-foreground tabular-nums">
      Completed in {formatDuration(Math.max(timeSpent, 1000))}
    </p>
    {previousAttemptTimeSpent != null && (
      <p className="text-xs text-muted-foreground/70 tabular-nums">
        Previous: {formatDuration(Math.max(previousAttemptTimeSpent, 1000))}
      </p>
    )}
  </div>
)}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/components/quiz/__tests__/ScoreSummary.test.tsx
```
Expected: PASS all tests

**Step 5: Commit**

```bash
git add src/app/components/quiz/ScoreSummary.tsx src/app/components/quiz/__tests__/ScoreSummary.test.tsx
git commit -m "feat(E15-S06): add previous attempt time comparison to ScoreSummary"
```

---

## Task 3: Wire up new props in `QuizResults` (AC4, AC5)

**Files:**
- Modify: `src/app/pages/QuizResults.tsx:1-179`

`QuizResults` already passes `timeSpent` to `ScoreSummary`. Now it needs to pass `showTimeSpent` and `previousAttemptTimeSpent`.

**Step 1: Add `previousAttemptTimeSpent` memo**

After the existing `previousBestPercentage` useMemo in `QuizResults.tsx`, add:

```typescript
const previousAttemptTimeSpent = useMemo(() => {
  if (attempts.length <= 1) return undefined
  const priorAttempt = attempts[attempts.length - 2]  // most recent prior attempt
  if (priorAttempt?.timeSpent != null && Number.isFinite(priorAttempt.timeSpent)) {
    return priorAttempt.timeSpent
  }
  return undefined
}, [attempts])
```

**Step 2: Update `ScoreSummary` usage**

In the `<ScoreSummary>` JSX element, add the two new props:

```typescript
<ScoreSummary
  percentage={lastAttempt.percentage}
  score={lastAttempt.score}
  maxScore={maxScore}
  passed={lastAttempt.passed}
  passingScore={currentQuiz.passingScore}
  timeSpent={lastAttempt.timeSpent}
  previousBestPercentage={previousBestPercentage}
  showTimeSpent={lastAttempt.timerAccommodation !== 'untimed'}
  previousAttemptTimeSpent={previousAttemptTimeSpent}
/>
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 4: Run all unit tests**

```bash
npx vitest run --project unit
```
Expected: All pass

**Step 5: Commit**

```bash
git add src/app/pages/QuizResults.tsx
git commit -m "feat(E15-S06): wire showTimeSpent and previousAttemptTimeSpent in QuizResults"
```

---

## Task 4: Write E2E spec for E15-S06

**Files:**
- Create: `tests/e2e/story-e15-s06.spec.ts`

Uses Playwright `page.clock.setSystemTime()` for deterministic time tracking. Pattern is from the epics spec requirement: "use Playwright clock mocking (`page.clock`) rather than real waits".

**Step 1: Create the E2E test file**

```typescript
/**
 * ATDD E2E tests for E15-S06: Track Time-to-Completion for Each Attempt
 *
 * Uses Playwright clock mocking to control perceived elapsed time
 * without real waits — deterministic and fast.
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes, seedQuizAttempts } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s06'
const LESSON_ID = 'test-lesson-e15s06'
const QUIZ_URL = `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`
const RESULTS_URL = `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const questions = [
  makeQuestion({
    id: 'q1',
    order: 1,
    text: 'What is 2 + 2?',
    options: ['4', '3', '5', '6'],
    correctAnswer: '4',
  }),
  makeQuestion({
    id: 'q2',
    order: 2,
    text: 'What is 3 * 3?',
    options: ['9', '6', '12', '8'],
    correctAnswer: '9',
  }),
]

const timedQuiz = makeQuiz({
  id: 'quiz-e15s06-timed',
  lessonId: LESSON_ID,
  title: 'Timed Quiz',
  questions,
  timeLimit: 10,       // 10-minute timer
  passingScore: 70,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const untimedQuiz = makeQuiz({
  id: 'quiz-e15s06-untimed',
  lessonId: LESSON_ID,
  title: 'Untimed Quiz',
  questions,
  timeLimit: null,     // untimed
  passingScore: 70,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToQuiz(
  page: import('@playwright/test').Page,
  quiz: Record<string, unknown>,
  priorAttempts: Record<string, unknown>[] = [],
) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz])
  if (priorAttempts.length > 0) {
    await seedQuizAttempts(page, priorAttempts)
  }
  await page.goto(QUIZ_URL, { waitUntil: 'domcontentloaded' })
}

async function startQuiz(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /start quiz/i }).click()
}

async function answerAndSubmit(page: import('@playwright/test').Page) {
  await page.getByRole('radio', { name: '4' }).click()
  await page.getByRole('button', { name: /next/i }).click()
  await page.getByRole('radio', { name: '9' }).click()
  await page.getByRole('button', { name: /submit quiz/i }).click()
  const confirmBtn = page.getByRole('button', { name: /submit anyway/i })
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click()
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E15-S06: Time-to-Completion Tracking', () => {

  test.describe('AC2+AC3: Timed quiz shows time-to-completion on results', () => {
    test('displays formatted time on results after timed quiz', async ({ page }) => {
      // Fix clock at a known start time
      await page.clock.setSystemTime(new Date('2025-01-15T12:00:00.000Z'))

      await navigateToQuiz(page, timedQuiz)
      await startQuiz(page)

      // Advance clock by 8 minutes 32 seconds
      await page.clock.setSystemTime(new Date('2025-01-15T12:08:32.000Z'))

      await answerAndSubmit(page)

      await page.waitForURL('**/quiz/results')

      // Should show "Completed in 8m 32s"
      await expect(page.getByText('Completed in 8m 32s')).toBeVisible()
    })
  })

  test.describe('AC4: Untimed quiz does NOT show time on results', () => {
    test('hides time display for untimed quiz results', async ({ page }) => {
      await page.clock.setSystemTime(new Date('2025-01-15T12:00:00.000Z'))

      await navigateToQuiz(page, untimedQuiz)
      await startQuiz(page)

      await page.clock.setSystemTime(new Date('2025-01-15T12:05:00.000Z'))
      await answerAndSubmit(page)

      await page.waitForURL('**/quiz/results')

      // Should NOT show any "Completed in" text
      await expect(page.getByText(/Completed in/i)).not.toBeVisible()
    })
  })

  test.describe('AC5: Multi-attempt time comparison', () => {
    test('shows previous attempt time on second attempt results', async ({ page }) => {
      // Seed a prior attempt with timeSpent=615000ms (10m 15s)
      const priorAttempt = makeAttempt({
        id: 'prior-attempt-e15s06',
        quizId: timedQuiz.id,
        timeSpent: 615000, // 10m 15s
        percentage: 100,
        passed: true,
        completedAt: '2025-01-14T12:10:15.000Z',
        startedAt: '2025-01-14T12:00:00.000Z',
        timerAccommodation: 'standard',
      })

      await page.clock.setSystemTime(new Date('2025-01-15T12:00:00.000Z'))

      await navigateToQuiz(page, timedQuiz, [priorAttempt])
      await startQuiz(page)

      // Advance to 8m 32s elapsed
      await page.clock.setSystemTime(new Date('2025-01-15T12:08:32.000Z'))
      await answerAndSubmit(page)

      await page.waitForURL('**/quiz/results')

      // Current time shown
      await expect(page.getByText('Completed in 8m 32s')).toBeVisible()
      // Previous time shown
      await expect(page.getByText(/Previous: 10m 15s/)).toBeVisible()
    })

    test('does not show previous time on first attempt', async ({ page }) => {
      await page.clock.setSystemTime(new Date('2025-01-15T12:00:00.000Z'))
      await navigateToQuiz(page, timedQuiz)
      await startQuiz(page)

      await page.clock.setSystemTime(new Date('2025-01-15T12:08:32.000Z'))
      await answerAndSubmit(page)

      await page.waitForURL('**/quiz/results')

      await expect(page.getByText('Completed in 8m 32s')).toBeVisible()
      await expect(page.getByText(/Previous:/)).not.toBeVisible()
    })
  })
})
```

**Step 2: Check the seedQuizAttempts helper exists**

```bash
grep -r "seedQuizAttempts" tests/support/helpers/
```

If it doesn't exist, see Task 4b below. If it exists, continue.

**Step 3: Run the E2E tests**

```bash
npx playwright test tests/e2e/story-e15-s06.spec.ts --project=chromium
```
Expected: All tests PASS (after Tasks 1–3 are implemented)

**Step 4: Commit**

```bash
git add tests/e2e/story-e15-s06.spec.ts
git commit -m "test(E15-S06): add E2E specs for time-to-completion display and comparison"
```

---

## Task 4b: Add `seedQuizAttempts` helper (if missing)

**Files:**
- Modify: `tests/support/helpers/indexeddb-seed.ts`

Check first:
```bash
grep -r "seedQuizAttempts\|quizAttempts" tests/support/helpers/indexeddb-seed.ts | head -5
```

If `seedQuizAttempts` is missing, add it alongside `seedQuizzes`:

```typescript
export async function seedQuizAttempts(
  page: Page,
  attempts: Record<string, unknown>[],
): Promise<void> {
  await page.evaluate(async (attemptsData) => {
    const { db } = await import('/src/db/index.ts')
    await db.quizAttempts.bulkPut(attemptsData as QuizAttempt[])
  }, attempts)
}
```

**Note:** Look at how `seedQuizzes` is implemented in `indexeddb-seed.ts` and follow the exact same pattern.

---

## Task 5: Final validation

**Step 1: Run full unit test suite**

```bash
npx vitest run --project unit --coverage
```
Expected: All pass, coverage ≥ 70%

**Step 2: Run E2E spec in isolation**

```bash
npx playwright test tests/e2e/story-e15-s06.spec.ts --project=chromium
```
Expected: All 4 tests PASS

**Step 3: Run smoke specs to check for regressions**

```bash
npx playwright test tests/e2e/smoke/ --project=chromium
```
Expected: All pass

**Step 4: Final commit**

```bash
git add -A
git status  # verify only expected files changed
git commit -m "chore(E15-S06): final polish and validation"
```

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/app/components/quiz/ScoreSummary.tsx` | Add `showTimeSpent` + `previousAttemptTimeSpent` props |
| `src/app/components/quiz/__tests__/ScoreSummary.test.tsx` | Add 5 new unit tests for AC4/AC5 |
| `src/app/pages/QuizResults.tsx` | Pass new props to `ScoreSummary` |
| `tests/e2e/story-e15-s06.spec.ts` | New E2E spec (4 tests) |
| `tests/support/helpers/indexeddb-seed.ts` | Add `seedQuizAttempts` if missing |

**Total estimated changes:** ~60 lines of production code, ~120 lines of tests.

---

## Key Constraints & Gotchas

1. **`timeSpent` is in milliseconds** — NOT seconds as the epic spec suggests. The existing `submitQuiz` calculates `Date.now() - startTime` (both ms). `formatDuration` takes ms. Do not divide by 1000.

2. **`previousAttemptTimeSpent` = most recent prior, not best time** — temporal comparison (am I getting faster?) is more intuitive than best-time comparison.

3. **Playwright `page.clock.setSystemTime()`** — must be called BEFORE `page.goto()` to affect `Date.now()` in the quiz store. Call it before `navigateToQuiz()`.

4. **Untimed quiz detection** — use `lastAttempt.timerAccommodation === 'untimed'` (stored on the attempt), not `currentQuiz.timeLimit === null`. This is more robust: the accommodation is the user's actual setting, while `timeLimit` is the quiz default.

5. **ESLint rule `test-patterns/deterministic-time`** — `Date.now()` is banned in test files. Use `page.clock.setSystemTime()` for time control in E2E tests (no `Date.now()` in test code).

6. **Sidebar localStorage seed** — always set `localStorage.setItem('knowlune-sidebar-v1', 'false')` in `page.addInitScript()` before navigating, per test patterns (see MEMORY.md).
