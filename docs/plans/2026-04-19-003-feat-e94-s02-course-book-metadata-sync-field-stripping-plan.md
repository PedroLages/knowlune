---
title: "feat: Wire P2 Course, Author, and Book Stores Through Sync Engine with Field Stripping"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s02-course-book-metadata-sync-field-stripping-requirements.md
---

# feat: Wire P2 Course, Author, and Book Stores Through Sync Engine with Field Stripping

## Overview

Wire the P2 library write paths — `src/lib/courseImport.ts` (persist service), `src/stores/useCourseImportStore.ts`, `src/stores/useYouTubeImportStore.ts`, `src/stores/useAuthorStore.ts`, and `src/stores/useBookStore.ts` — through `syncableWrite` so that course imports, author profiles, and book records are enqueued for Supabase upload. All non-serializable browser API handles (`directoryHandle`, `coverImageHandle`, `fileHandle`, `photoHandle`) and the `books.source` JSONB-incompatible union field are stripped by the table registry before upload. Register P2 store refresh callbacks in `useSyncLifecycle` so downloaded records flow back into stores on sync.

## Problem Frame

P2 library tables (`importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`) are declared in the table registry with correct `stripFields` since E92-S03. However all their write paths still call Dexie directly, bypassing `syncableWrite` entirely. No upload entries are created, so no P2 content ever reaches Supabase. Additionally, `books.source` is a discriminated union that can include a `FileSystemFileHandle` — Postgres cannot store it. The `Book` type needs companion flat fields (`sourceType`, `sourceUrl`) so the upload path has serializable data to work with.

(see origin: docs/brainstorms/2026-04-19-e94-s02-course-book-metadata-sync-field-stripping-requirements.md)

## Requirements Trace

- R1. `useCourseImportStore` mutations use `syncableWrite` for importedCourses (AC1)
- R2. `useCourseImportStore` mutations use `syncableWrite` for importedVideos and importedPdfs (AC2)
- R3. `useAuthorStore` mutations use `syncableWrite` for authors (AC3)
- R4. `useBookStore` mutations use `syncableWrite` for books with source decomposition (AC4)
- R5. `books` table registry entry updated with `source` in `stripFields` (AC5)
- R6. `Book` type gains `sourceType` and `sourceUrl` flat fields (AC5 — simpler alternative)
- R7. Store refresh callbacks registered in `useSyncLifecycle` for all 5 P2 tables (AC6)
- R8. Sync queue entries created on authenticated write; handles absent from payload (AC7)
- R9. Unauthenticated writes persist locally only — no queue entries (AC8)
- R10. Zero direct Dexie write calls remain in wired stores and service (AC9)
- R11. Unit tests cover all key mutation types (AC10)

## Scope Boundaries

- `db.transaction` wrappers for multi-table **reads** — unchanged (reads are not wired)
- Book progress RPC dispatch logic in the upload worker — E92-S06 already handles this via `conflictStrategy: 'monotonic'`
- Supabase Storage integration for cover art, audio files — E94-S04
- `bookReviews`, `shelves`, `bookShelves`, `readingQueue` stores — E94-S03
- `chapterMappings` — E94-S06
- ABS bulk import (`upsertAbsBook`, `bulkUpsertAbsBooks`) — excluded; see Deferred section

### Deferred to Separate Tasks

