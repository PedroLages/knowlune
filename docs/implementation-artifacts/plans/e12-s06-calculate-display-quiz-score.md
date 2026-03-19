# E12-S06: Calculate and Display Quiz Score — Implementation Plan

## Context

E12-S06 is the final story in Epic 12's current sprint. Stories E12-S01 through E12-S05 built the quiz infrastructure: type definitions, Dexie schema, Zustand store (`useQuizStore`), quiz route, and multiple-choice question display. The scoring backend (`calculateQuizScore()` in `src/lib/scoring.ts`) and store action (`submitQuiz()`) are fully implemented and tested (18 unit tests).

**What's missing is entirely UI**: a submit button on the quiz page, an unanswered-questions confirmation dialog, a results page with animated score display, and action buttons (retake, review, back).

## Pre-Implementation Setup

Before coding, execute these git/file operations:

1. **Commit untracked file** on main: `git add docs/plans/2026-03-19-nfr-remediation.md && git commit -m "docs: add NFR remediation plan"`
2. **Create branch**: `git checkout -b feature/e12-s06-calculate-display-quiz-score`
3. **Update story file** frontmatter: status → `in-progress`, started → `2026-03-19`
4. **Update sprint-status.yaml**: `12-6-calculate-and-display-quiz-score` → `in-progress`
5. **Initial commit**: `git add docs/implementation-artifacts/ && git commit -m "chore: start story E12-S06"`

## Implementation Tasks

### Task 0: Generate ATDD E2E Tests (RED phase)
**File**: `tests/e2e/story-12-6.spec.ts`

Create failing E2E tests mapping to acceptance criteria before implementation:

- **AC1**: Submit quiz with all answered → score page with percentage, "X of Y correct", pass message
- **AC2**: Submit with unanswered → AlertDialog with count, "Continue Reviewing" returns to quiz
- **AC3**: Submit with unanswered → "Submit Anyway" goes to results with unanswered scored as 0
- **AC4**: Results page shows "Retake Quiz" (outline), "Review Answers" (brand), "Back to Lesson" link
- **AC5**: Pass/fail messaging never contains "Failed" anywhere on results screen (QFR23)
- **AC6**: Time spent displayed as "Completed in Xm Ys"

**Patterns to follow**:
- Import from `tests/support/fixtures` (merged localStorageFixture + indexedDBFixture)
- Use `makeQuiz()`, `makeQuestion()`, `makeAttempt()` from `tests/support/fixtures/factories/quiz-factory.ts`
- Seed quizzes via `seedQuizzes(page, [quiz])` from `tests/support/helpers/seed-helpers.ts`
- Seed `localStorage.setItem('eduvi-sidebar-v1', 'false')` before navigation (tablet sidebar overlay)
- Use `waitUntil: 'domcontentloaded'` (not `networkidle`)

**Commit**: `test(E12-S06): add failing ATDD E2E tests for quiz scoring`

### Task 1: Create `formatDuration` helper
**File**: `src/lib/formatDuration.ts`

```typescript
export function formatDuration(ms: number): string
// 512000 → "8m 32s"
// 65000 → "1m 5s"
// 45000 → "45s"
// 0 → "0s"
```

**Unit test file**: `src/lib/__tests__/formatDuration.test.ts`

**Commit**: `feat(E12-S06): add formatDuration helper with unit tests`

### Task 2: Create `ScoreSummary` component
**File**: `src/app/components/quiz/ScoreSummary.tsx`

Props:
```typescript
interface ScoreSummaryProps {
  percentage: number
  score: number
  maxScore: number
  passed: boolean
  passingScore: number
  timeSpent: number // ms
}
```

Implementation:
- **Score ring**: Reuse the pattern from `src/app/components/figma/ProgressRing.tsx` but larger (`size=128` desktop, `size=96` mobile) with pass/fail color switching:
  - Pass: `text-success` stroke
  - Not-pass: `text-warning` stroke (never red)
  - Track: `text-accent`
  - Center text: `text-5xl font-bold text-foreground`
  - Animation: `transition-all duration-500 motion-reduce:transition-none`
