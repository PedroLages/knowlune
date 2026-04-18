---
story_id: E92-S06
story_name: "Sync Engine Download and Apply Phase"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.06: Sync Engine Download and Apply Phase

## Story

As the Knowlune sync system,
I want a download phase in `syncEngine.ts` that pulls server-side changes since the last sync checkpoint and applies them to Dexie using per-table conflict strategies from the registry,
so that data created or edited on another device becomes visible locally after the next sync cycle.

## Acceptance Criteria

**AC1 — Incremental fetch:** Only records with `updated_at >= lastSyncTimestamp` are fetched from Supabase. Confirmed by inspecting the query filter used in each Supabase call.

**AC2 — LWW apply (server newer):** When a downloaded record has a newer `updated_at` than the local Dexie record, the local record is overwritten with the server version.

**AC3 — LWW apply (client newer):** When the local Dexie record has a newer `updated_at` than the downloaded record (client has uncommitted changes), the local record is kept unchanged.

**AC4 — Monotonic apply:** For tables with `conflictStrategy: 'monotonic'`, monotonic fields use `Math.max()`. Server cannot overwrite a local value with a lower value. Example: server sends `watchedSeconds: 100` when local is `200` → local stays `200`.

**AC5 — INSERT-only apply:** For tables with `conflictStrategy: 'insert-only'`, only insert the record if `id` is not already present in Dexie. Existing records with that `id` are never updated.

**AC6 — Conflict-copy apply:** For tables with `conflictStrategy: 'conflict-copy'`, if content differs and both timestamps are within 5 seconds of each other, save both versions. Tag the non-authoritative copy with `{ conflictCopy: true, conflictSourceId: originalId }`.

**AC7 — syncMetadata advancement:** After a successful apply batch, `syncMetadata.lastSyncTimestamp` for that table is updated to the maximum `updated_at` seen in the batch.

**AC8 — Zustand store refresh:** After applying downloaded records, affected Zustand stores are refreshed by calling their existing `load*()` / `hydrate*()` methods. Zustand state is NOT patched directly — the store's own load function is called.

**AC9 — start/stop public API:** `syncEngine.start(userId: string): Promise<void>` begins continuous sync (runs an initial `fullSync()` then enables periodic nudges). `syncEngine.stop(): void` halts all sync activity and clears any pending timers.

**AC10 — fullSync() method:** `syncEngine.fullSync()` runs upload phase then download phase for all registered tables ordered by `priority` (P0 first, P4 last). Tables with `skipSync: true` are skipped.

**AC11 — TypeScript compiles clean:** `npx tsc --noEmit` produces zero errors.

**AC12 — Unit test coverage:** Tests in `src/lib/sync/__tests__/syncEngine.download.test.ts` verify:
- LWW: server newer → local updated (AC2)
- LWW: client newer → local kept (AC3)
- Monotonic: server lower → local value preserved (AC4)
- INSERT-only: existing id → not duplicated (AC5)
- Conflict-copy: same id, different content, within 5s → both present, one tagged (AC6)
- `syncMetadata.lastSyncTimestamp` advances after apply (AC7)
- `start()` / `stop()` correctly manage engine lifecycle (AC9)

## Tasks / Subtasks

- [ ] Task 1: Add `_doDownload()` core download loop to `syncEngine.ts` (AC: 1, 7)
  - [ ] 1.1 Import `toCamelCase` from `./fieldMapper` and `getRegistry` / `getTableEntry` from `./tableRegistry`
  - [ ] 1.2 For each table in registry, sorted by `priority` ascending (P0 first), skip tables where `skipSync: true`
  - [ ] 1.3 Read `lastSyncTimestamp` from `db.syncMetadata.get(entry.dexieTable)` — null means full download (no `updated_at` filter)
  - [ ] 1.4 Execute Supabase query: `supabase.from(entry.supabaseTable).select('*').gte('updated_at', lastSyncTimestamp).order('updated_at', { ascending: true })` (omit `.gte()` filter when lastSyncTimestamp is null)
  - [ ] 1.5 For each downloaded row, call `toCamelCase(entry, row)` to convert snake_case → camelCase
  - [ ] 1.6 Route each converted record through `_applyRecord(entry, record)` (Task 2)
  - [ ] 1.7 After all records in a table are applied without error, compute `maxUpdatedAt = Math.max(...rows.map(r => r.updated_at))` and write to `db.syncMetadata.put({ table: entry.dexieTable, lastSyncTimestamp: maxUpdatedAt })`
  - [ ] 1.8 Guard: if `!supabase`, log warning and return early (same null-guard pattern as upload phase)

