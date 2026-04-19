---
title: "feat: P2 Library Supabase Migration — imported_courses, imported_videos, imported_pdfs, authors, books"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e94-s01-p2-supabase-migrations-library-requirements.md
---

# feat: P2 Library Supabase Migration

## Overview

Create the `supabase/migrations/20260413000003_p2_library.sql` migration that introduces five new P2 tables and one SECURITY DEFINER stored function. This is a pure SQL story — no TypeScript code is touched. It unblocks all downstream E94 wiring stories (S02–S07).

## Problem Frame

The E92 sync engine and E93 learning-content tables are complete. The P2 content tier (courses, videos, PDFs, author profiles, books) has table registry entries in `src/lib/sync/tableRegistry.ts` but no corresponding Supabase schema. Without the migration, the sync engine cannot upload or download P2 records.

The `books` table requires special handling: `Book.source` is a discriminated union containing `FileSystemFileHandle` (non-serializable), so it must be decomposed into `source_type + source_url` columns. Book progress must never regress, requiring a dedicated `upsert_book_progress()` SECURITY DEFINER function with `GREATEST()` monotonic enforcement.

(see origin: docs/brainstorms/2026-04-19-e94-s01-p2-supabase-migrations-library-requirements.md)

## Requirements Trace

- R1. Five P2 tables exist with correct columns, types, and CHECK constraints.
- R2. `upsert_book_progress()` function enforces monotonic progress and derives status.
- R3. All five tables have FOR ALL RLS policies scoped to `auth.uid() = user_id`.
- R4. All five tables have `moddatetime` triggers on `updated_at` named `{tablename}_set_updated_at`.
- R5. All five tables have `(user_id, updated_at)` compound indexes; `imported_videos` adds a second `(user_id, course_id)` index.
- R6. `books.source` is decomposed into `source_type + source_url` — no JSONB `source` column.
- R7. Migration file is `supabase/migrations/20260413000003_p2_library.sql`, idempotent, wrapped in `BEGIN; ... COMMIT;`.
- R8. Rollback script at `supabase/migrations/rollback/20260413000003_p2_library_rollback.sql`.
- R9. `imported_courses.status` CHECK uses hyphenated values: `'not-started'|'active'|'completed'|'paused'`.
- R10. `books.progress` is `REAL CHECK (progress BETWEEN 0 AND 100)` — 0–100 range.

## Scope Boundaries

- No TypeScript wiring — deferred to E94-S02 through E94-S07.
- No Supabase Storage bucket setup — deferred to E94-S04.
- No `book_reviews`, `shelves`, `book_shelves`, or `reading_queue` tables — deferred to E94-S03.
- No `chapter_mappings` table — deferred to E94-S06.
- The `moddatetime` extension is not re-created (installed in P0).
- No automated E2E tests — this migration is verified manually via Supabase Studio or psql.

## Context & Research

### Relevant Code and Patterns

- `supabase/migrations/20260413000002_p1_learning_content.sql` — direct structural template: header comment block, `BEGIN;...COMMIT;`, per-table unit headers, `IF NOT EXISTS` / `OR REPLACE`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`, `extensions.moddatetime('updated_at')` trigger syntax, SECURITY DEFINER pattern with `SET search_path = public, pg_temp`, `p_user_id IS DISTINCT FROM auth.uid()` auth guard, `LEAST(p_updated_at, now() + interval '5 minutes')` timestamp clamp, `REVOKE FROM PUBLIC; GRANT TO authenticated`.
- `supabase/migrations/20260413000001_p0_sync_foundation.sql` — P0 extension installs (moddatetime, pgcrypto, vector already done; do not re-create).
- `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql` — rollback structure: `BEGIN;...COMMIT;`, drop functions first, drop tables in reverse dependency order with `CASCADE`.
- `src/lib/sync/tableRegistry.ts` lines 289–352 — P2 registry entries: `importedCourses`, `importedVideos`, `importedPdfs`, `authors`, `books`. Confirms Supabase table names, `stripFields`, and `monotonicFields: ['progress']` for books.
- `src/data/types.ts`:
  - `LearnerCourseStatus = 'not-started' | 'active' | 'completed' | 'paused'` (line 153)
  - `ImportedCourse` (line 172) — all columns including YouTube fields, thumbnailUrl
  - `ImportedVideo` (line 198) — includes `chapters?: Chapter[]`, `order: number`
  - `ImportedPdf` (line 219) — minimal: courseId, filename, path, pageCount
  - `ImportedAuthor` (line 489) — `courseIds: string[]`, `socialLinks`, `isPreseeded`
  - `Book` (line 758) — `source: ContentSource`, `progress: number // 0-100`, `status: BookStatus`
  - `ContentSource` (line 739) — `'local' | 'remote' | 'fileHandle'`; `fileHandle` variant is non-serializable → decompose
  - `BookStatus = 'unread' | 'reading' | 'finished' | 'abandoned'` (line 686)

