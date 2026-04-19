---
title: "feat: E92-S07 Sync Triggers and Offline Handling"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e92-s07-sync-triggers-requirements.md
---

# feat: E92-S07 Sync Triggers and Offline Handling

## Overview

Wire all events that cause the sync engine to run and ensure graceful offline behaviour. The sync engine (`syncEngine.ts`) is fully implemented from E92-S05/S06 but has no callers — data sits in Dexie and never reaches Supabase until something triggers it. This plan adds the event-driven trigger layer: a React hook (`useSyncLifecycle`) that fires on app open, every 30 seconds, on tab focus, and on network reconnection; a Zustand status store (`useSyncStatusStore`) that E97 will consume for UI display; and P0 store refresh registrations so Zustand state reflects downloaded data.

## Problem Frame

`syncEngine.fullSync()`, `syncEngine.nudge()`, and `syncEngine.registerStoreRefresh()` are implemented but never called in production. Without the trigger layer, the upload queue never drains and downloaded records from Supabase never refresh Zustand state. The `useAuthLifecycle` hook already handles session events; `useSyncLifecycle` handles network and lifecycle events. These are orthogonal concerns.

## Requirements Trace

- R1. `syncEngine.fullSync()` called on mount
- R2. `setInterval(30s)` calls `syncEngine.nudge()` when `navigator.onLine`; cleared on unmount
- R3. `visibilitychange` → visible triggers `syncEngine.nudge()` when online; listener removed on unmount
- R4. `offline` event → `useSyncStatusStore.status = 'offline'`; no errors thrown
- R5. `online` event → `syncEngine.fullSync()` fires immediately
- R6. `beforeunload` → `navigator.sendBeacon` called when available and payload < 64 KB
- R7. `useSyncStatusStore.pendingCount` reflects db.syncQueue pending count
- R8. `useSyncStatusStore.status` transitions: offline/syncing/synced/error
- R9. `useSyncLifecycle()` called from `App.tsx` root component
- R10. Store refresh callbacks registered before first `fullSync()` call
- R11. TypeScript compiles clean
- R12. Unit tests pass for all trigger paths and cleanup

## Scope Boundaries

- Does NOT call `syncEngine.start()` or `syncEngine.stop()` — those are E92-S08 (auth lifecycle)
- Does NOT modify `syncEngine.ts` — it is complete from S05/S06
- Does NOT implement `SyncStatusIndicator` or `SyncSettingsPanel` UI — E97-S01/S02
- Does NOT register P1–P4 store refresh callbacks — each wiring story (E93–E96) registers its own
- `/api/sync-beacon` endpoint does not exist and is not created here — beacon call silently fails

### Deferred to Separate Tasks

- Auth-driven `start(userId)` / `stop()` calls: E92-S08
- `LinkDataDialog` / `backfillUserId()`: E92-S08
- P1–P4 store refresh registrations: E93-E96 wiring stories
- `SyncStatusIndicator` cloud icon in header: E97-S01
- `SyncSettingsPanel` toggle + last-sync time display: E97-S02

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — public API: `nudge()`, `fullSync()`, `start()`, `stop()`, `registerStoreRefresh()`. Engine defaults `_started = true` so `nudge()` works before `start()` is called.
- `src/app/hooks/useAuthLifecycle.ts` — canonical pattern for App-level lifecycle hooks: single `useEffect([], [])`, `let ignore = false`, cleanup function, import path `@/app/hooks/`.
- `src/app/hooks/useOnlineStatus.ts` — canonical pattern for `window.addEventListener('online'/'offline', ...)` with cleanup.
- `src/app/hooks/useIdleDetection.ts` + `src/app/hooks/__tests__/useIdleDetection.test.ts` — canonical pattern for hooks with fake timers, `vi.useFakeTimers()`, `vi.advanceTimersByTime()`, `vi.useRealTimers()` in afterEach.
- `src/stores/useNotificationPrefsStore.ts` — canonical Zustand store with `create<State>()`, async action (`init()`), accessed via `.getState()` outside React.
- `src/stores/useContentProgressStore.ts` — `loadCourseProgress(courseId: string)` requires a courseId argument; no global `loadAll()` exists.
- `src/stores/useSessionStore.ts` — `loadSessionStats(courseId?: string)` accepts optional courseId; calling without argument loads stats for all courses.
- `src/app/App.tsx` — `useAuthLifecycle()` called at line ~68; `useSyncLifecycle()` goes directly after, same import pattern.

