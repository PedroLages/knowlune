# E97-S03 Initial Upload Wizard — Requirements

**Date:** 2026-04-19
**Story:** E97-S03
**Epic:** E97 Sync UX Polish
**Related stories:** E97-S01 (header sync indicator), E97-S02 (Sync Settings Panel), E92-S08 (auth lifecycle + LinkDataDialog)

## 1. Problem Statement

When an existing Knowlune user signs in for the first time on a device that already has local Dexie data (either from pre-sync usage or from another session), the existing sync pipeline starts uploading silently. The user sees the small header indicator (E97-S01) change to "syncing" and eventually to "synced", but nothing explains:

- Why their device is doing work.
- How much data is left to upload.
- That it is safe to navigate away.
- That they can defer the upload if the timing is inconvenient.

We need a one-time, friendly onboarding modal that wraps the first authenticated full-sync cycle and provides visibility + user control — without changing the sync engine itself.

## 2. Scope

### In scope

- A new `InitialUploadWizard` React modal component rendered at App.tsx root (same layer as `LinkDataDialog`).
- A `shouldShowInitialUploadWizard(userId)` guard helper (Dexie + localStorage read).
- A `useInitialUploadProgress()` hook that derives progress from `db.syncQueue` polling.
- localStorage persistence of two flags:
  - `sync:wizard:complete:<userId>` — permanent (per device, per user).
  - `sync:wizard:dismissed:<userId>` — session-scoped.
- Integration with `useAuthLifecycle` / App.tsx so the wizard appears after `LinkDataDialog` resolves (or immediately if unlinked data was not present).
- Unit tests and one E2E spec (`tests/e2e/story-97-03.spec.ts`).

### Out of scope

