---
title: "feat: E97-S04 New Device Download Experience"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e97-s04-new-device-download-requirements.md
---

# feat: E97-S04 New Device Download Experience

## Overview

When a returning Knowlune user signs in on a **new device** (empty local
Dexie, but Supabase has their data), the app currently renders empty states
while `hydrateP3P4FromSupabase` silently restores data in the background
AND the sync engine's download cursor trickles in content tables. Users
assume the app is broken. This plan adds a **download overlay** — the
symmetric counterpart to the E97-S03 Initial Upload Wizard — that
communicates "your data is being restored" for the duration of BOTH the
P3/P4 hydrate AND the first cursor pass of the sync engine (P0–P2 content
tables), auto-dismisses when both are complete, defers mount for fast
connections, and exposes a Retry affordance on error.

The engine is **not** changed. The overlay observes existing lifecycle
signals via a new lightweight status store (`useDownloadStatusStore`) that
`useAuthLifecycle` toggles around `hydrateP3P4FromSupabase(userId)` and a
purely observational watcher on `useSyncStatusStore` (existing engine
status) + `syncQueue` depth to detect the first-cursor-complete transition.
This mirrors the E97-S03 invariant "no engine primitive changes." No new
engine APIs — the overlay observes the ambient `'syncing' → 'synced'`
transition emitted by the existing `useSyncLifecycle`.

## Problem Frame

`useAuthLifecycle.handleSignIn` awaits `hydrateP3P4FromSupabase(userId)` on
`SIGNED_IN` / `INITIAL_SESSION`. On a new device, that call takes non-
trivial time (6 parallel Supabase queries + per-store `bulkPut`), during
which React routing has already navigated to Overview / Courses and
rendered empty states. The user sees a blank app with no signal that
hydration is in-flight. See origin: `docs/brainstorms/2026-04-19-e97-s04-
new-device-download-requirements.md`.

## Requirements Trace

- **R1 (AC1)** Overlay mounts on new-device sign-in when
  `shouldShowDownloadOverlay(userId)` returns true.
- **R2 (AC2)** Progress UI shows `processed/total` + percentage, updated
  via 500ms Dexie polling against a remote-count snapshot. Counts cover
  ALL synced tables (P0–P4, derived from `tableRegistry`, excluding
  `skipSync` and `uploadOnly` entries).
- **R3 (AC3)** Overlay auto-dismisses when BOTH phases complete:
  (a) `hydrateP3P4FromSupabase` resolves AND (b) the engine's first cursor
  pass completes (detected via `useSyncStatusStore.status` transitioning
  from `'syncing'` to `'synced'` for the first time AND `syncQueue`
  pending-depth reaching 0). `processed >= total` also satisfies the
  visual completion.
- **R4 (AC4)** A 2-second deferred mount suppresses the overlay when the
  entire restore sequence finishes fast.
- **R5 (AC5)** Error state with Retry + Close when the hydrator rejects,
  OR **all** Supabase HEAD count queries fail, OR the engine transitions
  to `'error'` before first-cursor-complete. Partial HEAD failures
  gracefully degrade (no numeric total); only *total* HEAD failure
  surfaces the error state.
- **R6 (AC6)** Overlay is never shown when local Dexie already has
  syncable rows for the user.

## Scope Boundaries

- Does NOT change `hydrateP3P4FromSupabase` contract (keep E96-S02
  invariants — `Promise.allSettled`, no `syncQueue` writes during hydrate).
- Does NOT block interaction beyond the overlay surface itself — the user
  can still Close from error state.
- Does NOT modify the sync engine download cursor's primitives.
- Does NOT cover Storage-bucket / file asset download progress.
- Never co-appears with `LinkDataDialog` or `InitialUploadWizard` — those
  imply local data exists, which short-circuits R6.

### Deferred to Separate Tasks

- Storage bucket (R2/PDF/audio asset) download progress — covered by
  E94-S05 "File Download New Device" plan already in `docs/plans/`.
