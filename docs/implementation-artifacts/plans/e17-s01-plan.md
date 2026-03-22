# E17-S01 Implementation Plan: Track and Display Quiz Completion Rate

**Story:** 17.1 — Track and Display Quiz Completion Rate
**Branch:** `feature/e17-s01-track-and-display-quiz-completion-rate`
**Date:** 2026-03-22
**Complexity:** Small (2-3 hours)

---

## Overview

Add a quiz completion rate metric to the Reports page. The rate is calculated from Dexie `quizAttempts` (completed quizzes) and localStorage `levelup-quiz-store` (in-progress quiz state). Display uses a Progress bar with percentage and raw count labels.

---

## Codebase Context

### Files Modified

| File | Role |
|------|------|
| `src/lib/analytics.ts` | Add `calculateCompletionRate()` — pure async computation |
| `src/app/pages/Reports.tsx` | Add quiz state, card UI, update `hasActivity` check |
| `src/lib/__tests__/analytics.test.ts` | Add unit tests for `calculateCompletionRate` |
| `tests/e2e/story-e17-s01.spec.ts` | New E2E spec for quiz completion display |

### Key Patterns Referenced

- **Async data in Reports**: `getTotalStudyNotes()` → `useEffect` with ignore flag, console error on failure, initial state `0`
- **Unit test with Dexie**: `import 'fake-indexeddb/auto'` at top of test file, real `db` from `@/db`
- **Factory helpers**: `makeAttempt(overrides)` in `tests/support/fixtures/factories/quiz-factory.ts`
- **E2E navigation**: `goToReports(page)` from `tests/support/helpers/navigation`
- **Progress component**: `src/app/components/ui/progress.tsx` (shadcn/ui, Radix-based)

### DB Schema

`quizAttempts`: `'id, quizId, [quizId+completedAt], completedAt'`
→ Use `db.quizAttempts.toArray()` then `new Set(attempts.map(a => a.quizId))`

### localStorage Structure

`'levelup-quiz-store'` → `{ state: { currentProgress: QuizProgress | null, currentQuiz: Quiz | null } }`

In-progress detection (handles both current and potential future shape):
```ts
inProgressCount = parsed?.state?.inProgressQuizIds?.length
  ?? (parsed?.state?.currentProgress ? 1 : 0)
```

---

## Task Breakdown

### Task 1: `calculateCompletionRate` in `src/lib/analytics.ts`

**Goal:** Add an exported async function that computes quiz completion metrics.

```typescript
export async function calculateCompletionRate(): Promise<{
  completionRate: number
  completedCount: number
  startedCount: number
}> {
  // 1. Query all quiz attempts from Dexie
  const allAttempts = await db.quizAttempts.toArray()

  // 2. Unique completed quizIds (multiple attempts of same quiz = 1)
  const completedQuizIds = new Set(allAttempts.map(a => a.quizId))
  const completedCount = completedQuizIds.size

  // 3. Parse localStorage for in-progress quiz count
  const quizStoreData = localStorage.getItem('levelup-quiz-store')
  let inProgressCount = 0
  if (quizStoreData) {
    try {
      const parsed = JSON.parse(quizStoreData)
      inProgressCount =
        parsed?.state?.inProgressQuizIds?.length ??
        (parsed?.state?.currentProgress ? 1 : 0)
    } catch {
      inProgressCount = 0
    }
  }

  // 4. Started = completed (unique) + in-progress
  const startedCount = completedCount + inProgressCount

  // 5. Rate: 0 if nothing started
  const completionRate = startedCount > 0
    ? (completedCount / startedCount) * 100
    : 0

  return { completionRate, completedCount, startedCount }
}
```

**Placement:** Append after `analyzeTopicPerformance` — same file, new section with `// ---------------------------------------------------------------------------\n// Completion Rate\n// ---------------------------------------------------------------------------` comment header.

---

### Task 2: Quiz Completion Card in `src/app/pages/Reports.tsx`

**2.1 — State + Effect**

```typescript
// New import at top
import { Progress } from '@/app/components/ui/progress'
import { calculateCompletionRate } from '@/lib/analytics'

// New state
const [quizData, setQuizData] = useState<{
  completionRate: number
  completedCount: number
  startedCount: number
}>({ completionRate: 0, completedCount: 0, startedCount: 0 })

// New useEffect (alongside existing studyNotes effect)
useEffect(() => {
  let ignore = false
  calculateCompletionRate()
    .then(data => {
      if (!ignore) setQuizData(data)
    })
    .catch(err => console.error('Failed to load quiz completion rate:', err))
  return () => { ignore = true }
}, [])
```

