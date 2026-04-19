---
story_id: E93-S02
story_name: "Wire Notes and Bookmarks with Sync"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 93.02: Wire Notes and Bookmarks with Sync

## Story

As a learner who uses notes and bookmarks across multiple devices,
I want my notes and video bookmarks to sync automatically through the E92 sync engine,
so that content I annotate on one device is instantly available everywhere.

## Acceptance Criteria

**AC1 — `notes` and `bookmarks` entries exist in tableRegistry:** Both tables are already registered in `src/lib/sync/tableRegistry.ts` (done in E92-S03). This story must verify the entries are correct before wiring the stores:
- `notes`: `{ dexieTable: 'notes', supabaseTable: 'notes', conflictStrategy: 'lww', priority: 1, fieldMap: { deleted: 'soft_deleted' } }`
- `bookmarks`: `{ dexieTable: 'bookmarks', supabaseTable: 'bookmarks', conflictStrategy: 'lww', priority: 1, fieldMap: {} }`

**AC2 — `useNoteStore` writes route through `syncableWrite`:** All Dexie mutations in `src/stores/useNoteStore.ts` use `syncableWrite` instead of direct `db.notes.*` calls:
- `saveNote`: replaces `db.notes.put(note)` with `syncableWrite('notes', 'put', note)`
- `addNote`: replaces `db.notes.add(note)` with `syncableWrite('notes', 'add', note)`
- `deleteNote`: replaces `db.notes.delete(noteId)` with `syncableWrite('notes', 'delete', noteId)`
- Soft delete (`softDelete` / `restoreNote`) updates `deleted` and `deletedAt` fields and must also call `syncableWrite('notes', 'put', updatedNote)` to persist the soft-delete flag and enqueue it for Supabase (the `fieldMap` maps `deleted → soft_deleted` so Supabase sees the correct column)

**AC3 — `useBookmarkStore` writes route through `syncableWrite`:** All Dexie mutations in `src/stores/useBookmarkStore.ts` use `syncableWrite` instead of direct `db.bookmarks.*` calls:
- `addBookmark`: replaces `db.bookmarks.add(bookmark)` with `syncableWrite('bookmarks', 'add', bookmark)`
- `updateBookmarkLabel`: replaces `db.bookmarks.update(bookmarkId, { label })` — since `syncableWrite` does not support partial update, fetch the existing record first, merge the label, then call `syncableWrite('bookmarks', 'put', updatedBookmark)`
- `deleteBookmark`: replaces `db.bookmarks.delete(bookmarkId)` with `syncableWrite('bookmarks', 'delete', bookmarkId)`

**AC4 — `VideoBookmark` type gets `updatedAt` field:** `syncableWrite` stamps `updatedAt` on put/add writes. The `VideoBookmark` interface in `src/data/types.ts` must add an optional `updatedAt?: string` field so TypeScript accepts the stamped record. No migration is needed — the v52 upgrade already stamped existing records.

**AC5 — Store refresh callbacks registered in `useSyncLifecycle`:** `src/app/hooks/useSyncLifecycle.ts` registers refresh callbacks so the download engine can reload in-memory state after a sync:
- `syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())`
- `syncEngine.registerStoreRefresh('bookmarks', () => useBookmarkStore.getState().loadBookmarks())`

**AC6 — Sync queue entries created on write:** After calling `addNote`, `saveNote`, `deleteNote`, `addBookmark`, `updateBookmarkLabel`, or `deleteBookmark` while authenticated, a `syncQueue` entry exists with:
- `tableName`: `'notes'` or `'bookmarks'`
- `operation`: `'put'`, `'add'`, or `'delete'`
- `status`: `'pending'`
- For `notes` puts: payload has `soft_deleted` key (not `deleted`) when note has a `deleted` field set

**AC7 — Unauthenticated writes still persist locally without queueing:** When the user is not signed in, `saveNote`, `addNote`, `addBookmark`, etc. write to Dexie (local persistence) but do NOT create sync queue entries. This is the existing `syncableWrite` contract — no additional code required beyond the store migration.

