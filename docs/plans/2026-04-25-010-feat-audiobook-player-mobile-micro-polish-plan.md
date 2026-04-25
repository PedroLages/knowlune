---
title: Audiobook Player Mobile Micro-Polish
type: feat
status: active
date: 2026-04-25
deepened: 2026-04-25
---

# Audiobook Player Mobile Micro-Polish

## Overview

Bundle of UI/UX improvements to the mobile audiobook player surfaced by a comparative review against Apple Books. Knowlune is functionally **ahead** of Apple Books (clips, skip silence, end-of-chapter sleep timer with live progress bar, Audiobookshelf sync) but loses on micro-interactions: ambiguous icons, missing time-display affordance, hardcoded skip intervals, and small sleep-timer / speed-control polish gaps.

This plan ships those gaps as a single coherent polish story, with the larger fine-tune-slider scope deferred to a follow-up.

## Problem Frame

A user listening to an audiobook on mobile encounters several friction points that Apple Books does not have:

1. **Two adjacent buttons in the bottom toolbar use the same `Scissors` icon.** One records a clip (two-phase create), the other opens the saved-clips list. Even power users cannot tell them apart at a glance.
2. **The right-hand timestamp on the scrubber always shows total duration.** Audiobook listeners think in *time remaining* ("how much is left before bed?"), not total runtime.
3. **Skip intervals (15s back, 30s forward) are hardcoded.** Some users want symmetric 30/30; others want a longer back-skip after losing the thread of a passage.
4. **The Speed popover has no anchor for "normal speed".** Users wandering at 2.25× have no visual landmark for "where do I tap to get back to baseline?"
5. **The Sleep Timer buries "End of chapter" and lacks short presets** (5, 10 min) for the "I'm falling asleep right now" use case.

None of these block the player from working. They're the difference between a player that feels rough and one that feels considered.

**Already shipped earlier in this session (do not re-plan):**
- Cover art letterboxing fix: `object-contain` → `object-cover` on the cover frame
- Viewport ambient blur tone-down: `opacity 0.4` → `0.15`, removed `saturate(1.5)`

## Requirements Trace

- **R1.** Each control in the bottom toolbar communicates its purpose unambiguously via icon and aria-label
- **R2.** Users can toggle the right-side scrubber timestamp between total duration and time remaining; preference persists across sessions
- **R3.** Users can configure skip-back and skip-forward intervals from `AudiobookSettingsPanel`; defaults remain 15s / 30s; preference persists across sessions
- **R4.** The 1.0× option in `SpeedControl` is visually marked as DEFAULT regardless of the currently selected speed
- **R5.** `SleepTimer` presents "End of chapter" near the top of the list and includes 5 min and 10 min presets
- **R6.** All changes pass design-token enforcement (no hardcoded colors), maintain 44×44px touch targets, and meet WCAG AA contrast (4.5:1 text)

## Scope Boundaries

- **Not changing:** speed popover layout, sleep timer popover layout, chapter list, scrubber slider, play/skip button visual treatment, blurred-background ambient effect (already tuned)
- **Not changing:** the chapter progress bar in `SleepTimer` (this is a feature Apple lacks — keep it)
- **Not changing:** keyboard shortcuts behavior — the configurable skip intervals must flow through to keyboard handlers without breaking existing shortcuts

### Deferred to Separate Tasks

- **Fine-tune speed slider (item 4b from the conversation):** allowing arbitrary speed values like 1.30× requires relaxing `VALID_SPEEDS_SET` validation in [src/stores/useAudiobookPrefsStore.ts](src/stores/useAudiobookPrefsStore.ts), updating Supabase sync schema (`saveSettingsToSupabase`), and migrating already-persisted preset values. Worth its own story — defer until we have signal that users want sub-0.25 granularity.
- **Speed popover large-numeric-readout redesign:** Apple's "1.30×" giant display is appealing but requires restructuring the popover layout. Defer; the DEFAULT label captures most of the value.
- **Swipe-down-to-dismiss + grabber handle (post-implementation reminder):** Apple Books shows a small horizontal pill (grabber) at the top-center of the player and supports pull-down-to-dismiss. Knowlune currently dismisses via a chevron-down at the top-left. Adding a true swipe-dismiss is a real story (motion/react drag handling, scrubber-conflict resolution, route-lifecycle, keyboard equivalent, reduced-motion fallback) — **not** a polish item. The grabber alone (decorative, no gesture) would mislead users. **After this micro-polish story ships, decide whether to invest in a dedicated swipe-dismiss story.** Likely 3–5 hours of focused work.

## Context & Research

### Relevant Code and Patterns

