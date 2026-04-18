---
story_id: E92-S09
story_name: "Wire P0 Stores with Syncable Write"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.9: Wire P0 Stores with Syncable Write

Status: ready-for-dev

## Story

As a Knowlune learner using the platform on two or more devices,
I want my content progress, study sessions, and video position to sync across devices within seconds of being recorded,
so that I can continue a course, lesson, or video exactly where I left off on any device I sign in to.

This is the **end-to-end acceptance test** of the entire E92 Sync Foundation epic. After this story ships:

1. Writes to the three P0 Dexie tables (`contentProgress`, `studySessions`, `progress`) route through `syncableWrite()` instead of direct Dexie calls.
2. Those writes automatically stamp `userId`/`updatedAt`, enqueue into `syncQueue`, trigger the upload engine, and land in the corresponding Supabase tables (`content_progress`, `study_sessions`, `video_progress`).
3. On a second device, the download-and-apply phase pulls those records back into Dexie, so "continue where I left off" works across devices.

## Acceptance Criteria

**AC1 — Content progress writes go through syncableWrite:**
- Every mutation site in `src/stores/useContentProgressStore.ts` that previously called `db.contentProgress.put(...)` now calls `syncableWrite('contentProgress', 'put', record)`.
- The transactional batch in `setItemStatus` (item record + cascade module records) is preserved: each record still writes, but through `syncableWrite`. Because `syncableWrite` performs `db.table(...).put` (not a `transaction('rw', ...)` wrapper), the call pattern must ensure no regression in atomicity. Either (a) iterate the batch and call `syncableWrite` for each record, or (b) keep the Dexie transaction and enqueue separate `syncQueue` entries after commit — choose (a) and document why in a code comment (simpler, matches the pattern expected by E92-S05 upload engine).
- `persistWithRetry` wrapper is preserved around the batch.
- No `db.contentProgress.put(...)` or `db.contentProgress.delete(...)` calls remain in the store source (excluding tests).

**AC2 — Study session writes go through syncableWrite (INSERT-only semantics):**
- `src/stores/useSessionStore.ts` mutation sites:
  - `startSession`: `db.studySessions.add(newSession)` → `syncableWrite('studySessions', 'add', newSession)`.
  - `pauseSession` / `resumeSession` / `endSession` / `heartbeat` currently use `db.studySessions.put(updatedSession)` to update an **in-flight active session**. The tableRegistry marks `studySessions` as `insert-only`, but the **local** Dexie table still needs mutable updates until the session closes — only the **upload** must be INSERT-only.
  - Resolution: the active session record is updated locally via `db.studySessions.put(...)` directly with `{ skipQueue: true }` routed through `syncableWrite('studySessions', 'put', session, { skipQueue: true })` to keep the stamping consistent; ONLY the final `endSession` / `pauseSession`-to-closed transition enqueues via `syncableWrite('studySessions', 'add', closedSession)` (which becomes the INSERT row in Supabase).
  - Alternative (simpler) implementation: keep intermediate `db.studySessions.put(...)` calls unchanged (direct Dexie, not through syncableWrite) because they are transient local-only state; call `syncableWrite('studySessions', 'add', session)` only when the session is finalized. Document the chosen approach in a code comment referencing this AC.
- The session is uploaded **once per lifecycle** — no duplicate queue entries for the same session id.
- Historical sessions in Supabase are never updated or deleted (INSERT-only policy from E92-S01 RLS).

**AC3 — Video progress writes go through syncableWrite (monotonic):**
- `src/app/components/course/PdfContent.tsx` and `src/app/components/course/tabs/MaterialsTab.tsx` currently call `db.progress.update(...)` and `db.progress.put(...)` for PDF page tracking.
- Replace both call sites with `syncableWrite('progress', 'put', record)`. The `update → put` unification is acceptable because `syncableWrite` uses `put` (upsert) semantics; field merging is done by stamping + full-record write.
- Preserve the `[courseId+videoId]` compound-key lookup before write so the existing record's `currentTime` / `completionPercentage` fields are not clobbered by an accidental null.
- `tableRegistry.progress.conflictStrategy = 'monotonic'` with `monotonicFields: ['watchedSeconds']` — the upload engine (E92-S05) delegates to Supabase `upsert_video_progress()` function which never regresses `watchedSeconds`. Dev is responsible only for routing writes through `syncableWrite`; the monotonic guarantee is enforced server-side.
- **Known issue note (do not fix):** `progress` Dexie schema was declared as `EntityTable<VideoProgress, 'courseId'>` but actual PK is `[courseId+videoId]` (R1-PE-01 from E92-S02). S09 continues to use the compound key as-is.