**AC8 — No direct `db.notes.put/add/delete` or `db.bookmarks.put/add/update/delete` calls remain in the store files:** After this story, `useNoteStore.ts` and `useBookmarkStore.ts` contain zero direct `db.notes.*`/`db.bookmarks.*` write calls (reads — `where`, `toArray`, `count` — are left as-is).

**AC9 — Unit tests cover the new wiring:** A new Vitest unit test file `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` verifies:
- `saveNote` → syncQueue entry with `tableName: 'notes'`, `operation: 'put'`
- `addNote` → syncQueue entry with `tableName: 'notes'`, `operation: 'add'`
- `deleteNote` → syncQueue entry with `tableName: 'notes'`, `operation: 'delete'`
- `softDelete` (in-memory) followed by `saveNote` → syncQueue entry with payload containing `soft_deleted: true`
- `addBookmark` → syncQueue entry with `tableName: 'bookmarks'`, `operation: 'add'`
- `updateBookmarkLabel` → syncQueue entry with `tableName: 'bookmarks'`, `operation: 'put'`
- `deleteBookmark` → syncQueue entry with `tableName: 'bookmarks'`, `operation: 'delete'`
- Unauthenticated: no queue entries for any of the above operations

## Tasks / Subtasks

- [ ] Task 1: Verify and confirm tableRegistry entries for notes and bookmarks (AC: 1)
  - [ ] 1.1 Read `src/lib/sync/tableRegistry.ts` and confirm both `notes` and `bookmarks` entries are present with correct `fieldMap`, `conflictStrategy`, and `priority` values
  - [ ] 1.2 Confirm `notes.fieldMap` has `{ deleted: 'soft_deleted' }` (non-obvious rename — Supabase column is `soft_deleted`, Dexie field is `deleted`)
  - [ ] 1.3 No registry changes needed — this task is verification only

- [ ] Task 2: Add `updatedAt` to `VideoBookmark` type (AC: 4)
  - [ ] 2.1 In `src/data/types.ts`, add `updatedAt?: string` to the `VideoBookmark` interface (after `createdAt`) with comment: `// ISO 8601 — stamped by syncableWrite (E92-S04)`
  - [ ] 2.2 Run `npx tsc --noEmit` to confirm no type errors

- [ ] Task 3: Wire `useNoteStore` writes through `syncableWrite` (AC: 2, 8)
  - [ ] 3.1 Add `import { syncableWrite } from '@/lib/sync/syncableWrite'` at top of `src/stores/useNoteStore.ts`
  - [ ] 3.2 `saveNote`: replace `db.notes.put(note)` inside `persistWithRetry` with `await syncableWrite('notes', 'put', note)` — keep `persistWithRetry` wrapper; `syncableWrite` performs the Dexie write internally
  - [ ] 3.3 `addNote`: replace `db.notes.add(note)` inside `persistWithRetry` with `await syncableWrite('notes', 'add', note)`
  - [ ] 3.4 `deleteNote`: replace `db.notes.delete(noteId)` inside `persistWithRetry` with `await syncableWrite('notes', 'delete', noteId)`
  - [ ] 3.5 `softDelete` (currently in-memory only): convert to an async method that first fetches the current note from state, applies `{ deleted: true, deletedAt: now }`, then calls `syncableWrite('notes', 'put', updatedNote)`. Update the store interface signature accordingly.
  - [ ] 3.6 `restoreNote` (currently in-memory only): same pattern — fetch, apply `{ deleted: false, deletedAt: undefined }`, call `syncableWrite('notes', 'put', updatedNote)`. Update interface.
  - [ ] 3.7 Verify zero remaining `db.notes.put`, `db.notes.add`, `db.notes.delete`, `db.notes.update` calls in the store file (reads are fine)
  - [ ] 3.8 Run `npx tsc --noEmit` — zero TypeScript errors

