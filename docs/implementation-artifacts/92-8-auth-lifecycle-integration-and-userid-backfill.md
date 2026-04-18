---
story_id: E92-S08
story_name: "Auth Lifecycle Integration and UserId Backfill"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.08: Auth Lifecycle Integration and UserId Backfill

## Story

As the Knowlune sync system,
I want the sync engine to start when the user signs in and stop when they sign out, and show a "Link my data" dialog when existing local data belongs to no account (or a different account),
so that sync is always scoped to the authenticated user, local-only data is never accidentally uploaded under the wrong account, and the user has a clear choice about what happens to their pre-auth data.

## Acceptance Criteria

**AC1 — Sync starts on sign-in:** `syncEngine.start(userId)` is called immediately after `SIGNED_IN` or `INITIAL_SESSION` events in `useAuthLifecycle.ts`. Engine is running within one event-loop tick of the auth event.

**AC2 — Sync stops on sign-out:** `syncEngine.stop()` is called on `SIGNED_OUT`. After this call, no Supabase upload or download requests are made.

**AC3 — Sign-out cleanup:** On `SIGNED_OUT`, `syncQueue` is cleared (all entries deleted) and `syncMetadata` cursors are reset (`lastSyncTimestamp = null`, `lastUploadedKey = null`). Local Dexie records (notes, books, etc.) are NOT deleted — only the queue and cursors.

**AC4 — First-sign-in detection:** When `syncEngine.start(userId)` is called and Dexie contains records with `userId = null` or `userId != newUserId`, the `LinkDataDialog` is shown before sync proceeds.

**AC5 — "Link to my account" path:** Clicking "Link to my account" in the dialog:
  1. Calls `backfillUserId(userId)` to stamp all `userId = null` records
  2. Calls `syncEngine.fullSync()` to upload the newly stamped records
  3. Dialog closes
  4. On subsequent sign-ins with the same userId, dialog does NOT appear again

**AC6 — "Start fresh" path:** Clicking "Start fresh" in the dialog:
  1. Clears all Dexie tables listed in `SYNCABLE_TABLES` (deletes all records)
  2. Clears `syncQueue` and resets `syncMetadata`
  3. Calls `syncEngine.fullSync()` to download from server
  4. Dialog closes

**AC7 — Dialog non-dismissible:** The `LinkDataDialog` has no close button and cannot be dismissed by clicking outside. User must choose one of the two options.

**AC8 — Dialog shows record counts:** The dialog displays the count of unlinked local records grouped by category (e.g., "12 courses, 47 notes, 3 books"). Counts use `SYNCABLE_TABLES` derived from the registry.

**AC9 — Backfill already present:** `backfillUserId(userId)` exists in `src/lib/sync/backfill.ts` (implemented in E92-S02). S08 does NOT rewrite it — it consumes the existing function. Verify the file exists before starting.

**AC10 — syncQueue re-queue on sign-in:** Existing `syncQueue` entries with missing `userId` (e.g., enqueued while unauthenticated) are stamped with the new `userId` and remain eligible for upload. (Note: `syncableWrite` already guards queue creation on auth state — but any entries that slipped through pre-auth should be stamped.)

**AC11 — TypeScript compiles clean:** `npx tsc --noEmit` produces zero errors.

**AC12 — Unit tests:** Tests in `src/app/hooks/__tests__/useAuthLifecycle.test.ts` (extend existing file) verify:
  - `syncEngine.start(userId)` called on `SIGNED_IN`
  - `syncEngine.start(userId)` called on `INITIAL_SESSION`
  - `syncEngine.stop()` called on `SIGNED_OUT`
  - `syncQueue` cleared and `syncMetadata` cursors reset on `SIGNED_OUT`
  - `LinkDataDialog` shown when unlinked records detected

**AC13 — No regressions:** Existing `useAuthLifecycle` behaviours (session expiry banner, user-initiated sign-out flag, `hydrateSettingsFromSupabase`, `backfillUserId` fire-and-forget) remain intact.

## Tasks / Subtasks

