## Test Coverage Review: E92-S01 — Supabase P0 Migrations and Extensions (Round 2)

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/7 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description                                                          | Unit Test                                                | E2E Test             | Verdict |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------- | -------------------- | ------- |
| 1   | 4 extensions installed in pg_extension                               | supabase/tests/e92-s01-verify.sql:27-34                  | N/A (SQL-only story) | Covered |
| 2   | 3 tables exist with columns, types, constraints, generated column    | supabase/tests/e92-s01-verify.sql:36-59                  | N/A                  | Covered |
| 3   | RLS blocks cross-user reads; anon blocked                            | supabase/tests/e92-s01-verify.sql:172-243                | N/A                  | Covered |
| 4   | upsert_content_progress monotonic (status, progress_pct, updated_at) | supabase/tests/e92-s01-verify.sql:95-114                 | N/A                  | Covered |
| 5   | upsert_video_progress monotonic (watched_seconds)                    | supabase/tests/e92-s01-verify.sql:116-122                | N/A                  | Covered |
| 6   | Migration idempotent (IF NOT EXISTS / IF EXISTS guards)              | supabase/tests/e92-s01-verify.sql:6 (re-runnable design) | N/A                  | Covered |
| 7   | No moddatetime trigger on content_progress / video_progress          | supabase/tests/e92-s01-verify.sql:61-74                  | N/A                  | Covered |

**Coverage**: 7/7 ACs fully covered | 0 gaps | 0 partial

### R1 Findings Verification

#### HIGH: Committed verification artifact — RESOLVED

`supabase/tests/e92-s01-verify.sql` is present, 264 lines, raises EXCEPTION on any failed assertion. The file has a clear header, usage instructions, idempotent cleanup, and covers AC1-AC7 plus all five Round-1 fixups (\_status_rank raises on unknown, progress_pct=100+in_progress CHECK, future timestamp clamp, last_position LWW, client_request_id uniqueness).

#### HIGH: RLS isolation gaps — RESOLVED

Cross-user SELECT is tested for all three tables (lines 183-204). Cross-user UPDATE (line 207-210 with GET DIAGNOSTICS row count assertion) and cross-user DELETE (lines 213-219) are explicitly asserted to affect 0 rows. Anon role is tested for all three tables (lines 224-243). Both RLS transactions use `BEGIN; SET LOCAL ROLE; ... ROLLBACK;` which is the correct pattern for `auth.uid()` simulation in pgTAP-free environments.

#### MEDIUM: Rollback documented — RESOLVED

`supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql` is present (27 lines), wraps in `BEGIN/COMMIT`, drops functions before tables (correct reverse order), uses `IF EXISTS` + `CASCADE`, explicitly documents that extensions are intentionally NOT dropped. Story file references the rollback script with run instructions at lines 84-95.

### Test Quality Findings

#### Blockers

None.

#### High Priority

None.

#### Medium

- **supabase/tests/e92-s01-verify.sql:50-58 (confidence: 65)**: AC6 (idempotency) is validated by design (the script itself uses `ON CONFLICT DO NOTHING` and can re-run cleanly), but there is no explicit assertion that running the migration twice produces 0 errors — the script tests data idempotency, not DDL idempotency. This is acceptable for a SQL migration story where DDL idempotency is enforced by `CREATE ... IF NOT EXISTS` guards in the migration itself (verified by the task-6.5 manual gate), but an explicit double-apply assertion would strengthen confidence.

#### Nits

- **supabase/tests/e92-s01-verify.sql:184-188**: The "userA sees own rows" guard (`v_visible = 0 THEN RAISE`) is only checked for `content_progress`. `video_progress` and `study_sessions` own-row visibility is implicitly validated by the monotonic tests inserting those rows, but an explicit own-row count assertion for `video_progress` within the RLS transaction block would be more self-contained.
- **supabase/migrations/rollback/20260413000001_p0_sync_foundation_down.sql**: The rollback drops only the base migration + fixup functions but the fixups migration file `20260417000002_p0_sync_foundation_fixups.sql` is not mentioned in the rollback header comment. The story notes (line 95) cover this, but a comment in the rollback SQL itself would prevent ambiguity for future maintainers.

### Edge Cases Covered (R2 confirms present)

- `_status_rank('bogus')` raises with matching error message (line 124-132)
- `progress_pct=100 + status=in_progress` rejected by CHECK constraint (line 135-142)
- Future `p_updated_at` (+100 years) clamped to now (line 144-149)
- `last_position` LWW advances with newer writes (line 152-158)
- `client_request_id` unique constraint blocks duplicate study_session inserts (line 160-169)
- Generated column `watched_percent` verified as `ALWAYS` generated (line 52-58)
- Anon blocked on all three tables individually (lines 229-242)

### Edge Cases Still Missing (low severity)

- `video_progress.watched_percent` edge cases noted in task 6.6 (watched > duration capped at 100; duration=0 yields 0) are described in the story tasks but are NOT present in the SQL verify script. These are observational gaps — the generated column expression in the migration is the enforcement — but an explicit assertion would close the loop. Confidence: 60 (medium-low, since the column definition is validated and the expression is deterministic SQL).
- `completed_at` set-once behavior (task 6.4) is referenced in story tasks but not asserted in the verify script. The script confirms status/progress_pct monotonicity but does not explicitly assert `completed_at IS NOT NULL` after first `completed` write or that it does not change on a second `completed` write. Confidence: 75.

---

ACs: 7 covered / 7 total | Findings: 4 | Blockers: 0 | High: 0 | Medium: 1 | Nits: 2 | R1 findings resolved: 3/3
