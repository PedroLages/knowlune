---
title: fix: Immediate Security Fixes (KI batch)
type: fix
status: active
date: 2026-07-02
origin: docs/brainstorms/2026-07-02-immediate-security-fixes-requirements.md
deepened: 2026-07-02
---

# fix: Immediate Security Fixes (KI batch)

## Overview

Resolve 6+ open security findings from the known-issues register (KI-034, KI-081, KI-BETA-001, KI-BETA-002, KI-E119-POST-005, KI-063) plus KI-E95-S05-L01 (deferred vault read-path migration). Each fix is independently scoped, ordered by risk: critical PostgreSQL SEARCH DEFINER hardening first, then fail-closed Edge Function patterns, CORS tightening, auth config, npm audit, and CI/CD automation.

**Deployment target:** Self-hosted Supabase on Unraid (titan) at `supabase.pedrolages.net`. All configuration changes, internal networking references, and environment variable locations assume this deployment topology. Supabase Cloud (for frontend) is at Cloudflare Pages. If the Supabase stack migrates to Cloud, a separate follow-up scope handles the transition — this plan targets the current self-hosted deployment exclusively. All references to "Supabase Cloud dashboard" in earlier drafts have been replaced with self-hosted equivalents.

## Problem Frame

The Knowlune application runs self-hosted Supabase on Unraid (titan) with bearertoken auth in localStorage. During the beta push, 6+ security items were accepted as deferred risks. Collectively they expand the attack surface in three dimensions: (1) PostgreSQL privilege escalation via unpinned search_path on SECURITY DEFINER triggers, (2) Edge Function misconfiguration causing silent auth bypasses, and (3) plaintext credential storage in IndexedDB. Each is individually low-risk given the current architecture (no cookies, no shared hosting), but together they represent an unacceptable posture for public launch.

Scope: triaged fix of known high-signal items only. Does NOT include a full penetration test, OWASP Top 10 audit, PWA security enhancements, or comprehensive rate-limiting redesign. Each of those is deferred to a later epic.

## Requirements Trace

| ID | Requirement | KI Reference |
|----|-------------|-------------|
| R1 | Fix `handle_new_user_entitlement` search_path | KI-081 |
| R2 | Audit all SECURITY DEFINER functions for search_path | KI-081 (adjacent) |
| R3 | WORKER_ENV_ALLOWLIST fail-closed on missing secrets | KI-E119-POST-005 |
| R4 | Tighten Kong/function-level CORS to known origins | KI-BETA-002 |
| R5 | Disable MAILER_AUTOCONFIRM | KI-BETA-001 |
| R6 | Fix npm audit HIGH vulnerabilities | KI-063 |
| R7 | Add npm audit to CI pipeline | (new) |
| R8 | Add secrets scanning to CI + git hooks | (new) |

### Deferred from This Scope

| Previously Planned | Rationale for Deferral | Tracking |
|-------------------|------------------------|----------|
| R6 (old): Migrate Book.source.auth OPDS credentials to vault | Architectural feature work (3 units across types, services, stores, imports). Not a security fix — the vault read-path was already deferred from E95-S05-L01. Removing from scope reduces plan complexity by 3 units and avoids the plaintext cleanup scheduling question. | KI-034, KI-E95-S05-L01 (remain open, scheduled for follow-up plan) |
| R5 rate-limit wrapper: Wire rate limiting into email verification | The proposed Edge Function (`verify-rate-limit`) would create a public function proxying to Kong with the service_role_key — a critical SSRF/privilege escalation vector. The existing `checkRateLimit` infrastructure requires `userId` (unavailable pre-auth) and keys on `tier`, not email, making it architecturally incompatible. Supabase Auth's built-in rate limiting on email verification endpoints is sufficient for beta. | KI-BETA-001 (partially resolved: MAILER_AUTOCONFIRM disabled, rate-limit wrapper removed) |

## Scope Boundaries

