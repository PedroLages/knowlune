---
title: "fix: ABS Sync + Library QA Fixes (9-issue bundle)"
type: fix
status: active
date: 2026-04-24
origin: docs/brainstorms/2026-04-24-abs-sync-qa-fixes-requirements.md
---

# fix: ABS Sync + Library QA Fixes (9-issue bundle)

## Overview

Nine defects discovered during QA of `/library` against the live ABS server are bundled here because they share the same surface area (Library page, ABS sync hook, Dexie schema, Supabase sync engine). Fixes range from blockers (silent auth-failed sync, missing Dexie stores) through medium (filter count drift, format tabs disappearing in series/collections views, storage footer globalism) to low (sync tooltip, empty-queue banner height). No layout redesign; no architecture replacement.

## Problem Frame

QA of `/library` against `Home ABS (http://192.168.2.200:13378)` surfaced:
- **Silent sync failure**: an `auth-failed` server still shows green "Synced" dot; clicking sync mutates `updatedAt` without making any API call.
- **Missing Dexie stores**: `series` and `collections` object stores have never been added; the two tabs are empty forever.
- **Supabase 429 storm**: `_doDownload()` iterates `tableRegistry` with no concurrency cap — 26+ parallel requests hit self-hosted Supabase on every page load; `review_records` table is also missing from migrations, producing a 404.
- **Filter drift**: reading-status pill counts and the StorageIndicator `bookCount` are sourced from the global book set, not the active source filter.
- **Format tabs disappear** when ABS Series or Collections tab is active.
- **Sync button tooltip** is missing.
- **Empty reading-queue banner** reserves hero height (~100 px) when there is nothing to show.

(see origin: docs/brainstorms/2026-04-24-abs-sync-qa-fixes-requirements.md)

## Requirements Trace

- R1. Auth-failed badge renders destructive; clicking sync opens ABS settings dialog + shows toast; no API call made; `updatedAt` unchanged.
- R2. Dexie v60 adds `absSeries` and `absCollections` stores; ABS sync fetches and persists both; tabs render real data scoped to active source filter.
- R3. `_doDownload()` caps concurrent Supabase downloads at 4 (configurable); 429 retried with exponential backoff; `review_records` migration added.
- R4. Reading-status pill counts derived from source-filtered book set.
- R5. Format filter tabs visible and functional when Series or Collections ABS tab is active.
- R6. `StorageIndicator` `bookCount` prop sourced from filtered book count when a source filter is active; global total shown as secondary.
- R7. Sync button wrapped in Radix `Tooltip` showing last-synced time or auth-failed label.
- R8. Empty reading-queue banner compressed to ≤ 40 px with single-line muted text.

## Scope Boundaries

- No Library page layout redesign.
- No multi-server ABS UX.
- No non-ABS provider reauth flows.
- No replacement of Supabase sync engine architecture — throttle only.
- Series and Collections are **not** mirrored to Supabase in this batch (local Zustand + Dexie only).

### Deferred to Separate Tasks

- Supabase mirror for `absSeries` / `absCollections`: future epic, after Dexie stores are proven stable.
- Series/Collections detail-view pages: future enhancement; cards link into filtered books grid for now.

## Context & Research

### Relevant Code and Patterns

