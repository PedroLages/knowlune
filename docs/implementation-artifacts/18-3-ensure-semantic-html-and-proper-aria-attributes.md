---
story_id: E18-S03
story_name: "Ensure Semantic HTML and Proper ARIA Attributes"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 18.3: Ensure Semantic HTML and Proper ARIA Attributes

## Story

As a screen reader user,
I want quiz components to use proper semantic HTML,
So that I can understand the structure and navigate efficiently.

**FRs Fulfilled: QFR45**

## Acceptance Criteria

**Given** quiz components use form controls
**When** rendering questions
**Then** radio button groups use `<fieldset>` and `<legend>`
**And** all inputs have associated `<label>` elements
**And** related controls are grouped logically

**Given** quiz pages render
**When** inspecting the document structure
**Then** headings follow a logical hierarchy (h1 for quiz title, h2 for question, h3 for subsections)
**And** a `<nav>` landmark wraps the question grid navigation
**And** the quiz content area uses `<main>` with `<section>` for distinct regions (question area, navigation, timer)

**Given** quiz displays dynamic content
**When** content changes (feedback, score, warnings)
**Then** appropriate ARIA roles are used (`role="status"`, `role="alert"`)
**And** `aria-atomic="true"` ensures full message is read

**Given** quiz has navigation controls
**When** rendering buttons and links
**Then** all have descriptive accessible names
**And** icon-only buttons have `aria-label` (e.g., aria-label="Next question")

**Given** quiz displays timer or progress
**When** showing countdown or progress bar
**Then** `role="timer"` is used for the countdown display with `aria-live="off"` (warning announcements are handled separately by Story 18.2's tiered live region)
**And** `role="progressbar"` is used for question progress
**And** `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are set correctly

## Tasks / Subtasks

- [ ] Task 1: Audit all quiz components for semantic HTML issues (AC: 1, 2)
  - [ ] 1.1 Inventory all quiz-related `.tsx` files and current HTML element usage
  - [ ] 1.2 Identify missing `<fieldset>/<legend>` wrappers around radio/checkbox groups
  - [ ] 1.3 Identify heading hierarchy violations (h1/h2/h3 ordering)
  - [ ] 1.4 Identify missing landmark elements (`<main>`, `<nav>`, `<section>`)
- [ ] Task 2: Add semantic HTML structure to quiz components (AC: 1, 2)
  - [ ] 2.1 Wrap question radio/checkbox groups with `<fieldset>` and `<legend>`
  - [ ] 2.2 Ensure all inputs have associated `<label>` elements
  - [ ] 2.3 Fix heading hierarchy (h1 quiz title, h2 question, h3 subsections)
  - [ ] 2.4 Add `<main>`, `<nav>`, `<section>` landmarks to quiz page structure
- [ ] Task 3: Add proper ARIA attributes to dynamic content (AC: 3, 4, 5)
  - [ ] 3.1 Add `role="status"` / `role="alert"` with `aria-atomic="true"` to feedback regions
  - [ ] 3.2 Ensure all icon-only buttons have `aria-label` attributes
  - [ ] 3.3 Add `role="timer"` with `aria-live="off"` to countdown display
  - [ ] 3.4 Add `role="progressbar"` with `aria-valuenow/min/max` to question progress
  - [ ] 3.5 Ensure all navigation buttons have descriptive accessible names
- [ ] Task 4: Write accessibility E2E tests (AC: 1-5)
  - [ ] 4.1 Add axe-core automated accessibility scan test
  - [ ] 4.2 Test landmark navigation (main, nav, sections)
  - [ ] 4.3 Test heading hierarchy (h1 > h2 > h3)
  - [ ] 4.4 Test ARIA attributes on timer, progress, feedback elements

## Design Guidance

[Optional — populated by /start-story if UI story detected]

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
