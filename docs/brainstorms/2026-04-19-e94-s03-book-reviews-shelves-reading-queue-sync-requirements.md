# Requirements — E94-S03 Book Reviews, Shelves, and Reading Queue Sync

**Source story:** `docs/implementation-artifacts/stories/E94-S03-book-reviews-shelves-and-reading-queue-sync.md`
**Epic:** E94 (Supabase Data Sync — P2 library organization)
**Date:** 2026-04-19

## Problem / Goal

Knowlune users organize their personal library via star ratings (reviews), custom shelves (including system defaults like "Favorites", "Currently Reading", "Want to Read"), shelf memberships, and a reading queue. Today this state is Dexie-only. Organization invested on one device does not appear on any other device.

This story wires 4 library-organization tables through the existing sync engine so that reviews, shelves, `book_shelves` memberships, and `reading_queue` positions round-trip through Supabase. It must preserve the no-duplicate-defaults property when a user signs in on a new device that already has local default shelves seeded.

## Scope (in)

1. Supabase migration `20260413000004_p2_book_organization.sql` creating 4 tables (`book_reviews`, `shelves`, `book_shelves`, `reading_queue`) with RLS, `moddatetime` triggers, download-cursor `(user_id, updated_at)` indexes, and a DEFERRABLE UNIQUE constraint on `reading_queue (user_id, position)`.
2. Rollback script.
3. `tableRegistry.ts` update — add `fieldMap: { sortOrder: 'position' }` to the existing `readingQueue` entry.
4. Route all Dexie writes in `useBookReviewStore`, `useShelfStore`, `useReadingQueueStore` through `syncableWrite`, converting partial updates to fetch-then-put.
5. New helper `src/lib/sync/defaultShelfDedup.ts` with `dedupDefaultShelves(incoming, existingLocal)` → `{ toInsert, toSkip, mergedIdMap }`.
6. Wire dedup into the download-apply path for `shelves`, persist `mergedIdMap` in `syncMetadata` keyed by user, then remap `book_shelves.shelf_id` on download for any mapped ids.
7. Register 4 store-refresh callbacks in `useSyncLifecycle.ts`.
8. Unit tests at `src/lib/sync/__tests__/p2-book-organization-sync.test.ts` covering all wiring, fieldMap translation, dedup pure-function behaviour, and unauthenticated no-queue contract.

## Out of scope

- UI changes (existing UI already reads from Dexie stores).
- E2E multi-device Playwright spec (optional — unit coverage of `dedupDefaultShelves` + the new-device scenario is sufficient per AC12; defer to epic closeout or manual QA).
- Hard FK constraints across `book_id` references — logical only (consistent with other E94 tables).
- Changes to `syncableWrite`'s public API.
- Renaming Dexie `sortOrder` field to `position` (would require a v53+ Dexie migration; fieldMap translation is cheaper).

## Acceptance criteria (summary)

AC1–AC3: Migration (tables + RLS + moddatetime + indexes + DEFERRABLE UNIQUE).
AC4–AC5, AC12: Default-shelf dedup helper + book_shelves remap + new-device integration scenario.
AC6–AC8: Store wiring through `syncableWrite` (reviews, shelves + bookShelves, readingQueue with fetch-then-put for reorder).
AC9: `sortOrder → position` fieldMap.
AC10: Store-refresh callbacks for all 4 tables.
AC11: Authenticated writes produce `syncQueue` entries; unauthenticated skip the queue.
AC13: Unit test coverage across all ACs.

Full ACs are inlined in the source story — this brief is a compacted CE-format summary.

## Risks / hazards

- **R1 — Download apply ordering:** `shelves` must be applied before `book_shelves` so the `mergedIdMap` exists when remapping runs. Mitigation: confirm `tableRegistry.ts` ordering, add a debug log if the map is empty when `book_shelves` runs.
- **R2 — Dedup persistence:** storing `mergedIdMap` per-user in `syncMetadata` requires merging on every download so that subsequent syncs continue to remap. Risk of losing mappings on queue-only sync paths.
- **R3 — Partial-update conversion correctness:** fetch-then-put changes timing. An intervening write between the fetch and put could lose data. Mitigation: sequential awaits within each method; rely on the same pattern already shipped in E93-S02.
- **R4 — DEFERRABLE constraint:** requires explicit transaction wrapping during reorder on the server side. `moddatetime` trigger fires per row — verify no trigger-order issues with deferred uniqueness.
- **R5 — Migration ordering dependency:** E94-S01 (P2 library migration `20260413000003`) must ship first. Mitigation: verify E94-S01 status before applying to shared envs.
- **R6 — Name-matching dedup false positives/negatives:** dedup only triggers on `is_default: true` same-name shelves. Users creating a custom shelf named "Favorites" are preserved (non-default branch).

## Key precedents

- E93-S02 (notes + bookmarks wiring) — same pattern for store wiring.
- E92-S09 P0 wiring — `syncableWrite` contract.
- E94-S01 P2 library migration — SQL migration template.

## Files to touch

**New:**
- `supabase/migrations/20260413000004_p2_book_organization.sql`
- `supabase/migrations/rollback/20260413000004_p2_book_organization_rollback.sql`
- `src/lib/sync/defaultShelfDedup.ts`
- `src/lib/sync/__tests__/p2-book-organization-sync.test.ts`

**Modified:**
- `src/lib/sync/tableRegistry.ts` (fieldMap on `readingQueue`)
- `src/stores/useBookReviewStore.ts` (3 write sites)
- `src/stores/useShelfStore.ts` (6 write sites)
- `src/stores/useReadingQueueStore.ts` (3 write sites)
- `src/app/hooks/useSyncLifecycle.ts` (4 `registerStoreRefresh` calls)
- Download-apply path (exact file TBD by plan — likely `src/lib/sync/downloadApply.ts` or the equivalent pull handler) for shelf dedup + book_shelves remap

## Test strategy

1. Unit tests (primary) — 6 groups covering all wiring + dedup + unauth + fieldMap.
2. Migration smoke via `supabase db push` locally + `information_schema` verification.
3. Regression: existing `useBookReviewStore.test.ts`, `useShelfStore.test.ts`, `useReadingQueueStore.test.ts`, `useSyncLifecycle.test.ts` stay green.
