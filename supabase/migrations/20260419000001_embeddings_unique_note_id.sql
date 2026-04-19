-- Migration: post-E93 cleanup — UNIQUE (note_id) on public.embeddings
--
-- Invariant being added:
--   "One embedding row per note." E93-S05's saveEmbedding fix enforces this
--   client-side (delete-then-insert), but without a DB constraint a future
--   client bug or out-of-band write could silently create duplicates.
--
-- Table note:
--   The table defined in 20260413000002_p1_learning_content.sql is
--   `public.embeddings` (not `note_embeddings`). The constraint is named
--   `embeddings_note_id_unique` to match.
--
-- Idempotency contract:
--   All statements guard with IF NOT EXISTS / information-schema checks.
--   Safe to re-run. Plain `ALTER TABLE ... ADD CONSTRAINT` is NOT idempotent
--   in Postgres, so the ADD is wrapped in a DO $$ ... $$ block that checks
--   pg_constraint first (same pattern as
--   20260417000002_p0_sync_foundation_fixups.sql).
--
-- Dedup strategy (fail-closed, tie-break on freshness):
--   In practice, E93-S05 prevents duplicates. If any slipped through (older
--   clients, out-of-band writes, backfills from Epic 93), the migration would
--   otherwise fail at ADD CONSTRAINT. Behaviour:
--     • Default: RAISE EXCEPTION when duplicates are present. Operator must
--       investigate before data is destroyed. (SEC-1 from R1 security review.)
--     • Override: SET LOCAL knowlune.allow_embeddings_dedup = 'on' to
--       acknowledge and proceed with dedup. The override MUST be set in the
--       current transaction (`SET LOCAL`); we verify pg_settings.source =
--       'session' to reject stale role/database-level defaults that could
--       inadvertently bypass the fail-closed gate (ADV-R2-02 from R2 review).
--   When dedup runs, the surviving row is chosen by `ORDER BY updated_at DESC
--   NULLS LAST, created_at DESC, id` — the freshest row wins, matching the
--   client's saveEmbedding pattern which reuses the Dexie id of the most
--   recently persisted local vector. Lexicographic id-tie-break was wrong:
--   UUIDs are not time-correlated, so MIN(id::text) picks randomly and can
--   orphan the id the client's local Dexie record points to (ADV-01 from
--   R1 adversarial review → permanent UNIQUE violation on next client upload).
--   Deleted ids are recorded in two places for post-migration reconciliation:
--     1. `_embeddings_dedup_audit_<ts>` table (created in this migration) —
--        the source of truth. Survives log-aggregator truncation that can
--        drop the WARNING line if the deleted set is large (CloudWatch 256KB,
--        Datadog 1MB). RLS-enabled with zero policies + REVOKE ALL from
--        anon/authenticated/PUBLIC, so PostgREST cannot expose the per-row
--        user_id ↔ note_id correlation cross-tenant (ADV-R3-01 from R3
--        adversarial review). Only the migration role / service_role can read.
--        (ADV-R2-01 from R2 adversarial review.)
--     2. `RAISE WARNING` line — convenience for operators reading deploy logs.
--
-- Concurrency (SEC-3):
--   `LOCK TABLE ... IN EXCLUSIVE MODE` is taken at the start of the
--   transaction so concurrent clients cannot INSERT a fresh duplicate
--   between dedup and ADD CONSTRAINT. `SET LOCAL lock_timeout = '3s'` bounds
--   the wait — the migration fails fast rather than queueing behind long
--   readers. EXCLUSIVE (not ACCESS EXCLUSIVE) keeps reads available during
--   STEP 1 (the dedup window). STEP 2 (ALTER TABLE ADD CONSTRAINT UNIQUE)
--   upgrades to ACCESS EXCLUSIVE and will briefly block reads — schedule
--   during off-peak windows or expect a retry if a long-running reader holds
--   the table beyond `lock_timeout` (ADV-R2-03 from R2 adversarial review).
--
-- Rollback: supabase/migrations/rollback/20260419000001_embeddings_unique_note_id_down.sql
--
-- No explicit index is created — a UNIQUE constraint automatically creates
-- a unique btree index with the same name.

BEGIN;

-- Bound wait time on the table lock. If another session holds a conflicting
-- lock for more than 3s we abort cleanly rather than stall the deploy.
SET LOCAL lock_timeout = '3s';

-- Block concurrent INSERTs during dedup + ADD CONSTRAINT. EXCLUSIVE (not
-- ACCESS EXCLUSIVE) keeps reads available — no tutor/search downtime.
LOCK TABLE public.embeddings IN EXCLUSIVE MODE;

