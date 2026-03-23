---
story_id: E23-S03
story_name: "Rename Instructors to Authors"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests]
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

- **Inside-out rename strategy**: types → data → lib → pages → components → routes → DB → tests. TypeScript caught cascading errors at each step, acting as a safety net.
- **Dexie v19 migration**: Added schema version 19 with upgrade function that copies `instructorId` → `authorId` and deletes the old field on existing records. All 20 tables must be redeclared to prevent Dexie from deleting them.
- **Preserved intentional "instructor" references**: `confidence-reboot.ts` has "guest instructor" in course content (keyTopics), and E2E tests for E09B-S01 have "The instructor explains..." (LLM-generated output text). These are content, not code references.
- **Asset paths kept**: Image paths like `/images/instructors/chase-hughes` kept as-is since they're not user-visible. Can be renamed separately if desired.
- **53 files touched** across types, data (10 files), lib, pages (2 renamed), components (5 updated), navigation, routes, DB schema, unit tests (13 files), E2E tests (6 files), API types.

## Testing Notes

- **2151 unit tests** all pass after renaming `instructorId` → `authorId` in mock data across 12 test files
- **Schema version test** needed updating from 18 → 19 (caught by unit test run)
- **Test data values** (e.g., `'instructor-1'`) updated to `'author-1'` for consistency
- **4 E2E ATDD tests** validate: no "Instructor" text visible, sidebar says "Authors", page heading correct, mobile layout works
- **Smoke specs** (navigation, overview, courses) all pass

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

- **Schema version test forgotten**: The `src/db/__tests__/schema.test.ts` asserts `db.verno === 18` — adding v19 migration broke this. Lesson: when adding Dexie schema versions, always search for version assertion tests.
- **Test mock data values vs field names**: After renaming the field `instructorId` → `authorId`, the mock data _values_ (e.g., `authorId: 'instructor-1'`) still contained "instructor". While functionally irrelevant (they're arbitrary IDs), updating them to `'author-1'` maintains consistency and avoids confusion in grep results.
- **Inside-out strategy works well for renames**: Starting from types and working outward means TypeScript errors guide you to every downstream consumer. No references were missed — the `grep -ri instructor src/` verification confirmed zero remaining code references (only intentional content strings and historical DB schema).
- **Dexie migration pattern**: When renaming an indexed field, the upgrade function must handle the field copy + delete atomically. The pattern of `modify(record => { record.newField = record.oldField; delete record.oldField })` is reliable and Dexie runs it lazily at `db.open()`.
- **Scope discipline**: The plan correctly identified "guest instructor" in course content and "The instructor explains" in LLM test output as non-targets. This prevented unnecessary content changes that would have been incorrect (they describe real-world instructor roles, not platform terminology).
