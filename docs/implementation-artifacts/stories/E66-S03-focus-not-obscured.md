---
story_id: E66-S03
story_name: "Focus Not Obscured"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 66.3: Focus Not Obscured (WCAG 2.4.11)

## Story

As a keyboard user,
I want focused elements to never be hidden behind sticky or floating UI,
so that I can always see where my keyboard focus is.

## Acceptance Criteria

**Given** I am navigating with keyboard on mobile
**When** focus moves to an element near the bottom of the viewport
**Then** the element scrolls into view above the fixed bottom navigation bar
**And** the focused element is fully visible (not partially hidden)

**Given** I am in reading mode with the floating toolbar visible
**When** focus moves to a content element behind the toolbar
**Then** the content scrolls so the focused element is visible above the toolbar

**Given** a toast notification is displayed
**When** keyboard focus is on an element behind the toast
**Then** the toast does not fully obscure the focused element
**And** the toast auto-dismisses or can be dismissed to reveal the focused element

**Given** the Onboarding Overlay is displayed
**When** keyboard focus attempts to move behind the overlay
**Then** focus is trapped within the overlay (not allowed behind it)
**And** the overlay has proper focus management

**Given** the Import Progress Overlay is displayed
**When** keyboard focus attempts to move behind the overlay
**Then** focus is trapped within the overlay

**Given** I add `scroll-padding-bottom` CSS to account for fixed bottom navigation
**When** the browser auto-scrolls for focus (via `scrollIntoView`)
**Then** it accounts for the bottom nav height (64px + safe area)

**Given** I am using the application with any combination of floating elements
**When** I tab through all interactive elements on a page
**Then** no focused element is ever fully obscured by author-created content

## Tasks / Subtasks

- [ ] Task 1: Add scroll padding for BottomNav on mobile (AC: 1, 6)
  - [ ] 1.1 Open `src/styles/index.css` or `src/styles/tailwind.css`
  - [ ] 1.2 Add CSS rule: at mobile breakpoint (`@media (max-width: 1023px)`), set `scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom))` on `main` or scroll container
  - [ ] 1.3 Verify BottomNav height in `src/app/components/navigation/BottomNav.tsx` — confirm 64px or measure actual height
  - [ ] 1.4 Test: Tab to last element on a long page on mobile viewport — element should not be hidden behind BottomNav

- [ ] Task 2: Add scroll padding for reading mode status bar (AC: 2)
  - [ ] 2.1 Add CSS rule: `html.reading-mode { scroll-padding-top: 48px }` (status bar height)
  - [ ] 2.2 Note: Reading mode is from E65 — if not yet implemented, add the CSS rule preemptively with a comment referencing E65-S01
  - [ ] 2.3 Add `scroll-padding-bottom` for reading mode floating toolbar (estimated 56px)

- [ ] Task 3: Audit toast positioning (AC: 3)
  - [ ] 3.1 Check Sonner toast configuration — find where `<Toaster>` is rendered (likely in `App.tsx` or `Layout.tsx`)
  - [ ] 3.2 Verify toasts are positioned `top-right` or `top-center` (not bottom, which conflicts with BottomNav)
  - [ ] 3.3 If toasts can appear at bottom, add `margin-bottom` to clear BottomNav
  - [ ] 3.4 Verify toasts auto-dismiss (default Sonner behavior) and have a close button
  - [ ] 3.5 Ensure toast container does not have `pointer-events: none` that would prevent interaction

- [ ] Task 4: Audit OnboardingOverlay focus trapping (AC: 4)
  - [ ] 4.1 Open `src/app/components/onboarding/OnboardingOverlay.tsx`
  - [ ] 4.2 Verify focus trap is implemented — should use Dialog/Sheet pattern or `inert` attribute on background
  - [ ] 4.3 If no focus trap, add one using Radix `FocusTrap` or manual `inert` attribute on content behind overlay
  - [ ] 4.4 Verify overlay announces itself to screen readers (role="dialog", aria-modal="true")
  - [ ] 4.5 Test: when overlay is open, Tab should cycle only within overlay elements

- [ ] Task 5: Audit ImportProgressOverlay focus trapping (AC: 5)
  - [ ] 5.1 Open `src/app/components/figma/ImportProgressOverlay.tsx`
  - [ ] 5.2 Same checks as Task 4 — verify focus trap, inert background, aria attributes
  - [ ] 5.3 If overlay is dismissible, ensure Escape key works
  - [ ] 5.4 If overlay is non-dismissible (progress must complete), ensure focus stays within it

- [ ] Task 6: E2E focus obscuring test (AC: 7)
  - [ ] 6.1 Create `tests/audit/focus-not-obscured.spec.ts`
  - [ ] 6.2 For each major page, tab through all interactive elements
  - [ ] 6.3 After each Tab press, check if the focused element's bounding box overlaps with any fixed/sticky element's bounding box
  - [ ] 6.4 Report any overlaps as violations
  - [ ] 6.5 Test on mobile viewport (375x667) where BottomNav is visible

## Design Guidance

- **BottomNav height**: 64px + safe area inset — use `env(safe-area-inset-bottom)` for notched devices
- **Scroll padding**: CSS `scroll-padding-*` properties tell the browser to account for fixed elements when scrolling to bring focused elements into view
- **Focus trap pattern**: Use `inert` attribute on background content (modern browsers) or Radix `FocusTrap` for overlays
- **Toast placement**: Sonner's default `position="top-right"` is safest for avoiding focus obscuring

## Implementation Notes

### Key files to modify:
1. `src/styles/index.css` — scroll-padding rules
2. `src/app/components/onboarding/OnboardingOverlay.tsx` — focus trap audit
3. `src/app/components/figma/ImportProgressOverlay.tsx` — focus trap audit
4. `src/app/App.tsx` or wherever `<Toaster>` is rendered — toast position config

### Floating/fixed elements in Knowlune that could obscure focus:
- **BottomNav** (`src/app/components/navigation/BottomNav.tsx`) — fixed bottom, mobile only
- **Toasts** (Sonner) — floating, auto-dismiss
- **OnboardingOverlay** — full-screen overlay
- **ImportProgressOverlay** — modal overlay
- **Reading mode toolbar** (E65, not yet implemented) — floating bottom
- **Reading mode status bar** (E65, not yet implemented) — fixed top

### `scroll-padding` browser support:
Supported in all modern browsers (Chrome 69+, Firefox 68+, Safari 14.1+, Edge 79+). Safe to use without fallback.

### The `inert` attribute:
Supported in all modern browsers (Chrome 102+, Firefox 112+, Safari 15.5+). Prevents focus and interaction on background content.

```html
<!-- When overlay is open, background content is inert -->
<main inert={overlayOpen}>...</main>
<div role="dialog" aria-modal="true">Overlay content</div>
```

### Do NOT:
- Use `tabindex="-1"` on every background element — use `inert` instead
- Remove toasts entirely to avoid obscuring — just position them properly
- Break existing overlay dismiss behavior

## Testing Notes

- Focus obscuring is subtle — automated testing with bounding box overlap detection is essential
- Test both with and without BottomNav visible (desktop vs mobile viewports)
- OnboardingOverlay may only appear on first visit — may need to clear localStorage to trigger
- ImportProgressOverlay appears during bulk import — trigger via the import dialog flow

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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