-- Step 1: Fail-closed dedup. Requires explicit operator acknowledgement via
-- a GUC flag set in the CURRENT session before destroying rows, and
-- tie-breaks on freshness (not id).
DO $$
DECLARE
  v_duplicate_count INTEGER;
  v_allow_flag      TEXT;
  v_allow_source    TEXT;
  v_deleted_count   INTEGER;
  v_deleted_ids     TEXT;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT note_id)
    INTO v_duplicate_count
    FROM public.embeddings;

  RAISE NOTICE 'Pre-dedup duplicate embeddings rows: %', v_duplicate_count;

  IF v_duplicate_count > 0 THEN
    -- Fail closed unless the operator set the override GUC IN THIS SESSION.
    -- pg_settings.source distinguishes 'session' (SET LOCAL or SET) from
    -- 'user' / 'database' / 'configuration file' (persistent defaults).
    -- Rejecting non-session sources prevents a stale ALTER ROLE from a
    -- prior incident silently re-authorising dedup on unrelated migrations
    -- months later (ADV-R2-02 from R2 adversarial review).
    v_allow_flag := current_setting('knowlune.allow_embeddings_dedup', true);
    SELECT source INTO v_allow_source
      FROM pg_settings
      WHERE name = 'knowlune.allow_embeddings_dedup';

    IF v_allow_flag IS DISTINCT FROM 'on'
       OR v_allow_source IS DISTINCT FROM 'session' THEN
      RAISE EXCEPTION
        'Found % duplicate embeddings rows. Silent dedup is not allowed. '
        'To authorise deletion, run BOTH in the same migration session: '
        '  SET LOCAL knowlune.allow_embeddings_dedup = ''on''; '
        '  -- then run this migration. '
        'Persistent defaults (ALTER ROLE / ALTER DATABASE / postgresql.conf) '
        'are rejected — only per-transaction SET LOCAL is honoured.',
        v_duplicate_count;
    END IF;

    -- Persist the deleted-id audit to a diagnostic table BEFORE the DELETE
    -- so reconciliation does not depend on log-aggregator capture (RAISE
    -- WARNING lines can be truncated by CloudWatch / Datadog / Loki when
    -- the duplicate count is large). The audit table is permanent (not
    -- TEMP / UNLOGGED) so the data survives a server restart and is
    -- queryable post-migration. Operator can drop it manually after
    -- reconciliation completes. (ADV-R2-01 from R2 adversarial review.)
    --
    -- SECURITY (ADV-R3-01 from R3 adversarial review):
    --   Supabase initializes new projects with `ALTER DEFAULT PRIVILEGES IN
    --   SCHEMA public GRANT ALL ON TABLES TO anon, authenticated`. A naive
    --   CREATE TABLE in `public` would inherit those grants and expose the
    --   audit (containing per-row user_id ↔ note_id correlation) to every
    --   authenticated user via PostgREST. We lock the table down at create
    --   time:
    --     1. REVOKE ALL from anon, authenticated, and PUBLIC.
    --     2. ENABLE RLS with NO policies — denies all access by default.
    --       The migration role (postgres / service_role) bypasses RLS, so
    --       operators can still query the table for reconciliation.
    CREATE TABLE IF NOT EXISTS public._embeddings_dedup_audit_20260419 (
      deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      id          UUID        NOT NULL,
      note_id     UUID        NOT NULL,
      user_id     UUID,
      created_at  TIMESTAMPTZ,
      updated_at  TIMESTAMPTZ,
      reason      TEXT        NOT NULL DEFAULT 'duplicate_note_id_dedup'
    );

    REVOKE ALL ON public._embeddings_dedup_audit_20260419 FROM PUBLIC;
    REVOKE ALL ON public._embeddings_dedup_audit_20260419 FROM anon;
    REVOKE ALL ON public._embeddings_dedup_audit_20260419 FROM authenticated;
    ALTER TABLE public._embeddings_dedup_audit_20260419 ENABLE ROW LEVEL SECURITY;
    -- No policies created — RLS with zero policies denies all non-bypass roles.

    -- Tie-break on freshness (updated_at DESC, created_at DESC, id as final
    -- tiebreaker for determinism). DISTINCT ON returns the first row per
    -- note_id under the ORDER BY — that row survives; the others are
    -- deleted. Aligns with saveEmbedding's client-side "reuse most-recent
    -- Dexie id" policy (ADV-01 from R1 adversarial review).
    WITH deleted AS (
      DELETE FROM public.embeddings
      WHERE id NOT IN (
        SELECT DISTINCT ON (note_id) id
          FROM public.embeddings
          ORDER BY note_id,
                   updated_at DESC NULLS LAST,
                   created_at DESC NULLS LAST,
                   id
      )
      RETURNING id, note_id, user_id, created_at, updated_at
    ),
    audited AS (
      INSERT INTO public._embeddings_dedup_audit_20260419
        (id, note_id, user_id, created_at, updated_at)
      SELECT id, note_id, user_id, created_at, updated_at FROM deleted
      RETURNING id::text
    )
    SELECT COUNT(*), string_agg(id, ',') INTO v_deleted_count, v_deleted_ids
      FROM audited;

    RAISE WARNING
      'Deleted % duplicate embedding rows. '
      'Full audit (id, note_id, user_id, created_at, updated_at) in '
      'public._embeddings_dedup_audit_20260419. '
      'Inline ids (may be truncated by log aggregator): %',
      v_deleted_count, v_deleted_ids;
  END IF;
END $$;

-- Step 2: Add UNIQUE (note_id) idempotently. Matches the pg_constraint-check
-- pattern from 20260417000002_p0_sync_foundation_fixups.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embeddings_note_id_unique'
  ) THEN
    ALTER TABLE public.embeddings
      ADD CONSTRAINT embeddings_note_id_unique
      UNIQUE (note_id);
  END IF;
END $$;

COMMIT;
