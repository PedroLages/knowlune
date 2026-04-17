---
title: "feat: E92-S01 — Supabase P0 Migrations and Extensions"
type: feat
status: active
date: 2026-04-17
deepened: 2026-04-17
origin: docs/planning-artifacts/epics-supabase-data-sync.md
---

# feat: E92-S01 — Supabase P0 Migrations and Extensions

## Overview

Creates the foundational Postgres layer that the entire sync engine (E92-E97) writes into. Installs 4 Postgres extensions and creates 3 P0 tables (`content_progress`, `study_sessions`, `video_progress`) with RLS policies and monotonic upsert functions. This is a pure database migration — no client code ships in this story.

## Problem Frame

Knowlune is offline-first (Dexie/IndexedDB). Supabase currently handles only auth + entitlements + calendar tokens. E92 builds full data sync. Before the sync engine can push or pull records, the Supabase schema must exist. E92-S01 creates the minimum schema needed to unblock every subsequent story in the epic.

## Requirements Trace

- R1. 4 extensions installed: `moddatetime`, `pgcrypto`, `vector`, `supabase_vault`
- R2. Tables `content_progress`, `study_sessions`, `video_progress` created with correct columns and types
- R3. RLS policies on all P0 tables restrict access to `auth.uid() = user_id`
- R4. `upsert_content_progress()` enforces monotonic status precedence (`completed > in_progress > not_started`) and `GREATEST()` on `progress_pct`
- R5. `upsert_video_progress()` enforces `GREATEST()` on `watched_seconds`
- R6. `updated_at` columns auto-updated via `moddatetime` trigger
- R7. Migration is idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`)

## Scope Boundaries

- Only the 3 P0 tables. P1–P4 tables, user_settings, and all other sync tables are out of scope (separate stories E93+)
- No client-side TypeScript code in this story — that begins in E92-S02
- No Storage buckets in this story
- Extensions are installed at the database level; Edge Functions for Vault are E95 scope

## Context & Research

### Relevant Code and Patterns

- `supabase/migrations/001_entitlements.sql` — establish pattern: header comment, table DDL, RLS enable + policies, helper functions, triggers
- `supabase/migrations/002_calendar_tokens.sql` — pattern for index and per-user RLS
- `docs/plans/2026-03-31-supabase-data-sync-design.md` — canonical schema spec: column patterns, RLS templates, upsert function signatures, migration order
- Design doc §"Common Column Pattern": all mutable tables use `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at`, `updated_at` with `moddatetime` trigger
- Design doc §"RLS Policy Templates": standard CRUD template vs. INSERT+SELECT-only (immutable) template

### Institutional Learnings

- `study_sessions` is INSERT-only (append log) — use the immutable RLS template (SELECT + INSERT only, no UPDATE/DELETE policies)
- `content_progress` and `video_progress` use monotonic upsert functions; standard CRUD RLS applies because clients call the Postgres function which handles conflict resolution internally
- `vector` extension is installed now but not used until E93 (pgvector search for embeddings)
- `supabase_vault` is installed now but not used until E95 (credential storage)

### External References

- Supabase migration file format: timestamp prefix `YYYYMMDDHHMMSS_description.sql` (Supabase CLI convention)
- `moddatetime` docs: trigger must be created after the table; function is `extensions.moddatetime()`
- pgvector: `CREATE EXTENSION IF NOT EXISTS vector` must run before any `vector(N)` column types

## Key Technical Decisions

- **Timestamp-prefix migration filename** (`20260413000001_p0_sync_foundation.sql`): The story spec prescribes this exact name. Departs from existing `NNN_description.sql` style but is the Supabase CLI standard and must not be changed. Lexicographic sort order still places it after `001_*` and `002_*` (ASCII `'0'` < `'2'`), so migration ordering is preserved.
- **`study_sessions` uses INSERT-only RLS**: No UPDATE or DELETE policies — append-only log semantics, consistent with design doc "Immutable INSERT+SELECT" template.
- **Monotonic upsert functions are Postgres functions (not client logic)**: Status precedence and `GREATEST()` are enforced in the DB so any client implementation that calls the function gets correct behavior automatically.
- **`updated_at` is client-driven on progress tables — NOT via `moddatetime` trigger.** On `content_progress` and `video_progress`, the upsert functions set `updated_at = GREATEST(existing, p_updated_at)` using the client's wall-clock timestamp. The `moddatetime` trigger is intentionally **not** installed on these tables because it would overwrite the client timestamp with server `now()`, breaking the incremental download query in E92-S06 (`WHERE updated_at >= lastSyncTimestamp`) and LWW conflict resolution. `moddatetime` is still installed as an extension for future non-synced tables.
- **`IF NOT EXISTS` throughout**: Makes the migration safe to re-run (idempotent), satisfying R7.
- **Extensions installed with `schema = extensions`**: The `moddatetime` extension function lives in the `extensions` schema; triggers (if later added to non-sync tables) must reference `extensions.moddatetime`.
- **Transactional DDL**: The migration file is wrapped in `BEGIN; ... COMMIT;` so partial failure rolls back cleanly. Exception: `CREATE EXTENSION` for `pgsodium`/`supabase_vault` may require superuser and is not always transactional — extensions are installed at the top of the file; if an extension CREATE fails, the entire migration fails before any table DDL runs.
- **Status precedence as a helper function, not inline CASE**: Define `_status_rank(TEXT) RETURNS INT` inside the migration. Reusable by future monotonic state tables (E93+ `books.status`, etc.) and keeps the upsert function body readable.

## Target Environment (Verified 2026-04-17)

Target: self-hosted Supabase on Unraid (`titan.local`), container `supabase-db` on image `supabase/postgres:15.8.1.085`. Verified via `ssh titan` before planning:

| Extension | Status on titan |
|---|---|
| `moddatetime` 1.0 | Available, not installed — this migration installs it |
| `pgcrypto` 1.3 | **Already installed** in schema `extensions` — `CREATE EXTENSION IF NOT EXISTS` is a no-op |
| `vector` 0.8.0 | Available, not installed — this migration installs it |
| `supabase_vault` 0.3.1 | **Already installed** in schema `vault` — `CREATE EXTENSION IF NOT EXISTS` is a no-op |
| `pgsodium` 3.1.8 | Available (not used — `supabase_vault` is preinstalled and is the correct abstraction) |

Postgres: 15.8. pgvector (needs ≥ 13) and Vault (needs ≥ 15) both supported.

**Implication:** The migration's `CREATE EXTENSION IF NOT EXISTS supabase_vault;` and `CREATE EXTENSION IF NOT EXISTS pgcrypto;` statements are **safe no-ops** on this instance — they're included for portability to fresh databases (dev, CI, other environments). The only extensions actually installed by this migration on titan are `moddatetime` and `vector`.

**Before re-applying to any other environment** (new dev DB, CI), re-run this preflight to confirm the same extensions are available:

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name IN ('moddatetime', 'pgcrypto', 'vector', 'supabase_vault');
SELECT version();
```

