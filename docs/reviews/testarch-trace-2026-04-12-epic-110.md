# Testarch Trace — Epic 110: Library Organization (Shelves, Series, Queue)

**Date:** 2026-04-12
**Epic:** E110 — Library Organization — Shelves, Series, Queue
**Stories:** E110-S01 (Smart Shelves), E110-S02 (Series Grouping), E110-S03 (Reading Queue)
**Status:** All 3 stories done

---

## Traceability Matrix

| Story | AC ID | AC Description | Test File(s) | Test Name(s) | Coverage Status |
|-------|-------|----------------|--------------|--------------|-----------------|
| E110-S01 | AC-1 | Three default shelves auto-created on first library load | `tests/e2e/regression/story-e110-s01.spec.ts` | `'default shelves are created on first load'` | ✅ Covered |
| E110-S01 | AC-2 | Users can create custom shelves via Shelf Manager dialog | `tests/e2e/regression/story-e110-s01.spec.ts` | `'can create a custom shelf'` | ✅ Covered |
| E110-S01 | AC-3 | Custom shelves can be renamed in-place | `tests/e2e/regression/story-e110-s01.spec.ts` | `'can rename a custom shelf'` | ✅ Covered |
| E110-S01 | AC-4 | Custom shelves can be deleted with confirmation; default shelves cannot | `tests/e2e/regression/story-e110-s01.spec.ts` | `'can delete a custom shelf with confirmation'` | ✅ Covered |
| E110-S01 | AC-5 | Books can be added to / removed from shelves via context menu | `tests/e2e/regression/story-e110-s01.spec.ts` | `'can add book to shelf via context menu and filter by shelf'` | ✅ Covered |
| E110-S01 | AC-6 | Filter Sidebar "Shelves" section filters library to matching books | `tests/e2e/regression/story-e110-s01.spec.ts` | `'can add book to shelf via context menu and filter by shelf'` | ✅ Covered |
| E110-S01 | AC-7 | Shelves + bookShelves persisted in IndexedDB (Dexie v44) | `src/db/__tests__/schema.test.ts` | `'should have all expected tables'` (shelves, bookShelves present) | ⚠️ Partial — schema tables verified; no E2E reload/round-trip persistence test |
| E110-S02 | AC-1 | Books grouped by series name in "Series" view | `tests/e2e/library-series.spec.ts`, `src/stores/__tests__/useBookStore.test.ts` | `'series view renders when switching to series tab'`; `'groups books by series name'` | ✅ Covered |
| E110-S02 | AC-2 | Series progress "{completed} of {total}" + per-book progress shown | `src/stores/__tests__/useBookStore.test.ts` | `'computes completed count and nextUnfinishedId correctly'` | ⚠️ Partial — logic unit-tested; no E2E test verifying visual display of progress labels |
| E110-S02 | AC-3 | Tapping series card expands to show ordered books + highlights next unfinished | — | — | ❌ Gap — no unit or E2E test for expand/collapse or "Continue" badge highlight |
| E110-S02 | AC-4 | Books without series appear in "Ungrouped" section | `tests/e2e/library-series.spec.ts`, `src/stores/__tests__/useBookStore.test.ts` | `'series view shows ungrouped books alongside series groups'`; `'puts books without series into ungrouped'` | ✅ Covered |
| E110-S02 | AC-5 | Users can assign/edit series name and sequence via book metadata editor | — | — | ❌ Gap — no unit or E2E test for BookMetadataEditor series fields |
| E110-S03 | AC-1 | "Reading Queue" section visible on Library page; empty state when no books | `tests/e2e/regression/story-e110-s03.spec.ts` | `'empty state is shown when no books are queued (AC-1)'`; `'queue badge count updates as books are added and removed (AC-1)'` | ✅ Covered |
| E110-S03 | AC-2 | Users can add any book to queue via context menu | `tests/e2e/regression/story-e110-s03.spec.ts` | `'add book to queue via dropdown menu (AC-2)'` | ✅ Covered |
| E110-S03 | AC-3 | Users can remove a book from queue via remove button | `tests/e2e/regression/story-e110-s03.spec.ts` | `'remove book from queue via remove button (AC-3)'` | ✅ Covered |
| E110-S03 | AC-4 | Users can reorder books in queue via drag-and-drop | — | — | ❌ Gap — no E2E or unit test for drag-and-drop reordering |
| E110-S03 | AC-5 | Queue persists across sessions via IndexedDB (readingQueue table) | `tests/e2e/regression/story-e110-s03.spec.ts`, `src/db/__tests__/schema.test.ts` | `'queue persists across page reloads (AC-5)'`; `'should have all expected tables'` (readingQueue present) | ✅ Covered |
| E110-S03 | AC-6 | Queue shows each book's cover, title, author, and reading progress | `tests/e2e/regression/story-e110-s03.spec.ts` | `'queue shows book title, author, and progress (AC-6)'` | ✅ Covered |
| E110-S03 | AC-7 | Completing a book auto-removes it from queue | `tests/e2e/regression/story-e110-s03.spec.ts` | `'auto-removes book from queue when marked as finished (AC-7)'` | ✅ Covered |

