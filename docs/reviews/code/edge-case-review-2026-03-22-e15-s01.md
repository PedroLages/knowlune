## Edge Case Review — E15-S01 (2026-03-22)

### Unhandled Edge Cases

**useQuizTimer.ts:3-6 (formatTime)** — `totalSeconds is negative (e.g., -5 from a timing glitch)`
> Consequence: `Math.floor(-5/60)` produces `-1`, rendering as `-1:-5` — invalid timer display
> Guard: `const clamped = Math.max(0, totalSeconds)`

**useQuizTimer.ts:3-6 (formatTime)** — `totalSeconds is NaN (non-numeric input)`
> Consequence: `Math.floor(NaN)` produces `NaN`, rendering as `NaN:NaN` in the timer display
> Guard: `if (!Number.isFinite(totalSeconds)) return '00:00'`

**useQuizTimer.ts:48** — `onExpire is async (Quiz.tsx handleTimerExpiry is async) but called without await`
> Consequence: If `submitQuiz()` rejects, the promise is unhandled — silent failure with no error surfaced to user
> Guard: `Promise.resolve(onExpireRef.current()).catch(console.error)`

**useQuizTimer.ts:67-77 (syncToStore)** — `remaining is 0 at expiry but syncToStore skips when remaining <= 0`
> Consequence: Store retains last-synced value (up to 60s stale); crash recovery after expiry could restart quiz with ~1 minute remaining
> Guard: `syncToStore(0)` before calling `onExpireRef.current()` on line 48

**useQuizTimer.ts:31-107 (effect deps)** — `initialSeconds changes on every render due to inline computation in Quiz.tsx`
> Consequence: Store updates change `currentProgress` reference, recomputing `timerInitialSeconds`, which re-triggers the effect — resetting `endTime` anchor and extending remaining time
> Guard: `const timerInitialSeconds = useMemo(() => ..., [currentProgress?.timeRemaining, currentQuiz?.timeLimit])`

**QuizTimer.tsx:11-14 (formatMinuteAnnouncement)** — `totalSeconds is 0 (timer just expired)`
> Consequence: Announces "Time remaining: 0 minutes" instead of a meaningful expiry message
> Guard: `if (totalSeconds <= 0) return 'Time has expired'`

**QuizTimer.tsx:36-39 (threshold announcements)** — `totalTime is very small (e.g., 3 seconds)`
> Consequence: `Math.floor(3 * 0.25) = 0` and `Math.floor(3 * 0.1) = 0` — both thresholds are 0, so warning/urgent announcements never fire for short quizzes
> Guard: `const threshold25 = Math.max(1, Math.floor(totalTime * 0.25))`

**Quiz.tsx:196-204 (handleTimerExpiry)** — `User clicks Submit while timer concurrently expires`
> Consequence: `submitQuiz(courseId)` called twice — double submission may corrupt score or trigger store error
> Guard: `const isSubmittingRef = useRef(false); if (isSubmittingRef.current) return;` guard in both submit paths

**Quiz.tsx:208-209 (timerInitialSeconds)** — `currentProgress.timeRemaining is 0 from a previously expired quiz`
> Consequence: `useQuizTimer(0, onExpire)` returns 0 and never fires — quiz renders with no timer and no expiry message; user sees stale quiz state with no indication it already expired
> Guard: Check `if (timerInitialSeconds === 0 && currentQuiz?.timeLimit) { /* show already-expired state */ }`

**Quiz.tsx:203 (handleTimerExpiry)** — `Component unmounts between await submitQuiz() and navigate()`
> Consequence: `navigate()` called on unmounted component — React Router may warn or navigate to stale route
> Guard: `const isMountedRef = useRef(true)` with cleanup, check before `navigate()`

---
**Total:** 10 unhandled edge cases found.
