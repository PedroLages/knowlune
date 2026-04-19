-- E94-S07: Book Files Storage Integration — add file_url column to books
--
-- Adds a nullable TEXT `file_url` column to `public.books` to store the
-- Supabase Storage URL of the primary book binary file (EPUB, PDF, audiobook).
-- The column is NULL until `_uploadBookFile` in storageSync.ts completes a
-- successful Storage upload and writes back the public URL.
--
-- Key design decisions:
--   - Nullable (no DEFAULT) — existing rows remain NULL until first sync upload.
--   - No index — `file_url` is never queried by this column; it is fetched via
--     the standard LWW table-row sync (SELECT * WHERE user_id = $1 AND updated_at > $2).
--   - No RLS change — the `books` table already has user-scoped RLS from
--     20260413000003_p2_library.sql. This column inherits those policies.
--   - No trigger — the column is written directly by the Storage upload handler
--     via Supabase client SDK (not via syncableWrite), so no moddatetime trigger
--     is needed for this specific column.
--
-- Dependencies:
--   - Runs AFTER 20260413000003_p2_library.sql which creates `public.books`.
--   - Runs AFTER 20260420000001_chapter_mappings.sql (ordering by date prefix).
--
-- Idempotency: `ADD COLUMN IF NOT EXISTS` — safe to re-run.
-- Rollback: supabase/migrations/rollback/20260421000001_books_file_url_rollback.sql

BEGIN;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS file_url TEXT;

COMMIT;
