# Plan: Stitch-Inspired Quiz UX Enhancements

Cherry-picked UX patterns from Stitch design review (2026-03-20). These enhance the existing quiz flow without changing the design system.

## Feature 1: Per-Question Score Breakdown (QuizResults)

**Inspired by:** `quiz_results_refined_layout` — "Topic Breakdown" sidebar showing per-topic scores.

**What:** Add a collapsible "Question Breakdown" section to QuizResults showing each question with correct/incorrect status, points earned, and the question text.

**Data source:** `QuizAttempt.answers[]` already has `questionId`, `isCorrect`, `pointsEarned`, `pointsPossible`. Cross-reference with `Quiz.questions[]` for question text.

**Implementation:**
- Create `src/app/components/quiz/QuestionBreakdown.tsx`
  - Props: `answers: Answer[]`, `questions: Question[]`
  - For each answer: show question number, truncated text, correct/incorrect icon, points
  - Use design tokens: `text-success` for correct, `text-destructive` for incorrect
  - Collapsible via shadcn Collapsible component
- Add to `QuizResults.tsx` between ScoreSummary and action buttons
- No store changes needed — all data already available

## Feature 2: Areas for Growth (QuizResults)

**Inspired by:** `quiz_results_encouraging_feedback` — "Areas for Growth" section with specific topics to review.

**What:** Below the question breakdown, show missed questions grouped as "Areas to Review" with encouraging copy. Only shown if any questions were wrong.

**Implementation:**
- Create `src/app/components/quiz/AreasForGrowth.tsx`
  - Props: `incorrectAnswers: Array<{ questionText: string; correctAnswer: string }>`
  - Show each missed question with the correct answer revealed
  - Encouraging header: "Areas to Review" (not "You got these wrong")
  - Use `bg-warning-soft` or `bg-muted` background card
- Filter `lastAttempt.answers.filter(a => !a.isCorrect)` in QuizResults
- Wire question text from `currentQuiz.questions`
- No store changes needed

## Feature 3: Contextual Quiz Tips (Quiz active view)

**Inspired by:** `refined_quiz_question` — "Design Pro-Tip" card at bottom during quiz-taking.

**What:** Show optional contextual hints below the question when available. Tips are stored per-question in the quiz data.

**Implementation:**
- Add optional `hint?: string` field to `QuestionSchema` in `src/types/quiz.ts`
- Create `src/app/components/quiz/QuestionHint.tsx`
  - Props: `hint: string | undefined`
  - Only renders if hint is non-empty
  - Lightbulb icon + hint text in a subtle card (`bg-muted rounded-xl p-4`)
- Add `<QuestionHint>` below `<QuestionDisplay>` in `Quiz.tsx`
- Backward-compatible: existing quizzes without hints show nothing

## Constraints

- Use existing design tokens — no new colors
- Use existing shadcn/ui components (Collapsible, Card, etc.)
- All features must be backward-compatible (no breaking changes to quiz data model)
- Follow LevelUp patterns: `cn()` utility, design token ESLint rule, min-h-[44px] touch targets
- Unit tests for each new component
