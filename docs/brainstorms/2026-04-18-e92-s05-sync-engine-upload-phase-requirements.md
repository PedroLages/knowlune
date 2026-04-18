# CE Requirements — E92-S05: Sync Engine Upload Phase

**Origin:** BMAD story file `docs/implementation-artifacts/92-5-sync-engine-upload-phase.md`
**Date:** 2026-04-18
**Epic:** E92 — Sync Foundation

---

## What We're Building

Implement the real upload phase inside `src/lib/sync/syncEngine.ts`, replacing the S04 no-op stub with a working queue-drain loop. The engine reads `syncQueue` from Dexie, coalesces duplicate entries for the same record, batches records to Supabase in groups of 100, handles per-table conflict strategies (LWW upsert / monotonic RPC / insert-only insert), retries 5xx failures with exponential backoff (1s/2s/4s/8s/16s), dead-letters permanent failures after 5 attempts, and serializes concurrent uploads using `navigator.locks`. `nudge()` becomes a real 200ms debounced trigger.

---

## Context & Constraints

- **Files to change:** `src/lib/sync/syncEngine.ts` (replace stub), `src/lib/sync/__tests__/syncEngine.test.ts` (new)
- **Files NOT to change:** `syncableWrite.ts`, `tableRegistry.ts`, `fieldMapper.ts`, `backfill.ts` — these are complete from S01–S04
- **Public API must not change:** `syncEngine.nudge()` and `syncEngine.isRunning` signatures must remain identical — `syncableWrite.ts` already calls them
- **Supabase client:** `import { supabase } from '@/lib/auth/supabase'` — may be null when env vars missing; always null-guard
- **Dexie syncQueue:** accessed via `db.syncQueue` (WhereClause, bulkDelete, update). Import `db` from `@/db`
- **tableRegistry:** `getTableEntry(dexieTable)` exported from `./tableRegistry` — use for strategy routing
- **Monotonic RPC map (P0 only):** `content_progress → upsert_content_progress`, `video_progress → upsert_video_progress`. Other monotonic tables (challenges, vocabularyItems, books) fall back to generic upsert with a warning log

---

## Acceptance Criteria (must all be true for story to ship)

1. Queue entries uploaded to Supabase are deleted from `syncQueue` on success
2. Coalescing: for each `(tableName, recordId)` pair, only the latest entry by `createdAt` is uploaded; superseded entries deleted before upload
3. Batch size 100: 250 records → exactly 3 Supabase calls (100+100+50)
4. LWW/conflict-copy tables → `supabase.from(table).upsert(batch, { onConflict: 'id' })`
5. Monotonic tables → `supabase.rpc('upsert_<table>()', {...})` per record (not batched)
6. Insert-only tables → `supabase.from(table).insert(batch)` (ON CONFLICT DO NOTHING)
7. Retry backoff: 1s/2s/4s/8s/16s on 5xx or network errors; correct delays verified with fake timers in unit tests
8. Dead-letter: after 5 failures, `syncQueue` entry has `status = 'dead'`; never retried automatically
9. 4xx (except 401) → immediate dead-letter; 401 → `supabase.auth.refreshSession()` then retry once
10. `navigator.locks.request('sync-upload', { ifAvailable: true })` serializes uploads; second concurrent call returns immediately
11. `nudge()` debounced 200ms: multiple rapid calls → single upload cycle
12. `npx tsc --noEmit` zero errors; `npm run lint` zero errors; `npm run build` clean
13. Unit tests cover: coalesce, batch-split, 5xx retry, dead-letter, 4xx, 401-refresh, concurrency guard, debounce

---

## Out of Scope

- Download phase (S06)
- Sync triggers / lifecycle hooks (S07)
- Auth lifecycle / start/stop API (S08)
- `useSyncStatusStore` Zustand store (S07)
- `syncEngine.fullSync()` (S06)
- UI components (none in this story)

---

## Technical Notes

- Verify `status` field enum in `src/db/schema.ts` — planning doc says `'dead'` not `'dead-letter'`
- `navigator.locks` fallback for Safari 15 and older: module-level `_isRunning` boolean flag
- Debounce: `setTimeout`/`clearTimeout` pattern; module-level `_debounceTimer`
- Retry scheduling: update Dexie entry `attempts++` and `status: 'pending'`, schedule a `setTimeout` that calls `nudge()` after backoff delay
- Test environment mocks: `@/db` (syncQueue), `@/lib/auth/supabase`, `navigator.locks`
- Keep `// Intentional:` comments at every non-obvious site (null guard, lock guard, fallback flag)
