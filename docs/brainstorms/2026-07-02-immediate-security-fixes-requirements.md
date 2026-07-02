---
date: 2026-07-02
topic: immediate-security-fixes
---

# Immediate Security Fixes

## Problem Frame

The Knowlune application has accumulated 6+ open security findings across the known-issues register (KI-034, KI-081, KI-BETA-001, KI-BETA-002, KI-E119-POST-005, KI-063) plus additional vulnerabilities discovered during codebase review. These span credential exposure in local storage, SECURITY DEFINER function privilege escalation, auto-confirm email registration, open CORS on Edge Functions, unprotected Edge Function endpoints via silent secret drops, and unaddressed npm audit vulnerabilities. While individually accepted as deferred risks during the beta push, collectively they represent an attack surface that must be reduced before public launch or wider user onboarding.

## Requirements

**Supabase / Edge Function Hardening**
- R1. Fix `handle_new_user_entitlement` function by adding `SET search_path = public, pg_temp` to the SECURITY DEFINER function definition. This addresses KI-081 — a CVE-2018-1058 search_path-based privilege escalation vector. Currently open since E92-S01.
- R2. Audit all PostgreSQL SECURITY DEFINER functions across all migration files in `supabase/migrations/` for the same search_path hardening pattern. Supabase Edge Functions (Deno workers in `supabase/functions/`) do not use search_path — this is a PostgreSQL-specific fix. Ensure the established pattern `SET search_path = public, pg_temp` is used consistently (existing function `reset_vocabulary_mastery` uses `public` without `pg_temp` and should be aligned for consistency).
- R3. Fix the `WORKER_ENV_ALLOWLIST` pattern in `supabase/functions/main/index.ts` such that missing secrets cause a fail-closed behavior (function returns 500 with a structured error log) rather than silently running without authentication. Emit a distinctive `console.error` log when the fail-closed path is hit so operators can monitor via log pattern alerts. Scope the fail-closed check to non-local environments (check `Deno.env.get('DENO_REGION')`) so local development without secrets continues to work. This addresses KI-E119-POST-005.
- R4. Tighten Kong CORS configuration for `/functions/v1/*` from wildcard `*` to the application's specific origins (`APP_URL`, `http://localhost:5173`). Also fix function-level wildcard CORS headers in `supabase/functions/calendar/index.ts` and `supabase/functions/vault-credentials/index.ts` by restricting them to the same origins (note: the calendar endpoint is a public iCal feed and may intentionally allow any origin — confirm design intent before changing). The `APP_URL` must be validated at deploy time (empty-string guard, format validation). Add a deployment smoke test that confirms the CORS response header is present. Use an environment variable for the dev server origin rather than hardcoding port 5173. Clarify which deployment environment (Supabase Cloud dashboard vs. self-hosted Kong config) this applies to. Addresses KI-BETA-002.

**Auth / Registration Hardening**
- R5. Disable `MAILER_AUTOCONFIRM=true` on the Supabase deployment and enforce email confirmation for new registrations. This addresses KI-BETA-001. Existing pre-confirm users must retain access.
  - Deployment sequence: (1) verify SMTP configuration works on a staging Supabase instance, (2) send a test verification email, (3) apply config change via the Supabase Cloud dashboard (Auth > Email Settings), (4) run a smoke test as an existing pre-confirm user (attempt sign-in, verify session is accepted), (5) document rollback procedure (re-enable `MAILER_AUTOCONFIRM` if step 4 fails).
  - Add rate limiting on the email verification endpoint to prevent SMTP quota exhaustion and email-bombing. The existing `increment_rate_limit` RPC (`supabase/migrations/20260502000001_increment_rate_limit_fn.sql`, already SECURITY DEFINER-hardened) should be wired into the verification flow.

**Credential Security in Local Storage**
- R6. Migrate OPDS credentials from plaintext storage in `Book.source.auth` to the credential vault system (Vault / credential resolvers). Includes a data migration strategy for credentials already stored in users' IndexedDB: on first launch after the change, existing `Book.source.auth` entries are read, vaulted, and cleared. The read path (`BookContentService`) is updated to use vault lookups rather than direct `source.auth` reads. Note: The `Book` type may need an `opdsCatalogId` FK field to look up the correct catalog credentials at download time (useAudioPlayer.ts already demonstrates the preferred hybrid pattern of direct-field + vault-fallback reads). Addresses KI-034 and KI-E95-S05-L01.

**Dependency / Build Security**
- R7. Audit and resolve all HIGH-severity npm audit vulnerabilities. Addresses KI-063 (3 HIGH, 3 MODERATE, 2 LOW advisories as of 2026-07-02). Document any that are dev-only or otherwise non-exploitable and cannot be resolved.