- **Does NOT** include GDPR/consent security (covered by E119).
- **Does NOT** include OWASP Top 10 full audit or penetration testing.
- **Does NOT** include PWA security enhancements.
- **Does NOT** include comprehensive rate-limiting redesign.
- **Does NOT** include SSRF protections beyond existing `isAllowedOllamaUrl`.
- **Does NOT** include a verify-rate-limit Edge Function wrapper — that approach was evaluated and rejected due to the SSRF/privilege escalation vector it would create (see Key Technical Decisions).
- **Does NOT** include OPDS credential vault migration — deferred to a follow-up plan (see R6 deferral above).

### Post-Fix Residual Risk Target

After all units in this plan are implemented, the application's security posture will be acceptable for beta launch. The residual risk target is defined as:

- **0 open HI GH-severity findings** in the known-issues register (KI-081, KI-E119-POST-005, KI-BETA-002 resolved).
- **MEDIUM findings** (KI-034, KI-E95-S05-L01: plaintext OPDS credentials in IndexedDB) remain open with documented deferral to a scheduled follow-up plan. Mitigation: IndexedDB is protected by browser Same-Origin Policy; exploitation requires both XSS and targeted credential extraction.
- **KI-BETA-001 partially resolved**: MAILER_AUTOCONFIRM disabled (eliminating auto-confirm bypass), but the rate-limit wrapper is removed from scope (Supabase built-in rate limiting is accepted).
- **CI/CD pipeline gates** prevent regression: npm audit HIGH failures block CI, secrets scanning blocks pre-commit and CI.
- **All npm audit HI GH vulnerabilities** eliminated or documented with justification in `.nsprc`.

This posture is acceptable for beta launch because:
1. All PostgreSQL privilege escalation vectors (unpinned search_path on SECURITY DEFINER functions) are closed.
2. No Edge Function has wildcard CORS on authenticated endpoints or fail-open on missing secrets.
3. Email verification is enforced (MAILER_AUTOCONFIRM disabled).
4. npm audit HIGHs are eliminated.
5. CI/CD prevents regression on all of the above.
6. Remaining risks (plaintext IndexedDB credentials) require authenticated access plus XSS to exploit — no known exploitation path in the current bearer-token architecture.

## Context & Research

### Relevant Code and Patterns

- **SECURITY DEFINER audit target**: `supabase/migrations/001_entitlements.sql` (handle_new_user_entitlement, no search_path). `supabase/migrations/20260413000002_p1_learning_content.sql` (reset_vocabulary_mastery, `SET search_path = public` without `pg_temp`). All other SD functions in `20260413000003_p2_library.sql`, `20260417000003_p0_sync_foundation_r4.sql`, `20260422000001_user_settings.sql`, `20260502000001_increment_rate_limit_fn.sql` already use `SET search_path = public, pg_temp`.
- **WORKER_ENV_ALLOWLIST fail-closed**: `supabase/functions/main/index.ts:20-34` defines allowlist; line 116 shows silent-deny pattern; function secrets checks use `if (!SECRET) { console.warn('not set'); }` which is fail-open.
- **CORS patterns**: `supabase/functions/vault-credentials/index.ts:26` uses wildcard `*`. `supabase/functions/delete-account/index.ts:40-44` pins to `APP_URL` (the correct hardened pattern for authenticated endpoints). `supabase/functions/calendar/index.ts:12` uses wildcard `*` (public iCal feed — intentional). `origin-check.ts` in `_shared` already has proper origin-allowlist pattern.
- **Credential vault**: `src/lib/credentials/` contains full resolver system (E95-S02/S05). `migrateCredentialsToVault.ts` handles legacy migration. `BookContentService.ts:137-159` reads `source.auth.password` directly (allowlisted in grep gate, marked `vault-migration-deferred`).
- **CI pipeline**: `.github/workflows/ci.yml` has typecheck, lint, format, build, unit-tests. Already runs `scripts/grep-gate-credentials.sh` in lint job. No npm audit step. No secrets scan step.
- **Rate limiting**: `src/lib/rate-limit.ts` (Edge Function) backs AI API calls. `increment_rate_limit` RPC in `20260502000001_increment_rate_limit_fn.sql` already hardened with search_path. **NOTE:** `checkRateLimit` requires `userId` parameter — incompatible with pre-auth email verification flows. Bucket keying is `ai-{tier}`, not email-based.
- **Deployment**: Self-hosted Supabase on Unraid (titan). Kong config at `titan:/mnt/cache/appdata/supabase/kong/api/kong.yml`. Cloudflare Pages for frontend. `.env.example` documents the self-hosted setup.

