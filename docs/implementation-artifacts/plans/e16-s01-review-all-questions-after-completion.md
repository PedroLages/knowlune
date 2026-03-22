# E16-S01 Implementation Plan: Review All Questions and Answers After Completion

**Story**: E16-S01
**Date**: 2026-03-22
**Complexity**: Medium (~4-5 hours)

---

## Overview

This story implements a read-only quiz review page (`/quiz/review/:attemptId`) where learners can see all their answers after completing a quiz, with correct/incorrect highlighting and explanations.

The core infrastructure was pre-scaffolded in Epic 12:
- `QuestionDisplayMode` type (`review-correct | review-incorrect | review-disabled`) already exists in `QuestionDisplay.tsx`
- All 4 question components accept `mode` prop but only implement `active` styling
- `AnswerFeedback` component already handles explanation display for all states
- `MarkdownRenderer` already exists for explanation rendering
- `QuizAttempt` type stores all needed data (`answers[].isCorrect`, `answers[].userAnswer`)

---

## Architecture Decision

**No new Zustand store** — the review page is stateless/read-only. Data is loaded directly from Dexie on mount via `useEffect`. Local `useState` manages current question index.

**Reuse existing components aggressively**:
- `QuestionDisplay` (with new review mode styling in child components)
- `AnswerFeedback` (explanation + correct/incorrect state)
- `MarkdownRenderer` (already handles explanations)
- New `ReviewQuestionGrid` (variant of `QuestionGrid` with ✓/● indicators)

---

## Files to Create

### 1. `src/app/pages/QuizReview.tsx`
Route-level page component. Responsible for:
- Reading `courseId`, `lessonId`, `attemptId` from URL params
- Loading `QuizAttempt` from `db.quizAttempts.get(attemptId)`
- Loading `Quiz` from `db.quizzes.get(attempt.quizId)`
- Error state when attemptId not found
- Loading skeleton
- Rendering `QuizReviewContent` when data is ready

```tsx
export function QuizReview() {
  const { courseId, lessonId, attemptId } = useParams()
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const a = await db.quizAttempts.get(attemptId!)
        if (!a) { if (!cancelled) setStatus('error'); return }
        const q = await db.quizzes.get(a.quizId)
        if (!q) { if (!cancelled) setStatus('error'); return }
        if (!cancelled) { setAttempt(a); setQuiz(q); setStatus('ready') }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [attemptId])

  if (status === 'loading') return <QuizReviewSkeleton />
  if (status === 'error') return <QuizReviewError courseId={courseId} lessonId={lessonId} />
  return <QuizReviewContent quiz={quiz!} attempt={attempt!} courseId={courseId!} lessonId={lessonId!} />
}
```

### 2. `src/app/components/quiz/QuizReviewContent.tsx`
Stateful review UI component. Manages:
- `currentIndex` state (0-based question index)
- Navigation (Previous/Next/"Back to Results")
- Renders `QuestionDisplay` with correct mode
- Renders `ReviewQuestionGrid`
- Renders `AnswerFeedback` (explanation)

```tsx
interface QuizReviewContentProps {
  quiz: Quiz
  attempt: QuizAttempt
  courseId: string
  lessonId: string
}

export function QuizReviewContent({ quiz, attempt, courseId, lessonId }: QuizReviewContentProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()

  const currentQuestion = quiz.questions[currentIndex]
  const answerRecord = attempt.answers.find(a => a.questionId === currentQuestion.id)
  const mode: QuestionDisplayMode = answerRecord
    ? (answerRecord.isCorrect ? 'review-correct' : 'review-incorrect')
    : 'review-disabled'
  const userAnswer = answerRecord?.userAnswer

  const isFirst = currentIndex === 0
  const isLast = currentIndex === quiz.questions.length - 1

  return (
    <div className="py-6">
      <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-6">
        {/* Header */}
        <div>
          <h1>{quiz.title} — Review</h1>
          <Progress ... />
          <p>Question {currentIndex + 1} of {quiz.questions.length}</p>
        </div>

        {/* Question (read-only, no onChange needed) */}
        <QuestionDisplay
          question={currentQuestion}
          value={userAnswer}
          onChange={noop}
          mode={mode}
        />

        {/* Explanation panel */}
        <AnswerFeedback question={currentQuestion} userAnswer={userAnswer} />

        {/* Navigation */}
        <nav aria-label="Review navigation" className="flex gap-3">
          <Button variant="outline" disabled={isFirst} onClick={() => setCurrentIndex(i => i - 1)}>
            Previous
          </Button>
          {!isLast ? (
            <Button variant="outline" onClick={() => setCurrentIndex(i => i + 1)}>Next</Button>
          ) : (
            <Button variant="brand" onClick={() => navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)}>
              Back to Results
            </Button>
          )}
        </nav>

        {/* Question jump grid */}
        <ReviewQuestionGrid
          questions={quiz.questions}
          answers={attempt.answers}
          currentIndex={currentIndex}
          onQuestionClick={setCurrentIndex}
        />

        {/* Back to Results link (always visible) */}
        <Link to={`/courses/${courseId}/lessons/${lessonId}/quiz/results`}>
          ← Back to Results
        </Link>
      </div>
    </div>
  )
}
```

