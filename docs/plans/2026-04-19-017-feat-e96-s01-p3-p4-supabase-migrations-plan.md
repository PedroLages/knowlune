---
title: E96-S01 — P3/P4 Supabase Migrations
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md
---

# E96-S01 — P3/P4 Supabase Migrations

## Overview

Create Postgres counterparts for the 11 P3/P4 tables that `src/lib/sync/tableRegistry.ts` already declares but Supabase does not yet know about. Pure SQL — no TypeScript. Unblocks E96-S02 (store wiring), E96-S03 (append-only sync), and E96-S04 (YouTube evaluation). Without this migration the upload phase 404s on first attempt for any of these 11 stores.

## Problem Frame

The sync engine registry enumerates 14 P3/P4 tables. Three (`opds_catalogs`, `audiobookshelf_servers`, `notification_preferences`) already shipped in E95. The remaining **11 tables** have no Postgres home, so `syncableWrite()` cannot be wired into their stores without server-side failures. This story creates those tables with the column types, RLS policies, and indexes that the sync engine expects (see origin: `docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md`).

## Requirements Trace

- R1. Create two migration files at `supabase/migrations/20260427000001_p3_sync.sql` and `supabase/migrations/20260427000002_p4_sync.sql` (origin §4, AC 1).
- R2. Create all 11 tables with the columns and type decisions in origin §2–§3 (AC 2).
- R3. Every table has RLS enabled: `FOR ALL` for the 9 LWW tables; separate INSERT + SELECT policies for the 2 insert-only tables (AC 3, origin §3.8).
- R4. Every table has its incremental-cursor index — `(user_id, updated_at)` for LWW, `(user_id, created_at)` for insert-only (AC 4, origin §5).
- R5. No FK constraints between sync tables — only to `auth.users(id) ON DELETE CASCADE` (AC 5, origin §3.2–§3.3).
- R6. No `moddatetime` trigger on any of the 11 tables (AC 6, origin §3.4).
- R7. Each file is wrapped in `BEGIN; … COMMIT;` with idempotent DDL (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) so re-running is safe (AC 7).
- R8. `supabase db reset` (or `supabase migration up`) applies both files cleanly on top of the existing migration set (AC 8).
- R9. Header comment on each file references the requirements doc and lists the tables it creates (AC 9).
- R10. Add a string-level assertion in `src/lib/sync/__tests__/tableRegistry.test.ts` that each of the 11 P3/P4 `supabaseTable` values appears in the new migration files (origin §9 item 3).

## Scope Boundaries

- No TypeScript wiring — `syncableWrite()` integration lands in E96-S02.
- No Supabase types regeneration — belongs in E96-S02 alongside wiring.
- No per-migration rollback files (E95 pattern — `rollback/` is epic-scoped only).
- No YouTube tables (`youtubeCourseChapters` deferred to E96-S04).
- No server-only tables (all 11 map 1:1 to a Dexie store already in the registry).
- No seed data, no backfill, no query-pattern indexes (add reactively later).
- No changes to `src/lib/sync/tableRegistry.ts` — it already declares all 11 tables correctly.

### Deferred to Separate Tasks

- Store wiring through `syncableWrite()` for the 11 stores: **E96-S02**.
- Append-only sync semantics for `quiz_attempts` / `ai_usage_events`: **E96-S03**.
- YouTube chapter sync decision + migration (if needed): **E96-S04**.

## Context & Research

### Relevant Code and Patterns

- `src/lib/sync/tableRegistry.ts` — authoritative source for `supabaseTable` names, conflict strategies, and `monotonicFields` for the 11 tables.
- `supabase/migrations/20260413000002_p1_learning_content.sql` — canonical patterns:
  - Lines ~300–316: LWW template (table + cursor index + RLS `FOR ALL` + `moddatetime` trigger) — use this shape but **drop** the `moddatetime` trigger per origin §3.4.
  - Lines 319–355: `audio_bookmarks` insert-only template — copy shape for `quiz_attempts` and `ai_usage_events` (no `updated_at`, `created_at` cursor index, separate INSERT + SELECT policies).
