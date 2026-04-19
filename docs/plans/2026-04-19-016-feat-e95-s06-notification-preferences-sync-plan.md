---
title: "feat: E95-S06 — Notification Preferences Sync"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e95-s06-notification-preferences-sync-requirements.md
---

# feat: E95-S06 — Notification Preferences Sync

## Overview

Wire `useNotificationPrefsStore` into the Supabase sync pipeline so that notification
toggles and quiet-hours settings roam across devices. The three-part work is:
(1) a Supabase migration adding the `notification_preferences` table, (2) replacing
`persistWithRetry` calls in `useNotificationPrefsStore` with `syncableWrite` and adding
an auth guard to `init()`, and (3) extending `hydrateSettingsFromSupabase` to hydrate
the store from the remote row on login.

## Problem Frame

Notification preferences (per-category toggles, quiet hours, push-enabled flag) live
exclusively in Dexie/IndexedDB. Installing Knowlune on a second device resets all
toggles to defaults. The `notificationPreferences` table is already declared in the
sync table registry (P3, LWW, `supabaseTable: 'notification_preferences'`); the
remaining work is the Supabase schema, the store wiring, and the hydration hook.

(see origin: docs/brainstorms/2026-04-19-e95-s06-notification-preferences-sync-requirements.md)

## Requirements Trace

- R1. `notification_preferences` Supabase table with `user_id UUID PRIMARY KEY`, one boolean column per `NotificationPreferences` field, quiet-hours columns, and `updated_at TIMESTAMPTZ`.
- R2. RLS on `notification_preferences`: `auth.uid() = user_id` for SELECT, INSERT, UPDATE.
- R3. `GRANT SELECT, INSERT, UPDATE` to the `authenticated` role.
- R4. Replace `persistWithRetry` in `useNotificationPrefsStore` with `syncableWrite('notificationPreferences', 'put', record)`.
- R5. `init()` must also use `syncableWrite` for the initial default write.
- R6. Remove manual `updatedAt: new Date().toISOString()` assignments — `syncableWrite` stamps `updatedAt` automatically.
- R7. Add `id: 'user_id'` to the `notificationPreferences` registry `fieldMap` and set `upsertConflictColumns: 'user_id'` (same pattern as `chapterMappings`).
- R8. After login, hydrate `useNotificationPrefsStore` from the remote `notification_preferences` row in `hydrateSettingsFromSupabase`; remote wins when `remote.updated_at > local.prefs.updatedAt`.
- R9. Hydration must be best-effort (errors swallowed with `console.warn`); must not block the rest of profile hydration.
- R10. If no remote row exists (new user), skip hydration and let local defaults stand.
- R11. Incoming remote `quietHoursStart` / `quietHoursEnd` must pass the existing `HHMM_RE` validation before being applied; malformed values are discarded.
- R12. Unknown `NotificationType` fields present in remote data are ignored (no runtime error).

## Scope Boundaries

- Push subscription tokens (APNS/FCM device tokens) — out of scope.
- No new UI — `NotificationPreferencesPanel` is unchanged.
- `push_enabled` as a top-level boolean — out of scope unless already present in `NotificationPreferences` (it is not).
- No server-side quiet-hours enforcement (client-side preference sync only).

### Deferred to Separate Tasks

- Server-side push notification gating using quiet-hours: future epic.
- APNS/FCM token sync: future epic.

## Context & Research

### Relevant Code and Patterns

