---
story_id: E92-S02
story_name: 'Dexie v52 Migration and Sync Infrastructure'
status: review
started: 2026-04-17
completed:
reviewed: in-progress
review_started: 2026-04-17
review_gates_passed: []
burn_in_validated: false
---

# Story 92.02: Dexie v52 Migration and Sync Infrastructure

## Story

As the sync engine (E92–E97),
I want the client-side Dexie schema to carry `userId` + `updatedAt` on every syncable table, plus `syncQueue` and `syncMetadata` tables,
so that subsequent stories can wrap writes with `syncableWrite()`, query "records modified since last checkpoint", and push/pull to Supabase.

## Acceptance Criteria

- AC1. v52 migration adds `userId` and a compound `[userId+updatedAt]` index to all ~30 syncable Dexie tables (P0–P4 per the E92-S03 registry). Existing indexes are preserved.
- AC2. v52 migration creates `syncQueue` table with index string `++id, status, [tableName+recordId], createdAt` and `syncMetadata` table with index string `table`.
- AC3. `src/db/checkpoint.ts` bumped: `CHECKPOINT_VERSION = 52`; `CHECKPOINT_SCHEMA` reflects the new indexes on every syncable table + the two new tables; `schema-checkpoint.test.ts` passes.
- AC4. Static `updatedAt` backfill runs inside the v52 upgrade callback: records on syncable tables whose `updatedAt` is missing/falsy get stamped with `migrationNow` (one timestamp captured at the start). Pre-existing `updatedAt` values (e.g. on `notes`, `chatConversations`) are preserved.
- AC5. `src/lib/sync/backfill.ts` exports `backfillUserId(userId)` that stamps `userId` (and `updatedAt` if still missing) onto existing records whose `userId` is empty; idempotent; skipped when `userId` is falsy. Invoked from the app bootstrap after auth hydration.
- AC6. Excluded tables (`videoCaptions`, `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `courseThumbnails`, `screenshots`, `bookFiles`, `transcriptEmbeddings`, `courseEmbeddings`, `entitlements`) get **no** `userId`/`updatedAt` additions in v52.
- AC7. Migration runs without data loss on a seeded v51 database; existing data (notes, bookmarks, progress, etc.) is preserved with all original fields intact.
- AC8. Performance: 10k-record database migrates in <3 seconds (asserted qualitatively under fake-indexeddb).

## Tasks / Subtasks

- [x] Task 1: Add v52 migration to `src/db/schema.ts` (AC1, AC2, AC4, AC6)
  - [x] 1.1 Capture `migrationNow = new Date().toISOString()` at top of upgrade callback
  - [x] 1.2 Declare `database.version(52).stores({...})` with full schema for each syncable table (add `userId, [userId+updatedAt]`) + new `syncQueue`/`syncMetadata` tables
  - [x] 1.3 Excluded tables retain their v51 schema string verbatim
  - [x] 1.4 `.upgrade(async tx => ...)` stamps `updatedAt = migrationNow` only on records missing it; does NOT set `userId`
  - [x] 1.5 Header comment block documents v52 additions
- [x] Task 2: Update checkpoint snapshot (AC3)
  - [x] 2.1 Bump `CHECKPOINT_VERSION = 52`
  - [x] 2.2 Update `CHECKPOINT_SCHEMA` for every changed table + add `syncQueue`, `syncMetadata`
  - [x] 2.3 Add v52 header comment line
- [x] Task 3: `backfillUserId()` in `src/lib/sync/backfill.ts` (AC5)
  - [x] 3.1 Create `src/lib/sync/backfill.ts` exporting `backfillUserId(userId): Promise<BackfillUserIdResult>`
  - [x] 3.2 Guard falsy userId; iterate `SYNCABLE_TABLES`; filter records missing `userId`; stamp userId + (if missing) updatedAt
  - [x] 3.3 Per-table try/catch — failures logged, collected in `tablesFailed`, do not abort aggregate
  - [x] 3.4 Invoke from `useAuthLifecycle` on both `SIGNED_IN`/`INITIAL_SESSION` and the `getSession()` safety-net path
- [x] Task 4: Schema integrity tests (AC1, AC2, AC3, AC6)
  - [x] 4.1 Created `src/db/__tests__/migration-v52-sync.test.ts` (10 tests) + updated `src/db/__tests__/schema.test.ts` and `schema-checkpoint.test.ts`
  - [x] 4.2 Assert `[userId+updatedAt]` present on every syncable table
  - [x] 4.3 Assert `syncQueue` / `syncMetadata` exist with expected index strings
  - [x] 4.4 Assert excluded tables do NOT have the new indexes
  - [x] 4.5 Created `src/lib/sync/__tests__/backfill.test.ts` (7 tests) — happy path, idempotency, falsy userId, error isolation, counts across tables
- [x] Task 5: Verification + finalize (all ACs)
  - [x] 5.1 `npm run test:unit`: 5581/5587 pass — 6 failures are pre-existing reader sepia tests on `main` unrelated to this story (verified by checkout)
  - [x] 5.2 `npx tsc --noEmit`: clean
  - [x] 5.3 `npm run build`: clean
  - [x] 5.4 `npm run lint`: 0 errors (new code contributes no warnings)
  - [x] 5.5 Story file Implementation Notes + Testing Notes populated (below)
  - [x] 5.6 `sprint-status.yaml` flipped to `review`

## Implementation Plan

See [plan](../plans/2026-04-17-003-feat-e92-s02-dexie-v52-sync-infrastructure-plan.md) for the detailed implementation approach, unit breakdown, risks, and verification strategy.

## Design Guidance

N/A — schema migration, no UI.

## Implementation Notes

**Architecture decisions:**

- **Two-phase backfill.** The v52 Dexie `.upgrade()` callback only stamps `updatedAt` (using a single `migrationNow` captured at the start of the upgrade). `userId` backfill lives in `src/lib/sync/backfill.ts` and runs post-open from `useAuthLifecycle`. This avoids the race where Zustand auth hydrates asynchronously while Dexie upgrades run synchronously during `db.open()`. Reading auth state inside the upgrade would have been brittle.
- **Single schema migration.** All ~38 syncable tables get their `userId` + `[userId+updatedAt]` indexes in one `.version(52).stores({...})` block. Excluded tables (`videoCaptions`, `courseThumbnails`, `screenshots`, `bookFiles`, `transcriptEmbeddings`, `courseEmbeddings`, `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `entitlements`) are omitted from the v52 declaration and inherit their v51 shape.
- **`syncQueue` uses auto-increment PK.** `++id` allows multiple queued operations against the same `(tableName, recordId)` tuple — the E92-S05 upload engine is responsible for coalescing. Indexes: `status`, `[tableName+recordId]`, `createdAt`.
- **`syncMetadata` keyed by `table` (string).** One row per syncable table; a `__global__` sentinel row is reserved for the last full-sync timestamp. No indexes beyond PK.
- **Types added to `ElearningDatabase`.** `SyncQueueEntry` and `SyncMetadataEntry` are interface-exported from `src/db/schema.ts` so downstream stories (E92-S04/S05) can import them without reinventing shapes.
- **Error tolerance in upgrade callback.** The per-table `.modify()` is wrapped in `.catch(() => {})` to tolerate empty tables or schema-only tables at migration time. Hard errors (schema mismatch, IndexedDB corruption) still propagate through Dexie's outer promise.
- **Backfill idempotency via filter semantics.** `backfillUserId` filters records whose `userId` is `undefined`, `null`, or `""`, then stamps the authenticated user. Records already stamped are untouched. Steady-state re-invocation is O(0).
- **Per-table error isolation.** `backfillUserId` wraps each table in try/catch; failures log + append to `tablesFailed` but don't abort the aggregate. Partial progress is better than none; next sign-in retries the whole operation (idempotent).

