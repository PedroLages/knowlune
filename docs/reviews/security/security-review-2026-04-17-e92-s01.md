## Security Review: E92-S01 — Supabase P0 Migrations + Extensions

**Date:** 2026-04-17
**Phases executed:** 5/8 (1, 2, 3, 7, 8)
**Diff scope:** 16 files changed, 3022 insertions, 2 deletions (primary: 1 SQL migration, 248 lines)

### Phases Executed

| Phase | Name            | Triggered By           | Findings                     |
| ----- | --------------- | ---------------------- | ---------------------------- |
| 1     | Attack Surface  | Always                 | 3 vectors identified         |
| 2     | Secrets Scan    | Always                 | Clean                        |
| 3     | OWASP Top 10    | Always                 | Reviewed with STRIDE overlay |
| 4     | Dependencies    | package.json unchanged | N/A                          |
| 5     | Auth & Access   | RLS policies changed   | 0 findings                   |
| 6     | STRIDE          | New schema/functions   | 1 finding (Tampering)        |
| 7     | Configuration   | vite/env unchanged     | N/A                          |
| 8     | Config Security | Always-on              | Clean                        |

### Attack Surface Changes

New Postgres attack surface introduced:

1. **4 extensions enabled**: `moddatetime`, `pgcrypto`, `vector`, `supabase_vault` — all standard, no risky extensions (`plpython3u`, `file_fdw`, `dblink`, `pg_read_server_files` absent).
2. **3 new tables with RLS**: `content_progress`, `study_sessions`, `video_progress` — all `auth.users(id) ON DELETE CASCADE`.
3. **3 new SQL functions**: `_status_rank` (IMMUTABLE), `upsert_content_progress`, `upsert_video_progress` — all SECURITY **INVOKER** (not DEFINER).

### Findings

#### Blockers

_None._

#### High Priority

_None._

#### Medium (fix when possible)

- **supabase/migrations/20260413000001_p0_sync_foundation.sql:170,221** (confidence: 75): Client-controlled `p_updated_at` with `GREATEST(existing, p_updated_at)` enables "future-pin" tampering.
  **Exploit (STRIDE: Tampering):** A malicious or buggy client can call `upsert_content_progress(..., p_updated_at := '9999-12-31')`. Because `updated_at = GREATEST(content_progress.updated_at, p_updated_at)` preserves the larger value, the row's `updated_at` becomes locked at year 9999. All subsequent legitimate upserts (from other devices, or after a client bug is fixed) will no-op on `updated_at` and — more importantly — future `status`/`progress_pct` updates with correct timestamps cannot be chronologically reasoned about. Scope: self-damage only (RLS confines the user to their own rows), so not a privilege-escalation vector, but it can corrupt a user's own cross-device sync permanently.
  **Fix:** Add a sanity bound on `p_updated_at` inside each upsert function:
  ```sql
  IF p_updated_at > now() + INTERVAL '1 day' THEN
    RAISE EXCEPTION 'updated_at too far in future: %', p_updated_at;
  END IF;
  IF p_updated_at < '2020-01-01'::timestamptz THEN
    RAISE EXCEPTION 'updated_at too far in past: %', p_updated_at;
  END IF;
  ```
  The 1-day skew tolerance handles normal client clock drift. Alternatively add a CHECK constraint `updated_at < now() + interval '1 day'` on the tables (but that blocks legitimate replay during migrations).

#### Informational (awareness only)

- **supabase/migrations/20260413000001_p0_sync_foundation.sql:149,164,216** (confidence: 65): Functions do not pin `search_path`. Because all three are `SECURITY INVOKER` (not DEFINER) and all cross-schema references already use explicit `public.` / `auth.` qualifiers, there is no current escalation path. Defense-in-depth: add `SET search_path = public, pg_temp` to each function definition so a future refactor to SECURITY DEFINER doesn't silently become exploitable.

- **supabase/migrations/20260413000001_p0_sync_foundation.sql:243** (confidence: 60): `last_position = video_progress.last_position` is a no-op on conflict — `last_position` is effectively immutable after first insert via this function. Not a security issue; flagged because the comment says "LWW" but the behavior is "write-once". A future caller believing LWW semantics hold could be surprised. Cross-referenced as a correctness/UX item, not a security blocker.

### Secrets Scan

Clean — no API keys, tokens, passwords, or credentials present in the SQL migration or any companion doc. `.mcp.json` not modified. No `.env*` files tracked in this diff.

### OWASP / Threat Coverage

