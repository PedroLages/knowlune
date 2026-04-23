---
title: "feat: E119-S03 — Registry-Driven Erasure Cascade"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s03-erasure-cascade-requirements.md
---

# feat: E119-S03 — Registry-Driven Erasure Cascade

## Overview

Extend the `delete-account` Edge Function with a registry-driven hard-delete phase that cascades across all 38 sync tables and 4 Storage buckets. Create `cancel-account-deletion` and `retention-tick` Edge Functions. Add Stripe anonymisation on deletion. Introduce post-delete probe tests that enforce registry-drift detection in CI.

## Problem Frame

The current `delete-account` function only soft-deletes the auth row (`deleted_at`). No mechanism hard-deletes application data from the 38 sync tables or 4 Storage buckets. No `cancel-account-deletion` function yet exists despite the frontend already calling it. The `retention-tick` skeleton (needed for S11 scheduling) is absent. This leaves GDPR Article 17 (right to erasure) incompletely implemented — deletion is not verifiable, not cascade-driven, and not registry-safe. (See origin: `docs/brainstorms/2026-04-23-e119-s03-erasure-cascade-requirements.md`)

## Requirements Trace

- R1 (AC-1) — Hard-delete iterates all `tableRegistry` entries, deletes rows by `user_id` via service-role client.
- R2 (AC-2) — Hard-delete iterates `STORAGE_BUCKETS`, removes user-prefixed objects.
- R3 (AC-3) — Soft-delete phase marks `pending_deletion_at` in user metadata; user can cancel.
- R4 (AC-4) — `cancel-account-deletion` reverses soft-delete, clears metadata marker.
- R5 (AC-5) — `retention-tick` skeleton with grace-period hard-delete branch.
- R6 (AC-6) — Lawful-basis exceptions documented in code comments with placeholder link to `docs/compliance/retention.md`.
- R7 (AC-7) — Stripe anonymisation (email/name/address scrub) on hard-delete; failure is non-blocking.
- R8 (AC-8) — Probe test: every registry table returns zero rows for test user after hard-delete.
- R9 (AC-9) — Registry-drift test: table count assertion blocks CI if a new entry is added without cascade coverage.
- R10 (AC-10) — `main/index.ts` auto-discovers new function directories; no router changes needed.

## Scope Boundaries

- Sending deletion confirmation emails (S04).
- Full retention-tick scheduling (S11).
- Export functionality (S05, S06).
- Formal `docs/compliance/retention.md` document (S10 only needs a placeholder comment here).
- No schema migrations — `pending_deletion_at` stored in `raw_user_meta_data`, not a new column.

## Context & Research

### Relevant Code and Patterns

- `supabase/functions/delete-account/index.ts` — CORS + JWT auth already wired. Only calls `auth.admin.deleteUser(userId, true)` (soft-delete). Extend to two phases: immediate soft-delete + deferred hard-delete.
- `src/lib/sync/tableRegistry.ts` — exports `tableRegistry: TableRegistryEntry[]` (38 entries as of E119), each with `supabaseTable` string. Hard-delete iterates this array.
- `supabase/functions/stripe-webhook/index.ts` — pattern for Stripe import: `import Stripe from 'https://esm.sh/stripe@14?target=deno'`. Stripe API key from `Deno.env.get('STRIPE_SECRET_KEY')`.
- `supabase/functions/main/index.ts` — path-based router using `EdgeRuntime.userWorkers.create({ servicePath: /home/deno/functions/${serviceName} })`. Auto-discovers any new directory. No changes needed.
- `src/lib/__tests__/deleteAccount.test.ts` — existing Vitest suite for frontend `deleteAccount.ts`. Mock pattern established. Extend here for cascade probe and registry-drift scenarios.
- `src/lib/account/deleteAccount.ts` — exports `cancelAccountDeletion()` which calls `supabase.functions.invoke('cancel-account-deletion', ...)`. The Edge Function must exist and match this contract.

### Institutional Learnings

- `reference_sync_engine_api.md` — all data mutations flow through registry; delete cascade mirrors upload iteration.
- `reference_supabase_unraid.md` — self-hosted Supabase; `auth.admin.updateUserById` available via service role client.
- `reference_dexie_4_quirks.md` — N/A for server-side Edge Functions, but retention-tick must handle dead-letter purge eventually (S11).

