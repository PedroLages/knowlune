---
title: Hydration allow-list gate + exported VALID_* constants for Zustand prefs
date: 2026-04-25
module: audiobook-player
component: useAudiobookPrefsStore / settings.ts
problem_type: best_practice
tags:
  - zustand
  - hydration
  - supabase-sync
  - allow-list
  - validation
  - audiobook
  - prefs
  - settings
related_pr: https://github.com/PedroLages/knowlune/pull/453
related_plan: docs/plans/2026-04-25-010-feat-audiobook-player-mobile-micro-polish-plan.md
---

# Hydration allow-list gate + exported VALID_* constants for Zustand prefs

Three reinforcing patterns extracted from PR #453 (audiobook player mobile micro-polish). They solve a recurring class of bug: cross-device sync hydrates a user-pref store with a value the store can't represent, silently poisoning state until the next write.

## Context

Knowlune persists audiobook prefs in two places:

1. `useAudiobookPrefsStore` (Zustand + localStorage) — the runtime source of truth.
2. Supabase `user_settings` row — dual-write target so prefs follow the user across devices.

`hydrateSettingsFromSupabase` in `src/lib/settings.ts` reads the Supabase row on app boot and pushes each field into the store via setters. Two failure modes were lurking:

- **Stale enum values**: a value persisted on device A under an older app version (e.g. `defaultSleepTimer: 90`) hydrates onto device B which only allows `5/10/15/30/45/60/end-of-chapter/off`. Without a guard, the store accepts it.
- **Drift between hydration and store**: the hydration block copy-pasted its own `validTimers` set inline. Adding `5` and `10` minute presets meant updating two places. R2 review (F3) caught this duplication; F4 caught the missing guard for `skipBackSeconds` / `skipForwardSeconds` entirely.

## Guidance

### 1. Allow-list gate at the hydration boundary

Hydration is an **untrusted input boundary** — same threat model as a network response. Gate every enum-ish field with a membership check before calling its setter:

```ts
// settings.ts — hydrateSettingsFromSupabase
if (typeof s.skipBackSeconds === 'number' && (VALID_SKIP_BACK as readonly number[]).includes(s.skipBackSeconds)) {
  useAudiobookPrefsStore.getState().setSkipBackSeconds(s.skipBackSeconds)
}
if (typeof s.skipForwardSeconds === 'number' && (VALID_SKIP_FORWARD as readonly number[]).includes(s.skipForwardSeconds)) {
  useAudiobookPrefsStore.getState().setSkipForwardSeconds(s.skipForwardSeconds)
}
if (s.defaultSleepTimer !== undefined) {
  if (VALID_TIMERS.has(s.defaultSleepTimer as SleepTimerDefault)) {
    useAudiobookPrefsStore.getState().setDefaultSleepTimer(s.defaultSleepTimer as SleepTimerDefault)
  }
}
```

The setter itself can also fall back to the default on bad input — and it does, in this codebase — but the hydration-side gate prevents a no-op setter call from racing with other hydration logic and catches drift earlier (closer to the actual data source).

### 2. Export `VALID_*` constants from the store

The store owns the canonical set of valid values. Export it. Importers (hydration, settings UI, tests) consume the same constant — drift becomes impossible:

```ts
// src/stores/useAudiobookPrefsStore.ts
export const VALID_TIMERS = new Set<SleepTimerDefault>(['off', 5, 10, 15, 30, 45, 60, 'end-of-chapter'])
export const VALID_SKIP_BACK = [5, 10, 15, 30, 45, 60] as const
export const VALID_SKIP_FORWARD = [10, 15, 30, 45, 60, 90] as const
```

```ts
// src/lib/settings.ts
const [, { useAudiobookPrefsStore, VALID_TIMERS, VALID_SKIP_BACK, VALID_SKIP_FORWARD }] = await Promise.all([...])
```

Use `Set` when you need O(1) `has()` and a heterogenous union (`'off' | number | 'end-of-chapter'`). Use `as const` tuple when you also want the values for UI rendering (rendering a `Select` requires iteration order, not just membership).

### 3. Value-setters, not toggles, for new boolean prefs

When adding a new boolean pref like `showRemainingTime`, the temptation is `toggleShowRemainingTime()` because it's one fewer prop to pass at the call site. Don't:

```ts
// Bad — read-then-toggle pattern
toggleShowRemainingTime: () => set((s) => ({ showRemainingTime: !s.showRemainingTime }))

// Good — value-setter pattern (matches setDefaultSpeed, setDefaultSleepTimer)
setShowRemainingTime: (value: boolean) => {
  set({ showRemainingTime: value })
  persist({ showRemainingTime: value })
}
```

Why:

- **Hydration symmetry.** Hydration knows the value, not the delta. A toggle setter forces hydration to read current state first, which races with other hydration writes.
- **Idempotency.** Calling `setX(true)` twice is a no-op; `toggle()` twice flips back. Hydration after a transient Supabase error must be safe to retry.
- **Intent at call sites.** UI handlers know whether they're enabling or disabling. Encoding intent in the setter call (`setShowRemainingTime(!current)` at the call site) keeps the store API minimal and consistent.

This is why R1 of PR #453 had no toggle setters even for booleans — every new pref shipped with a `setX(value)` and the call site supplies the new value.