### Institutional Learnings

- `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` — three patterns extracted from E93: monotonic reset pattern, PK reuse, append-only cursor. The monotonic reset distinction (GREATEST blocks unconditional resets) is why E93 added `reset_vocabulary_mastery()`. For `books`, the `upsert_book_progress()` function should only enforce GREATEST — there is no reset use-case for book progress.
- Timestamp clamp `LEAST(p_updated_at, now() + interval '5 minutes')` is a hard requirement from E93-S01 lessons learned — prevents far-future client timestamps from permanently pinning the E92-S06 incremental sync cursor.
- SECURITY DEFINER functions must set `SET search_path = public, pg_temp` (not just `public`) to prevent search-path injection. Pattern confirmed in `upsert_vocabulary_mastery()` and `search_similar_notes()`.
- `p_user_id IS DISTINCT FROM auth.uid()` is the correct NULL-safe auth guard (`!=` evaluates to NULL when `auth.uid()` is NULL, which would silently pass).
- RLS `DROP POLICY IF EXISTS` before `CREATE POLICY` is required for idempotent re-runs.
- `DROP TRIGGER IF EXISTS {tablename}_set_updated_at ON public.{tablename}` before `CREATE TRIGGER {tablename}_set_updated_at` is required for idempotency. Note: this differs from the P1 template which uses `set_updated_at` (without prefix) — the AC4 requirement overrides the P1 pattern. The DROP and CREATE names must match exactly to avoid "trigger already exists" errors on re-run.

## Key Technical Decisions

- **Single FOR ALL RLS policy (not split INSERT/SELECT/UPDATE/DELETE)**: Books, courses, videos, PDFs, and authors are all mutable LWW sync tables, not append-only events. Use the same `FOR ALL TO authenticated USING (...) WITH CHECK (...)` pattern as notes, bookmarks, flashcards — not the two-policy pattern used for `audio_bookmarks` and `flashcard_reviews`.
- **`imported_videos."order"` double-quoted**: `order` is a SQL reserved word. Must be `"order" INT NOT NULL DEFAULT 0` in the DDL. The tableRegistry has `fieldMap: {}` — Supabase storage layer handles quoting automatically during sync.
- **`books.source` decomposed, not JSONB**: `ContentSource` union includes `FileSystemFileHandle` (non-serializable). `source_type TEXT CHECK (source_type IN ('local', 'remote', 'opds', 'abs'))` with `source_url TEXT` (nullable for `'local'`). No `'fileHandle'` variant in the CHECK — stripped by syncableWrite in E94-S02.
- **`upsert_book_progress()` is a dedicated SECURITY DEFINER function**: The `books` table uses `conflictStrategy: 'monotonic'` in the registry. Progress upserts should go through the function for monotonic enforcement; standard LWW INSERT/UPDATE goes directly through RLS (for other fields). Status is derived server-side only when progress advances (`p_progress > existing`).
- **Status derivation in `upsert_book_progress()`**: `p_progress >= 100 → 'finished'`; `p_progress > 0 AND p_progress < 100 → 'reading'`; `p_progress = 0 → no status change`. This matches AC2 exactly.
- **`imported_courses.thumbnail_url TEXT`**: NULL until E94-S04 wires Storage upload. Column is present from day one to avoid a later ALTER TABLE.
- **`imported_pdfs.file_url TEXT`**: Same pattern — NULL until E94-S04. Present now.
- **Migration filename prefix `20260413000003`**: Sorts after `20260413000001` (P0) and `20260413000002` (P1), before P0 fixups (`20260417…`). This is intentional and consistent with the existing convention for design-date prefixes.
- **No re-install of extensions**: `moddatetime`, `pgcrypto`, `vector`, `supabase_vault` all installed in P0. Header comment must call this out explicitly.

