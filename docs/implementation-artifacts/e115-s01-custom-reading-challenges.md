---
story_id: E115-S01
story_name: "Custom Reading Challenges"
status: done
started: 2026-04-13
completed: 2026-04-12
reviewed: true
review_started: 2026-04-13
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests-skipped
  - design-review-skipped
  - code-review
  - code-review-testing
  - performance-benchmark-skipped
  - security-review-skipped
  - exploratory-qa-skipped
burn_in_validated: false
---

# Story 115.01: Custom Reading Challenges

## Story

As a reader,
I want to set challenges to read a certain number of books or pages,
so that I can motivate myself with reading-specific goals beyond lesson completion.

## Acceptance Criteria

- **AC-1**: Challenge creation dialog supports two new types: "books" (finish N books) and "pages" (read N pages).
- **AC-2**: Progress for "books" challenges counts books with status=finished whose finishedAt date is on or after the challenge creation date.
- **AC-3**: Progress for "pages" challenges sums pages read (totalPages × progress%) across books updated since challenge creation.
- **AC-4**: Both challenge types display correctly on the Challenges page with correct progress bars and labels.
- **AC-5**: Challenge progress is recalculated correctly on each page load.

## Tasks / Subtasks

- [x] Task 1: Add 'books' and 'pages' to ChallengeType union in src/data/types.ts (AC: 1)
- [x] Task 2: Implement calculateBooksProgress() in src/lib/challengeProgress.ts (AC: 2)
- [x] Task 3: Implement calculatePagesProgress() in src/lib/challengeProgress.ts (AC: 3)
- [x] Task 4: Add books and pages cases to calculateProgress() dispatcher (AC: 2, 3)
- [x] Task 5: Update CreateChallengeDialog to include books and pages options (AC: 1)
- [x] Task 6: Update Challenges page to display books/pages challenges with correct labels (AC: 4, 5)
- [x] Task 7: Write unit tests for calculateBooksProgress and calculatePagesProgress (AC: 2, 3)
- [x] Task 8: Fix review findings — query optimization, date extraction, JSDoc (AC: 2, 3)

## Implementation Notes

- ChallengeType extended to: `'completion' | 'time' | 'streak' | 'books' | 'pages'`
- `calculateBooksProgress`: uses Dexie `where('status').equals('finished')` index + filter by finishedAt >= createdAt
- `calculatePagesProgress`: uses Dexie `.filter()` to scope to books updated since challenge creation, then computes pages as `totalPages × progress / 100`
- Known limitation: pages progress counts current reading position, not delta since challenge start (no baseline snapshot in data model — accepted design trade-off documented in JSDoc)
- 26 unit tests added covering both calculators, edge cases (no books, zero progress, missing totalPages)

## Challenges and Lessons Learned

- Query optimization: extracting `createdAtMs` before the `.filter()` loop avoids redundant date parsing per iteration
- Dexie filter-before-toArray pattern: `db.books.filter(...).toArray()` is more efficient than loading all books and filtering in JS when Dexie index isn't usable for the full query
- Design trade-off documentation: accepted limitations (pages baseline) should be documented in JSDoc immediately, not deferred
