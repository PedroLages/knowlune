---
title: "feat: E97-S02 Sync Settings Panel"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e97-s02-sync-settings-panel-requirements.md
---

# feat: E97-S02 Sync Settings Panel

## Overview

Add a user-facing "Sync" section to the Knowlune Settings page so signed-in users can inspect sync status, pause or resume auto-sync, trigger a manual sync, and (as an escape hatch) wipe local Dexie data and re-download from Supabase. Builds on top of E97-S01's header indicator and the E92 sync engine — no new backend or schema changes are required. Preference persistence reuses the existing `AppSettings` pattern in `src/lib/settings.ts`.

## Problem Frame

E97-S01 shipped a passive header-level sync indicator. Users still have no UI to:

- Pause sync on metered connections or to conserve battery.
- Force a manual `fullSync()` without triggering an arbitrary write.
- Recover from local-DB corruption or stale conflict copies without using DevTools.

`useSyncStatusStore`, `syncEngine.start/stop/fullSync`, and `clearSyncState()` already exist; this story assembles them behind a Settings-page UI. (see origin: `docs/brainstorms/2026-04-19-e97-s02-sync-settings-panel-requirements.md`)

## Requirements Trace

- R1 (AC1): Auto-sync toggle pauses/resumes `syncEngine`, backed by persisted preference.
- R2 (AC2): Surface `lastSyncAt`, aggregate synced-item count, and `pendingCount`.
- R3 (AC3): "Sync Now" button invokes `syncEngine.fullSync()` with inline progress + toast feedback.
- R4 (AC4): "Clear local data and re-sync" destructive flow behind AlertDialog confirmation — wipes Dexie data tables + `clearSyncState()` + restarts engine.
- R5 (AC5): Section is hidden when `useAuthStore.user` is null and appears reactively on sign-in.
- R6 (AC6): `autoSyncEnabled` preference persists through `AppSettings` / `saveSettings()`.

## Scope Boundaries

- No per-table sync pause controls (global toggle only).
- No conflict-resolution UI (already handled by `conflict-copy` strategy on notes).
- No syncing of the `autoSyncEnabled` preference itself to Supabase — localStorage is sufficient.
- Sign-out/sign-in flow unchanged (already handled in E92-S08).
- No new Supabase schema or RPC changes.

### Deferred to Separate Tasks

