---
story_id: E92-S05
story_name: "Sync Engine Upload Phase"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.05: Sync Engine Upload Phase

## Story

As the Knowlune sync system,
I want a real upload phase inside `syncEngine.ts` that reads from `syncQueue`, coalesces duplicates, batches upserts to Supabase, and retries with exponential backoff,
so that every local write made via `syncableWrite()` eventually reaches Supabase even when the device goes offline or requests fail transiently.

## Acceptance Criteria

**AC1 — Queue drain on success:** Queue entries uploaded to Supabase are deleted from `syncQueue`. After a successful upload cycle, the drained records no longer appear in Dexie `syncQueue`.

**AC2 — Queue coalescing:** Before uploading, for each `(tableName, recordId)` pair, only the latest queue entry by `createdAt` is used. Earlier duplicate entries for the same record are discarded (deleted) without being uploaded.

**AC3 — Batch size 100:** Records are uploaded 100 per Supabase call. A batch of 250 records results in exactly 3 Supabase calls (100 + 100 + 50).

**AC4 — Generic LWW upsert:** Tables with `conflictStrategy: 'lww'` (or `'conflict-copy'`) use `supabase.from(table).upsert(batch, { onConflict: 'id' })`.

**AC5 — Monotonic upsert override:** Tables with `conflictStrategy: 'monotonic'` call their dedicated Postgres function (e.g., `upsert_video_progress()`, `upsert_content_progress()`) via `supabase.rpc()` instead of a generic upsert. Each record is sent as an individual RPC call (not batched into a single array call).

**AC6 — INSERT-only tables:** Tables with `insertOnly: true` or `conflictStrategy: 'insert-only'` use `supabase.from(table).insert(batch)` with the Supabase client's default `ON CONFLICT DO NOTHING` behavior. Duplicate inserts are no-ops.

**AC7 — Retry with exponential backoff:** On 5xx or network errors (`TypeError: Failed to fetch`), the entry is retried with delays of 1s, 2s, 4s, 8s, 16s. After 5 attempts the entry is dead-lettered (see AC8). Backoff schedule is verifiable via unit tests with fake timers.

**AC8 — Dead-letter:** After 5 consecutive failures, update `syncQueue` entry `status = 'dead'`. The entry is never retried automatically. It surfaces in the Sync Settings panel (E97-S02).

**AC9 — 4xx permanent failure:** 4xx errors (400, 403, 404) dead-letter the entry immediately (do not retry). Exception: 401 triggers `supabase.auth.refreshSession()` and then retries the upload once.

**AC10 — Concurrency guard:** `navigator.locks.request('sync-upload', { ifAvailable: true }, ...)` serializes upload runs. If the lock is already held (another upload is running), `nudge()` returns immediately without starting a second upload.

**AC11 — nudge() debounce:** `syncEngine.nudge()` becomes a real debounced (200ms) trigger for `_runUploadCycle()`. Multiple rapid `nudge()` calls within 200ms result in a single upload cycle.

**AC12 — TypeScript compiles clean:** `npx tsc --noEmit` produces zero errors.

**AC13 — Unit test coverage:** Tests in `src/lib/sync/__tests__/syncEngine.test.ts` verify:
- Coalescing: two puts for the same record → one Supabase call (AC2)
- Batch split: 250 records → 3 calls (AC3)
- Retry backoff delays match schedule (AC7 — fake timers)
- After 5 failures, entry has `status = 'dead'` (AC8)
- 5xx errors retry; 4xx dead-letter immediately; 401 triggers session refresh then retry (AC9)
- Concurrent `nudge()` calls do not run parallel uploads (AC10)

## Tasks / Subtasks

- [ ] Task 1: Implement `syncEngine.nudge()` as a real debounced upload trigger (AC: 11, 10)
  - [ ] 1.1 Replace the no-op `nudge()` body with a 200ms debounce using `setTimeout` / `clearTimeout`
  - [ ] 1.2 On each debounced fire, call `_runUploadCycle()` which acquires the `navigator.locks` lock
  - [ ] 1.3 If `navigator.locks.request` with `{ ifAvailable: true }` returns `null` (lock busy), return immediately — do not queue a second cycle
  - [ ] 1.4 Keep the public API surface (`nudge()`, `isRunning`) identical to the S04 stub — no breaking changes

