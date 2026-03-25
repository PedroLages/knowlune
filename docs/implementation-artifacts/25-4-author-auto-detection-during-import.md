---
story_id: E25-S04
story_name: "Author Auto-Detection During Import"
status: in-progress
started: 2026-03-23
completed:
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 25.4: Author Auto-Detection During Import

## Story

As a learner importing course folders,
I want the system to automatically detect and suggest the author name from folder naming patterns,
so that my imported courses are linked to the correct author without manual data entry.

## Acceptance Criteria

### AC1: Extract author name from folder name patterns
- **Given** a folder name containing a separator pattern (e.g., "Chase Hughes - Behavioral Analysis", "John Doe/Advanced React")
- **When** the user imports the course folder
- **Then** the system extracts the author name candidate from the folder name using common separator heuristics (` - `, ` — `, `: `)

### AC2: Match detected author against existing authors in DB
- **Given** an extracted author name candidate
- **When** the import completes
- **Then** the system performs case-insensitive matching against existing `authors` table records
- **And** if a match is found, automatically sets the `authorId` on the imported course

### AC3: Create new author record for unmatched names
- **Given** an extracted author name that doesn't match any existing author
- **When** the import completes
- **Then** the system creates a new `DbAuthor` record with `isPreseeded: false`
- **And** links the imported course to this new author

### AC4: Show detected author in success toast
- **Given** a successful import with author detection
- **When** the success toast is displayed
- **Then** it includes the detected author name (e.g., "Imported: Course Name by Author Name")

### AC5: Graceful fallback when no author detected
- **Given** a folder name that doesn't match any separator pattern (e.g., "my-videos", "course_files")
- **When** the import completes
- **Then** the course is imported successfully with no `authorId`
- **And** no error is shown — detection failure is silent

### AC6: Author detection is a pure function
- **Given** the detection logic
- **Then** it is implemented as a pure, testable function `detectAuthorFromFolderName(name: string): string | null`
- **And** it has comprehensive unit tests covering common patterns and edge cases

## Dependencies

- **E25-S01**: Author data model (`DbAuthor` interface, `authors` Dexie table, `authorId` on `importedCourses`)
- **E25-S02**: Author CRUD (for creating new author records)
- **E25-S03**: Authors page from IndexedDB (for displaying linked authors)

## Implementation Plan

[Plan: E25-S04](plans/e25-s04-author-auto-detection-during-import.md)

## Tasks / Subtasks

- [ ] Task 1: Create `detectAuthorFromFolderName()` pure function with unit tests (AC: 1, 6)
- [ ] Task 2: Create `matchOrCreateAuthor()` function for DB lookup/creation (AC: 2, 3)
- [ ] Task 3: Integrate detection into `importCourseFromFolder()` flow (AC: 1, 2, 3, 5)
- [ ] Task 4: Update success toast to include author name (AC: 4)
- [ ] Task 5: Update `ImportedCourseTestData` factory with `authorId` support
- [ ] Task 6: Add unit tests for `matchOrCreateAuthor()` (AC: 2, 3)
- [ ] Task 7: Add E2E test for import-with-author-detection flow (AC: 1-5)

## Design Guidance

No new UI components needed. Changes are limited to:
- Import flow logic (detection + DB matching)
- Toast message text enhancement
- Test infrastructure updates

## Implementation Notes

- `detectAuthorFromFolderName()` is a pure function using separator heuristics (` - `, ` — `, ` – `) and a Unicode-aware person name regex requiring 2+ words.
- `matchOrCreateAuthor()` does case-insensitive DB lookup, creates new author with `isPreseeded: false` if none found. Uses `crypto.randomUUID()` for IDs.
- Detection integrated into `persistScannedCourse()` so both wizard and one-shot import flows benefit. The `overrides` parameter now accepts an optional `authorId` for explicit override.
- After persist, the detected author's `courseIds` array is updated to include the new course.
- Success toast includes ` by AuthorName` when detection succeeds (AC4).
- Detection failure is fully silent — import continues without authorId (AC5).

## Testing Notes

- 15 unit tests for `detectAuthorFromFolderName()` covering separators, edge cases, name validation.
- 7 integration tests for `matchOrCreateAuthor()` with fake-indexeddb.
- 3 new tests in `courseImport.test.ts` verifying end-to-end detection, toast, and fallback.
- 2 E2E regression tests verifying seeded author/course data on Authors page.

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

Skipped — no UI changes detected in this story (no files changed in `src/app/pages/` or `src/app/components/`).

## Code Review Feedback

**2 HIGH, 1 MEDIUM, 2 NITS** — No blockers.

- **[HIGH]** Race condition in `matchOrCreateAuthor()` (read-then-write without transaction) — mitigated by single-import UX pattern. Fix: wrap in `db.transaction('rw', db.authors, ...)`.
- **[HIGH]** `db.authors.toArray()` loads all authors for linear scan — acceptable for personal app scale (<100 authors).
- **[MEDIUM]** Author `createdAt` and course `importedAt` may differ by milliseconds (cosmetic).
- **[NIT]** Comment says "slug-based ID" but code uses UUID.
- **[NIT]** `seedAuthors` uses `Record<string, unknown>[]` (consistent with other helpers but untyped).

Full report: `docs/reviews/code/code-review-2026-03-25-e25-s04.md`

## Web Design Guidelines Review

Skipped — no UI changes in this story.

## Challenges and Lessons Learned

- **Pure function + DB layer separation** — Splitting detection into a pure `detectAuthorFromFolderName()` and an async `matchOrCreateAuthor()` made unit testing straightforward: the pure function got 15 fast tests with zero mocking, while the integration tests only needed fake-indexeddb.
- **Unicode-aware name validation** — Used `\p{L}` Unicode property escape in the person name regex to support non-ASCII author names (accented characters, CJK names). This required the `/u` flag on the regex.
- **Non-critical author detection** — Wrapping the detection flow in try/catch within `persistScannedCourse()` ensures import never fails due to author detection bugs. This "best-effort" pattern (log + continue) is appropriate for enrichment features that shouldn't block core functionality.
- **Separator priority order** — The `SEPARATORS` array uses ordered iteration (` - `, ` — `, ` – `) with first-match-wins semantics. This avoids ambiguity when multiple separators appear in a folder name.
- **Reusing seed helpers** — Added `seedAuthors()` to the shared seed-helpers module rather than writing inline IDB seeding in the E2E spec, keeping test code DRY and consistent with established patterns.
