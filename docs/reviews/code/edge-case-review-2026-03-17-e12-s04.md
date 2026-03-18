## Edge Case Review — E12-S04 (2026-03-17)

### Unhandled Edge Cases

**[Quiz.tsx:handleResume / QuizHeader.tsx timer init]** — `savedProgress.timeRemaining` is stored in **minutes** by the per-quiz localStorage key, but `startQuiz()` also stores minutes in the Zustand persist key (`levelup-quiz-store`). When `handleResume` injects `savedProgress` directly via `useQuizStore.setState`, `QuizHeader` converts `progress.timeRemaining * 60` correctly. However, if the Zustand persist middleware rehydrates `currentProgress` from `levelup-quiz-store` on a fresh page load (browser refresh mid-quiz), the component still receives minutes and converts correctly — **unless** a future story changes the unit. The unit is not documented on the `QuizProgress` type's `timeRemaining` field; the Zod schema comment says "milliseconds" (`/** Remaining time in milliseconds, or null for untimed quizzes */`) while `startQuiz` stores **minutes** and the implementation notes say "minutes". This type/comment mismatch means any developer reading the type will initialize the timer incorrectly.
> Consequence: Timer displays a value 60,000× too large (if treated as milliseconds) or 60× too fast (if treated as seconds) by any future consumer of `QuizProgress.timeRemaining`. The bug exists in the type-level contract right now, not yet in rendered behavior.
> Guard: `timeRemaining: z.number().min(0).nullable(), // stored in minutes — matches quiz.timeLimit unit`

---

**[Quiz.tsx:loadSavedProgress:26]** — `JSON.parse(raw) as QuizProgress` uses a TypeScript cast, not a runtime validation. Corrupt or tampered localStorage data (e.g., a `savedProgress` object where `answers` is a string rather than a record, or `questionOrder` is missing) will pass the `Object.keys(parsed.answers ?? {}).length === 0` guard and be returned as valid, then passed to `useQuizStore.setState` in `handleResume` without any schema validation.
> Consequence: Injecting a structurally invalid `QuizProgress` into the Zustand store will cause runtime crashes in `QuizHeader` (e.g., `progress.questionOrder.length` throws if `questionOrder` is missing) and in any Story 12.5 component that indexes into `questionOrder`. The error surfaces in the active-quiz view with no user-visible error state.
> Guard: `const parsed = QuizProgressSchema.safeParse(JSON.parse(raw)); if (!parsed.success) return null; return parsed.data`

---

**[Quiz.tsx:handleResume:88]** — `handleResume` calls `useQuizStore.setState(...)` directly, bypassing the persist middleware's write cycle. If the user resumes from the per-quiz localStorage key (`quiz-progress-{quizId}`), the Zustand persist key (`levelup-quiz-store`) is not updated. On a subsequent hard refresh, the Zustand persist middleware rehydrates `currentProgress` as `null` (since it was never written), so the resumed session is silently lost. The learner sees the start screen again with "Resume Quiz" still showing, but clicking Resume injects the same stale per-quiz progress — creating an infinite resume loop with no progress being saved mid-quiz.
> Consequence: Any answer submitted after a `handleResume` call is persisted to Zustand's in-memory state but the `persist` middleware never serializes it because `setState` does not trigger the middleware's `onRehydrateStorage` or `partialize` write path for the outer `levelup-quiz-store` key until the next Zustand state change via a store action.
> Guard: After `useQuizStore.setState(...)`, explicitly trigger a no-op set or use `useQuizStore.getState().resumeQuiz()` extended to accept a `QuizProgress` parameter so the persist middleware captures the write.

---

**[QuizHeader.tsx:useEffect timer — empty deps array, line 33]** — The countdown interval is started once on mount and never restarted if `remainingSeconds` reaches 0. When the timer hits `0`, `setRemainingSeconds(s => 0)` continues firing every 1 second indefinitely. The interval is never cleared when the countdown expires; it only clears on unmount.
> Consequence: Unnecessary `setInterval` ticks continue after the quiz timer expires, causing 1 React re-render per second for the lifetime of the component. More critically, the quiz is not auto-submitted or locked when time expires — the learner can keep answering indefinitely past the time limit. This is a behavioral correctness issue for timed quizzes.
> Guard: `setRemainingSeconds(s => { if (s !== null && s > 0) return s - 1; clearInterval(interval); return 0; })` — or detect `remainingSeconds === 0` in the effect and call an `onTimeExpired` callback.

---

**[QuizHeader.tsx:progressValue calculation, line 21]** — `const currentQuestion = progress.currentQuestionIndex + 1` and `const progressValue = Math.round((currentQuestion / totalQuestions) * 100)`. When `currentQuestionIndex` is 0 (first question), `progressValue` is `Math.round(1/N * 100)`, which shows partial progress before any question is answered. When `currentQuestionIndex === totalQuestions - 1` (last question), `progressValue` is 100% — implying completion before the quiz is actually submitted.
> Consequence: The progress bar shows 100% while the learner is still on the last question, before submitting. This is misleading UX that could cause premature "I'm done" confusion.
> Guard: Use answered count instead: `const progressValue = Math.round((Object.keys(progress.answers).length / totalQuestions) * 100)` — or define progress as 0-based so `currentQuestionIndex / totalQuestions` reaches 100% only after submit.

