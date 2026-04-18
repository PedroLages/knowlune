---
title: "feat: E92-S08 Auth Lifecycle Integration and UserId Backfill"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-e92-s08-auth-lifecycle-requirements.md
---

# feat: E92-S08 Auth Lifecycle Integration and UserId Backfill

## Overview

Wire auth events (`SIGNED_IN`, `INITIAL_SESSION`, `SIGNED_OUT`) to `syncEngine.start(userId)` and `syncEngine.stop()`. Add sign-out cleanup that clears the upload queue and resets per-table incremental-download cursors. Introduce a non-dismissible "Link my data" `LinkDataDialog` that appears on first sign-in when the device has pre-existing local data (records with `userId = null` or `userId ≠ newUserId`), giving the user a binary choice: link all local records to their account or wipe local data and download from the server.

## Problem Frame

`syncEngine.start(userId)` and `syncEngine.stop()` are implemented in E92-S05/S06 but nothing calls them. The auth event hook (`useAuthLifecycle.ts`) already handles session expiry, settings hydration, and userId backfill — it is the right place to add sync lifecycle calls. Without `start()` being called, the engine's `_userId` is never set and per-user Supabase queries have no subject. Without `stop()` on sign-out, the engine keeps running with stale credentials. Without cleanup, the next sign-in inherits the previous user's upload queue and stale download cursors.

The first-sign-in scenario (user added local data before creating an account) needs a deliberate UX decision point — the two failure modes (uploading wrong-user data or silently discarding local work) are both worse than a modal choice.

## Requirements Trace

- R1. `syncEngine.start(userId)` called on `SIGNED_IN` and `INITIAL_SESSION`
- R2. `syncEngine.start(userId)` called in `getSession()` fallback if a session exists
- R3. `syncEngine.stop()` called on `SIGNED_OUT`
- R4. `syncQueue` cleared and `syncMetadata` cursors reset to `null` on `SIGNED_OUT`
- R5. Dialog appears when unlinked records exist AND `localStorage` flag not set for this userId
- R6. "Link to my account" → `backfillUserId()` + `fullSync()` + flag set + dialog closes
- R7. "Start fresh" → clear all syncable tables + `clearSyncState()` + `fullSync()` + flag set + dialog closes
- R8. Dialog non-dismissible (no X button, no pointer-outside, no ESC)
- R9. Dialog shows record counts by category (courses, notes, books, flashcards, other)
- R10. No regressions to existing `useAuthLifecycle` behaviour (expiry banner, backfillUserId, hydrateSettings)
- R11. TypeScript compiles clean (`tsc --noEmit` zero errors)
- R12. Unit tests extended to cover all new paths

## Scope Boundaries

- Does NOT modify `syncEngine.ts` or `backfill.ts` — both are complete
- Does NOT implement `SyncStatusIndicator` or `SyncSettingsPanel` — E97-S01/S02
- Does NOT stamp `userId` on `SyncQueueEntry` rows — that field does not exist in the schema; orphaned pre-auth queue entries are discarded by the sign-out `syncQueue.clear()` cleanup
- Does NOT wire P1–P4 stores — E93–E96

### Deferred to Separate Tasks

