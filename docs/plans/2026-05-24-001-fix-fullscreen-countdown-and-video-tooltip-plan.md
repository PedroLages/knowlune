---
title: fix: Auto-advance countdown invisible during fullscreen and unwanted video title tooltip
type: fix
status: active
date: 2026-05-24
---

# fix: Auto-advance countdown invisible during fullscreen and unwanted video title tooltip

## Overview

Two small fixes for the lesson player page (`courses/:courseId/lessons/:lessonId`):

1. **Fullscreen countdown invisible**: When a video ends in browser fullscreen mode, the `AutoAdvanceCountdown` overlay renders in the DOM but is invisible because it lives outside the fullscreen element's subtree. Exit fullscreen before showing completion UI.

2. **Unwanted video title tooltip**: The `<video>` element carries a native `title` attribute that produces an OS-level tooltip on hover — visible even when custom controls are hidden and especially annoying in fullscreen. Remove it since `aria-label` already serves accessibility.

## Problem Frame

**Issue 1**: `VideoPlayer` uses the Browser Fullscreen API (`containerRef.current.requestFullscreen()`) to enter fullscreen. In fullscreen mode, the browser renders only the fullscreen element and its descendants. `AutoAdvanceCountdown` renders as a `fixed inset-0 z-50` overlay in `UnifiedLessonPlayer` — outside the fullscreen element's DOM subtree — so it's invisible. The same applies to `CompletionModal` (celebration dialog).

**Issue 2**: The `<video>` element at `src/app/components/figma/VideoPlayer.tsx:972` has `title={title}`. Browsers render the native `title` attribute as a tooltip on hover. When custom controls auto-hide (after a few seconds of inactivity), hovering over the video shows a tooltip with the lesson title — an unintentional UI that's particularly distracting in fullscreen. The element already has `aria-label={title || 'Video player'}` for screen readers, making the `title` attribute redundant for accessibility.

## Requirements Trace

- R1. Auto-advance countdown overlay must be visible when a video ends in fullscreen mode
- R2. Celebration modal must be visible when a course completes in fullscreen mode
- R3. Hovering over the video element must not show a native browser title tooltip
- R4. Screen reader accessibility for the video player must be preserved

## Scope Boundaries

- Changing countdown duration or behavior: out of scope
- Adding new fullscreen UI features: out of scope
- Modifying YouTube iframe fullscreen behavior: out of scope (handled inherently by `document.exitFullscreen()`)

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useCompletionFlow.ts` — orchestrates completion celebration + auto-advance; three paths trigger `setShowAutoAdvance(true)`: `handleVideoEnded` (line 133), `handleYouTubeAutoComplete` (line 151), `handleManualStatusChange` (line 175)
- `src/app/components/figma/AutoAdvanceCountdown.tsx` — fixed overlay with mount/exit animation (200ms opacity+scale transition); renders outside any fullscreen element
- `src/app/components/figma/VideoPlayer.tsx:369-391` — `toggleFullscreen()` and `fullscreenchange` listener that keeps `isFullscreen` state in sync
- `src/app/components/figma/VideoPlayer.tsx:969-1007` — `<video>` element with both `title={title}` (line 972) and `aria-label={title || 'Video player'}` (line 966)
- `src/app/pages/UnifiedLessonPlayer.tsx:512-519` — renders `AutoAdvanceCountdown` conditionally

### Institutional Learnings

- `docs/solutions/developer-experience/auto-advance-visual-countdown-overlay-implementation-lessons-2026-05-23.md` — documents the overlay's phase state machine, exit animation, and theater mode z-index handling
- `docs/solutions/best-practices/auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md` — auto-advance gating pattern (autoPlay preference, celebration guard)

## Key Technical Decisions

- **Exit fullscreen in `useCompletionFlow`, not in `VideoPlayer`**: The completion flow hook is the single place where the decision to show UI is made — it covers all three code paths (video ended, YouTube auto-complete, manual status change). Exiting fullscreen in `VideoPlayer.handleEnded` would miss the other two paths.
- **Guard with `document.fullscreenElement` check**: `document.exitFullscreen()` alone would throw if called when not in fullscreen in some browsers. Checking `document.fullscreenElement` first makes it a safe no-op.
- **Remove `title` attribute, keep `aria-label`**: `aria-label` on the container `<div>` already provides the accessible name. The native `title` attribute adds no accessibility value and only produces the unwanted tooltip.

## Implementation Units

- [ ] **Unit 1: Exit fullscreen before showing completion UI**

**Goal:** Ensure `AutoAdvanceCountdown` and `CompletionModal` are visible when triggered during fullscreen video playback.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/hooks/useCompletionFlow.ts`