- Server-side persistence of `autoSyncEnabled` in `user_settings` JSONB: future iteration once the "sync the sync setting" chicken-and-egg story is worth solving.
- Per-table breakdown of synced items: possible follow-up as a collapsible section once user feedback is gathered.

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/Settings.tsx` — uses `SettingsPageProvider` + `SettingsLayout` + `SettingsSearch`; listens to `settingsUpdated` window event for reactivity.
- `src/app/components/settings/layout/settingsCategories.ts` — category registry; adding a new nav entry requires updating this file, `SettingsCategorySlug`, `settingsSearchIndex.ts`, and `getModifiedCategories()`.
- `src/app/components/settings/sections/IntegrationsDataSection.tsx` — reference pattern for destructive flows using shadcn `AlertDialog` + `Card` + `Separator`.
- `src/app/components/settings/SettingsPageContext.tsx` — surfaces `user`, `authSignOut`, and auth-dialog controls via `useSettingsPage()`.
- `src/app/stores/useSyncStatusStore.ts` — Zustand store (`status`, `pendingCount`, `lastSyncAt`, `lastError`, `markSyncComplete`, `refreshPendingCount`).
- `src/app/hooks/useSyncLifecycle.ts` — drives initial `fullSync()`, 30s nudge interval, online/offline handlers; must be gated on new pref.
- `src/lib/sync/syncEngine.ts` — public `start(userId)`, `stop()`, `fullSync()`, `nudge()`.
- `src/lib/sync/clearSyncState.ts` — clears `syncQueue` + resets `syncMetadata` cursors; preserves user data by design.
- `src/lib/sync/tableRegistry.ts` — source-of-truth for all syncable Dexie tables; iterate here for destructive wipe.
- `src/lib/settings.ts` — `AppSettings` + `getSettings()` / `saveSettings()` + `settingsUpdated` event pattern.
- `src/stores/useAuthStore.ts` — `user: User | null`, `initialized` (use for auth gating).
- `src/app/components/ui/switch.tsx`, `alert-dialog.tsx`, `button.tsx`, `card.tsx`, `spinner.tsx`, `tooltip.tsx` — all primitives already available.

### Institutional Learnings

- **`reference_sync_engine_api.md`** — `fullSync()` is the correct entry point for manual sync, not `nudge()` (upload-only, debounced 200ms).
- **Design token enforcement** — ESLint blocks hardcoded Tailwind colors; use `text-destructive`, `text-success`, `text-muted-foreground`.
- **`reference_dexie_4_quirks.md`** — Dexie 4 `sortBy` returns `Promise<T[]>`; prefer `toArray()` + JS sort.
- **Settings are offline-first** — localStorage is source of truth; Supabase sync is best-effort fire-and-forget.

### External References

- shadcn AlertDialog pattern (already used in `IntegrationsDataSection`) — no external research required.

## Key Technical Decisions

- **New top-level nav category `'sync'`** (not nested in `account`) with `RefreshCw` icon — parallels E97-S01 header affordance and gives the feature enough surface area to discover.
- **localStorage-only preference persistence** — `autoSyncEnabled?: boolean` added to `AppSettings`; `undefined` treated as `true` for backward compatibility.
- **Separate helper `resetLocalData(userId)`** in `src/lib/sync/resetLocalData.ts` rather than extending `clearSyncState()` — keeps sign-out semantics unchanged while centralizing the destructive reset behind one tested entry point.
- **Soft re-render on reset** preferred over hard `location.reload()` — the engine's `registerStoreRefresh` callbacks already fire after download; if integration testing reveals stale-cache issues during implementation, fall back to `location.reload()`.
- **"Sync Now" calls `fullSync()` directly** — does not go through `start()` because the lifecycle is already running; `start()` is reserved for auto-sync resume.
- **Destructive flow sequence is fixed**: `stop()` → clear Dexie data tables → `clearSyncState()` → `start(userId)`. This ordering prevents a mid-flight upload cycle from writing a just-wiped row back to Supabase.
- **Aggregate item count computed lazily** on mount + after each `markSyncComplete` — avoids a live subscription to every Dexie table.

## Open Questions

### Resolved During Planning

- Category placement — resolved as new top-level `'sync'` with `RefreshCw` icon.
- Preference storage — resolved as `AppSettings.autoSyncEnabled` (localStorage), no Supabase sync.
- Post-reset UX — soft re-render via existing refresh callbacks; `location.reload()` reserved as fallback if QA finds stale caches.

### Deferred to Implementation

- Exact copy for AlertDialog description — final wording pending design review; MVP uses draft from story AC4.
- Whether to lock the Auto-sync toggle during the `start()`/`stop()` transition — to be determined during implementation based on observed latency; target <100ms so no lock is needed.
- Whether `resetLocalData` should first attempt to flush the pending `syncQueue` before clearing — recommend NOT, because the user's intent is escape-hatch recovery and pending writes may be the corruption source. Confirm during test authoring.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌──────────────────────────────────────────────────────┐
│ SyncSection (new)                                    │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │ auto-sync Switch      [on/off]               │   │
│   └──────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────┐   │
│   │ Last synced: 2 min ago   (tooltip: ISO)      │   │
│   │ 1,204 items synced  •  3 pending upload      │   │
│   └──────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────┐   │
│   │ [ Sync Now ]                                  │   │
│   └──────────────────────────────────────────────┘   │
│   ┌─ Danger Zone ────────────────────────────────┐   │
│   │ [ Clear local data and re-sync ]             │   │
│   └──────────────────────────────────────────────┘   │
└─────────┬────────────────────────────────────────────┘
          │ reads/writes
          ▼
  useSyncStatusStore ── subscribes ── useSyncLifecycle
  useAuthStore (user)                    │
  getSettings / saveSettings             ▼
  syncEngine.start/stop/fullSync   fullSync() on mount,
  resetLocalData(userId) ───────┐  interval, online, focus
                                │
                                ▼
                       Dexie (all tables in tableRegistry)
                       syncMetadata  syncQueue
```

