---
story_id: E94-S01
story_name: "P2 Supabase Migrations: Courses, Videos, PDFs, Authors, Books"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 94.01: P2 Supabase Migrations — Courses, Videos, PDFs, Authors, Books

## Story

As the sync engine (E94-S02 through E94-S07),
I want all P2 library tables and their supporting functions present in Supabase,
so that imported courses, videos, PDFs, author profiles, and books can sync across devices.

## Acceptance Criteria

**AC1 — All 5 P2 tables exist with correct columns and types:**

- `imported_courses` — id UUID PK, user_id UUID FK, name TEXT NOT NULL, description TEXT, category TEXT, tags TEXT[], status TEXT (CHECK: 'not-started'|'active'|'completed'|'paused'), video_count INT NOT NULL DEFAULT 0, pdf_count INT NOT NULL DEFAULT 0, total_duration REAL, total_file_size BIGINT, max_resolution_height INT, source TEXT NOT NULL DEFAULT 'local' (CHECK: 'local'|'youtube'), author_id UUID, youtube_playlist_id TEXT, youtube_channel_id TEXT, youtube_channel_title TEXT, youtube_thumbnail_url TEXT, youtube_published_at TIMESTAMPTZ, last_refreshed_at TIMESTAMPTZ, thumbnail_url TEXT, imported_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- `imported_videos` — id UUID PK, user_id UUID FK, course_id UUID NOT NULL, filename TEXT NOT NULL, path TEXT NOT NULL, duration REAL NOT NULL DEFAULT 0, format TEXT NOT NULL (CHECK: 'mp4'|'mkv'|'avi'|'webm'|'ts'), "order" INT NOT NULL DEFAULT 0, file_size BIGINT, width INT, height INT, youtube_video_id TEXT, youtube_url TEXT, thumbnail_url TEXT, description TEXT, chapters JSONB, removed_from_youtube BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- `imported_pdfs` — id UUID PK, user_id UUID FK, course_id UUID NOT NULL, filename TEXT NOT NULL, path TEXT NOT NULL, page_count INT NOT NULL DEFAULT 0, file_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- `authors` — id UUID PK, user_id UUID FK, name TEXT NOT NULL, title TEXT, bio TEXT, short_bio TEXT, photo_url TEXT, course_ids TEXT[] NOT NULL DEFAULT '{}', specialties TEXT[], years_experience INT, education TEXT, social_links JSONB, featured_quote TEXT, is_preseeded BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- `books` — id UUID PK, user_id UUID FK, title TEXT NOT NULL, author TEXT, narrator TEXT, format TEXT NOT NULL (CHECK: 'epub'|'pdf'|'audiobook'|'epub+audiobook'), status TEXT NOT NULL DEFAULT 'unread' (CHECK: 'unread'|'reading'|'finished'|'abandoned'), cover_url TEXT, description TEXT, genre TEXT, tags TEXT[] NOT NULL DEFAULT '{}', chapters JSONB, current_position JSONB, total_pages INT, total_duration REAL, progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100), isbn TEXT, asin TEXT, rating REAL, source_type TEXT NOT NULL (CHECK: 'local'|'remote'|'opds'|'abs'), source_url TEXT, file_url TEXT, file_size BIGINT, last_opened_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, abs_server_id UUID, abs_item_id TEXT, linked_book_id UUID, series TEXT, series_sequence TEXT, playback_speed REAL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

**AC2 — `upsert_book_progress()` function exists and is monotonic:**
- Signature: `upsert_book_progress(p_user_id UUID, p_book_id UUID, p_progress REAL, p_updated_at TIMESTAMPTZ) RETURNS void`
- Uses `GREATEST(existing.progress, p_progress)` — progress never regresses
- Also sets `status = 'reading'` when new progress > 0 AND < 100; `status = 'finished'` when new progress = 100 (both conditioned on new progress winning)
- SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard
- `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated`
- Call with progress=0.8, then progress=0.6 → stays 0.8 (monotonic)
- Call with progress=1.0 → status becomes 'finished'