**Dependencies added:** none. All new code uses existing Dexie, Supabase, and Zustand facilities.

**Files touched:**

- `src/db/schema.ts` — v52 migration block + `SyncQueueEntry`/`SyncMetadataEntry` types + `ElearningDatabase` extension
- `src/db/checkpoint.ts` — bumped `CHECKPOINT_VERSION` to 52; updated every syncable table's index string; added `syncQueue`/`syncMetadata` to `CHECKPOINT_SCHEMA`
- `src/db/__tests__/schema.test.ts` — updated version assertion + table list
- `src/db/__tests__/schema-checkpoint.test.ts` — updated version assertion + table list
- `src/db/__tests__/migration-v52-sync.test.ts` — NEW, 10 tests covering schema shape, data preservation, updatedAt backfill, userId deferral, idempotency
- `src/lib/sync/backfill.ts` — NEW, `backfillUserId()` + `SYNCABLE_TABLES` constant + `BackfillUserIdResult` type
- `src/lib/sync/__tests__/backfill.test.ts` — NEW, 7 tests covering happy path, idempotency, falsy userId, overwrite avoidance, updatedAt preservation, counts, per-table error isolation
- `src/app/hooks/useAuthLifecycle.ts` — wired `backfillUserId(session.user.id)` into both the `SIGNED_IN`/`INITIAL_SESSION` handler and the `getSession()` safety-net path (fire-and-forget with `silent-catch-ok`)
- `docs/implementation-artifacts/sprint-status.yaml` — story flipped `backlog → in-progress → review`; `last_updated: 2026-04-17`