- `src/db/schema.ts` — current Dexie schema; last version is `v59` (no-op stores call). New series/collections stores go in `v60`.
- `src/db/checkpoint.ts` — `CHECKPOINT_VERSION = 58`; v59 and v60 are added as incremental migrations in `schema.ts` per the checkpoint pattern.
- `src/lib/sync/syncEngine.ts` — `_doDownload()` at line 782 iterates `tableRegistry` with a sequential `for` loop but `await query` means any future parallelization must be added explicitly. Currently no concurrency cap exists at all in the download path.
- `src/stores/useAudiobookshelfStore.ts` — `loadSeries` / `loadCollections` already call the ABS proxy and store results in Zustand; no Dexie persistence yet.
- `src/app/pages/Library.tsx` — `handleManualSync` at line 250 calls `syncCatalog(server)` for all servers regardless of `auth-failed`; `absSettingsOpen` state is already present at line 88; `books.length` (global) passed to `StorageIndicator`.
- `src/app/components/library/LibraryFilters.tsx` — `getBookCountByStatus()` from `useBookStore` already respects `source` filter internally; the mismatch is that `LibraryFilters` uses `books` from store (unfiltered) as its memo dep, but the count function itself is correct.
- `src/app/components/library/StorageIndicator.tsx` — accepts `bookCount: number` prop; caller passes `books.length` (global).
- `src/app/components/library/BookCard.tsx` — on `onError` hides the img element (`e.currentTarget.style.display = 'none'`) but does not substitute a fallback component; when `resolvedCoverUrl` is nullish a `<div>` with `<Headphones>` icon renders, but onerror on a valid-URL-but-404-response does not trigger the null branch.
- `src/app/components/library/ReadingQueueView.tsx` — empty state is `py-16` (64 px) with a `w-16 h-16` icon circle.
- `src/app/hooks/useAudiobookshelfSync.ts` — `syncCatalog` already handles `auth-failed` detection and toast; the gap is that `handleManualSync` in Library.tsx does not guard against calling `syncCatalog` when `status === 'auth-failed'`.
- `supabase/migrations/` — `review_records` table is declared in `tableRegistry.ts` and `schema.ts` but has no migration SQL file.

### Institutional Learnings

- From `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`: Supabase download errors are currently swallowed with `continue`; 429 is an error but the current code does not distinguish it from other errors.
- From `project_abs_cors_proxy` memory: all ABS API calls MUST go through the Express proxy — never direct from browser.
- Dexie migration safety: new stores are always added as additive `.version(N).stores({newStore: 'indexes'})` with no upgrade callback needed when existing tables are unchanged.

### External References

- Not needed — local patterns are sufficient for all 9 fixes.

## Key Technical Decisions

- **Throttle implementation for `_doDownload()`**: use a simple in-module async semaphore (`MAX_CONCURRENT_DOWNLOADS = 4`) rather than pulling in a `p-limit` dependency. The download path is already sequential today; the semaphore converts it to bounded parallel without restructuring the loop.
- **Backoff on 429**: check `error.code` or `error.status` on the Supabase error object for `429`; implement 3-attempt retry per table with delays 250 ms → 500 ms → 1000 ms before logging and continuing.
- **Series/Collections Dexie stores**: add `absSeries` and `absCollections` in `v60`. Type shapes mirror `AbsSeries` and `AbsCollection` from `src/data/types.ts`. Zustand store updated to persist to Dexie after fetch.
- **Auth-failed guard in `handleManualSync`**: check each server's `status` before calling `syncCatalog`; for `auth-failed` servers emit a toast and open `absSettingsOpen` instead. No API call.
- **Cover fallback**: extract a shared `<BookCoverImage>` component that renders the existing Headphones placeholder on both null URL *and* `onError`, replacing the two-branch ad-hoc logic in `BookCard`.
- **Format tabs in Series/Collections**: the `<LibraryFilters />` component is already rendered unconditionally when `books.length > 0`; the format tabs inside it are gated by state in `LibraryFilters`. The fix is to ensure format filter pills are rendered (or at minimum not hidden) when `absViewMode === 'series' | 'collections'` — option (a) from requirements.
- **StorageIndicator source scoping**: pass `filteredBooks.length` as `bookCount` when a source filter is active; pass `books.length` as `totalBookCount` for secondary display.
- **`review_records` migration**: add a new SQL migration file following the naming convention of existing migrations (e.g. `20260424000001_review_records.sql`).
- **Retry/backoff curve**: 250 ms → 500 ms → 1000 ms (3 attempts) as specified in requirements. Matches the existing upload engine's backoff philosophy.

## Open Questions

### Resolved During Planning