**CI/CD Security**
- R8. Add automated npm audit to the CI pipeline (`npm audit --audit-level=high` should fail the build). Use `.nsprc` to suppress documented non-exploitable or dev-only advisories that were accepted under R7. The CI step should verify that suppressed advisories are explicitly documented with a justification.
- R9. Add secrets scanning to detect hardcoded credentials before commit or in CI. Follow the precedent of the existing CI credential gate (`scripts/grep-gate-credentials.sh`) which scans for direct credential-field reads. For a broader scan, use git-secrets or a simple grep pattern. Add scanning both as a CI step and as a git pre-commit hook check. Also scan the full git history (e.g., `git log --all -p | git secrets --scan` or use Gitleaks/truffleHog) to detect any previously committed secrets and document a remediation strategy for any found.

## Success Criteria

- All open security-related known-issues (KI-034, KI-081, KI-BETA-001, KI-BETA-002, KI-E119-POST-005, KI-E95-S05-L01, KI-063) are resolved or explicitly documented as accepted risk with a revisit trigger.
- `handle_new_user_entitlement` has pinned `search_path`.
- All SECURITY DEFINER database functions in the project have pinned `search_path = public, pg_temp`. The audit log is documented in the PR or a related tracking issue.
- `MAILER_AUTOCONFIRM` is `false` on all environments.
- Edge Function secret-drop condition causes 500 (fail-closed) instead of silently accepting requests.
- Kong `/functions/v1/*` CORS is scoped to known origins.
- OPDS credentials no longer stored in `Book.source.auth` plaintext.
- `npm audit --audit-level=high` passes on CI.
- No hardcoded secrets found by automated scanner.

## Scope Boundaries

- Does NOT include GDPR/consent security (covered by E119).
- Does NOT include OWASP Top 10 full audit or penetration testing — this is a triaged fix of known high-signal items.
- Does NOT include PWA security enhancements (service worker scope, cache isolation).
- Does NOT include rate limiting tightening beyond what already exists.
- Does NOT include SSRF protections beyond existing `isAllowedOllamaUrl` — the proxy use case is already covered. However, R2's audit of Edge Functions should verify there are no other routes that bypass the proxy/allowlist pattern.

## Key Decisions

- **Fix known items first**: Rather than a full security audit, fix the 6+ already-documented issues that are triaged as HIGH/MEDIUM. A full audit is deferred to a later epic.
- **Fail-closed for secrets**: The WORKER_ENV_ALLOWLIST fix should use fail-closed (Option A from KI-E119-POST-005) as the minimum viable fix. The more comprehensive Options B/C can be done later.
- **OPDS credential migration**: Move `Book.source.auth` to the existing credential resolver pattern (`getOpdsPassword` / `useOpdsPassword`) established in E95-S02. This follows the established architecture rather than inventing new encryption.

## Dependencies / Assumptions

- Supabase project has the ability to set `MAILER_AUTOCONFIRM` via environment variable or dashboard setting.
- `handle_new_user_entitlement` is defined in `supabase/migrations/001_entitlements.sql` as confirmed in KI-081.
- The credential vault system (`src/lib/credentials/`) from E95-S02 is the correct target for OPDS credential migration.

## Outstanding Questions

### Resolve Before Planning

None. All requirements are well-understood from the known-issues register and codebase analysis.

### Deferred to Planning

- [Affects R6][Needs research] Does the `Book` type need an `opdsCatalogId` FK field, or can a URL-prefix-based catalog matcher map `source.url` to the owning catalog at download time?
- [Affects R4] Which deployment environment is currently active (Supabase Cloud or self-hosted) and what is the Kong CORS configuration path for that environment?
- [Affects R5][Technical] The existing `increment_rate_limit` RPC in `supabase/migrations/20260502000001_increment_rate_limit_fn.sql` — confirm it can be wired into the Supabase email verification flow, or if a separate rate limiter is needed at the Kong/Edge Function level.
- [Affects R7][Needs research] Which specific npm advisory IDs are involved (current count: 3 HIGH, 3 MODERATE, 2 LOW as of 2026-07-02), and which are resolvable vs blocked by transitive dependency constraints?
- [Affects R7][Needs research] Should dev-only findings (esbuild Windows-only file read advisory) be explicitly documented as accepted risk?
- [Affects R4][Needs research] Does the calendar endpoint (`supabase/functions/calendar/index.ts`) intentionally allow any origin as a public iCal feed, or should it be restricted like other functions?