- [ ] Task 2: Implement `_applyRecord()` — conflict strategy routing (AC: 2, 3, 4, 5, 6)
  - [ ] 2.1 Fetch existing local record from Dexie: `const local = await (db[entry.dexieTable] as Table).get(record.id)`
  - [ ] 2.2 **LWW path** (`conflictStrategy === 'lww'`):
    - If no local record: `put(record)` into Dexie
    - If `record.updatedAt > local.updatedAt`: `put(record)` (server newer, overwrite)
    - If `record.updatedAt <= local.updatedAt`: no-op (client newer, keep local)
  - [ ] 2.3 **Monotonic path** (`conflictStrategy === 'monotonic'`):
    - Start with server record as base
    - For each field in `entry.monotonicFields`: `merged[field] = Math.max(Number(local?.[field] ?? 0), Number(record[field] ?? 0))`
    - Apply LWW on `updatedAt` to decide which non-monotonic fields win
    - `put(merged)` into Dexie
  - [ ] 2.4 **INSERT-only path** (`conflictStrategy === 'insert-only'` or `entry.insertOnly`):
    - If local record exists with same `id`: no-op (never overwrite insert-only records)
    - If no local record: `add(record)` into Dexie
  - [ ] 2.5 **Conflict-copy path** (`conflictStrategy === 'conflict-copy'`):
    - If no local record: `put(record)` — no conflict
    - Parse both `updatedAt` timestamps; compute `|serverTs - localTs|` in milliseconds
    - If content differs AND `|serverTs - localTs| <= 5000`: both versions differ and are within 5s → conflict
      - Keep local record as-is (it is authoritative on this device)
      - Generate a new id for the copy: `conflictCopyId = crypto.randomUUID()`
      - Write `{ ...record, id: conflictCopyId, conflictCopy: true, conflictSourceId: record.id }` via `put()`
    - If content matches OR timestamps are more than 5s apart: apply standard LWW (server newer wins)
  - [ ] 2.6 For tables with `compoundPkFields`, use compound key lookup instead of `get(record.id)`:
    - `db[entry.dexieTable].where(compoundKey).equals(compoundValues).first()`
  - [ ] 2.7 Wrap each `_applyRecord()` call in try/catch; log errors but continue processing remaining records (do not abort the whole table on a single record failure)

- [ ] Task 3: Implement Zustand store refresh after download (AC: 8)
  - [ ] 3.1 After `_doDownload()` completes, identify which tables had records applied
  - [ ] 3.2 Map Dexie table names to their store `load*()` / `hydrate*()` methods:
    - `contentProgress` → import and call `useContentProgressStore.getState().load()`
    - `studySessions` → import and call `useSessionStore.getState().load()`
    - `progress` → import and call `useProgressStore.getState().load()` (or equivalent)
    - `notes` → import and call `useNoteStore.getState().load()` (if exists)
    - Any store that hydrates from Dexie — look for existing `load()` / `hydrate()` signatures
  - [ ] 3.3 Call only the stores for tables that had at least one record applied (avoid unnecessary reloads)
  - [ ] 3.4 **IMPORTANT:** Do NOT import stores at module level in `syncEngine.ts` — use dynamic imports or a registry callback pattern to keep the module free of Zustand coupling. Preferred: a `StoreRefreshRegistry` — a `Map<string, () => Promise<void>>` that callers (hooks, stores) register their refresh callbacks into. The download engine iterates this map. This keeps `syncEngine.ts` pure (no direct Zustand imports).