**AC4 — Content progress end-to-end sync:**
- Given a signed-in user, changing a lesson status in `useContentProgressStore` produces within 30 seconds:
  - A row in Supabase `content_progress` with `user_id = auth.uid()`, correct `course_id`, `item_id`, `status`, `updated_at`.
  - No duplicate rows (upsert on compound PK `[user_id, course_id, item_id]`).
- Given that row exists in Supabase, a second device signing in as the same user downloads and applies it: `statusMap[courseId:itemId]` equals the server value after sync.

**AC5 — Study session end-to-end sync:**
- A completed session appears as a single row in Supabase `study_sessions` with the same `id`, `duration`, `videosWatched`, `qualityScore` fields.
- Attempting to UPDATE a historical session returns 403 (RLS blocks mutation on INSERT-only table; already validated in E92-S01).
- A second device downloads the session into Dexie.

**AC6 — Video progress monotonic sync:**
- Setting `watchedSeconds = 100` then `watchedSeconds = 80` for the same `(courseId, videoId)` produces a Supabase `video_progress` row with `watched_seconds = 100` (never regresses).
- A second device downloads and the local Dexie `progress` record's `currentTime` / `completionPercentage` match the server.

**AC7 — Field stripping / serializability:**
- P0 tables (`contentProgress`, `studySessions`, `progress`) contain **no** `stripFields` or `vaultFields` in `tableRegistry.ts` (verified — see registry lines 75–107).
- A code comment in each store references AC7 confirming no non-serializable field handling is needed for P0.

**AC8 — Unauthenticated writes are queued on sign-in:**
- A write while `useAuthStore.user == null` still persists to Dexie (optimistic local write per `syncableWrite` contract).
- The write is **not** enqueued at write time (matches `syncableWrite` guard at line 115).
- On subsequent sign-in, `syncEngine.start(userId)` (E92-S08) + `backfillUserId(userId)` (E92-S02) + a full upload scan picks up the local record and uploads it.
- This is not a new mechanism — S09 only needs to verify the existing infrastructure handles P0 tables correctly.

**AC9 — Integration test `tests/sync/p0-sync.spec.ts`:**
- Create `tests/sync/p0-sync.spec.ts` (Playwright E2E) that:
  1. Seeds Dexie with deterministic `contentProgress`, `studySessions`, `progress` records using existing test helpers (see `tests/helpers/`).
  2. Signs in as a real Supabase test user (use the existing test-auth pattern from E92-S08 specs; reuse the `.env.test` Supabase test project credentials).
  3. Waits for `syncEngine` idle state (polling `useSyncStatusStore` or explicit `syncEngine.waitForIdle()` if exposed).
  4. Queries Supabase via the JS client to assert each seeded record is present with correct field mapping.
  5. Cleans up: deletes the test user's rows after the test (or uses a per-test user id).
- Test uses Chromium only and respects the worktree port kill guard (see CLAUDE.md "Worktree E2E Warning").
- Test tagged `@sync-p0` for selective execution.

**AC10 — Existing unit tests pass without regression:**
- `src/stores/__tests__/useContentProgressStore.test.ts`, `useSessionStore.test.ts`, and related integration tests (`integration/session-workflow.test.ts`, `integration/import-workflow.test.ts`, `useKnowledgeMapStore.test.ts`) pass without changes OR are updated minimally to mock `syncableWrite` where necessary. Prefer real `syncableWrite` in tests (integration-style) over mocking; fake-indexeddb makes this feasible.
- `src/app/components/youtube/__tests__/YouTubePlayer.test.ts` and `src/lib/__tests__/progress.test.ts` that seed `db.progress` directly for setup are NOT changed — seeding is acceptable; only production write paths route through `syncableWrite`.

**AC11 — TypeScript compiles clean:** `npx tsc --noEmit` produces zero errors.

