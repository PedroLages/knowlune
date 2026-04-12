# Adversarial Review — Epic 110: Library Organization (Shelves, Series, Queue)

**Review Date:** 2026-04-12  
**Reviewer:** Adversarial (cynical) code review — Claude Sonnet 4.6  
**Stories Covered:** E110-S01 (Smart Shelves), E110-S02 (Series Grouping), E110-S03 (Reading Queue)  
**Commits Reviewed:** `e39c8ac6~1..63186e73` (~64 files changed)  
**Methodology:** Source code inspection, review report cross-reference, test gap analysis — assume problems exist, look for them

---

## Summary Verdict

**This epic shipped three interconnected features with good bones but real structural problems that the automated review swarm soft-pedalled or missed entirely.** The existing review agents generated polished, moderately complementary reports. This review assumes the opposite: that praise is provisional until disproved.

**Issue count: 20** | Blockers: 0 | High: 5 | Medium: 9 | Low: 6

---

## Findings

### [High] 1 — Design-review HIGH findings merged unfixed (process failure)

**Files:** `src/app/components/library/ReadingQueue.tsx:86-93`, `ReadingQueue.tsx:119-127`

The design review agent flagged two HIGH-priority findings for E110-S03:

- **HIGH-1**: Drag handle and remove buttons have 24×24px touch targets (minimum required: 44×44px). On mobile — the primary form factor for personal reading management — users will consistently miss-tap controls, especially the irreversible remove action.
- **HIGH-2**: Both buttons missing `type="button"`, making them latent form-submit bombs if a form context is ever added as a parent.

**Evidence of non-remediation:** Examining the commit sequence after the design review (`cc6a61ee style: auto-fix Prettier`, `162853dd fix: add data-testid to queue count badge`), there are zero commits addressing accessibility or touch targets. The final `ReadingQueue.tsx` has `p-1` padding (not `p-2.5` or `min-h-[44px]`) and no `type="button"` on either button. The review generated findings, marked the story reviewed, and merged without applying the fixes. This is a process failure: reviews exist to gate merges, not document post-hoc complaints.

**Impact:** Every mobile user reordering or removing queue items will hit this daily. Remove is irreversible.

---

### [High] 2 — Series grouping corrupts progress counts under active filters

**Files:** `src/stores/useBookStore.ts:517-572`, `src/app/components/library/LocalSeriesView.tsx:32`

`getBooksBySeries()` calls `getFilteredBooks()` internally, which applies ALL active filters: search, status, format, author, genre, and shelf. This means:

- Search for "Foundation" → series view shows only matching books, so the Foundation series appears with 1 of 1 books (even if you have 4 in the series)
- Filter by "Reading" status → every series's progress count only reflects currently-reading books, not the true series completion rate
- Filter by "Favorites" shelf → series groups only include books on that shelf

**Result:** The "completed/total" progress display in `LocalSeriesCard` is meaningless under any active filter. A user filtering to find a book to continue will see "2 of 2 complete" for a 5-book series because only 2 match the filter. The series view is supposed to show the full picture of a series, not a filtered fragment of it.

**Fix:** `getBooksBySeries` should operate on `get().books` (unfiltered) and then let the caller decide whether to apply filter-based exclusions to series groups — or accept that series view implies "show all series, ignore most filters except source."

---

### [High] 3 — `filteredBookIds` prop defeats `useMemo` in LocalSeriesView (always recomputes)

**Files:** `src/app/pages/Library.tsx:656`, `src/app/components/library/LocalSeriesView.tsx:32`

```tsx
// Library.tsx:656
<LocalSeriesView
  getBooksBySeries={getBooksBySeries}
  onEdit={setEditingBook}
  filteredBookIds={filteredBooks.map(b => b.id)}  // ← new array every render
/>
```

```tsx
// LocalSeriesView.tsx:32
const { groups, ungrouped } = useMemo(() => getBooksBySeries(), [filteredBookIds])
```

`filteredBooks.map(b => b.id)` creates a new array reference on every render. `useMemo` uses `Object.is` for dependency comparison. The memo dependency is a new array every time, so the memo ALWAYS recomputes. The memoization has zero effect. Every Library.tsx re-render (which is frequent — keyboard shortcuts, dialog state, ABS sync status, online status) triggers a full `getBooksBySeries()` recomputation.

**The comment in LocalSeriesView.tsx** says `getBooksBySeries` is "intentionally omitted from deps — it's a stable store selector reference." This is self-contradicting: the actual trigger is `filteredBookIds`, which is not stable.

**Fix:** Either pass `books` directly and do the map internally, or use `useMemo` in Library.tsx to stabilize the ID array.