**Reset sequence (AC4):**

```
user clicks Confirm
    │
    ▼
syncEngine.stop()                 // halt interval + pending debounce
    │
    ▼
for entry in tableRegistry:
    db[entry.dexieTable].clear()   // wipe user data rows
    │
    ▼
clearSyncState()                   // clear syncQueue + reset cursors
    │
    ▼
syncEngine.start(userId)           // triggers fullSync — download rehydrates
    │
    ▼
toast.success + store-refresh callbacks fire on each table
```

## Implementation Units

- [ ] **Unit 1: Add `autoSyncEnabled` to AppSettings schema**

**Goal:** Introduce the new preference field with safe defaults.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/lib/settings.ts`
- Test: `src/lib/__tests__/settings.test.ts` (if it doesn't exist, create alongside — check first)

**Approach:**
- Add `autoSyncEnabled?: boolean` to `AppSettings` interface.
- Add `autoSyncEnabled: true` to the `defaults` const.
- Do NOT add `autoSyncEnabled` to `UserSettingsPatch` — this preference is intentionally localStorage-only.
- Ensure `saveSettings({ autoSyncEnabled: ... })` still fires `settingsUpdated` window event via existing code path.

**Patterns to follow:**
- Mirror how `focusAutoQuiz` / `focusAutoFlashcard` are declared and defaulted in the same file.

**Test scenarios:**
- Happy path: `getSettings()` returns `autoSyncEnabled: true` when localStorage is empty.
- Happy path: `saveSettings({ autoSyncEnabled: false })` persists and round-trips through `getSettings()`.
- Edge case: Legacy localStorage payload without the field yields `autoSyncEnabled: true` (undefined coerced to default).
- Edge case: Corrupted value (string, number) is accepted as-is because the interface allows `boolean | undefined` — consumers must guard; add a regression note if sanitization is desired later.

**Verification:**
- `tsc --noEmit` clean.
- Unit tests pass.

---

- [ ] **Unit 2: Add `'sync'` category to Settings nav registry**

**Goal:** Surface a new top-level Sync category with icon, label, description, and search-index entry.

**Requirements:** R1 (discoverability)

**Dependencies:** Unit 1 (so `getModifiedCategories` can reason about the new field if needed — optional coupling).

**Files:**
- Modify: `src/app/components/settings/layout/settingsCategories.ts`
- Modify: `src/app/components/settings/layout/settingsSearchIndex.ts`
- Modify: `src/app/pages/Settings.tsx` (extend `getModifiedCategories` to flag `'sync'` when `autoSyncEnabled === false`)

**Approach:**
- Add `'sync'` to `SettingsCategorySlug` union.
- Add a new `SETTINGS_CATEGORIES` entry: `{ slug: 'sync', label: 'Sync', description: 'Cloud sync controls and data management', icon: RefreshCw }`.
- Update search index with keywords: "sync", "auto-sync", "cloud", "backup", "reset", "clear data".
- Extend `getModifiedCategories()` to mark `'sync'` as modified when the user has turned auto-sync off.

**Patterns to follow:**
- Existing entries in `settingsCategories.ts` (icon import from `lucide-react`).
- Existing search-index entries (each keyword points at category slug).

**Test scenarios:**
- Happy path: `SETTINGS_CATEGORIES` includes the `'sync'` entry and the icon renders.
- Happy path: Navigating to `?section=sync` routes to the new section.
- Edge case: Search for "auto-sync" in `SettingsSearch` returns the Sync category.
- Integration: `getModifiedCategories()` returns the set including `'sync'` when `autoSyncEnabled === false` in localStorage.

**Verification:**
- Settings page renders the new nav entry in both desktop sidebar and mobile pill layouts.
- No ESLint or TypeScript errors.

---

- [ ] **Unit 3: Implement `resetLocalData(userId)` helper**

**Goal:** A tested, isolated function that wipes all syncable Dexie data tables, clears sync state, and restarts the engine.

**Requirements:** R4

**Dependencies:** None (tableRegistry and clearSyncState already exist).

**Files:**
- Create: `src/lib/sync/resetLocalData.ts`
- Test: `src/lib/sync/__tests__/resetLocalData.test.ts`

**Execution note:** Implement test-first — destructive behavior needs a safety net before we expose a UI trigger.

**Approach:**
- Exported function signature: `export async function resetLocalData(userId: string | null): Promise<void>`.
- Sequence: `syncEngine.stop()` → iterate `tableRegistry`; for each entry with a non-`skip` conflictStrategy, call `db[entry.dexieTable].clear()` (guard with `if (table)` so unknown table names log-and-skip, not throw) → `await clearSyncState()` → if `userId` is non-null, `await syncEngine.start(userId)`; otherwise leave the engine stopped.
- Never clear non-registry tables (auth, local-only caches like `opdsCatalogs` if marked `skipSync`).
- Wrap each table `.clear()` in its own `try/catch` that logs and continues — one bad table must not abort the rest.
- Do NOT clear `localStorage` (`app-settings`) or anything managed by Supabase Auth.

**Patterns to follow:**
- `clearSyncState.ts` for Dexie write patterns and JSDoc style.
- `syncEngine.ts` module-level pure-function approach (no React/Zustand imports).

**Test scenarios:**
- Happy path: Seeded Dexie with fixtures across three tables → call `resetLocalData('user-1')` → all three tables are empty post-stop and re-populated by the mocked `syncEngine.start` (stubbed to apply fixtures).
- Happy path: `clearSyncState()` is called exactly once; `syncQueue` and `syncMetadata` cursors are cleared.
- Edge case: `userId === null` → engine stays stopped; no `start()` invocation.
- Error path: If `db.notes.clear()` throws, the error is logged but `db.flashcards.clear()` still runs and `clearSyncState()` still fires.
- Error path: If `syncEngine.stop()` throws (shouldn't, but defend), the catch allows the rest of the sequence to proceed.
- Integration: After `resetLocalData`, a subsequent `syncEngine.fullSync()` can succeed without hitting stale cursors (verified by asserting `syncMetadata` is empty before rehydration).

**Verification:**
- Unit tests pass against `fake-indexeddb`.
- JSDoc includes "destructive — clears all Dexie data tables" warning.

---

- [ ] **Unit 4: Gate `useSyncLifecycle` on `autoSyncEnabled`**

**Goal:** Honor the user's Auto-sync preference so the hook pauses triggers when disabled.

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/hooks/useSyncLifecycle.ts`
- Test: `src/app/hooks/__tests__/useSyncLifecycle.test.ts` (create if absent — verify there is one first)