### Institutional Learnings

- `docs/engineering-patterns.md`: Use `// Intentional: <reason>` at non-obvious code sites (async guards, silent-fail patterns). Required for `sendBeacon` silent fail, `_started` default guard, online guard.
- `docs/engineering-patterns.md`: `useEffect` cleanup must return a function that removes ALL listeners and clears ALL timers — omitting any one causes memory leaks that are hard to trace.
- `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md`: Not directly applicable (this is infrastructure, not UI) but confirms the convention of keeping module-specific utilities co-located.
- `useAuthLifecycle.test.ts` pattern: mocks declared before imports via `vi.mock()` hoisting; `renderHook` from `@testing-library/react`; cleanup via `vi.restoreAllMocks()` in `afterEach`.

### External References

- None required — local patterns are well-established for all patterns in this plan.

## Key Technical Decisions

- **`useSyncStatusStore` lives in `src/app/stores/`** — not `src/stores/` (the main store directory). Rationale: the spec explicitly places it there; it is sync-infrastructure state consumed by UI panels, not domain data. This co-locates it with any future sync-adjacent stores.
- **Offline is handled via `navigator.onLine` guard in handlers, not `syncEngine.stop()`** — rationale: `start()`/`stop()` are auth-lifecycle concerns (E92-S08). Guards in the timer and visibilitychange handlers prevent nudge calls when offline without coupling this hook to auth state. The `offline` event only updates `useSyncStatusStore.status`.
- **`contentProgress` store refresh is skipped** — `loadCourseProgress(courseId)` requires a courseId argument and has no `loadAll()` variant. Registering a no-arg wrapper that calls with an empty string would be incorrect. Only `studySessions` (which accepts optional courseId) is registered. The `contentProgress` table will still be written to Dexie correctly on download — the store just won't auto-refresh until navigating to a course page. This is acceptable in S07; a global `loadAll()` can be added to `useContentProgressStore` in a later story if needed.
- **`sendBeacon` silently fails** — the `/api/sync-beacon` endpoint does not exist. The `beforeunload` handler calls `navigator.sendBeacon` knowing it will fail. Add `// Intentional: beacon endpoint is future work` comment. The benefit of the pattern (flushing on unload) is preserved structurally for when the endpoint is implemented.
- **Store refresh registrations happen inside the `useEffect` before `fullSync()`** — placing registrations before the initial `fullSync()` call ensures the download phase on mount will notify stores. If registered after, the first download would write to Dexie but not refresh Zustand.

## Open Questions

### Resolved During Planning

- **Can `loadSessionStats()` be called without a courseId?** Yes — the signature is `loadSessionStats(courseId?: string)`. Calling with no argument is valid and loads all sessions.
- **Should `contentProgress` get a store refresh registration?** No — `loadCourseProgress(courseId: string)` requires a mandatory argument. Skip this registration with a comment explaining why.
- **Does the engine need to be paused when offline?** No — `nudge()` checks `_started` internally. Guards on `navigator.onLine` in the timer/visibility handlers are sufficient. No direct engine mutation needed.
- **Which directory for `useSyncStatusStore`?** `src/app/stores/` per the story spec (not `src/stores/`).

### Deferred to Implementation

- Exact Dexie query timing for dead-letter detection: if implementer wants to set `'error'` status only when dead-letter entries exist (not on every thrown exception), they can query `db.syncQueue.where('status').equals('dead-letter').count()` after `fullSync()` resolves. This is additive and deferred if it adds complexity — the catch handler setting `'error'` on exception is sufficient for S07.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
App mount
  │
  ├─ useSyncLifecycle() [new hook, called in App.tsx]
  │    │
  │    ├─ registerStoreRefresh('studySessions', loadSessionStats)
  │    ├─ fullSync() → upload + download all P0 tables
  │    │
  │    ├─ setInterval(30s) ──→ nudge() [if navigator.onLine]
  │    │
  │    ├─ visibilitychange ──→ nudge() [if visible + navigator.onLine]
  │    │
  │    ├─ window 'online'  ──→ setStatus('synced') + fullSync()
  │    ├─ window 'offline' ──→ setStatus('offline')
  │    │
  │    └─ beforeunload ────→ sendBeacon (if available + payload < 64KB)
  │
  └─ useSyncStatusStore [new Zustand store]
       status: 'synced' | 'syncing' | 'offline' | 'error'
       pendingCount: number
       lastSyncAt: Date | null