### Institutional Learnings

- **`docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`**: Every SECURITY DEFINER function must pin `search_path = public, pg_temp`. Missing `created_at_epoch BIGINT` type causes silent sync failures.
- **`docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md`**: `GREATEST` monotonic guards swallow intentional resets; separate SD RPC is the fix pattern.
- **`docs/solutions/best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md`**: Every `supabase.functions.invoke()` must check `data?.error` / `data?.msg` after transport-level error check.
- **`docs/solutions/runtime-errors/api-key-vault-fallback-hardening-2026-05-01.md`**: Credential vault has 6 hardening patterns: event-free writes, falsy guards, in-flight dedup, retry-once for transient errors, discriminated union returns.
- **`docs/solutions/integration-issues/supabase-edge-runtime-dns-and-missing-delete-account-2026-04-22.md`**: The functions container had a DNS resolution issue on self-hosted Supabase (Docker `internal: true` network blocking egress), with solution to attach to a non-internal bridge. The `main/index.ts` router was rewritten to use Web Crypto (no external imports) to boot without DNS. This DNS history means any Edge Function that needs to proxy to internal Kong must first re-verify network connectivity — the router itself avoids this entirely.
- **`docs/solutions/integration-issues/2026-04-24-abs-browser-direct-bearer-auth.md`**: ABS uses browser-direct Bearer auth; cover/audio use `?token=` in URLs.

### External References

None needed. All patterns are well-established in the codebase.

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| R1/R2: Fix search_path on all SD functions in one migration | Single atomic migration file. `handle_new_user_entitlement` and `reset_vocabulary_mastery` are the only offenders. Create a new numbered migration that re-defines both with correct search_path. |
| R3: Fail-closed with `DENO_REGION` guard | `WORKER_ENV_ALLOWLIST` drops env vars. The fail-closed check reads `Deno.env.get('DENO_REGION')` -- it is only set in Supabase-deployed environments, not local dev. When set and a required secret is missing, return 500 with `console.error`. |
| R4: CORS tighten via `origin-check.ts` on vault-credentials | Rather than modifying Kong config (self-hosted, fragile), apply the existing `origin-check.ts` pattern at the function level. Calendar endpoint keeps wildcard CORS (public iCal feed). |
| R5: Disable MAILER_AUTOCONFIRM only — remove rate-limit wrapper from scope | The proposed `verify-rate-limit` Edge Function would create a public endpoint proxying to Kong with `service_role_key` — a critical SSRF/privilege escalation vector. The existing `checkRateLimit` requires `userId` (unavailable pre-auth) and keys on `tier` not email. Supabase Auth's built-in rate limiting on email verification endpoints is sufficient for beta launch. This decision reduces the plan by one unit and eliminates an attack surface expansion. |
| R6: npm audit — accept esbuild dev-only, suppress with .nsprc | esbuild HIGH is Windows-only dev server. `@xmldom/xmldom` via epubjs is the real fix target -- requires `npm audit fix --force` due to breaking change in epubjs. |
| R7/R8: Add CI steps + `.nsprc` + git-secrets | CI steps are cheap. `git-secrets` or simple grep for the pre-commit hook. Full history scan is one-shot with documentation. |

## Implementation Units

### Phase 1: PostgreSQL SECURITY DEFINER Hardening

- [ ] **Unit 1.1: Fix SECURITY DEFINER search_path on all affected functions**