---

**[Quiz.tsx:isQuizActive guard, line 119]** — `const isQuizActive = currentProgress !== null && currentProgress.quizId === quiz.id`. If the user navigates directly from one quiz URL to a different quiz URL (without unmounting the component — e.g., React Router keeps the component alive), `currentProgress` from the previous quiz still exists in the store with a different `quizId`. The `quizId` guard correctly blocks the active view, but the `fetchState` for the new quiz will be `'loading'` and the new `quiz` will be fetched. However, `isStoreLoading` from the old `startQuiz` call may momentarily be `true`, showing the skeleton. The deeper issue: the Dexie `useEffect` only re-runs when `lessonId` changes, which is correct, but `startQuiz` is not called and the store is not cleared between quiz navigations. A stale `currentProgress` for quiz-A remains in the store while viewing quiz-B's start screen.
> Consequence: If the user clicks "Start Quiz" on quiz-B while `currentProgress` for quiz-A is still in the store, `handleStart` calls `startQuiz(lessonId)` which will overwrite the store. This is acceptable. However, if the user clicks "Resume Quiz" for quiz-B (whose progress was restored from localStorage) and then navigates back to quiz-A, the store's `currentProgress` is now quiz-B's, causing quiz-A's start screen to show quiz-B's active state. No cleanup on route change or component unmount is performed.
> Guard: Add a `useEffect` with `[quiz?.id]` dependency that calls `useQuizStore.getState().clearQuiz()` when the component mounts with a different quiz than what's in the store.

---

**[Quiz.tsx:handleStart, line 83]** — `startQuiz(lessonId).catch(console.error)` — errors from `startQuiz` are caught by `console.error` at the call site, but `startQuiz` itself also sets `state.error` inside the store. The `Quiz` component reads `selectError` is not subscribed to at all — there is no `selectError` selector usage in `Quiz.tsx`. The store's error string is written but never surfaced to the user on the start screen.
> Consequence: If `startQuiz` fails (e.g., Dexie throws, or the quiz was deleted between page load and button click), the user sees nothing change — the "Start Quiz" button remains clickable, `isStoreLoading` returns to `false`, and the start screen re-renders with no feedback. The learner cannot distinguish between a silent failure and a normal state.
> Guard: Subscribe to `selectError` in `Quiz.tsx` and render an inline error banner when `error !== null`.

---

**[QuizStartScreen.tsx:answeredCount, line 12]** — `const answeredCount = savedProgress ? Object.keys(savedProgress.answers).length : 0`. The displayed count in the Resume button is computed from the saved localStorage progress, but `savedProgress.currentQuestionIndex` may be ahead of the answer count (e.g., if the user navigated forward without answering). The Resume button shows "Resume Quiz (3 of 12 answered)" but the current position is question 7, which may surprise the learner.
> Consequence: Minor UX confusion — the resume button accurately shows answers recorded but not the current position. However, the more concerning case is `currentQuestionIndex` being 0 while `answers` has entries (e.g., if the user answered but navigated back). Using `answeredCount` is correct; the issue is that `currentQuestionIndex + 1` would be a more natural "where you left off" indicator. Low severity, but the label conflates answered count with position.
> Guard: Display as "Resume Quiz (question {currentQuestionIndex + 1} of {total}, {answeredCount} answered)" — or decide on one canonical metric and use it consistently.

---

**[tests/e2e/story-e12-s04.spec.ts:AC2 timer test, line 131]** — `await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible()` — this locator will match any `MM:SS`-formatted text on the page, including UI elements outside the quiz component (e.g., a hypothetical sidebar clock or course duration display). It uses no `aria-label` or role anchor.
> Consequence: The test is a false positive if any other `MM:SS` pattern is visible. The `aria-label` is set on the timer span (`aria-label="Time remaining: 10:00"`), making a more specific locator available.
> Guard: `await expect(page.getByLabel(/time remaining/i)).toBeVisible()` — uses the `aria-label` attribute set on the timer `<span>`.

---

**[Quiz.tsx:loadSavedProgress key pattern vs. store persist key]** — `localStorage.getItem('quiz-progress-${quizId}')` reads a per-quiz key. The Zustand persist middleware writes to `levelup-quiz-store` (a single key for the entire store). There is no code that writes to `quiz-progress-${quizId}`. The E2E test seeds this key manually via `addInitScript`. In production, nothing ever writes `quiz-progress-${quizId}` — so `loadSavedProgress` will always return `null` for real users, and the Resume button will never appear until something writes to this per-quiz key.
> Consequence: The resume flow is entirely non-functional for real users (not a test artifact issue — the key is never written by the application). The story's AC3 can only be tested by seeding localStorage directly. Story 12.5+ must write to `quiz-progress-${quizId}` during `submitAnswer` or the entire crash-recovery design is dead on arrival.
> Guard: Document this explicitly as "Resume requires Story 12.5 to write `quiz-progress-${quizId}` on every answer submission" — or write a minimal `persistQuizProgress()` helper in this story to unblock the real-user flow.

---

**Total:** 10 unhandled edge cases found.
