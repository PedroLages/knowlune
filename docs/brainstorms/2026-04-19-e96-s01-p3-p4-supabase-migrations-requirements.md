# E96-S01 — P3/P4 Supabase Migrations — Requirements

- **Date:** 2026-04-19
- **Epic:** E96 — Remaining Tables & Features Sync ("Everything Everywhere")
- **Story:** E96-S01 — P3/P4 Supabase Migrations
- **Scope type:** Lightweight, pure SQL. No TypeScript. Wiring lives in E96-S02/S03/S04.
- **Depends on:** E92 (sync engine + P0 migrations), E93/E94/E95 (P1/P2 + settings patterns)
- **Blocks:** E96-S02 (store wiring), E96-S03 (append-only sync), E96-S04 (YouTube eval)

## 1. Problem & Goal

The sync engine registry in `src/lib/sync/tableRegistry.ts` declares 14 P3/P4 tables. 3 of them already have Supabase tables from E95 (`opds_catalogs`, `audiobookshelf_servers`, `notification_preferences`). **11 tables remain unmigrated**. Without their Postgres counterparts, the upload phase will 404 on first attempt and the store wiring in E96-S02+ cannot be written.

This story creates the missing Postgres tables, RLS policies, and indexes so that E96-S02+ can wire the corresponding Dexie stores through `syncableWrite()` without server-side surprises.

## 2. Scope — Tables to Migrate

Cross-referenced `tableRegistry.ts` against `supabase/migrations/*.sql`. The authoritative list of tables this story creates:

### P3 — Learning paths / scheduling / notifications / integrations (8 tables)

| Supabase table | Dexie store | Conflict | Notes |
| --- | --- | --- | --- |
| `learning_paths` | `learningPaths` | LWW | Multi-path model (E26). User-owned container |
| `learning_path_entries` | `learningPathEntries` | LWW | FK → `learning_paths.id` (TEXT, NOT enforced server-side — Dexie IDs arrive first) |
| `challenges` | `challenges` | **monotonic** on `current_progress` | `celebrated_milestones` is `INT[]` |
| `course_reminders` | `courseReminders` | LWW | `days` = `TEXT[]` of day-of-week names; `time` = `TEXT` "HH:MM" |
| `notifications` | `notifications` | LWW | PK is ULID (TEXT, not UUID); `read_at` / `dismissed_at` nullable |
| `career_paths` | `careerPaths` | LWW | `stages` serialized as `JSONB` |
| `path_enrollments` | `pathEnrollments` | LWW | FK → `career_paths.id` (TEXT) |
| `study_schedules` | `studySchedules` | LWW | `days` = `TEXT[]`; `timezone` = IANA string |

### P4 — Analytics / append-only events / quizzes (3 tables)

| Supabase table | Dexie store | Conflict | Notes |
| --- | --- | --- | --- |
| `quizzes` | `quizzes` | LWW | `questions` as `JSONB`; `course_id` TEXT (no FK) |
| `quiz_attempts` | `quizAttempts` | **insert-only** | Immutable; `answers` as `JSONB`; follow `audio_bookmarks` policy shape |
| `ai_usage_events` | `aiUsageEvents` | **insert-only** | Immutable analytics; `metadata` as `JSONB`; PK TEXT (UUID from client) |

Out of scope (already migrated by E95): `opds_catalogs`, `audiobookshelf_servers`, `notification_preferences`.

## 3. Column-level decisions (non-obvious)

These are the decisions whoever picks this up should not have to re-derive:

1. **Primary key types:** All client-generated IDs are stored as `TEXT` (not `UUID`). Dexie generates UUIDs/ULIDs as strings — the server must not attempt to coerce/validate UUID shape. `notifications.id` is explicitly a ULID (not a UUID); `ai_usage_events.id` is a client UUID as text. Use `id TEXT PRIMARY KEY` for all 11 tables.
2. **No FK constraints across sync tables.** The sync engine uploads in priority order, but parent/child rows can arrive out of order on a new device (e.g. `learning_path_entries` before its `learning_paths` parent if a retry reorders them). Every FK is advisory only — store as `TEXT` without REFERENCES.
3. **`user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`** on all 11 tables. This is the only hard FK.
4. **`updated_at` column** on every LWW table (9 of 11). Client-driven — NO `moddatetime` trigger. LWW-incompatible tables (`quiz_attempts`, `ai_usage_events`) use `created_at` as the download cursor.
5. **Array columns** use Postgres native `TEXT[]` (not JSONB). Applies to `course_reminders.days`, `study_schedules.days`, `challenges.celebrated_milestones` (`INT[]`). Keeps queries sane if we ever add admin tooling; automatic (de)serialization via PostgREST is transparent.
6. **Freeform nested data** uses `JSONB`. Applies to `career_paths.stages`, `quizzes.questions`, `quiz_attempts.answers`, `notifications.metadata`, `ai_usage_events.metadata`.
7. **Monotonic upsert for `challenges`:** Follow the pattern already established for `content_progress` / `video_progress` / `books.progress`. Either a dedicated SQL function (e.g. `upsert_challenge()`) OR — simpler — rely on the sync engine's `monotonicFields` client-side gate and use a standard upsert. **Recommended: standard upsert**, because the client-side monotonic check in `syncEngine` already gates this; no server function needed. Document this decision in the migration header.
8. **`quiz_attempts` / `ai_usage_events` RLS** follows `audio_bookmarks` pattern: SELECT + INSERT policies only (no UPDATE/DELETE policies). Use two named policies (`insert_own_*` and `select_own_*`), not a single FOR ALL policy, so the immutability is enforced at the DB layer even if a bug tries to UPDATE.

