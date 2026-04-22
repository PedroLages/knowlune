---
title: "fix: Unblock beta — Edge Functions DNS, delete-account function, Unit 6 verification"
type: fix
status: active
date: 2026-04-22
origin: docs/plans/2026-04-21-pre-beta-hardening-sprint.md
---

# fix: Unblock beta — Edge Functions DNS, delete-account function, Unit 6 verification

## Overview

Three blockers remain from the pre-beta hardening sprint Unit 6 verification. All must pass
before the first user invite.

- **B3 (P0):** The `supabase-edge-functions` container on titan uses Docker's embedded DNS
  (`127.0.0.11`), which returns SERVFAIL for external hostnames. Deno's runtime imports
  `deno.land/std` modules at boot time; DNS failure causes every Edge Function to crash at
  startup. The container returns HTTP 200 with the error in the body, so callers see no
  `error` field and treat the call as successful.
- **B4 (P0):** `delete-account` Edge Function does not exist in the repo or on titan. Only
  `create-checkout`, `stripe-webhook`, and `vault-credentials` are deployed. Account deletion
  silently succeeds in the UI but performs no server-side action.
- **B5 (code, P0):** `src/lib/account/deleteAccount.ts` does not inspect the Edge Function
  response body. When the function boot-crashes, `error` is null and `data` contains the
  crash message — the frontend marks deletion successful and signs the user out without
  deleting any data.

## Problem Frame

A user who clicks "Delete Account" on production today is:
1. Silently signed out (good)
2. NOT deleted from `auth.users` (bad — GDPR violation)
3. NOT soft-deleted (bad — no grace-period record)
4. Seeing no error (bad — they believe the deletion happened)

Root cause chain: Docker DNS → Deno boot crash → HTTP 200 body error → frontend silent success.

## Requirements Trace

- **R1.** Edge Functions container can resolve external DNS (Cloudflare 1.1.1.1 minimum).
- **R2.** `delete-account` Edge Function exists, is deployed on titan, and performs a
  7-day soft-delete of `auth.users` via Supabase Admin API.
- **R3.** `deleteAccount.ts` inspects the response body for boot-crash errors and surfaces
  them to the user rather than treating every HTTP 200 as success.
- **R4.** Full delete-account flow verified end-to-end: user created → confirms deletion →
  `auth.users` row absent (or `deleted_at` set) — with Sentry capturing errors during the
  test.
- **R5.** Sprint Go/No-Go checklist item R5 marked complete; post-sprint docs updated.

## Scope Boundaries

- No changes to Stripe subscription cancellation flow (it is a future concern; no Stripe
  keys are configured for production yet).
- No changes to `cancelAccountDeletion()` — it calls `cancel-account-deletion` which is also
  not deployed, but that flow is not exercised during deletion.
- No WAL-G, PITR, or Supabase Cloud migration work.
- Units 7 and 8 (healthcheck cosmetic fix, titan load avg) remain P1 and are not in scope.

### Deferred to Separate Tasks

- `cancel-account-deletion` Edge Function: separate concern, needed for E119 GDPR.
- `MAILER_AUTOCONFIRM=true` removal: noted for E119, not blocking beta.

## Context & Research

### Relevant Code and Patterns

- **`src/lib/account/deleteAccount.ts`** — calls `supabase.functions.invoke('delete-account')`.
  Lines 181–214: `error` object check only; `data` body never inspected for crash errors.
  The `data` field can contain `{ error: "...", details: "..." }` when the function boot-crashes
  and returns HTTP 200.
- **`supabase/functions/create-checkout/index.ts`** — existing Edge Function pattern to follow.
  Uses Deno `serve()`, validates auth header, returns JSON responses.
- **`supabase/functions/stripe-webhook/index.ts`** — same pattern; also shows error handling shape.
- **Supabase self-hosted compose stack:** `/mnt/cache/docker/stacks/supabase/docker-compose.yml`
  on titan. The `supabase-edge-functions` service definition needs `dns:` key added.
- **`/mnt/user/docker/scripts/pre-backup.sh`** — prior titan infrastructure edit for reference
  on how to stage local edits then scp to titan.

### Institutional Learnings

- Docker embedded DNS (`127.0.0.11`) resolves only container names on the compose network.
  External hostnames return SERVFAIL. Fix: specify `dns: [1.1.1.1, 8.8.8.8]` in the service
  definition and `docker compose up -d --no-deps supabase-edge-functions` to restart only
  that service without touching the database.
- Supabase Edge Functions are deployed by copying a directory to
  `/home/deno/functions/<function-name>/` inside the `supabase-edge-functions` container
  (or by bind-mounting a host directory). The `supabase functions deploy` CLI targets
  Supabase Cloud — not applicable to self-hosted.
