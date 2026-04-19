---
title: "feat: E95-S03 Server-Authoritative Entitlements — trial column migration + client test coverage"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e95-s03-server-authoritative-entitlements-requirements.md
---

# feat: E95-S03 Server-Authoritative Entitlements

## Overview

The `entitlements` table is missing `trial_end` and `had_trial` columns that the client code has selected since E19-S08. This story ships a single additive migration, a rollback, and two targeted unit test additions that close the coverage gaps for the server-always-validates and trial-field-propagation behaviors.

The security posture (RLS write-deny + Stripe-only write path) is already correct in `001_entitlements.sql` and in `useIsPremium.ts`. No architectural change is required — only schema repair and test verification.

## Problem Frame

`001_entitlements.sql` (E19-S02) created the base table without `trial_end` / `had_trial`. E19-S08 added `useIsPremium()` query logic that already SELECTs those columns — in production the fields are null because the columns don't exist. The schema and the client code are out of sync. `E95-S03` closes this gap with an idempotent migration, verifies the existing RLS policies, and adds the two missing unit test assertions.

(see origin: `docs/brainstorms/2026-04-19-e95-s03-server-authoritative-entitlements-requirements.md`)

## Requirements Trace

- R1. **FR1** — Add `trial_end TIMESTAMPTZ` (nullable) and `had_trial BOOLEAN NOT NULL DEFAULT false` to `public.entitlements` via `ADD COLUMN IF NOT EXISTS`.
- R2. **FR2** — Provide rollback migration with `DROP COLUMN IF EXISTS` statements.
- R3. **FR3** — Verify the three deny-write RLS policies exist. Add fixup migration only if a policy is missing.
- R4. **FR4** — Unit test confirms `validateEntitlementOnServer()` is called even when a fresh cache exists.
- R5. **FR5** — Unit test confirms stale cache + offline → `isPremium = false`, `isStale = true`, error message set.
- R6. **FR6** — Unit test confirms `tier='trial'` server response propagates `trialEnd` and `hadTrial` through `useIsPremium()` return value.

## Scope Boundaries

- No changes to `supabase/migrations/001_entitlements.sql` (canonical — never modified in place).
- No changes to `src/lib/entitlement/isPremium.ts` unless a test gap reveals a bug.
- No changes to `useTrialStatus.ts`, `src/lib/checkout.ts`, or Stripe webhook logic.
- No ABS read-path migration (KI-E95-S02-L01 — tracked separately).
- No E95-S04 streak calculation work.

### Deferred to Separate Tasks

- ABS apiKey read-path migration from Vault: `docs/known-issues.yaml` entry KI-E95-S02-L01 — E95-S05 or later.
- Server-side streak calculation: E95-S04.

## Context & Research

### Relevant Code and Patterns

- `supabase/migrations/001_entitlements.sql` — base table, RLS policies, trigger. All three deny-write policies exist and are correct. Task 2 is a no-op verification.
- `supabase/migrations/20260423000001_server_tables_no_credentials.sql` — migration style to follow (header comment, `BEGIN/COMMIT`, `IF NOT EXISTS` guards).
- `supabase/migrations/rollback/20260423000001_server_tables_no_credentials_rollback.sql` — rollback style to follow.
- `src/lib/entitlement/isPremium.ts` — already SELECTs `trial_end, had_trial` at line 51. `useIsPremium()` already calls `validateEntitlementOnServer()` on every validate cycle regardless of cache freshness (see `validate()` at line 131 — cache is read first for fast render, then server is called unconditionally).
- `src/lib/entitlement/__tests__/isPremium.test.ts` — existing test file. Has AC3 (stale cache disables premium) and "treats trial tier as premium" but is missing:
  - Assertion that `mockSupabaseFrom` was called when fresh cache exists (FR4 — server always called).
  - `trial_end` / `had_trial` propagation assertion on trial response (FR6).
- `src/data/types.ts` — `CachedEntitlement` already has `trialEnd?: string` and `hadTrial?: boolean` optional fields.

### Institutional Learnings

- Fire-and-forget Vault writes (E95-S02): never block on credential failures. Not directly applicable here but sets context for the pattern.
- ES2020 constraint: `Promise.allSettled` preferred; `Promise.any` unavailable.
- `ADD COLUMN IF NOT EXISTS` is the preferred idempotent pattern for Postgres schema changes.

## Key Technical Decisions

