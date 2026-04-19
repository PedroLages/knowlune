# E94-S01: P2 Supabase Migrations — Courses, Videos, PDFs, Authors, Books

## Context

Epic 94 ("Course & Book Library Sync") wires the P2 library tables so that imported courses, videos, PDFs, author profiles, and books can sync across devices via the E92 sync engine. This story (E94-S01) is a pure SQL migration story — no TypeScript code. It creates the five P2 tables and one monotonic upsert function that downstream wiring stories (E94-S02 through E94-S07) depend on.

Migration filename prefix `20260413000003` places this after P0 (`20260413000001`) and P1 (`20260413000002`). The `moddatetime`, `pgcrypto`, and `vector` extensions are already installed in P0 — do not re-create them.

---

## Problem Statement / What Needs to Be Built

Five new Supabase tables are needed to back the P2 sync tier:

- `imported_courses` — course metadata including YouTube playlist/channel fields, thumbnail URL
- `imported_videos` — per-video metadata with JSONB chapters, reserved-word `"order"` column
- `imported_pdfs` — PDF metadata with `file_url` placeholder for Storage URL (populated by E94-S04)
- `authors` — author profiles with JSONB `social_links` and `TEXT[]` course_ids
- `books` — book library with decomposed `source_type`/`source_url` columns (not a JSONB `source`), JSONB `chapters` and `current_position`, monotonic progress enforcement

Additionally, one stored function is required:

- `upsert_book_progress()` — SECURITY DEFINER function that enforces monotonic progress (progress never regresses) and derives `status` from progress value

All tables must have: RLS `FOR ALL` policies scoped to `auth.uid() = user_id`, `moddatetime` triggers, and `(user_id, updated_at)` compound indexes for the E92-S06 incremental download cursor.

---

## Acceptance Criteria

1. **All 5 P2 tables exist with correct columns and types** — `imported_courses`, `imported_videos`, `imported_pdfs`, `authors`, and `books` created with the exact column definitions from the story spec. Key non-obvious columns:
   - `imported_courses.status` CHECK uses hyphenated values: `'not-started'|'active'|'completed'|'paused'`
   - `imported_courses.thumbnail_url TEXT` is present (NULL until E94-S04)
   - `imported_videos."order"` is double-quoted (SQL reserved word)
   - `imported_videos.chapters JSONB` for YouTube chapter data
   - `imported_pdfs.file_url TEXT` is present (NULL until E94-S04)
   - `authors.social_links JSONB` (not decomposed into columns)
   - `authors.course_ids TEXT[] NOT NULL DEFAULT '{}'`
   - `books.source_type TEXT NOT NULL CHECK (source_type IN ('local','remote','opds','abs'))` — no `'fileHandle'` variant
   - `books.source_url TEXT` — NULL when `source_type = 'local'`
   - `books.progress REAL CHECK (progress BETWEEN 0 AND 100)` — 0–100 range, not 0–1
   - `books.status CHECK ('unread'|'reading'|'finished'|'abandoned')` — matches Dexie `BookStatus`
   - `books.chapters JSONB` and `books.current_position JSONB`

2. **`upsert_book_progress()` function exists and is monotonic** — signature: `(p_user_id UUID, p_book_id UUID, p_progress REAL, p_updated_at TIMESTAMPTZ) RETURNS void`. Uses `GREATEST(existing.progress, p_progress)` — progress never regresses. Sets `status = 'reading'` when new progress wins and `0 < progress < 100`; `status = 'finished'` when progress = 100. SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard. `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated`.

3. **Standard `FOR ALL` RLS policies on all 5 tables** — each table has a single `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` policy. Cross-user access must be blocked.

4. **`moddatetime` trigger on `updated_at` for all 5 tables** — named `{tablename}_set_updated_at`, `BEFORE UPDATE`, calling `extensions.moddatetime('updated_at')`. Do NOT re-create the `moddatetime` extension (already in E92-S01).

5. **Incremental download compound indexes on all 5 tables** — `idx_{tablename}_user_updated ON public.{tablename} (user_id, updated_at)` on all 5 tables. `imported_videos` additionally has `idx_imported_videos_course ON public.imported_videos (user_id, course_id)`.

6. **`books.source` field handled correctly** — Supabase uses two decomposed columns (`source_type + source_url`), not a `source` JSONB. No `'fileHandle'` variant in the CHECK constraint (stripped by `syncableWrite` in E94-S02).

7. **Migration filename and structure** — migration at `supabase/migrations/20260413000003_p2_library.sql`, rollback at `supabase/migrations/rollback/20260413000003_p2_library_rollback.sql`. Wrapped in `BEGIN; ... COMMIT;`. All statements use `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` for idempotency. Re-running produces no errors.

8. **`imported_courses.status` field uses Dexie enum values (hyphenated)** — `'not-started'|'active'|'completed'|'paused'` (not snake_case `'not_started'`). Avoids a fieldMap entry for status casing.