- Any new primitive in `src/lib/sync/syncEngine.ts` — the engine stays untouched (AC6 invariant).
- Event-based progress (no pub/sub from the engine).
- Multi-device progress reporting (only this device's queue).
- Upload cancellation — the wizard can be skipped but not cancelled.
- Progress for the download phase — only the upload phase needs explanation.

## 3. Current-State Research

### 3.1 `src/app/hooks/useSyncLifecycle.ts`

- Hook is mounted once at App root; runs initial `fullSync()` on mount if `autoSyncEnabled !== false`.
- After initial fullSync settles, `markSyncComplete()` sets `status='synced'` + `lastSyncAt = new Date()`.
- The hook itself does not know about userId or "is this the first sync for this device?" — it unconditionally runs fullSync on mount.
- Trigger point for wizard is therefore NOT inside this hook; the auth lifecycle is the correct place because it has userId context and already orchestrates `LinkDataDialog`.

### 3.2 `src/app/hooks/useAuthLifecycle.ts`

- `handleSignIn(userId, userMetadata)` already has the two key code paths the wizard needs to slot into:
  - **Fast-path (already linked):** immediately calls `backfillUserId` + `syncEngine.start(userId)`. The wizard should evaluate its open condition here after `start()` is kicked off.
  - **Unlinked-records path:** calls `onUnlinkedDetected(userId)` which opens `LinkDataDialog`. The dialog's `onResolved` callback (in App.tsx) is the place to evaluate the wizard's open condition so the two modals never co-appear.
- Adding a second optional callback `onPostAuthReady?: (userId) => void` would keep the hook pure. Alternatively, App.tsx can evaluate `shouldShowInitialUploadWizard` inside the existing `onUnlinkedDetected` side + mirror the call in the fast-path via a small auth-store subscription.
- `useAuthStore.user` is the authoritative userId source for other consumers (see `useSyncLifecycle.ts` line 307).

### 3.3 `src/lib/sync/syncEngine.ts`

- `fullSync()` exists (line 1139) as a public API: "Can be called without `start()` — useful for tests and E92-S07 triggers. Does not propagate exceptions to the caller."
- The engine does NOT expose progress events, item counts, or per-table completion hooks. We deliberately do not add any, per AC6.
- `_doUpload()` drains `db.syncQueue` in batches of `BATCH_SIZE`, so the most practical progress signal is `db.syncQueue.where('status').equals('pending').count()` polled from outside the engine.
- `start(userId)` writes `_started = true` + `_userId = userId` and immediately runs `_doFullSync()`. The wizard uses the existing `start()` flow via `useAuthLifecycle` — no direct calls needed unless the user clicks "Retry" on the error state.

### 3.4 `src/app/stores/useSyncStatusStore.ts`

- Provides `status: 'synced' | 'syncing' | 'offline' | 'error'` and `lastError: string | null`.
- `markSyncComplete()` fires on every successful sync; the wizard uses `status === 'synced' && pendingCount === 0` as its success condition.
- Dev/test builds expose the store on `window.__syncStatusStore` — useful for the E2E spec.

### 3.5 `src/lib/sync/tableRegistry.ts`

- Central list of all syncable Dexie tables with priority tiers (P0–P4). For progress "per-table" display we will map `tableName` → a humanized label (e.g. `notes` → "Notes", `flashcards` → "Flashcards").
- No changes needed to the registry.

### 3.6 `src/lib/settings.ts` — `AppSettings`

- Already added `autoSyncEnabled?: boolean` in E97-S02.
- The wizard's flags (`sync:wizard:complete:<userId>`, `sync:wizard:dismissed:<userId>`) are deliberately stored as separate localStorage keys rather than added to `AppSettings`, because:
  - They are per-user, not per-app (AppSettings is per-device, not per-user).
  - They should not be serialized into `user_metadata` on Supabase hydrate (would leak completion state across devices and defeat the "per device" semantics).

### 3.7 UI primitives in `src/app/components/ui/`

- `dialog.tsx` — shadcn `Dialog` with `DialogContent`, `DialogOverlay`, `DialogPortal`. `LinkDataDialog` uses the raw radix primitives because it is non-dismissible; the wizard can use `DialogContent` because overlay clicks dismissing is acceptable (same as "Skip").
- `progress.tsx` — shadcn `Progress` (Radix indicator, respects `bg-brand-soft` and `bg-brand` tokens).
- `button.tsx` — `variant="brand"`, `variant="ghost"` for the primary/secondary pair.
- `sonner.tsx` / `toast` — existing success pattern.

### 3.8 `src/stores/`

- `useAuthStore.user?.id` — primary source for userId.
- `useSessionStore` and other content stores — wizard does NOT subscribe to them; all progress is derived from `db.syncQueue`.

### 3.9 `src/app/components/sync/LinkDataDialog.tsx`

- Uses `countUnlinkedRecords(userId)` to display category breakdown and `backfillUserId(userId)` to stamp unlinked rows. After backfill, the records will generate `syncQueue` entries via the normal `syncableWrite` path — these are precisely what the wizard will count.
- Resolution paths in App.tsx ("Link to my account" or "Start fresh") both end with `onResolved()`. That callback is the hook-point for the wizard evaluation.

## 4. Functional Requirements

### FR1 — Detection

Expose `shouldShowInitialUploadWizard(userId: string): Promise<boolean>`:

- Returns `false` if `localStorage.getItem('sync:wizard:complete:<userId>')` is non-null.
- Returns `true` if either:
  - `db.syncQueue.where('status').equals('pending').count() > 0`, OR
  - `hasUnlinkedRecords(userId)` resolves to `true`.
- Returns `false` otherwise.

### FR2 — Progress derivation

Expose `useInitialUploadProgress()`:

- Snapshots `total = pendingQueueCount + unlinkedRowCount` on first render.
- Polls `pendingQueueCount` every 500ms.
- Exposes `{ processed, total, recentTable, done }` where `processed = total - currentPending` clamped to `[0, total]` and `done = pending === 0`.
- `recentTable` is updated whenever the most recent `syncQueue` scan returns a different top-row `tableName`.
- Cleans up its interval on unmount.

### FR3 — Wizard states

- `intro` — default open state. Shows total count + "Start upload" + "Skip for now".
- `uploading` — after clicking Start OR if a sync was already running when wizard opened (fast-path). Shows progress.
- `success` — triggered when `useSyncStatusStore.status === 'synced' && processed === total`. Writes completion flag + toast.
- `error` — triggered when `useSyncStatusStore.status === 'error'`. Shows `lastError`, Retry, Close.

### FR4 — Persistence

- On success: `localStorage['sync:wizard:complete:<userId>'] = new Date().toISOString()`.
- On skip: `localStorage['sync:wizard:dismissed:<userId>'] = new Date().toISOString()`.
- On sign-out (in `useAuthLifecycle` SIGNED_OUT branch): clear `sync:wizard:dismissed:<userId>` (but NOT the completion flag — per-device completion should persist across sign-out/in cycles for the same account).

### FR5 — Mount ordering

App.tsx renders `<InitialUploadWizard />` alongside `<LinkDataDialog />` gated on a local `showWizard` state. `showWizard` is set to `true` by:

1. The `onUnlinkedDetected` handler's `onResolved` callback after checking `shouldShowInitialUploadWizard(userId)`.
2. A `useEffect` subscribed to `useAuthStore.user` that, when the user becomes non-null AND the link dialog is not open, runs the same check.

## 5. Non-Functional Requirements

- **Performance:** 500ms polling of `syncQueue.count()` is negligible on modern browsers (Dexie count() is O(log N) on indexed column). No UI jank.
- **A11y:** Dialog follows shadcn/Radix defaults (focus trap, Escape, ARIA labels). Progress text uses `aria-live="polite"` so screen readers announce count updates without double-announcing the bar.
- **Responsive:** Modal collapses to full-height sheet on <640px, buttons stack full-width.
- **i18n:** Strings are hard-coded English for now (matches rest of app pre-i18n-epic).
- **Reduced motion:** Checkmark animation in success state is replaced with static icon when `prefers-reduced-motion: reduce`.
- **Observability:** Wizard mount + completion logged via `console.info('[InitialUploadWizard] …')`; errors via `console.error`.

## 6. Edge Cases

- **Sign-in with no pending queue but unlinked rows:** After `LinkDataDialog` "Link to my account" fires `backfillUserId`, the stamped rows generate `syncQueue` entries. The wizard evaluation must happen AFTER backfill has enqueued entries — tested by re-evaluating `shouldShowInitialUploadWizard` in the `onResolved` callback.
- **Offline during wizard:** `useSyncStatusStore.status` transitions to `'offline'`. Wizard should show a neutral "Waiting for connection…" message (subset of `uploading` state), not the error state.
- **Sign-out mid-wizard:** `useAuthStore.user === null` — wizard should unmount (render guard on userId).
- **Multiple accounts on same device:** Keys are scoped by userId so each account sees the wizard exactly once.
- **Queue draining faster than poll interval:** If `pending` drops from N → 0 between polls, the `processed === total` condition still fires on the next tick. Safe.
- **`fullSync()` throws before any upload:** `useSyncStatusStore.status === 'error'` within 1 tick → wizard shows error state immediately.
- **User clicks Skip after partial upload:** Modal closes, sync continues, completion flag is NOT written. On next sign-in (same session), wizard is shown again because dismissed flag ≠ complete flag.
- **User clicks Skip, completes signed-in session without full drain, signs out, signs back in:** Dismissal flag was cleared on sign-out (FR4). If pending queue still has items, wizard re-appears. If queue is drained, completion flag gets written on first new sync completion? No — the wizard only writes the completion flag when the modal is visible. Acceptable: the wizard reappears once, confirms empty state, writes the flag via AC5 silent no-op path guard (or user completes fresh).

## 7. Open Questions for Planner

1. Should the completion flag auto-write if the silent no-op path triggers (AC5)? Proposed: yes — when `shouldShowInitialUploadWizard` returns `false` solely because the DB is fully synced (not because the flag was already set), proactively write the flag so future checks short-circuit.
2. Should the wizard auto-start the upload on mount, or require a click? Proposed: require a click — reinforces that this is the user's device and they control the timing. Fast-path (already-linked) users may have sync already running; in that case the wizard opens directly in `uploading` state.
3. Per-table label humanization — ship a minimal map for top 6 tables (`notes`, `flashcards`, `bookmarks`, `books`, `progress`, `studySessions`) and fall back to the raw table name for the rest? Proposed: yes, and add to registry entry in a follow-up if needed.
4. Localization — defer i18n to the localization epic (no changes here).

## 8. Success Criteria

- New user signing in for the first time on an existing device sees a friendly wizard explaining the upload, can watch progress, and can dismiss if busy.
- Wizard never appears twice on the same device for the same account.
- Wizard never appears at all for fresh devices.
- No changes to `syncEngine.ts` (invariant verified by diff).
- All E97 acceptance criteria met.

## 9. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Wizard flickers open then closes on fresh devices | Gate mount on resolved promise from `shouldShowInitialUploadWizard`; render nothing until resolved |
| Race with `LinkDataDialog` | Evaluate wizard condition only in `onResolved`; fast-path checks `useAuthStore.user` and falls through only when dialog was never shown |
| Progress stalls at 99% forever | Poll timeout → if `pending === 0 && status === 'synced'`, force `done = true` |
| User loses unsynced data if they skip + close tab before sync completes | Not a regression — this is the current behavior without the wizard; sync continues in background tab and resumes next session |
| localStorage quota exhausted (unlikely) | Writes are short ISO strings (<50 bytes); catch + log silently |

## 10. References

- Story file: [E97-S03-initial-upload-wizard.md](../implementation-artifacts/stories/E97-S03-initial-upload-wizard.md)
- E97-S01 indicator: [E97-S01-sync-status-indicator-header.md](../implementation-artifacts/stories/E97-S01-sync-status-indicator-header.md)
- E97-S02 settings panel: [E97-S02-sync-settings-panel.md](../implementation-artifacts/stories/E97-S02-sync-settings-panel.md)
- E92-S08 auth lifecycle: `src/app/hooks/useAuthLifecycle.ts`, `src/app/components/sync/LinkDataDialog.tsx`
- Engine public API: `src/lib/sync/syncEngine.ts` lines 1068–1160
- Status store contract: `src/app/stores/useSyncStatusStore.ts`
