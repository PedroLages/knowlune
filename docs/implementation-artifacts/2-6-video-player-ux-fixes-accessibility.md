---
story_id: E02-S06
story_name: "Video Player UX Fixes & Accessibility"
status: done
started: 2026-02-21
completed: 2026-02-21
reviewed: true
review_started: 2026-02-21
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story 2.6: Video Player UX Fixes & Accessibility

## Story

As a learner,
I want a video player with proper touch targets, accessible controls, and reliable behavior on all devices,
So that I can use the player comfortably on mobile, tablet, and desktop with keyboard or touch.

## Acceptance Criteria

**AC1: Mobile touch targets and volume**
**Given** the user is on a mobile viewport (< 640px)
**When** the video player bottom controls are visible
**Then** all interactive buttons have minimum 44x44px touch targets
**And** the volume control is accessible via a popover triggered by tapping the mute/unmute button
**And** controls respond to touch events for auto-show/hide (not only mouse events)

**AC2: Keyboard focus and speed menu**
**Given** the video player container receives keyboard focus
**When** the user tabs to the player
**Then** a visible focus ring appears around the player container
**And** all keyboard shortcuts function correctly

**Given** the speed menu dropdown is open
**When** the user presses Tab
**Then** focus is trapped within the menu items (wraps from last to first)
**And** pressing Escape closes the menu and returns focus to the trigger button
**And** menu items have `role="menuitem"` with `aria-checked` on the active speed

**AC3: Video element attributes**
**Given** the `<video>` element renders
**When** the page loads
**Then** the element has `preload="metadata"`, `playsInline`, and optional `poster` attributes
**And** only metadata is preloaded (not the full video)

**AC4: Reduced motion**
**Given** the user has `prefers-reduced-motion` enabled
**When** the controls overlay transitions
**Then** transitions complete in ≤1ms (handled by existing global CSS rule)

**AC5: Single scrollbar and themed scrollbars**
**Given** the user is on the Lesson Player page
**When** the page renders
**Then** only one vertical scrollbar is visible for the main content area (no double scrollbar)
**And** the course sidebar has its own independent scroll
**And** all scrollbars use thin, theme-aware styling that matches light/dark mode

## Tasks / Subtasks

- [ ] Task 1: Touch targets — enlarge bottom-bar buttons to 44x44px (AC: 1)
  - [ ] 1.1 Change button sizing from `h-8 w-8` to `size-11`
  - [ ] 1.2 Change icons from `h-4 w-4` to `size-5`
  - [ ] 1.3 Remove duplicate play/pause from bottom bar
  - [ ] 1.4 Enlarge speed menu trigger button
- [ ] Task 2: Touch event handling (AC: 1)
  - [ ] 2.1 Add `onTouchStart` to controls overlay
  - [ ] 2.2 Memoize handler with `useCallback`
- [ ] Task 3: Mobile volume popover (AC: 1)
  - [ ] 3.1 Add Radix Popover for mobile volume slider
  - [ ] 3.2 Keep existing desktop volume slider as `hidden sm:flex`
- [ ] Task 4: Speed menu focus trap (AC: 2)
  - [ ] 4.1 Add `role="menu"` / `role="menuitem"` / `aria-checked`
  - [ ] 4.2 Implement keyboard navigation (Tab wrapping, Escape close)
  - [ ] 4.3 Auto-focus first item on open
- [ ] Task 5: Video element attributes (AC: 3)
  - [ ] 5.1 Add `poster` prop to VideoPlayerProps
  - [ ] 5.2 Add `preload="metadata"`, `playsInline`, `poster` to video element
- [ ] Task 6: Player container focus ring (AC: 2)
  - [ ] 6.1 Verify/add visible focus-visible outline on container
- [ ] Task 7: Fix double scrollbar in LessonPlayer (AC: 5)
  - [ ] 7.1 Add `min-h-0` to content flex child
  - [ ] 7.2 Verify single scrollbar behavior
- [ ] Task 8: WebKit scrollbar styling (AC: 5)
  - [ ] 8.1 Add `::-webkit-scrollbar` rules to index.css
  - [ ] 8.2 Add `--scrollbar-thumb-hover` variable if needed

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**Reviewed 2026-02-21** — Report: `docs/reviews/design/design-review-2026-02-21-E02-S06.md`

- **B1 (Blocker)**: `Button` needs `React.forwardRef` — `speedTriggerRef` always null
- **H1**: Slider thumbs have no accessible name — `aria-label` not threaded to `Thumb`
- **H2**: Focus ring uses `focus:` not `focus-visible:` — shows on mouse clicks
- **H3**: Duplicate Play button in tab order — center overlay needs `tabIndex={-1}`

## Code Review Feedback

**Reviewed 2026-02-21** — Report: `docs/reviews/code/code-review-2026-02-21-E02-S06.md`

- **B1 (Blocker)**: Focus ring `focus:` vs `focus-visible:` (same as design B2)
- **B2 (Blocker)**: Speed menu no click-outside-to-close handler
- **H1**: AutoAdvanceCountdown interval keeps ticking past zero
- **H2**: `poster` prop not wired in LessonPlayer
- **H3**: No AC4 (reduced motion) E2E test
- **H4**: ModuleAccordion stale `openModules` closure in useEffect
- 4 Medium issues (volume popover click-outside, Tailwind class consistency)
- 4 Nits

## Challenges and Lessons Learned

- **`focus:` vs `focus-visible:` matters.** Using `focus:` on interactive containers shows focus rings on every click. Always use `focus-visible:` for keyboard-only indicators. Both design and code reviews flagged this independently.
- **shadcn/ui Button needs forwardRef for ref forwarding.** The default shadcn `Button` is a plain function component. Speed menu focus-return on Escape failed silently because `speedTriggerRef` was always null. Wrapping with `React.forwardRef` fixed it. Check ref behavior when adding refs to library components.
- **Speed menus need click-outside handlers.** Opening a dropdown without a document-level click-outside listener is a common miss. Add `mousedown` listener on document when menu is open; clean up on close.
- **AutoAdvanceCountdown interval must clear at zero.** `setInterval` keeps firing after the countdown reaches 0, causing negative values and multiple `onAdvance` calls. Clear the interval when remaining hits zero, not just on unmount.
- **Test selectors break when Tailwind classes change.** Unit tests that query by CSS class (`.hover\\:scale-\\[1\\.02\\]`) are brittle — any refactor to arbitrary properties breaks them. Prefer `data-testid` or role-based queries where possible. When class selectors are necessary, update them alongside the component.
- **Tablet E2E tests have a pre-existing sidebar navigation issue.** All Tablet project failures in navigation/overview specs pre-date this story. The sidebar likely doesn't open at tablet width. Tracked as known debt.

## Implementation Plan

See [plan](../../.claude/plans/resilient-whistling-whale.md) for implementation approach.