## Open Questions

### Resolved During Planning

- **Which RLS template for `content_progress` and `video_progress`?** Standard CRUD (`FOR ALL`) — clients write via the upsert functions, so UPDATE/DELETE access is needed for future direct client writes too. (see origin: docs/planning-artifacts/epics-supabase-data-sync.md)
- **Should `upsert_*` functions be `SECURITY DEFINER`?** No — they operate on behalf of the calling user; `SECURITY INVOKER` (default) is correct. RLS applies normally.
- **`flashcard_reviews` in this story?** No — the design doc lists it as a Supabase-only table created in E93-S01.
- **Does `video_progress` need a `watched_percent` column?** The story spec prescribes only `watched_seconds` and `duration_seconds`. The design doc mentions `watched_percent` but as a computed/derived concept. **Decision:** Add `watched_percent` as a **generated column**: `watched_percent NUMERIC GENERATED ALWAYS AS (CASE WHEN duration_seconds > 0 THEN LEAST(100, (watched_seconds::numeric / duration_seconds) * 100) ELSE 0 END) STORED`. This satisfies both sources — monotonic `watched_seconds` drives the value, and `watched_percent` is always consistent. Story spec's `GREATEST(watched_seconds)` rule is the authority; percent regression is impossible by construction.
- **Should `moddatetime` trigger fire on progress tables?** **No.** The `moddatetime` trigger overwrites `updated_at` with server `now()` on every UPDATE. But E92-S06 (download phase) relies on the client's wall-clock timestamp surviving the upsert (`WHERE updated_at >= lastSyncTimestamp` incremental fetch + LWW comparisons). The upsert functions set `updated_at = GREATEST(existing, p_updated_at)` directly. No trigger on `content_progress` or `video_progress`. The `moddatetime` extension is still installed because future non-synced tables (admin tables, audit logs) can use it normally.