- [ ] Task 2: Implement queue coalescing (AC: 2)
  - [ ] 2.1 Read all `status: 'pending'` entries from `db.syncQueue` ordered by `createdAt` ascending
  - [ ] 2.2 Build a `Map<string, SyncQueueEntry>` keyed by `tableName + ':' + recordId`; later entries overwrite earlier ones
  - [ ] 2.3 Delete the superseded (earlier) entries from `syncQueue` before uploading (they will never reach Supabase)
  - [ ] 2.4 Proceed with uploading only the coalesced entries

- [ ] Task 3: Implement batch upload with table-strategy routing (AC: 3, 4, 5, 6)
  - [ ] 3.1 Group coalesced entries by `tableName`
  - [ ] 3.2 For each table group, look up the `TableRegistryEntry` via `getTableEntry(tableName)` from `tableRegistry.ts`
  - [ ] 3.3 Split the group into chunks of 100 (BATCH_SIZE constant)
  - [ ] 3.4 For `insertOnly: true` entries: call `supabase.from(entry.supabaseTable).insert(batchPayloads)`
  - [ ] 3.5 For `conflictStrategy: 'monotonic'` entries: call the table's dedicated Postgres function via `supabase.rpc()`. Map table name to RPC function name: `content_progress → upsert_content_progress`, `video_progress → upsert_video_progress`. Each record is an individual RPC call (looped, not batched — RPCs do not accept arrays).
  - [ ] 3.6 For all other strategies (lww, conflict-copy): call `supabase.from(entry.supabaseTable).upsert(batchPayloads, { onConflict: 'id' })`
  - [ ] 3.7 On Supabase success for a batch: delete the corresponding queue entries from `db.syncQueue`
  - [ ] 3.8 On Supabase error for a batch: route each entry through the retry/dead-letter logic (Task 4)

- [ ] Task 4: Implement retry and dead-letter logic (AC: 7, 8, 9)
  - [ ] 4.1 On any Supabase error response: inspect `error.status` (HTTP status code)
  - [ ] 4.2 If `error.status >= 500` or the error is a network error (`TypeError`, no `.status`): increment `attempts` on each failed queue entry; if `attempts < 5`, schedule retry with exponential backoff (`1 << attempts` seconds, capped at 16s); if `attempts >= 5`, set `status = 'dead'` and `lastError` to the error message
  - [ ] 4.3 If `error.status === 401`: call `await supabase.auth.refreshSession()`; retry the batch once (do not count against the 5-attempt limit); if retry also fails, apply normal 5xx retry logic
  - [ ] 4.4 If `error.status >= 400 && error.status < 500` (and not 401): set `status = 'dead'` immediately (no retries); set `lastError` to the error message
  - [ ] 4.5 Update `syncQueue` entries in Dexie with new `attempts`, `status`, and `lastError` after each failure

- [ ] Task 5: Write unit tests (AC: 13)
  - [ ] 5.1 Create `src/lib/sync/__tests__/syncEngine.test.ts`
  - [ ] 5.2 Mock `@/db` (syncQueue read/update/delete), `supabase` client, and `navigator.locks`
  - [ ] 5.3 Test coalescing: add 2 queue entries for same `(tableName, recordId)` → `supabase.from().upsert()` called once with latest payload
  - [ ] 5.4 Test batch split: 250 pending entries → supabase upsert called 3 times (100 + 100 + 50)
  - [ ] 5.5 Test 5xx retry: mock supabase to fail 4 times with 500, succeed on 5th → entry deleted on success, attempts incremented on each failure
  - [ ] 5.6 Test dead-letter after 5 failures: 5 consecutive 5xx → `status = 'dead'`, `lastError` set
  - [ ] 5.7 Test 4xx dead-letter: single 400 → `status = 'dead'` immediately, no retry
  - [ ] 5.8 Test 401 session refresh: 401 → `refreshSession()` called → batch retried once
  - [ ] 5.9 Test concurrency guard: nudge() called twice rapidly → upload cycle entered only once (lock mock)
  - [ ] 5.10 Test nudge() debounce: 5 nudge() calls within 200ms → `_runUploadCycle()` called only once (vi.useFakeTimers)

- [ ] Task 6: Verification
  - [ ] 6.1 `npm run test:unit` — all tests pass (new + pre-existing)
  - [ ] 6.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 6.3 `npm run lint` — zero errors
  - [ ] 6.4 `npm run build` — clean

## Design Guidance

No UI components. This is a pure TypeScript infrastructure story. All changes are confined to `src/lib/sync/syncEngine.ts` and the new test file `src/lib/sync/__tests__/syncEngine.test.ts`.

## Implementation Notes

### File Locations

Only these two files are created or modified:
- `src/lib/sync/syncEngine.ts` — replace stub with real upload phase (do NOT change the exported public API shape)
- `src/lib/sync/__tests__/syncEngine.test.ts` — new unit tests

