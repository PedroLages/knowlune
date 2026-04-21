# E97-S02 — Sync Settings Panel — Requirements

**Date:** 2026-04-19
**Epic:** E97 — Sync UX Polish
**Story:** E97-S02 — Sync Settings Panel
**Related:** E97-S01 (Sync Status Indicator in Header), E92-S07 (Sync triggers + useSyncStatusStore), E92-S08 (clearSyncState)

---

## 1. Problem Statement

E97-S01 shipped a passive header-level sync indicator that surfaces real-time status. Users still lack direct controls:

- They can't pause auto-sync (e.g., on metered connections or to reduce battery).
- They can't force a manual sync without triggering an arbitrary write.
- They can't recover from a corrupted local cache without signing out and back in — and even sign-out preserves Dexie by design (`clearSyncState` only clears sync state, not user data).

A dedicated **Sync Settings Panel** inside the Settings page closes those gaps while remaining consistent with the existing settings architecture (`SETTINGS_CATEGORIES`, `SettingsPageContext`, localStorage-backed `AppSettings`).

## 2. User Value

- **Trust**: Clear, human-readable evidence of "everything is synced" reduces anxiety about data loss.
- **Control**: Auto-sync toggle respects battery/bandwidth-constrained contexts (mobile data, airplane mode preparation).
- **Recovery**: "Clear local data and re-sync" gives users a self-service way out of local-DB corruption or stale conflict copies — today this requires manual IndexedDB deletion from DevTools.

## 3. Acceptance Criteria (summary)

| # | Criterion |
|---|-----------|
| AC1 | Sync section renders with an Auto-sync toggle that pauses/resumes `syncEngine` |
| AC2 | Section shows "last sync" timestamp + total synced items + pending-upload count |
| AC3 | "Sync Now" button triggers `syncEngine.fullSync()` with inline progress + toast feedback |
| AC4 | "Clear local data and re-sync" destructive action with AlertDialog confirmation wipes Dexie then re-downloads |
| AC5 | Section hidden when user is unauthenticated (Zustand-reactive) |
| AC6 | All preferences persist via existing `AppSettings` / `saveSettings()` pattern |

Full Given/When/Then format in the story file.

## 4. Research Summary

### 4.1 `src/app/pages/Settings.tsx`
Root Settings page uses `SettingsPageProvider` + `SettingsLayout` + `SettingsSearch`. Six categories defined in `src/app/components/settings/layout/settingsCategories.ts`: account, profile, appearance, learning, notifications, integrations. `getModifiedCategories()` detects customized settings per category and drives a visual indicator. New nav entries require updates to:
1. `SETTINGS_CATEGORIES` array
2. `SettingsCategorySlug` union
3. `settingsSearchIndex.ts`
4. `getModifiedCategories()` (if defaults can differ)

### 4.2 `src/app/stores/useSyncStatusStore.ts`
Zustand store with:
- `status: 'synced' | 'syncing' | 'offline' | 'error'`
- `pendingCount: number`
- `lastSyncAt: Date | null`
- `lastError: string | null`
- `setStatus`, `markSyncComplete`, `refreshPendingCount` actions

All four fields are needed by this story. Exposed on `window.__syncStatusStore` in dev/test for E2E access. Comment in file already flags "E97-S02 settings panel" as consumer.

### 4.3 `src/app/hooks/useSyncLifecycle.ts`
Wires sync triggers: initial `fullSync()` on mount, 30s nudge interval, tab focus nudge, online→fullSync, offline→status, sendBeacon on unload. **Does not** currently check a user pref — this story will add an `autoSyncEnabled` gate:

- Skip initial `fullSync()` when `autoSyncEnabled === false`
- Skip `setInterval` tick when disabled
- Listen for `settingsUpdated` event and start/stop engine dynamically

### 4.4 `src/lib/sync/syncEngine.ts` (public API)
```
syncEngine.nudge(): void                        // debounced upload trigger
syncEngine.start(userId: string): Promise<void> // begin lifecycle, runs fullSync
syncEngine.stop(): void                         // halt (cancels debounce, clears _userId)
syncEngine.fullSync(): Promise<void>            // upload then download
syncEngine.registerStoreRefresh(table, cb): void
syncEngine.isRunning: boolean
syncEngine.currentUserId: string | null
```

"Sync Now" → `fullSync()`. Auto-sync toggle → `start()`/`stop()`. `_started` flag already gates `nudge()` so `stop()` is safe mid-cycle.

