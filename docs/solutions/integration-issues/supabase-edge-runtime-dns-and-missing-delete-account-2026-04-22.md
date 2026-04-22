---
title: "Self-hosted Supabase Edge Functions: DNS-at-boot + missing function + silent-success trifecta"
date: 2026-04-22
category: docs/solutions/integration-issues/
module: supabase-edge-functions
problem_type: integration_issue
component: authentication
severity: critical
symptoms:
  - "Worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint"
  - "Deno edge function DNS lookup fails when importing from esm.sh/deno.land"
  - "supabase.functions.invoke('delete-account') returns success but auth.users row is never deleted"
  - "Docker compose dns: [1.1.1.1] has no effect when network has internal: true"
  - "GDPR delete-account UX shows success; backend row persists with no deleted_at"
root_cause: config_error
resolution_type: config_change
related_components:
  - tooling
  - development_workflow
  - service_object
tags:
  - supabase
  - edge-runtime
  - docker-networking
  - self-hosted
  - deno
  - delete-account
  - gdpr
  - traefik
---

# Self-hosted Supabase Edge Functions: DNS-at-boot + missing function + silent-success trifecta

## Problem

A single user-facing action — "delete my account" — failed silently in production because of three compounding defects discovered on 2026-04-22 during Knowlune's pre-beta hardening sprint: the self-hosted Supabase Edge Functions container could not resolve external DNS (blocking all Deno module imports at boot), the `delete-account` function was never deployed, and the frontend treated Supabase's HTTP 200 boot-crash envelope as a successful response. The user was signed out but their `auth.users` row remained intact, violating the GDPR deletion contract the UI had just promised.

Context: Knowlune runs self-hosted Supabase on Unraid ("titan") at `supabase.pedrolages.net` behind Traefik, with the app bundled at `knowlune.pedrolages.net` (auto memory [claude]: `project_actual_deployment_topology.md`, `reference_supabase_unraid.md`). The Supabase stack is composed via `docker-compose.yml` with a `supabase-internal` network marked `internal: true`.

## Symptoms

**Layer 1 — DNS / boot (B3):**

- Every Edge Function request returned `{ "error": "worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint" }` with HTTP 200.
- Functions container logs showed DNS resolution failures for `esm.sh` and `deno.land/x/*` during module import.
- `docker exec supabase-edge-functions nslookup esm.sh` returned `SERVFAIL`.

**Layer 2 — Missing function (B4):**

- Frontend "Delete Account" button invoked `supabase.functions.invoke('delete-account')`.
- Router returned `{ msg: "function not found" }` (again with HTTP 200).
- No `supabase/functions/delete-account/` directory existed in the repo or on the titan host.

**Layer 3 — Silent success (B5):**

- Frontend displayed "Account scheduled for deletion" toast.
- User was signed out.
- `auth.users` row persisted indefinitely — no `deleted_at`, no anonymization.
- No error surfaced in Sentry or the browser console because `supabase.functions.invoke()` returned `error: null` on HTTP 200.

## What Didn't Work

1. **Adding `dns: [1.1.1.1, 8.8.8.8]` to the `functions` service alone.** The functions container was only attached to `supabase-internal`, which is declared with `internal: true` in the compose file. Docker's embedded resolver (127.0.0.11) refuses to forward queries to upstream resolvers on internal-only networks — the `dns:` directive is silently ignored. Lookups continued to `SERVFAIL`.

2. **Using Supabase's upstream `main/index.ts` router.** The reference router imports `jose` from `deno.land/x/jose` for JWT verification. Chicken-and-egg: the router needs to fetch `jose` before it can verify any JWT, but fetching `jose` requires the DNS we were trying to fix. Even after DNS was working, a single `deno.land` blip at cold-start would take down the entire functions service.

3. **Writing the router over SSH with a heredoc.** The router's template-literal URL construction (backticks, `${}`) got mangled passing through an SSH heredoc and an intermediate Python `print()` — backticks were stripped, leaving broken syntax. Fixed by authoring locally and `scp`'ing the file to titan.

4. **Verifying soft-delete by querying `auth.users` by email.** After the fix, `SELECT * FROM auth.users WHERE email = '…'` returned zero rows, which initially looked like a total failure. Supabase anonymizes the email column on soft-delete for GDPR compliance. Re-querying by `id` confirmed the row was present with `deleted_at` correctly set — the fix had worked all along.

## Solution

### Part 1 — Docker networking (B3)

Edit `/mnt/cache/docker/stacks/supabase/docker-compose.yml` to attach the functions service to a non-internal bridge network with upstream DNS:

```yaml
services:
  functions:
    # ...
    dns:
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - supabase-internal     # existing: service-to-service
      - traefik_proxy         # NEW: gives Deno workers internet egress

networks:
  traefik_proxy:
    external: true            # pre-existing bridge, not internal:true
  supabase-internal:
    internal: true            # keep internal for DB/auth isolation
```

Then `docker compose up -d functions`. Verify with `docker exec supabase-edge-functions nslookup esm.sh` — should resolve.

### Part 2 — Self-contained main router (no deno.land imports at boot)

Write `supabase/functions/main/index.ts` using only Deno built-ins. Web Crypto handles HMAC-SHA256 JWT verification without any external imports, so the router boots before DNS is even required:

```typescript
// No imports from deno.land/x or esm.sh — Web Crypto is a Deno built-in.
const JWT_SECRET = Deno.env.get('JWT_SECRET')!

// Explicit allowlist — never forward Deno.env.toObject() to workers.
const WORKER_ENV_ALLOWLIST = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL', 'APP_URL', 'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID', 'VAULT_ENC_KEY',
  'DENO_REGION', 'VERIFY_JWT',
]

async function verifyJWT(token: string): Promise<boolean> {
  const [headerB64, payloadB64, sigB64] = token.split('.')
  const encoder = new TextEncoder()
  const data = encoder.encode(`${headerB64}.${payloadB64}`)
  const sig = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  if (!(await crypto.subtle.verify('HMAC', key, sig, data))) return false

  // exp/nbf validation — signature alone is not enough.
  const payload = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(
        atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      ),
    ),
  )
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp < now) return false
  if (typeof payload.nbf === 'number' && payload.nbf > now) return false
  return true
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const serviceName = url.pathname.split('/').filter(Boolean)[0]
  if (!serviceName) {
    return errorResponse('missing function name in request', 400)
  }

  // Allowlisted env forwarding — do NOT leak Deno.env.toObject() to user functions.
  const envVars: Array<[string, string]> = []
  for (const k of WORKER_ENV_ALLOWLIST) {
    const v = Deno.env.get(k)
    if (v !== undefined) envVars.push([k, v])
  }

  try {
    // Bound worker creation so a slow module graph doesn't hang the router.
    const worker = await Promise.race([
      // @ts-expect-error — EdgeRuntime injected by supabase/edge-runtime
      EdgeRuntime.userWorkers.create({
        servicePath: `/home/deno/functions/${serviceName}`,
        memoryLimitMb: 150,
        workerTimeoutMs: 60_000,
        noModuleCache: false,
        importMapPath: null,
        envVars,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('worker create timed out after 10000ms')), 10_000),
      ),
    ])
    return await (worker as { fetch: (r: Request) => Promise<Response> }).fetch(req)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`worker dispatch failed for ${serviceName}:`, message) // redacted
    return errorResponse(message, 500)
  }
})

function errorResponse(msg: string, status: number): Response {
  // Unified shape: new callers read `error`; legacy `msg` kept for compatibility.
  return new Response(JSON.stringify({ success: false, error: msg, msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### Part 3 — `delete-account` Edge Function (B4)

Write `supabase/functions/delete-account/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Match APP_URL, not '*', so an XSS on evil.com can't reach admin endpoints.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return json({ success: false, error: 'Unauthorized' }, 401)
  return { userId: user.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS_HEADERS })
  const authResult = await authenticate(req)
  if (authResult instanceof Response) return authResult

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    authResult.userId,
    true, // shouldSoftDelete — sets deleted_at, anonymizes email, 30-day grace
  )
  if (deleteError && !/already.*deleted/i.test(deleteError.message)) {
    console.error('admin.deleteUser error:', {
      message: deleteError.message,
      status: deleteError.status,
    }) // redacted — no full object
    return json({ success: false, error: 'Failed to delete account.' }, 500)
  }

  const scheduledDeletionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return json({ success: true, scheduledDeletionAt })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
```

### Part 4 — Frontend silent-success guard (B5)

In `src/lib/account/deleteAccount.ts`, after the transport-level `if (error)` check:

```typescript
const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })

if (error) {
  // transport-level / non-2xx handled here
  return { success: false, error: 'Unable to delete account. Please try again later.' }
}

// Guard: Edge Function boot-crash or router error returns HTTP 200 with error in body.
// - data.error: Deno runtime crash before the function returns a real response
// - data.msg:   main router error envelope (missing function name, worker timeout)
// - data.success === false: explicit application-level failure
if (data?.error || data?.msg || data?.success === false) {
  console.error('delete-account body error:', data)
  return {
    success: false,
    error: 'Account deletion failed. Please try again or contact support.',
  }
}

