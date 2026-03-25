---
story_id: E25-S03
story_name: "Authors Page from IndexedDB"
status: done
started: 2026-03-23
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 25.3: Authors Page from IndexedDB

## Story

As a learner,
I want the Authors page to show all authors from the database (pre-seeded and user-created),
So that I see a complete view of all content creators in my library.

## Acceptance Criteria

**AC1: Authors grid from IndexedDB**
**Given** the Authors page loads
**When** the `useAuthorStore` has loaded authors from IndexedDB
**Then** all authors (pre-seeded + user-created) display in the grid
**And** each author card shows: avatar (photo or initials), name, specialties (max 3 + "+N more"), course count, total content hours
**And** clicking an author card navigates to the author detail page

**AC2: Add Author button**
**And** a "Add Author" button opens the Create Author dialog (Story 25.2)

**AC3: Single-author featured layout**
**And** the single-author featured layout from E23 (Story 23.6) still applies when only 1 author exists

**AC4: Replace static imports**
**And** the static `allAuthors` import is replaced with `useAuthorStore` data
**And** `AuthorProfile.tsx` is refactored to read from `useAuthorStore` instead of static data — breadcrumbs, bio, courses, and stats all sourced from IndexedDB
**And** the `getAuthorStats()` function is adapted to work with the new Author entity

**AC5: Skeleton loading state**
**And** a skeleton loading state shows while `useAuthorStore` is loading (existing pattern)

**AC6: Graceful fallback**
**Given** `useAuthorStore` returns 0 authors (migration failed or empty DB)
**When** the page renders
**Then** it falls back to static `allAuthors` data as a safety net

## Prerequisites (E25-S01 scope bundled)

This story bundles the E25-S01 data model work since it hasn't been completed:
- Dexie v20 migration adding `authors` table
- `useAuthorStore` Zustand store with `loadAuthors()` and `getAuthorById()`
- Chase Hughes pre-seeded as Author record from existing static data
- Author seeding function (`seedAuthorsIfEmpty`)
- App initialization updated to seed authors and load store

## Tasks / Subtasks

- [ ] Task 1: Create Dexie v20 schema with `authors` table (AC: prerequisite)
  - [ ] 1.1 Add `authors` table: `id` primary key, `name` index
  - [ ] 1.2 Seed Chase Hughes from static data via `seedAuthorsIfEmpty()`
  - [ ] 1.3 Add Author interface to types (extend existing with `isPreseeded`, `createdAt`, `updatedAt`)
- [ ] Task 2: Create `useAuthorStore` Zustand store (AC: prerequisite, AC4)
  - [ ] 2.1 `loadAuthors()` method — reads from `db.authors.toArray()`
  - [ ] 2.2 `getAuthorById()` method
  - [ ] 2.3 `isLoaded` flag for loading state
- [ ] Task 3: Update app initialization (AC: prerequisite)
  - [ ] 3.1 Add `seedAuthorsIfEmpty` to `main.tsx` deferred init
  - [ ] 3.2 Add `useAuthorStore.loadAuthors()` call after seed
- [ ] Task 4: Refactor Authors page to use `useAuthorStore` (AC: 1, 4, 5, 6)
  - [ ] 4.1 Replace `allAuthors` import with `useAuthorStore` hook
  - [ ] 4.2 Add skeleton loading state while store loads
  - [ ] 4.3 Add fallback to static data if store returns empty
  - [ ] 4.4 Keep existing grid layout and card design
- [ ] Task 5: Refactor AuthorProfile page to use `useAuthorStore` (AC: 4)
  - [ ] 5.1 Replace `getAuthorById` static lookup with store lookup
  - [ ] 5.2 Add loading state for profile page
- [ ] Task 6: Adapt `getAuthorStats()` for new Author entity (AC: 4)
  - [ ] 6.1 Update `lib/authors.ts` to accept store-sourced Author
- [ ] Task 7: Add "Add Author" button placeholder (AC: 2)
  - [ ] 7.1 Button in page header (opens toast "Coming soon" — E25-S02 not yet built)
- [ ] Task 8: E2E tests (AC: 1, 4, 5, 6)
  - [ ] 8.1 Authors page renders from IndexedDB data
  - [ ] 8.2 Author profile loads from IndexedDB
  - [ ] 8.3 Skeleton loading state visible during load
  - [ ] 8.4 Navigation between authors list and profile works

## Design Guidance

- Maintain existing grid layout: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Add "Add Author" button in page header area (right-aligned, `variant="brand"`)
- Skeleton: use `Skeleton` component from shadcn/ui, match card dimensions
- Loading state: 3-6 skeleton cards in the grid
- Keep existing card design (avatar, name, specialties, stats)

## Implementation Notes

**Plan:** [2026-03-23-e25-s03-authors-page-from-indexeddb.md](plans/2026-03-23-e25-s03-authors-page-from-indexeddb.md)

### Key Changes
- Added `isLoaded` flag to `useAuthorStore` (was missing, referenced by pages)
- Created `AuthorView` unified type in `lib/authors.ts` to normalize `Author` vs `ImportedAuthor`
- `getMergedAuthors()` merges store authors with static fallback
- Authors page now has search by name/specialty and sort (alphabetical, most courses, recently added)
- AuthorProfile refactored to use `AuthorView` via `getMergedAuthors()`
- Fixed type mismatches in `AuthorFormDialog`, `DeleteAuthorDialog`, `CourseDetail.tsx`

## Testing Notes

- Rewrote `Authors.test.tsx` (20 tests) covering: empty state, single/multiple authors, search, sort, loading skeleton, pre-seeded fallback, store preference
- Author store tests updated with `isLoaded` in state reset

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
