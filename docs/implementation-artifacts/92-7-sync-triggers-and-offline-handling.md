---
story_id: E92-S07
story_name: "Sync Triggers and Offline Handling"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.07: Sync Triggers and Offline Handling

## Story

As the Knowlune sync system,
I want a lifecycle hook that wires all the events that cause the sync engine to run and handles graceful offline behaviour,
so that data syncs automatically on app open, tab focus, network reconnection, and every 30 seconds — and never throws errors when the device is offline.

## Acceptance Criteria

**AC1 — App open sync:** `syncEngine.fullSync()` is called on mount of `useSyncLifecycle`. Confirmed by checking the Supabase network tab immediately after page load.

**AC2 — Periodic sync:** A `setInterval` of 30 seconds calls `syncEngine.nudge()` while the app is open and online. Interval is cleared on unmount.

**AC3 — Visibility change sync:** `document.addEventListener('visibilitychange', ...)` triggers `syncEngine.nudge()` when `document.visibilityState === 'visible'` (tab gains focus). Listener is removed on unmount.

**AC4 — Offline pause:** `window.addEventListener('offline', ...)` sets `syncEngine` to a paused state (`_started = false` equivalent — any mechanism that causes `nudge()` to no-op). All `syncableWrite()` calls continue writing to Dexie. No errors are thrown or logged while offline.

**AC5 — Online resume:** `window.addEventListener('online', ...)` resumes sync and immediately triggers `syncEngine.fullSync()`. All queued writes accumulated while offline are flushed.

**AC6 — Before-unload flush:** `window.addEventListener('beforeunload', ...)` calls `navigator.sendBeacon` to flush small pending queue items (payload serialised to JSON must be < 64 KB). Gracefully skips if `navigator.sendBeacon` is unavailable.

**AC7 — pendingCount accuracy:** `useSyncStatusStore.pendingCount` reflects the current number of `pending` entries in `db.syncQueue`. Updated after every sync cycle and on any `syncableWrite()` completion.

**AC8 — Status transitions:** `useSyncStatusStore.status` transitions correctly:
  - `'offline'` when `window offline` event fires
  - `'syncing'` when an upload/download cycle is in progress
  - `'synced'` after a successful full cycle
  - `'error'` if a sync cycle ends with unresolved dead-letter entries

**AC9 — Root layout mount:** `useSyncLifecycle` is called from the root app component (`App.tsx`) — not from a specific page. It must be present for the entire app session.

**AC10 — Store refresh registrations:** P0 store refresh callbacks are registered into `syncEngine.registerStoreRefresh()` so Zustand stores reflect downloaded data:
  - `'contentProgress'` → `useContentProgressStore.getState().loadCourseProgress`
  - `'studySessions'` → `useSessionStore.getState().loadSessionStats`
  - Any other P0 table with a known load function

**AC11 — TypeScript compiles clean:** `npx tsc --noEmit` produces zero errors.

**AC12 — Unit test coverage:** Tests in `src/app/hooks/__tests__/useSyncLifecycle.test.ts` verify:
  - `fullSync()` called on mount (AC1)
  - `nudge()` called after 30s interval (AC2)
  - `nudge()` called when visibility becomes `'visible'` (AC3)
  - `nudge()` NOT called while paused (offline) (AC4)
  - `fullSync()` called when online event fires after offline (AC5)
  - `pendingCount` updates correctly in `useSyncStatusStore` (AC7)
  - All event listeners are cleaned up on unmount (no memory leaks)

## Tasks / Subtasks

- [ ] Task 1: Create `src/app/stores/useSyncStatusStore.ts` (AC: 7, 8)
  - [ ] 1.1 Create Zustand store with shape: `{ status: 'synced' | 'syncing' | 'offline' | 'error', pendingCount: number, lastSyncAt: Date | null }`
  - [ ] 1.2 Export `useSyncStatusStore` with `getState()` and `setState()` accessible outside React
  - [ ] 1.3 Add `refreshPendingCount()` action that reads `db.syncQueue.where('status').equals('pending').count()` and updates `pendingCount`
  - [ ] 1.4 Add `setStatus(status)` action for lifecycle transitions
  - [ ] 1.5 Add `markSyncComplete()` action: sets `status = 'synced'`, `lastSyncAt = new Date()`

