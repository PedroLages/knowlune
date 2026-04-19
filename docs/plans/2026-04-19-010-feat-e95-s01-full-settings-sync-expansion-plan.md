---
title: "feat: Full Settings Sync Expansion (E95-S01)"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e95-s01-full-settings-sync-requirements.md
---

# feat: Full Settings Sync Expansion (E95-S01)

## Overview

Four Zustand stores persist user preferences exclusively to `localStorage`. When a user signs in on a second device, all preferences are silently absent. This plan wires all four stores to a new Supabase `user_settings` table via a direct JSONB merge RPC, while keeping `localStorage` as a cold-start fallback for offline and anonymous sessions.

No Dexie schema changes. No `syncableWrite()` involvement. No UI changes.

## Problem Frame

See origin: `docs/brainstorms/2026-04-19-e95-s01-full-settings-sync-requirements.md`.

The affected stores and their keys:

| Store | localStorage key | Fields |
|-------|-----------------|--------|
| `src/stores/useReaderStore.ts` | `knowlune-reader-settings-v1` | theme, fontSize, lineHeight, readingRulerEnabled, scrollMode, dualPage, showPageNumbers, showProgressBar |
| `src/stores/useAudiobookPrefsStore.ts` | `knowlune:audiobook-prefs-v1` | defaultSpeed, skipSilence, defaultSleepTimer, autoBookmarkOnStop |
| `src/stores/useReadingGoalStore.ts` | `knowlune:reading-goals` | dailyType, dailyTarget, yearlyBookTarget *(not streak fields)* |
| `src/stores/useEngagementPrefsStore.ts` | `levelup-engagement-prefs-v1` | achievements, streaks, badges, animations, colorScheme |

`user_settings` does not yet exist in Supabase — confirmed by scanning all migrations in `supabase/migrations/`.

## Requirements Trace

- R1 (AC1): Reader theme syncs cross-device.
- R2 (AC2): Audiobook default speed syncs cross-device.
- R3 (AC3): Reading goal (dailyType, dailyTarget, yearlyBookTarget) syncs cross-device.
- R4 (AC4): colorScheme syncs and applies on next app load.
- R5 (AC5): `localStorage` keys for reader, audiobook, and reading-goal stores are no longer written as primary persistence for authenticated users (localStorage retained as cold-start fallback).
- R6 (AC6): Fresh-device sign-in restores all four preference groups via `hydrateSettingsFromSupabase()`.
- R7 (AC7): Streak fields (`currentReadingStreak`, `longestReadingStreak`, `lastMetDate`) are NEVER in Supabase payloads.

## Scope Boundaries

- No Dexie schema changes — `user_settings` is a Supabase-only singleton, not a synced collection.
- No `syncableWrite()` / `tableRegistry.ts` changes for this story.
- No E2E tests — no UI or route changes.
- No streak sync — that is E95-S04.
- No Vault credential management — that is E95-S02.
- `src/stores/useEngagementPrefsStore.ts` `badges` and `animations` fields are not in the JSONB field map and remain `localStorage`-only (not in the AC scope). Only `achievements`, `streaks`, and `colorScheme` are synced.

### Deferred to Separate Tasks

- Streak server calculation: E95-S04
- Supabase Vault for API keys: E95-S02

## Context & Research

### Relevant Code and Patterns

- `src/lib/settings.ts` — existing `hydrateSettingsFromSupabase(userMetadata): void` (currently sync, no Supabase fetch). This is the primary file to extend.
- `src/app/hooks/useAuthLifecycle.ts` — calls `hydrateSettingsFromSupabase(userMetadata)` on line 57 synchronously (not awaited). After this story it must be awaited, as the function becomes async. The call is already inside an `async function handleSignIn(...)` so `await` is safe with no restructuring.
- `src/stores/useEngagementPrefsStore.ts` — already calls `saveSettings({ colorScheme })` (localStorage bridge to `app-settings`) plus dispatches `settingsUpdated` event. The Supabase write is an additive call alongside this, not a replacement.
- `src/stores/useAudiobookPrefsStore.ts` — `persistPrefs()` is the localStorage write path; each setter calls it after `set()`.
- `src/stores/useReaderStore.ts` — `saveSettings(...)` called in each setter after `set()`. Field mapping is non-trivial (see below).
- `src/stores/useReadingGoalStore.ts` — `saveGoal()` writes to localStorage. Streak fields must be excluded from Supabase payload.
- `supabase/migrations/20260413000002_p1_learning_content.sql` — reference for SECURITY DEFINER function pattern with RLS split and `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated`.
- `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` — reference for explicit authz guard in SECURITY DEFINER functions.
- `src/lib/__tests__/settings.test.ts` — existing test file for `src/lib/settings.ts`; new tests extend this file.
- `src/stores/__tests__/useAudiobookPrefsStore.test.ts` — existing store test pattern (vi.mock, beforeEach reset, getState() calls).
- `src/app/hooks/__tests__/useAuthLifecycle.test.ts` — existing mock pattern for `vi.mock('@/lib/auth/supabase', ...)`.

