---
story_id: E95-S03
story_name: "Server-Authoritative Entitlements"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 95.03: Server-Authoritative Entitlements

## Story

As a product owner,
I want entitlement tiers enforced server-side,
so that they can't be spoofed by modifying local storage or IndexedDB — and trial/expiry columns missing from the DB schema are added so the existing client code stops silently querying non-existent fields.

## Acceptance Criteria

**AC1 — `trial_end` and `had_trial` columns exist in `entitlements`:**
Given the Supabase migration for E95-S03 has been applied.
When a Stripe webhook upgrades a user to `trial` tier.
Then the `trial_end` (TIMESTAMPTZ nullable) and `had_trial` (BOOLEAN DEFAULT false) columns are present in `public.entitlements`.
And the existing `useIsPremium()` hook's `SELECT` query returns `trial_end` and `had_trial` without error.

**AC2 — Only SELECT RLS policy exists for the authenticated role:**
Given the `entitlements` table RLS policies.
When an authenticated client attempts an INSERT, UPDATE, or DELETE on `public.entitlements`.
Then the operation is denied (RLS returns false).
And the `Deny user writes on entitlements` policies from `001_entitlements.sql` are verified still active.
Note: This AC is a verification / migration guard — no new RLS changes needed if `001_entitlements.sql` is already applied.

**AC3 — Client always re-validates on sync (cache TTL for offline-only fallback):**
Given a user has a fresh IndexedDB-cached entitlement (< 7 days old).
When the user is online and `useIsPremium()` runs its `validate()` path.
Then it always calls `validateEntitlementOnServer()` regardless of cache freshness.
And it updates the local cache from the server result.
And the existing 7-day TTL cache is only used when the server is unreachable (offline fallback).
Note: Current implementation already does this — AC3 is a regression test assertion.

**AC4 — Stale cache (> 7 days) disables premium when offline:**
Given a user has a stale IndexedDB-cached entitlement (> 7 days old).
When the device is offline and `useIsPremium()` runs.
Then `isPremium` returns `false`.
And the hook sets `error` to the stale-cache message string.

**AC5 — `trial_end` and `hadTrial` propagate through `useIsPremium()` return value:**
Given an entitlement row with `tier = 'trial'`, `trial_end = '2026-06-01T00:00:00Z'`, `had_trial = true`.
When `useIsPremium()` validates on the server.
Then `isPremium` is `true`.
And `trialEnd` is `'2026-06-01T00:00:00Z'`.
And `hadTrial` is `true`.

**AC6 — Stripe webhook remains sole write path:**
Given any client code.
When it attempts to modify the `entitlements` table.
Then the attempt is blocked by RLS (no INSERT/UPDATE/DELETE allowed for `authenticated` role).
And only the `stripe-webhook` Edge Function (running as `service_role`) can mutate entitlements.

**AC7 — GDPR cascade delete removes entitlement with account:**
Given a user account is deleted from `auth.users`.
When the cascade delete fires.
Then the corresponding `entitlements` row is removed (ON DELETE CASCADE from `001_entitlements.sql`).
Note: `001_entitlements.sql` already has this constraint — this AC is a schema verification.

## Tasks / Subtasks

- [ ] Task 1: Add `trial_end` and `had_trial` migration (AC1)
  - [ ] 1.1 Create `supabase/migrations/20260424000001_entitlements_trial_columns.sql`
  - [ ] 1.2 `ALTER TABLE public.entitlements ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;`
  - [ ] 1.3 `ALTER TABLE public.entitlements ADD COLUMN IF NOT EXISTS had_trial BOOLEAN NOT NULL DEFAULT false;`
  - [ ] 1.4 Add rollback file `supabase/migrations/rollback/20260424000001_entitlements_trial_columns_rollback.sql` with `DROP COLUMN` statements
  - [ ] 1.5 Add migration header comment referencing E95-S03 and explaining why these columns are needed (already read by `isPremium.ts` since E19-S08)

- [ ] Task 2: Verify RLS policies are correct (AC2, AC6)
  - [ ] 2.1 Confirm `001_entitlements.sql` is the source of truth for all three deny-write policies
  - [ ] 2.2 If any gap is found (e.g., missing UPDATE WITH CHECK), add a fixup migration; otherwise skip
  - [ ] 2.3 Do NOT duplicate policies — use `IF NOT EXISTS` guard if adding anything

- [ ] Task 3: Add/update unit tests for `isPremium.ts` (AC3, AC4, AC5)
  - [ ] 3.1 In `src/lib/entitlement/__tests__/`, verify existing test file covers: server called even when cache is fresh (AC3)
  - [ ] 3.2 Add/update test: stale cache offline → isPremium false + error set (AC4)
  - [ ] 3.3 Add/update test: trial entitlement → `trialEnd` and `hadTrial` propagate correctly (AC5)
  - [ ] 3.4 Tests should mock `supabase.from('entitlements').select(...)` using `vi.mock`; no real DB calls in unit tests

