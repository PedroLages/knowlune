---
title: feat: Add visual countdown overlay to auto-advance
type: feat
status: active
date: 2026-05-23
deepened: 2026-05-23
---

# feat: Add visual countdown overlay to auto-advance

## Overview

Replace the text-only auto-advance countdown banner ("Next: Title in 5s") with a Netflix-style full-viewport overlay featuring a large circular progress ring that visually depletes as seconds tick down. The overlay dims the entire page, centers a large countdown ring with the remaining seconds displayed inside, and includes Cancel and Play Now buttons.

## Problem Frame

When a video lesson ends and auto-play is enabled, the current countdown is a subtle inline banner below the video title. Users who glance away from the screen can miss it entirely. A prominent visual overlay — with a large animated ring depleting in real time — makes the transition impossible to miss and matches the pattern users recognize from streaming platforms (Netflix, YouTube).

## Requirements Trace

- **R1.** After a video lesson ends and auto-play is enabled, show a full-viewport overlay with a dimmed backdrop and a centered countdown card
- **R2.** The overlay must include a circular progress ring that visually depletes as seconds tick down, with the remaining seconds displayed in the center
- **R3.** The overlay must include a "Cancel" button that dismisses the countdown and keeps the user on the current lesson
- **R4.** The overlay must include a "Play Now" button that immediately navigates to the next lesson
- **R5.** The overlay must render above the video in theater mode (z-index escalation)
- **R6.** Canceling via the store toggle (disabling auto-play mid-countdown) must dismiss the overlay (existing behavior, must be preserved)
- **R7.** The overlay must not trap focus or block screen reader access to the underlying page — it is a passive status indicator, not a modal
- **R8.** Pressing the Escape key must dismiss the overlay (call `onCancel`), matching the `VideoShortcutsOverlay` pattern and streaming platform conventions
- **R9.** When the course completion celebration modal fires, the countdown overlay must be suppressed — the celebration modal's "Continue" button already handles advancing to the next lesson
- **R10.** All animations must respect `prefers-reduced-motion` (use `motion-safe:` prefix on Tailwind animation classes)
- **R11.** The overlay layout must be responsive: buttons stack vertically on mobile (`flex-col`) and sit side-by-side on desktop (`sm:flex-row`)

## Scope Boundaries

- Replace only the visual presentation of the countdown — the completion flow and auto-advance logic in `useCompletionFlow.ts` are unchanged
- The 5-second countdown duration is preserved (not user-configurable)
- No changes to the `useLessonChromeStore.autoPlay` toggle or its localStorage persistence
- No changes to YouTube vs. local video completion paths

### Deferred to Separate Tasks

- Configurable countdown duration (e.g., 5s/10s/15s in settings): future iteration
- "Watch Credits" button (for lessons with end-credits timestamps): requires credit timestamp metadata not yet available

## Context & Research

### Relevant Code and Patterns