- [ ] Task 4: Implement `syncEngine.start()`, `syncEngine.stop()`, and `syncEngine.fullSync()` (AC: 9, 10)
  - [ ] 4.1 Add module-level state: `let _userId: string | null = null` and `let _started = false`
  - [ ] 4.2 `syncEngine.start(userId: string): Promise<void>`:
    - Set `_userId = userId` and `_started = true`
    - Call `fullSync()` immediately (initial sync on start)
  - [ ] 4.3 `syncEngine.stop(): void`:
    - Set `_started = false`, `_userId = null`
    - Clear any pending debounce timers
    - Cancel any in-progress lock acquisition (best-effort — the lock will finish its current cycle, but `_started = false` prevents new cycles from beginning)
  - [ ] 4.4 `syncEngine.fullSync(): Promise<void>`:
    - Run `_doUpload()` first (flush pending writes before downloading)
    - Then run `_doDownload()` for all tables by priority
    - If `_started === false` at any check point, abort early
  - [ ] 4.5 Guard `nudge()`: if `_started === false`, `nudge()` is a no-op
  - [ ] 4.6 Update the exported `syncEngine` object to expose the new public methods

- [ ] Task 5: Write unit tests (AC: 12)
  - [ ] 5.1 Create `src/lib/sync/__tests__/syncEngine.download.test.ts`
  - [ ] 5.2 Mock `@/db` (syncMetadata get/put, per-table get/add/put), `supabase` client
  - [ ] 5.3 Test LWW — server newer: mock supabase to return record with newer updatedAt → Dexie `put()` called
  - [ ] 5.4 Test LWW — client newer: mock supabase to return record with older updatedAt → Dexie `put()` NOT called
  - [ ] 5.5 Test monotonic apply: local `watchedSeconds: 200`, server sends `watchedSeconds: 100` → merged record has `watchedSeconds: 200`
  - [ ] 5.6 Test INSERT-only: record with existing `id` in Dexie → `add()` NOT called, `put()` NOT called
  - [ ] 5.7 Test conflict-copy: same id, content differs, timestamps within 5s → two records in Dexie, copy has `conflictCopy: true`
  - [ ] 5.8 Test `syncMetadata.lastSyncTimestamp` advances to max `updated_at` from batch
  - [ ] 5.9 Test `start()`: calls `fullSync()` immediately; `stop()` prevents subsequent `nudge()` from running cycles
  - [ ] 5.10 Test null Supabase guard: when supabase is null, `_doDownload()` returns without error

- [ ] Task 6: Verification
  - [ ] 6.1 `npm run test:unit` — all tests pass (new + pre-existing from S01-S05)
  - [ ] 6.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 6.3 `npm run lint` — zero errors
  - [ ] 6.4 `npm run build` — clean

## Design Guidance

No UI components. This is a pure TypeScript infrastructure story. All changes are confined to:
- `src/lib/sync/syncEngine.ts` — add download phase methods alongside existing upload phase
- `src/lib/sync/__tests__/syncEngine.download.test.ts` — new download-specific unit tests

The existing upload phase (`_doUpload`, `nudge`, `_runUploadCycle`) must not be modified or broken.

## Implementation Notes

### File Locations — Only Modify These

- `src/lib/sync/syncEngine.ts` — add `_doDownload()`, `_applyRecord()`, `fullSync()`, `start()`, `stop()`, store refresh registry
- `src/lib/sync/__tests__/syncEngine.download.test.ts` — new unit tests for download phase

Do NOT touch:
- `syncableWrite.ts` — complete from S04
- `tableRegistry.ts` — complete from S03 (and reverted in E92-S03 revert — check current state)
- `fieldMapper.ts` — complete from S03
- `backfill.ts` — complete from S02
- `src/lib/sync/__tests__/syncEngine.test.ts` — existing upload tests (must remain passing)

### tableRegistry.ts Revert Warning

