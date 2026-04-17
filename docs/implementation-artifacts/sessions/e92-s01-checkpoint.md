---
story_id: E92-S01
saved_at: 2026-04-17 17:39
branch: feature/e92-s01-supabase-p0-migrations-extensions
reviewed: in-progress
review_started: 2026-04-17
review_gates_passed: []
---

## Completed Tasks

- Task 1 — Install 4 extensions (moddatetime, pgcrypto, vector, supabase_vault) in `supabase/migrations/20260413000001_p0_sync_foundation.sql`
- Task 2 — `content_progress` table with standard CRUD RLS and `(user_id, updated_at)` incremental-sync index
- Task 3 — `study_sessions` append-only table with INSERT+SELECT-only RLS (two policies, no UPDATE/DELETE)
- Task 4 — `video_progress` with generated `watched_percent NUMERIC(5,2)` column and RLS
- Task 5 — `_status_rank(TEXT)` helper + `upsert_content_progress(...)` + `upsert_video_progress(...)` (SECURITY INVOKER)
- Task 6 — Applied migration to titan (`supabase-db` container) and ran all 10 verification gates (pg_extension, schema, 0 triggers, RLS isolation with two users, monotonic regressions, idempotency, generated column edge cases)

## Remaining Tasks

None within the story. Story implementation is complete and ready for `/review-story`.

**Follow-up in subsequent stories** (not this story's scope):
- E92-S02: Dexie v52 migration (adds `userId`/`updatedAt` to 30+ Dexie tables, creates `syncQueue`/`syncMetadata`)
- E92-S05 / E92-S06: client code that actually calls the upsert functions created here
- Future consideration: if scrub-back semantics for `last_position` are needed, add an overloaded `upsert_video_progress` that accepts `p_last_position` (current function leaves it unchanged on conflict — see Key Decisions)

## Implementation Progress

```
f713163f docs(e92-s01): mark tasks complete + add verification lessons
af4abb28 feat(e92-s01): monotonic upsert functions + _status_rank helper (Unit 5)
593dd886 feat(e92-s01): create video_progress with generated watched_percent (Unit 4)
cde1ab37 feat(e92-s01): create study_sessions with INSERT-only RLS (Unit 3)
9bd64d02 feat(e92-s01): create content_progress table with RLS (Unit 2)
d37674bc feat(e92-s01): install P0 sync foundation extensions (Unit 1)
c76a68de chore: start story E92-S01
```

## Key Decisions

- **No `moddatetime` trigger on `content_progress` / `video_progress`.** The sync engine (E92-S06) uses client-provided `updated_at` for incremental downloads (`WHERE updated_at >= lastSyncTimestamp`) and LWW comparisons. A server-side trigger that rewrote `updated_at = now()` on every UPDATE would break both invariants. The upsert functions set `updated_at = GREATEST(existing, p_updated_at)` in-function. Migration header comment + AC7 + the `pg_trigger` negative check (0 user triggers) all exist to catch future regressions.
- **`SECURITY INVOKER` on both upsert functions** (not `DEFINER`). RLS applies to the caller — prevents privilege escalation via arbitrary `p_user_id`. Verified: authenticated user A calling `upsert_content_progress(userB_uuid, ...)` is rejected by the `WITH CHECK` clause.
- **`_status_rank` is `IMMUTABLE` + `LANGUAGE sql`** so Postgres can inline it at plan time. No function-call overhead inside the CASE expression.
- **`watched_percent` is a generated column** (`GENERATED ALWAYS AS ... STORED`, `NUMERIC(5,2)`), cannot drift from `watched_seconds / duration_seconds`. Handles `duration_seconds = 0` (→ 0) and `watched > duration` (→ capped at 100.00) by construction.
- **`completed_at` is set-once**: `COALESCE(existing, ...)` pattern preserves the first completion timestamp across re-completions. Matters for analytics and streak calculation.
- **Idempotency pattern: `DROP POLICY IF EXISTS` before `CREATE POLICY`**, because `CREATE POLICY IF NOT EXISTS` is not portable in PG 15. All other DDL uses `IF NOT EXISTS` / `CREATE OR REPLACE`. Migration re-applied twice cleanly.
- **Migration filename uses Supabase CLI timestamp convention** (`20260413000001_p0_sync_foundation.sql`) rather than existing `NNN_*` style. Lexicographic sort preserves ordering (`'0' < '2'`).

## Approaches Tried / What Didn't Work

- **`last_position` LWW-via-EXCLUDED was misleading in the plan.** Plan text said `last_position = EXCLUDED.last_position` for LWW semantics (scrub-back), but since `last_position` is NOT a parameter of `upsert_video_progress`, `EXCLUDED.last_position` on conflict would resolve to the `p_watched_seconds` value that seeded the INSERT — effectively forcing `last_position` to track `watched_seconds` monotonically. Decision: leave `last_position = video_progress.last_position` (unchanged on conflict). A future overload can accept `p_last_position` if real scrub-back is needed.
- **First AC3 RLS test failed (returned 0 rows for both users)**: `set_config(..., is_local=true)` scoped the JWT claims to the transaction that ran the set_config — but the follow-up `SELECT` executed in a new implicit transaction (psql autocommit), so `auth.uid()` returned NULL. Fix: wrap entire RLS test in explicit `BEGIN; SET LOCAL ROLE; set_config(...); SELECT; COMMIT;`. Worth documenting as a test pattern for future RLS stories.

## Current State

Working tree clean relative to story scope. Untracked files are unrelated (other stories' ideation, plan drafts, Stitch library, `.context/`) and pre-existed the story.

```
?? .context/
?? docs/design-references/stitch-library/11-library-format-tabs.html
?? docs/ideation/2026-04-15-books-page-ideation.md
?? docs/plans/2026-04-15-001-feat-multi-provider-metadata-search-plan.md
?? docs/plans/2026-04-16-001-chore-git-branch-stash-audit-plan.md
?? docs/plans/2026-04-16-002-fix-google-books-covers-broken-hires-plan.md
```

Migration applied to titan (`ssh titan docker exec supabase-db psql ...`). Test data was created during verification (two test users + rows) and has been cleaned up — `auth.users` no longer contains `e92s01-*` entries.

## Files Changed

```
 .../92-1-supabase-p0-migrations-and-extensions.md  | 104 +++++
 docs/implementation-artifacts/sprint-status.yaml   |   4 +-
 ...1-feat-e92-s01-p0-migrations-extensions-plan.md | 424 +++++++++++++++++++++
 .../20260413000001_p0_sync_foundation.sql          | 248 ++++++++++++
 4 files changed, 778 insertions(+), 2 deletions(-)
```

## Resumption Notes

Story is functionally complete. Next action: run `/review-story E92-S01` (recommended — RLS/auth-sensitive + defines conflict-resolution contract for every downstream sync story). Build passes. Migration is applied to titan but NOT to any other environment — if a dev DB or CI DB exists, re-apply there before running any code that depends on these tables.
