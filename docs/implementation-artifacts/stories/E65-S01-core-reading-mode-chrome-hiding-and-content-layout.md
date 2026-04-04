---
story_id: E65-S01
story_name: "Core Reading Mode — Chrome Hiding and Content Layout"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 65.1: Core Reading Mode — Chrome Hiding and Content Layout

## Story

As a learner,
I want to enter a distraction-free reading mode on lesson pages,
so that I can focus on content without sidebar, header, or navigation distracting me.

## Acceptance Criteria

**Given** I am on a lesson page
**When** I press Cmd+Shift+R (or Ctrl+Shift+R on Windows/Linux)
**Then** the sidebar, header, and bottom navigation are hidden
**And** the lesson content is displayed in a centered column (max-width 75ch on desktop, 65ch on tablet, full-bleed on mobile)
**And** a minimal status bar appears at the top with back button, lesson title, and close button
**And** my scroll position is preserved from the normal view

**Given** I am in reading mode
**When** I press Escape, click the close button (X), or press Cmd+Shift+R again
**Then** the full UI is restored (sidebar, header, bottom nav)
**And** my scroll position is preserved from reading mode

**Given** I am on a lesson page
**When** I click the reading mode toggle button (BookOpen icon) in the lesson header
**Then** reading mode activates with the same behavior as the keyboard shortcut

**Given** I am in reading mode with reduced motion preference ON
**When** the mode transition occurs
**Then** the transition is instant (0ms) with no fade or slide animation

**Given** I am in reading mode with reduced motion preference OFF
**When** the mode transition occurs
**Then** the sidebar slides out and header fades over 200ms

**Given** I am on a non-lesson page (e.g., Settings, Reports)
**When** I press Cmd+Shift+R
**Then** a toast notification appears: "Reading mode is available on lesson pages"
**And** reading mode does not activate

**Given** I am a screen reader user
**When** reading mode activates
**Then** an aria-live region announces "Reading mode activated. Press Escape to exit."

## Tasks / Subtasks

- [ ] Task 1: Create `useReadingMode()` hook (AC: 1, 2, 6, 7)
  - [ ] 1.1 Create `src/hooks/useReadingMode.ts` following `useContentDensity` pattern
  - [ ] 1.2 Toggle `.reading-mode` CSS class on `document.documentElement`
  - [ ] 1.3 Store reading mode state in React state (session-level, NOT localStorage)
  - [ ] 1.4 Accept `isLessonPage: boolean` parameter — show toast and bail if false
  - [ ] 1.5 Expose `isReadingMode`, `toggleReadingMode`, `exitReadingMode`
  - [ ] 1.6 Save/restore `window.scrollY` on enter/exit

- [ ] Task 2: Register keyboard shortcut Cmd+Shift+R (AC: 1, 2, 6)
  - [ ] 2.1 Add `useEffect` keydown listener for `metaKey+shiftKey+r` / `ctrlKey+shiftKey+r`
  - [ ] 2.2 Call `event.preventDefault()` to suppress browser refresh
  - [ ] 2.3 On non-lesson pages, show toast: "Reading mode is available on lesson pages"

- [ ] Task 3: Extend `data-theater-hide` to header and BottomNav (AC: 1, 2)
  - [ ] 3.1 Add `data-theater-hide` attribute to the header `<header>` wrapper in `Layout.tsx`
  - [ ] 3.2 Add `data-theater-hide` attribute to `<BottomNav>` component wrapper
  - [ ] 3.3 Add CSS rule in `theme.css`: `html.reading-mode [data-theater-hide] { display: none !important; }`

- [ ] Task 4: Create `ReadingModeStatusBar` component (AC: 1, 2)
  - [ ] 4.1 Create `src/app/components/figma/ReadingModeStatusBar.tsx`
  - [ ] 4.2 Render: back button (ChevronLeft or ArrowLeft icon), lesson title (truncated), close button (X icon)
  - [ ] 4.3 Fixed to top, height 48px, design-token colors (`bg-card`, `text-foreground`, `border-border`)
  - [ ] 4.4 Only render when `isReadingMode === true`
  - [ ] 4.5 Close button calls `exitReadingMode()`

- [ ] Task 5: Apply centered content layout in reading mode (AC: 1)
  - [ ] 5.1 Add CSS: `html.reading-mode main { max-width: 75ch; margin: 0 auto; }` (desktop)
  - [ ] 5.2 Add media query for tablet: `max-width: 65ch`
  - [ ] 5.3 Add media query for mobile: `max-width: 100%; padding-inline: 1rem;`

- [ ] Task 6: Add toggle button to LessonPlayer (AC: 3)
  - [ ] 6.1 Import `BookOpen` from lucide-react
  - [ ] 6.2 Add ghost-variant `Button` with `BookOpen` icon to lesson header area
  - [ ] 6.3 Add `Tooltip` with text "Reading mode (Cmd+Shift+R)"
  - [ ] 6.4 Wire `onClick` to `toggleReadingMode()`

- [ ] Task 7: Implement reduced motion support (AC: 4, 5)
  - [ ] 7.1 Use existing `shouldReduceMotion()` from `@/lib/settings`
  - [ ] 7.2 When reduced motion is ON: CSS transitions are `0ms` (use `transition-duration: 0ms` override)
  - [ ] 7.3 When reduced motion is OFF: sidebar slides out (`transform: translateX(-100%)` over 200ms), header fades (`opacity: 0` over 200ms)
  - [ ] 7.4 Use `prefers-reduced-motion` CSS media query as fallback

