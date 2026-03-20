## Edge Case Review — Stitch Quiz Enhancements (2026-03-20)

### Unhandled Edge Cases

**ScoreSummary.tsx:getScoreTier** — `percentage is NaN (e.g., 0/0 score division upstream)`
> Consequence: NaN >= 90 is false, NaN >= 50 is false — falls through to NEEDS WORK tier incorrectly
> Guard: `if (Number.isNaN(percentage)) return { label: 'NO SCORE', message: 'No score available.', ringClass: 'text-muted-foreground', textClass: 'text-muted-foreground' }`

**ScoreSummary.tsx:getScoreTier** — `percentage is negative (e.g., upstream scoring bug yields -5)`
> Consequence: Negative percentage renders NEEDS WORK and a broken SVG ring with offset exceeding circumference
> Guard: `const clamped = Math.max(0, Math.min(100, percentage))`

**ScoreSummary.tsx:getScoreTier** — `passed=true but percentage < 50 (stale passingScore vs score mismatch)`
> Consequence: PASSED tier shown for very low scores (e.g., 30%) since the passed check precedes the 50% check
> Guard: `if (passed && percentage >= 50) return { label: 'PASSED', ... }` — add percentage floor to the passed branch

**ScoreSummary.tsx:ScoreRing** — `percentage > 100 (scoring bug or extra credit)`
> Consequence: SVG strokeDashoffset goes negative — arc wraps past full circle, visual glitch
> Guard: `const clampedPct = Math.min(100, Math.max(0, percentage))`

**QuestionBreakdown.tsx:rows mapping** — `answers contains questionId not present in questions array`
> Consequence: Orphaned answers silently dropped — correctCount understates actual answers given
> Guard: `const orphaned = answers.filter(a => !questions.some(q => q.id === a.questionId)); if (orphaned.length) console.warn('Orphaned answers:', orphaned)`

**QuestionBreakdown.tsx:rows mapping** — `questions array has duplicate order values`
> Consequence: Questions with the same order value appear in unpredictable sequence
> Guard: `Sort tiebreaker: .sort((a, b) => a.question.order - b.question.order || a.question.id.localeCompare(b.question.id))`

**QuestionBreakdown.tsx:rows mapping** — `questions array is empty but answers is non-empty`
> Consequence: rows becomes empty after filter, header shows "0/0 correct" — misleading summary
> Guard: `if (questions.length === 0) return null` — add alongside the existing `answers.length === 0` check

**QuizResults.tsx:handleRetake** — `courseId or lessonId is undefined (missing route params)`
> Consequence: Navigates to /courses/undefined/lessons/undefined/quiz — 404 or blank page
> Guard: `if (!courseId || !lessonId) { toast.error('Missing course information'); return }`

**AreasForGrowth.tsx** — `incorrectItems has duplicate questionId values`
> Consequence: React key collision warning in console, potential DOM reconciliation bugs
> Guard: `Deduplicate upstream or use index-based fallback key: key={item.questionId + '-' + i}`

**Quiz.tsx:nextBtnRef auto-focus** — `requestAnimationFrame callback fires after component unmount during rapid navigation`
> Consequence: rAF callback executes after React cleanup; optional chaining on ref prevents crash but rAF itself is a leak
> Guard: `const rafId = requestAnimationFrame(() => nextBtnRef.current?.focus()); return () => cancelAnimationFrame(rafId)` — or guard with a mounted ref

**ScoreSummary.tsx:ScoreSummary** — `timeSpent is 0 — Math.max(timeSpent, 1000) clamps to 1s`
> Consequence: Displays "Completed in 1s" for instant or zero-duration attempts, which is misleading but not broken
> Guard: `Consider showing "< 1s" or omitting the line when timeSpent === 0`

---
**Total:** 11 unhandled edge cases found.
