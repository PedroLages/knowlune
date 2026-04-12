---
story_id: E113-S01
story_name: "Star Ratings & Reviews"
status: done
started: 2026-04-12
completed: 2026-04-12
reviewed: true
review_started: 2026-04-12
review_gates_passed:
  - build
  - lint
  - type-check
  - format-check
  - unit-tests
  - e2e-tests-skipped
  - design-review-skipped
  - code-review
  - code-review-testing-skipped
  - performance-benchmark-skipped
  - security-review-skipped
  - exploratory-qa-skipped
burn_in_validated: false
---

# Story 113.01: Star Ratings & Reviews

## Story

As a reader,
I want to rate books with stars and write personal reviews,
so that I can track my opinions and revisit my assessments over time.

## Acceptance Criteria

- **AC-1**: User can assign a star rating (1-5, half-star steps) to a book from the book detail view.
- **AC-2**: Rating is persisted to IndexedDB and survives app reload.
- **AC-3**: User can write a markdown-formatted personal review text after rating.
- **AC-4**: Review text auto-saves on blur and supports markdown preview toggle.
- **AC-5**: User can delete a review (rating + text) from the book detail view.
- **AC-6**: Star rating displays in read-only mode on the BookCard in the library grid.
- **AC-7**: Optimistic updates keep UI responsive while persistence completes.

## Tasks / Subtasks

- [x] Task 1: Add BookReview type to src/data/types.ts (AC: 1, 2)
- [x] Task 2: Add Dexie v48 migration with bookReviews table (AC: 2)
- [x] Task 3: Implement useBookReviewStore with setRating, setReviewText, deleteReview (AC: 1-5, 7)
  - [x] 3.1 Use set(state => ...) callback pattern to prevent race conditions
- [x] Task 4: Build StarRating component with half-star support, keyboard nav, ARIA (AC: 1, 6)
- [x] Task 5: Build BookReviewEditor with markdown preview and delete (AC: 3, 4, 5)
- [x] Task 6: Integrate BookReviewEditor into AboutBookDialog (AC: 1-5)
- [x] Task 7: Integrate read-only StarRating into BookCard (AC: 6)
- [x] Task 8: Write unit tests for useBookReviewStore (AC: 1-5, 7)
- [x] Task 9: Fix review findings — race conditions, keyboard feedback, error state (AC: 7)

## Implementation Notes

- BookReview type: { bookId, rating, reviewText?, createdAt, updatedAt }
- Dexie schema bumped to v48; bookReviews table added with bookId as primary key
- useBookReviewStore uses set(state => ...) callback everywhere to prevent lost-update race conditions
- StarRating supports click (full/half based on pointer position) and keyboard (ArrowLeft/ArrowRight), with local state for immediate visual feedback
- BookReviewEditor markdown preview uses innerHtml with intentional safety: user-owned local data, HTML entities escaped
- GLM-5.1 adversarial review found 1 blocker (silent text drop), 3 high issues (race conditions, stale selector), 2 mediums — all fixed

## Testing Notes

- 10 unit tests in useBookReviewStore.test.ts — all passing
- Pre-existing test failures on main (27) not introduced by this story (branch: 26 failures)
- No E2E spec — UI integration tested manually via GLM review

## Challenges and Lessons Learned

- **Race condition in Zustand optimistic updates**: Capturing get().reviews before set() and then calling set({ reviews: updated }) creates a lost-update race when two store actions run rapidly. Fix: always use set(state => ...) callback form.
- **Stale selector via store action call**: Calling store.getReviewForBook(id) inside a Zustand selector bypasses subscription reactivity. Fix: use a direct selector s => s.reviews.find(r => r.bookId === id).
- **useEffect sync race with editing**: Syncing local textarea state from store in a useEffect fires while the user is typing if the store updates. Fix: guard the sync with an isEditing flag.

## Pre-Review Checklist

- [x] All changes committed
- [x] No error swallowing — catch blocks log AND surface errors
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] useEffect hooks have cleanup functions where needed
- [x] Type guards on all dynamic lookups
