---
title: "Fail-closed destructive migrations with session-scoped GUC + durable RLS-locked audit table"
date: 2026-04-19
category: docs/solutions/best-practices/
module: supabase-migrations
problem_type: best_practice
component: database
severity: high
applies_when:
  - Writing a Supabase migration that must DELETE rows to enforce a new constraint (UNIQUE, CHECK, FK)
  - Dedup is required before ADD CONSTRAINT can succeed
  - Operator acknowledgement must be explicit — silent data destruction is not acceptable
  - Deleted-row provenance must be recoverable after deploy even if log aggregators truncate WARNING lines
tags: [supabase, migration, postgres, destructive-migration, guc, rls, audit, dedup, fail-closed]
---

# Fail-closed destructive migrations with session-scoped GUC + durable RLS-locked audit table

## Context

Post-E93 cleanup (PR #361) added a `UNIQUE (note_id)` constraint to `public.embeddings`. Pre-E93 clients could theoretically have written duplicates, so the migration needed to dedup before `ADD CONSTRAINT` — but dropping rows without explicit operator consent violates the "migrations are reviewable code, destructive actions must be opt-in" principle. Three rounds of adversarial review tightened the pattern: naive `RAISE WARNING` lines get truncated by log aggregators when duplicate counts are large, naive `SET` commands persist across sessions via `ALTER ROLE`, and naive audit tables inherit `ALTER DEFAULT PRIVILEGES` grants that expose per-user data to every authenticated user via PostgREST.

The resulting pattern is reusable for any future migration that must destroy rows to enforce a new invariant.

## Guidance

### Four layered safeguards

**1. Session-scoped GUC gate with `pg_settings.source` verification (fail-closed).**

Do not rely on `current_setting('my.flag', true) = 'on'` alone — that flag can persist outside the migration session via `ALTER ROLE … SET my.flag = 'on'` or `postgresql.conf`, silently re-authorizing destruction on unrelated future migrations. Verify the source:

```sql
v_allow_flag := current_setting('knowlune.allow_embeddings_dedup', true);
SELECT source INTO v_allow_source
  FROM pg_settings
  WHERE name = 'knowlune.allow_embeddings_dedup';

IF v_allow_flag IS DISTINCT FROM 'on'
   OR v_allow_source IS DISTINCT FROM 'session' THEN
  RAISE EXCEPTION 'Silent dedup not allowed. Run SET LOCAL … in this session.';
END IF;
```

`pg_settings.source = 'session'` proves the flag was set by the current transaction (`SET LOCAL`) or the current session (`SET`), not inherited from a persistent default. `'user'`, `'database'`, `'configuration file'` sources are rejected.

**2. Durable audit table — not just `RAISE WARNING`.**

Log aggregators truncate large messages (CloudWatch: 256KB, Datadog: 1MB, Loki: configurable). A dedup of thousands of rows will emit an id list that exceeds those limits, and `string_agg(id, ',')` output will be silently cut off mid-UUID. The source of truth for "which ids were deleted" must be a real table:

```sql
CREATE TABLE IF NOT EXISTS public._embeddings_dedup_audit_20260419 (
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  id         UUID        NOT NULL,
  note_id    UUID        NOT NULL,
  user_id    UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  reason     TEXT        NOT NULL DEFAULT 'duplicate_note_id_dedup'
);
```

The audit table is permanent (not `TEMP` / `UNLOGGED`) so it survives server restart. Name it with a date or migration-id suffix so it's obvious it's a one-off artifact that can be dropped after reconciliation.

**3. RLS + REVOKE ALL on the audit table.**

Supabase initializes projects with `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated`. A naive `CREATE TABLE public.audit` inherits those grants — PostgREST will expose every row (including the `user_id ↔ note_id` correlation) to every signed-in user. Lock the table down at create time:

```sql
REVOKE ALL ON public._embeddings_dedup_audit_20260419 FROM PUBLIC;
REVOKE ALL ON public._embeddings_dedup_audit_20260419 FROM anon;
REVOKE ALL ON public._embeddings_dedup_audit_20260419 FROM authenticated;
ALTER TABLE public._embeddings_dedup_audit_20260419 ENABLE ROW LEVEL SECURITY;
-- No policies — RLS with zero policies denies all non-bypass roles.
```

Only `postgres` / `service_role` (which bypass RLS) can read the table. Operators query it directly via the dashboard or `psql`.

**4. Bounded `EXCLUSIVE` lock with `lock_timeout`, not `ACCESS EXCLUSIVE`.**

To prevent concurrent INSERTs from racing between dedup and `ADD CONSTRAINT`, lock the table — but use `EXCLUSIVE` (blocks writes, allows reads) for the dedup step so production reads aren't stalled. Bound the wait with `SET LOCAL lock_timeout = '3s'` so the migration fails fast instead of queueing behind long readers:

```sql
SET LOCAL lock_timeout = '3s';
LOCK TABLE public.embeddings IN EXCLUSIVE MODE;
```

Be aware that `ALTER TABLE … ADD CONSTRAINT UNIQUE` upgrades the lock to `ACCESS EXCLUSIVE` briefly (blocks reads). Schedule these migrations during off-peak windows; expect a retry if a long-running reader holds the table beyond `lock_timeout`.

### Tie-break on freshness, never on lexicographic id

When choosing the survivor row in `DISTINCT ON`, `ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id`. UUIDs are not time-correlated, so `ORDER BY id` picks randomly — and can orphan the id that the client's local Dexie record points to, producing a permanent `UNIQUE` violation on the next client upload. Match the client's write policy exactly (here: `saveEmbedding` reuses the most-recent Dexie id, so survivor = most-recent `updated_at`).

### Idempotent `ADD CONSTRAINT`

`ALTER TABLE … ADD CONSTRAINT` is not idempotent in Postgres — re-running the migration fails with `constraint already exists`. Wrap in a `pg_constraint` check:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'embeddings_note_id_unique'
  ) THEN
    ALTER TABLE public.embeddings
      ADD CONSTRAINT embeddings_note_id_unique UNIQUE (note_id);
  END IF;
