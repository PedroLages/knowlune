## Test Coverage Review: E92-S01 — Supabase P0 Migrations and Extensions (Round 3)

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/7 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 4 extensions installed in pg_extension | supabase/tests/e92-s01-verify.sql:28-34 | N/A (SQL-only story) | Covered |
| 2 | 3 tables, columns, constraints, generated column | supabase/tests/e92-s01-verify.sql:37-59 | N/A | Covered |
| 3 | RLS blocks cross-user SELECT/UPDATE/DELETE; anon blocked | supabase/tests/e92-s01-verify.sql:172-250 | N/A | Covered |
| 4 | upsert_content_progress monotonic (status, progress_pct, updated_at) | supabase/tests/e92-s01-verify.sql:95-114 | N/A | Covered |
| 5 | upsert_video_progress monotonic (watched_seconds) | supabase/tests/e92-s01-verify.sql:116-122 | N/A | Covered |
| 6 | Object counts stable — each target object exists exactly once | supabase/tests/e92-s01-verify.sql:257-309 | N/A | Covered |
| 7 | No moddatetime trigger on content_progress / video_progress | supabase/tests/e92-s01-verify.sql:61-74 | N/A | Covered |

**Coverage**: 7/7 ACs fully covered | 0 gaps | 0 partial

### R3 Focus Area Verdicts

**1. AC-to-test traceability.** Complete. Every AC maps to at least one RAISE EXCEPTION assertion. No gaps.

**2. Negative monotonic regressions explicitly tested.** Confirmed present:
- `status`: completed→not_started at lines 96-101 — status remains `completed`.
- `progress_pct`: 100→0 at lines 102-105 — pct remains `100`.
- `watched_seconds`: 500→200 at lines 117-122 — watched_seconds remains `500`.
- `updated_at`: older timestamp attempt at lines 108-114 — updated_at not regressed.

These are genuine backward-regression probes, not just forward-progress checks. Sufficient.

**3. DDL idempotency ("apply migration twice").** Not exercised as a live double-apply. The AC6 block (lines 257-309) asserts each target object (2 constraints, 3 functions, 3 tables, 1 column) exists exactly once — which would catch any duplicate object introduced by a misapplied migration. This is an adequate proxy. The R2 Medium finding stands at the same severity; no regression here.

**4. R2 open edge cases.** Both remain absent from the script (unchanged from R2):
- `watched_percent` cap at 100 and div-by-zero guard (task 6.6 in story). Confidence: 60.
- `completed_at` set-once behavior not asserted. Confidence: 75.

**5. R2 fixups — RLS userB seed and AC6 object count.** Both solid. UserB rows are seeded via `service_role` at lines 181-189 before switching to userA. ROLLBACK at line 229 discards all seeded rows cleanly. AC6 object-count assertions are explicit and raise on mismatch.

### Test Quality Findings

#### Blockers

None.

#### High Priority

None.

#### Medium

- **supabase/tests/e92-s01-verify.sql:217-227 (confidence: 55)**: Cross-user UPDATE and cross-user DELETE are only asserted for `content_progress`. `video_progress` and `study_sessions` cross-user mutation is not explicitly tested. The RLS policy structure is identical across all three tables and cross-user SELECT is verified for all three (lines 205-215), so this is a low-risk gap. To close: add `UPDATE public.video_progress SET watched_seconds = 1 WHERE user_id = userB; GET DIAGNOSTICS v_cross = ROW_COUNT; ASSERT v_cross = 0` and the equivalent for `study_sessions` inside the same RLS transaction block. Severity held at Medium from R2, not escalated.

- **supabase/tests/e92-s01-verify.sql (confidence: 75)**: `completed_at` set-once behavior is referenced in story task 6.4 but has no assertion in the verify script. The monotonic tests at lines 95-104 confirm status/progress_pct stay at `completed`/`100` after a `not_started` upsert, but do not assert: (a) `completed_at IS NOT NULL` after the first `completed` write, or (b) `completed_at` does not change on a second `completed` upsert. To add: after the existing AC4 monotonic block, `IF (SELECT completed_at FROM public.content_progress WHERE user_id=v_userA AND content_id='e92s01-verify-c1') IS NULL THEN RAISE EXCEPTION 'AC4 FAIL: completed_at not set'; END IF;` and a second upsert confirming the value is unchanged. Carried from R2 at same severity.

#### Nits

- **supabase/tests/e92-s01-verify.sql:196-228**: Own-row visibility (`v_visible > 0`) guard is checked only for `content_progress` (line 200-204). `video_progress` and `study_sessions` own-row visibility within the RLS transaction block is implicitly validated by the monotonic seeds earlier in the script, but an explicit count inside the RLS transaction would make the test self-contained. Carried from R2 at Nit severity.

- **supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql**: The fixups migration `20260417000002_p0_sync_foundation_fixups.sql` is not mentioned in the rollback SQL header comment. Story notes cover this at line 95, but a comment in the SQL file itself would aid future maintainers. Carried from R2 at Nit severity.

### Edge Cases Confirmed Covered

- `_status_rank('bogus')` raises with matching error message (line 124-132) — confirmed.
- `progress_pct=100 + status=in_progress` rejected by CHECK constraint (line 134-142) — confirmed.
- Future `p_updated_at` (+100 years) clamped to now (line 144-150) — confirmed.
- `last_position` LWW advances with newer writes (line 152-158) — confirmed.
- `client_request_id` unique constraint blocks duplicate study_session inserts (line 160-169) — confirmed.
- `watched_percent` is ALWAYS GENERATED (line 52-58) — column definition confirmed.
- Anon role blocked on all three tables individually (lines 232-250) — confirmed.
- UserB rows seeded before RLS switch, so cross-user SELECT returning 0 is a real test (lines 181-207) — confirmed solid.

### Edge Cases Still Absent (unchanged from R2)

- `video_progress.watched_percent` capped at 100 when `watched_seconds > duration_seconds` — no explicit assertion. Confidence: 60 (low).
- `video_progress.watched_percent` yields 0 when `duration_seconds = 0` (no div-by-zero) — no explicit assertion. Confidence: 60 (low).
- `completed_at` set-once invariant not asserted. Confidence: 75 (medium).

---

ACs: 7 covered / 7 total | Findings: 4 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 2 | R2 findings resolved: all R2 fixups confirmed solid | New findings: 0