Do NOT touch:
- `syncableWrite.ts` — already complete from S04
- `tableRegistry.ts` — already complete from S03
- `fieldMapper.ts` — already complete from S03
- `backfill.ts` — already complete from S02

### Public API Contract (Must Not Change)

The S04 stub exposes:
```ts
export const syncEngine = {
  nudge(): void { ... },
  get isRunning(): boolean { ... },
  _setRunning(value: boolean): void { ... },  // @internal
}
```

S05 replaces the bodies of `nudge()` and `_setRunning()`, and adds `_runUploadCycle()` as an internal method. The external shape (`nudge()`, `isRunning`) must not change — `syncableWrite.ts` already calls `syncEngine.nudge()` and must continue to compile without modification.

### Supabase Client Import

Import from the project's shared Supabase client:
```ts
import { supabase } from '@/lib/auth/supabase'
```

The client may be `null` when env vars are missing. Guard all Supabase calls:
```ts
if (!supabase) {
  console.warn('[syncEngine] Supabase not configured — upload skipped')
  return
}
```

### Navigator.locks Usage

```ts
async function _runUploadCycle(): Promise<void> {
  if (!navigator.locks) {
    // Safari 15 and older — fall back to a module-level flag
    if (_isRunning) return
    _isRunning = true
    try { await _doUpload() } finally { _isRunning = false }
    return
  }

  await navigator.locks.request(
    'sync-upload',
    { ifAvailable: true },
    async (lock) => {
      if (!lock) return  // lock busy — another upload is running
      _isRunning = true
      try { await _doUpload() } finally { _isRunning = false }
    }
  )
}
```

`navigator.locks` is available in all modern browsers (Chrome 69+, Firefox 96+, Safari 15.4+). The fallback flag covers the rare edge case.

### Debounce Pattern

```ts
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

export const syncEngine = {
  nudge(): void {
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      _runUploadCycle().catch((err) => {
        console.error('[syncEngine] Upload cycle failed:', err)
      })
    }, 200)
  },
  // ...
}
```

### Queue Coalescing Logic

```ts
async function _coalesceQueue(): Promise<SyncQueueEntry[]> {
  // Read all pending entries, ordered by createdAt ascending
  const pending = await db.syncQueue
    .where('status')
    .equals('pending')
    .sortBy('createdAt')

  // Keep latest entry per (tableName, recordId) pair
  const latest = new Map<string, SyncQueueEntry>()
  const superseded: number[] = []

  for (const entry of pending) {
    const key = `${entry.tableName}:${entry.recordId}`
    if (latest.has(key)) {
      // Current entry replaces a previous one — the previous is superseded
      superseded.push(latest.get(key)!.id!)
    }
    latest.set(key, entry)
  }

  // Delete superseded entries — they will never reach Supabase
  if (superseded.length > 0) {
    await db.syncQueue.bulkDelete(superseded)
  }

  return [...latest.values()]
}
```

### Batch Split Utility

```ts
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

const BATCH_SIZE = 100
```

### Monotonic RPC Function Map

The mapping from Dexie table name to Postgres function name is fixed for the P0 tables that have `conflictStrategy: 'monotonic'`:

```ts
const MONOTONIC_RPC: Record<string, string> = {
  content_progress: 'upsert_content_progress',
  video_progress: 'upsert_video_progress',
  // books uses upsert_book_progress — added in E94-S01; skip for now (S05 is E92)
}
```

For tables with `conflictStrategy: 'monotonic'` that do NOT have an RPC entry (e.g., `challenges`, `vocabularyItems`, `books`), fall back to a generic upsert for now. Log a warning: `[syncEngine] No RPC for monotonic table {supabaseTable} — falling back to upsert`.

### Exponential Backoff

```
attempt 0 (first failure) → 1s  (1 << 0)
attempt 1                  → 2s  (1 << 1)
attempt 2                  → 4s  (1 << 2)
attempt 3                  → 8s  (1 << 3)
attempt 4                  → 16s (1 << 4) — cap
```

The retry is implemented by re-incrementing `attempts` in the queue entry and scheduling a `setTimeout` that calls `nudge()` after the delay. The debounce will coalesce multiple retrying entries into a single upload cycle if they fire at similar times.

### Error Classification

```ts
function classifyError(error: { status?: number } | null, networkErr: boolean): 'retry' | 'dead' | 'refresh-auth' {
  if (networkErr || !error?.status || error.status >= 500) return 'retry'
  if (error.status === 401) return 'refresh-auth'
  if (error.status >= 400) return 'dead'
  return 'retry'
}
```

