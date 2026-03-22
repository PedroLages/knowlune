# E17-S03: Calculate Item Difficulty (P-Values) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a P-value based item difficulty analysis to the `QuizResults` page. Each quiz question gets a difficulty score (proportion correct across all attempts), categorized as Easy/Medium/Difficult, and displayed in a ranked list with suggestion text for consistently hard questions.

**Architecture:**
- `calculateItemDifficulty()` — pure function added to `src/lib/analytics.ts`
- `ItemDifficultyAnalysis` — new component in `src/app/components/quiz/ItemDifficultyAnalysis.tsx`
- `QuizResults.tsx` — minor integration (import + render after ScoreTrajectoryChart)
- No store changes, no schema migrations — all data flows from existing `selectAttempts` + `selectCurrentQuiz`

**Test stack:** Vitest + React Testing Library (unit + component), Playwright (E2E)

---

## Task 1: Add `calculateItemDifficulty` to `src/lib/analytics.ts`

**Files:**
- Modify: `src/lib/analytics.ts`
- Modify: `src/lib/__tests__/analytics.test.ts`

### Step 1.1: Write the failing unit tests

Add a new `describe('calculateItemDifficulty', ...)` block at the bottom of `src/lib/__tests__/analytics.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// calculateItemDifficulty (E17-S03)
// ---------------------------------------------------------------------------

describe('calculateItemDifficulty', () => {
  it('returns empty array when no attempts', () => {
    const quiz = makeQuiz({ questions: [makeQuestion({ id: 'q1', order: 1, text: 'Q1' })] })
    expect(calculateItemDifficulty(quiz, [])).toEqual([])
  })

  it('calculates P-value correctly: 3/4 = 0.75', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result).toHaveLength(1)
    expect(result[0].pValue).toBeCloseTo(0.75)
  })

  it('categorizes P=0.8 as Easy (boundary: inclusive)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 8/10 = 0.8 exactly
    const attempts = [
      ...Array.from({ length: 8 }, () => makeAttempt({ answers: [makeCorrectAnswer('q1')] })),
      ...Array.from({ length: 2 }, () => makeAttempt({ answers: [makeWrongAnswer('q1')] })),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Easy')
  })

  it('categorizes P=0.7999 as Medium (just below Easy boundary)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 79/100 = 0.79
    const attempts = [
      ...Array.from({ length: 79 }, () => makeAttempt({ answers: [makeCorrectAnswer('q1')] })),
      ...Array.from({ length: 21 }, () => makeAttempt({ answers: [makeWrongAnswer('q1')] })),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Medium')
  })

  it('categorizes P=0.5 as Medium (boundary: inclusive)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Medium')
    expect(result[0].pValue).toBeCloseTo(0.5)
  })

  it('categorizes P=0.4999 as Difficult (just below Medium boundary)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 49/100 = 0.49
    const attempts = [
      ...Array.from({ length: 49 }, () => makeAttempt({ answers: [makeCorrectAnswer('q1')] })),
      ...Array.from({ length: 51 }, () => makeAttempt({ answers: [makeWrongAnswer('q1')] })),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].difficulty).toBe('Difficult')
  })

  it('excludes questions with zero attempts', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1 answered' })
    const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Q2 never answered' })
    const quiz = makeQuiz({ questions: [q1, q2] })
    // Only q1 has answers — q2 never appears in attempts
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result).toHaveLength(1)
    expect(result[0].questionId).toBe('q1')
  })

  it('sorts easiest first (highest P-value first)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Easy Q' })
    const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Hard Q' })
    const quiz = makeQuiz({ questions: [q1, q2] })
    const attempts = [
      makeAttempt({
        answers: [makeCorrectAnswer('q1'), makeWrongAnswer('q2')],
      }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].questionId).toBe('q1') // P=1.0 — easiest first
    expect(result[1].questionId).toBe('q2') // P=0.0 — hardest last
  })

  it('aggregates across multiple attempts for the same question', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // Correct in attempt1, wrong in attempt2 → P = 0.5
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].pValue).toBeCloseTo(0.5)
  })

  it('includes topic from question in result', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1', topic: 'Algebra' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].topic).toBe('Algebra')
  })

  it('defaults to "General" when question has no topic', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result[0].topic).toBe('General')
  })

  it('single attempt with all correct: all Easy', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Q2' })
    const quiz = makeQuiz({ questions: [q1, q2] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1'), makeCorrectAnswer('q2')] })]
    const result = calculateItemDifficulty(quiz, attempts)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.difficulty === 'Easy')).toBe(true)
  })
})
```

### Step 1.2: Run tests to confirm they fail