**Player surface:**
- [src/app/components/audiobook/AudiobookRenderer.tsx](src/app/components/audiobook/AudiobookRenderer.tsx) — main player, holds the bottom toolbar (lines ~520–600), scrubber (~457–473), skip-button click handlers (~479, 507), keyboard wiring (~240–262)
- [src/app/components/audiobook/SpeedControl.tsx](src/app/components/audiobook/SpeedControl.tsx) — Popover with 11 presets, uses `VALID_SPEEDS` from the prefs store
- [src/app/components/audiobook/SleepTimer.tsx](src/app/components/audiobook/SleepTimer.tsx) — Popover with `PRESET_OPTIONS` and `SUFFIX_OPTIONS` constants driving the menu
- [src/app/components/audiobook/ClipButton.tsx](src/app/components/audiobook/ClipButton.tsx) — two-phase clip recorder, uses `Scissors` (keep this one)
- [src/app/components/audiobook/AudiobookSettingsPanel.tsx](src/app/components/audiobook/AudiobookSettingsPanel.tsx) — settings sheet; pattern for adding new preference controls

**State / persistence (read carefully — sync is two-sided):**
- [src/stores/useAudiobookPrefsStore.ts](src/stores/useAudiobookPrefsStore.ts) — Zustand store, localStorage + Supabase sync via `saveSettingsToSupabase`. Pattern for new preference fields: extend `AudiobookPrefs` interface, add a setter, validate in `loadPersistedPrefs`, persist in setter.
- [src/lib/settings.ts](src/lib/settings.ts) — settings sync layer with **two halves**:
  - **Writer:** `UserSettingsPatch` type (lines ~190–212) defines the JSONB key allow-list; `saveSettingsToSupabase()` (line ~221) RPCs to `merge_user_settings`. Any new field must appear in `UserSettingsPatch`.
  - **Reader:** `hydrateSettingsFromSupabase()` (line ~242) runs on login and applies remote values to local stores. The `useAudiobookPrefsStore` hydration block lives at lines ~379–404. Any new field must also be read here, otherwise the value syncs *up* but never comes *down* to other devices.
  - **Hydration calls value-setters, not toggles.** `setDefaultSpeed(s.defaultSpeed)` is direct; `skipSilence`/`autoBookmarkOnStop` use a fragile read-then-toggle dance (lines 384–388). Prefer value setters for new fields.

**Hook layer:**
- [src/app/hooks/useAudioPlayer.ts](src/app/hooks/useAudioPlayer.ts) — `skipForward(seconds?)` and `skipBack(seconds?)` accept an override parameter (lines ~622, 653). Default value when no argument is passed must be confirmed during Unit 0 discovery.
- [src/app/hooks/useKeyboardShortcuts.ts](src/app/hooks/useKeyboardShortcuts.ts) — wired from `AudiobookRenderer.tsx:240-241, 257, 262`. Wiring passes `() => skipBack(15)` and `() => skipForward(30)` as closures from the renderer; the hook itself does not hardcode values. Updating the closures in `AudiobookRenderer` is sufficient — but verify in Unit 0.
- [src/app/hooks/useMediaSession.ts](src/app/hooks/useMediaSession.ts) — `seekbackward` / `seekforward` action handlers (lines 60–61) call `onSkipBack()` / `onSkipForward()` *with no arguments*. This means OS-level skip controls (lock screen, Bluetooth headphones) fall back to whatever default `useAudioPlayer.skipBack/skipForward` use. **This is the cross-surface gotcha for Unit 3** — confirm in Unit 0.

**Renderer parity:**
- [src/app/components/audiobook/AudioMiniPlayer.tsx](src/app/components/audiobook/AudioMiniPlayer.tsx) — desktop mini-player with its own skip 15s/30s controls (per docstring line 7) and reuses `<SpeedControl>`. Speed changes (Unit 4) propagate automatically; skip changes (Unit 3) require updating the mini-player too.

**Conventions:**
- [.claude/rules/styling.md](.claude/rules/styling.md) — design token discipline (no `bg-blue-600`; use `bg-brand`)
- [.claude/rules/workflows/design-review.md](.claude/rules/workflows/design-review.md) — WCAG AA, 44×44px targets, tested at 375/768/1440px
- ESLint `design-tokens/no-hardcoded-colors` enforces the token rule at save-time

### Institutional Learnings

- `useAudiobookPrefsStore` already validates persisted values against allow-lists in `loadPersistedPrefs` to avoid corrupted localStorage breaking the app — follow this pattern for new fields (numeric range checks for skip intervals; boolean check for `showRemainingTime`)
- The `Popover` component from shadcn/ui already handles tap-outside dismiss and focus management — reuse, don't re-invent
- `motion/react` (Framer Motion successor) is the project's animation library — already used in `ClipButton` for the recording pulse

### External References

- Apple Books mobile player (compared during conversation): popover speed picker with DEFAULT chip; sleep timer action sheet ordered Custom → End of chapter → 1hr → 45 → 30 → 15 → 10 → 5 → Off; tap-to-toggle remaining time displayed as `−1:20:07`

## Key Technical Decisions