The git log shows E92-S03 was reverted (`75de1634 Revert "Merge pull request #341 from PedroLages/feature/e92-s03-sync-table-registry-and-field-mapping"`). Before implementing, verify the current state of `tableRegistry.ts` and `fieldMapper.ts`:
```bash
git log --oneline src/lib/sync/tableRegistry.ts | head -5
```
If the files are at the S03 implementation (they appear to be — the revert was at the Git level but the sprint-status shows `92-3` as `ready-for-dev`), confirm `getTableEntry(dexieTable)` and `getRegistry()` exports are present.

### Public API Additions

S06 adds these to the exported `syncEngine` object:

```ts
export const syncEngine = {
  // Existing (from S05 — DO NOT change):
  nudge(): void { ... },
  get isRunning(): boolean { ... },
  _setRunning(value: boolean): void { ... },

  // New (S06):
  async start(userId: string): Promise<void> { ... },
  stop(): void { ... },
  async fullSync(): Promise<void> { ... },

  // Store refresh registry (for Zustand decoupling):
  registerStoreRefresh(tableName: string, callback: () => Promise<void>): void { ... },
}
```

### Store Refresh Registry Pattern (Zustand Decoupling)

`syncEngine.ts` must remain a pure module with no Zustand imports. Use a registry callback approach:

```ts
// In syncEngine.ts — module-level registry
const _storeRefreshRegistry = new Map<string, () => Promise<void>>()

// In syncEngine exported object:
registerStoreRefresh(tableName: string, callback: () => Promise<void>): void {
  _storeRefreshRegistry.set(tableName, callback)
},

// In _doDownload(), after applying records for a table:
const refreshFn = _storeRefreshRegistry.get(entry.dexieTable)
if (refreshFn) {
  await refreshFn().catch(err =>
    console.warn(`[syncEngine] Store refresh failed for ${entry.dexieTable}:`, err)
  )
}
```

Callers (hooks or stores) register themselves:
```ts
// In useSyncLifecycle.ts (E92-S07) or at store initialization:
syncEngine.registerStoreRefresh('contentProgress', () =>
  useContentProgressStore.getState().load()
)
```

This keeps `syncEngine.ts` free of Zustand imports while enabling proper store invalidation.

### Supabase Query Pattern

```ts
// Full download (no lastSyncTimestamp)
const { data, error } = await supabase
  .from(entry.supabaseTable)
  .select('*')
  .order('updated_at', { ascending: true })

// Incremental download (with lastSyncTimestamp)
const { data, error } = await supabase
  .from(entry.supabaseTable)
  .select('*')
  .gte('updated_at', lastSyncTimestamp)
  .order('updated_at', { ascending: true })
```

The Supabase RLS policies (set up in E92-S01) automatically filter by `auth.uid() = user_id`, so no explicit user_id filter is needed in the query.

### LWW Apply Logic

```ts
async function _applyLww(entry: TableRegistryEntry, record: Record<string, unknown>): Promise<void> {
  const dexieTable = db[entry.dexieTable as keyof typeof db] as Table<Record<string, unknown>>
  const local = await dexieTable.get(record.id as string)

  if (!local) {
    await dexieTable.put(record)
    return
  }

  const serverTs = new Date(record.updatedAt as string).getTime()
  const localTs = new Date(local.updatedAt as string).getTime()

  if (serverTs > localTs) {
    await dexieTable.put(record)
    // server newer → overwrite
  }
  // else: client newer or equal → keep local (no-op)
}
```

### Monotonic Apply Logic

```ts
async function _applyMonotonic(entry: TableRegistryEntry, record: Record<string, unknown>): Promise<void> {
  const dexieTable = db[entry.dexieTable as keyof typeof db] as Table<Record<string, unknown>>
  const local = await dexieTable.get(record.id as string)

  if (!local) {
    await dexieTable.put(record)
    return
  }

  // Monotonic fields: take the max
  const merged = { ...record }
  for (const field of entry.monotonicFields ?? []) {
    const serverVal = Number(record[field] ?? 0)
    const localVal = Number(local[field] ?? 0)
    merged[field] = Math.max(serverVal, localVal)
  }

  // LWW on non-monotonic fields: use the record with the newer updatedAt as the base
  const serverTs = new Date(record.updatedAt as string).getTime()
  const localTs = new Date(local.updatedAt as string).getTime()
  if (localTs > serverTs) {
    // Local wins on non-monotonic fields, but monotonic fields already merged
    const mergedFromLocal = { ...local }
    for (const field of entry.monotonicFields ?? []) {
      mergedFromLocal[field] = merged[field]
    }
    await dexieTable.put(mergedFromLocal)
  } else {
    await dexieTable.put(merged)
  }
}
```

