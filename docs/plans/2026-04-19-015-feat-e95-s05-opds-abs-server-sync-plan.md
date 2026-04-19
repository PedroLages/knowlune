---
title: E95-S05 — OPDS and Audiobookshelf Server Connection Sync
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e95-s05-opds-abs-server-sync-requirements.md
deepened: 2026-04-19
---

# E95-S05 — OPDS and Audiobookshelf Server Connection Sync

## Overview

Close the loop on E95-S02 by wiring `opdsCatalogs` and `audiobookshelfServers` through the full sync pipeline (Dexie ↔ Supabase, with credentials routed through the Vault broker) and closing KI-E95-S02-L01 — migrating every `server.apiKey` / `catalog.auth.password` read site to an async vault-backed resolver. After this story ships, signing in on a fresh device hydrates server configs automatically, credentials never touch Postgres rows or the Dexie `syncQueue`, and the TypeScript compiler enforces the credential-off-the-row invariant.

## Problem Frame

E95-S02 shipped the vault broker, the credential-free Supabase tables (migration `supabase/migrations/20260423000001_server_tables_no_credentials.sql`), and `tableRegistry` entries for both tables. But the **write path** still bypasses `syncableWrite` (see `src/stores/useAudiobookshelfStore.ts:89` using raw `db.audiobookshelfServers.add()` and `src/stores/useOpdsCatalogStore.ts:46-69` using raw Dexie writes), and the **read path** still reads `server.apiKey` off the Dexie row in 9 files / ~25 sites. That field was intentionally left as a compatibility shim so E95-S02 could ship — this story removes the shim, wires the sync paths, and migrates pre-vault installs. (See origin doc for scenarios and hard constraints.)

## Requirements Trace

- **R1 (HC-1):** All 25 call sites that currently read `server.apiKey` go through a single async resolver (`getAbsApiKey`) plus a React hook (`useAbsApiKey`). `AudiobookshelfServer` type drops the `apiKey` field; equivalent resolver + hook for OPDS password.
- **R2 (HC-2):** One-shot backwards-compat migration uploads pre-vault `apiKey` / `password` values into the vault on first authenticated boot, clears them from Dexie, retries on failure, surfaces a non-blocking toast after three failures.
- **R3 (HC-3):** Both tables fully synced via `syncableWrite` on every write; hydration on sign-in populates both tables; credentials never appear in Postgres rows or the `syncQueue`.
- **R4 (AC-1, AC-2):** Sign-in hydration E2E — fresh browser context hydrates within one sync cycle and ABS sync works without re-entering the apiKey.
- **R5 (AC-3):** Grep gate — `git grep -nP 'server\??\.apiKey' src/ -- ':!*.test.ts'` returns zero hits post-merge.
- **R6 (AC-5):** Unit tests prove `stripFields` drops `apiKey` / `password` and that `syncableWrite` never leaks them into the queue payload even when callers pass them in.
- **R7 (AC-7):** Telemetry events fire for hydration, migration success, migration failure.

## Scope Boundaries

- Credential rotation UX (later story)
- Multi-tenant / shared server connections
- Syncing ABS playback progress or library state (already wired elsewhere — this story only touches connection config)
- Changes to the vault-credentials broker API surface

### Deferred to Separate Tasks

- Orphaned vault-entry reconciler (cron sweep of vault entries with no matching Dexie / Supabase row) — log but don't sweep in this story.
- "Re-auth required" full UX polish — this story sets `status: 'auth-failed'` on 401 from the resolver and shows a compact banner; a dedicated re-entry modal with branded copy is a follow-up design story.

## Context & Research

### Relevant Code and Patterns

- **Sync wiring recipe:** `src/lib/sync/tableRegistry.ts:517-541` (both entries already present with `vaultFields: ['apiKey']` / `['password']`), `src/lib/sync/syncableWrite.ts` (already strips `vaultFields` via `toSnakeCase()` at line 178-185 of syncableWrite — confirmed in code read).
- **Vault broker client:** `src/lib/vaultCredentials.ts` exports `storeCredential` / `readCredential` / `checkCredential` / `deleteCredential`. All are non-throwing and no-op when unauthenticated.
- **Dexie schema history:** `src/db/schema.ts:1357-1519` shows the schema-version ladder. New bump needs to drop `apiKey` from `audiobookshelfServers` row shape and `auth.password` from `opdsCatalogs`.
- **Type definitions:** `src/data/types.ts:874-902` — `OpdsCatalog.auth.password?: string` and `AudiobookshelfServer.apiKey?: string`. Both already marked "Dexie rows do NOT contain this field after E95-S02 migration" in a comment — this story enforces that with the type.
- **Known issue:** `docs/known-issues.yaml` → `KI-E95-S02-L01`.

### Pattern References (prior stories)

- **E95-S01** (user_settings JSONB merge) — singleton-row LWW via RPC. Not directly reused (server tables are multi-row), but the one-shot post-boot migration pattern (run after sign-in, track in `kv`) is the same mechanism S01 used.
- **E95-S02** (vault-credentials broker) — we reuse the 4-route broker as-is. Reference implementation: `supabase/functions/vault-credentials/index.ts` and client `src/lib/vaultCredentials.ts`.
- **E94-S06** (composite PK sync via `upsertConflictColumns`) — **not applicable**. Both server tables use a single `id` UUID PK; `compoundPkFields` stays unused.
- **E92 sync engine public API** — reuse `syncableWrite`, `syncEngine.nudge()`, `tableRegistry` exactly as documented in `reference_sync_engine_api.md`.