- **Additive migration only:** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — no data backfill needed. Existing rows get `trial_end = NULL` and `had_trial = false` (default).
- **No `isPremium.ts` code change anticipated:** The existing implementation already calls the server on every validate invocation. The two new tests verify existing behaviour is asserted, not changed.
- **RLS verification is a no-op:** `001_entitlements.sql` has all three deny-write policies. No fixup migration is required unless a grep scan of the live DB shows otherwise — that is deferred to a developer spot-check, not a code change.
- **Next migration timestamp:** `20260424000001` (following chronological convention; one day after last migration `20260423000001`).

## Open Questions

### Resolved During Planning

- **Do `trial_end`/`had_trial` columns exist in any migration?** No — confirmed by scanning all files in `supabase/migrations/`. Only `001_entitlements.sql` defines the table and it lacks both columns.
- **Does `isPremium.ts` need a code fix for FR4?** No — reading the code at line 131–224 confirms `validateEntitlementOnServer()` is called after every cache read (see the `try { const serverResult = await validateEntitlementOnServer(user.id) }` block that runs regardless of cache freshness). Only an asserting test is missing.
- **Is `trial_end`/`had_trial` in `CachedEntitlement` type?** Yes — `src/data/types.ts` already has both as optional fields.

### Deferred to Implementation

- Whether the developer spot-check of RLS policies reveals any gap requiring a fixup migration. If all three deny-write policies are present (expected from `001_entitlements.sql`), no fixup is written.

## Implementation Units

- [ ] **Unit 1: Add `trial_end` and `had_trial` migration**

