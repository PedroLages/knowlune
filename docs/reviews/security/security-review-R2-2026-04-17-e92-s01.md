## Security Review R2: E92-S01 — P0 Supabase Sync Foundation (Fixup Verification)

**Date:** 2026-04-17
**Phases executed:** 3/8 (R2 scope: verify R1 fixes only)
**Diff scope:** Fixup migration + verification SQL + rollback

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | No new surface (SQL-only fixups) |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Coverage | Always | Re-verified for SQL changes |
| 4 | Dependencies | — | Skipped (no package.json change) |
| 5 | Auth & Access | RLS unchanged | Verified unchanged |
| 6 | STRIDE | No new routes | Skipped |
| 7 | Configuration | — | Skipped |
| 8 | Config Security | Always-on | Clean |

### R1 Finding Verification

**R1 MEDIUM: Client-controlled `p_updated_at` enabled future-pinning — RESOLVED ✅**

Verified at `supabase/migrations/20260417000002_p0_sync_foundation_fixups.sql`:

1. `upsert_content_progress` line 104: `v_clamped_updated_at TIMESTAMPTZ := LEAST(p_updated_at, now() + interval '5 minutes')`
2. `upsert_video_progress` line 159: identical clamp
3. Clamp applied consistently to INSERT values, `ON CONFLICT UPDATE` (including `updated_at`, `completed_at`, and `last_position` LWW comparator)

**NULL bypass check:** Functions are NOT declared `STRICT`. `LEAST(NULL, now() + 5min)` in PostgreSQL ignores NULL and returns `now() + 5min`. This means:
- A caller passing `p_updated_at = NULL` still gets a clamped (bounded) timestamp — NOT a bypass.
- The upper bound `now() + 5min` is preserved even under NULL input.
- `updated_at` column is `NOT NULL`, so a NULL result would fail INSERT — but LEAST never returns NULL here because `now() + interval '5 minutes'` is always non-NULL.

No bypass vector identified.

**Other R1 fixes verified:**

| Fix | Location | Status |
|-----|----------|--------|
| `search_path` pinned | All 3 functions (`SET search_path = public, pg_temp`) | ✅ Correct |
| `_status_rank` raises on unknown | Lines 71-86 | ✅ STRICT + explicit raise |
| `client_request_id` idempotency | Lines 14-27 | ✅ UUID + UNIQUE scoped to user |
| `content_progress` CHECK constraint | Lines 34-44 | ✅ Semantic guard only |
| `last_position` true LWW | Lines 174-178 | ✅ Uses clamped timestamp |

### Re-Check Findings

#### Blockers
None.

#### High
None.

#### Medium
None.

#### Informational

- **[20260417000002_p0_sync_foundation_fixups.sql:15]** (confidence: 70): `client_request_id UUID NOT NULL DEFAULT gen_random_uuid()` with UNIQUE `(user_id, client_request_id)`. Unique-violation errors could theoretically confirm existence of a `(user_id, client_request_id)` pair to an attacker who already owns the `user_id` — but RLS ensures a client can only INSERT with their own `user_id`, so this collapses to self-introspection. No cross-user exfiltration. Category: CS3 (client storage) — advisory only. **autofix_class: advisory**

- **[20260417000002_p0_sync_foundation_fixups.sql:104,159]** (confidence: 65): Non-STRICT functions accept NULL `p_updated_at`; LEAST() silently treats NULL as "ignore this value" returning the upper bound. Defensible (clamp still applies), but slightly surprising semantics. Consider `COALESCE(p_updated_at, now())` before LEAST for clarity — functional equivalence, better readability. **autofix_class: gated_auto**

### Specific Re-Check Results

| Item | Verdict |
|------|---------|
| Clamp formula correctness (`LEAST(p_updated_at, now() + '5 minutes')`) | ✅ Correct, bounded |
| NULL `p_updated_at` bypass | ❌ No bypass (LEAST ignores NULL, still bounded) |
| `search_path` pinned on all 3 functions | ✅ Yes (`public, pg_temp`) |
| `client_request_id` RLS / exfiltration | ✅ Safe — table RLS applies, unique scoped to user |
| CHECK constraint DoS | ✅ No — standard constraint violation, no log flood |
| Verification SQL role-switching safety | ✅ `SET LOCAL ROLE` inside BEGIN/ROLLBACK, no SECURITY DEFINER created |
| Rollback cleanup correctness | ✅ CASCADE on tables drops fixup constraints + column |
| Verification SQL cleanup | ✅ Prefixed `e92s01-verify-*`, deletes only seed users |

### Secrets Scan
Clean — no secrets in fixup migration, verification SQL, or rollback.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS2: Injection | Yes (SQL) | No | Parameterized via function args; no dynamic SQL |
| CS3: Sensitive Data in Storage | Yes | Info only | `client_request_id` UUID — user-scoped, RLS-protected |
| CS5: Integrity | Yes | No | Clamp + monotonic upserts preserve integrity |
| A05: Misconfiguration | Yes | No | `search_path` pinned, SECURITY INVOKER (not DEFINER) |
| A07: Auth Failures | Yes (RLS) | No | RLS unchanged from R1-approved baseline |

### What's Done Well

1. **Defense-in-depth on clamp**: `v_clamped_updated_at` used consistently across INSERT, UPDATE, `completed_at`, AND `last_position` comparator — no path where raw `p_updated_at` leaks into stored state.
2. **`search_path` hardening on INVOKER functions**: Even though SECURITY INVOKER is safer than DEFINER, pinning `search_path` prevents even theoretical future hijacks if a function is ever refactored to DEFINER.
3. **Fully qualified `public._status_rank` calls** inside upsert functions — not relying on search_path resolution for internal references.
4. **Verification SQL uses SET LOCAL + BEGIN/ROLLBACK correctly** — role-switch isolation is proper, no residual privilege escalation.

---
Phases: 3/8 | Findings: 2 informational | Blockers: 0 | High: 0 | Medium: 0 | R1 MEDIUM resolved ✅
