-- E94-S06: Chapter Mappings Sync — chapter_mappings table
--
-- Creates the `chapter_mappings` table that stores EPUB↔audiobook chapter
-- alignment data per user. This data allows the sync engine to propagate
-- chapter mapping work across devices automatically.
--
-- Key design decisions:
--   - Composite PK (epub_book_id, audio_book_id, user_id) — no standalone `id`
--     column. The sync engine uses `upsertConflictColumns` override to target
--     these three columns in the Supabase upsert `onConflict` clause.
--   - `mappings JSONB` stores the ChapterMapping[] array as an opaque blob.
--     No per-entry granularity; the whole array is replaced on each save (LWW).
--   - `deleted BOOLEAN NOT NULL DEFAULT FALSE` supports soft-delete: the client
--     marks a mapping deleted and the sync engine propagates the deletion to
--     other devices, which then remove the Dexie record in _applyRecord.
--   - `computed_at TIMESTAMPTZ` is nullable — chapter mapping may not have been
--     computed yet when first saved.
--   - Download cursor: `idx_chapter_mappings_user_updated (user_id, updated_at)`
--     follows the standard E92 incremental download cursor pattern.
--
-- Dependencies:
--   - Runs AFTER 20260413000003_p2_library.sql (E94-S01) which creates `books`.
--     No hard FK on epub_book_id / audio_book_id (logical references only,
--     consistent with E94 family pattern).
--   - Depends on P0 migration for `extensions.moddatetime` (already installed).
--
-- Idempotency: all statements use IF NOT EXISTS / DROP POLICY IF EXISTS /
-- DROP TRIGGER IF EXISTS. Safe to re-run.
-- Rollback: supabase/migrations/rollback/20260420000001_chapter_mappings_rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.chapter_mappings (
  epub_book_id  UUID         NOT NULL,
  audio_book_id UUID         NOT NULL,
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mappings      JSONB        NOT NULL DEFAULT '[]',
  deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
  computed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (epub_book_id, audio_book_id, user_id)
);

-- Incremental download cursor for E92-S06.
CREATE INDEX IF NOT EXISTS idx_chapter_mappings_user_updated
  ON public.chapter_mappings (user_id, updated_at);

ALTER TABLE public.chapter_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON public.chapter_mappings;
CREATE POLICY "users_own_data"
  ON public.chapter_mappings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS chapter_mappings_set_updated_at ON public.chapter_mappings;
CREATE TRIGGER chapter_mappings_set_updated_at
  BEFORE UPDATE ON public.chapter_mappings
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');

COMMIT;