**Goal:** Repair the schema gap between `001_entitlements.sql` and the client SELECT query.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260424000001_entitlements_trial_columns.sql`
- Create: `supabase/migrations/rollback/20260424000001_entitlements_trial_columns_rollback.sql`

**Approach:**
- Forward migration: `ALTER TABLE public.entitlements ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;` and `ADD COLUMN IF NOT EXISTS had_trial BOOLEAN NOT NULL DEFAULT false;`
- Wrap in `BEGIN; ... COMMIT;` per project convention.
- Header comment must reference E95-S03 and explain why the columns were missing (E19-S08 added client code before the migration was shipped).
- Rollback: `ALTER TABLE public.entitlements DROP COLUMN IF EXISTS had_trial; DROP COLUMN IF EXISTS trial_end;`

**Patterns to follow:**
- `supabase/migrations/20260423000001_server_tables_no_credentials.sql` — header comment format, BEGIN/COMMIT, IF NOT EXISTS guards.
- `supabase/migrations/rollback/20260423000001_server_tables_no_credentials_rollback.sql` — rollback structure.

**Test scenarios:**
- Test expectation: none — this is a pure SQL migration file. Post-migration verification is via `psql` in a local Supabase reset (developer smoke test, not an automated unit test). The downstream unit tests in Unit 2 exercise the client code that depends on these columns.

**Verification:**
- `supabase db reset` or `supabase migration up` applies cleanly with no errors.
- `psql -c "\d public.entitlements"` shows `trial_end` (nullable timestamptz) and `had_trial` (boolean, default false).
- Rollback applies cleanly (drops both columns without error on a fresh migration run).

---

- [ ] **Unit 2: Add missing unit test assertions to `isPremium.test.ts`**

**Goal:** Close the two assertion gaps: (a) server always called when online + fresh cache exists; (b) trial fields propagate through the hook return value.

**Requirements:** R4, R5 (already covered by existing AC3 test), R6

**Dependencies:** Unit 1 (logically — the new columns make these tests meaningful, but the tests themselves run against mocked data)

**Files:**
- Modify: `src/lib/entitlement/__tests__/isPremium.test.ts`

**Approach:**
- **Test for FR4 (server always called with fresh cache):** In the `useIsPremium` describe block, add a test that sets up a fresh cache (< 7 days old) and a server response, runs the hook, and asserts `mockSupabaseFrom` was called. This verifies the "server validates unconditionally" contract.
- **Test for FR6 (trial fields propagate):** Extend or add to the `useIsPremium` trial tier test to include `trial_end: '2026-06-01T00:00:00.000Z'` and `had_trial: true` in the mock server response, then assert `result.current.trialEnd === '2026-06-01T00:00:00.000Z'` and `result.current.hadTrial === true`.
- The existing `mockServerResponse()` helper already supports arbitrary response data — use it directly.
- Use `waitFor` for async assertions per existing hook test pattern.
- FR5 (stale cache offline) is already covered by the existing "AC3: offline with stale cache" test — confirm it passes, add no duplicate.

**Patterns to follow:**
- `src/lib/entitlement/__tests__/isPremium.test.ts` — `mockServerResponse()`, `makeCachedEntitlement()`, `renderHook()`, `waitFor()` patterns throughout.

**Test scenarios:**
- **Happy path — server called with fresh cache:** fresh 2-day-old cache + server returns premium → `mockSupabaseFrom` called at least once → `isPremium = true` from server result.
- **Happy path — trial fields propagate:** no cache + server returns `{ tier: 'trial', trial_end: '2026-06-01T00:00:00.000Z', had_trial: true }` → hook returns `isPremium = true`, `trialEnd = '2026-06-01T00:00:00.000Z'`, `hadTrial = true`.
- **Regression — stale cache offline (already covered):** confirm existing "AC3: offline with stale cache" test still passes; no change needed.

**Verification:**
- `npm run test:unit -- src/lib/entitlement/__tests__/isPremium.test.ts` passes with the two new assertions green.
- No existing tests regress.

---

- [ ] **Unit 3: RLS verification spot-check (no-op expected)**

**Goal:** Confirm the three deny-write policies from `001_entitlements.sql` are present and complete. Add a fixup migration only if a gap is found.

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Inspect: `supabase/migrations/001_entitlements.sql`
- Create (conditional): `supabase/migrations/20260424000002_entitlements_rls_fixup.sql` — only if a missing policy is found.

**Approach:**
- Read `001_entitlements.sql` and confirm all three deny-write policies exist: `FOR INSERT ... WITH CHECK (false)`, `FOR UPDATE ... USING (false) WITH CHECK (false)`, `FOR DELETE ... USING (false)`.
- If all three are present (expected), mark this unit complete — no migration is written.
- If any policy is missing, write a fixup migration using `CREATE POLICY IF NOT EXISTS` syntax and the same deny pattern as the existing policies.

**Test scenarios:**
- Test expectation: none — this is a verification step, not a behavioral change. If a fixup migration is written, it follows the same no-test pattern as Unit 1 (SQL DDL).

**Verification:**
- `001_entitlements.sql` confirms all three deny-write policies are present.
- If a fixup migration was written: it applies cleanly to a local Supabase instance.

## System-Wide Impact

- **Interaction graph:** Additive schema change — no callbacks, middleware, or observers affected. Migration applies silently.
- **Error propagation:** The migration uses `IF NOT EXISTS` guards — re-running on a DB that already has the columns is a no-op with no error.
- **State lifecycle risks:** None — existing `entitlements` rows receive `trial_end = NULL` and `had_trial = false` as defaults. No backfill needed. No risk of breaking existing premium or free-tier rows.
- **API surface parity:** `useTrialStatus.ts` and `checkout.ts` both SELECT the same columns and will benefit from the migration without code changes.
- **Integration coverage:** The unit tests mock the Supabase client — no live DB call is made in CI. The post-migration smoke test (`\d public.entitlements`) is a developer step, not automated.
- **Unchanged invariants:** RLS SELECT policy (`"Users read own entitlement"`) is unchanged. Stripe webhook write path via `service_role` is unchanged. `ON DELETE CASCADE` from `auth.users` is unchanged. `useIsPremium()` implementation logic is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration applied to a DB that already has the columns (developer ran it manually) | `ADD COLUMN IF NOT EXISTS` guard makes the migration idempotent — no error, no data loss |
| Test for FR4 is brittle (counts mock calls) | Use `expect(mockSupabaseFrom).toHaveBeenCalled()` (not `toHaveBeenCalledTimes(1)`) to tolerate internal implementation details |
| `001_entitlements.sql` has all three deny-write policies (expected) but they use slightly different syntax than assumed | Read the file directly before writing any fixup — Unit 3 is verification-first |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e95-s03-server-authoritative-entitlements-requirements.md](docs/brainstorms/2026-04-19-e95-s03-server-authoritative-entitlements-requirements.md)
- Story file: [docs/implementation-artifacts/stories/E95-S03-server-authoritative-entitlements.md](docs/implementation-artifacts/stories/E95-S03-server-authoritative-entitlements.md)
- Base migration: `supabase/migrations/001_entitlements.sql`
- Client hook: `src/lib/entitlement/isPremium.ts`
- Existing tests: `src/lib/entitlement/__tests__/isPremium.test.ts`
- Migration pattern: `supabase/migrations/20260423000001_server_tables_no_credentials.sql`
- Previous epic: PR #370 (E95-S02 Vault credentials)