---

## Coverage Summary

| Status | Count | ACs |
|--------|-------|-----|
| ✅ Covered | 13 | S01: AC-1–6; S02: AC-1, AC-4; S03: AC-1–3, AC-5–7 |
| ⚠️ Partial | 2 | S01: AC-7, S02: AC-2 |
| ❌ Gap | 3 | S02: AC-3, S02: AC-5, S03: AC-4 |
| **Total** | **18** | |

**Coverage rate:** 13/18 fully covered (72%); 15/18 at least partially covered (83%)

---

## Gap Analysis

### ❌ E110-S02 AC-3 — Series card expand/collapse + "next unfinished" highlight
No test verifies that clicking/tapping a `LocalSeriesCard` expands it to show all books in series order, or that the next unfinished book receives a "Continue" badge. This is the primary interactive behavior of the series view.

**Recommended fix:** Add an E2E test to `tests/e2e/regression/story-e110-s02.spec.ts` (does not yet exist) covering:
- Click on series card → books list appears in sequence order
- Next unread book has a "Continue" indicator visible

### ❌ E110-S02 AC-5 — BookMetadataEditor series fields
No test verifies that users can set or change `series` name and `seriesSequence` via the book metadata editor. The fields were added to the schema and editor, but there is no AC-level test asserting the edit flow persists correctly.

**Recommended fix:** Either a unit test for the store action that updates series fields, or an E2E test opening BookMetadataEditor, editing series name/sequence, and confirming the change is reflected in the series view.

### ❌ E110-S03 AC-4 — Drag-and-drop reorder
No test verifies drag-and-drop reordering of queue items. The implementation stores explicit `sortOrder` for persistence, but this behavior has zero test coverage. The story notes explicitly flag this as a non-obvious design decision ("drag-and-drop reordering requires persisting order explicitly").

**Recommended fix:** Add a Playwright drag-and-drop test using `page.dragAndDrop()` or the `mouse` API to reorder two queue items and verify the new order persists after a reload.

### ⚠️ E110-S01 AC-7 — Shelf persistence (schema only)
The `shelves` and `bookShelves` tables are verified present in the schema test, but no E2E test exercises a create-reload-verify cycle to confirm shelf data survives page refresh. The existing E2E tests use `seedShelves` (direct IndexedDB write) rather than create-via-UI-then-reload.

### ⚠️ E110-S02 AC-2 — Series progress display (logic only)
`useBookStore.test.ts` verifies the `getBooksBySeries` selector computes `completedCount`, `totalBooks`, and `nextUnfinishedId` correctly, but no E2E test asserts that the `LocalSeriesCard` renders the "{completed} of {total} books" text or per-book progress bars.

---

## Test Files Referenced

| File | Type | Stories Covered |
|------|------|-----------------|
| `tests/e2e/regression/story-e110-s01.spec.ts` | E2E regression | S01 AC-1–6 |
| `tests/e2e/regression/story-e110-s03.spec.ts` | E2E regression | S03 AC-1–3, AC-5–7 |
| `tests/e2e/library-series.spec.ts` | E2E smoke | S02 AC-1, AC-4 (render-level) |
| `src/stores/__tests__/useBookStore.test.ts` | Unit | S02 AC-1 (grouping), AC-2 (progress logic), AC-4 (ungrouped) |
| `src/db/__tests__/schema.test.ts` | Unit | S01 AC-7 (shelves/bookShelves tables), S03 AC-5 (readingQueue table) |

**Notable absence:** No `tests/e2e/regression/story-e110-s02.spec.ts` — Series Grouping has only smoke-level E2E coverage and unit tests for the selector logic. This is the story with the most AC gaps.