**AC12 — Lint clean:** `npm run lint` passes (no new warnings or errors). The `error-handling/no-silent-catch` ESLint rule is respected around `syncableWrite` callers (queue-insert failure is logged inside `syncableWrite` itself; callers only need to handle Dexie-write failures, which already happens via `persistWithRetry` / try-catch blocks).

**AC13 — No regressions in side-effects:**
- Notification triggers in `useContentProgressStore.setItemStatus` (milestone approaching, challenge progress) still fire correctly after the refactor.
- `logStudyAction` / study-log integrations still fire when a session ends.
- `appEventBus.emit(...)` calls are preserved verbatim.

## Tasks / Subtasks

- [ ] **Task 1: Wire `useContentProgressStore` to syncableWrite (AC: 1, 4, 7, 13)**
  - [ ] 1.1 Import `syncableWrite` from `@/lib/sync/syncableWrite` in `src/stores/useContentProgressStore.ts`.
  - [ ] 1.2 In `setItemStatus`, replace the `db.transaction('rw', db.contentProgress, ...)` block with a sequential loop: `await syncableWrite('contentProgress', 'put', itemRecord)` + `for (const record of cascadeRecords) await syncableWrite('contentProgress', 'put', record)`. Keep the entire loop inside the existing `persistWithRetry` callback.
  - [ ] 1.3 Add inline comment `// E92-S09: syncableWrite stamps userId/updatedAt + enqueues upload. P0 table, no stripFields.`
  - [ ] 1.4 Preserve all side-effect checks (`appEventBus.emit` for milestone:approaching, challenge progress) exactly as before.
  - [ ] 1.5 Run `src/stores/__tests__/useContentProgressStore.test.ts` and fix any failures caused by added queue entries (most tests should still pass — `syncableWrite` writes to Dexie identically to `put`).
  - [ ] 1.6 Verify no `db.contentProgress.put(...)` or `db.contentProgress.delete(...)` remain in the source file (grep).

- [ ] **Task 2: Wire `useSessionStore` to syncableWrite with INSERT-only semantics (AC: 2, 5, 13)**
  - [ ] 2.1 Import `syncableWrite` in `src/stores/useSessionStore.ts`.
  - [ ] 2.2 Replace `db.studySessions.add(newSession)` in `startSession` with `syncableWrite('studySessions', 'add', newSession)`. (This creates the queue INSERT entry at session start.)
  - [ ] 2.3 For intermediate `db.studySessions.put(updatedSession)` calls in `pauseSession`, `resumeSession`, `endSession` (when session is still open), `heartbeat`: leave as **direct Dexie put** (no syncableWrite). Rationale: the INSERT row was already enqueued at session start; local-only updates to the active session must not double-enqueue. Add a code comment on each site: `// E92-S09: local-only Dexie update; sync is INSERT-only and the row was enqueued at session start.`
  - [ ] 2.4 Audit `endSession`: the final `db.studySessions.put(closedSession)` writes the terminal state. Decision: if the session row in Dexie is updated after the INSERT queue entry was created, the queue entry's `payload` is stale. Fix: re-read the final record and **update** the existing queue entry's payload OR enqueue a second `syncableWrite('studySessions', 'put', closedSession, { skipQueue: true })` for the Dexie write and manually coalesce. **Recommended implementation:** replace `db.studySessions.add(newSession)` in `startSession` with `syncableWrite('studySessions', 'put', newSession, { skipQueue: true })` to stamp but not enqueue; then replace the **final** `db.studySessions.put(closedSession)` in `endSession` with `syncableWrite('studySessions', 'add', closedSession)` to enqueue the INSERT at the terminal state. Document this choice in a block comment at the top of `useSessionStore.ts`.
  - [ ] 2.5 Handle orphan session recovery (`recoverOrphanedSessions`): sessions recovered on app boot that were never closed must still get an INSERT queue entry. If the recovery code path writes `db.studySessions.put(recovered)`, replace with `syncableWrite('studySessions', 'add', recovered)` — INSERT-only table; duplicate id will be caught by DB upsert-on-conflict-do-nothing.
  - [ ] 2.6 Run `src/stores/__tests__/useSessionStore.test.ts` and `integration/session-workflow.test.ts`; fix regressions.
  - [ ] 2.7 Verify INSERT-only upload path: check `src/lib/sync/syncEngine.ts` upload code respects `entry.insertOnly` (E92-S05). If not, file as a follow-up; do NOT modify syncEngine in this story unless a BLOCKER.