- **Card composition for Series/Collections**: Use existing `SeriesCard` and `CollectionCard` components (already in `src/app/components/library/`). They are currently driven by Zustand in-memory data; update them to also hydrate from Dexie on mount.
- **Series/Collections Dexie key**: use `id` (ABS-assigned string UUID) as primary key; index on `serverId` and `libraryId` for source-filter scoping.
- **`review_records` migration reverse-compatibility**: additive table — safe for already-deployed clients. No column drops or renames.
- **Migration folder vs ad-hoc**: standard Supabase migrations folder (`supabase/migrations/`) strongly preferred; use that.
- **`getBookCountByStatus` drift root cause**: confirmed the function already respects source filter; the real drift is in `LibraryFilters` using a stale `books` memo dep. Fix: ensure `books` dep updates reactively after source filter change. Minor — the counts are already correct if the memo fires.

### Deferred to Implementation

- Exact Supabase error shape for 429 — implementer should `console.log` a real 429 response to confirm whether it lands in `error.status` or a nested field before writing the guard.
- Whether `AudiobookshelfSettings` dialog supports a "focus on server" prop — implementer confirms existing API and extends if needed.

## Implementation Units

- [ ] **Unit 1: Dexie v60 — `absSeries` and `absCollections` stores**

**Goal:** Add two new Dexie object stores so Series and Collections data can be persisted locally and survive page refreshes.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/checkpoint.ts` (update CHECKPOINT_SCHEMA comment to note v59/v60 are beyond the checkpoint)
- Modify: `src/db/index.ts` (or wherever `db.absSeries` / `db.absCollections` table properties are declared)
- Test: `src/db/__tests__/schema.test.ts`

**Approach:**
- Add `database.version(60).stores({ absSeries: 'id, serverId, libraryId, name', absCollections: 'id, serverId, name' })` after the existing `v59` call. No upgrade callback needed (additive).
- Declare `absSeries: EntityTable<AbsSeries, 'id'>` and `absCollections: EntityTable<AbsCollection, 'id'>` on the `ElearningDB` class.
- `CHECKPOINT_VERSION` stays at 58; v59 and v60 remain incremental (fresh installs > v58 still run both).

**Patterns to follow:**
- `database.version(59).stores({})` immediately above — same additive pattern.
- Existing `EntityTable` declarations in `src/db/schema.ts` lines ~100-150.

**Test scenarios:**
- Happy path: migrate a fake IDB at v59 to v60 — `absSeries` and `absCollections` stores exist; `books` count is unchanged.
- Edge case: migrate from v58 (skip v59 no-op) — both new stores still created.
- Happy path: `db.absSeries.add(...)` and `db.absCollections.add(...)` succeed with correct shape.

**Verification:**
- Schema test passes; `db.absSeries` and `db.absCollections` accessible in browser DevTools IDB panel after migration.

---

- [ ] **Unit 2: ABS sync — persist Series and Collections to Dexie after fetch**

**Goal:** After a successful ABS catalog sync, persist fetched series and collections to Dexie so they survive page refreshes and are available without a network roundtrip.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `src/stores/useAudiobookshelfStore.ts`
- Modify: `src/app/hooks/useAudiobookshelfSync.ts` (optional — if sync hook calls store functions directly)
- Test: `src/stores/__tests__/useAudiobookshelfStore-sync.test.ts`

**Approach:**
- In `loadSeries`: after receiving results from the ABS proxy, call `db.absSeries.bulkPut(allSeries)` (keyed on `id`) in addition to updating Zustand state.
- In `loadCollections`: after receiving results, call `db.absCollections.bulkPut(collections)` similarly.
- On store init (or lazy-load): hydrate Zustand `series` / `collections` from Dexie using `db.absSeries.where('serverId').equals(serverId).toArray()` so the tabs render from cache on first mount before the network fetch completes.
- Source-filter scoping: `SeriesCard` and `CollectionCard` already receive their data from Zustand; the store's load functions already accept `serverId` + `libraryId`; no changes needed to card components.

**Patterns to follow:**
- `bulkUpsertAbsBooks` in `useAudiobookshelfSync.ts` — same pattern for books.
- Dexie `bulkPut` usage in other stores.

**Test scenarios:**
- Happy path: `loadSeries` with mock proxy response → Dexie `absSeries` contains expected records, Zustand `series` updated.
- Happy path: `loadCollections` → Dexie `absCollections` populated.
- Edge case: call `loadSeries` twice — second call does not duplicate records (bulkPut semantics).
- Happy path: store hydration on init — series pre-populated from Dexie before API fetch completes.

**Verification:**
- Series tab renders pre-cached data on cold page reload without waiting for network; Collections tab same.

---

- [ ] **Unit 3: Auth-failed sync guard — no-op click + toast + open settings dialog**

**Goal:** Prevent `handleManualSync` from calling `syncCatalog` for any server with `status === 'auth-failed'`; instead emit a destructive toast and open the ABS settings dialog.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Library.tsx`
- Test: `src/app/pages/__tests__/Library.auth-failed.test.tsx` (new)