- Initial upload wizard (first-time full-upload with progress bar) — E97
- `SyncStatusIndicator` cloud icon in header — E97-S01
- `SyncSettingsPanel` details panel — E97-S02

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useAuthLifecycle.ts` — existing auth hook; already calls `backfillUserId` and `hydrateSettingsFromSupabase` on sign-in. The `ignore` flag and `onAuthStateChange` + `getSession()` pattern are established and must not be disrupted.
- `src/lib/sync/syncEngine.ts` — `start(userId)` sets `_userId`, sets `_started = true`, then calls `_doFullSync()` internally. `stop()` sets `_started = false`, `_userId = null`, and clears debounce timer.
- `src/lib/sync/backfill.ts` — exports `backfillUserId(userId)` and `SYNCABLE_TABLES` (derived from `tableRegistry`). Complete from E92-S02. Must be consumed as-is.
- `src/db/schema.ts` — `SyncQueueEntry` has no `userId` field. `SyncMetadataEntry` has `table`, `lastSyncTimestamp?`, `lastUploadedKey?`. Cursors reset via `.modify()`.
- `src/app/components/ui/dialog.tsx` — standard shadcn/ui Dialog. `DialogContent` always renders a `DialogPrimitive.Close` button (the X). To suppress it for `LinkDataDialog`, render `DialogContent` internals manually (using `DialogPortal` + `DialogOverlay` + `DialogPrimitive.Content`) rather than using the `DialogContent` convenience wrapper.
- `src/app/App.tsx` — calls `useAuthLifecycle()` and `useSyncLifecycle()` at the root level. Has `useState` usage and existing hooks for modal state (e.g., `WelcomeWizard`).
- `src/app/hooks/__tests__/useAuthLifecycle.test.ts` — existing Vitest test file with `onAuthStateChange` callback capture pattern. All new tests should extend this file.

### Key Discovery: start() Always Calls fullSync()

`syncEngine.start()` unconditionally calls `_doFullSync()`. This means:
- The dialog-gate check (`hasUnlinkedRecords`) must happen **before** calling `start()`
- When unlinked records exist: do NOT call `start()` yet; call `hasUnlinkedRecords()` → open dialog → user chooses → dialog calls `start()` or handles data clear → `fullSync()` is controlled by the dialog handlers
- When no unlinked records (or flag already set): call `start(userId)` normally → `fullSync()` fires as part of `start()`

This is a critical sequencing inversion from the naive reading of the requirements.

### Key Discovery: Dialog Requires Custom DialogContent (No X Button)

The project's `DialogContent` always renders the close X. For `LinkDataDialog` we need to suppress it. The cleanest approach is to compose `Dialog` + `DialogPortal` + `DialogOverlay` + `DialogPrimitive.Content` directly from radix-ui primitives, which gives full control without the pre-wired X button.

### Key Discovery: SyncQueueEntry Has No userId

The schema-defined `SyncQueueEntry` has no `userId` field. Task 6 from the story (orphaned syncQueue stamp) cannot be implemented as designed. The correct approach: `clearSyncState()` clears `syncQueue` on sign-out, so pre-auth queue entries are discarded. On next sign-in the user either re-links (backfills data → creates fresh queue entries) or starts fresh (all local data gone). This is consistent and safe.

### Institutional Learnings

- Dexie `.upgrade()` callbacks cannot read async auth state (engineering-patterns.md). Backfill runs post-open from `useAuthLifecycle`, which is already the correct pattern in the existing code.
- Use `ignore` flag in `useEffect` for async sign-in-triggered ops to prevent stale state updates after unmount.
- `hydrateSettingsFromSupabase` and `backfillUserId` are already fire-and-forget with `.catch()` — match this pattern for `syncEngine.start()` and `clearSyncState()`.

## Key Technical Decisions

- **Dialog gates start(), not fullSync()**: Because `start()` calls `fullSync()` internally, unlinked-record detection runs before `start()`. If unlinked records are found, `start()` is deferred until the user's dialog choice resolves. If no unlinked records (or flag already set), `start()` fires normally.
- **Custom DialogContent composition for no-X dialog**: Rather than CSS overrides to hide the X button (fragile), compose radix-ui primitives directly (`DialogPrimitive.Content` from `radix-ui`) to get a clean, X-free modal.
- **Callback not Zustand for dialog state**: `useAuthLifecycle` is refactored to accept an optional `{ onUnlinkedDetected?: (userId: string) => void }` options object. `App.tsx` owns dialog open/userId state via `useState` and passes `onUnlinkedDetected`. This keeps the hook free of UI store imports and matches the project's existing pattern for modal state (e.g., `WelcomeWizard` controlled from `App.tsx`).
- **SyncQueue orphan entries discarded via clearSyncState**: Since `SyncQueueEntry` has no `userId` field, pre-auth orphan queue entries cannot be tagged. Sign-out clears the queue; the next sign-in's `backfillUserId()` (link path) re-stamps content records which will re-enter the queue via future `syncableWrite` calls.
- **localStorage flag per-userId**: `sync:linked:${userId}` prevents the dialog from appearing on repeated sign-ins with the same account, while still showing it if a different user signs in on the same device.

## Open Questions

### Resolved During Planning

- **Does start() need to be split to avoid immediate fullSync?** No. The sequencing fix (detect first, call start() second) handles this without modifying syncEngine.ts.
- **How to suppress the X button on DialogContent?** Compose radix-ui primitives directly rather than using the convenience `DialogContent` wrapper.
- **Should SyncQueueEntry get a userId field?** No. Schema changes are owned by DB migrations. Pre-auth queue entries are discarded by clearSyncState() on sign-out — this is the correct behavior.

### Deferred to Implementation

- Whether `hasUnlinkedRecords` should check all 30+ tables or a representative P0 subset. The story guidance says P0-first with `Promise.any()` short-circuit — implementer should use the full `SYNCABLE_TABLES` list but prioritize P0 tables by ordering them first.
- Exact Radix UI import path for `DialogPrimitive.Content` — check `src/app/components/ui/dialog.tsx` import at implementation time.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Auth Event (onAuthStateChange / getSession fallback)
  │
  ├─ SIGNED_IN / INITIAL_SESSION
  │     │
  │     ├─ existing: hydrateSettingsFromSupabase (fire-and-forget)
  │     ├─ existing: backfillUserId (fire-and-forget)
  │     │
  │     └─ NEW: check localStorage flag sync:linked:{userId}
  │           │
  │           ├─ flag set → syncEngine.start(userId) [runs fullSync internally]
  │           │
  │           └─ flag not set → hasUnlinkedRecords(userId)
  │                 │
  │                 ├─ false → set flag + syncEngine.start(userId)
  │                 │
  │                 └─ true → onUnlinkedDetected(userId) callback
  │                           [start() deferred until dialog resolves]
  │
  └─ SIGNED_OUT
        ├─ existing: session expiry logic, setSession(null)
        ├─ NEW: syncEngine.stop()
        └─ NEW: clearSyncState() [fire-and-forget]

LinkDataDialog (open=true, userId)
  │
  ├─ mount: countUnlinkedRecords(userId) → display counts
  │
  ├─ "Link to my account" click
  │     → backfillUserId(userId)
  │     → syncEngine.start(userId) [sets _userId + triggers fullSync]
  │     → localStorage.setItem(flag)
  │     → onResolved()
  │
  └─ "Start fresh" click → window.confirm
        → db.table(name).clear() for each SYNCABLE_TABLES
        → clearSyncState()
        → syncEngine.start(userId) [triggers fullSync → downloads server state]
        → localStorage.setItem(flag)
        → onResolved()
```