**Goal:** Pin `search_path = public, pg_temp` on `handle_new_user_entitlement` (missing entirely) and `reset_vocabulary_mastery` (has `public` without `pg_temp`).

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260702000001_fix_sec_definer_searchpath.sql` (or next available timestamp)

**Approach:**
- Create a new migration that uses `CREATE OR REPLACE FUNCTION` to re-define `handle_new_user_entitlement` and `reset_vocabulary_mastery` with `SET search_path = public, pg_temp`.
- Do NOT modify the existing migration files in-place (they have already been applied). Use a new forward migration.
- Include a COMMENT that records the fix date and KI reference.
- Verify that ALL other SECURITY DEFINER functions in the project already have `SET search_path = public, pg_temp` by auditing each migration file.

**Patterns to follow:**
- `upsert_book_progress` in `20260413000003_p2_library.sql` (line 317-318) -- correct pattern: `SECURITY DEFINER` then `SET search_path = public, pg_temp`.
- `upsert_content_progress` in `20260417000003_p0_sync_foundation_r4.sql` (line 116-117).

**Test scenarios:**
- Happy path: Migration applies cleanly; function audit confirms all SD functions have pinned search_path.
- Edge case: Migration re-runs (idempotent `CREATE OR REPLACE` handles this).
- Edge case: `reset_vocabulary_mastery` continues to function correctly with `pg_temp` in search_path.

**Verification:**
- `grep -rn 'SECURITY DEFINER' supabase/migrations/ --include='*.sql' -A2` shows every occurrence is followed by `SET search_path = public, pg_temp`.
- Migration applies without error on a fresh Supabase instance.

### Phase 2: Edge Function Hardening

- [ ] **Unit 2.1: Create WORKER_ENV_ALLOWLIST fail-closed helper**

**Goal:** When `WORKER_ENV_ALLOWLIST` drops a required secret in a non-local environment, the function returns 500 instead of silently running without auth.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Create: `supabase/functions/_shared/envCheck.ts`

**Approach:**
- Create a shared helper `requireWorkerEnv(key: string): string` in `supabase/functions/_shared/envCheck.ts` that checks `Deno.env.get('DENO_REGION')` — it is only set in Supabase-deployed environments, not local dev. When set and a required secret is missing, throw an error with a distinctive `[ENV-FAIL-CLOSED]` prefix.
- Do NOT modify the main router's boot path (`supabase/functions/main/index.ts`). Modifying the boot sequence is high-risk — the router already has a proven, working pattern. Instead, the shared helper is imported and used by each function handler for its critical secrets.
- This is a per-function pattern, not a router-level change. Individual Edge Functions that need fail-closed behavior import `requireWorkerEnv` and call it at boot time (before `Deno.serve`).

**Patterns to follow:**
- `supabase/functions/vault-credentials/index.ts:21-22` already throws on missing secrets: `if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')`.
- The pattern of immediate throw at function boot (before `Deno.serve`) is the simplest correct approach for fail-closed.

**Test scenarios:**
- Happy path: `DENO_REGION` is set and all required secrets exist — function works normally.
- Error path: `DENO_REGION` is set and a required secret is missing — function returns 500 with distinctive `[ENV-FAIL-CLOSED]` error message.
- Error path: `DENO_REGION` is not set (local dev) and secrets are missing — function operates as before (fail-open for development convenience).
- Edge case: `DENO_REGION` is `"local"` — treat as local dev, not fail-closed.

**Verification:**
- Function returns 500 when deployed without required secrets.
- Distinctive `[ENV-FAIL-CLOSED]` log message appears in Supabase Edge Function logs.

- [ ] **Unit 2.2: Tighten CORS on vault-credentials Edge Function**

**Goal:** Replace wildcard CORS on `vault-credentials/index.ts` with origin-restricted headers using the existing `origin-check.ts` pattern.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `supabase/functions/vault-credentials/index.ts`

**Approach:**
- Import `checkOrigin`, `corsHeaders`, `handlePreflight`, `getAllowedOrigins` from `../_shared/origin-check.ts`.
- Replace the hardcoded `CORS_HEADERS` object (line 26-30) with dynamic origin-aware headers using `corsHeaders(req)`.
- Use `handlePreflight(req, allowedOrigins)` at the OPTIONS handler (line 173).
- `ALLOWED_ORIGINS` env var is already expected by `getAllowedOrigins()`. The deployer must set it (documented in `.env.example`).

**Patterns to follow:**
- `supabase/functions/_shared/origin-check.ts` -- the canonical CORS pattern for all Knowlune Edge Functions.
- The `delete-account` Edge Function demonstrates the correct hardened CORS pattern (pinning to `APP_URL` instead of `*`), but it achieves this via hardcoded headers rather than importing `origin-check.ts`. This unit upgrades `vault-credentials` to use the shared `origin-check.ts` pattern for consistency with other functions.

