---
story_id: E65-S03
story_name: "Focus Mode — Overlay, Focus Trap, and Exit"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: true
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 65.3: Focus Mode — Overlay, Focus Trap, and Exit

## Story

As a learner,
I want interactive components like quizzes and flashcards to be spotlighted in focus mode,
so that I can concentrate on the activity without visual distractions.

## Acceptance Criteria

**Given** I am on a page with an interactive component (quiz or flashcard)
**When** I press Cmd+Shift+F
**Then** focus mode activates: a dimmed overlay covers the entire viewport and the active component is elevated above it
**And** the overlay uses backdrop-filter blur (4px) with 50% opacity in light mode / 65% in dark mode

**Given** focus mode is active
**When** I press Escape
**Then** focus mode deactivates and the full UI is restored
**And** keyboard focus returns to the element that triggered focus mode

**Given** focus mode is active
**When** I click the dimmed overlay area
**Then** focus mode deactivates (unless a quiz is in progress — see below)

**Given** a quiz is in progress during focus mode
**When** I click the overlay or press Escape
**Then** a confirmation dialog appears: "Exit focus mode? Your quiz progress will be preserved."
**And** I can choose to exit or stay

**Given** focus mode is active
**When** I press Tab
**Then** keyboard focus cycles only within the focused component (focus trap)
**And** elements outside the focused component have the `inert` attribute applied

**Given** I am a screen reader user
**When** focus mode activates
**Then** an aria-live region announces "Focus mode activated. [Component type] in progress. Press Escape to exit."

**Given** focus mode is active with reduced motion ON
**When** the mode transitions
**Then** overlay appears/disappears instantly (0ms, no blur animation)

**Given** focus mode is active with reduced motion OFF
**When** the mode transitions
**Then** overlay fades in/out over 200ms

**Given** I am on a page with no interactive component
**When** I press Cmd+Shift+F
**Then** a toast appears: "No interactive component to focus"

**Given** I am in reading mode
**When** focus mode is triggered (via shortcut or auto-activation)
**Then** reading mode exits first, then focus mode activates
**And** the two modes are mutually exclusive

## Tasks / Subtasks

- [x] Task 1: Create `useFocusMode()` hook (AC: 1, 2, 5, 9, 10)
  - [x] 1.1 Create `src/hooks/useFocusMode.ts`
  - [x] 1.2 Manage state: `isFocusMode`, `focusTargetId`, `componentType` (quiz/flashcard)
  - [x] 1.3 Expose: `activateFocusMode(targetId, type)`, `deactivateFocusMode()`, `isFocusMode`
  - [x] 1.4 On activate: check for reading mode (import `exitReadingMode` from E65-S01), exit it first
  - [x] 1.5 On activate: store `document.activeElement` as return-focus target
  - [x] 1.6 On deactivate: restore focus to the stored element
  - [x] 1.7 Apply `inert` attribute to all siblings of the focused component's container

- [x] Task 2: Register keyboard shortcut Cmd+Shift+F (AC: 1, 9)
  - [x] 2.1 Add `useEffect` keydown listener for `metaKey+shiftKey+f` / `ctrlKey+shiftKey+f`
  - [x] 2.2 Call `event.preventDefault()`
  - [x] 2.3 Find nearest `[data-focus-target]` element on the page
  - [x] 2.4 If no target found: `toast.info('No interactive component to focus')`
  - [x] 2.5 If target found: `activateFocusMode(targetId, type)`

- [x] Task 3: Create `FocusOverlay` component (AC: 1, 3, 7, 8)
  - [x] 3.1 Create `src/app/components/figma/FocusOverlay.tsx`
  - [x] 3.2 Render via React portal to `document.body`
  - [x] 3.3 Overlay: `fixed inset-0`, `backdrop-filter: blur(4px)`, z-index z-40
  - [x] 3.4 Light mode: `bg-black/50`; dark mode: `bg-black/65`
  - [x] 3.5 Transition: 200ms opacity fade (0ms if reduced motion)
  - [x] 3.6 Click handler on overlay: if quiz in progress, show confirmation dialog; otherwise deactivate
  - [x] 3.7 Close button (X) in top-right corner above overlay