- [ ] **Task 3: Wire video progress writes to syncableWrite (AC: 3, 6, 7)**
  - [ ] 3.1 Import `syncableWrite` in `src/app/components/course/PdfContent.tsx` and `src/app/components/course/tabs/MaterialsTab.tsx`.
  - [ ] 3.2 In `PdfContent.tsx` line ~200–222: unify the `db.progress.where(...).first() → update/put` two-branch logic into a single `syncableWrite('progress', 'put', fullRecord)` call. Merge existing fields by spreading the `existing` record first so `currentTime` / `completionPercentage` are preserved when only `currentPage` changes.
  - [ ] 3.3 Repeat for `MaterialsTab.tsx` line ~150–165 (same pattern).
  - [ ] 3.4 Add inline comments: `// E92-S09: syncableWrite routes to Supabase video_progress via upsert_video_progress() (monotonic on watchedSeconds).`
  - [ ] 3.5 Preserve the `.catch(() => { ... })` silent-catch patterns (page save is non-critical per the existing `silent-catch-ok` comment).
  - [ ] 3.6 Run `src/lib/__tests__/progress.test.ts`; confirm passes.
  - [ ] 3.7 Grep `src/app/` and `src/stores/` for remaining `db.progress.put` / `db.progress.update` / `db.progress.add` in production code (tests and seeders excluded) — expect zero matches.

- [ ] **Task 4: Create integration test `tests/sync/p0-sync.spec.ts` (AC: 9)**
  - [ ] 4.1 Create `tests/sync/p0-sync.spec.ts` following the E92-S08 integration spec pattern (whatever exists there; inherit the sign-in helper, fixed-time helper, and Supabase test-client helper).
  - [ ] 4.2 Test case 1 — `contentProgress`: seed one record via `useContentProgressStore.setItemStatus`, wait for sync idle, query Supabase `content_progress` via JS client, assert row exists with correct fields.
  - [ ] 4.3 Test case 2 — `studySessions`: start + end a session via `useSessionStore`, wait for sync idle, assert one row in `study_sessions`.
  - [ ] 4.4 Test case 3 — `progress` (video_progress, monotonic): write `watchedSeconds = 100`, then `watchedSeconds = 80`, wait for sync idle, assert Supabase `video_progress.watched_seconds = 100` (never regressed).
  - [ ] 4.5 Cleanup: delete the test user's rows after the test in `afterEach` / `afterAll`.
  - [ ] 4.6 Tag spec `@sync-p0` and add to `playwright.config.ts` if needed.
  - [ ] 4.7 Verify deterministic-time ESLint rule is respected (no `Date.now()` / `new Date()` in test source without justification).

- [ ] **Task 5: Regression + quality gates (AC: 10, 11, 12, 13)**
  - [ ] 5.1 Run `npm run test:unit` — all passing.
  - [ ] 5.2 Run `npx tsc --noEmit` — zero errors.
  - [ ] 5.3 Run `npm run lint` — zero warnings/errors.
  - [ ] 5.4 Run `npm run build` — successful.
  - [ ] 5.5 Run `tests/sync/p0-sync.spec.ts` against a live Supabase test project.
  - [ ] 5.6 Manual smoke test on two devices (or two browser profiles): progress change on A appears in Dexie on B within 30s after sync nudge.

## Dev Notes

### Epic 92 Context

This is the **final story** in Epic 92 (Sync Foundation). After this lands, P0 data sync is **end-to-end functional**:

```
User action
  → Store mutation
  → syncableWrite() [E92-S04]
  → Dexie write + syncQueue entry [E92-S02]
  → syncEngine.nudge() [E92-S05]
  → Upload phase pulls queue entries, applies field mapping [E92-S03]
  → Supabase table row created/updated (with RLS user_id = auth.uid())
  → On Device B: syncEngine download phase [E92-S06]
  → Downloaded record applied to Dexie
  → Store subscribed to Dexie (live query) re-renders
```

### Prior Art

