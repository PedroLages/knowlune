---
story_id: E109-S05
story_name: "Cross-book Search"
status: done
started: 2026-04-11
completed: 2026-04-11
reviewed: true
review_started: 2026-04-11
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
burn_in_validated: false
---

# Story 109.05: Cross-book Search

## Story

As a reader,
I want to search across all my highlights and vocabulary from any book,
so that I can quickly find knowledge I've captured regardless of which book it came from.

## Acceptance Criteria

- AC1: Search input accepts free-text query and filters highlights and vocabulary in real-time (debounced)
- AC2: Results are grouped by book with book title visible
- AC3: Filter tabs allow switching between All / Highlights / Vocabulary result types
- AC4: Each result links to the source book's annotation/reader view
- AC5: Empty state shown when no results match the query
- AC6: Search is case-insensitive and matches partial words

## Tasks / Subtasks

- [x] Task 1: Create SearchAnnotations page with debounced search input (AC: 1, 6)
- [x] Task 2: Implement IndexedDB query across highlights and vocabulary (AC: 1, 6)
- [x] Task 3: Group results by book title (AC: 2)
- [x] Task 4: Add filter tabs (All / Highlights / Vocabulary) (AC: 3)
- [x] Task 5: Add navigation links per result (AC: 4)
- [x] Task 6: Implement empty state (AC: 5)
- [x] Task 7: Register route in routes.tsx (AC: 1)
- [x] Task 8: Write E2E tests (AC: 1–6)
- [x] Task 9: Seed helper additions for books, highlights, vocabulary (AC: 1–6)

## Implementation Notes

- New page: `src/app/pages/SearchAnnotations.tsx`
- Route added: `/search-annotations` in `src/app/routes.tsx`
- Debounced search (300ms) prevents excessive Dexie queries
- Uses `useLiveQuery` from dexie-react-hooks for reactive results
- Results grouped client-side by bookId after fetching all matching items
- Filter tabs implemented with shadcn/ui Tabs component

## Testing Notes

- E2E spec: `tests/e2e/story-e109-s05.spec.ts`
- Seeds two books (Deep Work, Atomic Habits) with highlights and vocabulary
- Tests filter tab switching, empty state, and cross-book grouping
- Uses FIXED_DATE for deterministic timestamps

## Pre-Review Checklist

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions
- [x] No optimistic UI updates before persistence
- [x] Type guards on all dynamic lookups
- [x] E2E afterEach cleanup uses `await`
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern

## Code Review Feedback

**R1 (2026-04-11) — PASS**

Issues found and fixed:
- MEDIUM: Dexie error handling missing try/catch around live query (fixed)
- LOW: Redundant ternary in result count display (fixed)
- LOW: Multi-match highlight only marked first occurrence (fixed)
- LOW: Debounced search race condition on rapid input (fixed)
- LOW: Missing aria-label on filter tab group (fixed)
- NIT: Unused import in SearchAnnotations.tsx (fixed)

## Challenges and Lessons Learned

- Dexie `useLiveQuery` requires error boundary or try/catch wrapper — raw hook errors are silent in production
- Debounce timing (300ms) is sufficient for search UX; lower values cause unnecessary DB churn
- Multi-word highlight matching needs to mark all occurrences, not just the first