### Deferred to Implementation

- Exact column lengths / text constraints (e.g., `content_type CHECK (...)` enum values): implementer should cross-reference `docs/plans/2026-03-31-supabase-data-sync-design.md` P0 table spec for any type refinements.
- Whether `supabase db diff` or `supabase migration new` tooling is used — CLI workflow is an execution decision.

## Implementation Units

- [ ] **Unit 1: Install Extensions**

**Goal:** Install all 4 Postgres extensions required by the sync foundation.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260413000001_p0_sync_foundation.sql`

**Approach:**
- Open the migration file with a header comment identifying E92-S01
- `CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;`
- `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`
- `CREATE EXTENSION IF NOT EXISTS vector;`
- `CREATE EXTENSION IF NOT EXISTS supabase_vault;`
- All use `IF NOT EXISTS` for idempotency

**Patterns to follow:**
- `supabase/migrations/001_entitlements.sql` — header comment format

**Test scenarios:**
- Happy path: `SELECT extname FROM pg_extension WHERE extname IN ('moddatetime','pgcrypto','vector','supabase_vault')` returns 4 rows after migration
- Idempotency: Re-running the migration section does not throw

**Verification:**
- `SELECT extname FROM pg_extension` lists all 4 extensions

---

- [ ] **Unit 2: Create `content_progress` Table**

**Goal:** Create the `content_progress` table with correct schema, RLS policy, and index for incremental sync queries. No `moddatetime` trigger — `updated_at` is client-driven (see Key Technical Decisions).

**Requirements:** R2, R3

**Dependencies:** Unit 1 (extensions installed)

**Files:**
- Modify: `supabase/migrations/20260413000001_p0_sync_foundation.sql`

**Approach:**
- Columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `content_id TEXT NOT NULL`, `content_type TEXT NOT NULL CHECK (content_type IN ('course','video','pdf','book'))`, `status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed'))`, `progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100)`, `completed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Unique constraint on `(user_id, content_id, content_type)` — one row per user per content item
- Index on `(user_id, updated_at)` — required by E92-S06 incremental download query (`WHERE user_id = ? AND updated_at >= lastSyncTimestamp`)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- Standard CRUD policy: `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- **No `moddatetime` trigger** — `updated_at` is set by `upsert_content_progress()` using the client's timestamp (see Unit 5). Direct UPDATEs (future admin/migration paths) must set `updated_at = now()` explicitly.

**Patterns to follow:**
- `docs/plans/2026-03-31-supabase-data-sync-design.md` §"Common Column Pattern"
- `docs/plans/2026-03-31-supabase-data-sync-design.md` §"RLS Policy Templates" — standard CRUD

**Test scenarios:**
- Happy path: `INSERT INTO content_progress (...) VALUES (...)` with valid user context succeeds
- RLS isolation: session as userA cannot `SELECT` rows owned by userB (verify by setting `request.jwt.claims` to each user and querying)
- CHECK constraints: inserting `status = 'bogus'` or `progress_pct = 150` or `content_type = 'xyz'` fails with constraint violation
- Unique constraint: two rows with same `(user_id, content_id, content_type)` fails
- Idempotency: `CREATE TABLE IF NOT EXISTS` does not error on re-run
- No trigger side-effect: direct `UPDATE content_progress SET progress_pct = 50` does NOT auto-advance `updated_at` (confirms absence of `moddatetime` — critical for upsert function correctness)

**Verification:**
- `\d content_progress` shows all columns, unique constraint, CHECK constraints, and the `(user_id, updated_at)` index
- `\dy content_progress` (or `SELECT tgname FROM pg_trigger WHERE tgrelid = 'content_progress'::regclass AND NOT tgisinternal`) shows **zero** user triggers
- RLS test query returns 0 rows for cross-user access

---

- [ ] **Unit 3: Create `study_sessions` Table**

**Goal:** Create the `study_sessions` append-only table with INSERT-only RLS (no UPDATE/DELETE).

**Requirements:** R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `supabase/migrations/20260413000001_p0_sync_foundation.sql`

**Approach:**
- Columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `started_at TIMESTAMPTZ NOT NULL`, `duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0)`, `idle_seconds INTEGER NOT NULL DEFAULT 0 CHECK (idle_seconds >= 0)`, `interaction_count INTEGER NOT NULL DEFAULT 0 CHECK (interaction_count >= 0)`, `breaks INTEGER NOT NULL DEFAULT 0 CHECK (breaks >= 0)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- No `updated_at` column — sessions are immutable records once written (E92-S06 downloads `study_sessions` by `created_at` cursor instead)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY`
- INSERT-only RLS (immutable template from design doc):
  - `CREATE POLICY "insert_own" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id)`
  - `CREATE POLICY "select_own" ON study_sessions FOR SELECT USING (auth.uid() = user_id)`
  - No UPDATE or DELETE policies
- No `moddatetime` trigger (no `updated_at` column)
- Index on `(user_id, started_at)` for streak calculation queries (`calculate_streak()` function, E92-S05)
- Index on `(user_id, created_at)` for E92-S06 incremental download cursor

**Patterns to follow:**
- `docs/plans/2026-03-31-supabase-data-sync-design.md` §"RLS Policy Templates" — Immutable INSERT+SELECT template

**Test scenarios:**
- Happy path: `INSERT INTO study_sessions (user_id, started_at, duration_seconds, ...) VALUES (...)` succeeds for authenticated user
- RLS isolation: authenticated user cannot SELECT sessions belonging to another user
- No UPDATE: `UPDATE study_sessions SET duration_seconds = 999 WHERE ...` fails (no policy)
- No DELETE: `DELETE FROM study_sessions WHERE ...` fails for authenticated role
- Idempotency: `CREATE TABLE IF NOT EXISTS` does not error

**Verification:**
- `SELECT policyname FROM pg_policies WHERE tablename = 'study_sessions'` shows exactly 2 policies (insert_own, select_own)
- UPDATE and DELETE attempts from `authenticated` role are rejected

---

- [ ] **Unit 4: Create `video_progress` Table**

**Goal:** Create the `video_progress` table with client-driven `updated_at` (no `moddatetime` trigger), a generated `watched_percent` column, RLS, and incremental-sync index.

**Requirements:** R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `supabase/migrations/20260413000001_p0_sync_foundation.sql`

**Approach:**
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `video_id TEXT NOT NULL`
  - `watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0)`
  - `duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0)`
  - `last_position INTEGER NOT NULL DEFAULT 0 CHECK (last_position >= 0)`
  - `watched_percent NUMERIC(5,2) GENERATED ALWAYS AS (CASE WHEN duration_seconds > 0 THEN LEAST(100::numeric, (watched_seconds::numeric / duration_seconds) * 100) ELSE 0 END) STORED` — always consistent with `watched_seconds / duration_seconds`; monotonic by construction since `watched_seconds` is monotonic
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Unique constraint on `(user_id, video_id)`
- Index on `(user_id, updated_at)` — E92-S06 incremental download
- Standard CRUD RLS policy: `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- **No `moddatetime` trigger** — `updated_at` is set by `upsert_video_progress()` using the client's timestamp (see Unit 5).