## Testing Notes

**New test coverage:**

| File | Tests | Coverage |
| --- | --- | --- |
| `src/db/__tests__/migration-v52-sync.test.ts` | 10 | Schema shape, data preservation, `updatedAt` stamping, `userId` deferral, excluded tables, idempotency |
| `src/lib/sync/__tests__/backfill.test.ts` | 7 | Falsy-userId guard, stamp-missing, don't-overwrite, `updatedAt` handling, idempotency, per-table error isolation |

**Test strategy:**

- Migration tests use `fake-indexeddb/auto` + the v31 FSRS test pattern: seed a v51-shaped DB, close, reopen via `declareLegacyMigrations()`, assert post-v52 state.
- Backfill tests use real `db.notes` / `db.bookmarks` / `db.flashcards` (fake-indexeddb under the hood) to exercise the actual Dexie query + modify path. Per-table error isolation is verified via `vi.spyOn(db, 'table').mockImplementation(...)` to synthetically throw for one table.
- The existing `schema-checkpoint.test.ts` invariant ("migration-built schema === checkpoint-built schema at CHECKPOINT_VERSION") now validates v52. This is the load-bearing integration check that guarantees `schema.ts` and `checkpoint.ts` never drift.

**Edge cases covered:**

- `userId` already set to a different value (e.g. `'user-B'`) — backfill preserves it.
- `updatedAt` already set — migration preserves it.
- Excluded tables — `videoCaptions`, `courseThumbnails`, etc. — no schema or data changes in v52.
- Idempotent re-invocation — second `backfillUserId()` call stamps zero records.
- Synthetic per-table failure — aggregate continues, failure reported in `tablesFailed`.
- Falsy `userId` (empty string, `null`, `undefined`) — function returns zero counts, DB untouched.

**Not covered (deferred to later stories):**

- Large-scale migration performance (10k+ records) — qualitatively asserted under fake-indexeddb, not wall-clock validated.
- Sign-out → sign-in re-invocation flow — E92-S08 will add an explicit test for the auth lifecycle hook.
- `syncQueue`/`syncMetadata` write semantics — tables exist but aren't written to in this story; E92-S04/S05 will add those tests.

**Pre-existing test failures (NOT introduced by this story):** 6 reader sepia theme tests (`ReaderFooter`, `ReaderHeader`, `EpubRenderer`, `TtsControlBar`) fail on `main` as well — verified by checking out `main` and running the same specs.

## Pre-Review Checklist

See [story-template.md](./story-template.md) for the full pre-review checklist. Key items for this story:

- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] Dexie schema: `src/db/__tests__/schema.test.ts` updated for v52 additions
- [ ] No error swallowing — catch blocks in `backfill.ts` log AND allow aggregate to continue
- [ ] Checkpoint and migration stay in lockstep (`schema-checkpoint.test.ts` passes)
- [ ] Excluded-table list is accurate (no accidental inclusion of `videoCaptions`, `courseThumbnails`, `screenshots`, `bookFiles`, `transcriptEmbeddings`, `courseEmbeddings`, `youtubeVideoCache`, `youtubeTranscripts`, `youtubeChapters`, `entitlements`)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

### Round 1 (2026-04-17) — ce:review mode:autofix

