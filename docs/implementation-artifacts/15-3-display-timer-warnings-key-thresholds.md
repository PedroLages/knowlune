---
story_id: E15-S03
story_name: "Display Timer Warnings at Key Thresholds"
status: in-progress
started: 2026-03-22
completed:
reviewed: in-progress
review_started: 2026-03-22
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 15.3: Display Timer Warnings at Key Thresholds

## Story

As a learner,
I want to receive warnings when time is running low,
So that I can manage my pacing and avoid running out of time unexpectedly.

## Acceptance Criteria

**Given** a timed quiz is in progress
**When** the timer reaches 25% of original time remaining (75% elapsed) (e.g., 3:45 of 15:00)
**Then** a subtle toast notification appears: "3 minutes 45 seconds remaining"
**And** the toast auto-dismisses after 3 seconds
**And** the warning does NOT disrupt my quiz-taking flow

**When** the timer reaches 10% of original time remaining (e.g., 1:30 of 15:00)
**Then** a more prominent toast appears: "Only 1 minute 30 seconds remaining!"
**And** the toast auto-dismisses after 5 seconds

**When** the timer reaches 1 minute remaining
**Then** a persistent warning appears: "1 minute remaining"
**And** this warning remains visible until time expires

**Given** I am in untimed mode
**When** taking the quiz
**Then** no timer warnings are displayed (all warning logic is skipped)

**Given** I am using a screen reader
**When** each warning threshold is reached
**Then** the warning is announced via ARIA live region (`aria-live="polite"` for 25% remaining, `aria-live="assertive"` for 10% and 1 min)
**And** the announcement does NOT interrupt my current question reading

**Given** I have configured timer accommodations
**When** warnings are triggered
**Then** they are based on the adjusted time, not the original time
**And** 25% of 22:30 (extended time) = 5:37, not based on original 15:00

## Tasks / Subtasks

- [ ] Task 1: Add `onWarning` callback to `useQuizTimer` hook (AC: warnings at thresholds)
  - [ ] 1.1 Add `warningsFiredRef` to track fired thresholds
  - [ ] 1.2 Add threshold checks in timer interval (25%, 10%, 1min)
  - [ ] 1.3 Guard against untimed mode (skip all warning logic)
- [ ] Task 2: Create `TimerWarnings.tsx` component (AC: toast + ARIA)
  - [ ] 2.1 Toast notifications via Sonner (3s, 5s, persistent)
  - [ ] 2.2 ARIA live regions (polite for 25%, assertive for 10%/1min)
  - [ ] 2.3 Screen reader-only announcements
- [ ] Task 3: Integrate warnings in Quiz page (AC: all thresholds)
  - [ ] 3.1 Wire `onWarning` callback to `TimerWarnings` component
  - [ ] 3.2 Pass adjusted time for accommodation-aware thresholds
- [ ] Task 4: E2E tests for timer warnings (AC: all thresholds + untimed)
  - [ ] 4.1 25% threshold toast appears
  - [ ] 4.2 10% threshold toast appears
  - [ ] 4.3 1 minute persistent warning
  - [ ] 4.4 No warnings in untimed mode
  - [ ] 4.5 Accommodation-adjusted thresholds

## Design Guidance

### Design Direction: Non-Disruptive Progressive Urgency

Three-tier toast system with escalating visual weight — the learner feels the shift without being yanked out of focus.

### Existing Context

`QuizTimer.tsx` already handles color transitions (`text-muted-foreground` → `text-warning` → `text-destructive`) and basic ARIA announcements at minute boundaries. E15-S03 adds **toast notifications** and **enhanced ARIA regions** on top.

### Toast Notification Hierarchy (Sonner)

| Threshold | Method | Duration | Tone |
|-----------|--------|----------|------|
| 25% remaining | `toast.info()` | 3000ms | `"{MM:SS} remaining"` |
| 10% remaining | `toast.warning()` | 5000ms | `"Only {MM:SS} remaining!"` |
| 1 minute | `toast.warning()` | `Infinity` | `"{MM:SS} remaining"` (persistent) |

No custom toast styling needed — Sonner's built-in `info` and `warning` variants align with design tokens.

### ARIA Live Region Strategy

Two `sr-only` regions in `TimerWarnings.tsx`:
- `aria-live="polite"` + `role="status"` for 25% threshold (non-interrupting)
- `aria-live="assertive"` for 10% and 1-minute (interrupting)
- Both use `aria-atomic="true"` for full message re-reads

### Component Architecture

`TimerWarnings.tsx` is a **renderless component** (only `sr-only` ARIA regions visible). It receives `onWarning` events from the hook, fires Sonner toasts, and updates ARIA regions. Clean separation: hook detects thresholds → component presents them.

