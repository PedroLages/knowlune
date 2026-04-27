---
title: "fix: Progress Position Sync Across Devices & Audiobookshelf"
type: fix
status: active
date: 2026-04-27
---

# Fix: Progress Position Sync Across Devices & Audiobookshelf

## Overview

Audiobook, ebook, and course progress positions are not syncing across devices. Three independent root causes: (1) position saves bypass the sync engine, (2) video progress field names don't match the Supabase RPC, (3) content progress is missing required fields. This plan fixes all three so that a user can pause on desktop and resume on mobile at the exact same position — and sync bidirectionally with Audiobookshelf.

## Problem Frame

**User expectation:** When listening to an audiobook, reading an ebook, or watching a course video on one device, the user should be able to pick up at the exact same position on another device. Additionally, progress made in Audiobookshelf should reflect in Knowlune (and vice versa) even when switching devices.

**Current reality:**
- Audiobook position: saved locally only (raw `db.books.update`, not `syncableWrite`)
- Ebook CFI position: saved locally only (raw `db.books.update`, not `syncableWrite`)
- Video progress: uses `syncableWrite` but Dexie fields (`currentTime`, `completionPercentage`) don't map to RPC params (`watched_seconds`, `duration_seconds`) — data silently drops
- Content progress: uses `syncableWrite` but `itemId` maps to `item_id` while RPC expects `content_id`, and `contentType`/`progressPct` fields are missing from the Dexie type
- ABS sync works direct but doesn't bridge through Supabase for cross-device scenarios

## Requirements Trace

- R1. Audiobook position (seconds) syncs across devices via Supabase
- R2. Ebook position (CFI string) syncs across devices via Supabase
- R3. Course video position (seconds) syncs correctly to/from Supabase
- R4. Course content progress syncs correctly to/from Supabase
- R5. ABS progress bidirectional sync works across devices (ABS → Supabase → other device)
- R6. `lastOpenedAt` syncs so "Continue Learning" shows most recent content
- R7. Download direction restores position on fresh devices

## Scope Boundaries