- [x] Task 4: Implement focus trap (AC: 5)
  - [x] 4.1 When focus mode activates, apply `inert` attribute to all direct children of `<body>` except the portal and focused component
  - [x] 4.2 Remove `inert` on deactivate
  - [x] 4.3 Follow Radix UI focus-trap pattern used by Dialog/Sheet components
  - [x] 4.4 Ensure Tab cycles within the focused component only

- [x] Task 5: Implement quiz-in-progress confirmation (AC: 4)
  - [x] 5.1 Use `AlertDialog` from shadcn/ui for confirmation
  - [x] 5.2 Title: "Exit focus mode?"
  - [x] 5.3 Description: "Your quiz progress will be preserved."
  - [x] 5.4 Actions: "Stay" (cancel) and "Exit" (confirm deactivate)
  - [x] 5.5 Check quiz state via `data-focus-active="quiz"` attribute or callback prop

- [x] Task 6: Add `data-focus-target` attributes to interactive components (AC: 1, 9)
  - [x] 6.1 Add `data-focus-target="quiz"` to Quiz component root in `src/app/pages/Quiz.tsx`
  - [x] 6.2 Add `data-focus-target="flashcard"` to Flashcards component root in `src/app/pages/Flashcards.tsx`
  - [x] 6.3 Add `data-focus-target="interleaved-review"` to InterleavedReview component root

- [x] Task 7: Implement aria-live announcement (AC: 6)
  - [x] 7.1 On focus mode activate: announce "Focus mode activated. [Quiz/Flashcard review] in progress. Press Escape to exit."
  - [x] 7.2 On focus mode deactivate: announce "Focus mode deactivated."
  - [x] 7.3 Use `role="status"` `aria-live="polite"` region (can reuse pattern from E65-S01)

- [x] Task 8: Implement Escape key exit with quiz guard (AC: 2, 4)
  - [x] 8.1 Listen for Escape key in `useFocusMode`
  - [x] 8.2 If no quiz in progress: deactivate immediately
  - [x] 8.3 If quiz in progress: show confirmation dialog instead
  - [x] 8.4 On confirmation: deactivate and restore focus

- [x] Task 9: Mobile focus mode (UX-DR6)
  - [x] 9.1 On mobile: focused component fills viewport (no overlay needed)
  - [x] 9.2 Apply `position: fixed; inset: 0; z-index: 50` to the focused component
  - [x] 9.3 Add close button at top of the full-screen view
  - [x] 9.4 Detect mobile via `useIsMobile()` hook

## Design Guidance

**Layout approach:** Portal-based overlay rendered to `document.body`. The focused component is elevated above the overlay via z-index. On mobile, the focused component fills the viewport directly (no overlay).

**Component structure:**
- `useFocusMode()` hook — state, keyboard shortcut, inert management, focus restoration
- `FocusOverlay` — portal overlay with blur and click-to-dismiss
- Quiz/Flashcard pages get `data-focus-target` attributes

**Design system usage:**
- Overlay: `bg-black/50` (light) / `bg-black/65` (dark) with `backdrop-blur-sm` (4px)
- Close button: `variant="ghost"` `size="icon"` with X icon, positioned top-right
- Confirmation dialog: `AlertDialog` from shadcn/ui with `AlertDialogAction`/`AlertDialogCancel`
- All colors via design tokens — no hardcoded values

**Responsive strategy:**
- Desktop/Tablet: overlay + elevated component
- Mobile: full-screen component, no overlay (UX-DR6)

**Accessibility:**
- `inert` attribute on non-focused content (native browser support for focus trap + screen reader hiding)
- `aria-live="polite"` announcement on mode change
- Focus restored to trigger element on exit
- Escape key: exits or shows confirmation
- Overlay click: exits or shows confirmation