- [ ] Task 2: Create `src/app/hooks/useSyncLifecycle.ts` (AC: 1, 2, 3, 4, 5, 6, 9, 10)
  - [ ] 2.1 Import `syncEngine` from `@/lib/sync/syncEngine` and `useSyncStatusStore` from the store created in Task 1
  - [ ] 2.2 **App open:** On mount, call `syncEngine.fullSync()` (fire-and-forget with `.catch()` to surface errors via `console.error`)
  - [ ] 2.3 **Periodic timer:** `const id = setInterval(() => { if (navigator.onLine) syncEngine.nudge() }, 30_000)` — clear in cleanup
  - [ ] 2.4 **Visibility change:** `document.addEventListener('visibilitychange', handler)` where handler calls `syncEngine.nudge()` when `document.visibilityState === 'visible'` and `navigator.onLine` — remove in cleanup
  - [ ] 2.5 **Online handler:** `window.addEventListener('online', handler)` — handler: `useSyncStatusStore.getState().setStatus('synced')`, then `syncEngine.fullSync()` — remove in cleanup
  - [ ] 2.6 **Offline handler:** `window.addEventListener('offline', handler)` — handler: `useSyncStatusStore.getState().setStatus('offline')` + pause nudge (set a module-level or ref flag that nudge checks; alternatively, rely on `navigator.onLine` guard in timer/visibility handlers) — remove in cleanup
  - [ ] 2.7 **Before unload:** `window.addEventListener('beforeunload', handler)` — handler serialises pending queue entries and calls `navigator.sendBeacon('/api/sync-flush', payload)` only if `JSON.stringify(payload).length < 64_000` and `navigator.sendBeacon` is defined — remove in cleanup
  - [ ] 2.8 **Store refresh registrations:** Register P0 callbacks immediately (before fullSync fires):
    ```ts
    syncEngine.registerStoreRefresh('contentProgress', async () => {
      // loadCourseProgress requires a courseId; for global refresh use a sentinel or skip
      // If no global load method exists, log a warning and skip — do NOT invent a non-existent API
    })
    syncEngine.registerStoreRefresh('studySessions', () =>
      useSessionStore.getState().loadSessionStats()
    )
    ```
    Check each store's actual exported methods before registering — do NOT call methods that don't exist.
  - [ ] 2.9 Return cleanup function that clears all listeners and the interval

- [ ] Task 3: Update `src/app/App.tsx` to call `useSyncLifecycle()` (AC: 9)
  - [ ] 3.1 Import `useSyncLifecycle` from `@/app/hooks/useSyncLifecycle`
  - [ ] 3.2 Call `useSyncLifecycle()` at the top of the `App` component (alongside `useAuthLifecycle()`)
  - [ ] 3.3 Add `// E92-S07: Sync triggers, offline handling, store refresh registrations` comment

- [ ] Task 4: Write unit tests (AC: 12)
  - [ ] 4.1 Create `src/app/hooks/__tests__/useSyncLifecycle.test.ts`
  - [ ] 4.2 Mock `@/lib/sync/syncEngine` with `vi.fn()` for `fullSync`, `nudge`, `registerStoreRefresh`
  - [ ] 4.3 Mock `@/stores/useSessionStore` and `@/stores/useContentProgressStore`
  - [ ] 4.4 Mock `@/app/stores/useSyncStatusStore`
  - [ ] 4.5 Test: `fullSync` called on mount
  - [ ] 4.6 Test: After `vi.advanceTimersByTime(30_000)` with `navigator.onLine = true`, `nudge` called
  - [ ] 4.7 Test: `nudge` NOT called when `navigator.onLine = false` during timer tick
  - [ ] 4.8 Test: `visibilitychange` event with `document.visibilityState = 'visible'` → `nudge` called
  - [ ] 4.9 Test: `online` event → `fullSync` called
  - [ ] 4.10 Test: `offline` event → `setStatus('offline')` called
  - [ ] 4.11 Test: On unmount, event listeners removed and interval cleared (use `vi.spyOn(window, 'removeEventListener')`)

- [ ] Task 5: Verification
  - [ ] 5.1 `npm run test:unit` — all new tests pass, no regressions in `syncEngine.test.ts` or `useAuthLifecycle.test.ts`
  - [ ] 5.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 5.3 `npm run lint` — zero errors
  - [ ] 5.4 `npm run build` — clean

## Design Guidance

No new UI components. This story is pure infrastructure:
- `src/app/stores/useSyncStatusStore.ts` — new Zustand store (no UI, consumed by E97)
- `src/app/hooks/useSyncLifecycle.ts` — new hook (no JSX)
- `src/app/App.tsx` — one-line hook call addition
- `src/app/hooks/__tests__/useSyncLifecycle.test.ts` — unit tests