- **Bundle as one story, defer the fine-tune slider.** All 6 items touch the same 4 files and ship as a coherent "audiobook polish" PR. The slider is a separate scope (validation relaxation + sync schema change + migration) and earns its own story when prioritized.
- **Replacement icon for the clips-list panel: `ListVideo` from lucide-react.** Closest semantic match for "browse a list of saved audio segments". Alternatives considered: `Library` (too generic), `FileAudio` (suggests file management, not playback), `BookmarkCheck` (collides with the bookmark button next to it).
- **DEFAULT label is always visible on the 1.0× option, not just when inactive.** Apple's pattern: the DEFAULT label is a navigational landmark, not a state indicator. Showing it always means users learn "1.0× is home" once and never have to re-derive it.
- **Sleep timer order: Custom → End of chapter → 60 → 45 → 30 → 15 → 10 → 5 → Off.** Mirrors Apple's intent ordering (high-intent options first, descending durations, terminal "Off" at the bottom). Keep our chapter progress bar — it's a feature Apple lacks.
- **Skip intervals stored as numbers (seconds), not enum.** Defaults 15/30. Validated to a specific allow-list (`[5, 10, 15, 30, 45, 60]` back; `[10, 15, 30, 45, 60, 90]` forward) to keep UI controls finite while allowing flexibility. Asymmetric defaults preserved for backward compatibility.
- **`showRemainingTime` defaults to `false`** (current behavior — show total). Discoverable via a tap on the right-hand label. No tutorial or hint added; the pattern is conventional enough that users find it.
- **Toggle target is the entire right-side timestamp span.** Not just the digits — the whole tap target reaches 44×44px when wrapped in a `button` with adequate padding.
- **All new prefs use value-setters (`setX(value)`), not toggles.** Toggle-style setters (like the existing `toggleSkipSilence`) force hydration to read current state, compare, and toggle conditionally — fragile and harder to test. Value setters compose naturally with hydration: `setShowRemainingTime(s.showRemainingTime)` is a one-liner. The renderer can still produce toggle behavior at the call site: `onClick={() => setShowRemainingTime(!showRemainingTime)}`.
- **DEFAULT label is part of the option's accessible name.** Not `aria-hidden`. Screen reader announces "1.0 times, default" — that's the entire point of having the label as a navigational landmark.
- **Ship as a single PR, not split per unit.** All 5 units share the same prefs store, settings panel, and renderer; splitting would require 5 round-trips through `/review-story` for ~150 lines of cohesive change. If Unit 3 grows unexpectedly (e.g., MediaSession refactor turns out larger than expected), revisit.
- **No telemetry added in this story.** Knowlune does not currently track audiobook UI interaction metrics. Adding telemetry for the new prefs is deferred — revisit if user research signals a need to know toggle/configuration rates.

## Open Questions

### Resolved During Planning

