## Security Review R3 (FINAL): E92-S01 — P0 Supabase Sync Foundation

**Date:** 2026-04-17
**Phases executed:** 3/8 (STRIDE + OWASP for database layer; no new surface beyond R1/R2)
**Diff scope:** SQL migrations + fixups + rollback + verification (unchanged since R2)
**Prior rounds:** R1 (3 findings → resolved), R2 (2 informational → acceptable). R3 focus: STRIDE deep dive on auth boundaries per dispatch.

### Phases Executed

| Phase | Name            | Triggered By         | R3 Findings |
| ----- | --------------- | -------------------- | ----------- |
| 1     | Attack Surface  | Always               | No new      |
| 2     | Secrets Scan    | Always               | Clean       |
| 3     | OWASP (CS + A05/A07) | Always          | 0 new       |
| 4     | Dependencies    | —                    | Skipped     |
| 5     | Auth & Access   | RLS/functions in diff | Re-verified — 0 new |
| 6     | STRIDE          | DB auth surface      | 0 new       |
| 7     | Configuration   | —                    | Skipped     |
| 8     | Config Security | Always-on            | Clean       |

### STRIDE Analysis (Database Layer)

#### S — Spoofing: Can a user forge `auth.uid()` to impersonate another?

**Verdict: Not exploitable via this diff.**