- `supabase.functions.invoke()` returns `{ data, error }`. When the Deno runtime crashes
  during boot (before returning a response), the Supabase Edge Runtime wrapper catches it
  and returns HTTP 200 with `{ error: "...", details: "..." }` as the body. The JS SDK maps
  this to `data = { error: ... }` and `error = null`.
- PWA Service Worker caches the built bundle including CSP. After any deploy that changes
  CSP or adds new network origins, the SW must be unregistered to pick up the new bundle.
  (Already handled for CSP fix in commit `1f375203`.)
- GHA bakes `VITE_*` env vars at Docker build time. Runtime env changes on titan do not
  affect the frontend bundle — only infra-side changes (DNS, compose config, function files).

### External References

- Supabase Admin API for user deletion:
  `DELETE /auth/v1/admin/users/{user_id}` — requires `service_role` key.
- Supabase self-hosted Edge Function deployment: copy function dir to container, restart not
  required (Deno watches for file changes) — but a restart ensures clean boot.

## Key Technical Decisions

- **DNS fix via compose `dns:` key, not `/etc/resolv.conf` override:** The compose `dns:`
  key is durable (survives container restarts); direct resolv.conf edits inside the container
  are lost on restart.
- **Soft-delete only (no hard delete):** The Edge Function sets `deleted_at` timestamp on
  the auth user record and waits 7 days before hard deletion. Matches existing `SOFT_DELETE_GRACE_DAYS`
  constant in the frontend. Hard-delete on day 8 is a cron concern outside this sprint.
- **Deploy function by scp + docker cp, not Supabase CLI:** Self-hosted deployment. No
  Supabase Cloud project. `supabase functions deploy` is not applicable.
- **Body inspection in `deleteAccount.ts` via `data?.error` guard:** The response body
  shape when the function boot-crashes is `{ error: string, details?: string }`. Check `data?.error`
  after a null `error` to surface the real failure.
- **No Stripe integration in `delete-account` function:** Skip cancellation steps; just soft-delete
  the auth record. Stripe keys are not configured for production yet — attempting to call
  Stripe would add another boot-crash failure mode.

## Open Questions

### Resolved During Planning

- **Does `supabase functions deploy` work for self-hosted?** No. Files must be placed in
  the container's `/home/deno/functions/` directory directly.
- **Is the `service_role` key available inside the Edge Function?** Yes — Supabase self-hosted
  injects `SUPABASE_SERVICE_ROLE_KEY` as an env var into the edge-functions container.
- **Does the Edge Runtime restart automatically after new function files are added?** The
  runtime watches for changes but a container restart guarantees a clean boot. Plan includes
  restart step.

### Deferred to Implementation

- Exact compose service name for `supabase-edge-functions` on titan (likely `supabase-edge-functions`
  but implementer should verify with `docker ps` before restarting).
- Whether titan's compose stack uses `docker-compose` v1 or `docker compose` v2 — implementer
  checks and uses the correct command.

## Implementation Units

- [ ] **Unit 1: Fix DNS on supabase-edge-functions container**

**Goal:** Give the Edge Functions container external DNS so Deno can import `deno.land` modules at boot.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify (on titan, not in repo): `/mnt/cache/docker/stacks/supabase/docker-compose.yml` — add `dns:` key to `supabase-edge-functions` service

**Approach:**
- SSH to titan, edit the compose file to add `dns: [1.1.1.1, 8.8.8.8]` under the
  `supabase-edge-functions` service definition.
- Restart only that service: `docker compose up -d --no-deps supabase-edge-functions`
- Verify by `docker exec supabase-edge-functions nslookup deno.land` — should return an IP.
- This is a titan infrastructure change only; no repo commit needed.

**Test scenarios:**
- Test expectation: none — pure infrastructure change; verified by nslookup and function boot test in Unit 3.

**Verification:**
- `docker exec supabase-edge-functions nslookup deno.land` returns a non-error response.
- `docker exec supabase-edge-functions nslookup 8.8.8.8` resolves (confirming resolver is reachable).

---

- [ ] **Unit 2: Create and deploy delete-account Edge Function**

**Goal:** Implement the `delete-account` Supabase Edge Function that soft-deletes the
calling user's auth record, and deploy it to titan.

**Requirements:** R2

**Dependencies:** Unit 1 (DNS must work so Deno can import modules)

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