**Test scenarios:**
- Happy path: Request from `ALLOWED_ORIGINS` origin succeeds with correct `Access-Control-Allow-Origin` header.
- Edge case: Request from disallowed origin returns 403.
- Edge case: Request without Origin header (server-to-server) is permitted.
- Integration: OPTIONS preflight returns 204 with correct CORS headers.

**Verification:**
- `curl -H "Origin: https://evil.com"` returns 403.
- `curl -H "Origin: https://knowlune.pedrolages.net"` succeeds.
- `curl` without Origin header succeeds.

- [ ] **Unit 2.3: Confirm calendar CORS intent (documentation only)**

**Goal:** Verify that the calendar endpoint's wildcard CORS is intentional, document the decision, and confirm no other functions have unguarded wildcard CORS.

**Requirements:** R4 (note in origin document)

**Dependencies:** None

**Files:**
- Modify: `supabase/functions/calendar/index.ts` (add comment confirming design intent)
- Document: PR description / commit message

**Approach:**
- The calendar endpoint serves a public iCal feed consumed by calendar apps (Google Calendar, Apple Calendar, etc.) that cannot send custom Origin headers. Wildcard CORS is correct and intentional for this use case.
- Add a comment above `CORS_HEADERS` (line 12) explaining the intentional wildcard.
- Scan other Edge Functions (`ai-generate`, `ai-ollama`, `ai-stream`, `cancel-account-deletion`, `cover-proxy`, `create-checkout`, `delete-account`, `export-data`, `export-worker`, `retention-tick`, `stripe-webhook`) for unguarded wildcard CORS. Report findings.

**Test scenarios:**
- Confirmation: No test changes needed -- documentation-only unit.
- Verification: Audit all Edge Functions and confirm only calendar intentionally uses wildcard.

**Verification:**
- Calendar continues to serve iCal to any origin.
- Audit log in PR description confirms no other functions have unintended wildcard CORS.

### Phase 3: Auth / Registration Hardening

- [ ] **Unit 3.1: Disable MAILER_AUTOCONFIRM and verify SMTP**

**Goal:** Turn off auto-confirm on Supabase deployment, enforce email verification, and verify pre-confirm users retain access.

**Requirements:** R5

**Dependencies:** Access to self-hosted Supabase deployment on titan

**Files:**
- Optionally: create a deployment checklist in `docs/deployment/` or PR description, documenting the exact configuration path used.

**Approach:**
- Deployment sequence:
  1. Verify SMTP configuration works on the self-hosted Supabase instance
  2. Set `MAILER_AUTOCONFIRM=false` in the Supabase stack `.env` file on titan (`/mnt/cache/docker/stacks/supabase/.env` or equivalent)
  3. Restart the relevant Supabase service to pick up the config change
  4. Run a smoke test as an existing pre-confirm user (attempt sign-in, verify session is accepted)
  5. Document rollback procedure: re-enable `MAILER_AUTOCONFIRM=true` if step 4 fails
- Document the known-issues.yaml update: change KI-BETA-001 status from `scheduled` to `fixed` (partially — rate-limit wrapper deferred).
- Document the exact config path on titan for future reference.

**Note:** The previously planned Unit 3.2 (verify-rate-limit Edge Function wrapper) has been removed from scope. See Key Technical Decisions for rationale. Supabase Auth's built-in rate limiting on email verification endpoints is accepted as sufficient for beta launch.

**Patterns to follow:**
- Deployment procedures are documented at `docs/deployment/cloudflare-pages-setup.md` and `.env.example`.
- The self-hosted Supabase .env file is at `/mnt/cache/docker/stacks/supabase/.env` on titan (per existing documentation).

**Test scenarios:**
- Happy path: New user registration sends verification email, unverified users cannot sign in.
- Edge case: Existing pre-confirm user signs in successfully after the change (session not revoked).
- Error path: SMTP misconfiguration causes verification email send failure -- app shows a clear error.
- Rollback: Re-enabling `MAILER_AUTOCONFIRM` restores previous behavior.

### Phase 4: Dependency / Build Security