### Callback Pattern (Not useState)

`useQuizTimer` gets `onWarning?: (level: '25%' | '10%' | '1min', remainingSeconds: number) => void` with `warningsFiredRef` to prevent re-firing. Avoids re-render cascade through all timer consumers.

### Threshold Calculation

Uses `initialSeconds` (already accommodation-adjusted from E15-S02), not raw `quiz.timeLimit`. Untimed mode (`initialSeconds <= 0`) skips all warning logic — hook returns early.

### Accessibility Checklist

- `aria-live="polite"` for 25% (non-interrupting), `aria-live="assertive"` for 10%/1min
- `aria-atomic="true"` on both regions
- `role="status"` on polite region
- Persistent toast has close button (`closeButton: true`)
- Toast dismissable via keyboard (Sonner handles natively)

## Implementation Plan

See [plan](plans/e15-s03-timer-warnings.md) for implementation approach.

## Implementation Notes

- **Callback pattern over useState**: `onWarning` callback avoids re-render cascade through all timer consumers. `warningsFiredRef` prevents re-firing thresholds.
- **Renderless component**: `TimerWarnings.tsx` has no visible DOM — only `sr-only` ARIA regions. Toast rendering delegated to Sonner's global `<Toaster />`.
- **Dual ARIA strategy**: `aria-live="polite"` for 25% (non-interrupting) and `aria-live="assertive"` for 10%/1min (interrupting) with `aria-atomic="true"`.
- **No new dependencies**: Leveraged existing Sonner installation for toasts.

## Testing Notes

- **Date.now shifting pattern**: Reused from E15-S01 — `saveRealDateNow` → `shiftDateNow` → `triggerVisibilityChange` to simulate time passage without real waits.
- **Flexible regex for time assertions**: Exact time in toasts varies by ~1-3s due to real time elapsed during test setup. Use `/00:\d+ remaining/` not `/01:00 remaining/`.
- **Justified waitForTimeout**: 3 intentional hard waits for absence/persistence verification — can't assert "toast never appeared" without waiting.
- **9 E2E tests**: 6 ACs covered across timed, untimed, ARIA, and accommodation scenarios.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

Reviewed 2026-03-22. 2 HIGH, 3 MEDIUM, 2 NITS.
- **H1**: Persistent 1-minute toast overlaps mobile bottom nav (~40px at 375px)
- **H2**: Duplicate ARIA announcements at 25% threshold (QuizTimer + TimerWarnings)
- **M1**: 1-minute toast copy regresses urgency arc
- **M2**: Stale polite ARIA region after escalation
- **M3**: No prefers-reduced-motion handling for Sonner animations
Full report: docs/reviews/design/design-review-2026-03-22-e15-s03.md

## Code Review Feedback

Reviewed 2026-03-22. 1 BLOCKER, 3 HIGH, 3 MEDIUM, 2 NITS.
- **BLOCKER**: Short quiz batched state update — all 3 thresholds fire in same tick, React batches, only '1min' survives
- **H1**: Persistent toast not dismissed on quiz end (duration: Infinity lingers)
- **H2**: Tab-return zero-remaining skip (remaining > 0 guard skips all warnings)
- **H3**: Redundant prevLevelRef guard (fragile on Suspense remount)
Full report: docs/reviews/code/code-review-2026-03-22-e15-s03.md

## Web Design Guidelines Review

Reviewed 2026-03-22. PASS with 2 LOW findings.
- **L1**: Assertive live region missing role="alert"
- **L2**: Persistent toast not programmatically dismissed on quiz end
Full report: docs/reviews/code/web-design-guidelines-2026-03-22-e15-s03.md

## Challenges and Lessons Learned

- **E2E test flakiness from exact time assertions**: The 1-minute warning test initially used `/01:00 remaining/` which failed because ~1-3 seconds of real time elapse during test setup (navigation, button clicks). Fixed by using flexible regex `/00:\d+ remaining/`. Lesson: when Date.now shifting, always account for real elapsed time in assertions.
- **Callback vs state for cross-component communication**: `onWarning` callback was the right choice over a shared state approach — it keeps the timer hook decoupled from the presentation layer and avoids re-render cascades in components that only need `timeRemaining`.
- **Sonner toast selectors**: `[data-sonner-toast]` is the reliable selector for Sonner toasts in E2E tests. The `.filter({ hasText: ... })` pattern works well for distinguishing between threshold-specific toasts.
- **Renderless component pattern**: `TimerWarnings` has zero visible DOM footprint — only sr-only ARIA regions. This clean separation (hook detects → component presents) made testing straightforward.