### Field Mapping (store field → JSONB key)

| Store | Store field | JSONB key |
|-------|------------|-----------|
| useReaderStore | `theme` | `readingTheme` |
| useReaderStore | `fontSize` | `readingFontSize` |
| useReaderStore | `lineHeight` | `readingLineHeight` |
| useReaderStore | `readingRulerEnabled` | `readingRuler` |
| useReaderStore | `scrollMode` | `scrollMode` |
| useAudiobookPrefsStore | `defaultSpeed` | `defaultSpeed` |
| useAudiobookPrefsStore | `skipSilence` | `skipSilence` |
| useAudiobookPrefsStore | `defaultSleepTimer` | `defaultSleepTimer` |
| useAudiobookPrefsStore | `autoBookmarkOnStop` | `autoBookmarkOnStop` |
| useReadingGoalStore | `goal.dailyType` | `dailyType` |
| useReadingGoalStore | `goal.dailyTarget` | `dailyTarget` |
| useReadingGoalStore | `goal.yearlyBookTarget` | `yearlyBookTarget` |
| useEngagementPrefsStore | `achievements` | `achievementsEnabled` |
| useEngagementPrefsStore | `streaks` | `streaksEnabled` |
| useEngagementPrefsStore | `colorScheme` | `colorScheme` |

### Institutional Learnings

- **Single-write-path discipline** (`docs/solutions/sync/`): each store mutation retains its `localStorage` write and adds a side-effectful Supabase call. The Supabase call is fire-and-forget (`void async`) — it must never throw into the calling store setter.
- **SECURITY DEFINER functions need explicit authz guard** (`docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`): the `merge_user_settings` RPC uses `SECURITY DEFINER` and should guard `p_user_id IS DISTINCT FROM auth.uid()` to prevent cross-user writes if called with a spoofed ID.
- **REVOKE/GRANT pattern**: all SECURITY DEFINER functions in this codebase follow `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ON FUNCTION ... TO authenticated`.

## Key Technical Decisions

- **Direct Supabase RPC, not `syncableWrite`**: `user_settings` is a singleton row per user (not a collection). The Dexie sync queue is optimized for collections; using it here would require an unnecessary Dexie table and schema migration. Decision: direct `supabase.rpc('merge_user_settings', ...)` call. (see origin: requirements doc § Architecture Decision)
- **JSONB key-level merge via `||` operator**: a plain `upsert` overwrites the entire `settings` blob, so storing reader theme from Device A then audiobook speed from Device B would wipe Device A's reader theme. The Postgres `||` JSONB merge operator ensures only the changed key is written; unrelated keys survive untouched.
- **`hydrateSettingsFromSupabase` becomes async**: currently `void` (synchronous). Adding a Supabase `select` requires `async`. Call site in `useAuthLifecycle.ts` already runs inside an `async function handleSignIn()`, so `await hydrateSettingsFromSupabase(userMetadata)` is a one-line change.
- **`localStorage` retained as cold-start fallback**: every store still writes to `localStorage` on every mutation. On a new device with no Supabase row yet, the store loads from localStorage defaults on cold start, then gets overwritten by Supabase on sign-in. This is the same dual-write pattern used throughout E92–E94.
- **Hydration is "last-write-wins from Supabase"**: on sign-in, Supabase preferences always win over any stale localStorage values. This is correct — the Supabase row is the canonical cross-device source of truth.
- **`useEngagementPrefsStore` `badges` and `animations` NOT synced**: only `achievements`, `streaks`, and `colorScheme` appear in the ACs. `badges` and `animations` remain localStorage-only — they are not in the JSONB field map.

## Open Questions

### Resolved During Planning

