---
story_id: E25-S02
story_name: "Author CRUD Dialog"
status: done
started: 2026-03-23
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 25.02: Author CRUD Dialog

## Story

As a learner,
I want to create, edit, and delete author profiles through a dialog interface,
so that I can manage the content creators associated with my imported courses.

## Acceptance Criteria

**AC1: Create Author**
**Given** I am on the Authors page
**When** I click the "Add Author" button
**Then** a dialog opens with a form containing fields for: name (required), title, bio, short bio, specialties (tag input), years of experience, education, social links (website, LinkedIn, Twitter), and avatar URL
**And** the form validates required fields before submission
**And** on successful submission, the author is persisted to IndexedDB and appears in the Authors list
**And** a success toast notification is displayed

**AC2: Edit Author**
**Given** I am viewing an author's profile or the Authors grid
**When** I click the "Edit" button/icon on an author card or profile
**Then** the same dialog opens pre-populated with the author's existing data
**And** I can modify any field and save changes
**And** on successful save, the updated data is persisted to IndexedDB and reflected in the UI
**And** a success toast notification is displayed

**AC3: Delete Author**
**Given** I am viewing an author's profile or the Authors grid
**When** I click the "Delete" button/icon on an author
**Then** a confirmation dialog appears warning that this action cannot be undone
**And** the confirmation shows the author's name for clarity
**And** on confirmation, the author is removed from IndexedDB
**And** a success toast notification is displayed
**And** I am redirected to the Authors list if I was on the profile page

**AC4: Form Validation**
**Given** I am filling out the author form (create or edit mode)
**When** I submit with missing required fields (name is required)
**Then** inline validation errors are displayed beneath the relevant fields
**And** the form does not submit until errors are resolved
**And** errors clear as I correct each field

**AC5: Authors Page reads from IndexedDB**
**Given** authors have been persisted to IndexedDB (via migration or CRUD)
**When** I navigate to the Authors page
**Then** authors are loaded from IndexedDB via `useAuthorStore`
**And** the page displays all persisted authors (not just hardcoded static data)

**AC6: Accessibility**
**Given** the author dialog is open
**When** I interact with the form using keyboard only
**Then** all fields are navigable via Tab/Shift+Tab
**And** the dialog traps focus correctly
**And** validation errors are announced via `aria-invalid` and `role="alert"`
**And** the dialog can be closed with Escape

## Dependencies

- **E25-S01 (Author Data Model & Migration):** This story requires an `authors` table in Dexie and a `useAuthorStore` Zustand store. Since E25-S01 is `backlog`, this story subsumes that work as Task 1.

## Tasks / Subtasks

- [ ] Task 1: Add `authors` table to Dexie schema (v20 migration) and seed from static data (AC: 5)
  - [ ] 1.1 Add `authors` table to schema.ts
  - [ ] 1.2 Seed existing static author data during migration
- [ ] Task 2: Create `useAuthorStore` Zustand store with CRUD operations (AC: 1, 2, 3, 5)
  - [ ] 2.1 Define store interface (loadAuthors, addAuthor, updateAuthor, deleteAuthor)
  - [ ] 2.2 Implement persistence with `persistWithRetry`
- [ ] Task 3: Create `AuthorFormDialog` component (AC: 1, 2, 4, 6)
  - [ ] 3.1 Build form layout with shadcn/ui Dialog, Input, Textarea, Label
  - [ ] 3.2 Implement create/edit mode switching
  - [ ] 3.3 Add inline validation with error messages
  - [ ] 3.4 Add specialties tag input
- [ ] Task 4: Create delete confirmation with AlertDialog (AC: 3)
- [ ] Task 5: Update Authors page to use `useAuthorStore` instead of static data (AC: 5)
  - [ ] 5.1 Replace `allAuthors` import with store data
  - [ ] 5.2 Add "Add Author" button
  - [ ] 5.3 Add edit/delete actions to author cards
- [ ] Task 6: Update AuthorProfile page for edit/delete actions (AC: 2, 3)
- [ ] Task 7: Update `lib/authors.ts` to read from store instead of static data
- [ ] Task 8: Write E2E tests
- [ ] Task 9: Verify build, lint, type-check

## Implementation Plan

See: [docs/implementation-artifacts/plans/e25-s02-author-crud-dialog.md](plans/e25-s02-author-crud-dialog.md)

## Design Guidance

- Dialog follows existing `CreateChallengeDialog` pattern (controlled open/onOpenChange)
- Form uses inline validation (not zod/react-hook-form — match existing codebase pattern)
- Delete uses `AlertDialog` with destructive styling (match `ImportedCourseCard` pattern)
- Toast notifications via Sonner (`toast.success` / `toast.error`)
- Card actions use icon buttons (Pencil, Trash2 from lucide-react)
- Design tokens: `bg-brand`, `text-destructive`, etc. — no hardcoded colors

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

1. **Zustand `getState()` in render is non-reactive.** Using `useAuthorStore.getState()` inside a render function (e.g., CourseDetail's IIFE) reads the snapshot but never re-renders when authors load. Always use the `useAuthorStore()` hook for reactive subscriptions, and call `loadAuthors()` in a `useEffect` to ensure data is available even when navigating directly to a page.

2. **Utility functions that access store state need load guards.** `getAuthorForCourse()` used `getState()` without checking if authors were loaded. For non-React utility functions, add an idempotent `loadAuthors()` call when `isLoaded` is false to prevent stale/empty reads.

3. **Silent `console.error` in catch blocks is insufficient.** The `loadAuthors` catch block logged to console but showed no user-facing feedback. All error paths that affect user-visible state should include `toast.error()` alongside `console.error` for debugging.

4. **Default `0` for optional numeric fields is misleading.** When `yearsExperience` is empty, defaulting to `0` caused the UI to display "0y Experience" — implying no experience rather than unknown. The display layer should treat `0` as "not specified" and show a dash or hide the stat.

5. **Duplicated helpers across pages.** `getInitials()` was copy-pasted into both Authors.tsx and AuthorProfile.tsx. Extracting to `lib/authors.ts` provides a single source of truth and reduces maintenance burden.