**Approach:**
- In `handleManualSync`, before calling `syncCatalog(server)`, check `server.status === 'auth-failed'`. If true: call `toast.error(...)` with "ABS authentication expired — reconnect to sync", call `setAbsSettingsOpen(true)`, and skip `syncCatalog`. Do not mutate `syncedServerIds`.
- The `AudiobookshelfSettings` component already has `open` / `onOpenChange` props; no dialog API changes needed.
- `updatedAt` is only mutated inside `syncCatalog` — by never calling it, the no-op is guaranteed.

**Patterns to follow:**
- Existing `toast.error(...)` calls in `useAudiobookshelfSync.ts` lines ~159-163.
- The existing `setAbsSettingsOpen(true)` call at line 219 and 506 in `Library.tsx`.

**Test scenarios:**
- Happy path: server status `connected` → `syncCatalog` is called normally.
- Error path: server status `auth-failed` → `syncCatalog` not called, toast fired with destructive message, `absSettingsOpen` set to `true`, `server.updatedAt` unchanged.
- Edge case: mixed servers (one connected, one auth-failed) → connected server syncs, auth-failed server triggers toast + dialog, no double-open.
- Unit: `updatedAt` field of the auth-failed server record is unchanged after no-op click.

**Verification:**
- E2E: with seeded `auth-failed` server, clicking sync button shows toast text "ABS authentication expired" and opens ABS settings dialog; no XHR to ABS proxy.

---

- [ ] **Unit 4: Cover fallback component**

**Goal:** Replace the ad-hoc `onError → display:none` pattern in `BookCard` with a reusable component that renders a muted tile + initial letter fallback whenever the cover URL is missing or the img fires onerror.

**Requirements:** R (H1 from origin)

**Dependencies:** None

**Files:**
- Create: `src/app/components/library/BookCoverImage.tsx`
- Modify: `src/app/components/library/BookCard.tsx`
- Modify: `src/app/components/library/BookListItem.tsx` (if it also has raw `<img>` cover logic)
- Test: `src/app/components/library/__tests__/BookCoverImage.test.tsx` (new)

**Approach:**
- `<BookCoverImage src={url} title={title} className={...} />` — renders `<img>` when `src` is truthy; on `onError` transitions to the fallback div (letter initial or book glyph). Uses React state to track error.
- Fallback: muted background (`bg-muted`), centered first letter of title in `text-brand-soft-foreground` font-semibold, `aria-label="{title} — cover unavailable"`. No hardcoded colors.
- When `src` is nullish: render fallback immediately (no img element created).
- Replace both `BookCard` cover branches (null URL branch + onError branch) with `<BookCoverImage>`.

**Patterns to follow:**
- Existing null-URL fallback in `BookCard` lines 102-106 — same token usage.
- `BookStatusBadge` for token-only styling convention.

**Test scenarios:**
- Happy path: `src` provided and loads → img visible, fallback hidden.
- Error path: `src` provided but `onError` fires → img hidden, fallback div visible with correct aria-label.
- Edge case: `src` is undefined → fallback renders immediately, no img element in DOM.
- Edge case: title is empty string → renders book glyph icon instead of blank initial.
- Integration: `BookCard` with a known-404 cover URL → `BookCoverImage` shows fallback (not an empty hole).