### Dexie syncQueue Schema (from S02)

The `syncQueue` table exists in Dexie with this shape (already defined — do not redefine):
```ts
interface SyncQueueEntry {
  id?: number           // auto-increment primary key
  tableName: string
  recordId: string
  operation: 'put' | 'add' | 'delete'
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'uploading' | 'dead'
  createdAt: string     // ISO timestamp string
  updatedAt: string     // ISO timestamp string
  lastError?: string
}
```

Note: the S04 story file references `status: 'pending' | 'uploading' | 'dead-letter'` but the actual Dexie schema uses `'dead'` (not `'dead-letter'`). Use `'dead'` as the terminal status — check `src/db/schema.ts` to confirm before writing tests.

### Querying Dexie syncQueue

Use Dexie's WhereClause API for indexed queries:
```ts
// Read all pending entries sorted by createdAt
const pending = await db.syncQueue
  .where('status').equals('pending')
  .sortBy('createdAt')

// Update entry after failure
await db.syncQueue.update(entry.id!, {
  attempts: entry.attempts + 1,
  status: entry.attempts + 1 >= MAX_ATTEMPTS ? 'dead' : 'pending',
  lastError: errMsg,
  updatedAt: new Date().toISOString(),
})

// Delete successfully uploaded entries
await db.syncQueue.bulkDelete(successfulIds)
```

### Auth Refresh on 401

```ts
if (!supabase) return
const { error: refreshError } = await supabase.auth.refreshSession()
if (!refreshError) {
  // Retry the batch once — do not count this against the attempts limit
  const { error: retryError } = await supabase.from(supabaseTable).upsert(batch, { onConflict: 'id' })
  if (!retryError) {
    // Success after refresh — delete queue entries
  } else {
    // Still failing after refresh — apply normal backoff logic
  }
}
```

### Pure Module Guard

`syncEngine.ts` must remain importable from anywhere, including non-browser environments (unit test runner). Do not import from React, Zustand stores, or the UI layer. The Supabase client import (`@/lib/auth/supabase`) is acceptable — it already uses `import.meta.env` with a null guard.

### Known Pre-existing Issue: progress Table PK

From the E92-S03 code review (R1-PE-01): the `progress` Dexie table declares a compound PK `[courseId+videoId]` but the TypeScript type says `EntityTable<VideoProgress, 'courseId'>`. When uploading `progress` table entries, use `payload.id` for `recordId` — but be aware this may collide for records that share a `courseId`. This is a pre-existing schema issue. Do not fix in S05; document in Challenges if it surfaces.

### What S05 Does NOT Implement

The following belong to later stories:
- Download phase (`SELECT` from Supabase and apply to Dexie) — **E92-S06**
- Sync triggers (app open, tab visibility, online/offline) — **E92-S07**
- Auth lifecycle integration (engine start/stop on sign-in/sign-out) — **E92-S08**
- `syncEngine.start(userId)` and `syncEngine.stop()` public API — **E92-S06**
- `useSyncStatusStore` Zustand store — **E92-S07**
- The `fullSync()` method — **E92-S06**

S05 only adds: real `nudge()` debounce + `_runUploadCycle()` internal method.

## Testing Notes

### Mocking Strategy

Vitest does not have a real IndexedDB, a real Supabase connection, or a real `navigator.locks`. All three must be mocked:

```ts
// Mock Supabase client
const mockUpsert = vi.fn().mockResolvedValue({ data: [], error: null })
const mockInsert = vi.fn().mockResolvedValue({ data: [], error: null })
const mockRpc   = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ upsert: mockUpsert, insert: mockInsert })),
    rpc: mockRpc,
    auth: { refreshSession: vi.fn().mockResolvedValue({ error: null }) },
  },
}))

// Mock Dexie syncQueue
const mockSyncQueueWhere = vi.fn()
const mockBulkDelete = vi.fn().mockResolvedValue(undefined)
const mockUpdate = vi.fn().mockResolvedValue(undefined)

vi.mock('@/db', () => ({
  db: {
    syncQueue: {
      where: mockSyncQueueWhere,
      bulkDelete: mockBulkDelete,
      update: mockUpdate,
    },
  },
}))

// Mock navigator.locks
const mockLockRequest = vi.fn(async (_name, _opts, cb) => cb({ /* lock granted */ }))
Object.defineProperty(global.navigator, 'locks', {
  value: { request: mockLockRequest },
  writable: true,
})
```

