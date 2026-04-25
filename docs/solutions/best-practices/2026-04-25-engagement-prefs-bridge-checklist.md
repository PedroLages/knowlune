---
title: "Eight-step checklist for adding a synced preference to useEngagementPrefsStore"
date: 2026-04-25
problem_type: best_practice
category: best-practices
module: stores/useEngagementPrefsStore
component: settings-bridge
tags: [zustand, supabase, settings, sync, engagement-prefs, e99-s01]
applies_when: "Adding a new user preference that must persist locally AND sync across devices via the AppSettings + user_settings bridge."
---

# Adding a Synced Preference to useEngagementPrefsStore — 8-Step Checklist

## Context

`useEngagementPrefsStore` is the home for user-level display preferences that need cross-device sync (color scheme, course view mode, engagement toggles). The store sits on top of two persistence layers:

1. **Local** — the store's own `levelup-engagement-prefs-v1` localStorage blob, plus a one-way bridge to `app-settings` (`AppSettings`) for non-React consumers.
2. **Remote** — Supabase `user_settings` JSONB column, written via `saveSettingsToSupabase` and rehydrated on login by `hydrateSettingsFromSupabase`.

Because the bridge is split across two files (`src/stores/useEngagementPrefsStore.ts` and `src/lib/settings.ts`), it's easy to add a preference that *looks* like it works locally but never reaches another device. Eight things must be wired up. Missing any one of them silently breaks cross-device sync.

## Guidance

When adding a new preference (call it `myPref`):

1. **Sanitiser in `loadPersistedPrefs`** (`useEngagementPrefsStore.ts`)
   Reject corrupted localStorage values; fall back to a known default. Mirror the `colorScheme` `.includes(...)` check.

2. **State persistence in `setPreference`'s `prefs` object** (`useEngagementPrefsStore.ts`)
   The `prefs` object built from `get()` is what gets serialised to localStorage. Forgetting to add `myPref: state.myPref` here means the new value never persists locally.

3. **`saveSettings` bridge branch** (`useEngagementPrefsStore.ts`)
   Add `if (key === 'myPref') saveSettings({ myPref: value as MyPrefType })` plus a `settingsUpdated` event dispatch. This is what lets non-React code (e.g., a `useMyPref` hook listening on the AppSettings event) pick up the change.

4. **`saveSettingsToSupabase` bridge branch** (`useEngagementPrefsStore.ts`)
   `else if (key === 'myPref') void saveSettingsToSupabase({ myPref: value })`. Without this the change never reaches the server.

5. **Reset-defaults bridge entry** (`useEngagementPrefsStore.ts`)
   `resetToDefaults` calls `saveSettings({...})` directly. Add `myPref: defaults.myPref` to that call so reset propagates to AppSettings.

6. **Sanitiser in `getSettings`** (`src/lib/settings.ts`)
   Add a `VALID_MY_PREF` const and an `if (!VALID_MY_PREF.includes(parsed.myPref)) parsed.myPref = defaults.myPref` branch. AppSettings is read by many consumers; corrupted values must be rejected here too.

7. **`UserSettingsPatch` type extension** (`src/lib/settings.ts`)
   Add `myPref?: string` (or appropriate type) to the `UserSettingsPatch` type. Without this, TypeScript blocks the call in step 4.

8. **Hydration block in `hydrateSettingsFromSupabase`** (`src/lib/settings.ts`)
   Add a `if (typeof s.myPref === 'string') { ... useEngagementPrefsStore.getState().setPreference('myPref', s.myPref) }` block, with validation against the same allowed set. **This is the step that's easiest to forget** — local writes work fine without it, so the bug only shows up when a second device tries to receive the value.

## Why This Matters

Each step lives in a different function. A reviewer scanning the diff for "is the new pref synced?" can easily see steps 1–5 (the store changes) and miss steps 6–8 (the settings.ts changes), or vice versa. The result is a partial bridge that passes tests on the local device but never round-trips through Supabase.

The `colorScheme` field has all eight wired correctly — it's the canonical reference. When adding a new pref, `git grep colorScheme src/stores/useEngagementPrefsStore.ts src/lib/settings.ts` and add a parallel line everywhere it appears.

## When to Apply

- Any new field added to `EngagementPrefs` that should sync across devices.
- Adapt step 4 if the field is intentionally local-only (badges, animations) — skip steps 4, 7, 8 in that case and document the choice with a comment near the setter.

## Examples

### Reference diff — `courseViewMode` (E99-S01)

```ts
// 1. Sanitiser in loadPersistedPrefs
courseViewMode: VALID_COURSE_VIEW_MODES.includes(parsed.courseViewMode)
  ? parsed.courseViewMode
  : 'grid',

// 2. State persistence in setPreference
const prefs: EngagementPrefs = { ..., courseViewMode: state.courseViewMode }

// 3. saveSettings bridge branch
if (key === 'courseViewMode') {
  saveSettings({ courseViewMode: value as CourseViewMode })
  window.dispatchEvent(new Event('settingsUpdated'))
}

// 4. saveSettingsToSupabase bridge branch
} else if (key === 'courseViewMode') {
  void saveSettingsToSupabase({ courseViewMode: value as CourseViewMode })
}

// 5. resetToDefaults bridge
saveSettings({ colorScheme: defaults.colorScheme, courseViewMode: defaults.courseViewMode })

// 6. getSettings sanitiser (settings.ts)
if (!VALID_COURSE_VIEW_MODE.includes(parsed.courseViewMode)) {
  parsed.courseViewMode = defaults.courseViewMode
}

// 7. UserSettingsPatch type
courseViewMode?: string

// 8. hydrateSettingsFromSupabase block
if (typeof s.courseViewMode === 'string') {
  const validViewModes = ['grid', 'list', 'compact']
  if (validViewModes.includes(s.courseViewMode)) {
    useEngagementPrefsStore.getState().setPreference('courseViewMode', s.courseViewMode as CourseViewMode)
  }
}
```

### Related: shadcn ToggleGroup `''` deselect

When using shadcn `ToggleGroup type="single"` for a radio-style toggle (one option always selected), Radix emits `onValueChange('')` when the user clicks the currently active item. Filter empty strings in the handler so `onChange` only fires for valid values:

```tsx
onValueChange={next => {
  if (next === 'grid' || next === 'list' || next === 'compact') {
    onChange(next)
  }
}}
```

### Related: brand-soft contrast pairing

For `data-state=on` styling on toggle items in a soft surface, pair `bg-brand-soft` with `text-brand-soft-foreground` (not `text-brand`). The `--brand` token is calibrated for white text on solid brand backgrounds and is too dark for text on `--brand-soft` in dark mode. `--brand-soft-foreground` is the lighter sibling that meets WCAG AA contrast against soft backgrounds in both light and dark themes.
