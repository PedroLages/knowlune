# NFR Assessment — Epic 110: Library Organization (Shelves, Series, Queue)

**Date:** 2026-04-12
**Epic:** E110 — Library Organization: Smart Shelves, Series Grouping, Reading Queue
**Stories:** E110-S01 (Smart Shelves), E110-S02 (Series Grouping), E110-S03 (Reading Queue)
**PRs:** #297, #299, #300

---

## NFR Category Ratings

| Category | Rating | Summary |
|----------|--------|---------|
| Performance | **PASS** | No new large deps; minor memoization gap in ReadingQueue; Library.tsx overlength |
| Security | **PASS** | No XSS vectors; proper input validation; safe ID generation |
| Accessibility | **PASS** | Strong ARIA patterns; keyboard DnD; minor touch-target gap in ShelfManager |
| Reliability | **PASS** | Optimistic updates + rollback; transactional writes; cascade on book deletion; auto-queue removal |

---

## 1. Performance — PASS

### Bundle Size
- Main bundle: `index-W2aGQuKM.js` — **828 kB / gzip 239 kB** (stable vs. pre-E110)
- `@dnd-kit/*` packages were **pre-existing** (introduced before E110). No new bundle cost from E110 drag-and-drop.
- New Zustand stores (`useShelfStore`, `useReadingQueueStore`) contribute negligible JS weight.
- No new large third-party dependencies introduced.

### Render Performance
- `LocalSeriesCard` correctly wrapped with `React.memo()`.
- `LocalSeriesView` uses `useMemo(() => getBooksBySeries(), [filteredBookIds])`.
- `bookMap` in `ReadingQueue.tsx:163` recreates on every render (no `useMemo`). Acceptable for typical library sizes (< 500 books).
- `getSortedShelves()` creates a sorted copy on every call; minor at expected shelf counts (< 20).

### DB Write Performance
- `reorderQueue` uses `db.transaction('rw')` for O(n) atomic writes — acceptable for queue sizes < 50.
- `deleteShelf` uses `db.transaction('rw', db.shelves, db.bookShelves)` — atomic multi-table delete.

### File Size
- `Library.tsx`: **833 lines** — exceeds the 500-line ESLint threshold. Pre-existing issue, not introduced by E110.

---

## 2. Security — PASS

### XSS / Injection
- No raw HTML injection patterns found in Epic 110 code.
- User-controlled text (shelf names, series metadata) rendered exclusively as React text nodes — JSX escaping applies automatically.
- Shelf name used in `data-testid` via `.toLowerCase().replace(/\s+/g, '-')` — test attribute only, no injection risk.

### Input Validation
- `createShelf`: trims whitespace, rejects empty names, case-insensitive uniqueness check.
- `renameShelf`: same + guards against renaming default shelves.
- `deleteShelf`: guards against deleting default shelves.
- `addToQueue` / `addBookToShelf`: idempotent — no duplicate inserts.

### ID Generation
- All new entity IDs use `crypto.randomUUID()` — cryptographically random, collision-safe.

### Data Handling
- No new external network calls introduced by E110 (all data is local Dexie + Zustand).
- Series/seriesSequence fields are user-editable metadata — rendered as text, not executed.

---

## 3. Accessibility — PASS

### ReadingQueue (E110-S03)
- `role="list"` + `aria-label="Reading queue"` on queue container.
- `role="listitem"` + `aria-roledescription="sortable"` on each item — correct ARIA DnD pattern.
- Drag handle: `aria-label` with book title; remove button: `aria-label` with book title.
- **Keyboard drag-and-drop**: `KeyboardSensor` with `sortableKeyboardCoordinates` — reorderable without pointer.
- Decorative icons: `aria-hidden="true"` throughout.

### LocalSeriesCard (E110-S02)
- Full accordion ARIA: `aria-expanded`, `aria-controls`, `aria-label` on toggle button.
- `useId()` for collision-safe `id`/`aria-controls` pairs.
- `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset` — keyboard focus ring.
- Cover images: `alt=""` (decorative, correctly empty); `loading="lazy"`.

