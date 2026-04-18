---
story_id: E92-S04
story_name: "Syncable Write Wrapper"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.04: Syncable Write Wrapper

## Story

As the sync engine (E92-S05 through E92-S09),
I want a single write path (`syncableWrite()`) that all synced Dexie mutations flow through,
so that every write is automatically stamped with metadata, written optimistically to Dexie, and enqueued for Supabase upload — without callers needing to know about the queue.

## Acceptance Criteria

**AC1 — Optimistic Dexie write:** `syncableWrite()` writes to Dexie immediately. The write is visible in IndexedDB before any network activity occurs.

**AC2 — syncQueue entry created:** After an authenticated write, a `SyncQueueEntry` is inserted in `syncQueue` with the correct `operation`, `tableName`, `recordId`, and `payload` (stripped via `toSnakeCase`). `attempts` is `0`, `status` is `'pending'`.

**AC3 — Unauthenticated write is safe:** If there is no authenticated `userId` (auth store `user` is null), the Dexie write succeeds normally. No queue entry is created. No error is thrown.

**AC4 — stripFields applied:** Fields in `tableRegistry.stripFields` (e.g., `directoryHandle`, `fileHandle`, `photoHandle`, `coverImageHandle`) are absent from the queue payload.

**AC5 — vaultFields excluded:** Fields in `tableRegistry.vaultFields` (e.g., `password`, `apiKey`) are absent from the queue payload (confirmed via unit test).

**AC6 — delete operation:** For `operation: 'delete'`, the second argument is a string `id`. Dexie table `.delete(id)` is called. Queue entry payload is `{ id }` (the bare id — no record fields to strip).

**AC7 — syncEngine.nudge() called:** After enqueuing, `syncEngine.nudge()` is called if the engine is running. In S04, `nudge()` is a no-op stub; the import must not break compilation.

**AC8 — skipQueue option:** If `options.skipQueue` is `true`, the write happens but no queue entry is created and `nudge()` is not called.

**AC9 — deviceId generated and persisted:** `deviceIdentity.ts` generates a UUID v4 on first call and stores it in `localStorage` under key `'sync:deviceId'`. Subsequent calls return the same value.

**AC10 — Unit tests: 100% branch coverage:** Tests in `src/lib/sync/__tests__/syncableWrite.test.ts` cover:
- authenticated `put` → Dexie write + queue entry created
- authenticated `add` → Dexie write + queue entry created
- authenticated `delete` → Dexie delete + queue entry with `{ id }` payload
- unauthenticated → Dexie write succeeds, no queue entry
- `skipQueue: true` → write only, no queue entry
- `stripFields` items absent from payload
- `vaultFields` items absent from payload

**AC11 — TypeScript compiles clean:** `npx tsc --noEmit` produces zero errors.

