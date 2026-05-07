-- E94-S04 / Unit 1: Self-contained bucket creation + RLS policies for learning-path-covers.
--
-- Guarantees the bucket exists and its four RLS policies are in place, independent
-- of whether supabase/storage-setup.sql was manually applied.
--
-- Idempotent: bucket uses INSERT ... ON CONFLICT DO NOTHING; policies use
-- DROP POLICY IF EXISTS / CREATE POLICY.

BEGIN;

-- ── Bucket ────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('learning-path-covers', 'learning-path-covers', true, 2097152)
ON CONFLICT (id) DO NOTHING;

-- ── RLS Policies ──────────────────────────────────────────────────────────────
-- Folder-prefix policy: (storage.foldername(name))[1] = auth.uid()::text
-- ensures each user can only access files under their own userId prefix.

-- Public SELECT: anyone can read (public bucket, enables CDN caching)
DROP POLICY IF EXISTS "learning-path-covers: public select" ON storage.objects;
CREATE POLICY "learning-path-covers: public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'learning-path-covers');

-- Authenticated INSERT: user can only write to their own folder prefix
DROP POLICY IF EXISTS "learning-path-covers: owner insert" ON storage.objects;
CREATE POLICY "learning-path-covers: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'learning-path-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated UPDATE: user can only update objects in their own folder
DROP POLICY IF EXISTS "learning-path-covers: owner update" ON storage.objects;
CREATE POLICY "learning-path-covers: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'learning-path-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'learning-path-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated DELETE: user can only delete objects in their own folder
DROP POLICY IF EXISTS "learning-path-covers: owner delete" ON storage.objects;
CREATE POLICY "learning-path-covers: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'learning-path-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