### ShelfManager (E110-S01)
- All icon-only buttons have `aria-label`.
- Create shelf button: `min-h-[44px] min-w-[44px]` — meets touch target.
- **MINOR:** Edit/Delete buttons: `min-h-[32px] min-w-[32px]` — below 44px guideline. Desktop-only dialog context, low impact.
- Delete confirmation uses accessible `AlertDialog` pattern.

### Progress Bars
- Progress bars in ReadingQueue/LocalSeriesCard are decorative — lack `role="progressbar"`. WCAG compliant as decorative elements, but adding the role would improve screen reader experience.

---

## 4. Reliability — PASS

### Error Handling
- All store operations: **optimistic update → DB write → rollback on failure**.
- All `catch` blocks surface `toast.error()` — ESLint `error-handling/no-silent-catch` compliance verified.
- `renameShelf` rollback reloads from DB rather than guessing prior state.

### Data Integrity
- `deleteShelf`: transactional — atomically deletes bookShelves join records + shelf row. No orphans.
- `reorderQueue`: transactional — all sort order updates succeed atomically.
- `deleteBook` cascades to both stores:
  - `useShelfStore.getState().removeAllBookEntries(bookId)`
  - `useReadingQueueStore.getState().removeAllBookEntries(bookId)`
- **Auto-removal on completion** (E110-S03 AC-7): `appEventBus.on('book:finished')` calls `removeFromQueue` — decoupled, no direct store coupling.

### Schema Migrations
- `CHECKPOINT_VERSION = 46` — current.
- `CHECKPOINT_SCHEMA` includes all three new tables: `shelves`, `bookShelves`, `readingQueue`.
- Incremental chain: v44 (shelves + bookShelves), v45 (series fields on books), v46 (readingQueue).
- Fresh installs get single `db.version(46)` — no migration penalty.

### Edge Cases
- `addToQueue` / `addBookToShelf`: idempotent checks before insert.
- `Math.max(-1, ...entries.map(e => e.sortOrder))` handles empty queue correctly.
- Series sort NaN guard: `isNaN(rawA) ? Infinity : rawA` — non-numeric sequences sort to end.
- `validEntries` filter removes queue entries for deleted books (race condition safety).
- Progress clamped via `Math.min(100, Math.max(0, book.progress))`.

### Test Coverage
- **S01**: `tests/e2e/regression/story-e110-s01.spec.ts` — 166 lines.
- **S02**: No dedicated regression spec. Smoke coverage in `tests/e2e/library-series.spec.ts` (92 lines, 3 tests only).
- **S03**: `tests/e2e/regression/story-e110-s03.spec.ts` — 168 lines.

---

## Summary of Findings

| # | Severity | Category | Finding |
|---|----------|----------|---------|
| 1 | LOW | Accessibility | ShelfManager edit/delete buttons: 32px touch target. Desktop-only dialog. |
| 2 | LOW | Accessibility | Progress bars lack `role="progressbar"`. WCAG compliant as decorative. |
| 3 | LOW | Reliability | E110-S02 lacks dedicated E2E regression spec (smoke only). |
| 4 | INFO | Performance | `bookMap` recreates on every render in ReadingQueue (no `useMemo`). Acceptable at scale. |
| 5 | INFO | Performance | `Library.tsx` at 833 lines exceeds 500-line threshold (pre-existing). |

**No BLOCKER or HIGH findings.**

---

## Disposition

| Finding | Action |
|---------|--------|
| #1 Touch targets | Future epic — desktop context, low impact |
| #2 Progress bar ARIA | Future epic — decorative, WCAG exempt |
| #3 S02 test gap | Add regression spec for series metadata editing and filter scenarios |
| #4 bookMap memoization | Add `useMemo` during next Library.tsx refactor |
| #5 Library.tsx size | Dedicated refactor story to split page component |
