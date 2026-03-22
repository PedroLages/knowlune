# E15-S05: Display Performance Summary After Quiz

## Context

After completing a quiz, learners currently see their score (via ScoreSummary), per-question breakdown (via QuestionBreakdown), and incorrect items (via AreasForGrowth). What's missing is a **topic-level aggregation** — grouping performance by topic to highlight strengths and growth areas. This story adds a `PerformanceInsights` component and supporting `analyzeTopicPerformance()` function.

**Dependencies (both done):** E12-S06 (QuizResults page), E15-S04 (per-question correctness data)

## Implementation Steps

### Step 1: Add `topic?: string` to Question type
**File:** `src/types/quiz.ts`

Add `topic: z.string().optional()` to `BaseQuestionSchema`. This is a single-line addition — no migration needed since it's optional. Also update the quiz-factory to support it.

**File:** `tests/support/fixtures/factories/quiz-factory.ts`
- No change needed to `makeQuestion()` defaults (topic remains undefined by default)
- Callers pass `topic: 'Arrays'` via overrides as needed

**Commit after this step.**

### Step 2: Create `src/lib/analytics.ts` — topic analysis function
**New file:** `src/lib/analytics.ts`

```typescript
export function analyzeTopicPerformance(
  questions: Question[],
  answers: Answer[]
): TopicAnalysis
```

**Type returned:**
```typescript
type TopicPerformance = {
  name: string
  percentage: number
  questionNumbers: number[]  // 1-indexed, incorrect answers only
}

type TopicAnalysis = {
  correctCount: number
  incorrectCount: number
  skippedCount: number
  strengths: TopicPerformance[]    // topics >=70%, sorted high→low
  growthAreas: TopicPerformance[]  // topics <70%, sorted low→high
  hasMultipleTopics: boolean       // false when all questions are "General"
}
```

**Logic:**
1. Group questions by `topic` (default to `"General"` if absent)
2. Match each question to its answer via `questionId`
3. Calculate percentage correct per topic
4. Categorize: >=70% → strengths, <70% → growthAreas
5. Track incorrect question numbers (1-indexed by `question.order`)
6. Set `hasMultipleTopics = false` when only one unique topic exists (i.e., all "General")
7. Limit growthAreas to top 3 (sorted by worst percentage first)

**Reuse:** Import `Question` and `Answer` types from `@/types/quiz`. Use `isUnanswered()` from `src/lib/scoring.ts` for skipped count.

**Commit after this step.**

### Step 3: Unit tests for `analyzeTopicPerformance`
**New file:** `src/lib/__tests__/analytics.test.ts`

Test cases:
- Mixed topics → correct strengths/growthAreas categorization
- All correct (100%) → all strengths, no growth areas
- All incorrect → all growth areas
- No topic tags → all "General", `hasMultipleTopics: false`
- Single topic with mixed results → `hasMultipleTopics: false` (only one unique topic)
- Skipped questions counted correctly
- Growth areas limited to 3
- Question numbers are 1-indexed and only include incorrect answers

**Commit after this step.**

### Step 4: Create `PerformanceInsights` component
**New file:** `src/app/components/quiz/PerformanceInsights.tsx`

**Props:**
```typescript
interface PerformanceInsightsProps {
  questions: Question[]
  answers: Answer[]
}
```

**Structure:**
```
<div data-testid="performance-insights">
  <p> correctCount correct · incorrectCount incorrect · skippedCount skipped </p>

  {hasMultipleTopics && strengths.length > 0 && (
    <section aria-labelledby={strengthsHeadingId}>
      <h3>Your Strengths</h3>
      <ul> ... CheckCircle2 + topic name + percentage (text-success) </ul>
    </section>
  )}

  {hasMultipleTopics && growthAreas.length > 0 && (
    <section aria-labelledby={growthHeadingId}>
      <h3>Growth Opportunities</h3>
      <ul> ... TrendingUp/AlertTriangle + topic name + percentage (text-warning)
           + "Review questions X, Y" (text-muted-foreground text-sm)
      </ul>
    </section>
  )}
</div>
```