```

## Implementation Units

- [ ] **Unit 1: `useSyncStatusStore` — Zustand sync status store**

**Goal:** Create the Zustand store that exposes sync state to the rest of the app. E97-S01/S02 will consume this directly — the shape must match the spec exactly.

**Requirements:** R7, R8

**Dependencies:** None

**Files:**
- Create: `src/app/stores/useSyncStatusStore.ts`

**Approach:**
- `create<SyncStatusState>()` with `devtools` wrapper optional — do NOT add persist (status is ephemeral session state, not persisted)
- Initial state: `{ status: 'synced', pendingCount: 0, lastSyncAt: null }`
- `refreshPendingCount()` queries `db.syncQueue.where('status').equals('pending').count()` — this is the only Dexie import in this store
- `setStatus()` is a simple setter — no side effects
- `markSyncComplete()` sets `status = 'synced'` and `lastSyncAt = new Date()`
- Export both the hook (`useSyncStatusStore`) and the store instance (same reference, Zustand convention)

**Patterns to follow:**
- `src/stores/useNotificationPrefsStore.ts` — `create<State>((set, get) => ({...}))` with async action pattern
- `src/stores/useSessionStore.ts` — store accessed via `getState()` outside React components

**Test scenarios:**
- Happy path: `setStatus('offline')` → store state transitions to `{ status: 'offline' }`
- Happy path: `markSyncComplete()` → `status === 'synced'` and `lastSyncAt` is a recent `Date`
- Happy path: `refreshPendingCount()` with mock Dexie returning 3 pending entries → `pendingCount === 3`
- Edge case: `refreshPendingCount()` with mock Dexie returning 0 → `pendingCount === 0`

**Verification:**
- Store exports `useSyncStatusStore` with all four actions
- `tsc --noEmit` clean on this file

---

- [ ] **Unit 2: `useSyncLifecycle` — sync event trigger hook**

**Goal:** Wire all sync trigger events. Registers store refresh callbacks before the first fullSync, then sets up the interval, visibilitychange listener, online/offline listeners, and beforeunload handler. Returns a cleanup function that removes all of them.

**Requirements:** R1, R2, R3, R4, R5, R6, R10

**Dependencies:** Unit 1 (useSyncStatusStore), syncEngine (existing)

**Files:**
- Create: `src/app/hooks/useSyncLifecycle.ts`

**Approach:**
- Single `useEffect([], [])` — no reactive dependencies, runs once on mount
- Use a `mountedRef = useRef(true)` to guard async operations from resolving after unmount
- **Registration order matters:** `registerStoreRefresh()` calls must come before `fullSync()` call
- Register `'studySessions'` → `useSessionStore.getState().loadSessionStats()`. Do NOT register `'contentProgress'` — `loadCourseProgress` requires a mandatory `courseId`; add a comment explaining the skip
- Initial `fullSync()` on mount: set `setStatus('syncing')` before the call, call `markSyncComplete()` on resolve, call `setStatus('error')` + `console.error` on reject. This immediately reflects sync activity in the status store after mount.
- Timer: `setInterval(() => { if (navigator.onLine) syncEngine.nudge() }, 30_000)`. Store the id for `clearInterval` in cleanup
- visibilitychange handler: fire `nudge()` only when `document.visibilityState === 'visible' && navigator.onLine`
- online handler: `setStatus('syncing')` → `fullSync()` → `markSyncComplete()` on success, `setStatus('error')` on catch. This wires all four status values from R8 without requiring E97.
- offline handler: `setStatus('offline')` only — no engine pause
- beforeunload handler: check `navigator.sendBeacon`, serialize pending queue entries, call `sendBeacon` only when payload length < 64_000. Add `// Intentional: beacon endpoint is future work — call silently fails` comment
- Cleanup: `clearInterval(id)`, `document.removeEventListener('visibilitychange', ...)`, `window.removeEventListener('online', ...)`, `window.removeEventListener('offline', ...)`, `window.removeEventListener('beforeunload', ...)`, `mountedRef.current = false`

**Patterns to follow:**
- `src/app/hooks/useAuthLifecycle.ts` — `useEffect(fn, [])` + cleanup function + `let ignore = false` pattern
- `src/app/hooks/useOnlineStatus.ts` — `addEventListener`/`removeEventListener` pairs in `useEffect`