- **In scope:** Fixing the sync of progress position data for all three content types
- **Out of scope:** Adding new features (e.g., real-time collaborative reading, streaming sync)
- **Out of scope:** Changing the ABS API integration protocol itself
- **Out of scope:** UI changes to show sync status indicators

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/syncEngine.ts` — Upload/download phases, RPC batch logic, monotonic merge
- `src/lib/sync/tableRegistry.ts` — Table registry with `fieldMap`, `monotonicFields`, `compoundPkFields`
- `src/lib/sync/fieldMapper.ts` — Auto camelCase↔snake_case conversion
- `src/lib/sync/syncableWrite.ts` — The write path that stamps `userId`/`updatedAt` and enqueues sync
- `src/stores/useBookStore.ts:347` — `updateBookPosition()` (uses `syncableWrite`, but NOT called by position hooks)
- `src/app/hooks/useAudiobookPositionSync.ts` — Saves position via raw `db.books.update()` (line 70)
- `src/app/pages/BookReader.tsx:645` — Saves CFI position via raw `db.books.update()` (line 653)
- `src/app/hooks/useAudiobookshelfProgressSync.ts` — ABS bidirectional sync (direct, not via Supabase)
- `src/app/components/course/PdfContent.tsx:215` — PDF progress via `syncableWrite('progress', 'put', ...)`
- `src/stores/useContentProgressStore.ts:135` — Content progress via `syncableWrite('contentProgress', 'put', ...)`
- `src/data/types.ts:245` — `ContentProgress` type (missing `contentType`, `progressPct`)
- `src/data/types.ts:254` — `VideoProgress` type (field names don't match RPC)
- `src/data/types.ts:803` — `Book.currentPosition` field (ContentPosition type)

### Supabase Schema (verified via MCP)

**`books` table** — has `current_position jsonb`, `progress real`, `last_opened_at timestamptz`, `playback_speed double precision` — all columns exist and ready for sync

**`video_progress` table** — has `watched_seconds int`, `duration_seconds int`, `last_position int`, `watched_percent numeric`

**`content_progress` table** — has `content_id text`, `content_type text`, `status text`, `progress_pct int`

**RPC `upsert_video_progress`** — expects `p_user_id`, `p_video_id`, `p_watched_seconds`, `p_duration_seconds`, `p_updated_at`; uses `GREATEST()` for monotonic merge; `last_position = p_watched_seconds` (same value)

**RPC `upsert_content_progress`** — expects `p_user_id`, `p_content_id`, `p_content_type`, `p_status`, `p_progress_pct`, `p_updated_at`

### Key Findings

1. **The `books` table in Supabase already has `current_position` (JSONB)** — the column exists and the field mapper would auto-convert `currentPosition` → `current_position`. The only missing piece is using `syncableWrite` instead of raw Dexie updates.

2. **The `books` registry entry uses monotonic strategy with `monotonicFields: ['progress']`** — `progress` already syncs as a 0-100 integer. But `currentPosition` is not a monotonic field — it should use LWW (latest timestamp wins) since the user might go backwards.

3. **The sync engine's monotonic merge handles non-monotonic fields via LWW** — so adding `currentPosition` to the synced fields would automatically get LWW behavior, which is correct for position data.

4. **ABS hook writes to local Dexie via raw `db.books.update()`** — once we switch to `syncableWrite`, ABS progress will automatically flow to Supabase.

## Key Technical Decisions

- **Decision 1: Use `syncableWrite` for all position saves** — Instead of creating a parallel sync mechanism, route all position writes through the existing `syncableWrite` → `syncQueue` → Supabase pipeline. This is the path of least resistance since `books.current_position` already exists in Supabase.
  - Rationale: The book store already has `updateBookPosition()` that uses `syncableWrite`. We just need the hooks to call it instead of doing raw Dexie writes.

- **Decision 2: Add `fieldMap` entries for video/content progress instead of renaming Dexie fields** — The Dexie types (`currentTime`, `completionPercentage`, `itemId`) are used extensively throughout the UI code. Renaming would be a massive refactor. Instead, add `fieldMap` overrides to bridge the gap.
  - Rationale: `fieldMap` exists exactly for this purpose. The RPC path already extracts fields by name before calling the RPC.

- **Decision 3: Add missing fields to Dexie types rather than changing RPC signatures** — `ContentProgress` needs `contentType` and `progressPct`. `VideoProgress` needs to carry `watchedSeconds` alongside `currentTime`. We add them as supplementary fields that get populated alongside existing data.
  - Rationale: Changing Supabase RPC functions would require migrations and could break existing data. Adding fields to Dexie is additive and non-breaking.

- **Decision 4: Use LWW for position fields, monotonic only for progress percentage** — Position can go backwards (user seeks back), but progress percentage should only increase.
  - Rationale: Already the case — `books` table uses `monotonicFields: ['progress']`, and non-monotonic fields fall back to LWW. Just need to ensure `currentPosition` isn't accidentally added to monotonicFields.

## Open Questions

### Resolved During Planning

- **Q: Should ABS sync also go through Supabase?** Yes — the ABS hook already writes to Dexie. Once we switch to `syncableWrite`, ABS progress automatically flows to Supabase. The ABS hook continues to do its direct API call too (for ABS-native sync), but the position also goes through the Supabase pipeline for cross-device scenarios.
- **Q: What about the `last_position` column in `video_progress`?** The RPC sets `last_position = p_watched_seconds` (same value). We should pass `currentTime` as `watched_seconds` to populate both fields correctly.

### Deferred to Implementation

- **Exact debounce timing for position sync writes**: Current 5s interval for audio is fine. May want to increase to reduce sync queue pressure, but that's a tuning decision.
- **Whether to add a dedicated `upsert_book_position` RPC**: The `books` table currently falls through to the generic monotonic upsert path (no dedicated RPC). For a pure position update, a dedicated RPC could be more efficient, but the generic path works.

## Implementation Units

- [ ] **Unit 1: Route audiobook position saves through syncableWrite**

**Goal:** Audiobook position saves go through the sync engine so they reach Supabase

**Requirements:** R1, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/hooks/useAudiobookPositionSync.ts`
- Modify: `src/stores/useBookStore.ts` (if `updateBookPosition` needs adjustment)

**Approach:**
The hook currently calls `db.books.update()` (line 70). Switch to calling `useBookStore.getState().updateBookPosition()` which already uses `syncableWrite`. The `updateBookPosition` function (useBookStore.ts:347) does optimistic Zustand update + Dexie write + sync queue — exactly what we need.

