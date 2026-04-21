# E97-S04 — New Device Download Experience (Requirements)

**Date:** 2026-04-19
**Epic:** E97 Sync UX Polish
**Story:** E97-S04
**Status:** Requirements / pre-plan

## Problem

When a user signs into Knowlune on a new device:

1. Supabase has their data (notes, books, flashcards, progress, etc.).
2. Local Dexie is empty.
3. `useAuthLifecycle` awaits `hydrateP3P4FromSupabase(userId)` and other
   hydrators silently in the background.
4. During hydration the app routes to Overview / Courses / etc., which render
   **empty states** with no indication that data is in-flight.

Result: a returning user sees a blank app and assumes their data is lost or
their account is broken. They may sign out, reinstall, or file support
issues.

E97-S04 fixes this with a symmetric counterpart to the E97-S03 Initial
Upload Wizard — a **download overlay** that communicates "your data is being
restored" for the duration of hydration.

## Existing Systems (Research Summary)

### `src/app/hooks/useAuthLifecycle.ts` (lines 62–128)

- `handleSignIn(userId, userMetadata)` runs on `SIGNED_IN` /
  `INITIAL_SESSION`.
- Sequence:
  1. `await hydrateSettingsFromSupabase(...)` — user-metadata settings.
  2. `await hydrateP3P4FromSupabase(userId)` — **the fan-out we want to
     observe.** (lines 73–75)
  3. `runCredentialsToVaultMigration()` (fire-and-forget).
  4. Fast-path: if `LINKED_FLAG_PREFIX` set → `backfillUserId` +
     `syncEngine.start(userId)` and return.
  5. Otherwise: `hasUnlinkedRecords` → dialog or backfill + start sync.
- **Key insight:** hydrateP3P4 is awaited. We can wrap it in a
  status-broadcasting helper or emit events around it without changing its
  contract.

### `src/lib/sync/hydrateP3P4.ts`

- `hydrateP3P4FromSupabase(userId)` dispatches 9 table queries in parallel
  via `Promise.allSettled`.
- Tables touched: `learningPaths`, `learningPathEntries`, `studySchedules`,
  `challenges`, `courseReminders`, `notifications`, plus deferred quizzes /
  careerPaths / pathEnrollments.
- Each branch calls the matching Dexie store's `hydrateFromRemote` with
  `bulkPut` — no `syncQueue` writes (echo-loop guard).
- **Error posture:** `Promise.allSettled` — partial failures are logged and
  swallowed. The top-level call always resolves to `undefined`.

Note: "syncable" content (notes, books, flashcards, bookHighlights,
audioBookmarks, etc.) is **not** hydrated through `hydrateP3P4` — it's
pulled via the E92 sync engine's download cursor. For a true new-device
experience, the overlay must observe BOTH:

- `hydrateP3P4FromSupabase` (P3/P4 LWW tables), AND
- `syncEngine.start(userId)` → initial download cursor run (P0/P1/P2
  content tables).

### `src/app/hooks/useInitialUploadProgress.ts` (reuse pattern)

- Snapshot-on-mount total via `readPendingCount` + `computeUnlinkedCount`.
- 500ms poll loop via `window.setInterval`.
- Uses `useRef` to hold snapshot stable across renders (F2 race fix).
- `enabled` flag gates the effect for conditional mounting.
- Returns `{ processed, total, recentTable, done, error }`.

**For S04 we mirror this shape but source counts differently:**
- **Total:** sum of Supabase row counts per table (cheap `select count(*)`
  or `HEAD` queries) captured at mount time.
- **Processed:** sum of Dexie row counts per hydrated table, updated by
  polling Dexie every 500ms.
- **Done:** either hydrator promise resolved OR `processed === total`.

### `src/app/components/sync/InitialUploadWizard.tsx` (reuse pattern)

- Phase machine: `intro → uploading → success | error`.
- S04 skips `intro` (no user choice — we just show progress).
- Proposed phases: `downloading → success | error`, with a 2s deferred mount
  so fast paths never see the `downloading` frame (AC4).
- Non-dismissible during active download (mirror S03 uploading phase).
- `aria-live="polite"` on progress text.
- `data-testid` hooks: `new-device-download-overlay`,
  `new-device-download-retry`, `new-device-download-close`.

### `src/lib/sync/shouldShowInitialUploadWizard.ts` (adapt pattern)

S03 predicate checks `localStorage` completion/dismissal flags + pending
queue + unlinked records. For S04 we adapt:

```ts
export async function shouldShowDownloadOverlay(userId: string): Promise<boolean> {
  if (!userId) return false
  // Only show when local DB is empty (new device) AND remote has data.
  const localHasData = await anySyncableTableHasRowsFor(userId)
  if (localHasData) return false // AC6 short-circuit
  const remoteHasData = await anySupabaseTableHasRowsFor(userId)
  return remoteHasData
}
```