- **Store under modification:** `src/stores/useNotificationPrefsStore.ts` — currently uses `persistWithRetry`; three write sites: `init()`, `setTypeEnabled()`, `setQuietHours()`.
- **Existing test file:** `src/stores/__tests__/useNotificationPrefsStore.test.ts` — mocks `persistWithRetry`, needs migration to mock `syncableWrite` and `useAuthStore`.
- **Registry entry (already exists, needs update):** `src/lib/sync/tableRegistry.ts` line ~539 — `notificationPreferences` entry has empty `fieldMap: {}` and no `upsertConflictColumns`; must add `fieldMap: { id: 'user_id' }` and `upsertConflictColumns: 'user_id'`.
- **Singleton PK pattern (prior art):** `chapterMappings` entry in `tableRegistry.ts` uses `upsertConflictColumns: 'epub_book_id,audio_book_id,user_id'` — same mechanism; here the target is just `'user_id'`.
- **syncableWrite auth guard:** `src/lib/sync/syncableWrite.ts` already reads `useAuthStore.getState().user?.id ?? null` and skips queue enqueue when `userId` is null — Dexie write still happens. `init()` therefore needs no special auth branch for the Dexie write path, but must not set a static `updatedAt` timestamp on the default record (let `syncableWrite` stamp it).
- **Hydration hook:** `src/lib/settings.ts` — `hydrateSettingsFromSupabase(userMetadata, userId)` already performs a `.from('user_settings')` fetch and fans out to stores. The notification preferences row lives in a separate table; a new `.from('notification_preferences')` fetch inside the same try/catch block is the correct extension point.
- **E95-S05 wiring pattern:** `src/stores/useAudiobookshelfStore.ts` and `src/stores/useOpdsCatalogStore.ts` — import `syncableWrite`, import `useAuthStore`, call `syncableWrite('tableName', 'put', record)` in place of `persistWithRetry`.
- **Auth-guard pattern for `init()`:** The anonymous / offline case must still persist defaults to Dexie (for the notification service). When `userId` is null, `syncableWrite` already handles this correctly (writes Dexie, skips queue). No special-casing is needed in the store beyond calling `syncableWrite` instead of `persistWithRetry`.
- **Default-timestamp LWW edge case:** The `DEFAULTS` object in `useNotificationPrefsStore` initializes `updatedAt: new Date().toISOString()` (module load time). Because `syncableWrite` re-stamps `updatedAt` at write time, the stored record's timestamp will be the actual write time, not the module load time. This is correct. However, during hydration, a brand-new user whose default row was just written may have a local `updatedAt` that is slightly newer than a remote row written milliseconds earlier (e.g., from a first-install upload race). The hydration strategy must treat remote as winner when `remote.updated_at >= local.prefs.updatedAt` (inclusive), not just strictly greater, to handle this within-same-second race.
- **NotificationPreferences type (confirmed field list):** `src/data/types.ts` — 12 boolean toggle fields (`courseComplete`, `streakMilestone`, `importFinished`, `achievementUnlocked`, `reviewDue`, `srsDue`, `knowledgeDecay`, `recommendationMatch`, `milestoneApproaching`, `bookImported`, `bookDeleted`, `highlightReview`) + `quietHoursEnabled` (boolean) + `quietHoursStart` / `quietHoursEnd` (TEXT) + `updatedAt` (TEXT ISO 8601) + `id: 'singleton'` (Dexie PK, maps to `user_id` in Supabase).
- **Migration naming convention:** Most recent migration is `20260425000001_compute_reading_streak.sql`. New migration: `20260426000001_notification_preferences.sql`.
- **Call site for `init()`:** `App.tsx` line 87 — `useNotificationPrefsStore.getState().init()` runs in a `useEffect([], [])`. This runs before sign-in; `syncableWrite` correctly handles the null-user path.
- **`hydrateSettingsFromSupabase` call site:** `src/app/hooks/useAuthLifecycle.ts` — `handleSignIn()` calls `await hydrateSettingsFromSupabase(userMetadata, userId)` on every SIGNED_IN / INITIAL_SESSION event.

### Institutional Learnings

- **Stale closure guard (E93-S02):** Use `set(state => ...)` functional form whenever any `await` separates a state read from a state write. The store currently captures state before `persistWithRetry` — must remain functionally equivalent after switching to `syncableWrite`. (see `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`)
- **Single write path (E93):** `syncableWrite` is the canonical write path for all synced tables. Do not keep `persistWithRetry` as a fallback alongside `syncableWrite`. (see `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`)
- **Migration idempotency (best practices):** All migration statements must use `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS`. (see `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`)
- **tsc --noEmit is a mandatory pre-check** (from E95 retrospective and requirements doc).

### External References

