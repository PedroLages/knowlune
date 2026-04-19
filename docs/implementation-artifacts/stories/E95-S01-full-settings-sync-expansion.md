---
story_id: E95-S01
story_name: "Full Settings Sync Expansion"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 95.01: Full Settings Sync Expansion

## Story

As a learner who uses Knowlune on multiple devices,
I want my reading preferences, audiobook settings, reading goals, and engagement preferences synced automatically,
so that I never have to re-configure my preferences when switching devices.

## Acceptance Criteria

**AC1 — Reader preferences sync cross-device:**
Given I set reading theme to "sepia" on Device A.
When Device B syncs (signs in or pulls from Supabase).
Then Device B shows "sepia" as the active reader theme.

**AC2 — Audiobook preferences sync cross-device:**
Given I set default audiobook speed to 1.5× on Device A.
When Device B syncs.
Then Device B shows 1.5× as the default speed.

**AC3 — Reading goal syncs cross-device:**
Given I set a daily target of 20 pages on Device A.
When Device B syncs.
Then Device B shows "20 pages" as the daily target.

**AC4 — Color scheme syncs cross-device:**
Given I set colorScheme to "vibrant" on Device A.
When Device B syncs.
Then Device B applies "vibrant" on the next app load.

**AC5 — localStorage no longer used for preference data:**
Given the stores have been migrated to sync-backed persistence.
When I inspect localStorage after saving a reader preference.
Then the keys `knowlune-reader-settings-v1` and `knowlune:audiobook-prefs-v1` and `knowlune:reading-goals` are absent (no longer written by those stores).

**AC6 — New device fully restored on sign-in:**
Given a user signs in on a brand-new device with no localStorage data.
When `hydrateSettingsFromSupabase()` runs.
Then all four preference groups (reader, audiobook, reading goals, engagement) are restored from the `user_settings` JSONB row in Supabase.

**AC7 — Streak fields excluded from E95-S01 sync:**
Given the `readingGoal` has `currentReadingStreak` and `longestReadingStreak` fields.
When E95-S01 stores goal settings.
Then streak counts are NOT written to the sync payload (those are server-calculated in E95-S04).

## Tasks / Subtasks

- [ ] Task 1: Add `saveSettingsToSupabase()` and expand `hydrateSettingsFromSupabase()` (AC6)
  - [ ] 1.1 In `src/lib/settings.ts`, add `saveSettingsToSupabase(prefs: SettingsPatch): Promise<void>` — does a Supabase `upsert` into `user_settings` table with `{ user_id: authUser.id, settings: { ...prefs } }` using jsonb merge approach (`||` operator via RPC or upsert with `settings = settings || $input`)
  - [ ] 1.2 Expand `hydrateSettingsFromSupabase()` to also fetch the `user_settings` row from Supabase (not just user_metadata) and restore all four preference groups to each store

- [ ] Task 2: Migrate `useReaderStore.ts` off localStorage (AC1, AC5)
  - [ ] 2.1 Replace all `saveSettings(...)` calls (localStorage writes) with `saveSettingsToSupabase({ readingTheme, readingFontSize, ... })` — fire-and-forget with logged catch
  - [ ] 2.2 On store init, load from localStorage as fallback only (for offline/anonymous mode); authenticated users get settings hydrated via `hydrateSettingsFromSupabase()` on sign-in
  - [ ] 2.3 Map store fields to JSONB keys: `theme→readingTheme`, `fontSize→readingFontSize`, `lineHeight→readingLineHeight`, `readingRulerEnabled→readingRuler`, `scrollMode→scrollMode`
  - [ ] 2.4 Do NOT remove localStorage reads entirely — keep as cold-start fallback for anonymous users and offline mode

- [ ] Task 3: Migrate `useAudiobookPrefsStore.ts` off localStorage (AC2, AC5)
  - [ ] 3.1 Replace `persistPrefs()` localStorage writes with `saveSettingsToSupabase({ defaultSpeed, skipSilence, defaultSleepTimer, autoBookmarkOnStop })`
  - [ ] 3.2 Keep `loadPersistedPrefs()` for anonymous/offline fallback only
  - [ ] 3.3 Hydration: `hydrateSettingsFromSupabase()` restores all four audiobook pref fields into the Zustand store