- [ ] Task 4: Wire `useBookmarkStore` writes through `syncableWrite` (AC: 3, 8)
  - [ ] 4.1 Add `import { syncableWrite } from '@/lib/sync/syncableWrite'` at top of `src/stores/useBookmarkStore.ts`
  - [ ] 4.2 `addBookmark`: replace `db.bookmarks.add(bookmark)` inside `persistWithRetry` with `await syncableWrite('bookmarks', 'add', bookmark)`
  - [ ] 4.3 `updateBookmarkLabel`: replace `db.bookmarks.update(bookmarkId, { label })` with a fetch-then-put pattern:
    ```ts
    const existing = await db.bookmarks.get(bookmarkId)
    if (!existing) return
    await syncableWrite('bookmarks', 'put', { ...existing, label })
    ```
    Keep the `persistWithRetry` wrapper around both the `get` and the `syncableWrite` call.
  - [ ] 4.4 `deleteBookmark`: replace `db.bookmarks.delete(bookmarkId)` inside `persistWithRetry` with `await syncableWrite('bookmarks', 'delete', bookmarkId)`
  - [ ] 4.5 Verify zero remaining `db.bookmarks.add`, `db.bookmarks.put`, `db.bookmarks.update`, `db.bookmarks.delete` calls in the store file (reads are fine)
  - [ ] 4.6 Run `npx tsc --noEmit` — zero TypeScript errors

- [ ] Task 5: Register store refresh callbacks in `useSyncLifecycle` (AC: 5)
  - [ ] 5.1 Add `import { useNoteStore } from '@/stores/useNoteStore'` to `src/app/hooks/useSyncLifecycle.ts`
  - [ ] 5.2 Add `import { useBookmarkStore } from '@/stores/useBookmarkStore'` to the same file
  - [ ] 5.3 Inside the `useEffect`, after the existing `registerStoreRefresh('studySessions', ...)` call, add:
    ```ts
    syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())
    syncEngine.registerStoreRefresh('bookmarks', () => useBookmarkStore.getState().loadBookmarks())
    ```
  - [ ] 5.4 Confirm the registrations are placed before the `fullSync()` call (critical — registrations must exist when the download phase runs)

- [ ] Task 6: Write unit tests for the wiring (AC: 6, 7, 9)
  - [ ] 6.1 Create `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts` following the pattern of `p0-sync.test.ts`
  - [ ] 6.2 Use `fake-indexeddb/auto`, `vi.resetModules()` in `beforeEach`, and `Dexie.delete('ElearningDB')` for clean state
  - [ ] 6.3 Seed a signed-in user via `useAuthStore.setState({ user: { id: TEST_USER_ID, ... } })`
  - [ ] 6.4 Test `saveNote` (put): call `saveNote(note)`, verify `db.syncQueue` has entry with `tableName: 'notes', operation: 'put', status: 'pending'`
  - [ ] 6.5 Test `addNote` (add): call `addNote(note)`, verify queue entry with `operation: 'add'`
  - [ ] 6.6 Test `deleteNote` (delete): call `addNote` then `deleteNote`, verify queue entry with `operation: 'delete'`
  - [ ] 6.7 Test soft-delete sync: call `softDelete(noteId)` (now async), verify queue entry payload has `soft_deleted: true` (the fieldMap rename)
  - [ ] 6.8 Test `addBookmark` (add): call `addBookmark(...)`, verify queue entry with `tableName: 'bookmarks', operation: 'add'`
  - [ ] 6.9 Test `updateBookmarkLabel` (put): add then update label, verify queue entry with `operation: 'put'` and payload containing updated label
  - [ ] 6.10 Test `deleteBookmark` (delete): add then delete, verify queue entry with `operation: 'delete'`
  - [ ] 6.11 Test unauthenticated: set `user: null`, call `saveNote`, verify Dexie row exists but syncQueue is empty

- [ ] Task 7: Verification
  - [ ] 7.1 `npm run test:unit` — all tests pass (including existing `useNoteStore` and `useBookmarkStore` tests)
  - [ ] 7.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 7.3 `npm run lint` — zero errors
  - [ ] 7.4 `npm run build` — clean build

## Design Guidance

No UI components. This is a pure infrastructure story — store layer wiring only. No design review required.

## Implementation Notes

### Registry State at Story Start

Both `notes` and `bookmarks` are already registered in `src/lib/sync/tableRegistry.ts` (completed in E92-S03). This story does **not** need to modify the registry — it only wires the stores.