- [ ] Task 1: Add `syncEngine.start()/stop()` to `useAuthLifecycle.ts` (AC: 1, 2, 13)
  - [ ] 1.1 Import `syncEngine` from `@/lib/sync/syncEngine` in `useAuthLifecycle.ts`
  - [ ] 1.2 In the `SIGNED_IN` / `INITIAL_SESSION` branch (after `hydrateSettingsFromSupabase`): call `syncEngine.start(session.user.id)` — fire-and-forget with `.catch(err => console.error(...))`
  - [ ] 1.3 In the `SIGNED_OUT` branch (after existing session-expiry logic): call `syncEngine.stop()`
  - [ ] 1.4 Add comment `// E92-S08: auth-driven sync lifecycle` on each call site
  - [ ] 1.5 In `getSession()` fallback block: also call `syncEngine.start(session.user.id)` if session exists
  - [ ] 1.6 Verify `useAuthLifecycle.ts` compiles without TypeScript errors after changes

- [ ] Task 2: Implement sign-out cleanup (AC: 3)
  - [ ] 2.1 Create `src/lib/sync/clearSyncState.ts` with exported async function `clearSyncState(): Promise<void>`
  - [ ] 2.2 `clearSyncState` must: (a) `await db.syncQueue.clear()`, (b) iterate `syncMetadata` and reset each row: `lastSyncTimestamp = null`, `lastUploadedKey = null`
  - [ ] 2.3 Batch the `syncMetadata` reset using `db.syncMetadata.toCollection().modify(...)` for efficiency
  - [ ] 2.4 Call `clearSyncState()` from the `SIGNED_OUT` handler in `useAuthLifecycle.ts`, fire-and-forget with `.catch(err => console.error('[useAuthLifecycle] clearSyncState failed:', err))`
  - [ ] 2.5 Add `// Intentional: syncQueue and cursor cleared on sign-out; local records preserved` comment