One concern: `updateBookPosition` does an optimistic Zustand update (setting all books state) every 5 seconds. For the periodic save, we may want a lighter path that only does the Dexie+sync write without the Zustand round-trip, since the Zustand state is already up-to-date (the audio player store drives the position). Consider adding a `updateBookPositionQuiet()` method that skips the optimistic update.

Also update the ABS progress hook: when ABS position is newer and writes to local Dexie (line ~653 in BookReader or the ABS hook), ensure that write also goes through `syncableWrite` so it propagates to Supabase.

**Patterns to follow:**
- `src/stores/useBookStore.ts:347` — `updateBookPosition()` pattern

**Test scenarios:**
- Happy path: Play audiobook for 30s, verify syncQueue has an entry for the book with correct `currentPosition`
- Edge case: Pause and resume multiple times rapidly, verify coalescing works (only latest position)
- Integration: Play on device A, verify device B downloads and restores position from Supabase

**Verification:**
- Audiobook position appears in Supabase `books.current_position` column after playing
- Cross-device resume works within one sync cycle

---

- [ ] **Unit 2: Route ebook/EPUB position saves through syncableWrite**

**Goal:** EPUB CFI position saves go through the sync engine so they reach Supabase

**Requirements:** R2

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Modify: `src/app/pages/BookReader.tsx` (debounced save at ~line 645, flush at ~line 688)

**Approach:**
The `debouncedSavePosition` callback and `saveEpubPositionNow` both call raw `db.books.update()`. Switch to `useBookStore.getState().updateBookPosition()` or a lighter equivalent. Same pattern as Unit 1 — the CFI position `{ type: 'cfi', value: cfi }` and progress (0-100) should flow through syncableWrite.

The `handleLocationChanged` callback also updates the Zustand store directly. After switching to `updateBookPosition`, ensure we don't double-update Zustand state (once from the callback, once from the optimistic update in `updateBookPosition`).

**Patterns to follow:**
- Same as Unit 1: `updateBookPosition()` pattern

**Test scenarios:**
- Happy path: Navigate through EPUB, verify CFI position appears in Supabase `books.current_position`
- Edge case: Switch between books rapidly, verify each book's position is saved independently
- Integration: Read on device A, open same book on device B, verify CFI restoration

**Verification:**
- EPUB CFI position appears in Supabase after reading
- Cross-device CFI restoration works

---

- [ ] **Unit 3: Fix video progress field mapping**

**Goal:** Video progress uploads correctly map Dexie fields to Supabase RPC parameters

**Requirements:** R3

**Dependencies:** None (can be done in parallel with Units 1-2)

**Files:**
- Modify: `src/data/types.ts` — Add `watchedSeconds` and `durationSeconds` to `VideoProgress` type
- Modify: `src/lib/sync/tableRegistry.ts` — Add `fieldMap` for progress table
- Modify: `src/lib/sync/syncEngine.ts` — Update `video_progress` RPC `paramMap`
- Modify: `src/app/components/course/PdfContent.tsx` — Populate new fields
- Modify: `src/app/components/course/tabs/MaterialsTab.tsx` — Populate new fields
- Test: Any existing tests for video progress sync

**Approach:**
The core issue: Dexie `VideoProgress` has `currentTime` and `completionPercentage`, but the Supabase RPC `upsert_video_progress` expects `watched_seconds` and `duration_seconds`. The field mapper auto-converts `currentTime` → `current_time`, which is NOT in the RPC paramMap, so the data drops.

**Fix strategy:**
1. Add `watchedSeconds?: number` and `durationSeconds?: number` to the `VideoProgress` type. These are supplementary — `currentTime` remains the canonical position for local use.
2. Where `syncableWrite('progress', 'put', ...)` is called, populate `watchedSeconds = currentTime` (the RPC uses `watched_seconds` for both the monotonic counter and `last_position`).
3. Update the RPC `paramMap` in syncEngine.ts to also extract `current_time` → `p_watched_seconds` as a fallback, or rely on the new field.
4. The RPC already handles `ON CONFLICT ... watched_seconds = GREATEST(existing, new)` — correct monotonic behavior.