- Adding a `firstCursorComplete` signal primitive to the sync engine —
  explicitly rejected. The engine stays untouched; S04 observes the
  existing `useSyncStatusStore.status` transition
  (`'syncing' → 'synced'`) AND `syncQueue` pending-depth reaching 0 on
  the first-ever sync cycle after sign-in. This is purely observational.

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useAuthLifecycle.ts` — `handleSignIn` lines 62–128.
  `await hydrateP3P4FromSupabase(userId)` at line 73 is the wrap point.
- `src/lib/sync/hydrateP3P4.ts` — 9-table parallel `Promise.allSettled`
  fan-out. Does not emit progress events today.
- `src/app/hooks/useInitialUploadProgress.ts` — snapshot-on-mount + 500ms
  poll pattern with `useRef` stability. Mirror this structure.
- `src/app/components/sync/InitialUploadWizard.tsx` — phase machine + non-
  dismissible-during-active-phase `Dialog`. Reuse `data-phase`,
  `aria-live="polite"`, `data-testid` conventions.
- `src/lib/sync/shouldShowInitialUploadWizard.ts` — localStorage-gated
  predicate. Adapt the inverse condition (empty-DB detection).
- `src/app/App.tsx` — existing mount pattern for `LinkDataDialog` and
  `InitialUploadWizard` via `evaluateWizard` callback + ref guard.
- `src/app/stores/useSyncStatusStore.ts` — existing status-store
  convention (`status`, `lastError`) to mirror for the new download store.
- `src/lib/sync/backfill.ts` — `SYNCABLE_TABLES` export (line 30) —
  source of truth for "which Dexie tables to count for emptiness check."
- `src/lib/sync/tableRegistry.ts` — `dexieTable` ↔ `supabaseTable` map
  for remote-count HEAD queries.

### Institutional Learnings

- **E97-S03 F2 race fix** — snapshot count must be captured BEFORE the
  async operation starts and stored in a ref; otherwise the first poll can
  read 0 and the completion transition never fires. Apply the same
  pattern to S04's remote-count snapshot.
- **E96-S02 echo-loop guard** — hydrators use `bulkPut`, not
  `syncableWrite`. The overlay must NOT introduce any `syncableWrite` or
  we break the zero-queue-write invariant on hydration.
- **Dexie 4 sortBy quirk** (reference memory) — `sortBy` returns
  `Promise<T[]>`. Our poll uses `count()` only, so unaffected.
- **ES2020 target** — no `Promise.any`. Use `Promise.allSettled` for
  HEAD-count fan-out.

### External References

None — entirely internal pattern reuse from E97-S03.

## Key Technical Decisions

- **New store `useDownloadStatusStore`** (vs. extending
  `useSyncStatusStore`): keeps the new-device lifecycle signal orthogonal
  to the ambient engine `idle | syncing | synced | error` state. Avoids
  conflating "first-time restore" with "steady-state sync tick." Mirrors
  the `useSyncStatusStore` API surface. Phase machine:
  `idle → hydrating-p3p4 → downloading-p0p2 → complete` (plus `error`
  as a lateral terminal from any active phase).
- **Two-phase observation**:
  - Phase A (`hydrating-p3p4`): wrap the existing
    `await hydrateP3P4FromSupabase(userId)` call in `useAuthLifecycle`
    via `observedHydrate`. On resolve, transition store to
    `downloading-p0p2`.
  - Phase B (`downloading-p0p2`): subscribe (read-only) to
    `useSyncStatusStore`. A `firstSyncedSeenRef` latches the first
    observed `'syncing' → 'synced'` transition after sign-in; when it
    fires AND `syncQueue` pending-depth is 0, transition store to
    `complete`. If the engine transitions to `'error'` before the
    latched-synced event, transition to `error`. This is purely
    observational — no engine API changes required.
- **Wrap hydrator at the call site**, not inside
  `hydrateP3P4FromSupabase`: preserves the hydrator's contract (resolves
  `undefined`, swallows errors). The wrap in `useAuthLifecycle` sets
  store state to `hydrating-p3p4` before the `await`, and
  `downloading-p0p2` / `error` after, based on `observedHydrate`.
- **Remote totals derived from `tableRegistry`**: at overlay mount, build
  the full table list by filtering `tableRegistry` for entries where
  `!skipSync && !uploadOnly` (the latter excludes `embeddings` — no
  download direction). This yields ~37 tables spanning P0–P4 (single
  source of truth, no arithmetic drift). Fire one HEAD request per table
  in parallel (`Promise.allSettled`, `count: 'exact', head: true`). See
  "Table list derivation" note below for the concrete list used at
  planning time.
- **Processed count derived from Dexie `table.count()`**, polled every
  500ms. Sum across the SAME filtered registry tables, filtered by
  `userId` where the Dexie row schema has a `userId` column. Hydrators
  use `bulkPut` (idempotent) and the engine uses upserts, so no
  undercount races.
- **HEAD failure accounting**: track outcomes in two refs —
  `totalsFailedCount` and `totalTables`. Rules (per R5):
  - `totalsFailedCount === totalTables` → ALL failed → store
    `status: 'error'`, `lastError: 'Could not determine remote totals — check your connection.'`, overlay shows Retry.
  - `0 < totalsFailedCount < totalTables` → PARTIAL — continue with the
    partial count sum + `console.warn` listing failed tables; overlay
    shows numeric progress against the successful totals.
  - `totalsFailedCount === 0` → happy path.
- **2s deferred mount** implemented via `setTimeout` in an effect that
  clears on unmount or completion. Matches R4 precisely — no flash.
- **Watchdog timeout of 60s** — if the download store is still in
  `hydrating-p3p4` or `downloading-p0p2` after 60s without resolution,
  force-transition to `error` with "Taking longer than expected."
  Prevents stuck overlays on silent hydrator hangs or wedged cursors.
- **Retry** calls `hydrateP3P4FromSupabase(userId)` directly and
  re-toggles store state to `hydrating-p3p4`; does NOT restart the sync
  engine (the engine's own retry/backoff handles content). Idempotent
  per E96-S02 (bulkPut + upsert-based).

### Table list derivation (source of truth)

Count queries and Dexie polling iterate the same derived list:

```ts
// Pseudo — computed at mount time from tableRegistry
const countedTables = tableRegistry.filter(
  (e) => !e.skipSync && !e.uploadOnly,
)
// At planning time this list contains (P0–P4):
//   P0: contentProgress, studySessions, progress
//   P1: notes, bookmarks, flashcards, reviewRecords,
//       bookHighlights, vocabularyItems, audioBookmarks, audioClips,
//       chatConversations, learnerModels
//       (embeddings excluded — uploadOnly)
//   P2: importedCourses, importedVideos, importedPdfs, authors,
//       books, bookReviews, shelves, bookShelves, readingQueue,
//       chapterMappings
//   P3: learningPaths, learningPathEntries, challenges,
//       courseReminders, notifications, careerPaths, pathEnrollments,
//       studySchedules, opdsCatalogs, audiobookshelfServers,
//       notificationPreferences
//   P4: quizzes, quizAttempts, aiUsageEvents
```

Using the registry as source-of-truth means new tables added in future
epics automatically flow into the overlay's counts without touching this
feature. Any table intentionally outside sync (`skipSync`) or
upload-only (`uploadOnly`) is excluded.

## Open Questions

### Resolved During Planning

- **Signal source:** new `useDownloadStatusStore` (decided above).
- **Total source:** Supabase HEAD count queries at overlay mount, parallel
  `Promise.allSettled` over `tableRegistry.filter(!skipSync && !uploadOnly)`,
  graceful degradation on *partial* failure, error surface on *total*
  failure (R5).
- **Co-existence with content sync (OQ3 resolution):** S04 observes BOTH
  `hydrateP3P4FromSupabase` AND the sync engine's first cursor pass via
  the existing `useSyncStatusStore` status transition + `syncQueue`
  pending depth. No engine API changes. The overlay stays visible across
  both phases; its phase machine is
  `idle → hydrating-p3p4 → downloading-p0p2 → complete`.
- **Reduced-motion:** no pulsing animations when `prefers-reduced-motion`
  is set; progress bar remains (it is informational, not decorative).

### Deferred to Implementation

- Exact Supabase JS call shape for HEAD counts — may require `.select('*',
  { count: 'exact', head: true })` or a `.count()` shim depending on the
  supabase-js version pinned. Verified at implementation time.
- Whether a 2-second delay or a 1.5-second delay gives the best UX — start
  at 2s per AC4, tune during design review.
- Exact copy for error states — draft in the code, finalized in design
  review.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for
> review, not implementation specification. The implementing agent should
> treat it as context, not code to reproduce.*

```text
SIGNED_IN event (useAuthLifecycle.handleSignIn)
  │
  ├─► hydrateSettingsFromSupabase (existing, unchanged)
  │
  ├─► observedHydrate(userId):
  │       useDownloadStatusStore.set({ status: 'hydrating-p3p4' })
  │       try { await hydrateP3P4FromSupabase(userId) }
  │       catch(e){ set({ status:'error', lastError:e.message }); throw }
  │       set({ status: 'downloading-p0p2' })  // hands off to engine phase
  │
  └─► [existing] backfill / syncEngine.start / LinkDataDialog path
        (engine start triggers the first cursor run, observed below)