- [ ] Task 3: Implement first-sign-in detection and `LinkDataDialog` (AC: 4, 5, 6, 7, 8)
  - [ ] 3.1 Create `src/lib/sync/hasUnlinkedRecords.ts` — async function `hasUnlinkedRecords(newUserId: string): Promise<boolean>` that queries a representative subset of syncable tables for records where `userId === null || userId !== newUserId`. For performance, use `Promise.any()` — resolve `true` at the first table with a match; no need to scan all 30+ tables exhaustively. Check P0 tables first (contentProgress, studySessions, progress).
  - [ ] 3.2 Create `src/lib/sync/countUnlinkedRecords.ts` — async function `countUnlinkedRecords(newUserId: string): Promise<Record<string, number>>` that returns counts per display category:
    ```ts
    {
      courses: number,      // importedCourses + importedVideos + importedPdfs
      notes: number,        // notes
      books: number,        // books
      flashcards: number,   // flashcards
      other: number,        // everything else with unlinked records
    }
    ```
    Use `SYNCABLE_TABLES` from `backfill.ts` as the source of truth.
  - [ ] 3.3 Create `src/app/components/sync/LinkDataDialog.tsx` — modal Dialog (shadcn/ui `Dialog` with `DialogContent`):
    - No close button on `DialogContent` (remove default X via `DialogContent` `showCloseButton={false}` prop or equivalent — check the project's Dialog variant)
    - `onPointerDownOutside={(e) => e.preventDefault()}` and `onEscapeKeyDown={(e) => e.preventDefault()}` to block dismissal
    - Displays category counts using icons from `lucide-react`
    - "Link to my account" button: `variant="brand"`, triggers link flow (AC5)
    - "Start fresh" button: `variant="outline"` with destructive text color, triggers fresh flow (AC6)
    - Loading spinner state during async operations (disable both buttons while working)
  - [ ] 3.4 Add `useLinkDataDialog` state hook or local state to control dialog visibility (store in a Zustand atom or React context — prefer a simple `useState` in the consuming component for now; promote to store if E97 needs to read it)
  - [ ] 3.5 Call `hasUnlinkedRecords(userId)` inside `syncEngine.start()` (or in `useAuthLifecycle.ts` before calling `start()`) — if `true`, set dialog-open state; if `false`, proceed directly to `syncEngine.fullSync()`. Note: `syncEngine.start()` itself should still be called regardless — it sets `_userId` and `_started`. The dialog gating is about WHETHER `fullSync()` is called immediately, not whether `start()` is called.
  - [ ] 3.6 Mount `<LinkDataDialog>` in `App.tsx` alongside the `useAuthLifecycle()` call, passing open state and handlers as props

- [ ] Task 4: Implement "Link to my account" handler (AC: 5)
  - [ ] 4.1 On confirm: call `await backfillUserId(userId)` (import from `@/lib/sync/backfill`)
  - [ ] 4.2 After backfill: call `syncEngine.fullSync()` fire-and-forget
  - [ ] 4.3 Close dialog
  - [ ] 4.4 Persist "linked" state to localStorage (`sync:linked:${userId} = true`) so dialog does not reappear on subsequent sign-ins with same userId
  - [ ] 4.5 Check the localStorage flag in the detection gate (Task 3.5): if flag is set for the incoming userId, skip dialog entirely

- [ ] Task 5: Implement "Start fresh" handler (AC: 6)
  - [ ] 5.1 On confirm: show a secondary confirmation ("This will delete all local data. Are you sure?") via `window.confirm()` or an inline confirmation state
  - [ ] 5.2 Clear all syncable tables: iterate `SYNCABLE_TABLES` and call `db.table(name).clear()` for each
  - [ ] 5.3 Call `clearSyncState()` to also wipe queue and cursors
  - [ ] 5.4 Call `syncEngine.fullSync()` to download fresh from server
  - [ ] 5.5 Close dialog
  - [ ] 5.6 Persist the same `sync:linked:${userId} = true` flag (user has made a choice; don't ask again)

- [ ] Task 6: Stamp orphaned syncQueue entries on sign-in (AC: 10)
  - [ ] 6.1 After `syncEngine.start(userId)`, query `db.syncQueue.where('userId').equals('')` and any with missing `userId`
  - [ ] 6.2 Use `.modify()` to stamp `userId` on these entries
  - [ ] 6.3 Keep this lightweight — it only targets queue entries, not all Dexie records (that is `backfillUserId`)
  - [ ] 6.4 Wrap in try/catch with `console.error` — must not block sign-in flow

- [ ] Task 7: Write unit tests (AC: 12)
  - [ ] 7.1 Extend `src/app/hooks/__tests__/useAuthLifecycle.test.ts` with new test cases
  - [ ] 7.2 Mock `@/lib/sync/syncEngine`: `{ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() }`
  - [ ] 7.3 Mock `@/lib/sync/clearSyncState`: `{ clearSyncState: vi.fn().mockResolvedValue(undefined) }`
  - [ ] 7.4 Mock `@/lib/sync/hasUnlinkedRecords`: controllable return value
  - [ ] 7.5 Test: `syncEngine.start(userId)` called after `SIGNED_IN` event
  - [ ] 7.6 Test: `syncEngine.start(userId)` called after `INITIAL_SESSION` event
  - [ ] 7.7 Test: `syncEngine.stop()` called after `SIGNED_OUT` event
  - [ ] 7.8 Test: `clearSyncState()` called after `SIGNED_OUT` event
  - [ ] 7.9 Test: existing `hydrateSettingsFromSupabase` and `backfillUserId` calls still fire on SIGNED_IN (regression guard)
  - [ ] 7.10 Test: dialog open state set when `hasUnlinkedRecords` returns `true`

- [ ] Task 8: Verification
  - [ ] 8.1 `npm run test:unit` — all tests pass (new + pre-existing `useAuthLifecycle` tests)
  - [ ] 8.2 `npx tsc --noEmit` — zero TypeScript errors
  - [ ] 8.3 `npm run lint` — zero errors
  - [ ] 8.4 `npm run build` — clean bundle

## Design Guidance

### LinkDataDialog Visual Design

This is a blocking modal. Use the standard shadcn/ui `Dialog` component from `src/app/components/ui/dialog.tsx`.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  🔗  You have local data                          │
│                                                    │
│  We found data saved on this device:              │
│                                                    │
│    📚 12 courses                                   │
│    📝 47 notes                                     │
│    📖 3 books                                      │
│                                                    │
│  What would you like to do?                        │
│                                                    │
│  [Link to my account]     [Start fresh]           │
└──────────────────────────────────────────────────┘
```

- Use `text-brand` for the link icon and title
- Category counts use `text-foreground` with `text-muted-foreground` for labels
- "Link to my account": `variant="brand"` Button (primary CTA)
- "Start fresh": `variant="outline"` Button with `text-destructive` class
- Loading state: replace button text with `<Loader2 className="animate-spin" />` while async ops run
- Dialog width: `max-w-sm` (compact — this is a decision prompt, not a data table)
- No `X` close button — achieved by not rendering the default `DialogClose` component

### Accessibility

- `role="alertdialog"` on `DialogContent` (it demands user action)
- `aria-labelledby` pointing to the dialog title
- `aria-describedby` pointing to the descriptive text
- Focus trapped inside dialog (shadcn/ui Dialog does this via Radix UI)
- Both buttons keyboard-navigable; default focus lands on "Link to my account"

## Implementation Notes

### File Inventory — What Exists, What to Create

| File | State | S08 Action |
|------|-------|------------|
| `src/app/hooks/useAuthLifecycle.ts` | Exists (E43-S04) — already calls `backfillUserId` | **Modify**: add `syncEngine.start/stop` and `clearSyncState` calls |
| `src/lib/sync/backfill.ts` | Exists (E92-S02) — `backfillUserId()` and `SYNCABLE_TABLES` exported | **Read-only**: consume as-is |
| `src/lib/sync/syncEngine.ts` | Exists (E92-S05/S06) — `start(userId)`, `stop()`, `fullSync()` public | **Read-only**: call only |
| `src/lib/sync/clearSyncState.ts` | Does NOT exist | **Create new** |
| `src/lib/sync/hasUnlinkedRecords.ts` | Does NOT exist | **Create new** |
| `src/lib/sync/countUnlinkedRecords.ts` | Does NOT exist | **Create new** |
| `src/app/components/sync/LinkDataDialog.tsx` | Does NOT exist | **Create new** |
| `src/app/App.tsx` | Exists — already calls `useAuthLifecycle()` | **Modify**: mount `<LinkDataDialog>` |

### Current `useAuthLifecycle.ts` State (Do NOT Break These Behaviours)

The file already:
1. Subscribes to `supabase.auth.onAuthStateChange()`
2. Distinguishes user-initiated vs system-initiated sign-out (`_userInitiatedSignOut` flag)
3. Sets `sessionExpired` state for the session expiry banner
4. Calls `hydrateSettingsFromSupabase(session.user.user_metadata)` on sign-in
5. Calls `backfillUserId(session.user.id)` fire-and-forget on sign-in
6. Has a `getSession()` safety-net block for OAuth redirects

S08 adds `syncEngine.start(userId)` AFTER the existing sign-in block and `syncEngine.stop()` + `clearSyncState()` AFTER the existing sign-out block.

### syncEngine Public API (Read Before Calling)

```ts
// From src/lib/sync/syncEngine.ts
syncEngine.start(userId: string): Promise<void>   // sets _userId, _started=true, calls fullSync()
syncEngine.stop(): void                            // sets _started=false, clears debounce timer
syncEngine.fullSync(): Promise<void>               // upload + download all tables
syncEngine.isRunning: boolean                      // read-only: _started value
syncEngine.currentUserId: string | null            // read-only: _userId value
```

**Important:** `start()` calls `fullSync()` internally. Do NOT call `fullSync()` separately after `start()` unless the dialog flow requires it (link/start-fresh handlers call `fullSync()` explicitly after their respective DB operations).

### clearSyncState Pattern

```ts
// src/lib/sync/clearSyncState.ts
import { db } from '@/db'

/**
 * Clears all sync queue entries and resets per-table sync cursors.
 * Called on SIGNED_OUT to ensure the next sign-in starts clean.
 *
 * Local Dexie records (notes, books, etc.) are NOT deleted — only the
 * upload queue and incremental-download cursors.
 *
 * Intentional: local data is preserved on sign-out so the user can still
 * use the app offline. The data will be re-linked or cleared on next sign-in
 * via the LinkDataDialog flow.
 */
export async function clearSyncState(): Promise<void> {
  await db.syncQueue.clear()
  await db.syncMetadata.toCollection().modify((row) => {
    row.lastSyncTimestamp = null
    row.lastUploadedKey = null
  })
}
```

### hasUnlinkedRecords Pattern

```ts
// src/lib/sync/hasUnlinkedRecords.ts
import { db } from '@/db'

/**
 * Returns true if any syncable table contains records with userId = null
 * or userId !== newUserId. Uses Promise.any() for fast short-circuit —
 * stops at the first match without scanning all tables.
 *
 * Checks P0 tables first (most likely to have records in normal usage).
 */
export async function hasUnlinkedRecords(newUserId: string): Promise<boolean> {
  // P0 tables first — most likely to have records
  const checkTables = ['contentProgress', 'studySessions', 'progress',
                        'notes', 'books', 'importedCourses', /* etc */]
  try {
    await Promise.any(
      checkTables.map(async (tableName) => {
        const count = await db
          .table(tableName)
          .filter((r: Record<string, unknown>) =>
            r.userId === null || r.userId === undefined || r.userId !== newUserId
          )
          .count()
        if (count > 0) return true
        throw new Error('none') // trigger Promise.any rejection for this branch
      })
    )
    return true
  } catch {
    // All promises rejected → no unlinked records
    return false
  }
}
```

### First-Sign-In Gate in useAuthLifecycle.ts

```ts
// After existing sign-in handling (hydrateSettingsFromSupabase, backfillUserId):

// E92-S08: Start sync engine
syncEngine.start(session.user.id).catch(err => {
  console.error('[useAuthLifecycle] syncEngine.start failed:', err)
})

// E92-S08: Check for unlinked local data — show dialog if found
const linkedKey = `sync:linked:${session.user.id}`
if (!localStorage.getItem(linkedKey)) {
  hasUnlinkedRecords(session.user.id).then(hasRecords => {
    if (hasRecords) {
      setShowLinkDialog(true) // state setter passed from App.tsx or local state
    } else {
      localStorage.setItem(linkedKey, 'true')
    }
  }).catch(err => {
    // silent-catch-ok: if detection fails, proceed without dialog
    console.error('[useAuthLifecycle] hasUnlinkedRecords failed:', err)
  })
}
```

**Dialog state wiring:** `useAuthLifecycle` does not own dialog state. Two options:
1. (**Preferred**) Pass a `onUnlinkedDetected` callback from `App.tsx` to `useAuthLifecycle`
2. Use a shared Zustand store atom for dialog visibility

Use option 1 (callback) to keep `useAuthLifecycle` dependency-free of UI stores.

### LinkDataDialog Component Skeleton

```tsx
// src/app/components/sync/LinkDataDialog.tsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Loader2 } from 'lucide-react'
import { backfillUserId } from '@/lib/sync/backfill'
import { syncEngine } from '@/lib/sync/syncEngine'
import { clearSyncState } from '@/lib/sync/clearSyncState'
import { countUnlinkedRecords } from '@/lib/sync/countUnlinkedRecords'
import { SYNCABLE_TABLES } from '@/lib/sync/backfill'
import { db } from '@/db'

interface LinkDataDialogProps {
  open: boolean
  userId: string
  onResolved: () => void
}

export function LinkDataDialog({ open, userId, onResolved }: LinkDataDialogProps) {
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (open) {
      countUnlinkedRecords(userId).then(setCounts).catch(console.error)
    }
  }, [open, userId])

  async function handleLink() {
    setLoading(true)
    try {
      await backfillUserId(userId)
      syncEngine.fullSync().catch(err => console.error('[LinkDataDialog] fullSync error:', err))
      localStorage.setItem(`sync:linked:${userId}`, 'true')
      onResolved()
    } finally {
      setLoading(false)
    }
  }

  async function handleStartFresh() {
    if (!window.confirm('This will delete all local data on this device. Are you sure?')) return
    setLoading(true)
    try {
      for (const tableName of SYNCABLE_TABLES) {
        await db.table(tableName).clear()
      }
      await clearSyncState()
      syncEngine.fullSync().catch(err => console.error('[LinkDataDialog] fullSync error:', err))
      localStorage.setItem(`sync:linked:${userId}`, 'true')
      onResolved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={() => { /* intentional no-op — dialog is non-dismissible */ }}
    >
      <DialogContent
        role="alertdialog"
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Remove close button — DialogContent may expose showCloseButton prop,
        // or override via CSS: [&>button]:hidden
      >
        <DialogHeader>
          <DialogTitle>You have local data</DialogTitle>
          <DialogDescription>
            We found data saved on this device. What would you like to do?
          </DialogDescription>
        </DialogHeader>

        {/* Category counts */}
        <div className="space-y-1 text-sm">
          {Object.entries(counts).map(([category, count]) =>
            count > 0 ? (
              <div key={category} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{category}</span>
                <span className="font-medium">{count}</span>
              </div>
            ) : null
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="brand"
            className="flex-1"
            disabled={loading}
            onClick={handleLink}
          >
            {loading ? <Loader2 className="animate-spin size-4" /> : 'Link to my account'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            disabled={loading}
            onClick={handleStartFresh}
          >
            Start fresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### App.tsx Integration

```tsx
// App.tsx — add alongside existing hooks:
const [showLinkDialog, setShowLinkDialog] = useState(false)
const [linkDialogUserId, setLinkDialogUserId] = useState<string>('')

useAuthLifecycle({
  onUnlinkedDetected: (userId) => {
    setLinkDialogUserId(userId)
    setShowLinkDialog(true)
  }
})

// ... elsewhere in JSX:
<LinkDataDialog
  open={showLinkDialog}
  userId={linkDialogUserId}
  onResolved={() => setShowLinkDialog(false)}
/>
```

**Note:** This requires changing `useAuthLifecycle()` signature to accept an options object. Alternatively, use a Zustand store for dialog visibility. Choose whichever keeps the component graph cleanest — the options object approach is preferred to avoid adding a new Zustand dependency just for dialog state.

### syncQueue Orphan Stamping (Task 6)

```ts
// After syncEngine.start(userId) is called:
// Stamp any queue entries that were enqueued before auth was established
db.syncQueue
  .filter((entry) => !entry.userId || entry.userId === '')
  .modify((entry) => { entry.userId = userId })
  .catch(err => console.error('[useAuthLifecycle] syncQueue stamp failed:', err))
```

This is separate from `backfillUserId` (which stamps Dexie content records). Queue entries were enqueued by `syncableWrite` when no user was authenticated — they should be uploaded under this userId now.

### Do NOT Do

- Do NOT rewrite `backfillUserId` — it exists and works; call it
- Do NOT call `syncEngine.fullSync()` from `useAuthLifecycle` directly after `start()` — `start()` calls `fullSync()` internally
- Do NOT call `syncEngine.start()` from `useSyncLifecycle.ts` (E92-S07) — that hook only calls `nudge()` and `fullSync()`
- Do NOT modify `syncEngine.ts` — its public API is complete
- Do NOT add UI to `useSyncLifecycle.ts` — it has no JSX

## Testing Notes

### Key Test Scenarios

1. **Happy path sign-in (no unlinked records):** `SIGNED_IN` event → `start()` called, no dialog shown
2. **First-sign-in with local data:** `SIGNED_IN` + `hasUnlinkedRecords` returns `true` → dialog appears
3. **Link flow:** Dialog "Link to my account" → `backfillUserId` called, `fullSync` called, dialog closes
4. **Start fresh flow:** Dialog "Start fresh" + confirm → all tables cleared, `clearSyncState`, `fullSync`, dialog closes
5. **Sign-out:** `SIGNED_OUT` → `stop()` called, `clearSyncState()` called
6. **Repeated sign-in same user:** `localStorage.getItem('sync:linked:userId')` truthy → no dialog
7. **Regression: existing sign-in behaviours** — `hydrateSettingsFromSupabase` and `backfillUserId` still fire

### Mock Strategy

```ts
vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    fullSync: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
    currentUserId: null,
  }
}))

vi.mock('@/lib/sync/clearSyncState', () => ({
  clearSyncState: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/sync/hasUnlinkedRecords', () => ({
  hasUnlinkedRecords: vi.fn().mockResolvedValue(false)
}))

vi.mock('@/lib/sync/backfill', () => ({
  backfillUserId: vi.fn().mockResolvedValue({ tablesProcessed: 0, recordsStamped: 0, tablesFailed: [] }),
  SYNCABLE_TABLES: ['contentProgress', 'notes']
}))
```

### Edge Cases

- `syncEngine.start()` rejects: must not crash sign-in flow — catch and log
- `hasUnlinkedRecords` rejects: treat as "no unlinked records", proceed silently
- `countUnlinkedRecords` rejects: show empty counts in dialog, don't crash
- User opens two tabs simultaneously: dialog may appear in both — `localStorage` flag prevents double-action if one tab finishes first
- `db.table(name).clear()` fails for one table in "Start fresh": log error, continue clearing remaining tables; close dialog

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — all async chains have `.catch(err => console.error(...))` with meaningful labels
- [ ] `useAuthLifecycle` signature change is backward-compatible (optional options object, not a breaking change)
- [ ] `LinkDataDialog` has no close button and blocks keyboard/pointer dismissal (`onPointerDownOutside`, `onEscapeKeyDown`)
- [ ] `clearSyncState` does NOT delete local Dexie content records — only queue and cursors
- [ ] `syncEngine.start()` is NOT called from `useSyncLifecycle.ts` — only from `useAuthLifecycle`
- [ ] `localStorage` flag `sync:linked:${userId}` is set after both dialog flows complete
- [ ] `window.confirm()` used in "Start fresh" (or equivalent) — destructive actions need confirmation
- [ ] `backfillUserId` import is from `@/lib/sync/backfill` (NOT re-implemented inline)
- [ ] `SYNCABLE_TABLES` imported from `@/lib/sync/backfill` (not hardcoded) in `clearAllLocalData`
- [ ] `tsc --noEmit` — zero TypeScript errors
- [ ] `npm run test:unit` — all tests pass (new + pre-existing `useAuthLifecycle` tests)
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — clean
- [ ] AC → UI trace: `LinkDataDialog` is visible and interactive when `open=true`; both buttons work; loading state shows during async operations
- [ ] ARIA: `role="alertdialog"` on `DialogContent`; `aria-labelledby`/`aria-describedby` wired
- [ ] At every non-obvious catch block: `// silent-catch-ok` or `// Intentional:` comment with reason

## Design Review Feedback

N/A — minor dialog UI; will be populated by /review-story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**Context from E92-S07:** `useSyncLifecycle.ts` intentionally does NOT call `syncEngine.start()` or `syncEngine.stop()`. The engine defaults `_started = true` so nudge/fullSync work from S07 without auth. S08 owns auth-driven start/stop — these are separate concerns.

**Context from E92-S02 revert:** `backfill.ts` was implemented as part of the E92-S03 revert cycle. Verify `src/lib/sync/backfill.ts` exists and exports `backfillUserId` and `SYNCABLE_TABLES` before starting implementation.

**Key design decision — callback over Zustand for dialog state:** `useAuthLifecycle` is a side-effect hook, not a UI hook. Passing an `onUnlinkedDetected` callback from `App.tsx` keeps the hook pure (no Zustand import for UI state). This avoids adding a new store dependency and is easier to test.

**Key design decision — `start()` always called, dialog gates `fullSync()`:** `syncEngine.start()` must be called on every sign-in to set `_userId` and `_started`. The dialog only gates whether `fullSync()` runs immediately (it does not in the dialog flow — `fullSync` is called after the user makes a choice). `start()` calling `fullSync()` internally is the problem here. **Resolve this by checking the actual `syncEngine.start()` implementation** — if `start()` calls `fullSync()` internally (per S06 design), then the dialog detection must happen BEFORE calling `start()`, and `start()` should be called only after the user makes a choice (or use `syncEngine._userId = userId` directly if a lower-level setter is available). Check `syncEngine.ts` lines 110–160 for the actual `start()` implementation before coding Task 1.
