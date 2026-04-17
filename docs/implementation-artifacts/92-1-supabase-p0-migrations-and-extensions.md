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

- [ ] Task 1: Install 4 Postgres extensions in new migration file (AC1)
  - [ ] 1.1 Create `supabase/migrations/20260413000001_p0_sync_foundation.sql` with header comment
  - [ ] 1.2 `CREATE EXTENSION IF NOT EXISTS` for `moddatetime`, `pgcrypto`, `vector`, `supabase_vault`
- [ ] Task 2: Create `content_progress` table with RLS + incremental-sync index (AC2, AC3)
  - [ ] 2.1 Columns, constraints (unique `(user_id, content_id, content_type)`, CHECKs), index on `(user_id, updated_at)`
  - [ ] 2.2 Enable RLS + standard CRUD policy `auth.uid() = user_id`
- [ ] Task 3: Create `study_sessions` (append-only) with INSERT+SELECT-only RLS (AC2, AC3)
  - [ ] 3.1 Columns + CHECKs + indexes on `(user_id, started_at)` and `(user_id, created_at)`
  - [ ] 3.2 Two-policy RLS: `insert_own`, `select_own` — no UPDATE / DELETE policies
- [ ] Task 4: Create `video_progress` with generated `watched_percent` column and RLS (AC2, AC3)
  - [ ] 4.1 Columns incl. `watched_percent NUMERIC(5,2) GENERATED ALWAYS AS (...) STORED`
  - [ ] 4.2 Unique `(user_id, video_id)`, index on `(user_id, updated_at)`, RLS
- [ ] Task 5: Monotonic upsert functions (AC4, AC5, AC7)
  - [ ] 5.1 `_status_rank(TEXT) RETURNS INT` helper, `IMMUTABLE`
  - [ ] 5.2 `upsert_content_progress(...)` with status precedence, `GREATEST` on `progress_pct` and `updated_at`, set-once `completed_at`
  - [ ] 5.3 `upsert_video_progress(...)` with `GREATEST` on `watched_seconds`, `duration_seconds`, `updated_at`; LWW on `last_position`
- [ ] Task 6: Verification (AC1–AC7)
  - [ ] 6.1 Apply migration on fresh scratch DB; run `pg_extension`, `\d` checks
  - [ ] 6.2 Negative trigger check: zero user triggers on `content_progress` and `video_progress`
  - [ ] 6.3 RLS isolation test with two users
  - [ ] 6.4 Monotonic regression tests (status, progress, watched_seconds, updated_at)
  - [ ] 6.5 Idempotency — run the migration twice; no error
  - [ ] 6.6 Apply to titan (`ssh titan` → `supabase-db` container) and re-run checks

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

*Story start (2026-04-17) — notes so far:*

- Plan was authored in advance (`docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md`) with a live preflight against `titan` confirming which extensions are already installed — this avoided the usual "extension missing on target" risk and let the plan pick `supabase_vault` over `pgsodium` confidently.
- Deviation from the epic spec intentionally documented in the plan: the `moddatetime` trigger is **not** attached to `content_progress` or `video_progress` (would corrupt client-driven `updated_at` used by E92-S06's incremental download + LWW). The extension is still installed for future non-synced tables. Added to ACs as AC7 so reviewers catch regressions if a future story re-adds the trigger "to match the pattern."
- Migration filename uses Supabase CLI timestamp convention (`20260413000001_...`) rather than existing `NNN_` style. Lexicographic sort still places it after `001_entitlements.sql` / `002_calendar_tokens.sql`.
- Implementation lessons to be filled in as Units 1–5 are applied.