**AC3 — Standard `FOR ALL` RLS policies on all 5 tables:**
- Each table has a single `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` policy
- Cross-user access: a query with `auth.uid() = userA` cannot read or modify userB rows

**AC4 — `moddatetime` trigger on `updated_at` for all 5 tables:**
- All 5 tables have a `BEFORE UPDATE` trigger calling `extensions.moddatetime('updated_at')`
- Trigger is named `{tablename}_set_updated_at` (table-scoped, avoids name collisions)
- The `moddatetime` extension is already installed in E92-S01 — do NOT re-create it

**AC5 — Incremental download compound indexes on all 5 tables:**
- Each table has `CREATE INDEX IF NOT EXISTS idx_{tablename}_user_updated ON public.{tablename} (user_id, updated_at)` for E92-S06 download cursor
- `imported_videos` additionally has `CREATE INDEX IF NOT EXISTS idx_imported_videos_course ON public.imported_videos (user_id, course_id)` for per-course queries
- `books` additionally has no extra FK index beyond the cursor (abs_item_id and linked_book_id are not queried server-side yet)

**AC6 — `books.source` field handled correctly:**
- `books` table has `source_type TEXT NOT NULL` and `source_url TEXT` columns only
- `source_type` stores the discriminant ('local', 'remote', 'opds', 'abs') — the `fileHandle` variant is stripped by `syncableWrite` before upload (handled in E94-S02 wiring)
- No `source` JSONB column in Supabase — the Dexie `ContentSource` union type is decomposed into `source_type + source_url`
- `source_url` is NULL when `source_type = 'local'` (fileHandle was stripped, no URL to store)

**AC7 — Migration filename and structure:**
- Migration file at `supabase/migrations/20260413000003_p2_library.sql`
- Rollback script at `supabase/migrations/rollback/20260413000003_p2_library_rollback.sql`
- Wrapped in `BEGIN; ... COMMIT;` transaction
- All statements use `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` for idempotency
- Re-running the migration produces no errors

**AC8 — `imported_courses.status` field uses Dexie enum values (not Supabase snake_case):**
- Dexie `LearnerCourseStatus` type: `'not-started' | 'active' | 'completed' | 'paused'`
- Supabase `status` CHECK constraint uses the same hyphenated values (not `not_started` etc.)
- This is intentional — avoids a fieldMap entry just for status casing

**AC9 — `books.progress` is 0–100 (integer percentage), not 0–1:**
- The Dexie `Book.progress: number` field stores 0–100
- Supabase column is `REAL CHECK (progress BETWEEN 0 AND 100)`
- `upsert_book_progress()` accepts `p_progress REAL` in the same 0–100 range
- The epics doc's "0–1" range description is incorrect — actual Dexie type is 0–100 (verify with `Book.progress` in `src/data/types.ts`)

## Tasks / Subtasks