**Verification:**
- Unit tests pass; E2E shows fallback tile for `1aeba91e-8299-4805-b3d6-8637bbb35207` item (or any seeded 404-cover book).

---

- [ ] **Unit 5: Supabase sync engine — download throttle + 429 backoff**

**Goal:** Cap `_doDownload()` at 4 concurrent table fetches and retry 429 responses with exponential backoff before surfacing failure.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/syncEngine.ts`
- Test: `src/lib/sync/__tests__/syncEngine.download.test.ts`

**Approach:**
- Add a module-level constant `MAX_CONCURRENT_DOWNLOADS = 4`.
- Implement an async semaphore inline (counter + queue of resolve callbacks) — no new dependency. Each table download acquires a slot, runs, releases.
- Wrap the Supabase `query` call in a `downloadWithRetry(fn, maxAttempts=3, baseDelayMs=250)` helper that: on error checks for 429 status, waits `baseDelayMs * 2^attempt`, retries up to `maxAttempts`; after exhaustion logs and continues to next table. Non-429 errors continue immediately (existing behavior).
- 429 toast deduplication: track a `Set<string>` of tables that have already toasted per sync session; only toast once per table per session after exhausted retries.

**Technical design:** *(directional only)*
```
// Semaphore sketch (not implementation code)
pending = 0
waiters = []
acquire() → if pending < MAX → increment and resolve immediately
           else → enqueue a Promise resolve
release() → decrement → if waiters.length > 0 → dequeue and call next resolve
```

**Patterns to follow:**
- Existing `navigator.locks` fallback in syncEngine (lines ~116+) for concurrency guard pattern.
- Upload engine retry logic for backoff shape reference.

**Test scenarios:**
- Happy path: 8 tables → at most 4 in-flight concurrently at any point in time.
- Error path: table returns 429 → retried up to 3 times with increasing delays; final failure does not crash loop.
- Error path: table returns 429 after 3 retries → toast fires once (not 3 times).
- Edge path: table returns non-429 error → continues immediately, no retry delay.
- Happy path: table returns 429 on attempt 1, succeeds on attempt 2 → no toast, data applied.
- Integration: `MAX_CONCURRENT_DOWNLOADS` constant is exported so tests can import and assert against it.

**Verification:**
- Unit tests pass. Manual check: cold `/library` load against prod Supabase shows ≤ 4 concurrent Supabase network requests at any instant in DevTools network panel; no 429 in network log on a healthy server.

---

- [ ] **Unit 6: Supabase migration — `review_records` table**

**Goal:** Ship the missing `review_records` table migration so the sync engine download no longer receives a 404.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260424000002_review_records.sql`

**Approach:**
- Cross-reference `src/lib/sync/tableRegistry.ts` entry for `review_records` and the `ReviewRecord` TypeScript type in `src/data/types.ts` to derive the exact columns.
- Follow the column naming convention of other library migrations (snake_case, `user_id`, `updated_at`, RLS enabled).
- Add RLS policy matching the pattern in `supabase/migrations/20260413000003_p2_library.sql`.
- The migration is purely additive — no existing data affected.

**Patterns to follow:**
- `supabase/migrations/20260413000003_p2_library.sql` for column naming, RLS, and index style.

**Test scenarios:**
- Test expectation: none — SQL migration is verified by manual `supabase db push` and confirming zero 404 for `review_records` in network panel.

**Verification:**
- `supabase migrations list` shows the new migration applied; `/library` cold load shows no 404 for `review_records`.

---

- [ ] **Unit 7: Reading-status pill count + StorageIndicator source scoping**