- [ ] Task 4: Migrate `useReadingGoalStore.ts` goal (not streak) data off localStorage (AC3, AC7)
  - [ ] 4.1 `saveGoal()` must call `saveSettingsToSupabase({ dailyType, dailyTarget, yearlyBookTarget })` — streak fields (`currentReadingStreak`, `longestReadingStreak`, `lastMetDate`) are NOT synced (they're local-only until E95-S04)
  - [ ] 4.2 Keep streak fields in localStorage (`knowlune:reading-goal-streak`) — do not migrate streak to Supabase in this story
  - [ ] 4.3 Hydration: restore `dailyType`, `dailyTarget`, `yearlyBookTarget` from Supabase; keep streak from localStorage

- [ ] Task 5: Add `colorScheme` and engagement prefs sync via `useEngagementPrefsStore.ts` (AC4)
  - [ ] 5.1 In `setPreference()`, after the existing `persistPrefs()` call, also call `saveSettingsToSupabase({ colorScheme })` (or other engagement pref key)
  - [ ] 5.2 Map engagement prefs to JSONB keys: `achievements→achievementsEnabled`, `streaks→streaksEnabled`, `colorScheme→colorScheme`
  - [ ] 5.3 Hydration: restore engagement prefs from `user_settings.settings` JSONB

- [ ] Task 6: Supabase `user_settings` table wiring (AC1–AC6)
  - [ ] 6.1 Verify `user_settings` table exists with `user_id` PK and `settings` JSONB column (from E19); no migration needed unless the column is missing
  - [ ] 6.2 Ensure RLS on `user_settings` allows SELECT/INSERT/UPDATE for `auth.uid() = user_id`
  - [ ] 6.3 Use jsonb merge upsert pattern — do NOT overwrite the entire JSONB blob; use `settings = COALESCE(settings, '{}') || $1::jsonb` to merge keys idempotently
  - [ ] 6.4 If `user_settings` table does NOT exist (no E19 migration): create migration `supabase/migrations/20260422000001_user_settings.sql` with `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `settings JSONB NOT NULL DEFAULT '{}'`, `updated_at TIMESTAMPTZ DEFAULT now()`

- [ ] Task 7: Unit tests (AC1–AC7)
  - [ ] 7.1 Test `saveSettingsToSupabase()` — mocks Supabase client, verifies upsert called with correct payload and never includes streak fields
  - [ ] 7.2 Test `hydrateSettingsFromSupabase()` — mocks `supabase.from('user_settings').select()`, verifies each store is hydrated from JSONB
  - [ ] 7.3 Test `useReaderStore` — calling `setTheme('sepia')` triggers `saveSettingsToSupabase` with `{ readingTheme: 'sepia' }`
  - [ ] 7.4 Test `useReadingGoalStore.saveGoal()` — verifies streak fields absent from Supabase payload

## Design Guidance

No UI changes in this story. This is a pure data layer migration. The Settings UI that already exists should continue to work — the only behavioral change is where data is persisted (Supabase instead of localStorage).

## Implementation Notes

### Architecture Pattern: Settings as JSONB Blob vs. Dexie syncableWrite

`user_settings` is NOT wired through `syncableWrite()` / the Dexie sync queue. Instead it uses a **direct Supabase upsert** pattern because:
- `user_settings` is a single row per user (singleton), not a collection
- There is no Dexie table for user settings (no `userId+updatedAt` indexing needed)
- Settings are already backed by Supabase from E19 (profile fields); this story extends the same JSONB `settings` column

The pattern is:
```ts
// In src/lib/settings.ts
export async function saveSettingsToSupabase(patch: Partial<AllUserPreferences>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return  // anonymous — skip
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, settings: patch },
      { onConflict: 'user_id', ignoreDuplicates: false }
    )
  // Note: Supabase upsert with JSONB does NOT auto-merge — need RPC or server-side merge
  // Use a Postgres function for safe JSONB merge: merge_user_settings(p_user_id, p_patch)
  if (error) console.warn('[settings] Supabase save failed:', error)
}
```

**JSONB merge approach:** A plain upsert will overwrite the entire `settings` blob. Use a Postgres function for safe key-level merge:
```sql
-- supabase/migrations/20260422000001_user_settings.sql (or add to existing migration)
CREATE OR REPLACE FUNCTION merge_user_settings(p_user_id UUID, p_patch JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES (p_user_id, p_patch, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    settings = COALESCE(user_settings.settings, '{}') || p_patch,
    updated_at = now();
END;
$$;
```
Call it via `supabase.rpc('merge_user_settings', { p_user_id: user.id, p_patch: patch })`.

### Field Mapping

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

### Fire-and-Forget Pattern

All `saveSettingsToSupabase()` calls are fire-and-forget (no `await` at call sites). The pattern mirrors the existing `saveSettings()` fire-and-forget. localStorage remains the primary persistence for offline/anonymous users; Supabase is the sync layer for authenticated users.

```ts
// In useReaderStore.ts setTheme:
setTheme: theme => {
  const s = get()
  saveSettings({ ...getSettingsFromState(s), theme })  // keep for offline/anonymous
  set({ theme })
  void saveSettingsToSupabase({ readingTheme: theme }) // fire-and-forget for sync
},
```

### Existing Sync (colorScheme → AppSettings)

`useEngagementPrefsStore.setPreference('colorScheme', value)` already calls `saveSettings({ colorScheme })` which updates `localStorage['app-settings']`. Keep that path. Add `void saveSettingsToSupabase({ colorScheme })` alongside it. Both localStorage (offline) and Supabase (sync) paths should coexist.

### `hydrateSettingsFromSupabase()` Expansion

Expand the existing function in `src/lib/settings.ts`:
```ts
export async function hydrateSettingsFromSupabase(userMetadata: Record<string, unknown> | undefined): Promise<void> {
  // ... existing profile field hydration (displayName, bio, profilePhotoUrl) ...

  // NEW: fetch user_settings row
  const { data } = await supabase.from('user_settings').select('settings').eq('user_id', userId).single()
  if (data?.settings) {
    const s = data.settings as Record<string, unknown>
    // Hydrate useReaderStore
    if (s.readingTheme) useReaderStore.getState().setTheme(s.readingTheme as ReaderTheme)
    // ... etc for each field
    // Hydrate useEngagementPrefsStore
    if (s.colorScheme) useEngagementPrefsStore.getState().setPreference('colorScheme', s.colorScheme as ColorScheme)
  }
}
```

**Note:** `hydrateSettingsFromSupabase()` currently returns `void` (sync). After expansion it becomes `async`. Update the call site in `src/app/hooks/useAuthLifecycle.ts` to `await hydrateSettingsFromSupabase(userMetadata)`.

### Previous Story Intelligence (E94-S07)

The last merged story added `storageSync.ts` binary upload/download. The pattern there:
- Fire-and-forget saves throughout store mutations
- Separate hydration step on auth sign-in (`useAuthLifecycle.ts`)
- localStorage remains for cold-start before auth resolves

No Dexie schema changes required for E95-S01. No `syncableWrite()` involvement. No `tableRegistry.ts` changes for this story (the E95-S01 epic entry says `user_settings` is accessed directly, not via the Dexie sync queue).

### ES2020 Constraints (from project memory)
- No `Promise.any` — use `Promise.allSettled` instead
- Nullish coalescing `??` and optional chaining `?.` are available
- `async/await` available

## Testing Notes

- Unit tests only (no E2E for this story — no UI changes)
- Mock Supabase client in all tests: `vi.mock('@/lib/auth/supabase', ...)`
- Test that `saveSettingsToSupabase` is called with correct patch object
- Test that streak fields (`currentReadingStreak`, `longestReadingStreak`, `lastMetDate`) are never in the Supabase payload
- Test `hydrateSettingsFromSupabase` fetches from `user_settings` table and applies to each store
- Test anonymous user case: `saveSettingsToSupabase` returns early when no authenticated user
- Test network failure: `saveSettingsToSupabase` logs warning but does NOT throw (non-blocking)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] CRUD completeness: For any entity this story touches, verify Create/Read/Update/Delete paths all exist and have tests
- [ ] AC → UI trace: For each acceptance criterion, verify the feature is visible in the rendered UI — not just implemented in a service or store
- [ ] For numeric computations: verify numerator and denominator reference the same scope (same book set, same session set, same time window) before coding the formula
- [ ] At every non-obvious code site (AbortController, timer cleanup, catch blocks), add `// Intentional: <reason>` comment
- [ ] For every `useEffect` or async callback that reads Zustand state: confirm it reads from `get()` inside the callback, not from outer render scope (stale closure risk)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)
- [ ] Dexie schema: if adding or modifying tables/indexes, update `src/db/__tests__/schema.test.ts`
- [ ] Touch targets: verify all interactive elements are ≥44×44px (check in DevTools device toolbar)
- [ ] Visual sanity: load feature with seed data and verify the primary UI renders correctly before submitting
- [ ] ARIA: run axe scan on any custom selection or interaction UI (keyboard-navigable lists, comboboxes, dialogs)
- [ ] Marker stripping: if implementing an LLM marker-token pattern (e.g., `<ANSWER>`), confirm strip logic in the render path before displaying to user
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] E2E: run current story's spec locally (`npx playwright test tests/e2e/story-95-1.spec.ts --project=chromium`) and verify all tests pass
- [ ] `hydrateSettingsFromSupabase` call site updated to `await` the now-async function
- [ ] Streak fields verified absent from all Supabase payloads (AC7)
- [ ] Anonymous/offline path tested: preferences still persist to localStorage when user not signed in

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