## 4. Migration file layout

Two files, ordered chronologically after existing E95 migrations:

1. `supabase/migrations/20260427000001_p3_sync.sql` — 8 P3 tables + indexes + RLS
2. `supabase/migrations/20260427000002_p4_sync.sql` — 3 P4 tables + indexes + RLS

Splitting keeps each file under ~300 lines and gives a clean rollback unit per priority tier. Filename prefix `20260427` slots after the latest existing migration (`20260426000001_notification_preferences.sql`) without collision.

### Per-table template (LWW)

```sql
CREATE TABLE IF NOT EXISTS public.<table> (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... domain columns ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_<table>_user_updated
  ON public.<table> (user_id, updated_at);

ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own <table>" ON public.<table>;
CREATE POLICY "Users access own <table>"
  ON public.<table>
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Per-table template (insert-only — `quiz_attempts`, `ai_usage_events`)

Mirror the `audio_bookmarks` block from `20260413000002_p1_learning_content.sql` lines 324–360:
- No `updated_at` column
- `created_at`-keyed index for download cursor
- Separate INSERT + SELECT policies (no FOR ALL; no UPDATE/DELETE policies)

## 5. Indexes

Minimum set — one incremental-cursor index per table, matching the existing P0/P1/P2 convention:

- LWW tables: `(user_id, updated_at)`
- Insert-only tables: `(user_id, created_at)`

No additional indexes in this story. Query-pattern indexes (e.g. `course_reminders.course_id`) can be added reactively in a later migration when a real query surfaces.

## 6. Acceptance Criteria

1. Two migration files exist at `supabase/migrations/20260427000001_p3_sync.sql` and `20260427000002_p4_sync.sql`.
2. All 11 tables created with the columns listed in § 2 and the type decisions in § 3.
3. Every table has RLS enabled with the correct policy shape (FOR ALL for LWW; INSERT + SELECT only for insert-only).
4. Every table has its incremental-cursor index.
5. No FK constraints between sync tables — only to `auth.users`.
6. No `moddatetime` trigger on any of the 11 tables (verified by file grep — trigger names must not mention these tables).
7. Files are wrapped in `BEGIN; ... COMMIT;` and use `IF NOT EXISTS` / idempotent DDL so re-running is safe.
8. `supabase db reset` (or equivalent local migration test) applies both files cleanly on top of the existing migration set.
9. Header comment on each file references this requirements doc and lists the tables it creates.

## 7. Explicit non-goals

- **No TypeScript wiring.** `syncableWrite()` calls in stores land in E96-S02.
- **No Supabase types regen.** That belongs in E96-S02 alongside the wiring.
- **No `rollback/` files.** Match the pattern of E95 migrations which do not ship per-migration rollback scripts; the existing `rollback/` directory is for epic-scoped recovery only.
- **No YouTube tables.** `youtubeCourseChapters` is deferred to E96-S04 which evaluates whether it should sync at all.
- **No `flashcard_reviews`-style server-only tables.** All 11 tables in scope correspond 1:1 with a Dexie store already in `tableRegistry.ts`.
- **No seed data or backfill.** New devices pull from live rows; existing devices upload on first connect.

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| PK type mismatch between TEXT (server) and whatever Dexie actually stores | All 11 Dexie stores use string IDs (verified in `src/data/types.ts`); `TEXT` is correct. Test: unit test in E96-S02 that round-trips a record. |
| Silently missing `celebrated_milestones` array → Postgres rejects write | Declared as `INT[] NOT NULL DEFAULT '{}'` so empty arrays work. |
| `notifications.id` as ULID collides with UUID generation default | Use `TEXT PRIMARY KEY` with no default — client always supplies the ID. |
| `path_enrollments.path_id` points to a non-existent career path on server | Store as `TEXT` without FK. Acceptable — a stale enrollment is recoverable client-side. |
| Someone later adds `moddatetime` trigger, breaking LWW | Header comment on every LWW table explicitly forbids it; E92-S01 already documents the rule. |

## 9. Handoff to Planning

This is implementation-ready for `/ce:plan` or direct execution. Planner should produce a plan that:

1. Creates the two migration files with the templates above.
2. Runs `supabase db reset` locally (or `supabase migration up`) as a verification step.
3. Adds a minimal assertion to `src/lib/sync/__tests__/tableRegistry.test.ts` confirming each of the 11 P3/P4 tables' `supabaseTable` value is represented in the new files (grep-based or a simple string check — no live DB needed).
4. Does NOT touch `tableRegistry.ts` — it already declares all 11 tables correctly.