**Test scenarios:**
- Happy path: on mount, `syncEngine.fullSync` called exactly once (AC1)
- Happy path: after `vi.advanceTimersByTime(30_000)` with `navigator.onLine = true`, `syncEngine.nudge` called once (AC2)
- Edge case: after `vi.advanceTimersByTime(30_000)` with `navigator.onLine = false`, `syncEngine.nudge` NOT called (AC2 offline guard)
- Happy path: `document.dispatchEvent(new Event('visibilitychange'))` with `document.visibilityState = 'visible'` and `navigator.onLine = true` → `syncEngine.nudge` called (AC3)
- Edge case: visibilitychange with `visibilityState = 'hidden'` → `syncEngine.nudge` NOT called
- Edge case: visibilitychange with `visibilityState = 'visible'` but `navigator.onLine = false` → `syncEngine.nudge` NOT called
- Happy path: `window.dispatchEvent(new Event('online'))` → `syncEngine.fullSync` called again (AC5)
- Happy path: `window.dispatchEvent(new Event('offline'))` → `useSyncStatusStore.getState().setStatus` called with `'offline'` (AC4)
- Integration: `syncEngine.registerStoreRefresh` called with `'studySessions'` before first `fullSync` (AC10)
- Happy path: on unmount, all 4 event listeners removed (`window.removeEventListener` × 3 + `document.removeEventListener` × 1) and `clearInterval` called (AC2, AC3 cleanup)

**Verification:**
- All 11 test scenarios above pass
- `tsc --noEmit` clean
- `npm run lint` clean (no `any` casts, no missing event listener cleanup)

---

- [ ] **Unit 3: Wire `useSyncLifecycle` into `App.tsx`**

**Goal:** Call the hook from the root app component so sync triggers are active for the entire app session, regardless of which route the user navigates to.

**Requirements:** R9

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/App.tsx`

**Approach:**
- Add import: `import { useSyncLifecycle } from '@/app/hooks/useSyncLifecycle'`
- Add call directly after `useAuthLifecycle()` with comment: `// E92-S07: Sync triggers, offline handling, store refresh registrations`
- No other changes to `App.tsx`

**Test scenarios:**
- Test expectation: none — the integration is confirmed by Unit 2's test that `fullSync` fires on mount, and by manual verification that a page reload triggers a Supabase network request

**Verification:**
- `npm run build` succeeds (import resolves, no type errors introduced)
- `npm run lint` clean

---

- [ ] **Unit 4: Unit tests for `useSyncLifecycle`**

**Goal:** Comprehensive unit test coverage for all trigger paths, the online/offline guard, cleanup, and store refresh registration ordering.

**Requirements:** R12

**Dependencies:** Units 1, 2

**Files:**
- Create: `src/app/hooks/__tests__/useSyncLifecycle.test.ts`

**Approach:**
- Declare all `vi.mock()` calls before any imports (hoisting requirement — follow `useAuthLifecycle.test.ts` pattern exactly)
- Mock modules: `@/lib/sync/syncEngine`, `@/app/stores/useSyncStatusStore`, `@/stores/useSessionStore`
- `beforeEach`: `vi.useFakeTimers()`, reset `navigator.onLine = true`, reset `document.visibilityState = 'visible'`
- `afterEach`: `vi.useRealTimers()`, `vi.clearAllMocks()`, `vi.restoreAllMocks()`
- Use `renderHook(() => useSyncLifecycle())` from `@testing-library/react`
- For timer test: `vi.advanceTimersByTime(30_000)` — note that fake timers require `vi.runAllTimers()` or `advanceTimersByTime()` to fire; do not use `await act()` wrapping unless timer fires async callbacks
- For event tests: `window.dispatchEvent(new Event('online'))` / `window.dispatchEvent(new Event('offline'))` / `document.dispatchEvent(new Event('visibilitychange'))`
- `Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })` to set offline in tests
- `Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })` for visibility tests
- For cleanup test: `vi.spyOn(window, 'removeEventListener')` and `vi.spyOn(document, 'removeEventListener')` before `renderHook`; then `unmount()` and assert spies