- **Does `user_settings` table already exist?** No — confirmed by scanning all migration files. Migration must be created.
- **Is `hydrateSettingsFromSupabase` already awaited at call site?** No — currently called as a sync function. It becomes async and must be awaited. The call site is inside `async function handleSignIn` so this is a non-breaking change.
- **Which engagement prefs to sync?** The ACs name `colorScheme` and the requirements surface `achievementsEnabled`/`streaksEnabled`. `badges` and `animations` are excluded from the JSONB map.
- **Can `src/lib/settings.ts` import Zustand store modules?** Yes — Zustand stores export `getState()` which is safe in non-React modules. The module already imports from `@/lib/auth/supabase`, so adding store imports is pattern-consistent.

### Deferred to Implementation

- Exact TypeScript type name for `AllUserPreferences` — implementer decides whether to use a flat interface, a type alias, or inline `Partial<Record<string, unknown>>`.
- Whether to add a `REVOKE/GRANT` on `merge_user_settings` via a separate `ALTER FUNCTION` statement or inline. Either is correct — follow the pattern in `20260417000003_p0_sync_foundation_r4.sql`.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Store setter (e.g. useReaderStore.setTheme('sepia'))
  ├─► saveSettings({ theme })         ← existing localStorage write (keep)
  ├─► set({ theme })                  ← Zustand in-memory update (keep)
  └─► void saveSettingsToSupabase({ readingTheme: 'sepia' })   ← new, fire-and-forget

saveSettingsToSupabase(patch)
  ├─► supabase.auth.getUser()         ← if no user, return early (anonymous)
  └─► supabase.rpc('merge_user_settings', { p_user_id, p_patch: patch })
        └─► [Postgres] COALESCE(settings, '{}') || patch   ← key-level merge

Sign-in (useAuthLifecycle.handleSignIn)
  └─► await hydrateSettingsFromSupabase(userMetadata)
        ├─► [existing] profile fields from user_metadata
        └─► [new] supabase.from('user_settings').select('settings').eq('user_id', uid)
              └─► restore each field to its store via store.getState().setSetter(value)
```

## Implementation Units

- [ ] **Unit 1: Supabase migration — `user_settings` table and `merge_user_settings` RPC**

**Goal:** Create the Supabase-side infrastructure: a `user_settings` table with a `settings JSONB` column and a `SECURITY DEFINER` RPC that performs a key-level merge upsert.

**Requirements:** R1–R6 (table and RPC are prerequisites for all sync paths)

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260422000001_user_settings.sql`
- Create: `supabase/migrations/rollback/20260422000001_user_settings_rollback.sql`

**Approach:**
- Table: `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `settings JSONB NOT NULL DEFAULT '{}'`, `updated_at TIMESTAMPTZ DEFAULT now()`. No `moddatetime` trigger needed — `updated_at` is set manually inside the RPC.
- RLS: enable RLS, create separate `FOR SELECT`, `FOR INSERT`, `FOR UPDATE` policies with `auth.uid() = user_id`. No DELETE policy needed (settings rows are permanent; CASCADE handles auth user deletion).
- `merge_user_settings(p_user_id UUID, p_patch JSONB)` function: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`. Guards: `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'cross-user write forbidden'; END IF;`. Body: `INSERT INTO user_settings (user_id, settings, updated_at) VALUES (p_user_id, p_patch, now()) ON CONFLICT (user_id) DO UPDATE SET settings = COALESCE(user_settings.settings, '{}') || p_patch, updated_at = now();`
- Apply `REVOKE EXECUTE ON FUNCTION public.merge_user_settings(uuid, jsonb) FROM PUBLIC;` and `GRANT EXECUTE ON FUNCTION public.merge_user_settings(uuid, jsonb) TO authenticated;`.
- Wrap in `BEGIN; ... COMMIT;` (idempotent).
- Rollback drops the function, policies, and table in reverse order.

**Patterns to follow:**
- `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` — SECURITY DEFINER with `IS DISTINCT FROM auth.uid()` guard and REVOKE/GRANT pattern.
- `supabase/migrations/001_entitlements.sql` — RLS policy split (FOR SELECT / FOR INSERT / FOR UPDATE) structure.

**Test scenarios:**
- Test expectation: none — Supabase migration DDL; behavioral correctness verified in Unit 4 via mocked Supabase client.

**Verification:**
- `supabase/migrations/20260422000001_user_settings.sql` runs without error.
- `user_settings` table exists with `user_id`, `settings`, `updated_at` columns.
- `merge_user_settings` function exists and is callable by `authenticated` role.

