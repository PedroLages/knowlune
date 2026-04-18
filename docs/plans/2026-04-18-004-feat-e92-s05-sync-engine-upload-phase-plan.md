---
title: "feat: Implement sync engine upload phase — queue drain, batching, retry, dead-letter"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e92-s05-sync-engine-upload-phase-requirements.md
---

# feat: Implement sync engine upload phase — queue drain, batching, retry, dead-letter

## Overview

E92-S05 replaces the no-op `syncEngine.ts` stub (from E92-S04) with a working upload phase. The engine reads `syncQueue` from Dexie, coalesces duplicate entries per `(tableName, recordId)` pair, batches records to Supabase in chunks of 100, routes each table to the correct upload strategy (LWW upsert / monotonic RPC / insert-only insert), retries transient failures with exponential backoff, dead-letters permanent failures, and serializes concurrent upload cycles via `navigator.locks`. The public API surface (`nudge()`, `isRunning`) stays identical to the S04 stub.

Two files change:
- `src/lib/sync/syncEngine.ts` — stub body replaced with real logic
- `src/lib/sync/__tests__/syncEngine.test.ts` — new unit test file

No other files are modified.

## Problem Frame

`syncableWrite()` (E92-S04) writes records to Dexie and enqueues them in `syncQueue`, then calls `syncEngine.nudge()` — which is currently a no-op. Without this story, no data reaches Supabase. This story implements the engine that drains that queue. All subsequent sync epics (E93–E96) depend on this upload foundation being reliable: coalescing ensures each record is uploaded exactly once even when written rapidly, retry logic handles transient network issues, and dead-lettering prevents infinite retry storms.

(see origin: `docs/brainstorms/2026-04-18-e92-s05-sync-engine-upload-phase-requirements.md`)

## Requirements Trace

- R1. Queue entries uploaded to Supabase are deleted from `syncQueue` on success
- R2. Coalescing: only the latest `SyncQueueEntry` per `(tableName, recordId)` pair (by `createdAt`) is uploaded; superseded entries deleted before upload
- R3. Batch size 100: 250 records → exactly 3 Supabase calls (100+100+50)
- R4. LWW and conflict-copy tables → `supabase.from(table).upsert(batch, { onConflict: 'id' })`
- R5. Monotonic tables → `supabase.rpc()` per record (not batched array)
- R6. Insert-only tables → `supabase.from(table).insert(batch)` (ON CONFLICT DO NOTHING)
- R7. Retry: 1s/2s/4s/8s/16s backoff on 5xx or network errors; delays verifiable via fake timers
- R8. Dead-letter: after 5 failures `status = 'dead-letter'`; never retried automatically
- R9. 4xx (except 401) → immediate dead-letter; 401 → `refreshSession()` then one retry
- R10. `navigator.locks.request('sync-upload', { ifAvailable: true })` serializes concurrent runs
- R11. `nudge()` debounced 200ms: multiple rapid calls → single upload cycle
- R12. `npx tsc --noEmit` clean, lint clean, build clean
- R13. Unit tests cover coalesce, batch-split, retry delays, dead-letter, 4xx, 401-refresh, concurrency, debounce

## Scope Boundaries

- No download phase (S06)
- No sync triggers or online/offline handling (S07)
- No auth lifecycle `start(userId)` / `stop()` API (S08)
- No `useSyncStatusStore` Zustand store (S07)
- No `syncEngine.fullSync()` (S06)
- No UI components
- No modifications to `syncableWrite.ts`, `tableRegistry.ts`, `fieldMapper.ts`, `backfill.ts`
- No `deviceId` stamped on queue entries or payloads (deferred to S07/S08)

### Deferred to Separate Tasks