Key registry facts to keep in mind during wiring:
- `notes.fieldMap: { deleted: 'soft_deleted' }` — `toSnakeCase()` will emit `soft_deleted` instead of `deleted` in the queue payload. This is correct for Supabase.
- `bookmarks.fieldMap: {}` — default camelCase → snake_case conversion handles all fields (e.g., `courseId → course_id`, `lessonId → lesson_id`, `createdAt → created_at`).

### `persistWithRetry` and `syncableWrite` Interaction

`syncableWrite` already performs the Dexie write internally. Wrapping it in `persistWithRetry` is correct: `persistWithRetry` handles transient IDB errors with exponential backoff. The existing wrappers in the stores should be kept — just replace the inner `db.*` call with `syncableWrite(...)`.

Example (from E92-S09 pattern in `useContentProgressStore`):
```ts
await persistWithRetry(async () => {
  await syncableWrite('notes', 'put', note)
})
```

Do NOT remove `persistWithRetry` — it provides the retry resilience layer. `syncableWrite` provides the sync wiring layer. They compose cleanly.

### `softDelete` and `restoreNote` — Conversion from Sync to Async

Currently, `softDelete` and `restoreNote` are synchronous store mutations (they only call `set()`). After this story, they must also persist to Dexie via `syncableWrite`. This requires converting them to `async` functions. The store interface must be updated accordingly:

```ts
// Before:
softDelete: (noteId: string) => void
restoreNote: (noteId: string) => void

// After:
softDelete: (noteId: string) => Promise<void>
restoreNote: (noteId: string) => Promise<void>
```

**Important:** Any callers of `softDelete`/`restoreNote` (search the codebase) may need `await` added. Check if any callers rely on the synchronous return type.

### `updateBookmarkLabel` — No Partial Update in `syncableWrite`

`syncableWrite` does not support Dexie's partial `update(id, partialRecord)` API. The correct pattern is fetch-then-put:

```ts
updateBookmarkLabel: async (bookmarkId: string, label: string) => {
  // ... optimistic state update ...
  try {
    await persistWithRetry(async () => {
      const existing = await db.bookmarks.get(bookmarkId)
      if (!existing) return
      await syncableWrite('bookmarks', 'put', { ...existing, label })
    })
  } catch (error) {
    // ... rollback ...
  }
}
```

The `get()` inside `persistWithRetry` is intentional — on retry, we re-fetch to avoid merging against a stale version. This is the same pattern used by `useContentProgressStore`.

### Soft-Delete Semantics for `notes`

The `Note` type has `deleted?: boolean` and `deletedAt?: string`. In Supabase, the column is `soft_deleted` (via `fieldMap`). The `search_similar_notes()` Supabase function (E93-S01 AC7) already filters `soft_deleted IS NOT TRUE`, so soft-deleted notes are excluded from server-side semantic search automatically.

When `softDelete(noteId)` calls `syncableWrite('notes', 'put', { ...note, deleted: true, deletedAt: now })`, the `toSnakeCase` function will rename `deleted → soft_deleted` in the queue payload. This is the correct end-to-end path.

### Unified Search Index Updates

`useNoteStore.saveNote` also calls `updateDocInIndex(toSearchableNote(note))` and `addDocToIndex(...)` after a successful write. These calls must remain in place — they update the in-memory MiniSearch index for the unified search feature. The `syncableWrite` call replaces only the Dexie persistence, not the search index update.

### Why Not Wire `embeddings` in This Story

`embeddings` (Dexie: `db.embeddings`) is a P1 table but its write path is buried inside `embeddingPipeline.indexNote()` which runs inside a Worker. Wiring it through `syncableWrite` would require refactoring the Worker communication pattern. That is deferred to E93-S03 or a dedicated embeddings sync story. This story scopes to the two stores with straightforward write paths: `useNoteStore` and `useBookmarkStore`.

### Error Handling Contract (from `syncableWrite` docs)