---

- [ ] **Unit 2: `saveSettingsToSupabase()` in `src/lib/settings.ts`**

**Goal:** Add the `saveSettingsToSupabase(patch)` function that authenticated callers use to push a preference key-patch to Supabase without awaiting the result. Anonymous callers return immediately.

**Requirements:** R1–R5, R7

**Dependencies:** Unit 1 (RPC must exist; tested via mocks)

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/__tests__/settings.test.ts`

**Approach:**
- `saveSettingsToSupabase` is an `async` function returning `Promise<void>`.
- Gets the current user via `supabase.auth.getUser()`. If `!user`, returns immediately (anonymous or unauthenticated).
- Calls `supabase.rpc('merge_user_settings', { p_user_id: user.id, p_patch: patch })`.
- On error: `console.warn('[settings] Supabase save failed:', error)`. Never re-throws.
- The parameter type is a flat `Partial<Record<string, unknown>>` or an explicit `AllUserPrefs` type — implementer's choice. Must accept all 15 JSONB keys listed in the field map.
- No `await` at call sites in stores — callers use `void saveSettingsToSupabase(...)`.

**Patterns to follow:**
- Existing `saveSettings()` fire-and-forget pattern in `src/lib/settings.ts` for `supabase.auth.updateUser()`.
- Test mocking: `vi.mock('@/lib/auth/supabase', ...)` pattern from `src/app/hooks/__tests__/useAuthLifecycle.test.ts`.

**Test scenarios:**
- Happy path: `saveSettingsToSupabase({ readingTheme: 'sepia' })` when authenticated → `supabase.rpc` called once with `p_user_id = user.id` and `p_patch = { readingTheme: 'sepia' }`.
- Anonymous: user is null → `supabase.rpc` never called; function returns without throwing.
- Network failure: `supabase.rpc` rejects → `console.warn` called; function returns without throwing.
- Streak fields are never in the type signature; implementer should confirm no streak key can be passed.

**Verification:**
- `saveSettingsToSupabase({ readingTheme: 'sepia' })` calls `supabase.rpc('merge_user_settings', ...)` in tests.
- All unit tests pass.

---

- [ ] **Unit 3: `hydrateSettingsFromSupabase()` expansion**

**Goal:** Extend `hydrateSettingsFromSupabase` to also fetch the `user_settings` row from Supabase and apply all 15 preference fields to their respective stores.

**Requirements:** R6 (AC6)

**Dependencies:** Unit 1 (table must exist), Unit 2 (conceptual — both in settings.ts)

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/app/hooks/useAuthLifecycle.ts` (call site: `await hydrateSettingsFromSupabase(...)`)
- Modify: `src/lib/__tests__/settings.test.ts`
- Modify: `src/app/hooks/__tests__/useAuthLifecycle.test.ts` (update mock for now-async function)

**Approach:**
- Change signature from `(userMetadata): void` to `async (userMetadata): Promise<void>`.
- After the existing `userMetadata` profile hydration block, add: fetch `supabase.from('user_settings').select('settings').eq('user_id', userId).single()`. Errors are silently swallowed with `console.warn` — hydration is best-effort.
- If `data?.settings` is a non-null object, apply each field to its store via `store.getState().setter(value)` with validation guards (`?? default` and type checks) before applying. Never apply `undefined` or an invalid enum value.
- Store imports: `useReaderStore`, `useAudiobookPrefsStore`, `useReadingGoalStore`, `useEngagementPrefsStore` — all safe to import in a non-React module via `getState()`.
- `hydrateSettingsFromSupabase` needs the authenticated user's ID to query `user_settings`. The `userMetadata` parameter does not include `user_id`. Options:
  - Call `supabase.auth.getUser()` inside the function to get the UUID (one additional async call on sign-in).
  - Or accept `userId` as a second optional parameter and have the call site pass `session.user.id`.
  - **Recommended**: add `userId?: string` as second parameter. The call site in `useAuthLifecycle.ts` line 57 already has `session.user.id` available — pass it directly. Avoids a second `getUser()` round-trip.
- Call site in `useAuthLifecycle.ts`: update `hydrateSettingsFromSupabase(userMetadata)` → `await hydrateSettingsFromSupabase(userMetadata, session.user.id)`. The function is already inside `async function handleSignIn(userId, userMetadata)` so `await` is safe.
- The `useAuthLifecycle.test.ts` mock `vi.mock('@/lib/settings', () => ({ hydrateSettingsFromSupabase: vi.fn() }))` continues to work; update mock to `vi.fn().mockResolvedValue(undefined)` to reflect the now-async shape.

