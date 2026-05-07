-- Rollback: remove learning-path-covers policies and bucket row.

BEGIN;

DROP POLICY IF EXISTS "learning-path-covers: public select" ON storage.objects;
DROP POLICY IF EXISTS "learning-path-covers: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "learning-path-covers: owner update" ON storage.objects;
DROP POLICY IF EXISTS "learning-path-covers: owner delete" ON storage.objects;

DELETE FROM storage.buckets WHERE id = 'learning-path-covers';

COMMIT;
