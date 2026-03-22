## Edge Case Review — E15-S05 (2026-03-22)

### Unhandled Edge Cases

**src/lib/analytics.ts:21-23** — `Skipped questions pushed to incorrectQuestionNumbers`
> Consequence: "Review questions X, Y" suggests reviewing unanswered questions alongside wrong ones
> Guard: `Track skipped question numbers separately: if (!answer || isUnanswered(answer.userAnswer)) { skippedCount++; /* don't push to incorrectQuestionNumbers */ }`

**src/lib/analytics.ts:12** — `question.topic is empty string ""`
> Consequence: Empty string topic silently treated as "General" due to falsy OR
> Guard: `const topic = question.topic?.trim() || 'General'`

**src/lib/analytics.ts:36** — `Math.round at 69.5% boundary rounds to 70% (strength)`
> Consequence: A topic at 69.5% exact (e.g., 139/200) becomes a strength instead of growth area
> Guard: `percentage: total > 0 ? Math.floor((correct / total) * 100) : 0`

**src/lib/analytics.ts:1** — `Duplicate answers for same questionId in answers array`
> Consequence: Map constructor keeps last entry only; earlier answers silently dropped
> Guard: `const answerMap = new Map(); for (const a of answers) { if (!answerMap.has(a.questionId)) answerMap.set(a.questionId, a); }`

**src/app/components/quiz/PerformanceInsights.tsx:9-10** — `skippedCount === 0 hides "0 skipped" text`
> Consequence: AC specifies "10 correct, 2 incorrect, 0 skipped" but component omits zero skipped
> Guard: `Remove the skippedCount > 0 conditional — always render skippedCount`

**src/app/pages/QuizResults.tsx:138** — `lastAttempt.answers is undefined or null`
> Consequence: analyzeTopicPerformance calls answers.map() on undefined, throws TypeError
> Guard: `<PerformanceInsights questions={currentQuiz.questions} answers={lastAttempt.answers ?? []} />`

**src/app/components/quiz/PerformanceInsights.tsx:33-40** — `Duplicate topic names used as React key`
> Consequence: If two topics share a name (casing variants surviving separately), React key collision causes rendering bugs
> Guard: `<li key={\`\${topic.name}-\${topic.percentage}\`}>` or normalize topic names to lowercase

**src/lib/analytics.ts:11-31** — `Orphaned answers (questionId not in questions array) silently ignored`
> Consequence: correctCount + incorrectCount + skippedCount may not equal total answers provided
> Guard: `Acceptable if by design, but document the invariant: counts reflect questions array only`

**src/lib/analytics.ts:36** — `All questions in a topic are skipped (0 correct, 0 incorrect, N skipped)`
> Consequence: Topic gets 0% and appears as growth area with "Review questions" despite no wrong answers — only skipped
> Guard: `Consider excluding all-skipped topics from growthAreas or adding a distinct label`

---
**Total:** 9 unhandled edge cases found.