## Open Questions

### Resolved During Planning

- **`books.source_type` includes `'opds'` and `'abs'`?** Yes — `ContentSource` in `types.ts` only has `local | remote | fileHandle`. The requirements doc specifies `('local', 'remote', 'opds', 'abs')` for the CHECK. Confirmed: `opds` and `abs` are future-proofing additions (the sync wiring in E94-S02 will map them). Use all four variants as specified in the requirements.
- **Does `authors` map to `ImportedAuthor` (not `Author`)?** Yes — `Author` is a static pre-seeded type; `ImportedAuthor` is the user-managed Dexie record. The Supabase table `authors` backs `ImportedAuthor`. Columns must match `ImportedAuthor` interface, not `Author`.
- **`books.chapters` column type?** `JSONB` — stores `BookChapter[]` from types.ts.
- **`books.current_position` column type?** `JSONB` — stores `ContentPosition` union.
- **Trigger name pattern?** Requirements specify `{tablename}_set_updated_at`. P1 migration uses `set_updated_at` (without table prefix). The requirements override — use `{tablename}_set_updated_at` to match AC4. This avoids cross-table trigger name collision if triggers are ever listed globally.

### Deferred to Implementation

- Exact `ON CONFLICT (id) DO UPDATE` field list in `upsert_book_progress()` — implementation should exclude `user_id`, `title`, `format`, `source_type`, `source_url` (immutable identity fields) from the DO UPDATE clause, preserving them from the INSERT.
- Whether `upsert_book_progress()` needs a separate ON CONFLICT for the initial INSERT or can rely on EXCLUDED — implementation discovery.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Migration file: 20260413000003_p2_library.sql
─────────────────────────────────────────────
Header comment block
  ├── Purpose, ordering, idempotency
  ├── books.source decomposition note
  └── Extension dependency note (no re-create)

BEGIN;

Unit 1: imported_courses
  CREATE TABLE IF NOT EXISTS …
  CREATE INDEX IF NOT EXISTS idx_imported_courses_user_updated …
  ALTER TABLE … ENABLE ROW LEVEL SECURITY
  DROP POLICY IF EXISTS … / CREATE POLICY "users_own_data" FOR ALL …
  DROP TRIGGER IF EXISTS … / CREATE TRIGGER imported_courses_set_updated_at …

Unit 2: imported_videos
  (same structure; "order" double-quoted; extra idx_imported_videos_course index)

Unit 3: imported_pdfs
  (same structure; minimal columns)

Unit 4: authors
  (same structure; course_ids TEXT[], social_links JSONB)

Unit 5: books
  (same structure; source_type + source_url decomposed; chapters/current_position JSONB)

Unit 6: upsert_book_progress()
  CREATE OR REPLACE FUNCTION …
  SECURITY DEFINER, SET search_path = public, pg_temp
  Auth guard: p_user_id IS DISTINCT FROM auth.uid()
  Timestamp clamp: LEAST(p_updated_at, now() + '5 minutes')
  INSERT … ON CONFLICT (id) DO UPDATE SET
    progress = GREATEST(books.progress, EXCLUDED.progress),
    status   = CASE WHEN new_progress > old_progress THEN … END,
    updated_at = GREATEST(books.updated_at, v_clamped)
  REVOKE EXECUTE FROM PUBLIC
  GRANT EXECUTE TO authenticated
  COMMENT ON FUNCTION …

COMMIT;