- [ ] Task 4: Smoke test query against local Supabase (AC1 post-migration)
  - [ ] 4.1 After applying migration locally, run `supabase db reset` or `supabase migration up` and verify `psql -c "\d public.entitlements"` shows `trial_end` and `had_trial` columns
  - [ ] 4.2 Confirm existing `useIsPremium()` tests still pass with no changes to `isPremium.ts`

## Dev Notes

### Background: Why these columns are missing

`001_entitlements.sql` (created in E19-S02) defined the initial schema without `trial_end`/`had_trial`. E19-S08 added trial logic to the `useIsPremium()` hook (which SELECTs those columns) and `useTrialStatus.ts`, but the corresponding migration was never added to `supabase/migrations/`. The columns exist in production only if applied manually. E95-S03 closes this gap by creating a proper migration.

### What already exists and must not be changed

- **`supabase/migrations/001_entitlements.sql`** — Do not modify. Contains the base table, RLS policies, ON DELETE CASCADE, and the `handle_new_user_entitlement()` trigger. The three deny-write policies are complete.
- **`src/lib/entitlement/isPremium.ts`** — Already correct. The `validateEntitlementOnServer()` function already SELECTs `trial_end, had_trial`. No changes needed unless a bug is found in AC3-AC5 testing.
- **`src/lib/checkout.ts`** — Also already reads `trial_end` and `had_trial` from the same table. No changes.
- **`src/app/hooks/useTrialStatus.ts`** — Trial status hook. No changes in this story.

### Migration naming convention

Follow existing pattern: `YYYYMMDD000001_<description>.sql`
Next migration number: `20260424000001_entitlements_trial_columns.sql`

### RLS verification checklist

The following policies should already exist on `public.entitlements`:
- `"Users read own entitlement"` — FOR SELECT, USING `auth.uid() = user_id`
- `"Deny user writes on entitlements"` — FOR INSERT TO authenticated, WITH CHECK false
- `"Deny user updates on entitlements"` — FOR UPDATE TO authenticated, USING false WITH CHECK false
- `"Deny user deletes on entitlements"` — FOR DELETE TO authenticated, USING false

If any are missing, add via fixup migration. If all present, Task 2 is a no-op.

### IndexedDB schema (read-only reference)

`db.entitlements` table (Dexie) stores `CachedEntitlement`:
```ts
interface CachedEntitlement {
  userId: string     // PK
  tier: EntitlementTier
  trialEnd?: string  // ISO string, from Postgres trial_end
  hadTrial?: boolean // from Postgres had_trial
  cachedAt: string   // ISO string, set by client
}
```
No Dexie schema changes needed — `trialEnd` and `hadTrial` are already declared optional.

### Patterns to follow

- **Migration style**: See `supabase/migrations/20260423000001_server_tables_no_credentials.sql` for header comment format
- **Rollback style**: See `supabase/migrations/rollback/20260423000001_server_tables_no_credentials_rollback.sql`
- **Unit test style**: See `src/lib/entitlement/__tests__/` for existing patterns; mock Supabase client with `vi.mock('@/lib/auth/supabase', () => ({ supabase: { from: vi.fn()... } }))`

### Previous story intelligence (E95-S02)

- Vault credentials were wired in E95-S02 — no credential columns in server tables
- Fire-and-forget Vault writes: don't block on auth failure
- `Promise.allSettled` preferred over `Promise.any` (ES2020 constraint — Knowlune targets ES2020)
- Non-throwing pattern for credential operations: log warnings, never propagate to UI

## Test Scenarios

| Scenario | Input | Expected |
|----------|-------|----------|
| Fresh cache + online | Valid 1-day-old cache, server returns premium | Server called; tier set to premium from server |
| Stale cache + offline | 8-day-old cache, no network | isPremium = false, error message set |
| Trial entitlement | Server returns `tier='trial'`, `trial_end='2026-06-01'`, `had_trial=true` | isPremium=true, trialEnd propagated, hadTrial=true |
| Server returns free tier | Any cache, server returns `tier='free'` | Cache cleared, isPremium=false |
| No cache + network error | Empty IndexedDB, fetch throws | isPremium=false, no error shown |
| Migration applied | `psql \d public.entitlements` | Columns `trial_end` and `had_trial` visible |

## Definition of Done

- [ ] Migration file exists and applies cleanly with `IF NOT EXISTS` guards
- [ ] Rollback file exists
- [ ] RLS policies verified (Task 2 confirms or adds fixup)
- [ ] Unit tests pass for AC3/AC4/AC5 scenarios
- [ ] Build passes (`npm run build`)
- [ ] TypeScript clean on modified files (`npx tsc --noEmit`)