**Patterns to follow:**
- `src/app/hooks/__tests__/useIdleDetection.test.ts` — fake timers, `advanceTimersByTime`, cleanup pattern
- `src/app/hooks/__tests__/useAuthLifecycle.test.ts` — `vi.mock()` before imports, `renderHook`, `beforeEach`/`afterEach`

**Test scenarios:** (mirrors Unit 2 test scenarios — this unit IS the test implementation)

**Verification:**
- `npm run test:unit` — all new tests pass
- `npm run test:unit` — no regressions in `useAuthLifecycle.test.ts` or `syncEngine.test.ts`

## System-Wide Impact

- **Interaction graph:** `useSyncLifecycle` calls `syncEngine.fullSync()` and `syncEngine.nudge()`. `syncEngine` internally calls `_doUpload()` → Supabase upsert/insert → `db.syncQueue` mutations, and `_doDownload()` → Supabase select → `db.*` puts → store refresh callbacks. The refresh callbacks (`loadSessionStats()`) call Dexie internally. All async; nothing blocks the React render cycle.
- **Error propagation:** `fullSync()` rejections are caught and logged via `console.error`. No unhandled promise rejections. Zustand actions (`setStatus`, `refreshPendingCount`) do not throw — Dexie read errors in `refreshPendingCount` should be caught internally.
- **State lifecycle risks:** The 30-second interval must be cleared on unmount — failure causes `nudge()` to fire on an unmounted component's context (though this is benign since `nudge()` is stateless, the timer itself keeps the module alive). The `mountedRef` guard prevents stale async callbacks from updating state after unmount.
- **API surface parity:** `useSyncStatusStore` shape is a contract for E97. The exact field names (`status`, `pendingCount`, `lastSyncAt`) and the four actions must not change without coordinating with E97 stories.
- **Integration coverage:** The beacon handler reads from `db.syncQueue` (async) inside a `beforeunload` handler (synchronous). The Dexie read cannot be awaited before the page unloads — the read is fire-and-forget and the result may not be used. This is a known limitation of `beforeunload` async patterns. Document with `// Intentional:` comment.
- **Unchanged invariants:** `syncEngine.ts`, `syncableWrite.ts`, `tableRegistry.ts`, `fieldMapper.ts`, `useAuthLifecycle.ts` — none of these are modified. The upload queue, conflict strategies, and auth session handling are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `contentProgress` store not refreshed after download | Accepted for S07 — `loadCourseProgress` requires courseId. Add note in Implementation Notes that a global `loadAll()` can be added to the store if refresh is needed before E97. |
| `beforeunload` async Dexie read completes after page unload | Known browser limitation. The sendBeacon call may carry stale data. Add `// Intentional:` comment. Beacon endpoint doesn't exist anyway — this is structural scaffolding. |
| `vi.useFakeTimers()` interaction with async Dexie queries in tests | Tests mock `syncEngine.fullSync` and `syncEngine.nudge` as `vi.fn()` — Dexie is never called in unit tests. Not a risk. |
| Timer fires during SSR / non-browser contexts | Not applicable — Vite SPA, always browser. `navigator.onLine` and `document.visibilityState` are always available. |
| `useSyncStatusStore` imported in both hook and store file | Zustand stores are module singletons — importing from two places returns the same instance. No risk. |

## Documentation / Operational Notes

- `useSyncStatusStore` is a public contract for E97. Do not rename its fields or remove actions without coordinating.
- The `/api/sync-beacon` endpoint is unimplemented. When the endpoint is eventually added (POST with JSON body of pending `SyncQueueEntry[]`), remove the `// Intentional:` comment and test the handler.
- After this story ships, sync fires on every app open. This will generate Supabase network requests on every page load for authenticated users. Monitor Supabase dashboard for unexpected load if traffic increases.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e92-s07-sync-triggers-requirements.md](docs/brainstorms/2026-04-18-e92-s07-sync-triggers-requirements.md)
- **Story file:** [docs/implementation-artifacts/92-7-sync-triggers-and-offline-handling.md](docs/implementation-artifacts/92-7-sync-triggers-and-offline-handling.md)
- Related code: `src/lib/sync/syncEngine.ts`, `src/app/hooks/useAuthLifecycle.ts`, `src/app/hooks/useOnlineStatus.ts`, `src/app/hooks/useIdleDetection.ts`
- Related plans: `docs/plans/2026-04-18-005-feat-e92-s06-sync-engine-download-apply-phase-plan.md`
- External docs: None required