**Approach:**
- Read `getSettings().autoSyncEnabled` on mount; treat `undefined` as `true`.
- When disabled:
  - Skip the initial `setStatus('syncing') + fullSync()` block.
  - Skip the `setInterval` tick (`navigator.onLine`-gated nudge + refreshPendingCount) — use a guarded closure rather than unregistering the interval so we can react to runtime toggling.
  - Still register store-refresh callbacks (harmless no-ops; keeps API symmetry for when user re-enables).
- Subscribe to `settingsUpdated` event — on change, re-read `autoSyncEnabled` and call `syncEngine.start(userId)` or `syncEngine.stop()` accordingly.
- Keep `online`, `offline`, `beforeunload`, and `visibilitychange` listeners registered unconditionally, but guard their callbacks on `autoSyncEnabled` so a paused user doesn't auto-fullSync on reconnect.

**Patterns to follow:**
- Existing `useEffect` cleanup and `navigator.onLine` guard style in the same file.
- `settingsUpdated` event listener pattern already used in `Settings.tsx`.

**Test scenarios:**
- Happy path: Mount with `autoSyncEnabled: true` → initial `fullSync()` fires (spied).
- Happy path: Mount with `autoSyncEnabled: false` → no initial `fullSync()`, interval callback is a no-op, store-refresh registrations still happen.
- Happy path: Toggle from enabled to disabled at runtime (dispatch `settingsUpdated`) → `syncEngine.stop()` called.
- Happy path: Toggle from disabled to enabled at runtime → `syncEngine.start(userId)` called with current user.
- Edge case: `autoSyncEnabled === undefined` (legacy) → treated as enabled.
- Edge case: Online event fires while disabled → no `fullSync()`.
- Integration: Unmount removes the `settingsUpdated` listener (no leaked handler).