- **ABS book sync (`upsertAbsBook`, `bulkUpsertAbsBooks`)**: These bulk paths are driven by ABS server sync, not user mutations; they require a special merge/purge pattern (`bulkPut`, `bulkDelete`) incompatible with per-record `syncableWrite`. Kept as direct Dexie writes; a dedicated E94+ story will wire ABS sync correctly.
- **`persistScannedCourse` in `src/lib/courseImport.ts`**: The main local file import path. Has an atomic `db.transaction` across `importedCourses + importedVideos + importedPdfs`. Since `syncableWrite` has no bulk variant and each record needs its own queue entry, the transaction must be replaced with sequential `syncableWrite` calls. This is in scope for this story — see Unit 1.
- **`useYouTubeImportStore` YouTube import path**: Similar atomic transaction across `importedCourses + importedVideos`. In scope — see Unit 1.

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncableWrite.ts` — canonical write path; handles Dexie write, `updatedAt` stamp, `userId` stamp, field stripping via `toSnakeCase`, syncQueue enqueue, engine nudge
- `src/lib/sync/tableRegistry.ts` (lines 289–355) — P2 entries already exist with `stripFields`; `books` entry has `conflictStrategy: 'monotonic'` and `monotonicFields: ['progress']`
- `src/lib/sync/fieldMapper.ts` — `toSnakeCase` applies `stripFields` + `vaultFields` automatically; no code changes needed here
- `src/app/hooks/useSyncLifecycle.ts` — `registerStoreRefresh` pattern; all P1 stores already registered; P2 registrations must go before `fullSync()` call
- `src/stores/useNoteStore.ts` / `useBookmarkStore.ts` — reference implementations of fetch-then-put pattern for partial updates
- `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md` — key lessons: stale closure rule, fetch-inside-retry, registerStoreRefresh timing
- `src/lib/courseImport.ts::persistScannedCourse` (lines 344–540) — primary course import path used by `ImportWizardDialog` and `BulkImportDialog`; uses `db.transaction` wrapping `add` + `bulkAdd`
- `src/stores/useYouTubeImportStore.ts` (line ~347) — YouTube import path; uses same `db.transaction` pattern
- `src/data/types.ts` (lines 758–791) — `Book` interface; `ContentSource` union (line 739–742): `'local'|'remote'|'fileHandle'` variants

### Institutional Learnings

- **Fetch-inside-retry**: When doing fetch-then-put for partial updates, always read the current record inside the retry block so retries work on the latest DB state (docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md §4)
- **Stale closure rule**: Use `set(state => ...)` functional form whenever there is an `await` before touching Zustand state (docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md §1)
- **registerStoreRefresh timing**: Must be called synchronously in `useEffect` before `fullSync()` — the sync engine may fire immediately on mount (docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md §5)
- **stripFields are registry-inherited**: Do not re-declare fields already in the registry; confirm `books` strip entry in tableRegistry rather than adding duplicates (docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md §6)

### External References

Not needed — strong local pattern established by E93 stories.

## Key Technical Decisions

- **`Book.sourceType` + `Book.sourceUrl` as persisted Dexie fields**: Rather than a runtime transform in `syncableWrite`, add `sourceType: string` and `sourceUrl: string | null` to the `Book` type and populate them at write time. The `source` union field is kept on the `Book` type for local runtime use (e.g., `opfsStorageService`) and added to `stripFields` in the table registry. This avoids introducing a field-transform hook in the sync engine and is the simpler of the two options in AC5. (see origin doc Key Design Decisions §1)

- **`persistScannedCourse` must use sequential `syncableWrite` calls, not a single transaction**: `syncableWrite` has no bulk or transactional variant. The atomicity guarantee from the Dexie transaction is sacrificed — if the process is interrupted mid-import, partial records may exist locally without sync queue entries. The risk is acceptable: `syncableWrite` is individually atomic per record, and a future upload scan can detect records without corresponding queue entries. The alternative — keeping the Dexie transaction for atomicity while enqueuing separately — would create a partial-write window where Dexie succeeds but queue insert fails. Both options have the same risk profile; sequential `syncableWrite` is simpler.

- **YouTube import store (`useYouTubeImportStore`) wired in same unit as `courseImport.ts`**: Both paths write `importedCourses` + `importedVideos`. Wiring them together ensures AC2 applies to all import sources and prevents a confusing state where local imports sync but YouTube imports do not.

- **`deleteTagGlobally` / `renameTagGlobally` bulk updates stay as sequential `syncableWrite` in a loop**: These operations update N courses via `db.transaction` today. Replace with a `for` loop over `syncableWrite('importedCourses', 'put', updated)` calls. Loses atomicity across all courses but gains per-record sync queue entries. Acceptable tradeoff — tag operations are low-risk and rare.

- **ABS `upsertAbsBook` / `bulkUpsertAbsBooks` are excluded from this story**: ABS sync drives a server-authoritative merge/purge that needs its own reconciliation strategy before becoming compatible with `syncableWrite`'s per-record enqueue model.

## Open Questions

### Resolved During Planning

- **Is the `books` table registry already complete?** Yes — `conflictStrategy: 'monotonic'` and `monotonicFields: ['progress']` are set. The only gap is `source` in `stripFields` and the two flat fields on the type. (confirmed via tableRegistry.ts lines 345–355)
- **Does `persistScannedCourse` call `useCourseImportStore.addImportedCourse`?** No — it updates Zustand directly via `useCourseImportStore.setState` and calls `db.transaction` directly. Both paths must be wired independently.
- **Are `books` reads affected?** No — `db.books.toArray()`, `db.books.get()` etc. remain unchanged. Only write paths (`put`, `add`, `update`, `delete`, `bulkDelete`, `bulkPut`) are in scope.
- **Does `updateBookPosition` need `syncableWrite`?** Yes — it updates `currentPosition`, `progress`, and `lastOpenedAt` via `db.books.update`. Since `progress` is monotonic and triggers RPC, it must go through `syncableWrite`. Use fetch-then-put.

### Deferred to Implementation

- **`updateBookPlaybackSpeed` — should it enqueue?** Playback speed is a low-priority preference. Wiring it produces syncQueue churn for a field with low recovery value. Implementation may choose to use `syncableWrite(..., { skipQueue: true })` for this field only, to get the Dexie write without sync overhead. Decision deferred to implementation.
- **`books.source` for `'fileHandle'` variant on download**: When a remote Supabase record is downloaded (source_type='local', source_url=null), the `toCamelCase` mapper will produce `sourceType: 'local'` and `sourceUrl: null` — the `source` union won't be reconstructed. Books downloaded from another device will have no `source` field until the user opens them locally. This is acceptable for MVP — the book record lands in Dexie for browse/metadata display; file access is gated by OPFS availability. A future story may reconstruct `source` on download.

## Implementation Units

- [ ] **Unit 1: Wire `persistScannedCourse` and `useYouTubeImportStore` through `syncableWrite`**

**Goal:** Replace `db.transaction` add/bulkAdd writes in both the local-file import path (`src/lib/courseImport.ts`) and YouTube import path (`src/stores/useYouTubeImportStore.ts`) with sequential `syncableWrite` calls so all three tables (`importedCourses`, `importedVideos`, `importedPdfs`) produce sync queue entries on import.

**Requirements:** R1, R2, R10

**Dependencies:** None — table registry entries and `syncableWrite` are already in place

**Files:**
- Modify: `src/lib/courseImport.ts`
- Modify: `src/stores/useYouTubeImportStore.ts`
- Test: `src/lib/sync/__tests__/p2-course-book-sync.test.ts` (created in Unit 5)

**Approach:**
- In `persistScannedCourse`: replace the `db.transaction([importedCourses, importedVideos, importedPdfs], ...)` block with `await syncableWrite('importedCourses', 'add', course)`, followed by `for` loops calling `syncableWrite('importedVideos', 'add', video)` and `syncableWrite('importedPdfs', 'add', pdf)` per record. Remove `import { db }` for these tables if no longer needed elsewhere in the file (reads may still use `db.importedCourses.get()` — keep that import).
- In `useYouTubeImportStore`: same pattern — replace the `db.transaction` add/bulkAdd block with sequential `syncableWrite` calls for `importedCourses` and `importedVideos`. The `youtubeChapters` and `youtubeVideoCache` tables are not P2 sync tables — keep their writes via direct Dexie (or confirm they're in the registry; if not, leave as-is).
- `syncableWrite('importedCourses', 'add', course)` will strip `directoryHandle` and `coverImageHandle` via the registry. No extra code needed.
- `syncableWrite('importedVideos', 'add', video)` will strip `fileHandle` via the registry.
- `syncableWrite('importedPdfs', 'add', pdf)` will strip `fileHandle` via the registry.
- Import `syncableWrite` and `SyncableRecord` from `@/lib/sync/syncableWrite`.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — `addNote` calling `syncableWrite('notes', 'add', note as unknown as SyncableRecord)`

**Test scenarios:**
- Happy path: calling `persistScannedCourse` with a scanned course containing 2 videos and 1 PDF produces 4 syncQueue entries (1 course + 2 videos + 1 PDF), all with `status: 'pending'` and correct `tableName`
- Happy path: handles (`directoryHandle`, `fileHandle`) are absent from all syncQueue payloads
- Edge case: course with 0 videos and 0 PDFs produces exactly 1 syncQueue entry (just the course)
- Error path: if the `importedCourses` add fails (simulated Dexie error), the error propagates and no `importedVideos` entries are created
- Integration: unauthenticated import (user is null) — records written to Dexie but no syncQueue entries

**Verification:**
- No `db.importedCourses.add`, `db.importedVideos.bulkAdd`, `db.importedPdfs.bulkAdd` calls remain in `persistScannedCourse`
- No `db.importedCourses.add`, `db.importedVideos.bulkAdd` calls remain in `useYouTubeImportStore`

---

- [ ] **Unit 2: Wire `useCourseImportStore` mutations through `syncableWrite`**

**Goal:** Replace all direct Dexie write calls in `useCourseImportStore` — `addImportedCourse`, `removeImportedCourse`, `updateCourseTags`, `updateCourseStatus`, `updateCourseDetails`, `renameTagGlobally`, `deleteTagGlobally` — with `syncableWrite`.

**Requirements:** R1, R2, R10

**Dependencies:** Unit 1 (confirm import that is needed; this unit is independently writable)

**Files:**
- Modify: `src/stores/useCourseImportStore.ts`

**Approach:**
- `addImportedCourse(course)`: replace `db.importedCourses.add(course)` with `syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)`. Note: this method is called by legacy paths — `persistScannedCourse` also writes the course directly, so after Unit 1 wires `persistScannedCourse`, `addImportedCourse` may become a secondary path. Still wire it.
- `removeImportedCourse(courseId)`: The current code uses `db.transaction` to delete course + all child videos + all child PDFs atomically. Replace with: (1) fetch child video IDs with `db.importedVideos.where('courseId').equals(courseId).toArray()` and PDF IDs similarly, (2) call `syncableWrite('importedVideos', 'delete', v.id)` for each, (3) call `syncableWrite('importedPdfs', 'delete', p.id)` for each, (4) call `syncableWrite('importedCourses', 'delete', courseId)`. Keep `deleteCourseThumbnail` as a direct Dexie call (not a synced table).
- `updateCourseTags(courseId, tags)`: replace `db.importedCourses.update(courseId, { tags })` with fetch-then-put: read course from `db.importedCourses.get(courseId)`, merge `tags`, call `syncableWrite('importedCourses', 'put', merged)`.
- `updateCourseStatus(courseId, status)`: same fetch-then-put pattern.
- `updateCourseDetails(courseId, details)`: same fetch-then-put — merge patch into full record, call `syncableWrite('importedCourses', 'put', merged)`.
- `renameTagGlobally`: replace inner `db.importedCourses.update(course.id, { tags })` calls with `syncableWrite('importedCourses', 'put', updatedCourse)`. Cannot use `db.transaction` wrapper — remove it; iterate sequentially.
- `deleteTagGlobally`: same — replace `db.importedCourses.update` loop with `syncableWrite` loop; remove `db.transaction` wrapper.
- Import `syncableWrite` and `SyncableRecord` from `@/lib/sync/syncableWrite`.

**Patterns to follow:**
- `src/stores/useBookmarkStore.ts::updateBookmarkLabel` — fetch-then-put inside `persistWithRetry` block
- `src/stores/useNoteStore.ts` — `deleteNote` calling `syncableWrite('notes', 'delete', noteId)`

**Test scenarios:**
- Happy path: `updateCourseTags` produces a `put` queue entry for `importedCourses` with updated tags in payload, `directoryHandle` absent
- Happy path: `removeImportedCourse` on a course with 1 video and 1 PDF produces 3 queue entries (1 course delete + 1 video delete + 1 pdf delete)
- Happy path: `renameTagGlobally` on 2 matching courses produces 2 `put` queue entries
- Edge case: `removeImportedCourse` on a course with no videos or PDFs produces 1 queue entry (just the course delete)
- Integration: unauthenticated `updateCourseTags` — Dexie updated, no syncQueue entry

**Verification:**
- No `db.importedCourses.put/add/delete/update` calls remain in `useCourseImportStore.ts` (reads via `db.importedCourses.get()` and `toArray()` remain)
- No `db.importedVideos.where(...).delete()` pattern remains (replaced by per-record `syncableWrite` deletes)

---

- [ ] **Unit 3: Wire `useAuthorStore` mutations through `syncableWrite`**

**Goal:** Replace all direct Dexie write calls in `useAuthorStore` with `syncableWrite`. The `photoHandle` field is stripped by the registry automatically.

**Requirements:** R3, R10

**Dependencies:** None

**Files:**
- Modify: `src/stores/useAuthorStore.ts`

**Approach:**
- `addAuthor(data)`: replace `db.authors.add(author)` with `syncableWrite('authors', 'add', author as unknown as SyncableRecord)`. The `photoHandle` field on the author object will be stripped from the upload payload by the registry; it remains in Dexie for local use.
- `updateAuthor(id, data)`: replace `db.authors.put(updated)` with `syncableWrite('authors', 'put', updated as unknown as SyncableRecord)`.
- `deleteAuthor(id)`: replace `db.authors.delete(id)` with `syncableWrite('authors', 'delete', id)`.
- **Undo-delete in `deleteAuthor`**: the undo callback calls `db.authors.add(deletedAuthor)` directly. Replace with `syncableWrite('authors', 'add', deletedAuthor as unknown as SyncableRecord)`. This re-enqueues an upload for the restored author.
- `linkCourseToAuthor` / `unlinkCourseFromAuthor`: both build an `updated` record and call `db.authors.put(updated)`. Replace with `syncableWrite('authors', 'put', updated as unknown as SyncableRecord)`.
- `persistScannedCourse` also has a `db.authors.update(authorId, updates)` call in the author-link post-persist step (line ~480 in courseImport.ts). Replace with fetch-then-put: `const current = await db.authors.get(authorId); syncableWrite('authors', 'put', { ...current, ...updates })`.
- Import `syncableWrite` and `SyncableRecord` from `@/lib/sync/syncableWrite`.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — general fetch-then-put and delete patterns

**Test scenarios:**
- Happy path: `addAuthor` produces an `add` queue entry for `authors`, `photoHandle` absent from payload
- Happy path: `deleteAuthor` produces a `delete` queue entry; undo callback produces an `add` queue entry
- Happy path: `linkCourseToAuthor` produces a `put` queue entry with updated `courseIds`
- Integration: unauthenticated `addAuthor` — Dexie written, no syncQueue entry

**Verification:**
- No `db.authors.put/add/delete/update` calls remain in `useAuthorStore.ts` or `courseImport.ts`

---

- [ ] **Unit 4: Add `sourceType`/`sourceUrl` to `Book` type and wire `useBookStore` through `syncableWrite`**

**Goal:** (a) Add `sourceType` and `sourceUrl` flat fields to the `Book` type in `src/data/types.ts`. (b) Add `'source'` to `stripFields` in the `books` table registry entry. (c) Wire all `useBookStore` write paths through `syncableWrite`.

**Requirements:** R4, R5, R6, R10

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/lib/sync/tableRegistry.ts`
- Modify: `src/stores/useBookStore.ts`