**Patterns to follow:**
- Existing guard pattern in `hydrateSettingsFromSupabase` using `?? default` and `typeof checks`.
- `src/stores/useEngagementPrefsStore.ts` `setPreference` method — use this for colorScheme hydration to also trigger the `settingsUpdated` event and `saveSettings` bridge.

**Test scenarios:**
- Happy path: mocked `supabase.from(...).select().eq().single()` returns `{ settings: { readingTheme: 'sepia', defaultSpeed: 1.5 } }` → `useReaderStore.getState().setTheme('sepia')` called; `useAudiobookPrefsStore.getState().setDefaultSpeed(1.5)` called.
- Partial data: settings JSONB is missing some keys → missing keys are not applied (no `undefined` written to store).
- No row: `data` is null (user has no `user_settings` row yet) → no store setters called; function completes silently.
- Supabase error on fetch: error returned → `console.warn` called; function does not throw; existing profile hydration (displayName etc.) still applies.
- Anonymous call (no userId): function returns early without fetching `user_settings`.
- `colorScheme` hydration: setting `colorScheme = 'vibrant'` triggers `useEngagementPrefsStore.setPreference('colorScheme', 'vibrant')` which in turn dispatches `settingsUpdated`.

**Verification:**
- All test scenarios pass.
- `useAuthLifecycle` test still passes after `hydrateSettingsFromSupabase` becomes async.

---

- [ ] **Unit 4: Dual-write wiring in `useReaderStore.ts`**

**Goal:** Add `void saveSettingsToSupabase({ ... })` to every preference-bearing setter in `useReaderStore`, alongside the existing localStorage path.

**Requirements:** R1 (AC1), R5 (AC5 partially)

**Dependencies:** Unit 2

**Files:**
- Modify: `src/stores/useReaderStore.ts`
- Modify: `src/stores/__tests__/useReaderStore.test.ts`

**Approach:**
- Each of the following setters gains a `void saveSettingsToSupabase({ <jsonbKey>: value })` call: `setTheme` (key: `readingTheme`), `setFontSize` (key: `readingFontSize`), `setLineHeight` (key: `readingLineHeight`), `setReadingRulerEnabled` (key: `readingRuler`), `setScrollMode` (key: `scrollMode`).
- Setters NOT synced (not in ACs): `setFontFamily`, `setLetterSpacing`, `setWordSpacing`, `setDualPage`, `setShowPageNumbers`, `setShowProgressBar`. These remain localStorage-only.
- The existing `saveSettings(...)` call in each setter is KEPT — localStorage is the offline/anonymous fallback.
- `resetSettings()` does NOT call `saveSettingsToSupabase` — resetting is a local-only operation for now.
- Import `saveSettingsToSupabase` at the top of the file from `@/lib/settings`.

**Patterns to follow:**
- `src/stores/useEngagementPrefsStore.ts` — `void saveSettings(...)` alongside `persistPrefs()` pattern.
- Existing setter structure in `src/stores/useReaderStore.ts`.

**Test scenarios:**
- Happy path: `setTheme('sepia')` → `saveSettingsToSupabase` called with `{ readingTheme: 'sepia' }` (mock Supabase client).
- Happy path: `setFontSize(120)` → `saveSettingsToSupabase` called with `{ readingFontSize: 120 }`.
- Happy path: `setLineHeight(1.8)` (clamped) → `saveSettingsToSupabase` called with `{ readingLineHeight: 1.8 }`.
- Happy path: `setReadingRulerEnabled(true)` → `saveSettingsToSupabase({ readingRuler: true })`.
- Happy path: `setScrollMode(true)` → `saveSettingsToSupabase({ scrollMode: true })`.
- Unsynced setter: `setFontFamily('serif')` → `saveSettingsToSupabase` NOT called.
- Existing localStorage tests still pass (dual-write: both paths active).

**Verification:**
- All new and existing tests pass.
- `setTheme()` invokes both `saveSettings()` (localStorage) and `saveSettingsToSupabase()` (Supabase).

---

- [ ] **Unit 5: Dual-write wiring in `useAudiobookPrefsStore.ts`**