### Key Patterns to Follow

- Env var fail-fast at top of Edge Function file (see `delete-account/index.ts` lines 10-15).
- CORS headers from env `APP_URL` with localhost fallback (same pattern).
- `authenticate()` helper returning `{ userId }` or error Response (same pattern).
- Service-role `supabaseAdmin` client for RLS bypass (same pattern).
- Stripe optional: guard on `STRIPE_SECRET_KEY` existence; if absent, skip Stripe step without error.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Deletion lifecycle (two phases):**

```
POST /delete-account
  │
  ├── Phase 1 (immediate): soft-delete
  │     auth.admin.updateUserById → raw_user_meta_data.pending_deletion_at = now
  │     auth.admin.deleteUser(userId, true) → sets deleted_at on auth.users
  │     → Return 200 { success: true, scheduledDeletionAt }
  │
  └── Phase 2 (triggered by retention-tick after 7 days): hard-delete
        exportHardDeleteCascade(userId, supabaseAdmin, stripe?)
          ├── For each tableRegistry entry → DELETE WHERE user_id = userId
          ├── For each STORAGE_BUCKET → list prefix userId/ → remove all
          ├── Stripe anonymisation (if STRIPE_SECRET_KEY set, non-blocking)
          └── auth.admin.deleteUser(userId, false) → permanent auth removal

POST /cancel-account-deletion
  │
  └── auth.admin.updateUserById → raw_user_meta_data.pending_deletion_at = null
      auth.admin.updateUserById → { ban_duration: 'none' } (un-ban if needed)
      → Return 200 { success: true }

Cron /retention-tick
  └── SELECT * FROM auth.users WHERE deleted_at IS NOT NULL
        AND raw_user_meta_data.pending_deletion_at < NOW() - 7 days
      → For each: exportHardDeleteCascade(userId)
```

**Registry-drift guard (test layer):**

```
EXPECTED_TABLE_COUNT = tableRegistry.length  // computed at test time
CASCADE_TABLE_COUNT  = <count returned by mock/spy>
assert CASCADE_TABLE_COUNT === EXPECTED_TABLE_COUNT
```

## Implementation Units

- [ ] **Unit 1: Shared cascade helper + updated `delete-account` Edge Function**

**Goal:** Implement the `hardDeleteUser` shared function and wire it into `delete-account` as Phase 2; update Phase 1 (soft-delete) to also stamp `pending_deletion_at` in user metadata.

**Requirements:** R1, R2, R3, R6, R7, R10

**Dependencies:** None

**Files:**
- Modify: `supabase/functions/delete-account/index.ts`
- Create: `supabase/functions/_shared/hardDeleteUser.ts`

**Approach:**
- Move hard-delete logic into `_shared/hardDeleteUser.ts` so `retention-tick` can import the same function (DRY, avoids drift).
- `hardDeleteUser(userId, supabaseAdmin, stripe?)` iterates `TABLE_NAMES` (array of Supabase table name strings, derived at module load from the registry snapshot — see registry-drift note in Unit 4). For each table: `supabaseAdmin.from(tableName).delete().eq('user_id', userId)`. Errors per-table are logged but do not abort the cascade (partial erasure is better than no erasure, but each failure is surfaced in the return value for audit).
- Storage: for each bucket in `STORAGE_BUCKETS`, call `supabaseAdmin.storage.from(bucket).list(userId + '/')` then `supabaseAdmin.storage.from(bucket).remove(paths)`. Handle paginated list (>100 objects) with a loop.
- Stripe anonymisation: if `STRIPE_SECRET_KEY` is set, look up customer by `userId` in `stripe.customers.search`, then call `stripe.customers.update(customerId, { email: 'deleted-...@deleted.invalid', name: 'Deleted User', address: null })`. Wrap in try/catch — failure is logged and non-blocking.
- Lawful-basis comment block above the Stripe section per AC-6 citing `docs/compliance/retention.md` (placeholder path).
- Updated soft-delete phase in `delete-account`: call `auth.admin.updateUserById(userId, { user_metadata: { pending_deletion_at: new Date().toISOString() } })` before `auth.admin.deleteUser(userId, true)`. This stamps the metadata while the user is still reachable.
- `WORKER_ENV_ALLOWLIST` in `main/index.ts` already includes `STRIPE_SECRET_KEY` — no router change needed.