---

### [High] 4 — Missing E2E test for AC-4 (drag-and-drop reorder)

**Files:** `tests/e2e/regression/story-e110-s03.spec.ts`

The Reading Queue story has 7 acceptance criteria. The E2E spec covers: empty state (AC-1), add via dropdown (AC-2), remove via button (AC-3), persistence (AC-5), display fields (AC-6), auto-remove on completion (AC-7), and badge count (AC-1).

**AC-4 — "Users can reorder books in the queue via drag-and-drop" — has zero test coverage.**

The QA report notes "Pointer event drag tested" in exploratory QA, but that was a manual one-off in the review session, not a regression test. The core differentiating UX of this feature (drag ordering persists across reloads) is entirely untested. Any regression in `reorderQueue`, `sortOrder` persistence, or dnd-kit integration will be invisible to CI.

**Why this matters specifically:** The `sortOrder` normalization logic (reassigning sequential integers 0, 1, 2... after each reorder) is a non-trivial invariant. A bug here results in non-deterministic queue ordering on reload — the exact failure mode the position field was meant to prevent.

---

### [High] 5 — Series name case-sensitivity creates duplicate groups

**Files:** `src/stores/useBookStore.ts:519-529`

```ts
const seriesMap = new Map<string, Book[]>()
// ...
if (book.series) {
  const existing = seriesMap.get(book.series)  // exact string key match
```

The Map uses the `book.series` string as an exact key. "Foundation" and "foundation" and "FOUNDATION" create three separate series groups. ABS sync populates `series` from ABS metadata, and manual entry goes through `BookMetadataEditor`. If a user edits one book's series as "Harry Potter" and ABS syncs another as "harry potter", they'll appear in separate groups despite being the same series.

**No normalization happens at storage time or grouping time.** The `BookMetadataEditor` text input accepts any casing.

**Fix:** Normalize series name on input (trim + consistent casing) or normalize the Map key during grouping.

---

### [Medium] 6 — `createShelf` is not optimistic (inconsistent with rename/delete)

**Files:** `src/stores/useShelfStore.ts:67-98`

`renameShelf` and `deleteShelf` both optimistically update state before the DB write and rollback on failure. `createShelf` does not: it writes to DB first, then updates state. The result is a visible delay between submitting a new shelf name and it appearing in the list. On slow IndexedDB (mobile, first-load), this feels broken — the form appears to do nothing, then the shelf pops in.

This inconsistency also makes `createShelf` harder to test and violates the stated architecture principle ("no optimistic UI updates before persistence" from the checklist, which means _state should follow DB_, but the pattern used throughout is optimistic-first for CRUD operations). The checklist rule is routinely violated across the epic — the real pattern is optimistic-first-then-rollback.

---

### [Medium] 7 — `removeBookFromShelf` has no success toast (silent)

**Files:** `src/stores/useShelfStore.ts:203-221`

`addBookToShelf` shows `toast.success('Added to "${shelf.name}"')`. `removeBookFromShelf` shows nothing on success — it's silent. A user removing a book from a shelf via the context menu gets no confirmation the action worked. This is especially confusing in the submenu, where the checkmark disappears but there's no toast to anchor the interaction.

`addToQueue` shows "Added to reading queue." `removeFromQueue` (in the ReadingQueue `removeFromQueue` store action) is also silent. Two of four queue/shelf mutation directions provide no user feedback.

---

### [Medium] 8 — `localSeriesView` resets to grid on every navigation away

**Files:** `src/stores/useBookStore.ts:89`, `src/stores/useBookStore.ts:193`

```ts
localSeriesView: false,  // initial state — no persistence
```

The series view toggle is in-memory only. Every time the user navigates to another page and returns to `/library`, they're back in grid view. Switching to series view requires 1 extra click per library visit. The review tracking doc acknowledged this as a LOW issue (KI-057/KI-058 scope), but combined with the frequency of library visits for a reading app, this is a significant UX regression.

`libraryView` (grid/list) persists via Zustand state but also resets on reload. Neither view preference survives page reloads or navigation, despite `localStorage` being readily available for this use case.

---

### [Medium] 9 — `isLoaded` guards never reset — stale state on tab re-focus

**Files:** `src/stores/useShelfStore.ts:49`, `src/stores/useReadingQueueStore.ts:39`

Both stores guard against redundant loads:
```ts
loadQueue: async () => {
  if (get().isLoaded) return
```