**Goal:** Ensure reading-status pill counts and the StorageIndicator footer reflect the active source filter rather than the global book set.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/LibraryFilters.tsx`
- Modify: `src/app/pages/Library.tsx` (StorageIndicator `bookCount` prop)
- Modify: `src/app/components/library/StorageIndicator.tsx` (add optional `totalBookCount` prop)
- Test: `src/app/components/library/__tests__/StorageIndicator.test.ts`
- Test: `src/app/components/library/__tests__/LibraryFilters.test.tsx` (add/extend)

**Approach:**
- **Pill counts**: `getBookCountByStatus()` in `useBookStore` already respects source filter (confirmed during research). The drift is a stale memo dep in `LibraryFilters`. Fix: change the `useMemo` dep from `[books, getBookCountByStatus]` to `[books, filters.source, getBookCountByStatus]` so counts recompute when source filter changes.
- **StorageIndicator**: add optional `totalBookCount?: number` prop. When present and different from `bookCount`, render secondary text "({totalBookCount} total across all sources)". In `Library.tsx`, pass `bookCount={filteredBooks.length}` and `totalBookCount={books.length}` when a source filter is active (`filters.source !== undefined`).

**Patterns to follow:**
- Existing `bookCount` usage in `StorageIndicator`.
- `useMemo` dep array pattern elsewhere in `LibraryFilters`.

**Test scenarios:**
- Happy path: source filter = `audiobookshelf` (235 books) → pill "All" shows 235, not 239.
- Happy path: source filter cleared → pill "All" shows global total.
- Happy path: `StorageIndicator` with `bookCount=235, totalBookCount=239` → renders "235 books" + secondary "239 total".
- Happy path: `StorageIndicator` with only `bookCount=239` (no source filter) → no secondary text.

**Verification:**
- E2E: toggling source filter changes pill "All" count and footer book count.

---

- [ ] **Unit 8: Format filter visibility in Series/Collections ABS view**

**Goal:** Keep format filter tabs visible and functional when the ABS Series or Collections tab is active, so users do not experience silent filter disappearance.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/library/LibraryFilters.tsx`
- Test: `src/app/components/library/__tests__/LibraryFilters.test.tsx`

**Approach:**
- Investigate why format tabs hide in Series/Collections mode. Likely a conditional render based on `absViewMode` or `activeFormatTab` state. Remove that condition so format tabs are always shown when `books.length > 0` and source is `audiobookshelf`.
- Format tab selection while in Series/Collections mode should filter `absSeries` / `absCollections` by format where feasible, or at minimum stay visible without crashing. If filtering series/collections by format is non-trivial, leave tab visible but as a no-op with a `// TODO` comment for the follow-up.

**Patterns to follow:**
- `LibraryFilters` existing render logic for status pill visibility.

**Test scenarios:**
- Happy path: `absViewMode === 'series'` → format tab control is present in DOM.
- Happy path: `absViewMode === 'collections'` → format tab control is present in DOM.
- Happy path: `absViewMode === 'books'` → format tab control present (regression guard).

**Verification:**
- E2E: switching to Series tab does not remove the format tab control from the DOM.

---

- [ ] **Unit 9: Sync button tooltip + empty reading-queue banner compression**

**Goal:** Add a `Tooltip` to the sync button showing last-synced time or auth-failed label; compress the empty reading-queue banner to ≤ 40 px.

**Requirements:** R7, R8

**Dependencies:** Unit 3 (auth-failed state is established by Unit 3; tooltip uses the same state)

**Files:**
- Modify: `src/app/pages/Library.tsx` (wrap sync button in Tooltip)
- Modify: `src/app/components/library/ReadingQueueView.tsx` (compact empty state)
- Test: `src/app/pages/__tests__/Library.sync-tooltip.test.tsx` (new or extend Library test)
- Test: `src/app/components/library/__tests__/ReadingQueueView.test.tsx` (new or extend)

**Approach:**
- **Sync tooltip**: import shadcn/ui `Tooltip`, `TooltipContent`, `TooltipTrigger`, `TooltipProvider` from `@/app/components/ui/tooltip`. Wrap the existing sync `<Button>` in `<TooltipTrigger asChild>`. `TooltipContent` text:
  - `auth-failed`: "Auth failed — click to reconnect"
  - `connected` with `lastSyncedAt`: "Last synced {relative time}" — use `formatDistanceToNow` from `date-fns` (already a project dependency via the Date Picker component).
  - No `lastSyncedAt`: "Never synced"