**Execution note:** Write the `hardDeleteUser` helper first, then wire it into `delete-account`. The helper is the testable unit.

**Patterns to follow:**
- `supabase/functions/delete-account/index.ts` — env validation, CORS, authenticate helper.
- `supabase/functions/stripe-webhook/index.ts` — Stripe import pattern.

**Test scenarios:**
- Happy path: `hardDeleteUser` called for user with rows in 3 tables → all tables queried with `.eq('user_id', userId)`, storage `list` + `remove` called for 4 buckets.
- Edge case: table delete returns Supabase error for one table → cascade continues, error collected, function resolves without throwing.
- Edge case: storage list returns 0 objects for a bucket → no `remove` call for that bucket.
- Error path: Stripe API throws → cascade continues, Stripe failure logged, `hardDeleteUser` resolves with partial result.
- Error path: `STRIPE_SECRET_KEY` absent → Stripe block skipped entirely.
- Integration: `delete-account` POST with valid JWT stamps `pending_deletion_at` in user metadata AND returns `{ success: true, scheduledDeletionAt }`.

**Verification:**
- `_shared/hardDeleteUser.ts` exists and exports `hardDeleteUser`.
- `delete-account/index.ts` imports and calls `hardDeleteUser` in the hard-delete path.
- Soft-delete phase stamps `pending_deletion_at` via `updateUserById`.

---

- [ ] **Unit 2: `cancel-account-deletion` Edge Function**

**Goal:** Create the `cancel-account-deletion` function that reverses the soft-delete by clearing `pending_deletion_at` from user metadata and un-banning the user if needed.

**Requirements:** R4, R10

**Dependencies:** Unit 1 (soft-delete stamps `pending_deletion_at`, cancel clears it)

**Files:**
- Create: `supabase/functions/cancel-account-deletion/index.ts`

**Approach:**
- Mirror `delete-account/index.ts` structure: env validation, CORS headers, `authenticate()` helper, `Deno.serve`.
- On POST: call `supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { pending_deletion_at: null } })` to clear the marker.
- The Supabase soft-delete (`deleted_at`) is not automatically reversible via the Admin API — use `updateUserById` with `ban_duration: 'none'` to reactivate. (Supabase self-hosted: `deleted_at` cleanup requires direct DB access or a service call; the `ban_duration: 'none'` approach reactivates the user for login purposes within the grace period.)
- Return `{ success: true }`.
- Idempotent: if user has no `pending_deletion_at`, still return success (already cancelled or never initiated).

**Patterns to follow:**
- `supabase/functions/delete-account/index.ts` — authenticate, CORS, error shapes.

**Test scenarios:**
- Happy path: POST with valid JWT → `updateUserById` called with `{ user_metadata: { pending_deletion_at: null } }`, returns `{ success: true }`.
- Edge case: user has no `pending_deletion_at` (idempotent) → still returns `{ success: true }`.
- Error path: `updateUserById` fails → returns `{ success: false, error: '...' }` 500.
- Error path: missing/invalid JWT → 401 Unauthorized.

**Verification:**
- `supabase/functions/cancel-account-deletion/index.ts` exists.
- Frontend `cancelAccountDeletion()` invocation returns success when function is called with valid session.

---

- [ ] **Unit 3: `retention-tick` skeleton Edge Function**

**Goal:** Create the `retention-tick` Edge Function skeleton with a branch that calls `hardDeleteUser` for users whose grace period has expired.

**Requirements:** R5, R10

**Dependencies:** Unit 1 (`_shared/hardDeleteUser.ts` must exist)

**Files:**
- Create: `supabase/functions/retention-tick/index.ts`