- [PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — SVG circular progress ring with `children` prop for custom center content, size presets up to xl (128px), `strokeLinecap="butt"` handling for small offsets, and `role="progressbar"` with aria attributes
- [VideoShortcutsOverlay.tsx](src/app/components/figma/VideoShortcutsOverlay.tsx) — existing video overlay using `absolute inset-0 z-50 bg-black/80 flex items-center justify-center`, Escape key handling, and `role="dialog"`
- [AutoAdvanceCountdown.tsx](src/app/components/figma/AutoAdvanceCountdown.tsx) — current text-only countdown component to be rewritten
- [UnifiedLessonPlayer.tsx:512-521](src/app/pages/UnifiedLessonPlayer.tsx#L512-L521) — renders the countdown; effect at lines 232-237 cancels countdown when autoPlay toggles off
- [useCompletionFlow.ts](src/app/hooks/useCompletionFlow.ts) — `handleAutoAdvance` (navigates with `state: { autoPlay: true }`), `handleCancelAutoAdvance` (hides countdown), `readAutoPlay` helper
- [QualityScoreRing.tsx](src/app/components/session/QualityScoreRing.tsx) — uses `motion` library (`motion.circle`) for smooth SVG stroke animation with cubic-bezier easing `[0.16, 1, 0.3, 1]`
- [theme.css](src/styles/theme.css) — theater mode fix: `html[data-theater-mode='true'] [data-slot='dialog-overlay'] { z-index: 60; transform: translateZ(0) }` — needed because GPU-composited video layers paint above CSS z-index

### Institutional Learnings

- Auto-advance countdown gating pattern documented in `docs/solutions/best-practices/auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md` — `readAutoPlay()` guards all three callbacks; the `useEffect` watcher in `UnifiedLessonPlayer.tsx` cancels in-flight countdown when autoPlay toggles off
- `pointer-events-none` / `pointer-events-auto` sandwich pattern documented in `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md` — used when an absolutely-positioned element overlaps interactive siblings
- Pomodoro wrong-callback bug in `docs/solutions/ui-bugs/pomodoro-start-break-button-wired-to-skip-2026-05-23.md` — reinforces using `useRef` for stable callback references in interval-based countdowns (already done in current `AutoAdvanceCountdown`)
- Project animation durations from `src/styles/animations.css`: micro 150ms, UI elements 250ms, modal entrances 300-350ms

### External References

- N/A — the codebase has strong local patterns for overlays, progress rings, and animation. No external research needed.

## Key Technical Decisions

- **Use `PathProgressRing` with `children` prop for custom center content**: Avoiding a new ProgressRing variant. The existing component already handles sizing, stroke math, a11y roles, and `strokeLinecap` edge cases.
- **Use a `fixed` overlay (not `absolute` within video container)**: The user chose the overlay style. A `fixed` overlay covers the full viewport including the sidebar and content below the video, matching the Netflix/YouTube "Up Next" pattern. It is more prominent and harder to miss than an absolute overlay constrained to the video container.
- **Use `z-50` as the base z-index**: Matches the existing `VideoShortcutsOverlay` and SoftBlockGate patterns. In theater mode, escalate to `z-[60]` with `transform: translateZ(0)` to paint above GPU-composited video layers.
- **Use `role="status"` + `aria-live="polite"` (not `role="dialog"`)**: The countdown is a passive visual indicator — the user should be able to interact with the page while it counts down. No focus trapping, no `aria-modal`.
  - **Accessibility tradeoff acknowledged**: The `role="status"` approach with a full-viewport `fixed inset-0` overlay creates keyboard accessibility tension. The `bg-black/50` backdrop visually blocks all page interaction, but without a focus trap (by design, per R7), keyboard-only users can Tab through invisible elements behind the overlay and never discover the Cancel or Play Now buttons.
  - **Mitigation — autoFocus on Cancel button**: When the overlay mounts, auto-focus the Cancel button (`ref={autoFocusRef}` / `autoFocus` attribute on the button element). This ensures keyboard-only users land on an actionable control immediately upon overlay appearance, directing them toward the two available actions (Cancel or Tab to Play Now). After that, Escape key dismissal provides a secondary escape hatch regardless of focus position. This is a pragmatic balance between the R7 constraint (no focus trap, no `aria-modal`) and the need to guide keyboard users to the overlay's action buttons.
- **Do not use the `motion` library**: The `PathProgressRing` already uses CSS `transition-[stroke-dashoffset] duration-500`. For a 5-second countdown, updating the `percentage` prop every second via `setInterval` naturally animates the ring via CSS transitions. The `motion` library would add complexity without proportional benefit for a 5-tick animation.
- **Add `data-slot="countdown-overlay"` attribute**: Allows the theater mode CSS in `theme.css` to target this overlay specifically, matching the existing `[data-slot='dialog-overlay']` pattern.
- **Add `strokeColor` prop to `PathProgressRing`**: The existing component uses semantic color logic (`stroke-success` at 100%, `stroke-brand` above 0%) designed for forward progress (0→100). A countdown depletes from 100→0, so the ring would flash green then switch to brand. Adding an optional `strokeColor` prop (defaults to undefined, preserving existing behavior) lets the countdown use a single consistent color (`stroke-brand`) throughout the countdown without affecting other consumers of `PathProgressRing`.
- **Suppress countdown when celebration modal fires**: When the current lesson completes the course, `handleVideoEnded` currently fires both `showCelebration()` and `setShowAutoAdvance(true)`. The celebration modal (`role="dialog"`, focus-trapping) would compete with the countdown overlay. The plan adds a guard: if `showCelebration()` returns true (modal will open), skip `setShowAutoAdvance(true)`. The celebration modal's "Continue" button already handles advancing to the next lesson.
- **Use exit transitions on all dismissal paths**: The backdrop uses `animate-in fade-in` on mount. On unmount (Cancel, Play Now, or zero-countdown), apply `animate-out fade-out duration-200` following the MiniPlayer's mount/unmount animation pattern. This prevents the overlay from popping out of existence abruptly.
- **Use `motion-safe:` prefix on animation classes**: `motion-safe:animate-in motion-safe:fade-in` ensures users with `prefers-reduced-motion: reduce` see instantaneous state transitions, matching the codebase's existing pattern in `animations.css`.
- **Handle Escape key for dismissal**: Pressing Escape calls `onCancel`, matching the `VideoShortcutsOverlay` pattern (which also supports `?` to toggle). Streaming platform conventions (Netflix, YouTube) universally support Escape to dismiss "Up Next" overlays.
- **Static mapping for `transitionDuration` prop to avoid Tailwind v4 JIT purging**: The `transitionDuration` prop on `PathProgressRing` must use a static lookup object rather than string concatenation. Tailwind v4's JIT engine scans source files for complete class strings at build time — runtime-constructed values (e.g., `` `duration-${ms}` ``) are invisible to the scanner and will be purged in production. Use a mapping such as `{ 500: 'duration-500', 1000: 'duration-1000' }` where both string literals appear verbatim in scanned source. The countdown passes `1000` (mapped to `duration-1000`) while the default remains `500` (mapped to `duration-500`).

## Open Questions

### Resolved During Planning

- **Fixed vs. absolute positioning?**: The user chose the overlay (Netflix-style) approach, so `fixed` positioning covering the full viewport.
- **Which ProgressRing variant to use?**: `PathProgressRing` — it has the `children` prop, size presets, and the most complete a11y support.
- **motion library or CSS transitions?**: CSS transitions — the 1-second tick interval is coarse enough that CSS transitions handle it smoothly, and `PathProgressRing` already uses `transition-[stroke-dashoffset] duration-500`.

### Deferred to Implementation

- Exact CSS class composition for the backdrop and card: depends on the specific design tokens chosen; implementer should follow existing `SoftBlockGate` and `VideoShortcutsOverlay` patterns
- Whether to add an "also playing next" thumbnail preview: nice-to-have that depends on whether course adapter provides thumbnail URLs for lessons

## Implementation Units

- [ ] **Unit 1: Rewrite AutoAdvanceCountdown as a full-viewport overlay**

**Goal:** Replace the inline banner with a fixed-position overlay showing a large countdown ring, next lesson title, Cancel and Play Now buttons.

**Requirements:** R1, R2, R3, R4, R5, R7, R8, R10, R11

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/AutoAdvanceCountdown.tsx`
- Modify: `src/app/components/figma/PathProgressRing.tsx` (add optional `strokeColor` prop)
- Test: `src/app/components/figma/__tests__/AutoAdvanceCountdown.test.tsx` (new)

**Approach:**
- Change from the current horizontal banner layout to a `fixed inset-0 z-50` overlay
- Backdrop: `bg-black/50` with `motion-safe:animate-in motion-safe:fade-in duration-200` (respects `prefers-reduced-motion` via `motion-safe:` prefix)
- Card: centered via `flex items-center justify-center`, `bg-card rounded-2xl shadow-lg p-8`
- Ring: `PathProgressRing` with `size="xl"` (128px, which defaults to 6px stroke), `strokeColor="stroke-brand"` (overrides the built-in semantic color logic — see Key Technical Decisions), and `children` rendering the remaining seconds as an `aria-live` region (e.g., `text-4xl font-bold tabular-nums`)
- Text: "Next up" label (muted via `text-muted-foreground`) + lesson title (semibold) below the ring
- Buttons container: `flex flex-col sm:flex-row gap-2` — stacks vertically on mobile, side-by-side on desktop
- Buttons: "Cancel" (outline variant) + "Play Now" (brand variant, with `Play` icon from lucide-react). Touch targets confirmed ≥44px (shadcn Button default `size` prop)
- Exit transitions: Use the MiniPlayer mount/unmount pattern — on mount, render and animate in; on dismissal (any path), apply `animate-out fade-out duration-200`, wait for transition, then unmount. The `onCancel` and `onAdvance` callbacks remain unchanged — the exit animation is internal to the component
- Escape key: Add `onKeyDown` handler on the overlay root: `e.key === 'Escape'` → `onCancel()`. This fires regardless of focus position since it's on the fixed overlay container
- **Backdrop click behavior — deliberate divergence from Netflix/YouTube pattern**: The backdrop (`bg-black/50` overlay area) intentionally does NOT dismiss the overlay on click. This differs from Netflix and YouTube "Up Next" overlays which dismiss on any click. Rationale: the countdown window is only 5 seconds — an accidental backdrop click (e.g., reaching for a drink, adjusting posture) would immediately cancel auto-advance, requiring the user to manually navigate. The dedicated Cancel button and Escape key provide sufficient, deliberate dismissal paths without the risk of accidental dismissal during the brief countdown window. This tradeoff is documented so the implementer does not treat it as an oversight.
- Initial screen reader announcement: On mount, render a visually-hidden span with `role="status"` and `aria-label="Next up: {nextLessonTitle}. Auto-playing in {seconds} seconds."` so screen readers get context before the countdown ticks begin
- Ring percentage: `(remaining / seconds) * 100` — drives the SVG stroke-dashoffset animation. Pass `transitionDuration="duration-1000"` to match the 1-second tick interval (added to `PathProgressRing` as an optional prop, defaulting to `duration-500`)
- Add `data-slot="countdown-overlay"` to the backdrop div for theater mode CSS targeting
- Keep the existing `data-testid="auto-advance-countdown"` on the root element
- Keep existing ref pattern: `onAdvanceRef` for stable callback reference during interval
- Props remain identical (`seconds`, `nextLessonTitle`, `onAdvance`, `onCancel`) — no parent changes needed

**Patterns to follow:**
- `VideoShortcutsOverlay.tsx` — overlay positioning, backdrop, and Escape key handling
- `PathProgressRing.tsx` — ring rendering with `children` prop
- `MiniPlayer.tsx` — mount/unmount animation state pattern (render→animate-in→animate-out→unmount)
- Current `AutoAdvanceCountdown.tsx` — interval logic and ref pattern

**Test scenarios:**
- Happy path: Overlay renders when countdown is active, shows correct remaining seconds, ring percentage is `(remaining/seconds)*100`
- Happy path: Countdown reaches zero → `onAdvance` is called exactly once
- Happy path: Clicking "Cancel" calls `onCancel`
- Happy path: Clicking "Play Now" calls `onAdvance` immediately (before countdown reaches zero)
- Happy path: Pressing Escape key calls `onCancel`
- Edge case: Interval is cleaned up on unmount (no stale `onAdvance` calls after Cancel)
- Edge case: Ring at `seconds` prop change resets remaining state (if component re-renders with new `seconds`)
- Edge case: `remaining=0` → `onAdvance` fires via effect (not interval)
- Edge case: Exit transition completes before unmount (no stuck DOM nodes)
- Edge case: Backdrop click does NOT dismiss overlay (only Cancel/Escape/PlayNow dismiss)
- Accessibility: `role="status"` and `aria-live="polite"` are present on overlay container
- Accessibility: Initial screen reader announcement contains lesson title and countdown duration
- Accessibility: Buttons have accessible labels and ≥44px touch targets
- Accessibility: Escape key dismissal works regardless of focus position
- Responsive: Buttons stack vertically at mobile widths, side-by-side at ≥640px
- Reduced motion: `prefers-reduced-motion: reduce` skips backdrop and ring animations (verify `motion-safe:` classes are present)

**Verification:**
- Overlay renders centered with backdrop dimming the page
- Ring depletes smoothly as seconds tick down (`duration-1000` CSS transition on stroke-dashoffset)
- Ring uses consistent `stroke-brand` color throughout (no green→brand flash)
- Exit fade-out animation plays on all dismissal paths
- All existing auto-advance behavior preserved (Cancel at any time, auto-navigate at zero)

- [ ] **Unit 2: Add theater mode z-index escalation for the countdown overlay**

**Goal:** Ensure the countdown overlay renders above GPU-composited video layers when theater mode is active.

**Requirements:** R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/styles/theme.css`

**Approach:**
- The overlay already uses `data-slot="countdown-overlay"` (added in Unit 1)
- Add a CSS rule in `theme.css` targeting `html[data-theater-mode='true'] [data-slot='countdown-overlay']` with `z-index: 60` and `transform: translateZ(0)`
- This mirrors the existing rule for `[data-slot='dialog-overlay']` at `theme.css:1306-1310`
- GPU compositor promotion via `transform: translateZ(0)` forces the overlay into its own compositing layer, solving the z-index stacking context issue with `<video>` elements in theater mode

**Patterns to follow:**
- `theme.css` lines 1306-1310 — existing `[data-slot='dialog-overlay']` theater mode rule

**Test scenarios:**
- Integration: In theater mode, countdown overlay paints above the full-height video (verify via Playwright E2E screenshot or visual assertion)

**Verification:**
- In theater mode, the countdown overlay is visible above the video (not obscured)
- In normal mode, the overlay renders correctly at z-50 (no regression)

- [ ] **Unit 3: Suppress countdown when celebration modal fires**

**Goal:** Prevent the countdown overlay from competing with the course completion celebration modal when both would otherwise render simultaneously.

**Requirements:** R9

**Dependencies:** None (independent of Unit 1 and Unit 2)

**Files:**
- Modify: `src/app/hooks/useCompletionFlow.ts`

**Approach:**
- **Refactor `showCelebration()` to return `boolean`**: The current implementation returns `void`. It must be changed to return `true` when the celebration modal opens (course completed) and `false` when it is skipped/not applicable (non-final lesson). This is a prerequisite for the guard logic below.
- In `handleVideoEnded`, `handleYouTubeAutoComplete`, and `handleManualStatusChange`: call `showCelebration()` first, capture its return value, and only call `setShowAutoAdvance(true)` if `showCelebration()` returned `false`
- The celebration modal already has a "Continue" button wired to `handleCelebrationContinue` which navigates to the next lesson with `state: { autoPlay: true }` — no duplicate countdown is needed
- This applies to all three auto-advance entry points (`handleVideoEnded`, `handleYouTubeAutoComplete`, and `handleManualStatusChange`)

**Patterns to follow:**
- Existing `showCelebration` behavior in `useCompletionFlow.ts` (lines 95-111)
- Existing `handleCelebrationContinue` in `useCompletionFlow.ts` (lines 180-188)

**Test scenarios:**
- Happy path: Completing a non-final lesson → countdown overlay shows (celebration did not fire)
- Integration: Completing the final lesson in a course → celebration modal shows, countdown overlay does NOT render
- Edge case: `setItemStatus` throws (persistence failure) → neither celebration nor countdown fires (existing bail-out behavior preserved)
- Edge case: YouTube auto-complete on final lesson → celebration fires, countdown suppressed (same guard applies to `handleYouTubeAutoComplete`)
- Edge case: Manual status change to "completed" on final lesson → celebration fires, countdown suppressed (same guard applies to `handleManualStatusChange`)

**Verification:**
- Course-level celebration and per-lesson countdown never render simultaneously
- Per-lesson countdown still fires for non-final lessons (no regression)

## System-Wide Impact

- **Interaction graph:** The countdown overlay renders as a sibling to the video container in `UnifiedLessonPlayer`. Unit 3 adds a guard in `useCompletionFlow` that prevents the countdown from rendering when `showCelebration()` fires. No other callbacks, middleware, or observers are affected.
- **Error propagation:** If `handleAutoAdvance` navigation fails (e.g., next lesson ID invalid), the overlay remains visible at `remaining=0`. The current behavior is unchanged — navigation failure is not handled. A future improvement could add error toast feedback, but this is out of scope.
- **State lifecycle risks:** The overlay uses `useState` + `useEffect` interval pattern. If the parent unmounts the overlay (by setting `showAutoAdvance=false`), the interval cleanup in the `useEffect` return prevents stale callbacks. The existing `useEffect` watcher in `UnifiedLessonPlayer.tsx:232-237` handles the `autoPlay` toggle-off → cancel case. The exit animation (Unit 1) adds a mount/unmount state machine following the `MiniPlayer` pattern — the component renders, transitions in, accepts dismissal, transitions out, then unmounts after the transition completes.
- **Cross-navigation during countdown:** If the user navigates away during the 5-second countdown (sidebar click, browser back, URL navigation, or any route change), the overlay unmounts with its parent component (the overlay is scoped to the lesson page lifecycle in `UnifiedLessonPlayer`). The existing `useEffect` cleanup (clearInterval on the countdown timer) handles timer disposal automatically — no additional cleanup is needed. `handleCancelAutoAdvance` is not called on route change, but this is safe because `showAutoAdvance` state is reset when the lesson page remounts. The overlay never persists across page navigations.
- **API surface parity:** Unit 1 adds an optional `strokeColor` prop and an optional `transitionDuration` prop to `PathProgressRing`. Both default to the existing behavior (`undefined` → semantic color logic, `duration-500` → existing transition). No existing consumers are affected.
- **Integration coverage:** The theater mode behavior should be verified in a real browser (Playwright), as jsdom cannot test GPU compositing behavior. The celebration-modal-and-countdown-overlay scenario (Unit 3) should be tested in Playwright since it involves real component rendering and state management across hooks.
- **Unchanged invariants:** `useCompletionFlow` hook API unchanged; `showAutoAdvance` boolean state unchanged; `readAutoPlay()` gating unchanged; the three callback paths (`handleVideoEnded`, `handleYouTubeAutoComplete`, `handleManualStatusChange`) still trigger auto-advance — with the added guard that celebration suppression takes priority over countdown rendering.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Theater mode video paints above overlay on some GPU/driver combos | Apply `transform: translateZ(0)` + `z-index: 60` matching the proven pattern already used for `CompletionModal` in theater mode |
| Overlay covers the QA Chat panel or Notes panel while user is mid-input | Acceptable — the countdown only lasts 5 seconds and was user-triggered (they watched a video). The Cancel button and Escape key provide immediate dismissal |
| `PathProgressRing` stroke transition at 500ms duration may not look smooth with 1-second ticks (the animation completes at 500ms, leaving the ring idle for 500ms before the next tick — producing a stutter rather than continuous motion) | Add optional `transitionDuration` prop to `PathProgressRing` (default `duration-500`), pass `duration-1000` from countdown to span the full interval between ticks |
| `PathProgressRing` semantic color logic (green at 100%, brand above 0%) is designed for forward progress, not countdown depletion | Add optional `strokeColor` prop to `PathProgressRing` (default undefined preserves existing behavior). Countdown passes `strokeColor="stroke-brand"` for a single consistent color throughout |
| Countdown overlay and celebration modal render simultaneously on course completion — celebration traps focus, making countdown buttons unreachable | Unit 3 adds a guard: skip `setShowAutoAdvance(true)` when `showCelebration()` fires (celebration's "Continue" button already advances to next lesson) |
| Backdrop `bg-black/50` may not provide sufficient dimming contrast in dark mode | Acceptable for initial implementation — the countdown is a 5-second transient state. If contrast insufficient, adjust to `bg-black/70` or use a theme-aware overlay in a follow-up |

## Sources & References

- Origin: User request (no requirements document)
- [AutoAdvanceCountdown.tsx](src/app/components/figma/AutoAdvanceCountdown.tsx) — current component
- [PathProgressRing.tsx](src/app/components/figma/PathProgressRing.tsx) — ring component to reuse
- [VideoShortcutsOverlay.tsx](src/app/components/figma/VideoShortcutsOverlay.tsx) — overlay pattern to follow
- [UnifiedLessonPlayer.tsx](src/app/pages/UnifiedLessonPlayer.tsx) — parent component
- [useCompletionFlow.ts](src/app/hooks/useCompletionFlow.ts) — auto-advance logic and celebration modal suppression (Unit 3)
- [MiniPlayer.tsx](src/app/components/course/MiniPlayer.tsx) — mount/unmount animation state pattern for exit transitions
- [theme.css](src/styles/theme.css) — theater mode z-index escalation pattern
- `docs/solutions/best-practices/auto-advance-autoplay-gate-session-dialog-removal-2026-05-04.md` — auto-advance gating pattern
- `docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md` — pointer-events sandwich