- Remove or repurpose the existing `title` attribute on the Button (tooltip supersedes it for sighted users; keep `aria-label` for screen readers).
- **Empty queue banner**: Replace `py-16` + icon circle with a single-line compact variant: `flex items-center gap-2 h-10 px-3 text-sm text-muted-foreground` with a small `BookOpen` icon and "Queue is empty — right-click a book to add". No hero icon circle. Height ≤ 40 px.

**Patterns to follow:**
- Tooltip usage: `src/app/components/ui/tooltip.tsx` + any existing tooltip usage in the codebase (e.g. Settings page).
- `text-muted-foreground` token for compact empty states.

**Test scenarios:**
- Happy path: sync button hovered → tooltip renders with "Last synced X minutes ago" text.
- Error path: sync button hovered with `auth-failed` server → tooltip renders "Auth failed — click to reconnect".
- Happy path: no `lastSyncedAt` → tooltip renders "Never synced".
- Happy path: empty queue → container element height ≤ 40 px (computed style or bounding rect).
- Happy path: non-empty queue → original queue list renders (regression guard).

**Verification:**
- E2E hover assertion shows tooltip text matching server state. E2E: empty queue banner bounding height ≤ 40 px.

---

## System-Wide Impact

- **Interaction graph:** `handleManualSync` change affects all ABS servers; the auth-failed guard touches `toast` and `absSettingsOpen` state. Sync engine throttle affects all 26+ tables in `tableRegistry` — no table-specific logic changed, only concurrency shape.
- **Error propagation:** 429 errors are now retried silently; only exhausted retries surface a deduplicated toast per table per session. Non-429 errors continue existing `console.error` + `continue` behavior.
- **State lifecycle risks:** Dexie `bulkPut` for series/collections is idempotent (upsert by `id`); no duplication risk. The Zustand TTL cache (`seriesLoadedAt`, `collectionsLoadedAt`) continues to gate refetches — Dexie hydration happens on mount independently of the TTL.
- **API surface parity:** `StorageIndicator` gains an optional `totalBookCount` prop — additive, no breaking change. `BookCoverImage` is a new internal component; `BookCard` and `BookListItem` are modified callers.
- **Integration coverage:** The auth-failed guard must be tested with an actual Zustand `absServers` store state (seeded) rather than just unit-testing the guard condition in isolation.
- **Unchanged invariants:** Existing book sync flow (`syncCatalog` → `bulkUpsertAbsBooks`), upload engine, Supabase auth, OPDS catalogs, and all non-ABS library functionality are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Dexie v60 migration fails silently for users already at v59 | Test migration from both v58 and v59 in schema tests |
| Supabase 429 error shape differs from assumed | Implementer logs real 429 before writing guard; fall back to string match on `error.message` if needed |
| `AudiobookshelfSettings` dialog does not support "focus on server" prop | Unit 3 opens dialog generically (existing `setAbsSettingsOpen(true)` pattern); focusing a specific server is deferred |
| `review_records` SQL schema drifts from TypeScript type | Cross-reference `ReviewRecord` type and `tableRegistry` entry before writing SQL |
| Format filter "keep visible in series view" causes visual collision | If format tabs collide with series tab bar layout, apply CSS isolation rather than removing tabs |
| `formatDistanceToNow` from `date-fns` not imported | Confirm date-fns is already a dep (it is, via DatePicker); import from correct entry point |

## Documentation / Operational Notes

- After implementing Unit 6, run `supabase db push` against the self-hosted Supabase on Unraid titan to apply the `review_records` migration.
- The `MAX_CONCURRENT_DOWNLOADS = 4` constant in `syncEngine.ts` should be documented in the module-level JSDoc so future contributors know it exists.
- After Units 1-2, verify Series and Collections tabs in the browser against the live ABS server before writing E2E fixtures.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-24-abs-sync-qa-fixes-requirements.md](docs/brainstorms/2026-04-24-abs-sync-qa-fixes-requirements.md)
- Related code: `src/db/schema.ts`, `src/lib/sync/syncEngine.ts`, `src/app/pages/Library.tsx`, `src/stores/useAudiobookshelfStore.ts`
- Related solutions: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`
- Related migrations: `supabase/migrations/20260413000003_p2_library.sql`