**Goal:** Add `void saveSettingsToSupabase({ ... })` to each setter in `useAudiobookPrefsStore`, alongside the existing `persistPrefs()` localStorage path.

**Requirements:** R2 (AC2)

**Dependencies:** Unit 2

**Files:**
- Modify: `src/stores/useAudiobookPrefsStore.ts`
- Modify: `src/stores/__tests__/useAudiobookPrefsStore.test.ts`

**Approach:**
- `setDefaultSpeed(speed)`: add `void saveSettingsToSupabase({ defaultSpeed: validated })` after `persistPrefs(...)`. Note: use `validated` (post-validation value), not the raw `speed` parameter.
- `toggleSkipSilence()`: add `void saveSettingsToSupabase({ skipSilence: get().skipSilence })` after `persistPrefs(...)`. Read state from `get()` post-`set()`.
- `setDefaultSleepTimer(timer)`: add `void saveSettingsToSupabase({ defaultSleepTimer: timer })`.
- `toggleAutoBookmark()`: add `void saveSettingsToSupabase({ autoBookmarkOnStop: get().autoBookmarkOnStop })`.
- `persistPrefs()` is KEPT for offline/anonymous fallback.

**Patterns to follow:**
- `src/stores/useAudiobookPrefsStore.ts` existing setter pattern (set → get → persistPrefs).

**Test scenarios:**
- Happy path: `setDefaultSpeed(1.5)` → `saveSettingsToSupabase({ defaultSpeed: 1.5 })` called.
- Invalid speed: `setDefaultSpeed(99)` → validated to `1.0`; `saveSettingsToSupabase({ defaultSpeed: 1.0 })` called with validated value.
- `toggleSkipSilence()` twice → `saveSettingsToSupabase({ skipSilence: true })` then `saveSettingsToSupabase({ skipSilence: false })`.
- Existing localStorage persistence tests still pass.

**Verification:**
- All new and existing tests pass.

---

- [ ] **Unit 6: Partial dual-write wiring in `useReadingGoalStore.ts` (no streak fields)**

**Goal:** Add `void saveSettingsToSupabase({ dailyType, dailyTarget, yearlyBookTarget })` to `saveGoal()`. Streak fields must never be included. Streak `localStorage` key remains unchanged.

**Requirements:** R3 (AC3), R7 (AC7)

**Dependencies:** Unit 2

**Files:**
- Modify: `src/stores/useReadingGoalStore.ts`
- Modify: `src/stores/__tests__/useReadingGoalStore.test.ts` (if it exists; create if not)

**Approach:**
- `saveGoal(partial)`: after `localStorage.setItem(STORAGE_KEY, ...)`, add:
  ```
  void saveSettingsToSupabase({
    dailyType: goal.dailyType,
    dailyTarget: goal.dailyTarget,
    yearlyBookTarget: goal.yearlyBookTarget,
  })
  ```
- `clearGoal()`, `checkDailyGoalMet()`, `checkPagesGoalMet()`, `checkYearlyGoalReached()` — no Supabase calls added (no preference data changed).
- Streak key `knowlune:reading-goal-streak` — localStorage only. No change.

**Patterns to follow:**
- Dual-write pattern from Unit 4 and Unit 5.

**Test scenarios:**
- Happy path: `saveGoal({ dailyType: 'pages', dailyTarget: 20, yearlyBookTarget: 24 })` → `saveSettingsToSupabase` called with exactly `{ dailyType: 'pages', dailyTarget: 20, yearlyBookTarget: 24 }` and NOT with any streak field.
- Streak guard: `saveSettingsToSupabase` call arguments must not contain `currentReadingStreak`, `longestReadingStreak`, or `lastMetDate`.
- `clearGoal()` → `saveSettingsToSupabase` NOT called.
- Existing localStorage tests still pass.

**Verification:**
- All tests pass; streak exclusion verified by inspecting mock call arguments.

---

- [ ] **Unit 7: Dual-write wiring in `useEngagementPrefsStore.ts`**

**Goal:** Add `void saveSettingsToSupabase({ ... })` for `achievements`, `streaks`, and `colorScheme` keys in `setPreference()`.

**Requirements:** R4 (AC4)

**Dependencies:** Unit 2

**Files:**
- Modify: `src/stores/useEngagementPrefsStore.ts`
- Modify: `src/stores/__tests__/useEngagementPrefsStore.test.ts`