**Verification:**
- Existing E92-S07 tests continue to pass.
- New toggle behavior covered.

---

- [ ] **Unit 5: Build `SyncSection` component**

**Goal:** The user-facing panel wiring all controls together.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Units 1–4

**Files:**
- Create: `src/app/components/settings/sections/SyncSection.tsx`
- Create: `src/app/components/settings/__tests__/SyncSection.test.tsx`

**Approach:**
- Subscribe to `useSyncStatusStore` (selectors: `status`, `lastSyncAt`, `pendingCount`, `lastError`).
- Subscribe to `useAuthStore` (`user`); return `null` if `user === null`.
- Read `autoSyncEnabled` via `getSettings()` in a `useState` initializer, refresh on `settingsUpdated`.
- Compute `totalSyncedItems`: on mount and on every `markSyncComplete` (detect via subscribing to `lastSyncAt` changes), iterate `tableRegistry` (filter out `skipSync`) and `Promise.all` the `db[...].count()` calls; store in local state with memoization.
- Render:
  - Auto-sync row: `Switch` bound to the local state; `onCheckedChange` calls `saveSettings({ autoSyncEnabled: next })` and then `syncEngine.start(userId)` / `syncEngine.stop()` based on `next`.
  - Status row: "Last synced {relative}" with `Tooltip` on exact ISO; "X items synced • Y pending upload" copy.
  - "Sync Now" `Button` variant="brand"; disabled when `status === 'syncing'` or `!navigator.onLine`; onClick → `setBusy(true)` → `syncEngine.fullSync()` → `toast.success|error` → `setBusy(false)`.
  - Destructive danger-zone card with `AlertDialog`; on confirm → call `resetLocalData(user.id)` with inline "Restoring from cloud…" spinner → `toast.success` + local state refresh (count re-compute) on success.
- Use design tokens only: `text-success`, `text-destructive`, `text-muted-foreground`, `bg-card`, `bg-destructive/10` for danger zone hover.
- Touch targets ≥44×44; `AlertDialogAction` uses destructive variant.

**Patterns to follow:**
- `IntegrationsDataSection.tsx` card + separator + AlertDialog layout.
- `SyncStatusIndicator.tsx` (E97-S01) for status-to-color mapping and relative-time formatting.
- `AccountSection.tsx` for `useSettingsPage()` usage and toast helper calls (`toastSuccess`, `toastError`).

