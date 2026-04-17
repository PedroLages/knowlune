## Test Coverage Review: E92-S01 — Supabase P0 Migrations and Extensions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/7 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

> Note: This is a SQL migration story. No application-layer (Vitest/Playwright) tests are expected or appropriate. All verification is SQL-based, executed live against the titan Postgres container. The story explicitly states this in Testing Notes and the plan's Verification Strategy section. Coverage assessment is based on the SQL verification gates documented in Task 6.

### AC Coverage Table

| AC# | Description                                                                                    | SQL Verification                                                                                              | E2E/Unit Test  | Verdict |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- | ------- |
| 1   | All 4 extensions visible in `pg_extension`                                                     | Task 6.1 — `pg_extension` returns 4 rows on titan                                                             | N/A (DB layer) | Covered |
| 2   | `content_progress`, `study_sessions`, `video_progress` exist with correct schema               | Task 6.1 — schema verified on titan                                                                           | N/A (DB layer) | Covered |
| 3   | RLS blocks cross-user access on all P0 tables                                                  | Task 6.3 — two-user RLS isolation test (cross-user SELECT = 0 rows; cross-user upsert rejected by WITH CHECK) | N/A (DB layer) | Covered |
| 4   | `upsert_content_progress()` is monotonic on status and progress_pct                            | Task 6.4 — completed→not_started stays completed; 80→60 stays 80                                              | N/A (DB layer) | Covered |
| 5   | `upsert_video_progress()` is monotonic on watched_seconds                                      | Task 6.4 — 500→200 stays 500                                                                                  | N/A (DB layer) | Covered |
| 6   | Migration is idempotent                                                                        | Task 6.5 — applied twice, no errors                                                                           | N/A (DB layer) | Covered |
| 7   | `updated_at` on `content_progress`/`video_progress` is client-driven; no `moddatetime` trigger | Task 6.2 — 0 user triggers on both tables; Task 6.4 — older timestamp ignored                                 | N/A (DB layer) | Covered |

**Coverage**: 7/7 ACs fully covered | 0 gaps | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **supabase/migrations/20260413000001_p0_sync_foundation.sql (confidence: 82)**: Verification gates are documented and reportedly executed against titan, but no artefact of the verification run is committed to the repo. The only evidence is prose in the story file and checkpoint. If the titan environment is wiped, there is no repeatable, automated way to re-verify the schema. This is an inherent risk of manual SQL verification — acceptable for a migration story but worth flagging. Fix: Add a `supabase/tests/` pgTAP test file (e.g. `supabase/tests/e92-s01-p0-foundation.sql`) that runs the structural checks (`SELECT ... FROM pg_extension`, `information_schema.columns`, trigger count) as an automated suite. pgTAP is supported by `supabase test db`.

- **AC3 — RLS bypass via `SECURITY DEFINER` function (confidence: 75)**: The upsert functions are correctly `SECURITY INVOKER`. However, the RLS isolation test documented in Task 6.3 only covered direct SELECT and upsert-via-function. It did not verify that a caller cannot bypass RLS by calling an unrelated `SECURITY DEFINER` function to write into another user's row, nor does it verify that a service-role client (bypasses RLS by design) is restricted to known admin paths. This is partially out of scope for a schema story but worth noting for the sync engine stories that wire the client.

#### Medium

- **No rollback test documented (confidence: 72)**: The story's pre-review checklist references the plan § Rollback ("destructive, keeps extensions"). The migration is wrapped in a single `BEGIN; ... COMMIT;` transaction, so a mid-migration failure would auto-roll back. But there is no documented test of a deliberate rollback (e.g. apply to a throwaway DB, then drop the tables, and verify extensions survive). This is a minor gap given the migration is already on titan, but should be addressed if this schema ships to a CI Supabase instance.

- **`study_sessions` has no upsert function (confidence: 65)**: The table is append-only by design and the story doesn't claim otherwise — INSERT-only RLS is intentional. However, the implications for duplicate INSERT (e.g., client retries on network failure) are not tested. The table has no `ON CONFLICT DO NOTHING` uniqueness guard on `(user_id, started_at)` — a retry would insert a duplicate session. This is a design gap, not a test gap, but it lacks any verification. Confidence is 65 because the downstream E92-S05 streak story may address this.

#### Nits

- **Nit — migration filename timestamp (confidence: 90)**: The file is named `20260413000001_p0_sync_foundation.sql` (April 13) but the story was authored on April 17. This is noted in the checkpoint and is not a correctness issue, but it could confuse anyone comparing file dates to commit history. No action required — just documenting.

- **Nit — `_status_rank` does not guard against `NULL` input (confidence: 60)**: `_status_rank(NULL)` returns 0 (the `ELSE 0` branch). This is fine for the current CASE expression, but if a future caller passes a NULL status and expects an error, the silent `0` could cause unexpected behavior. Consider adding a `WHEN s IS NULL THEN -1` branch or a `RAISE` to fail loud.

### Edge Cases to Consider

1. **Clock skew — `updated_at` older than now()**: If a client's clock is significantly behind the server, `p_updated_at` could be older than an existing row's `updated_at`, and the `GREATEST(existing, p_updated_at)` guard would silently discard the incoming update's timestamp. The data would still be correct (existing timestamp is preserved), but the sync engine's `WHERE updated_at >= lastSyncTimestamp` cursor could miss the row on the next incremental pull if the client later corrects its clock. Task 6.4 tests this for `updated_at` (older timestamp ignored — correct), but the cursor skew implication is not tested.

2. **Concurrent upserts for same `(user_id, content_id, content_type)`**: Two racing `upsert_content_progress()` calls in the same millisecond for the same row could hit a serialization conflict. The function uses `INSERT ... ON CONFLICT DO UPDATE` which is atomic per-row in Postgres, so a true race will serialize correctly — but this is not explicitly tested.

3. **`progress_pct = 100` without `status = 'completed'`**: A client could send `progress_pct=100, status='in_progress'`. The schema allows this (no CHECK enforces the correlation). The upsert function would store `progress_pct=100` with `status='in_progress'` and leave `completed_at=NULL`. Downstream analytics that derive completion from `progress_pct=100` would disagree with `status`. No verification covers this scenario.

4. **`content_type` value not in CHECK list**: Calling `upsert_content_progress(... , 'audiobook', ...)` would raise a CHECK constraint violation from the INSERT, which is correct. But the error surface from the plpgsql function is an unhandled exception — the client gets a Postgres error code, not a structured response. This is acceptable for a schema story but should be noted for the client-wiring stories.

5. **`video_progress` with `watched_seconds > duration_seconds` on INSERT (not update)**: The generated column caps `watched_percent` at 100.00 (verified in Task 6.6), but the row itself stores `watched_seconds > duration_seconds`. The CHECK only enforces `>= 0` for each independently. A future query that compares `watched_seconds` to `duration_seconds` without going through `watched_percent` could behave unexpectedly.

---

ACs: 7 covered / 7 total | Findings: 7 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 3