8 reviewers dispatched in parallel (correctness, testing, maintainability, data-migrations, reliability, kieran-typescript, adversarial, project-standards). Full artifacts at `.context/compound-engineering/ce-review/20260417-212533-5ef6b44b/`.

**10 safe_auto fixes applied in-review:**

1. `SyncQueueEntry.payload: unknown` → `Record<string, unknown>` (KT-01 — tighter type for E92-S04 consumers)
2. Re-exported `SyncQueueEntry` + `SyncMetadataEntry` from `src/db/index.ts` (KT-03)
3. Narrowed `backfillUserId` signature: `string | null | undefined` → `string | null` (KT-02)
4. Removed `backfillUserId(undefined)` test call (paired with signature narrow)
5. Fixed dead "E92-S08" comment reference in `schema.ts` — now points at `useAuthLifecycle.ts` (M-04)
6. Added cross-reference comment linking `SYNCABLE_TABLES_V52` (inline in upgrade callback) to `SYNCABLE_TABLES` (in backfill.ts) (M-05)
7. Replaced inline 38-item table literal in `migration-v52-sync.test.ts` with import of `SYNCABLE_TABLES` from backfill (M-01 / TG-01 — single source of truth)
8. Added `afterEach(Dexie.delete)` to `migration-v52-sync.test.ts` — matches `beforeEach` pattern and prevents connection leaks between tests (T05)
9. Tightened error-isolation test: `tablesProcessed > 0` → `=== SYNCABLE_TABLES.length - 1` and `tablesFailed` → `toEqual(['notes'])` (T03)
10. Added explicit test: backfill stamps records with `userId: ''` (empty-string) — closes branch coverage on the filter predicate (T02)
11. Upgrade callback's silent `.catch(() => {})` now logs via `console.warn` with the table name and error — genuine IDB errors are visible instead of silent partial migrations. Narrower rethrow behavior captured as R1-01 follow-up below. (C-03 / ADV-05 / DM-01 / REL-01 — 4-reviewer agreement)

All 89 unit tests pass after fixes (88 + the new empty-string test). `tsc --noEmit` clean.

### Round 1 residual work (gated_auto / manual — not auto-applied)

These findings were agreed on by 2+ reviewers and have concrete fixes, but change observable behavior so they need a design decision before applying. Track as E92-S02 round-2 follow-ups or defer to E92-S08:

- **R1-01 (P1, 4-reviewer agreement ~0.95 confidence):** The `Promise.all + per-table .catch` pattern in the v52 upgrade callback still converts a genuine IDB error (QuotaExceededError, DataCloneError, TransactionAbortError) into a silently partial migration — Dexie commits v52 even if every table failed. The logging fix above makes this visible, but the correct long-term fix is to narrow the catch: rethrow anything that isn't `NotFoundError` / "table empty" so the versionchange transaction aborts and leaves the DB at v51 for safe retry. Reviewers: correctness C-03, adversarial ADV-05, data-migrations DM-01, reliability REL-01. **Action:** evaluate whether to narrow the catch now (can be done as a single commit, adds 1 test case to synthesize a hard error) or defer until E92-S05 so the sync engine can detect and recover from partial migrations.

- **R1-02 (P2, 5-reviewer agreement ~0.95 confidence):** `useAuthLifecycle.ts` fires `backfillUserId` at both call sites (INITIAL_SESSION handler AND getSession safety-net) on every cold start. Idempotency prevents double-stamping, but two concurrent 38-table scans run on every app open. Reviewers: correctness C-02, adversarial ADV-02, data-migrations DM-03, reliability REL-02, kieran-typescript KT-04. **Action:** add a module-level in-flight guard (`let backfillInFlight: Promise | null = null`) that coalesces concurrent calls. Best deferred to E92-S08 which owns the full auth-lifecycle sync wiring.

- **R1-03 (P2, adversarial + correctness R-01 ~0.88):** Sign-out during an in-flight backfill stamps records with the now-invalid userId, and the filter guard prevents re-stamping on next sign-in with a different account. No production risk today (single-user model), but must be resolved before multi-account switching ships. **Action:** defer to E92-S08 (auth lifecycle integration). Note in E92-S08's story file.

- **R1-04 (P3, reliability REL-03):** `backfillUserId` returns `BackfillUserIdResult.tablesFailed` but both call sites discard it. A systematic partial failure (e.g., disk quota) produces per-table `console.error` lines but no aggregate signal. **Action:** defer to E92-S05 observability work — the sync engine will need this signal anyway.