`useSyncStatusStore` will be consumed in E97-S01 (Sync Status Indicator) and E97-S02 (Sync Settings Panel). Keep the shape exactly as specified in AC7/AC8.

## Implementation Notes

### File Locations — Only Modify These

- `src/app/stores/useSyncStatusStore.ts` — **create new**
- `src/app/hooks/useSyncLifecycle.ts` — **create new**
- `src/app/App.tsx` — add `useSyncLifecycle()` call (one line import + one line call)
- `src/app/hooks/__tests__/useSyncLifecycle.test.ts` — **create new**

Do NOT touch:
- `src/lib/sync/syncEngine.ts` — complete from S05/S06
- `src/lib/sync/syncableWrite.ts` — complete from S04
- `src/lib/sync/tableRegistry.ts` — complete from S03
- `src/app/hooks/useAuthLifecycle.ts` — complete from E43-S04 (S07 runs alongside it, not inside it)
- Any existing store files — only read their public API, do not modify

### syncEngine Public API (S05/S06 — fully implemented)

```ts
syncEngine.nudge(): void                              // debounced upload trigger (no-op if !_started)
syncEngine.start(userId: string): Promise<void>       // sets _started = true, calls fullSync()
syncEngine.stop(): void                               // sets _started = false, clears timers
syncEngine.fullSync(): Promise<void>                  // upload then download all tables
syncEngine.registerStoreRefresh(table, cb): void      // register Zustand store reload callback
syncEngine.isRunning: boolean
syncEngine.currentUserId: string | null
```

`nudge()` is guarded by `_started`. S07 does NOT need to replicate this guard — it should just check `navigator.onLine` before calling `nudge()` to avoid sending a nudge to a paused engine that would queue work unnecessarily.

**Important:** `start()` / `stop()` are the auth-lifecycle concern (E92-S08). S07 only calls `nudge()` and `fullSync()` — it does NOT call `start()` or `stop()`. The engine defaults `_started = true` for backward compat, so `nudge()` works from S07 without a `start()` call.

### Offline Pause Strategy

The engine's `nudge()` is already a no-op when `!_started`. S07 avoids re-implementing this guard:

```ts
// In timer and visibility handlers — guard with navigator.onLine
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    syncEngine.nudge()
  }
}

const handleOnline = () => {
  useSyncStatusStore.getState().setStatus('synced')
  syncEngine.fullSync().catch(err => console.error('[useSyncLifecycle] fullSync error:', err))
}

const handleOffline = () => {
  useSyncStatusStore.getState().setStatus('offline')
  // nudge() is no-op'd by the online guard in timer/visibility handlers
  // Intentional: no direct pausing of syncEngine here — that is E92-S08's concern
}
```

### Before-Unload Beacon Pattern

```ts
const handleBeforeUnload = () => {
  if (!navigator.sendBeacon) return

  // Intentional: fire-and-forget — beforeunload cannot await async operations.
  // Only flush tiny payloads that fit in a beacon (< 64KB).
  db.syncQueue.where('status').equals('pending').toArray().then(entries => {
    const payload = JSON.stringify(entries)
    if (payload.length < 64_000) {
      navigator.sendBeacon('/api/sync-beacon', payload)
    }
  })
}
```

Note: `/api/sync-beacon` does not exist yet (no backend in this project). The beacon call will silently fail. This is acceptable in S07 — the pattern is wired; the endpoint is a future concern. Add `// Intentional: beacon endpoint is future work` comment.

### useSyncStatusStore Shape

```ts
import { create } from 'zustand'
import { db } from '@/db'

interface SyncStatusState {
  status: 'synced' | 'syncing' | 'offline' | 'error'
  pendingCount: number
  lastSyncAt: Date | null
  refreshPendingCount: () => Promise<void>
  setStatus: (status: SyncStatusState['status']) => void
  markSyncComplete: () => void
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  status: 'synced',
  pendingCount: 0,
  lastSyncAt: null,
  refreshPendingCount: async () => {
    const count = await db.syncQueue.where('status').equals('pending').count()
    set({ pendingCount: count })
  },
  setStatus: (status) => set({ status }),
  markSyncComplete: () => set({ status: 'synced', lastSyncAt: new Date() }),
}))
```

### Store Refresh Registrations — Verify Before Registering

Before registering a callback, confirm the method signature from the actual store file:

- `useContentProgressStore.loadCourseProgress(courseId)` — requires a courseId. There may NOT be a global "load all" method. If none exists, skip the registration for `contentProgress` and add a comment explaining why. Do NOT invent a `loadAll()` method.
- `useSessionStore.loadSessionStats(courseId?)` — optional courseId. Calling without argument may load all sessions. Verify the actual function signature in `src/stores/useSessionStore.ts`.

The store refresh registry is about notifying stores after download. If a store has no suitable method to call, it is acceptable to skip it in S07 — the data is still written to Dexie and the store will reflect it on next page navigation.

### useSyncLifecycle Pattern

```ts
import { useEffect, useRef } from 'react'
import { syncEngine } from '@/lib/sync/syncEngine'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { useSessionStore } from '@/stores/useSessionStore'

export function useSyncLifecycle(): void {
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // Register store refresh callbacks before fullSync fires
    syncEngine.registerStoreRefresh('studySessions', () =>
      useSessionStore.getState().loadSessionStats()
    )
    // Add other store registrations here as they become available

    // AC1: Initial full sync
    syncEngine.fullSync().catch(err => {
      console.error('[useSyncLifecycle] Initial fullSync error:', err)
    })

    // AC2: Periodic nudge every 30s
    const intervalId = setInterval(() => {
      if (navigator.onLine && mountedRef.current) {
        syncEngine.nudge()
      }
    }, 30_000)

    // AC3: Visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && mountedRef.current) {
        syncEngine.nudge()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // AC5: Online resume
    const handleOnline = () => {
      useSyncStatusStore.getState().setStatus('synced')
      syncEngine.fullSync().catch(err => {
        console.error('[useSyncLifecycle] Online fullSync error:', err)
      })
    }
    window.addEventListener('online', handleOnline)

    // AC4: Offline pause
    const handleOffline = () => {
      useSyncStatusStore.getState().setStatus('offline')
      // Intentional: nudge() is guarded by navigator.onLine checks in timer and
      // visibilitychange handlers — no direct pause of syncEngine needed here.
    }
    window.addEventListener('offline', handleOffline)

    // AC6: Before-unload beacon
    const handleBeforeUnload = () => {
      // Intentional: beacon endpoint is future work — call will silently fail.
      if (!navigator.sendBeacon) return
      // Fire-and-forget — cannot await in beforeunload
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      mountedRef.current = false
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])
}
```

### App.tsx Integration Point

`useSyncLifecycle()` must be added alongside `useAuthLifecycle()` in `App.tsx`. S07 does NOT wire auth-driven `start()`/`stop()` — those are E92-S08's concern. The hook call is unconditional (runs for all users including unauthenticated):

```tsx
// E43-S04: Auth lifecycle hook
useAuthLifecycle()

// E92-S07: Sync triggers, offline handling, store refresh registrations
useSyncLifecycle()
```

### Testing Pattern

```ts
import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSyncLifecycle } from '../useSyncLifecycle'

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    fullSync: vi.fn().mockResolvedValue(undefined),
    nudge: vi.fn(),
    registerStoreRefresh: vi.fn(),
  },
}))

vi.mock('@/app/stores/useSyncStatusStore', () => ({
  useSyncStatusStore: {
    getState: () => ({
      setStatus: vi.fn(),
      markSyncComplete: vi.fn(),
    }),
  },
}))

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      loadSessionStats: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

describe('useSyncLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('calls fullSync on mount', () => {
    const { syncEngine } = vi.mocked(await import('@/lib/sync/syncEngine'))
    renderHook(() => useSyncLifecycle())
    expect(syncEngine.fullSync).toHaveBeenCalledTimes(1)
  })

  it('calls nudge after 30s when online', () => {
    const { syncEngine } = vi.mocked(await import('@/lib/sync/syncEngine'))
    renderHook(() => useSyncLifecycle())
    vi.advanceTimersByTime(30_000)
    expect(syncEngine.nudge).toHaveBeenCalledTimes(1)
  })

  it('does not call nudge when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { syncEngine } = vi.mocked(await import('@/lib/sync/syncEngine'))
    renderHook(() => useSyncLifecycle())
    vi.advanceTimersByTime(30_000)
    expect(syncEngine.nudge).not.toHaveBeenCalled()
  })

  it('calls nudge on visibilitychange to visible', () => {
    const { syncEngine } = vi.mocked(await import('@/lib/sync/syncEngine'))
    renderHook(() => useSyncLifecycle())
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(syncEngine.nudge).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(syncEngine.nudge).toHaveBeenCalledTimes(1)
  })

  it('calls fullSync on online event', () => {
    const { syncEngine } = vi.mocked(await import('@/lib/sync/syncEngine'))
    renderHook(() => useSyncLifecycle())
    vi.clearAllMocks()  // clear mount fullSync
    window.dispatchEvent(new Event('online'))
    expect(syncEngine.fullSync).toHaveBeenCalledTimes(1)
  })

  it('removes all listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useSyncLifecycle())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    expect(docRemoveSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
```