**Approach:**
- Follow the pattern of `supabase/functions/create-checkout/index.ts` for structure.
- Auth: extract the JWT from the `Authorization: Bearer <token>` header, verify the
  user is authenticated (Supabase injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` for
  this), extract `sub` as the user ID.
- Admin action: use `SUPABASE_SERVICE_ROLE_KEY` (injected by self-hosted runtime) with
  the Supabase Admin client to call the admin user deletion API with `shouldSoftDelete: true`.
  This sets `deleted_at` on the user record without hard-deleting.
- Return shape on success: `{ success: true, scheduledDeletionAt: <ISO date 7 days out> }`.
- Return shape on failure: `{ success: false, error: "<message>" }` with appropriate HTTP
  status (400 for invalid request, 500 for internal error).
- No Stripe calls — skip cancellation steps entirely for now.
- CORS headers: match the pattern from `create-checkout/index.ts` for preflight handling.
- Deployment to titan: `scp -r supabase/functions/delete-account/ titan:/tmp/delete-account/`
  then `docker cp /tmp/delete-account supabase-edge-functions:/home/deno/functions/delete-account`
  then restart the edge-functions service.

**Patterns to follow:**
- `supabase/functions/create-checkout/index.ts` — auth extraction, serve() structure, CORS headers, error shape.
- `supabase/functions/vault-credentials/index.ts` — if it uses service_role for admin operations.

**Test scenarios:**
- Happy path: authenticated user calls function → `auth.users.deleted_at` is set, response
  is `{ success: true, scheduledDeletionAt: <date> }`.
- Error path — unauthenticated call: no `Authorization` header → HTTP 401, response body
  contains `{ error: "Unauthorized" }`.
- Error path — invalid JWT: malformed token → HTTP 401.
- Edge case — already-deleted user: calling the function twice for the same user should
  not throw a 500; either idempotent success or a clear error.

**Verification:**
- `curl -X POST https://supabase.pedrolages.net/functions/v1/delete-account \
  -H "Authorization: Bearer <valid-session-jwt>" -H "Content-Type: application/json" \
  -d "{}"` returns `{ "success": true, ... }` (not a boot-crash JSON).
- `docker exec supabase-db psql -U postgres -c "SELECT deleted_at FROM auth.users WHERE id='<test-user-id>';"` shows a non-null timestamp.

---

- [ ] **Unit 3: Fix deleteAccount.ts to surface Edge Function body errors**

**Goal:** Prevent silent success when the Edge Function returns HTTP 200 with an error body
(boot-crash or application error).

**Requirements:** R3

**Dependencies:** None (can be developed and committed independently of Units 1-2, deployed together)

**Files:**
- Modify: `src/lib/account/deleteAccount.ts`

**Approach:**
- After the `supabase.functions.invoke()` call, the existing code checks `if (error)` correctly.
  Add a second guard: after the `error` check, inspect `data` for a body-level error. If
  `data?.error` or `data?.success === false` is present, treat it as a failure.
- Return a user-facing error message. For boot-crash scenarios, the message should be generic:
  "Account deletion failed. Please try again or contact support."
- Do not expose raw internal error strings (crash details, stack traces) to the user.
- Log the full `data` body to `console.error` for Sentry capture.
- The `data?.step` progress tracking block that follows the error check should only run
  when `data?.success !== false`.

**Patterns to follow:**
- Existing error-handling shape in `deleteAccount.ts` lines 185–214.
- `error-handling/no-silent-catch` ESLint rule: surfaced errors must reach the user via
  the return value (which the calling component renders as a toast).

**Test scenarios:**
- Happy path: Edge Function returns `{ success: true }` → `deleteAccount()` returns `{ success: true }`.
- Error path — body error (boot-crash simulation): `error` is null, `data` is
  `{ error: "boot crashed", details: "..." }` → `deleteAccount()` returns
  `{ success: false, error: "Account deletion failed. Please try again or contact support." }`.
- Error path — body success=false: `data` is `{ success: false, error: "open invoice" }` →
  returns appropriate `invoiceError: true` result (existing logic).
- Integration: component calling `deleteAccount()` receives `{ success: false }` and renders
  visible error toast — user is NOT signed out.

**Verification:**
- Unit test: mock `supabase.functions.invoke` to return `{ data: { error: "crash" }, error: null }`;
  assert `deleteAccount()` resolves to `{ success: false }`.
- No regression on existing error path tests.

---

- [ ] **Unit 4: End-to-end Unit 6 verification (delete flow)**

**Goal:** Confirm the full delete-account flow works in production: account created → deletion
confirmed → data gone from `auth.users`. Sprint Unit 6 checklist complete.

**Requirements:** R4

**Dependencies:** Units 1, 2, 3 all deployed

**Files:**
- No code changes — manual verification via Playwright MCP and SSH to titan.

**Approach:**
- Create a throwaway account at `https://knowlune.pedrolages.net/auth`.
- Navigate to Settings → Account → Delete Account.
- Complete the confirmation dialog (type "DELETE").
- Verify user is signed out with a visible success message.
- SSH to titan: `docker exec supabase-db psql -U postgres -c "SELECT id, deleted_at FROM auth.users WHERE email='<throwaway-email>';"`.
  - Soft-delete success: row exists with non-null `deleted_at`.
  - Hard-delete success: no row returned (if admin cron already ran — unlikely in the same session).
- Confirm Sentry received no errors during the flow (check Sentry dashboard or logs).
- Clean up: `docker exec supabase-db psql -U postgres -c "DELETE FROM auth.users WHERE email='<throwaway-email>';"`.

**Test scenarios:**
- Integration: full browser flow from signup → delete → sign-out → sign-in fails (session
  gone, user deleted/soft-deleted).
- Edge case: after signing out post-deletion, attempting to sign back in with the same
  credentials should fail (Supabase auth rejects deleted users).

**Verification:**
- `auth.users` row for the test account has `deleted_at` set (or is absent).
- No error toast appeared during the deletion flow.
- Sentry dashboard shows no unexpected errors from `knowlune.pedrolages.net` during the test window.

---

- [ ] **Unit 5: Sprint checklist and post-sprint documentation**

**Goal:** Mark the sprint complete, update the Go/No-Go checklist, and do post-sprint doc updates.

**Requirements:** R5

**Dependencies:** Unit 4 verified

**Files:**
- Modify: `docs/plans/2026-04-21-pre-beta-hardening-sprint.md` — check off R5 (delete flow) in the Go/No-Go checklist
- Modify: `docs/known-issues.yaml` — add any deferred items (P1 healthcheck, titan load avg source if documented)
- Modify: `docs/plans/2026-04-21-remaining-epics-execution-order.md` — mark Gate 0 complete

**Approach:**
- Update checklist: privacy/terms pages ✅, delete-account flow ✅.
- Add known-issues entry for MAILER_AUTOCONFIRM (to be addressed in E119).
- Mark Gate 0 complete in the execution order doc.
- Commit all doc changes in a single `docs:` commit.

**Test scenarios:**
- Test expectation: none — documentation-only changes.

**Verification:**
- `docs/plans/2026-04-21-pre-beta-hardening-sprint.md` Go/No-Go checklist shows all P0 items checked.
- `docs/plans/2026-04-21-remaining-epics-execution-order.md` reflects Gate 0 complete.

## System-Wide Impact

- **Interaction graph:** DNS fix affects all Edge Functions (create-checkout, stripe-webhook,
  vault-credentials) — they will now successfully boot where previously they may have also
  been crashing silently. Treat this as a positive side effect; verify no existing function
  changes behavior unexpectedly after the DNS fix.
- **Error propagation:** `deleteAccount.ts` change: errors now propagate to the calling
  component's error handler and are shown as toasts. Previously they were swallowed.
- **State lifecycle risks:** If the Edge Function succeeds but the frontend's sign-out step
  fails, the user will be stuck with a session for a deleted account. Existing code in
  `deleteAccount.ts` lines 238–241 already handles this by force-clearing local state.
- **API surface parity:** `cancelAccountDeletion()` has the same body-inspection gap —
  deferred to E119 since that flow is not exercised in this sprint.
- **Unchanged invariants:** The `SOFT_DELETE_GRACE_DAYS` constant, `DeletionStep` type,
  and UI progress tracking behavior are not changed.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| DNS change breaks container networking for other services | Only affects the edge-functions service. No impact on supabase-db, kong, or auth. Roll back by removing the `dns:` key and restarting. |
| Edge Function deployment fails (scp / docker cp) | Verify file exists in container with `docker exec supabase-edge-functions ls /home/deno/functions/` before restarting. |
| `SUPABASE_SERVICE_ROLE_KEY` not injected into edge-functions container | Check with `docker exec supabase-edge-functions env | grep SERVICE_ROLE`. If missing, add to compose env. |
| Soft-delete API not available in self-hosted Supabase version | Verify via `curl -X DELETE https://supabase.pedrolages.net/auth/v1/admin/users/<id> -H "apikey: <service_role_key>"` manually before deploying function. |
| Deploying function triggers restart that interrupts active sessions | Restart is brief (~5s). Production has 1 user (Pedro). Acceptable. |

## Documentation / Operational Notes

- After Unit 2, update `docs/runbooks/supabase-restore-rehearsal.md` Change log with a note
  that `delete-account` function was deployed.
- `MAILER_AUTOCONFIRM=true` (any email can be claimed without verification) — note added to
  `docs/known-issues.yaml` as a known pre-beta accepted risk; addressed in E119.

## Sources & References

- **Origin document:** [`docs/plans/2026-04-21-pre-beta-hardening-sprint.md`](../plans/2026-04-21-pre-beta-hardening-sprint.md)
- Frontend caller: `src/lib/account/deleteAccount.ts` lines 181–214
- Existing Edge Function patterns: `supabase/functions/create-checkout/index.ts`
- Supabase self-hosted Edge Function runtime env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Prior DNS root cause: session summary, B3 blocker
