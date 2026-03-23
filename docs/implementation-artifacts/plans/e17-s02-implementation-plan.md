# Implementation Plan: E17-S02 — Track Average Retake Frequency

**Date:** 2026-03-22
**Branch:** `feature/e17-s02-track-average-retake-frequency`
**Complexity:** Small (2-3 hours)

---

## Overview

Add an "Average Retake Frequency" metric to the Reports page. The metric shows how often a learner retakes quizzes on average, with an encouraging interpretation string. The implementation follows the same async DB → useEffect → Card pattern established by E17-S01.

---

## Codebase Context

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/analytics.ts` | Add `calculateRetakeFrequency()` async function and `interpretRetakeFrequency()` pure function |
| `src/app/pages/Reports.tsx` | Add `retakeData` state + `useEffect` + new Card in study tab |

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/__tests__/analytics.test.ts` | Add new `describe` blocks for both new functions (appended) |
| `tests/e2e/regression/story-e17-s02.spec.ts` | New E2E spec with 4 test cases |

### Key Dependencies

- **`src/db/schema.ts`**: `quizAttempts` table (`id, quizId, [quizId+completedAt], completedAt`)
- **`src/types/quiz.ts:191`**: `QuizAttempt` type (`{ id, quizId, answers, score, percentage, passed, timeSpent, completedAt, startedAt, timerAccommodation }`)
- **`src/db/index.ts`** (or wherever `db` is exported): `import { db } from '@/db'`

### E17-S01 Branch Conflict Warning

E17-S01 (`feature/e17-s01-track-and-display-quiz-completion-rate`) is not yet merged. It adds:
- `import { db } from '@/db'` to `analytics.ts`
- A Quiz Completion Rate Card as Row 5 in Reports.tsx

If E17-S01 merges before this PR, expect merge conflicts in both files. Resolution:
- `analytics.ts`: Keep both functions, both imports (if not de-duplicated)
- `Reports.tsx`: Place both cards in a 2-column grid (`grid grid-cols-1 md:grid-cols-2 gap-4`)

---

## Step-by-Step Implementation

### Step 1: `src/lib/analytics.ts` — Add Retake Frequency Functions

**1a. Add `db` import** (top of file, after existing imports):
```typescript
import { db } from '@/db'
```

**1b. Add type and `calculateRetakeFrequency` at the bottom of `analytics.ts`**:

```typescript
// ---------------------------------------------------------------------------
// Retake Frequency (E17-S02)
// ---------------------------------------------------------------------------

export type RetakeFrequencyResult = {
  /** Average number of attempts per unique quiz */
  averageRetakes: number
  /** Total completed attempts across all quizzes */
  totalAttempts: number
  /** Number of distinct quizzes attempted at least once */
  uniqueQuizzes: number
}

/**
 * Calculate average retake frequency from quiz attempt history.
 *
 * Formula: totalAttempts / uniqueQuizzes
 *
 * Multiple attempts for the same quizId all count. Returns 0 when no
 * attempts exist (no division by zero).
 */
export async function calculateRetakeFrequency(): Promise<RetakeFrequencyResult> {
  const allAttempts = await db.quizAttempts.toArray()
  const uniqueQuizIds = new Set(allAttempts.map(a => a.quizId))

  const totalAttempts = allAttempts.length
  const uniqueQuizzes = uniqueQuizIds.size
  const averageRetakes = uniqueQuizzes > 0 ? totalAttempts / uniqueQuizzes : 0

  return { averageRetakes, totalAttempts, uniqueQuizzes }
}

/**
 * Returns an encouraging interpretation string for the retake frequency.
 *
 * Bands:
 * - ≤ 1.0: "No retakes yet — each quiz taken once."
 * - ≤ 2.0: "Light review — you occasionally revisit quizzes."
 * - ≤ 3.0: "Active practice — you retake quizzes 2-3 times on average for mastery."
 * - > 3.0: "Deep practice — strong commitment to mastery through repetition."
 */
export function interpretRetakeFrequency(avg: number): string {
  if (avg <= 1.0) return 'No retakes yet — each quiz taken once.'
  if (avg <= 2.0) return 'Light review — you occasionally revisit quizzes.'
  if (avg <= 3.0) return 'Active practice — you retake quizzes 2-3 times on average for mastery.'
  return 'Deep practice — strong commitment to mastery through repetition.'
}
```

---

### Step 2: `src/app/pages/Reports.tsx` — Wire State and Card

**2a. Add import** (alongside existing analytics import):
```typescript
import { calculateRetakeFrequency, interpretRetakeFrequency } from '@/lib/analytics'
```

**2b. Add `RotateCcw` to lucide-react import** (alongside `BookOpen, CheckCircle, ...`):
```typescript
import { BookOpen, CheckCircle, FileText, TrendingUp, Clock, RotateCcw } from 'lucide-react'
```

**2c. Add state** (alongside existing `studyNotes` state):
```typescript
const [retakeData, setRetakeData] = useState<RetakeFrequencyResult>({
  averageRetakes: 0,
  totalAttempts: 0,
  uniqueQuizzes: 0,
})
```