**Approach:**
- No JWT auth required (called by scheduler/cron, not user). Use service-role client only.
- On POST/GET: query `auth.users` via `supabaseAdmin.auth.admin.listUsers()` (paginated). Filter for users where `raw_user_meta_data.pending_deletion_at` is non-null AND more than `SOFT_DELETE_GRACE_DAYS` days ago.
- For each expired user: call `hardDeleteUser(userId, supabaseAdmin, stripe?)`.
- Skeleton comment block marks where S11 will wire the pg_cron / external cron trigger.
- Return `{ success: true, processed: N }`.
- Note: `auth.admin.listUsers()` paginates at 50 by default — loop with `page` param until exhausted.

**Patterns to follow:**
- `supabase/functions/delete-account/index.ts` — env validation, service-role client, error response shape.

**Test scenarios:**
- Happy path: two users with expired `pending_deletion_at` → `hardDeleteUser` called twice, returns `{ processed: 2 }`.
- Edge case: no expired users → returns `{ processed: 0 }`.
- Edge case: paginated user list (more than 50 users) → all pages iterated.
- Error path: `hardDeleteUser` throws for one user → error logged, other users still processed.

**Verification:**
- `supabase/functions/retention-tick/index.ts` exists.
- Function handles paginated user lists correctly.
- `hardDeleteUser` is imported from `_shared/hardDeleteUser.ts`.

---

- [ ] **Unit 4: Probe tests and registry-drift guard**

**Goal:** Extend `src/lib/__tests__/deleteAccount.test.ts` with post-delete probe tests (AC-8) and a registry-drift table count assertion (AC-9).

**Requirements:** R8, R9

**Dependencies:** Unit 1 (defines the table list consumed by `hardDeleteUser`)

**Files:**
- Modify: `src/lib/__tests__/deleteAccount.test.ts`
- Modify: `supabase/functions/_shared/hardDeleteUser.ts` — export `TABLE_NAMES` constant so the test can import it for the drift assertion.

**Approach:**
- Export `TABLE_NAMES: string[]` from `_shared/hardDeleteUser.ts`. This array is the live list of Supabase table names the cascade will delete from.
- Note: `_shared/hardDeleteUser.ts` is a Deno module (ESM, URL imports). The probe test is a Vitest/browser test. To avoid cross-runtime import issues, export a companion `ERASURE_TABLE_NAMES` constant from `src/lib/sync/tableRegistry.ts` computed by mapping `tableRegistry` entries to `supabaseTable`. The probe test imports from the TypeScript source; the Deno function derives its list the same way at runtime. This keeps the assertion O(1): if `tableRegistry` adds an entry, `ERASURE_TABLE_NAMES.length` increases, and the test that checks `TABLE_NAMES.length === ERASURE_TABLE_NAMES.length` (or equivalently, checks that each table appears in the cascade mock calls) fails CI.
- Probe test: mock `supabaseAdmin.from().delete().eq()` spy. Call a test-only `hardDeleteCascade(userId, mockAdmin)` wrapper (or spy the `mockFunctionsInvoke` to simulate the edge function calling into the cascade). Assert spy was called with each `supabaseTable` from `tableRegistry`.
- Registry-drift test: `expect(cascadedTableNames).toHaveLength(tableRegistry.length)`. If a developer adds a table to `tableRegistry` without updating the cascade, this assertion fails.
- Storage probe: mock `supabaseAdmin.storage.from().list()` and `.remove()`. Assert called for all 4 buckets.

**Patterns to follow:**
- Existing mock pattern in `src/lib/__tests__/deleteAccount.test.ts` — `vi.hoisted`, `vi.mock`, `mockFunctionsInvoke`.

**Test scenarios:**
- Probe: after simulated hard-delete, spy records one delete call per registry table — `expect(deleteCalls).toHaveLength(tableRegistry.length)`.
- Probe: storage spy records list+remove for `['avatars', 'course-media', 'audio', 'exports']`.
- Registry-drift: `tableRegistry.length` equals the number of tables targeted by the cascade (enforced by the length assertion).
- Edge case: `tableRegistry` has zero-length (defensive) → cascade runs no table deletes, no error thrown.

**Verification:**
- `npm run test:unit` passes with new probe and drift tests.
- Manually adding a dummy entry to `tableRegistry` causes the drift assertion to fail (manual spot-check during implementation).

---

- [ ] **Unit 5: `docs/compliance/retention.md` placeholder + `ERASURE_TABLE_NAMES` export**

