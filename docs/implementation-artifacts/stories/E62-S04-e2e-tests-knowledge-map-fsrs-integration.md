---
story_id: E62-S04
story_name: 'E2E Tests for Knowledge Map FSRS Integration'
status: in-progress
started: 2026-04-14
completed:
reviewed: in-progress
review_started: 2026-04-14
review_gates_passed: []
burn_in_validated: false
---

# Story 62.4: E2E Tests for Knowledge Map FSRS Integration

## Story

As a developer,
I want E2E tests verifying the gradient treemap, decay tooltips, and popover decay section work end-to-end,
so that the full feature is validated in a browser environment.

## Acceptance Criteria

**Given** IndexedDB is seeded with courses, flashcards with varied stability/last_review values, and study sessions
**When** navigating to /knowledge-map
**Then** the treemap renders with cells showing varied background colors (not just 3 discrete colors)

**Given** a seeded topic with low retention (stability 2, last_review 10 days ago)
**When** hovering over its treemap cell
**Then** the tooltip contains text matching "Fading" pattern

**Given** a seeded topic with high retention (stability 100, last_review 1 day ago)
**When** hovering over its treemap cell
**Then** the tooltip contains text matching "Stable" pattern

**Given** a seeded topic with aggregateRetention and predictedDecayDate
**When** clicking its treemap cell to open TopicDetailPopover
**Then** the popover contains a "Memory Decay" section with a retention percentage and decay date

**Given** a seeded topic with no flashcards
**When** clicking its treemap cell to open TopicDetailPopover
**Then** the popover does not contain a "Memory Decay" section

**Given** the knowledge map page in dark mode
**When** treemap cells render with gradient colors
**Then** text labels are readable (visual verification — no console errors, cells render without visual artifacts)

**Given** all E2E test data
**When** dates are used for seeding or assertions
**Then** deterministic fixed dates are used per project ESLint rules

## Tasks / Subtasks

- [ ] Task 1: Create test data factory for FSRS-scored topics (AC: 1, 7)
  - [ ] 1.1 Create flashcard factory with FSRS fields (stability, last_review, due, difficulty, reps, lapses, state)
  - [ ] 1.2 Create seed data: 3+ topics with varied retention levels (high ~90%, medium ~50%, low ~20%)
  - [ ] 1.3 Create seed data: 1 topic with no flashcards (null retention)
  - [ ] 1.4 Use FIXED_DATE for all seeded dates

- [ ] Task 2: Write E2E test for gradient treemap rendering (AC: 1)
  - [ ] 2.1 Seed IndexedDB with factory data
  - [ ] 2.2 Navigate to /knowledge-map
  - [ ] 2.3 Wait for treemap to render
  - [ ] 2.4 Assert treemap cells have different background-color CSS values (not just 3 distinct colors)

- [ ] Task 3: Write E2E test for decay prediction tooltips (AC: 2, 3)
  - [ ] 3.1 Hover over low-retention topic cell
  - [ ] 3.2 Assert tooltip contains "Fading" text
  - [ ] 3.3 Hover over high-retention topic cell
  - [ ] 3.4 Assert tooltip contains "Stable" text

- [ ] Task 4: Write E2E test for TopicDetailPopover decay section (AC: 4, 5)
  - [ ] 4.1 Click topic cell with FSRS retention data
  - [ ] 4.2 Assert popover contains "Memory Decay" heading/section
  - [ ] 4.3 Assert retention percentage is visible
  - [ ] 4.4 Assert decay date is visible
  - [ ] 4.5 Click topic cell with no flashcards
  - [ ] 4.6 Assert popover does NOT contain "Memory Decay" section

- [ ] Task 5: Write E2E test for dark mode rendering (AC: 6)
  - [ ] 5.1 Enable dark mode via settings or class toggle
  - [ ] 5.2 Navigate to /knowledge-map
  - [ ] 5.3 Assert treemap cells render without console errors
  - [ ] 5.4 Assert text labels are visible (not transparent/invisible)

## Design Guidance

No UI — pure E2E test story.

## Implementation Notes

**Key files to create:**

- `tests/e2e/knowledge-map-fsrs.spec.ts` (~150-200 lines)

**Key files to reference:**

- Existing E2E tests in `tests/e2e/` for seeding patterns and factory usage
- `tests/support/fixtures/factories/` for flashcard factory patterns
- Existing knowledge map E2E tests (if any from E56) for page interaction patterns

**Testing approach:**

- Chromium only for visual color verification
- Use `page.evaluate()` to seed IndexedDB with FSRS flashcard data
- Use `page.locator()` for treemap cell targeting
- Use `toHaveCSS()` matcher for background-color assertions
- Use `formatDistanceToNow` logic expectations for tooltip text matching

**Seeding strategy:**

- 3 courses with flashcards at different retention levels
- 1 course with no flashcards (fallback path)
- All using FIXED_DATE-relative timestamps for determinism

## Testing Notes

- This IS the testing story — E2E tests are the primary deliverable
- May need `waitForSelector` for Recharts treemap rendering (SVG elements)
- Tooltip testing: hover and wait for tooltip appear animation
- Popover testing: click cell, wait for popover open animation
- Dark mode: toggle via `documentElement.classList.add('dark')` or settings route

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

1. **FSRS seed data design**: Creating deterministic FSRS test data required careful stability/last_review combinations to produce predictable retention percentages. High stability (100) with recent review (1 day ago) yields ~99% retention; low stability (2) with old review (10 days ago) yields low retention. The FSRS exponential decay formula `R = e^(-t/S)` makes the math straightforward once you pick the right parameters.

2. **Browser date mocking via addInitScript**: The `page.addInitScript()` pattern for date mocking must be set before any `goto()` call since navigation creates a new document. The mock replaces `Date` globally in the browser context, ensuring `Date.now()` returns FIXED_DATE throughout the page lifecycle.

3. **Dark mode class persistence across navigations**: Setting `document.documentElement.classList.add('dark')` via `page.evaluate()` is lost on navigation. Only `localStorage` persists. The test relies on the app reading `localStorage` on mount to apply dark mode, which is the app's actual behavior — but this is a subtle testing footgun worth documenting.

4. **Radix popover selectors**: Using `[data-radix-popper-content-wrapper]` is fragile (internal Radix implementation detail). A `data-testid` on the popover component would be more robust but was deferred to avoid changing production code in a test-only story.