```bash
cd /Volumes/SSD/Dev/Apps/Knowlune
npx vitest run src/lib/__tests__/analytics.test.ts
```

Expected: FAIL — `calculateItemDifficulty` not found.

### Step 1.3: Implement `calculateItemDifficulty` in `src/lib/analytics.ts`

Add the following after the existing `calculateNormalizedGain` function:

```typescript
// ---------------------------------------------------------------------------
// Item Difficulty — P-Values (E17-S03)
// ---------------------------------------------------------------------------

export type ItemDifficulty = {
  /** Question ID from the quiz */
  questionId: string
  /** Question text for display */
  questionText: string
  /** 1-indexed display order (from question.order) */
  questionOrder: number
  /** Topic tag (defaults to "General" if unset) */
  topic: string
  /** Proportion of attempts answered correctly (0.0–1.0) */
  pValue: number
  /** Human-readable difficulty label */
  difficulty: 'Easy' | 'Medium' | 'Difficult'
}

/**
 * Calculate item difficulty (P-values) for each question in a quiz.
 *
 * P-value = proportion of attempts where the question was answered correctly.
 * Questions with zero attempts across all attempts are excluded.
 *
 * Difficulty thresholds (standard psychometric convention):
 *   - P >= 0.8  → "Easy"
 *   - 0.5 <= P < 0.8 → "Medium"
 *   - P < 0.5  → "Difficult"
 *
 * Results are sorted easiest-first (descending P-value) for display.
 *
 * Reference: NFR4 — Psychometric validity requirements (item difficulty tracking)
 */
export function calculateItemDifficulty(quiz: Quiz, attempts: QuizAttempt[]): ItemDifficulty[] {
  if (attempts.length === 0) return []

  // Aggregate correct/total counts per questionId across all attempts
  const statsMap = new Map<string, { correct: number; total: number }>()

  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const existing = statsMap.get(answer.questionId) ?? { correct: 0, total: 0 }
      statsMap.set(answer.questionId, {
        correct: existing.correct + (answer.isCorrect ? 1 : 0),
        total: existing.total + 1,
      })
    }
  }

  // Map quiz questions to ItemDifficulty, excluding questions with no attempts
  return quiz.questions
    .map((q): ItemDifficulty | null => {
      const stats = statsMap.get(q.id)
      if (!stats || stats.total === 0) return null

      const pValue = stats.correct / stats.total
      const difficulty: ItemDifficulty['difficulty'] =
        pValue >= 0.8 ? 'Easy' : pValue >= 0.5 ? 'Medium' : 'Difficult'

      return {
        questionId: q.id,
        questionText: q.text,
        questionOrder: q.order,
        topic: q.topic?.trim() || 'General',
        pValue,
        difficulty,
      }
    })
    .filter((item): item is ItemDifficulty => item !== null)
    .sort((a, b) => b.pValue - a.pValue) // Easiest first
}
```

Also add to the import at the top of `analytics.ts`:
```typescript
import type { Question, Answer, QuizAttempt, Quiz } from '@/types/quiz'
```
(replace existing import if `Quiz` is not already included)

### Step 1.4: Run tests to confirm they pass

```bash
npx vitest run src/lib/__tests__/analytics.test.ts
```

Expected: All existing tests pass + all new `calculateItemDifficulty` tests pass.

### Step 1.5: Commit

```bash
git add src/lib/analytics.ts src/lib/__tests__/analytics.test.ts
git commit -m "feat(E17-S03): add calculateItemDifficulty function with unit tests"
```

---

## Task 2: Create `ItemDifficultyAnalysis.tsx` component

**Files:**
- Create: `src/app/components/quiz/ItemDifficultyAnalysis.tsx`
- Create: `src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx`

### Step 2.1: Write the failing component tests

Create `src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx`:

```tsx
/**
 * Component tests for ItemDifficultyAnalysis
 * Covers: empty state, sorted list, badge labels, suggestion text
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ItemDifficultyAnalysis } from '../ItemDifficultyAnalysis'
import {
  makeQuiz,
  makeQuestion,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../../../../../tests/support/fixtures/factories/quiz-factory'

describe('ItemDifficultyAnalysis', () => {
  it('renders empty state when no attempts provided', () => {
    const quiz = makeQuiz({ questions: [makeQuestion({ id: 'q1', order: 1, text: 'Q1' })] })
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={[]} />)
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument()
  })

  it('renders section heading when items exist', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Easy question' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText('Question Difficulty Analysis')).toBeInTheDocument()
  })

  it('renders question text in the list', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'What is gravity?' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText('What is gravity?')).toBeInTheDocument()
  })

  it('shows "Easy" badge for high P-value (P=1.0)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  it('shows "Difficult" badge for low P-value (P=0.0)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeWrongAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/difficult/i)).toBeInTheDocument()
  })

  it('shows "Medium" badge for mid P-value (P=0.5)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  it('shows suggestion text for Difficult questions', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Hard question', topic: 'Algebra' })
    const quiz = makeQuiz({ questions: [q1] })
    // 0/1 = P=0.0 → Difficult
    const attempts = [makeAttempt({ answers: [makeWrongAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    // Should show suggestion referencing the question order
    expect(screen.getByText(/review question/i)).toBeInTheDocument()
  })

  it('does not show suggestion text when no Difficult questions', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Easy Q' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.queryByText(/review question/i)).not.toBeInTheDocument()
  })

  it('displays P-value as percentage in badge', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 3/4 = 75%
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })
})
```

### Step 2.2: Run tests to confirm they fail

```bash
npx vitest run src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx
```

Expected: FAIL — `ItemDifficultyAnalysis` not found.

### Step 2.3: Create the component

Create `src/app/components/quiz/ItemDifficultyAnalysis.tsx`:

```tsx
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { calculateItemDifficulty, type ItemDifficulty } from '@/lib/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'

interface ItemDifficultyAnalysisProps {
  quiz: Quiz
  attempts: QuizAttempt[]
}

function getDifficultyBadgeClass(difficulty: ItemDifficulty['difficulty']): string {
  switch (difficulty) {
    case 'Easy':
      return 'bg-success/10 text-success border-success/20'
    case 'Medium':
      return 'bg-warning/10 text-warning border-warning/20'
    case 'Difficult':
      return 'bg-destructive/10 text-destructive border-destructive/20'
  }
}

function buildSuggestions(items: ItemDifficulty[]): string[] {
  const difficultItems = items.filter(item => item.difficulty === 'Difficult')
  if (difficultItems.length === 0) return []

  // Group by topic
  const byTopic = new Map<string, ItemDifficulty[]>()
  for (const item of difficultItems) {
    const group = byTopic.get(item.topic) ?? []
    group.push(item)
    byTopic.set(item.topic, group)
  }

  const suggestions: string[] = []
  for (const [topic, topicItems] of byTopic) {
    const questionNums = topicItems.map(i => i.questionOrder).sort((a, b) => a - b)
    const questionWord = questionNums.length === 1 ? 'question' : 'questions'
    const avgPct = Math.round(
      (topicItems.reduce((sum, i) => sum + i.pValue, 0) / topicItems.length) * 100
    )
    const topicLabel = topic === 'General' ? '' : ` on ${topic}`
    suggestions.push(
      `Review ${questionWord} ${questionNums.join(', ')}${topicLabel} — you answer correctly only ${avgPct}% of the time.`
    )
  }

  return suggestions
}

export function ItemDifficultyAnalysis({ quiz, attempts }: ItemDifficultyAnalysisProps) {
  const items = calculateItemDifficulty(quiz, attempts)

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough data to analyze difficulty.
      </p>
    )
  }

  const suggestions = buildSuggestions(items)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Question Difficulty Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" aria-label="Questions ranked by difficulty">
          {items.map(item => (
            <li
              key={item.questionId}
              className="flex justify-between items-center gap-2"
            >
              <span
                className="text-sm truncate flex-1"
                title={item.questionText}
              >
                {item.questionText}
              </span>
              <Badge
                variant="outline"
                className={getDifficultyBadgeClass(item.difficulty)}
              >
                {item.difficulty} ({Math.round(item.pValue * 100)}%)
              </Badge>
            </li>
          ))}
        </ul>

        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 2.4: Run component tests

```bash
npx vitest run src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx
```

Expected: All tests pass.

### Step 2.5: Commit

```bash
git add src/app/components/quiz/ItemDifficultyAnalysis.tsx \
        src/app/components/quiz/__tests__/ItemDifficultyAnalysis.test.tsx
git commit -m "feat(E17-S03): add ItemDifficultyAnalysis component with tests"
```

---

## Task 3: Integrate into `QuizResults.tsx`

**Files:**
- Modify: `src/app/pages/QuizResults.tsx`

### Step 3.1: Add import

Add to the existing imports block near the top of `QuizResults.tsx`:

```tsx
import { ItemDifficultyAnalysis } from '@/app/components/quiz/ItemDifficultyAnalysis'
```

### Step 3.2: Render after ScoreTrajectoryChart

In the JSX return block (around line 162), insert `<ItemDifficultyAnalysis>` after `<ScoreTrajectoryChart>`:

```tsx
{/* Score trajectory chart — only renders with 2+ attempts */}
<ScoreTrajectoryChart attempts={trajectoryData} passingScore={currentQuiz.passingScore} />