useDownloadEngineWatcher (mounted by overlay or App.tsx):
  subscribe(useSyncStatusStore)
    on 'syncing'           → firstSyncingSeenRef = true
    on 'synced' (after 1st) → if syncQueue pending === 0
                                 → useDownloadStatusStore.set('complete')
    on 'error' (pre-synced) → useDownloadStatusStore.set('error')

App.tsx mount:
  useEffect(evaluateOverlay, [authUser, linkDialogUserId, ...])
    → shouldShowDownloadOverlay(userId)?
        ├── localHasData(userId) === true  → false (R6)
        ├── remoteHasData(userId) === false → false
        └── else → true  → setDownloadOverlayUserId(userId)

<NewDeviceDownloadOverlay open userId onClose>
  ├── 2s defer timer — if complete before fires, never mount visually
  ├── useDownloadProgress(userId, enabled) → { processed, total, done, err,
  │                                            totalsFailedCount, totalTables }
  ├── phase machine: hydrating-p3p4 | downloading-p0p2 → success | error
  └── status store subscription → drives phase transitions
```

State transitions:

```text
  idle ──signin──▶ hydrating-p3p4 ──resolve──▶ downloading-p0p2
                        │                               │
                        │                               ├──engine 'synced' + queue=0──▶ complete ──auto-close──▶ idle
                        │                               │
                        ├──reject──▶ error              ├──engine 'error'──▶ error
                        │                               │
                        │             ┌─────────────────┘
                        │             │
                        │             ▼
                        └─ all-HEAD-fail / 60s watchdog ─▶ error ──retry──▶ hydrating-p3p4
                                                              └──close──▶ idle