- **R1-05 (P3, adversarial ADV-03):** `!record.updatedAt` truthy check mishandles edge cases (`0`, `{}`, `false`). No production data evidence of these values existing. **Action:** advisory only — document in `docs/solutions/` if an incident is traced to this.

### Pre-existing issues surfaced by review (not blocking E92-S02)

- **R1-PE-01 (P2, correctness C-01 0.92):** `progress` table declared as `EntityTable<VideoProgress, 'courseId'>` but its actual primary key is compound `[courseId+videoId]`. This pre-dates E92-S02 but will trip up E92-S04's `syncableWrite` when it tries to use `recordId` as a lookup key. **Action:** fix during E92-S04 when the type shape matters; create a chore commit if the fix is trivial.

### Deferred test gaps (tracked for follow-up)

- Concurrent `backfillUserId` calls with different userIds (R-01 race) — no test today (adversarial + correctness T-01). Will be addressed in E92-S08.
- 10k-record performance bound (AC8) — not asserted in a test (T04). Plan classifies as qualitative; can be added when we have a performance harness.
- Hard-error upgrade scenario — becomes easy to test once R1-01 narrows the catch (T06 / TG-01).
- Concurrent double-backfill with same userId (R1-02) — test should be added alongside the dedup guard fix.

## Challenges and Lessons Learned

**1. Dexie + Zustand hydration race — resolved by separating schema from data-backfill.**
The naive interpretation of the epic ("backfill userId on migration open using auth store") would have forced reading Zustand state during the Dexie `.upgrade()` callback. But Dexie upgrades run synchronously during `db.open()` (which the module executes at import time), while Zustand auth hydrates asynchronously via the Supabase `onAuthStateChange` listener. Result: the upgrade callback would see `null` userId on first app load and silently skip every record.

Fix: split the work. The v52 `.upgrade()` stamps only `updatedAt` (static value). The `userId` stamping happens in `src/lib/sync/backfill.ts`, invoked from `useAuthLifecycle` after auth hydrates. This also gives E92-S08 a clean hook: it can re-invoke `backfillUserId()` on any subsequent `SIGNED_IN` event without schema changes.

**2. `Dexie.where().equals(undefined)` is not reliable for "field is missing" queries.**
The first draft of `backfillUserId` used `db.table(t).where('userId').equals(undefined).modify(...)`. Dexie's index doesn't include records where the indexed field is missing from the document, and `.equals(undefined)` returns zero rows even when records have no `userId`. Switched to `.toCollection().filter(r => !r.userId)` — slower but correct for all three cases (missing, `null`, empty string).

**3. Schema + checkpoint must be updated in lockstep, or `schema-checkpoint.test.ts` fails opaquely.**
Updating `schema.ts` alone leaves `checkpoint.ts` stale. The test diffs migration-built schema against checkpoint-built schema table-by-table — the failure output points to the specific offending table, but only if both files are updated. This caught several typos during development (missing commas, wrong compound-index syntax).

**4. TypeScript data interfaces vs Dexie schema — scope boundary enforced.**
The Dexie schema now carries `userId`/`updatedAt` on every syncable table, but the TypeScript types (`Note`, `VideoBookmark`, etc.) don't yet have those fields — that's E92-S03/S04's `SyncableFields` mixin. Rather than drag type changes into this story, the backfill tests use a local `asSyncable<T>()` helper to narrow through `unknown`. Keeps E92-S02 scoped to schema-shape-only.

**5. `notifications` is a syncable table (despite an old v28 comment suggesting "local-only").**
Initial exploration flagged `notifications` as possibly local-only based on a historical v28 comment. The canonical source of truth is E92-S03's P3 registry list in `epics-supabase-data-sync.md`, which includes `notifications`. Included it in v52; E96-S03 will define the sync conflict strategy.

**6. Plan-aligned execution kept scope tight.**
The plan explicitly carved out `syncableWrite()`, `tableRegistry`, `syncEngine`, and store rewiring as out-of-scope for E92-S02. During implementation it was tempting to start building the registry inline (since we have the table list right here) — holding the line kept the PR reviewable and preserved the epic's 9-story sequencing.