- Monotonic RPC for P2+ tables (`challenges`, `vocabularyItems`, `books`): separate PRs in E93–E96 when their migrations exist. S05 adds warning log + generic upsert fallback for those tables.
- `syncEngine.start(userId)` and `syncEngine.stop()` public API: E92-S06

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — current no-op stub; exports `syncEngine.nudge()`, `syncEngine.isRunning`, `syncEngine._setRunning()`. Must preserve these signatures
- `src/lib/sync/tableRegistry.ts` — exports `getTableEntry(dexieTable)` for strategy routing; `conflictStrategy`, `insertOnly`, `monotonicFields`, `supabaseTable` drive the dispatch
- `src/lib/sync/syncableWrite.ts` — already calls `syncEngine.nudge()`; must compile unchanged
- `src/lib/auth/supabase.ts` — exports `supabase: SupabaseClient | null`; may be null when env vars missing; always null-guard
- `src/db/index.ts` / `src/db/schema.ts` — `db.syncQueue` is `EntityTable<SyncQueueEntry, 'id'>`; `SyncQueueEntry.status` type is `'pending' | 'uploading' | 'dead-letter'` (NOT `'dead'` — confirmed in schema.ts line 60)
- `src/lib/sync/__tests__/syncableWrite.test.ts` — shows vi.hoisted + vi.mock pattern used in this directory; navigator.locks will need Object.defineProperty mock
- `src/lib/sync/__tests__/backfill.test.ts` — shows `fake-indexeddb/auto` import + Dexie.delete cleanup pattern

### Key Dexie Query API

```
db.syncQueue.where('status').equals('pending').sortBy('createdAt')  // returns sorted entries
db.syncQueue.update(id, { attempts, status, lastError, updatedAt }) // update single entry
db.syncQueue.bulkDelete([id1, id2, ...])                            // delete multiple entries
```

### Institutional Learnings

- `docs/engineering-patterns.md`: Pure module guard — no React imports in `src/lib/sync/*.ts`. The supabase client import from `@/lib/auth/supabase` is acceptable (uses `import.meta.env` internally with its own null guard). Add `// Intentional:` comments at every non-obvious site (null guard, lock guard, fallback flag).

## Key Technical Decisions

- **`'dead-letter'` not `'dead'`**: `SyncQueueEntry.status` in `src/db/schema.ts` uses `'dead-letter'` as the terminal value. Do not use `'dead'` — it would be a TypeScript error.
- **Per-record RPC for monotonic tables**: Postgres monotonic functions (`upsert_content_progress`, `upsert_video_progress`) accept named parameters, not array batches. Each record is an individual `supabase.rpc()` call. Acceptable at P0 volume (contentProgress, videoProgress). For P2+ monotonic tables without a dedicated RPC (challenges, vocabularyItems, books), log a warning and fall back to generic upsert — correct behavior pending their migration stories.
- **Retry via re-nudge**: Failed entries get `attempts++` updated in Dexie, then a `setTimeout(() => syncEngine.nudge(), backoffMs)` schedules the next attempt. This leverages the existing debounce and coalescing logic rather than building a separate retry queue.
- **Module-level `_debounceTimer`**: Standard `setTimeout`/`clearTimeout` debounce. Clear on each `nudge()` call, set a new 200ms timer.
- **navigator.locks with module-level fallback**: Use `navigator.locks.request('sync-upload', { ifAvailable: true }, cb)` as the primary guard. If `navigator.locks` is undefined (Safari ≤15.3), fall back to a module-level `_isRunning` boolean. Both guard paths must call `_setRunning()`.
- **Monotonic RPC parameter mapping (P0 only)**:
  - `content_progress` → `upsert_content_progress` with params: `p_user_id, p_content_id, p_content_type, p_status, p_progress_pct, p_updated_at`
  - `video_progress` → `upsert_video_progress` with params: `p_user_id, p_video_id, p_watched_seconds, p_duration_seconds, p_updated_at`
  - These functions were created in E92-S01. Map the snake_case payload keys to these parameter names.
- **`'uploading'` status not used in S05**: The schema defines `'uploading'` as a status value, but S05 does not update entries to `'uploading'` mid-batch. Entries stay `'pending'` until success (deleted) or failure (attempts++ or `'dead-letter'`). The `'uploading'` status is reserved for a future concurrent-marker if needed (S06/S07).

## Open Questions

### Resolved During Planning

- **`status = 'dead'` vs `'dead-letter'`**: The schema (`src/db/schema.ts` line 60) uses `'dead-letter'`. The planning doc from E92-S05 story file says `'dead'` — that was an error. Use `'dead-letter'` throughout.
- **Should monotonic tables be called per-record or batched?**: Per-record via `supabase.rpc()` — Postgres functions accept named params, not arrays. Acceptable volume for P0.
- **What is the backoff delay formula?**: `1 << attempts` seconds (so: 1s, 2s, 4s, 8s, 16s for attempts 0–4). Cap at 16s. `Math.min(1000 * (1 << entry.attempts), 16000)` milliseconds.