Also add the `RetakeFrequencyResult` import:
```typescript
import { calculateRetakeFrequency, interpretRetakeFrequency, type RetakeFrequencyResult } from '@/lib/analytics'
```

**2d. Add useEffect** (alongside existing study notes useEffect):
```typescript
useEffect(() => {
  let ignore = false
  calculateRetakeFrequency()
    .then(data => {
      if (!ignore) setRetakeData(data)
    })
    .catch(err => console.error('Failed to load retake frequency:', err))
  return () => {
    ignore = true
  }
}, [])
```

**2e. Update `hasActivity` guard** to include retake data:
```typescript
const hasActivity =
  completedLessons > 0 ||
  studyNotes > 0 ||
  activityData.some(d => d.activities > 0) ||
  retakeData.totalAttempts > 0
```

**2f. Add Card** (as Row 5 in study tab, before existing Row 5 "Recent Activity Timeline"):
```tsx
{/* ── Row 5: Average Retake Frequency ── */}
<motion.div variants={fadeUp}>
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
</motion.div>
```

---

### Step 3: Unit Tests — `src/lib/__tests__/analytics.test.ts`

Append two new `describe` blocks to the existing test file. Note: `calculateRetakeFrequency` reads from Dexie DB so it needs `vi.mock('@/db')`.

```typescript
// ---------------------------------------------------------------------------
// calculateRetakeFrequency (E17-S02)
// ---------------------------------------------------------------------------

import { vi } from 'vitest'
import { db } from '@/db'  // mocked

vi.mock('@/db', () => ({
  db: {
    quizAttempts: {
      toArray: vi.fn(),
    },
  },
}))

const mockToArray = db.quizAttempts.toArray as ReturnType<typeof vi.fn>

describe('calculateRetakeFrequency', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 0 averageRetakes when no attempts', async () => {
    mockToArray.mockResolvedValue([])
    const result = await calculateRetakeFrequency()
    expect(result).toEqual({ averageRetakes: 0, totalAttempts: 0, uniqueQuizzes: 0 })
  })

  it('calculates 3.0 for one quiz attempted 3 times', async () => {
    mockToArray.mockResolvedValue([
      { id: 'a1', quizId: 'q1' },
      { id: 'a2', quizId: 'q1' },
      { id: 'a3', quizId: 'q1' },
    ])
    const result = await calculateRetakeFrequency()
    expect(result.averageRetakes).toBe(3)
    expect(result.totalAttempts).toBe(3)
    expect(result.uniqueQuizzes).toBe(1)
  })

  it('calculates 1.0 for two different quizzes each attempted once', async () => {
    mockToArray.mockResolvedValue([
      { id: 'a1', quizId: 'q1' },
      { id: 'a2', quizId: 'q2' },
    ])
    const result = await calculateRetakeFrequency()
    expect(result.averageRetakes).toBe(1)
    expect(result.totalAttempts).toBe(2)
    expect(result.uniqueQuizzes).toBe(2)
  })

  it('calculates 2.5 for quiz A × 3 + quiz B × 2', async () => {
    mockToArray.mockResolvedValue([
      { id: 'a1', quizId: 'qA' },
      { id: 'a2', quizId: 'qA' },
      { id: 'a3', quizId: 'qA' },
      { id: 'a4', quizId: 'qB' },
      { id: 'a5', quizId: 'qB' },
    ])
    const result = await calculateRetakeFrequency()
    expect(result.averageRetakes).toBe(2.5)
    expect(result.totalAttempts).toBe(5)
    expect(result.uniqueQuizzes).toBe(2)
  })
})

describe('interpretRetakeFrequency', () => {
  it('returns "No retakes yet" for exactly 1.0', () => {
    expect(interpretRetakeFrequency(1.0)).toBe('No retakes yet — each quiz taken once.')
  })

  it('returns "Light review" for 1.5', () => {
    expect(interpretRetakeFrequency(1.5)).toBe('Light review — you occasionally revisit quizzes.')
  })

  it('returns "Active practice" for 2.5', () => {
    expect(interpretRetakeFrequency(2.5)).toBe('Active practice — you retake quizzes 2-3 times on average for mastery.')
  })

  it('returns "Deep practice" for 4.0', () => {
    expect(interpretRetakeFrequency(4.0)).toBe('Deep practice — strong commitment to mastery through repetition.')
  })
})
```

> **Note:** Check how existing `analytics.test.ts` handles imports. If it doesn't already mock `@/db`, the mock must be scoped to only the new tests or placed at file-level with careful `beforeEach` reset.

---

### Step 4: E2E Tests — `tests/e2e/regression/story-e17-s02.spec.ts`

Pattern: seed `quizAttempts` via IndexedDB injection (matches `story-e16-s01.spec.ts`), navigate to `/reports`, assert on `data-testid="quiz-retake-card"`.