| Category                               | Applicable? | Finding? | Details                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CS1: Broken Client-Side Access Control | No          | —        | Server-side RLS is the enforcement layer here.                                                                                                                                                                                                                                                                |
| CS2: Client-Side Injection             | No          | —        | No client code in this diff.                                                                                                                                                                                                                                                                                  |
| CS3: Sensitive Data in Client Storage  | No          | —        | Schema-only migration.                                                                                                                                                                                                                                                                                        |
| CS5: Client-Side Integrity             | No          | —        | N/A for DB migration.                                                                                                                                                                                                                                                                                         |
| CS7: Client-Side Security Logging      | No          | —        | N/A.                                                                                                                                                                                                                                                                                                          |
| CS9: Client-Side Communication         | No          | —        | N/A.                                                                                                                                                                                                                                                                                                          |
| A01: Broken Access Control (RLS)       | Yes         | No       | All 3 tables `ENABLE ROW LEVEL SECURITY`. `content_progress` and `video_progress` use `FOR ALL` with both `USING` and `WITH CHECK` on `auth.uid() = user_id`. `study_sessions` has only `FOR INSERT (WITH CHECK)` and `FOR SELECT (USING)` — RLS default-deny correctly blocks UPDATE/DELETE (immutable log). |
| A03: Injection                         | Yes         | No       | Generated column `watched_percent` uses a fixed arithmetic expression on same-row columns — no dynamic SQL, no injection surface. Functions use parameterized values, no `EXECUTE`.                                                                                                                           |
| A04: Insecure Design                   | Yes         | Medium   | Client-controlled `p_updated_at` with `GREATEST` allows self-tampering (see finding above).                                                                                                                                                                                                                   |
| A05: Security Misconfiguration         | Yes         | No       | Extensions are all standard Supabase-approved (`pgcrypto`, `moddatetime`, `vector`, `supabase_vault`). No `plpython3u`/`file_fdw`/`dblink`.                                                                                                                                                                   |
| A07: Identification & Auth Failures    | Yes         | No       | `auth.uid()` used correctly; FKs to `auth.users` with `ON DELETE CASCADE` ensure orphan cleanup on user deletion.                                                                                                                                                                                             |
| A08: Data Integrity                    | Yes         | No       | CHECK constraints on `content_type`, `status`, `progress_pct (0-100)`, non-negative integers. `_status_rank` returns 0 for unknown (belt-and-suspenders vs CHECK).                                                                                                                                            |
| STRIDE: Spoofing                       | Yes         | No       | RLS `WITH CHECK (auth.uid() = user_id)` blocks spoofing `p_user_id` in function calls (SECURITY INVOKER runs RLS).                                                                                                                                                                                            |
| STRIDE: Tampering                      | Yes         | Medium   | See `p_updated_at` future-pin finding.                                                                                                                                                                                                                                                                        |
| STRIDE: Repudiation                    | Yes         | No       | `study_sessions` is append-only (INSERT-only RLS) — provides audit trail for sessions.                                                                                                                                                                                                                        |
| STRIDE: Information Disclosure         | Yes         | No       | RLS isolates reads to `auth.uid() = user_id`. No cross-user selects.                                                                                                                                                                                                                                          |
| STRIDE: DoS                            | Yes         | No       | User-scoped via RLS (self-DoS only). Indexes prevent scan-based DoS.                                                                                                                                                                                                                                          |
| STRIDE: Elevation of Privilege         | Yes         | No       | No `SECURITY DEFINER` functions. All functions run as invoker.                                                                                                                                                                                                                                                |

### What's Done Well

1. **Deliberate choice of `SECURITY INVOKER` over `SECURITY DEFINER`** on upsert functions avoids the classic privilege-escalation pitfall. RLS still applies with the caller's identity, so `p_user_id` can't be spoofed — `WITH CHECK (auth.uid() = user_id)` blocks mismatches at the row level. This is the correct design.
2. **Explicit schema qualification** (`public._status_rank`, `public.content_progress`, `auth.users`) on every cross-schema reference eliminates `search_path` hijacking risk even without a pinned search_path.
3. **INSERT-only RLS on `study_sessions`** correctly leverages Postgres default-deny: omitting UPDATE/DELETE policies is safer than adding restrictive ones, because it is impossible to accidentally weaken later.
4. **`ON DELETE CASCADE` from `auth.users`** ensures GDPR / account-deletion correctness — no orphaned progress rows after a user deletes their account.
5. **Generated column `watched_percent`** with `LEAST(100, ...)` clamp is injection-free and handles the `duration_seconds = 0` edge case cleanly.

---

Phases: 5/8 | Findings: 3 total | Blockers: 0 | High: 0 | Medium: 1 | Info: 2 | False positives filtered: 0