- [ ] Task 8: Add aria-live announcement (AC: 7)
  - [ ] 8.1 Add `<div role="status" aria-live="polite">` to Layout or ReadingModeStatusBar
  - [ ] 8.2 On reading mode enter: set text to "Reading mode activated. Press Escape to exit."
  - [ ] 8.3 On reading mode exit: set text to "Reading mode deactivated."
  - [ ] 8.4 Clear text after 3 seconds to avoid stale announcements

## Design Guidance

**Layout approach:** CSS-class-driven on `<html>` element (same pattern as `useContentDensity` and theater mode). The `.reading-mode` class triggers `display: none` on `[data-theater-hide]` elements and applies centered column layout to the main content area.

**Component structure:**
- `useReadingMode()` hook — state management, keyboard shortcut, scroll preservation
- `ReadingModeStatusBar` — minimal top bar (back, title, close)
- CSS in `theme.css` — layout rules for `.reading-mode` class

**Design system usage:**
- Status bar: `bg-card border-b border-border` (not hardcoded colors)
- Buttons: `variant="ghost"` with `size="icon"` for close/back
- Toggle button: `variant="ghost"` with `BookOpen` icon and `Tooltip`
- All text: `text-foreground` / `text-muted-foreground`

**Responsive strategy:**
- Desktop: centered 75ch column, status bar at top
- Tablet: centered 65ch column
- Mobile: full-bleed with `padding-inline: 1rem`, status bar replaces header
- BottomNav hidden on all breakpoints via `data-theater-hide`

**Accessibility:**
- `aria-live="polite"` region for mode change announcements
- Status bar buttons: `aria-label="Exit reading mode"`, `aria-label="Go back"`
- Keyboard: Cmd+Shift+R toggle, Escape to exit
- All transitions respect `prefers-reduced-motion`

## Implementation Notes

**Existing patterns to follow:**
- `useContentDensity` hook at `src/hooks/useContentDensity.ts` — exact same pattern of toggling a CSS class on `<html>` and listening for `settingsUpdated` custom events
- `data-theater-hide` attribute already used on the sidebar in `Layout.tsx` (line 399) and breadcrumb in `LessonPlayer.tsx` (line 551) — extend to header and BottomNav
- Theater mode CSS in `theme.css` (line 563): `html[data-theater-mode='true'] [data-theater-hide] { display: none !important; }` — follow same pattern

**Key files to modify:**
- `src/hooks/useReadingMode.ts` — NEW
- `src/app/components/figma/ReadingModeStatusBar.tsx` — NEW
- `src/app/components/Layout.tsx` — add `data-theater-hide` to header and BottomNav wrappers
- `src/app/pages/LessonPlayer.tsx` — add toggle button, consume `useReadingMode()`
- `src/styles/theme.css` — add `.reading-mode` CSS rules

**Libraries:** No new dependencies. Uses existing lucide-react (BookOpen, X, ChevronLeft), sonner (toast), and shadcn/ui (Button, Tooltip).

**Scroll preservation:** Save `window.scrollY` before toggling, restore via `window.scrollTo(0, savedPosition)` in a `requestAnimationFrame` callback after the DOM updates.

**Mutual exclusivity with focus mode (E65-S03):** Reading mode state should be exported so E65-S03 can check and exit reading mode before activating focus mode. Design the hook API with this in mind (`exitReadingMode()` function).

**Toast usage:** Import `toast` from `sonner`. Non-lesson page shortcut press: `toast.info('Reading mode is available on lesson pages')`.

## Testing Notes

- E2E: Test reading mode toggle on LessonPlayer page, verify sidebar/header hidden
- E2E: Test keyboard shortcut (Cmd+Shift+R) enters and exits reading mode
- E2E: Test Escape key exits reading mode
- E2E: Test non-lesson page shows toast instead of activating
- E2E: Test scroll position preserved on enter/exit
- Unit: Test `useReadingMode` hook — toggle state, CSS class on `<html>`
- Accessibility: Verify aria-live announcement with screen reader or role="status" assertion

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **CSS transitions vs `display: none`**: `display: none` prevents CSS transitions from running because the element is immediately removed from layout. Use `opacity: 0; pointer-events: none; position: absolute; height: 0; width: 0` instead, and add `display: none` only inside `prefers-reduced-motion: reduce` for instant hiding.
- **`announce()` inside setState updater**: Side effects (like `announce()`) must not be called inside the `setIsReadingMode` updater function. Compute the next value first, then call both the setter and side effects sequentially in the event handler.
- **Duplicate `role="banner"`**: `<header>` already carries `role="banner"` implicitly. A fixed status bar is a `role="toolbar"`, not a second banner.
- **Scroll restoration race**: A single `requestAnimationFrame` after `setIsReadingMode(false)` may run before React has committed the DOM reflow. Use double `requestAnimationFrame` (nested) to ensure the layout has settled before calling `window.scrollTo`.
- **Hardcoded `useReadingMode(true)`**: Derive the `isLessonPage` flag from route params (`Boolean(courseId && lessonId)`) so it reflects actual route state rather than a compile-time constant.
