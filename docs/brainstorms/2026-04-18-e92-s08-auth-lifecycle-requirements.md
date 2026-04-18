# CE Requirements: E92-S08 Auth Lifecycle Integration and UserId Backfill

**Source:** BMAD story `docs/implementation-artifacts/92-8-auth-lifecycle-integration-and-userid-backfill.md`
**Date:** 2026-04-18
**Epic:** E92 — Sync Foundation
**Depends on:** E92-S07 (done — useSyncLifecycle hook, syncEngine.start/stop exist)

---

## Problem Statement

The Knowlune sync engine (`syncEngine.ts`) has `start(userId)` and `stop()` methods but nothing calls them. When a user signs in, the engine remains idle. When they sign out, the engine keeps running with stale credentials. If a user has pre-existing local data (created before they had an account), there is no UX to decide what happens to that data.

This story wires auth events → sync engine lifecycle, adds sign-out cleanup, and provides a non-dismissible "Link my data" dialog for the first-sign-in case.

---

## What Needs to Be Built

### 1. Wire Auth Events to syncEngine

**File to modify:** `src/app/hooks/useAuthLifecycle.ts`

The hook already handles `SIGNED_IN`, `INITIAL_SESSION`, and `SIGNED_OUT` events via `supabase.auth.onAuthStateChange`. It already calls `backfillUserId` and `hydrateSettingsFromSupabase`. S08 adds:

- On `SIGNED_IN` / `INITIAL_SESSION`: call `syncEngine.start(userId)` after the existing handling
- On `SIGNED_OUT`: call `syncEngine.stop()` + `clearSyncState()` after the existing handling
- The `getSession()` fallback block also needs `syncEngine.start(userId)` if a session exists

**Critical constraint:** `syncEngine.start()` calls `fullSync()` internally. If the dialog must gate sync, the detection must happen BEFORE `start()`. Check `syncEngine.ts` to see if there's a way to call `start()` without triggering `fullSync()`, or whether detection must precede the `start()` call entirely.

### 2. Sign-Out Cleanup (`clearSyncState`)

**File to create:** `src/lib/sync/clearSyncState.ts`

```ts
export async function clearSyncState(): Promise<void>
```

- `db.syncQueue.clear()` — delete all pending/failed queue entries
- `db.syncMetadata.toCollection().modify(row => { row.lastSyncTimestamp = null; row.lastUploadedKey = null })` — reset cursors
- Local Dexie content records (notes, books, etc.) must NOT be deleted

### 3. First-Sign-In Detection (`hasUnlinkedRecords`)

**File to create:** `src/lib/sync/hasUnlinkedRecords.ts`

```ts
export async function hasUnlinkedRecords(newUserId: string): Promise<boolean>
```

- Uses `Promise.any()` for fast short-circuit: returns `true` at the first table with unlinked records
- Checks P0 tables first: `contentProgress`, `studySessions`, `progress`, `notes`, `books`, `importedCourses`
- A record is "unlinked" if `userId === null || userId === undefined || userId !== newUserId`

### 4. Record Counts for Dialog (`countUnlinkedRecords`)

**File to create:** `src/lib/sync/countUnlinkedRecords.ts`

```ts
export async function countUnlinkedRecords(newUserId: string): Promise<Record<string, number>>
```

Returns: `{ courses, notes, books, flashcards, other }` where each is the count of unlinked records in that category. Uses `SYNCABLE_TABLES` from `backfill.ts`.

### 5. LinkDataDialog Component

**File to create:** `src/app/components/sync/LinkDataDialog.tsx`

A blocking modal (no close button, no outside-click dismiss, no ESC dismiss) using shadcn/ui `Dialog`.

Props: `{ open: boolean, userId: string, onResolved: () => void }`

**"Link to my account" button (variant="brand"):**
1. `await backfillUserId(userId)` — stamps all null-userId records
2. `syncEngine.fullSync()` fire-and-forget
3. `localStorage.setItem('sync:linked:{userId}', 'true')`
4. `onResolved()`

