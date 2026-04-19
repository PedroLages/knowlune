---
date: 2026-04-19
topic: e95-s06-notification-preferences-sync
---

# E95-S06: Notification Preferences Sync

## Problem Frame

Notification preferences (per-category toggles, quiet hours, push-enabled flag) are stored exclusively in Dexie/IndexedDB. When a user installs Knowlune on a second device, their notification settings reset to defaults rather than reflecting the choices they made on their primary device.

The `notificationPreferences` table is already declared in the sync table registry (P3, LWW, `supabaseTable: 'notification_preferences'`), and `useNotificationPrefsStore` already writes to Dexie via `persistWithRetry`. The remaining work is: a Supabase migration for the `notification_preferences` table, replacing `persistWithRetry` calls with `syncableWrite`, and adding hydration on login.

## Key Decision: user_settings JSONB vs. Dedicated Table

**Decision: dedicated `notification_preferences` table (already chosen by the registry).**

The tableRegistry already declares `supabaseTable: 'notification_preferences'` — this decision is effectively made. Rationale: notification prefs are a singleton but structurally distinct from the 15 UI/AI/goal fields in `user_settings`. A dedicated table keeps each concern queryable independently and leaves the door open for server-side push subscription records (APNS/FCM tokens) in a future epic, which would be awkward inside a JSONB blob.

`user_settings` + `merge_user_settings()` RPC would have been simpler (zero migration, zero new RPC) but loses type safety at the column level and couples two unrelated preference domains.

## Requirements

**Supabase Schema**
- R1. Add a `notification_preferences` migration with one row per user (`user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE`), individual boolean columns for each `NotificationType` field (matching the `NotificationPreferences` Dexie schema), plus `quiet_hours_enabled`, `quiet_hours_start` (TEXT HH:MM), `quiet_hours_end` (TEXT HH:MM), and `updated_at TIMESTAMPTZ`.
- R2. Enable RLS on `notification_preferences` with `auth.uid() = user_id` policies for SELECT, INSERT, and UPDATE. All mutations go through the client (no SECURITY DEFINER RPC needed — LWW upsert via the sync engine is sufficient).
- R3. Grant SELECT, INSERT, UPDATE to the `authenticated` role.

**Store Wiring**
- R4. Replace `persistWithRetry(async () => db.notificationPreferences.put(...))` calls in `useNotificationPrefsStore` with `syncableWrite('notificationPreferences', 'put', record)` so every toggle and quiet-hours change enqueues to the sync engine.
- R5. The `init()` path (first-time default write) must also use `syncableWrite` so the singleton row is uploaded on first sign-in.
- R6. `syncableWrite` stamps `userId` and `updatedAt` automatically — remove any manual `updatedAt: new Date().toISOString()` assignments that would conflict.

**Field Mapping**
- R7. The existing camelCase-to-snake_case auto-conversion in `fieldMapper.ts` handles all boolean columns and quiet-hours fields correctly (e.g. `courseComplete → course_complete`, `quietHoursEnabled → quiet_hours_enabled`). No overrides are needed in `fieldMap` for these fields. However, the Dexie PK `id: 'singleton'` has no corresponding Supabase column — the Supabase PK is `user_id`. Add `id: 'user_id'` to the registry `fieldMap` and set `upsertConflictColumns: 'user_id'` so the sync engine upserts on the correct column. (Pattern reference: `chapter_mappings` in `src/lib/sync/tableRegistry.ts` uses `upsertConflictColumns` for the same reason.)

**Hydration on Login**
- R8. After a successful login, hydrate `useNotificationPrefsStore` from the Supabase `notification_preferences` row in `hydrateSettingsFromSupabase()` (in `src/lib/settings.ts`). Strategy: remote wins if `remote.updated_at > local.prefs.updatedAt`; otherwise keep local.
- R9. Hydration must be best-effort (errors swallowed with `console.warn`); it must not block the rest of profile hydration.
- R10. If no remote row exists (new user), skip hydration and let the local defaults stand.

**Validation / Guards**
- R11. Incoming remote values for `quietHoursStart` and `quietHoursEnd` must pass the existing `HHMM_RE` validation before being applied; malformed values from remote are discarded.
- R12. Unknown `NotificationType` fields present in remote data (future additions) must be ignored rather than causing a runtime error.

## Success Criteria

- After signing in on a second device, notification toggles and quiet-hours settings match what the user configured on their primary device.
- Toggling any notification category on Device A propagates to Device B within the normal sync cycle (no additional user action required).
- `tsc --noEmit` passes with zero new errors.
- Existing notification-related E2E tests (if any) continue to pass; store unit tests pass with `syncableWrite` replacing `persistWithRetry`.

## Scope Boundaries

- Push subscription tokens (APNS/FCM device tokens) are out of scope — this story syncs preference flags only, not OS-level push registration state.
- No new UI. The `NotificationPreferencesPanel` component is unchanged.
- `push_enabled` as a top-level boolean (distinct from per-category toggles) is out of scope unless it already exists in `NotificationPreferences` — wire whatever fields are present in the Dexie schema, no additions.
- No server-side enforcement of quiet hours (e.g., suppressing push at the server layer). This story is client-side preference sync only.

## Dependencies / Assumptions

- `notificationPreferences` is already registered in `src/lib/sync/tableRegistry.ts` (P3, LWW, `supabaseTable: 'notification_preferences'`). No registry changes needed beyond updating `fieldMap`.
- The sync engine upload path (E92-S05) and `syncableWrite` (E92-S04) are already operational.
- `hydrateSettingsFromSupabase` in `src/lib/settings.ts` is the established hook for post-login store hydration (used by E95-S01 through E95-S04).
- The `NotificationPreferences` Dexie type in `src/data/types` defines the canonical field set; the Supabase migration must match it exactly.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Needs research] Confirm the exact field list in `NotificationPreferences` from `src/data/types` (including `bookImported`, `bookDeleted`, `highlightReview` added in E86-S02) to ensure the migration covers all columns.
- [Affects R8][Technical] Confirm whether `hydrateSettingsFromSupabase` receives the `notification_preferences` row already (via a join), or whether a separate `.from('notification_preferences').select()` call is needed.

## Next Steps

-> `/ce:plan` for structured implementation planning
