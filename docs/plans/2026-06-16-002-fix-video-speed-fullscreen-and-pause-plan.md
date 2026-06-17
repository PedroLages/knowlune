---
title: "fix: Video speed controls hidden in fullscreen and video pauses on speed change"
type: fix
status: active
date: 2026-06-16
---

# fix: Video speed controls hidden in fullscreen and video pauses on speed change

## Overview

Two related bugs in the custom HTML5 `VideoPlayer` component:

1. **Speed dropdown invisible in fullscreen** — the playback speed `DropdownMenu` renders in a portaled element outside the fullscreen container, so it is not visible when the player is fullscreen.
2. **Video pauses when a speed option is selected** — clicking a speed radio item in the portaled dropdown triggers `togglePlayPause()` because the click event's DOM target does not match any guard clause in the controls overlay's `onClick` handler.

## Problem Frame

Users watching a video in fullscreen mode cannot access the playback speed controls because the dropdown menu is portaled to `document.body`, which is outside the fullscreen element's visible DOM subtree. Separately, even outside fullscreen, selecting a different speed causes the video to pause — the user must press play again. Both issues degrade the core video viewing experience.

## Requirements Trace

- **R1.** When the video player is in fullscreen mode, the playback speed dropdown must be visible and interactive.
- **R2.** Changing the playback speed (via click or keyboard shortcut) must not interrupt playback — the video continues playing at the new speed without requiring a manual play action.
- **R3.** Existing keyboard shortcuts (`<` / `>` for speed stepping) must continue to work correctly and not pause the video.

## Scope Boundaries

- This fix is scoped to the custom `VideoPlayer` component and the shared `DropdownMenu` UI primitive.
- The caption settings `Popover` (line 1407) has the same portal-in-fullscreen issue but is deferred here to keep the fix focused on the user-reported problem.
- Other portaled overlays in the player (e.g., mobile volume popover) are out of scope.
- YouTube embeds (`YouTubePlayer.tsx`) are not affected — they use a YouTube iframe with its own built-in controls.

### Deferred to Separate Tasks

- Caption settings popover visibility in fullscreen: future fix following the same portal-container pattern established here.

## Context & Research

### Relevant Code and Patterns

- [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx) — core custom video player (1527 lines). Speed dropdown at line 1283; controls overlay `onClick` at lines 1052–1062; `changePlaybackSpeed` at lines 445–449.
- [src/app/components/ui/dropdown-menu.tsx](src/app/components/ui/dropdown-menu.tsx) — shadcn/ui `DropdownMenu` primitives wrapping `@radix-ui/react-dropdown-menu`. `DropdownMenuContent` (line 25) hardcodes a `<DropdownMenuPrimitive.Portal>` wrapper with no `container` prop passthrough.
- [src/app/components/audiobook/SpeedControl.tsx](src/app/components/audiobook/SpeedControl.tsx) — analogous speed control using `Popover` (different portal behavior; not affected).
- [src/lib/fullscreen.ts](src/lib/fullscreen.ts) — safe fullscreen exit utility.

### Institutional Learnings

- [docs/plans/2026-05-24-001-fix-fullscreen-countdown-and-video-tooltip-plan.md](docs/plans/2026-05-24-001-fix-fullscreen-countdown-and-video-tooltip-plan.md) — prior fullscreen visibility fix for `AutoAdvanceCountdown` / `CompletionModal`, which rendered outside the fullscreen element. Same root cause (portaled content), different components.
- Commit `84015ec8` — `fix(lesson-player): exit fullscreen before showing completion UI and remove video title tooltip`. Used an exit-fullscreen-first approach for completion overlays, but the speed dropdown needs to remain usable *during* fullscreen, so portal-container targeting is the correct strategy here.
- Commit `de06871c` — `fix(audiobook): make speed popover options tappable with real buttons`. Audiobook speed popover had a different activation issue (tappable targets), not related to the video pause bug.
- [docs/implementation-artifacts/2-2-video-playback-controls-and-keyboard-shortcuts.md](docs/implementation-artifacts/2-2-video-playback-controls-and-keyboard-shortcuts.md) — original video speed implementation spec.

### External References