9. **`books.progress` is 0–100, not 0–1** — `REAL CHECK (progress BETWEEN 0 AND 100)`. The epics doc's "0–1" description is incorrect; the actual Dexie `Book.progress` is 0–100.

---

## Technical Constraints and Dependencies

- **Depends on E92-S01** — `moddatetime` extension installed in P0 migration; do not re-create
- **Depends on E92 sync engine** — tables must have `(user_id, updated_at)` indexes for E92-S06 download cursor
- **Migration ordering** — filename prefix `20260413000003` must sort after `20260413000001` (P0) and `20260413000002` (P1)
- **No TypeScript code** — this is a pure SQL migration story; all wiring is deferred to E94-S02
- **Self-hosted Supabase (titan.local)** — testing done against local instance via Supabase Studio or `psql`
- **`books.status` source of truth** — use `src/data/types.ts` `BookStatus` type (`'unread'|'reading'|'finished'|'abandoned'`), not the epics doc description
- **`books.source` decomposition** — `ContentSource` union type contains `FileSystemFileHandle` (non-serializable); decompose into `source_type + source_url` columns only
- **`upsert_book_progress()` timestamp clamping** — clamp `p_updated_at` to `LEAST(p_updated_at, now() + interval '5 minutes')` to prevent far-future timestamps from pinning the sync cursor (E93-S01 lesson learned)
- **SECURITY DEFINER pattern** — all SECURITY DEFINER functions must include `SET search_path = public, pg_temp`, explicit `REVOKE FROM PUBLIC; GRANT TO authenticated`
- **Pattern reference files**: `supabase/migrations/20260413000001_p0_sync_foundation.sql`, `supabase/migrations/20260413000002_p1_learning_content.sql`, `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`

---

## Out-of-Scope Items

- TypeScript wiring of stores via `syncableWrite` — deferred to E94-S02
- Supabase Storage bucket setup — deferred to E94-S04
- File upload/download logic — deferred to E94-S04 and E94-S05
- Book reviews and shelves tables — deferred to E94-S03
- Chapter mappings table — deferred to E94-S06
- `books.abs_server_id` and `linked_book_id` are not FK-indexed server-side (not queried server-side yet)
- Automated E2E tests for this migration — deferred to E94-S02 wiring stories which exercise the tables

---

## Key Implementation Notes

### Migration Structure Pattern

Follow the structure of `20260413000002_p1_learning_content.sql`:
- Header comment block (purpose, ordering, idempotency, `books.source` decomposition note)
- `BEGIN; ... COMMIT;` wrapper
- One comment block per table: `-- ─── Unit N: tablename ───`
- `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` everywhere

### `imported_videos."order"` Reserved Word

The column name `order` must be double-quoted in the `CREATE TABLE` statement: `"order" INT NOT NULL DEFAULT 0`. The Dexie field is `order` (unquoted in TypeScript); the tableRegistry fieldMap for `importedVideos` has `fieldMap: {}` — Supabase storage layer handles quoting automatically.

### `books.source` Decomposition Rationale

The Dexie `Book.source: ContentSource` is a discriminated union with three variants. The `fileHandle` variant contains `FileSystemFileHandle` which cannot serialize to JSON. The decomposition:
- `source_type TEXT NOT NULL CHECK (source_type IN ('local', 'remote', 'opds', 'abs'))` — no `'fileHandle'`
- `source_url TEXT` — NULL when `source_type = 'local'`

E94-S02 wiring handles the custom strip logic in `syncableWrite`.

### `upsert_book_progress()` Key Behaviors

1. Monotonic progress: `GREATEST(books.progress, EXCLUDED.progress)`
2. Status derivation (only when new progress wins):
   - `p_progress >= 100` → `status = 'finished'`
   - `p_progress > 0 AND p_progress < 100` → `status = 'reading'`
   - `p_progress = 0` → no status change
3. INSERT path handles both initial insert (no existing row) and update via `ON CONFLICT (id) DO UPDATE`
4. Timestamp clamp: `LEAST(p_updated_at, now() + interval '5 minutes')` on `updated_at` update

### RLS Policy Pattern (single FOR ALL)

```sql
CREATE POLICY "users_own_data" ON public.imported_courses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Rollback Script Drop Order

Must drop in reverse dependency order (books → authors → imported_pdfs → imported_videos → imported_courses), then drop the function. Use `CASCADE` on table drops.

### Manual Verification Checklist

- Table existence: query `information_schema.tables` — expect 5 rows
- `books.source_type` CHECK: `INSERT` with `source_type = 'fileHandle'` must fail
- Monotonic test: insert progress=80, call with 60, confirm stays 80
- Completion test: call with progress=100, confirm `status='finished'`
- RLS: query as userA cannot read userB rows
- Idempotency: apply migration twice — no errors
- Triggers: `information_schema.triggers` — 5 `set_updated_at` triggers
