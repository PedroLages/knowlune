# E16-S05: Score Improvement Trajectory Chart — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a recharts line chart to `QuizResults` that shows score trajectory across multiple quiz attempts, with a dashed passing-score reference line and color-coded dots.

**Architecture:** Create a new `ScoreTrajectoryChart` component in `src/app/components/quiz/` that receives pre-mapped `attempts` data and `passingScore`. `QuizResults.tsx` maps the existing `attempts` array into `{ attemptNumber, percentage }` entries and renders the chart. No store changes required — all data flows from the existing `selectAttempts` selector.

**Tech Stack:** React 19, TypeScript, recharts (`LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ReferenceLine`, `ResponsiveContainer`), shadcn/ui `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartConfig`, `useIsMobile` from `@/app/hooks/useMediaQuery`, Vitest + React Testing Library for unit tests, Playwright for E2E.

---

## Task 1: Create ScoreTrajectoryChart component

**Files:**
- Create: `src/app/components/quiz/ScoreTrajectoryChart.tsx`
- Create: `src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx`

### Step 1: Write the failing unit test

Create `src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx`:

```tsx
/**
 * Unit tests for ScoreTrajectoryChart
 * Mocks recharts to avoid canvas/DOM issues in Vitest
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ScoreTrajectoryChart } from '../ScoreTrajectoryChart'

// Mirror the recharts mock pattern from Reports.test.tsx
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    ...actual,
    ResponsiveContainer: Passthrough,
    LineChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: ({ label }: { label?: { value?: string } }) => (
      <div data-testid="reference-line">{label?.value}</div>
    ),
  }
})

describe('ScoreTrajectoryChart', () => {
  const twoAttempts = [
    { attemptNumber: 1, percentage: 60 },
    { attemptNumber: 2, percentage: 80 },
  ]

  it('renders chart when 2+ attempts provided', () => {
    render(<ScoreTrajectoryChart attempts={twoAttempts} passingScore={70} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders passing score reference line with label', () => {
    render(<ScoreTrajectoryChart attempts={twoAttempts} passingScore={70} />)
    expect(screen.getByTestId('reference-line')).toHaveTextContent('Passing: 70%')
  })

  it('returns null when fewer than 2 attempts', () => {
    const { container } = render(
      <ScoreTrajectoryChart attempts={[{ attemptNumber: 1, percentage: 80 }]} passingScore={70} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when attempts array is empty', () => {
    const { container } = render(
      <ScoreTrajectoryChart attempts={[]} passingScore={70} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders section heading', () => {
    render(<ScoreTrajectoryChart attempts={twoAttempts} passingScore={70} />)
    expect(screen.getByText('Score Trajectory')).toBeInTheDocument()
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd /Volumes/SSD/Dev/Apps/Knowlune
npx vitest run src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx
```

Expected: FAIL — module `ScoreTrajectoryChart` not found.

### Step 3: Create the ScoreTrajectoryChart component

Create `src/app/components/quiz/ScoreTrajectoryChart.tsx`:

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type DotProps,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { useIsMobile } from '@/app/hooks/useMediaQuery'

interface ScoreTrajectoryChartProps {
  attempts: Array<{ attemptNumber: number; percentage: number }>
  passingScore: number
}

const chartConfig = {
  percentage: {
    label: 'Score',
    color: 'var(--color-brand)',
  },
} satisfies ChartConfig

/**
 * Custom dot renderer: green for at/above passing, brand color for below.
 * Receives recharts DotProps plus our custom passingScore via closure.
 */
function makeCustomDot(passingScore: number) {
  return function CustomDot(props: DotProps & { payload?: { percentage?: number } }) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const pct = payload?.percentage ?? 0
    const color =
      pct >= passingScore ? 'var(--color-success)' : 'var(--color-brand)'
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
  }
}