```

## Implementation Units

- [ ] **Unit 1: Download status store**

**Goal:** Introduce `useDownloadStatusStore` — a minimal Zustand store
mirroring `useSyncStatusStore`'s shape but scoped to the new-device
hydration lifecycle.

**Requirements:** R1, R3, R5

**Dependencies:** None

**Files:**
- Create: `src/app/stores/useDownloadStatusStore.ts`
- Test: `src/app/stores/__tests__/useDownloadStatusStore.test.ts`

**Approach:**
- State shape: `{ status: 'idle'|'hydrating-p3p4'|'downloading-p0p2'|'complete'|'error', lastError: string|null, startedAt: number|null }`.
- Actions:
  - `startHydrating()` — `idle → hydrating-p3p4` (sets `startedAt`).
  - `startDownloadingP0P2()` — `hydrating-p3p4 → downloading-p0p2`.
  - `completeDownloading()` — active phase → `complete`.
  - `failDownloading(msg)` — any phase → `error`.
  - `reset()` — any phase → `idle` (clears lastError).
- No persistence. Lives for the session; reset on sign-out.

**Patterns to follow:**
- `src/app/stores/useSyncStatusStore.ts` — identical Zustand style.

**Test scenarios:**
- Happy path: `startHydrating()` transitions `idle → hydrating-p3p4` and sets `startedAt`.
- Happy path: `startDownloadingP0P2()` transitions `hydrating-p3p4 → downloading-p0p2`.
- Happy path: `completeDownloading()` transitions `downloading-p0p2 → complete`.
- Happy path: direct fast-path `hydrating-p3p4 → complete` allowed (engine already synced before hand-off).
- Error path: `failDownloading('boom')` from `hydrating-p3p4` → `error` with `lastError='boom'`.
- Error path: `failDownloading('engine')` from `downloading-p0p2` → `error`.
- Edge case: `reset()` from any phase returns to `idle` with cleared error.

**Verification:**
- Unit tests pass.
- Store is consumable from React via `useDownloadStatusStore(s => s.status)`.

---

- [ ] **Unit 2: Detection predicate `shouldShowDownloadOverlay`**

**Goal:** Pure read-only predicate answering "should the new-device overlay
appear for this user?" Uses the inverse of the E97-S03 S03 trigger.

**Requirements:** R1, R6

**Dependencies:** Unit 1 (not strictly — can run in parallel)

**Files:**
- Create: `src/lib/sync/shouldShowDownloadOverlay.ts`
- Test: `src/lib/sync/__tests__/shouldShowDownloadOverlay.test.ts`

**Approach:**
- Signature: `async function shouldShowDownloadOverlay(userId: string): Promise<boolean>`.
- Step 1: `localHasData(userId)` — iterate `tableRegistry.filter(!skipSync && !uploadOnly)`, sum `db.table(entry.dexieTable).filter(r => r.userId === userId).count()` (or `.count()` for tables whose schema has no userId, scoped by auth). If > 0 → return `false` (R6).
- Step 2: `remoteHasAnyRows(userId)` — parallel `Promise.allSettled` HEAD count queries against the same filtered registry (Supabase-side). If any succeed with `count > 0` → return `true`. If all fail → return `false` (safe default — don't mount overlay on unknown state).
- Errors swallowed with `console.error`; predicate defaults to `false` on error.

**Patterns to follow:**
- `src/lib/sync/shouldShowInitialUploadWizard.ts` — same skeleton.
- `src/lib/sync/hydrateP3P4.ts` — same Supabase client access pattern.

**Test scenarios:**
- Happy path: empty local + non-empty remote → `true`.
- Happy path: populated local (any syncable table) → `false` (R6 short-circuit, no remote query made).
- Happy path: empty local + empty remote → `false`.
- Edge case: `userId` empty → `false`.
- Error path: Dexie `count()` throws on one table → other tables still counted; predicate doesn't crash.
- Error path: all Supabase HEAD queries fail → `false` (safe default).
- Integration: predicate does not write to `syncQueue` (echo-loop guard).

**Verification:**
- Unit tests cover the full truth table.
- No `syncQueue` rows inserted during predicate evaluation (spy assertion).

---

- [ ] **Unit 3: `observedHydrate` wrapper + auth lifecycle wiring**

**Goal:** Wrap the existing `await hydrateP3P4FromSupabase(userId)` call in
`useAuthLifecycle.handleSignIn` so the download store observes the
lifecycle. No change to hydrator internals.

**Requirements:** R1, R3, R5

**Dependencies:** Unit 1

**Files:**
- Create: `src/lib/sync/observedHydrate.ts`
- Modify: `src/app/hooks/useAuthLifecycle.ts`
- Test: `src/lib/sync/__tests__/observedHydrate.test.ts`
- Test: `src/app/hooks/__tests__/useAuthLifecycle.download.test.ts` (new scenarios — do not duplicate the existing test file)

**Approach:**
- `observedHydrate(userId)` calls `useDownloadStatusStore.getState().startHydrating()`, then `await hydrateP3P4FromSupabase(userId)`, then `startDownloadingP0P2()` (hands off to the engine-watcher phase; does NOT emit `complete` yet — that transition is owned by Unit 4a). On throw, call `failDownloading(err.message)` and re-throw.
- `useAuthLifecycle.handleSignIn` replaces the existing `await hydrateP3P4FromSupabase(userId).catch(...)` with `await observedHydrate(userId).catch(...)`. Existing error log preserved.
- Sign-out handler (`SIGNED_OUT` branch) calls `useDownloadStatusStore.getState().reset()` alongside the existing cleanup.

**Patterns to follow:**
- `src/app/hooks/useAuthLifecycle.ts` — error-logging convention.

**Test scenarios:**
- Happy path: `observedHydrate` resolves → store goes `hydrating-p3p4 → downloading-p0p2` (NOT `complete` — that transition is owned by Unit 4a).
- Error path: hydrator rejects → store goes `hydrating-p3p4 → error` with message; wrapper re-throws so caller's existing `.catch` still logs.
- Integration: `handleSignIn` invokes `observedHydrate` once per sign-in (not double-fired by `onAuthStateChange` + `getSession` safety net — use the existing `ignore` flag).
- Integration: `SIGNED_OUT` resets the store to `idle`.

**Verification:**
- Existing auth-lifecycle tests still pass (no regression).
- New tests assert store transitions in both success and failure paths.

---

- [ ] **Unit 4: `useDownloadProgress` hook**

**Goal:** Snapshot remote totals at mount time for ALL synced tables
(P0–P4 from `tableRegistry`), poll Dexie table counts every 500ms, derive
`{ processed, total, done, error, recentTable, totalsFailedCount, totalTables }`.

**Requirements:** R2, R5

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/hooks/useDownloadProgress.ts`
- Test: `src/app/hooks/__tests__/useDownloadProgress.test.ts`