Rollback file: 20260413000003_p2_library_rollback.sql
─────────────────────────────────────────────────────
BEGIN;
DROP FUNCTION IF EXISTS public.upsert_book_progress(…);
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.authors CASCADE;
DROP TABLE IF EXISTS public.imported_pdfs CASCADE;
DROP TABLE IF EXISTS public.imported_videos CASCADE;
DROP TABLE IF EXISTS public.imported_courses CASCADE;
COMMIT;
```

## Implementation Units

- [ ] **Unit 1: `imported_courses` table**

**Goal:** Create the `imported_courses` table with all course metadata columns, RLS policy, moddatetime trigger, and compound index.

**Requirements:** R1, R3, R4, R5, R7, R9

**Dependencies:** P0 migration (extensions installed)

**Files:**
- Modify: `supabase/migrations/20260413000003_p2_library.sql` (create if not exists)

**Approach:**
- Columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `description TEXT`, `imported_at TIMESTAMPTZ NOT NULL`, `category TEXT NOT NULL DEFAULT ''`, `tags TEXT[] NOT NULL DEFAULT '{}'`, `status TEXT NOT NULL DEFAULT 'not-started' CHECK (status IN ('not-started', 'active', 'completed', 'paused'))`, `video_count INT NOT NULL DEFAULT 0`, `pdf_count INT NOT NULL DEFAULT 0`, `total_duration FLOAT`, `total_file_size BIGINT`, `max_resolution_height INT`, `source TEXT DEFAULT 'local'`, `youtube_playlist_id TEXT`, `youtube_channel_id TEXT`, `youtube_channel_title TEXT`, `youtube_thumbnail_url TEXT`, `youtube_published_at TIMESTAMPTZ`, `last_refreshed_at TIMESTAMPTZ`, `author_id TEXT`, `thumbnail_url TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Status CHECK uses hyphenated values matching `LearnerCourseStatus` — not snake_case (R9)
- `thumbnail_url` is NULL by default; populated by E94-S04
- `author_id` is TEXT (not UUID FK) — matches `ImportedAuthor.id: string` in Dexie
- Trigger name: `imported_courses_set_updated_at`
- Compound index: `idx_imported_courses_user_updated ON public.imported_courses (user_id, updated_at)`

**Patterns to follow:**
- `supabase/migrations/20260413000002_p1_learning_content.sql` — Unit 1 (notes) structure verbatim
- Policy name: `"users_own_data"` — matches AC3 pattern

**Test scenarios:**
- Happy path: `INSERT` a row with `status = 'not-started'` — succeeds and row is readable
- Happy path: `UPDATE` a row — `updated_at` auto-advances via trigger
- Edge case: `INSERT` with `status = 'not_started'` (snake_case) — must fail CHECK constraint
- Error path: `INSERT` as userA, `SELECT` as userB — RLS blocks cross-user read
- Error path: `INSERT` twice with same `id` — constraint error (PK)
- Idempotency: run `CREATE TABLE IF NOT EXISTS` statement twice — no error

**Verification:**
- `information_schema.tables` shows `imported_courses` in `public` schema
- `information_schema.triggers` shows `imported_courses_set_updated_at` trigger
- `pg_policies` shows one `FOR ALL` policy on `imported_courses`
- `idx_imported_courses_user_updated` index exists

- [ ] **Unit 2: `imported_videos` table**

**Goal:** Create the `imported_videos` table with the double-quoted `"order"` column, JSONB chapters, extra course index, RLS, trigger, and compound index.

**Requirements:** R1, R3, R4, R5, R7

**Dependencies:** None — follows Unit 1 in the migration file by convention only (no FK constraint between these tables; units can be authored in any order within the file)

**Files:**
- Modify: `supabase/migrations/20260413000003_p2_library.sql`