- [ ] **Unit 4.1: Address npm audit HIGH vulnerabilities**

**Goal:** Resolve all 3 HIGH-severity npm audit advisories, document accepted risks for dev-only/blocked items.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `package.json` (if dependency upgrades resolve the issues)
- Create: `.nsprc` (suppress advisories that are accepted risk)
- Modify: `package-lock.json` (regenerated by npm install)

**Approach:**
- Current state (from `npm audit`): 3 HIGH in `@xmldom/xmldom` via `epubjs` -> `react-reader`, 1 HIGH in `esbuild` (dev-only Windows), 3 MODERATE in `js-yaml` and `uuid` (via `@lhci/cli`), 1 LOW
- The 3 HIGH @xmldom/xmldom advisories: these require `npm audit fix --force` which upgrades `epubjs` to v0.4.2. Test whether epubjs v0.4.2 is compatible with the app's EPUB reading functionality.
  - If compatible: apply `npm audit fix --force`, update lockfile.
  - If NOT compatible: document in `.nsprc` with justification.
- `esbuild` HIGH: Windows-only dev server file read. Accept as dev-only, document in `.nsprc`.
- `js-yaml` MODERATE: fix via `npm audit fix` (non-breaking).
- `uuid` MODERATE via `@lhci/cli`: CI-only build-time dependency. Document in `.nsprc`.
- Create `.nsprc` at repo root to suppress accepted advisories:
  ```json
  {
    "1349": { "active": true, "notes": "esbuild Windows-only dev server file read. dev-only, not exploitable in our Linux/macOS CI or production." },
    "[uuid GHSA IDs]": { "active": true, "notes": "CI-only @lhci/cli dep. Not in production bundle." }
  }
  ```
- Update KI-063 entry: change status from `scheduled` to `fixed`.

**Test scenarios:**
- Happy path: `npm audit --audit-level=high` exits 0 after fixes.
- Edge case: epubjs v0.4.2 breaks EPUB reading -- document in `.nsprc` with a `won't fix` note.
- Verification: Production build (`npm run build`) works after dependency changes.

**Verification:**
- `npm audit --audit-level=high` passes.
- App builds and EPUB reading works.
- `.nsprc` documents all suppressed advisories with justifications.

### Phase 5: CI/CD Security Automation

- [ ] **Unit 5.1: Add npm audit step to CI pipeline**

**Goal:** Run `npm audit --audit-level=high` in CI, with `.nsprc` suppression support.

**Requirements:** R7

**Dependencies:** Unit 4.1 (`.nsprc` created)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Approach:**
- Add a new job `npm-audit` to the CI pipeline, or add a step to the existing `lint` job.
- The step runs: `npx npm-audit-json --audit-level=high` or simply `npm audit --audit-level=high`.
- Since `.nsprc` is used for suppression, ensure the audit tool respects it. The standard `npm audit` does NOT read `.nsprc`. Options:
  1. Use `npx @microsoft/npm-audit-solution` or similar that respects `.nsprc`.
  2. Or, simplest: add `npm audit --audit-level=high || true` and a grep-based check that enforces only documented exceptions.
  3. Best: Add a custom script `scripts/ci-audit.sh` that runs `npm audit --json` and filters results against an allowlist (paths in `.nsprc`) before deciding exit code.
- Approach: Create `scripts/ci-audit.sh` that:
  1. Runs `npm audit --json`
  2. Parses the JSON output
  3. For each HIGH advisory, checks if it's in `.nsprc` (with a documented justification)
  4. Exits non-zero if any HIGH advisory is NOT in `.nsprc`

**Patterns to follow:**
- `scripts/grep-gate-credentials.sh` -- similar gate pattern with allowlist filtering.

**Test scenarios:**
- Happy path: No HIGH advisories (or only suppressed ones) -- job passes.
- Error path: New HIGH advisory appears without `.nsprc` entry -- job fails.

**Verification:**
- CI pipeline passes when `npm audit` is clean or all HIGHs are in `.nsprc`.
- CI pipeline fails when a new unsuppressed HIGH advisory appears.

- [ ] **Unit 5.2: Add pre-commit secrets scanning hook**

