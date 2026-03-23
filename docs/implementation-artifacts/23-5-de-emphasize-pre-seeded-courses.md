---
story_id: E23-S05
story_name: "De-Emphasize Pre-Seeded Courses"
status: done
started: 2026-03-23
completed: 2026-03-23
reviewed: true
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 23.5: De-Emphasize Pre-Seeded Courses

## Story

As a self-directed learner,
I want the pre-seeded sample courses to be visually de-emphasized compared to my imported courses,
so that the platform prioritizes my own content and the sample courses feel like optional reference material rather than the primary experience.

## Acceptance Criteria

- **AC1**: Given the Courses page is loaded, when the user views the page, then the pre-seeded courses section is visually de-emphasized with a "Sample Courses (N)" heading, muted styling, and a collapsible container that defaults to collapsed when imported courses exist
- **AC2**: Given the Courses page has both imported and pre-seeded courses, when the user views the page, then the imported courses section appears first (above the pre-seeded section) with full visual prominence
- **AC3**: Given the Overview page is loaded, when the user has imported courses, then the "Your Library" gallery prioritizes imported courses and shows pre-seeded courses with reduced visual weight (opacity/muted treatment)
- **AC4**: Given the Overview page is loaded, when the user has no imported courses, then pre-seeded courses display at full prominence (no de-emphasis) as the primary content
- **AC5**: Given the Courses page pre-seeded section header, when the user clicks the collapse/expand toggle, then the section collapses or expands with a smooth animation and the state persists across page navigations
- **AC6**: Given any page is modified, when viewed on mobile, tablet, and desktop, then the layout remains responsive and visually correct

## Tasks / Subtasks

- [ ] Task 1: Update Courses page pre-seeded section styling (AC: 1, 2)
  - [ ] 1.1 Rename section heading from implicit "All Courses" to "Sample Courses"
  - [ ] 1.2 Add collapsible wrapper with expand/collapse toggle
  - [ ] 1.3 Apply muted/de-emphasized visual treatment
  - [ ] 1.4 Default collapsed when imported courses exist
- [ ] Task 2: Update Overview page library section (AC: 3, 4)
  - [ ] 2.1 Conditionally apply opacity/muted treatment to pre-seeded CourseCards
  - [ ] 2.2 Show imported courses first in the gallery
  - [ ] 2.3 No de-emphasis when no imported courses exist
- [ ] Task 3: Persist collapse state (AC: 5)
  - [ ] 3.1 Store collapse state in localStorage
  - [ ] 3.2 Animate expand/collapse transition
- [ ] Task 4: Responsive verification (AC: 6)
  - [ ] 4.1 Test mobile, tablet, desktop layouts
- [ ] Task 5: E2E tests
  - [ ] 5.1 Write ATDD tests for all ACs

## Design Guidance

### Scope

This story de-emphasizes the 8 pre-seeded Chase Hughes courses across two pages: **Courses** and **Overview**. The pre-seeded data itself (`src/data/courses/`) is NOT removed — it remains as sample/reference content. The goal is visual hierarchy: imported courses feel primary, pre-seeded courses feel secondary.

### Key Changes

**1. Courses page — Pre-seeded section (lines 342-402 of `Courses.tsx`)**
- **Section heading**: Change from the category toggle group header area to a clear "Sample Courses" section with a `ChevronDown`/`ChevronUp` collapse toggle
- **Collapsible**: Wrap the grid in a `Collapsible` component (shadcn/ui). Default collapsed when `importedCourses.length > 0`, expanded when no imports
- **Visual de-emphasis**: Apply `opacity-60 hover:opacity-100` transition on the entire section container. Muted border around the section: `border border-border/50 rounded-[24px] p-4`
- **Category filter + sort**: Move inside the collapsible content (only visible when expanded)

**2. Courses page — Section ordering (already correct)**
- Imported courses section (lines 287-340) already renders first — no change needed

**3. Overview page — "Your Library" gallery (lines 318-345 of `Overview.tsx`)**
- When `importedCourses.length > 0`: render imported courses first in the grid, then pre-seeded courses with `opacity-60` treatment
- When `importedCourses.length === 0`: render pre-seeded courses at full opacity (current behavior)
- Add a "Sample" badge to pre-seeded CourseCards in the Overview gallery

**4. LocalStorage persistence**
- Key: `knowlune:sample-courses-collapsed`
- Value: `'true'` | `'false'`
- Read on mount, write on toggle

### Design Token Compliance
- All styling uses design tokens (no hardcoded colors)
- Use `text-muted-foreground`, `border-border/50`, `bg-muted/30` for de-emphasis
- Use `opacity-60` + `hover:opacity-100` for reduced visual weight

### Component Patterns
- Reuse `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` from shadcn/ui
- Reuse existing `Badge` component for "Sample" label
- Follow the existing `ImportedCourseCard` vs `CourseCard` section separation pattern

### Responsive Considerations
- Collapsible toggle: full-width clickable header on mobile (44px min touch target)
- Grid columns: same breakpoints as current (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`)

### Accessibility
- Collapsible: `aria-expanded`, `aria-controls` (handled by shadcn Collapsible)
- Toggle button: clear `aria-label="Expand sample courses"` / `"Collapse sample courses"`
- De-emphasized opacity: must remain above 4.5:1 contrast ratio at `opacity-60` on `bg-background`

## Implementation Plan

See [plan](plans/e23-s05-de-emphasize-pre-seeded-courses.md) for implementation approach.

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
