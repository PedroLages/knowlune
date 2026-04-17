---
story_id: E92-S01
saved_at: 2026-04-17 17:39
branch: feature/e92-s01-supabase-p0-migrations-extensions
reviewed: true
review_started: 2026-04-17
review_completed: 2026-04-17
review_rounds: 3
review_verdict: PASS
review_rounds_extra:
  - r4-micro-round-2026-04-17
review_gates_passed:
  - build
  - lint
  - type-check
  - format
  - unit-tests
  - e2e-tests
  - bundle-analysis
  - lessons-learned
  - code-review
  - code-review-testing
  - security-review
  - glm-code-review
  - titan-end-to-end-verification
  - ce-review-cross-tool-2026-04-17
  - r4-micro-round-2026-04-17
review_gates_skipped:
  - design-review
  - exploratory-qa
  - performance-benchmark
  - openai-code-review
review_gates_skipped_reason:
  design-review: "no UI changes"
  exploratory-qa: "no UI changes"
  performance-benchmark: "no UI pages to measure"
  openai-code-review: "API quota exhausted — fallback manual review provided"
---

# E92-S01 Checkpoint

Pointer — content lives in the story file.

- Story: [`docs/implementation-artifacts/92-1-supabase-p0-migrations-and-extensions.md`](../92-1-supabase-p0-migrations-and-extensions.md)
- Plan: [`docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md`](../../plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md)
- Migration: [`supabase/migrations/20260413000001_p0_sync_foundation.sql`](../../../supabase/migrations/20260413000001_p0_sync_foundation.sql)
- Fixups (R1): [`supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql`](../../../supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql)
- Verification: [`supabase/tests/e92-s01-verify.sql`](../../../supabase/tests/e92-s01-verify.sql)
- Rollback: [`supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql`](../../../supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql)

## Current Status

Implementation complete. All 3 review rounds passed — verdict: PASS. R1 fixes: rollback script, search_path, LWW last_position, NULL guards, client_request_id. R2 fixes: RLS userB seed, NOT VALID check, AC6 object count. R3 fix: removed dead duplicate `_status_rank` definition. Fixup migration applied + all AC verified on titan.

## Next Action

Run `/finish-story E92-S01` to create the PR.

## R4 Micro-Round (2026-04-17)

Cross-tool `ce:review` (12 reviewers, report-only) surfaced 22 findings after the in-house 3-round loop concluded PASS. Triaged into R4 fix-now vs. defer-to-E92-S02 vs. log-to-known-issues per `docs/plans/2026-04-17-002-fix-e92-s01-ce-review-findings-plan.md`.

**Fixed in R4** (supabase/migrations/20260417000003_p0_sync_foundation_r4.sql):

- **R4.1 `client_request_id` DEFAULT removed** — DEFAULT `gen_random_uuid()` defeated idempotency; clients now MUST supply stable UUID (SQLSTATE 23502 on omission).
- **R4.2 RLS split on content_progress + video_progress** — `FOR ALL` → separate `FOR SELECT` + `FOR INSERT`. Direct UPDATE/DELETE by authenticated role now silently denied (0 rows). Admin paths use service_role.
- **R4.3 `p_user_id = auth.uid()` guard** — added to upsert_content_progress and upsert_video_progress as explicit authz boundary. Required SECURITY DEFINER on both functions (FOR UPDATE policy removed → SECURITY INVOKER would fail ON CONFLICT DO UPDATE).
- **R4.4 GRANT/REVOKE hardening** — REVOKE EXECUTE FROM PUBLIC + GRANT EXECUTE TO authenticated on all 3 sync functions.
- **R4.5 COMMENT ON FUNCTION** — persisted operational notes (RAISE aborts caller txn, SAVEPOINT needed for partial-batch).

**verify.sql extended with 9 new assertions**: A1 (completed_at set on first completion), A2 (completed_at preserved on downgrade), A3 (watched_percent=0 when duration=0), A4 (watched_percent capped at 100), A5 (anon INSERT rejected), A6 (cross-user UPDATE/DELETE on video_progress + study_sessions), A7 (`_status_rank(NULL)` STRICT), A8 (in_progress→not_started blocked), A9/AC8 (direct UPDATE denied under R4). Refactored AC4/AC5 block to run under `SET LOCAL ROLE authenticated` + JWT claims (required after SECURITY DEFINER + auth.uid() guard).

**Deferred to known-issues.yaml** (KI-072 through KI-081): 10 P2/P3 findings logged with cross-reviewer context, including the pre-existing SEC-04 (`handle_new_user_entitlement` missing search_path) as severity HIGH scheduled for e92-hotfix.

**Rollback files renamed**: `20260413000001_p0_sync_foundation_down.sql` → `p0_sync_foundation_full_down.sql` (neutral name reflects full-teardown scope). Per-migration stubs delegate to the combined file.

**Final verification on titan**: `ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/tests/e92-s01-verify.sql` → `NOTICE: E92-S01 verification: all gates PASSED`.

**Justification for R4 (not a 4th review loop)**: Memory `feedback_review_loop_max_rounds.md` permits micro-rounds triggered by cross-tool second-opinion findings (not adversarial in-house review). Four P1 findings converged across 2-4 independent reviewers each, two exposing silent-data-corruption paths that would compound in production.
