-- Rollback for 20260419000001_embeddings_unique_note_id.sql
--
-- Dropping the UNIQUE constraint also drops the automatically-created
-- unique btree index. IF EXISTS makes this safe to run against a DB
-- where the constraint was never applied or has already been dropped.
--
-- NOTE on reversibility:
--   This rollback is NOT a true inverse of the up migration. If the up
--   migration's dedup step deleted duplicate rows (only when the operator
--   set `knowlune.allow_embeddings_dedup = 'on'`), those rows are gone —
--   this rollback does NOT restore them. For true point-in-time recovery,
--   use Supabase PITR / database backup snapshots from before the up
--   migration ran. Deleted ids are logged via RAISE WARNING at up-migration
--   time for post-migration reconciliation.

ALTER TABLE public.embeddings
  DROP CONSTRAINT IF EXISTS embeddings_note_id_unique;