END $$;
```

## Why This Matters

Each safeguard addresses a real failure mode surfaced in review:

| Safeguard | Failure it prevents |
|-----------|---------------------|
| GUC gate | Silent data destruction on a re-deploy where nobody remembers the constraint implies deletion |
| `pg_settings.source = 'session'` check | A stale `ALTER ROLE knowlune.allow_* = 'on'` from a prior incident silently re-authorizing dedup months later (ADV-R2-02) |
| Durable audit table | Log-aggregator truncation losing the id list when duplicate counts exceed the aggregator's per-line limit (ADV-R2-01) |
| RLS + REVOKE ALL | Supabase `ALTER DEFAULT PRIVILEGES` exposing per-user reconciliation data via PostgREST (ADV-R3-01) |
| `EXCLUSIVE` + `lock_timeout` | Concurrent INSERTs creating a fresh duplicate between dedup and `ADD CONSTRAINT`; unbounded blocking of deploys behind long readers (SEC-3, ADV-R2-03) |
| Freshness tie-break | Random UUID winner orphaning the client's local id, producing a permanent upload-loop UNIQUE violation (ADV-01) |

## When to Apply

- Any migration that must `DELETE` rows to satisfy a new constraint
- Any migration whose rollback would be hard/impossible if rows were destroyed without an audit trail
- Any migration that may run in an environment where persistent GUC defaults could survive from prior incidents

## When Not to Apply

- Migrations that only add constraints over already-clean data (no `DELETE` needed) — the standard idempotency check on `pg_constraint` is sufficient.
- Migrations that dedup via `UPDATE` (not `DELETE`) — no audit trail needed because rows aren't destroyed.
- Migrations gated behind a feature flag at the app layer where the invariant can be enforced without ever running the destructive path in production.

## Examples

**Full worked example:** `supabase/migrations/20260419000001_embeddings_unique_note_id.sql` (PR #361).

**Run recipe:**

```sql
-- Operator opens a dedicated migration session:
BEGIN;
SET LOCAL knowlune.allow_embeddings_dedup = 'on';
-- Apply the migration (via supabase CLI or manual \i):
\i supabase/migrations/20260419000001_embeddings_unique_note_id.sql
-- Verify:
SELECT COUNT(*), MIN(deleted_at), MAX(deleted_at)
  FROM public._embeddings_dedup_audit_20260419;
COMMIT;
-- Later, after reconciliation is confirmed complete:
DROP TABLE public._embeddings_dedup_audit_20260419;
```

## Related

- **Case study:** `supabase/migrations/20260419000001_embeddings_unique_note_id.sql` — the reference implementation this pattern was extracted from.
- **PR #361** — post-E93 cleanup, 3 review rounds (R1 security-1, adversarial-1; R2 adversarial-1, adversarial-2; R3 adversarial-1) refined each safeguard into its final form.
- **Prior pattern:** `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md` — general invariants for Dexie-synced Supabase tables; complementary to this doc's destructive-migration focus.
- **Engineering pattern:** `docs/engineering-patterns.md` — "Fail-Closed Destructive Migrations" (tactical summary; this document is the architectural narrative).
