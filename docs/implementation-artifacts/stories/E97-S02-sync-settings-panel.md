---
story_id: E97-S02
story_name: "Sync Settings Panel"
status: ready-for-dev
started: 2026-04-19
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 97.02: Sync Settings Panel

## Story

As a Knowlune user who syncs my learning data across devices,
I want a dedicated "Sync" section inside the Settings page where I can see sync status, toggle auto-sync, force a manual sync, and (if needed) blow away my local cache and re-download from the cloud,
so that I can take direct control of my sync behavior when I hit problems or want to conserve battery/bandwidth.

## Acceptance Criteria

**AC1 — Sync section with auto-sync toggle**
- **Given** I am signed in and on the Settings page,
- **When** I navigate to the new "Sync" section (surfaced as a sub-section inside Account or as a new top-level category — decided during planning),
- **Then** I see a "Auto-sync" `Switch` labeled clearly, currently-on by default.
- **When** I toggle Auto-sync off, the periodic nudges from `useSyncLifecycle` stop (engine paused via `syncEngine.stop()`), writes are still queued locally, and the header indicator (E97-S01) reflects paused state.
- **When** I toggle Auto-sync back on, `syncEngine.start(userId)` is called, any queued writes flush, and status returns to `synced`.

**AC2 — Last sync timestamp + synced item count**
- **Given** I am viewing the Sync section,
- **When** the section is rendered,
- **Then** I see:
  - A human-readable "Last synced" line (e.g. "2 minutes ago") sourced from `useSyncStatusStore.lastSyncAt`, with an absolute ISO timestamp in a tooltip.
  - A count of total locally-synced items across all syncable Dexie tables (sum of row counts for tables listed in `tableRegistry` that aren't `skipSync`/`uploadOnly`), plus a "X pending upload" line from `pendingCount`.
- The counts refresh when the section mounts and after every successful `fullSync()` (via `markSyncComplete()` subscription).

**AC3 — "Sync Now" button with inline progress**
- **Given** I am viewing the Sync section,
- **When** I click the "Sync Now" primary Button,
- **Then** `syncEngine.fullSync()` is invoked; the button enters a loading state (spinner + "Syncing…" label, `disabled`); the status line shows a progress message while `status === 'syncing'`.
- **When** the sync completes successfully, the button returns to idle, `lastSyncAt` updates, and a `toast.success` fires ("Sync complete").
- **When** the sync fails, the button returns to idle and a `toast.error` surfaces the classified error message; `status === 'error'` is preserved for the header indicator.
- The button is disabled while `status === 'syncing'` or `!navigator.onLine` to prevent double-fires.

**AC4 — "Clear local data and re-sync" destructive action with confirmation**
- **Given** I am viewing the Sync section,
- **When** I click "Clear local data and re-sync",
- **Then** an `AlertDialog` opens explaining exactly what will happen ("This will delete every book, note, flashcard, and progress entry from this device and re-download them from the cloud. Changes that haven't finished syncing yet will be lost.") with a destructive-styled **Confirm** button and a neutral **Cancel**.
- **When** I confirm, the action:
  1. Calls `syncEngine.stop()` to halt mid-flight cycles.
  2. Clears all syncable Dexie tables (iterating `tableRegistry`; non-syncable tables like `syncQueue`/`syncMetadata` are cleared via `clearSyncState()`; never wipes `auth.users` or the session).
  3. Calls `syncEngine.start(userId)` which triggers a fresh `fullSync()` download.
  4. Shows inline progress (spinner + "Restoring from cloud…").
  5. On success, fires `toast.success("Local data restored from cloud")` and reloads the page (or dispatches a soft re-render) to pick up rehydrated stores.
  6. On failure, fires `toast.error` with the error message; the user remains on the Settings page with empty local data — they can retry.
- **When** I cancel, nothing happens and the dialog closes.

**AC5 — Section only visible to authenticated users**
- **Given** I am signed out (`useAuthStore.user === null`),
- **When** I open the Settings page,
- **Then** the Sync section (and its nav/category entry, if applicable) is not rendered — no empty placeholder, no "sign in to sync" CTA (that already lives in the Account section).
- **Given** I sign in mid-session, the Sync section appears without a page reload (Zustand subscription to `useAuthStore.user`).

**AC6 — Settings persist via existing settings store**
- **Given** I have toggled Auto-sync off (or any other sync preference introduced in this story),
- **When** I reload the page,
- **Then** my preference persists because it is stored in `AppSettings` via `saveSettings()` / `getSettings()` in `src/lib/settings.ts` (same pattern used for `colorScheme`, `focusAutoQuiz`, etc.).
- A new field `autoSyncEnabled?: boolean` (default `true`) is added to the `AppSettings` interface and to the `defaults` object; optionally a new `syncPreferences` namespace if more fields are needed.
- Reading on app mount must gate `useSyncLifecycle` so the initial `fullSync()` respects the persisted choice.

## Tasks / Subtasks

- [ ] Task 1: Extend settings schema (AC6)
  - [ ] 1.1 Add `autoSyncEnabled?: boolean` to `AppSettings` in `src/lib/settings.ts` with `default: true`.
  - [ ] 1.2 Update `getModifiedCategories()` in `Settings.tsx` if a new nav category is introduced.
  - [ ] 1.3 Ensure `saveSettings({ autoSyncEnabled })` fires the `settingsUpdated` event.
- [ ] Task 2: Build `SyncSettingsSection` component (AC1–AC5)
  - [ ] 2.1 Create `src/app/components/settings/sections/SyncSection.tsx` (or `SyncSettings.tsx` under `src/app/components/settings/`).
  - [ ] 2.2 Subscribe to `useSyncStatusStore` (`status`, `lastSyncAt`, `pendingCount`, `lastError`) and `useAuthStore` (`user`).
  - [ ] 2.3 Render Auto-sync `Switch` bound to `autoSyncEnabled`; onChange → `saveSettings` + `syncEngine.start/stop`.
  - [ ] 2.4 Render last-sync relative line with tooltip; render synced-item count (sum of `db.<table>.count()` across registry).
  - [ ] 2.5 Render "Sync Now" button wired to `syncEngine.fullSync()` with inline spinner + toast feedback.
  - [ ] 2.6 Render destructive "Clear local data and re-sync" flow behind an `AlertDialog` (shadcn primitive already used in `IntegrationsDataSection`).
  - [ ] 2.7 Gate the entire section on `user !== null`; return `null` when unauthenticated.
- [ ] Task 3: Plumb into Settings layout
  - [ ] 3.1 Decide: add new category `'sync'` to `SETTINGS_CATEGORIES` OR nest inside existing `account` / `integrations` category (plan-phase decision).
  - [ ] 3.2 If new category: add icon (e.g. `RefreshCw`), update `SettingsNav`, `SettingsSearch` index, and `getModifiedCategories`.
  - [ ] 3.3 Wire through `SettingsPageContext` if the component needs shared state (auth user, toast helpers).
- [ ] Task 4: Implement "Clear local data and re-sync" helper (AC4)
  - [ ] 4.1 Add a new `resetLocalData()` function (e.g. in `src/lib/sync/resetLocalData.ts`) that: stops engine, iterates `tableRegistry` clearing each Dexie table, calls `clearSyncState()`, then restarts engine.
  - [ ] 4.2 Unit-test the helper in isolation (Dexie fake-indexeddb).
- [ ] Task 5: Wire `autoSyncEnabled` into `useSyncLifecycle` (AC1)
  - [ ] 5.1 On mount, read `getSettings().autoSyncEnabled` and skip initial `fullSync()` + interval when disabled.
  - [ ] 5.2 Subscribe to `settingsUpdated` to start/stop the engine on toggle without requiring page reload.
  - [ ] 5.3 Preserve current behavior when the flag is missing (treat `undefined` as `true`).
- [ ] Task 6: Tests (unit + E2E)
  - [ ] 6.1 Unit: toggling Auto-sync calls `syncEngine.stop()` then `.start()` and persists via `saveSettings`.
  - [ ] 6.2 Unit: "Sync Now" invokes `syncEngine.fullSync` and shows spinner while `status === 'syncing'`.
  - [ ] 6.3 Unit: "Clear local data" helper empties registered Dexie tables and preserves auth state.
  - [ ] 6.4 Unit: section returns `null` when `user === null`.
  - [ ] 6.5 E2E (`tests/e2e/story-97-02.spec.ts`): open Settings → Sync; toggle auto-sync and reload to confirm persistence; click Sync Now; open destructive dialog and cancel; open and confirm (with mocked Supabase) to verify Dexie wipe + re-populate.

## Design Guidance

**Placement:** Candidate A — add a sixth nav entry `'sync'` to `SETTINGS_CATEGORIES` with the `RefreshCw` Lucide icon (mirrors E97-S01 header indicator affordance). Candidate B — nest inside `account` section beneath `MyDataSummary`. Plan-phase picks based on UX parity with header indicator.

**Component structure:**
```
<section aria-labelledby="sync-heading">
  <h4 id="sync-heading" className="…uppercase tracking-widest">Sync</h4>
  <Card>
    <CardContent>
      <Row>
        <Label>Auto-sync</Label>
        <Switch checked={autoSyncEnabled} onCheckedChange={…} />
      </Row>
      <Separator />
      <StatusLines lastSyncAt={…} pendingCount={…} totalItems={…} />
      <ButtonRow>
        <Button onClick={handleSyncNow} disabled={isSyncing || !navigator.onLine}>
          {isSyncing ? <Spinner /> : null} {isSyncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </ButtonRow>
      <Separator />
      <DangerZone>
        <AlertDialog>…Clear local data and re-sync…</AlertDialog>
      </DangerZone>
    </CardContent>
  </Card>
</section>
```

**Design tokens:** Use `text-success` for "Synced just now", `text-destructive` for the danger-zone button and dialog confirm action, `text-muted-foreground` for hint copy. No hardcoded Tailwind colors.

**Accessibility:**
- `Switch` has an associated `<Label>` with `htmlFor`.
- `AlertDialog` uses shadcn primitive (focus trap, Escape close, focus restoration).
- All buttons ≥44×44px.
- Live region announcement when sync completes ("Sync complete" via `aria-live="polite"`).
- Destructive action description must be explicit about data loss of un-synced pending writes.

**Responsive:** Stacks vertically on mobile (<640px); buttons go full-width. Card padding shrinks from `p-6` to `p-4` per existing `IntegrationsDataSection` convention.

**Motion:** Spinner respects `prefers-reduced-motion` (static pulsing dot fallback, same as E97-S01).

## Implementation Notes

- Reuses `useSyncStatusStore` from E92-S07 / E97-S01 (already exposes `status`, `lastSyncAt`, `pendingCount`, `lastError`, `markSyncComplete`).
- `syncEngine.start(userId)` / `syncEngine.stop()` are already public (see `src/lib/sync/syncEngine.ts` lines 1107–1132).
- `syncEngine.fullSync()` is the correct entry point for manual "Sync Now" — not `nudge()` (debounced upload-only).
- `clearSyncState()` already exists (`src/lib/sync/clearSyncState.ts`) but only clears `syncQueue` + `syncMetadata`. The destructive re-sync flow needs an additional helper that iterates `tableRegistry` and clears each Dexie data table.
- `userId` comes from `useAuthStore.user?.id` — same source the auth listener uses to call `syncEngine.start()` on sign-in.
- Settings persistence follows the `saveSettings({ autoSyncEnabled })` + `window.dispatchEvent('settingsUpdated')` pattern already used across the codebase.
- Do NOT wipe `auth.users`, session tokens, or localStorage `app-settings` during the destructive reset — only Dexie data tables + sync state.

## Testing Notes

- E2E patterns follow `.claude/rules/testing/test-patterns.md`: deterministic time, IndexedDB seeding via shared helpers, no `Date.now()` in specs.
- Mock `syncEngine.fullSync` at the module boundary for "Sync Now" tests to avoid hitting real Supabase.
- For destructive flow, seed Dexie with fixtures → click Confirm → assert `await db.notes.count()` returns `0` immediately after stop, then re-populates after mocked download.
- Verify `autoSyncEnabled=false` prevents the 30s interval in `useSyncLifecycle` from calling `nudge()`.
- Auth-gated visibility test: mount with `useAuthStore.user = null` → expect section absent from DOM.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors via toast
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence — Auto-sync toggle flips only after `saveSettings` resolves
- [ ] Type guards on all dynamic lookups
- [ ] Destructive action requires confirmation (AlertDialog cannot be bypassed)
- [ ] `tsc --noEmit` clean
- [ ] E2E for this story passes (`story-97-02.spec.ts`)
- [ ] Touch targets ≥44×44px on all interactive controls
- [ ] ARIA: axe scan of AlertDialog + Switch
- [ ] Contrast check in light and dark themes
- [ ] `prefers-reduced-motion` respected by spinner
- [ ] No hardcoded Tailwind colors (ESLint clean)
- [ ] Clearing local data does NOT clear session or `app-settings` localStorage
- [ ] Auto-sync `undefined` treated as `true` (backward compatibility)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Populated on completion]