Once `isLoaded = true`, the store never re-fetches from IndexedDB. There's no mechanism to reset this guard. If the user:
1. Opens the app in two tabs
2. Adds a shelf in Tab A
3. Switches to Tab B (which already loaded with `isLoaded: true`)

Tab B will never see the new shelf without a full page reload. Dexie supports multi-tab change events (`db.on('changes')`) but this is not wired up.

The code review agent flagged this at confidence 72% for the queue store. It was not flagged for the shelf store, where the same pattern exists.

---

### [Medium] 10 — `BookContextMenu` subscribes all instances to queue store — mass re-renders

**Files:** `src/app/components/library/BookContextMenu.tsx:116-118`

```ts
const isInQueue = useReadingQueueStore(s => s.isInQueue)
const addToQueue = useReadingQueueStore(s => s.addToQueue)
const removeFromQueue = useReadingQueueStore(s => s.removeFromQueue)
```

`isInQueue` is a function; subscribing to it with `useReadingQueueStore(s => s.isInQueue)` subscribes this component to any store state change. Every `BookContextMenu` in the grid — up to 50+ visible books — will re-render whenever any queue operation occurs (adding/removing any book). Adding a single book to the queue re-renders every context menu in the grid.

The same issue applies to the shelf store: `getSortedShelves = useShelfStore(s => s.getSortedShelves)` is called on every render without memoization, creating a new sorted array each time.

**With 50 visible books, a single "Add to Queue" click triggers 50+ unnecessary re-renders.**

---

### [Medium] 11 — Library.tsx is 833 lines — blew past the 500-line threshold, still growing

**Files:** `src/app/pages/Library.tsx`

The review tracking doc noted "Library.tsx 761 lines — exceeds 500-line threshold" as a MEDIUM finding during S02. The S02 fix extracted `LocalSeriesView` into its own file. The S03 additions (ReadingQueue, ShelfManager wiring, queue event listener, shelf load effect, queue load effect) grew it to 833 lines. The extraction of `LocalSeriesView` saved ~70 lines; the S03 additions added ~100.

The file now orchestrates: ABS sync, 8 separate useEffect mount hooks (loadBooks, loadShelves, loadQueue, loadGoal, loadCatalogs, loadAbsServers, ABS catalog sync, yearly goal celebration), drag-drop empty state, 6 dialog states, 3 view mode toggles (local: grid/list/series; ABS: grid/series/collections), keyboard shortcuts, and all rendering conditions. This is a god component accumulating every feature.

---

### [Medium] 12 — `getFilteredBooks` calls `useShelfStore.getState()` — cross-store coupling during reads

**Files:** `src/stores/useBookStore.ts:253-256`

```ts
if (filters.shelfId) {
  const bookIds = new Set(useShelfStore.getState().getBooksOnShelf(filters.shelfId))
  result = result.filter(b => bookIds.has(b.id))
}
```

`useBookStore.getFilteredBooks()` reaches into `useShelfStore.getState()` directly. This means:
- If `useShelfStore` hasn't loaded yet (timing race), the shelf filter silently returns an empty set (all books filtered out)
- `useBookStore` now has an implicit runtime dependency on `useShelfStore` being initialized first
- Cross-store state access via `getState()` bypasses Zustand's reactivity: if `bookShelves` changes in `useShelfStore`, `getFilteredBooks()` doesn't re-run automatically

The `deleteBook` cascade also calls `useShelfStore.getState()` and `useReadingQueueStore.getState()` directly. This pattern creates an undeclared dependency graph between stores.

---

### [Medium] 13 — Reading Queue empty state is permanent UI noise

**Files:** `src/app/pages/Library.tsx:467-468`, `src/app/components/library/ReadingQueue.tsx:191-203`

```tsx
{/* Reading Queue — always visible when books exist (E110-S03 AC-1) */}
{books.length > 0 && <ReadingQueue />}
```

The queue section appears at the top of the Library page regardless of whether the user ever uses it. When the queue is empty, users who don't want a queue see:
- A dashed-border empty state box
- A ListOrdered icon
- Instructional text: "Your reading queue is empty. Right-click a book..."

This widget occupies permanent vertical space above all books on every library visit. There is no way to hide, collapse, or dismiss it. A user who prefers their library without a queue panel has no recourse. The AC says "A 'Reading Queue' section is **visible** on the Library page" but that doesn't mandate it always takes up prime real estate when empty.

**Compare:** The series view only appears when explicitly selected. The queue empty state is always there.

---

### [Low] 14 — `DEFAULT_SHELVES` icon field is dead data

**Files:** `src/stores/useShelfStore.ts:20-24`, `src/data/types.ts:648`