**Approach:**
- Columns: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users`, `course_id TEXT NOT NULL`, `filename TEXT NOT NULL DEFAULT ''`, `path TEXT NOT NULL DEFAULT ''`, `duration FLOAT NOT NULL DEFAULT 0`, `format TEXT NOT NULL DEFAULT 'mp4'`, `"order" INT NOT NULL DEFAULT 0`, `file_size BIGINT`, `width INT`, `height INT`, `youtube_video_id TEXT`, `youtube_url TEXT`, `thumbnail_url TEXT`, `description TEXT`, `chapters JSONB`, `removed_from_youtube BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `"order"` must be double-quoted in DDL — it is a SQL reserved word
- `chapters JSONB` stores `Chapter[]` from YouTube auto-detection
- Two indexes: `idx_imported_videos_user_updated (user_id, updated_at)` and `idx_imported_videos_course (user_id, course_id)`
- Trigger name: `imported_videos_set_updated_at`

**Patterns to follow:**
- Same as Unit 1; add second index after first (same pattern as `idx_embeddings_vector_hnsw` + `idx_embeddings_user_updated` in P1)

**Test scenarios:**
- Happy path: `INSERT` a video row — `"order"` column stores integer value correctly
- Happy path: `INSERT` with `chapters = '[{"title":"Intro","start":0}]'::jsonb` — succeeds
- Edge case: `INSERT` without quoting `order` in a dynamic context — verify column accepts INT
- Error path: `SELECT` as userB on userA video — RLS blocks
- Idempotency: create table twice — no error; create both indexes twice — no error

**Verification:**
- `information_schema.columns` shows `order` column in `imported_videos`
- Both `idx_imported_videos_user_updated` and `idx_imported_videos_course` indexes exist
- `imported_videos_set_updated_at` trigger exists

- [ ] **Unit 3: `imported_pdfs` table**

**Goal:** Create the `imported_pdfs` table with `file_url` placeholder, RLS, trigger, and compound index.

**Requirements:** R1, R3, R4, R5, R7

**Dependencies:** None beyond extensions

**Files:**
- Modify: `supabase/migrations/20260413000003_p2_library.sql`

**Approach:**
- Columns: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users`, `course_id TEXT NOT NULL`, `filename TEXT NOT NULL DEFAULT ''`, `path TEXT NOT NULL DEFAULT ''`, `page_count INT NOT NULL DEFAULT 0`, `file_url TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `file_url` is NULL until E94-S04 wires Storage upload
- Trigger name: `imported_pdfs_set_updated_at`
- Index: `idx_imported_pdfs_user_updated (user_id, updated_at)`

**Patterns to follow:**
- Same as Unit 1 (simplified column list)

**Test scenarios:**
- Happy path: `INSERT` a PDF row with `file_url = NULL` — succeeds
- Error path: RLS cross-user read blocked
- Idempotency: re-run creates nothing new

**Verification:**
- `information_schema.tables` shows `imported_pdfs`
- `file_url` column exists and is nullable
- `imported_pdfs_set_updated_at` trigger exists

- [ ] **Unit 4: `authors` table**

**Goal:** Create the `authors` table with JSONB `social_links` and `TEXT[]` `course_ids`, RLS, trigger, and compound index.

**Requirements:** R1, R3, R4, R5, R7

**Dependencies:** None beyond extensions

**Files:**
- Modify: `supabase/migrations/20260413000003_p2_library.sql`

**Approach:**
- Columns: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users`, `name TEXT NOT NULL`, `title TEXT`, `bio TEXT`, `short_bio TEXT`, `photo_url TEXT`, `course_ids TEXT[] NOT NULL DEFAULT '{}'`, `specialties TEXT[]`, `years_experience INT`, `education TEXT`, `social_links JSONB`, `featured_quote TEXT`, `is_preseeded BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `social_links` is JSONB (not decomposed) — matches AC1 and `ImportedAuthor.socialLinks` which is `{ website?, twitter?, linkedin? }` — schema-flexible enough for JSONB
- `course_ids TEXT[] NOT NULL DEFAULT '{}'` — matches `ImportedAuthor.courseIds: string[]`
- Trigger name: `authors_set_updated_at`
- Index: `idx_authors_user_updated (user_id, updated_at)`

**Patterns to follow:**
- Same as Unit 1; `social_links JSONB` follows `learner_models.quiz_stats JSONB` pattern