### 3. `src/app/components/quiz/ReviewQuestionGrid.tsx`
Grid showing question numbers with correct/incorrect indicators.

```tsx
interface ReviewQuestionGridProps {
  questions: Question[]
  answers: Answer[]
  currentIndex: number
  onQuestionClick: (index: number) => void
}

export function ReviewQuestionGrid({ questions, answers, currentIndex, onQuestionClick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q, i) => {
        const answer = answers.find(a => a.questionId === q.id)
        const isCurrent = i === currentIndex
        // Correct = green, Incorrect = orange, Unanswered = muted
        return (
          <button
            key={q.id}
            onClick={() => onQuestionClick(i)}
            aria-label={`Question ${i + 1}, ${answer ? (answer.isCorrect ? 'correct' : 'incorrect') : 'unanswered'}`}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex items-center justify-center size-11 rounded-full text-sm font-medium',
              isCurrent ? 'bg-brand text-brand-foreground'
              : answer?.isCorrect ? 'bg-success-soft text-success border border-success'
              : answer ? 'bg-warning/10 text-warning border border-warning'
              : 'bg-card text-muted-foreground border border-border'
            )}
          >
            {i + 1}
            {/* Correct: green checkmark dot, Incorrect: orange dot */}
            {answer && !isCurrent && (
              <span className="absolute -top-1 -right-1" aria-hidden="true">
                <span className={cn(
                  'size-3 rounded-full',
                  answer.isCorrect ? 'bg-success' : 'bg-warning'
                )} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

---

## Files to Modify

### 4. Question components — review mode styling

**`MultipleChoiceQuestion.tsx`** and **`TrueFalseQuestion.tsx`**:
Currently, non-`active` mode shows `opacity-60 cursor-default` for all options. In review mode, we need:
- Selected correct option: `border-success bg-success-soft`
- Selected incorrect option: `border-warning bg-warning/10`
- Unselected correct option (when user was wrong): `border-success bg-success-soft opacity-80`
- Other unselected options: `border-border bg-card opacity-60`

```tsx
// In the label className logic:
const isCorrectAnswer = option === question.correctAnswer
const isUserAnswer = value === option

// Review mode styling:
if (!isActive) {
  if (isUserAnswer && isCorrectAnswer) return 'border-success bg-success-soft'  // review-correct
  if (isUserAnswer && !isCorrectAnswer) return 'border-warning bg-warning/10'    // user wrong
  if (!isUserAnswer && isCorrectAnswer && mode === 'review-incorrect') return 'border-success bg-success-soft opacity-80'  // show correct answer
  return 'border-border bg-card opacity-60'  // inactive
}
```

**`MultipleSelectQuestion.tsx`**:
Per-option correct/incorrect/missed indicators. Check against `question.correctAnswer` array:
- Selected + in correctAnswer → green checkbox border
- Selected + NOT in correctAnswer → orange checkbox border
- Not selected + in correctAnswer (mode === review-incorrect) → show as "missed" with dashed border

**`FillInBlankQuestion.tsx`**:
In review mode, show read-only input with user's answer, then below it:
- If correct: `bg-success-soft rounded p-2` showing "Your answer is correct"
- If incorrect: show "Your answer: [user answer]" + "Correct answer: [correctAnswer]" in `bg-success-soft`
- Case-insensitive note: compare `userAnswer.toLowerCase() === correctAnswer.toLowerCase()` and they differ only in case → add "(case-insensitive match)" note

### 5. `src/app/routes.tsx`
Add lazy import and route:
```tsx
const QuizReview = React.lazy(() =>
  import('./pages/QuizReview').then(m => ({ default: m.QuizReview }))
)

