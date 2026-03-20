## Edge Case Review — Stitch Quiz Enhancements (2026-03-20)

### Unhandled Edge Cases

**Quiz.tsx:54-61 countUnanswered()** — `multiple-select answer is an empty array []`
> Consequence: Empty array is truthy and not `=== ''`, so question counted as "answered" — submit dialog shows wrong unanswered count
> Guard: `return a === undefined || a === '' || (Array.isArray(a) && a.length === 0)`

**Quiz.tsx:236-238 currentAnswer cast** — `multiple-select question stores string[] but cast to string | undefined`
> Consequence: QuestionDisplay receives a string[] coerced to string type — checkboxes may not reflect selected state
> Guard: `const currentAnswer = currentQuestionId ? currentProgress.answers[currentQuestionId] : undefined` (remove `as string | undefined` cast)

**Quiz.tsx:228-233 questionId fallback** — `questionOrder is shorter than questions array (quiz updated after progress saved)`
> Consequence: Both `questionOrder[index]` and fallback `questions[index]?.id` could yield undefined, making currentQuestion undefined despite valid quiz
> Guard: `if (!questionId) { goToNextQuestion(); return }` or clamp index to `Math.min(index, questionOrder.length - 1)`

**Quiz.tsx:132-152 handleResume()** — `savedProgress.answers contains keys for removed question IDs`
> Consequence: Stale answer keys persist in store — scoring may process orphaned answers or skip validation
> Guard: `const validAnswers = Object.fromEntries(Object.entries(savedProgress.answers).filter(([k]) => currentQuestionIds.has(k)))`

**Quiz.tsx:254-257 rAF auto-focus** — `requestAnimationFrame fires after unmount during rapid navigation`
> Consequence: rAF callback executes after cleanup; ref optional chaining prevents crash but the rAF ID leaks
> Guard: `cancelAnimationFrame(rafRef.current)` in effect cleanup already exists, but onChange callback can schedule new rAF after cleanup runs — add a `mountedRef` guard

**QuizResults.tsx:44-47 maxScore** — `lastAttempt.answers is empty array (zero-question quiz edge case)`
> Consequence: reduce returns 0, displays "0 of 0 correct" and "0% to pass" — cosmetically misleading
> Guard: `if (maxScore === 0) return <EmptyState message="No questions were scored" />`

**QuizResults.tsx:30-39 loadAttempts error** — `Dexie read failure sets attemptsLoaded=true with empty attempts`
> Consequence: Error triggers redirect to quiz page via line 85-86 condition — user sees no error explanation, toast may flash briefly
> Guard: `Add error state; show error UI instead of redirecting on load failure`

**QuizResults.tsx:80-81 redirect loop** — `currentQuiz is null and quiz page also can't find quiz`
> Consequence: Quiz page shows error state (no redirect back), so no infinite loop — but user lands on quiz error with no results context
> Guard: `Navigate to course page instead: /courses/${courseId}`

**ScoreSummary.tsx:20-21 getScoreTier** — `percentage is NaN (0/0 division upstream)`
> Consequence: NaN fails all >= comparisons, falls through to NEEDS WORK tier incorrectly
> Guard: `if (Number.isNaN(percentage)) return { label: 'NO SCORE', message: 'No score available.', ringClass: 'text-muted-foreground', textClass: 'text-muted-foreground' }`

**ScoreSummary.tsx:20-28 getScoreTier** — `percentage >= 90 but passed is false (passingScore is 95)`
> Consequence: EXCELLENT tier shown but passed=false — "Outstanding! You've mastered this material" conflicts with failing status
> Guard: `if (percentage >= 90 && passed)` or show a qualified message when percentage >= 90 but not passed

**ScoreSummary.tsx:121 sr-only announcement** — `percentage is NaN`
> Consequence: Screen reader announces "Quiz score: NaN percent" — confusing for assistive technology users
> Guard: `const displayPct = Number.isFinite(percentage) ? Math.round(clampedPct) : 0`

**QuestionBreakdown.tsx:36-44 rows mapping** — `answers contains questionId not present in questions array`
> Consequence: Orphaned answers silently dropped — correctCount/total diverges from ScoreSummary totals
> Guard: `const orphaned = answers.filter(a => !questions.some(q => q.id === a.questionId)); if (orphaned.length) console.warn('[QuestionBreakdown] Orphaned answers:', orphaned)`

**QuestionBreakdown.tsx:44 sort** — `multiple questions share the same order value`
> Consequence: Sort is unstable across browsers for equal elements — row order may vary per render
> Guard: `.sort((a, b) => a.question.order - b.question.order || a.question.id.localeCompare(b.question.id))`

**AreasForGrowth.tsx:39** — `incorrectItems has duplicate questionId values`
> Consequence: React key collision warning, potential DOM reconciliation issues
> Guard: `key={`${item.questionId}-${index}`}`

---
**Total:** 14 unhandled edge cases found.