**Test scenarios:**
- Happy path: `INSERT` author with `social_links = '{"website":"https://example.com"}'::jsonb` — succeeds
- Happy path: `INSERT` with `course_ids = ARRAY['course-abc']` — array stored correctly
- Edge case: `INSERT` with `course_ids = '{}'` (default) — succeeds
- Error path: RLS cross-user blocked
- Idempotency: no error on re-run

**Verification:**
- `information_schema.columns` shows `social_links` (JSONB) and `course_ids` (ARRAY) in `authors`
- `authors_set_updated_at` trigger exists

- [ ] **Unit 5: `books` table**

**Goal:** Create the `books` table with decomposed `source_type`/`source_url`, 0–100 progress CHECK, JSONB `chapters`/`current_position`, and all standard RLS/trigger/index boilerplate.

**Requirements:** R1, R3, R4, R5, R6, R7, R10

**Dependencies:** None beyond extensions

**Files:**
- Modify: `supabase/migrations/20260413000003_p2_library.sql`

**Approach:**
- Columns: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users`, `title TEXT NOT NULL`, `author TEXT`, `narrator TEXT`, `format TEXT NOT NULL DEFAULT 'epub'`, `status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'finished', 'abandoned'))`, `cover_url TEXT`, `description TEXT`, `genre TEXT`, `tags TEXT[] NOT NULL DEFAULT '{}'`, `chapters JSONB NOT NULL DEFAULT '[]'`, `source_type TEXT NOT NULL CHECK (source_type IN ('local', 'remote', 'opds', 'abs'))`, `source_url TEXT`, `current_position JSONB`, `total_pages INT`, `total_duration FLOAT`, `progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100)`, `isbn TEXT`, `asin TEXT`, `rating FLOAT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `last_opened_at TIMESTAMPTZ`, `finished_at TIMESTAMPTZ`, `file_size BIGINT`, `abs_server_id TEXT`, `abs_item_id TEXT`, `linked_book_id TEXT`, `series TEXT`, `series_sequence TEXT`, `playback_speed FLOAT`
- `source_type` CHECK has no `'fileHandle'` variant — this is stripped by syncableWrite in E94-S02
- `source_url` is nullable (NULL when `source_type = 'local'`)
- `progress REAL CHECK (progress BETWEEN 0 AND 100)` — 0–100, not 0–1 (R10)
- `status` CHECK matches `BookStatus` from `src/data/types.ts` line 686
- Trigger name: `books_set_updated_at`
- Index: `idx_books_user_updated (user_id, updated_at)`

**Note on column completeness:** All 30+ columns from the `Book` interface are mapped now to avoid `ALTER TABLE` in later epics. Columns `abs_server_id`, `abs_item_id`, `linked_book_id`, `series`, `series_sequence`, and `playback_speed` are placeholders for future epic features (ABS integration, series tracking, audio playback).

**Patterns to follow:**
- Column naming: Dexie camelCase fields → snake_case columns (e.g., `createdAt → created_at`, `absServerId → abs_server_id`)
- `chapters JSONB` follows `messages JSONB NOT NULL DEFAULT '[]'` pattern from `chat_conversations`

**Test scenarios:**
- Happy path: `INSERT` book with `source_type = 'remote'`, `source_url = 'https://...'`, `progress = 0` — succeeds
- Happy path: `INSERT` book with `source_type = 'local'`, `source_url = NULL` — succeeds
- Happy path: `UPDATE` book `progress = 50.5` — stored as REAL
- Edge case: `INSERT` with `progress = 100` — valid; `progress = 100.0001` — fails CHECK
- Edge case: `INSERT` with `progress = -1` — fails CHECK
- Error path: `INSERT` with `source_type = 'fileHandle'` — fails CHECK constraint (R6)
- Error path: `INSERT` with `status = 'read'` — fails CHECK
- Error path: RLS cross-user blocked
- Idempotency: no error on re-run

**Verification:**
- `information_schema.columns` shows `source_type`, `source_url` (no `source` column)
- `books_set_updated_at` trigger exists
- `idx_books_user_updated` index exists

- [ ] **Unit 6: `upsert_book_progress()` function**

