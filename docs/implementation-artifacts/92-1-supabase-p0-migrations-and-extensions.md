---
story_id: E92-S01
story_name: "Supabase P0 Migrations and Extensions"
status: ready-for-dev
started: 2026-04-17
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 92.01: Supabase P0 Migrations and Extensions

## Story

As the sync engine (E92–E97),
I want the Postgres foundation (extensions, P0 tables, RLS, monotonic upsert functions) in place,
so that every subsequent sync story has a schema to push to and pull from.

## Acceptance Criteria

- AC1. All 4 extensions installed and visible in `pg_extension`: `moddatetime`, `pgcrypto`, `vector`, `supabase_vault`.
- AC2. `content_progress`, `study_sessions`, `video_progress` tables exist with the columns, types, constraints, and indexes specified in the plan.
- AC3. RLS policies block cross-user access: a query as `userA` cannot read `userB` rows in any P0 table.
- AC4. `upsert_content_progress()` called with `status='not_started'` after `status='completed'` leaves status as `completed`; `progress_pct` never decreases (`GREATEST()`).
- AC5. `upsert_video_progress()` called with lower `watched_seconds` than existing value leaves existing value unchanged (`GREATEST()`).
- AC6. Migration is idempotent — re-running does not error.
- AC7. `updated_at` on `content_progress` and `video_progress` is client-driven (set via `GREATEST(existing, p_updated_at)` inside the upsert functions); **no** `moddatetime` trigger on these two tables (see plan § Key Technical Decisions).

## Tasks / Subtasks

- [x] Task 1: Install 4 Postgres extensions in new migration file (AC1)
  - [x] 1.1 Create `supabase/migrations/20260413000001_p0_sync_foundation.sql` with header comment
  - [x] 1.2 `CREATE EXTENSION IF NOT EXISTS` for `moddatetime`, `pgcrypto`, `vector`, `supabase_vault`
- [x] Task 2: Create `content_progress` table with RLS + incremental-sync index (AC2, AC3)
  - [x] 2.1 Columns, constraints (unique `(user_id, content_id, content_type)`, CHECKs), index on `(user_id, updated_at)`
  - [x] 2.2 Enable RLS + standard CRUD policy `auth.uid() = user_id`
- [x] Task 3: Create `study_sessions` (append-only) with INSERT+SELECT-only RLS (AC2, AC3)
  - [x] 3.1 Columns + CHECKs + indexes on `(user_id, started_at)` and `(user_id, created_at)`
  - [x] 3.2 Two-policy RLS: `insert_own`, `select_own` — no UPDATE / DELETE policies
- [x] Task 4: Create `video_progress` with generated `watched_percent` column and RLS (AC2, AC3)
  - [x] 4.1 Columns incl. `watched_percent NUMERIC(5,2) GENERATED ALWAYS AS (...) STORED`
  - [x] 4.2 Unique `(user_id, video_id)`, index on `(user_id, updated_at)`, RLS
- [x] Task 5: Monotonic upsert functions (AC4, AC5, AC7)
  - [x] 5.1 `_status_rank(TEXT) RETURNS INT` helper, `IMMUTABLE`
  - [x] 5.2 `upsert_content_progress(...)` with status precedence, `GREATEST` on `progress_pct` and `updated_at`, set-once `completed_at`
  - [x] 5.3 `upsert_video_progress(...)` with `GREATEST` on `watched_seconds`, `duration_seconds`, `updated_at`; see Lessons for `last_position` deviation
- [x] Task 6: Verification (AC1–AC7) — applied to titan, all 10 gates passed
  - [x] 6.1 Apply migration on titan; `pg_extension` returns 4 rows, all 3 tables exist with correct schema
  - [x] 6.2 Negative trigger check: 0 user triggers on `content_progress` and `video_progress`
  - [x] 6.3 RLS isolation test with two users (userA/userB) — cross-user SELECT returns 0 rows; cross-user upsert rejected by `WITH CHECK`
  - [x] 6.4 Monotonic regression tests: status (completed→not_started stays completed), progress_pct (80 then 60 stays 80), watched_seconds (500 then 200 stays 500), duration_seconds non-regression, updated_at (older timestamp ignored), completed_at set-once
  - [x] 6.5 Idempotency — migration applied twice cleanly, no errors
  - [x] 6.6 Generated column edge cases: `watched > duration` capped at 100; `duration = 0` yields 0 (no div-by-zero)