**Patterns to follow:**
- Same structural pattern as `content_progress` (Units 2 and 4 are parallel)

**Test scenarios:**
- Happy path: INSERT with valid user context succeeds
- RLS isolation: cross-user SELECT returns no rows
- Generated column: `INSERT (watched_seconds=300, duration_seconds=600)` → `watched_percent = 50.00`; `UPDATE watched_seconds = 450` → `watched_percent = 75.00` automatically
- Generated column edge case: `duration_seconds = 0` → `watched_percent = 0` (no division by zero)
- Generated column upper bound: `watched_seconds > duration_seconds` → `watched_percent = 100.00` (capped by `LEAST`)
- CHECK constraints reject negative values
- Unique constraint: two rows with same `(user_id, video_id)` fails
- No trigger side-effect: direct `UPDATE video_progress SET watched_seconds = 100` does NOT auto-advance `updated_at`
- Idempotency: re-run does not error

**Verification:**
- `\d video_progress` shows unique constraint on `(user_id, video_id)`, the `(user_id, updated_at)` index, and **no** triggers
- Generated column tests return expected percent values

---

- [ ] **Unit 5: Monotonic Upsert Functions**

**Goal:** Create `_status_rank()` helper and the two monotonic upsert functions (`upsert_content_progress`, `upsert_video_progress`) that drive conflict resolution in the database.