**Approach:**
- Signature: `useDownloadProgress(userId: string, enabled: boolean): DownloadProgress`.
- Derive `countedTables = tableRegistry.filter(e => !e.skipSync && !e.uploadOnly)` at hook entry. `totalTables = countedTables.length`.
- On first run with `enabled`: parallel Supabase HEAD counts for all `countedTables`; for each `Promise.allSettled` result: if fulfilled, add to `totalRef.current`; if rejected, increment `totalsFailedCountRef.current` and `console.warn('[useDownloadProgress] HEAD failed for', entry.supabaseTable, err)`.
- HEAD failure policy (R5):
  - If `totalsFailedCount === totalTables` (ALL failed) → set state `error: true`, `errorMessage: 'Could not determine remote totals — check your connection.'`, `total = 0`. Downstream component surfaces Retry.
  - If `0 < totalsFailedCount < totalTables` (PARTIAL) → continue with partial totals; expose counts via state so the component can render numeric progress against the partial baseline. Log once with the list of failed tables.
  - If `totalsFailedCount === 0` → happy path.
- Poll every 500ms: sum Dexie `table.count()` across `countedTables` (filtered by `userId` when the row schema has `userId`). Set `processed` (clamped 0..total), `done = (store.status === 'complete') || (processed >= total && total > 0 && totalsFailedCount === 0)`.
- `recentTable` — the table whose count changed most recently (cosmetic — track per-tick deltas).
- Cleanup: clear interval on unmount or when `enabled` flips to `false`.

**Execution note:** Write the poll-stability and completion-transition tests first — the E97-S03 F2 race bug was caught by exactly this kind of test.

**Patterns to follow:**
- `src/app/hooks/useInitialUploadProgress.ts` — snapshot-then-poll with `useRef` stability; `cancelled` flag on unmount.

**Test scenarios:**
- Happy path: snapshot total captured on first effect run across ALL registry tables; subsequent ticks read `totalRef.current`, not re-query remote.
- Happy path: polling advances `processed` as Dexie tables fill (simulated via fake-timer + controlled Dexie stub).
- Happy path: `done` flips true when `processed >= total` AND store status is `complete`.
- Edge case: `enabled=false` → no interval, no HEAD queries, hook returns idle defaults.
- Error path (R5 — ALL HEAD fail): all HEAD queries reject → `total=0`, `error=true`, `errorMessage` set; hook reports `totalsFailedCount === totalTables`. Component should surface Retry (asserted in Unit 5).
- Error path (R5 — PARTIAL HEAD fail): half of HEAD queries reject → `error` stays `false` (graceful degrade), `totalsFailedCount > 0 && < totalTables`, numeric progress continues against the partial baseline, single `console.warn` emitted listing failed tables.
- Edge case: `userId=''` → no-op.
- Error path (Dexie): one Dexie `count()` throws per tick → other tables still counted; error surfaced via per-tick warning; next tick retries.
- Integration: unmount during poll does not leak the interval (assert `clearInterval` called).
- Integration: the derived `countedTables` list matches `tableRegistry.filter(!skipSync && !uploadOnly)` (snapshot test locks future-proofing).

**Verification:**
- Fake-timer tests pass deterministically over 20 iterations (no flake).
- ALL-fail vs PARTIAL-fail branches covered by distinct tests per R5.

---

- [ ] **Unit 4a: `useDownloadEngineWatcher` hook** (new)

**Goal:** Observational bridge from the existing `useSyncStatusStore` +
`syncQueue` depth to `useDownloadStatusStore`. Detects the first-cursor-
complete transition during Phase B (`downloading-p0p2`) and advances the
download store to `complete` (or `error` if the engine fails pre-synced).