- `auth.uid()` resolves from the JWT `sub` claim injected by PostgREST/GoTrue. The DB cannot forge the JWT — it must be signed by the Supabase auth server. Any spoofing requires a compromised JWT secret, which is **out of diff scope** (not stored in migrations — verified by secrets scan).
- Every RLS policy uses `auth.uid() = user_id` directly (not an intermediate variable that could be set_config'd by a client). `set_config('request.jwt.claims', ...)` only works with a privileged role (`service_role` / postgres) — an `authenticated` client cannot set it.
- Verification script (line 192-194) uses `SET LOCAL ROLE authenticated` + `set_config(..., true)` inside a transaction. This is a legitimate test harness requiring the postgres role — not a client-accessible path.

#### T — Tampering: Can a user bypass monotonic progression via direct INSERT?

**Verdict: Residual by-design behavior, acceptable.**

- RLS `WITH CHECK (auth.uid() = user_id)` is symmetric with `USING` on both `content_progress` and `video_progress` — verified at migration lines 66-67 and 141-142. Symmetry prevents the classic "visible under USING but write blocked" and vice-versa confusions.
- A client CAN perform direct INSERT/UPDATE on their own rows bypassing `upsert_content_progress` / `upsert_video_progress`. This means:
  - Direct UPDATE to `progress_pct = 5` after `= 100` would regress (non-monotonic).
  - Direct UPDATE to `updated_at = future` bypasses the 5-minute clamp.
- **Why not a blocker:** monotonic semantics are an integrity property, not a security property — the data is the user's own. A user regressing their own progress is self-harm, not a cross-tenant threat. The story spec explicitly anticipates direct UPDATE paths ("Direct UPDATEs (admin/migration paths) MUST set `updated_at` explicitly" — header of primary migration) and the future-clamp defense is positioned as a hardening measure for the sync engine's common path, not an absolute barrier.
- **Recommendation (advisory, NOT a finding):** If future stories need to enforce monotonicity at the DB layer for ALL paths, add a BEFORE UPDATE trigger applying the same GREATEST/clamp logic. E92-S01 scope defers this intentionally.

#### R — Repudiation: Are writes traceable?

**Verdict: Sufficient for current scope.**

- Every table has `user_id` NOT NULL FK to `auth.users`. Every row is attributable.
- `study_sessions` is append-only (no UPDATE/DELETE policies) — provides a forensic trail for session activity.
- `client_request_id` (fixup migration) provides client-side correlation for retries — useful for debugging and duplicate detection.
- Limitation: no separate audit log table, no `created_by`/`updated_by` that diverges from `user_id`. Acceptable — all writes go through RLS which enforces `user_id = auth.uid()`, so user_id IS the actor.

#### I — Information Disclosure: Cross-user SELECT / RLS completeness

**Verdict: Clean. Comprehensive coverage verified.**

- Every one of the three tables has `ENABLE ROW LEVEL SECURITY` — verified at lines 60, 92, 135 of primary migration.
- Every table has policies covering every operation: `content_progress` + `video_progress` use `FOR ALL` (SELECT/INSERT/UPDATE/DELETE); `study_sessions` uses separate `FOR SELECT` + `FOR INSERT` (immutable log — no UPDATE/DELETE policy intentionally denies those operations under RLS).
- The verification SQL (R2 improvement) now seeds userB rows AS service_role FIRST, then switches to userA and asserts zero cross-user visibility — a real two-user isolation test, not a tautology.
- **Views/aggregates:** None introduced in this diff. Future views must be individually audited — view RLS inheritance depends on `security_invoker` view option (Postgres 15+) vs. the owner's privileges. Tracked as an advisory for future stories but not a finding here.
- **Generated columns:** `watched_percent` is stored and subject to the same RLS as its parent table — no independent leak vector.
- `anon` role zero-access verified in e92-s01-verify.sql (lines 232-250).

#### D — Denial of Service: Resource exhaustion vectors

**Verdict: No practical vector from this diff.**

- `watched_seconds GREATEST` growth is bounded by INTEGER range (~2.1B seconds ≈ 68 years per video). CHECK constraints enforce `>= 0`. No unbounded accumulation.
- `content_progress.progress_pct` is `CHECK (0..100)` — bounded by definition.
- `study_sessions` is unbounded in row count (append-only, one row per session). No rate limit at DB layer. **Partial mitigation:** `client_request_id` uniqueness prevents duplicate retries from inflating row count. A malicious authenticated user could still write many legitimate-looking sessions, but this is a general anti-abuse problem (rate-limit in edge function layer / PostgREST) — not in-scope for this migration.
- `future-pinned updated_at` was a potential ordering-index DoS (R1 finding) — RESOLVED via 5-minute clamp.
- No recursive CTEs, no triggers with cascading side effects, no unindexed WHERE columns on user-controlled filters.

#### E — Elevation of Privilege

**Verdict: Correctly architected. SECURITY INVOKER choice eliminates the largest class of privilege escalation.**

- **All three functions (`_status_rank`, `upsert_content_progress`, `upsert_video_progress`) declare `SECURITY INVOKER`** — verified at lines 179, 230 (primary) and 103, 158 (fixups). This means the functions run with the CALLER's privileges, so RLS on the underlying tables applies to every INSERT/UPDATE the function performs. A user calling `upsert_content_progress(other_user_id, ...)` will be blocked by the `WITH CHECK (auth.uid() = user_id)` RLS policy on `content_progress`. The `p_user_id` parameter is effectively only usable for the caller's own uid.
- Because functions are INVOKER (not DEFINER), the CVE-2018-1058 `search_path` injection class does not grant privilege escalation — but `search_path = public, pg_temp` is pinned on all three functions anyway (defense in depth). Verified at lines 59, 79, 104, 159 of fixup migration.
- **No `SECURITY DEFINER` functions exist in this diff** — the dispatch's concern about "SECURITY DEFINER owner / GRANT EXECUTE" does not apply. Confirmed by grep: no `SECURITY DEFINER` token in either migration. This is the correct design choice.
- `GRANT EXECUTE` is not explicitly specified in either migration. Postgres default: functions in `public` schema are executable by `PUBLIC` (including `anon` and `authenticated`). Because the functions are INVOKER and the underlying tables deny access to `anon` via RLS, an anon caller would see RLS block the INSERT — not a leak, but calling the function is permitted. **Recommendation (advisory):** consider explicit `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` for clarity. Not a finding — the RLS layer prevents any actual privilege grant.
- Rollback script runs in plain SQL (invoker context). Not privilege-escalating.

### OWASP Coverage (Database Slice)

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Access Control | Yes (RLS) | No | RLS USING/WITH CHECK symmetric on all tables; FOR ALL or explicit SELECT+INSERT |
| CS2: Injection | Yes (SQL) | No | Parameterized function args, no dynamic SQL, `quote_ident` not needed |
| CS3: Sensitive Data in Storage | Yes | No | No PII in migrations; user-owned progress only |
| CS5: Client-Side Integrity | N/A | — | DB layer — integrity enforced by RLS + CHECK constraints |
| CS7: Security Logging | Yes | No | `_status_rank` raises on unknown input (no silent fail) |
| CS9: Communication | N/A | — | No network surface introduced |
| A01: Broken Access Control | Yes | No | See STRIDE-I / STRIDE-E above |
| A05: Security Misconfiguration | Yes | No | `search_path` pinned, INVOKER (not DEFINER), extensions explicit schemas (modulo pre-existing nit on vector/vault, unchanged from R2) |
| A07: Authentication Failures | Yes | No | `auth.uid()` in every RLS policy; no JWT parsing in migrations |

### Findings

#### Blockers
None.

#### High
None.

#### Medium
None.

#### Informational (carried from R2, re-affirmed)

- **[20260417000002_p0_sync_foundation_fixups.sql:15]** (confidence: 70): `client_request_id` unique-violation is self-introspective only (RLS scopes to caller's user_id). No cross-user exfiltration. `autofix_class: advisory`

- **[20260417000002_p0_sync_foundation_fixups.sql:107,162]** (confidence: 65): `LEAST(NULL, now() + 5min)` returns upper bound (non-NULL). Defensible, but `COALESCE(p_updated_at, now())` before `LEAST` would be clearer. `autofix_class: gated_auto`

#### New Advisories (R3)

- **[ALL three functions]** (confidence: 60): No explicit `REVOKE EXECUTE ... FROM PUBLIC` / `GRANT EXECUTE ... TO authenticated`. Functions are executable by `anon` by Postgres default; RLS on underlying tables blocks actual writes, so there is no privilege escalation — but for belt-and-suspenders, consider adding explicit GRANTs in a future migration. `autofix_class: gated_auto`

- **[20260413000001_p0_sync_foundation.sql:60,92,135]** (confidence: 55): Tables use `ENABLE ROW LEVEL SECURITY` but NOT `FORCE ROW LEVEL SECURITY`. Table owner (postgres) and `service_role` bypass RLS — this is standard Supabase convention and documented in e92-s01-verify.sql lines 252-255. Not a finding (intentional); recorded here for traceability. `autofix_class: advisory`

### Specific Validation Results (per dispatch checklist)

| Check | Verdict |
|-------|---------|
| Every SECURITY DEFINER has `SET search_path = ...` | N/A — no SECURITY DEFINER functions in diff (correct design) |
| No SECURITY DEFINER function accepts user_id parameter | N/A — all INVOKER; RLS enforces user_id = auth.uid() regardless |
| RLS ENABLED on all underlying tables | ✅ All 3 tables |
| RLS FORCED | ❌ Not forced (intentional — service_role bypass by Supabase convention, documented) |
| `WITH CHECK` symmetric with `USING` | ✅ `content_progress`, `video_progress`; `study_sessions` uses split INSERT/SELECT policies (no UPDATE/DELETE paths) |
| No stored credentials / JWT secrets in migrations | ✅ Clean (re-verified) |
| `auth.uid()` enforced in every policy | ✅ All 5 policies across 3 tables |
| Cross-user SELECT returns 0 rows | ✅ Verification seeds userB as service_role, asserts userA sees 0 (real test, not tautology) |
| Cross-user UPDATE/DELETE affect 0 rows | ✅ Asserted in e92-s01-verify.sql lines 217-227 |
| `anon` role zero-access | ✅ Asserted |
| `p_updated_at` future-pinning bypass | ✅ Clamped to `now() + 5min` in both upsert functions |
| `watched_seconds` unbounded DoS | ✅ INTEGER-bounded (~68 years), CHECK `>= 0` |

### Secrets Scan

Clean. No secrets, JWT signing keys, or hardcoded credentials in any of the four reviewed SQL files.

### What's Done Well (R3 observations)

1. **SECURITY INVOKER choice on upsert functions** — sidesteps the entire SECURITY DEFINER attack surface (ownership hijacking, search_path injection, GRANT EXECUTE escalation). This is the highest-leverage security decision in the story, and the combination of INVOKER + pinned `search_path` + explicit `public._status_rank` qualification is defense-in-depth done well.
2. **RLS verification test is a real two-user test** (R2 improvement). Seeding userB rows as `service_role` before switching to userA and asserting `count = 0` is the correct pattern. Prior test was a tautology; this is a genuine isolation assertion.
3. **Symmetric `USING` + `WITH CHECK`** on FOR ALL policies — eliminates the silent-UPDATE-bypass pattern where a user can SELECT-then-UPDATE rows they shouldn't be able to write.
4. **Append-only by policy absence** on `study_sessions` — denying UPDATE/DELETE by *not writing a policy* rather than writing a `USING (false)` policy is idiomatic and safer (no clever policy arithmetic to review).
5. **Diff-scoped secrets discipline** — four SQL files, four passes, zero secrets, zero dynamic SQL.

### Approval

**Gate: PASS.** No blockers, no high, no medium. All R1 and R2 findings resolved and verified. STRIDE sweep surfaces no new issues. Story is safe to merge from a security perspective.

---

Phases: 3/8 | Findings: 0 blockers, 0 high, 0 medium | Informational: 4 (2 carried from R2, 2 new advisories) | False positives filtered: 0