**Goal:** Prevent accidental commit of hardcoded credentials via a git pre-commit hook.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Create: `scripts/git-hooks/pre-commit-secrets-scan`
- Modify: Documentation (or create a setup script for hook installation)

**Approach:**
- Create `scripts/git-hooks/pre-commit-secrets-scan` that scans staged changes for:
  - High-entropy strings that look like API keys/secrets
  - Patterns like `apiKey`, `secret`, `password`, `token` assigned to string literals
  - Base64-encoded credential strings
- Use the existing `scripts/grep-gate-credentials.sh` patterns as a foundation.
- The hook skips test files and vendored dependencies.
- Output: prints offending lines with file:line references and exits non-zero on violation.
- Document installation: `git config core.hooksPath .githooks` or `ln -sf ../../scripts/git-hooks/pre-commit-secrets-scan .git/hooks/pre-commit`.
- Consider using `git-secrets` (AWS labs) if available, else a simple bash+grep approach.

**Patterns to follow:**
- `scripts/grep-gate-credentials.sh` -- existing credential scan approach.
- `.claude/hooks/safety-guardrail.sh` -- existing Claude Code hook for reference on hook patterns.

**Test scenarios:**
- Happy path: Commit with no secrets passes.
- Error path: Commit staging a file with `const apiKey = "sk-123"` is blocked.
- Edge case: Test files with mock secrets in test data are allowed (with explicit skip pattern).
- Edge case: File in `docs/` with `password` in prose is allowed.

**Verification:**
- `git commit` with a staged credential pattern fails with a clear message.
- `git commit` with clean staged changes succeeds.

- [ ] **Unit 5.3: Add secrets scanning step to CI pipeline**

**Goal:** Scan all production code for hardcoded credentials on every PR.

**Requirements:** R8

**Dependencies:** Unit 5.2 (scan pattern established)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Approach:**
- Add a new step to the existing `lint` job (or a new job) that runs the same scanning logic from Unit 5.2 against the full checkout.
- The scan should run against all files (not just staged changes) to catch any committed issues.
- Also run `git log --all -p | git secrets --scan` or equivalent for a one-time full history scan in a separate step.
- The full history scan runs once and documents findings. If secrets are found, document a remediation strategy (rotate compromised keys, scrub history with `git filter-branch` or BFG).

**Patterns to follow:**
- `scripts/grep-gate-credentials.sh` -- same credential gate pattern.

**Test scenarios:**
- Happy path: PR with no hardcoded credentials passes.
- Error path: PR introducing a credential pattern fails.
- Integration: Full history scan documents any historical findings.

**Verification:**
- CI pipeline passes on clean PRs.
- CI pipeline fails on PRs with hardcoded credentials.

## System-Wide Impact

- **Interaction graph:** UNIT 1.1 (search_path fix) touches the `auth.users` insert trigger path -- any trigger that fires after user creation. `handle_new_user_entitlement` runs as SECURITY DEFINER within the `auth` schema context. The search_path fix only affects how `public.entitlements` is resolved inside the function; no behavioral change for callers.
- **Error propagation:** UNIT 2.1 (fail-closed) changes the error mode for missing secrets from silent-accept to 500. Downstream callers (Cloudflare Workers, cron jobs) that currently work without secrets will break. This is intentional and correct -- those callers MUST be configured with the required secrets.
- **API surface parity:** UNIT 2.2 (CORS tighten) affects any caller of vault-credentials from a non-allowlisted origin. Existing callers all come from the Knowlune frontend (localhost or prod) which ARE allowlisted.
- **Deployment impact:** UNIT 3.1 (MAILER_AUTOCONFIRM) requires manual config change in the self-hosted Supabase `.env` on titan. Document rollback procedure.
- **Unchanged invariants:** UNIT 2.3 (calendar CORS) -- wildcard remains; explicit justification added. UNIT 1.1 -- SECURITY DEFINER behavior (privilege escalation) is unchanged; only the search_path resolution is hardened. UNIT 2.1 -- local dev behavior is unchanged (only deployed environments get fail-closed). The `main/index.ts` router boot path is NOT modified (per `_shared/envCheck.ts` approach).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| R1/R2 migration re-defines functions that may be concurrently in use | `CREATE OR REPLACE FUNCTION` is atomic in PostgreSQL. Brief window where old definition is used before connection picks up the new plan. Acceptable for a single-user application. |
| R3 fail-closed breaks existing deployments missing secrets | The `DENO_REGION` guard ensures local dev is unaffected. Monitored deployments will see `[ENV-FAIL-CLOSED]` logs. The fix is to set the missing secrets. |
| R4 CORS tighten breaks callers from unlisted origins | All legitimate callers come from the app's own origin or localhost. Document `ALLOWED_ORIGINS` env var setup. |
| R5 MAILER_AUTOCONFIRM=false breaks signup flow if SMTP is misconfigured | Document rollback (re-enable MAILER_AUTOCONFIRM) and stage testing sequence. |
| R6 epubjs v0.4.2 may break EPUB reading | Test thoroughly. If incompatible, accept the HIGH via `.nsprc` and add a comment explaining why. |
| R7/R8 CI changes fail incorrectly | Start as non-blocking (continue-on-error) for 1 week, then harden to blocking. |

