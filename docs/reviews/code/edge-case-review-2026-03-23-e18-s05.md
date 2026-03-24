## Edge Case Review — E18-S05 (2026-03-23)

### Unhandled Edge Cases

**`src/lib/studyLog.ts:studyDaysFromLog` (diff hunk)** — `a.timestamp` is empty string, null, or non-ISO value
> Consequence: Garbage `"NaN-NaN-NaN"` date key added to the study-days Set as a phantom study day
> Guard: `if (!a.timestamp || isNaN(new Date(a.timestamp).getTime())) continue;`

**`src/lib/studyLog.ts:activityFromLog` (diff hunk)** — `a.timestamp` is empty string, null, or non-ISO value
> Consequence: Garbage key written into `countMap`; silently ignored but persists in memory
> Guard: `if (!a.timestamp || isNaN(new Date(a.timestamp).getTime())) continue;`

**`src/stores/useQuizStore.ts:submitQuiz` (diff hunk ~line 176)** — device clock moves backward between `startQuiz` and `submitQuiz`
> Consequence: Negative `timeSpent` stored in streak metadata, corrupting any analytics consuming it
> Guard: `timeSpent: Math.max(0, Date.now() - currentProgress.startTime)`

**`src/lib/studyLog.ts:activityFromLog` (diff hunk) / `StreakSnapshot.activity`** — caller reads `lessonCount` expecting only lesson completions
> Consequence: UI over-reports lesson count; field silently counts quiz completions too after this change
> Guard: `// rename field to activityCount or add JSDoc noting it includes quiz_complete`

---
**Total:** 4 unhandled edge cases found.