return { success: true }
```

A symmetric guard was added to `cancelAccountDeletion()` since it uses the same invoke path. See [the reusable silent-success guard pattern](../best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md) for the broader rule.

## Why This Works

**Layer 1** — Docker networks marked `internal: true` instruct the embedded DNS resolver to refuse upstream forwarding. This is a Docker security feature, not a bug, and `dns:` at the service level cannot override it. Attaching the functions service to a second non-internal bridge (`traefik_proxy`, which already had working upstream DNS for Traefik's ACME needs) gives Deno workers a route to the public internet for module imports while preserving service-to-service isolation on `supabase-internal`.

**Layer 2** — The `EdgeRuntime.userWorkers.create` API needs a `servicePath` pointing at an actual function directory on the bind-mount. `delete-account` didn't exist, so the worker spawn failed, the router caught it, and returned the error envelope.

**Layer 3** — `supabase.functions.invoke()` in `@supabase/supabase-js` populates the client-level `error` field only for non-2xx HTTP responses. Supabase's edge-runtime deliberately returns HTTP 200 with `{ error: "worker boot error: ..." }` or `{ msg: "..." }` in the body whenever the router catches an exception, so clients can distinguish transport errors from application errors. The client SDK does not inspect the body for error keys; only an explicit application-level guard can catch this class of failure.

**Web Crypto for JWT** — `crypto.subtle` is part of the Deno runtime itself, not a module. It requires zero network calls at boot, so the router starts cleanly even in a DNS-less environment and only pulls external modules when spawning individual function workers (which can retry independently).

## Prevention

- [ ] **Body-error guard on every `supabase.functions.invoke()` call** — check `data?.error`, `data?.msg`, and `data?.success === false` before returning success. Client-level `error` is insufficient because Supabase's router returns boot-crash envelopes with HTTP 200. See the [dedicated pattern doc](../best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md).
- [ ] **Avoid `deno.land/x` imports in router code** — use Web Crypto (`crypto.subtle.importKey` / `crypto.subtle.verify`) for JWT verification so the router can boot before DNS is available and survive transient `deno.land` outages.
- [ ] **Test Edge Functions with simulated boot failure** — rename a function directory or break an import, confirm the frontend body-error guard fires end-to-end before shipping.
- [ ] **Forward env vars to user workers via explicit allowlist** — never `Deno.env.toObject()`, which leaks the service-role key and any other secret to every user function.
- [ ] **Pin function CORS to `APP_URL`, not `*`** — belt-and-suspenders against XSS from other origins reaching admin endpoints. Kong-level CORS is a separate, coarser layer (tracked as `KI-BETA-002`).
- [ ] **Redact error logs** — log `err.message` and `err.status`, not the full error object. Supabase error objects frequently contain JWT payload fragments or user PII.
- [ ] **Bound worker spawn time** — wrap `EdgeRuntime.userWorkers.create` in `Promise.race` with a 10s timeout so a hung module graph doesn't hang the router.
- [ ] **Validate `exp` and `nbf` JWT claims** at the router, not just the signature — signature-only verification accepts expired tokens.
- [ ] **Attach egress-needing services to a non-internal bridge** when your Docker stack uses `internal: true` — don't fight the embedded DNS; give the service a second route.
- [ ] **When verifying soft-deletes, query `auth.users` by `id`, not by `email`** — Supabase anonymizes the email column on soft-delete per GDPR. A zero-row result by email is expected, not a failure signal.
- [ ] **Author non-trivial Deno/shell files locally and `scp` them** — avoid heredocs with backticks or `${}` over SSH. Intermediate shells mangle template literals silently.

## Related

- [Silent-success guard for `supabase.functions.invoke()` calls](../best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md) — the reusable pattern extracted from this incident.
- [E93 closeout sync patterns](../sync/e93-closeout-sync-patterns-2026-04-18.md) — related silent-failure family (server-side upsert monotonic guard).
- [Fail-closed destructive migrations](../best-practices/fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md) — shared "fail loud on destructive ops" philosophy.
- `docs/plans/2026-04-22-001-fix-beta-blockers-edge-functions-dns-plan.md` — the plan that drove this fix.
- `docs/known-issues.yaml#KI-BETA-002` — follow-up: Kong CORS wildcard and `FUNCTIONS_VERIFY_JWT=false` at the gateway (deferred to E119, low severity for bearer-token architecture).