### What S07 Does NOT Implement

- `syncEngine.start(userId)` / `syncEngine.stop()` calls — **E92-S08** (auth lifecycle)
- `LinkDataDialog` — **E92-S08**
- `backfillUserId()` — **E92-S08**
- `SyncStatusIndicator` UI component — **E97-S01** (consumes `useSyncStatusStore`)
- `SyncSettingsPanel` UI — **E97-S02**
- P1-P4 store refresh registrations — **E93-E96** (each wiring story registers its own store)

## Testing Notes

### Mock Layering

Tests must mock three layers:
1. `syncEngine` module — `fullSync`, `nudge`, `registerStoreRefresh` as `vi.fn()`
2. `useSyncStatusStore` — `getState().setStatus`, `getState().markSyncComplete`
3. Zustand stores (`useSessionStore`) — `getState().loadSessionStats`

Use `vi.useFakeTimers()` for the 30-second interval test. Advance with `vi.advanceTimersByTime(30_000)`.

Use `Object.defineProperty(navigator, 'onLine', { value: false, writable: true })` to simulate offline state in tests (note: this modifies a read-only property; `writable: true` makes it testable but does NOT trigger the `online`/`offline` events — dispatch those manually via `window.dispatchEvent(new Event('online'))`).

### Edge Cases to Cover

- Hook called on unmount before async operations complete — `mountedRef.current = false` prevents stale calls
- `navigator.sendBeacon` undefined (older browsers) — guard before calling
- `syncEngine.fullSync()` rejects on mount — must be caught and logged, NOT thrown to React
- visibilitychange fires while offline — nudge should NOT be called

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — `fullSync()` rejections caught with `console.error`, not silently swallowed
- [ ] `useEffect` cleanup returns a function that removes ALL 4 listeners and the interval
- [ ] `navigator.onLine` check in timer and visibility handlers (not in offline handler)
- [ ] `useSyncLifecycle` does NOT call `syncEngine.start()` or `syncEngine.stop()` — those are E92-S08
- [ ] `useSyncStatusStore` shape matches spec exactly: `{ status, pendingCount, lastSyncAt }` — E97 depends on this
- [ ] Store refresh registrations only call methods that actually exist in the store files
- [ ] `// Intentional:` comment on the beacon endpoint (`/api/sync-beacon` is future work)
- [ ] `// Intentional:` comment explaining why nudge is not called directly in the offline handler
- [ ] `useSyncLifecycle()` added to `App.tsx` after `useAuthLifecycle()`
- [ ] No optimistic UI updates — `useSyncStatusStore` state changes happen after Supabase response
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run test:unit` — all tests pass (new + pre-existing)
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — clean
- [ ] AC → UI trace: No UI in this story — `useSyncStatusStore` is the observable output (consumed in E97)

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Context from E92-S06:** `syncEngine.ts` has full upload + download phases, `StoreRefreshRegistry` as a module-level Map, and all lifecycle methods (`start`, `stop`, `fullSync`, `nudge`, `registerStoreRefresh`). S07's job is to wire the event-based triggers INTO these existing methods — not to reimplement them.

**Key design decision — S07 does not call start()/stop():** The engine defaults `_started = true` so `nudge()` works without `start()`. Auth-driven start/stop is E92-S08's concern. S07 only drives sync via `nudge()` and `fullSync()` calls — this separation means S07 can be implemented and tested independently of auth state.

**Key design decision — navigator.onLine guard instead of engine pause:** Rather than calling a hypothetical `syncEngine.pause()`, S07 guards `nudge()` calls with `navigator.onLine` checks in the timer and visibility handlers. The `offline` event only updates `useSyncStatusStore.status`. This keeps the engine's pause semantics clean and makes the handlers predictable.

**Key design decision — Store refresh registration happens before fullSync:** Registrations must be in place before the first `fullSync()` fires, otherwise the initial download will apply records to Dexie without notifying stores.

**E92-S03 revert note:** Verify `src/lib/sync/tableRegistry.ts` and `fieldMapper.ts` are present and exported correctly before running tests. The git log shows the S03 PR was reverted at the repo level but the sprint-status tracks it as `ready-for-dev`. If these files are missing, S07 will fail to compile.