- [Radix UI Portal docs](https://www.radix-ui.com/primitives/docs/utilities/portal) — `container` prop for targeting a specific DOM node as the portal mount point.
- [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) — only the fullscreen element and its DOM descendants are visible; portaled content elsewhere in the document is hidden.
- HTML5 `playbackRate` property — setting `video.playbackRate` does not affect playback state; the pause is caused by the inadvertent `togglePlayPause()` call, not by the rate assignment itself.

## Key Technical Decisions

- **Portal `container` prop vs. exit-fullscreen-first**: The prior fullscreen fix (`84015ec8`) exited fullscreen before showing overlays. That approach does not apply here — users must be able to change speed *while staying* in fullscreen. Using Radix Portal's `container` prop to render the dropdown inside the fullscreen element is the correct solution.
- **Expose `container` via `DropdownMenuContent` vs. inline fix in `VideoPlayer`**: The clean separation is to add a `container` prop to the shared `DropdownMenuContent` component and pass the player container ref from `VideoPlayer`. This keeps the UI primitive reusable and avoids coupling `dropdown-menu.tsx` to video-player concerns.
- **Guard clause fix (Bug 2)**: Adding `target.closest('[role="menu"]')` to the controls overlay guard is the most reliable approach because: (a) it catches any Radix menu content regardless of item type, (b) it is DOM-based and does not depend on React state timing, (c) it also prevents the same bug from manifesting in any future controls that use menu-type overlays.

## Implementation Units

### Unit 1: Fix speed dropdown visibility in fullscreen

**Goal:** Make the playback speed `DropdownMenu` render inside the video player container so it remains visible when the container is the fullscreen element.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/ui/dropdown-menu.tsx`
- Modify: `src/app/components/figma/VideoPlayer.tsx`

**Approach:**
- Add an optional `container` prop to `DropdownMenuContent` (typed as `Element | DocumentFragment | null`, matching the Radix Portal `container` contract) and forward it to the underlying `DropdownMenuPrimitive.Portal`.
- In `VideoPlayer`, pass `containerRef.current` as the `container` prop on the speed `DropdownMenuContent`.
- When `containerRef.current` is `null` (e.g., before mount), the portal falls back to the default `document.body` behavior.
- **Overflow handling**: The container div uses `overflow-hidden` (line 947) which would clip the portaled dropdown outside fullscreen. Conditionally remove `overflow-hidden` when the speed menu is open and the player is not in fullscreen (`!isFullscreen && speedMenuOpen` → `overflow-visible`). In fullscreen mode, the browser handles overflow naturally so no change is needed.

**Patterns to follow:**
- `src/app/components/ui/dropdown-menu.tsx:31` — existing `Portal` wrapper on `DropdownMenuContent` (the integration point).
- `src/app/components/figma/VideoPlayer.tsx:1296` — existing `DropdownMenuContent side="top" align="end"` usage.

**Test scenarios:**
- Happy path (Manual): Open speed dropdown in fullscreen mode → dropdown is visible and interactive, all speed options are selectable.
- Happy path: Open speed dropdown outside fullscreen → dropdown renders inside the player container (not clipped), behavior is unchanged (no regression).
- Edge case (Manual): Toggle fullscreen while speed dropdown is open → dropdown remains visible when possible (portal stays inside the fullscreen container since `containerRef` is the fullscreen element). Verify across Chrome, Firefox, and Safari — each browser's fullscreen implementation may handle the transition differently.
- Edge case: `containerRef.current` is `null` (component unmounted) → portal falls back to `document.body`, dropdown still renders without crash.

**Verification:**
- Build passes with no TypeScript errors.
- Manual verification: enter fullscreen, click the speed button, confirm dropdown appears and works.

---

### Unit 2: Prevent video pause when selecting speed via click or keyboard shortcut

**Goal:** Ensure that clicking a speed option in the dropdown does not trigger `togglePlayPause()`, so playback continues uninterrupted at the new speed.

**Requirements:** R2, R3

**Dependencies:** None (can be done independently of Unit 1)

**Files:**
- Modify: `src/app/components/figma/VideoPlayer.tsx`
- Test: `src/app/components/figma/__tests__/VideoPlayer.test.tsx`

**Approach:**
- The root cause is in the controls overlay `onClick` handler (lines 1052–1062). When a user clicks a portaled `DropdownMenuRadioItem`, the React synthetic event bubbles to this handler. The existing guards (`target.closest('button')`, `target.closest('input')`, `target.closest('[data-controls]')`) do not match because:
  - `DropdownMenuRadioItem` is a `<div role="menuitemradio">`, not a `<button>`.
  - The portal content is outside the `[data-controls]` div in the DOM.
- Add `target.closest('[role="menu"]')` to the guard clause. This catches clicks on any dropdown/context menu content (Radix `DropdownMenuContent` sets `role="menu"` on its root element), preventing the spurious `togglePlayPause()`.
- This guard is DOM-based, independent of React state timing, and protects against the same class of bug for any future menu-type overlays.

**Patterns to follow:**
- `src/app/components/figma/VideoPlayer.tsx:1052-1062` — existing guard clause in controls overlay `onClick`.

**Test scenarios:**
- Happy path: Video is playing, click a speed option in the dropdown → speed changes, video continues playing (no pause).
- Happy path: Video is paused, click a speed option → speed changes, video remains paused (does not unexpectedly start playing).
- Happy path: Click buttons in the bottom controls bar (play/pause, skip, volume, fullscreen, etc.) → behavior unchanged, all buttons work normally.
- Edge case: Use keyboard shortcuts `>` / `<` to change speed while video is playing → speed changes, video continues playing.
- Edge case: Click the speed trigger button itself (open/close without selecting) → does not toggle play/pause.
- Integration: Verify that the AB-loop, captions, bookmark, theater, and PiP buttons still function after the guard change — none of these should be affected since they are rendered as `<button>` elements (caught by the existing `closest('button')` guard).

**Verification:**
- Existing `VideoPlayer.test.tsx` tests pass.
- New test cases for speed-change-while-playing added and pass.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `container` prop on Portal causes double-render or layout shift in fullscreen | Radix Portal with `container` is a stable API; test in Chrome/Firefox/Safari fullscreen |
| Adding `[role="menu"]` guard could prevent play/pause toggle on legitimate canvas clicks near menu edges | Menu content uses `role="menu"` only on the popup root — clicks on the canvas itself have no `role` ancestor and will still toggle correctly |
| Caption settings Popover (same pattern) left unfixed | Explicitly deferred; not user-reported and lower-priority |

## Sources & References

- User report: video speed options invisible in fullscreen; video pauses on speed change
- Prior related plan: [docs/plans/2026-05-24-001-fix-fullscreen-countdown-and-video-tooltip-plan.md](docs/plans/2026-05-24-001-fix-fullscreen-countdown-and-video-tooltip-plan.md)
- Prior related commit: `84015ec8` — fullscreen completion UI fix
- Related code: [src/app/components/figma/VideoPlayer.tsx](src/app/components/figma/VideoPlayer.tsx)
- Related code: [src/app/components/ui/dropdown-menu.tsx](src/app/components/ui/dropdown-menu.tsx)
- Radix UI Portal: https://www.radix-ui.com/primitives/docs/utilities/portal