**Approach:**
- In `setPreference(key, value)`, after `persistPrefs(prefs)`, add conditional Supabase sync for the three synced keys:
  - `key === 'achievements'` → `void saveSettingsToSupabase({ achievementsEnabled: value as boolean })`
  - `key === 'streaks'` → `void saveSettingsToSupabase({ streaksEnabled: value as boolean })`
  - `key === 'colorScheme'` → `void saveSettingsToSupabase({ colorScheme: value as ColorScheme })`
- `badges` and `animations` are NOT synced.
- The existing `saveSettings({ colorScheme })` bridge and `settingsUpdated` dispatch for `colorScheme` are KEPT.
- `resetToDefaults()` does NOT call `saveSettingsToSupabase`.

**Patterns to follow:**
- Existing `key === 'colorScheme'` branch pattern in `setPreference()`.

**Test scenarios:**
- Happy path: `setPreference('colorScheme', 'vibrant')` → `saveSettingsToSupabase({ colorScheme: 'vibrant' })` called.
- Happy path: `setPreference('achievements', false)` → `saveSettingsToSupabase({ achievementsEnabled: false })` called.
- Happy path: `setPreference('streaks', false)` → `saveSettingsToSupabase({ streaksEnabled: false })` called.
- Unsynced key: `setPreference('badges', false)` → `saveSettingsToSupabase` NOT called.
- Unsynced key: `setPreference('animations', false)` → `saveSettingsToSupabase` NOT called.
- `resetToDefaults()` → `saveSettingsToSupabase` NOT called.

**Verification:**
- All new and existing tests pass.

## System-Wide Impact

- **Interaction graph:** `hydrateSettingsFromSupabase()` now imports `useReaderStore`, `useAudiobookPrefsStore`, `useReadingGoalStore`, and `useEngagementPrefsStore`. These are Zustand stores with `getState()` access — safe in non-React modules. No circular dependency risk since stores do not import `settings.ts`.
- **Error propagation:** All `saveSettingsToSupabase()` failures are swallowed with `console.warn`. No toast, no rethrow. Offline users see no error. This matches existing `saveSettings()` error behavior.
- **State lifecycle risks:** Hydration on sign-in is "last-write-wins from Supabase." If a user changes a preference while offline and then signs in, the Supabase value replaces the local one. This is intentional — Supabase is the cross-device source of truth. (A conflict-resolution UX is out of scope.)
- **API surface parity:** `hydrateSettingsFromSupabase` signature changes from `(userMetadata) => void` to `async (userMetadata, userId?) => Promise<void>`. The only call site is `useAuthLifecycle.ts` — update required. The `useAuthLifecycle.test.ts` mock must be updated to `vi.fn().mockResolvedValue(undefined)`.
- **Integration coverage:** No cross-service boundary tests needed — all Supabase calls are mocked at the `@/lib/auth/supabase` module boundary in unit tests.
- **Unchanged invariants:** `localStorage` write paths in all four stores are preserved unchanged. Anonymous and offline users continue to get the same localStorage-backed behavior as before this story.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `merge_user_settings` RPC not yet deployed to Supabase when browser calls it | Test environment uses mocked Supabase. Production deploy runs migration before code. |
| `hydrateSettingsFromSupabase` import of store modules creates a circular dependency | Verify: stores import `syncableWrite` and `@/lib/auth/supabase` but NOT `settings.ts`. Safe. |
| Hydration applies `undefined` value to a store setter (e.g., missing JSONB key) | Guard with `?? default` checks before calling any setter. |
| `useEngagementPrefsStore.setPreference('colorScheme')` triggers `settingsUpdated` on hydration (double-fire) | Acceptable — the event triggers a CSS class re-apply which is idempotent. |
| `useReadingGoalStore.saveGoal()` streak fields accidentally included in Supabase patch | Verified by dedicated test scenario in Unit 6. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e95-s01-full-settings-sync-requirements.md](docs/brainstorms/2026-04-19-e95-s01-full-settings-sync-requirements.md)
- Related code: `src/lib/settings.ts`, `src/app/hooks/useAuthLifecycle.ts`
- Related stores: `src/stores/useReaderStore.ts`, `src/stores/useAudiobookPrefsStore.ts`, `src/stores/useReadingGoalStore.ts`, `src/stores/useEngagementPrefsStore.ts`
- Related migrations: `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` (SECURITY DEFINER pattern)
- Institutional learnings: `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`
- Story file: `docs/implementation-artifacts/stories/E95-S01-full-settings-sync-expansion.md`