- **Dexie write failure → rethrow** (fatal; the existing `catch` blocks in the stores handle rollback)
- **Queue insert failure → log + swallow** (non-fatal; `syncableWrite` handles this internally with `console.error`)

No additional error handling is needed in the store files beyond what already exists.

### Store Refresh Registration Order

`useSyncLifecycle.ts` registers callbacks **before** calling `fullSync()`. The current code already follows this pattern for `studySessions`. The new registrations for `notes` and `bookmarks` must be added in the same block, before the `setStatus('syncing')` / `syncEngine.fullSync()` call.

## Testing Notes

### Test Pattern

Follow the exact pattern from `src/lib/sync/__tests__/p0-sync.test.ts`:
- `import 'fake-indexeddb/auto'` at the top
- `vi.resetModules()` + `Dexie.delete('ElearningDB')` in `beforeEach`
- Dynamic imports after `resetModules` to get fresh module instances
- Seed `useAuthStore` with a test user before writing

### Key Assertions

```ts
// Notes save (put)
const note = { id: 'note-1', courseId: 'c-1', videoId: 'v-1', content: 'test', ... }
await useNoteStore.getState().saveNote(note)
const queue = await db.syncQueue.toArray()
const entry = queue.find(q => q.tableName === 'notes')
expect(entry?.operation).toBe('put')
expect(entry?.status).toBe('pending')

// Soft-delete field rename
const softDeletedNote = { ...note, deleted: true, deletedAt: new Date().toISOString() }
await useNoteStore.getState().saveNote(softDeletedNote)
const softEntry = (await db.syncQueue.toArray()).find(q => q.tableName === 'notes' && q.payload.soft_deleted === true)
expect(softEntry).toBeDefined()
expect(softEntry?.payload).not.toHaveProperty('deleted') // old key must be absent

// Bookmark updateLabel (put)
await useBookmarkStore.getState().addBookmark('c-1', 'les-1', 30, 'original')
await useBookmarkStore.getState().updateBookmarkLabel(bookmarkId, 'updated')
const bQueue = await db.syncQueue.toArray()
const updateEntry = bQueue.find(q => q.tableName === 'bookmarks' && q.operation === 'put')
expect(updateEntry?.payload.label).toBe('updated')

// Unauthenticated: no queue entries
useAuthStore.setState({ user: null })
await useNoteStore.getState().saveNote(note)
const unauthQueue = await db.syncQueue.toArray()
expect(unauthQueue.filter(q => q.tableName === 'notes')).toHaveLength(0)
```

### Existing Test Impact

`src/stores/__tests__/useNoteStore.test.ts` and `src/stores/__tests__/useBookmarkStore.test.ts` test the stores directly and will need updates if `softDelete`/`restoreNote` become async. Check existing call sites and update `await` usage accordingly.

The `useBookmarkStore.test.ts` suite likely uses `vi.mock('@/db', ...)` or similar — the mock must also cover `syncableWrite` or the call will fail. Review the test setup carefully before assuming the existing tests pass without changes.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — all `catch` blocks in both store files surface errors via `console.error` (existing pattern preserved)
- [ ] `softDelete` and `restoreNote` are now async — any existing callers have been audited and updated with `await` where needed
- [ ] `updateBookmarkLabel` does a `db.bookmarks.get()` to fetch existing record before calling `syncableWrite` — never partial-updating without the full record
- [ ] `useSyncLifecycle.ts` registers `notes` and `bookmarks` callbacks **before** `fullSync()` is called
- [ ] Unified search index calls (`addDocToIndex`, `updateDocInIndex`, `removeDocFromIndex`) remain intact in `useNoteStore` — only the Dexie persistence line changed
- [ ] `VideoBookmark` interface in `src/data/types.ts` has `updatedAt?: string` added
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] Zero direct `db.notes.put/add/delete` or `db.bookmarks.put/add/update/delete` calls remain in the wired store files
- [ ] E2E: run current story's spec locally (`npx playwright test tests/e2e/story-93-2.spec.ts --project=chromium`) if spec exists, or verify via unit tests
- [ ] CRUD completeness: notes (save, add, delete, soft-delete) and bookmarks (add, update-label, delete) are all wired and tested
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