export function ScoreTrajectoryChart({ attempts, passingScore }: ScoreTrajectoryChartProps) {
  const isMobile = useIsMobile()

  // AC3: Require at least 2 data points
  if (attempts.length < 2) return null

  const chartHeight = isMobile ? 200 : 300

  return (
    <section aria-label="Score trajectory chart" className="mt-6 text-left">
      <h4 className="font-semibold text-sm text-muted-foreground mb-3">Score Trajectory</h4>
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
        <LineChart data={attempts} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="attemptNumber"
            label={{ value: 'Attempt', position: 'insideBottom', offset: -10 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            domain={[0, 100]}
            label={{ value: 'Score %', angle: -90, position: 'insideLeft', offset: 10 }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [`${value}%`, 'Score']}
                labelFormatter={(label) => `Attempt ${label}`}
              />
            }
          />
          <ReferenceLine
            y={passingScore}
            stroke="var(--color-success)"
            strokeDasharray="5 5"
            label={{
              value: `Passing: ${passingScore}%`,
              fill: 'var(--color-success)',
              fontSize: 11,
              position: 'insideTopRight',
            }}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={makeCustomDot(passingScore)}
            activeDot={{ r: 7 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </section>
  )
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx
```

Expected: 5 tests pass.

### Step 5: Commit

```bash
git add src/app/components/quiz/ScoreTrajectoryChart.tsx \
        src/app/components/quiz/__tests__/ScoreTrajectoryChart.test.tsx
git commit -m "feat(E16-S05): add ScoreTrajectoryChart component with unit tests"
```

---

## Task 2: Integrate ScoreTrajectoryChart into QuizResults

**Files:**
- Modify: `src/app/pages/QuizResults.tsx`

### Step 1: Add mapped attempts data + import

In `QuizResults.tsx`, add the import and `useMemo` for trajectory data. Insert after the existing `previousAttemptTimeSpent` useMemo (around line 68):

```tsx
// Import at top of file (add to existing imports)
import { ScoreTrajectoryChart } from '@/app/components/quiz/ScoreTrajectoryChart'

// Add this useMemo after `previousAttemptTimeSpent` (around line 68):
const trajectoryData = useMemo(
  () =>
    attempts.map((attempt, index) => ({
      attemptNumber: index + 1,
      percentage: Math.round(Math.min(100, Math.max(0, attempt.percentage))),
    })),
  [attempts]
)
```

### Step 2: Render the chart in JSX

In the return JSX, add `<ScoreTrajectoryChart>` after `<ScoreSummary>` and before `<QuestionBreakdown>`:

```tsx
<ScoreSummary
  percentage={lastAttempt.percentage}
  {/* ...existing props... */}
/>

{/* Score trajectory chart — only renders with 2+ attempts */}
<ScoreTrajectoryChart
  attempts={trajectoryData}
  passingScore={currentQuiz.passingScore}
/>

<QuestionBreakdown answers={lastAttempt.answers} questions={currentQuiz.questions} />
```

### Step 3: Run the full unit test suite

```bash
npx vitest run
```

Expected: All existing tests pass, no regressions.

### Step 4: Run build check

```bash
npm run build
```

Expected: Builds cleanly with no TypeScript errors.

### Step 5: Commit

```bash
git add src/app/pages/QuizResults.tsx
git commit -m "feat(E16-S05): integrate ScoreTrajectoryChart into QuizResults page"
```

---

## Task 3: E2E tests

**Files:**
- Create: `tests/e2e/story-e16-s05.spec.ts`

### Step 1: Write the failing E2E test

Create `tests/e2e/story-e16-s05.spec.ts`:

```ts
/**
 * ATDD E2E tests for E16-S05: Display Score Improvement Trajectory Chart
 *
 * Tests the trajectory chart appearing on the QuizResults page:
 * - AC1: Chart appears when 2+ attempts exist
 * - AC2: Passing score reference line is labeled correctly
 * - AC3: Chart is hidden with only 1 attempt
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e16s05'
const LESSON_ID = 'test-lesson-e16s05'
const QUIZ_ID = 'quiz-e16s05'

const q1 = makeQuestion({
  id: 'q1-e16s05',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Math Basics',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// Two attempts: first at 60% (below passing), second at 100% (above passing)
const attempt1 = makeAttempt({
  id: 'attempt1-e16s05',
  quizId: QUIZ_ID,
  score: 0,
  percentage: 60,
  passed: false,
  answers: [{ questionId: q1.id, userAnswer: '3', isCorrect: false, pointsEarned: 0, pointsPossible: 1 }],
})

const attempt2 = makeAttempt({
  id: 'attempt2-e16s05',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 100,
  passed: true,
  answers: [{ questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 }],
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedData(
  page: import('@playwright/test').Page,
  quizzes: unknown[],
  attempts: unknown[]
) {
  await page.evaluate(
    async ({ quizData, attemptData, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (
              !db.objectStoreNames.contains('quizzes') ||
              !db.objectStoreNames.contains('quizAttempts')
            ) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(['quizzes', 'quizAttempts'], 'readwrite')
            for (const item of quizData) tx.objectStore('quizzes').put(item)
            for (const item of attemptData) tx.objectStore('quizAttempts').put(item)
            tx.oncomplete = () => { db.close(); resolve('ok') }
            tx.onerror = () => { db.close(); reject(tx.error) }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error('Required stores not found after retries')
    },
    { quizData: quizzes, attemptData: attempts, maxRetries: 10, retryDelay: 200 }
  )
}

async function navigateToResults(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedData(page, [quiz], [attempt1, attempt2])
  // Manually set quiz store state so QuizResults doesn't redirect
  await page.evaluate(
    ({ quizId, lessonId, q, attempts }) => {
      // Zustand-persisted quiz store keys
      localStorage.setItem(
        'quiz-store',
        JSON.stringify({
          state: {
            currentQuiz: { ...q },
            attempts: attempts,
            isLoading: false,
            currentAttempt: null,
            progress: null,
          },
          version: 0,
        })
      )
    },
    { quizId: QUIZ_ID, lessonId: LESSON_ID, q: quiz, attempts: [attempt1, attempt2] }
  )
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E16-S05: Score Trajectory Chart', () => {
  test('AC1: chart appears after 2+ attempts', async ({ page }) => {
    await navigateToResults(page)
    await expect(page.getByText('Score Trajectory')).toBeVisible()
  })

  test('AC2: passing score reference line is labeled correctly', async ({ page }) => {
    await navigateToResults(page)
    // Label "Passing: 70%" should appear somewhere in the chart area
    await expect(page.getByText(/Passing: 70%/i)).toBeVisible()
  })

  test('AC3: chart is hidden with only 1 attempt', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedData(page, [quiz], [attempt2]) // only 1 attempt
    await page.evaluate(
      ({ q, singleAttempt }) => {
        localStorage.setItem(
          'quiz-store',
          JSON.stringify({
            state: {
              currentQuiz: { ...q },
              attempts: [singleAttempt],
              isLoading: false,
              currentAttempt: null,
              progress: null,
            },
            version: 0,
          })
        )
      },
      { q: quiz, singleAttempt: attempt2 }
    )
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
      waitUntil: 'domcontentloaded',
    })
    // Chart heading should NOT be visible
    await expect(page.getByText('Score Trajectory')).not.toBeVisible()
  })
})
```

**Important note on E2E approach:** The `navigateToResults` helper uses a direct Zustand store injection via `localStorage.setItem('quiz-store', ...)` because `QuizResults` reads from the quiz store (not just IndexedDB directly). Check the actual Zustand persist key in `useQuizStore.ts` before running — it may differ.

### Step 2: Verify the quiz store's localStorage key

```bash
grep -n "persist\|name:" /Volumes/SSD/Dev/Apps/Knowlune/src/stores/useQuizStore.ts | head -10
```

Adjust the `localStorage.setItem` key in the test to match the actual key (e.g., `'quiz-store'` or whatever name is used in the `persist()` call).

### Step 3: Run E2E tests

```bash
npx playwright test tests/e2e/story-e16-s05.spec.ts --project=chromium
```

Expected: 3 tests pass.

If AC3 test is flaky (timing), add a short `page.waitForTimeout(300)` after navigation with a comment explaining why — this is acceptable for page settle time in results redirect logic.

### Step 4: Commit

```bash
git add tests/e2e/story-e16-s05.spec.ts
git commit -m "test(E16-S05): add E2E tests for score trajectory chart"
```

---

## Task 4: Final validation

### Step 1: Run full test suite

```bash
npx vitest run && npx playwright test tests/e2e/story-e16-s05.spec.ts tests/e2e/story-12-6.spec.ts --project=chromium
```

Expected: All pass.

### Step 2: Run build + lint

```bash
npm run build && npm run lint
```

Expected: No errors. If design-tokens lint rule fires, confirm all color references use CSS variables (`var(--color-brand)`, `var(--color-success)`) — not hardcoded Tailwind classes.

### Step 3: Commit final state

```bash
git status  # should be clean after prior commits
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Chart wrapper | `ChartContainer` (shadcn) | Injects CSS variable theming automatically — axis ticks, tooltips respect dark mode |
| Responsive height | `useIsMobile()` + inline `style` | JS value required for height; Tailwind `h-[200px] sm:h-[300px]` would also work but `useIsMobile` is more explicit |
| Dot coloring | Custom `dot` render prop (closure) | Only recharts mechanism for per-point dot colors; no external state needed |
| Animation | `isAnimationActive={false}` | Avoids test flakiness from recharts SVG animation in Playwright |
| Chart placement | After ScoreSummary, before QuestionBreakdown | Secondary analytics section — hero is the score ring |

## Potential Pitfalls

1. **Zustand persist key:** The E2E test injects store state via `localStorage`. The exact key must match `useQuizStore`'s `persist({ name: '...' })`. Verify before running tests.
2. **recharts SVG in unit tests:** `ChartContainer` renders into a `<div>` — the `ResponsiveContainer` inside may have zero size in jsdom. The mock in Task 1 replaces `ResponsiveContainer` with a passthrough to avoid this.
3. **ReferenceLine label visibility:** recharts renders `ReferenceLine` labels as SVG `<text>` elements. Playwright's `getByText()` can find these if the text is a direct text node. If `getByText(/Passing: 70%/)` fails, scope to the chart's parent `<section>` element.
4. **ChartContainer `style` vs `className` height:** `ChartContainer` wraps in a `<div>`. Setting `style={{ height: chartHeight }}` alongside `className="w-full"` is the reliable approach when height is dynamic. The `aspect-video` class in ChartContainer's default className will conflict — override it by passing explicit `className` without aspect-video.