**Test scenarios:**
- Happy path: Renders Switch, status lines, Sync Now button, and danger-zone button when `user !== null`.
- Happy path: Clicking Switch persists via `saveSettings` (spied) and toggles `syncEngine.stop/start`.
- Happy path: Clicking "Sync Now" calls `syncEngine.fullSync` (spied) and shows spinner while `status === 'syncing'`.
- Happy path: After `markSyncComplete` fires, the "items synced" count recomputes.
- Edge case: `user === null` → component returns `null` (no nav entry either — handled by gating in layout if needed, or component is rendered but empty).
- Edge case: `lastSyncAt === null` → renders "Never synced" placeholder.
- Edge case: `!navigator.onLine` → Sync Now button disabled with tooltip "You're offline".
- Error path: `syncEngine.fullSync()` rejects → `toast.error` with the message; button returns to idle.
- Error path: `resetLocalData` rejects → `toast.error`; the AlertDialog is closed; section continues to render.
- Integration: Confirming the destructive AlertDialog invokes `resetLocalData` and then re-reads counts.

**Verification:**
- All AC1–AC5 observable behavior present in the unit tests.
- No hardcoded Tailwind colors (ESLint clean).
- axe scan clean on the rendered component.

---

- [ ] **Unit 6: Mount SyncSection in SettingsLayout routing**

**Goal:** Connect the new category slug to the new component in the SettingsLayout's section switcher.

**Requirements:** R1, R5

**Dependencies:** Units 2, 5

**Files:**
- Modify: `src/app/components/settings/layout/SettingsLayout.tsx`

**Approach:**
- Locate the switch/match that maps `section` slug → component.
- Add a case for `'sync'` returning `<SyncSection />` (which already handles the unauth-null render internally).
- Confirm `SettingsNav` / `SettingsNavPills` already handle arbitrary new slugs — they should, since they iterate `SETTINGS_CATEGORIES`.

**Patterns to follow:**
- Existing case arms for the other five categories in `SettingsLayout`.

**Test scenarios:**
- Integration: Navigating to `/settings?section=sync` renders `SyncSection`.
- Happy path: Selecting Sync in the nav updates the URL and swaps to the new section.

**Verification:**
- Manual smoke: navigation works; no console errors.

---

- [ ] **Unit 7: End-to-end coverage**

**Goal:** Regression-proof the observable flows across the Settings page.

**Requirements:** R1–R6

**Dependencies:** Units 1–6

**Files:**
- Create: `tests/e2e/story-97-02-sync-settings.spec.ts`

**Execution note:** Follow deterministic-time patterns in `.claude/rules/testing/test-patterns.md`. Seed IndexedDB via the shared helpers, not by hand.

**Approach:**
- Scenario 1 — Visibility gating: sign in, navigate to Settings, confirm Sync nav entry is visible; sign out, confirm it disappears without reload.
- Scenario 2 — Auto-sync toggle persistence: toggle off, reload, confirm Switch still reflects off; toggle back on.
- Scenario 3 — Sync Now happy path: seed a pending write, click Sync Now, mock Supabase upsert to succeed, assert spinner appears then the `lastSyncAt` line updates and `pendingCount` drops.
- Scenario 4 — Sync Now error: mock Supabase to reject, assert `toast.error` copy and header indicator reflects error state.
- Scenario 5 — Destructive reset: seed Dexie with 5 note rows, open AlertDialog, cancel → rows still present; reopen, confirm → stop engine, rows cleared, mocked download rehydrates, toast fires.
- Scenario 6 — Offline guard: `await context.setOffline(true)` → Sync Now button disabled with tooltip.

**Patterns to follow:**
- E97-S01 `story-97-01.spec.ts` for `window.__syncStatusStore` driving and IndexedDB seeding.

**Test scenarios:**
- (Covered above.) Each scenario = one spec block; prefix with "@desktop" if tablet/mobile parity isn't tested here.

**Verification:**
- Spec passes on Chromium; follows shared helpers and deterministic-time rules.

## System-Wide Impact

