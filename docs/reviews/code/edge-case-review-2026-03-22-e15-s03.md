## Edge Case Review — E15-S03 (2026-03-22)

### Unhandled Edge Cases

**src/hooks/useQuizTimer.ts:78-95** — `Tab hidden long enough that remaining jumps from >60 to 0`
> Consequence: All three warning toasts silently skipped when user returns to expired quiz
> Guard: `Remove remaining > 0 guard or fire warnings before the remaining === 0 expiry check`

**src/hooks/useQuizTimer.ts:78-95** — `Large time jump crosses multiple thresholds in single tick`
> Consequence: Three toasts stack simultaneously, overwhelming the user
> Guard: `Skip lower-urgency warnings when higher-urgency ones fire simultaneously (e.g., skip 25% if 10% also triggers)`

**src/hooks/useQuizTimer.ts:78-95** — `initialSeconds <= 60 (short quiz, e.g., 30s or 60s)`
> Consequence: 1min warning fires immediately on quiz start; 25% and 10% fire within seconds
> Guard: `if (initialSeconds <= 60) skip percentage-based warnings; only fire 1min if initialSeconds >= 60`

**src/app/components/quiz/TimerWarnings.tsx:36-55** — `Quiz ends (expires or submitted) while 1min persistent toast is visible`
> Consequence: Persistent toast stays on screen after quiz ends, overlapping results
> Guard: `Dismiss persistent toast on unmount: useEffect(() => () => toast.dismiss(toastIdRef.current), [])`

**src/app/components/quiz/TimerWarnings.tsx:32-33** — `ARIA polite/assertive regions set once and never cleared`
> Consequence: Screen readers may not re-announce if same text persists across navigations
> Guard: `Clear announcement after timeout: setTimeout(() => setPoliteAnnouncement(''), 1000)`

**src/app/pages/Quiz.tsx:263-268** — `User retakes quiz without page reload (warningState not reset)`
> Consequence: TimerWarnings renders stale warning level from previous attempt on remount
> Guard: `Reset warningState to null when quiz restarts (e.g., in handleStartQuiz)`

**src/hooks/useQuizTimer.ts:82-93** — `Short quiz (e.g., 2min) where 25% remaining (30s) < 60s threshold`
> Consequence: Warnings fire in reversed urgency order (1min first, then 25% later)
> Guard: `Order thresholds by urgency: check 1min before 10% before 25%; skip 25% if 1min already fired`

**src/hooks/useQuizTimer.ts:78** — `initialSeconds is fractional (e.g., 0.5) — passes > 0 guard`
> Consequence: Division by sub-second value produces erratic percentage thresholds
> Guard: `Guard: if (initialSeconds < 1) return; or Math.floor(initialSeconds) at entry`

---
**Total:** 8 unhandled edge cases found.