```typescript
/**
 * E2E tests for E17-S02: Track Average Retake Frequency
 */
import { test, expect } from '../support/fixtures'
import { makeAttempt } from '../support/fixtures/factories/quiz-factory'

const QUIZ_A = 'quiz-e17s02-a'
const QUIZ_B = 'quiz-e17s02-b'

// Helper: seed quizAttempts store
async function seedAttempts(page, attempts) {
  await page.evaluate(
    async ({ data }) => {
      for (let i = 0; i < 10; i++) {
        const result = await new Promise((resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains('quizAttempts')) {
              db.close(); resolve('missing'); return
            }
            const tx = db.transaction('quizAttempts', 'readwrite')
            const store = tx.objectStore('quizAttempts')
            for (const item of data) store.put(item)
            tx.oncomplete = () => { db.close(); resolve('ok') }
            tx.onerror = () => { db.close(); reject(tx.error) }
          }
          req.onerror = () => reject(req.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, 200))
      }
      throw new Error('quizAttempts store not found after retries')
    },
    { data: attempts }
  )
}

test.describe('E17-S02: Average Retake Frequency', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  })

  test('AC: quiz A × 3 → retake frequency 3.0 with Deep Practice text', async ({ page }) => {
    await seedAttempts(page, [
      makeAttempt({ id: 'r1', quizId: QUIZ_A }),
      makeAttempt({ id: 'r2', quizId: QUIZ_A }),
      makeAttempt({ id: 'r3', quizId: QUIZ_A }),
    ])
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /study analytics/i }).click()

    const card = page.getByTestId('quiz-retake-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('3.0')
    await expect(card).toContainText('attempts per quiz')
    await expect(card).toContainText('Deep practice')
  })

  test('AC: two different quizzes once each → retake frequency 1.0 with No Retakes text', async ({ page }) => {
    await seedAttempts(page, [
      makeAttempt({ id: 'r4', quizId: QUIZ_A }),
      makeAttempt({ id: 'r5', quizId: QUIZ_B }),
    ])
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /study analytics/i }).click()

    const card = page.getByTestId('quiz-retake-card')
    await expect(card).toContainText('1.0')
    await expect(card).toContainText('No retakes yet')
  })

  test('AC: quiz A × 3 + quiz B × 2 → 2.5 with Active Practice text', async ({ page }) => {
    await seedAttempts(page, [
      makeAttempt({ id: 'r6', quizId: QUIZ_A }),
      makeAttempt({ id: 'r7', quizId: QUIZ_A }),
      makeAttempt({ id: 'r8', quizId: QUIZ_A }),
      makeAttempt({ id: 'r9', quizId: QUIZ_B }),
      makeAttempt({ id: 'r10', quizId: QUIZ_B }),
    ])
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: /study analytics/i }).click()

    const card = page.getByTestId('quiz-retake-card')
    await expect(card).toContainText('2.5')
    await expect(card).toContainText('Active practice')
  })

  test('AC: zero attempts → Reports shows empty state (no quiz-retake-card)', async ({ page }) => {
    // Don't seed any attempts — default DB is empty for quizAttempts
    // Also ensure lessons/courses are empty so hasActivity is false
    await page.goto('/reports', { waitUntil: 'domcontentloaded' })
    // Empty state should be shown — the retake card is not rendered
    await expect(page.getByTestId('empty-state-sessions')).toBeVisible()
    await expect(page.getByTestId('quiz-retake-card')).not.toBeVisible()
  })
})
```

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| E17-S01 merges before E17-S02 PR | Medium | Resolve merge conflict: keep both cards, put in 2-col grid |
| Dexie mock complexity in unit tests | Low | Use `vi.mock('@/db')` with `mockResolvedValue`; check if existing tests in file already mock `@/db` |
| `makeAttempt` factory doesn't accept `quizId` override | Low | Check factory signature in `tests/support/fixtures/factories/quiz-factory.ts` |
| `hasActivity` guard hides card in E2E | Low | Seeding ≥1 attempt sets `retakeData.totalAttempts > 0`, satisfying the guard |
| Reports page tab label varies | Low | Use `getByRole('tab', { name: /study analytics/i })` for resilience |

---

## Acceptance Criteria Traceability

| AC | Where Tested |
|----|-------------|
| Average retake = total attempts / unique quizzes | Unit: `calculateRetakeFrequency` 2.5 scenario |
| Quiz A×3 + Quiz B×2 = 2.5 | Unit: exact scenario; E2E: test 3 |
| Interpretation ≤1.0: "No retakes yet" | Unit: boundary 1.0; E2E: test 2 |
| Interpretation 1.1–2.0: "Light review" | Unit: 1.5 |
| Interpretation 2.1–3.0: "Active practice" | Unit: 2.5; E2E: test 3 |
| Interpretation >3.0: "Deep practice" | Unit: 4.0; E2E: test 1 |
| Rounded to 1 decimal place | E2E: all tests assert on `X.X` format |

---

## Definition of Done

- [ ] `npm run build` passes
- [ ] `npm run lint` passes (no hardcoded colors, no silent catches)
- [ ] `npx tsc --noEmit` passes
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] E2E tests pass for story spec (Chromium)
- [ ] Card renders correctly in Reports Study Analytics tab
- [ ] Empty state shows correctly when no attempts
- [ ] Interpretation text matches spec exactly