### 4.5 `src/lib/sync/clearSyncState.ts`
Clears `db.syncQueue` + resets `lastSyncTimestamp` in `syncMetadata`. **Does NOT** clear user data tables. For AC4 we need a new `resetLocalData()` helper that additionally iterates `tableRegistry` and calls `db.<table>.clear()` on every syncable Dexie table (skipping `skipSync` + `uploadOnly` where appropriate — though for a full reset we clear those too, since they'll re-derive).

### 4.6 User settings store
No `useUserSettingsStore.ts` exists. Settings use a **function-based module**: `src/lib/settings.ts` with `getSettings()`, `saveSettings(patch, { syncToSupabase })`, and a `settingsUpdated` window event for cross-component reactivity. We add `autoSyncEnabled?: boolean` (default `true`) to the `AppSettings` interface + `defaults` const. No new store is needed.

Server-side persistence (Supabase `user_settings` JSONB) is optional and can be deferred — localStorage is source of truth.

### 4.7 UI primitives (in `src/app/components/ui/`)
- `switch.tsx` — Radix-based toggle
- `button.tsx` — supports `variant="brand" | "destructive"`
- `alert-dialog.tsx` — shadcn primitive; already used in `IntegrationsDataSection` for destructive flows (reference pattern)
- `card.tsx`, `separator.tsx`, `label.tsx`, `spinner.tsx` (custom spinner), `tooltip.tsx`

All needed primitives already exist — no new UI components required.

### 4.8 Auth state
`useAuthStore` exposes `user: User | null` and `initialized`. The Sync section gates on `user !== null`. `SettingsPageContext` already surfaces `user` + `authSignOut` — reuse via `useSettingsPage()` for auth access and toast helpers.

## 5. Open Questions (to resolve in planning)

1. **Category placement**: New top-level `'sync'` category OR sub-section inside existing `'account'` / `'integrations'`? Top-level parallels the header indicator and surfaces the feature clearly; nesting conserves nav real estate. Recommend top-level with `RefreshCw` icon.
2. **"Total synced items" definition**: Sum of all Dexie syncable tables? Per-category breakdown? Single aggregate is simpler; a collapsible per-table breakdown could be a nice enhancement.
3. **Post-reset UX**: Hard `location.reload()` OR soft re-render via `registerStoreRefresh` callbacks? Hard reload is safest (guarantees all in-memory Zustand caches rehydrate) but jarring. Prefer soft re-render if the download phase's existing refresh callbacks cover all stores.
4. **Server-side persistence of `autoSyncEnabled`**: Deferred. localStorage is sufficient for MVP; sync-the-sync-setting creates a chicken-and-egg problem.
5. **What about storage buckets (audio, images)?** The destructive reset clears Dexie rows; binary blobs in IndexedDB object stores or in Supabase Storage are re-downloaded via `STORAGE_DOWNLOAD_TABLES` during `fullSync`. No separate cache clear needed.

## 6. Non-Goals

- Per-table sync pause controls (global toggle only).
- Conflict resolution UI (already handled by `conflict-copy` strategy on notes).
- Syncing the `autoSyncEnabled` preference itself to Supabase.
- Sign-out flow changes (already handled in E92-S08).

## 7. Dependencies

- **E92-S07** (`useSyncStatusStore`, `useSyncLifecycle`) — ✅ merged
- **E92-S08** (`clearSyncState`, `syncEngine.start/stop`) — ✅ merged
- **E97-S01** (header indicator, extra store fields like `lastError`) — ✅ merged
- New helper `resetLocalData()` — to be implemented in this story

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Destructive reset loses un-synced writes | Medium | AlertDialog copy explicitly warns; optionally flush `syncQueue` upload first before clearing |
| Auto-sync disabled → user forgets → silent data divergence across devices | Medium | Header indicator (E97-S01) shows pending count; "paused" state distinct from "offline" |
| Toggling Auto-sync rapidly triggers race between `start()` and `stop()` | Low | `_started` flag + debounce on toggle; lock UI during transition |
| Race between reset and in-flight upload cycle | Medium | Call `syncEngine.stop()` first, await any in-flight cycle (locks), then wipe |
| Soft re-render misses a store → stale UI | Medium | Default to hard `location.reload()` for MVP; optimize later |
| Total item count query is slow on large DBs | Low | Compute once on mount + after successful sync; cache in memoized state |

## 9. Success Metrics (post-ship)

- % of signed-in users who open the Sync section within first 7 days (exploration).
- Count of "Sync Now" clicks per user per week (indicator of trust/friction).
- Count of "Clear local data" confirmations (support-burden proxy — if high, sync engine needs more work).
- Zero reports of data loss attributable to this UI.

## 10. Confidence

Requirements are well-grounded in existing APIs — all building blocks exist. The main design decision is category placement (plan-phase). Story confidence: **high**.