**Patterns to follow (from AreasForGrowth.tsx):**
- `useId()` for heading IDs
- `<section aria-labelledby={id}>` wrapper
- `bg-muted rounded-xl p-5 sm:p-6 space-y-4` card styling
- Icon + heading in `flex items-center gap-2`
- `aria-hidden="true"` on decorative icons
- `min-h-[44px]` touch targets if any interactive elements
- Import `cn` from `@/app/components/ui/utils`

**Responsive:** Consider `sm:grid sm:grid-cols-2 sm:gap-4` when both strengths and growth sections are present.

**Commit after this step.**

### Step 5: Unit tests for PerformanceInsights component
**New file:** `src/app/components/quiz/__tests__/PerformanceInsights.test.tsx`

Test cases:
- Renders correctness summary bar
- Shows strengths section when topics have >=70%
- Shows growth section with question references for <70%
- Hides strengths/growth when `hasMultipleTopics` is false (all General)
- Headings have proper hierarchy (h3)
- Lists use semantic `<ul>/<li>` elements
- Icons are `aria-hidden`

**Commit after this step.**

### Step 6: Integrate into QuizResults page
**File:** `src/app/pages/QuizResults.tsx`

Insert `<PerformanceInsights>` between `<QuestionBreakdown>` and `<AreasForGrowth>` (around line 138):

```tsx
import { PerformanceInsights } from '@/app/components/quiz/PerformanceInsights'

// ... in render, after QuestionBreakdown:
<PerformanceInsights
  questions={currentQuiz.questions}
  answers={lastAttempt.answers}
/>
```

**Commit after this step.**

### Step 7: Update ATDD E2E tests
**File:** `tests/e2e/story-15-5.spec.ts` (already created with failing tests)

Review and adjust tests now that implementation exists. Key adjustments:
- Ensure `topic` field is passed in test question data (already done in ATDD file)
- Verify selectors match actual rendered output
- Run tests and fix any selector mismatches

**Commit after this step.**

## Critical Files

| File | Action |
|------|--------|
| `src/types/quiz.ts` | Modify — add `topic` to BaseQuestionSchema |
| `src/lib/analytics.ts` | Create — `analyzeTopicPerformance()` |
| `src/lib/__tests__/analytics.test.ts` | Create — unit tests |
| `src/app/components/quiz/PerformanceInsights.tsx` | Create — UI component |
| `src/app/components/quiz/__tests__/PerformanceInsights.test.tsx` | Create — component tests |
| `src/app/pages/QuizResults.tsx` | Modify — integrate component |
| `tests/e2e/story-15-5.spec.ts` | Modify — adjust ATDD tests |
| `tests/support/fixtures/factories/quiz-factory.ts` | No change needed (supports overrides) |

## Existing Code to Reuse

| What | Where |
|------|-------|
| `Question`, `Answer`, `Quiz` types | `src/types/quiz.ts` |
| `isUnanswered()` | `src/lib/scoring.ts` |
| `cn()` utility | `src/app/components/ui/utils` |
| `useId()` pattern | `src/app/components/quiz/AreasForGrowth.tsx` |
| Card styling pattern | `src/app/components/quiz/AreasForGrowth.tsx` |
| `CheckCircle2`, `AlertCircle` icons | `lucide-react` (already used in QuestionBreakdown) |
| `getScoreTier()` messaging | `src/app/components/quiz/ScoreSummary.tsx` (no duplication needed) |
| Quiz factory functions | `tests/support/fixtures/factories/quiz-factory.ts` |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design tokens, no hardcoded colors)
3. `npx tsc --noEmit` — type check passes
4. `npm run test:unit` — analytics + PerformanceInsights unit tests pass
5. `npx playwright test tests/e2e/story-15-5.spec.ts --project=chromium` — ATDD E2E tests pass
6. Manual check: navigate to quiz, complete with mixed results, verify:
   - Correctness bar shows "X correct · Y incorrect · Z skipped"
   - Strengths section shows topics >=70% with green icons
   - Growth section shows topics <70% with amber icons + question numbers
   - Complete quiz with no topic tags → strengths/growth sections hidden
