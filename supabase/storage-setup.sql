-- E94-S04: Supabase Storage Bucket Setup — manual-apply script.
--
-- Apply this script ONCE per environment (local dev + production) via:
--   psql <connection-string> -f supabase/storage-setup.sql
-- or paste into the Supabase dashboard SQL editor.
--
-- This is intentionally NOT a numbered migration. Supabase Storage bucket
-- creation via INSERT INTO storage.buckets is not idempotent through the
-- standard migration runner in self-hosted setups. All statements use
-- ON CONFLICT DO NOTHING guards — safe to re-run if bucket state is unknown.
--
-- Path convention: {userId}/{recordId}/{filename}
-- RLS policy: (storage.foldername(name))[1] = auth.uid()::text
-- ensures each user can only access files under their own userId prefix.
--
-- Buckets:
--   course-thumbnails  500 KB   — course thumbnail images
--   screenshots        2 MB     — screenshots (upload trigger: E94-S05+)
--   avatars            1 MB     — author profile photos
--   pdfs               100 MB   — imported PDF files
--   book-files         200 MB   — EPUB / audiobook files (upload: E94-S07)
--   book-covers        2 MB     — book cover images

BEGIN;

-- ─── Bucket Definitions ─────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('course-thumbnails', 'course-thumbnails', false, 524288),       -- 500 KB
  ('screenshots',       'screenshots',       false, 2097152),      -- 2 MB
  ('avatars',           'avatars',           false, 1048576),      -- 1 MB
  ('pdfs',              'pdfs',              false, 104857600),     -- 100 MB
  ('book-files',        'book-files',        false, 209715200),    -- 200 MB
  ('book-covers',       'book-covers',       false, 2097152)       -- 2 MB
ON CONFLICT (id) DO NOTHING;

-- ─── RLS Policies ───────────────────────────────────────────────────────────
-- Each bucket gets SELECT, INSERT, and UPDATE policies.
-- DELETE policy omitted intentionally — files are overwritten via upsert.
-- Path segment [1] is the userId folder; [2] is the recordId folder.

-- Enable RLS on storage.objects (already enabled by Supabase, but idempotent):
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── course-thumbnails ──

DROP POLICY IF EXISTS "course-thumbnails: owner select" ON storage.objects;
CREATE POLICY "course-thumbnails: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "course-thumbnails: owner insert" ON storage.objects;
CREATE POLICY "course-thumbnails: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "course-thumbnails: owner update" ON storage.objects;
CREATE POLICY "course-thumbnails: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'course-thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── screenshots ──

DROP POLICY IF EXISTS "screenshots: owner select" ON storage.objects;
CREATE POLICY "screenshots: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "screenshots: owner insert" ON storage.objects;
CREATE POLICY "screenshots: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "screenshots: owner update" ON storage.objects;
CREATE POLICY "screenshots: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── avatars ──

DROP POLICY IF EXISTS "avatars: owner select" ON storage.objects;
CREATE POLICY "avatars: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars: owner insert" ON storage.objects;
CREATE POLICY "avatars: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars: owner update" ON storage.objects;
CREATE POLICY "avatars: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── pdfs ──

DROP POLICY IF EXISTS "pdfs: owner select" ON storage.objects;
CREATE POLICY "pdfs: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "pdfs: owner insert" ON storage.objects;
CREATE POLICY "pdfs: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "pdfs: owner update" ON storage.objects;
CREATE POLICY "pdfs: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── book-files ──

DROP POLICY IF EXISTS "book-files: owner select" ON storage.objects;
CREATE POLICY "book-files: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'book-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "book-files: owner insert" ON storage.objects;
CREATE POLICY "book-files: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'book-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "book-files: owner update" ON storage.objects;
CREATE POLICY "book-files: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'book-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'book-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── book-covers ──

DROP POLICY IF EXISTS "book-covers: owner select" ON storage.objects;
CREATE POLICY "book-covers: owner select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "book-covers: owner insert" ON storage.objects;
CREATE POLICY "book-covers: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "book-covers: owner update" ON storage.objects;
CREATE POLICY "book-covers: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
