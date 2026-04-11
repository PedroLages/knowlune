---
story_id: E110-S02
story_name: "Series Grouping"
status: in-progress
started: 2026-04-11
completed:
reviewed: true
review_started: 2026-04-11
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests
  - design-review
  - code-review
  - code-review-testing
  - performance-benchmark-skipped
  - security-review
  - exploratory-qa-skipped
burn_in_validated: false
---

# Story 110.02: Series Grouping

## Story

As a Knowlune user with books that belong to series,
I want to see my local books grouped by series with reading order,
so that I can follow a series sequentially and track my progress through it.

## Acceptance Criteria

**Given** a library with local books that have series metadata
**When** the user selects a "Series" view/filter on the Library page
**Then** books are grouped by series name
**And** within each series, books are ordered by series sequence number

**Given** a series group is displayed
**When** the user views the series
**Then** series progress is shown: "{completed} of {total} books"
**And** each book shows its individual reading/listening progress

**Given** a series with partially read books
**When** the user taps a series card
**Then** the series expands to show all books in order
**And** the next unfinished book is highlighted

**Given** a book without series metadata
**When** the user views the series-grouped library
**Then** the book appears in an "Ungrouped" section at the bottom

**Given** a user wants to assign/edit series info on a book
**When** the user edits book metadata
**Then** they can set/change the series name and sequence number

## Tasks / Subtasks

- [ ] Task 1: Add `series` and `seriesSequence` fields to the `Book` type and Dexie schema (AC: 1, 5)
  - [ ] 1.1 Update `Book` interface in `src/data/types.ts`
  - [ ] 1.2 Add Dexie v45 migration with `series` index on books table
  - [ ] 1.3 Update checkpoint schema
- [ ] Task 2: Update BookMetadataEditor to support series fields (AC: 5)
  - [ ] 2.1 Add series name input
  - [ ] 2.2 Add series sequence number input
  - [ ] 2.3 Persist changes via book store
- [ ] Task 3: Create local series grouping logic in useBookStore (AC: 1, 2, 4)
  - [ ] 3.1 Add `getBooksBySeries()` selector that groups books by series name
  - [ ] 3.2 Sort books within each series by sequence number
  - [ ] 3.3 Calculate series progress (completed/total)
  - [ ] 3.4 Identify next unfinished book per series
- [ ] Task 4: Create LocalSeriesCard component (AC: 1, 2, 3)
  - [ ] 4.1 Collapsed state: series name, progress count, cover collage
  - [ ] 4.2 Expanded state: books in order with progress and "Continue" badge
  - [ ] 4.3 Keyboard accessible (Enter/Space to expand)
- [ ] Task 5: Add "Series" view mode to Library page for local/all sources (AC: 1, 4)
  - [ ] 5.1 Add series view toggle for non-ABS sources
  - [ ] 5.2 Show ungrouped books section
  - [ ] 5.3 Wire up LocalSeriesCard rendering
- [ ] Task 6: Auto-populate series metadata from ABS sync (AC: 1)
  - [ ] 6.1 When syncing ABS books, copy series/seriesSequence from ABS metadata to local Book

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] CRUD completeness: For any entity this story touches, verify Create/Read/Update/Delete paths all exist and have tests
- [ ] At every non-obvious code site (AbortController, timer cleanup, catch blocks), add `// Intentional: <reason>` comment
- [ ] For every `useEffect` or async callback that reads Zustand state: confirm it reads from `get()` inside the callback, not from outer render scope (stale closure risk)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

- Story setup: reusing existing SeriesCard pattern from E102-S02 (ABS series) for local series grouping