- **E92-S01** — P0 Supabase tables (`content_progress`, `study_sessions`, `video_progress`) with RLS + `upsert_video_progress()` monotonic function.
- **E92-S02** — Dexie v52 schema with `syncQueue`, `syncMetadata`; `backfillUserId` in `src/lib/sync/backfill.ts`.
- **E92-S03** — `tableRegistry` entries for all three P0 tables (verified above at lines 75–107).
- **E92-S04** — `syncableWrite()` in `src/lib/sync/syncableWrite.ts` (reviewed above; handles stamping, queue enqueue, engine nudge, error contract).
- **E92-S05** — Upload phase in `src/lib/sync/syncEngine.ts` (consumes queue, applies field mapping, respects `insertOnly` and `monotonicFields`).
- **E92-S06** — Download + apply phase (pulls from Supabase, merges into Dexie).
- **E92-S07** — Sync triggers (idle, online, visibility) + offline handling.
- **E92-S08** — Auth lifecycle integration: `syncEngine.start()/stop()` in `useAuthLifecycle`, `LinkDataDialog`, `clearSyncState`.

### Key Files to Touch

| File | Purpose | Change Type |
|------|---------|-------------|
| `src/stores/useContentProgressStore.ts` | Content progress writes | Replace `db.contentProgress.put` with `syncableWrite` |
| `src/stores/useSessionStore.ts` | Study session lifecycle writes | Replace terminal `db.studySessions.add/put` with `syncableWrite`; keep intermediate local-only puts |
| `src/app/components/course/PdfContent.tsx` | PDF page tracking (video_progress table) | Replace `db.progress.put/update` with `syncableWrite('progress', 'put', ...)` |
| `src/app/components/course/tabs/MaterialsTab.tsx` | Materials tab PDF tracking | Same as PdfContent |
| `tests/sync/p0-sync.spec.ts` | **New** end-to-end integration test | Create |

**Files NOT to touch (out of scope):**
- `src/lib/sync/syncableWrite.ts` — already implemented in E92-S04, consume as-is.
- `src/lib/sync/syncEngine.ts` — upload/download already handles the three P0 tables via `tableRegistry`.
- `src/lib/sync/tableRegistry.ts` — P0 entries already correct.
- `src/lib/sync/backfill.ts` — E92-S02; no changes.
- `src/app/hooks/useAuthLifecycle.ts` — E92-S08; no changes.
- Test seeders (`db.progress.put` / `db.studySessions.add` in test files are setup code, not production writes).

### syncableWrite API Contract (from E92-S04)

```typescript
syncableWrite<T extends SyncableRecord>(
  tableName: string,             // must be in tableRegistry
  operation: 'put' | 'add' | 'delete',
  record: T | string,            // string for delete (id); T for put/add
  options?: { skipQueue?: boolean }
): Promise<void>
```

Behaviour:
- Stamps `userId` + `updatedAt` on the record (even if null userId — unauthenticated writes still persist locally).
- Performs Dexie write; **rethrows** on failure (fatal; caller must handle).
- Enqueues `SyncQueueEntry` with `toSnakeCase(entry, record)` payload; swallows + logs on queue-insert failure (non-fatal).
- Calls `syncEngine.nudge()` to trigger debounced upload.
- `skipQueue: true` → Dexie write happens but no queue entry + no engine nudge (use for local-only updates).

### Study Session INSERT-only Semantics — Design Decision

