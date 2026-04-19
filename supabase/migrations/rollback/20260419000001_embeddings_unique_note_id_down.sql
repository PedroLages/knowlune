-- Rollback for 20260419000001_embeddings_unique_note_id.sql
--
-- Dropping the UNIQUE constraint also drops the automatically-created
-- unique btree index. IF EXISTS makes this safe to run against a DB
-- where the constraint was never applied or has already been dropped.

ALTER TABLE public.embeddings
  DROP CONSTRAINT IF EXISTS embeddings_note_id_unique;
