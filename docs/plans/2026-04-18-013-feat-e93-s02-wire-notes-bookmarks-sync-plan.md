---
title: "feat: Wire notes and bookmarks stores through syncableWrite (E93-S02)"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e93-s02-wire-notes-bookmarks-sync-requirements.md
---

# feat: Wire notes and bookmarks stores through syncableWrite (E93-S02)

## Overview

`useNoteStore` and `useBookmarkStore` currently write directly to Dexie (`db.notes.*`, `db.bookmarks.*`), bypassing the E92 sync engine. This story wires both stores through `syncableWrite`, adds the `updatedAt` field to `VideoBookmark`, registers store refresh callbacks in `useSyncLifecycle`, and adds P1 integration tests — making note and bookmark mutations sync-eligible across devices.

## Problem Frame

A learner who annotates content on one device sees nothing on their other devices because note/bookmark mutations never reach the sync queue. Both `notes` and `bookmarks` tables are already registered in `tableRegistry` (E92-S03) and `syncableWrite` exists (E92-S04). The gap is purely at the store wiring layer. (see origin: `docs/brainstorms/2026-04-18-e93-s02-wire-notes-bookmarks-sync-requirements.md`)

## Requirements Trace

- R1. Both `notes` and `bookmarks` entries in `tableRegistry` confirmed correct (AC1)
- R2. All `useNoteStore` mutations use `syncableWrite` — no direct `db.notes.*` write calls remain (AC2, AC8)
- R3. All `useBookmarkStore` mutations use `syncableWrite` — no direct `db.bookmarks.*` write calls remain (AC3, AC8)
- R4. `VideoBookmark` interface gains `updatedAt?: string` (AC4)
- R5. Store refresh callbacks registered before `fullSync()` in `useSyncLifecycle` (AC5)
- R6. Authenticated mutations produce `syncQueue` entries with correct `tableName`, `operation`, `status: 'pending'`; soft-delete payload uses `soft_deleted` key (AC6)
- R7. Unauthenticated mutations write to Dexie but create no queue entries (AC7)
- R8. Unit tests for all 7 mutation operations plus unauthenticated no-queue scenario (AC9)

## Scope Boundaries

