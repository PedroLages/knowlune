## Exploratory QA Report: E111-S03 — Sleep Timer End of Chapter

**Date:** 2026-04-12
**Routes tested:** 2 (`/library`, `/library/:bookId/read`)
**Health score:** 95/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 100 | 30% | 30.0 |
| Edge Cases | 85 | 15% | 12.75 |
| Console | 95 | 15% | 14.25 |
| UX | 90 | 15% | 13.5 |
| Links | 100 | 10% | 10.0 |
| Performance | 95 | 10% | 9.5 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **95/100** |

### Top Issues

1. Sleep timer popover option buttons briefly detach from DOM when the popover is reopened while a timer is active — the E2E spec already works around this with `force: true` and an explicit listbox-visible wait, signalling a real but narrow timing window where user clicks can miss their target.
2. EOC `chapterend` listener is silently skipped if `audioRef.current` is null at the moment `setTimer` is called — badge shows "EOC" but the chapter-end fade never fires.
3. `<li role="option">` wrapping a `<button>` is a non-standard ARIA composition that may produce duplicate activation announcements for screen reader users.

### Bugs Found

#### BUG-001: Popover option buttons detach from DOM during rapid re-open while timer active
**Severity:** Medium
**Category:** UX
**Route:** `/library/:bookId/read`
**AC:** AC-2 (popover re-open after EOC activation)

**Steps to Reproduce:**
1. Navigate to an audiobook reader page
2. Open the sleep timer popover (Moon button) and select "30 minutes"
3. Immediately reopen the popover
4. Click "End of chapter" within the first ~300ms of the popover opening

**Expected:** Option click registers and switches the timer to EOC mode
**Actual:** The option button detaches from the DOM mid-click ("element was detached from the DOM" Playwright error), causing the click to be lost. The timer stays on its previous selection.

**Root cause:** When a timer is active, `currentTime` updates (~4Hz) cause `AudiobookRenderer` to re-render, propagating a new `chapterProgressPercent` prop to `SleepTimer`. The Radix UI Popover content re-renders on these prop changes, briefly unmounting and remounting the option buttons during the render cycle.

**Evidence:** Consistent failure in exploratory Playwright tests for "EOC → 15min transition" and "30min → EOC transition" without `force: true`. The official spec test (`EOC can be cancelled by selecting Off`) already documents this: "The popover re-renders as chapter progress updates, so use getByText for stability" and uses `click({ force: true })`.

**Suggestion:** Memoize the `SleepTimer` component with `React.memo` to prevent re-renders when only `chapterProgressPercent` changes (it is not used to render the option list). Alternatively, stabilize by passing `chapterProgressPercent` only when the popover is open.

---

#### BUG-002: EOC chapterend listener not registered when audioRef.current is null at setTimer call
**Severity:** Low
**Category:** Functional
**Route:** `/library/:bookId/read`
**AC:** AC-1

**Steps to Reproduce:**
1. Navigate to audiobook reader before the `<audio>` element is fully initialized (e.g. in a very slow load scenario)
2. Click the Moon button and select "End of chapter" before `audioRef.current` is set
3. Observe: badge shows "EOC" but chapter end never triggers fade-out

**Expected:** Either the timer is not activated until audio is ready, or a deferred registration is attempted when `audioRef.current` becomes non-null
**Actual:** `useSleepTimer.ts` lines 109–115 guard with `if (audio) { ... }` — if `audio` is null, `setActiveOption('end-of-chapter')` has already been called (line 87) so the badge appears, but `eocCleanupRef.current` is never set and no listener is registered. The "EOC" mode is stuck until the user manually selects "Off".

**Evidence:** Code inspection at `src/app/hooks/useSleepTimer.ts:109-115`. In practice `audioRef.current` is available when the player renders, so this is a theoretical edge case at present.

---

#### BUG-003: ARIA — li[role="option"] wrapping button creates non-standard interactive pattern
**Severity:** Low
**Category:** UX
**Route:** `/library/:bookId/read`
**AC:** AC-6 (Accessibility)

**Steps to Reproduce:**
1. Use a screen reader (e.g. VoiceOver / NVDA) to open the sleep timer popover
2. Navigate to any timer option in the list

**Expected:** Screen reader announces "X minutes, option, N of M" once, activated by Enter/Space
**Actual:** Each option has dual semantics: `<li role="option" aria-selected>` wrapping a `<button>`. Screen readers may announce both roles (e.g. "button, End of chapter, option, 6 of 7") or require two activations (Space for button, Enter for listbox selection). This may also confuse screen reader users about how to activate options.

**Evidence:** `src/app/components/audiobook/SleepTimer.tsx:70` — `<li key={...} role="option" aria-selected={isActive}><button ...>`. Standard pattern for a custom listbox is `<li role="option">` as a non-interactive element with click handlers, not nested inside a `<button>`.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | EOC mode fades out and pauses at chapter boundary | Pass | `fadeOutAndPause` called via `chapterend` event; 11/11 unit tests verify fade + pause + localStorage flag |
| 2 | Chapter progress bar visible in popover when EOC active | Pass | `data-testid="chapter-progress-bar"` visible; `role="progressbar"` with `aria-label="Current chapter progress"` confirmed |
| 3 | EOC works for single-file M4B (chapterend event) | Pass | Both M4B (chapter boundary detection) and multi-file (auto-advance) dispatch `chapterend`; EOC handler uses `e.preventDefault()` to block auto-advance |
| 4 | Countdown timer badge shows remaining time (regression) | Pass | `30m` badge confirmed via `getByTestId('sleep-timer-button')` containing text |
| 5 | Progress bar NOT shown for countdown mode | Pass | `getByTestId('chapter-progress-bar')` not visible when 30m active; `chapterProgressPercent` returns null when `activeOption !== 'end-of-chapter'` |
| 6 | Post-sleep toast appears on next app open | Pass | `consumeSleepTimerEndedFlag()` called on mount; toast appears and flag is consumed (removed from localStorage); no repeat toast on second visit |
| 7 | ARIA label updates when EOC active | Pass | `aria-label="Sleep timer: EOC"` when active, reverts to `"Sleep timer"` after Off |
| 8 | Keyboard navigation through popover | Pass | `Enter` on trigger opens popover; `listbox` role visible; all options reachable; `Escape` closes |

Note: ACs 7 and 8 correspond to the story's AC-6 (Accessibility); mapped here for granularity.

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | No errors during normal EOC workflow (verified by dedicated console-health exploratory test) |
| Warnings | 2 | `apple-mobile-web-app-capable` deprecation (pre-existing, fires per navigation); Radix UI `aria-label` deprecation on PopoverContent (internal, pre-existing) |
| Info | 0 | No debug logs present |

### What Works Well

1. The race condition fix for EOC — listening to `chapterend` (cancelable custom event) instead of `ended` (which races with auto-advance) — is well-implemented and well-documented in comments. The `e.preventDefault()` call correctly blocks chapter auto-advance.
2. The `consumeSleepTimerEndedFlag` function correctly reads-and-removes the localStorage flag atomically on mount, preventing duplicate toasts across sessions.
3. Chapter progress bar correctly computes elapsed/duration for both single-file M4B (gap between chapter start times) and multi-file formats, with proper `Math.min(100, Math.max(0, ...))` clamping.
4. `badgeText` logic is correct across all modes: `null` when Off, `"EOC"` for end-of-chapter, `"Xm"` (ceiling of remaining minutes) for countdown — all three states pass E2E verification.

---
Health: 95/100 | Bugs: 3 | Blockers: 0 | High: 0 | Medium: 1 | Low: 2 | ACs: 6/6 verified
