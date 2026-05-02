---
title: "Always body-error-guard supabase.functions.invoke() — transport success is not application success"
date: 2026-04-22
category: docs/solutions/best-practices/
module: supabase-client
problem_type: best_practice
component: authentication
severity: high
applies_when:
  - Calling supabase.functions.invoke() from any frontend code
  - The Edge Function may return HTTP 200 with error details in the response body
  - The action has real side effects the user depends on (delete, payment, provisioning, email, sync)
  - Self-hosted Supabase where edge-runtime worker boot failures are plausible
symptoms:
  - "Frontend treats { data: { error: '...' }, error: null } as success"
  - "User sees success UI but backend operation never ran"
  - "supabase.functions.invoke() returns HTTP 200 on worker boot-crash or router error"
root_cause: missing_validation
resolution_type: code_fix
related_components:
  - service_object
tags:
  - supabase
  - error-handling
  - silent-failure
  - edge-functions
  - frontend-contract
  - invoke
---

# Always body-error-guard `supabase.functions.invoke()` — transport success is not application success

## Context

`supabase.functions.invoke()` from `@supabase/supabase-js` returns `{ data, error }`. The client-level `error` field is populated **only for non-2xx HTTP responses** — network failures, transport errors, explicit `Response(status: >=400)` from the function.

Supabase's edge-runtime router, however, returns **HTTP 200** in several cases where the application-level operation did not succeed:

- **Worker boot crash** — a Deno module import fails at load time, the runtime catches the exception, and returns `{ "error": "worker boot error: ...", "success": null }` with status 200.
- **Missing function** — the router can't find the service path and returns `{ msg: "function not found" }` with status 200 (behavior depends on router implementation).
- **Worker spawn timeout** — the router caught a timeout from `EdgeRuntime.userWorkers.create` and returned a router-level error envelope.
- **Explicit application failure** — the function itself returns `{ success: false, error: "open invoice" }` with status 200 (common pattern to return structured business-logic errors without triggering retry middleware).

In all four cases, `error` from the client SDK is `null`. Frontend code that only checks `error` will silently treat these as success. For destructive or billing-sensitive operations (delete-account, create-checkout, process-refund), this is a data-integrity and trust-destroying bug.

This pattern was extracted from the GDPR delete-account incident on 2026-04-22 where users clicking "Delete Account" were signed out but their `auth.users` row remained intact. See the [bug-track writeup](../integration-issues/supabase-edge-runtime-dns-and-missing-delete-account-2026-04-22.md) for the full incident narrative.

## Guidance

**Always add a body-error guard after the transport-level `if (error)` check, before returning success.** The guard must cover three cases:

| Case | Body shape | Why it exists |
|------|------------|---------------|
| Runtime boot crash | `{ error: "...", success: null }` | Deno module import failed; platform returns 200 with error in body |
| Router-level error | `{ msg: "..." }` (or `{ success: false, error, msg }` if router normalizes) | Router caught an exception from worker spawn or dispatch |
| Application failure | `{ success: false, error: "..." }` | Function deliberately returns structured business error without non-2xx |

**Canonical guard:**

```typescript
const { data, error } = await supabase.functions.invoke('<function-name>', { body: {...} })

// Transport-level errors (non-2xx, network failure, etc.) — handled by SDK
if (error) {
  return { success: false, error: 'Unable to <action>. Please try again later.' }
}

// Guard: Edge Function boot-crash or router error returns HTTP 200 with error in body.
// - data.error:            Deno runtime crash before the function returns a real response
// - data.msg:              main router error envelope (missing function, worker timeout)
// - data.success === false: explicit application-level failure
if (data?.error || data?.msg || data?.success === false) {
  console.error('<function-name> body error:', data)
  return {
    success: false,
    error: 'Operation failed. Please try again or contact support.',
  }
}

// Only here is it safe to treat the call as successful.
return { success: true, ...data }
```

### Function-side contract to pair with the guard

Edge Functions should help the guard by using a consistent response envelope:

```typescript
// Success shape
return json({ success: true, /* domain fields */ })

// Failure shape
return json({ success: false, error: 'human-readable reason' }, 500)
```

The router should normalize its own errors into the same shape so the client only has to check one thing:

```typescript
// In main/index.ts router:
function errorResponse(msg: string, status: number): Response {
  // Dual-key envelope bridges old callers (`msg`) and new callers (`error`).
  return new Response(JSON.stringify({ success: false, error: msg, msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

Paired, the guard becomes noise-free for the happy path while still catching the three silent-failure classes.

### Test the guard

A unit test that never fires the guard is worthless. Mock the invoke call and feed it each silent-failure shape:

```typescript
it('returns error when body contains data.error (boot-crash)', async () => {
  mockFunctionsInvoke.mockResolvedValue({
    data: { error: 'Worker failed to boot' },
    error: null,
  })
  const result = await deleteAccount()
  expect(result.success).toBe(false)
})

it('returns error when body contains router msg envelope', async () => {
  mockFunctionsInvoke.mockResolvedValue({
    data: { msg: 'worker create timed out after 10000ms' },
    error: null,
  })
  const result = await deleteAccount()
  expect(result.success).toBe(false)
})

it('returns error when body has success=false', async () => {
  mockFunctionsInvoke.mockResolvedValue({
    data: { success: false, error: 'already cancelled' },
    error: null,
  })
  const result = await deleteAccount()
  expect(result.success).toBe(false)
})
```

## Why This Matters

- **Silent success is worse than explicit failure.** An error toast tells the user to retry or contact support. A silent success teaches the user that the system works when it didn't — eroding trust the next time something actually fails. For destructive GDPR operations like account deletion, a silent success also creates a compliance gap: the UI promised deletion, the backend didn't deliver.
- **The client SDK's contract is narrower than most readers expect.** The `{ data, error }` destructuring *looks* like it covers all failures, and in managed Supabase with healthy functions it usually does. Self-hosted edge-runtime, cold starts, deployment races, and deliberate business-logic failures are all routine sources of 200-with-body-error responses the SDK will not flag for you.
- **One-line guard, repeated everywhere, beats a central helper.** The guard is three lines. A `safeInvoke()` wrapper looks tempting but obscures the pattern at call sites — future readers won't see the invariant being checked and may bypass it with a direct `supabase.functions.invoke(...)` call that forgets the guard. Inline repetition is better than premature abstraction here.
- **Siblings: fail-loud philosophy.** This pattern is the `functions.invoke()` cousin of the E93 monotonic-upsert fail-loud rule and the fail-closed destructive-migration rule. All three exist because **any successful side effect that should have failed is harder to detect and recover from than an explicit error.**

## When to Apply

- Every call to `supabase.functions.invoke()` in frontend code, without exception — even read-only calls, because a silent "0 results" answer from a crashed worker looks identical to a legitimate empty response.
- Every new Edge Function should adopt the `{ success, error }` envelope so callers only need one guard shape.
- In tests, treat "guard fires on body error" as a required AC, not an extra. At least one test per invoke call site should mock a silent-failure body.

**Do not apply** when calling:

- `supabase.from(...).select()` / `.insert()` / etc. — those use PostgREST and correctly populate `error` on failure.
- `supabase.auth.*` — those have their own typed error paths.
- Third-party APIs via `fetch()` — different contract entirely.

## Examples

### Before — silent success (the bug)

```typescript
// src/lib/account/deleteAccount.ts (pre-fix)
const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
if (error) {
  return { success: false, error: 'Unable to delete account.' }
}
// ❌ Falls through to success even when worker boot-crashed and
// ❌ data = { error: "worker boot error: ...", success: null }.
return { success: true }
```

### After — guarded (the fix)

```typescript
const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
if (error) {
  return { success: false, error: 'Unable to delete account.' }
}
if (data?.error || data?.msg || data?.success === false) {
  console.error('delete-account body error:', data)
  return {
    success: false,
    error: 'Account deletion failed. Please try again or contact support.',
  }
}
return { success: true }
```

### Symmetric guard on related calls

When you guard one invoke call, check sibling operations in the same file — they usually need the same guard:

```typescript
// src/lib/account/deleteAccount.ts — cancelAccountDeletion()
const { data, error } = await supabase.functions.invoke('cancel-account-deletion', { body: {} })
if (error) return { error: 'Unable to cancel deletion. Please contact support.' }
// Symmetric body-error guard — same three cases.
if (data?.error || data?.msg || data?.success === false) {
  console.error('cancel-account-deletion body error:', data)
  return { error: 'Unable to cancel deletion. Please contact support.' }
}
return {}
```

## Related

- [Bug-track writeup of the incident that surfaced this pattern](../integration-issues/supabase-edge-runtime-dns-and-missing-delete-account-2026-04-22.md)
- [E93 closeout sync patterns](../sync/e93-closeout-sync-patterns-2026-04-18.md) — sibling fail-loud rule for server-side monotonic upserts
- [Fail-closed destructive migrations](./fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md) — shared philosophy for destructive-op safety