## Implementation Notes

**Dependency on E65-S01:** Must import `exitReadingMode` from `useReadingMode()` to enforce mutual exclusivity. If reading mode is active when focus mode triggers, reading mode exits first.

**Existing patterns to follow:**
- Radix UI Dialog/Sheet focus trap — same `inert` attribute approach used internally
- `AlertDialog` at `src/app/components/ui/alert-dialog.tsx` — for quiz exit confirmation
- `shouldReduceMotion()` from `src/lib/settings.ts` — transition timing
- Portal pattern: `createPortal(overlay, document.body)` from React DOM
- `useIsMobile()` from `src/app/hooks/useMediaQuery.ts` — mobile detection

**Key files to create:**
- `src/hooks/useFocusMode.ts` — NEW
- `src/app/components/figma/FocusOverlay.tsx` — NEW

**Key files to modify:**
- `src/app/pages/Quiz.tsx` — add `data-focus-target="quiz"` attribute
- `src/app/pages/Flashcards.tsx` — add `data-focus-target="flashcard"` attribute
- `src/app/pages/InterleavedReview.tsx` — add `data-focus-target="interleaved-review"` attribute
- `src/styles/theme.css` — add focus mode CSS (overlay transitions, mobile full-screen)

**Libraries:** No new dependencies. Uses existing React `createPortal`, shadcn/ui `AlertDialog`, lucide-react (X icon).

**`inert` attribute strategy:** Apply `inert` to all direct children of `<body>` except the portal container. This is more robust than trying to traverse the component tree. Remove `inert` on deactivate. The `inert` attribute natively hides content from screen readers and prevents focus — no additional aria-hidden needed.

**Focus restoration:** Store `document.activeElement` before activating. On deactivate, call `savedElement.focus()`. If the element is no longer in the DOM, fall back to the main content area.

**Custom events for E65-S04:** The hook should also listen for `focus-request` and `focus-release` custom events (dispatched by quiz/flashcard components in E65-S04). Design the event listener hooks now but the actual event dispatching will be added in E65-S04.

## Testing Notes

- E2E: Test Cmd+Shift+F activates focus mode on a quiz page
- E2E: Test overlay appears with blur backdrop
- E2E: Test Escape key exits focus mode
- E2E: Test overlay click exits focus mode (non-quiz context)
- E2E: Test quiz-in-progress confirmation dialog appears
- E2E: Test focus trap — Tab cycles only within focused component
- E2E: Test keyboard focus returns to trigger element on exit
- E2E: Test toast on page with no interactive component
- E2E: Test mutual exclusivity with reading mode
- E2E: Test mobile: component goes full-screen
- Unit: Test `useFocusMode` hook — state transitions, inert management
- Accessibility: Verify `inert` applied to non-focused content, aria-live announcements

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Reading mode mutual exclusivity via custom events**: Passing `exitReadingMode` as a prop to `useFocusMode` creates a coupling that breaks when the hook is called far from the component that owns reading mode state. The cleaner pattern is to dispatch a `window.dispatchEvent(new CustomEvent('exit-reading-mode'))` from within the focus mode hook and listen for it inside `useReadingMode`. This decouples the two hooks without requiring a shared store.

**Quiz-in-progress detection must be dynamic**: A static `data-focus-active="quiz"` attribute always triggers the exit confirmation dialog, even before the user has answered anything. The correct heuristic is `Object.keys(answers).length > 0` — only guard exit when the user has actual progress to lose.

**Overlay exit animation requires separate mount state**: Directly returning `null` when `isFocusMode` is false prevents the exit animation from playing. The fix is to track a separate `isMounted` state that stays `true` until after the 200ms `animate-out` completes, then unmounts. A `shouldReduceMotion` guard skips the timeout entirely for accessibility.