For the download direction: when fetching from Supabase `video_progress`, the field mapper converts `watched_seconds` → `watchedSeconds` and `last_position` → `lastPosition`. We need to ensure these map back to `currentTime` when restoring position. Add a download-time field mapping or store hook.

**Patterns to follow:**
- `src/lib/sync/tableRegistry.ts:125` — Existing fieldMap pattern (notes table has `deleted → soft_deleted`)
- `src/lib/sync/syncEngine.ts:182` — Existing RPC config

**Test scenarios:**
- Happy path: Watch video for 60s, verify `watched_seconds = 60` in Supabase `video_progress`
- Edge case: Resume video on fresh device, verify `currentTime` restored from `last_position`
- Integration: Watch video on device A, verify device B downloads and resumes at correct position
- Error path: RPC called with missing `watched_seconds` — verify graceful handling

**Verification:**
- `video_progress` table in Supabase has non-NULL `watched_seconds` after watching a video
- Cross-device video resume works

---

- [ ] **Unit 4: Fix content progress field mapping**

**Goal:** Content progress uploads correctly map Dexie fields to Supabase RPC parameters

**Requirements:** R4

**Dependencies:** None (can be done in parallel with Units 1-3)

**Files:**
- Modify: `src/data/types.ts` — Add `contentType` and `progressPct` to `ContentProgress` type
- Modify: `src/lib/sync/tableRegistry.ts` — Add `fieldMap` for `contentProgress` table
- Modify: `src/lib/sync/syncEngine.ts` — Update `content_progress` RPC `paramMap`
- Modify: `src/stores/useContentProgressStore.ts` — Populate new fields
- Test: Any existing tests for content progress sync

**Approach:**
The Dexie `ContentProgress` type has `courseId`, `itemId`, `status`, `updatedAt`. The RPC expects `content_id`, `content_type`, `status`, `progress_pct`. Missing fields: `contentType` (text), `progressPct` (integer).

**Fix strategy:**
1. Add `contentType?: string` and `progressPct?: number` to `ContentProgress` type.
2. Add `fieldMap` to registry: `{ itemId: 'content_id' }` — maps `itemId` → `content_id`.
3. Where `syncableWrite('contentProgress', 'put', ...)` is called, populate `contentType` (e.g., `'video'`, `'pdf'`, `'lesson'`) and `progressPct`.
4. Update the `paramMap` to include `content_type → p_content_type` and `progress_pct → p_progress_pct`.
5. The compound PK `[courseId, itemId]` needs to also work for the download direction — when Supabase returns `content_id`, it should map back to `itemId`.

For the download direction: the field mapper converts `content_id` → `contentId` (auto). We need this to map to `itemId` instead. Add reverse mapping in the registry's `fieldMap` or handle in the download merge logic.

**Patterns to follow:**
- Same pattern as Unit 3: field mapping + supplementary fields

**Test scenarios:**
- Happy path: Complete a lesson, verify row in Supabase `content_progress` with correct `content_id`, `content_type`, `progress_pct`
- Edge case: Mark lesson complete, verify `status = 'completed'` and `progress_pct = 100`
- Integration: Complete lesson on device A, verify device B reflects completion after sync

**Verification:**
- `content_progress` table has non-NULL `content_type` and meaningful `progress_pct` after completing lessons
- Cross-device course completion state syncs

---

- [ ] **Unit 5: Add position restoration on download/sync**

**Goal:** When a fresh device downloads synced data, positions are correctly restored for all content types

**Requirements:** R7

**Dependencies:** Units 1-4 (needs the data to be in Supabase first)

**Files:**
- Modify: `src/lib/sync/syncEngine.ts` — Download-phase position field handling
- Modify: `src/app/hooks/useAudiobookPositionSync.ts` — Check Supabase position on load
- Modify: `src/app/pages/BookReader.tsx` — Restore CFI from synced data
- Modify: `src/stores/useBookStore.ts` — Handle download merge for book positions

**Approach:**
The download phase already fetches from Supabase and merges into Dexie. For `books` with `current_position`, the merge uses monotonic strategy on `progress` and LWW on other fields. `currentPosition` would get LWW treatment automatically.