**2.2 — Update `hasActivity`**

```typescript
const hasActivity =
  completedLessons > 0 ||
  studyNotes > 0 ||
  activityData.some(d => d.activities > 0) ||
  quizData.startedCount > 0  // ← ADD THIS
```

**2.3 — New Card in Study Tab**

Position: New Row 5 (before existing Row 5 "Recent Activity"), or append as last item. Prefer appending as a new `<motion.div variants={fadeUp}>` block before Recent Activity.

```tsx
{/* ── Row 5: Quiz Completion Rate ── */}
<motion.div variants={fadeUp}>
  <Card data-testid="quiz-completion-card">
    <CardHeader>
      <CardTitle className="text-base flex items-center gap-2">
        <CheckCircle className="size-4 text-muted-foreground" aria-hidden="true" />
        Quiz Completion Rate
      </CardTitle>
    </CardHeader>
    <CardContent>
      {quizData.startedCount === 0 ? (
        <p className="text-sm text-muted-foreground">No quizzes started yet</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Progress
              value={quizData.completionRate}
              className="flex-1"
              aria-label={`Quiz completion rate: ${Math.round(quizData.completionRate)}%`}
            />
            <span className="text-2xl font-bold tabular-nums">
              {Math.round(quizData.completionRate)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {quizData.completedCount} of {quizData.startedCount} started quizzes completed
          </p>
        </>
      )}
    </CardContent>
  </Card>
</motion.div>
```

Note: `CheckCircle` is already imported in `Reports.tsx`. `Progress` needs to be imported.

**Renumbering:** Existing "Row 5: Recent Activity Timeline" becomes "Row 6" in comments.

---

### Task 3: Unit Tests

**File:** `src/lib/__tests__/analytics.test.ts`

Add a new `describe('calculateCompletionRate', ...)` block after the existing `analyzeTopicPerformance` tests.

**Test setup:** Import `fake-indexeddb/auto` at the top of the file (or a new file `src/lib/__tests__/analytics.completionRate.test.ts` if preferred). Since `fake-indexeddb` may already be available (used in `progress.test.ts`), check `package.json`.

**Test cases:**

```typescript
import 'fake-indexeddb/auto'
import { db } from '@/db'
import { makeAttempt } from '../../../tests/support/fixtures/factories/quiz-factory'
import { calculateCompletionRate } from '@/lib/analytics'

beforeEach(async () => {
  await db.quizAttempts.clear()
  localStorage.clear()
})

describe('calculateCompletionRate', () => {
  it('returns 0% with 0 started when no data', async () => {
    const result = await calculateCompletionRate()
    expect(result).toEqual({ completionRate: 0, completedCount: 0, startedCount: 0 })
  })

  it('returns 100% when all started quizzes are completed', async () => {
    await db.quizAttempts.bulkAdd([
      makeAttempt({ quizId: 'q1' }),
      makeAttempt({ quizId: 'q2' }),
    ])
    const result = await calculateCompletionRate()
    expect(result.completedCount).toBe(2)
    expect(result.startedCount).toBe(2)
    expect(result.completionRate).toBe(100)
  })

  it('counts multiple attempts of same quiz as 1 completed', async () => {
    await db.quizAttempts.bulkAdd([
      makeAttempt({ quizId: 'q1' }),
      makeAttempt({ quizId: 'q1' }),
      makeAttempt({ quizId: 'q1' }),
    ])
    const result = await calculateCompletionRate()
    expect(result.completedCount).toBe(1)
    expect(result.startedCount).toBe(1)
  })

  it('counts in-progress quiz from localStorage currentProgress', async () => {
    await db.quizAttempts.bulkAdd([
      makeAttempt({ quizId: 'q1' }),
      makeAttempt({ quizId: 'q2' }),
      makeAttempt({ quizId: 'q3' }),
    ])
    localStorage.setItem('levelup-quiz-store', JSON.stringify({
      state: { currentProgress: { quizId: 'q4', currentQuestionIndex: 2 }, currentQuiz: { id: 'q4' } }
    }))
    const result = await calculateCompletionRate()
    expect(result.completedCount).toBe(3)
    expect(result.startedCount).toBe(4)
    expect(result.completionRate).toBe(75)
  })

  it('handles malformed localStorage JSON without throwing', async () => {
    localStorage.setItem('levelup-quiz-store', 'not-json}}}')
    const result = await calculateCompletionRate()
    expect(result.startedCount).toBe(0)
    expect(result.completionRate).toBe(0)
  })

  it('uses inProgressQuizIds array if present in localStorage', async () => {
    await db.quizAttempts.add(makeAttempt({ quizId: 'q1' }))
    localStorage.setItem('levelup-quiz-store', JSON.stringify({
      state: { inProgressQuizIds: ['q2', 'q3'], currentProgress: null }
    }))
    const result = await calculateCompletionRate()
    expect(result.completedCount).toBe(1)
    expect(result.startedCount).toBe(3) // 1 completed + 2 in-progress
    expect(Math.round(result.completionRate)).toBe(33)
  })
})
```