**Requirements:** R3, R5 (engine-error branch)

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/hooks/useDownloadEngineWatcher.ts`
- Test: `src/app/hooks/__tests__/useDownloadEngineWatcher.test.ts`

**Approach:**
- Signature: `useDownloadEngineWatcher(userId: string, enabled: boolean): void`. Subscribes to `useSyncStatusStore` only while `enabled` and `useDownloadStatusStore.status === 'downloading-p0p2'`.
- Refs: `firstSyncingSeenRef` (boolean), `unsubscribeRef`.
- Logic:
  - Subscribe to `useSyncStatusStore`. On status change:
    - `'syncing'` → set `firstSyncingSeenRef.current = true`.
    - `'synced'` → if `firstSyncingSeenRef.current === true`, query `db.syncQueue.where('status').equals('pending').count()`; if 0, call `useDownloadStatusStore.getState().completeDownloading()`. (Non-zero pending indicates steady-state sync still draining writes — defer to next tick.)
    - `'error'` → if download store still in `downloading-p0p2`, call `failDownloading(syncStatusStore.lastError ?? 'Sync failed during first cursor pass')`.
    - `'offline'` → no-op (watchdog handles stuck state).
  - Cleanup: unsubscribe on disable / unmount.
- The watcher is passive — it never writes to the engine or queue.
- It is safe to run multiple watchers (they all converge on the same store state) but the component mounts only one.

**Patterns to follow:**
- `src/app/hooks/useSyncLifecycle.ts` — Zustand subscribe + unsubscribe pattern.

**Test scenarios:**
- Happy path: store enters `downloading-p0p2`; sync status goes `'syncing' → 'synced'` with queue=0 → download store transitions to `complete`.
- Happy path (pre-latch): `'synced'` observed BEFORE any `'syncing'` → no-op (guard against stale initial state).
- Edge case: `'synced'` with pending queue > 0 → stays `downloading-p0p2`; next `'synced'` with queue=0 advances.
- Error path: sync status goes `'syncing' → 'error'` → download store transitions to `error` with engine's `lastError`.
- Edge case: watcher disabled while store is `hydrating-p3p4` (engine phase hasn't started) → never subscribes until Phase B begins.
- Edge case: sign-out → download store resets to `idle`, watcher unsubscribes, no leaks.

**Verification:**
- Unit tests pass; no engine primitive calls made (spy assertion — read-only subscriptions only).

---

- [ ] **Unit 5: `NewDeviceDownloadOverlay` component**

**Goal:** Render the overlay modal with phase machine, progress bar, Retry,
Close. Non-dismissible during active download.

**Requirements:** R1, R2, R3, R5

**Dependencies:** Units 1, 4

**Files:**
- Create: `src/app/components/sync/NewDeviceDownloadOverlay.tsx`
- Test: `src/app/components/sync/__tests__/NewDeviceDownloadOverlay.test.tsx`

**Approach:**
- Props: `{ open: boolean; userId: string; onClose: () => void }`.
- Phase state (component-local, mirrors store): `'hydrating-p3p4' | 'downloading-p0p2' | 'success' | 'error'`.
- Mount `useDownloadEngineWatcher(userId, open)` (Unit 4a) inside the overlay so Phase B observation is scoped to the overlay's lifetime.
- Effects:
  - Subscribe to `useDownloadStatusStore`:
    - `hydrating-p3p4` → render Phase A copy.
    - `downloading-p0p2` → render Phase B copy.
    - `complete` AND `progress.done` → `success`, then `onClose()` after 250ms.
    - `error` → `error`.
  - Also subscribe to `useDownloadProgress(userId, open)`; if its `error === true` AND `totalsFailedCount === totalTables` (ALL HEAD failed — see Unit 4), force local phase to `error` with `errorMessage: 'Could not determine remote totals — check your connection.'` AND call `useDownloadStatusStore.getState().failDownloading(...)` so Phase A/B watchers halt.
  - 60s watchdog: if phase stays in any active phase (`hydrating-p3p4` OR `downloading-p0p2`) for 60s, force-transition to `error` with copy "Taking longer than expected."
- UI:
  - `<Dialog>` with `data-testid="new-device-download-overlay"`, `data-phase={phase}`.
  - Prevent radix auto-close while phase is active (`hydrating-p3p4` | `downloading-p0p2`) (mirror S03).
  - Progress bar `<Progress value={percent}>`, `aria-live="polite"` on `"Restoring X of Y"` text. When `totalsFailedCount > 0 && < totalTables`, append a subtle `"(partial counts)"` suffix so users know the number may be under-counted.
  - Error phase: Retry button + Close.
    - Retry on HEAD-failure error → re-runs overlay-mount HEAD fetch (re-invokes the progress hook by toggling a retry-nonce) AND re-invokes `observedHydrate(userId)`; store goes back to `hydrating-p3p4`.
    - Retry on hydrator error → same helper (idempotent per E96-S02).
    - Retry on engine error → store goes back to `hydrating-p3p4`; the subsequent engine sync-lifecycle tick will re-run the cursor pass (no explicit engine call).
- Copy-tone:
  - Phase A: "Restoring your Knowlune library…"
  - Phase B: "Finishing sync — fetching your content…"
  - Error (HEAD-all-fail): "Could not determine remote totals — check your connection."
  - Error (watchdog): "Taking longer than expected."
- `prefers-reduced-motion` guard: no pulsing icon animation; static icon.

**Patterns to follow:**
- `src/app/components/sync/InitialUploadWizard.tsx` — phase machine, non-dismissible pattern, `data-phase`, `aria-live`, `data-testid` conventions.
- `src/styles/theme.css` tokens — `bg-brand-soft`, `text-brand-soft-foreground`, `text-destructive`, etc. No hardcoded colors.

**Test scenarios:**
- Happy path (Phase A): mount with store `hydrating-p3p4` → renders `data-phase="hydrating-p3p4"` with Phase A copy.
- Happy path (Phase B): store advances to `downloading-p0p2` → renders `data-phase="downloading-p0p2"` with Phase B copy.
- Happy path (success): store reaches `complete` AND `progress.done` → phase flips to `success`, `onClose` called after 250ms delay.
- Happy path: Retry button re-invokes `observedHydrate` AND resets totals; store goes back to `hydrating-p3p4`.
- Edge case: `open=false` → renders nothing AND `useDownloadEngineWatcher` does not subscribe (no leak).
- Edge case: `prefers-reduced-motion` active → no animated pulse class on the icon.
- Error path (R5 — hydrator): store goes to `error` during `hydrating-p3p4` → phase `error`, error message shown, Retry + Close visible.
- Error path (R5 — ALL HEAD fail): `useDownloadProgress` reports `totalsFailedCount === totalTables` → phase forced to `error`, copy "Could not determine remote totals — check your connection.", Retry visible.
- Graceful degrade (R5 — PARTIAL HEAD fail): `0 < totalsFailedCount < totalTables` → phase stays in `downloading-p0p2` (or `hydrating-p3p4`), progress text appends `(partial counts)`, NO error UI.
- Error path (R5 — engine): store goes to `error` during `downloading-p0p2` (engine transitioned to `'error'`) → phase `error`, Retry kicks off from `hydrating-p3p4`.
- Error path: 60s watchdog fires from `hydrating-p3p4` → phase forced to `error` with "Taking longer" copy.
- Error path: 60s watchdog fires from `downloading-p0p2` → phase forced to `error` with "Taking longer" copy.
- Integration: radix `onOpenChange(false)` during active phases does NOT call `onClose` (non-dismissible).
- Integration: design-token lint passes (no hardcoded Tailwind colors).

**Verification:**
- Component tests pass; snapshot for each phase stable; no a11y violations in jest-axe check.

---

- [ ] **Unit 6: App.tsx mount wiring + 2s defer**

**Goal:** Mount `NewDeviceDownloadOverlay` alongside `InitialUploadWizard` /
`LinkDataDialog` in `App.tsx`, gated by `shouldShowDownloadOverlay` and a
2s deferred mount per R4.

**Requirements:** R1, R4, R6

**Dependencies:** Units 2, 5 (Unit 4a is pulled in transitively by Unit 5)

**Files:**
- Modify: `src/app/App.tsx`
- Test: `src/app/__tests__/App.downloadOverlay.test.tsx`

**Approach:**
- Add state `const [downloadOverlayUserId, setDownloadOverlayUserId] = useState<string | null>(null)` and `evaluationInFlightRef` analogous to the wizard eval.
- On `authUser` change (and not while `linkDialogUserId` is set, and not while `uploadWizardUserId` is set — mutually exclusive), call `evaluateDownloadOverlay(userId)` which runs `shouldShowDownloadOverlay(userId)` and sets state.
- **2s defer:** when `evaluateDownloadOverlay` resolves `true`, start a `setTimeout(..., 2000)` that flips a `deferredReadyRef` and forces a re-render via state. If `useDownloadStatusStore.status === 'complete'` before the timeout fires, clear the timeout and never mount (R4). NOTE: because the overlay now observes BOTH Phase A and Phase B, the defer-resolve check subscribes to the store's `complete` state, which only fires after the engine's first cursor pass AND hydrate both complete — so the 2s fast-path is genuinely end-to-end, not just hydrate-done.
- Mount: `{downloadOverlayUserId && deferredReady && <NewDeviceDownloadOverlay open userId={downloadOverlayUserId} onClose={() => setDownloadOverlayUserId(null)} />}`.
- Sign-out: reset `downloadOverlayUserId`, `deferredReadyRef`, and the download store.

**Patterns to follow:**
- `src/app/App.tsx` — existing `evaluateWizard` / `handleLinkDialogResolved` pattern; `evaluationInFlightRef` double-mount guard.

**Test scenarios:**
- Happy path (new device): `authUser` arrives, predicate returns `true`, 2s passes, overlay mounts in `hydrating-p3p4`.
- Happy path (fast hydration + fast cursor): predicate returns `true`, hydrate resolves and engine `'syncing' → 'synced'` both within 1.5s, overlay never mounts visually.
- Happy path (slow cursor): predicate returns `true`, hydrate resolves in 1s but engine first cursor takes 5s → overlay mounts at 2s in `downloading-p0p2`, dismisses when engine completes.
- Happy path (existing device): predicate returns `false` → overlay never evaluated for mount.
- Edge case: `LinkDataDialog` open → download overlay evaluation deferred until link dialog resolves.
- Edge case: `InitialUploadWizard` active → download overlay not shown (mutually exclusive by construction — S03 implies local data exists).
- Error path: `shouldShowDownloadOverlay` throws → overlay not mounted; error logged.
- Integration: sign-out clears overlay state and resets download store.

**Verification:**
- App-level integration test asserts the mutual-exclusivity and defer-timer invariants.
- No regression in existing S03 wizard behavior (existing tests green).

---

- [ ] **Unit 7: E2E tests — new-device simulation**

**Goal:** End-to-end Playwright coverage of the three paths (happy /
fast-path / error) using a new-device test fixture.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** Units 1–6

**Files:**
- Create: `tests/e2e/sync/new-device-download-overlay.spec.ts`
- Create/extend: `tests/e2e/fixtures/newDeviceFixture.ts` (helper to seed Supabase rows + wipe Dexie)

**Approach:**
- Fixture: sign in as a seeded test user whose Supabase tables contain known rows across P0–P4 (notes, books, flashcards, learningPaths, etc.); wipe the browser's IndexedDB before the test.
- Test 1 (happy — two-phase): load app, assert `[data-testid="new-device-download-overlay"][data-phase="hydrating-p3p4"]` appears within 3s, then observe transition to `data-phase="downloading-p0p2"`, then dismiss; Overview page shows restored P3/P4 AND content-table (notes/books) rows.
- Test 2 (fast-path): seed a single row per table so hydrate+cursor complete in ~1s, assert overlay never appears (use `page.locator(...).waitFor({ state: 'visible', timeout: 2500 })` with `toBeHidden` assertion via race).
- Test 3 (error — hydrator): intercept Supabase REST calls to the P3/P4 tables and return 500s; assert overlay transitions to `data-phase="error"` via hydrator rejection; remove interception and click Retry; assert success transition.
- Test 3b (error — ALL HEAD fail, R5): intercept ALL HEAD requests (`count=exact&head=true`) across ALL tables with 500; assert overlay transitions to `data-phase="error"` with copy matching "Could not determine remote totals — check your connection."; Retry button visible.
- Test 3c (graceful degrade — PARTIAL HEAD fail): intercept HEAD requests for HALF of tables; assert overlay stays in an active phase, shows numeric progress with the "(partial counts)" suffix, and dismisses normally on completion.
- Test 3d (error — engine): allow hydrate to succeed, then fail the sync engine's first cursor fetch; assert phase transitions to `data-phase="error"`; Retry restarts both phases.
- Test 4 (existing-device): seed Dexie directly with any content-table row (e.g., a single note), then sign in; assert overlay never mounts (R6).

**Execution note:** Use fake-time deterministic patterns from `.claude/rules/testing/test-patterns.md`. Burn-in: 10 iterations, no flake.

**Patterns to follow:**
- `tests/e2e/sync/initial-upload-wizard.spec.ts` (E97-S03) — closest precedent for overlay assertions.

**Test scenarios:** (captured inline above)

**Verification:**
- All 4 specs pass on Chromium; burn-in script (10 iterations) green.

## System-Wide Impact

- **Interaction graph:** `useAuthLifecycle` (observedHydrate wrap), `App.tsx` (mount), `useSyncStatusStore` (read-only subscription via Unit 4a — no writes), `syncEngine.start()` (untouched — not called, not wrapped), `db.syncQueue` (read-only `.count()` probe at `'synced'` transitions).
- **Error propagation:** hydrator errors continue to log via existing `console.error` and are additionally surfaced via `useDownloadStatusStore.lastError`. Engine errors observed during Phase B surface via the same `lastError` channel, sourced from `useSyncStatusStore.lastError`. ALL-HEAD-failure errors (R5) are synthesized client-side with a user-facing message. No change to upstream caller contracts.
- **State lifecycle risks:** Sign-out must reset `useDownloadStatusStore` to avoid stale state appearing on a subsequent sign-in for a different user. Handled in Unit 3.
- **API surface parity:** None — no public API changes. New store is internal.
- **Integration coverage:** Unit 6 (App-level) and Unit 7 (E2E) cover cross-layer interactions. Unit 4 uses fake-timers for the poll loop.
- **Unchanged invariants:**
  - `hydrateP3P4FromSupabase` contract unchanged (still resolves `undefined`, still `Promise.allSettled`, still uses `bulkPut` with no `syncQueue` writes).
  - S03 wizard behavior unchanged — new overlay is mutually exclusive by construction.
  - `syncEngine` public API unchanged.
  - Echo-loop guard preserved — no `syncableWrite` calls introduced on the download path.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Overlay flashes for fast hydration | R4 2s defer + watchdog-cleared timer; defer now spans BOTH phases |
| Stuck overlay on silent hydrator hang | 60s watchdog forces error phase (Unit 5) — covers Phase A |
| Stuck overlay on silent engine wedge (Phase B) | Same 60s watchdog also covers `downloading-p0p2`; Retry resets to `hydrating-p3p4` |
| Remote HEAD count queries slow → overlay appears with `total=0` | Graceful degrade on PARTIAL; error surface + Retry on ALL-fail (R5) |
| False `complete` from a pre-signin `'synced'` state | `firstSyncingSeenRef` latch in Unit 4a — require observed `'syncing'` first |
| Steady-state sync tick misread as first-cursor-complete | Unit 4a requires `syncQueue` pending=0 at the moment of `'synced'` transition |
| Engine transitions to `'offline'` mid-cursor | Watcher treats `'offline'` as no-op (not error); watchdog still arms |
| Double-mount between `onAuthStateChange` and `getSession` safety net | Reuse `evaluationInFlightRef` pattern from existing App.tsx wizard flow |
| Co-appearance with `LinkDataDialog` / `InitialUploadWizard` | Predicate short-circuits on local data (R6); App.tsx gates on dialog/wizard state |
| Reset on sign-out missed → stale store on next sign-in for different user | Unit 3 wires `reset()` into `SIGNED_OUT` branch + test asserts |
| ESLint `design-tokens/no-hardcoded-colors` violations in new component | Explicit pattern in Unit 5; lint auto-runs at save-time |
| Table-registry drift (new table added, not counted) | Unit 4 derives list from `tableRegistry.filter(!skipSync && !uploadOnly)`; snapshot test asserts derivation |
| E2E flake from 500ms polling + 2s defer + two-phase transitions | Fake-timer patterns + burn-in script (10 iterations required); separate timers per phase |

## Documentation / Operational Notes

- Update `docs/implementation-artifacts/sprint-status.yaml` E97-S04 entry once shipped.
- Add a one-liner to `docs/engineering-patterns.md` under sync UX: "New-device download overlay = symmetric counterpart to S03 upload wizard; share snapshot-poll pattern."
- No rollout/monitoring impact — client-only UI.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-19-e97-s04-new-device-download-requirements.md`
- **Story file:** `docs/implementation-artifacts/stories/E97-S04-new-device-download-experience.md`
- **Precedent plan:** `docs/plans/2026-04-19-024-feat-e97-s03-initial-upload-wizard-plan.md`
- **Engine reference:** `src/app/hooks/useAuthLifecycle.ts`, `src/lib/sync/hydrateP3P4.ts`
- **Pattern references:** `src/app/hooks/useInitialUploadProgress.ts`, `src/app/components/sync/InitialUploadWizard.tsx`, `src/lib/sync/shouldShowInitialUploadWizard.ts`, `src/app/stores/useSyncStatusStore.ts`