- No changes to `tableRegistry.ts` — both entries already exist from E92-S03
- No Supabase migration — tables and columns exist from E92
- No UI changes — pure infrastructure story; no design review required
- No changes to the upload engine or download reconciliation (E92)
- `embeddings` table sync not in scope — Worker communication refactor deferred to E93-S03
- LWW conflict resolution strategy not modified

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncableWrite.ts` — canonical write wrapper; stamps `userId`/`updatedAt`, writes to Dexie, enqueues to `syncQueue`, nudges engine
- `src/lib/sync/tableRegistry.ts:116-132` — `notes` entry (fieldMap `deleted → soft_deleted`) and `bookmarks` entry (empty fieldMap) already present
- `src/stores/useContentProgressStore.ts` — P0 reference implementation: `await persistWithRetry(async () => { await syncableWrite(...) })`
- `src/lib/sync/__tests__/p0-sync.test.ts` — exact test template: `import 'fake-indexeddb/auto'`, `vi.resetModules()` + `Dexie.delete('ElearningDB')` in `beforeEach`, dynamic imports after reset
- `src/app/hooks/useSyncLifecycle.ts:46-48` — `studySessions` registration as the insertion point for new `registerStoreRefresh` calls
- `src/stores/useNoteStore.ts` — currently synchronous `softDelete`/`restoreNote` (in-memory set only), async `persistWithRetry` wrapping direct Dexie calls for other mutations
- `src/stores/useBookmarkStore.ts` — `updateBookmarkLabel` uses `db.bookmarks.update(id, partial)` — requires fetch-then-put conversion since `syncableWrite` has no patch API

### Institutional Learnings

- `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md` — architectural rationale for the single write path; confirms `persistWithRetry` wrapping `syncableWrite` is the correct composition
- E92-S09 pattern: wrap `syncableWrite` inside `persistWithRetry`, not the other way around, so retries re-execute the full stamped write
- `softDelete`/`restoreNote` are the only two store methods that are currently synchronous and in-memory only — all call sites that call them without `await` must be audited and updated
- `updateBookmarkLabel` fetch must live inside `persistWithRetry` so retries always re-fetch the latest stored record before merging

### External References

None needed — codebase has 3+ direct `syncableWrite` consumer implementations to follow.

## Key Technical Decisions

- **`softDelete`/`restoreNote` become async:** They must fetch the current record from Dexie (or the in-memory state), merge `deleted`/`deletedAt`, and call `syncableWrite('notes', 'put', mergedNote)`. The interface signature changes from `(noteId: string) => void` to `(noteId: string) => Promise<void>`. All call sites must be audited for `await`. (see origin: AC2, Technical Constraints)
- **`updateBookmarkLabel` uses fetch-then-put:** `syncableWrite` has no partial update (`update(id, partial)`) variant. The full existing record is fetched from Dexie inside the `persistWithRetry` block, then merged with the new label and written with `syncableWrite('bookmarks', 'put', mergedRecord)`. (see origin: AC3, Technical Constraints)
- **Unified search index calls preserved:** `useNoteStore.saveNote` calls `updateDocInIndex` and `addDocToIndex` — only the `db.notes.put()` line changes; search index side-effects are untouched. (see origin: Technical Constraints)
- **`persistWithRetry` wrapper kept:** The outer retry layer is retained on all existing mutation functions; `syncableWrite` replaces only the inner Dexie call. This preserves IndexedDB transient-error resilience without changing the retry boundary.
- **No new `loadAll` variant needed:** `useSyncLifecycle` registers `loadNotes()` and `loadBookmarks()` which both load the full table — no argument needed unlike `loadCourseProgress(courseId)`.

## Open Questions

### Resolved During Planning

- **Are `notes` and `bookmarks` already in tableRegistry?** Yes — confirmed at `src/lib/sync/tableRegistry.ts:116-132`. No changes required. (AC1 is verification-only)
- **Does `VideoBookmark` already have `updatedAt`?** No — the interface at `src/data/types.ts:242-249` omits `updatedAt`. Must add `updatedAt?: string`.
- **Are there call sites for `softDelete`/`restoreNote` outside the store?** Search confirms no call sites in `src/app/**` — only in `src/stores/useNoteStore.ts` (implementation) and `src/stores/__tests__/useNoteStore.test.ts` (tests). The test file must update its synchronous `act()` wrappers to `await act(async () => ...)`.
- **Is `Dexie.delete('ElearningDB')` the correct test database name?** Confirmed in `p0-sync.test.ts` line 48.

### Deferred to Implementation

- Whether any future consumer of `softDelete`/`restoreNote` outside the store requires an await — audit is bounded to the current call sites identified above
- Exact error message strings in the updated tests — mirror existing `useNoteStore.test.ts` conventions

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Store mutation call
  └── optimistic set() in Zustand state
  └── persistWithRetry(async () => {
        // [NEW] syncableWrite replaces db.<table>.*
        await syncableWrite(tableName, operation, record)
          └── stamps userId + updatedAt
          └── db.<table>.put/add/delete (fatal on fail)
          └── [if authenticated] db.syncQueue.add(entry) (non-fatal)
          └── [if authenticated] syncEngine.nudge()
      })
  └── [notes only] updateDocInIndex / addDocToIndex (unchanged)

softDelete / restoreNote (special case — was sync-only, now persisted):
  └── fetch current record via db.notes.get(noteId) inside persistWithRetry
  └── merge { deleted: true/false, deletedAt: iso/undefined }
  └── syncableWrite('notes', 'put', mergedNote)
  └── optimistic set() still updates Zustand state (order: fetch → merge → syncableWrite → set)

updateBookmarkLabel (fetch-then-put):
  └── optimistic set() label in Zustand state
  └── persistWithRetry(async () => {
        const existing = await db.bookmarks.get(bookmarkId)
        if (!existing) return
        await syncableWrite('bookmarks', 'put', { ...existing, label })
      })

useSyncLifecycle registration (before setStatus('syncing')):
  syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())
  syncEngine.registerStoreRefresh('bookmarks', () => useBookmarkStore.getState().loadBookmarks())
  setStatus('syncing')
  syncEngine.fullSync()
```

## Implementation Units

- [ ] **Unit 1: Verify tableRegistry and add `updatedAt` to `VideoBookmark`**

**Goal:** Confirm AC1 (no code change needed) and satisfy AC4 with a one-line type addition that unblocks TypeScript compilation for bookmark tests.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Verify (read-only): `src/lib/sync/tableRegistry.ts`
- Modify: `src/data/types.ts`

**Approach:**
- Read `tableRegistry.ts` to confirm `notes` entry has `fieldMap: { deleted: 'soft_deleted' }` and `bookmarks` entry has `fieldMap: {}` — document the confirmation in a code comment or test assertion in Unit 4, no code change
- Add `updatedAt?: string` to the `VideoBookmark` interface after `createdAt`

**Patterns to follow:**
- `Note` interface at `src/data/types.ts:125` for `updatedAt` field style

**Test scenarios:**
- Test expectation: none — this unit is a type addition and verification; behavioral coverage is in Units 3 and 4

**Verification:**
- `npx tsc --noEmit` passes with zero errors after the type addition

---

- [ ] **Unit 2: Wire `useNoteStore` mutations through `syncableWrite`**

**Goal:** Replace all direct `db.notes.*` write calls with `syncableWrite`, and convert `softDelete`/`restoreNote` from synchronous in-memory operations to async persisted mutations (AC2, AC8).

**Requirements:** R2, R6, R7

**Dependencies:** Unit 1 (TypeScript must compile cleanly)

**Files:**
- Modify: `src/stores/useNoteStore.ts`
- Modify: `src/stores/__tests__/useNoteStore.test.ts` (softDelete/restoreNote test blocks need `await act(async () => ...)`)

**Approach:**
- Add `import { syncableWrite } from '@/lib/sync/syncableWrite'` at the top
- `saveNote`: inside the existing `persistWithRetry` block, replace `await db.notes.put(note)` with `await syncableWrite('notes', 'put', note)`. All other lines (optimistic state, search index, embedding, link suggestions) are unchanged
- `addNote`: inside `persistWithRetry`, replace `await db.notes.add(note)` with `await syncableWrite('notes', 'add', note)`
- `deleteNote`: inside `persistWithRetry`, replace `await db.notes.delete(noteId)` with `await syncableWrite('notes', 'delete', noteId)`
- `softDelete`: convert to `async (noteId: string): Promise<void>`. Inside a new `persistWithRetry` block: fetch full note via `await db.notes.get(noteId)`, guard if not found, merge `{ ...note, deleted: true, deletedAt: new Date().toISOString() }`, call `await syncableWrite('notes', 'put', mergedNote)`. Also apply the optimistic in-memory `set()` (retain the existing behavior)
- `restoreNote`: same conversion pattern — merge `{ ...note, deleted: false, deletedAt: undefined }`, call `syncableWrite('notes', 'put', mergedNote)`
- Update `NoteState` interface: change `softDelete` and `restoreNote` return types from `void` to `Promise<void>`
- Unified search index side-effects (`updateDocInIndex`, `addDocToIndex`, `removeDocFromIndex`) remain exactly as-is — only the inner Dexie call changes

**Patterns to follow:**
- `src/stores/useContentProgressStore.ts` — `persistWithRetry(async () => { await syncableWrite(...) })` pattern
- `src/lib/sync/__tests__/p0-sync.test.ts` — test setup with `vi.resetModules()` + `Dexie.delete`

**Test scenarios:**
- Happy path — `saveNote` on an existing note: `syncQueue` contains one `put` entry for `tableName: 'notes'`; the note is present in `db.notes` with `userId` and `updatedAt` stamped
- Happy path — `addNote`: `syncQueue` contains one `add` entry; note persisted in Dexie
- Happy path — `deleteNote`: `syncQueue` contains one `delete` entry with `payload: { id: noteId }`; note absent from Dexie
- Happy path — `softDelete`: `syncQueue` contains one `put` entry; payload has `soft_deleted: true` and does NOT have a `deleted` property (fieldMap rename verified); Dexie record has `deleted: true`
- Happy path — `restoreNote` after softDelete: `syncQueue` has a `put` entry; payload has `soft_deleted: false`; Dexie record has `deleted: false` and no `deletedAt`
- Edge case — `softDelete` on non-existent noteId: guard returns early, no queue entry created, no error thrown
- Error path — unauthenticated `saveNote`: note is written to Dexie, zero `syncQueue` entries for `tableName: 'notes'`
- Integration — `softDelete` fieldMap rename: the queue entry payload must have key `soft_deleted` (not `deleted`) — this validates that `toSnakeCase` correctly applies the `notes` registry fieldMap

**Verification:**
- `useNoteStore.ts` contains no `db.notes.put`, `db.notes.add`, or `db.notes.delete` calls
- `npx tsc --noEmit` passes
- `npm run test:unit` passes for all `useNoteStore` test suite cases

---

- [ ] **Unit 3: Wire `useBookmarkStore` mutations through `syncableWrite`**

**Goal:** Replace all direct `db.bookmarks.*` write calls with `syncableWrite`, converting `updateBookmarkLabel` from a partial update to a fetch-then-put (AC3, AC8).

**Requirements:** R3, R6, R7

**Dependencies:** Unit 1 (`updatedAt` added to `VideoBookmark`)

**Files:**
- Modify: `src/stores/useBookmarkStore.ts`

**Approach:**
- Add `import { syncableWrite } from '@/lib/sync/syncableWrite'`
- `addBookmark`: inside the existing `persistWithRetry` block, replace `await db.bookmarks.add(bookmark)` with `await syncableWrite('bookmarks', 'add', bookmark)`
- `updateBookmarkLabel`: replace `await db.bookmarks.update(bookmarkId, { label })` with a fetch-then-put inside `persistWithRetry`. The fetch (`await db.bookmarks.get(bookmarkId)`) must be inside `persistWithRetry` so retries always re-fetch the latest record. Guard on `!existing` with early return. Then `await syncableWrite('bookmarks', 'put', { ...existing, label })`. The optimistic in-memory state update remains unchanged
- `deleteBookmark`: inside `persistWithRetry`, replace `await db.bookmarks.delete(bookmarkId)` with `await syncableWrite('bookmarks', 'delete', bookmarkId)`

**Patterns to follow:**
- `src/stores/useContentProgressStore.ts` — reference implementation
- `src/stores/useNoteStore.ts` post-Unit-2 for delete pattern

**Test scenarios:**
- Happy path — `addBookmark`: `syncQueue` has one `add` entry with `tableName: 'bookmarks'`; bookmark persisted with `userId` and `updatedAt` stamped
- Happy path — `updateBookmarkLabel`: `syncQueue` has one `put` entry; payload contains the updated label and the full bookmark record fields
- Happy path — `deleteBookmark`: `syncQueue` has one `delete` entry; bookmark absent from Dexie
- Edge case — `updateBookmarkLabel` on non-existent bookmarkId: `db.bookmarks.get` returns undefined, function returns early, no queue entry created
- Error path — unauthenticated `addBookmark`: bookmark written to Dexie, zero `syncQueue` entries for `tableName: 'bookmarks'`
- Integration — `updateBookmarkLabel` fetch-then-put: the full merged record (not just `{ label }`) appears in the queue payload, including `timestamp`, `courseId`, `lessonId`, `createdAt`

**Verification:**
- `useBookmarkStore.ts` contains no `db.bookmarks.put`, `db.bookmarks.add`, `db.bookmarks.update`, or `db.bookmarks.delete` calls
- `npx tsc --noEmit` passes
- `npm run test:unit` passes

---

- [ ] **Unit 4: Register store refresh callbacks in `useSyncLifecycle`**

**Goal:** Ensure the sync engine calls `loadNotes()` and `loadBookmarks()` after a full sync download phase, satisfying AC5.

**Requirements:** R5

**Dependencies:** Units 2 and 3 (stores must expose correct `loadNotes` and `loadBookmarks` signatures)

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- Add imports for `useNoteStore` and `useBookmarkStore` at the top of the file
- Inside the `useEffect`, after the existing `studySessions` registration and before `setStatus('syncing')`, add:
  - `syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())`
  - `syncEngine.registerStoreRefresh('bookmarks', () => useBookmarkStore.getState().loadBookmarks())`
- Order must be: all `registerStoreRefresh` calls → `setStatus('syncing')` → `syncEngine.fullSync()` — this is already the pattern in the file; the new calls slot in after line 48

**Patterns to follow:**
- `src/app/hooks/useSyncLifecycle.ts:46-48` — existing `studySessions` registration as direct template

**Test scenarios:**
- Test expectation: none — this unit modifies hook registration order with no independently testable behavior. Coverage for the downstream effect (stores refreshed after sync) belongs in the E2E suite when a Supabase test project is provisioned. The integration test file (Unit 5) verifies the registrations exist.

**Verification:**
- `useSyncLifecycle.ts` registers both `notes` and `bookmarks` callbacks before the `setStatus('syncing')` line
- `npx tsc --noEmit` passes

---

- [ ] **Unit 5: Write P1 sync integration tests**

**Goal:** Cover all 7 mutation operations and the unauthenticated no-queue scenario in a new test file, satisfying AC9.

**Requirements:** R6, R7, R8

**Dependencies:** Units 1–4 (all store wiring and type changes must be in place)

**Files:**
- Create: `src/lib/sync/__tests__/p1-notes-bookmarks-sync.test.ts`

**Approach:**
- Follow `p0-sync.test.ts` exactly for setup: `import 'fake-indexeddb/auto'`, `beforeEach` with `Dexie.delete('ElearningDB')` and `vi.resetModules()`, dynamic imports after reset
- Seed a signed-in user via `useAuthStore.setState({ user: { id: TEST_USER_ID, email: '...' } })` before importing stores
- Group into `describe` blocks: `notes sync wiring`, `bookmarks sync wiring`, `unauthenticated writes`
- For the soft-delete scenario: assert `syncQueue` entry with `payload.soft_deleted === true` AND `!('deleted' in payload)` — the fieldMap rename is the critical regression check
- For `restoreNote`: assert `payload.soft_deleted === false`
- For `updateBookmarkLabel` fetch-then-put: after adding a bookmark via `addBookmark`, call `updateBookmarkLabel` and verify the queue entry payload includes all bookmark fields (not just `{ label }`)
- Unauthenticated test: `useAuthStore.setState({ user: null })` before the store call, then assert `db.syncQueue.toArray()` filtered by `tableName` has length 0 while the Dexie record exists

**Patterns to follow:**
- `src/lib/sync/__tests__/p0-sync.test.ts` — entire file structure, import pattern, assertion style

**Test scenarios:**
- Happy path — notes `saveNote` → queue entry `operation: 'put'`, `tableName: 'notes'`
- Happy path — notes `addNote` → queue entry `operation: 'add'`, `tableName: 'notes'`
- Happy path — notes `deleteNote` → queue entry `operation: 'delete'`, `payload: { id: noteId }`
- Happy path — notes `softDelete` → queue `put` entry with `payload.soft_deleted === true`, no `deleted` key in payload
- Happy path — bookmarks `addBookmark` → queue entry `operation: 'add'`, `tableName: 'bookmarks'`
- Happy path — bookmarks `updateBookmarkLabel` → queue `put` entry containing full bookmark fields plus new label
- Happy path — bookmarks `deleteBookmark` → queue `delete` entry
- Error path — unauthenticated note save: Dexie record created, zero queue entries for `tableName: 'notes'`

**Verification:**
- `npm run test:unit` passes with the new test file
- All 8+ test cases green
- `npx tsc --noEmit` passes

## System-Wide Impact

- **Interaction graph:** `useSyncLifecycle` (refresh registration); `syncEngine.fullSync()` (downloads trigger `loadNotes`/`loadBookmarks`); `embeddingPipeline.indexNote()` (unchanged, still fires after `saveNote` succeeds); `triggerNoteLinkSuggestions` (unchanged, still fires after `saveNote`)
- **Error propagation:** Dexie write failure inside `syncableWrite` rethrows — `persistWithRetry` handles retries then surfaces the error to the store's catch block, which sets `state.error` and rolls back optimistic state. Queue insert failure is non-fatal (logged, swallowed). No change to existing error propagation shape.
- **State lifecycle risks:** `softDelete`/`restoreNote` were previously synchronous; callers that don't `await` will silently miss the Dexie write. All current call sites are in the test file (synchronous `act()` → must become `await act(async () => ...)`). No component call sites found in `src/app/**`.
- **API surface parity:** `NoteState` interface changes `softDelete`/`restoreNote` return type to `Promise<void>`. Any future component calling these without `await` will still compile (a Promise is truthy) but the Dexie write may not complete before the next render.
- **Integration coverage:** The fetch-then-put in `updateBookmarkLabel` introduces a new async Dexie read inside `persistWithRetry` — if the bookmark was deleted between the optimistic check and the retry fetch, the `!existing` guard returns early without error. This is the correct behavior (same as the in-memory guard that already exists).
- **Unchanged invariants:** `tableRegistry.ts` is not modified. `syncableWrite.ts` is not modified. The upload engine and download reconciliation (E92) are not modified. All read paths (`db.notes.toArray()`, `db.bookmarks.where(...).toArray()`) are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `softDelete`/`restoreNote` callers not awaited — Dexie write happens but component doesn't observe it | Audit confirmed no component call sites in `src/app/**`. Test file must update `act()` wrappers. TypeScript return type change to `Promise<void>` helps IDEs surface missing awaits. |
| `updateBookmarkLabel` fetch-then-put races with a concurrent delete | The `!existing` guard inside `persistWithRetry` returns early if the record disappears between optimistic check and retry fetch. Acceptable — concurrent delete implies the bookmark is intentionally gone. |
| `softDelete` fieldMap rename not verified in tests | Explicitly tested in Unit 5 with both positive (`soft_deleted: true`) and negative (`!('deleted' in payload)`) assertions. |
| Existing `useNoteStore.test.ts` synchronous `act()` calls break after async conversion | Bounded to two `describe` blocks (lines 299–376). Must convert to `await act(async () => ...)`. Scoped change. |

## Sources & References

- **Origin document:** [`docs/brainstorms/2026-04-18-e93-s02-wire-notes-bookmarks-sync-requirements.md`](../brainstorms/2026-04-18-e93-s02-wire-notes-bookmarks-sync-requirements.md)
- **Reference implementation:** `src/stores/useContentProgressStore.ts` (P0 wiring from E92-S09)
- **Test template:** `src/lib/sync/__tests__/p0-sync.test.ts`
- **Sync wrapper:** `src/lib/sync/syncableWrite.ts`
- **Table registry:** `src/lib/sync/tableRegistry.ts:116-132`
- **Lifecycle hook:** `src/app/hooks/useSyncLifecycle.ts`
- **Institutional learning:** `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`
