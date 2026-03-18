## Edge Case Review — E12-S04 (2026-03-18)

### Unhandled Edge Cases

**QuizHeader.tsx:31** — `progress.questionOrder is empty array (length 0)`
> Consequence: totalQuestions becomes 0, progressValue division uses 0 denominator path but shows "Question 1 of 0"
> Guard: `const totalQuestions = (progress.questionOrder.length || quiz.questions.length) || 1`

**QuizHeader.tsx:23-25** — `progress.currentQuestionIndex exceeds totalQuestions from stale localStorage`
> Consequence: progressValue exceeds 100%, progress bar overflows or renders incorrectly
> Guard: `const currentQuestion = Math.min(progress.currentQuestionIndex + 1, totalQuestions)`

**QuizHeader.tsx:33-35** — `progress.timeRemaining is 0 (valid per schema min:0)`
> Consequence: Math.round(0 * 60) = 0 seconds, timer starts at 00:00 but interval still runs one tick setting it to -1 via `s - 1` before the `s <= 0` guard fires
> Guard: `if (s === null || s <= 1) { clearInterval(...); return 0; }` or initialize with early-return when remainingSeconds is 0

**QuizHeader.tsx:12-16** — `formatTime receives negative totalSeconds`
> Consequence: Math.floor of negative number produces unexpected results (e.g., "-1:59" display), modulo of negative is negative in JS
> Guard: `const clamped = Math.max(0, totalSeconds)` at the top of formatTime

**QuizHeader.tsx:55-60** — `clearInterval runs inside setState callback (side effect in updater)`
> Consequence: React may batch state updates; clearInterval inside a setState updater is a side effect that React does not guarantee runs synchronously — interval could fire one extra tick
> Guard: Move clearInterval outside the setState updater using a ref to track expiry, or use useEffect watching remainingSeconds === 0

**QuizHeader.tsx:54** — `Empty dependency array ignores prop changes on re-render`
> Consequence: If QuizHeader remounts with different progress (resume vs fresh start), timer uses stale initial value from first render
> Guard: `}, [progress.timeRemaining])` or derive initial seconds from props with a key reset

**QuizHeader.tsx:72-98** — `remainingSeconds changes every second but dependency is [remainingSeconds === null]`
> Consequence: Boolean expression is a stable dependency trick, but if remainingSeconds transitions from number back to null (store rehydration), cleanup runs but syncToStore captures stale closure value
> Guard: Use a ref for the sync callback to avoid stale closure, or add eslint-disable comment with justification

**QuizHeader.tsx:80-88** — `useQuizStore.setState called inside React setState updater`
> Consequence: Calling an external store's setState inside a React setState updater is a side effect; during React 19 concurrent rendering, this could trigger a warning or be deferred unexpectedly
> Guard: Extract syncToStore to use a ref for remainingSeconds and call useQuizStore.setState outside of setRemainingSeconds

**QuizHeader.tsx:96** — `syncToStore fires on unmount with initial value when no tick occurred`
> Consequence: Fast navigation (mount then immediate unmount) writes stale timeRemaining to store before any countdown tick
> Guard: Track whether any tick occurred via a ref; skip final sync if no ticks fired

**Quiz.tsx:77-78** — `db.quizzes.where('lessonId').first() when multiple quizzes exist for a lesson`
> Consequence: Silently picks whichever Dexie returns first — non-deterministic quiz selection
> Guard: Add `.sortBy('createdAt')` then take `[0]`, or log a warning when count > 1

**Quiz.tsx:113** — `handleStart fires startQuiz(lessonId) but error only logged to console`
> Consequence: If Dexie is unavailable (storage full, private browsing), user clicks "Start Quiz" and nothing happens — no visible error
> Guard: `startQuiz(lessonId).catch(() => setFetchState('error'))` or render storeError in UI

**Quiz.tsx:118-126** — `handleResume restores savedProgress without checking quiz definition staleness`
> Consequence: If quiz questions were updated since progress was saved, questionOrder may reference IDs that no longer exist in quiz.questions
> Guard: Validate every ID in `savedProgress.questionOrder` exists in `quiz.questions.map(q => q.id)` before restoring

**Quiz.tsx:127** — `localStorage.removeItem runs after setState but before React commits`
> Consequence: If component unmounts between setState and next render (concurrent React), localStorage is cleared but store state may not persist — progress lost on crash
> Guard: Remove localStorage key only after confirming Zustand persist middleware has written to its storage

**Quiz.tsx:90-95** — `handleResume does not deduct elapsed time since last session`
> Consequence: Resumed quiz restores full timeRemaining from last save; time elapsed between sessions is not deducted — user gets free time
> Guard: `const elapsed = (Date.now() - savedProgress.startTime) / 60000; const adjusted = Math.max(0, (savedProgress.timeRemaining ?? 0) - elapsed);`

**Quiz.tsx:38** — `courseId defaults to empty string when route param is missing`
> Consequence: Error state "Back to course" link navigates to `/courses/` which may be invalid
> Guard: `to={courseId ? \`/courses/${courseId}\` : '/courses'}`

**useQuizStore.ts:109** — `Date.now() - currentProgress.startTime can be negative`
> Consequence: If system clock adjusted backward during quiz, negative timeSpent stored in Dexie
> Guard: `timeSpent: Math.max(0, Date.now() - currentProgress.startTime)`

**useQuizStore.ts:193** — `partialize only persists currentProgress, not currentQuiz`
> Consequence: On page refresh, currentProgress rehydrates but currentQuiz is null — isQuizActive check passes (currentProgress.quizId === quiz.id) but currentQuiz is null, so the active quiz branch does not render
> Guard: Include `currentQuiz` in partialize, or re-fetch quiz from Dexie on rehydration

**QuizStartScreen.tsx:28** — `savedProgress.answers is undefined despite Zod schema requiring it`
> Consequence: If loadSavedProgress code path is bypassed (direct prop injection), Object.keys(undefined) throws TypeError
> Guard: `Object.keys(savedProgress.answers ?? {}).length` (already partially present but relies on Zod gate)

---
**Total:** 18 unhandled edge cases found.