## Implementation Units

- [ ] **Unit 1: clearSyncState utility**

**Goal:** Create a pure async function that wipes the upload queue and resets per-table download cursors on sign-out.

**Requirements:** R3, R4

**Dependencies:** None (Dexie `db` only)

**Files:**
- Create: `src/lib/sync/clearSyncState.ts`
- Test: `src/lib/sync/__tests__/clearSyncState.test.ts`

**Approach:**
- `db.syncQueue.clear()` removes all upload queue entries (pending, uploading, dead-letter)
- `db.syncMetadata.toCollection().modify(row => { row.lastSyncTimestamp = undefined; row.lastUploadedKey = undefined })` resets cursors (use `undefined` not `null` — Dexie's IndexedDB serialization treats `undefined` and absent fields equivalently; avoid `null` to stay consistent with the optional field type in `SyncMetadataEntry`)
- Local Dexie content records (notes, books, courses, etc.) are NOT touched
- Add JSDoc: `// Intentional: local data preserved on sign-out — re-linked or cleared on next sign-in via LinkDataDialog`

**Patterns to follow:**
- `src/lib/sync/backfill.ts` — per-table Dexie operations with fire-and-forget error handling pattern

**Test scenarios:**
- Happy path: after calling `clearSyncState()`, `db.syncQueue.count()` returns 0 and all `syncMetadata` rows have `lastSyncTimestamp = undefined`
- Edge case: `syncQueue` already empty — no error thrown; function completes successfully
- Edge case: `syncMetadata` has zero rows — no error thrown
- Integration: non-syncQueue Dexie tables (e.g., `notes`) retain their records after `clearSyncState()` — local data is not deleted

**Verification:**
- Unit tests pass with `fake-indexeddb/auto` (same pattern as `backfill.test.ts`)
- `tsc --noEmit` clean on the new file

---

- [ ] **Unit 2: hasUnlinkedRecords detection**

**Goal:** Async predicate that returns `true` if any syncable Dexie table has records that need userId linking for the given user.

**Requirements:** R5

**Dependencies:** Unit 1 (none — depends on `backfill.ts` and `db`)

**Files:**
- Create: `src/lib/sync/hasUnlinkedRecords.ts`
- Test: `src/lib/sync/__tests__/hasUnlinkedRecords.test.ts`

**Approach:**
- Import `SYNCABLE_TABLES` from `backfill.ts` (single source of truth)
- Order the table list: P0 tables first (`contentProgress`, `studySessions`, `progress`), then remaining in `SYNCABLE_TABLES` order — most likely to have records checked first
- Use `Promise.any()` with a per-table async check: query `db.table(name).filter(r => !r.userId || r.userId !== newUserId).count()` → if `count > 0`, resolve; else throw (to trigger `Promise.any` rejection for that branch)
- `Promise.any` resolves as soon as one table has unlinked records → fast short-circuit
- All promises rejected (no unlinked records) → `Promise.any` throws `AggregateError` → catch → return `false`
- If a table is not present in the live DB (e.g., not yet created by migration), the `.table()` call may throw — catch per-table and treat as "no records" (log warning, do not propagate)
- Return type: `Promise<boolean>`

**Patterns to follow:**
- `src/lib/sync/backfill.ts` — `SYNCABLE_TABLES` iteration pattern, per-table error isolation

**Test scenarios:**
- Happy path: notes table has a record with `userId = null` → returns `true`
- Happy path: all tables have records with the correct userId → returns `false`
- Happy path: all tables empty → returns `false`
- Edge case: record with `userId` matching a different user → returns `true`
- Edge case: a table query throws (table absent) → that table treated as "no records"; function continues and returns correct result for other tables
- Edge case: called with empty `SYNCABLE_TABLES` → returns `false`

**Verification:**
- Unit tests with `fake-indexeddb/auto`
- `tsc --noEmit` clean

---

- [ ] **Unit 3: countUnlinkedRecords for dialog display**

**Goal:** Return per-category counts of unlinked records for display in `LinkDataDialog`.

**Requirements:** R9

**Dependencies:** Unit 2 (same DB pattern)

**Files:**
- Create: `src/lib/sync/countUnlinkedRecords.ts`
- Test: `src/lib/sync/__tests__/countUnlinkedRecords.test.ts`

**Approach:**
- Categories and their Dexie table names:
  - `courses`: `importedCourses`, `importedVideos`, `importedPdfs`
  - `notes`: `notes`
  - `books`: `books`
  - `flashcards`: `flashcards`
  - `other`: all remaining `SYNCABLE_TABLES` entries not in the above categories
- Per-table: `db.table(name).filter(r => !r.userId || r.userId !== newUserId).count()`
- Aggregate counts into the category buckets. If a table query fails, log and treat as 0.
- Return type: `Promise<{ courses: number; notes: number; books: number; flashcards: number; other: number }>`
- Run all table queries in parallel via `Promise.allSettled` for performance

**Patterns to follow:**
- Same per-table filter pattern as `hasUnlinkedRecords.ts`

**Test scenarios:**
- Happy path: 3 importedCourses + 1 note with null userId, correct userId elsewhere → `{ courses: 3, notes: 1, books: 0, flashcards: 0, other: 0 }`
- Happy path: all tables empty → all counts 0
- Edge case: one table query rejects → its count defaults to 0; other categories unaffected
- Edge case: books table has 2 records, one with matching userId, one with null → books count = 1

**Verification:**
- Unit tests with `fake-indexeddb/auto`
- `tsc --noEmit` clean

---

- [ ] **Unit 4: LinkDataDialog component**

**Goal:** Non-dismissible modal that presents record counts and two resolution options ("Link" or "Start fresh") with loading state.

**Requirements:** R5, R6, R7, R8, R9

**Dependencies:** Units 1, 2, 3 (runtime), backfill.ts (runtime)

**Files:**
- Create: `src/app/components/sync/LinkDataDialog.tsx`

**Approach:**
- Compose from radix-ui primitives directly (not the `DialogContent` convenience wrapper) to suppress the X close button: `Dialog` root → `DialogPortal` → `DialogOverlay` → `DialogPrimitive.Content` from `'radix-ui'`
- Add `onPointerDownOutside={(e) => e.preventDefault()}` and `onEscapeKeyDown={(e) => e.preventDefault()}` on `DialogPrimitive.Content` to block all dismissal paths
- Add `role="alertdialog"` on the content element
- Props: `{ open: boolean; userId: string; onResolved: () => void }`
- Local state: `loading: boolean`, `counts: CategoryCounts` (populated from `countUnlinkedRecords` on open)
- `useEffect` triggers `countUnlinkedRecords(userId)` when `open` becomes true; stores result in `counts`; failure → `counts` stays empty (show no counts, still show buttons)
- **Link handler:** `setLoading(true)` → `await backfillUserId(userId)` → `syncEngine.start(userId).catch(console.error)` (fire-and-forget fullSync via start) → `localStorage.setItem(flag)` → `onResolved()` → `setLoading(false)` in finally
- **Start fresh handler:** `window.confirm(...)` first; on cancel do nothing. On confirm: `setLoading(true)` → loop `db.table(name).clear()` for each `SYNCABLE_TABLES` (errors logged, loop continues) → `await clearSyncState()` → `syncEngine.start(userId).catch(console.error)` (download from server) → `localStorage.setItem(flag)` → `onResolved()` → `setLoading(false)` in finally
- During loading: both buttons disabled; "Link" button shows `<Loader2 className="animate-spin" />`
- Design: `max-w-sm`, brand icon + title, counts list with `text-muted-foreground` labels, "Link" button `variant="brand"`, "Start fresh" button `variant="outline"` + `className="text-destructive hover:text-destructive"`
- Category icons from lucide-react: `BookOpen` for courses/books, `FileText` for notes, `Brain` for flashcards, `Package` for other

**Patterns to follow:**
- `src/app/components/WelcomeWizard.tsx` — App.tsx-mounted modal pattern
- `src/app/components/ui/dialog.tsx` — Radix UI import path: `import { Dialog as DialogPrimitive } from 'radix-ui'`
- Design token usage from styling.md — `text-brand`, `text-muted-foreground`, `bg-brand`, `variant="brand"`

**Test scenarios:**
- Test expectation: none — UI component; visual correctness verified by design review. Logic is covered by Unit 4b tests.

**Verification:**
- Mounts without TypeScript errors
- Both buttons visible; clicking outside or pressing ESC does not close the dialog
- Loading state disables buttons and shows spinner on Link button
- Dialog closes when `onResolved()` is called

---

- [ ] **Unit 4b: LinkDataDialog logic unit tests**

**Goal:** Test the link and start-fresh handler logic in isolation (not the full rendered component).

**Requirements:** R6, R7

**Dependencies:** Unit 4, Units 1–3

**Files:**
- Test: `src/app/components/sync/__tests__/LinkDataDialog.test.tsx`

**Approach:**
- Render `LinkDataDialog` with `open=true`, mock `backfillUserId`, `syncEngine.start`, `clearSyncState`, `countUnlinkedRecords`, and `SYNCABLE_TABLES`
- Use `@testing-library/react` `renderHook` / `render` + `userEvent`

**Test scenarios:**
- Happy path (link): clicking "Link to my account" → `backfillUserId(userId)` called → `syncEngine.start(userId)` called → `localStorage` flag set → `onResolved()` called
- Happy path (start fresh): `window.confirm` returns true → `db.table(n).clear()` called for each table → `clearSyncState()` called → `syncEngine.start()` called → `localStorage` flag set → `onResolved()` called
- Edge case (start fresh declined): `window.confirm` returns false → no Dexie calls, `onResolved` not called
- Edge case: `backfillUserId` rejects → error is caught, `onResolved()` still called (finally block)
- Edge case: loading state during link → buttons disabled; `onResolved()` not called until backfill complete
- Integration: `countUnlinkedRecords` called with correct userId when dialog opens; counts displayed

**Verification:**
- All test cases pass; `onResolved` call count matches expectations

---

- [ ] **Unit 5: Wire useAuthLifecycle to syncEngine + clearSyncState**

**Goal:** Modify `useAuthLifecycle.ts` to call `syncEngine.start(userId)` on sign-in (or defer to dialog) and `syncEngine.stop()` + `clearSyncState()` on sign-out.

**Requirements:** R1, R2, R3, R4, R5, R10

**Dependencies:** Units 1, 2

**Files:**
- Modify: `src/app/hooks/useAuthLifecycle.ts`

**Approach:**
- Add optional `{ onUnlinkedDetected?: (userId: string) => void }` parameter to `useAuthLifecycle()`. The parameter is optional and defaults to `{}` so existing callers (tests, App.tsx before update) remain unbroken.
- Sign-in branch (`SIGNED_IN` / `INITIAL_SESSION`): after existing `hydrateSettingsFromSupabase` + `backfillUserId` calls, add:
  1. Check `localStorage.getItem('sync:linked:' + userId)`
  2. If flag set → `syncEngine.start(userId).catch(console.error)` [fire-and-forget]
  3. If flag not set → `hasUnlinkedRecords(userId).then(has => { if (has) { opts.onUnlinkedDetected?.(userId) } else { localStorage.setItem(...); syncEngine.start(userId).catch(console.error) } }).catch(err => { console.error(...); syncEngine.start(userId).catch(console.error) })` — on `hasUnlinkedRecords` failure, fall back to starting anyway (don't block sync on detection failure)
- Sign-out branch (`SIGNED_OUT`): after existing expiry logic, add:
  1. `syncEngine.stop()` [synchronous]
  2. `clearSyncState().catch(err => console.error('[useAuthLifecycle] clearSyncState failed:', err))` [fire-and-forget]
- `getSession()` fallback block: if `session?.user` exists, apply same sign-in logic as above (check flag → start or detect)
- All new calls are wrapped in the existing `if (ignore) return` guard at the onAuthStateChange level — no new guard needed for the sign-in branch since it already has the ignore check
- Do NOT remove or reorder the existing `backfillUserId`, `hydrateSettingsFromSupabase`, or session expiry calls
- Add `// E92-S08: auth-driven sync lifecycle` comment on each new call site

**Patterns to follow:**
- Existing `backfillUserId` fire-and-forget pattern in the same file
- `// silent-catch-ok` or `// Intentional:` on every catch block

**Test scenarios:**
- Happy path (no unlinked records): `SIGNED_IN` + `hasUnlinkedRecords` returns false → `syncEngine.start(userId)` called, `onUnlinkedDetected` NOT called
- Happy path (localStorage flag set): `SIGNED_IN` + flag already set → `syncEngine.start(userId)` called immediately, `hasUnlinkedRecords` NOT called
- First-sign-in (unlinked records): `SIGNED_IN` + no flag + `hasUnlinkedRecords` returns true → `onUnlinkedDetected(userId)` called, `syncEngine.start` NOT called yet
- Sign-out: `SIGNED_OUT` → `syncEngine.stop()` called + `clearSyncState()` called
- Regression: `hydrateSettingsFromSupabase` still called on `SIGNED_IN`
- Regression: `backfillUserId` still called on `SIGNED_IN`
- Regression: existing `sessionExpired` / `_userInitiatedSignOut` behaviour unchanged
- Error path: `hasUnlinkedRecords` rejects → `syncEngine.start()` still called as fallback (no deadlock)
- `getSession()` fallback: if `session.user` exists → same start/detect logic fires
- Unsubscribe on unmount: existing behaviour preserved

**Verification:**
- Extended test file passes all new + existing cases
- `tsc --noEmit` clean

---

- [ ] **Unit 6: App.tsx integration — mount LinkDataDialog**

**Goal:** Thread dialog state through App.tsx: call `useAuthLifecycle` with `onUnlinkedDetected` callback, own the dialog open/userId state, mount `<LinkDataDialog>`.

**Requirements:** R5, R6, R7, R8

**Dependencies:** Unit 4, Unit 5

**Files:**
- Modify: `src/app/App.tsx`

**Approach:**
- Add two `useState` declarations: `const [showLinkDialog, setShowLinkDialog] = useState(false)` and `const [linkDialogUserId, setLinkDialogUserId] = useState('')`
- Update `useAuthLifecycle()` call to: `useAuthLifecycle({ onUnlinkedDetected: (userId) => { setLinkDialogUserId(userId); setShowLinkDialog(true) } })`
- Add import for `LinkDataDialog` from `@/app/components/sync/LinkDataDialog`
- Mount inside the JSX return (alongside existing modals like `WelcomeWizard`):
  ```
  <LinkDataDialog
    open={showLinkDialog}
    userId={linkDialogUserId}
    onResolved={() => setShowLinkDialog(false)}
  />
  ```
- Add `// E92-S08: Link local data to account on first sign-in` comment

**Patterns to follow:**
- Existing `WelcomeWizard` mounting pattern in `App.tsx`
- Existing `useState` for modal control

**Test scenarios:**
- Test expectation: none — App.tsx integration is verified by E2E/smoke test or visual review. Unit-level coverage is in Unit 5 (auth hook) and Unit 4b (dialog logic).

**Verification:**
- `npm run build` clean (no TypeScript errors in App.tsx)
- `LinkDataDialog` renders when `showLinkDialog = true` in local dev

## System-Wide Impact

- **Interaction graph:** `useAuthLifecycle` now calls `syncEngine.start()` and `syncEngine.stop()` — anything that depends on `syncEngine.isRunning` or `syncEngine.currentUserId` will now reflect auth state. `useSyncLifecycle` (E92-S07) calls `nudge()` and `fullSync()` without `start()` guards — `nudge()` is already gated by `_started`; after S08, `_started` is auth-driven.
- **Error propagation:** All new async calls are fire-and-forget with `.catch(console.error)`. Sync failures do not propagate to the React component tree. `LinkDataDialog` wraps handlers in `try/finally` to ensure `loading` resets and `onResolved` fires even on error.
- **State lifecycle risks:** The sign-out cleanup (`clearSyncState`) runs after `syncEngine.stop()` — no race with in-flight uploads since `stop()` prevents new cycles. A user who signs out mid-upload will have their in-flight lock cycle complete naturally (lock cannot be cancelled) but no new cycles start.
- **localStorage flag**: `sync:linked:{userId}` is per-user. If a different user signs in on the same device and has unlinked records, the dialog will appear again. This is correct behaviour.
- **Unchanged invariants:** `backfillUserId`, `hydrateSettingsFromSupabase`, `sessionExpired`, and `_userInitiatedSignOut` behaviour in `useAuthLifecycle` must not change. All existing `useAuthLifecycle` tests must continue to pass.
- **Integration coverage:** The full sign-in → dialog → link → fullSync chain involves 5 modules. Unit tests mock boundaries; the integration can be verified manually in dev by signing in with pre-existing IndexedDB data.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `start()` fires fullSync before dialog can gate it | Detection (`hasUnlinkedRecords`) runs before `start()`. Dialog path defers `start()` until user chooses. |
| X button suppression breaks future Dialog upgrades | Use radix-ui primitives directly; document the workaround in component JSDoc. |
| `hasUnlinkedRecords` rejects (table not found, etc.) | Fallback: call `syncEngine.start()` anyway on error. Sync is more important than the dialog. |
| Dialog appears in both tabs on multi-tab sign-in | localStorage flag set after resolution in the first tab to win; second tab will find flag set and not show dialog on next event cycle. |
| Dexie `.modify()` on `syncMetadata` with `undefined` vs `null` | Use `undefined` to match `SyncMetadataEntry` optional field type; `null` would cause TypeScript errors. |

## Documentation / Operational Notes

- `sync:linked:{userId}` localStorage keys accumulate per user. No cleanup mechanism exists in this story. Future: could be pruned on sign-out but this is low priority (keys are tiny).
- `window.confirm()` in "Start fresh" is a blocking native dialog. On mobile browsers with popup suppression, `confirm()` may silently return `true`. This is an acceptable trade-off for the MVP — a full in-dialog confirmation step can replace it in a future polish story.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-e92-s08-auth-lifecycle-requirements.md](docs/brainstorms/2026-04-18-e92-s08-auth-lifecycle-requirements.md)
- BMAD story: [docs/implementation-artifacts/92-8-auth-lifecycle-integration-and-userid-backfill.md](docs/implementation-artifacts/92-8-auth-lifecycle-integration-and-userid-backfill.md)
- Related: E92-S07 plan: [docs/plans/2026-04-18-006-feat-e92-s07-sync-triggers-offline-handling-plan.md](docs/plans/2026-04-18-006-feat-e92-s07-sync-triggers-offline-handling-plan.md)
- `src/lib/sync/syncEngine.ts` — `start()` implementation (lines 830–835)
- `src/lib/sync/backfill.ts` — `SYNCABLE_TABLES` and `backfillUserId`
- `src/app/components/ui/dialog.tsx` — Radix UI primitive import pattern
- `src/app/hooks/useAuthLifecycle.ts` — existing hook to modify
- `src/app/hooks/__tests__/useAuthLifecycle.test.ts` — existing test file to extend