### INSERT-only Apply Logic

```ts
async function _applyInsertOnly(entry: TableRegistryEntry, record: Record<string, unknown>): Promise<void> {
  const dexieTable = db[entry.dexieTable as keyof typeof db] as Table<Record<string, unknown>>
  const local = await dexieTable.get(record.id as string)

  if (local) return  // already exists — never overwrite insert-only records

  await dexieTable.add(record)
}
```

### Conflict-Copy Apply Logic

```ts
async function _applyConflictCopy(entry: TableRegistryEntry, record: Record<string, unknown>): Promise<void> {
  const dexieTable = db[entry.dexieTable as keyof typeof db] as Table<Record<string, unknown>>
  const local = await dexieTable.get(record.id as string)

  if (!local) {
    await dexieTable.put(record)
    return
  }

  const serverTs = new Date(record.updatedAt as string).getTime()
  const localTs = new Date(local.updatedAt as string).getTime()
  const deltaMs = Math.abs(serverTs - localTs)

  // Shallow content equality check (excluding updatedAt)
  const { updatedAt: _sTs, ...serverContent } = record as Record<string, unknown>
  const { updatedAt: _lTs, ...localContent } = local as Record<string, unknown>
  const contentDiffers = JSON.stringify(serverContent) !== JSON.stringify(localContent)

  if (contentDiffers && deltaMs <= 5000) {
    // Conflict: both versions differ and are within 5s → create conflict copy
    const conflictCopyId = crypto.randomUUID()
    await dexieTable.put({
      ...record,
      id: conflictCopyId,
      conflictCopy: true,
      conflictSourceId: record.id,
    })
    // Local record stays unchanged — it is the authoritative version on this device
  } else {
    // Not a conflict: apply LWW
    if (serverTs > localTs) {
      await dexieTable.put(record)
    }
    // client newer → no-op
  }
}
```

### Compound PK Tables

Some tables use compound PKs (e.g., `contentProgress` with `[courseId+itemId]`, `chapterMappings` with `[epubBookId+audioBookId]`). For these, the `id` field may not exist. Use `entry.compoundPkFields` to construct the correct lookup:

```ts
// Compound PK lookup
if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
  const pkValues = entry.compoundPkFields.map(f => record[f])
  // Dexie compound key lookup — use where() with equals()
  const local = await (db[entry.dexieTable as keyof typeof db] as Table)
    .where(entry.compoundPkFields)
    .equals(pkValues)
    .first()
}
```

### syncMetadata — lastSyncTimestamp Update

```ts
// After all records for a table are applied
if (rows.length > 0) {
  const maxUpdatedAt = rows.reduce((max, row) => {
    return row.updated_at > max ? row.updated_at : max
  }, rows[0].updated_at as string)

  await db.syncMetadata.put({
    table: entry.dexieTable,
    lastSyncTimestamp: maxUpdatedAt,
  })
}
```

### SyncMetadataEntry Schema (from S02)

```ts
interface SyncMetadataEntry {
  table: string           // primary key
  lastSyncTimestamp?: string  // ISO string (from Supabase updated_at)
  lastUploadedKey?: string
}
```

Read: `await db.syncMetadata.get(entry.dexieTable)` → `entry?.lastSyncTimestamp ?? null`

### getRegistry() Export

The download engine needs to iterate all tables by priority. Verify `tableRegistry.ts` exports `getRegistry()` that returns `TableRegistryEntry[]` sorted by priority. If it does not exist, add:

```ts
export function getRegistry(): TableRegistryEntry[] {
  return [...TABLE_REGISTRY].sort((a, b) => a.priority - b.priority)
}
```

