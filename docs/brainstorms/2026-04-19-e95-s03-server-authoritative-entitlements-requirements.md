# Requirements: E95-S03 — Server-Authoritative Entitlements

**Source:** `docs/implementation-artifacts/stories/E95-S03-server-authoritative-entitlements.md`
**Date:** 2026-04-19
**Epic:** E95 — Settings & Security Sync

---

## Problem Statement

The `entitlements` table was created in E19-S02 without `trial_end` and `had_trial` columns. E19-S08 added trial logic to `useIsPremium()` and `useTrialStatus.ts` that already SELECT those columns — but the migration was never shipped. The code silently fails (null values) in production. Additionally, E95-S03 formally verifies that the RLS policies prevent client writes (enforcing server-authoritative entitlements), and validates client behaviour under stale-cache and offline conditions.

## User Story

As a product owner,  
I want entitlement tiers enforced server-side,  
so that they can't be spoofed by modifying local storage — and trial/expiry columns are present in the DB schema so the existing client code can correctly display trial status.

## Functional Requirements

**FR1 — Missing columns migration:** Add `trial_end TIMESTAMPTZ` (nullable) and `had_trial BOOLEAN NOT NULL DEFAULT false` to `public.entitlements` via an idempotent migration with `ADD COLUMN IF NOT EXISTS` guards.

**FR2 — Rollback migration:** Provide matching rollback file with `DROP COLUMN` statements.

**FR3 — RLS write-deny verification:** Confirm (and fix if absent) that INSERT, UPDATE, DELETE policies deny authenticated users. Stripe webhook via `service_role` remains the only write path.

**FR4 — Client always validates on sync:** `useIsPremium()` must call `validateEntitlementOnServer()` on every online invocation regardless of cache freshness. The 7-day TTL cache is an offline fallback only.

**FR5 — Stale cache degrades gracefully:** When the cached entitlement is > 7 days old and the device is offline, `isPremium` returns `false` with the stale-cache error message.

**FR6 — Trial fields propagate:** When the server returns `tier='trial'`, `trial_end`, and `had_trial`, `useIsPremium()` exposes them correctly through its return value.

## Acceptance Criteria Summary

| AC | What | Done when |
|----|------|-----------|
| AC1 | `trial_end` + `had_trial` exist in DB | Migration applies cleanly; `\d public.entitlements` shows columns |
| AC2 | RLS write-deny policies active | Authenticated INSERT/UPDATE/DELETE blocked |
| AC3 | Server always called when online | Unit test confirms server called even with fresh cache |
| AC4 | Stale cache offline → isPremium false | Unit test confirms degradation + error message |
| AC5 | Trial fields propagate | Unit test: tier=trial → trialEnd + hadTrial correct |
| AC6 | Build + TS clean | `npm run build` + `npx tsc --noEmit` succeed |

## Out of Scope

- Stripe webhook implementation (already exists in `server/`)
- Trial lifecycle management (start/end trial flows)
- `useTrialStatus.ts` changes (that hook is already correct)
- `src/lib/checkout.ts` changes (also already reads the correct columns)
- ABS read-path migration (KI-E95-S02-L01 — deferred)
- E95-S04 (server-side streak calculation — separate story)

## Technical Context

- **Existing migration:** `supabase/migrations/001_entitlements.sql` — base table + RLS + trigger. Do NOT modify.
- **Next migration number:** `20260424000001_entitlements_trial_columns.sql`
- **Client code:** `src/lib/entitlement/isPremium.ts` — already selects `trial_end, had_trial`. Likely needs no changes unless AC3–AC5 test gaps are found.
- **Test location:** `src/lib/entitlement/__tests__/` — add/update tests here.
- **ES2020 constraint:** Use `Promise.allSettled` not `Promise.any`.
- **Pattern:** Migration style from `20260423000001_server_tables_no_credentials.sql`.

## Dependencies

- E95-S01 (settings sync) — done ✓
- E95-S02 (Vault credentials) — done ✓ (PR #370 merged)
- No dependency on E95-S04

## Risks

- **Low:** The migration is additive and idempotent (`IF NOT EXISTS`) — zero risk of breaking existing data.
- **Low:** `useIsPremium()` may already cover AC3/AC4/AC5 in existing tests — the task may reduce to adding migration + confirming test coverage.
- **None:** RLS policies are already correct per `001_entitlements.sql` — Task 2 is likely a verification no-op.