```ts
const DEFAULT_SHELVES: Shelf[] = [
  { id: 'shelf-favorites', name: 'Favorites', icon: 'Heart', ... },
  { id: 'shelf-currently-reading', name: 'Currently Reading', icon: 'BookOpen', ... },
  { id: 'shelf-want-to-read', name: 'Want to Read', icon: 'Bookmark', ... },
]
```

The `icon` field is stored in IndexedDB for every shelf. `ShelfManager.tsx` renders shelf names and action buttons — no icon rendering anywhere. `FilterSidebar.tsx` renders shelf names — no icon. `BookContextMenu` renders shelf names in the submenu — no icon. The `Shelf` type declares `icon?: string` as optional, so new custom shelves don't even have an icon. This data is stored, persisted in IndexedDB, and never displayed.

---

### [Low] 15 — `const sorted = shelves` alias in ShelfManager is misleading

**Files:** `src/app/components/library/ShelfManager.tsx:70-71`

```ts
const sorted = shelves  // ← alias, no actual sort here
const shelfToDelete = shelves.find(s => s.id === deleteConfirmId)
```

`shelves` is already the sorted result of `getSortedShelves()` (called at line 40). The `const sorted = shelves` assignment on line 70 is a no-op alias that implies sorting happens here. This is a reading comprehension trap. The render loop uses `sorted.map(...)` which makes it look like the sort is in this component. Rename to `const shelfList = shelves` or just use `shelves` directly.

---

### [Low] 16 — Series key instability loses expand state on rename

**Files:** `src/app/components/library/LocalSeriesView.tsx:57`

```tsx
{groups.map(group => (
  <LocalSeriesCard key={group.name} group={group} />
))}
```

If a user renames a book's series (via BookMetadataEditor), the series group key changes. React unmounts the old `LocalSeriesCard` and mounts a new one. Any expanded card collapses. With the `isExpanded` state owned by `LocalSeriesCard`, renaming a series while it's expanded causes a jarring collapse. A stable key (e.g., a hash of the name) would be semantically equivalent and preserve state across renames.

---

### [Low] 17 — Shelf creation missing max-shelf guard

**Files:** `src/stores/useShelfStore.ts:67-98`

`createShelf` validates against empty names and duplicate names, but there's no maximum shelf count guard. A user (or an automation script) can create unlimited shelves. With 1000 shelves, the ShelfManager dialog becomes unusable (fixed height `max-h-[320px]`, scrollable, but 1000 items is technically fine via the `overflow-y-auto` container). More critically, the shelf submenu in `BookContextMenu` has no height cap and no virtualization — it would render all 1000 shelves.

This is a personal app, so the realistic risk is low, but adding a soft limit (e.g., `>= 50`) with a toast would be minimal effort.

---

### [Low] 18 — `review_gates_passed: []` in E110-S03 story file — gates not recorded

**Files:** `docs/implementation-artifacts/stories/E110-S03.md:9`

```yaml
review_gates_passed: []
```

The E110-S01 story file has `review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, ...]`. E110-S03's field is empty. Yet the story is marked `reviewed: true` and merged via PR #300. 

Either the gate tracking was skipped (process failure) or the field was never populated (tooling failure). Combined with finding [High]-1 (design review HIGH findings unaddressed), this suggests the review workflow ran but tracking wasn't completed. An empty `review_gates_passed` leaves the audit trail incomplete.

---

### [Low] 19 — 8 separate `useEffect` mount hooks in Library.tsx 

**Files:** `src/app/pages/Library.tsx:153-240`

Library.tsx has 8 separate `useEffect` hooks that are all conceptually "load on mount":
- `loadShelves` (153)
- `loadQueue` (158)
- Event bus subscription for `book:finished` (164)
- `loadGoal` (171)
- `loadCatalogs` (176)
- `loadAbsServers` (182)
- ABS catalog sync trigger (190)
- Yearly goal celebration event bus (228)

Six of these have `[loadX]` as the sole dependency, where `loadX` is a stable Zustand function reference that never changes. These effects run once on mount — identical behavior to `[]`. The `[loadX]` deps provide false safety (implying the effect re-runs if `loadX` changes, which never happens). This is cargo-cult dependency tracking.

These could be consolidated into 2-3 effects by concern, reducing cognitive overhead when reading the component.

---

### [Low] 20 — `getSortedShelves()` called twice per render in both ShelfManager and BookContextMenu

**Files:** `src/app/components/library/ShelfManager.tsx:39-40`, `src/app/components/library/BookContextMenu.tsx:111-112`

In `BookContextMenu.tsx`:
```ts
const getSortedShelves = useShelfStore(s => s.getSortedShelves)
const shelves = getSortedShelves()  // called on every render, creates new array
```

