## Edge Case Review — E18-S06 (2026-03-23)

### Unhandled Edge Cases

**`src/lib/quizMetrics.ts:28`** — `db.quizAttempts.toArray() rejects (IndexedDB unavailable or schema mismatch)`
> Consequence: Unhandled rejection propagates; caller component frozen in skeleton state indefinitely
> Guard: `const allAttempts = await db.quizAttempts.toArray().catch(() => [])`

---

**`src/lib/quizMetrics.ts:33`** — `attempt.percentage is undefined, null, or NaN in a stored record`
> Consequence: averageScore becomes NaN; UI renders "NaN%" for Average Score metric
> Guard: `sum + (Number.isFinite(a.percentage) ? a.percentage : 0)`

---

**`src/lib/quizMetrics.ts:33`** — `attempt.percentage is outside [0, 100] due to data corruption`
> Consequence: Average score displays an impossible value (e.g., 150% or a negative percentage)
> Guard: `sum + Math.min(100, Math.max(0, a.percentage))`

---

**`src/app/components/dashboard/QuizPerformanceCard.tsx:85-90`** — `calculateQuizMetrics() promise rejects`
> Consequence: Component stays in skeleton state indefinitely with no error feedback shown to user
> Guard: `calculateQuizMetrics().then(r => { if (!ignore) setMetrics(r) }).catch(() => { if (!ignore) setMetrics({ totalQuizzes: 0, averageScore: 0, completionRate: 0 }) })`

---

**`src/app/components/dashboard/QuizPerformanceCard.tsx:57-67`** — `User clicks "Find Quizzes" link inside QuizEmptyState (rendered within outer <button>)`
> Consequence: Both link navigation and `navigate('/reports?tab=quizzes')` fire simultaneously; also invalid DOM nesting (`button > a`)
> Guard: `Add onClick={e => e.stopPropagation()} to the <Button asChild> / <Link> inside QuizEmptyState`

---

**Total:** 5 unhandled edge cases found.