- `supabase/migrations/20260426000001_notification_preferences.sql` — most recent migration; confirms the `20260427…` timestamp slots next without collision.
- `src/data/types.ts` — confirms all 11 Dexie stores use string IDs (informs `TEXT PRIMARY KEY` choice).
- `src/lib/sync/__tests__/tableRegistry.test.ts` — target file for the grep-style coverage assertion (R10).

### Institutional Learnings

- Origin §3.7: client-side `monotonicFields` in `syncEngine` already gates monotonic upserts (see `content_progress` / `video_progress` / `books.progress` pattern). No server function needed for `challenges.current_progress` — standard upsert suffices. Document this in the migration header.
- Origin §3.4: `moddatetime` trigger is incompatible with LWW — the client-supplied `updated_at` must win. Existing E92-S01 docs record the rule; header comment on every LWW table here must restate it as a guardrail for future contributors.

### External References

- None needed — all patterns are in-repo and prescriptive in the origin doc.

## Key Technical Decisions

- **`TEXT PRIMARY KEY` (no default) on all 11 tables**: Dexie stores generate string IDs (UUID or ULID) client-side. Server must not coerce UUID shape, and `notifications.id` is explicitly a ULID (origin §3.1).
- **No FK constraints between sync tables**: upload order is priority-based but retries can reorder parent/child; advisory `TEXT` references only. Only hard FK is `user_id → auth.users(id)` (origin §3.2–§3.3).
- **Native `TEXT[]` / `INT[]` for arrays**, `JSONB` for freeform nested data: keeps arrays queryable if admin tooling appears; JSONB for `stages`, `questions`, `answers`, `metadata` (origin §3.5–§3.6).
- **Monotonic `challenges` = standard upsert**: client-side gate in `syncEngine` already enforces monotonic semantics; no `upsert_challenge()` SQL function. Header comment must document this (origin §3.7).
- **Insert-only RLS uses two named policies, not `FOR ALL`**: `insert_own_*` + `select_own_*` so immutability is enforced at DB layer even against a buggy UPDATE call (origin §3.8).
- **Split into two files (P3 vs P4)**: keeps each under ~300 lines and gives a clean rollback unit per priority tier (origin §4).
- **Re-run safety**: every `CREATE TABLE`, `CREATE INDEX` uses `IF NOT EXISTS`; every `CREATE POLICY` is preceded by `DROP POLICY IF EXISTS`. Both files wrapped in `BEGIN; … COMMIT;`.

## Open Questions

### Resolved During Planning

- _Should `challenges` use a dedicated `upsert_challenge()` SQL function?_ No — rely on the existing client-side `monotonicFields` gate (origin §3.7).
- _Should we add query-pattern indexes (e.g. `course_reminders.course_id`)?_ No — add reactively when a real query surfaces (origin §5).
- _Should insert-only tables use a single `FOR ALL` policy?_ No — use separate INSERT + SELECT to enforce immutability at the DB layer (origin §3.8).

### Deferred to Implementation

- Exact column set for `career_paths.stages` / `quizzes.questions` / `notifications.metadata` JSONB contents — stored as raw `JSONB` with no schema constraint; the Dexie shape is authoritative.
- Whether `supabase db reset` or `supabase migration up` is the right local verification command in the developer's environment — either satisfies AC 8.

## Implementation Units

- [ ] **Unit 1: P3 migration file — 8 LWW tables**

**Goal:** Create `supabase/migrations/20260427000001_p3_sync.sql` with the 8 P3 tables, their cursor indexes, and RLS policies.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R9

**Dependencies:** None (existing migrations up through `20260426000001_notification_preferences.sql` provide the baseline).

**Files:**
- Create: `supabase/migrations/20260427000001_p3_sync.sql`

