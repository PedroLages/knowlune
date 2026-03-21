# Design Review Report — E15-S01: Display Countdown Timer with Accuracy

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e15-s01-display-countdown-timer-accuracy`
**Changed Files**: `src/app/components/quiz/QuizTimer.tsx` (new), `src/hooks/useQuizTimer.ts` (new), `src/app/components/quiz/QuizHeader.tsx` (modified), `src/app/pages/Quiz.tsx` (modified)
**Affected Routes**: `/courses/:courseId/lessons/:lessonId/quiz`
**Test Subject**: `quiz-lesson-1` (5-minute timed quiz, `lesson-1`)

---

## Executive Summary

E15-S01 adds a drift-free countdown timer to the quiz interface. The implementation is technically strong: all three AC-specified color transitions work correctly, accessibility semantics are solid, design tokens are used throughout, and responsive behavior is clean at all tested breakpoints. Two medium-priority issues were found — a semantic imprecision in screen reader announcements at sub-minute time, and a Zustand store time-sync behavior that produces a residual UX artifact when returning to a recently-expired quiz. No blockers.

---

## What Works Well

- **Correct timer semantics**: `role="timer"` with `aria-label="Time remaining"` follows the ARIA spec precisely. The timer is not in the tab order (`tabIndex: -1`), which is correct — timers are informational, not interactive.
- **All three color transitions confirmed via live browser**: default muted (7.42:1 contrast), warning amber (7.00:1), urgent red (4.85:1) — all pass WCAG AA in dark mode.
- **Font rendering**: `font-mono tabular-nums font-semibold` prevents the display from jittering as digits change width. Correct use of responsive classes (`text-sm sm:text-base`) gives 14px on mobile and 16px on desktop.
- **Design token discipline**: No hardcoded colors. `text-muted-foreground`, `text-warning`, `text-destructive` are used exclusively. No inline styles.
- **Drift-free timer logic**: `useQuizTimer` anchors to `Date.now()` + `visibilitychange` listener — correct approach for tab-switching accuracy.
- **300ms color transition**: Within the 250–350ms content-reveal range from the design principles. Respects the global `prefers-reduced-motion: reduce` rule in `index.css` (transition suppressed to 0.01ms).
- **No console errors** across the full session (0 errors, 1 Apple PWA meta-tag warning unrelated to this story).
- **Mobile layout**: Title + timer co-exist cleanly in the flex header row at 375px (252px title + 42px timer in 324px container, 30px gap). No text truncation or overflow.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

#### Finding 1: Screen reader announcement is imprecise below 60 seconds

**Location**: `src/app/components/quiz/QuizTimer.tsx:12-16`

**Evidence**: Live browser verification at ~14 seconds remaining showed:
```
liveRegionText: "Urgent: Time remaining: 0 minutes"
```
The `formatMinuteAnnouncement` function uses `Math.floor(totalSeconds / 60)`, which produces "0 minutes" for any value between 1–59 seconds. A screen reader user who cannot see the visual timer receives "Urgent: Time remaining: 0 minutes" when there are still 14–59 seconds left. This is the most critical time window for a learner — they need to know exactly how much time remains.

**Impact**: Screen reader users taking a timed quiz are deprived of actionable time information during the final minute. The urgent announcement correctly alerts them to a critical state but then provides a count of "0 minutes" which sounds like time has already expired.

**Suggestion**: Change the announcement to use seconds below 60 seconds:
```typescript
function formatMinuteAnnouncement(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `Time remaining: ${totalSeconds} seconds`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes'
  return `Time remaining: ${minutes} ${minuteLabel}`
}
```

---

#### Finding 2: Zustand store time-sync causes near-expired quiz on revisit after clock-shift or expiry

**Location**: `src/hooks/useQuizTimer.ts:71-83` (store sync), `src/app/pages/Quiz.tsx:211-213` (timerInitialSeconds derivation)

**Evidence**: During testing, after a quiz auto-submitted and the user navigated back to `/courses/:id/lessons/:id/quiz`, the quiz loaded directly into active state showing `00:05` (near-zero) instead of the start screen. The Zustand store had preserved `timeRemaining: ~0.08` (minutes) from the final sync, and `timerInitialSeconds` was computed as `Math.round(0.08 * 60) = 5` seconds.

This means a learner who:
1. Starts a quiz, doesn't finish, navigates away (store syncs remaining time)
2. Returns within the same Zustand session
3. Sees the quiz already running at whatever time was last synced — potentially near expiry

The localStorage `quiz-progress-*` key was the correct resume path, but after expiry those keys are not cleared, leaving the store in an inconsistent state.

**Impact**: A learner returning to retake a quiz after expiry could find themselves thrust into a near-zero-second ticking quiz instead of the start screen. This is confusing and could waste a retake attempt.

**Suggestion**: In `Quiz.tsx`, guard the `timerInitialSeconds` derivation: if `currentProgress.timeRemaining` rounds to 0, treat it as if no timer is set (fall back to the quiz's full `timeLimit`). Alternatively, clear `timeRemaining` from the store when `submitQuiz` is called.

---

### Nitpicks (Optional)

#### Nitpick 1: Live region is a sibling inside the header flex row

**Location**: `src/app/components/quiz/QuizTimer.tsx:65`

**Evidence**: DOM inspection confirmed the `<span className="sr-only" aria-live="polite">` is a flex sibling of `H1` and `DIV[role=timer]` inside the header row:
```
DIV.flex.items-center
  H1.text-lg
  DIV[role=timer].ml-auto
  SPAN.sr-only[aria-live=polite]   ← inside flex row