**AC12 — Pure sync module guard:** `syncableWrite.ts` does not import React. It may import from `@/stores/useAuthStore` (Zustand, not React). It must not import from any UI layer.

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/sync/deviceIdentity.ts` (AC: 9)
  - [ ] 1.1 Export `getDeviceId(): string` — reads `localStorage.getItem('sync:deviceId')`; if missing, generates a UUID v4 (using `crypto.randomUUID()`), stores it, and returns it
  - [ ] 1.2 Export the `DEVICE_ID_KEY = 'sync:deviceId'` constant for tests
  - [ ] 1.3 No external uuid library needed — `crypto.randomUUID()` is available in all modern browsers and Node 18+

- [ ] Task 2: Create `src/lib/sync/syncEngine.ts` stub (AC: 7)
  - [ ] 2.1 Export `syncEngine` object with `nudge(): void` no-op stub
  - [ ] 2.2 Export `isRunning: boolean` getter initialized to `false`
  - [ ] 2.3 Add JSDoc comment: "Stub — upload/download logic implemented in E92-S05/S06. nudge() becomes a real debounced upload trigger in E92-S05."
  - [ ] 2.4 Do NOT implement any upload/download logic — out of scope for S04

- [ ] Task 3: Create `src/lib/sync/syncableWrite.ts` (AC: 1–8, 11, 12)
  - [ ] 3.1 Define and export `SyncableRecord` interface: `{ id?: string; userId?: string; updatedAt?: string; [key: string]: unknown }`
  - [ ] 3.2 Implement function signature exactly as specified:
    ```ts
    export async function syncableWrite<T extends SyncableRecord>(
      tableName: string,
      operation: 'put' | 'add' | 'delete',
      record: T | string,
      options?: { skipQueue?: boolean }
    ): Promise<void>
    ```
  - [ ] 3.3 Stamp `userId` from `useAuthStore.getState().user?.id` and `updatedAt` as `new Date().toISOString()` on the record before writing (for `put`/`add`)
  - [ ] 3.4 Dexie write: `db.table(tableName).put(record)` for `put`, `.add(record)` for `add`, `.delete(record)` for `delete` (where `record` is a string id for delete)
  - [ ] 3.5 Get registry entry via `tableRegistry.find(e => e.dexieTable === tableName)`. If no entry found, throw a developer-friendly error (this indicates a misconfigured table — should never reach prod users)
  - [ ] 3.6 Build queue payload: for `put`/`add`, call `toSnakeCase(entry, record as Record<string, unknown>)` to get the stripped snake_case payload. For `delete`, payload is `{ id: record as string }`
  - [ ] 3.7 Unauthenticated guard: if `!userId`, skip queue and `nudge()` — return after Dexie write. No error thrown.
  - [ ] 3.8 `skipQueue` guard: if `options?.skipQueue`, skip queue and `nudge()` — return after Dexie write
  - [ ] 3.9 Enqueue: `db.syncQueue.add({ tableName, recordId, operation, payload, attempts: 0, status: 'pending', createdAt: now, updatedAt: now })`
  - [ ] 3.10 `recordId` extraction: for `put`/`add`, use `(record as SyncableRecord).id ?? ''`; for `delete`, use `record as string`
  - [ ] 3.11 Call `syncEngine.nudge()` after enqueueing (no-op in S04, real debounced trigger in S05)
  - [ ] 3.12 Wrap entire function in try/catch — if Dexie write fails, rethrow (caller must handle). If queue insert fails, log error but do NOT rethrow (optimistic write already succeeded; queue will be retried on next sync)

- [ ] Task 4: Create `src/lib/sync/__tests__/syncableWrite.test.ts` (AC: 10)
  - [ ] 4.1 Mock `@/db` with a fake in-memory store (object map per table name) using `vi.mock`
  - [ ] 4.2 Mock `useAuthStore` to control `user?.id` in each test
  - [ ] 4.3 Mock `syncEngine` to spy on `nudge()` calls
  - [ ] 4.4 Test: authenticated `put` — Dexie `put` called, queue entry created with operation/tableName/payload/status
  - [ ] 4.5 Test: authenticated `add` — Dexie `add` called, queue entry created
  - [ ] 4.6 Test: authenticated `delete` — Dexie `delete` called with id string, queue payload is `{ id: '<id>' }`
  - [ ] 4.7 Test: unauthenticated — Dexie write called, `syncQueue.add` NOT called, no error thrown
  - [ ] 4.8 Test: `skipQueue: true` — Dexie write called, `syncQueue.add` NOT called, `nudge()` NOT called
  - [ ] 4.9 Test: `stripFields` — use `importedCourses` entry; verify `directoryHandle` absent from queue payload
  - [ ] 4.10 Test: `vaultFields` — use `opdsCatalogs` entry; verify `password` absent from queue payload
  - [ ] 4.11 Test: `nudge()` called after authenticated write (spy assertion)
  - [ ] 4.12 Test: `nudge()` NOT called for unauthenticated write

- [ ] Task 5: Create `src/lib/sync/__tests__/deviceIdentity.test.ts` (AC: 9)
  - [ ] 5.1 Mock `localStorage` — verify first call writes to `DEVICE_ID_KEY`
  - [ ] 5.2 Verify second call returns same value (reads from localStorage, no new UUID generated)
  - [ ] 5.3 Verify returned value matches UUID v4 format (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)

- [ ] Task 6: Verification
  - [ ] 6.1 `npm run test:unit` — all tests pass
  - [ ] 6.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 6.3 `npm run lint` — zero errors
  - [ ] 6.4 `npm run build` — clean

## Design Guidance

No UI components. This is a pure TypeScript infrastructure story. All new files go in `src/lib/sync/`.

## Implementation Notes

### File Locations

All files belong in `src/lib/sync/`:
- `src/lib/sync/syncableWrite.ts` — main wrapper
- `src/lib/sync/syncEngine.ts` — stub (real implementation in E92-S05)
- `src/lib/sync/deviceIdentity.ts` — UUID persistence
- `src/lib/sync/__tests__/syncableWrite.test.ts`
- `src/lib/sync/__tests__/deviceIdentity.test.ts`

Existing files in `src/lib/sync/`:
- `tableRegistry.ts` — created in E92-S03 (present and working)
- `fieldMapper.ts` — created in E92-S03 (present and working)
- `backfill.ts` — created in E92-S02 (uses tableRegistry)
- `__tests__/backfill.test.ts`
- `__tests__/tableRegistry.test.ts`

### Auth Store Access Pattern

Get `userId` via `useAuthStore.getState().user?.id` inside the function body (not as an argument, not from a hook). This is the established pattern for calling Zustand stores outside React components in this codebase. Reading from `getState()` at call time ensures the value is fresh, avoiding stale closure bugs.

```ts
import { useAuthStore } from '@/stores/useAuthStore'
// inside syncableWrite:
const userId = useAuthStore.getState().user?.id ?? null
```

### Dexie Table Access

Use `db.table(tableName)` for dynamic table access. This is already used in `backfill.ts`:
```ts
import { db } from '@/db'
// inside syncableWrite:
await db.table(tableName).put(stampedRecord)
```

The `db` export comes from `src/db/index.ts` → `src/db/schema.ts`.

### SyncQueueEntry Shape (from schema.ts)

The `SyncQueueEntry` interface (already defined in `src/db/schema.ts`):
```ts
interface SyncQueueEntry {
  id?: number           // auto-increment
  tableName: string
  recordId: string
  operation: 'put' | 'add' | 'delete'
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'uploading' | 'dead-letter'
  createdAt: string
  updatedAt: string
  lastError?: string
}
```

Use this type for the queue insert — do not redeclare it. Import from `@/db`:
```ts
import type { SyncQueueEntry } from '@/db'
```

### stripFields + vaultFields — Delegated to toSnakeCase

Both stripping behaviors are already handled by `toSnakeCase()` from `fieldMapper.ts`. Do NOT re-implement stripping in `syncableWrite.ts`. Just call:
```ts
const payload = toSnakeCase(entry, record as Record<string, unknown>)
```
This strips both `stripFields` and `vaultFields` automatically (per fieldMapper.ts implementation).

### syncEngine Stub Design

The stub must be importable from `syncableWrite.ts` without breaking the build. Keep it minimal:
```ts
// src/lib/sync/syncEngine.ts
let _isRunning = false