**Approach:**
- Header comment: reference origin doc path, list the 8 tables created, state the "no `moddatetime` trigger on LWW sync tables" guardrail, state the "standard upsert for `challenges` — client-side monotonic gate" decision.
- Wrap entire file in `BEGIN; … COMMIT;`.
- For each of the 8 tables, emit the LWW template block from origin §4:
  - `CREATE TABLE IF NOT EXISTS public.<table> (...)` with `id TEXT PRIMARY KEY`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, domain columns, `created_at` and `updated_at` both `TIMESTAMPTZ NOT NULL DEFAULT now()`.
  - `CREATE INDEX IF NOT EXISTS idx_<table>_user_updated ON public.<table> (user_id, updated_at);`
  - `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
  - `DROP POLICY IF EXISTS "Users access own <table>" ON public.<table>;` + `CREATE POLICY … FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
- Column specifics per origin §2–§3:
  - `learning_paths`: domain columns per the Dexie `LearningPath` shape (text/boolean/numeric primitives). No cross-table FK.
  - `learning_path_entries`: `path_id TEXT NOT NULL` (advisory, no FK), ordinal / entry columns.
  - `challenges`: `current_progress INT NOT NULL DEFAULT 0`, `celebrated_milestones INT[] NOT NULL DEFAULT '{}'`, remaining challenge columns.
  - `course_reminders`: `course_id TEXT`, `days TEXT[] NOT NULL DEFAULT '{}'`, `time TEXT NOT NULL` (HH:MM format — stored as opaque string).
  - `notifications`: `id TEXT PRIMARY KEY` (ULID — explicitly note in comment), `read_at TIMESTAMPTZ`, `dismissed_at TIMESTAMPTZ`, `metadata JSONB`.
  - `career_paths`: `stages JSONB NOT NULL DEFAULT '[]'::jsonb`.
  - `path_enrollments`: `path_id TEXT NOT NULL` (advisory FK to `career_paths`).
  - `study_schedules`: `days TEXT[] NOT NULL DEFAULT '{}'`, `timezone TEXT NOT NULL` (IANA).
- **No `moddatetime` trigger on any table.** **No FK between sync tables.**

**Patterns to follow:**
- Header/table/index/RLS shape: `supabase/migrations/20260413000002_p1_learning_content.sql` (LWW sections, e.g., `vocabulary_items` at lines ~280–316) — but **omit** the `moddatetime` trigger block.
- File ordering and idempotent DDL style: `supabase/migrations/20260426000001_notification_preferences.sql`.

**Test scenarios:**
- Happy path: `supabase db reset` (or equivalent local migration apply) succeeds on top of existing migrations — all 8 tables visible in `public` schema, all have RLS enabled (`pg_class.relrowsecurity = true`), all have the `idx_<table>_user_updated` index.
- Edge case: re-running the migration (simulated by applying twice) is a no-op — `IF NOT EXISTS` + `DROP POLICY IF EXISTS` pattern prevents errors.
- Edge case: empty `celebrated_milestones` insert succeeds (default `'{}'`); empty `days` arrays on `course_reminders` / `study_schedules` succeed.
- Integration: `grep -c "CREATE TABLE IF NOT EXISTS public\." supabase/migrations/20260427000001_p3_sync.sql` equals 8.
- Integration: `grep -n "moddatetime" supabase/migrations/20260427000001_p3_sync.sql` returns no matches.
- Integration: `grep -c "REFERENCES auth.users" supabase/migrations/20260427000001_p3_sync.sql` equals 8 (one per table, and zero other REFERENCES lines).

**Verification:**
- All 8 tables exist after applying the migration.
- Each has a `(user_id, updated_at)` index.
- Each has a single `FOR ALL` policy named `"Users access own <table>"`.
- No `moddatetime` trigger, no cross-sync-table FK.

- [ ] **Unit 2: P4 migration file — 3 tables (1 LWW + 2 insert-only)**

**Goal:** Create `supabase/migrations/20260427000002_p4_sync.sql` with `quizzes` (LWW), `quiz_attempts` (insert-only), and `ai_usage_events` (insert-only).

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R9

**Dependencies:** Unit 1 (for chronological ordering; P4 file applies after P3).

**Files:**
- Create: `supabase/migrations/20260427000002_p4_sync.sql`