**Approach:**
- Add `if (document.fullscreenElement) document.exitFullscreen().catch(() => {})` at the start of `handleVideoEnded` (after the early-return guard, before the `setItemStatus` call)
- Add the same line at the start of `handleYouTubeAutoComplete`
- Add the same line inside the `status === 'completed'` branch of `handleManualStatusChange`, before `showCelebration()`
- `document.exitFullscreen()` exits fullscreen for any element (VideoPlayer container, YouTube iframe, or PDF viewer). The `fullscreenchange` event fires and `VideoPlayer`'s existing listener updates `isFullscreen` state accordingly.
- The `.catch(() => {})` suppresses unhandled promise rejections in dev/test environments when fullscreen exit fails (e.g., fullscreen initiated by a different frame).
- The `AutoAdvanceCountdown` overlay renders instantly after a double-RAF delay (~32ms), so it appears during or immediately after the fullscreen exit transition. The exit animation (200ms opacity+scale) is only used when dismissing the overlay, not during mount.

**Patterns to follow:**
- `src/app/components/figma/VideoPlayer.tsx:377-378` — existing `document.exitFullscreen()` call pattern

**Test scenarios:**
- Happy path: Video ends while in fullscreen → fullscreen exits → countdown overlay appears and is visible
- Happy path: YouTube video reaches >90% while in fullscreen → fullscreen exits → countdown overlay appears
- Happy path: User manually marks lesson complete while in fullscreen → fullscreen exits → countdown overlay appears
- Edge case: Video ends while NOT in fullscreen → `document.fullscreenElement` is null → `exitFullscreen()` is not called → countdown appears normally (no regression)
- Edge case: Course completion while in fullscreen → fullscreen exits → celebration modal appears (not just countdown)

**Verification:**
- Open a course lesson, enter fullscreen, let video play to end → countdown overlay is visible
- Existing tests in `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx` continue to pass (`document.exitFullscreen()` is a no-op in jsdom when `fullscreenElement` is null)

---

- [ ] **Unit 2: Remove native title attribute from video element**

**Goal:** Eliminate the unwanted browser tooltip that appears when hovering over the video.

**Requirements:** R3, R4

**Dependencies:** None (independent of Unit 1)

**Files:**
- Modify: `src/app/components/figma/VideoPlayer.tsx`

**Approach:**
- Remove `title={title}` from the `<video>` element (line 972)
- Keep `aria-label={title || 'Video player'}` on the container `<div>` (line 966) — this preserves screen reader accessibility
- No other changes needed — the `title` prop is only used on the `<video>` element

**Patterns to follow:**
- `src/app/components/figma/VideoPlayer.tsx:966` — existing `aria-label` pattern on the container

**Test scenarios:**
- Happy path: Hover over video → no native browser tooltip appears (manual verification)
- Edge case: Screen reader still announces the video as "[lesson title]" or "Video player" via `aria-label`
- Edge case: Video with empty/undefined title → `aria-label` falls back to "Video player" — no regression

**Verification:**
- Hover over the video in both normal and fullscreen modes → no browser title tooltip
- Screen reader check: the video region is announced with the lesson title

## System-Wide Impact

- **Interaction graph:** The fullscreen exit fires `fullscreenchange` on `document`, which `VideoPlayer` and `usePdfViewerState` already listen to. No new listeners needed.
- **Error propagation:** `document.exitFullscreen()` returns a Promise. We fire-and-forget with `.catch(() => {})` — the countdown overlay appears after fullscreen exits regardless. If fullscreen exit fails (e.g., fullscreen initiated by a different frame), the rejection is silently caught and the countdown still renders (behind the fullscreen element, which is no worse than current behavior).
- **Unchanged invariants:** All existing countdown behavior (5-second timer, cancel/advance buttons, Escape key, backdrop behavior) remains identical. Only the pre-condition (fullscreen must be exited) changes.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `document.exitFullscreen()` returns a rejected promise in some edge cases (e.g., fullscreen was initiated by a different frame) | The rejection is unhandled but harmless — the countdown still renders; it just might be behind the fullscreen element. This is strictly better than the current behavior where it's always invisible. |
| Removing `title` from `<video>` could affect automated tests that use the title attribute as a selector | Check for `[title=...]` selectors in test files during implementation |

## Sources & References

- Related plan: `docs/plans/2026-05-23-005-feat-auto-advance-visual-countdown-overlay-plan.md`
- Lessons learned: `docs/solutions/developer-experience/auto-advance-visual-countdown-overlay-implementation-lessons-2026-05-23.md`
- Related code: `src/app/hooks/useCompletionFlow.ts`, `src/app/components/figma/VideoPlayer.tsx`, `src/app/components/figma/AutoAdvanceCountdown.tsx`
- Related PR: #579 (auto-advance countdown overlay rewrite)
