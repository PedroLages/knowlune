# Epic 109 — Audiobook Player Polish

**Date:** 2026-04-19
**Status:** Draft (awaiting beta launch completion before story creation)
**Epic number:** E109 (next available after E108 Audiobookshelf integration)
**Effort estimate:** ~7 stories, 1-2 sprints

## Context

Knowlune shipped audiobook playback (E108 series: Audiobookshelf integration, `useAudioPlayer`, `AudioMiniPlayer`, bookmarks/clips, `useAudiobookPrefsStore`). The core playback loop works, but the player UX lags behind mature audiobook apps (Overcast, Pocket Casts, Audible, Audiobooth).

Pedro reviewed Audiobooth's iOS Player settings (2026-04-19) and identified gaps. This epic closes the high-value ones — features users expect from a serious audiobook client — without chasing niche or hardware-only capabilities.

**Why this matters:** Audiobook retention is a multiplier on Knowlune's value prop. Users who audio-learn for 1+ hour/day notice missing smart-rewind or fade-out instantly and churn to Overcast. Shipping polish close to E108 compounds the investment while the player code is fresh.

**Why not now:** Beta launch (see `2026-04-18-011-feat-knowlune-online-beta-launch-plan.md`) takes priority. Polish features don't block launch.

**Sequencing:** Execute **after** beta launch validates the core product, **before** E56 Knowledge Map. Slotted as **Batch F** in the product roadmap.

## Story Breakdown

| # | Story | Effort | Notes |
|---|---|---|---|
| **S01** | Configurable skip forward/back intervals | S | Asymmetric (different back/forward), preset list: 10/15/30/60/90s. Extend `useAudiobookPrefsStore`. |
| **S02** | Smart Rewind after pause | M | When playback resumes after pause > threshold (10min default), rewind N seconds (pref: off/10/20/30). |
| **S03** | Smart Rewind on audio interruption | S | Same mechanism as S02, triggered by phone calls / Siri / AirPods disconnect. Use `onended`/`onpause` + interruption events. |
| **S04** | Audio fade-out on sleep timer expiry | S | Linear volume ramp over last N seconds (pref: off/5s/10s/30s). Web Audio API gain node. |
| **S05** | Automatic sleep timer (time-window scheduling) | M | Auto-start sleep timer when playback begins during configured window (e.g., 10pm-6am). New pref: `autoSleepTimer: { enabled, startTime, endTime, duration }`. |
| **S06** | "Playback speed adjusts time remaining" toggle | S | When on, time-remaining display divides by current speed. Pref-gated because some users prefer raw time. |
| **S07** | Reorderable player controls | M | Drag-to-reorder list in `AudiobookSettingsPanel` for Speed / Timer / Bookmarks / History / Volume buttons. Persist to prefs store. Disabled controls move to overflow menu. |

**Deferred / dropped:**
- Shake-to-reset sleep timer — PWA `DeviceMotionEvent` is flaky across browsers, requires iOS permission prompt, low ROI
- Orientation lock — web-only limitation, niche use case
- Lock Screen Controls reorder — MediaSession API exposes limited control surface on web
- NFC tag writing — hardware-only, niche
- iCloud sync — already solved via Supabase sync (E92-E94)

## Critical Files

**Existing (to be extended):**
- `src/stores/useAudiobookPrefsStore.ts` — add new pref fields + setters
- `src/app/hooks/useAudioPlayer.ts` — smart rewind logic, fade-out
- `src/app/components/audiobook/AudiobookSettingsPanel.tsx` — new UI controls
- `src/app/components/audiobook/AudioMiniPlayer.tsx` — respect reordered controls
- `src/app/hooks/useAudiobookPrefsEffects.ts` — wire auto-sleep-timer side effect

**New (likely):**
- `src/app/components/audiobook/PlayerControlsReorderList.tsx` — drag-and-drop list
- `src/lib/audioFade.ts` — gain node helper for S04

## Patterns to Reuse

- **Prefs persistence:** `useAudiobookPrefsStore` already has `loadPersistedPrefs` / `persistPrefs` — extend its `AudiobookPrefs` interface and validation sets
- **Zustand + localStorage:** established pattern across prefs stores
- **Drag-and-drop:** check existing usage (shadcn doesn't ship one — likely need `@dnd-kit/core` dependency, verify bundle impact)

## Verification

- **Unit:** extend `useAudiobookPrefsStore.test.ts` for each new pref + setter; new tests for smart-rewind timing logic and fade-out gain ramp
- **E2E:** new Playwright spec under `tests/e2e/audiobook-player-polish.spec.ts` covering S01 (skip intervals), S05 (auto sleep timer activation window), S07 (reorder persistence)
- **Manual:** test on real audiobook session (Audiobookshelf server) — pause 15 min, resume, verify rewind; set sleep timer, verify fade-out; reorder controls, reload, verify persistence
- **Bundle size:** verify `@dnd-kit` (if added) doesn't regress perf budget > 25%

## Open Questions (resolve before story creation)

1. **Smart rewind threshold** — fixed 10min like Audiobooth, or configurable? (Recommend: configurable, default 10min)
2. **Auto sleep timer time source** — device local time or user-set timezone? (Recommend: local time, matches OS behavior)
3. **DnD library** — add `@dnd-kit/core` or hand-roll with pointer events? (Recommend: `@dnd-kit`, battle-tested, ~12kb gzipped)

## Next Action

1. Add roadmap entry (this plan's companion edit to `2026-03-28-product-roadmap.md`)
2. Wait for beta launch completion
3. Run `/bmad-create-epics-and-stories` to generate E109 story files from this plan
4. Execute via `/start-story E109-S01` → standard story workflow