### Pure Module Guard

`syncEngine.ts` must remain importable from non-browser environments (unit test runner). Do not import from React or Zustand stores directly. The store refresh registry pattern (Task 3) handles Zustand decoupling without imports.

### What S06 Does NOT Implement

- Sync triggers (app open, visibility, online/offline) — **E92-S07**
- Auth lifecycle integration (`useAuthLifecycle.ts`) — **E92-S08**
- `useSyncStatusStore` Zustand store — **E92-S07**
- Registration of P0 stores into the `StoreRefreshRegistry` — **E92-S07** (the registry mechanism is created here; registrations happen when hooks are wired in S07)
- `backfillUserId()` — **E92-S08**

## Testing Notes

### Mocking Strategy

```ts
// Mock Supabase client — select chain
const mockSelect = vi.fn().mockReturnThis()
const mockGte = vi.fn().mockReturnThis()
const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      gte: mockGte,
      order: mockOrder,
    })),
    auth: { refreshSession: vi.fn().mockResolvedValue({ error: null }) },
  },
}))

// Mock db — syncMetadata + per-table operations
const mockSyncMetadataGet = vi.fn().mockResolvedValue(null)  // null = full download
const mockSyncMetadataPut = vi.fn().mockResolvedValue(undefined)
const mockTableGet = vi.fn().mockResolvedValue(null)  // no existing local record
const mockTablePut = vi.fn().mockResolvedValue(undefined)
const mockTableAdd = vi.fn().mockResolvedValue(undefined)

vi.mock('@/db', () => ({
  db: {
    syncMetadata: { get: mockSyncMetadataGet, put: mockSyncMetadataPut },
    contentProgress: { get: mockTableGet, put: mockTablePut, add: mockTableAdd },
    progress: { get: mockTableGet, put: mockTablePut, add: mockTableAdd },
    notes: { get: mockTableGet, put: mockTablePut, add: mockTableAdd },
    // ... other tables as needed per test
  },
}))
```

### LWW Test Pattern

```ts
it('LWW: server newer → local record updated', async () => {
  mockOrder.mockResolvedValueOnce({
    data: [{ id: 'rec-1', content: 'server', updated_at: '2026-04-18T10:00:00Z' }],
    error: null,
  })
  mockTableGet.mockResolvedValueOnce({ id: 'rec-1', content: 'local', updatedAt: '2026-04-17T10:00:00Z' })

  await syncEngine.fullSync()

  expect(mockTablePut).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'rec-1', content: 'server' })
  )
})

it('LWW: client newer → local record kept unchanged', async () => {
  mockOrder.mockResolvedValueOnce({
    data: [{ id: 'rec-1', content: 'server', updated_at: '2026-04-17T10:00:00Z' }],
    error: null,
  })
  mockTableGet.mockResolvedValueOnce({ id: 'rec-1', content: 'local', updatedAt: '2026-04-18T10:00:00Z' })

  await syncEngine.fullSync()

  expect(mockTablePut).not.toHaveBeenCalled()
})
```

### Monotonic Test Pattern

```ts
it('monotonic: server sends lower watchedSeconds → local value preserved', async () => {
  // Table: progress (Dexie) → video_progress (Supabase), conflictStrategy: 'monotonic'
  mockOrder.mockResolvedValueOnce({
    data: [{ id: 'vid-1', watched_seconds: 100, updated_at: '2026-04-18T10:00:00Z' }],
    error: null,
  })
  mockTableGet.mockResolvedValueOnce({ id: 'vid-1', watchedSeconds: 200, updatedAt: '2026-04-17T10:00:00Z' })

  await syncEngine.fullSync()

  expect(mockTablePut).toHaveBeenCalledWith(
    expect.objectContaining({ watchedSeconds: 200 })  // Math.max(100, 200) = 200
  )
})
```

### Conflict-Copy Test Pattern