`studySessions.conflictStrategy = 'insert-only'` with `insertOnly: true`. This means:
- **Local Dexie:** allows any number of `put` updates during the active session (Dexie doesn't enforce INSERT-only).
- **Supabase upload:** uses `INSERT ... ON CONFLICT DO NOTHING` — so only the first `add` lands in Postgres; subsequent updates to the same session id are discarded at the upload layer.

Consequence: if you enqueue the session at `startSession` time, the upload will race the user's activity — the session may upload with `duration = 0`. We want the **final, closed** session to upload.

**Chosen approach:** stamp the session locally at start (`syncableWrite(..., 'put', ..., { skipQueue: true })`) so `userId`/`updatedAt` are set consistently; enqueue the INSERT only at the terminal state (`endSession` → `syncableWrite('studySessions', 'add', closedSession)`).

Orphan recovery (`recoverOrphanedSessions`) enqueues the INSERT too because those sessions are already closed.

### Architecture Compliance

- **Design tokens:** no new UI in this story; no token work required.
- **No hardcoded colors / test patterns:** new Playwright spec must use `FIXED_DATE` and seeding helpers per `.claude/rules/testing/test-patterns.md`.
- **Silent-catch rule:** preserve the existing `// silent-catch-ok` comment in `PdfContent.tsx` and `MaterialsTab.tsx` (page save is non-critical; rule allows it).
- **Import alias:** use `@/lib/sync/syncableWrite`, never relative paths.

### Library / Framework Requirements

- **Dexie** — already in use; no version bump.
- **@supabase/supabase-js** — already in use for E92-S05/S06; the integration test uses this directly to assert Supabase-side state.
- **Playwright** — existing E2E framework; add new spec under `tests/sync/`.

### File Structure Requirements

New file:
```
tests/sync/
  └── p0-sync.spec.ts   (NEW)
```

Follow the directory convention if `tests/sync/` already has E92-S08 specs; otherwise create it fresh.

### Testing Requirements

- Unit tests: preserve existing coverage; prefer integration-style tests that exercise real `syncableWrite` (using fake-indexeddb) over mocking.
- E2E: new `p0-sync.spec.ts` exercises the full pipeline against a live Supabase test project.
- Burn-in: if any flaky patterns surface, run `scripts/burn-in.sh` on the new spec (10 iterations).

## Previous Story Intelligence

### From E92-S08 (Auth Lifecycle Integration)

- `syncEngine.start(userId)` / `syncEngine.stop()` wired into `useAuthLifecycle`.
- `LinkDataDialog` handles first-sign-in with pre-existing local data.
- `clearSyncState` resets `syncQueue` + `syncMetadata` cursors on sign-out.
- **S09 consumes these without modification.** The sync engine is already running when a signed-in user mutates a P0 store.

### From E92-S04 (syncableWrite)

- Unauthenticated writes persist locally without enqueuing — the S08 auth-lifecycle + S02 backfill handle catch-up on first sign-in. S09 inherits this.
- Queue insert failures are non-fatal + logged; S09 callers don't need to wrap in try/catch.
- Dexie write failures are fatal + rethrown; S09 callers must wrap in existing `persistWithRetry` / try-catch blocks (already present in both stores).

### From E92-S05 (Upload Phase)

- Verify `insertOnly` tables use `onConflict: 'id', ignoreDuplicates: true` (or equivalent) in the Supabase upsert call. If missing, this is an upstream bug to file against S05 — **not fix in S09**.
- Verify `monotonic` tables with `video_progress` specifically use the `upsert_video_progress()` RPC (not a plain `upsert`). Same: file upstream if missing.

### From E92-S06 (Download Phase)

- Download merges server records into Dexie respecting conflict strategy. Second-device E2E assertions in `p0-sync.spec.ts` rely on this.

## Git Intelligence

Recent commits:
- `2056841a feat(E92-S03): add sync table registry and field mapping` — tableRegistry entries already exist for P0 tables; do not modify.
- Pattern: epic E92 stories have been merged via PRs with the `feature/e92-s##-slug` branch naming (per `.claude/rules/workflows/story-workflow.md`).
- Branch naming for S09: `feature/e92-s09-wire-p0-stores-with-syncable-write`.

## Latest Tech Information

- **Dexie v4+** — `db.table(name).put(record)` is the idiomatic upsert; `syncableWrite` wraps this.
- **Supabase JS v2** — `upsert()` defaults to `onConflict: 'id'`; INSERT-only tables require `ignoreDuplicates: true`. The integration test should verify by attempting a duplicate insert + confirming no error (or RLS rejection, depending on E92-S05 implementation).

## Project Context Reference

See [CLAUDE.md](../../CLAUDE.md) for project-wide rules:
- Tailwind v4, design tokens, WCAG 2.1 AA+ (no UI changes in this story).
- Testing patterns: deterministic time, IndexedDB seeding helpers, Playwright context isolation.
- Worktree E2E warning: kill port 5173 before running `p0-sync.spec.ts` in a worktree.

## Story Completion Status

- [ ] All acceptance criteria met
- [ ] All tasks complete
- [ ] TypeScript + lint + build clean
- [ ] Unit + integration tests passing
- [ ] Two-device manual smoke test verified
- [ ] Code review passed
- [ ] PR merged

---

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