**Goal:** Create a SECURITY DEFINER function that atomically upserts a book row with monotonic progress enforcement and server-side status derivation.

**Requirements:** R2, R7

**Dependencies:** Unit 5 (`books` table must exist)

**Files:**
- Modify: `supabase/migrations/20260413000003_p2_library.sql`

**Decision:** UPDATE-only. The `books` row must pre-exist (created via syncableWrite LWW). If the book row is not found, the function raises `P0002`. There is no INSERT path in this function.

**Corrected function definition:**

```sql
CREATE OR REPLACE FUNCTION public.upsert_book_progress(
  p_user_id    UUID,
  p_book_id    UUID,
  p_progress   REAL,
  p_updated_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clamped_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes');
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.books SET
    progress   = GREATEST(progress, p_progress),
    status     = CASE
                   WHEN GREATEST(progress, p_progress) >= 100 THEN 'finished'
                   WHEN GREATEST(progress, p_progress) > 0 AND status = 'unread' THEN 'reading'
                   ELSE status
                 END,
    updated_at = GREATEST(updated_at, v_clamped_at)
  WHERE id = p_book_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'book not found or not owned by caller'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_book_progress(UUID, UUID, REAL, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_book_progress(UUID, UUID, REAL, TIMESTAMPTZ) TO authenticated;
```

**Key decisions:**
1. UPDATE-only: book row must pre-exist via syncableWrite (LWW). If NOT FOUND, raises P0002.
2. `SET search_path = public, pg_temp` prevents schema injection attacks.
3. `updated_at` clamped to `now()+5min` to prevent future-timestamp cursor poisoning.
4. Status advances: `unread→reading` (progress > 0), `reading/unread→finished` (progress >= 100). Never regresses.
5. `REVOKE FROM PUBLIC` + `GRANT TO authenticated` (Supabase grants anon by default — must revoke).
6. Intentional progress reset flows through syncableWrite (full-row LWW bypasses the GREATEST guard).
7. Ownership guard: `WHERE id = p_book_id AND user_id = p_user_id` prevents cross-user writes even in SECURITY DEFINER context (P1 fix).

**Patterns to follow:**
- `public.upsert_vocabulary_mastery()` in `supabase/migrations/20260413000002_p1_learning_content.sql` — structural template (note: this function diverges by being UPDATE-only, not UPSERT)
- `LEAST(p_updated_at, now() + interval '5 minutes')` clamp — mandatory (institutional learning)
- `IS DISTINCT FROM` auth guard — mandatory (handles NULL `auth.uid()`)

**Test scenarios:**
- Happy path: pre-insert a book row with `progress = 0`, then call with `p_progress = 80` — progress advances to 80, `status = 'reading'`
- Happy path: call with `p_progress = 100` — `status` becomes `'finished'`
- Monotonic: book at `progress = 80`, call with `p_progress = 60` — progress stays 80, status unchanged
- Monotonic: book at `progress = 80`, call with `p_progress = 90` — progress advances to 90, `status = 'reading'`
- Edge case: call with `p_progress = 0` — progress stays at existing value (GREATEST), status unchanged
- Edge case: `p_updated_at` far in future — clamped to `now() + 5 minutes`
- Error path: call with `p_user_id` ≠ `auth.uid()` — SQLSTATE 42501 raised
- Error path: call as unauthenticated user (`auth.uid() = NULL`) — auth guard fires (IS DISTINCT FROM handles NULL)
- Error path: call with a `p_book_id` that does not exist — raises P0002 (NOT FOUND)
- Integration: call `upsert_book_progress()` then `SELECT` from `books` as the same authenticated user — row visible via RLS

**Verification:**
- `\df upsert_book_progress` shows function with correct signature
- Progress monotonic test passes (see manual checklist in requirements)
- Completion test: `p_progress = 100` → `status = 'finished'`
- Cross-user call raises 42501
- Call with non-existent book raises P0002

- [ ] **Unit 7: Rollback script**

**Goal:** Create the rollback script that cleanly tears down all P2 objects in reverse dependency order.

**Requirements:** R8

**Dependencies:** Units 1–6 (drops what they create)