export const syncEngine = {
  nudge(): void {
    // Intentional no-op: upload trigger implemented in E92-S05
  },
  get isRunning(): boolean {
    return _isRunning
  },
  /** @internal — used by E92-S05 to activate the engine */
  _setRunning(value: boolean): void {
    _isRunning = value
  },
}
```

E92-S05 will replace the body of `nudge()` and `_setRunning()` with real logic. The public API surface (`nudge()`, `isRunning`) must not change between S04 and S05.

### Error Handling Strategy

```ts
try {
  // Dexie write
  if (operation === 'put') await db.table(tableName).put(stampedRecord)
  else if (operation === 'add') await db.table(tableName).add(stampedRecord)
  else await db.table(tableName).delete(record as string)
} catch (err) {
  // Intentional: Dexie write failure is fatal — rethrow so the caller can
  // surface the error to the user (e.g., toast). The queue entry was never
  // created, so no orphaned queue entry exists.
  throw err
}

if (!userId || options?.skipQueue) return

try {
  await db.syncQueue.add({ ... })
  syncEngine.nudge()
} catch (err) {
  // Intentional: queue insert failure is non-fatal. The Dexie write already
  // succeeded (optimistic write is the source of truth locally). The sync
  // engine's next full scan (E92-S06 download) will reconcile any missing
  // entries. Log for observability but do not propagate.
  console.error('[syncableWrite] Queue insert failed — write succeeded, sync deferred:', err)
}
```

### Timestamp Consistency

Use `new Date().toISOString()` for both `updatedAt` on the record and `createdAt`/`updatedAt` on the queue entry. Capture once at the top of the function and reuse:
```ts
const now = new Date().toISOString()
```

### deviceId Usage (Future — S05/S07)

`deviceIdentity.ts` is created in this story but `deviceId` is NOT stamped on records or queue entries in S04. The deviceId will be included in queue metadata when the upload engine (S05) sends records to Supabase, allowing the server to attribute writes. Include `deviceId` as a comment in the queue entry type if desired, but do not add it to `SyncQueueEntry` in this story (schema change is S05 territory).

### tableRegistry.find() Performance Note

The `tableRegistry` is a 38-element array. A linear `find()` per write is O(38) — acceptable given that this is an array of simple objects with a string comparison. In E92-S05, a `Map<string, TableRegistryEntry>` lookup will be introduced for the upload engine's hot path. No need to optimize in S04.

### Known Prior Issue: progress Table PK

From the E92-S03 code review (R1-PE-01): the `progress` Dexie table has a compound PK `[courseId+videoId]` but is declared as `EntityTable<VideoProgress, 'courseId'>`. This means `db.table('progress').delete(id)` may not work correctly for the `delete` operation on that table. This is a pre-existing issue (not introduced in S04). Document it in Challenges if encountered during testing. Do NOT fix it in this story.

## Testing Notes

### Mocking Strategy

The Vitest test environment does not have a real IndexedDB. Mock `@/db` with a simple in-memory map:

```ts
// In test file:
const fakeStore: Record<string, unknown[]> = {}