### Deferred to Implementation

- Whether `db.syncQueue.where('status').equals('pending').sortBy('createdAt')` returns a Dexie `Collection` that needs `.toArray()` — check at implementation time
- Exact parameter name mapping from snake_case payload to RPC params for `upsert_content_progress` and `upsert_video_progress` — validate against E92-S01 migration

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
nudge() call
     │ clearTimeout(_debounceTimer)
     │ _debounceTimer = setTimeout(200ms) →
                    ▼
           _runUploadCycle()
                    │
         navigator.locks.request('sync-upload', { ifAvailable: true })
                    │ lock acquired?
            No ─── return   Yes ──►
                              │
                    _isRunning = true
                              │
              supabase null? → warn + return
                              │
              coalesce: read pending, build Map<"table:recordId" → entry>
                         delete superseded ids via bulkDelete
                              │
              group by tableName
                              │
              for each table group:
                chunk into 100s
                lookup TableRegistryEntry
                route:
                  insertOnly  → supabase.from().insert(batch)
                  monotonic   → supabase.rpc() per record
                  default     → supabase.from().upsert(batch, { onConflict:'id' })
                              │
              on success → bulkDelete queue entries
              on error   → classifyError():
                  401   → refreshSession(), retry once
                  5xx/net → attempts++; attempts<5 → nudge in backoffMs; ≥5 → 'dead-letter'
                  4xx   → 'dead-letter' immediately
                              │
                    _isRunning = false
```

## Implementation Units

- [ ] **Unit 1: Real nudge() debounce + navigator.locks concurrency guard**

**Goal:** Replace the no-op `nudge()` with a debounced 200ms trigger that acquires `navigator.locks` before running the upload cycle.

**Requirements:** R10, R11

**Dependencies:** None (modifies existing stub file)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`

**Approach:**
- Add module-level `_debounceTimer: ReturnType<typeof setTimeout> | null = null`
- `nudge()` clears any existing timer and sets a new 200ms `setTimeout` that calls `_runUploadCycle()`
- `_runUploadCycle()` acquires `navigator.locks.request('sync-upload', { ifAvailable: true }, async (lock) => { if (!lock) return; ... })`. Lock callback sets `_setRunning(true)`, runs `_doUpload()`, then calls `_setRunning(false)` in a `finally` block
- If `navigator.locks` is undefined: use a module-level `_uploadInFlight: boolean` flag — `if (_uploadInFlight) return; _uploadInFlight = true; try { await _doUpload() } finally { _uploadInFlight = false }`. Call `_setRunning()` in both branches.
- The `_runUploadCycle().catch(err => console.error('[syncEngine] Upload cycle error:', err))` in the setTimeout callback ensures errors don't leak as unhandled rejections

**Test scenarios:**
- Happy path: `nudge()` called once → `_runUploadCycle` entered after 200ms
- Edge case: `nudge()` called 5× within 200ms → `_runUploadCycle` entered exactly once
- Edge case: `nudge()` called again after debounce fires → second cycle runs correctly
- Concurrency: two simultaneous `_runUploadCycle()` calls → only one proceeds (lock mock returns null for second)
- Fallback: `navigator.locks` undefined → `_uploadInFlight` flag prevents parallel entry

**Verification:**
- vi.useFakeTimers() + advanceTimersByTime(201) → upload cycle entered once regardless of nudge count
- Lock mock returning `null` for second call → `_doUpload` not called twice

---

- [ ] **Unit 2: Queue coalescing — deduplicate before upload**

**Goal:** Read all pending queue entries, build a coalesced map (latest per `tableName:recordId`), delete superseded entries, return the winning entries for upload.

**Requirements:** R2

