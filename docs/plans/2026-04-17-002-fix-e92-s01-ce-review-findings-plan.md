---
title: "Fix E92-S01 ce:review findings (R4 micro-round + deferrals)"
type: fix
status: active
date: 2026-04-17
origin: docs/reviews/consolidated-review-R3-2026-04-17-e92-s01.md
related:
  - docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md (original E92-S01 plan — deleted in branch history, referenced by checkpoint)
  - docs/reviews/code/code-review-R3-2026-04-17-e92-s01.md
  - docs/reviews/security/security-review-R3-2026-04-17-e92-s01.md
  - docs/reviews/code/glm-code-review-R3-2026-04-17-e92-s01.md
---

# Fix E92-S01 ce:review findings (R4 micro-round + deferrals)

## Overview

Cross-tool `ce:review` (12 reviewers, report-only) surfaced 22 findings on E92-S01 after the in-house 3-round review concluded PASS. Four P1 findings and two trivial P2 security items are worth fixing now in a narrow R4 micro-round; the rest split between deferrable-to-E92-S02 or log-to-known-issues.

This plan defines the R4 micro-round: what lands, what doesn't, and why. It is a **maintenance fix plan**, not a feature plan — no new behavior is added, only hardening and test coverage for behavior already specified by R1/R2/R3.

## Problem Frame

The in-house review loop converged on PASS at R3 (max-3-rounds policy). `ce:review` then surfaced:

- **4 P1 findings**: three converged across 2-4 independent reviewers each
- **9 P2 findings**: mixed — some real hardening gaps, some design questions
- **9 P3 findings**: test coverage + maintainability nits

Two P1 findings expose silent-data-corruption paths that would not be visible in testing but would compound in production:

1. **client_request_id DEFAULT gen_random_uuid() defeats idempotency.** Four reviewers converged. The UNIQUE `(user_id, client_request_id)` constraint only protects retries when the client supplies a stable UUID; DEFAULT gives each retry a fresh server-generated UUID, silently creating duplicate study_sessions rows. Breaks streak and analytics math.
2. **Direct UPDATE on content_progress / video_progress bypasses monotonic invariants.** RLS `FOR ALL` lets an authenticated user `UPDATE ... SET status='not_started', updated_at='1970-01-01'` on their own rows. The row falls off the incremental-sync cursor (`WHERE updated_at >= lastSyncTimestamp`) permanently → silent data loss.

Two more P1 findings are pure test-coverage gaps:

3. **completed_at set-once invariant has zero test coverage** (the COALESCE branch is the most complex logic in the function, untested).
4. **watched_percent generated column edge cases** (divide-by-zero, watched > duration) untested.

Fixing all four now prevents shipping known silent-corruption paths to E92-S02+.

## Requirements Trace

