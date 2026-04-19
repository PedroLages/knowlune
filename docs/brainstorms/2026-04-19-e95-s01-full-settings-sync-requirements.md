# Requirements: Full Settings Sync Expansion (E95-S01)

**Date:** 2026-04-19
**Status:** ready-for-planning
**Story:** E95-S01

---

## Problem

Four Zustand stores persist user preferences exclusively to localStorage today:

| Store | localStorage key | Preferences covered |
|-------|-----------------|---------------------|
| `src/stores/useReaderStore.ts` | `knowlune-reader-settings-v1` | theme, fontSize, lineHeight, ruler, scrollMode, dualPage, showPageNumbers, showProgressBar |
| `src/stores/useAudiobookPrefsStore.ts` | `knowlune:audiobook-prefs-v1` | defaultSpeed, skipSilence, defaultSleepTimer, autoBookmarkOnStop |
| `src/stores/useReadingGoalStore.ts` | `knowlune:reading-goals` | dailyType, dailyTarget, yearlyBookTarget |
| `src/stores/useEngagementPrefsStore.ts` | `levelup-engagement-prefs-v1` | achievements, streaks, badges, animations, colorScheme |

When a user signs in on a new device or browser, all preferences are lost. The Supabase `user_settings` table does not yet exist (confirmed: no migration contains it).

---

## Goal

Sync all four preference groups to a new `user_settings` Supabase table so preferences follow the user across devices. localStorage remains as a cold-start fallback for offline and anonymous sessions.

---

## Out of Scope

- Streak calculation (E95-S04 handles `currentReadingStreak`, `longestReadingStreak`)
- Vault credentials for API keys (E95-S02)
- Any Dexie schema changes (no Dexie table needed — this is a singleton row sync)
- `syncableWrite()` / tableRegistry involvement (settings use direct Supabase RPC)
- E2E tests (no UI changes; unit tests only)

---

## Success Criteria

1. **AC1** — Setting reader theme "sepia" on Device A: Device B shows "sepia" after sign-in sync.
2. **AC2** — Setting audiobook speed 1.5× on Device A: Device B shows 1.5× as default.
3. **AC3** — Setting daily reading goal 20 pages on Device A: Device B restores 20 pages.
4. **AC4** — Setting colorScheme "vibrant" on Device A: Device B applies "vibrant" on next app load.
5. **AC5** — After migration, keys `knowlune-reader-settings-v1`, `knowlune:audiobook-prefs-v1`, `knowlune:reading-goals` are no longer written by those stores (localStorage write paths removed for authenticated users).
6. **AC6** — Fresh device: all four preference groups restored on `hydrateSettingsFromSupabase()` completing.
7. **AC7** — Streak fields (`currentReadingStreak`, `longestReadingStreak`, `lastMetDate`) are NEVER included in Supabase payloads from this story.

---

## Architecture Decision

**Direct Supabase RPC** (not Dexie `syncableWrite`):

`user_settings` is a per-user singleton row (one row per `user_id`), not a collection. The Dexie sync queue is designed for collections (many rows per user, indexed by `[userId+updatedAt]`). Using `syncableWrite` here would require adding a Dexie table and schema migration for no gain — the LWW sync queue adds no value for a singleton.

Instead: new `merge_user_settings(p_user_id, p_patch JSONB)` Postgres function performs a key-level JSONB merge (`settings = COALESCE(settings, '{}') || p_patch`) via `supabase.rpc(...)`. This prevents one preference write from clobbering unrelated preferences.

---

## Behavior Specification

### New Supabase migration: `user_settings` table

```sql
-- supabase/migrations/20260422000001_user_settings.sql
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users write own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.merge_user_settings(p_user_id UUID, p_patch JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, settings, updated_at)
    VALUES (p_user_id, p_patch, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    settings = COALESCE(public.user_settings.settings, '{}') || p_patch,
    updated_at = now();
END;
$$;
```

### New `saveSettingsToSupabase()` in `src/lib/settings.ts`

```ts
// Fire-and-forget. Returns void. Swallows errors with console.warn.
// Anonymous/offline: returns early if no authenticated user.
export async function saveSettingsToSupabase(patch: Partial<AllUserPreferences>): Promise<void>
```

- `AllUserPreferences` = union type of all 15 JSONB keys (see field map below)
- Gets current user via `supabase.auth.getUser()`; returns early if `!user`
- Calls `supabase.rpc('merge_user_settings', { p_user_id: user.id, p_patch: patch })`
- On error: `console.warn('[settings] Supabase save failed:', error)` — never throws

### Field mapping (store field → JSONB key)

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

### Store mutations: dual-write pattern

Each store setter continues writing to localStorage (offline fallback) AND adds a fire-and-forget Supabase call:

```ts
// Example: useReaderStore.setTheme
setTheme: theme => {
  const s = get()
  saveSettings({ ...getSettingsFromState(s), theme })  // existing localStorage path — KEEP
  set({ theme })
  void saveSettingsToSupabase({ readingTheme: theme })  // new Supabase sync path
},
```

**Streak fields are NOT synced** — `useReadingGoalStore.saveGoal()` calls `saveSettingsToSupabase({ dailyType, dailyTarget, yearlyBookTarget })` only. Streak localStorage key (`knowlune:reading-goal-streak`) and streak state remain localStorage-only until E95-S04.

### Hydration on sign-in: `hydrateSettingsFromSupabase()` expansion

`src/lib/settings.ts`: current signature is `(userMetadata) => void` (sync). Expanded to `async (userMetadata) => Promise<void>`.

Call site in `src/app/hooks/useAuthLifecycle.ts` line 57 must become `await hydrateSettingsFromSupabase(userMetadata)` (already inside an async block).

Hydration fetches `user_settings` row and applies each field to the corresponding store via `getState().setTheme(...)` etc. Uses `?? default` guards — never overwrites a fresh preference with `undefined`.

---

## Constraints

- ES2020: no `Promise.any`; use `Promise.allSettled` if parallel fetching needed
- `?.` and `??` available
- No React imports in `src/lib/settings.ts` (pure module constraint)
- Zustand stores can be accessed outside React via `.getState()` — safe in `settings.ts`

---

## Test Coverage Required

- Unit: `saveSettingsToSupabase()` — correct RPC call; streak fields absent
- Unit: `hydrateSettingsFromSupabase()` — mocked Supabase fetch → each store hydrated
- Unit: `useReaderStore.setTheme()` → triggers `saveSettingsToSupabase({ readingTheme })`
- Unit: `useReadingGoalStore.saveGoal()` → streak fields absent from Supabase payload
- Unit: anonymous user case → `saveSettingsToSupabase` returns early (no RPC call)
- Unit: network failure → logs warning, does not throw
