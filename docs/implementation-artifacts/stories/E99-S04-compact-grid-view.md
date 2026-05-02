---
story_id: E99-S04
story_name: "Compact Grid View"
status: in-review
started: 2026-04-25
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 99.4: Compact Grid View

## Story

As a learner with a large catalog,
I want a compact grid view that strips metadata down to title and thumbnail only,
so that I can scan many courses at a glance like an app-icon grid.

## Acceptance Criteria

**Given** I set `courseViewMode` to `'compact'`
**When** the Courses page renders
**Then** courses display as a dense grid with smaller cards
**And** each card shows only: thumbnail (larger proportionally), title (truncate to 2 lines), minimal progress indicator
**And** tags, author, status badge, timestamp, overflow menu are hidden or shown on hover/long-press

**Given** compact view is active
**When** I view at `lg` breakpoint with `courseGridColumns === 'auto'`
**Then** the grid shows roughly 6-8 columns (denser than default grid's 4)
**And** uses `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8`

**Given** compact view + an explicit column choice (from S02)
**When** I picked 5 columns in grid mode and switch to compact
**Then** compact uses its own column override (`~1.6x` the chosen value, capped) OR keeps its own separate preference — decide per implementation (document in notes)

**Given** I hover a compact card (desktop)
**When** the hover state engages
**Then** the overflow menu and status badge fade in
**And** the title gets a subtle `text-foreground` emphasis

**Given** I long-press a compact card (mobile)
**When** the press exceeds ~500ms
**Then** a context menu with edit/delete/status appears
**And** a short tap navigates to the course as usual

**Given** I click a compact card
**When** the click fires (not long-press)
**Then** I navigate to course detail (same as grid/list)

**Given** progress is shown on a compact card
**When** the card renders with `progress > 0`
**Then** a thin progress bar (2px) overlays the bottom edge of the thumbnail
**And** no numeric percentage is shown

## Tasks / Subtasks

- [ ] Task 1: Create `<ImportedCourseCompactCard />` component (AC: 1, 4, 5, 7)
  - [ ] 1.1 Create `src/app/components/figma/ImportedCourseCompactCard.tsx`
  - [ ] 1.2 Accept same core props as `ImportedCourseCard`
  - [ ] 1.3 Layout: vertical — thumbnail (aspect-square or 16:9), title below (2-line truncate with `line-clamp-2`)
  - [ ] 1.4 No text metadata other than title — NO author, NO tags, NO timestamp
  - [ ] 1.5 Progress overlay: `absolute bottom-0 left-0 h-0.5 bg-brand` with width = progress%
  - [ ] 1.6 Hover reveals overflow menu top-right

- [ ] Task 2: Column logic (AC: 2, 3)
  - [ ] 2.1 Extend `getGridClassName` helper (from E99-S02) with a second arg: `viewMode: 'grid' | 'compact'`
  - [ ] 2.2 In compact mode `auto` maps to `'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'`
  - [ ] 2.3 In compact mode with explicit columns (2-5), scale up by ~1.6×: 2→3, 3→5, 4→6, 5→8
  - [ ] 2.4 Document the scaling rule in `gridClassName.ts` file-header comment
  - [ ] 2.5 Alternative design (if scaling feels off): store a separate `compactGridColumns` — consult UX judgment before starting, default to scaling approach

- [ ] Task 3: Long-press context menu on mobile (AC: 5)
  - [ ] 3.1 Add `onPointerDown` + timer to each compact card
  - [ ] 3.2 If pointer is held > 500ms and hasn't moved > 10px, trigger context menu
  - [ ] 3.3 Use Radix `<ContextMenu>` or open the existing `<DropdownMenu>` programmatically
  - [ ] 3.4 Clear timer on pointer move/up/cancel
  - [ ] 3.5 If this adds significant complexity, fall back to a small dots button that's always visible on mobile

- [ ] Task 4: Wire into `Courses.tsx` (AC: 1, 6)
  - [ ] 4.1 When `courseViewMode === 'compact'`, render `<ImportedCourseCompactCard />` inside the grid container with compact classes
  - [ ] 4.2 Click handler navigates to course detail (same as grid card click)

- [ ] Task 5: Tests
  - [ ] 5.1 Unit: `ImportedCourseCompactCard.test.tsx` — renders thumbnail + title only, progress overlay when >0, hover reveals menu
  - [ ] 5.2 Unit: update `gridClassName.test.ts` with compact branch
  - [ ] 5.3 E2E: `tests/e2e/e99-s04-compact-view.spec.ts` — set compact mode, assert dense grid, click navigates

## Dev Notes

### Design rationale: when Compact wins over List

- **List** = metadata-rich, vertical scan, few wide rows per screen
- **Compact** = visual scan, many items per screen, "which cover do I recognize?"

Both are valid for power users. They answer different questions, so we keep both.

### Column scaling decision

Two approaches — pick ONE during implementation:

**A) Scale explicit column count** (recommended — simpler, less state)
- User picks "4 columns" in grid mode → compact shows ~6 columns
- Single `courseGridColumns` setting
- Con: users may find the 1.6× ratio unintuitive

**B) Separate `compactGridColumns` setting**
- Two independent settings, each with its own toggle
- Pro: fully predictable
- Con: doubles the state + UI; user must tune twice

Default to A. If user testing shows confusion, promote to B.

### Key Constraints

- **Thumbnail-centric** — compact view is about visual recognition; don't clutter with text
- **Progress as 2px bar** — a percentage number is noise at this density
- **Do NOT lose the overflow menu** — hide it, but keep it reachable (hover desktop, long-press or always-visible dot mobile)
- **Gap must be tight** — use `gap-3` not `gap-[var(--content-gap)]` (which is larger)
- **Long-press is fiddly** — if it proves buggy, ship with always-visible 3-dot button on mobile instead
- **Touch target still 44×44** — the CARD is the touch target; card itself must be ≥ 44×44 (at 8-col desktop grid this requires the container to be wide enough — add a min-width check)

### Files to modify / create

- `src/app/components/figma/ImportedCourseCompactCard.tsx` — new
- `src/app/components/courses/gridClassName.ts` — extend with `viewMode` arg
- `src/app/pages/Courses.tsx` — conditional render
- `tests/e2e/e99-s04-compact-view.spec.ts` — new

### Dependencies

- **Blocked by E99-S01** (needs `courseViewMode`)
- **Blocked by E99-S02** (extends `gridClassName` helper)

## Design Guidance

- **Aspect ratio**: square or 4:3 thumbnail
- **Title**: `text-xs font-medium` desktop, `text-sm` mobile, 2-line clamp
- **Gap**: `gap-3` between cards
- **Hover transition**: 150ms ease-out; respect `prefers-reduced-motion`
- **Progress bar**: `h-0.5 bg-brand` — flush to bottom of thumbnail, inside rounded corners

## Pre-Review Checklist

- [ ] All changes committed
- [ ] Compact cards show ONLY thumbnail + title + progress
- [ ] Overflow menu reachable (hover desktop / tap-and-hold or dot on mobile)
- [ ] 44×44 minimum card size even at densest breakpoint
- [ ] Design tokens only
- [ ] `gridClassName` helper branches tested
- [ ] E2E asserts ≥6 columns visible at lg+ viewport
- [ ] Long-press doesn't interfere with scrolling
- [ ] `prefers-reduced-motion` respected

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document]