**Requirements:** R4, R5, R6 (the upsert functions are what *maintain* `updated_at` now that `moddatetime` trigger is absent)

**Dependencies:** Units 2, 4 (tables must exist before functions reference them)

**Files:**
- Modify: `supabase/migrations/20260413000001_p0_sync_foundation.sql`

**Approach:**

**Step 5a — Status rank helper** (`IMMUTABLE` so Postgres can inline it):

`_status_rank(s TEXT) RETURNS INT` returns `3` for `completed`, `2` for `in_progress`, `1` for `not_started`, `0` otherwise. Underscore prefix signals internal helper; reusable by E93+ state-machine tables.

**Step 5b — `upsert_content_progress(p_user_id, p_content_id, p_content_type, p_status, p_progress_pct, p_updated_at)`:**
- `INSERT INTO content_progress (user_id, content_id, content_type, status, progress_pct, completed_at, updated_at) VALUES (p_user_id, p_content_id, p_content_type, p_status, p_progress_pct, CASE WHEN p_status = 'completed' THEN p_updated_at ELSE NULL END, p_updated_at) ON CONFLICT (user_id, content_id, content_type) DO UPDATE SET ...`
- `status = CASE WHEN _status_rank(EXCLUDED.status) > _status_rank(content_progress.status) THEN EXCLUDED.status ELSE content_progress.status END`
- `progress_pct = GREATEST(content_progress.progress_pct, EXCLUDED.progress_pct)`
- `updated_at = GREATEST(content_progress.updated_at, p_updated_at)` — **critical:** this is what makes `updated_at` monotonic in the absence of a `moddatetime` trigger
- `completed_at = COALESCE(content_progress.completed_at, CASE WHEN _status_rank(EXCLUDED.status) > _status_rank(content_progress.status) AND EXCLUDED.status = 'completed' THEN p_updated_at ELSE NULL END)` — set once when status first advances to `completed`; never overwritten

**Step 5c — `upsert_video_progress(p_user_id, p_video_id, p_watched_seconds, p_duration_seconds, p_updated_at)`:**
- Note: `last_position` is NOT a parameter (story spec omits it); default to `watched_seconds` for the initial INSERT. If a future story needs explicit `last_position` control, add an overload then.
- `INSERT INTO video_progress (user_id, video_id, watched_seconds, duration_seconds, last_position, updated_at) VALUES (p_user_id, p_video_id, p_watched_seconds, p_duration_seconds, p_watched_seconds, p_updated_at) ON CONFLICT (user_id, video_id) DO UPDATE SET ...`
- `watched_seconds = GREATEST(video_progress.watched_seconds, EXCLUDED.watched_seconds)`
- `duration_seconds = GREATEST(video_progress.duration_seconds, EXCLUDED.duration_seconds)` — duration can increase as video buffers/loads; never decrease (prevents a short-probe from clobbering a full-duration known value)
- `last_position = EXCLUDED.last_position` (LWW — cursor is the most-recent wall-clock position; may legitimately rewind when user scrubs back)
- `updated_at = GREATEST(video_progress.updated_at, p_updated_at)`
- (`watched_percent` is a generated column — Postgres recomputes it automatically from the new `watched_seconds` / `duration_seconds`)

All functions: `LANGUAGE plpgsql` (or `LANGUAGE sql` for `_status_rank`), `SECURITY INVOKER`, `CREATE OR REPLACE`. `_status_rank` marked `IMMUTABLE`; upserts are `VOLATILE` (they write).

**Patterns to follow:**
- `supabase/migrations/001_entitlements.sql` — `CREATE OR REPLACE FUNCTION` pattern
- Design doc §"Key Postgres Functions" — upsert function signatures