- **R1** (P1 #1): `client_request_id` MUST NOT accept server-generated defaults. Clients MUST supply a stable UUID per logical session; omission MUST raise a clear constraint violation at insert time.
- **R2** (P1 #2): Direct UPDATE/DELETE on `content_progress` and `video_progress` MUST be denied by RLS for the `authenticated` role. Admin paths use `service_role` (RLS bypass).
- **R3** (P1 #3, #4): `supabase/tests/e92-s01-verify.sql` MUST assert: `completed_at` is set on first completion, `completed_at` is preserved on subsequent upserts, `watched_percent = 0` when `duration_seconds = 0`, `watched_percent = 100.00` when `watched_seconds > duration_seconds`.
- **R4** (P2 #5): Upsert functions and `_status_rank` MUST `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated` per Supabase convention (see `supabase/migrations/002_calendar_tokens.sql`).
- **R5** (P2 #6): `upsert_content_progress` and `upsert_video_progress` MUST raise an explicit `forbidden` error when `p_user_id IS DISTINCT FROM auth.uid()`, as a defense-in-depth check independent of RLS policy evaluation.
- **R6** (P3 test gaps): `verify.sql` MUST additionally assert — anon INSERT is rejected on all three tables; cross-user UPDATE/DELETE is denied on `video_progress` and `study_sessions`; `_status_rank(NULL)` returns NULL (STRICT propagation); `in_progress→not_started` regression is blocked.
- **R7**: All remaining findings (P2 #7-#13 design calls, P3 #14-#18 maintainability nits) MUST be logged to `docs/known-issues.yaml` as KI-072+ so they are not silently lost.
- **R8**: Migration must be applied end-to-end on titan; `verify.sql` must output `all gates PASSED` with the new assertions.

## Scope Boundaries

- No behavioral changes beyond what R1-R3 already specified (except removing the DEFAULT on `client_request_id`, which tightens the existing contract).
- No refactoring of existing fixup migration beyond the changes above.
- No changes to base migration (`20260413000001`) — additions land in a new R4 fixup migration.
- No client-side work (E92-S02+ territory).
- No migration to external Supabase (cloud) — titan only, matches current deployment.

### Deferred to Separate Tasks

- **P2 #7** (`last_position` tie semantics `>` vs `>=`): architectural decision deferred to E92-S02 when real multi-device client behavior is observable. Log to known-issues with design notes.
- **P2 #8** (NULL p_status silent no-op): low severity given clients will always send a valid enum; add early guard in E92-S02 when client contract is wired. Log to known-issues.
- **P2 #9** (SQLSTATE mismatch on wrong-case status): cosmetic; defer to E92-S02 when client error handling is specified. Log to known-issues.
- **P2 #10** (in_progress at 100% CHECK conflict): real interaction bug but only triggers if client reports 100% without status='completed' — address when client state machine is defined in E92-S02. Log to known-issues.
- **P2 #11** (NOT VALID constraint follow-up untracked): log to known-issues as KI-072 (supersedes implicit tracking), schedule VALIDATE CONSTRAINT migration for post-E92-S06 when real data exists.
- **P2 #12** (RAISE aborts caller transaction): advisory-only; document in function header in this R4 (trivial comment addition), do not change semantics.
- **P2 #13** (rollback filename mismatch): rename in this R4 (trivial — one file rename + comment update). Also add stub `20260417000002_p0_sync_foundation_fixups_down.sql` that delegates.
- **P3 #14** (no-op "Fix 6" comment block): remove in this R4 (trivial — 7-line delete).
- **P3 #15** (UUID literals in verify.sql): low value; defer.
- **P3 #16** (VOLATILE DEFAULT rewrite pattern): documentation-only, log to known-issues as team-learning pointer.
- **P3 #17** (_status_rank plpgsql lost inlining): micro-perf; defer.
- **P3 #18** (study_sessions silent 0-row on UPDATE/DELETE): design-level; log to known-issues.
- **Pre-existing SEC-04** (`handle_new_user_entitlement` missing search_path): out of scope for E92 epic; log as separate hotfix story.

## Context & Research

### Relevant Code and Patterns

- **R4 fixup migration pattern**: follow `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql` structure — BEGIN/COMMIT wrapping, labeled section headers per fix, idempotency guards via `CREATE OR REPLACE` and `DO $$ ... IF NOT EXISTS ... END $$`.
- **GRANT/REVOKE reference**: `supabase/migrations/002_calendar_tokens.sql` shows explicit grants on functions. Mirror that shape.
- **Split RLS policy pattern**: `supabase/migrations/20260413000001_p0_sync_foundation.sql:92-105` already splits `study_sessions` into `FOR INSERT` and `FOR SELECT` policies — follow the same shape for `content_progress` and `video_progress`.
- **Verification script pattern**: `supabase/tests/e92-s01-verify.sql` existing AC4/AC5 blocks are the template for new assertions.
- **Known-issues schema**: `docs/known-issues.yaml` header documents required fields. Recent entries KI-069, KI-070, KI-071 (R3 deferrals) are the shape to follow.

### Institutional Learnings

- ce:review learnings-researcher found no prior `docs/solutions/*.md` entries for Supabase RLS/SECURITY DEFINER/LWW upserts. The patterns established in E92-S01 should be promoted into `docs/solutions/database-issues/` after epic completes — out of scope for this plan.
- Memory `project_supabase_sync_design.md`: LWW is the core of the sync design. Anything that weakens LWW (including broken idempotency) corrupts the entire sync contract.
- Memory `feedback_review_loop_max_rounds.md`: max 3 review rounds; this R4 is a micro-round justified by cross-tool second-opinion findings, not a 4th adversarial review loop.

### External References

None used — all patterns are local.

## Key Technical Decisions

- **Single new fixup migration** (not two separate fixups or an amend): keeps linear migration history, minimizes review surface, all R4 changes roll back together cleanly. File: `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`.
- **Remove DEFAULT on client_request_id via `ALTER TABLE ... ALTER COLUMN client_request_id DROP DEFAULT`** (not a new column, not a data backfill). Existing rows keep their random UUIDs — this is acceptable because (a) no client wiring exists yet so those rows are test fixtures, and (b) removing the default only affects *future* inserts. Rationale: simplest forward migration; no data loss; no lock contention risk.
- **Split RLS policies** (`content_progress` and `video_progress`) from `FOR ALL` into separate `FOR SELECT` + `FOR INSERT` policies. Omitting UPDATE/DELETE policies means RLS denies them silently (0 rows affected) — this is the intended behavior. Drop the old `FOR ALL` policy via `DROP POLICY IF EXISTS ... ; CREATE POLICY ... FOR SELECT ... ; CREATE POLICY ... FOR INSERT ...`. Idempotent pattern matches existing migration.
- **Add `p_user_id IS DISTINCT FROM auth.uid()` early guard** inside both upsert functions (before INSERT). Uses `DISTINCT FROM` (not `!=`) to handle NULL auth.uid() correctly. Raises `EXCEPTION 'forbidden: p_user_id does not match authenticated user'` with SQLSTATE `42501` (insufficient_privilege) for consistent client-side error handling.
- **REVOKE ... FROM PUBLIC; GRANT ... TO authenticated** on all 3 functions (`_status_rank`, `upsert_content_progress`, `upsert_video_progress`). Supabase convention.
- **R4 fixup migration must be applied after 20260417000002** — filename `20260417000003` ensures lexical ordering.
- **Rollback symmetry**: rename `supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql` → `supabase/migrations/rollback/p0_sync_foundation_full_down.sql` (neutral name). Add minimal per-migration stubs that delegate to the full teardown for operator clarity.
- **No new tests for security hardening beyond existing coverage** — the R4 additions to `verify.sql` (Unit 3) already include anon INSERT rejection and cross-user UPDATE/DELETE denial, which exercise the R4 RLS changes.
- **Known-issues entries use `status: open`, `scheduled_for: null`** by default for this batch. E92-S02 can triage each during planning.

## Open Questions

### Resolved During Planning

- **Should `client_request_id` DEFAULT be removed, or should we document the weaker contract?** → Remove. Four reviewers converged; the cost is one line; the silent-corruption path is too expensive to leave.
- **Should direct UPDATE be blocked via DENY policies, trigger, or docs?** → Split RLS to remove FOR ALL. Matches Supabase convention; only mechanism that actually enforces the contract at the DB layer.
- **How many test additions land in R4?** → All 8 (R3, R6). Test-only risk is near-zero; batching is cheaper than splitting.
- **Should SEC-01 (GRANT/REVOKE) and SEC-02 (p_user_id guard) both land in R4?** → Both. Trivial line count; defense-in-depth matters given R4 is already touching the functions.

### Deferred to Implementation

- **Exact SQLSTATE code for `forbidden` error in upsert functions**: `42501` (insufficient_privilege) is the most semantically correct match for authz failure. If titan's Postgres version quirks force a different code, implementer may substitute `P0001` with a clear DETAIL payload. Not architecturally significant.
- **Rollback stub file naming**: either `20260417000002_p0_sync_foundation_fixups_down.sql` (per-migration stub) or a README.md note in `supabase/migrations/rollback/` explaining the combined rollback. Implementer picks based on Supabase CLI tooling preferences when writing the migration.

## Implementation Units

- [ ] **Unit 1: Create R4 fixup migration with hardening changes**

**Goal:** Single migration file that (a) drops DEFAULT from `client_request_id`, (b) splits RLS policies on `content_progress` and `video_progress` to remove direct UPDATE/DELETE ability, (c) adds `p_user_id = auth.uid()` guard to both upsert functions, (d) applies GRANT/REVOKE pattern to all 3 functions, (e) removes the no-op "Fix 6" comment block from the prior fixup via no action (already dead weight — handled separately in Unit 2 if desired, but not load-bearing for this unit).

**Requirements:** R1, R2, R4, R5

**Dependencies:** None — runs after `20260417000002` lexically.

**Files:**
- Create: `supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`

**Approach:**
- Wrap in `BEGIN; ... COMMIT;` for atomicity.
- Section header comment block at top naming this R4 micro-round and the 4 issues it addresses, with pointer to `docs/plans/2026-04-17-002-fix-e92-s01-ce-review-findings-plan.md`.
- **Section 1** — `client_request_id`: `ALTER TABLE public.study_sessions ALTER COLUMN client_request_id DROP DEFAULT;` plus a comment explaining "clients MUST supply a stable UUID; omission will raise a NOT NULL violation at insert time."
- **Section 2** — RLS policies on `content_progress`: `DROP POLICY IF EXISTS "Users access own content_progress" ON public.content_progress;` then `CREATE POLICY "select_own_content_progress" ON public.content_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);` and `CREATE POLICY "insert_own_content_progress" ON public.content_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);`. No UPDATE or DELETE policies → RLS denies them for authenticated role. Same structure for `video_progress`.
- **Section 3** — `upsert_content_progress` and `upsert_video_progress`: `CREATE OR REPLACE FUNCTION` replaying the current fixups.sql body, but with `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user' USING ERRCODE = '42501'; END IF;` at the top of the body. Preserve `SECURITY INVOKER`, `SET search_path = public, pg_temp`.
- **Section 4** — GRANTs: `REVOKE EXECUTE ON FUNCTION public._status_rank(TEXT) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public._status_rank(TEXT) TO authenticated;` repeated for `upsert_content_progress` and `upsert_video_progress` with full signatures.
- **Section 5** — function header comment on `_status_rank` documenting "RAISE aborts caller transaction; batch callers must wrap each record in a SAVEPOINT if partial-batch success is required" (P2 #12 documentation-only fix).
- Idempotent via `CREATE OR REPLACE` for functions and `DROP POLICY IF EXISTS; CREATE POLICY` for policies. For `ALTER COLUMN DROP DEFAULT`, the operation is naturally idempotent — Postgres ignores the change if already applied.

**Patterns to follow:**
- Header comment + BEGIN/COMMIT structure: `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql:1-30`
- Split RLS policy shape: `supabase/migrations/20260413000001_p0_sync_foundation.sql:92-105` (study_sessions policies)
- GRANT pattern: `supabase/migrations/002_calendar_tokens.sql` (search for `GRANT EXECUTE`)
- p_user_id guard: follow the existing early-guard pattern in the fixup migration (e.g., the NOT VALID DO $$ block) but at function entry rather than migration level.

**Test scenarios:**
- Integration: apply migration on titan, confirm no errors (`COMMIT` is the final psql output line).
- Edge case: re-apply migration a second time, confirm idempotent (no errors, no duplicate policy creation).
- Integration: `verify.sql` AC1-AC7 still pass after R4 migration applied.

**Verification:**
- `ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/20260417000003_p0_sync_foundation_r4.sql` → clean COMMIT.
- `\d public.study_sessions` shows `client_request_id` without a default.
- `SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('content_progress','video_progress');` shows 2 policies per table (select_own + insert_own), no FOR ALL.
- `\df+ public.upsert_content_progress` shows `SECURITY INVOKER`, granted to `authenticated`, revoked from PUBLIC.

---

- [ ] **Unit 2: Remove dead "Fix 6" comment block from prior fixup migration**

**Goal:** Delete lines 168-174 of `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql` — a labeled section that contains only a comment and executes no SQL. The deferral rationale lives in `docs/known-issues.yaml` already (KI-070).

**Requirements:** P3 #14 (maintainability)

**Dependencies:** None.

**Files:**
- Modify: `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql`

**Approach:**
- Simple deletion of the no-op block. The section comment "Fix 6 (NIT, documented)" and the prose inside it are both removed.
- Do not touch surrounding sections.
- Since this migration has already been applied to titan, the delete is cosmetic — no new `COMMIT` surface. Supabase CLI will not re-apply an already-applied migration file, so editing it post-apply is safe for this local repo but risky on any fresh environment. Document in the commit message that the edit is cosmetic.
- **Safer alternative considered and rejected**: leave the block alone. Rejected because (a) the finding is confidence 0.90 across maintainability reviewer, (b) leaving labeled no-op sections in executable migrations misleads future readers, and (c) any new environment that applies both migrations will see the current fixup once, then never again — the comment-only block produces no side effect on either first or re-apply.

**Patterns to follow:**
- None — plain deletion.

**Test scenarios:**
- Test expectation: none — pure comment removal, no behavioral change.

**Verification:**
- `git diff supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql` shows only the block removal; no other changes.
- Pre-commit hook runs Prettier/format without issue.

---

- [ ] **Unit 3: Extend verify.sql with 8 new assertions (P1 test gaps + P3 test gaps)**

**Goal:** Add assertion blocks to `supabase/tests/e92-s01-verify.sql` covering: `completed_at` set-once, `watched_percent` edge cases, anon INSERT rejection, cross-user UPDATE/DELETE denial on `video_progress` and `study_sessions`, `_status_rank(NULL)` STRICT propagation, `in_progress→not_started` regression block, and a smoke test for the new R4 policy split (direct UPDATE by authenticated user on own row is denied).

**Requirements:** R3, R6

**Dependencies:** Unit 1 (R4 migration must be applied before verify runs, otherwise the direct-UPDATE denial test would fail — the authenticated user can still UPDATE under pre-R4 FOR ALL policy).

**Files:**
- Modify: `supabase/tests/e92-s01-verify.sql`

**Approach:**
- Locate the AC4/AC5 blocks (~line 96-158) and the AC3 RLS transaction (~line 178-229) in the existing verify.sql.
- **Assertion A1 (P1 #3 — completed_at set on first completion)**: After the existing AC4 completed→not_started upsert at line ~100, add `IF (SELECT completed_at FROM public.content_progress WHERE user_id = v_userA AND content_id = 'e92s01-verify-ac4-completed' AND content_type = 'course') IS NULL THEN RAISE EXCEPTION 'AC4 FAIL: completed_at not set on completion'; END IF;`
- **Assertion A2 (P1 #3 — completed_at not reset on subsequent downgrade attempt)**: Capture `completed_at` after first completion into a variable, run a second upsert with `status='not_started'`, re-read and assert unchanged.
- **Assertion A3 (P1 #4 — watched_percent = 0 when duration_seconds = 0)**: Upsert `upsert_video_progress(user, 'e92s01-verify-divzero', 0, 0, now())`. SELECT watched_percent, assert = 0.00.
- **Assertion A4 (P1 #4 — watched_percent = 100 when watched > duration)**: Upsert `upsert_video_progress(user, 'e92s01-verify-overflow', 1200, 1000, now())`. SELECT watched_percent, assert = 100.00.
- **Assertion A5 (P3 #21 — anon INSERT rejected)**: Inside AC3 transaction, after the existing anon SELECT block, add an attempted INSERT as anon role. Wrap in `BEGIN ... EXCEPTION WHEN insufficient_privilege OR check_violation THEN ... END;` to swallow the expected denial. Assert row count did not increase.
- **Assertion A6 (P3 #20 — cross-user UPDATE/DELETE denied on video_progress and study_sessions)**: Extend AC3 RLS transaction. Run `UPDATE public.video_progress SET watched_seconds = 9999 WHERE user_id = v_userB` as authenticated userA. Assert 0 rows affected. Same for DELETE. Repeat for `study_sessions`.
- **Assertion A7 (P3 #19 — _status_rank(NULL) returns NULL via STRICT)**: `SELECT public._status_rank(NULL) IS NULL` → assert TRUE. Distinguishes STRICT behavior from the RAISE path.
- **Assertion A8 (P3 #22 — in_progress→not_started blocked)**: After AC4 completed→not_started test, add a parallel case that upserts `in_progress` first, then `not_started`, and asserts status stays `in_progress`.
- **Assertion A9 (Unit 1 verification — direct UPDATE denied under R4)**: New AC8 block — authenticated user attempts `UPDATE public.content_progress SET status='not_started' WHERE user_id = v_userA`. Under R4 policy split, this should return 0 rows affected. Assert zero rows updated.
- Preserve existing rollback / cleanup structure. All new seed data uses the `e92s01-verify-%` prefix for cleanup compatibility.

**Execution note:** Test-first posture applies selectively — for A9 (direct UPDATE denied), write the assertion *before* applying Unit 1 to observe the failure (RLS FOR ALL allows UPDATE), then apply Unit 1 and confirm the assertion now passes. This validates the RLS change is load-bearing, not just cosmetic.

**Patterns to follow:**
- Assertion idiom: `IF NOT <condition> THEN RAISE EXCEPTION 'ACn FAIL: ...'; END IF;` — matches existing style in verify.sql.
- Content ID prefix: `e92s01-verify-%` — matches existing cleanup query at verify.sql:~312.
- RLS test transaction: existing AC3 `BEGIN ... SET LOCAL ROLE ... set_config ... COMMIT/ROLLBACK` pattern.

**Test scenarios:**
- Happy path: apply R4 migration, run verify.sql, observe `NOTICE: E92-S01 verification: all gates PASSED`.
- Edge case A3: video_progress row with duration_seconds=0 returns watched_percent=0 (not NULL, not error).
- Edge case A4: video_progress row with watched=1200/duration=1000 returns watched_percent=100.00 (capped, not 120.00).
- Error path A9: pre-R4, direct UPDATE succeeds → assertion fails (validates RLS was previously permissive). Post-R4, direct UPDATE affects 0 rows → assertion passes.
- Integration A5, A6: anon INSERT and cross-user UPDATE/DELETE produce 0-row-affected outcomes consistent with RLS silent-denial semantics.

**Verification:**
- `ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/tests/e92-s01-verify.sql` → `NOTICE: E92-S01 verification: all gates PASSED`.
- Intentionally revert Unit 1's RLS policy split, re-run verify.sql → A9 fails. Re-apply Unit 1 → A9 passes. (Sanity check; not committed.)
- Total assertion count in verify.sql increases by 8 (A1-A8) + 1 (A9) = 9. Line count grows by ~100.

---

- [ ] **Unit 4: Rename rollback file and add per-migration stubs**

**Goal:** Clarify that the rollback script covers both migrations (and the new R4 fixup) by renaming and adding short stub files that delegate to the combined rollback.

**Requirements:** P2 #13 (rollback filename mismatch)

**Dependencies:** Unit 1 (R4 fixup exists — its rollback stub references the combined file).

**Files:**
- Rename: `supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql` → `supabase/migrations/rollback/p0_sync_foundation_full_down.sql`
- Create: `supabase/migrations/rollback/20260417000002_p0_sync_foundation_fixups_down.sql` (stub — comment-only, points to combined file)
- Create: `supabase/migrations/rollback/20260417000003_p0_sync_foundation_r4_down.sql` (stub — same)
- Modify: header comments of the renamed file to list all three migrations it covers.

**Approach:**
- The renamed file uses a neutral name (`p0_sync_foundation_full_down.sql`) that no longer implies a single-migration scope.
- Each per-migration stub file contains only a comment block saying "This migration is rolled back as part of `p0_sync_foundation_full_down.sql` — run that file to teardown the entire P0 sync foundation. Per-migration reversal is not supported; rollback is all-or-nothing."
- Update any references in story files or docs to the old filename.

**Patterns to follow:**
- Header comment structure: follow the existing rollback file's header.

**Test scenarios:**
- Test expectation: none — file rename + stub creation, no executable SQL change beyond what was already there.
- Integration: confirm `ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/rollback/p0_sync_foundation_full_down.sql` still produces clean DROPs after being renamed.

**Verification:**
- `git mv` preserves history on the renamed file.
- `grep -r '20260413000001_p0_sync_foundation_down.sql' docs/ supabase/` returns zero hits after references are updated.

---

- [ ] **Unit 5: Log all deferred findings to docs/known-issues.yaml**

**Goal:** Append KI entries for every ce:review finding not fixed in R4. Each entry cites the discovering reviewer, links to the consolidated report, and states whether it's scheduled, wont-fix, or open.

**Requirements:** R7

**Dependencies:** None — orthogonal to Units 1-4.

**Files:**
- Modify: `docs/known-issues.yaml` (append KI-072 through KI-~082)

**Approach:**
- For each deferred finding listed in the Scope Boundaries > Deferred section above, write one KI entry with the schema documented at the top of `docs/known-issues.yaml`.
- `type` field per finding:
  - P2 #7 `last_position` tie → `code`
  - P2 #8 NULL p_status → `code`
  - P2 #9 SQLSTATE mismatch → `code`
  - P2 #10 in_progress at 100% CHECK → `code`
  - P2 #11 NOT VALID constraint follow-up → `tech-debt`
  - P3 #15 UUID literal duplication → `test`
  - P3 #16 VOLATILE DEFAULT pattern note → `tech-debt`
  - P3 #17 _status_rank inlining → `performance`
  - P3 #18 study_sessions silent UPDATE/DELETE → `code`
  - Pre-existing SEC-04 `handle_new_user_entitlement` → `security` (severity HIGH, marked `scheduled_for: e92-hotfix` or similar)
- All entries use `discovered_by: E92-S01-ce-review`, `discovered_on: 2026-04-17`, `status: open` unless specifically scheduled.
- Notes field: 1-2 sentences summarizing the finding plus cite back to `docs/reviews/consolidated-review-R3-2026-04-17-e92-s01.md` (note: this plan's cross-tool review is documented there + in this plan file). For Pre-existing SEC-04, note it's out of scope for E92 epic.

**Patterns to follow:**
- Existing KI-069, KI-070, KI-071 entries (R3 deferrals) — same shape, same fields.

**Test scenarios:**
- Test expectation: none — data-only change.
- Integration: `yq` parse or manual inspection confirms valid YAML (no syntax errors, all required fields present).

**Verification:**
- `grep -c '^  - id: KI-' docs/known-issues.yaml` increases by ~10.
- Last KI id matches the expected highest sequence after append.
- `docs/known-issues.yaml` parses as valid YAML (`python3 -c 'import yaml; yaml.safe_load(open("docs/known-issues.yaml"))'` returns no error).

---

- [ ] **Unit 6: End-to-end verification on titan + commit**

**Goal:** Apply Units 1-4 on titan in order, run the extended verify.sql, confirm all gates pass, then commit all changes.

**Requirements:** R8

**Dependencies:** Units 1, 2, 3, 4, 5 complete.

**Files:**
- No file changes — verification and commit only.

**Approach:**
- Apply R4 migration: `ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/20260417000003_p0_sync_foundation_r4.sql`.
- Run verify: `ssh titan docker exec -i supabase-db psql -U postgres -d postgres < supabase/tests/e92-s01-verify.sql`. Expect `NOTICE: E92-S01 verification: all gates PASSED`.
- Optionally: apply the combined rollback, re-apply all 3 migrations, re-run verify. Confirms the rollback is symmetric and the full sequence is idempotent.
- Update `docs/implementation-artifacts/sessions/e92-s01-checkpoint.md` frontmatter: add `review_gates_passed: [..., r4-micro-round]` and append a new section noting the ce:review findings and R4 resolution.
- Single commit: `fix(e92-s01): R4 micro-round — address ce:review findings (client_request_id DEFAULT removal, RLS split, GRANT hardening, test coverage)`.

**Test scenarios:**
- Happy path: all migrations apply cleanly, verify.sql passes.
- Integration: full teardown + re-apply loop succeeds.

**Verification:**
- titan verify.sql outputs `all gates PASSED`.
- `git log --oneline -1` shows the R4 commit.
- `git status` clean after commit.

## System-Wide Impact

- **Interaction graph:** The RLS policy split is load-bearing for E92-S02+. Any future direct UPDATE callers (admin tools, migrations) must now use `service_role` to bypass RLS. Document in migration header.
- **Error propagation:** Removing `client_request_id` DEFAULT means clients that omit the field will now receive a NOT NULL violation (SQLSTATE 23502) — this is a *new observable error code* clients may encounter. E92-S02+ client wiring must handle it (or guarantee client_request_id is always supplied). Worth calling out in the function header comment and in the E92-S02 story.
- **State lifecycle risks:** None new. The R4 RLS split tightens an existing gap; it doesn't introduce new state.
- **API surface parity:** `_status_rank`, `upsert_content_progress`, `upsert_video_progress` are the three functions that all future sync-related stories (E92-S02 through E97) will compose with. Their signatures are unchanged in R4 — only their bodies (p_user_id guard) and their permissions (GRANT/REVOKE) change.
- **Integration coverage:** The new verify.sql assertions (A3-A9) are integration-level (run against real titan Postgres, not mocked). They are the coverage contract for future stories.
- **Unchanged invariants:** Base migration `20260413000001` is NOT modified. The monotonic upsert semantics (GREATEST on pct/seconds, status rank comparison, last_position LWW > condition) are unchanged. `p_updated_at` clamp is unchanged. `_status_rank` unknown-raise behavior is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Removing `client_request_id` DEFAULT breaks any external callers that were already inserting without it (edge function, admin script). | No external callers exist — E92-S06 client wiring hasn't shipped. The only inserts so far are from `verify.sql` test seeds, which do supply the column. Low risk. |
| Split RLS policy pattern + existing `CREATE POLICY ... FOR ALL` may leave orphaned old policy if `DROP POLICY IF EXISTS` is skipped. | Use `DROP POLICY IF EXISTS "Users access own content_progress" ON public.content_progress;` explicitly before creating the new policies. Idempotent; safe to re-run. |
| R4 migration introduces the `p_user_id IS DISTINCT FROM auth.uid()` guard — `auth.uid()` is NULL when called outside an authenticated session (psql as postgres). Direct admin calls to upsert functions from superuser sessions will now raise `forbidden`. | Document in function header: "Direct admin calls must use service_role JWT or bypass the function via direct INSERT/UPDATE (allowed for service_role). Postgres superuser sessions that call these functions must SET LOCAL jwt.claim.sub to a valid UUID first." This mirrors Supabase convention. |
| verify.sql extension makes the script larger; any future regression that breaks one assertion will cause all subsequent assertions in the same transaction to not run (BEGIN/ROLLBACK scope). | Existing pattern already groups assertions by AC block. New assertions (A1-A9) slot into existing blocks or add new labeled blocks. If one fails, the block fails clearly with the labeled message. |
| `git mv` on rollback file may confuse Supabase CLI tooling if it tracks rollbacks by filename. | Supabase CLI does not auto-apply rollbacks. The file is run manually when needed. Renaming has no runtime impact. |

## Documentation / Operational Notes

- **Migration header comment** on `20260417000003_p0_sync_foundation_r4.sql` must list all 6 fixes, link this plan file, and note that the R4 micro-round was triggered by ce:review (not by a 4th in-house review loop).
- **Function header comments** on `upsert_content_progress` and `upsert_video_progress` must note: (a) the `p_user_id = auth.uid()` guard, (b) admin paths use service_role, not direct superuser calls, (c) `_status_rank` RAISE aborts caller transactions.
- **Checkpoint update**: add a "R4 Micro-Round" section to `docs/implementation-artifacts/sessions/e92-s01-checkpoint.md` summarizing what ce:review surfaced, what R4 fixed, what was deferred, and the final verdict.
- **No Supabase deployment beyond titan**: titan remains the only environment. When Supabase cloud ships later, all 3 migrations + R4 fixup + rollback are applied fresh.
- **Rollout**: no staged rollout — single commit, single push, single PR (post-R4).

## Sources & References

- **ce:review consolidated report (this session)**: the 12-reviewer report produced immediately before this plan, containing all 22 findings with cross-reviewer confidence boosts.
- **R3 consolidated review**: [docs/reviews/consolidated-review-R3-2026-04-17-e92-s01.md](../reviews/consolidated-review-R3-2026-04-17-e92-s01.md)
- **Original E92-S01 plan** (referenced by checkpoint but deleted in branch history): `docs/plans/2026-04-17-001-feat-e92-s01-p0-migrations-extensions-plan.md`
- **Related files**:
  - [supabase/migrations/20260413000001_p0_sync_foundation.sql](../../supabase/migrations/20260413000001_p0_sync_foundation.sql)
  - [supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql](../../supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql)
  - [supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql](../../supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql)
  - [supabase/tests/e92-s01-verify.sql](../../supabase/tests/e92-s01-verify.sql)
  - [docs/known-issues.yaml](../known-issues.yaml)
- **Memory references**:
  - `project_supabase_sync_design.md` — LWW is the core sync contract; idempotency breakage corrupts it.
  - `feedback_review_loop_max_rounds.md` — R4 is a micro-round justified by cross-tool second opinion, not a 4th review loop.
  - `reference_supabase_unraid.md` — titan is the self-hosted Supabase on Unraid.