But there's a subtlety: when a downloaded book has `current_position` from Supabase, the Zustand store needs to reflect this so the UI (audio player, reader) can restore the position. The existing `_storeRefreshRegistry` mechanism should handle this — after downloading books, stores refresh their state from Dexie.

Verify the complete round-trip:
1. Device A saves position → syncableWrite → Supabase
2. Device B triggers download → Supabase → Dexie merge → store refresh
3. UI restores position from store

For video progress download: `watched_seconds` → `watchedSeconds` → needs to map to `currentTime` for UI restoration. For content progress download: `content_id` → needs to map to `itemId`.

**Test scenarios:**
- Integration: Full round-trip — save position on device A, sync to Supabase, download on device B, verify UI shows correct position
- Edge case: Conflicting positions (user reads on both devices offline) — verify LWW resolution picks the later one
- Edge case: Fresh install, sync all data from Supabase — verify all positions restored

**Verification:**
- End-to-end cross-device position restoration works for audiobooks, ebooks, and videos

---

- [ ] **Unit 6: Sync `lastOpenedAt` for "Continue Learning" ordering**

**Goal:** The "Continue Learning" feature shows the most recently accessed content across devices

**Requirements:** R6

**Dependencies:** Units 1-2 (needs books going through syncableWrite)

**Files:**
- Modify: `src/stores/useBookStore.ts` — Ensure `lastOpenedAt` is included in syncableWrite payload
- Verify: `src/app/components/figma/SearchCommandPalette.tsx` — "Continue Learning" ordering

**Approach:**
`lastOpenedAt` is already saved alongside position updates in `updateBookPosition()`. Since we're routing all position saves through that function (Units 1-2), `lastOpenedAt` will automatically be included in the syncableWrite payload. The Supabase `books` table already has `last_opened_at timestamptz`. Verify that the field mapper handles `lastOpenedAt` → `last_opened_at` correctly (should be automatic).

**Test scenarios:**
- Happy path: Open book A, then book B, verify `last_opened_at` reflects book B as more recent on Supabase
- Integration: Open book on device A, verify device B's "Continue Learning" shows it at the top

**Verification:**
- `books.last_opened_at` updates in Supabase after opening a book
- "Continue Learning" ordering is consistent across devices

## System-Wide Impact

- **Interaction graph:** `useAudiobookPositionSync` and `BookReader` will now write to the sync queue, increasing sync traffic. Position saves are debounced (5s audio, ~300ms ebook), so queue pressure is bounded.
- **Error propagation:** If syncableWrite fails (e.g., no auth), position is still saved locally (Dexie write succeeds). Sync queue will retry later.
- **State lifecycle risks:** Optimistic Zustand updates in `updateBookPosition` may cause brief flickers if the position changes rapidly. The existing debounce in the hooks should mitigate this.
- **Unchanged invariants:** ABS direct sync continues to work unchanged. The Supabase sync is an additional path, not a replacement.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Increased sync queue pressure from position updates | Debounce is already in place (5s audio). Monitor queue depth. |
| Field mapping bugs cause data corruption | Add fieldMap entries explicitly, test round-trip for each content type |
| Download direction field mismatch (Supabase → Dexie) | Verify reverse mapping for all fieldMap entries |
| Monotonic strategy incorrectly applied to position (which can decrease) | Only `progress` is in `monotonicFields`. `currentPosition` gets LWW by default. |
| ABS + Supabase double-write causes conflict | ABS writes locally via syncableWrite → Supabase. LWW resolution uses `updatedAt`. If ABS is newer, it wins. If Supabase is newer (from another device), it wins. Correct behavior. |

## Sources & References

- Supabase `books` schema (verified via MCP): `current_position jsonb`, `progress real`, `last_opened_at timestamptz`
- Supabase `video_progress` schema: `watched_seconds int`, `duration_seconds int`, `last_position int`
- Supabase `upsert_video_progress` RPC: uses `GREATEST()` for monotonic, LWW for `last_position`
- Supabase `upsert_content_progress` RPC: status ranking, `GREATEST()` for progress_pct
- `src/lib/sync/syncEngine.ts` — `_uploadBatch()` at line 497, `MONOTONIC_RPC` at line 165
- `src/lib/sync/tableRegistry.ts` — Book registry at priority 2, progress at priority 0