**Test scenarios (covers AC 4 and 5 directly):**
- **Happy path — content:** `upsert_content_progress(uid, 'c1', 'course', 'in_progress', 40, t1)` → row exists, status `in_progress`, progress `40`, updated_at `t1`, completed_at `NULL`
- **Monotonic status regression (AC 4):** after `completed`, call with `not_started` → status stays `completed`
- **Monotonic status advance:** `not_started` → `in_progress` → `completed` → all advance correctly
- **`GREATEST()` progress (AC 4):** insert `progress_pct=80`, then call with `progress_pct=60` → stays `80`
- **`completed_at` set-once:** first `completed` call at `t2` sets `completed_at = t2`; subsequent calls at `t3` do not overwrite
- **`updated_at` monotonicity:** call with `p_updated_at = t1`, then call again with older `p_updated_at = t0` → `updated_at` stays `t1` (this is what used to come from `moddatetime` — now enforced in-function)
- **Happy path — video:** `upsert_video_progress(uid, 'v1', 100, 600, t1)` → row exists with `watched_seconds=100`, `watched_percent≈16.67`
- **Monotonic watched (AC 5):** call with `watched_seconds=100`, then with `watched_seconds=80` → stays `100`
- **Duration non-regression:** insert `duration_seconds=600`, then call with `duration_seconds=10` (a short probe) → stays `600`
- **Generated `watched_percent` recomputes:** after monotonic update, `watched_percent` reflects the new `watched_seconds`
- **`_status_rank` helper:** returns 3/2/1/0 for `completed`/`in_progress`/`not_started`/unknown
- **Idempotency:** `CREATE OR REPLACE FUNCTION` does not error on re-run
- **RLS (upserts use SECURITY INVOKER):** calling `upsert_content_progress` for a different `p_user_id` than the caller's `auth.uid()` fails the RLS `WITH CHECK` clause

**Verification:**
- Direct psql calls to both functions with test data confirm monotonic behavior
- `SELECT * FROM content_progress` after out-of-order status calls shows correct final state
- `SELECT _status_rank('completed'), _status_rank('in_progress'), _status_rank('not_started'), _status_rank('bogus')` returns `3, 2, 1, 0`

---

## System-Wide Impact

- **Interaction graph:** Only affects Supabase Postgres — no TypeScript client code changes. Downstream E92-S05 (upload) and E92-S09 (wire stores) will call these upsert functions.
- **Error propagation:** If migration fails mid-run (e.g., extension not available), the incomplete migration must be rolled back manually before retrying. All DDL in a single transaction where possible.
- **State lifecycle risks:** The migration must run exactly once on the production database. The `IF NOT EXISTS` guards and `CREATE OR REPLACE` make re-runs safe, but the migration file should not be edited after applying to production (Supabase CLI convention).
- **Unchanged invariants:** `entitlements` and `calendar_tokens` tables are untouched. Existing auth.users rows unaffected.
- **Integration coverage:** E92-S09 integration test (`tests/sync/p0-sync.spec.ts`) is where end-to-end Supabase round-trip is verified — that is out of scope here, but the schema this story creates is the prerequisite.

## Risks & Dependencies

Preflight already verified that `supabase_vault`, `pgcrypto`, `moddatetime`, and `vector` are present/available on titan (see Target Environment section). Remaining risks:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Developer re-introduces `moddatetime` trigger on `content_progress` or `video_progress` in a future migration, silently breaking LWW sync | Medium (the pattern is installed on other tables so it looks "standard") | High (E92-S06 download becomes non-idempotent; sync loops possible) | Unit 2/4 "no-trigger side-effect" tests catch this; add a comment in the migration SQL explaining *why* these two tables omit the trigger |
| Migration filename `20260413000001` applied on 2026-04-17 | Low | None | Supabase CLI applies in filename order; timestamp is a sequence key, not wall-clock |
| Direct `UPDATE` on progress tables (outside upsert functions) bypasses monotonicity | Low in this epic (sync engine is the only writer) | High if triggered | Document as a contract in the migration file header; rely on code review + integration tests in E92-S05 |
| `gen_random_uuid()` unavailable if `pgcrypto` missing | None (verified installed on titan) | N/A | Migration `CREATE EXTENSION IF NOT EXISTS pgcrypto` is a no-op but documents the dependency for fresh environments |
| Generated column `watched_percent` differs between Postgres versions | Low (syntax stable since PG12; titan is PG15) | None | `GENERATED ALWAYS AS ... STORED` is the only form used; `NUMERIC(5,2)` is explicit to avoid float drift |