```ts
it('conflict-copy: same id, content differs, within 5s → both records saved', async () => {
  const now = new Date('2026-04-18T10:00:00Z').getTime()
  const serverTs = new Date(now).toISOString()
  const localTs = new Date(now - 3000).toISOString()  // 3s apart

  mockOrder.mockResolvedValueOnce({
    data: [{ id: 'note-1', content: 'server version', updated_at: serverTs }],
    error: null,
  })
  mockTableGet.mockResolvedValueOnce({ id: 'note-1', content: 'local version', updatedAt: localTs })

  await syncEngine.fullSync()

  // Local kept (no put with id: 'note-1')
  // Conflict copy added with conflictCopy: true
  expect(mockTablePut).toHaveBeenCalledWith(
    expect.objectContaining({ conflictCopy: true, conflictSourceId: 'note-1' })
  )
})
```

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Upload phase (`nudge()`, `_doUpload()`, coalescing, batching, retry) is functionally identical to S05 — no regressions
- [ ] `syncEngine.ts` has no direct Zustand imports — store refresh uses registry callback pattern
- [ ] `supabase` null-guarded in `_doDownload()` — returns early if null, no unguarded `.from()` calls
- [ ] `getRegistry()` is available in `tableRegistry.ts` — add export if missing
- [ ] LWW: server newer → Dexie `put()` called (AC2 unit test passes)
- [ ] LWW: client newer → Dexie `put()` NOT called (AC3 unit test passes)
- [ ] Monotonic: server lower value → local monotonic field preserved via `Math.max()` (AC4 unit test passes)
- [ ] INSERT-only: existing Dexie record with same id → `add()` and `put()` not called (AC5 unit test passes)
- [ ] Conflict-copy: timestamps within 5s + content differs → two Dexie records, copy tagged (AC6 unit test passes)
- [ ] `syncMetadata.lastSyncTimestamp` advances to max `updated_at` in batch (AC7 unit test passes)
- [ ] `start()` / `stop()` correctly start/stop engine lifecycle (AC9 unit test passes)
- [ ] `fullSync()` runs upload then download (AC10)
- [ ] Compound PK tables use `compoundPkFields` for lookup (not just `id`)
- [ ] Null Supabase guard tested: when `supabase` is null, `_doDownload()` returns without error
- [ ] `// Intentional:` comments at every non-obvious code site
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run test:unit` — all tests pass (new + pre-existing from S01-S05)
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — clean
- [ ] CRUD completeness: S06 implements download/apply; triggers (S07) and auth lifecycle (S08) are separate — confirm scope is not accidentally expanded

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Context from E92-S05:** The upload phase (`_doUpload`, `nudge`, `_runUploadCycle`) is complete and tested in S05. The download phase is a new addition that runs after upload in `fullSync()`. Do not modify or break any upload logic.

**Context from E92-S03:** The `tableRegistry.ts` and `fieldMapper.ts` were implemented in S03 (though the story was reverted at git level — verify file state before starting). `toCamelCase(entry, record)` converts Supabase snake_case rows back to Dexie camelCase.

**Key design decision — StoreRefreshRegistry for Zustand decoupling:** Direct Zustand imports in `syncEngine.ts` would create tight coupling and make unit testing harder (Zustand stores depend on Dexie which requires a browser environment). The registry callback pattern inverts the dependency: stores register their own refresh callbacks. This pattern is established in S06 and populated in S07 (`useSyncLifecycle.ts`).

**Key design decision — Upload before download in `fullSync()`:** Running upload first ensures local changes are not overwritten by a server download of older data. If the client has a newer version, it uploads it first, then when downloading, the server will return the same (now newer) version — LWW keeps local.

**Key design decision — Error isolation per record:** A single corrupt record should not abort the entire table download. Wrap `_applyRecord()` in try/catch and continue. The `lastSyncTimestamp` is only advanced if the full batch processes without catastrophic failure (i.e., the Supabase query itself succeeds).

**E92-S03 revert note:** The sprint-status shows `92-3` as `ready-for-dev` (not `done`). If `tableRegistry.ts` and `fieldMapper.ts` are not yet merged, this story is blocked until they are. Check with `ls src/lib/sync/` before starting implementation.