---

### Task 4: E2E Tests

**File:** `tests/e2e/story-e17-s01.spec.ts`

```typescript
import { test, expect } from '../support/fixtures'
import { goToReports } from '../support/helpers/navigation'

test.describe('E17-S01 Quiz Completion Rate', () => {
  test('shows "No quizzes started yet" when no quiz data', async ({ page }) => {
    await goToReports(page)
    // Page may show empty state (no activity at all), or show the quiz card
    // If page-level empty state shows, navigate won't show the card — check for either
    const quizCard = page.getByTestId('quiz-completion-card')
    const pageEmptyState = page.getByTestId('empty-state-sessions')

    const isPageEmpty = await pageEmptyState.isVisible()
    if (!isPageEmpty) {
      await expect(quizCard).toBeVisible()
      await expect(quizCard.getByText('No quizzes started yet')).toBeVisible()
    }
  })

  test('shows 75% completion rate with 3 completed and 1 in-progress', async ({ page, context }) => {
    // Seed 3 completed quiz attempts (unique quizIds)
    await context.addInitScript(() => {
      // Seed quizAttempts via IndexedDB
      // (Use existing IDB seeding helper from tests/support if available,
      //  or seed via page evaluate)
    })
    // [Implementation depends on available E2E seeding helpers]
    // See tests/support/ for existing IDB/localStorage seeding patterns

    await goToReports(page)
    const quizCard = page.getByTestId('quiz-completion-card')
    await expect(quizCard).toBeVisible()
    await expect(quizCard.getByText('75%')).toBeVisible()
    await expect(quizCard.getByText(/3 of 4 started quizzes completed/)).toBeVisible()
  })

  test('shows 100% completion rate with 2 completed quizzes', async ({ page }) => {
    await goToReports(page)
    // [Seed 2 unique completed attempts, no in-progress]
    // Verify 100% is displayed
  })
})
```

**Note on E2E seeding:** Check `tests/support/` for IDB/localStorage seeders used in existing specs (e.g., `story-12-6.spec.ts`). If no quiz seeder exists, create one at `tests/support/helpers/seed-quiz-attempts.ts`.

---

## Sequence of Implementation

```
1. Analytics function (Task 1) — no dependencies
2. Unit tests (Task 3) — validates Task 1 before UI work
3. UI card in Reports (Task 2) — depends on Task 1 being stable
4. E2E tests (Task 4) — end-to-end validation
```

---

## Design Review Focus Areas (per epic spec)

- Progress bar styling (uses shadcn `Progress` — check dark mode contrast)
- Percentage display size (`text-2xl font-bold`) — adequate emphasis
- Raw numbers clarity (`text-sm text-muted-foreground`)
- Empty state message styling (muted, not alarming)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `fake-indexeddb` not available for unit test | Check `package.json`; use `vi.mock('@/db')` pattern instead (see `relatedConcepts.test.ts`) |
| E2E seeding for quiz attempts complex | Check `story-12-6.spec.ts` for prior art; implement minimal helper |
| `hasActivity` change hides quiz card in empty state | Card is inside the tab content (shown only when `hasActivity`); update `hasActivity` to include `quizData.startedCount > 0` (Task 2.2) |
| LocalStorage shape differs from spec | Handled by `??` fallback chain — both shapes produce correct result |

---

## Acceptance Criteria Mapping

| AC | Implemented By |
|----|---------------|
| Completion rate % displayed | Task 1 (calculation) + Task 2 (card) |
| In-progress counts as started | Task 1 (localStorage parsing) |
| Multiple attempts = 1 completed | Task 1 (Set-based dedup) |
| Empty state "No quizzes started yet" | Task 2.3 (conditional render) |
| Visual progress bar + raw numbers | Task 2.3 (Progress + text) |