vi.mock('@/db', () => ({
  db: {
    table: (name: string) => ({
      put: vi.fn(async (record) => { fakeStore[name] = [record] }),
      add: vi.fn(async (record) => { fakeStore[name] = [record] }),
      delete: vi.fn(async () => {}),
    }),
    syncQueue: {
      add: vi.fn(async () => 1), // returns auto-increment id
    },
  },
}))
```

### Mocking Auth Store

```ts
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ user: { id: 'test-user-id' } })),
  },
}))
```

For unauthenticated tests, override the mock per-test:
```ts
vi.mocked(useAuthStore.getState).mockReturnValueOnce({ user: null } as never)
```

### 100% Branch Coverage Checklist

| Branch | Test |
|--------|------|
| `operation === 'put'` | 4.4 |
| `operation === 'add'` | 4.5 |
| `operation === 'delete'` | 4.6 |
| `!userId` early return | 4.7 |
| `skipQueue: true` early return | 4.8 |
| stripFields removed | 4.9 |
| vaultFields removed | 4.10 |
| nudge() called | 4.11 |
| nudge() not called (unauthenticated) | 4.12 |

### Test File Naming Convention

Follow the existing pattern in `src/lib/sync/__tests__/`:
- `backfill.test.ts`
- `tableRegistry.test.ts`

New files:
- `syncableWrite.test.ts`
- `deviceIdentity.test.ts`

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] `syncableWrite.ts` reads auth via `useAuthStore.getState()` inside the function body (not from a hook, not a stale closure)
- [ ] `toSnakeCase()` used for payload building — no manual field stripping duplicated
- [ ] `stripFields` and `vaultFields` both confirmed absent from queue payload (via unit tests 4.9 and 4.10)
- [ ] Queue insert failure does NOT rethrow — logged and swallowed (optimistic write pattern)
- [ ] Dexie write failure DOES rethrow (fatal — caller must handle)
- [ ] `syncEngine.nudge()` is a no-op stub only — no upload logic in S04
- [ ] `deviceIdentity.ts` uses `crypto.randomUUID()` — no external uuid library added
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run test:unit` — all tests pass including pre-existing backfill and tableRegistry tests
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — clean
- [ ] No React imports in any new `src/lib/sync/*.ts` file
- [ ] `SyncQueueEntry` imported from `@/db`, not redeclared
- [ ] At every non-obvious code site (try/catch, auth read, queue skip), add `// Intentional: <reason>` comment

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Context from E92-S03:** The `tableRegistry.ts` and `fieldMapper.ts` files exist at `src/lib/sync/` (the correct location per epic spec). The `backfill.ts` already imports `tableRegistry` and derives `SYNCABLE_TABLES` from it. The sync infrastructure is well-established; S04 adds the write path on top of it.

**Key design decision — queue failure is non-fatal:** The write path uses optimistic Dexie write as the primary local truth. Queue insert failure is non-fatal because the sync engine's periodic full scan (E92-S06) will detect and re-enqueue missing records. This matches the "eventually consistent" design in the sync architecture doc.

**Key design decision — auth via getState():** Using `useAuthStore.getState()` (not a React hook) is intentional. `syncableWrite` is a plain async function called from Zustand store actions, not from React components. Reading from `getState()` at call time is the correct pattern for this use case (see engineering-patterns.md § Zustand Outside React).