## Implementation Plan

See [plan](../plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md) for the detailed implementation approach, unit breakdown, risks, and verification strategy.

## Design Guidance

N/A — pure database migration, no UI.

## Implementation Notes

[Populated during implementation — architecture decisions, patterns used, dependencies added]

## Testing Notes

End-to-end verification is SQL-based — no E2E Playwright tests. See plan § Verification Strategy for the 10-step gate list. No client code changes in this story (client wiring begins in E92-S02+).

## Pre-Review Checklist

Standard checklist applies — but note these domain-specific items for this story:

- [ ] Migration file uses `IF NOT EXISTS` / `CREATE OR REPLACE` throughout (idempotency)
- [ ] `content_progress` and `video_progress` have **no** `moddatetime` trigger (verified via `pg_trigger`)
- [ ] Upsert functions are `SECURITY INVOKER` (not `DEFINER`) so RLS applies to the caller
- [ ] All DDL wrapped in a single `BEGIN; ... COMMIT;` transaction
- [ ] Header comment in migration file explains *why* progress tables omit `moddatetime` (LWW + incremental sync)
- [ ] Verified on titan after applying (extensions, schema, upsert behavior)

## Design Review Feedback

N/A — no UI.

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

**Pre-written plan + titan preflight paid off.** The plan (`docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md`) was Opus-grade with a live preflight against titan — we knew before coding which extensions were installed (`pgcrypto`, `supabase_vault`) vs. needed (`moddatetime`, `vector`). Zero surprises on apply. Recommend for any schema story: run the preflight before authoring the plan.

**The `moddatetime` trigger omission is the highest-risk invariant in the whole epic.** The plan added AC7 specifically for this. If a future story re-adds the trigger "to match the pattern," E92-S06's incremental download becomes non-idempotent and LWW breaks silently. The migration header comment + the negative trigger check (`pg_trigger` returns 0 rows) + AC7 all exist to catch regressions.

**`last_position` deviation from the plan, documented here.** The plan's Unit 5c text included `last_position = EXCLUDED.last_position` (LWW so users can scrub back). But since `last_position` is NOT a parameter of `upsert_video_progress`, `EXCLUDED.last_position` on conflict would resolve to the `p_watched_seconds` value that seeded the INSERT — effectively making `last_position` monotonically equal to `watched_seconds`. That loses the "scrub back" semantic without adding any correctness. **Decision: leave `last_position` unchanged on conflict** (`last_position = video_progress.last_position`). A future story can add an overloaded function (`upsert_video_progress` with explicit `p_last_position`) if real scrub-back support is needed — meanwhile direct UPDATE is available.

**`auth.uid()` needs a transaction for RLS tests.** First AC3 attempt ran `set_config(..., is_local=true)` + `SET ROLE` + `SELECT` as separate statements in psql autocommit — the `true` local scope only applied to the transaction that immediately ran `set_config`, so the follow-up SELECT saw no JWT. Wrapped the whole thing in `BEGIN; SET LOCAL ROLE; set_config(...); SELECT; COMMIT;` and `auth.uid()` resolved correctly. Worth documenting in test patterns for future RLS stories.

**Generated column was the right call over an in-function computed value.** Testing `duration_seconds = 0` → `watched_percent = 0` and `watched_seconds > duration_seconds` → `watched_percent = 100.00` (capped) both worked out of the box. No division-by-zero guard needed in any caller. No way for a client to desync `watched_percent` from the underlying columns.

**Idempotency pattern: `DROP POLICY IF EXISTS` before `CREATE POLICY`.** `CREATE POLICY IF NOT EXISTS` doesn't exist in Postgres 15 (added in 15.1+ but behavior varies). Using `DROP POLICY IF EXISTS` followed by `CREATE POLICY` is the portable idempotent form. Re-applied the migration twice on titan with no errors.
