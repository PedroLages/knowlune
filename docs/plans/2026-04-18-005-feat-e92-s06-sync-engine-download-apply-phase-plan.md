---
title: "feat: Add download and apply phase to sync engine (E92-S06)"
type: feat
status: active
date: 2026-04-18
origin: docs/implementation-artifacts/92-6-sync-engine-download-and-apply-phase.md
---

# feat: Add download and apply phase to sync engine (E92-S06)

## Overview

`syncEngine.ts` currently has a complete upload phase (E92-S05) but no download capability. This plan adds the download half: incremental fetching from Supabase per table using `syncMetadata.lastSyncTimestamp` as a cursor, and applying downloaded records to Dexie using the conflict strategy declared in `tableRegistry.ts` (LWW, monotonic, insert-only, conflict-copy). It also adds the three public API methods (`start`, `stop`, `fullSync`) that subsequent stories (E92-S07, E92-S08) will call, and a `StoreRefreshRegistry` that decouples the engine from Zustand imports.

## Problem Frame

After E92-S05, the engine can push local changes to Supabase but cannot pull server-side changes made on another device. Users who create a note on device A and switch to device B will not see it. E92-S06 delivers the pull half, completing the round-trip. The conflict strategies in `tableRegistry.ts` (already populated in E92-S03) govern how downloaded records merge with local state.

## Requirements Trace

- R1. Only fetch records updated since `lastSyncTimestamp` (incremental, not full-replace)
- R2. Apply downloaded records with per-table conflict strategy (LWW, monotonic, insert-only, conflict-copy)
- R3. Advance `syncMetadata.lastSyncTimestamp` to max `updated_at` seen after a successful apply batch
- R4. Refresh affected Zustand stores after apply without importing them directly into `syncEngine.ts`
- R5. Expose `start(userId)`, `stop()`, `fullSync()` public API; guard `nudge()` when stopped
- R6. Upload before download in `fullSync()` to prevent stale server data overwriting unsynced local writes
- R7. All new code covered by unit tests in a dedicated test file; existing upload tests must stay green

## Scope Boundaries

- Download phase for all 38 registered tables (by priority order)
- `StoreRefreshRegistry` mechanism — registration calls deferred to E92-S07
- `start()`, `stop()`, `fullSync()` on the exported `syncEngine` object
- Unit tests in `src/lib/sync/__tests__/syncEngine.download.test.ts`

### Deferred to Separate Tasks

- Registering store refresh callbacks into the registry: E92-S07 (`useSyncLifecycle.ts`)
- Auth lifecycle wiring (`syncEngine.start()` called on SIGNED_IN): E92-S08
- `useSyncStatusStore` Zustand store: E92-S07
- Binary file download from Supabase Storage buckets: future epics (E94+)
- Conflict-copy UI (surfacing conflict copies to the user): future epics

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — upload phase; upload-before-download in `fullSync()` reuses `_doUpload()` directly
- `src/lib/sync/tableRegistry.ts` — `tableRegistry` array (38 entries, already priority-sorted); `getTableEntry(dexieTable)` lookup; note: no `getRegistry()` export yet — use `tableRegistry` array directly
- `src/lib/sync/fieldMapper.ts` — `toCamelCase(entry, row)` converts Supabase snake_case → Dexie camelCase; already handles explicit `fieldMap` overrides and automatic conversion
- `src/db/schema.ts` — `SyncMetadataEntry { table: string, lastSyncTimestamp?: string, lastUploadedKey?: string }` keyed by Dexie table name; accessed via `db.syncMetadata.get(key)` / `.put(entry)`
- `src/lib/sync/__tests__/syncEngine.test.ts` — established mock pattern: `vi.hoisted()` for mocks shared across `vi.mock()` factories; import `syncEngine` after mocks; `beforeEach` restores default mock implementations after `vi.clearAllMocks()`
- `src/stores/useNoteStore.ts` — `loadNotes()` as representative store refresh target; pattern: `useNoteStore.getState().loadNotes()`
- Stores with `load*` methods: `useNoteStore` (`loadNotes`), `useBookmarkStore` (`loadBookmarks`), `useFlashcardStore` (`loadFlashcards`), `useContentProgressStore` (`loadCourseProgress`), `useSessionStore` (`loadSessionStats`), `useBookStore` (`loadBooks`) — all are Dexie-backed and follow the same pattern
- `docs/engineering-patterns.md` § "Dexie Mock Boilerplate for Unit Tests" — `vi.mock('@/db')` with `vi.mock('@/db/schema')` at the top; mock must match exact Dexie API surface called (`.get()`, `.put()`, `.add()`, `.where().equals().first()`)