`getSortedShelves` uses `[...get().shelves].sort(...)` — it creates a new sorted copy on every call. This is called in `BookContextMenu` on every render. With 50 books in the grid, 50 `BookContextMenu` instances each call `getSortedShelves()` on every re-render. With 30 shelves, this is 50 × 30 = 1500 comparisons per re-render cycle.

The `useMemo` fix is trivial: `const shelves = useMemo(() => getSortedShelves(), [getSortedShelves])`. The code review agent noted this pattern as NIT-1 (`bookMap` in ReadingQueue) but missed the more impactful version in BookContextMenu.

---

## Summary Table

| # | Severity | Title | File |
|---|----------|-------|------|
| 1 | **[High]** | Design-review HIGH findings merged unfixed | ReadingQueue.tsx |
| 2 | **[High]** | Series progress counts corrupt under active filters | useBookStore.ts |
| 3 | **[High]** | filteredBookIds prop defeats useMemo in LocalSeriesView | LocalSeriesView.tsx |
| 4 | **[High]** | Missing E2E test for AC-4 (drag-and-drop reorder) | story-e110-s03.spec.ts |
| 5 | **[High]** | Series names are case-sensitive — duplicate groups | useBookStore.ts |
| 6 | [Medium] | createShelf is not optimistic (inconsistent) | useShelfStore.ts |
| 7 | [Medium] | removeBookFromShelf has no success toast | useShelfStore.ts |
| 8 | [Medium] | localSeriesView resets on every navigation | useBookStore.ts |
| 9 | [Medium] | isLoaded guards never reset — stale on tab re-focus | useShelfStore.ts, useReadingQueueStore.ts |
| 10 | [Medium] | BookContextMenu mass re-renders on queue changes | BookContextMenu.tsx |
| 11 | [Medium] | Library.tsx is 833 lines — still growing | Library.tsx |
| 12 | [Medium] | getFilteredBooks cross-calls useShelfStore.getState() | useBookStore.ts |
| 13 | [Medium] | Reading Queue empty state is permanent UI noise | Library.tsx, ReadingQueue.tsx |
| 14 | [Low] | DEFAULT_SHELVES icon field is dead data | useShelfStore.ts |
| 15 | [Low] | const sorted = shelves alias is misleading | ShelfManager.tsx |
| 16 | [Low] | Series key instability loses expand state on rename | LocalSeriesView.tsx |
| 17 | [Low] | Shelf creation has no max-count guard | useShelfStore.ts |
| 18 | [Low] | review_gates_passed: [] — gates not recorded | E110-S03.md |
| 19 | [Low] | 8 useEffect mount hooks — cargo-cult deps | Library.tsx |
| 20 | [Low] | getSortedShelves() unMemoized in BookContextMenu | BookContextMenu.tsx |

---

## What the Existing Reviews Missed

The automated review swarm generated technically accurate but incomplete coverage:

- **Code review (code-review-2026-04-12):** Focused on E110-S03 only. Identified `bulkPut` opportunity and `bookMap` memoization as MEDIUMs/NITs. Missed: series filter contamination (finding #2), filteredBookIds memoization failure (#3), mass re-render pattern (#10), cross-store coupling (#12).
- **Design review:** Correctly found HIGH-1 (touch targets) and HIGH-2 (type="button"). These were NOT fixed before merge. Review reports are advisory only if no gate enforces acting on them.
- **Exploratory QA:** Noted missing landmark role (already in design review). Confirmed AC-7 (auto-remove) works. Did not test drag-and-drop with persistence verification.
- **GLM adversarial (E110-S02-R4):** Reviewed E110-S02 only. Found the NaN guard and duplicate toggle issues that were mostly addressed.

**Pattern:** Review agents are generating findings in isolation per story. No agent synthesized cross-story issues (series + filter interaction, cross-store coupling accumulation, Library.tsx growth trajectory across 3 stories).

---

## Recommended Fix Priority

1. **Fix touch targets and `type="button"` in ReadingQueue** — pre-existing unfixed HIGH findings, 10 min effort
2. **Add E2E test for AC-4 (drag reorder with persistence)** — core feature with no regression test
3. **Fix series case-sensitivity** — normalize `book.series` on write or group by `.toLowerCase()` key
4. **Fix series view to use unfiltered books** — the correct design: series view shows full series, not filtered fragments
5. **Fix `filteredBookIds` prop** — memoize in Library.tsx or pass books directly

The Medium/Low issues can be tracked as tech debt items for a future library polish pass.