No external research needed — the codebase has 5+ direct examples of `syncableWrite` wiring in stores (E92–E95-S05) and the hydration extension point is well-established in `hydrateSettingsFromSupabase`.

## Key Technical Decisions

- **Dedicated `notification_preferences` table (not `user_settings` JSONB):** Already settled by the registry (`supabaseTable: 'notification_preferences'`). Keeps per-type boolean columns queryable independently and leaves room for push token columns in a future epic. (see origin §Key Decision)
- **`upsertConflictColumns: 'user_id'`:** The Dexie PK is `id: 'singleton'` (a fixed string, not a UUID). The Supabase PK is `user_id`. The `fieldMap: { id: 'user_id' }` override ensures the sync engine translates the PK correctly on upload; `upsertConflictColumns: 'user_id'` ensures Supabase upserts on the right column. (R7, mirror of `chapterMappings` pattern)
- **`hydrateSettingsFromSupabase` extension (not a new hydration entry point):** A separate `.from('notification_preferences').select()` call inside the existing try/catch block in `settings.ts`. This keeps all post-login store hydration in one place. The `userId` param is already available.
- **LWW hydration with inclusive timestamp comparison:** `remote.updated_at >= local.prefs.updatedAt` handles same-second first-install races where the default row was just written locally and the remote upload race resolved. Remote always wins when in doubt.
- **P2 default-wins guard (when local prefs are all-defaults):** If all of the local prefs exactly match `DEFAULTS` (i.e., the user has never made an explicit change), remote always wins regardless of timestamps. This prevents a freshly-initialized default row from blocking a valid remote record that happens to carry an older timestamp due to upload latency.
- **No new migration for `updatedAt` trigger:** The `set_updated_at` trigger pattern (using `extensions.moddatetime`) is appropriate only for tables where the server timestamp should override the client timestamp. For LWW sync tables, the client is the authoritative timestamp source — do NOT add a `moddatetime` trigger. (Same decision as all other LWW P3 tables.)
- **Auth guard in `init()`:** No explicit `userId` check is needed in the store because `syncableWrite` already skips queue enqueue when `userId` is null. The Dexie write still happens, which is required for the notification service. This matches the behavior of all other stores wired in E92–E95.

## Open Questions

### Resolved During Planning

- **Exact field list in `NotificationPreferences` (R1, from brainstorm):** Confirmed from `src/data/types.ts` — 12 boolean toggles + `quietHoursEnabled` + `quietHoursStart` + `quietHoursEnd` + `updatedAt` + `id`. Migration covers all columns.
- **Separate `.from('notification_preferences')` fetch or join (R8, from brainstorm):** Separate fetch is correct. `hydrateSettingsFromSupabase` currently does a single `.from('user_settings').select('settings')` — it does NOT join `notification_preferences`. A new `.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()` call must be added.
- **`maybeSingle()` vs `.single()`:** Use `.maybeSingle()` to avoid a PGRST116 error when the remote row does not exist (new user). `.single()` throws on no rows.
- **`updatedAt` auto-stamping by `syncableWrite`:** Confirmed — `syncableWrite` stamps `updatedAt: now` on every put/add. Manual `updatedAt` assignments in the store must be removed to avoid conflict (R6).
- **Auth guard scope:** `syncableWrite` already handles null `userId` correctly. No additional guard needed in the store.

### Deferred to Implementation

- Exact column ordering in the SQL migration — cosmetic, no architectural impact.
- Whether to add a `userId` column index for the download cursor — the upload engine upserts by `user_id` PK; a composite index on `(user_id, updated_at)` is standard but not blocking for MVP. Add if following the same pattern as other P3 tables in the existing migrations.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
On login (useAuthLifecycle → handleSignIn):
  hydrateSettingsFromSupabase(userMetadata, userId)
    ├─ existing: .from('user_settings')... → fans out to 4 stores
    └─ NEW: .from('notification_preferences').maybeSingle()
         if no row  → skip (R10)
         if row      → compare remote.updated_at vs local.prefs.updatedAt
                         remote ≥ local OR local is all-DEFAULTS → apply remote (R8, P2)
                         local  >  remote → keep local
                       validate quietHoursStart/End with HHMM_RE (R11)
                       ignore unknown fields (R12)
                       call useNotificationPrefsStore.getState().hydrateFromRemote(remotePrefs)

