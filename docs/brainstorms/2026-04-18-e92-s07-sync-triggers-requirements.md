# E92-S07: Sync Triggers and Offline Handling — CE Requirements Brief

**Generated:** 2026-04-18
**Source:** docs/implementation-artifacts/92-7-sync-triggers-and-offline-handling.md
**Epic:** E92 — Sync Foundation
**Dependencies:** E92-S06 done (syncEngine.ts has full upload + download phases, StoreRefreshRegistry exists)

---

## Problem Statement

The sync engine (syncEngine.ts) is complete but nothing starts it running. Without trigger wiring, sync never fires — data sits in Dexie and never reaches Supabase (or vice versa). We need a React hook that acts as the sync lifecycle's event hub: starting a full sync on app open, polling every 30 seconds, syncing when the user returns to the tab, resuming after going back online, and gracefully pausing when offline.

Additionally, we need a Zustand store (`useSyncStatusStore`) to expose sync state to future UI panels (E97) without coupling the engine to React.

---

## What Must Be Built

### 1. `src/app/stores/useSyncStatusStore.ts` (new file)

Zustand store with this exact shape (E97 will consume this):

```ts
{
  status: 'synced' | 'syncing' | 'offline' | 'error'
  pendingCount: number
  lastSyncAt: Date | null
  refreshPendingCount(): Promise<void>  // reads db.syncQueue pending count
  setStatus(status): void
  markSyncComplete(): void  // sets status='synced', lastSyncAt=new Date()
}
```

### 2. `src/app/hooks/useSyncLifecycle.ts` (new file)

React hook (no JSX) that wires these triggers:

| Trigger | Action |
|---------|--------|
| Mount | `syncEngine.fullSync()` (fire-and-forget) |
| `setInterval` 30s | `syncEngine.nudge()` if `navigator.onLine` |
| `visibilitychange` → visible | `syncEngine.nudge()` if `navigator.onLine` |
| `window online` event | `useSyncStatusStore.setStatus('synced')` + `syncEngine.fullSync()` |
| `window offline` event | `useSyncStatusStore.setStatus('offline')` (nudge guards handle rest) |
| `beforeunload` | `navigator.sendBeacon(...)` if payload < 64KB |
| Unmount | Remove all listeners + clear interval |

Also registers P0 store refresh callbacks in `syncEngine.registerStoreRefresh()` before the first fullSync fires:
- `'studySessions'` → `useSessionStore.getState().loadSessionStats()`
- `'contentProgress'` → skip or use available method (verify actual API before registering)

**Critical constraints:**
- Does NOT call `syncEngine.start()` or `syncEngine.stop()` — that's E92-S08
- Engine defaults `_started = true`, so `nudge()` works without `start()`
- Online guard in timer/visibilitychange handlers (not a direct engine pause)
- `fullSync()` rejections must be caught + logged, never re-thrown to React

### 3. `src/app/App.tsx` — one-line addition

```tsx
useAuthLifecycle()
useSyncLifecycle()  // E92-S07: sync triggers + offline handling
```

### 4. `src/app/hooks/__tests__/useSyncLifecycle.test.ts` (new file)

Unit tests covering:
- fullSync called on mount
- nudge called after 30s (vi.advanceTimersByTime)
- nudge NOT called when navigator.onLine = false
- nudge called on visibilitychange to 'visible'
- fullSync called on window online event
- setStatus('offline') called on window offline event
- all listeners removed on unmount

---

## Acceptance Criteria (Verified)

1. `syncEngine.fullSync()` called on mount
2. `setInterval(30s)` calls `syncEngine.nudge()` when online; cleared on unmount
3. `visibilitychange` → visible → `syncEngine.nudge()` when online; listener removed on unmount
4. `offline` event → `useSyncStatusStore.status = 'offline'`; no errors thrown
5. `online` event → `syncEngine.fullSync()` fires immediately
6. `beforeunload` → `navigator.sendBeacon` called if `sendBeacon` available and payload < 64KB
7. `useSyncStatusStore.pendingCount` reflects db.syncQueue pending count
8. `useSyncStatusStore.status` transitions: offline/syncing/synced/error
9. `useSyncLifecycle()` called from App.tsx root (not a page)
10. Store refresh callbacks registered before first fullSync
11. TypeScript compiles clean
12. Unit tests pass (listed above)

---

## Out of Scope for This Story

- `syncEngine.start(userId)` / `syncEngine.stop()` — E92-S08
- Auth-driven lifecycle — E92-S08
- `LinkDataDialog` / `backfillUserId()` — E92-S08
- `SyncStatusIndicator` UI — E97-S01
- `SyncSettingsPanel` UI — E97-S02
- P1-P4 store refresh registrations — E93-E96
- `/api/sync-beacon` endpoint — future work

---

## Key Technical Context

**syncEngine.ts public API (fully implemented in S05/S06):**
```ts
syncEngine.nudge(): void                           // debounced upload (no-op if !_started)
syncEngine.start(userId): Promise<void>            // sets _started=true, fullSync
syncEngine.stop(): void                            // sets _started=false
syncEngine.fullSync(): Promise<void>               // upload then download
syncEngine.registerStoreRefresh(table, cb): void   // Zustand decoupling registry
syncEngine.isRunning: boolean
syncEngine.currentUserId: string | null
```

**Existing stores to NOT break:**
- `useAuthStore` — auth state (used by useAuthLifecycle)
- All P0 stores — `useContentProgressStore`, `useSessionStore`

**App.tsx location:** `src/app/App.tsx` — `useAuthLifecycle()` already wired there at line ~68; add `useSyncLifecycle()` directly after.

**Store path convention:** stores live in `src/stores/` (e.g., `useContentProgressStore.ts`), hooks in `src/app/hooks/`. New `useSyncStatusStore` goes in `src/app/stores/` (consistent with E92-S07 spec).

**Test tooling:** Vitest + `@testing-library/react` (`renderHook`). Use `vi.useFakeTimers()` for interval tests.

**navigator.sendBeacon:** The beacon endpoint (`/api/sync-beacon`) doesn't exist yet. The call will silently fail. Add `// Intentional: beacon endpoint is future work` comment.

---

## File Manifest

| File | Action |
|------|--------|
| `src/app/stores/useSyncStatusStore.ts` | CREATE |
| `src/app/hooks/useSyncLifecycle.ts` | CREATE |
| `src/app/App.tsx` | MODIFY (1 import + 1 call) |
| `src/app/hooks/__tests__/useSyncLifecycle.test.ts` | CREATE |
