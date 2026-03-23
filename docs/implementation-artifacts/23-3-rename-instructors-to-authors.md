---
story_id: E23-S03
story_name: "Rename Instructors to Authors"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: []
burn_in_validated: false
---

# Story 23.3: Rename Instructors to Authors

## Story

As a learner,
I want the platform to refer to content creators as "Authors" instead of "Instructors",
so that the terminology accurately reflects the self-directed learning model where I import my own content.

## Acceptance Criteria

- **AC1**: Given any page in the application, when the user views text labels, navigation items, or headings, then "Instructor" / "Instructors" is replaced with "Author" / "Authors" everywhere
- **AC2**: Given the sidebar navigation, when the user views the menu, then the "Instructors" link reads "Authors" and navigates to the same route
- **AC3**: Given the Instructors/Authors page, when the user views the page heading and content, then all references use "Author" / "Authors" terminology
- **AC4**: Given any component, store, type, or variable referencing "instructor", when the codebase is searched, then internal naming has been updated to use "author" terminology (files, types, variables, store names)
- **AC5**: Given the application is modified, when viewed on mobile, tablet, and desktop, then the layout remains responsive and visually correct

## Tasks / Subtasks

- [ ] Task 1: Audit all "instructor" references in the codebase (AC: 1, 4)
  - [ ] 1.1 Search source files for "instructor" (case-insensitive)
  - [ ] 1.2 Categorize: UI text, route paths, file names, types, variables, store names
- [ ] Task 2: Rename UI-facing text (AC: 1, 2, 3)
  - [ ] 2.1 Update sidebar navigation label
  - [ ] 2.2 Update page heading and content on Instructors page
  - [ ] 2.3 Update any other pages referencing "instructor"
- [ ] Task 3: Rename internal code references (AC: 4)
  - [ ] 3.1 Rename files (e.g., Instructors.tsx → Authors.tsx)
  - [ ] 3.2 Update types, interfaces, and store names
  - [ ] 3.3 Update route definitions
  - [ ] 3.4 Update imports across the codebase
- [ ] Task 4: Update tests (AC: 1-5)
  - [ ] 4.1 Update E2E tests referencing "instructor"
  - [ ] 4.2 Update unit tests referencing "instructor"
- [ ] Task 5: Responsive verification (AC: 5)
  - [ ] 5.1 Verify layout on mobile, tablet, desktop

## Design Guidance

### Scope

This story is a **terminology rename** — "Instructor" → "Author" across the entire codebase. No visual layout changes are needed. The existing page design, card grid, profile layout, and responsive behavior remain unchanged.

### Text Changes

**1. Page heading ([Instructors.tsx:22](src/app/pages/Instructors.tsx#L22))**
- **From**: `"Our Instructors"`
- **To**: `"Our Authors"`
- Subtitle pattern stays the same: `"Meet the {n} experts behind your learning journey"`

**2. Sidebar navigation ([Layout.tsx](src/app/components/Layout.tsx))**
- Change nav item label from `"Instructors"` to `"Authors"`
- Keep the same icon and route path (route path change is optional — see below)

**3. InstructorProfile not-found state ([InstructorProfile.tsx:38-42](src/app/pages/InstructorProfile.tsx#L38-L42))**
- `"Instructor Not Found"` → `"Author Not Found"`
- `"The instructor you're looking for doesn't exist."` → `"The author you're looking for doesn't exist."`
- `"Back to Instructors"` → `"Back to Authors"`

**4. Breadcrumbs on profile page**
- `"Instructors"` breadcrumb label → `"Authors"`

### Route Path

Route changes from `/instructors` → `/authors` and `/instructors/:instructorId` → `/authors/:authorId`. No redirect needed (personal app, no SEO, no external bookmarks to preserve).

### File Rename Strategy

Rename files to match new terminology:
- `src/app/pages/Instructors.tsx` → `Authors.tsx`
- `src/app/pages/InstructorProfile.tsx` → `AuthorProfile.tsx`
- `src/data/instructors/` → `src/data/authors/`
- `src/lib/instructors.ts` → `src/lib/authors.ts`

### Design Token Compliance

The existing pages already use design tokens (`text-muted-foreground`, `text-brand`, `bg-brand/10`, `ring-brand/30`). No hardcoded colors to fix.

### Responsive Considerations

No layout changes — the existing responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) and mobile-first patterns remain untouched.

### Accessibility

- Ensure `aria-label` attributes on links/buttons use "Author" terminology
- Verify screen reader announcements reflect the new terminology

## Implementation Plan

See [plan](plans/e23-s03-rename-instructors-to-authors.md) for implementation approach.

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