{/* Item difficulty analysis — shows when at least 1 attempt has been recorded */}
<ItemDifficultyAnalysis quiz={currentQuiz} attempts={attempts} />

<QuestionBreakdown answers={lastAttempt.answers} questions={currentQuiz.questions} />
```

**Design note:** Unlike `ScoreTrajectoryChart` which self-hides with <2 attempts, `ItemDifficultyAnalysis` always renders (it shows the empty state message). Even 1 attempt gives a P-value snapshot. This is intentional — a learner can see which questions they got right/wrong after their first attempt.

### Step 3.3: Run full unit test suite

```bash
npx vitest run
```

Expected: All existing + new tests pass.

### Step 3.4: Build check

```bash
npm run build
```

Expected: Clean build. TypeScript errors would surface here if the `Quiz` import is missing from `analytics.ts`.

### Step 3.5: Commit

```bash
git add src/app/pages/QuizResults.tsx
git commit -m "feat(E17-S03): integrate ItemDifficultyAnalysis into QuizResults page"
```

---

## Task 4: E2E Test

**Files:**
- Create: `tests/e2e/regression/story-e17-s03.spec.ts`

### Step 4.1: Write the failing E2E test

Create `tests/e2e/regression/story-e17-s03.spec.ts`:

```typescript
/**
 * ATDD E2E tests for E17-S03: Calculate Item Difficulty (P-Values)
 *
 * AC1: Questions ranked by difficulty (easiest to hardest) visible in quiz analytics
 * AC3: Difficulty labels (Easy/Medium/Difficult) visible per question
 * AC4: Questions with zero attempts excluded
 * AC5: Suggestion text for Difficult questions
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes, seedQuizAttempts } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e17s03'
const LESSON_ID = 'test-lesson-e17s03'
const QUIZ_ID = 'quiz-e17s03'

const q1 = makeQuestion({
  id: 'q1-e17s03',
  order: 1,
  text: 'What is 2 + 2?',
  topic: 'Math',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e17s03',
  order: 2,
  text: 'What is the powerhouse of the cell?',
  topic: 'Biology',
  options: ['Nucleus', 'Mitochondria', 'Golgi', 'Ribosome'],
  correctAnswer: 'Mitochondria',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Mixed Knowledge Quiz',
  questions: [q1, q2],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// 3 attempts:
// q1 correct in all 3 (P = 1.0 → Easy)
// q2 correct in 1 of 3 (P = 0.33 → Difficult)
const attempt1 = makeAttempt({
  id: 'attempt1-e17s03',
  quizId: QUIZ_ID,
  score: 2,
  percentage: 100,
  passed: true,
  completedAt: '2026-01-01T10:00:00.000Z',
  startedAt: '2026-01-01T09:55:00.000Z',
  answers: [
    { questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
    { questionId: q2.id, userAnswer: 'Mitochondria', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
  ],
})

const attempt2 = makeAttempt({
  id: 'attempt2-e17s03',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 50,
  passed: false,
  completedAt: '2026-01-02T10:00:00.000Z',
  startedAt: '2026-01-02T09:55:00.000Z',
  answers: [
    { questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
    { questionId: q2.id, userAnswer: 'Nucleus', isCorrect: false, pointsEarned: 0, pointsPossible: 1 },
  ],
})

const attempt3 = makeAttempt({
  id: 'attempt3-e17s03',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 50,
  passed: false,
  completedAt: '2026-01-03T10:00:00.000Z',
  startedAt: '2026-01-03T09:55:00.000Z',
  answers: [
    { questionId: q1.id, userAnswer: '4', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
    { questionId: q2.id, userAnswer: 'Nucleus', isCorrect: false, pointsEarned: 0, pointsPossible: 1 },
  ],
})

// Most recent attempt is attempt3 (will be index 0 after store sort)
const allAttempts = [attempt3, attempt2, attempt1] // most-recent-first (Zustand sort order)

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function navigateToResults(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz] as Record<string, unknown>[])
  await seedQuizAttempts(page, allAttempts as Record<string, unknown>[])

  // Inject Zustand quiz store state — key MUST match persist({ name: '...' }) in useQuizStore
  await page.evaluate(
    ({ q, attempts }) => {
      localStorage.setItem(
        'levelup-quiz-store',
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
    { q: quiz, attempts: allAttempts }
  )

  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E17-S03: Item Difficulty Analysis', () => {
  test('AC1: shows Question Difficulty Analysis section', async ({ page }) => {
    await navigateToResults(page)
    await expect(page.getByText('Question Difficulty Analysis')).toBeVisible()
  })

  test('AC3: shows Easy badge for q1 (P=1.0, 3/3 correct)', async ({ page }) => {
    await navigateToResults(page)
    // q1 text is visible, with Easy badge
    await expect(page.getByText('What is 2 + 2?')).toBeVisible()
    await expect(page.getByText(/Easy \(100%\)/)).toBeVisible()
  })

  test('AC3: shows Difficult badge for q2 (P=0.33, 1/3 correct)', async ({ page }) => {
    await navigateToResults(page)
    await expect(page.getByText('What is the powerhouse of the cell?')).toBeVisible()
    await expect(page.getByText(/Difficult/)).toBeVisible()
  })

  test('AC5: shows suggestion text for Difficult questions', async ({ page }) => {
    await navigateToResults(page)
    await expect(page.getByText(/Review question/i)).toBeVisible()
  })
})
```

### Step 4.2: Verify Zustand store key

Before running, confirm the persist key:

```bash
grep -n "name:" /Volumes/SSD/Dev/Apps/Knowlune/src/stores/useQuizStore.ts | head -5
```

Adjust `'levelup-quiz-store'` in the test if the actual key differs.

### Step 4.3: Run E2E test

```bash
npx playwright test tests/e2e/regression/story-e17-s03.spec.ts --project=chromium
```

Expected: 4 tests pass.

**If percentage display doesn't match:** The badge renders `Math.round(item.pValue * 100)`. For P=0.333..., that's `Math.round(33.3)` = `33`. Adjust the assertion to `/Difficult \(33%\)/` if the test is checking exact badge text.

### Step 4.4: Commit

```bash
git add tests/e2e/regression/story-e17-s03.spec.ts
git commit -m "test(E17-S03): add E2E tests for item difficulty analysis"
```

---

## Task 5: Final Validation

### Step 5.1: Full unit test suite

```bash
npx vitest run
```

Expected: All pass, no regressions.

### Step 5.2: Run E2E regression suite (smoke + story spec)

```bash
npx playwright test tests/e2e/regression/story-e17-s03.spec.ts --project=chromium
```

### Step 5.3: Build + lint

```bash
npm run build && npm run lint
```

Expected: No errors. The design-token ESLint rule may flag color classes if hardcoded Tailwind colors sneak in — ensure all colors use `bg-success/10`, `text-success`, `text-warning`, `bg-destructive/10` (these are design token references, not hardcoded hex values).

### Step 5.4: Type check

```bash
npx tsc --noEmit
```

Expected: Clean. If `Quiz` type is missing from the `analytics.ts` import, TypeScript will fail here.

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Function placement | `src/lib/analytics.ts` | Follows established pattern (analyzeTopicPerformance, calculateImprovement) — pure functions in analytics module |
| Input signature | `(quiz: Quiz, attempts: QuizAttempt[])` | Quiz provides question metadata (text, order, topic); attempts provide answer data — clean separation |
| Question topic default | `"General"` | Mirrors `analyzeTopicPerformance` — consistent fallback label |
| Empty state | Component renders message | Caller in QuizResults does not need to guard; component is self-contained |
| Badge percentage | `Math.round(pValue * 100)%` | Whole numbers only — no decimal precision needed for user-facing display |
| Suggestion grouping | By topic | Groups related questions; encourages topical review |
| Integration guard | None (always render) | 1 attempt is still useful data; component's empty state covers 0 attempts |
| Sort order | Easiest first | Convention from epics spec: "ranked by difficulty (easiest to hardest)" means ascending difficulty = descending P-value |

## Potential Pitfalls

1. **Missing `Quiz` import in analytics.ts:** The existing import is `import type { Question, Answer, QuizAttempt }` — `Quiz` needs to be added.
2. **Zustand store key:** E2E test uses `'levelup-quiz-store'` — verify against `useQuizStore.ts` before running. Wrong key causes redirect (no quiz found → Navigate component fires).
3. **Badge color classes:** `bg-success/10`, `text-warning`, etc. use Tailwind opacity modifiers — these must be valid design tokens. If ESLint flags them, verify they exist in `theme.css`.
4. **`title` attribute on truncated text:** Added for hover tooltip on long question text. This is a progressive enhancement — don't block for it.
5. **Suggestion percentage for Difficult group:** Uses `avgPct` across the group — if only 1 difficult question, this equals that question's P-value display.
