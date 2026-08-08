-- Reliable cross-device course/learning-track sync (protocol v2).
-- This migration is additive and deliberately preserves unmatched legacy rows.

BEGIN;

-- The client has always carried these portable URL/Drive metadata fields, but
-- older environments did not expose them on imported_videos. Every statement
-- is idempotent so staging and production can converge safely.
ALTER TABLE public.imported_videos
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS embeddable BOOLEAN,
  ADD COLUMN IF NOT EXISTS unembeddable_reason TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_ref JSONB;

-- Remove only the exact 31 rows that are copies of public template entries.
-- Unmatched user rows are intentionally left untouched for source-device
-- recovery and operator review.
DELETE FROM public.learning_path_entries AS e
USING public.learning_path_template_entries AS t
WHERE e.id = t.id
  AND e.path_id IN (t.template_id, 'template_' || t.template_id)
  AND e.course_id IS NOT DISTINCT FROM t.course_id
  AND e.position = t.position;

-- Enforce parent integrity for new writes without rejecting the remaining
-- recoverable legacy orphan rows. Validate only after the orphan audit reaches
-- zero in a later operator-approved migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learning_path_entries_path_id_fkey'
      AND conrelid = 'public.learning_path_entries'::regclass
  ) THEN
    ALTER TABLE public.learning_path_entries
      ADD CONSTRAINT learning_path_entries_path_id_fkey
      FOREIGN KEY (path_id)
      REFERENCES public.learning_paths(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END;
$$;

-- Keep supported private assets within the current Free-plan 50 MiB ceiling.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('pdfs', 'pdfs', false, 52428800),
  ('book-files', 'book-files', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "private course assets owner select" ON storage.objects;
CREATE POLICY "private course assets owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('pdfs', 'book-files')
    AND (storage.foldername(name))[1] = (select auth.uid())::text);

DROP POLICY IF EXISTS "private course assets owner insert" ON storage.objects;
CREATE POLICY "private course assets owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('pdfs', 'book-files')
    AND (storage.foldername(name))[1] = (select auth.uid())::text);

DROP POLICY IF EXISTS "private course assets owner update" ON storage.objects;
CREATE POLICY "private course assets owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('pdfs', 'book-files')
    AND (storage.foldername(name))[1] = (select auth.uid())::text)
  WITH CHECK (bucket_id IN ('pdfs', 'book-files')
    AND (storage.foldername(name))[1] = (select auth.uid())::text);

DROP POLICY IF EXISTS "private course assets owner delete" ON storage.objects;
CREATE POLICY "private course assets owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('pdfs', 'book-files')
    AND (storage.foldername(name))[1] = (select auth.uid())::text);

COMMIT;