## Documentation / Operational Notes

- **Secrets to configure after deployment:**
  - `ALLOWED_ORIGINS` on Supabase environment (for vault-credentials, delete-account, and other CORS-restricted functions) — set in three places for self-hosted: Supabase stack `.env`, docker-compose `environment:` block, and `WORKER_ENV_ALLOWLIST` in `main/index.ts`.
  - `RETENTION_TICK_SECRET`, `EXPORT_WORKER_SECRET` — verify these are in `WORKER_ENV_ALLOWLIST` and set on the deployment.
  - `MAILER_AUTOCONFIRM=false` — set in the self-hosted Supabase `.env` on titan (`/mnt/cache/docker/stacks/supabase/.env`).
- **Monitor log patterns:** `[ENV-FAIL-CLOSED]` after deploying UNIT 2.1.
- **Rollback procedures:**
  - R1/R2: Deploy a revert migration that restores the original function definitions (without search_path).
  - R3: Remove or comment out the `requireWorkerEnv` calls from affected functions.
  - R4: Revert vault-credentials CORS changes to wildcard.
  - R5: Re-enable `MAILER_AUTOCONFIRM=true`.
- **Deferred items:**
  - OPDS credential vault migration (KI-034, KI-E95-S05-L01): Plaintext credentials remain in IndexedDB. Mitigated by browser Same-Origin Policy. Scheduled for follow-up plan.
  - Rate-limit wrapper for email verification: Supabase built-in rate limiting accepted. No follow-up planned.
  - The `main/index.ts` router boot path is NOT modified by this plan. The fail-closed check is implemented as a per-function shared helper (`_shared/envCheck.ts`), not a router-level change.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-07-02-immediate-security-fixes-requirements.md`
- **Known issues:** `docs/known-issues.yaml` (KI-034, KI-081, KI-BETA-001, KI-BETA-002, KI-E119-POST-005, KI-063, KI-E95-S05-L01)
- **Related solutions:**
  - `docs/solutions/best-practices/supabase-migration-schema-invariants-2026-04-18.md`
  - `docs/solutions/runtime-errors/api-key-vault-fallback-hardening-2026-05-01.md`
  - `docs/solutions/best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md`
  - `docs/solutions/integration-issues/supabase-edge-runtime-dns-and-missing-delete-account-2026-04-22.md`
- **Related code:**
  - `supabase/functions/main/index.ts` (WORKER_ENV_ALLOWLIST)
  - `supabase/functions/_shared/origin-check.ts` (CORS pattern)
  - `supabase/functions/_shared/rate-limit.ts` (rate limit pattern — note: requires userId, incompatible with pre-auth email verification)
  - `src/lib/credentials/opdsPasswordResolver.ts` (OPDS vault resolver)
  - `src/services/BookContentService.ts` (direct credential read — KI-E95-S05-L01, deferred)
  - `src/lib/vaultCredentials.ts` (vault client: storeCredential, readCredential, etc.)
  - `scripts/grep-gate-credentials.sh` (credential scan gate)
  - `.github/workflows/ci.yml` (CI pipeline)