```
Because `sr-only` uses `position: absolute`, it is correctly removed from the flex layout and causes no visual issue. However, moving it outside the flex container (e.g., appended directly to the quiz card or body) is a common convention and may prevent theoretical issues with `position: absolute` interacting with `overflow: hidden` on a parent.

**Impact**: No current visual or screen reader issue — this is a defensive code quality observation only.

---

#### Nitpick 2: `formatTime` is exported from `useQuizTimer.ts`

**Location**: `src/hooks/useQuizTimer.ts:8`

`formatTime` is a pure display utility but lives in a hooks file. This conflates UI formatting concerns with timer logic. Not an issue today (only `QuizTimer.tsx` imports it), but worth separating if the file grows.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal) / ≥3:1 (large) | Pass | Default: 7.42:1, Warning: 7.00:1, Urgent: 4.85:1 — all pass in dark mode |
| Keyboard navigation | Pass | Timer is non-interactive (`tabIndex: -1`), correct for informational element |
| Focus indicators visible | Pass | Not applicable to timer itself; surrounding interactive elements (buttons, radios) have focus rings |
| Heading hierarchy | Pass | Single H1 ("JavaScript Fundamentals Quiz") — correct for quiz page |
| ARIA labels on icon buttons | Pass | Timer has `aria-label="Time remaining"`, progress bar has `aria-label="Quiz progress"` |
| Semantic HTML | Pass | `role="timer"` on div, `<span>` for live region, `<nav>` for quiz navigation |
| Screen reader live region | Pass (with caveat) | `aria-live="polite"` `aria-atomic="true"` on `sr-only` span. Per-minute and threshold announcements work correctly. Announcement content imprecise below 60s (see Finding 1) |
| `prefers-reduced-motion` | Pass | Global CSS rule in `index.css:306-314` suppresses `transition-colors duration-300` to 0.01ms |
| Timer not in tab order | Pass | `tabIndex: -1` — informational widgets should not be focusable |
| Form labels associated | Pass | Radio inputs correctly wrapped in labelled `<label>` elements |

---

## Responsive Design Verification

All tests run against the live application with a 5-minute (`timeLimit: 5`) quiz.

| Breakpoint | Status | Timer Font Size | Card Padding | Horizontal Overflow | Notes |
|------------|--------|----------------|--------------|---------------------|-------|
| Mobile (375px) | Pass | 14px (`text-sm`) | 16px (`p-4`) | None | Title + timer fit in header row (252px + 42px in 324px container) |
| Tablet (768px) | Pass | 16px (`sm:text-base`) | 32px (`sm:p-8`) | None | Responsive class breakpoint fires correctly |
| Desktop (1440px) | Pass | 16px | 32px | None | Card maxed at `max-w-2xl` (672px), centered |

The `text-sm sm:text-base` responsive classes on the timer are correct and working. At mobile the timer narrows to 42px width — still clearly legible as `MM:SS`.

---

## Detailed Findings

### Finding 1: Imprecise screen reader announcement below 60 seconds

- **Issue**: `formatMinuteAnnouncement` always rounds down to minutes. At 59 seconds remaining, announces "Time remaining: 0 minutes". At 14 seconds remaining (confirmed in browser), announces "Urgent: Time remaining: 0 minutes".
- **Location**: `src/app/components/quiz/QuizTimer.tsx:12-16`
- **Evidence**: Live browser evaluation at ~14 seconds remaining returned `liveRegionText: "Urgent: Time remaining: 0 minutes"`.
- **Impact**: Screen reader users lose precise time information during the most critical window of the quiz. A learner using VoiceOver or NVDA hears "0 minutes" and cannot determine if they have 5 or 55 seconds remaining.
- **Suggestion**: Add a seconds branch to `formatMinuteAnnouncement` for values under 60 seconds (see Medium Priority section above).

### Finding 2: Near-zero timer on quiz revisit after expiry

- **Issue**: `useQuizTimer` syncs `timeRemaining` in minutes to the Zustand store every 60 seconds and on tab-hidden. After expiry, the store retains the last synced value (~0 minutes). On revisit, `timerInitialSeconds = Math.round(nearZeroMinutes * 60)` produces a near-zero value, launching the quiz immediately with seconds remaining.
- **Location**: `src/hooks/useQuizTimer.ts:71-83`, `src/app/pages/Quiz.tsx:211-213`
- **Evidence**: After quiz auto-submission + navigation back to the quiz route, the quiz loaded directly into active state at `00:05` instead of showing the start/retake screen.
- **Impact**: A learner expecting the start screen finds themselves in a live quiz with 5 seconds remaining — creating confusion and wasting a retake attempt.
- **Suggestion**: After `submitQuiz()` succeeds, clear `timeRemaining` from `currentProgress` in the store. Alternatively, add a guard: `if (timerInitialSeconds < 10) treat as 0 (disabled)`.

---

## Recommendations

1. **Fix the sub-minute announcement text** (Finding 1, Medium): A single-line change to `formatMinuteAnnouncement` in `QuizTimer.tsx` would make the urgent state genuinely useful to screen reader users. This is a high-impact accessibility improvement for low effort.

2. **Guard the near-zero timer on revisit** (Finding 2, Medium): Clear `timeRemaining` from the store upon successful quiz submission, or add a minimum threshold guard (e.g., `< 30 seconds → treat as untimed`). The current behavior is confusing in the manual testing path.

3. **Consider seconds in per-minute announcements during the final minute**: Even if the main announcement text stays minute-based, a separate announcement like "Less than 1 minute remaining" when crossing the 60-second mark would be more actionable than the current "Time remaining: 0 minutes" wording.

4. **Move `formatTime` to a utils file if the hook grows**: Not urgent, but clean separation of display utilities from hook logic will help as the quiz feature expands.

---

*Report generated by design-review agent (Claude Sonnet 4.6) via Playwright MCP browser automation. All computed values verified against live application at `http://localhost:5173`.*