- [ ] Task 1: Create migration file `supabase/migrations/20260413000003_p2_library.sql` (AC: 1-9)
  - [ ] 1.1 File header comment: reference E94-S01, design doc, migration ordering rationale, idempotency policy, note on `books.source` decomposition
  - [ ] 1.2 Unit 1 — `imported_courses` table: create table with all columns from AC1 (including YouTube fields, thumbnail_url for Storage URL), `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.3 Unit 2 — `imported_videos` table: create table with `"order"` (quoted — reserved word in some SQL), `chapters JSONB` for YouTube chapter data, `moddatetime` trigger, `(user_id, updated_at)` index, `(user_id, course_id)` index, RLS policy
  - [ ] 1.4 Unit 3 — `imported_pdfs` table: create table with `file_url TEXT` (Storage URL, populated by E94-S04), `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.5 Unit 4 — `authors` table: create table with `social_links JSONB` (not decomposed into columns — matches Dexie `ImportedAuthor.socialLinks` object), `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.6 Unit 5 — `books` table: create table with `source_type` + `source_url` decomposition (NOT a `source` JSONB), `chapters JSONB`, `current_position JSONB`, `tags TEXT[]`, `moddatetime` trigger, `(user_id, updated_at)` index, RLS policy
  - [ ] 1.7 Unit 6 — `upsert_book_progress()` function: SECURITY DEFINER, `p_user_id IS DISTINCT FROM auth.uid()` guard, `GREATEST()` on progress, conditional status update, `REVOKE FROM PUBLIC; GRANT TO authenticated`
  - [ ] 1.8 Close `BEGIN; ... COMMIT;` transaction wrapper

- [ ] Task 2: Create rollback script `supabase/migrations/rollback/20260413000003_p2_library_rollback.sql` (AC: 7)
  - [ ] 2.1 `DROP FUNCTION IF EXISTS public.upsert_book_progress(UUID, UUID, REAL, TIMESTAMPTZ)`
  - [ ] 2.2 `DROP TABLE IF EXISTS public.books CASCADE`
  - [ ] 2.3 `DROP TABLE IF EXISTS public.authors CASCADE`
  - [ ] 2.4 `DROP TABLE IF EXISTS public.imported_pdfs CASCADE`
  - [ ] 2.5 `DROP TABLE IF EXISTS public.imported_videos CASCADE`
  - [ ] 2.6 `DROP TABLE IF EXISTS public.imported_courses CASCADE`

- [ ] Task 3: Manual verification checklist (AC: 1-9)
  - [ ] 3.1 All 5 tables exist: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('imported_courses','imported_videos','imported_pdfs','authors','books')` — expect 5 rows
  - [ ] 3.2 Verify `books.source_type` CHECK: attempt `INSERT` with `source_type = 'fileHandle'` — expect constraint violation
  - [ ] 3.3 Verify `upsert_book_progress()` monotonic: insert book at progress=80, call with 60, confirm stays 80
  - [ ] 3.4 Verify `upsert_book_progress()` completion: call with progress=100, confirm status='finished'
  - [ ] 3.5 Verify RLS: query as userA cannot read userB rows
  - [ ] 3.6 Verify idempotency: apply migration twice — no errors on second run
  - [ ] 3.7 Verify `moddatetime` trigger on all 5 tables: `SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public'` — 5 `set_updated_at` triggers present

## Design Guidance

No UI components. This is a pure SQL migration story.

Follow the same structural pattern as `20260413000001_p0_sync_foundation.sql` and `20260413000002_p1_learning_content.sql`:
- Header comment block explaining purpose, ordering, and non-obvious invariants
- `BEGIN; ... COMMIT;` transaction wrapper
- One SQL unit comment block per table (e.g., `-- ─── Unit 1: imported_courses ───`)
- `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` everywhere for idempotency
- Functions: SECURITY DEFINER, `SET search_path = public, pg_temp`, explicit `REVOKE/GRANT`

## Implementation Notes

### Migration File Ordering

The filename prefix `20260413000003` orders this migration after P0 (`20260413000001`) and P1 (`20260413000002`). The `moddatetime`, `pgcrypto`, and `vector` extensions are already installed in P0 — do NOT attempt to re-create them here.

### `books.source` Field Decomposition

The Dexie `Book.source: ContentSource` is a discriminated union:
```ts
type ContentSource =
  | { type: 'local'; opfsPath: string }
  | { type: 'remote'; url: string; auth?: RemoteAuth }
  | { type: 'fileHandle'; handle: FileSystemFileHandle }
```

Supabase cannot store `FileSystemFileHandle` (non-serializable). The sync wiring story (E94-S02) strips the entire `source` field when `source.type === 'fileHandle'` and preserves it for `'remote'` / `'opds'` / `'abs'`.

The Supabase schema decomposes this into:
- `source_type TEXT NOT NULL CHECK (source_type IN ('local', 'remote', 'opds', 'abs'))` — the discriminant (no 'fileHandle' variant in Supabase)
- `source_url TEXT` — the URL for 'remote'/'opds'/'abs' sources; NULL for 'local'

The E94-S02 wiring story will handle the custom strip logic in `syncableWrite`. The tableRegistry entry for `books` in E92-S03 already has this noted. For this migration story, just create the two decomposed columns with the appropriate CHECK constraint.