**Goal:** Export `ERASURE_TABLE_NAMES` from `tableRegistry.ts` for the probe test (Unit 4) and create a `docs/compliance/retention.md` placeholder so code comments can link to a real path (AC-6).

**Requirements:** R6, R9

**Dependencies:** None (Unit 4 imports this, so it must land alongside or before Unit 4)

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts` — add `export const ERASURE_TABLE_NAMES: string[]` derived from `tableRegistry`.
- Create: `docs/compliance/retention.md` — one-paragraph placeholder with `[TODO: S10]` marker.

**Approach:**
- `ERASURE_TABLE_NAMES = tableRegistry.map(e => e.supabaseTable)` added after the registry array declaration.
- `docs/compliance/retention.md` placeholder: minimal markdown noting this document will be completed in S10.

**Test scenarios:**
- Test expectation: none — this is a derived constant (value equality proven by probe in Unit 4) and a stub doc.

**Verification:**
- `ERASURE_TABLE_NAMES.length === 38` at current registry size.
- `docs/compliance/retention.md` exists and contains `[TODO: S10]` marker.

## System-Wide Impact

- **Interaction graph:** `hardDeleteUser` is called by both `delete-account` (on-demand) and `retention-tick` (scheduled). Any future story adding a retention-triggered action must import the same helper.
- **Error propagation:** Per-table errors are non-fatal (logged, collected). The hard-delete continues even if one table fails — partial erasure is preferable to no erasure, but failures must be surfaced in the response for audit.
- **State lifecycle risks:** Race condition: if a user cancels during the `hardDeleteUser` execution window (after `retention-tick` starts but before it finishes), data may be partially deleted. Mitigation: `retention-tick` is called only after 7-day grace; the cancellation window is the grace period before tick invocation, not during.
- **API surface parity:** `cancel-account-deletion` must match the contract expected by `src/lib/account/deleteAccount.ts` `cancelAccountDeletion()` — returns HTTP 200 `{ success: true }` on success.
- **Integration coverage:** The probe test (Unit 4) covers the cascade table list at the unit level. Integration-level verification (actual DB rows removed) is deferred to E2E testing in S08.
- **Unchanged invariants:** `SOFT_DELETE_GRACE_DAYS = 7` constant is preserved in both Edge Functions and frontend. `main/index.ts` router is not modified — it auto-discovers directories.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Stripe customer lookup returns 0 results (user never subscribed) | Guard the Stripe block with `if (customer)` — skip anonymisation gracefully |
| `auth.admin.listUsers()` paginates — retention-tick misses users past page 1 | Implement pagination loop in Unit 3 |
| `_shared/` Deno ESM and Vitest TypeScript test import incompatibility | Export `ERASURE_TABLE_NAMES` from TypeScript `tableRegistry.ts` (Vite-bundled), not from the Deno `_shared/` module, for test isolation |
| New table added to `tableRegistry` silently bypasses cascade | Unit 4 registry-drift assertion enforces parity — CI fails immediately |
| `supabaseAdmin.auth.admin.updateUserById` for ban_duration may differ between self-hosted versions | Use `ban_duration: 'none'` (documented Supabase pattern); log warning if API returns unexpected shape |

## Documentation / Operational Notes

- `docs/compliance/retention.md` placeholder created by Unit 5 — S10 will fill it.
- `STRIPE_SECRET_KEY` must be set in the Edge Function env for Stripe anonymisation to run; if absent, it is silently skipped (non-breaking for non-Stripe users).
- `retention-tick` is a skeleton in S03; S11 wires the pg_cron or external cron trigger.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s03-erasure-cascade-requirements.md](docs/brainstorms/2026-04-23-e119-s03-erasure-cascade-requirements.md)
- **Umbrella plan:** [docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md](docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md)
- **Story file:** [docs/implementation-artifacts/stories/E119-S03.md](docs/implementation-artifacts/stories/E119-S03.md)
- Related code: `supabase/functions/delete-account/index.ts`, `src/lib/sync/tableRegistry.ts`, `src/lib/__tests__/deleteAccount.test.ts`
- External: GDPR Article 17 (right to erasure)