Co-existence with S03 wizard: S03 only shows when **local DB has data** that
needs uploading. S04 only shows when **local DB is empty**. The two are
mutually exclusive by construction — the `localHasData` check in S04 is the
exact inverse of S03's trigger condition.

### `src/app/App.tsx` (mount pattern)

Currently mounts `LinkDataDialog` and `InitialUploadWizard` near the end of
the JSX tree, gated by `useAuthStore` user + predicate evaluation via
`useEffect`. S04 adds a parallel `NewDeviceDownloadOverlay` mount with its
own `evaluateOverlay` callback.

Evaluation coordination:
- S04 overlay evaluation must run **before** `LinkDataDialog` (they're
  mutually exclusive: link dialog implies local data exists).
- Concretely: the `handleUnlinkedDetected` callback fires only when
  `hasUnlinkedRecords` returns true → local DB has rows → S04 overlay is
  not shown. So a simple "evaluate on authUser change, gate on no local
  data" is sufficient.

## Requirements (from story ACs)

**R1 (AC1)** Overlay mounts on new-device sign-in when `shouldShowDownloadOverlay(userId)` resolves true.

**R2 (AC2)** Progress UI shows `processed/total` (item count) and an optional
percentage bar. Updates in real-time via 500ms polling of Dexie table counts
against the snapshot total.

**R3 (AC3)** Overlay auto-dismisses when hydration resolves AND `processed >= total`, OR when the hydration signal emits "done".

**R4 (AC4)** A 2-second `setTimeout` defers the mount. If hydration resolves
before the timeout fires, overlay never appears.

**R5 (AC5)** Error state displayed if hydrator rejects OR if all fetched
totals are 0 but a generic failure flag is set. Shows `lastError` from a
status store (new or extend `useSyncStatusStore`) and a Retry button that
re-invokes `hydrateP3P4FromSupabase(userId)`.

**R6 (AC6)** `shouldShowDownloadOverlay` returns `false` if any syncable
Dexie table has rows linked to `userId` (reuse `SYNCABLE_TABLES` list from
`@/lib/sync/backfill` plus the P3/P4 tables).

## Open Questions (for plan phase)

1. **Hydration signal source** — Add a new `useDownloadStatusStore`
   (`idle | downloading | complete | error`) that `useAuthLifecycle` toggles
   around `hydrateP3P4FromSupabase`? Or pass a callback into a refactored
   hydrator? Proposed: new store (avoids changing hydrator contract,
   mirrors `useSyncStatusStore` convention).

2. **Total count source** — Supabase `count: 'exact', head: true` query per
   table (6 HEAD requests) at overlay mount? Or sum `hydrateFromRemote`
   payload sizes as they arrive (less accurate but no extra queries)?
   Proposed: HEAD queries — cheap, accurate, AC2 wants a stable total.

3. **Content tables (syncEngine download)** — Does the overlay wait for
   `syncEngine.start()`'s initial download cursor run too, or only
   `hydrateP3P4`? Proposed: both — otherwise the user sees the overlay
   disappear and the app still shows empty notes/books/flashcards. Requires
   extending the overlay's "done" signal to include the sync engine's
   first-cursor-run completion.

4. **Reduced-motion variant** — Replace pulsing download icon with static
   icon + spinner-free progress? Plan phase should confirm.

5. **Test harness for E2E** — Need a helper to seed Supabase + wipe Dexie
   to simulate new-device state. Likely extending existing sync test
   fixtures.

## Patterns to Reuse

- Snapshot + 500ms poll loop (`useInitialUploadProgress`).
- Phase-machine modal (`InitialUploadWizard`).
- LocalStorage-backed predicate (`shouldShowInitialUploadWizard`).
- Mount gate via `useEffect` + `useRef` guard in `App.tsx`.
- `data-phase` attribute for E2E assertions.
- `aria-live="polite"` for screen readers.

## Risk & Mitigation

- **R: Overlay flashes on fast connections** → AC4 2s defer.
- **R: Stuck overlay on silent hydrator failure** → AC5 timeout watchdog
  (e.g. 60s max; if not done, show error with Retry).
- **R: Race between `hydrateP3P4` completion and sync engine content
  download** → overlay "done" signal must wait for BOTH (see Open Q3).
- **R: Double-mount across renders** → guard via `evaluationInFlightRef`
  pattern from `App.tsx`.
- **R: Supabase HEAD queries hit rate limits** → fire in parallel
  (`Promise.allSettled`); on partial failure fall back to
  "Restoring your library..." without a numeric total.

## Success Metrics

- Returning user on a new device sees "Restoring..." within 200ms of sign-in
  completing (not an empty Overview page).
- Overlay disappears cleanly once hydration done; no flicker.
- < 1% of new-device sessions hit the error state (or, if they do, Retry
  succeeds on second attempt).