- **Interaction graph:** Component reads/writes to `useSyncStatusStore`, `useAuthStore`, and `syncEngine`; listens to `settingsUpdated` window event. `useSyncLifecycle` gains a new dependency on `getSettings().autoSyncEnabled`.
- **Error propagation:** All engine-facing calls wrapped in try/catch with user-visible `toastError`. `resetLocalData` continues through per-table failures to keep the escape hatch usable. The destructive confirmation dialog is the last safety net — no bypass path.
- **State lifecycle risks:** Mid-flight upload cycle during reset mitigated by calling `stop()` first; `navigator.locks` finishes any in-flight batch before `clear()` proceeds (locks cannot be forcibly cancelled — acceptable wait).
- **API surface parity:** `syncEngine` API is untouched; `useSyncStatusStore` is untouched; `AppSettings` gains one optional field. No schema migrations.
- **Integration coverage:** E2E spec covers sign-out hide, persistence across reload, engine stop/start via toggle, destructive reset wipe-then-rehydrate.
- **Unchanged invariants:** Sign-out preserves Dexie (unchanged). `clearSyncState` semantics unchanged — we add a new wider helper instead of mutating the existing one. Header indicator (E97-S01) behavior unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| User accidentally destroys pending un-synced writes via the reset button | AlertDialog copy is explicit; destructive-styled confirm button; reset is confirmation-only, never auto-triggered. |
| Toggle race between `start()` and `stop()` on rapid user flicks | `_started` flag guards `nudge()`; each call is idempotent; observed latency expected <100ms so no UI lock is needed for MVP. |
| Soft re-render after reset misses a store, leaving stale cache | Implementation fallback plan: swap to `location.reload()` if QA surfaces stale data; only 2 lines of code to change. |
| Large DB makes aggregate item count slow | Counts computed once on mount + after `markSyncComplete`; not in render path; use `Promise.all` for parallelism. |
| `autoSyncEnabled === false` + new sign-in never starts engine | `useSyncLifecycle` still honors the pref even after sign-in — documented as intended: user explicitly disabled sync. Header indicator should surface "paused" visually (consider follow-up). |
| Dexie `clear()` on a large table blocks the UI thread | Acceptable for the destructive flow (one-shot user action with spinner); if it becomes an issue, chunk via `bulkDelete` in a follow-up. |
| Sign-out during mid-reset | `resetLocalData` captures `userId` at call time; if auth is lost before `start()`, the function simply leaves the engine stopped — next sign-in resumes. |

## Documentation / Operational Notes

- Update `docs/implementation-artifacts/sprint-status.yaml` to mark E97-S02 in-progress when work begins.
- Add a brief note to `docs/engineering-patterns.md` if `resetLocalData` introduces a new destructive-write pattern worth standardizing (optional).
- No runbook or monitoring changes — the feature is purely client-side.
- CLAUDE.md / `.claude/rules/` do not need updates; existing design-token and settings-persistence rules already cover the work.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e97-s02-sync-settings-panel-requirements.md](../brainstorms/2026-04-19-e97-s02-sync-settings-panel-requirements.md)
- **Story file:** `docs/implementation-artifacts/stories/E97-S02-sync-settings-panel.md`
- **E97-S01 story (sibling):** `docs/implementation-artifacts/stories/E97-S01-sync-status-indicator-header.md`
- **E97-S01 plan (sibling):** `docs/plans/2026-04-19-021-feat-e97-s01-sync-status-indicator-header-plan.md`
- Related code:
  - `src/app/stores/useSyncStatusStore.ts`
  - `src/app/hooks/useSyncLifecycle.ts`
  - `src/lib/sync/syncEngine.ts`
  - `src/lib/sync/clearSyncState.ts`
  - `src/lib/sync/tableRegistry.ts`
  - `src/lib/settings.ts`
  - `src/app/components/settings/sections/IntegrationsDataSection.tsx`
- Related memory: `reference_sync_engine_api.md`, `reference_dexie_4_quirks.md`
