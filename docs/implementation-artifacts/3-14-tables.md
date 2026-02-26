---
story_id: E03-S14
story_name: "Tables"
status: done
started: 2026-02-25
completed: 2026-02-26
reviewed: true
review_started: 2026-02-25
review_gates_passed: [build, lint, e2e-tests, design-review, code-review]
---

# Story 3.14: Tables

## Story

As a learner,
I want to create and edit tables in my notes,
So that I can organize structured data like comparisons, vocabulary lists, and reference information.

## Acceptance Criteria

**AC1**: Given the user clicks the Table button in the toolbar (or types `/table`)
When the table insert UI appears
Then a grid picker lets the user choose rows x columns (up to 6x6)
And a default 3x3 table is inserted on click

**AC2**: Given a table exists in the editor
When the user right-clicks a cell
Then options appear: Add Row Above, Add Row Below, Add Column Left, Add Column Right, Delete Row, Delete Column, Delete Table
And Tab moves between cells, Tab at the last cell creates a new row

## Tasks / Subtasks

- [ ] Task 1: Install `@tiptap/extension-table` (AC: 1, 2)
- [ ] Task 2: Add table CSS styles (AC: 1, 2)
- [ ] Task 3: Create TableGridPicker component (AC: 1)
- [ ] Task 4: Create TableContextMenu component (AC: 2)
- [ ] Task 5: Wire up NoteEditor.tsx (AC: 1, 2)
  - [ ] 5a: Imports and extension config
  - [ ] 5b: Toolbar button with grid picker
  - [ ] 5c: Mobile overflow menu item
  - [ ] 5d: Context menu wrapper around EditorContent
- [ ] Task 6: Add `/table` slash command (AC: 1)
- [ ] Task 7: E2E tests (AC: 1, 2)

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

**Reviewed 2026-02-25 (re-run)** — Report: `docs/reviews/design/design-review-2026-02-25-E03-S14.md`

1 Blocker (B1: context menu keyboard inaccessible — no focus management, missing ARIA roles), 4 High (H1: grid cells 28px on mobile below 44px min, H2: missing aria-live on size label, H3: dead `.tableWrapper` CSS / wide tables overflow on mobile, H4: menuHeight underestimate clips bottom items), 3 Medium (M1: inline style, M2: button+gridcell ARIA conflict, M3: nested table possible via slash command), 2 Nits. All ACs verified working functionally.

## Code Review Feedback

**Reviewed 2026-02-25 (re-run)** — Report: `docs/reviews/code/code-review-2026-02-25-E03-S14.md`

0 Blockers, 3 High (H1: arrow key navigation missing on role="menu", H2: --table-selected missing from .dark, H3: Enter vs Tab AC ambiguity untested), 4 Medium (M4: useLayoutEffect double-render, M5: col x row label inversion, M6: comment contrast ratio, M7: inline style for position:fixed), 3 Nits. Good component architecture, thorough first-review remediation noted.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Implementation Plan

See [plan](../../.claude/plans/golden-stirring-truffle.md) for implementation approach.