- **Score text**: "{score} of {maxScore} correct"
- **Pass indicator**: CheckCircle icon `text-success` + "Passed ({passingScore}% required)" or neutral circle `text-warning` + "Keep Going! You got {score} of {maxScore} correct."
- **Encouraging message** (QFR23 tiered):
  - >= 90%: "Excellent work! You've mastered this material."
  - 70-89%: "Great job! You're on the right track."
  - 50-69%: "Good effort! Review the growth areas below."
  - < 50%: "Keep practicing! Focus on the topics below."
- **Time**: "Completed in {formatDuration(timeSpent)}"
- **QFR23 enforcement**: No "Failed", "Wrong", "Incorrect", "Bad" anywhere
- **ARIA**: `aria-live="polite"` region announcing score for screen readers
- **Responsive**: ring w-32 desktop, w-24 mobile via `size-32 sm:size-32` / media query

**Design tokens** (from story dev notes):
- Card: `bg-card rounded-[24px] p-4 sm:p-8`
- Pass: `text-success`, not-pass: `text-warning`
- SVG ring pass: `stroke: var(--color-success)`, not-pass: `stroke: var(--color-warning)`

**Unit test file**: `src/app/components/quiz/__tests__/ScoreSummary.test.tsx`
- Renders pass message correctly
- Renders not-pass message correctly (never "Failed")
- Renders time formatting
- Renders correct score text

**Commit**: `feat(E12-S06): create ScoreSummary component with score ring and messaging`

### Task 3: Create `QuizResults` page
**File**: `src/app/pages/QuizResults.tsx`

Structure:
```
<div className="py-6">
  <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm text-center space-y-6">
    <ScoreSummary ... />
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Button variant="outline" className="rounded-xl">Retake Quiz</Button>
      <Button className="bg-brand text-brand-foreground rounded-xl">Review Answers</Button>
    </div>
    <Link className="text-brand hover:underline text-sm">Back to Lesson</Link>
  </div>
</div>
```

Logic:
- Read `useQuizStore(selectAttempts)` — get last attempt
- Read `useQuizStore(selectCurrentQuiz)` — for quiz metadata (passingScore, title)
- If no attempt data: redirect to quiz page via `useNavigate()`
- Load attempts from Dexie on mount via `loadAttempts(quizId)`
- **Retake Quiz**: call `retakeQuiz(lessonId)` then navigate to `/courses/:courseId/lessons/:lessonId/quiz`
- **Review Answers**: navigate to placeholder (toast "Coming in a future update" for now — Epic 16)
- **Back to Lesson**: `<Link to={/courses/${courseId}/${lessonId}}>` (no `lessons/` segment per existing route pattern)
- Touch targets: all buttons ≥44px (`min-h-[44px]`)

**Reuse**:
- `useParams<{ courseId, lessonId }>()` (same pattern as Quiz.tsx)
- `selectAttempts` selector from store
- `Button` from `@/app/components/ui/button`
- `Link` from `react-router`

**Commit**: `feat(E12-S06): create QuizResults page with retake and navigation`

### Task 4: Add quiz results route
**File**: `src/app/routes.tsx`

Add lazy import + route after existing quiz route (line 136):
```typescript
const QuizResults = React.lazy(() =>
  import('./pages/QuizResults').then(m => ({ default: m.QuizResults }))
)

// In routes array, after quiz route:
{
  path: 'courses/:courseId/lessons/:lessonId/quiz/results',
  element: <SuspensePage><QuizResults /></SuspensePage>,
},
```

**Commit**: `feat(E12-S06): add quiz results route`

### Task 5: Add Submit button + navigation to Quiz page
**File**: `src/app/pages/Quiz.tsx`

Modify the active quiz section (lines 186-202) to add:

1. **Navigation footer** below `QuestionDisplay`:
   - "Previous" button (disabled on first question) — decrements `currentQuestionIndex`
   - "Next" button (hidden on last question) — increments `currentQuestionIndex`
   - "Submit Quiz" button (visible on last question, or always as secondary)

2. **Unanswered count logic**:
   ```typescript
   const totalQuestions = currentQuiz.questions.length
   const answeredCount = Object.keys(currentProgress.answers).filter(
     k => currentProgress.answers[k] !== '' && currentProgress.answers[k] !== undefined
   ).length
   const unansweredCount = totalQuestions - answeredCount
   ```

