-- E95-S06 rollback: drop notification_preferences table.
--
-- Dropping the table cascades to the RLS policies and indexes attached to it.
-- ON DELETE CASCADE on the user_id FK means the table drop is self-contained —
-- no orphan cleanup needed.

BEGIN;

DROP TABLE IF EXISTS public.notification_preferences CASCADE;

COMMIT;