## Why This Matters

Without the discovery spike from the plan (which inventoried existing prefs patterns before adding 3 new fields), this PR would likely have:

1. Copied the inline `validTimers` set a third time.
2. Skipped the allow-list guard on the new `skipBackSeconds` / `skipForwardSeconds` fields entirely (R1 shipped this way; R2's F4 fixed it).
3. Added a `toggleShowRemainingTime()` because "it's just a boolean."

Each of those is a small bug. Combined, they create a class of intermittent cross-device sync issues that are extremely hard to diagnose because they only manifest after a specific upgrade-then-sync sequence.

The exported-constant pattern also pays off in tests: 12 new test cases in `useAudiobookPrefsStore.test.ts` import the same `VALID_SKIP_BACK` / `VALID_SKIP_FORWARD` they're validating against, so test data and runtime guard can never drift.

## When to Apply

Apply this triad whenever you add a new pref to `useAudiobookPrefsStore`, `useReaderStore`, `useReadingGoalStore`, or `useEngagementPrefsStore` (any Zustand store wired through `hydrateSettingsFromSupabase`):

1. Define the field's domain as an exported `VALID_*` `Set` or `as const` tuple in the store module.
2. Write a `setX(value)` setter that validates against `VALID_*` and falls back to the default on miss.
3. In `hydrateSettingsFromSupabase`, type-check the incoming field, gate it through the same `VALID_*`, then call the setter. Never trust the Supabase row.
4. If the new field is a boolean, expose `setX(value: boolean)`. Do not expose `toggleX()` from the store — let the call site negate.

For non-pref hydration boundaries (e.g. `localStorage` JSON, URL query params, `BroadcastChannel` messages) the same pattern applies: treat the boundary as untrusted, validate against an exported allow-list, prefer value-setters.

## Examples

### Before (R1, F4 latent)

```ts
// settings.ts
if (typeof s.skipBackSeconds === 'number') {
  useAudiobookPrefsStore.getState().setSkipBackSeconds(s.skipBackSeconds)
}

// useAudiobookPrefsStore.ts — VALID_TIMERS not exported
const VALID_TIMERS = new Set<SleepTimerDefault>(['off', 5, 10, 15, 30, 45, 60, 'end-of-chapter'])

// settings.ts — duplicated inline
const validTimers = new Set(['off', 5, 10, 15, 30, 45, 60, 'end-of-chapter'])
```

### After (R2, bfe5c798)

```ts
// useAudiobookPrefsStore.ts
export const VALID_TIMERS = new Set<SleepTimerDefault>(['off', 5, 10, 15, 30, 45, 60, 'end-of-chapter'])
export const VALID_SKIP_BACK = [5, 10, 15, 30, 45, 60] as const
export const VALID_SKIP_FORWARD = [10, 15, 30, 45, 60, 90] as const

// settings.ts
const [, { useAudiobookPrefsStore, VALID_TIMERS, VALID_SKIP_BACK, VALID_SKIP_FORWARD }] = await Promise.all([...])

if (s.defaultSleepTimer !== undefined && VALID_TIMERS.has(s.defaultSleepTimer as SleepTimerDefault)) {
  useAudiobookPrefsStore.getState().setDefaultSleepTimer(s.defaultSleepTimer as SleepTimerDefault)
}
if (typeof s.skipBackSeconds === 'number' && (VALID_SKIP_BACK as readonly number[]).includes(s.skipBackSeconds)) {
  useAudiobookPrefsStore.getState().setSkipBackSeconds(s.skipBackSeconds)
}
if (typeof s.skipForwardSeconds === 'number' && (VALID_SKIP_FORWARD as readonly number[]).includes(s.skipForwardSeconds)) {
  useAudiobookPrefsStore.getState().setSkipForwardSeconds(s.skipForwardSeconds)
}
```

### Bonus: useCallback dependency wins for free

A non-obvious bonus from value-setters: when skip intervals became configurable, `useMediaSession`'s `setActionHandler` effect already depended on `handleSkipBack`/`handleSkipForward` callback identities. Wrapping those in `useCallback` with `[skipBackSeconds]` deps meant OS-level MediaSession controls picked up new pref values automatically — no refactor of `useMediaSession` needed. Same effect for keyboard shortcut handlers and the `AudioMiniPlayer`.

This worked because the existing prefs were already plumbed via `useCallback` closures rather than `useRef`. If a future store wires up via mutable refs to "avoid re-renders", expect to manually re-bind handlers when prefs change.

## References

- PR: https://github.com/PedroLages/knowlune/pull/453
- Plan: [docs/plans/2026-04-25-010-feat-audiobook-player-mobile-micro-polish-plan.md](../../plans/2026-04-25-010-feat-audiobook-player-mobile-micro-polish-plan.md)
- F4 fix commit: `bfe5c798` — gate skip-interval hydration with allow-list
- Store: [src/stores/useAudiobookPrefsStore.ts](../../../src/stores/useAudiobookPrefsStore.ts)
- Hydration: [src/lib/settings.ts](../../../src/lib/settings.ts) (`hydrateSettingsFromSupabase`)
- Tests: [src/stores/__tests__/useAudiobookPrefsStore.test.ts](../../../src/stores/__tests__/useAudiobookPrefsStore.test.ts)