### Institutional Learnings

- `docs/engineering-patterns.md` § "Dexie Filter Semantics for Missing Fields" — `db.table.where('field').equals(undefined)` returns zero rows; the compound PK tables (`contentProgress`, `chapterMappings`) must use `.where(fields).equals(values)` with defined values, not undefined
- E92-S05 code review: the `progress` Dexie table declares compound PK `[courseId+videoId]` but `entityTable` type says `'courseId'` (known pre-existing issue R1-PE-01 from E92-S02); during download, `progress` records from Supabase will have `video_id` and `course_id` — after `toCamelCase()` these become `videoId` and `courseId`; the local lookup must use compound key `[courseId, videoId]` (listed in `compoundPkFields` via `entry.compoundPkFields` — but `progress` does NOT declare `compoundPkFields` in `tableRegistry.ts`; fall back to `get(record.id)` and document this as a known gap
- `syncEngine.ts` is a pure module — must stay free of React and Zustand imports; use the `StoreRefreshRegistry` callback inversion pattern described in the story file

### External References

None needed — all relevant patterns are established locally.

## Key Technical Decisions

- **`StoreRefreshRegistry` for Zustand decoupling**: A `Map<string, () => Promise<void>>` at module level in `syncEngine.ts`. The download phase calls registered callbacks after applying each table's records. Registration happens in E92-S07. This keeps `syncEngine.ts` importable in a Vitest jsdom environment without Zustand store imports triggering Dexie.open() errors.
- **Upload-before-download in `fullSync()`**: Flushes pending local writes before downloading, preventing a stale server snapshot from overwriting an unsynced local record. If upload fails, download still runs (best-effort; the local record will win on LWW next cycle anyway).
- **`tableRegistry` array used directly for iteration**: The registry is already priority-sorted. No new `getRegistry()` export is needed — `import { tableRegistry } from './tableRegistry'` suffices.
- **Error isolation per record, not per table**: A corrupt single record should not abort the table's batch. Wrap `_applyRecord()` calls in try/catch per record; log and continue. The `lastSyncTimestamp` is only advanced after all records in a table are attempted (not only successfully applied).
- **LWW timestamp comparison via `Date` parsing**: `updatedAt` on Dexie records and `updated_at` on Supabase rows are ISO strings. Parse with `new Date(...).getTime()` for numeric comparison. The camelCase-converted field from Supabase will be `updatedAt` (via `toCamelCase`).
- **Conflict-copy `id` generation via `crypto.randomUUID()`**: Available in all modern browsers (and in Node/jsdom in tests). No import needed.
- **`_started` flag guards `nudge()`**: When `stop()` is called, `_started = false` prevents new upload cycles. The in-flight lock cycle (if any) completes naturally — the lock cannot be forcibly cancelled.

## Open Questions

### Resolved During Planning

- **Does `tableRegistry.ts` export a `getRegistry()` function?** No — only `tableRegistry` (array) and `getTableEntry()` (lookup by Dexie name). Use `tableRegistry` directly for download iteration.
- **Is `progress` table's compound PK declared in `compoundPkFields`?** No — `tableRegistry.ts` does not set `compoundPkFields` on the `progress` entry. Use `get(record.id)` fallback and document as known gap (pre-existing issue from E92-S02).
- **Do Zustand stores have a uniform `load()` method?** No — each store uses a domain-specific name (`loadNotes`, `loadBooks`, `loadFlashcards`, etc.). The `StoreRefreshRegistry` maps Dexie table names to closures that call the correct store method. Registration happens in E92-S07.

### Deferred to Implementation

- **Which tables actually have records to download during development testing?** Depends on Supabase data. Unit tests will mock the response.
- **Exact TypeScript type for `db[entry.dexieTable]` dynamic table access**: Implementation will need a type assertion (`as Table<Record<string, unknown>>`). The exact assertion shape should be confirmed by running `tsc --noEmit` after the first draft.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
fullSync()
  ├─ _doUpload()              // flush pending writes first (existing S05 logic)
  └─ _doDownload()            // new S06 logic
       for each entry in tableRegistry (priority order, skipSync skipped):
         lastSyncTimestamp = db.syncMetadata.get(entry.dexieTable)?.lastSyncTimestamp
         rows = supabase.from(entry.supabaseTable)
                  .select('*')
                  [.gte('updated_at', lastSyncTimestamp)]  // omit if null (full download)
                  .order('updated_at', ascending)
         for each row:
           record = toCamelCase(entry, row)
           _applyRecord(entry, record)  // try/catch per record
         if rows.length > 0:
           db.syncMetadata.put({ table: entry.dexieTable, lastSyncTimestamp: maxUpdatedAt })
         _storeRefreshRegistry.get(entry.dexieTable)?.()  // notify store

_applyRecord(entry, record):
  switch entry.conflictStrategy:
    'lww'           → compare updatedAt, put if server newer
    'monotonic'     → Math.max per monotonicField, LWW for others, put
    'insert-only'   → get by id, add only if absent
    'conflict-copy' → if content differs and |Δt| ≤ 5s → add conflict copy; else LWW

StoreRefreshRegistry (module-level Map):
  registerStoreRefresh(tableName, callback) → _storeRefreshRegistry.set(...)
  (populated by useSyncLifecycle in E92-S07)
```

## Implementation Units

- [ ] **Unit 1: Add `StoreRefreshRegistry` and export `registerStoreRefresh`**

**Goal:** Introduce the module-level callback registry that decouples the download engine from Zustand store imports.

**Requirements:** R4

**Dependencies:** None (purely additive to `syncEngine.ts`)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`

**Approach:**
- Add `const _storeRefreshRegistry = new Map<string, () => Promise<void>>()` at module level, below the existing constants block
- Add `registerStoreRefresh(tableName: string, callback: () => Promise<void>): void` to the exported `syncEngine` object
- Do not call the registry in this unit — just define it

**Patterns to follow:**
- Same module-level state pattern as `_debounceTimer` and `_uploadInFlight` in the existing upload phase

**Test scenarios:**
- Happy path: `registerStoreRefresh('notes', mockFn)` stores the callback; a subsequent `_storeRefreshRegistry.get('notes')` returns it (verify via Unit 4 tests that call the callback after apply)
- Test expectation: none standalone — covered by Unit 4 integration in the download tests

**Verification:**
- `tsc --noEmit` passes with the new method added to the exported object type

---

- [ ] **Unit 2: Add `_applyRecord()` — conflict strategy routing**

**Goal:** A single internal function that applies one downloaded (camelCase-converted) record to Dexie using the table's declared conflict strategy.

**Requirements:** R2

**Dependencies:** Unit 1 (module structure in place)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.download.test.ts` (new file)

**Approach:**
- Four strategy branches (LWW, monotonic, insert-only, conflict-copy); fall-through default logs a warning
- **LWW**: fetch local by id; if absent → `put`; if server `updatedAt > local.updatedAt` → `put`; else no-op
- **Monotonic**: fetch local; `Math.max(Number(local[f] ?? 0), Number(record[f] ?? 0))` for each `monotonicField`; apply LWW on `updatedAt` to decide which record's non-monotonic fields are used as base; `put` merged
- **Insert-only**: fetch local by id; if absent → `add`; if present → no-op
- **Conflict-copy**: fetch local by id; if absent → `put`; compute `|serverTs - localTs| <= 5000` AND content differs (shallow JSON.stringify excluding `updatedAt`); if conflict → `put` a new record with `crypto.randomUUID()` id, `conflictCopy: true`, `conflictSourceId: record.id`; if no conflict → LWW
- **Compound PK tables**: when `entry.compoundPkFields` is defined, build the compound key array and use `.where(compoundPkFields).equals(compoundValues).first()` instead of `.get(record.id)`
- Wrap each strategy's Dexie write in try/catch; rethrow so the caller (`_doDownload`) can log-and-continue per record
- Dynamic table access pattern: `(db as unknown as Record<string, Table>)[entry.dexieTable]`

**Patterns to follow:**
- `syncEngine.test.ts` mock pattern — `vi.hoisted()` for shared mocks, `vi.mock('@/db')` with explicit table shapes

**Test scenarios:**
- Happy path LWW — no local record: server row downloaded → `db.notes.put()` called with camelCased record
- Happy path LWW — server newer: local `updatedAt` < server `updatedAt` → `put()` called
- Edge case LWW — client newer: local `updatedAt` > server `updatedAt` → `put()` NOT called
- Edge case LWW — equal timestamps: local `updatedAt` === server `updatedAt` → `put()` NOT called (no-op, equal treated as client wins)
- Happy path monotonic — local has higher value: server sends `watchedSeconds: 100`, local has `200` → `put()` called with `watchedSeconds: 200`
- Happy path monotonic — server has higher value: server `watchedSeconds: 300`, local `200` → `put()` called with `watchedSeconds: 300`
- Happy path insert-only — no local record: `db.studySessions.add()` called
- Edge case insert-only — existing id: `db.studySessions.get()` returns a record → `add()` NOT called, `put()` NOT called
- Happy path conflict-copy — content differs within 5s: two Dexie records written; conflict copy has `conflictCopy: true` and `conflictSourceId` matching original id
- Edge case conflict-copy — same content: content identical → only LWW path; no second record
- Edge case conflict-copy — timestamps > 5s apart: LWW applied, no duplicate

**Verification:**
- All test scenarios pass with `npm run test:unit`
- `tsc --noEmit` clean

---

- [ ] **Unit 3: Add `_doDownload()` — download loop**

**Goal:** Per-table download from Supabase using `syncMetadata.lastSyncTimestamp` as cursor, calling `_applyRecord()` per row and advancing the timestamp after each table.

**Requirements:** R1, R3, R4

**Dependencies:** Unit 2

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.download.test.ts`

**Approach:**
- Import `tableRegistry` (array) from `'./tableRegistry'` and `toCamelCase` from `'./fieldMapper'` — both already in the module's dependency set (fieldMapper not yet imported; add import)
- Iterate `tableRegistry` in order (already priority-sorted); skip entries where `skipSync === true`
- Read `lastSyncTimestamp`: `const meta = await db.syncMetadata.get(entry.dexieTable); const cursor = meta?.lastSyncTimestamp ?? null`
- Build Supabase query: chain `.gte('updated_at', cursor)` only when `cursor !== null`
- On Supabase error: log and `continue` to next table (do not abort the full download)
- Per-row: `const record = toCamelCase(entry, row as Record<string, unknown>)` then `try { await _applyRecord(entry, record) } catch (err) { console.error(...) }`
- Advance timestamp after all rows attempted: `const maxUpdatedAt = rows.reduce(...)` → `db.syncMetadata.put({ table: entry.dexieTable, lastSyncTimestamp: maxUpdatedAt })`
- After all rows applied for the table: `const refreshFn = _storeRefreshRegistry.get(entry.dexieTable); if (refreshFn) await refreshFn().catch(err => console.warn(...))`
- Null-guard: `if (!supabase) { console.warn('[syncEngine] Supabase not configured — download skipped'); return }`

**Patterns to follow:**
- Upload phase's `_doUpload()` for table iteration and null guard patterns

**Test scenarios:**
- Happy path: supabase returns 2 rows for `notes` → `_applyRecord` called twice, `syncMetadata.put` called with max `updated_at`
- Incremental: `syncMetadata.get` returns `lastSyncTimestamp` → `.gte('updated_at', timestamp)` present in Supabase call
- Full download: `syncMetadata.get` returns undefined/null → no `.gte()` filter in Supabase call
- Error path: supabase returns error for a table → that table skipped; next table still processed; no throw
- Edge case: empty result (no rows) → `syncMetadata.put` NOT called for that table; no error
- Store refresh: after apply, `_storeRefreshRegistry.get('notes')` callback is invoked
- Null supabase guard: when `supabase` is null, `_doDownload()` returns without error and without Dexie calls

**Verification:**
- All scenarios pass
- `syncMetadata.get` is called once per table; `.put` only when `rows.length > 0`

---

- [ ] **Unit 4: Add `start()`, `stop()`, `fullSync()` to public API**

**Goal:** Expose lifecycle methods used by E92-S07 and E92-S08, and make `nudge()` a no-op when stopped.

**Requirements:** R5, R6

**Dependencies:** Unit 3

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.download.test.ts`

**Approach:**
- Add module-level state: `let _userId: string | null = null`, `let _started = false`
- `start(userId)`: set `_userId`, `_started = true`, call `fullSync()` (awaited)
- `stop()`: set `_started = false`, `_userId = null`, clear any pending `_debounceTimer`
- `fullSync()`: call `_doUpload()` then `_doDownload()`; use null guards (not `_started` check) inside each phase so `fullSync()` can be called independently by tests and E92-S07 without requiring `start()` first; wrap the entire body in try/catch, log errors without rethrowing (fullSync is called from useSyncLifecycle — must not propagate exceptions to the caller)
- Update `nudge()`: prepend `if (!_started) return` guard before the debounce timer
- Add `start`, `stop`, `fullSync`, `registerStoreRefresh` to the exported `syncEngine` object

**Patterns to follow:**
- Existing `_setRunning` pattern for module-level state mutation

**Test scenarios:**
- Happy path: `start('user-1')` sets `_started = true`, calls `fullSync()` which runs upload then download
- `stop()` after `start()`: `_started = false`; subsequent `nudge()` call is a no-op (no debounce timer set)
- `fullSync()` sequence: `_doUpload()` called before `_doDownload()`
- Error resilience: `_doUpload()` throws → `fullSync()` catches, logs the error, and **still calls `_doDownload()`** (best-effort; the local record will win on LWW next cycle anyway); exception must not propagate to caller
- `stop()` clears debounce timer: if `nudge()` was called but timer not yet fired, `stop()` clears it

**Verification:**
- `start()` → `stop()` → `nudge()` results in zero upload or download activity
- `fullSync()` calls upload first, download second (verify via call order in mocks)

---

- [ ] **Unit 5: Verification pass**

**Goal:** Confirm the complete implementation compiles, lints cleanly, and passes all tests including pre-existing upload tests.

**Requirements:** R7

**Dependencies:** Units 1–4

**Files:**
- No new files; no code changes expected in this unit

**Test scenarios:**
- Test expectation: none — this is a verification-only unit

**Verification:**
- `npm run test:unit` passes with 0 failures (new download tests + pre-existing upload, tableRegistry, fieldMapper, syncableWrite, backfill tests)
- `npx tsc --noEmit` — zero errors
- `npm run lint` — zero errors (design-tokens rule irrelevant for pure-TS files; ESLint still runs)
- `npm run build` — clean

## System-Wide Impact

- **Interaction graph:** `syncEngine.ts` now imports `tableRegistry` (array) and `toCamelCase` from `fieldMapper`. Both are pure modules — no new side effects. `fullSync()` calls `_doUpload()` internally, preserving upload behaviour.
- **Error propagation:** Per-record errors in `_applyRecord()` are caught, logged, and skipped. Per-table Supabase errors are caught and skipped (the next table still runs). `fullSync()` does not propagate exceptions to its caller.
- **State lifecycle risks:** `lastSyncTimestamp` is advanced per-table after applying rows — if the process crashes mid-table, the cursor is not advanced for that table; rows are re-fetched next cycle (idempotent apply). The LWW and insert-only strategies are idempotent; conflict-copy is not strictly idempotent (re-running could create a second conflict copy) but this is an acceptable edge case for the rare scenario.
- **API surface parity:** `start()`, `stop()`, `fullSync()`, `registerStoreRefresh()` are net-new; existing `nudge()`, `isRunning`, `_setRunning()` unchanged. E92-S07 and E92-S08 depend on the new surface.
- **Integration coverage:** The download → Zustand refresh chain is exercised in Unit 3 tests via the `StoreRefreshRegistry` mock. End-to-end integration (actual Supabase + Dexie + store) deferred to E92-S09 integration tests.
- **Unchanged invariants:** Upload phase (`_doUpload()`, `_coalesceQueue()`, `_uploadBatch()`, retry logic) is not modified. `nudge()` external behaviour is preserved (only a `_started` guard is prepended). Existing tests in `syncEngine.test.ts` must remain green with no changes.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| TypeScript dynamic table access (`db[entry.dexieTable]`) may be hard to type cleanly | Use `as unknown as Record<string, Table<Record<string, unknown>>>` cast; document the cast site with `// Intentional:` comment |
| `progress` table lacks `compoundPkFields` in registry → download lookup may use wrong key | Document as pre-existing known gap (R1-PE-01 from E92-S02); fall back to `get(record.id)` and add `// Intentional:` comment flagging the gap |
| Conflict-copy content comparison with `JSON.stringify` is order-dependent | Acceptable for now — same-origin objects will have consistent key order; cross-device differences in key order would be a false positive, treated as conservative (creates conflict copy when not strictly needed) |
| `fullSync()` called before `start()` (by test or hook) | `_doUpload()` and `_doDownload()` have their own null guards; `_started` is false → they exit early gracefully |
| Store refresh callback throws | Wrapped in `.catch(err => console.warn(...))` — never propagates; download result is unaffected |
| Supabase may return vault field columns (e.g. `password` for `opdsCatalogs`) | `toCamelCase` will include these in the converted record and they will be written to Dexie. Acceptable — vault fields are already present locally; the sync merely re-writes them. `stripFields` is upload-only. No action needed in S06; E95 owns vault routing. |

## Sources & References

- **Origin document:** `docs/implementation-artifacts/92-6-sync-engine-download-and-apply-phase.md`
- **Design doc:** `docs/plans/2026-03-31-supabase-data-sync-design.md`
- **Epic source:** `docs/planning-artifacts/epics-supabase-data-sync.md` (E92-S06 section)
- Related code: `src/lib/sync/syncEngine.ts`, `src/lib/sync/tableRegistry.ts`, `src/lib/sync/fieldMapper.ts`, `src/db/schema.ts`
- Related tests: `src/lib/sync/__tests__/syncEngine.test.ts` (upload — must stay green)
- Institutional patterns: `docs/engineering-patterns.md` §§ "Dexie Mock Boilerplate", "Dexie Filter Semantics"
