---
story_id: E30-S02
story_name: "Add aria-label to Icon-Only Buttons"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, typecheck, format, unit-tests, e2e-tests, design-review, code-review, test-coverage-review]
burn_in_validated: false
---

# Story 30.2: Add aria-label to Icon-Only Buttons

## Story

As a screen reader user,
I want all icon-only buttons to have descriptive labels,
So that I understand what each button does without seeing the icon.

## Acceptance Criteria

**Given** each of the 11 icon-only buttons identified in the audit
**When** a screen reader announces the button
**Then** it reads a descriptive label (e.g., "Toggle sidebar", "Notifications", "Search")
**And** the label uses `aria-label` attribute (not `title`)

**Given** social link icons on Authors and AuthorProfile pages
**When** a screen reader announces the link
**Then** it reads the platform name and author (e.g., "Twitter — John Doe")

## Tasks / Subtasks

- [ ] Task 1: Audit and catalog all 11 icon-only buttons (AC: 1)
  - [ ] 1.1 Search codebase for `<button>` and `<Button>` elements containing only an icon child (no text)
  - [ ] 1.2 Cross-reference with audit findings H11 and H19
  - [ ] 1.3 Document each button's file, line, and intended label
- [ ] Task 2: Add aria-labels to header icon buttons (AC: 1)
  - [ ] 2.1 Sidebar toggle button — `aria-label="Toggle sidebar"`
  - [ ] 2.2 Notification bell button — `aria-label="Notifications"`
  - [ ] 2.3 Search icon button (if separate from input) — `aria-label="Search"`
  - [ ] 2.4 Any other header icon buttons (user menu, settings gear, etc.)
- [ ] Task 3: Add aria-labels to sidebar icon buttons (AC: 1)
  - [ ] 3.1 Collapse/expand toggle — `aria-label="Collapse sidebar"` / `aria-label="Expand sidebar"` (dynamic based on state)
- [ ] Task 4: Add aria-labels to social link icons (AC: 2)
  - [ ] 4.1 Locate social links in `Authors.tsx` — add `aria-label="{Platform} — {Author Name}"`
  - [ ] 4.2 Locate social links in `AuthorProfile.tsx` — add `aria-label="{Platform} — {Author Name}"`
  - [ ] 4.3 Verify all social platforms covered (Twitter/X, LinkedIn, GitHub, website, etc.)
- [ ] Task 5: Add aria-labels to remaining icon-only buttons
  - [ ] 5.1 Any icon buttons in course cards, settings, or other pages identified in Task 1

## Implementation Notes

- **WCAG Reference:** WCAG 4.1.2 (Name, Role, Value) — all interactive elements must have an accessible name
- **Audit Findings:** H11 (2-agent consensus), H19
- **Pattern:** Use `aria-label` directly on the element, not `title` attribute (title is not reliably announced by all screen readers)
- **Dynamic labels:** For toggle buttons (sidebar collapse), use a dynamic aria-label that reflects current state:
  ```tsx
  <button aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
    <ChevronLeft />
  </button>
  ```
- **Social links pattern:** Interpolate author name for context:
  ```tsx
  <a href={url} aria-label={`${platform} — ${authorName}`}>
    <TwitterIcon />
  </a>
  ```
- **Do NOT use:** `aria-labelledby` pointing to hidden text (unnecessary complexity for this case), or `title` alone

## Testing Notes

- **Screen reader testing:** Use VoiceOver (macOS) to verify each button announces its label correctly
  - Enable VoiceOver: Cmd+F5
  - Navigate with Tab key through interactive elements
  - Verify each icon-only button announces its descriptive label
- **axe-core audit:** Run `npx axe` or browser extension to verify zero "buttons must have discernible text" violations
- **E2E assertions:**
  ```typescript
  // Verify aria-label exists on icon-only buttons
  await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  ```
- **Regression:** Verify sighted users see no visual changes (aria-label is invisible)
- **Social links:** Test with multiple authors to verify dynamic label interpolation works

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

- **Most buttons already labelled**: Header search, notification bell, user menu, sidebar toggle, theme toggle already had aria-labels from prior work
- **Social links were the gap**: Author/AuthorProfile social links had platform names as visible text but lacked author-name context for screen readers
- **aria-hidden on ExternalLink**: Added aria-hidden="true" to decorative ExternalLink icon in AuthorProfile