3. **AlertDialog for unanswered questions**:
   - Title: "Submit quiz?"
   - Description: "You have {N} unanswered questions. Submit anyway?"
   - Cancel: "Continue Reviewing" (outline) — returns to quiz
   - Action: "Submit Anyway" (default) — calls handleSubmit
   - If all answered: skip dialog, submit directly

4. **handleSubmit callback**:
   ```typescript
   const handleSubmit = useCallback(async () => {
     await submitQuiz(courseId, []) // modules=[] — store handles conditionally
     navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)
   }, [submitQuiz, courseId, lessonId, navigate])
   ```

5. **Store imports to add**: `submitQuiz` action (already has `submitAnswer`)

6. **Navigation imports**: `useNavigate` from react-router

**Key patterns**:
- Keep all hooks at component top (lesson from E12-S05: no hooks after early returns)
- Button touch targets ≥44px: `min-h-[44px]`
- Use store's `nextQuestion`/`prevQuestion` if they exist, or directly increment/decrement `currentQuestionIndex` via setState

**Commit**: `feat(E12-S06): add quiz navigation and submit flow with confirmation dialog`

### Task 6: Verify and fix ATDD tests (GREEN phase)
- Run E2E tests: `npx playwright test tests/e2e/story-12-6.spec.ts --project=chromium`
- Fix any test failures or adjust selectors
- Run unit tests: `npm run test:unit`
- Run build: `npm run build`
- Run lint: `npm run lint`

**Commit**: `test(E12-S06): fix ATDD tests to pass after implementation`

## Files Modified/Created

| Action | File |
|--------|------|
| **Create** | `tests/e2e/story-12-6.spec.ts` |
| **Create** | `src/lib/formatDuration.ts` |
| **Create** | `src/lib/__tests__/formatDuration.test.ts` |
| **Create** | `src/app/components/quiz/ScoreSummary.tsx` |
| **Create** | `src/app/components/quiz/__tests__/ScoreSummary.test.tsx` |
| **Create** | `src/app/pages/QuizResults.tsx` |
| **Modify** | `src/app/routes.tsx` — add lazy import + route |
| **Modify** | `src/app/pages/Quiz.tsx` — add nav footer + submit + AlertDialog |
| **Modify** | `docs/implementation-artifacts/12-6-calculate-and-display-quiz-score.md` — status update |
| **Modify** | `docs/implementation-artifacts/sprint-status.yaml` — status update |

## Existing Code to Reuse (DO NOT recreate)

| What | File | Notes |
|------|------|-------|
| `calculateQuizScore()` | `src/lib/scoring.ts` | Already called by submitQuiz |
| `useQuizStore.submitQuiz()` | `src/stores/useQuizStore.ts` | Accepts `(courseId, modules)` |
| `useQuizStore.retakeQuiz()` | `src/stores/useQuizStore.ts` | Accepts `(lessonId)` |
| `selectAttempts` | `src/stores/useQuizStore.ts` | Returns `QuizAttempt[]` |
| `loadAttempts()` | `src/stores/useQuizStore.ts` | Loads from Dexie by quizId |
| `ProgressRing` pattern | `src/app/components/figma/ProgressRing.tsx` | SVG circle with dasharray animation |
| `AlertDialog` | `src/app/components/ui/alert-dialog.tsx` | Full shadcn/ui component |
| `makeQuiz/makeQuestion/makeAttempt` | `tests/support/fixtures/factories/quiz-factory.ts` | Test data factories |
| `seedQuizzes()` | `tests/support/helpers/seed-helpers.ts` | E2E IndexedDB seeding |

## Verification

1. **Build**: `npm run build` — no TypeScript errors
2. **Lint**: `npm run lint` — no ESLint violations (especially design token rule)
3. **Unit tests**: `npm run test:unit` — formatDuration + ScoreSummary tests pass
4. **E2E tests**: `npx playwright test tests/e2e/story-12-6.spec.ts --project=chromium`
5. **Manual smoke test**: Navigate to a quiz, answer questions, submit, verify results page renders correctly with score ring, messaging, and buttons
6. **QFR23 check**: Search results page output for "Failed" — must not appear
7. **Accessibility**: Tab through results page, verify focus order and screen reader announcements
8. **Responsive**: Check results page at mobile (< 640px), tablet (640-1023px), desktop (>= 1024px)
