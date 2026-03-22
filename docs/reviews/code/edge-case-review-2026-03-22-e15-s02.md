## Edge Case Review — E15-S02 (2026-03-22)

### Unhandled Edge Cases

**src/app/components/quiz/QuizStartScreen.tsx:79-82** — `quiz.timeLimit is 0 (falsy but not null/undefined)`
> Consequence: formatTimeBadge called with 0, shows "0 min" badge and accommodations button for zero-time quiz
> Guard: `const hasTimed = quiz.timeLimit != null && quiz.timeLimit > 0`

**src/app/components/quiz/QuizStartScreen.tsx:37-38** — `formatTimeBadge receives fractional baseMinutes (e.g. 0.5)`
> Consequence: Shows "0 min 30 sec" instead of "30 sec" for sub-minute times
> Guard: `Handle sub-minute base: if (whole === 0) return '${seconds} sec'`

**src/app/components/quiz/TimerAccommodationsModal.tsx:66** — `onValueChange receives unexpected string not in TimerAccommodation union`
> Consequence: Invalid value cast via "as TimerAccommodation" bypasses type safety at runtime
> Guard: `const parsed = TimerAccommodationEnum.safeParse(v); if (parsed.success) setSelected(parsed.data)`

**src/stores/useQuizStore.ts:86-87** — `baseTimeMinutes is very large (e.g. 999999) and multiplier is 2`
> Consequence: timeRemaining becomes astronomically large, timer shows nonsensical values
> Guard: `const timeRemaining = acc === 'untimed' ? null : Math.min((quiz.timeLimit ?? 0) * multiplier, MAX_TIMER_MINUTES)`

**src/app/pages/Quiz.tsx:94-96** — `lessonId is empty string or undefined at initialization`
> Consequence: localStorage key becomes "quiz-accommodation-" (trailing dash), silently wrong key
> Guard: `loadSavedAccommodation(lessonId || 'default')`

**src/app/pages/Quiz.tsx:248-253** — `Resume a quiz started with accommodation but timerAccommodation field missing in old progress`
> Consequence: undefined !== "untimed" evaluates true, timer initializes incorrectly for legacy progress objects
> Guard: `(currentProgress.timerAccommodation ?? 'standard') !== 'untimed'`

**src/app/components/quiz/QuizTimer.tsx:43-44** — `totalTime is 0 (untimed quiz somehow renders QuizTimer)`
> Consequence: Division by zero in threshold calc: totalTime * 0.25 = 0, immediate warning/urgent state
> Guard: `if (totalTime <= 0) return null`

**src/stores/useQuizStore.ts:86** — `quiz.timeLimit is negative number (corrupted data)`
> Consequence: Negative timeRemaining causes timer to show negative values or immediate timeout
> Guard: `const safeLimit = Math.max(quiz.timeLimit ?? 0, 0)`

**src/app/pages/Quiz.tsx:161-167** — `localStorage quota exceeded when saving accommodation`
> Consequence: Preference silently not saved; user must re-select next time with no indication
> Guard: `Already handled by try/catch but no user feedback on failure`

**src/app/components/quiz/QuizStartScreen.tsx:79** — `formatTimeBadge produces floating point artifact where seconds rounds to 60`
> Consequence: Display shows "10 min 60 sec" instead of "11 min" for certain base times
> Guard: `if (seconds >= 60) { whole += 1; seconds = 0 }`

**src/app/components/quiz/QuizTimer.tsx:43-44** — `annotation contains parentheses or special characters`
> Consequence: Double-wrapped parens in display: "(Extended Time (v2))" looks odd but is harmless
> Guard: `Cosmetic only — no functional guard needed`

---
**Total:** 11 unhandled edge cases found.