**Approach:**

**(a) Type changes:**
- Add to `Book` interface: `sourceType?: string` and `sourceUrl?: string | null`. Mark optional for backward compatibility with Dexie rows written before this story (downloaded rows won't have a `source` field to decompose).
- No changes to `ContentSource` type — it remains the runtime union for local file access.

**(b) Registry change:**
- In the `books` entry in `tableRegistry.ts`, add `stripFields: ['source']`. The `sourceType` and `sourceUrl` flat fields will auto-convert to `source_type` and `source_url` by `toSnakeCase`.

**(c) Store wiring:**
- Helper function (local to `useBookStore.ts`): `decomposeSource(source: ContentSource): { sourceType: string; sourceUrl: string | null }`. Maps: `'local'` → `{ sourceType: 'local', sourceUrl: null }`; `'remote'` → `{ sourceType: 'remote', sourceUrl: source.url }`; `'fileHandle'` → `{ sourceType: 'fileHandle', sourceUrl: null }` (handle is non-serializable; URL is not available).
- `importBook(book, file?)`: After OPFS storage and `source` field mutation, call `decomposeSource(book.source)` and merge `sourceType`/`sourceUrl` into the book record before calling `syncableWrite('books', 'add', bookWithFlats as unknown as SyncableRecord)`. Replace `db.books.put(book)`.
- `updateBookStatus(bookId, status)`: replace `db.books.update(bookId, updates)` with fetch-then-put: read book from `db.books.get(bookId)`, merge `{ status, finishedAt }`, call `syncableWrite('books', 'put', merged)`.
- `deleteBook(bookId)`: replace `db.books.delete(bookId)` with `syncableWrite('books', 'delete', bookId)`. Keep `db.bookHighlights.where('bookId').equals(bookId).delete()` as a direct Dexie call (not a synced table in this story scope — bookHighlights are handled by E93-S06 wiring already in place via `useHighlightStore`). Keep `opfsStorageService.deleteBookFiles(bookId)` as-is.
- `updateBookMetadata(bookId, updates)`: replace `db.books.update(bookId, { ...updates })` with fetch-then-put.
- `updateBookPosition(bookId, position, progress)`: replace `db.books.update(bookId, { currentPosition, progress, lastOpenedAt })` with fetch-then-put. This is the path that triggers monotonic progress sync.
- `updateBookPlaybackSpeed(bookId, speed)`: use `syncableWrite('books', 'put', merged, { skipQueue: true })` — playback speed preference is high-churn, low sync value. The `skipQueue: true` option writes to Dexie without enqueuing, avoiding excessive sync traffic. (See Deferred open question — implementation may choose to enqueue if the team prefers full sync coverage.)
- `linkBooks(bookIdA, bookIdB)` / `unlinkBooks(bookIdA, bookIdB)`: replace the `db.transaction` wrapping two `db.books.update` calls with two sequential `syncableWrite('books', 'put', merged)` calls. Loses atomicity — acceptable since each book's link field is independently meaningful.
- `upsertAbsBook` / `bulkUpsertAbsBooks`: **excluded** — keep as direct Dexie writes per scope boundary. Add a comment explaining the exclusion.
- Import `syncableWrite` and `SyncableRecord` from `@/lib/sync/syncableWrite`.

**Patterns to follow:**
- `src/stores/useBookmarkStore.ts` — fetch-then-put with `persistWithRetry` for label update
- `src/lib/sync/tableRegistry.ts` (lines 289–355) — existing P2 entries for `stripFields` pattern

**Test scenarios:**
- Happy path: `importBook` with a local OPFS file produces an `add` queue entry; payload has `source_type: 'local'`, `source_url: null`; `source` field is absent from payload
- Happy path: `importBook` with a remote ABS book (`source.type === 'remote'`) produces payload with `source_type: 'remote'`, `source_url` matching `source.url`
- Happy path: `updateBookPosition` produces a `put` queue entry with `progress` in payload (monotonic — upload worker will route to `upsert_book_progress` RPC)
- Happy path: `deleteBook` produces a `delete` queue entry; OPFS cleanup still attempted
- Happy path: `linkBooks` produces two `put` queue entries (one per book) with `linked_book_id` set
- Edge case: `updateBookStatus` to `'finished'` produces a `put` queue entry with `finished_at` field present in payload
- Integration: unauthenticated `importBook` — Dexie written with `sourceType`/`sourceUrl` fields, no syncQueue entry

**Verification:**
- No `db.books.put/add/delete/update/bulkPut/bulkDelete` calls remain in `useBookStore.ts` except inside `upsertAbsBook` and `bulkUpsertAbsBooks` (explicitly excluded)
- `source` absent from all syncQueue payloads; `source_type` and `source_url` present

---

- [ ] **Unit 5: Register P2 store refresh callbacks in `useSyncLifecycle` and add test file**

**Goal:** Register store refresh callbacks for all 5 P2 Dexie tables in `useSyncLifecycle.ts` so the sync engine can notify stores after download. Create the unit test file covering all key P2 mutation types.

**Requirements:** R7, R8, R9, R11

**Dependencies:** Units 1–4 (test scenarios require the wired stores)

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`
- Create: `src/lib/sync/__tests__/p2-course-book-sync.test.ts`

**Approach:**

**(a) Store refresh registrations:**
Add before the `setStatus('syncing')` call and before `syncEngine.fullSync()` in `useSyncLifecycle.ts`:
- `importedCourses`, `importedVideos`, `importedPdfs` → all three trigger `useCourseImportStore.getState().loadImportedCourses()` (loading courses re-queries all associated videos/PDFs on next navigation)
- `authors` → `useAuthorStore.getState().loadAuthors()` — set `isLoaded = false` first to force reload past the early-return guard
- `books` → `useBookStore.getState().loadBooks()` — set `isLoaded = false` first to force reload past the early-return guard

Import `useCourseImportStore`, `useAuthorStore`, `useBookStore` at the top of `useSyncLifecycle.ts`.

Note on `loadAuthors` and `loadBooks` guards: both stores have `if (get().isLoaded) return` early-exit guards. The refresh callback must reset `isLoaded = false` on the store before calling `loadAuthors()` / `loadBooks()`, otherwise the refresh is silently skipped. Pattern: `useAuthorStore.setState({ isLoaded: false }); await useAuthorStore.getState().loadAuthors()`.

**(b) Unit test file:**
Mirror the structure of `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts`. Use `fake-indexeddb/auto`, `Dexie.delete('ElearningDB')` in `beforeEach`, `vi.resetModules()` for isolation. Seed `useAuthStore` with a test user for authenticated scenarios; clear it for unauthenticated.

Test coverage (minimum):
- Course add: `addImportedCourse` → syncQueue has `tableName: 'importedCourses'`, `operation: 'add'`; `directoryHandle` absent from payload
- Course add handles: `directoryHandle` and `coverImageHandle` absent from syncQueue payload
- Author add: `addAuthor` → syncQueue has `tableName: 'authors'`, `operation: 'add'`; `photoHandle` absent
- Author delete: `deleteAuthor` → syncQueue has `operation: 'delete'` for `authors`
- Book add with source decomposition: `importBook` with `source.type: 'local'` → payload has `source_type: 'local'`, `source` absent
- Book progress update: `updateBookPosition` → syncQueue has `operation: 'put'`, `tableName: 'books'`, `progress` in payload
- Unauthenticated write: `addImportedCourse` with null user → Dexie record exists, syncQueue empty

**Patterns to follow:**
- `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` — full test structure to mirror
- `src/app/hooks/useSyncLifecycle.ts` (lines 56–100) — existing registerStoreRefresh pattern

**Test scenarios:** (see above — the test file IS the test scenarios for this unit)

**Verification:**
- `useSyncLifecycle.ts` has 5 new `registerStoreRefresh` calls (importedCourses, importedVideos, importedPdfs, authors, books) all placed before `fullSync()`
- `p2-course-book-sync.test.ts` passes with `npm run test:unit`

## System-Wide Impact

- **Interaction graph:** `persistScannedCourse` is called by `ImportWizardDialog` and `BulkImportDialog` (both in `src/app/components/figma/`). Changing it from a pure-Dexie path to `syncableWrite` means authenticated imports immediately enqueue upload jobs. If `syncEngine.nudge()` is called inside `syncableWrite`, an upload may start before the import wizard closes. This is the intended behavior — no callback timing changes needed.
- **Error propagation:** `syncableWrite` rethrows Dexie write failures (fatal) and swallows queue insert failures (logged, non-fatal). The existing `try/catch` blocks in `useCourseImportStore` that call `toast.error` will still fire on Dexie write failure.
- **State lifecycle risks:** `isLoaded` guards on `useAuthorStore` and `useBookStore` must be reset before calling the store refresh callback, otherwise the refresh no-ops. Add `setState({ isLoaded: false })` before each callback.
- **API surface parity:** `updateCourseThumbnail` in `useCourseImportStore` writes to `db.courseThumbnails` — this is NOT a synced table and is unchanged. `deleteCourseThumbnail` similarly unchanged.
- **Integration coverage:** The unit tests use `fake-indexeddb` so they run in Node without a browser — they will not catch OPFS failures (expected) or `FileSystemFileHandle` serialization issues (moot since handles are stripped).
- **Unchanged invariants:** All read paths (`db.*.toArray()`, `db.*.get()`, `db.*.where(...)`) remain direct Dexie calls. `upsertAbsBook` and `bulkUpsertAbsBooks` remain direct Dexie writes with an explicit exclusion comment. `db.bookHighlights.where('bookId').delete()` inside `deleteBook` remains a direct Dexie call (bookHighlights are wired separately by `useHighlightStore` from E93).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `persistScannedCourse` losing atomicity across course/video/pdf | Acceptable for MVP — each record is individually atomic; a future scan can detect orphaned records. Comment the tradeoff in code. |
| `isLoaded` guards silently swallowing store refresh callbacks | Explicitly reset `isLoaded = false` before calling `loadAuthors()` / `loadBooks()` in refresh callbacks |
| `books.source` strip breaking local OPFS file access | `source` remains on the Dexie `Book` record — it is only stripped from the upload payload; local reads are unaffected |
| Stale closure bugs in fetch-then-put updates | Follow E93-S02 lesson: always use `set(state => ...)` functional form after any `await` |
| `upsertAbsBook` and `bulkUpsertAbsBooks` not wired (user confusion) | Document explicitly in code and in this plan; the ABS refresh path is server-driven, not user-mutation-driven |

## Documentation / Operational Notes

- Add a comment in `persistScannedCourse` explaining why `db.transaction` atomicity was removed (sync wiring requires per-record queue entries; see E94-S02 plan).
- Add exclusion comment in `useBookStore` on `upsertAbsBook` and `bulkUpsertAbsBooks` explaining they are out of scope for this story.
- `books` table now has `stripFields: ['source']` — future `toCamelCase` (download phase) will not reconstruct the `source` field from Supabase rows. Books downloaded from another device will have `sourceType`/`sourceUrl` set but `source` undefined until the next OPFS-backed open.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s02-course-book-metadata-sync-field-stripping-requirements.md](docs/brainstorms/2026-04-19-e94-s02-course-book-metadata-sync-field-stripping-requirements.md)
- Related code: `src/lib/sync/tableRegistry.ts` (P2 section, lines 289–355)
- Related code: `src/lib/sync/syncableWrite.ts`
- Related code: `src/lib/courseImport.ts::persistScannedCourse` (lines 344–540)
- Related code: `src/app/hooks/useSyncLifecycle.ts`
- Related code: `src/data/types.ts` (Book interface, ContentSource union)
- Prior art: `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` (test structure to mirror)
- Lessons: `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`