**Dependencies:** Unit 1 (calls into `_doUpload` which uses coalescing)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`

**Approach:**
- `_coalesceQueue(): Promise<SyncQueueEntry[]>`: reads `db.syncQueue.where('status').equals('pending').sortBy('createdAt')` → entries ordered oldest-first
- Builds `Map<string, SyncQueueEntry>` keyed by `${tableName}:${recordId}`; iterating oldest-to-newest means each entry overwrites the previous one in the map for the same key — keeping the latest
- Collects superseded `id` values (those overwritten in the map) into a `number[]`
- Calls `db.syncQueue.bulkDelete(supersededIds)` to remove them before upload
- Returns `[...latest.values()]`

**Patterns to follow:**
- `src/lib/sync/backfill.ts` — shows batch Dexie operations pattern

**Test scenarios:**
- Happy path: 3 entries for different records → all 3 returned, 0 deleted
- Happy path: 2 entries for same `(tableName, recordId)` with different `createdAt` → 1 returned (latest), 1 deleted
- Edge case: empty queue → returns `[]`, no bulkDelete call
- Edge case: 10 entries for the same record → 1 returned (latest by createdAt), 9 deleted

**Verification:**
- After coalesce, `db.syncQueue.bulkDelete` called with exactly the superseded ids
- Returned array contains only the most recent entry per key

---

- [ ] **Unit 3: Batch upload with table-strategy routing**

**Goal:** Group coalesced entries by table, split into 100-record batches, route each batch to the correct Supabase call based on `TableRegistryEntry.conflictStrategy` / `insertOnly`.

**Requirements:** R3, R4, R5, R6

**Dependencies:** Unit 2 (coalesced entries), Unit 1 (called from `_doUpload`)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.test.ts`

**Approach:**
- `_doUpload()` calls `_coalesceQueue()` then groups entries by `tableName`
- `chunk<T>(arr: T[], size: number): T[][]` — pure utility; split array into fixed-size chunks
- For each table group, call `getTableEntry(tableName)` from `tableRegistry.ts` to get `TableRegistryEntry`
- If no registry entry found (unexpected): log error, skip table (do not dead-letter — caller bug, not a transient failure)
- **Insert-only** (`insertOnly: true` or `conflictStrategy: 'insert-only'`): `supabase.from(entry.supabaseTable).insert(payloads)`
- **Monotonic** (`conflictStrategy: 'monotonic'`): check `MONOTONIC_RPC` map; if entry found, call `supabase.rpc(rpcName, params)` per record; if no RPC entry, log warning and fall back to generic upsert
- **Default** (lww, conflict-copy, or any other): `supabase.from(entry.supabaseTable).upsert(payloads, { onConflict: 'id' })`
- Payload for upload: `entry.payload` (already snake_case from `syncableWrite` via `toSnakeCase`) — no re-conversion needed
- On Supabase success (`!error`): `await db.syncQueue.bulkDelete(batchEntryIds)` — remove uploaded entries

**Patterns to follow:**
- `src/lib/auth/supabase.ts` — import and null-guard pattern
- `src/lib/sync/tableRegistry.ts` — `getTableEntry()` usage

**Test scenarios:**
- Happy path: 1 LWW entry → `supabase.from().upsert()` called once, entry deleted from queue
- Happy path: 1 insert-only entry → `supabase.from().insert()` called, not `.upsert()`
- Happy path: 1 monotonic entry for `content_progress` → `supabase.rpc('upsert_content_progress', {...})` called
- Happy path: 250 LWW entries for same table → `supabase.from().upsert()` called 3× (100+100+50)
- Happy path: monotonic entry for `challenges` (no RPC in map) → fallback to `.upsert()`, warning logged
- Edge case: `supabase` is null → returns immediately, no Supabase calls, no queue modification
- Edge case: unregistered table name in queue → skipped, others still processed

**Verification:**
- 250-entry mock → exactly 3 upsert calls, each with correct payload count
- Deleted entry ids passed to `bulkDelete` match the uploaded batch ids

---

- [ ] **Unit 4: Retry with exponential backoff and dead-lettering**

**Goal:** On Supabase errors, classify the failure, increment `attempts`, apply backoff or dead-letter, and schedule retry via `nudge()`.

**Requirements:** R7, R8, R9