On any user toggle (setTypeEnabled / setQuietHours):
  old: persistWithRetry(() => db.notificationPreferences.put(next))
  new: syncableWrite('notificationPreferences', 'put', next)
         ├─ stamps { userId, updatedAt } automatically
         ├─ writes Dexie immediately (regardless of auth)
         └─ if userId non-null: enqueues to syncQueue → upload engine → Supabase

On first load (App.tsx → init()):
  old: persistWithRetry(() => db.notificationPreferences.put(defaults))
  new: syncableWrite('notificationPreferences', 'put', defaults)
         same auth-guard behavior: Dexie write always, queue skip when anonymous

tableRegistry (notificationPreferences entry):
  fieldMap: { id: 'user_id' }           ← Dexie PK 'singleton' → Supabase user_id
  upsertConflictColumns: 'user_id'       ← upsert ON CONFLICT (user_id)
```

## Implementation Units

- [ ] **Unit 1: Supabase Migration — `notification_preferences` table**

**Goal:** Create the `notification_preferences` Postgres table with RLS and grants so the sync engine can upsert notification preference rows.

**Requirements:** R1, R2, R3

**Dependencies:** None — standalone DDL migration.

**Files:**
- Create: `supabase/migrations/20260426000001_notification_preferences.sql`
- Create: `supabase/migrations/rollback/20260426000001_notification_preferences_rollback.sql`

**Approach:**
- `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- One `BOOLEAN NOT NULL DEFAULT TRUE` column per NotificationType field: `course_complete`, `streak_milestone`, `import_finished`, `achievement_unlocked`, `review_due`, `srs_due`, `knowledge_decay`, `recommendation_match`, `milestone_approaching`, `book_imported`, `book_deleted`, `highlight_review`
- `quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `quiet_hours_start TEXT NOT NULL DEFAULT '22:00'`
- `quiet_hours_end TEXT NOT NULL DEFAULT '07:00'`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Composite index on `(user_id, updated_at)` for the download cursor — matches the pattern of all other LWW sync tables
- RLS enabled; FOR ALL policy `auth.uid() = user_id` (SELECT, INSERT, UPDATE in one policy — same pattern as `notes` and other P3 tables)
- `GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated`
- **Do NOT add a `moddatetime` trigger** — the client is the authoritative timestamp source for LWW tables
- All statements use `IF NOT EXISTS` / `DROP POLICY IF EXISTS` for idempotency
- Rollback file: `DROP TABLE IF EXISTS public.notification_preferences CASCADE`

**Patterns to follow:**
- `supabase/migrations/20260413000002_p1_learning_content.sql` — LWW table with `(user_id, updated_at)` index, FOR ALL RLS policy, grants
- `supabase/migrations/20260422000001_user_settings.sql` — singleton `user_id PK`, REFERENCES auth.users ON DELETE CASCADE

**Test scenarios:**
- Test expectation: none — DDL-only migration; correctness verified by Unit 3 hydration test which fetches from the real table schema.

**Verification:**
- Running the migration locally produces no errors
- `SELECT * FROM public.notification_preferences` as an authenticated user returns only their own rows (RLS)
- An anonymous request is rejected by RLS

---

- [ ] **Unit 2: Registry Update — fieldMap + upsertConflictColumns**

**Goal:** Fix the `notificationPreferences` registry entry so the sync engine maps the Dexie PK (`id: 'singleton'`) to the Supabase PK column (`user_id`) and upserts on the correct conflict target.

**Requirements:** R7

**Dependencies:** None — pure config change; safe to land before or after Unit 1.

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`
- Test: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Update the `notificationPreferences` entry: `fieldMap: { id: 'user_id' }` and `upsertConflictColumns: 'user_id'`
- No other fields on the entry change

**Patterns to follow:**
- `chapterMappings` entry in `tableRegistry.ts` — `upsertConflictColumns: 'epub_book_id,audio_book_id,user_id'`, non-default `fieldMap`