### Fake Timers for Debounce and Backoff Tests

```ts
import { vi } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

it('debounces nudge() calls within 200ms', async () => {
  syncEngine.nudge()
  syncEngine.nudge()
  syncEngine.nudge()
  // No upload started yet
  expect(mockUpsert).not.toHaveBeenCalled()
  // Advance past debounce window
  await vi.advanceTimersByTimeAsync(201)
  expect(/* upload cycle entered */).toHaveBeenCalledTimes(1)
})
```

### Retry Backoff Verification

```ts
it('retries with exponential backoff on 5xx', async () => {
  mockUpsert
    .mockResolvedValueOnce({ error: { status: 500, message: 'Internal Server Error' } })
    .mockResolvedValueOnce({ error: null, data: [] })

  // ... seed 1 queue entry, trigger cycle, advance timers by 1s ...
  await vi.advanceTimersByTimeAsync(1001)
  // Verify retry was attempted and succeeded
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.any(Number),
    expect.objectContaining({ attempts: 1, status: 'pending' }),
  )
})
```

### Dead-Letter Verification

```ts
it('dead-letters entry after 5 consecutive 500s', async () => {
  mockUpsert.mockResolvedValue({ error: { status: 500, message: 'Server Error' } })
  // ... seed 1 queue entry with attempts = 4 (simulating previous failures) ...
  // trigger cycle, advance past backoff
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.any(Number),
    expect.objectContaining({ status: 'dead', attempts: 5 }),
  )
})
```

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] `syncEngine.ts` public API unchanged — `nudge()` and `isRunning` signatures identical to S04 stub
- [ ] `supabase` null-guarded in `_runUploadCycle()` — no unguarded `.from()` calls
- [ ] `navigator.locks` has fallback for older browsers (module-level `_isRunning` flag)
- [ ] Coalescing tested: 2 entries for same record → 1 Supabase call (AC2 unit test passes)
- [ ] Batch split tested: 250 records → 3 Supabase calls (AC3 unit test passes)
- [ ] Dead-letter after 5 failures: `status = 'dead'` set correctly (AC8 unit test passes)
- [ ] 4xx dead-letters immediately without retry (AC9 unit test passes)
- [ ] 401 triggers `refreshSession()` and retries once (AC9 unit test passes)
- [ ] Debounce 200ms: multiple rapid `nudge()` calls collapse to one cycle (AC11 unit test passes)
- [ ] No React imports anywhere in `syncEngine.ts`
- [ ] No direct Zustand store imports — Supabase client is acceptable
- [ ] `// Intentional:` comments at every non-obvious code site (lock guard, null supabase guard, fallback flag)
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run test:unit` — all tests pass (new + pre-existing from S01-S04)
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — clean
- [ ] CRUD completeness: S05 implements the upload path; download (S06) and trigger (S07) are separate stories — confirm scope is not accidentally expanded
- [ ] Dexie schema: no new tables or indexes added (S05 only reads/updates existing `syncQueue`)

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Context from E92-S04:** `syncEngine.ts` is a stub with `nudge()` as a no-op. S04 already imports and calls `syncEngine.nudge()` from `syncableWrite.ts`. The S05 implementation must keep the same module export shape so `syncableWrite.ts` continues to compile without modification.

**Context from E92-S03:** `getTableEntry(dexieTable)` is exported from `tableRegistry.ts` as a lookup helper. Use it in the upload engine's hot path instead of `tableRegistry.find()` (the function is equivalent but named for clarity).

**Context from E92-S01:** The monotonic Postgres functions `upsert_content_progress()` and `upsert_video_progress()` were created in S01. Their signatures are:
- `upsert_content_progress(p_user_id, p_content_id, p_content_type, p_status, p_progress_pct, p_updated_at)`
- `upsert_video_progress(p_user_id, p_video_id, p_watched_seconds, p_duration_seconds, p_updated_at)`

Map the snake_case payload fields to these parameter names when calling via `supabase.rpc()`.

**Key design decision — per-record RPC for monotonic tables:** Unlike generic upsert (which accepts a batch array), Postgres functions accept a fixed parameter list. The upload engine calls them one record at a time. This is acceptable for P0 tables (contentProgress, videoProgress) because they are high-priority, low-volume writes.

**Key design decision — `'dead'` not `'dead-letter'` as terminal status:** The S04 story file mentioned `'dead-letter'` but the actual Dexie schema type should be verified in `src/db/schema.ts`. The planning doc for S05 says `status = 'dead'`. Verify before coding and document the discrepancy in Challenges if found.