## Verification Strategy

End-to-end validation that this migration satisfies all 7 requirements:

1. **Fresh-database apply** — in a disposable environment (local `supabase db reset` or a scratch container), run `supabase migration up`. Migration must apply cleanly with no errors.

2. **Extension check (R1):**
   ```sql
   SELECT extname FROM pg_extension
   WHERE extname IN ('moddatetime','pgcrypto','vector','supabase_vault');
   -- Expect: 4 rows
   ```

3. **Schema check (R2):**
   ```sql
   \d content_progress
   \d study_sessions
   \d video_progress
   -- Expect: columns, constraints, indexes as specified in Units 2-4
   ```

4. **Trigger negative check (our key invariant):**
   ```sql
   SELECT tgname, tgrelid::regclass FROM pg_trigger
   WHERE tgrelid IN ('content_progress'::regclass, 'video_progress'::regclass)
     AND NOT tgisinternal;
   -- Expect: 0 rows (no user triggers)
   ```

5. **RLS isolation (R3, AC 3):** Create two test users (`userA`, `userB`) via Supabase Auth, insert progress rows as each, then switch session to `userA` and confirm `SELECT` over `userB`'s rows returns 0. Repeat as `userB`.

6. **Monotonic status (R4, AC 4):**
   ```sql
   -- As a signed-in test user:
   SELECT upsert_content_progress(auth.uid(), 'c1', 'course', 'completed', 100, now());
   SELECT upsert_content_progress(auth.uid(), 'c1', 'course', 'not_started', 0, now());
   SELECT status, progress_pct FROM content_progress WHERE content_id = 'c1';
   -- Expect: status = 'completed', progress_pct = 100
   ```

7. **Monotonic watched (R5, AC 5):**
   ```sql
   SELECT upsert_video_progress(auth.uid(), 'v1', 500, 1000, now());
   SELECT upsert_video_progress(auth.uid(), 'v1', 200, 1000, now());
   SELECT watched_seconds FROM video_progress WHERE video_id = 'v1';
   -- Expect: 500
   ```

8. **`updated_at` is client-driven (R6 reinterpretation):** Two calls with explicit `p_updated_at` timestamps — confirm `updated_at` advances via `GREATEST()`, not via a trigger.

9. **Idempotency (R7, AC 6):** Run the migration a second time on the same DB. Must complete with no errors; schema unchanged.

10. **Apply to titan** — final gate. Apply via `supabase db push` or manual `psql` execution on `ssh titan`'s `supabase-db` container. Re-run checks 2-9 on titan.

## Rollback

This migration only creates new objects — it doesn't alter existing ones. Rollback is destructive (drops the P0 tables). In development / pre-production: safe. After production data exists: requires explicit data backup + user approval.

Rollback script (not committed; kept in execution notes):
```sql
BEGIN;
DROP FUNCTION IF EXISTS upsert_content_progress(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS upsert_video_progress(UUID, TEXT, INTEGER, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS _status_rank(TEXT);
DROP TABLE IF EXISTS video_progress;
DROP TABLE IF EXISTS study_sessions;
DROP TABLE IF EXISTS content_progress;
-- Extensions are NOT dropped — they may be in use by other work
COMMIT;
```

## Sources & References

- **Origin document:** [docs/planning-artifacts/epics-supabase-data-sync.md](docs/planning-artifacts/epics-supabase-data-sync.md) — E92-S01 story spec
- **Design doc (canonical schema):** [docs/plans/2026-03-31-supabase-data-sync-design.md](docs/plans/2026-03-31-supabase-data-sync-design.md)
- Existing migrations: [supabase/migrations/001_entitlements.sql](supabase/migrations/001_entitlements.sql), [supabase/migrations/002_calendar_tokens.sql](supabase/migrations/002_calendar_tokens.sql)