### `upsert_book_progress()` Behavior

The function enforces two invariants:
1. Progress is monotonic: `GREATEST(existing.progress, p_progress)` — reading position only advances
2. Status derives from progress: when new progress wins (`p_progress > existing.progress`):
   - `p_progress > 0 AND p_progress < 100` → status = 'reading'
   - `p_progress = 100` → status = 'finished'
   - `p_progress = 0` → no status change (user hasn't started yet)

The status derivation only applies when the new progress value actually wins. If the existing progress is higher, the status is left unchanged.

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
  v_new_status TEXT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Determine status from the incoming progress value
  IF p_progress >= 100 THEN
    v_new_status := 'finished';
  ELSIF p_progress > 0 THEN
    v_new_status := 'reading';
  ELSE
    v_new_status := NULL; -- no status change when progress = 0
  END IF;

  INSERT INTO public.books (id, user_id, progress, status, updated_at)
    VALUES (p_book_id, p_user_id, p_progress,
            COALESCE(v_new_status, 'unread'), p_updated_at)
  ON CONFLICT (id) DO UPDATE
    SET progress   = GREATEST(books.progress, EXCLUDED.progress),
        status     = CASE
                       WHEN EXCLUDED.progress > books.progress AND v_new_status IS NOT NULL
                       THEN v_new_status
                       ELSE books.status
                     END,
        updated_at = GREATEST(books.updated_at, EXCLUDED.updated_at);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_book_progress(UUID, UUID, REAL, TIMESTAMPTZ) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_book_progress(UUID, UUID, REAL, TIMESTAMPTZ) TO authenticated;
```

### `moddatetime` Trigger Syntax

Follow the pattern from the P0 and P1 migrations:
```sql
CREATE TRIGGER imported_courses_set_updated_at
  BEFORE UPDATE ON public.imported_courses
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
```

Prefix the trigger name with the table name to avoid conflicts if Postgres requires unique trigger names within a schema.

### `imported_courses.status` vs Supabase Naming Convention

The Dexie `LearnerCourseStatus` uses hyphenated values (`'not-started'`, `'active'`, `'completed'`, `'paused'`). Preserve these exact strings in the Supabase CHECK constraint — do not convert to `'not_started'` snake_case. This avoids needing a fieldMap entry just for status casing and keeps the field round-trip clean.

```sql
status TEXT NOT NULL DEFAULT 'not-started'
  CHECK (status IN ('not-started', 'active', 'completed', 'paused'))
```

### `imported_videos."order"` Reserved Word

The `order` column name must be double-quoted in Postgres since ORDER is a reserved SQL keyword. In the CREATE TABLE statement:
```sql
"order" INT NOT NULL DEFAULT 0
```
The Dexie field name is `order` (unquoted in TypeScript). The tableRegistry fieldMap for `importedVideos` has `fieldMap: {}` (no mapping needed — Supabase storage layer handles quoting automatically in the upsert).

### `authors.course_ids` TEXT[]

The Dexie `ImportedAuthor.courseIds: string[]` stores linked imported course IDs as a string array. Store as `TEXT[]` in Supabase (same pattern as `notes.tags`). The sync engine serializes this as a JSON array; Supabase coerces JSON arrays to `TEXT[]` for array-typed columns.

### `books.chapters` and `books.current_position` as JSONB

These are complex typed objects in TypeScript:
- `BookChapter[]` — array of `{ id, bookId, title, order, position: ContentPosition }`
- `ContentPosition` — discriminated union `{ type: 'cfi'|'time'|'page', ... }`

Store both as opaque JSONB. No server-side queries are performed on these fields — they are client-side navigation state only. The sync engine will serialize/deserialize them as JSON blobs.

### `books.progress` — Confirmed 0–100 Range

Inspecting `src/data/types.ts`:
```ts
export interface Book {
  progress: number // 0-100
```
The progress field is 0–100 (integer percentage). The epics doc description of "0–1" is **incorrect**. Supabase column is `REAL CHECK (progress BETWEEN 0 AND 100)`.

### `imported_courses.thumbnail_url` Column

Adding `thumbnail_url TEXT` to `imported_courses` now (even though E94-S04 handles the Storage upload) keeps the migration atomic and avoids a follow-up fixup migration. The column is NULL until E94-S04 wiring runs. Same pattern as `imported_pdfs.file_url`.

### RLS Policy Pattern

Following E92-S01 and E93-S01 conventions: use a single `FOR ALL` policy for full-CRUD tables (all 5 P2 tables support full CRUD from the client). The `upsert_book_progress()` function uses SECURITY DEFINER for monotonic enforcement, so no split SELECT/INSERT policy is needed:

```sql
CREATE POLICY "users_own_data" ON public.imported_courses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Key Existing Files

| File | Relevance |
|------|-----------|
| `supabase/migrations/20260413000001_p0_sync_foundation.sql` | Pattern reference — table structure, RLS, trigger, function style |
| `supabase/migrations/20260413000002_p1_learning_content.sql` | Most recent pattern reference — P1 migration structure |
| `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` | SECURITY DEFINER function pattern with authz guard |
| `src/data/types.ts` | Source of truth for all TypeScript interfaces — `ImportedCourse`, `ImportedVideo`, `ImportedPdf`, `ImportedAuthor`, `Book` |
| `src/lib/sync/tableRegistry.ts` | P2 registry entries (§ "P2 — Imported content metadata, books, shelves") — field maps and stripFields already defined |
| `docs/planning-artifacts/epics-supabase-data-sync.md` | Story spec — column lists for E94-S01 |
| `docs/plans/2026-03-31-supabase-data-sync-design.md` | Design reference — P2 conflict strategies, `books.source` handling |

## Testing Notes

### Test Strategy

This story is SQL only — no TypeScript code. Testing is manual verification against the self-hosted Supabase instance (titan.local) or via Supabase Studio / `psql`.

Automated coverage for E94-S01 is deferred to E94-S02 wiring stories, which exercise the tables via the sync engine.

### Manual Verification Plan

**Table existence:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'imported_courses', 'imported_videos', 'imported_pdfs', 'authors', 'books'
  );
-- Expected: 5 rows
```

**`books.source_type` CHECK constraint:**
```sql
INSERT INTO public.books (id, user_id, title, format, status, progress, source_type, created_at, updated_at)
  VALUES (gen_random_uuid(), auth.uid(), 'Test Book', 'epub', 'unread', 0, 'fileHandle', now(), now());
-- Expected: ERROR — violates check constraint
```

**`upsert_book_progress()` monotonic test:**
```sql
-- Insert a book at progress=80
INSERT INTO public.books (id, user_id, title, format, status, progress, source_type, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000001', auth.uid(), 'Test', 'epub', 'reading', 80, 'local', now(), now());

-- Try to lower progress
SELECT public.upsert_book_progress(auth.uid(), '00000000-0000-0000-0000-000000000001', 60, now());

-- Verify stays at 80
SELECT progress, status FROM public.books WHERE id = '00000000-0000-0000-0000-000000000001';
-- Expected: progress=80, status='reading'
```

**`upsert_book_progress()` completion test:**
```sql
SELECT public.upsert_book_progress(auth.uid(), '00000000-0000-0000-0000-000000000001', 100, now());
SELECT progress, status FROM public.books WHERE id = '00000000-0000-0000-0000-000000000001';
-- Expected: progress=100, status='finished'
```

**Trigger existence check:**
```sql
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%set_updated_at';
-- Expected: 5 rows (one per P2 table)
```

**Idempotency:**
```bash
supabase db push --local
supabase db push --local
# Expected: no errors on second run
```

### Key Edge Cases

- `books.progress` is 0–100 (not 0–1) — the `CHECK (progress BETWEEN 0 AND 100)` reflects this
- `imported_videos."order"` must be quoted in SQL — double-check the CREATE TABLE syntax
- `authors.course_ids TEXT[]` must default to `'{}'` (empty array), not NULL — `ImportedAuthor.courseIds` is always an array in TypeScript
- `books.source_type` has no 'fileHandle' value in the CHECK constraint — fileHandle books are stripped before upload (E94-S02)
- `upsert_book_progress()` INSERT path: the function must handle both the initial insert case (no existing row) and the update case via `ON CONFLICT`
- `books` has many optional fields — all optional columns must be nullable in Supabase (no unexpected NOT NULL constraints)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] Migration file exists at `supabase/migrations/20260413000003_p2_library.sql`
- [ ] Rollback file exists at `supabase/migrations/rollback/20260413000003_p2_library_rollback.sql`
- [ ] Migration is wrapped in `BEGIN; ... COMMIT;`
- [ ] All 5 tables created (verified against `src/data/types.ts` interfaces)
- [ ] `books.source_type` CHECK does NOT include 'fileHandle' as a valid value
- [ ] `books.progress` is `REAL CHECK (progress BETWEEN 0 AND 100)` — NOT 0–1 range
- [ ] `upsert_book_progress()` is SECURITY DEFINER with `p_user_id IS DISTINCT FROM auth.uid()` guard
- [ ] `upsert_book_progress()` uses `GREATEST()` for monotonic progress enforcement
- [ ] `upsert_book_progress()` sets `status='finished'` when `p_progress = 100`
- [ ] `imported_videos."order"` column is double-quoted in SQL (reserved word)
- [ ] `authors.course_ids` is `TEXT[] NOT NULL DEFAULT '{}'` (not nullable)
- [ ] `imported_courses.status` CHECK uses hyphenated values: `'not-started'`, `'active'`, `'completed'`, `'paused'`
- [ ] `moddatetime` trigger on all 5 tables references `extensions.moddatetime` (installed in E92-S01)
- [ ] Each table has `(user_id, updated_at)` compound index for incremental download cursor
- [ ] `imported_videos` has additional `(user_id, course_id)` index
- [ ] `imported_courses.thumbnail_url TEXT` column present (for E94-S04 Storage URL)
- [ ] `imported_pdfs.file_url TEXT` column present (for E94-S04 Storage URL)
- [ ] All SECURITY DEFINER functions have `REVOKE FROM PUBLIC; GRANT TO authenticated`
- [ ] Migration is idempotent (re-run produces no errors)
- [ ] Manual verification checklist in Testing Notes completed against local Supabase instance
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

N/A — no UI components in this story.

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

**E93-S01 lesson — `updated_at` timestamp clamp in monotonic functions:** The P0 and P1 experience showed that upsert functions should clamp `p_updated_at` to prevent far-future timestamps from pinning the incremental sync cursor permanently: `LEAST(p_updated_at, now() + interval '5 minutes')`. Apply the same clamp in `upsert_book_progress()`.

**E92-S01 R4 lesson — SECURITY DEFINER for monotonic functions:** Monotonic upsert functions require SECURITY DEFINER because they do `ON CONFLICT DO UPDATE` without a full UPDATE RLS policy (the table's `FOR ALL` policy permits UPDATE, but the function is SECURITY DEFINER for defense-in-depth consistent with the pattern established in E92-S01).

**`books.source` decomposition vs JSONB:** The original design doc suggests storing `source` as a JSONB blob. However, `ContentSource` contains a `FileSystemFileHandle` variant that cannot serialize. Decomposing into `source_type + source_url` is safer than storing JSONB that risks embedding a non-serializable handle. The E94-S02 wiring story handles the custom strip logic; this migration just creates the correct decomposed columns.

**`books.status` enum mismatch from E83:** The Dexie `BookStatus` type uses `'unread' | 'reading' | 'finished' | 'abandoned'` (E83), while the epics-supabase-data-sync.md spec lists `'want-to-read' | 'reading' | 'completed' | 'paused'`. The actual Dexie type in `src/data/types.ts` (line ~686) is the authoritative source — use `'unread' | 'reading' | 'finished' | 'abandoned'`. Verify before writing the CHECK constraint.
