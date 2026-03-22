---
story_id: E23-S01
story_name: "Remove Hardcoded Branding from Courses Page"
status: in-progress
started: 2026-03-22
completed:
reviewed: in-progress
review_started: 2026-03-22
review_gates_passed: []
burn_in_validated: false
---

# Story 23.1: Remove Hardcoded Branding from Courses Page

## Story

As a learner,
I want the Courses page to reflect my actual imported courses without hardcoded branding,
so that the platform feels personal and accurately represents my learning content.

## Acceptance Criteria

- **AC1**: Given the Courses page is loaded, when the user views the page, then no hardcoded course provider names, logos, or branding text are displayed
- **AC2**: Given the Courses page is loaded, when there are no imported courses, then an appropriate empty state is shown instead of hardcoded placeholder courses
- **AC3**: Given hardcoded branding elements existed previously, when they are removed, then design tokens and the existing theme system are used for all remaining styling
- **AC4**: Given the Courses page is modified, when viewed on mobile, tablet, and desktop, then the layout remains responsive and visually correct

## Tasks / Subtasks

- [ ] Task 1: Audit Courses page for hardcoded branding (AC: 1)
  - [ ] 1.1 Identify hardcoded provider names, logos, course titles
  - [ ] 1.2 Identify hardcoded image URLs or placeholder content
- [ ] Task 2: Remove or replace hardcoded branding elements (AC: 1, 2)
  - [ ] 2.1 Replace hardcoded content with dynamic data from store/DB
  - [ ] 2.2 Add empty state for when no courses exist
- [ ] Task 3: Verify design token compliance (AC: 3)
  - [ ] 3.1 Ensure no hardcoded colors remain (ESLint will catch)
  - [ ] 3.2 Use theme.css tokens for all styling
- [ ] Task 4: Responsive verification (AC: 4)
  - [ ] 4.1 Test mobile, tablet, desktop layouts

## Design Guidance

### Scope

This story targets the **Courses page header** (line 209 of `Courses.tsx`) which displays hardcoded branding: `"Chase Hughes — The Operative Kit"`. The pre-seeded course *data* in `src/data/courses/` is out of scope (covered by E23-S05).

### Key Changes

**1. Header subtitle (line 209)**
- **Remove**: `"Chase Hughes — The Operative Kit ({count} courses + {n} imported)"`
- **Replace with**: Dynamic summary derived from actual data — e.g., `"{totalCount} courses"` or `"{importedCount} imported courses"` when only imported courses exist
- **Empty state**: When both `allCourses.length === 0 && importedCourses.length === 0`, show no subtitle (count is meaningless at zero)

**2. Empty state component (`data-testid="courses-empty-state"`)**
- The "Imported Courses" section already has an empty state (line 274-301)
- The pre-seeded section (line 367-370) shows `"No courses match your search"` — this is a *filter* empty state, not a *zero courses* empty state
- **Reuse**: `src/app/components/EmptyState.tsx` — the project already has a motion-animated empty state component used in Overview.tsx and Reports.tsx
- **Add**: A true empty state when `allCourses.length === 0 && importedCourses.length === 0`:
  - Use `<EmptyState>` component with `data-testid="courses-empty-state"`
  - Icon: `BookOpen` from lucide-react (same as Overview.tsx empty state)
  - Title: "No courses yet"
  - Description: "Import a course folder to get started"
  - `onAction`: reuse existing `handleImportCourse`
  - Action label: "Import Course"

**3. Design tokens**
- All existing styling on the Courses page already uses design tokens (`bg-card`, `text-muted-foreground`, `bg-brand`, etc.)
- The header subtitle uses `text-muted-foreground` — keep this
- Empty state should use: `text-muted-foreground` for text, `bg-muted/50` for background (matching the imported courses empty state pattern at line 277)

**4. Responsive considerations**
- Header: `flex items-start justify-between gap-4` already handles responsive — keep as-is
- Empty state: Use `flex flex-col items-center text-center` for vertical centering at all breakpoints
- No layout changes needed beyond the empty state addition

### Component patterns to follow
- Match the existing imported courses empty state pattern (lines 274-301) for visual consistency
- Use `role="region"` and `aria-label` on the empty state container

## Implementation Plan

See [plan](plans/e23-s01-remove-hardcoded-branding.md) for implementation approach.

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
