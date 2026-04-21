# E97-S04 — New Device Download Experience

**Epic:** E97 Sync UX Polish
**Story ID:** E97-S04
**Title:** New Device Download Experience
**Status:** Draft
**Created:** 2026-04-19

## Summary

When a returning user signs in on a **new device** (empty local Dexie DB, but
Supabase has their data), the app currently renders empty states with no
explanation while `hydrateP3P4FromSupabase` (and sibling hydrators) silently
restore data. This story adds a prominent "Downloading your data..." overlay
that communicates progress and removes itself once hydration completes — the
symmetric counterpart to the E97-S03 Initial Upload Wizard.

## User Story

> As a returning Knowlune user who just signed in on a new device,
> I want to see that my data is being downloaded from the cloud,
> so that I understand the empty UI is temporary and trust the app is working.

## Context & Prior Work

- **E97-S01** — Header sync status indicator (subtle, always-on)
- **E97-S02** — Sync Settings Panel (reset / re-sync controls)
- **E97-S03** — Initial Upload Wizard (first-time upload for existing users
  with local data). Establishes the polling + phase-machine pattern we reuse.
- **E96-S02** — `hydrateP3P4FromSupabase` (the fan-out hydrator this story
  observes).

## Acceptance Criteria

### AC1 — Download overlay on new-device sign-in

On `SIGNED_IN` / `INITIAL_SESSION` when local Dexie is empty AND Supabase has
rows for the user, a prominent overlay (full-screen or app-level modal) is
displayed indicating "Downloading your data..." while hydration runs.

### AC2 — Real-time progress

The overlay shows progress — an item count (`X of Y`) or percentage — that
updates as `hydrateP3P4FromSupabase` populates Dexie tables. The total is
snapshotted from the Supabase remote row counts or approximated from the
hydrate fan-out; the processed counter is derived by polling Dexie table
counts during hydration.

### AC3 — Auto-dismiss on completion

When hydration resolves (the `await hydrateP3P4FromSupabase(userId)` call in
`useAuthLifecycle` completes), the overlay disappears automatically and the
app content becomes visible. No user action required on the happy path.

### AC4 — Skip overlay for fast connections

If hydration completes in **< 2 seconds**, the overlay is never shown
(deferred mount with a 2s delay timer). Prevents an ugly flash for users on
fast connections or small datasets.

### AC5 — Error state with Retry

If `hydrateP3P4FromSupabase` throws (or the underlying Supabase queries all
fail), the overlay transitions to an error state showing the error message
and a **Retry** button. Retry re-invokes the hydrator. A Close/Dismiss option
lets the user proceed with an empty local DB.

### AC6 — Skip entirely when local DB already has data

If local Dexie already has content (not a new device), the overlay is never
mounted. Detection uses a `shouldShowDownloadOverlay(userId)` predicate
analogous to `shouldShowInitialUploadWizard` that checks whether any
syncable table has rows for the user.

## Non-Goals / Scope Boundaries

- Does NOT change the hydration engine — purely observes the existing
  `hydrateP3P4FromSupabase` call in `useAuthLifecycle.ts`.
- Does NOT block interaction with sync-unrelated UI if the user dismisses the
  error state.
- Does NOT cover Storage-bucket asset download progress (covered separately).
- Does NOT co-appear with `LinkDataDialog` or `InitialUploadWizard` — those
  dialogs indicate local data exists, which short-circuits AC6.

## Design Notes

- Reuse shadcn `Dialog` (non-dismissible during download, like S03 uploading
  phase) OR a full-screen overlay with brand gradient — final pick during
  plan phase.
- Copy-tone: reassuring, not alarming. "Restoring your Knowlune library..."
- `aria-live="polite"` on progress text for screen readers.
- Respect `prefers-reduced-motion` — no pulsing animations if reduced.

## Files Likely Touched

- `src/lib/sync/shouldShowDownloadOverlay.ts` (new) — detection helper
- `src/app/hooks/useDownloadProgress.ts` (new) — polling hook (table counts)
- `src/app/components/sync/NewDeviceDownloadOverlay.tsx` (new) — UI component
- `src/app/App.tsx` — mount overlay, gate on predicate, 2s defer
- `src/app/hooks/useAuthLifecycle.ts` — expose hydration lifecycle signal
  (status store event or a ref passed into the overlay)

## Test Plan

- **Unit:** `shouldShowDownloadOverlay` truth table (empty DB + remote data,
  empty DB + empty remote, populated DB).
- **Unit:** `useDownloadProgress` polling — snapshot stability, done flag
  transitions, error propagation.
- **E2E (Playwright):** new-device simulation (seed Supabase, wipe Dexie),
  assert overlay appears, progress advances, overlay auto-closes, app content
  visible.
- **E2E:** fast-path — hydration completes in <2s, overlay never mounts.
- **E2E:** error path — force hydrate rejection, assert Retry button works.

## Out of Scope

- Modifying hydrator internals (keep engine invariants — E96-S02 contract).
- Persistent progress across reload (new-device hydration is one-shot).

## Definition of Done

- AC1–AC6 verified via Playwright + unit tests.
- Design review passes (mobile 375px, tablet 768px, desktop 1440px).
- Code review passes (architecture, silent-failure scan, accessibility).
- Does not regress E97-S03 wizard behavior — both flows coexist via the
  short-circuit in AC6.