**Dependencies:** Unit 3 (wraps the batch call result)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.test.ts`

**Approach:**
- `_classifyError(status: number | undefined, isNetworkError: boolean): 'retry' | 'dead-letter' | 'refresh-auth'`:
  - `isNetworkError || !status || status >= 500` → `'retry'`
  - `status === 401` → `'refresh-auth'`
  - `status >= 400 && status < 500` → `'dead-letter'`
- `_handleBatchError(entries: SyncQueueEntry[], supabaseError: {status?: number} | null, isNetworkError: boolean)`:
  - Classify → `'retry'` | `'dead-letter'` | `'refresh-auth'`
  - `'refresh-auth'`: call `await supabase!.auth.refreshSession()`, then retry the batch once. If retry succeeds → delete entries. If retry fails → route to `'retry'` path (count against attempts limit)
  - `'retry'`: for each entry, `newAttempts = entry.attempts + 1`. If `newAttempts >= MAX_ATTEMPTS (5)` → update `status: 'dead-letter'`, `lastError: errMsg`. Else → update `attempts: newAttempts`, schedule `setTimeout(() => syncEngine.nudge(), backoffMs)` where `backoffMs = Math.min(1000 * (1 << entry.attempts), 16000)`
  - `'dead-letter'`: update each entry `status: 'dead-letter'`, `lastError: errMsg` immediately
  - All Dexie updates use `db.syncQueue.update(entry.id!, { attempts, status, lastError, updatedAt })`

**Patterns to follow:**
- S04 error handling pattern: intentional comments at every non-obvious catch site

**Test scenarios:**
- Retry: 5xx response → `attempts` incremented, `setTimeout` scheduled with 1s delay; entry still `'pending'`
- Retry with fake timers: verify delay sequence `[1000, 2000, 4000, 8000, 16000]` ms for attempts 0–4
- Dead-letter after 5×: entry with `attempts: 4` fails → `status = 'dead-letter'`, `lastError` set, no timer scheduled
- 4xx immediate dead-letter: 400 response → `status = 'dead-letter'` on first failure, no timer
- 401 refresh: 401 response → `refreshSession()` called → batch retried → success → entries deleted
- 401 refresh + retry fail: 401 → refresh → retry also fails (500) → routes to retry path, attempts incremented
- Network error: `TypeError` (no status) → treated as retry, not dead-letter

**Verification:**
- After 5 failures: `db.syncQueue.update` called with `{ status: 'dead-letter' }`
- Backoff timer fires at correct delays (fake timers + `advanceTimersByTime`)

---

- [ ] **Unit 5: Unit tests**

**Goal:** Comprehensive unit test file covering all acceptance criteria.

**Requirements:** R13

**Dependencies:** Units 1–4 (tests the complete engine)

**Files:**
- Create: `src/lib/sync/__tests__/syncEngine.test.ts`

**Approach:**
- Use `vi.hoisted()` + `vi.mock()` pattern (same as `syncableWrite.test.ts`)
- Mock `@/db`: `db.syncQueue.where().equals().sortBy()`, `db.syncQueue.update()`, `db.syncQueue.bulkDelete()`
- Mock `@/lib/auth/supabase`: `supabase.from().upsert()`, `supabase.from().insert()`, `supabase.rpc()`, `supabase.auth.refreshSession()`
- Mock `navigator.locks` via `Object.defineProperty(globalThis.navigator, 'locks', { value: { request: mockLockFn }, configurable: true })`
- `vi.useFakeTimers()` in `beforeEach`, `vi.useRealTimers()` in `afterEach` for all timer-dependent tests
- Reset all mocks in `beforeEach` to avoid test-to-test bleed

**Patterns to follow:**
- `src/lib/sync/__tests__/syncableWrite.test.ts` — full mock pattern with `vi.hoisted()`, `vi.clearAllMocks()`, `mockReturnValue` restoration in `beforeEach`

**Test scenarios:** (all scenarios from Units 1–4 consolidated here)
- `nudge()` debounce: 5 rapid calls within 200ms → `_doUpload` called once (fake timers)
- `nudge()` sequential: call, advance 201ms, call again, advance 201ms → `_doUpload` called twice
- Concurrency: lock returns `null` for second call → `_doUpload` not called twice
- Coalesce: 2 entries same `(tableName, recordId)` → 1 upsert call, 1 bulkDelete for superseded
- Batch split: 250 entries → 3 upsert calls
- Strategy routing: insertOnly → insert(), monotonic-with-RPC → rpc(), default → upsert()
- 5xx retry: 4 failures + 1 success → entry deleted on success; correct delays verified
- Dead-letter: 5 consecutive 5xx → `status = 'dead-letter'`
- 4xx immediate dead-letter: 400 → `status = 'dead-letter'` without retry
- 401 refresh + retry success: refresh called, batch retried, entry deleted
- supabase null: `nudge()` called → no error, no Supabase call
- Network error: classify as retry (not dead-letter)

**Verification:**
- `npm run test:unit` passes with all new tests green
- No existing test regressions

---

- [ ] **Unit 6: Verification pass**

**Goal:** Confirm the implementation compiles clean, passes lint, and builds.

**Requirements:** R12

**Dependencies:** Units 1–5

**Files:** (no new files — read-only verification)

**Approach:**
- Run `npm run test:unit` — all tests pass
- Run `npx tsc --noEmit` — zero errors
- Run `npm run lint` — zero errors (ESLint design-token rule is ERROR-level; pure sync module has no Tailwind, no colors)
- Run `npm run build` — clean

**Test expectation:** none — this unit is verification only

**Verification:**
- All three commands exit with code 0
- No TypeScript errors in `syncEngine.ts` or `syncEngine.test.ts`

## System-Wide Impact

- **Interaction graph:** `syncableWrite.ts` calls `syncEngine.nudge()` synchronously after queue insert. S05's debounced `nudge()` means upload is deferred 200ms after each write — this is intentional. No other modules directly import from `syncEngine.ts` in S05 scope (S06 will add `start()`/`stop()`).
- **Error propagation:** Upload errors are fully absorbed inside `_runUploadCycle()`. Errors are written to `SyncQueueEntry.lastError` and logged via `console.error`. No errors surface to the calling code (caller is `syncableWrite()` → `nudge()` which already resolved). The `_runUploadCycle().catch()` on the debounce timeout prevents unhandled promise rejection.
- **State lifecycle risks:** The `navigator.locks` guard prevents parallel uploads. The module-level fallback `_uploadInFlight` flag provides the same guarantee on older browsers. No risk of two simultaneous Supabase upserts for the same record.
- **API surface parity:** `syncEngine.nudge()` and `syncEngine.isRunning` signatures unchanged — `syncableWrite.ts` continues to compile without modification. `_setRunning()` is `@internal` and not part of the public contract.
- **Integration coverage:** No cross-layer integration in S05 — the upload engine talks to Dexie (mocked) and Supabase (mocked). True integration coverage (seeing data arrive in Supabase) belongs to S09's integration test (`tests/sync/p0-sync.spec.ts`).
- **Unchanged invariants:** `syncableWrite()` → Dexie write → queue insert → `nudge()` call chain is unchanged. The engine stub in S04 compiled and no-opped; S05 makes `nudge()` real without changing the calling contract.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `'dead-letter'` vs `'dead'` schema mismatch | Confirmed in `src/db/schema.ts` line 60 — use `'dead-letter'` everywhere |
| `Dexie.where().sortBy()` returns a Promise not a Collection — wrong chain | Verify at implementation time; sortBy() on a WhereClause returns Promise<T[]> in Dexie 4 |
| `navigator.locks` not available in Vitest jsdom environment | Mock via `Object.defineProperty(globalThis.navigator, 'locks', ...)` in test setup |
| Monotonic RPC param names drift from E92-S01 migration | Validate against migration file before implementing; plan shows known param names as directional guidance |
| Retry `setTimeout` accumulation if engine never drains | Acceptable: each retry fires one more `nudge()`, which enters the debounce. Concurrent nudges collapse via debounce. Dead-letter cap of 5 prevents infinite growth. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e92-s05-sync-engine-upload-phase-requirements.md](docs/brainstorms/2026-04-18-e92-s05-sync-engine-upload-phase-requirements.md)
- **BMAD story:** [docs/implementation-artifacts/92-5-sync-engine-upload-phase.md](docs/implementation-artifacts/92-5-sync-engine-upload-phase.md)
- **S04 plan (prior art):** [docs/plans/2026-04-18-003-feat-e92-s04-syncable-write-wrapper-plan.md](docs/plans/2026-04-18-003-feat-e92-s04-syncable-write-wrapper-plan.md)
- **syncEngine.ts stub:** [src/lib/sync/syncEngine.ts](src/lib/sync/syncEngine.ts)
- **SyncQueueEntry schema:** [src/db/schema.ts](src/db/schema.ts) — status: `'pending' | 'uploading' | 'dead-letter'`
- **tableRegistry:** [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts)
- **Supabase client:** [src/lib/auth/supabase.ts](src/lib/auth/supabase.ts)
- **Test pattern reference:** [src/lib/sync/__tests__/syncableWrite.test.ts](src/lib/sync/__tests__/syncableWrite.test.ts)