**"Start fresh" button (variant="outline" + text-destructive):**
1. `window.confirm(...)` — secondary confirmation
2. Clear all `SYNCABLE_TABLES` via `db.table(name).clear()` in a loop
3. `await clearSyncState()`
4. `syncEngine.fullSync()` fire-and-forget
5. `localStorage.setItem('sync:linked:{userId}', 'true')`
6. `onResolved()`

Loading spinner replaces button text during async operations. Both buttons disabled while loading.

### 6. App.tsx Integration

**File to modify:** `src/app/App.tsx`

- Add `useState` for `showLinkDialog: boolean` and `linkDialogUserId: string`
- Modify `useAuthLifecycle` call to accept an `onUnlinkedDetected` callback
- Mount `<LinkDataDialog open={showLinkDialog} userId={linkDialogUserId} onResolved={...} />`

### 7. Orphaned syncQueue Stamp

After `syncEngine.start(userId)`, stamp any `syncQueue` entries where `userId` is missing/empty with the new `userId`. This ensures pre-auth queue entries get uploaded.

```ts
db.syncQueue
  .filter(entry => !entry.userId || entry.userId === '')
  .modify(entry => { entry.userId = userId })
  .catch(err => console.error('[useAuthLifecycle] syncQueue stamp failed:', err))
```

### 8. Unit Tests

**File to extend:** `src/app/hooks/__tests__/useAuthLifecycle.test.ts`

New test cases:
- `syncEngine.start(userId)` called on `SIGNED_IN`
- `syncEngine.start(userId)` called on `INITIAL_SESSION`
- `syncEngine.stop()` called on `SIGNED_OUT`
- `clearSyncState()` called on `SIGNED_OUT`
- Dialog `onUnlinkedDetected` callback fires when `hasUnlinkedRecords` returns `true`
- No dialog callback when `localStorage` flag already set for userId
- Regression: `hydrateSettingsFromSupabase` and `backfillUserId` still fire

---

## Acceptance Criteria (Abbreviated)

1. `syncEngine.start(userId)` called within one event-loop tick of `SIGNED_IN` / `INITIAL_SESSION`
2. `syncEngine.stop()` called on `SIGNED_OUT`; no Supabase calls after this
3. `syncQueue` cleared + `syncMetadata` cursors reset on sign-out
4. Dialog appears when unlinked records exist AND `localStorage` flag not set
5. "Link to my account": backfills, fullSync, sets flag, closes
6. "Start fresh": clears tables, clears state, fullSync, sets flag, closes
7. Dialog non-dismissible (no X, no outside click, no ESC)
8. Dialog shows record counts by category
9. No regressions to existing `useAuthLifecycle` behaviours
10. TypeScript clean (`tsc --noEmit` zero errors)
11. Unit tests pass

---

## Out of Scope

- `SyncStatusIndicator` UI — E97-S01
- `SyncSettingsPanel` — E97-S02
- Modifying `syncEngine.ts` or `backfill.ts` — they exist and are complete
- P1-P4 store wiring — E93-E96
- The initial upload wizard (separate from LinkDataDialog) — E97

---

## Key Files Reference

| File | Status | Note |
|------|--------|------|
| `src/app/hooks/useAuthLifecycle.ts` | Exists | Already calls backfillUserId; add sync start/stop |
| `src/lib/sync/backfill.ts` | Exists | Exports `backfillUserId`, `SYNCABLE_TABLES` |
| `src/lib/sync/syncEngine.ts` | Exists | `start(userId)`, `stop()`, `fullSync()` public API |
| `src/lib/sync/clearSyncState.ts` | Create | Queue + cursor reset on sign-out |
| `src/lib/sync/hasUnlinkedRecords.ts` | Create | Fast detection for dialog gate |
| `src/lib/sync/countUnlinkedRecords.ts` | Create | Category counts for dialog display |
| `src/app/components/sync/LinkDataDialog.tsx` | Create | Blocking modal with Link/Fresh choices |
| `src/app/App.tsx` | Modify | Mount dialog, pass callback to useAuthLifecycle |
| `src/app/hooks/__tests__/useAuthLifecycle.test.ts` | Extend | New test cases for S08 |
