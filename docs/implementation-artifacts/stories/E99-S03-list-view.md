---
story_id: E99-S03
story_name: "List View"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 99.3: List View

## Story

As a power user with many courses,
I want a dense list view that shows more courses per screen with detailed metadata,
so that I can scan my entire library without excessive scrolling.

## Acceptance Criteria

**Given** I set `courseViewMode` to `'list'`
**When** the Courses page renders
**Then** courses display in a vertical list (one course per row)
**And** each row shows: thumbnail (small, left), title, author/source, progress bar, tag badges, status, last-played timestamp, overflow menu
**And** each row has minimum height 72px and is fully tappable

**Given** I hover over a course row
**When** the hover state engages
**Then** a subtle `bg-muted/50` highlight appears
**And** the row cursor becomes `pointer`

**Given** I click anywhere on a course row (not on a button/menu)
**When** the click fires
**Then** I navigate to the course detail page (same destination as Grid card click)

**Given** I focus a course row with keyboard
**When** I press Enter
**Then** navigation fires (same as click)
**And** focus indicator is visible per WCAG 2.4.13 (E66-S05 compliant)

**Given** the list is rendered and contains an overflow menu button on each row
**When** I click the overflow menu
**Then** it shows the same actions as the grid card (edit title, change status, delete, etc.) — wired to the same handlers

**Given** a course row's thumbnail is missing
**When** the row renders
**Then** a fallback placeholder displays (same fallback logic as `ImportedCourseCard`)

**Given** I am on a mobile viewport
**When** I view the list
**Then** the row layout collapses: thumbnail + title on the first line, metadata truncated/stacked below
**And** the row remains tappable with 44px minimum height

## Tasks / Subtasks

- [ ] Task 1: Create `<ImportedCourseListRow />` component (AC: 1, 2, 6, 7)
  - [ ] 1.1 Create `src/app/components/figma/ImportedCourseListRow.tsx`
  - [ ] 1.2 Accept the same props as `ImportedCourseCard` (course, handlers) so wiring is trivial
  - [ ] 1.3 Layout: flex row with `gap-4 p-4 rounded-xl hover:bg-muted/50`
  - [ ] 1.4 Thumbnail: 64×64 (desktop) / 48×48 (mobile), rounded, object-cover, same fallback as `ImportedCourseCard`
  - [ ] 1.5 Metadata column (flex-1): title (truncate), author (muted), progress bar (inline, thin)
  - [ ] 1.6 Right column: status badge, tag badges (first 2 + `+N` chip), last-played (desktop only), overflow `DropdownMenu`
  - [ ] 1.7 Reuse existing `DropdownMenu` from `ImportedCourseCard` — extract into shared helper if duplication grows

- [ ] Task 2: Wire into `Courses.tsx` (AC: 3, 4)
  - [ ] 2.1 When `courseViewMode === 'list'`, render `<ul role="list">` container
  - [ ] 2.2 Each course renders as `<li><ImportedCourseListRow ... /></li>`
  - [ ] 2.3 Click handler on the row body calls `navigate(/courses/...)`
  - [ ] 2.4 Stop propagation inside the overflow menu so clicking the menu doesn't navigate
  - [ ] 2.5 Container: `className="flex flex-col gap-2"` — vertical list, small gap

- [ ] Task 3: Keyboard navigation (AC: 4)
  - [ ] 3.1 Row becomes focusable (`tabIndex={0}` or wrap in `<button>`-like semantic)
  - [ ] 3.2 Press Enter / Space navigates
  - [ ] 3.3 Arrow keys move focus between rows (optional polish — skip if complex)
  - [ ] 3.4 Focus indicator: use `focus-visible:ring-2 focus-visible:ring-ring`

- [ ] Task 4: Mobile responsive (AC: 8)
  - [ ] 4.1 On `< sm`: stack metadata vertically, hide timestamp
  - [ ] 4.2 Row height min 44px (WCAG 2.5.8)
  - [ ] 4.3 Overflow menu stays reachable

- [ ] Task 5: Extract reused card helpers (refactor opportunity)
  - [ ] 5.1 If thumbnail-fallback logic is duplicated across `ImportedCourseCard` and `ImportedCourseListRow`, extract to `useCourseThumbnail` hook or `<CourseThumbnail />` component
  - [ ] 5.2 Same for the overflow menu — consider `<CourseOverflowMenu course={...} onEdit onDelete ... />`
  - [ ] 5.3 Prefer extraction NOW to prevent drift later

- [ ] Task 6: Tests
  - [ ] 6.1 Unit: `ImportedCourseListRow.test.tsx` — renders all metadata, fires onClick, fires overflow actions
  - [ ] 6.2 E2E: `tests/e2e/e99-s03-list-view.spec.ts` — set list mode, assert rows render, click row navigates

## Dev Notes

### Why a new component, not a conditional inside `ImportedCourseCard`?

Two layouts with very different DOM shapes — a conditional branch inside one component quickly becomes a nightmare of style overrides and prop gymnastics. Two sibling components sharing extracted helpers (thumbnail, overflow menu, status badge) is cleaner.

### Key Constraints

- **Reuse handlers** — the list row and grid card should call the exact same edit/delete/status handlers. Don't re-implement business logic.
- **Navigation parity** — clicking a list row must go to the same course detail URL as the grid card.
- **Do NOT skip fallback thumbnails** — missing thumbs are common and look broken without the fallback.
- **Overflow menu must not propagate click** — use `onClick={(e) => e.stopPropagation()}` on the menu trigger.
- **Design tokens only** — no hardcoded colors.
- **Accessibility** — every row needs keyboard access; Enter/Space activates; focus-visible ring visible.

### Existing components to study

- `src/app/components/figma/ImportedCourseCard.tsx` — source of all the metadata & handlers
- `src/app/components/library/BookList.tsx` (via `SmartGroupedView.tsx`) — reference for book library's list view pattern, good structural precedent

### Files to modify / create

- `src/app/components/figma/ImportedCourseListRow.tsx` — new
- `src/app/components/figma/CourseThumbnail.tsx` — new (extract if dup-scan flags it)
- `src/app/components/figma/CourseOverflowMenu.tsx` — new (same)
- `src/app/pages/Courses.tsx` — conditionally render list vs grid
- `tests/e2e/e99-s03-list-view.spec.ts` — new

### Dependencies

- **Blocked by E99-S01** (needs `courseViewMode` in store)
- No blockers on E99-S02 (grid column control is hidden in list mode)

## Design Guidance

- **Row height**: 72px desktop, 60px mobile
- **Padding**: `p-4` horizontal, `py-3` vertical
- **Gap between metadata items**: `gap-2` small, `gap-4` medium
- **Separators**: optional thin `border-b` between rows, or use gap — match whichever looks better
- **Thumbnail**: rounded-lg, 64×64 desktop
- **Progress bar**: thin (2px), inline with metadata
- **Reduce visual weight** — lists work because they're dense; don't re-add card-like shadows

## Pre-Review Checklist

- [ ] All changes committed
- [ ] List row renders same handlers as grid card (DRY)
- [ ] Keyboard Enter/Space navigates
- [ ] Focus-visible ring present
- [ ] Row tappable 44px minimum (mobile)
- [ ] Overflow menu click doesn't bubble to row navigation
- [ ] Design tokens only
- [ ] Fallback thumbnail when image missing
- [ ] E2E covers list mode selection + row click navigation
- [ ] Unit tests for row component

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document]