### Institutional Learnings

- **Dexie 4 async upgrades can't read auth** (`reference_dexie_4_quirks.md`) — the pre-vault credential migration **cannot** run inside a Dexie upgrade function. It must run from a post-boot hook after `auth.uid()` is available. The Dexie upgrade function only drops the field from the index / type shape; the legacy row data stays present until the post-boot migration uploads and clears it.
- **ES2020 constraints** (`reference_es2020_constraints.md`) — `Promise.allSettled` is available (used for bulk migration retry), `Promise.any` is not.
- **`updatedAt` stamping belongs to `syncableWrite`** — callers must never pre-stamp `updatedAt` (lesson from E93-S02 bookmark optimistic-update bug KI-E93-S02-L01).

### External References

None — this is all well-patterned local work. Skipping external research per Phase 1.2 (strong local patterns, 3+ prior sync-wiring reference stories).

## Key Technical Decisions

- **Credential write ordering: vault-first, metadata-second.** If vault write fails, surface an error and abort the metadata write (no partial state). If metadata write fails after a successful vault write, the vault entry is orphaned but harmless — no Dexie row or Supabase row references it. Deferred reconciler sweeps orphans later. This matches the recommendation in the origin doc's ADR section.
- **One resolver helper per credential kind, plus one React hook.** `getAbsApiKey(serverId)` / `useAbsApiKey(serverId)` for ABS. `getOpdsPassword(catalogId)` / `useOpdsPassword(catalogId)` for OPDS. Both files live under `src/lib/credentials/` so the codebase has a single home for "read a credential through the vault."
- **Resolver cache: unbounded per session.** Users have at most ~3 servers. Keyed by `serverId`, invalidated on sign-out (hooked into the existing auth-state change listener). No LRU needed. (Answers origin Open Question #1.)
- **OPDS needs a hook too** (answers origin Open Question #2). `src/app/components/library/OpdsBrowser.tsx` is render-time and fetches feeds with basic auth; it needs the same reactive hook pattern as ABS components that render cover URLs.
- **Migration bookkeeping:** single `migrations.credentialsToVault.v1 = 'done'` entry in `db.kv` (reuse existing `kv` table pattern). One flag covers both tables — the migration iterates both in one shot.
- **Migration failure backoff:** per-serverId failure count kept in-memory (not persisted — a user who closes the app resets the counter, which is fine because they'll get the toast on the 3rd failing session anyway). Telemetry events fire regardless so we can observe the real failure rate in Supabase Functions logs.
- **401 handling from resolver:** retry once (refresh session, re-invoke). If still 401, mark the server row `status: 'auth-failed'` via `syncableWrite` (so the status propagates to other devices) and surface a compact inline banner in the server card. Defer the full re-entry modal to a later polish story.
- **Type enforcement instead of runtime strip for the row shape:** after the Dexie upgrade, the TypeScript type `AudiobookshelfServer` drops the `apiKey` field entirely. `tableRegistry.vaultFields` stays as defense-in-depth (in case a future caller tries to cast-around the type). This is what "TypeScript enforces the migration" means in the requirements doc.
- **Hydration verification:** both tables are already registered in `tableRegistry`, which means `syncEngine.download` already includes them in the manifest. We add an explicit integration test rather than touching engine code — the scope is to verify, not modify.

## Open Questions

### Resolved During Planning

- **Cache shape (origin Q1):** unbounded per session, invalidated on sign-out. See Key Decisions.
- **OPDS hook (origin Q2):** yes, `useOpdsPassword` is needed for `OpdsBrowser.tsx` render-time feed fetches. See Key Decisions.
- **Orphan reconciler (origin Q3):** deferred to a later story; log `sync.vault.potential_orphan` telemetry on metadata-write failure so we have data when we build the reconciler. See Scope Boundaries.
- **401 UX (origin Q4):** minimum viable — set `status: 'auth-failed'` via `syncableWrite` and show a compact inline banner with "Re-enter credentials" CTA that opens the existing edit form. Full modal polish deferred.

### Deferred to Implementation

- Exact shape of the in-memory cache (Map vs plain object) — stylistic, pick during Unit 2.
- Whether to use `useSyncExternalStore` or a local `useState + useEffect` for the resolver hook — depends on whether the cache needs cross-component invalidation; likely `useEffect` is enough.
- Exact telemetry emitter call signature — match whatever pattern `useAnalytics` / `trackEvent` uses in the codebase at implementation time.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌──────────────────────┐                    ┌──────────────────────────┐
│  Consumer component  │  useAbsApiKey(id)  │  src/lib/credentials/    │
│  (SeriesCard, etc.)  │ ─────────────────▶ │  absApiKeyResolver.ts    │
└──────────────────────┘                    │                          │
                                            │   cache  ◀──┐            │
                                            │             │            │
                                            └─────────────┼────────────┘
                                                          │ miss
                                                          ▼
                                            ┌──────────────────────────┐
                                            │ vaultCredentials         │
                                            │   .readCredential()      │
                                            └──────────┬───────────────┘
                                                       ▼
                                            ┌──────────────────────────┐
                                            │ Supabase Edge Function   │
                                            │   vault-credentials      │
                                            └──────────────────────────┘

Write path (addServer):
  ┌─────────────────────────────────┐
  │ 1. storeCredential (await)      │ ──▶ vault broker
  └──────────┬──────────────────────┘
             │ on success
             ▼
  ┌─────────────────────────────────┐
  │ 2. syncableWrite('put', row')   │ ──▶ Dexie + syncQueue (apiKey stripped)
  └─────────────────────────────────┘

  on vault failure: surface toast, do NOT write row (no partial state)
```

Pre-vault migration (runs once per device, after first authenticated boot):

```
for each row in (opdsCatalogs ∪ audiobookshelfServers):
  if row has legacy credential field:
    storeCredential(kind, row.id, secret) --> vault
    on success: raw Dexie update to null the field (NOT syncableWrite)
    on fail:    leave field, log telemetry, increment per-id counter
                if counter >= 3: show non-blocking toast (once per session)
mark db.kv.migrations.credentialsToVault.v1 = 'done'
```

## Implementation Units

- [ ] **Unit 1: Schema bump + type narrowing**

**Goal:** Bump Dexie schema version to drop `apiKey` from the stored shape of `audiobookshelfServers` and `password` from `opdsCatalogs.auth`. Update TypeScript types so the compiler flags any remaining direct read.

**Requirements:** R1 (HC-1 type enforcement), R3 (HC-3 schema parity)

**Dependencies:** None — this unit lands first so every subsequent unit compiles against the new type.

**Files:**
- Modify: `src/db/schema.ts` — add a new schema version bump; the upgrade function only drops the index (if indexed) and is a no-op for field removal since Dexie stores arbitrary objects. Do **not** run credential migration here (Dexie upgrades can't read auth).
- Modify: `src/data/types.ts` — remove `apiKey?: string` from `AudiobookshelfServer`; remove `password?: string` from `OpdsCatalog.auth`. Add a deprecated legacy-shape type alias (e.g., `LegacyAudiobookshelfServer`) internal to the credential-migration module for use by the post-boot migration (see Unit 3).
- Test: `src/db/__tests__/schema-e95-s05.test.ts` — assert new version number registered, assert legacy rows still open (Dexie retains unknown fields on stored rows until explicitly overwritten).

**Approach:**
- Add a new schema version (next integer after current latest) with identical index signatures. Field removal is not an index change, so only type + version increment.
- Mark the two credential fields as **absent** in the exported types. Consumers that still reference them will fail `tsc --noEmit`, which is exactly the enforcement surface the requirements call for.

**Execution note:** Land the type change and the whole rest of the plan in one PR — a partial merge would leave ~25 type errors on `main`. Implement in dependency order but do not merge early.

**Patterns to follow:**
- Existing schema bumps in `src/db/schema.ts` (lines 1357-1519 show the version ladder convention)
- `LegacyBookmark` pattern used in earlier P1 sync migrations for legacy-shape types

**Test scenarios:**
- Happy path — new schema version opens cleanly on a fresh IDB with no legacy data.
- Edge case — existing Dexie with a legacy row (has `apiKey` populated) still opens without throwing; the field value is still readable via a raw `db.audiobookshelfServers.toArray()` (needed by Unit 3's migration).
- Happy path — `tsc --noEmit` fails on a probe file that reads `server.apiKey` directly (sanity check that the type change bites).

**Verification:**
- Unit tests pass
- `tsc --noEmit` shows exactly the expected error count from direct `server.apiKey` / `catalog.auth.password` reads (the migration targets in Unit 4 & 5)

---

- [ ] **Unit 2: Credential resolver library**

**Goal:** Build `src/lib/credentials/` with the vault-backed resolver + React hook for both kinds.

**Requirements:** R1 (resolver contract)

**Dependencies:** Unit 1 (types).

**Files:**
- Create: `src/lib/credentials/absApiKeyResolver.ts` — exports `getAbsApiKey(serverId: string): Promise<string | null>` and `useAbsApiKey(serverId: string | undefined)` hook.
- Create: `src/lib/credentials/opdsPasswordResolver.ts` — exports `getOpdsPassword(catalogId: string): Promise<string | null>` and `useOpdsPassword(catalogId: string | undefined)` hook.
- Create: `src/lib/credentials/cache.ts` — in-memory cache keyed by `${kind}:${id}`, `clear()` method wired to auth-state-change.
- Modify: `src/lib/auth/supabase.ts` (or wherever the auth listener lives) — call `credentialCache.clear()` on `SIGNED_OUT`.
- Test: `src/lib/credentials/__tests__/absApiKeyResolver.test.ts`, `src/lib/credentials/__tests__/opdsPasswordResolver.test.ts`, `src/lib/credentials/__tests__/cache.test.ts`.

**Approach:**
- Cache-first read. On miss, call `readCredential()`. Cache the result (including `null`, to avoid repeated round-trips for missing entries — with a 5-minute TTL on `null` entries).
- On 401 from the broker, invalidate the cache entry, refresh session via `supabase.auth.refreshSession()`, retry once, then give up and return `null`.
- Hook wraps the async resolver with `useState` (value, loading, error). Recomputes on `serverId` change. Suspense-free — consumers render from an intermediate loading state.

**Patterns to follow:**
- `src/lib/vaultCredentials.ts` for the non-throwing client pattern
- Existing async-hook conventions in `src/app/hooks/` (scan during implementation for a clean prior example)

**Test scenarios:**
- Happy path — first call hits broker, second call hits cache (mock broker called exactly once).
- Edge case — `serverId` undefined → resolver returns `null` without calling the broker; hook returns `{ apiKey: null, loading: false, error: null }`.
- Edge case — null result is cached; repeated calls don't hit the broker for 5 min.
- Error path — broker returns 401 once, then 200 after refresh → resolver returns the value; broker called twice.
- Error path — broker returns 401 twice → resolver returns `null`, sets an error state, emits `sync.credential.auth_failed` telemetry with `{ kind, id }`.
- Error path — broker throws network error → resolver returns `null`, does not cache the miss (so next call retries).
- Integration — cache cleared on auth `SIGNED_OUT` event; next `getAbsApiKey` after sign-out with no auth returns `null` and does not call the broker (vaultCredentials no-ops when unauthenticated).

**Verification:**
- Broker mock call count matches expected cache-hit pattern
- No unhandled-rejection warnings in test output

---

- [ ] **Unit 3: Backwards-compat credential migration**

**Goal:** One-shot post-boot migration that uploads pre-vault `apiKey` / `password` values into the vault and clears them from Dexie rows.

**Requirements:** R2 (HC-2), R7 (telemetry)

**Dependencies:** Unit 1 (schema bump — legacy rows still have the field readable), Unit 2 (shared cache invalidation on success).

**Files:**
- Create: `src/lib/credentials/migrateCredentialsToVault.ts` — the migration runner.
- Modify: `src/app/App.tsx` (or wherever the authenticated-boot hook lives — grep during implementation) — invoke the migration after auth state becomes authenticated, once per session.
- Test: `src/lib/credentials/__tests__/migrateCredentialsToVault.test.ts` — unit tests with mocked broker + Dexie.
- Test: `tests/e2e/e95-s05-credential-migration.spec.ts` — E2E seeding a legacy row (Playwright seeds Dexie via `page.evaluate`) and asserting migration completes.

**Approach:**
- On entry, check `db.kv.get('migrations.credentialsToVault.v1')`. If `'done'`, return immediately.
- If no authenticated user yet, return (the auth-state listener will re-invoke).
- `Promise.allSettled` over all legacy rows across both tables, calling `storeCredential()`. On success, raw-Dexie-update the field to `undefined` (do **not** use `syncableWrite` — we don't want to push a metadata row stamped now for a field that's being removed). Emit `sync.migration.credential_uploaded` per success.
- On failure for a row, increment in-memory counter; emit `sync.migration.credential_upload_failed`. If counter hits 3 this session, show a non-blocking toast (once per session).
- After all rows processed, if **every** row succeeded, set `db.kv.migrations.credentialsToVault.v1 = 'done'` so future boots skip. If any failed, do not mark done — retry next boot.

**Execution note:** Start with unit tests that lock down the success / partial-failure / all-failure paths against a mocked broker before writing the runner.

**Patterns to follow:**
- E95-S01 post-boot migration pattern (settings hydration runs once per sign-in)
- `db.kv.get/put` pattern used elsewhere in the codebase for migration flags (grep `kv.get(` during implementation)

**Test scenarios:**
- Happy path — single legacy ABS server → vault gets the key, Dexie row has `apiKey: undefined`, kv flag set to `'done'`.
- Happy path — mix of ABS + OPDS legacy rows migrate in one run.
- Happy path — no legacy rows (fresh install) → flag immediately set to `'done'`, broker never called.
- Edge case — unauthenticated on first call → migration defers, legacy rows still readable.
- Edge case — kv flag already `'done'` → migration returns without scanning.
- Error path — vault write fails for one row, succeeds for others → kv flag stays unset, successful rows cleared, failed row's apiKey still present.
- Error path — 3 consecutive failures for same `serverId` in one session → single toast fired (not three).
- Error path — broker returns error AND local clear would have failed → legacy field still present next boot; next boot retries and broker idempotently overwrites.
- Integration — migration runs once per session even if called multiple times (in-flight guard).

**Verification:**
- Unit tests pass
- E2E seeds legacy row, launches app, asserts post-migration state

---

- [ ] **Unit 4: Wire ABS store writes through syncableWrite; close read-path migration**

**Goal:** Route `useAudiobookshelfStore.addServer/updateServer/removeServer` through `syncableWrite`, replace every `server.apiKey` direct read with the resolver, and delete the legacy shim.

**Requirements:** R1 (HC-1 read path), R3 (HC-3 write path), R5 (grep gate)

**Dependencies:** Unit 1, Unit 2.

**Files:**
- Modify: `src/stores/useAudiobookshelfStore.ts` — replace raw `db.audiobookshelfServers.add/put/delete` with `syncableWrite('audiobookshelfServers', ...)`. Remove the "fire-and-forget" vault write pattern (now await-first); remove the `apiKey: undefined` strip (type change enforces it). On `updateServer` credential update, the flow is `storeCredential` → `syncableWrite(...metadata only...)`.
- Modify: `src/app/hooks/useAudiobookshelfSync.ts` (lines 90, 110, 141, 159) — replace `server.apiKey` reads with `await getAbsApiKey(server.id)`.
- Modify: `src/app/hooks/useAudiobookshelfProgressSync.ts` (lines 73, 77, 94, 140, 159, 172) — same.
- Modify: `src/app/hooks/useAudiobookshelfSocket.ts` (lines 113, 115, 141) — use `useAbsApiKey(server?.id)` hook; drop `server?.apiKey` from dep array, replace with `apiKey` from the hook result.
- Modify: `src/app/hooks/useAudioPlayer.ts` (line 313) — use `getAbsApiKey` (imperative context).
- Modify: `src/app/pages/CollectionDetail.tsx` (line 70) — use `useAbsApiKey` hook; map over books only once `apiKey` is loaded.
- Modify: `src/app/components/library/CollectionCard.tsx` (lines 56, 168) — `useAbsApiKey`.
- Modify: `src/app/components/library/SeriesCard.tsx` (lines 103, 162) — `useAbsApiKey`.
- Modify: `src/app/components/library/AudiobookshelfSettings.tsx` (lines 105, 191) — the form's "existing apiKey" preview should use `checkCredential()` (just "configured or not") rather than reading the value; full redesign deferred. Line 191's read is during edit-submit — use `getAbsApiKey` right before the submit.
- Test: `src/stores/__tests__/useAudiobookshelfStore.test.ts` — assert `syncableWrite` is called with a payload that contains no `apiKey`, and `storeCredential` is called before the metadata write.
- Test: `src/app/hooks/__tests__/useAudiobookshelfSync.test.ts` — assert resolver is called to get the key.

**Approach:**
- For render-time consumers (CollectionCard, SeriesCard, CollectionDetail), the hook returns `{ apiKey, loading }`. Render the cover URL conditionally: placeholder while `loading`, real URL once `apiKey` is present, broken-image fallback if resolver returned `null`.
- For imperative consumers (`useAudioPlayer`, `useAudiobookshelfProgressSync`), `await getAbsApiKey(server.id)` at the top of the handler. If `null`, bail early with the same semantics as the old `if (!server.apiKey) return` guards.
- For the socket hook, adding the resolved `apiKey` into the dep array means the socket reconnects when the credential changes. That is the correct behavior — it matches the current `server?.apiKey` dep semantics.

**Execution note:** After editing, run `git grep -nP 'server\??\.apiKey' src/ -- ':!*.test.ts' ':!*.spec.ts'` — output must be empty. This is the grep gate from AC-3.

**RLS posture (`audiobookshelf_servers`):** Row-level security is the primary authorization boundary for sync writes — the client talks directly to Postgres with an end-user JWT, so every operation relies on RLS. The four required policies are already in place from `supabase/migrations/20260423000001_server_tables_no_credentials.sql` (lines 86-113):

- `select_own_abs_servers` — `FOR SELECT TO authenticated USING (auth.uid() = user_id)`
- `insert_own_abs_servers` — `FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`
- `update_own_abs_servers` — `FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- `delete_own_abs_servers` — `FOR DELETE TO authenticated USING (auth.uid() = user_id)`

`ENABLE ROW LEVEL SECURITY` is set on the table. Before implementing this unit, verify the policies are actually present by running `\d+ public.audiobookshelf_servers` (or `SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.audiobookshelf_servers'::regclass;`). If any of the four SELECT/INSERT/UPDATE/DELETE policies is missing, or if RLS was somehow disabled, **stop and add a migration to fill the gap before wiring sync**. Never ship a sync path against a table that does not have RLS on all four operations — a missing policy means any authenticated user could read or mutate another user's server config. Per-user data isolation is non-negotiable for this table because server URLs and library IDs are themselves sensitive (they can disclose private infrastructure), and the vault-credentials broker assumes the `audiobookshelf_servers` row existing means the calling user owns it.

**Patterns to follow:**
- `src/stores/useBookmarkStore.ts` or similar E92-S09 store for the `syncableWrite` call shape
- `src/lib/vaultCredentials.ts` for await-first credential writes

**Test scenarios:**
- Happy path — `addServer({ apiKey: 'K1' })` → `storeCredential` called with `'K1'`, then `syncableWrite('put', ...)` called with a record where no `apiKey` exists anywhere in the payload.
- Happy path — `updateServer(id, { apiKey: 'K2' })` → `storeCredential` called with new value, `syncableWrite` enqueued with only the non-credential fields changed.
- Happy path — `updateServer(id, { name: 'Home' })` (no credential change) → `storeCredential` **not** called, `syncableWrite` enqueued.
- Error path — `storeCredential` rejects on `addServer` → no Dexie write happens, no queue entry, toast surfaces error, Zustand state unchanged.
- Error path — `syncableWrite` rejects after successful `storeCredential` → vault entry is orphaned (logged as `sync.vault.potential_orphan`), toast surfaces error.
- Integration — render `SeriesCard` with a server that has a vault credential; cover URL appears after the hook resolves; no network call to vault broker after the first cover renders (cache hit).
- Integration — socket hook reconnects when resolver cache returns a new apiKey (e.g. after an `updateServer` credential change).
- Grep assertion — run the CI grep after Unit 4 is complete; expected: zero hits.

**Verification:**
- Store-level unit tests pass
- Grep gate returns zero hits

---

- [ ] **Unit 5: Wire OPDS store writes through syncableWrite; close OPDS read-path**

**Goal:** Mirror Unit 4 for OPDS. Route `useOpdsCatalogStore.addCatalog/updateCatalog/removeCatalog` through `syncableWrite`. Replace every `catalog.auth.password` direct read with `getOpdsPassword` / `useOpdsPassword`.

**Requirements:** R1, R3, R5

**Dependencies:** Unit 1, Unit 2.

**Files:**
- Modify: `src/stores/useOpdsCatalogStore.ts` — `storeCredential` is already awaited (see lines 46-49, 65-69) per prior E95-S02 work, but the subsequent Dexie writes are raw `db.opdsCatalogs.put/update/delete` — swap those for `syncableWrite`. Remove the runtime strip.
- Modify: `src/services/OpdsService.ts` — any `catalog.auth.password` reads (grep during implementation) → `getOpdsPassword`.
- Modify: `src/app/components/library/OpdsBrowser.tsx` — render-time; use `useOpdsPassword` hook for basic-auth headers.
- Modify: `src/app/components/library/OpdsCatalogSettings.tsx`, `src/app/components/library/CatalogForm.tsx` — use `checkCredential` for the "configured?" UI state; read via `getOpdsPassword` at submit time if needed.
- Test: `src/stores/__tests__/useOpdsCatalogStore.test.ts`
- Test: extend `src/services/__tests__/OpdsService.test.ts` for the resolver path

**Approach:**
- Same shape as Unit 4 — vault-first, metadata-second, resolver for reads.
- `OpdsBrowser` constructs `Authorization: Basic base64(user:password)` headers. Hook provides password; component builds the header once the value is loaded.
- **Nested `auth` flattening (see Unit 6 pre-resolved fieldMap analysis):** Dexie stores `OpdsCatalog.auth` as a nested object `{ username }` (password is now vault-only), but Supabase has a flat `auth_username` column. Before calling `syncableWrite`, project `catalog.auth?.username` to a top-level `authUsername` field on the write payload and omit the nested `auth` object. The default `toSnakeCase` then produces `auth_username`. On download, add a small remap step (in the download applicator or a post-download hook for `opdsCatalogs`) that re-nests `auth_username` back to `auth: { username }` so Dexie rows match the TypeScript `OpdsCatalog` shape. Apply this consistently across `addCatalog`, `updateCatalog`, and hydration.

**RLS posture (`opds_catalogs`):** Same model as ABS — RLS is the authorization boundary. The four required policies are already in place from `supabase/migrations/20260423000001_server_tables_no_credentials.sql` (lines 36-63):

- `select_own_opds_catalogs` — `FOR SELECT TO authenticated USING (auth.uid() = user_id)`
- `insert_own_opds_catalogs` — `FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`
- `update_own_opds_catalogs` — `FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- `delete_own_opds_catalogs` — `FOR DELETE TO authenticated USING (auth.uid() = user_id)`

`ENABLE ROW LEVEL SECURITY` is set on the table. Verify policies are present before wiring sync (`SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.opds_catalogs'::regclass;`). If any of the four operations is missing a policy, **stop and add a migration to fill the gap before proceeding** — never ship a sync path against a table that does not have RLS on all four operations. This is especially important for OPDS because the stored `auth_username` column is personally identifying and must not leak across users.

**Patterns to follow:**
- Unit 4's store refactor
- Existing `src/services/OpdsService.ts` patterns

**Test scenarios:**
- Happy path — `addCatalog({ auth: { username, password } })` → `storeCredential('opds-catalog', ...)` awaited, then `syncableWrite` called with `auth` lacking `password`.
- Happy path — fetch feed with stored password → `getOpdsPassword` called, basic-auth header built, fetch succeeds.
- Error path — no password in vault (anonymous OPDS feed) → fetch proceeds without auth header.
- Edge case — catalog without `auth` (public feed) → `storeCredential` never called, `syncableWrite` enqueues as expected.
- Grep assertion — zero hits for `catalog\.auth\.password` / `auth\?\.password` in `src/` (excluding tests) after this unit.

**Verification:**
- Store unit tests pass
- Grep gate returns zero hits for OPDS

---

- [ ] **Unit 6: tableRegistry fieldMap resolution + stripFields defense-in-depth tests**

**Goal:** Apply the pre-resolved `fieldMap` changes identified during planning, and add defense-in-depth tests proving both tables' `tableRegistry` entries strip credentials even if a caller bypasses the type system.

**Requirements:** R3 (HC-3 registry audit), R6 (AC-5 strip assertion)

**Dependencies:** Unit 4, Unit 5 (wiring complete — tests assert on the final write payload shape).

**Pre-resolved fieldMap analysis (done during planning, 2026-04-19):**

Inspected `src/lib/sync/tableRegistry.ts:517-537` and cross-checked against `supabase/migrations/20260423000001_server_tables_no_credentials.sql`:

**`audiobookshelfServers`** — Supabase columns: `id, user_id, name, url, library_ids, status, last_synced_at, created_at, updated_at`. Assuming Dexie field names `id, userId, name, url, libraryIds, status, lastSyncedAt, createdAt, updatedAt` (confirm during implementation by reading `src/data/types.ts` `AudiobookshelfServer` interface), every field converts correctly under the default `toSnakeCase` rule (`libraryIds` → `library_ids`, `lastSyncedAt` → `last_synced_at`, etc.). **Verified not needed — `fieldMap` stays `{}`.** If Unit 1's type inspection reveals any field name that does NOT follow straight camelCase (e.g., an acronym-heavy field like `APIKey` instead of `apiKey`), add an explicit `fieldMap` entry then. Otherwise no change.

**`opdsCatalogs`** — Supabase columns: `id, user_id, name, url, auth_username, last_synced, created_at, updated_at`. Dexie `OpdsCatalog` stores `auth` as a **nested object** `{ username, password }` (confirmed in `src/stores/useOpdsCatalogStore.ts:47-72`). The default `toSnakeCase` does NOT flatten nested objects into parent-prefixed columns, so `auth.username` will not map to `auth_username` automatically. **`fieldMap` needs explicit handling for two points:**

1. `lastSynced` (Dexie) ↔ `last_synced` (Supabase) — default camelCase conversion produces `last_synced` correctly, so no override needed. **Verified not needed for this field.**
2. Nested `auth.username` ↔ flat `auth_username` column — `fieldMap` alone cannot solve this (fieldMap is a shallow key rename, not a flattener). Resolution: flatten at the store layer. In Unit 5, when building the `syncableWrite` payload, project `catalog.auth?.username` onto a top-level `authUsername` field and omit the nested `auth` object entirely from the write payload. Then add `fieldMap: { authUsername: 'auth_username' }` — actually this is also unnecessary because `authUsername` → `auth_username` via default camelCase. So the concrete change is: **Unit 5 flattens `auth.username` → `authUsername` at write time; `fieldMap` stays `{}`**. On download, the reverse hook re-nests `auth_username` back into `auth: { username }` for Dexie compatibility — add this in a lightweight `_remapDownload` step in Unit 5 or co-locate with the download applicator. This applies to both create and update paths. This resolves the one real camelCase↔snake_case complication.

**Concrete fieldMap edits to apply in this unit:**
- `audiobookshelfServers.fieldMap` — no change (stays `{}`). Verified not needed.
- `opdsCatalogs.fieldMap` — no change (stays `{}`). The structural `auth.username` ↔ `auth_username` mismatch is resolved in Unit 5's write/read flatten/unflatten logic, not via `fieldMap`. This unit's job is only to verify the test assertions still pass with the resolved shape.

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts` — **no field changes expected** per pre-resolution above. If Unit 1's type read surfaces a camelCase field that breaks the default rule, add the override here then.
- Test: `src/lib/sync/__tests__/tableRegistry-e95-s05.test.ts` — assert `toSnakeCase` output for a crafted record with `apiKey: 'LEAK'` / `password: 'LEAK'` drops those fields; assert `library_ids` and `last_synced_at` columns come through correctly.
- Test: `src/lib/sync/__tests__/syncableWrite-vault-fields.test.ts` — assert that calling `syncableWrite('audiobookshelfServers', 'put', { id, apiKey: 'LEAK', ... })` enqueues a payload with no `apiKey` key at any nesting depth.
- Test (Unit 5 cross-reference): the OPDS store test from Unit 5 must assert that the enqueued payload contains top-level `authUsername` (or `auth_username` post-snake-case) and does NOT contain a nested `auth` object.

**Approach:**
- The tests are defense-in-depth — after Unit 1 types should make `apiKey` in the record impossible, but a cast-around or direct call from untyped code could still slip it in.
- If the implementer discovers a new camelCase↔snake_case mismatch not anticipated here (e.g., a field added post-planning), add the `fieldMap` entry inline and document the addition in the PR description.

**Patterns to follow:**
- Existing `tableRegistry.test.ts` patterns
- `toSnakeCase` behavior (already implemented in `src/lib/sync/fieldMapper.ts`)

**Test scenarios:**
- Happy path — record with only non-credential fields → `toSnakeCase` output has all fields with correct casing.
- Edge case — record crafted with `apiKey: 'LEAK'` cast through `unknown` → `toSnakeCase` output has no `api_key` or `apiKey` key.
- Edge case — same for `password` on OPDS.
- Integration — `syncableWrite` called with leaking record → queue entry payload passes recursive scan for "LEAK" string returns zero hits.

**Verification:**
- Grep on queue payload JSON proves no credential leak even with malicious callers

---

- [ ] **Unit 7: Hydration + telemetry E2E + grep gate**

**Goal:** Prove the full pipeline end-to-end: sign in on a fresh device, both tables hydrate, ABS sync works without re-entering credentials. Add telemetry events. Add the CI grep gate as a script.

**Requirements:** R4 (AC-1, AC-2), R7 (telemetry), R5 (grep gate in CI)

**Dependencies:** Units 1-6 complete.

**Files:**
- Create: `tests/e2e/e95-s05-server-hydration.spec.ts` — seed Supabase with one `audiobookshelf_servers` row + a vault credential (via broker), launch fresh browser context, sign in, assert Settings > Library shows the server within one sync cycle, click "Sync now", assert library fetch succeeds.
- Create: `tests/e2e/e95-s05-offline-edit.spec.ts` — AC-6 offline rename.
- Modify (or create): `scripts/grep-gate-credentials.sh` — runs the grep assertion, returns non-zero on hits.
- Modify: `.github/workflows/ci.yml` (or the equivalent pre-review pipeline) — invoke the grep-gate script.
- Add telemetry emitter calls: modify the migration runner (Unit 3), the resolver (Unit 2), and the hydration path (Unit 7) to emit the 3 telemetry events from AC-7 (`sync.server_config.hydrated`, `sync.migration.credential_uploaded`, `sync.migration.credential_upload_failed`).

**Approach:**
- Use existing `tests/e2e/` patterns — `playwright.config.ts` and the sign-in fixture.
- Seed Supabase row directly via the Supabase JS admin client in a Playwright fixture (same approach as earlier E95 sync tests).
- Grep gate script is a 3-line bash — if `git grep -nP ...` has output, print and exit 1.

**Patterns to follow:**
- `tests/e2e/e95-s01-*.spec.ts` or similar recent sync-hydration E2E
- Existing CI workflow for pre-checks (see `.claude/rules/workflows/story-workflow.md` quality gates)

**Test scenarios:**
- Happy path (E2E) — sign in → within 3s one `audiobookshelf_servers` row hydrates → click Sync → books appear.
- Happy path (E2E) — sign in → rename server offline → reconnect → rename visible in Supabase → vault broker called zero times during the edit cycle.
- Error path (E2E) — sign in with no Supabase data → no errors, no toasts.
- Grep gate — run the bash script; passes on clean branch, fails if probe file reading `server.apiKey` is introduced.

**Verification:**
- E2E specs pass in Chromium
- CI grep gate active and failing on regression

## System-Wide Impact

- **Interaction graph:** resolver is called by 9 files / ~25 sites. Any component that previously rendered based on `server.apiKey` is now async. The hook-based sites re-render once when the resolver resolves.
- **Error propagation:** vault-broker failures are silent in the resolver (return `null`) but loud in the write path (toast + no row written). Migration failures are silent (telemetry only) until the 3rd session-consecutive failure, then non-blocking toast.
- **State lifecycle risks:** orphaned vault entries if metadata write fails after vault write succeeds. Logged but not swept in this story; documented as a known issue for follow-up reconciler.
- **API surface parity:** OPDS and ABS get parallel resolver + hook. Both stores route through `syncableWrite`. No drift.
- **Integration coverage:** E2E covers sign-in hydration, ABS sync post-hydration, offline edit. Unit coverage covers migration (success, partial failure, retry, idempotency), resolver (cache, 401, sign-out invalidation), and strip defense-in-depth.
- **Unchanged invariants:** vault-credentials broker API surface (4 routes — `store`, `check`, `read`, `delete`) is unchanged. `syncableWrite` signature is unchanged. `tableRegistry` entries for other tables are unchanged. Credential encryption at rest (Supabase Vault) is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Pre-vault users lose their apiKey if vault upload fails silently three times across app restarts | Non-blocking toast on 3rd failure in a session; legacy field stays readable until migration succeeds (the E95-S02 shim keeps working until the clear step); telemetry gives us observability on rollout failure rate |
| Resolver latency breaks rendering when user scrolls through a grid of cover images | Hook caches per `serverId`; first cover-render triggers one broker call; all subsequent covers on the same server reuse the cached value in the same session |
| Orphaned vault entries from write-partial failures accumulate over time | Logged via `sync.vault.potential_orphan` telemetry; reconciler deferred to a follow-up story; orphans are harmless (no lookup path) |
| 401 from broker during socket reconnect causes reconnect loop | Resolver retries once on 401 then gives up; socket hook treats `null` apiKey as "don't connect" (same semantics as pre-migration `if (!server?.apiKey) return`) |
| Unit 1 type change produces many TS errors; merging partial work would break the main branch | All units ship in one PR; `tsc --noEmit` pre-check gate catches any local regression before merge |
| Dexie upgrade on a user with a massive legacy server list times out migration | Unlikely — users have ≤ ~5 servers. But migration uses `Promise.allSettled` so slow rows don't block each other, and partial-success is acceptable (re-runs next boot) |

## Documentation / Operational Notes

- Update `docs/known-issues.yaml` to mark `KI-E95-S02-L01` as `fixed-in: E95-S05`.
- Update `docs/implementation-artifacts/sprint-status.yaml` — E95-S05 moves to `in-progress` when Unit 1 lands.
- Telemetry dashboards should add three new event names (`sync.server_config.hydrated`, `sync.migration.credential_uploaded`, `sync.migration.credential_upload_failed`, `sync.credential.auth_failed`, `sync.vault.potential_orphan`). Grafana/LogRocket wiring is existing infrastructure.
- Rollout monitoring: watch `sync.migration.credential_upload_failed` rate in the first 7 days post-merge. If > 1% of unique users, triage.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e95-s05-opds-abs-server-sync-requirements.md](../brainstorms/2026-04-19-e95-s05-opds-abs-server-sync-requirements.md)
- Vault broker: `supabase/functions/vault-credentials/index.ts`, `src/lib/vaultCredentials.ts`
- Server tables migration: `supabase/migrations/20260423000001_server_tables_no_credentials.sql`
- Sync engine: `src/lib/sync/tableRegistry.ts`, `src/lib/sync/syncableWrite.ts`, `src/lib/sync/fieldMapper.ts`
- Dexie schema: `src/db/schema.ts` (version ladder around lines 1357-1519)
- Type definitions: `src/data/types.ts:874-902`
- Known issue: `docs/known-issues.yaml` → `KI-E95-S02-L01`
- Prior plans (patterns to mirror): `docs/plans/2026-04-19-010-feat-e95-s01-full-settings-sync-expansion-plan.md`, `docs/plans/2026-04-19-011-feat-e95-s02-vault-credentials-plan.md`
