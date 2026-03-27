---
story_id: E30-S04
story_name: "Add aria-expanded to Module Toggles and Collapsibles"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 30.4: Add aria-expanded to Module Toggles and Collapsibles

## Story

As a screen reader user,
I want collapsible sections to announce their expanded/collapsed state,
So that I know whether content is visible without having to arrow through it.

## Acceptance Criteria

**Given** the CourseOverview page module toggles
**When** a module section is collapsed
**Then** the toggle button has `aria-expanded="false"`
**When** the module section is expanded
**Then** the toggle button has `aria-expanded="true"`

**Given** the YouTubeCourseDetail AI Summary collapsible
**When** the summary is collapsed
**Then** the toggle has `aria-expanded="false"`
**When** expanded
**Then** `aria-expanded="true"`

## Tasks / Subtasks

- [ ] Task 1: Investigate current collapsible implementation (AC: 1, 2)
  - [ ] 1.1 Open `CourseOverview.tsx` and examine module toggle around line 346
  - [ ] 1.2 Determine if using Radix Collapsible, Accordion, or custom toggle logic
  - [ ] 1.3 Open `YouTubeCourseDetail.tsx` and examine AI Summary collapsible around line 334
  - [ ] 1.4 Determine if using Radix Collapsible or custom implementation
- [ ] Task 2: Fix CourseOverview module toggles (AC: 1)
  - [ ] 2.1 If using Radix Collapsible/Accordion: verify `aria-expanded` is automatically applied by Radix — if missing, check component wiring
  - [ ] 2.2 If using custom toggle: add `aria-expanded={isExpanded}` to the toggle button element
  - [ ] 2.3 Ensure the toggle button is a `<button>` element (not a `<div>` with onClick)
  - [ ] 2.4 Add `aria-controls` pointing to the collapsible content panel ID for full ARIA pattern
- [ ] Task 3: Fix YouTubeCourseDetail AI Summary collapsible (AC: 2)
  - [ ] 3.1 If using Radix Collapsible: verify `aria-expanded` is present on the trigger
  - [ ] 3.2 If using custom toggle: add `aria-expanded={isSummaryExpanded}` to the toggle
  - [ ] 3.3 Add `aria-controls` pointing to the summary content panel ID
- [ ] Task 4: Verify all other collapsible patterns in the app
  - [ ] 4.1 Search for other expand/collapse patterns that may be missing `aria-expanded`
  - [ ] 4.2 Fix any additional instances found

## Implementation Notes

- **WCAG Reference:** WCAG 4.1.2 (Name, Role, Value) — interactive elements must expose their state to assistive technology
- **Audit Findings:** H15 (`CourseOverview.tsx:346`), H16 (`YouTubeCourseDetail.tsx:334`)
- **Radix UI behavior:** If using Radix `Collapsible` or `Accordion` components, `aria-expanded` should be automatically managed. If it's missing:
  - The trigger may not be using `Collapsible.Trigger` / `Accordion.Trigger` properly
  - The component may be using a custom button instead of the Radix trigger primitive
- **Custom toggle pattern:**
  ```tsx
  const [isExpanded, setIsExpanded] = useState(false);

  <button
    aria-expanded={isExpanded}
    aria-controls="module-content-1"
    onClick={() => setIsExpanded(!isExpanded)}
  >
    Module 1: Introduction
    <ChevronDown className={isExpanded ? 'rotate-180' : ''} />
  </button>
  <div id="module-content-1" hidden={!isExpanded}>
    {/* Module content */}
  </div>
  ```
- **aria-controls:** While not required for WCAG compliance, it creates a programmatic relationship between the trigger and the panel, improving screen reader UX.

## Testing Notes

- **Screen reader testing:** Use VoiceOver to verify:
  - Tab to a module toggle — VoiceOver should announce "Module Name, collapsed, button" or "Module Name, expanded, button"
  - Toggle the module — VoiceOver should announce the state change
  - Tab to AI Summary toggle — same announcement pattern
- **E2E assertions:**
  ```typescript
  // CourseOverview module toggle
  const moduleToggle = page.getByRole('button', { name: /Module 1/i });
  await expect(moduleToggle).toHaveAttribute('aria-expanded', 'false');
  await moduleToggle.click();
  await expect(moduleToggle).toHaveAttribute('aria-expanded', 'true');

  // YouTubeCourseDetail AI Summary
  const summaryToggle = page.getByRole('button', { name: /AI Summary/i });
  await expect(summaryToggle).toHaveAttribute('aria-expanded', 'false');
  ```
- **Keyboard navigation:** Verify Enter and Space both toggle the expanded state
- **Visual regression:** No visual changes expected (aria-expanded is a semantic attribute only)

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

[Document during implementation]
