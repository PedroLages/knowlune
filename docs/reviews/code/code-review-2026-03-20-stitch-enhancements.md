## Code Review: Stitch Quiz Enhancements (Pass 2)

### What Works Well

1. **Tier-based scoring is well-structured.** The `getScoreTier` function in `ScoreSummary.tsx` cleanly maps percentage ranges to labels, messages, and color tokens with a single source of truth. The previous dual-function misalignment has been resolved. Boundary tests (exactly 90%, exactly 50%, 49%, 89%) are thorough and verify the logic exhaustively.

2. **Accessibility is solid across all new components.** `useId()` for unique heading IDs on `AreasForGrowth`, `aria-live` for score announcements, `role="note"` on `QuestionHint`, ARIA labels on status icons in `QuestionBreakdown`, and `motion-reduce:transition-none` on the score ring. The `min-h-[44px]` touch targets are consistent throughout.

3. **Defensive coding in Quiz.tsx.** Zod validation of localStorage progress, the `ignore` flag for race-condition-safe unmounting, and the check that `savedProgress.questionOrder` still matches current quiz questions before restoring state demonstrate careful engineering.

### Findings

#### Blockers

*None*

#### High Priority

- **[src/app/components/quiz/ScoreSummary.tsx:55] (confidence: 90)**: SVG progress ring has no guard against out-of-range `percentage` values. If `percentage` exceeds 100 or is negative (floating-point arithmetic, bad data from Dexie), `strokeDashoffset` becomes negative (overshoot past full circle) or larger than `circumference` (arc renders backwards). The component trusts the caller to provide 0-100 but the Zod schema on `QuizAttemptSchema.percentage` only enforces `min(0).max(100)` at parse time -- not at render time after potential in-memory mutations. Why: A learner could see a visually broken score ring, undermining trust in their results. Fix: Clamp at the render site:
  ```tsx
  const clampedPct = Math.min(100, Math.max(0, percentage))
  const offset = circumference - (clampedPct / 100) * circumference
  ```

- **[src/app/components/quiz/QuestionBreakdown.tsx:37] (confidence: 85)**: O(n*m) join between `questions` and `answers` via nested `Array.find`. More critically, if an answer references a `questionId` that does not exist in `questions` (e.g., quiz was edited between attempts), that answer is silently dropped from the breakdown with no warning. Why: A learner who answered all questions could see fewer rows than expected, with no indication why. Fix: Build a `Map` for O(1) lookup and warn on orphaned answers:
  ```tsx
  const questionMap = new Map(questions.map(q => [q.id, q]))
  ```

- **[Recurring] [src/app/pages/QuizResults.tsx:33-34] (confidence: 82)**: `loadAttempts` error is silently swallowed. The `.catch(() => setAttemptsLoaded(true))` sets the flag but provides zero feedback to the learner. If IndexedDB read fails (quota, corruption, browser restrictions), the learner is silently redirected back to the quiz page (line 82) with no error message. Why: The learner completed a quiz, navigated to results, and gets bounced back with no explanation. Fix: Surface the error:
  ```tsx
  .catch((err) => {
    console.error('[QuizResults] Failed to load attempts:', err)
    toast.error('Could not load quiz results. Please try again.')
    setAttemptsLoaded(true)
  })
  ```

- **[Recurring] [src/app/pages/QuizResults.tsx:66-68] (confidence: 80)**: Fire-and-forget async in `handleRetake`. The `catch` block is empty (comment says "Store shows error toast internally"). If `retakeQuiz` throws an error type the store does not handle, the learner clicks "Retake Quiz" and nothing happens with no feedback. Why: Silent failure erodes user trust. Fix: Add defensive logging at minimum:
  ```tsx
  } catch (err) {
    console.error('[QuizResults] Retake failed:', err)
  }
  ```

#### Medium

- **[src/app/pages/Quiz.tsx:253] (confidence: 74)**: `requestAnimationFrame` for auto-focusing the Next button after answer selection. If the button transitions from hidden to visible in the same render cycle (e.g., answering the second-to-last question reveals Submit), `nextBtnRef.current` could be null because React hasn't committed the DOM update yet. The current code uses non-optional access (`nextBtnRef.current?.focus()` is safe due to optional chaining implicitly, but the `ref` assignment on line 280/291 means the ref switches between two different buttons). Fix: Consider a `useEffect` keyed on the answer value or at minimum verify the rAF timing is reliable across the Next-to-Submit button transition.

- **[src/app/pages/QuizResults.tsx:40-43] (confidence: 72)**: `maxScore` is wrapped in `useMemo` depending on `lastAttempt`, but `lastAttempt` is derived from `attempts[attempts.length - 1]` on line 38 -- a new object reference on every render. The memo recomputes every time `attempts` changes. Since the computation is a single `.reduce()` over a small array, the `useMemo` adds cognitive overhead without meaningful optimization. Fix: Either remove the `useMemo` (computation is trivial) or stabilize `lastAttempt` with its own `useMemo`.

- **[src/app/components/quiz/QuestionBreakdown.tsx:35-43] (confidence: 78)**: The comment on lines 31-34 explains canonical question order is shown, not shuffle order. This is a reasonable design choice, but the inverse case -- answers for questions that were *removed* from the quiz after the attempt -- are silently dropped by the `.filter()` on line 40. Consider showing a "Question no longer available" placeholder row for orphaned answers so the total always matches the learner's actual attempt.

- **[src/app/components/quiz/ScoreSummary.tsx:74] (confidence: 70)**: `text-muted/30` on the track circle. The `/30` opacity modifier is applied to the `text-muted` token. In Tailwind v4, `text-muted` resolves to the `--color-muted` CSS variable (which is a background-oriented token: `#e9e7e4` in light mode). Using a background token as a text/stroke color works visually but is semantically unexpected. Consider using `text-muted-foreground/30` or a dedicated `stroke-*` approach for the track.

#### Nits

- **Nit** [src/app/components/quiz/ScoreSummary.tsx:96,120] (confidence: 65): `Math.round(percentage)` is called twice -- once in the visual display (line 96) and once in the sr-only text (line 120). Extract to a variable for consistency: `const displayPercentage = Math.round(percentage)`.

- **Nit** [src/app/components/quiz/AreasForGrowth.tsx:53] (confidence: 60): The "Show all" button uses `size="sm"` but also `min-h-[44px]`. The `min-h` overrides the small size's height at runtime. Consider using the default size variant so the intent is clearer.

- **Nit** [src/app/components/quiz/QuestionBreakdown.tsx:76] (confidence: 55): `cn('flex items-center gap-3 rounded-xl px-4 py-2 min-h-[44px]', 'bg-card')` -- the second argument is a static class that could be part of the first string. `cn()` is useful for conditional merging; using it to concatenate two static strings adds function call overhead for no benefit.

### Recommendations

1. **First**: Clamp `percentage` in `ScoreRing` (High -- visual corruption risk, 2-line fix).
2. **Second**: Add error feedback in `QuizResults` `loadAttempts` catch block (High -- silent failure for learners).
3. **Third**: Add `console.error` to `handleRetake` catch block (High -- recurring fire-and-forget pattern).
4. **Fourth**: Convert `QuestionBreakdown` join to Map-based lookup with orphan warning (High -- correctness for edge cases).
5. **Fifth**: Address medium findings as time permits -- they are polish, not blockers.

---
Issues found: 9 | Blockers: 0 | High: 4 | Medium: 4 | Nits: 3
Confidence: avg 75 | >= 90: 1 | 70-89: 6 | < 70: 3