**Approach:**
- Header comment: reference origin doc path, list the 3 tables, state the "insert-only RLS uses separate INSERT + SELECT policies" rule for the 2 append-only tables, state the "no `moddatetime` trigger" rule for the LWW table.
- Wrap in `BEGIN; … COMMIT;`.
- `quizzes` (LWW): same template as Unit 1. Columns include `course_id TEXT` (advisory, no FK), `questions JSONB NOT NULL DEFAULT '[]'::jsonb`, timestamps.
- `quiz_attempts` (insert-only): mirror `audio_bookmarks` block (origin §4, second template).
  - No `updated_at` column; `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` only.
  - `answers JSONB NOT NULL DEFAULT '[]'::jsonb`, `quiz_id TEXT NOT NULL` (advisory FK).
  - Index: `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON public.quiz_attempts (user_id, created_at);`
  - `DROP POLICY IF EXISTS "Users access own quiz_attempts" …; DROP POLICY IF EXISTS "insert_own_quiz_attempts" …; DROP POLICY IF EXISTS "select_own_quiz_attempts" …;`
  - `CREATE POLICY "insert_own_quiz_attempts" … FOR INSERT WITH CHECK (auth.uid() = user_id);`
  - `CREATE POLICY "select_own_quiz_attempts" … FOR SELECT USING (auth.uid() = user_id);`
  - **No UPDATE / DELETE policies**, **no `FOR ALL` policy**.
- `ai_usage_events` (insert-only): same shape as `quiz_attempts`.
  - `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`, event-type / token / model columns per the Dexie `AIUsageEvent` shape.
  - Index: `(user_id, created_at)`.
  - Separate INSERT + SELECT policies.

**Patterns to follow:**
- Insert-only template: `supabase/migrations/20260413000002_p1_learning_content.sql` lines 319–355 (`audio_bookmarks` block).
- LWW template: same as Unit 1.

**Test scenarios:**
- Happy path: migration applies cleanly on top of Unit 1; all 3 tables created with RLS enabled.
- Happy path: `quizzes` has `(user_id, updated_at)` index; `quiz_attempts` and `ai_usage_events` have `(user_id, created_at)` index.
- Edge case: simulated UPDATE attempt against `quiz_attempts` (from a client with valid JWT) fails with RLS policy violation — only INSERT + SELECT policies exist.
- Edge case: re-running the migration is a no-op (idempotent DDL).
- Integration: `grep -c "FOR INSERT" supabase/migrations/20260427000002_p4_sync.sql` equals 2 (two insert-only tables).
- Integration: `grep -c "FOR SELECT" supabase/migrations/20260427000002_p4_sync.sql` equals 2.
- Integration: `grep -c "FOR ALL" supabase/migrations/20260427000002_p4_sync.sql` equals 1 (only `quizzes`).
- Integration: `grep -n "moddatetime" supabase/migrations/20260427000002_p4_sync.sql` returns no matches.
- Integration: `grep -c "updated_at" supabase/migrations/20260427000002_p4_sync.sql` — count is consistent with `quizzes` alone having it (no `updated_at` on the two insert-only tables).

**Verification:**
- 3 tables created, correct index per conflict strategy, correct RLS shape per conflict strategy.
- `quiz_attempts` and `ai_usage_events` reject UPDATE/DELETE at RLS level.

- [ ] **Unit 3: Registry coverage assertion in `tableRegistry.test.ts`**

**Goal:** Guardrail that any future registry change for these 11 tables is reflected in a migration file (and vice versa).

**Requirements:** R10

**Dependencies:** Unit 1 and Unit 2 (test reads the migration files).

**Files:**
- Modify: `src/lib/sync/__tests__/tableRegistry.test.ts`

**Approach:**
- Add a single `it` block: "P3/P4 sync tables have corresponding Supabase migrations".
- Hardcoded list of the 11 `supabaseTable` names (`learning_paths`, `learning_path_entries`, `challenges`, `course_reminders`, `notifications`, `career_paths`, `path_enrollments`, `study_schedules`, `quizzes`, `quiz_attempts`, `ai_usage_events`).
- Read both migration files via `fs.readFileSync` (synchronously, since Node test runner supports it); concatenate contents.
- For each table name, assert the concatenated text contains `CREATE TABLE IF NOT EXISTS public.<table>` — simple substring check, no live DB.
- Also assert that `tableRegistry` entries for these 11 stores have a matching `supabaseTable` value — pulls from the registry so renames in the registry fail the test until the migration follows.