- **Should the `ClipButton` icon also change?** No — it stays as `Scissors`, and its existing pulsing red recording-state indicator (via `motion/react` AnimatePresence) already disambiguates the *active* state. The ambiguity is only when both buttons sit idle in the toolbar; changing the *opener* solves it.
- **Should DEFAULT show as a chip or muted text?** Muted text. A chip would compete visually with the active-state `Check` icon and the row's hover/focus state.
- **Should Custom be at the very top of `SleepTimer`?** No, second after End of chapter. End-of-chapter is the *single most distinctive feature* of our timer (Apple has it but doesn't lead with the progress bar). Putting it first signals "this is the one to use." Custom is power-user territory.
- **Should "End of chapter" be hidden for single-chapter audiobooks?** No, leave visible. Apple Books shows it always; the existing code handles single-chapter cases without crashing (the timer effectively waits for file end). Hiding it conditionally would add branching complexity for a low-value polish.
- **Test files: extend or scaffold?** Mixed: `useAudiobookPrefsStore.test.ts` (extend) and `useSleepTimer.test.ts` (extend) exist. `AudiobookRenderer.test.tsx`, `SpeedControl.test.tsx`, `SleepTimer.test.tsx`, `AudiobookSettingsPanel.test.tsx` **do not exist** and must be scaffolded. Each unit's Files list calls this out.

### Deferred to Implementation

- **Exact spacing for the DEFAULT label inside the speed list item.** Will likely be a `text-[10px] text-muted-foreground ml-1.5` next to the `1.0×` value — settle when looking at the actual rendered popover.
- **Whether the skip-interval setting needs a "reset to defaults (15/30)" button.** Probably not for v1; revisit if user feedback shows people get stuck on weird values.
- **Whether `useMediaSession` needs to accept seconds args directly or stay closure-based.** Resolved during Unit 0 discovery — see Unit 0 verification.

## Implementation Units

- [ ] **Unit 0: Pre-implementation discovery spike**

**Goal:** Verify three assumptions about the skip-interval data path before Unit 3 starts. Prevents an hour of mid-implementation surprise.

**Requirements:** Supports R3 (configurable skip intervals must work end-to-end through every surface that triggers a skip).

**Dependencies:** None (must run before Unit 3).

**Files:**
- Read-only: `src/app/hooks/useAudioPlayer.ts` (lines ~622, 653 — confirm default seconds when no arg passed)
- Read-only: `src/app/hooks/useKeyboardShortcuts.ts` (confirm hook accepts dynamic closures and does not hardcode 15/30 internally)
- Read-only: `src/app/hooks/useMediaSession.ts` (confirm `onSkipBack`/`onSkipForward` callbacks could close over fresh pref values when called by OS controls)
- Read-only: `src/app/components/audiobook/AudioMiniPlayer.tsx` (locate the mini-player's skip handlers; identify all skip-related call sites)

**Approach:**
- Read each file and answer three questions:
  1. **Default-arg fallback:** When `skipBack()` is called with no argument, what value does it use? (Likely 15 — confirm.) Same for `skipForward()`.
  2. **MediaSession freshness:** When the OS triggers `seekbackward` 30 seconds after the last render, does the closure capture the *current* pref value or a stale one? Inspect `useMediaSession.ts` setup to determine if action handlers are re-registered on every render or only on mount.
  3. **Mini-player parity:** Does `AudioMiniPlayer.tsx` call `skipBack(15)` / `skipForward(30)` directly, or call into a shared helper? List exact line numbers.
- Document findings inline in this plan under "Resolved by Unit 0" before starting Unit 3.

**Test scenarios:**
- Test expectation: none — discovery spike, no behavior change.

**Verification:**
- Three answers documented in the plan, with line numbers.
- If any answer is "stale closure" or "hardcoded fallback", Unit 3's approach is updated accordingly *before* Unit 3 begins.

---

- [ ] **Unit 1: Disambiguate clips-list panel icon**

**Goal:** Replace the `Scissors` icon on the clips-list opener with `ListVideo` so it no longer collides with the `ClipButton` (recorder) sitting next to it.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/audiobook/AudiobookRenderer.tsx` (line ~13 import, line ~562 JSX)
- Create: `src/app/components/audiobook/__tests__/AudiobookRenderer.test.tsx` (file does not exist yet — scaffold with React Testing Library + jsdom; mock `useAudioPlayer`, `useBookCoverUrl`, and Zustand stores as needed). Subsequent units will extend this file.

**Approach:**
- Swap the lucide import: remove `Scissors` from this file's import (it's still used by `ClipButton.tsx`); add `ListVideo`
- Update the JSX at the clips-panel button to use `<ListVideo className="size-5" aria-hidden="true" />`
- Keep the existing `aria-label="Clips"` and `data-testid="clips-panel-button"` — these are correct semantically; only the icon was wrong
- Verify `ClipButton.tsx` still imports and renders `Scissors` (no change needed there)

**Patterns to follow:**
- Existing icon-only buttons in [src/app/components/audiobook/AudiobookRenderer.tsx](src/app/components/audiobook/AudiobookRenderer.tsx) use `size-5` with `aria-hidden="true"` on the icon and a sibling `aria-label` on the button

**Test scenarios:**
- Happy path: clips-panel button renders with the `ListVideo` icon (use `data-testid="clips-panel-button"` to find the button, assert the SVG has the expected lucide class or `data-lucide="list-video"` attribute)
- Happy path: `ClipButton` still renders `Scissors` (no regression in its existing test)
- Accessibility: clicking the clips-panel button still opens `ClipListPanel` (existing behavior preserved)

**Verification:**
- The two adjacent toolbar buttons render distinct icons; visual inspection at mobile breakpoint (375px) shows no remaining ambiguity
- All existing `AudiobookRenderer` tests still pass

---

- [ ] **Unit 2: Toggle elapsed/remaining time on scrubber**

**Goal:** Let users tap the right-hand scrubber timestamp to switch between total duration and time remaining (`−4:11:45` style), persisted across sessions and across devices.

**Requirements:** R2, R6

**Dependencies:** None

**Files:**
- Modify: `src/stores/useAudiobookPrefsStore.ts` (add `showRemainingTime: boolean` to `AudiobookPrefs`, add `setShowRemainingTime(value: boolean)` value-setter, validate in `loadPersistedPrefs`)
- Modify: `src/lib/settings.ts` — **two sites:**
  - Add `showRemainingTime?: boolean` to `UserSettingsPatch` (writer side, ~line 198)
  - Add hydration block inside `hydrateSettingsFromSupabase` next to the existing audiobook-prefs block (~line 379): `if (typeof s.showRemainingTime === 'boolean') { useAudiobookPrefsStore.getState().setShowRemainingTime(s.showRemainingTime) }`
- Modify: `src/app/components/audiobook/AudiobookRenderer.tsx` (lines ~470–471: wrap right-side timestamp in a `<button>`, conditionally render based on pref)
- Test: `src/stores/__tests__/useAudiobookPrefsStore.test.ts` (extend — file exists)
- Test: `src/app/components/audiobook/__tests__/AudiobookRenderer.test.tsx` (extend the file scaffolded in Unit 1)

**Approach:**
- Add `showRemainingTime: boolean` to `AudiobookPrefs` interface, default `false`
- Add `setShowRemainingTime(value: boolean)` action to the store (value-setter, *not* a toggle — see Key Technical Decisions). Mirror `setDefaultSpeed` pattern at lines ~94–101: validate input is boolean, persist to localStorage, fire-and-forget Supabase sync via `saveSettingsToSupabase({ showRemainingTime: value })`.
- In `loadPersistedPrefs`, validate with `typeof parsed.showRemainingTime === 'boolean' ? parsed.showRemainingTime : defaults.showRemainingTime`
- In `AudiobookRenderer`, replace the bare `<span>{formatAudioTime(duration)}</span>` with a `<button>` that:
  - Renders `−${formatAudioTime(Math.max(0, duration - currentTime))}` when `showRemainingTime`
  - Renders `formatAudioTime(duration)` otherwise
  - Calls `setShowRemainingTime(!showRemainingTime)` onClick
  - Has `aria-label="Toggle time display"` and `aria-pressed={showRemainingTime}`
  - Padded sufficiently to meet 44×44px target (use `min-h-[44px] px-3` on the button)
- Use the existing `tabular-nums` class so digits don't shift width when toggling

**Patterns to follow:**
- `setDefaultSpeed` value-setter pattern in [src/stores/useAudiobookPrefsStore.ts:94](src/stores/useAudiobookPrefsStore.ts) for the new setter
- Existing audiobook-prefs hydration block in [src/lib/settings.ts:379–404](src/lib/settings.ts) — add the new field as a sibling using the value-setter style (cleaner than the toggle-style hydration above it)
- `data-testid="current-time-display"` (existing on the left timestamp) — add `data-testid="duration-display"` to the right button for test stability

**Test scenarios:**
- Happy path (store): `setShowRemainingTime(true)` updates state, persists to localStorage, calls `saveSettingsToSupabase({ showRemainingTime: true })`
- Happy path (store): `setShowRemainingTime(false)` round-trips identically
- Happy path (component): default render shows total duration; clicking the right timestamp shows `−` prefix and remaining time; clicking again toggles back
- Edge case: when `duration` is 0 or unknown, the remaining-time render produces `−0:00` (via `Math.max(0, …)`) and does not throw
- Edge case: when `currentTime > duration` (rounding edge), remaining still clamps to 0 and does not produce a positive number with a minus sign
- Edge case: `loadPersistedPrefs` recovers gracefully when localStorage has a non-boolean `showRemainingTime` value (falls through to default `false`)
- Accessibility: button has `aria-label`, `aria-pressed` reflects state, keyboard activation (Enter/Space) toggles correctly
- Integration (sync round-trip): seed `user_settings.settings.showRemainingTime: true` in a mocked Supabase, run `hydrateSettingsFromSupabase`, assert the store state reflects `true` afterward (mirrors the existing pattern for `defaultSpeed` hydration tests)

**Verification:**
- Tapping the right-side timestamp toggles between `6:47:35` and `−4:11:45` formats; reload preserves the choice
- Logging in on a second device (where the user previously toggled) shows the same display mode
- No layout shift when toggling (tabular-nums + same character width)

---

- [ ] **Unit 3: Configurable skip intervals**

**Goal:** Allow users to choose skip-back (5/10/15/30/45/60 s) and skip-forward (10/15/30/45/60/90 s) intervals from `AudiobookSettingsPanel`. Defaults stay 15/30. Preference flows to **all** skip surfaces: button taps, keyboard shortcuts, OS-level MediaSession controls, and the desktop mini-player.

**Requirements:** R3, R6

**Dependencies:** Unit 0 must be completed first.

**Files:**
- Modify: `src/stores/useAudiobookPrefsStore.ts` (add `skipBackSeconds: number` and `skipForwardSeconds: number`, value-setters, validation against allow-lists; export `VALID_SKIP_BACK` and `VALID_SKIP_FORWARD` constants)
- Modify: `src/lib/settings.ts` — **two sites:**
  - Add `skipBackSeconds?: number` and `skipForwardSeconds?: number` to `UserSettingsPatch` (~line 198)
  - Add hydration block (~line 379) using value-setters: `if (typeof s.skipBackSeconds === 'number') { useAudiobookPrefsStore.getState().setSkipBackSeconds(s.skipBackSeconds) }` plus the equivalent for forward
- Modify: `src/app/components/audiobook/AudiobookSettingsPanel.tsx` (add two select controls in the Playback section)
- Modify: `src/app/components/audiobook/AudiobookRenderer.tsx` (replace hardcoded `15`/`30` at lines ~240, ~241, ~257, ~262, ~479, ~485, ~507, ~513 with the configured values; update the visible `15s` / `30s` labels under the skip buttons)
- Modify: `src/app/components/audiobook/AudioMiniPlayer.tsx` (mirror the same skip-handler updates so desktop mini-player honors the configured intervals — exact line numbers documented in Unit 0 findings)
- Modify (conditional, based on Unit 0 findings): `src/app/hooks/useKeyboardShortcuts.ts` — only if Unit 0 reveals the hook hardcodes values internally rather than receiving closures from the renderer
- Modify (conditional, based on Unit 0 findings): `src/app/hooks/useMediaSession.ts` — only if Unit 0 reveals action handlers capture stale closures and need either re-registration on pref change or a dynamic-arg signature
- Test: `src/stores/__tests__/useAudiobookPrefsStore.test.ts` (extend — file exists)
- Create: `src/app/components/audiobook/__tests__/AudiobookSettingsPanel.test.tsx` (file does not exist — scaffold)
- Test: `src/app/components/audiobook/__tests__/AudiobookRenderer.test.tsx` (extend the file scaffolded in Unit 1)

**Approach:**
- Define module-level constants in the store: `export const VALID_SKIP_BACK = [5, 10, 15, 30, 45, 60]` and `export const VALID_SKIP_FORWARD = [10, 15, 30, 45, 60, 90]`; the settings UI imports these
- Add fields to `AudiobookPrefs` interface and `defaults` (15 and 30); validate in `loadPersistedPrefs` against the corresponding allow-list (mirror the `VALID_SPEEDS_SET.has(...)` pattern at lines ~54–56)
- Add `setSkipBackSeconds(seconds: number)` and `setSkipForwardSeconds(seconds: number)` value-setter actions following the `setDefaultSpeed` pattern at lines ~94–101 — including the fire-and-forget `saveSettingsToSupabase` call
- In `AudiobookRenderer`, read both values from the store via `useAudiobookPrefsStore`; pass them to `skipBack(skipBackSeconds)` and `skipForward(skipForwardSeconds)` at every call site (handlers, keyboard wiring closures, button `onClick`s); update the `<span className="text-[10px] tabular-nums">15s</span>` labels to interpolate the configured value
- In `AudioMiniPlayer`, apply the same closure substitution at the locations identified in Unit 0
- **MediaSession freshness fix (if Unit 0 finds the issue):** the simplest stable pattern is to put the `onSkipBack` and `onSkipForward` callbacks inside a `useCallback` that depends on the configured pref values, and ensure `useMediaSession` re-registers handlers when those callbacks change. If Unit 0 finds handlers are already re-registered on every render (because `setActionHandler` is in an effect that depends on the callbacks), nothing more is needed.
- In `AudiobookSettingsPanel`, add two new controls in the Playback section using the same pattern as the existing speed control. Use the project's existing shadcn `Select` component for visual consistency with the rest of the panel

**Patterns to follow:**
- `setDefaultSpeed` validation pattern in [src/stores/useAudiobookPrefsStore.ts:94](src/stores/useAudiobookPrefsStore.ts) — validate against allow-list, fall through to default on invalid value
- The existing audiobook-prefs hydration block in [src/lib/settings.ts:379–404](src/lib/settings.ts) for both new fields
- The existing speed-options block in [src/app/components/audiobook/AudiobookSettingsPanel.tsx](src/app/components/audiobook/AudiobookSettingsPanel.tsx) (around line ~80) for layout and labeling

**Test scenarios:**
- Happy path (store): `setSkipBackSeconds(45)` updates state, persists, syncs; reading back returns `45`
- Happy path (store): `setSkipForwardSeconds(60)` updates state, persists, syncs
- Edge case: `setSkipBackSeconds(7)` (not in allow-list) falls through to default `15`
- Edge case: `setSkipForwardSeconds(120)` (not in allow-list) falls through to default `30`
- Edge case: `loadPersistedPrefs` recovers gracefully when persisted values are corrupted (non-numeric, out-of-range, NaN)
- Happy path (component): clicking skip-back button when `skipBackSeconds === 45` calls `skipBack(45)` (assert via mocked `useAudioPlayer`)
- Happy path (component): button label text updates from `15s` to `45s` when preference changes
- Happy path (component): keyboard shortcut for skip-back uses the configured value (simulate keypress, assert `skipBack` arg)
- Happy path (mini-player): `AudioMiniPlayer` skip controls also honor the configured value (mirror the renderer test)
- Integration (MediaSession): after a pref change, simulate the OS calling `seekbackward` and assert the resulting `skipBack` call uses the new value, not the old one. This is the staleness check.
- Integration (sync round-trip): seed `user_settings.settings.skipBackSeconds: 45` in a mocked Supabase, run `hydrateSettingsFromSupabase`, assert the store reflects `45`; same for forward
- Happy path (settings panel): selecting a new value calls the corresponding setter; UI reflects the active selection
- Happy path (settings panel): the dropdown only offers values from `VALID_SKIP_BACK` / `VALID_SKIP_FORWARD`

**Verification:**
- Setting skip-back to 45s and skip-forward to 60s produces audio that jumps by those amounts on every interaction (button taps + keyboard shortcuts + OS controls + mini-player)
- Visible labels under the skip buttons match the configured values
- Reload preserves the configured intervals
- Logging in on a second device picks up the configured intervals via Supabase hydration

---

- [ ] **Unit 4: SpeedControl DEFAULT label on 1.0×**

**Goal:** Always render a small `DEFAULT` label next to the `1.0×` option in the speed popover so users have a navigational anchor to baseline speed regardless of current selection.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/audiobook/SpeedControl.tsx` (line ~56–77 list item rendering)
- Create: `src/app/components/audiobook/__tests__/SpeedControl.test.tsx` (file does not exist — scaffold)

**Approach:**
- Inside the `VALID_SPEEDS.map` callback, when `rate === 1.0`, render an additional `<span>` next to the speed value with the text `DEFAULT`
- Style it as `text-[10px] uppercase tracking-wide text-muted-foreground font-medium ml-1.5` (matches the existing micro-label aesthetic in [src/app/components/audiobook/AudiobookRenderer.tsx](src/app/components/audiobook/AudiobookRenderer.tsx) `Narrated by` line ~431)
- The label is always visible — it does not hide when 1.0× is the active selection
- The active-state `Check` icon still renders to the right when 1.0× is selected; DEFAULT label sits between the speed value and the Check
- Confirm contrast: `text-muted-foreground` on the popover surface meets WCAG AA — this is already validated for other muted text in the popover

**Patterns to follow:**
- The existing `text-xs uppercase tracking-wide text-muted-foreground` micro-label in [src/app/components/audiobook/AudiobookRenderer.tsx:431](src/app/components/audiobook/AudiobookRenderer.tsx) — use a similar treatment with `text-[10px]` to fit inline with the speed value

**Test scenarios:**
- Happy path: 1.0× option renders a `DEFAULT` label; other options do not
- Happy path: selecting 2.0× then re-opening the popover — DEFAULT is still visible on the 1.0× row (i.e., independent of selection state)
- Happy path: when 1.0× is the active selection, both the DEFAULT label and the active-state `Check` icon are present
- Accessibility: DEFAULT label is part of the option's accessible name — screen readers announce "1.0 times, default". Achieved by rendering the label as plain text inside the `<li role="option">` (no `aria-hidden`)

**Verification:**
- Opening the speed popover at any active speed shows DEFAULT next to 1.0×
- Visual inspection at mobile breakpoint shows the label fits without truncating the speed value or pushing the Check off-row

---

- [ ] **Unit 5: SleepTimer reorder and add 5/10 min presets**

**Goal:** Reorder `SleepTimer` options so high-intent items lead the list (Custom → End of chapter → 60 → 45 → 30 → 15 → 10 → 5 → Off) and add 5/10 min presets for quick "falling asleep now" use.

**Requirements:** R5, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/audiobook/SleepTimer.tsx` (constants `PRESET_OPTIONS` and `SUFFIX_OPTIONS`, render order in JSX)
- Modify: `src/app/hooks/useSleepTimer.ts` — **no changes required** to the hook itself: `SleepTimerOption` is already typed as `number | 'end-of-chapter' | 'off'` (line 15), so 5 and 10 are accepted without a type extension. Listed here only as a confirmation file to read during implementation.
- Modify: `src/stores/useAudiobookPrefsStore.ts` (extend `SleepTimerDefault` type to include `5 | 10` and add to `VALID_TIMERS` set so `defaultSleepTimer` can persist these new presets)
- Modify: `src/lib/settings.ts` — the existing hydration block at lines 389–398 uses `validTimers = new Set(['off', 15, 30, 45, 60, 'end-of-chapter'])`. Extend that set to include 5 and 10 (otherwise hydration silently rejects the new presets even though the store accepts them)
- Modify: `src/app/components/audiobook/AudiobookSettingsPanel.tsx` (extend `SLEEP_TIMER_OPTIONS` array to include 5 and 10)
- Create: `src/app/components/audiobook/__tests__/SleepTimer.test.tsx` (file does not exist — scaffold)
- Test: `src/app/hooks/__tests__/useSleepTimer.test.ts` (extend — file exists)

**Approach:**
- Update `PRESET_OPTIONS` to descending order: `[60, 45, 30, 15, 10, 5]` with labels in `'X minutes'` format
- Restructure the JSX render order to match the new intent ordering. Current order in [src/app/components/audiobook/SleepTimer.tsx](src/app/components/audiobook/SleepTimer.tsx): `[chapter progress bar] → PRESET_OPTIONS → Custom → SUFFIX_OPTIONS (end-of-chapter, off)`. New order: `[chapter progress bar] → Custom → end-of-chapter → PRESET_OPTIONS (60→5 descending) → off`
- Move the Custom inline-input rendering above the End of chapter row in the JSX
- Move End of chapter into its own rendered row (split from `SUFFIX_OPTIONS`); keep Off in `SUFFIX_OPTIONS` as the terminal item
- Verify `useSleepTimer` hook accepts the new 5/10 numeric values without additional changes (likely already does since it accepts `number`)
- Update `SleepTimerDefault` type and `VALID_TIMERS` set in the prefs store to include `5 | 10`
- Update settings panel options array to add the two new presets in descending order

**Patterns to follow:**
- Existing `renderOption` helper in [src/app/components/audiobook/SleepTimer.tsx](src/app/components/audiobook/SleepTimer.tsx) — reuse as-is for the new preset rows

**Test scenarios:**
- Happy path: popover renders rows in this order top-to-bottom: Custom, End of chapter, 60 minutes, 45 minutes, 30 minutes, 15 minutes, 10 minutes, 5 minutes, Off
- Happy path: selecting `5` activates a 5-minute timer (assert `onSelect(5)` is called)
- Happy path: selecting `10` activates a 10-minute timer
- Happy path: End of chapter still shows the chapter progress bar when active (existing behavior preserved)
- Edge case: `loadPersistedPrefs` accepts 5 and 10 as valid persisted values (validation in `useAudiobookPrefsStore`)
- Accessibility: all rows remain keyboard-navigable; tab order matches visual order
- Integration: `AudiobookSettingsPanel`'s default-sleep-timer dropdown includes 5 and 10 options

**Verification:**
- Visual order matches the spec
- Selecting 5 or 10 triggers a corresponding sleep timer that fires after the expected duration (the underlying `useSleepTimer` hook is unchanged)
- Default-sleep-timer setting in `AudiobookSettingsPanel` accepts 5 and 10

---

## System-Wide Impact

- **Interaction graph:** Skip-interval changes flow through three call sites (mouse handlers, keyboard handlers, MediaSession action handlers). All must be updated together. The MediaSession metadata at `AudiobookRenderer.tsx:233` does not need changes — the OS-level skip controls already use the same `skipForward`/`skipBack` functions.
- **Error propagation:** No new failure modes. All settings setters use the existing fire-and-forget Supabase sync pattern; localStorage failures are silent-caught.
- **State lifecycle risks:** `loadPersistedPrefs` is the choke point — if any new field validates incorrectly, it falls through to the default rather than crashing the player. This pattern is already proven for `defaultSpeed` and `defaultSleepTimer`.
- **API surface parity:** None of these changes affect public APIs, exported types consumed by other features, or sync engine schemas beyond adding new optional fields to the settings sync (additive — backward compatible).
- **Integration coverage:** Settings persistence + Supabase sync should be tested with real store interactions (not pure mocks) for each new field, since the existing tests for `useAudiobookPrefsStore` already cover the round-trip pattern.
- **Unchanged invariants:** Existing skip behavior (15/30 defaults) preserved when prefs are at default. Existing speed presets unchanged (still 11 values, 0.25 grid). Existing sleep timer behavior preserved for all current options. Cover art treatment unchanged from this session's earlier fix. Chapter progress bar in `SleepTimer` preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Skip-interval setting somehow misses a call site (e.g., a future feature adds a new skip handler that hardcodes 15/30 again) | Define skip values as the *only* source of truth in the store; consider an ESLint rule later if regressions appear. Not blocking for v1. |
| `ListVideo` icon is too similar to other list-type icons in the toolbar to other users | Visual review during design review will catch this. Fallback to `Library` or `BookmarkCheck` if needed. |
| DEFAULT label crowds the popover row at small widths | The popover is `w-36` (144px). `text-[10px]` label adds ~50px. Total fits comfortably; visual review will confirm. |
| Sleep timer reorder confuses users who learned the current ordering | Low risk; the menu is rarely used (sleep timers are set-and-forget). Users who care will notice the new options (5/10 min) as a benefit. |
| Persisted `showRemainingTime` syncs to Supabase but downstream consumers (web vs. mobile, future native app) interpret it differently | The field is purely UI-local; it's safe to sync but no other surface depends on it today. |

## Documentation / Operational Notes

- No user-facing docs need updates (no help center references to skip intervals or speed presets)
- No migration needed — all new prefs use sensible defaults; existing users get current behavior
- **JSONB field-name discipline:** the `user_settings.settings` column is JSONB with no server-side schema validation. The field-name strings in `UserSettingsPatch`, `saveSettingsToSupabase` calls, and the `s.fieldName` reads inside `hydrateSettingsFromSupabase` must match exactly. A typo will fail silently — the round-trip integration tests in each unit are the safety net.
- After merge, monitor for any Supabase sync errors that could indicate unexpected payload issues. The `saveSettingsToSupabase` function in [src/lib/settings.ts](src/lib/settings.ts) logs failures via `console.warn`.
- **Performance impact:** negligible. Each new field adds one Zustand subscription and one localStorage write per pref change. No new effects, no extra renders, no animation work. Bundle size impact is sub-1KB across all units combined. Performance review during `/review-story` should confirm but is unlikely to surface anything.

## Sources & References

- Conversation context: comparison of Knowlune mobile player against Apple Books screenshots (this session)
- Already-shipped changes (do not re-plan): cover `object-cover` fix and ambient-blur tone-down in [src/app/components/audiobook/AudiobookRenderer.tsx](src/app/components/audiobook/AudiobookRenderer.tsx) lines ~392–393, ~401, ~406
- Related code: [src/app/components/audiobook/](src/app/components/audiobook/) (player surface), [src/stores/useAudiobookPrefsStore.ts](src/stores/useAudiobookPrefsStore.ts) (persistence)
- Related conventions: [.claude/rules/styling.md](.claude/rules/styling.md), [.claude/rules/workflows/design-review.md](.claude/rules/workflows/design-review.md)