**Test scenarios:**
- Happy path: `getTableEntry('notificationPreferences')` returns an entry with `fieldMap: { id: 'user_id' }` and `upsertConflictColumns: 'user_id'`
- Integration: `toSnakeCase(entry, { id: 'singleton', courseComplete: true, ... })` produces a payload with `user_id` key (not `id`) and `course_complete` key (not `courseComplete`)

**Verification:**
- `tableRegistry.test.ts` passes; `toSnakeCase` snapshot test produces expected snake_case keys

---

- [ ] **Unit 3: Store Wiring — replace `persistWithRetry` with `syncableWrite`**

**Goal:** Replace all three `persistWithRetry` write sites in `useNotificationPrefsStore` with `syncableWrite`; remove manual `updatedAt` stamps; ensure `init()` correctly handles both authenticated and anonymous sessions.

**Requirements:** R4, R5, R6

**Dependencies:** Unit 2 (registry entry must be correct before syncableWrite is called in tests)

**Files:**
- Modify: `src/stores/useNotificationPrefsStore.ts`
- Modify: `src/stores/__tests__/useNotificationPrefsStore.test.ts`

**Approach:**
- Import `syncableWrite` from `@/lib/sync/syncableWrite`
- In `init()`: replace `persistWithRetry(async () => db.notificationPreferences.put(defaults))` with `await syncableWrite('notificationPreferences', 'put', defaults)`. Remove `updatedAt: new Date().toISOString()` from the `defaults` object constructed inside `init()` — `syncableWrite` stamps it automatically. The in-memory `set({ prefs: ... })` call that follows must use the stamped record; the simplest approach is to re-read from Dexie or accept that the store's in-memory `updatedAt` will be set at call-time (both are correct).
- In `setTypeEnabled()`: remove `updatedAt: new Date().toISOString()` from the `next` record; replace `persistWithRetry` call with `await syncableWrite('notificationPreferences', 'put', next)`.
- In `setQuietHours()`: same removal and replacement as `setTypeEnabled`.
- **Stale closure guard:** The `next` record is constructed from `get().prefs` before the `await`. After switching to `syncableWrite`, the await is inside `syncableWrite` itself; the pattern remains safe (no state read after the await in the store code). No change needed here beyond the replacement.
- **DEFAULTS `updatedAt`:** The module-level `DEFAULTS` constant initializes `updatedAt: new Date().toISOString()`. This is the fallback in-memory value before `init()` runs. It is NOT the value written to Dexie (syncableWrite overwrites it). Leave `DEFAULTS.updatedAt` as-is — it is used only as the initial in-memory state and for the first-install "all-defaults" detection in hydration.
- Add a `hydrateFromRemote(remotePrefs: Partial<NotificationPreferences>): void` action to the store interface that accepts a validated remote snapshot and sets both `prefs` and `isLoaded: true`. This action is called by the hydration extension in Unit 4; it must not write to Dexie (hydration is read-only from the store's perspective — the remote data is already in Supabase, writing it back to Dexie is unnecessary).

**Patterns to follow:**
- `src/stores/useOpdsCatalogStore.ts` and `src/stores/useAudiobookshelfStore.ts` — E95-S05 wiring pattern
- `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md` — stale closure guard

**Test scenarios:**
- Happy path (authenticated): `init()` when no Dexie row exists → calls `syncableWrite` → Dexie row written → `syncQueue` has entry with `tableName: 'notificationPreferences'` and `payload` containing `user_id` (not `id`)
- Happy path (anonymous, null userId): `init()` with `useAuthStore` userId null → Dexie row still written → `syncQueue` is empty (auth guard fires)
- Happy path: `setTypeEnabled('course-complete', false)` → Dexie updated, `courseComplete: false`; queue entry enqueued with `course_complete: false` in payload
- Happy path: `setQuietHours({ quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '06:00' })` → Dexie updated; queue entry has `quiet_hours_enabled: true`, `quiet_hours_start: '23:00'`
- Edge case: `setTypeEnabled` when `persistWithRetry` would have been called with a manual `updatedAt` — verify no manual `updatedAt` appears in the `next` record passed to `syncableWrite` (the stamp comes from syncableWrite internally)
- Error path: `init()` DB failure → falls through with in-memory defaults, `isLoaded: true` (existing behavior preserved)
- Error path: `setTypeEnabled` — `db.notificationPreferences.put` failure → `toast.error('Failed to update notification preference')` shown
- Integration: `hydrateFromRemote` sets `prefs` to the provided snapshot and `isLoaded: true`; does NOT write to Dexie or syncQueue

**Verification:**
- `npm run test:unit` passes; no `persistWithRetry` import remains in `useNotificationPrefsStore.ts`
- `tsc --noEmit` passes with zero new errors

---

- [ ] **Unit 4: Hydration — extend `hydrateSettingsFromSupabase`**

**Goal:** After login, fetch the user's `notification_preferences` row from Supabase and hydrate `useNotificationPrefsStore` with remote data when remote is authoritative (remote timestamp ≥ local, or local is all-defaults).

**Requirements:** R8, R9, R10, R11, R12

**Dependencies:** Unit 1 (table must exist), Unit 3 (`hydrateFromRemote` action must exist)

**Files:**
- Modify: `src/lib/settings.ts`
- Test: `src/lib/sync/__tests__/` (new file: `p3-notification-preferences-sync.test.ts`) OR extend existing store test

**Approach:**
- Inside `hydrateSettingsFromSupabase`, after the `user_settings` hydration block (before the legacy AI migration block at the bottom), add a new best-effort block:
  ```
  try {
    fetch notification_preferences row via supabase.from(...).maybeSingle()
    if no row or error → skip (R10, R9)
    compare remote.updated_at vs local (isAllDefaults check + timestamp comparison)
    validate quietHoursStart / quietHoursEnd with HHMM_RE (R11)
    strip unknown fields / only apply known NotificationPreferences keys (R12)
    call useNotificationPrefsStore.getState().hydrateFromRemote(validated)
  } catch (err) {
    console.warn(...)  // silent-catch-ok (R9)
  }
  ```
- **isAllDefaults helper:** A local function that compares the store's current `prefs` against `DEFAULTS` (imported from the store or re-declared inline). If all preference fields match defaults, remote always wins regardless of timestamp. This handles the P2 first-install edge case.
- **Timestamp comparison:** `remote.updated_at >= local.prefs.updatedAt` (string ISO8601 comparison is lexicographically correct for UTC timestamps). Inclusive `>=` handles same-second races.
- **HHMM_RE validation (R11):** Re-declare or import the regex. Malformed values are replaced with the DEFAULTS values for those fields, not applied.
- **Unknown field guard (R12):** Only spread known keys from the remote row onto the validated object. A `Pick<NotificationPreferences, ...>` construction or an explicit allow-list of the 16 known fields prevents unknown keys from reaching the store.
- The notification preferences fetch is a separate `.from('notification_preferences')` call, NOT a join with `user_settings`. This matches how the existing store hydrations work (each fetch targets its own table).

**Patterns to follow:**
- The `user_settings` hydration block in `src/lib/settings.ts` lines 251–388 — `.single()` → error guard → store fan-out pattern. (Use `.maybeSingle()` here to avoid PGRST116 throw.)
- `hydrateStreak` call pattern — best-effort try/catch with `console.warn` on failure

**Test scenarios:**
- Happy path: remote row exists with `updated_at` newer than local → `hydrateFromRemote` called with validated prefs; `courseComplete: false` (remote value) applied to store
- Happy path (P2 default guard): local prefs are all-DEFAULTS; remote row has older `updated_at` → remote still wins (all-defaults means user never explicitly modified)
- Edge case: local timestamp strictly newer than remote (user changed prefs after another device upload) → local kept, `hydrateFromRemote` NOT called
- Edge case: same-second timestamps (local `updated_at === remote.updated_at`) → remote wins (inclusive `>=`)
- Edge case: remote row absent (new user / PGRST116) → hydration skipped, store unchanged (R10)
- Error path: Supabase fetch throws → `console.warn` called, hydration silently skipped, rest of `hydrateSettingsFromSupabase` continues (R9)
- Validation (R11): remote row has `quiet_hours_start: '99:00'` → field ignored; `DEFAULTS.quietHoursStart` used instead
- Validation (R12): remote row has an extra field `unknownField: true` → ignored; no runtime error
- Integration: `hydrateSettingsFromSupabase` with a mocked Supabase that returns a remote row → store state reflects remote values on next `getState()` call

**Verification:**
- `tsc --noEmit` passes
- Unit tests for the new hydration block pass
- E2E smoke: sign in on a device, toggle `course-complete` off, sign in on a second context → `courseComplete` is `false` in the store

## System-Wide Impact

- **Interaction graph:** `syncableWrite` → `db.syncQueue` → `syncEngine.nudge()` → upload cycle → `notification_preferences` table in Supabase. Download phase is covered by the existing LWW download engine (already handles P3 tables).
- **Error propagation:** `syncableWrite` Dexie failures propagate to the store; stores surface them via `toast.error`. Queue insert failures are logged but swallowed (existing contract). Hydration errors are swallowed with `console.warn`.
- **State lifecycle risks:** The singleton `id: 'singleton'` PK means there is never more than one Dexie row and one Supabase row per user. No ordering conflicts. First-install upload race is handled by the inclusive timestamp comparison in hydration.
- **API surface parity:** `NotificationPreferencesPanel` and `NotificationsSection` components are read-only consumers of the store; no changes needed. `NotificationService` reads the store via `isTypeEnabled` / `isInQuietHours` — these functions are unchanged.
- **Integration coverage:** The `hydrateFromRemote` action path is exercised by Unit 4 tests; the upload path is exercised by Unit 3 `syncQueue` assertion tests.
- **Unchanged invariants:** `isTypeEnabled`, `isInQuietHours`, and the `TYPE_TO_FIELD` map are not modified. The existing `init()` Dexie-load-from-existing-row path is unchanged (only the default-write sub-path changes).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `id: 'singleton'` passed as `recordId` to `syncableWrite` — upload engine tries to use it as a UUID key | Confirmed safe: `upsertConflictColumns: 'user_id'` + `fieldMap: { id: 'user_id' }` means `toSnakeCase` maps the field to `user_id` in the payload; the Supabase upsert targets `user_id` not `id`. Unit 3 test asserts `user_id` appears in payload. |
| Default DEFAULTS object's `updatedAt` (module load time) used in hydration comparison producing false "local is newer" result | Resolved by the all-defaults guard (P2): when prefs match DEFAULTS, remote always wins regardless of timestamp. |
| `hydrateSettingsFromSupabase` grows large — maintainability | Acceptable for MVP. Future refactor: fan out to per-store hydration functions. Not blocking this story. |
| `HHMM_RE` redeclaration in `settings.ts` (it currently lives only in the store) | Low risk: simple regex, easy to copy or export from store. Better to export and import for DRY. |
| tsc errors from `hydrateFromRemote` argument type if `NotificationPreferences` fields don't align with what Supabase returns | The Supabase response is `Record<string, unknown>`; the hydration code applies field-by-field with type checks. No structural typing conflict. |

## Documentation / Operational Notes

- No user-visible UI changes.
- New migration `20260426000001_notification_preferences.sql` must be applied to the self-hosted Supabase instance before E95-S06 ships.
- Sprint status YAML must be updated after merge.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e95-s06-notification-preferences-sync-requirements.md](docs/brainstorms/2026-04-19-e95-s06-notification-preferences-sync-requirements.md)
- Related code: `src/stores/useNotificationPrefsStore.ts`, `src/lib/settings.ts`, `src/lib/sync/tableRegistry.ts`, `src/lib/sync/syncableWrite.ts`
- Prior art stores: `src/stores/useOpdsCatalogStore.ts`, `src/stores/useAudiobookshelfStore.ts`
- Patterns: `chapterMappings` in `src/lib/sync/tableRegistry.ts` (upsertConflictColumns)
- Institutional learnings: `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md`, `docs/solutions/best-practices/single-write-path-for-synced-mutations-2026-04-18.md`, `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`