**Files:**
- Create: `supabase/migrations/rollback/20260413000003_p2_library_rollback.sql`

**Approach:**
- Follow `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql` structure
- Drop function first (non-blocking; references table but DROP FUNCTION is safe)
- Drop tables in reverse dependency order: `books → authors → imported_pdfs → imported_videos → imported_courses` (all with `CASCADE`)
- Wrap in `BEGIN; ... COMMIT;`
- Use `DROP FUNCTION IF EXISTS ... (full signature)` and `DROP TABLE IF EXISTS ... CASCADE`
- Header comment identifies which migration this rolls back

**Patterns to follow:**
- `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql`

**Test scenarios:**
- Test expectation: none — rollback script is destructive dev tooling; verification is manual (confirm tables are absent after run)

**Verification:**
- After executing rollback: `information_schema.tables` shows no P2 tables in `public` schema
- Re-running rollback produces no errors (all `IF EXISTS`)

## System-Wide Impact

- **Interaction graph:** No TypeScript code is touched in this story. The five tables are read/written by the E92 sync engine via `syncableWrite` in downstream E94 stories. The `upsert_book_progress()` function will be called by the `books` monotonic upload path in E94-S02.
- **Error propagation:** SQL errors in the migration abort the transaction (`BEGIN/COMMIT` wrapping). RLS violations surface as Postgres errors to the client.
- **State lifecycle risks:** `thumbnail_url` and `file_url` are NULL placeholders — downstream Storage stories must not assume non-null. `books.source_url` is nullable for `'local'` type; query code must handle NULL.
- **API surface parity:** `imported_videos."order"` must be referenced with double-quotes in any raw SQL queries (Supabase client handles this automatically via column metadata).
- **Integration coverage:** Trigger correctness (moddatetime fires on UPDATE) and RLS isolation (cross-user blocked) require live Supabase testing — not exercisable offline.
- **Unchanged invariants:** P0 tables (`content_progress`, `study_sessions`, `video_progress`) and P1 tables (all 11) are not modified. Extensions are not re-created. Existing migrations are not edited.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `"order"` keyword confusion — DDL author forgets double-quotes | Header comment and per-unit comment call this out explicitly; test by inserting a row and reading back the column |
| `books.progress` range documented as 0–1 in the epics doc (incorrect) | Requirements override: 0–100 per `types.ts` line 774. Plan and AC both specify 0–100 |
| `upsert_book_progress()` status derivation fires when progress does not advance | Use CASE WHEN on `EXCLUDED.progress > books.progress` condition to guard status update |
| Far-future `p_updated_at` pins sync cursor | LEAST clamp applied — mandatory per E93-S01 institutional learning |
| `source_type = 'fileHandle'` slipping into CHECK | CHECK explicitly excludes `'fileHandle'`; test with INSERT attempt |
| Rollback run order — dropping books before authors causes no issues (no FK between them) | No inter-P2 FKs exist; any order works, but reverse creation order is conventional |

## Documentation / Operational Notes

- Run migration against local Supabase (titan.local) via `supabase db push` or `psql` direct execution.
- Manual verification checklist in the requirements doc covers all 5 acceptance criteria with specific SQL probes.
- If migration is applied to a Supabase instance that already has partial P2 tables (e.g., from a failed earlier run), idempotency guards (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`) ensure a clean re-run.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e94-s01-p2-supabase-migrations-library-requirements.md](docs/brainstorms/2026-04-19-e94-s01-p2-supabase-migrations-library-requirements.md)
- Related code: `src/lib/sync/tableRegistry.ts` (P2 section, lines 289–352)
- Related code: `src/data/types.ts` (ImportedCourse, ImportedVideo, ImportedPdf, ImportedAuthor, Book, ContentSource, BookStatus)
- Template migration: `supabase/migrations/20260413000002_p1_learning_content.sql`
- Rollback template: `supabase/migrations/rollback/20260413000002_p1_learning_content_rollback.sql`
- Institutional learnings: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`
- Design reference: `docs/plans/2026-03-31-supabase-data-sync-design.md`