// After QuizResults route:
{
  path: 'courses/:courseId/lessons/:lessonId/quiz/review/:attemptId',
  element: <SuspensePage><QuizReview /></SuspensePage>
}
```

### 6. `src/app/pages/QuizResults.tsx`
Replace the placeholder `handleReviewAnswers`:
```tsx
const handleReviewAnswers = useCallback(() => {
  if (!lastAttempt) return
  navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/review/${lastAttempt.id}`)
}, [lastAttempt, courseId, lessonId, navigate])
```

Also remove the `disabled` from "View All Attempts" button placeholder (that's Story 16.2).

---

## Error & Loading States

**Loading skeleton**: Match the QuizResults skeleton pattern — circle + text skeletons.

**Error state** (`QuizReviewError`):
```tsx
<div className="py-6">
  <div className="bg-card rounded-[24px] p-8 max-w-2xl mx-auto shadow-sm text-center space-y-4">
    <AlertCircle className="size-12 text-warning mx-auto" />
    <h1>Quiz attempt not found</h1>
    <p>The quiz attempt you are looking for does not exist or may have been deleted.</p>
    <Link to={`/courses/${courseId}/lessons/${lessonId}/quiz`}>← Back to Quiz</Link>
  </div>
</div>
```

---

## Data Access Pattern

```
URL: /courses/:courseId/lessons/:lessonId/quiz/review/:attemptId

Load sequence:
1. db.quizAttempts.get(attemptId)     → QuizAttempt (has .quizId, .answers[])
2. db.quizzes.get(attempt.quizId)     → Quiz (has .questions[], .title)

Per question display:
  answers.find(a => a.questionId === question.id) → Answer | undefined
  Answer.isCorrect → true/false → QuestionDisplayMode
  Answer.userAnswer → pass as `value` to QuestionDisplay
```

**Edge case**: If `quiz.shuffleQuestions` was true when the attempt was taken, the questions in `Quiz.questions` are in canonical order but the learner may have seen them shuffled. For the review page, always show questions in canonical order (by `question.order` sort) — this simplifies the UX and matches the epics spec which says "all questions sequentially."

---

## Test Plan

### Unit Tests (Vitest + jsdom)

**`src/app/pages/__tests__/QuizReview.test.tsx`**:
1. Shows loading skeleton initially
2. Loads attempt from db and renders questions
3. Invalid attemptId (db returns undefined) → error state
4. db throws → error state
5. Navigate Previous/Next buttons update current question
6. Last question shows "Back to Results" instead of "Next"
7. ReviewQuestionGrid jump navigation works

**`src/app/components/quiz/__tests__/ReviewQuestionGrid.test.tsx`**:
1. Renders correct number of buttons
2. Correct answers have green styling + aria label "correct"
3. Incorrect answers have orange styling + aria label "incorrect"
4. Unanswered have muted styling + aria label "unanswered"
5. Current index has brand styling

**`src/app/components/quiz/__tests__/MultipleChoiceQuestion.review.test.tsx`** (or add cases to existing):
1. `mode="review-correct"` with user answer = correct → green on selected
2. `mode="review-incorrect"` with user answer ≠ correct → orange on selected, green on correct
3. `mode="review-disabled"` → all options muted, no highlight

### E2E Tests (`tests/e2e/story-e16-s01.spec.ts`)

Setup: Seed quiz + quizAttempt in IndexedDB before each test.

1. **Navigate to review mode**: Click "Review Answers" on results page → URL changes to `/quiz/review/:attemptId`
2. **Questions display**: First question shows text + options + feedback panel (AnswerFeedback)
3. **Navigate through questions**: Click Next → shows question 2; Previous → back to 1
4. **Back to Results**: On last question, click "Back to Results" → navigates back to results URL
5. **Invalid attemptId**: Navigate directly to `/quiz/review/invalid-id` → error state with "Quiz attempt not found"

---

## Implementation Order

1. **Routes** (routes.tsx) — unblock lazy loading
2. **Review mode styling** (4 question components) — the core visual change
3. **ReviewQuestionGrid** — standalone, no deps
4. **QuizReviewContent** — uses all the above
5. **QuizReview page** — wraps QuizReviewContent with data loading
6. **QuizResults wire-up** — replace placeholder with real navigation
7. **Unit tests**
8. **E2E tests**

---

## Risk Assessment

**Low risk**: All data structures exist. `AnswerFeedback` is reusable. `QuestionDisplayMode` pre-scaffolded.

**Moderate complexity**: Review mode styling in question components needs careful handling of all cases (correct/incorrect/unselected-correct). Write unit tests first for these.

**FillInBlank review**: Most custom logic needed — comparing user text to correct answer with case-insensitive detection. Keep it simple: exact match = "Correct", otherwise show both answers side by side.

---

## Dependency Check

- Story 12.6: ✅ Done (QuizResults page exists)
- Story 14.4: ✅ Done (react-markdown@10.1.0, MarkdownRenderer exists)
- Story 15.4: ✅ Done (AnswerFeedback with explanations exists)
- No new npm dependencies needed