**Patterns to follow:**
- Existing file-reading test patterns in the repo — check if other tests under `src/lib/sync/__tests__/` already use `fs` + `path`; if none, use `import { readFileSync } from 'node:fs'` and `path.join(__dirname, '../../../../supabase/migrations/…')`.

**Test scenarios:**
- Happy path: new test passes against the files from Unit 1 and Unit 2.
- Failure case (manual verification): temporarily remove one `CREATE TABLE` line from the P3 file — test fails with a clear message naming the missing table.
- Edge case: adding a new P3/P4 table to the registry without a migration — test fails.

**Verification:**
- `npm run test:unit -- tableRegistry` passes.
- Removing any of the 11 `CREATE TABLE` lines causes the new assertion to fail.

## System-Wide Impact

- **Interaction graph:** Unblocks the `syncableWrite()` upload path for 11 Dexie stores. Nothing else in the running app reads these tables yet (E96-S02 handles wiring), so the blast radius of applying the migration is limited to making previously-404 endpoints now return 2xx for authenticated users.
- **Error propagation:** Existing sync code that already calls `syncableWrite()` for these stores (if any) would currently 404; after this migration it will succeed. No change in error-handling semantics at the client.
- **State lifecycle risks:** None — empty tables with RLS on; no backfill, no triggers, no cross-table constraints.
- **API surface parity:** PostgREST exposes these tables automatically; client must be authenticated for every read/write. No service-role bypass introduced.
- **Integration coverage:** Real cross-layer coverage (sync engine ↔ Postgres) lands in E96-S02. This story's grep-based test (Unit 3) is a structural guardrail only.
- **Unchanged invariants:** `tableRegistry.ts` is not modified. Existing 26 migrations are not modified. No triggers, functions, or types introduced.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| PK type mismatch (TEXT vs whatever Dexie actually stores) | All 11 Dexie stores use string IDs per `src/data/types.ts`; `TEXT` is correct. Round-trip verification lands in E96-S02. |
| Missing array default causes Postgres to reject inserts with empty arrays | Declare `TEXT[]` / `INT[]` columns as `NOT NULL DEFAULT '{}'`. |
| `notifications.id` collision if a default UUID is generated | `TEXT PRIMARY KEY` with no default — client always supplies the ULID. |
| `path_enrollments.path_id` points to a career path that does not exist server-side | Advisory `TEXT` column, no FK. Stale enrollment is client-recoverable. |
| Future contributor adds a `moddatetime` trigger and breaks LWW | Header comment on every LWW table explicitly forbids it; guardrail already exists in E92-S01 docs. |
| Migration file ordering collision (another branch lands a `20260427…` migration first) | Trivially resolved at merge: bump to `20260428000001/2` or a higher sequence. No semantic coupling to the exact timestamp. |

## Documentation / Operational Notes

- Each migration file's header comment is the durable documentation — references the origin requirements doc path and lists the tables, type rules, and the "no `moddatetime`" / "standard upsert for `challenges`" guardrails. No separate docs update required.
- `supabase db reset` (or `supabase migration up`) is sufficient verification locally; no staging rollout plan needed for a pure DDL change this contained.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md`
- Registry: `src/lib/sync/tableRegistry.ts`
- LWW template pattern: `supabase/migrations/20260413000002_p1_learning_content.sql` (vocabulary_items section, minus the `moddatetime` trigger)
- Insert-only template pattern: `supabase/migrations/20260413000002_p1_learning_content.sql` (audio_bookmarks section, lines 319–355)
- Most-recent migration (for ordering): `supabase/migrations/20260426000001_notification_preferences.sql`
- Test target: `src/lib/sync/__tests__/tableRegistry.test.ts`
