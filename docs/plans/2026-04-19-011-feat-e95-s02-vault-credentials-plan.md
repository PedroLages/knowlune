---
title: "feat: API keys and all credentials via Supabase Vault"
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e95-s02-api-keys-and-all-credentials-via-supabase-vault-requirements.md
---

# feat: API Keys and All Credentials via Supabase Vault

## Overview

Moves three classes of sensitive credentials — AI provider API keys, OPDS catalog passwords, and Audiobookshelf API keys — from client-side storage into Supabase Vault (pgsodium-encrypted). A new Edge Function `vault-credentials` acts as the server-side broker: clients send their JWT and the Edge Function performs Vault reads/writes using service-role credentials. Raw secrets never appear in Postgres public tables, the Dexie sync queue, or browser localStorage after migration.

This is a **security-posture upgrade** that makes credentials available cross-device. The implementation follows a replace (not dual-write) pattern: once stored in Vault, the credential is removed from localStorage / Dexie.

## Problem Frame

With cross-device sync live (E92–E94), credentials must be retrievable on new devices. The naive path — syncing through the Dexie/Supabase sync engine — puts raw secrets in unencrypted Postgres rows. Supabase Vault (already extension-enabled) is the correct store.

Three migration scopes:
1. **AI provider keys**: currently AES-GCM encrypted in `localStorage['ai-configuration']` via `src/lib/crypto.ts`
2. **OPDS passwords**: plaintext in Dexie `opdsCatalogs` (acknowledged TODO in `src/data/types.ts`)
3. **ABS API keys**: plaintext in Dexie `audiobookshelfServers` (acknowledged TODO)

(see origin: `docs/brainstorms/2026-04-19-e95-s02-api-keys-and-all-credentials-via-supabase-vault-requirements.md`)

## Requirements Trace

- R1–R6: Edge Function with four routes, JWT auth, service-role Vault access
- R7–R10: `vaultCredentials.ts` client module — no-op when unauthenticated, non-throwing errors
- R11–R14: AI provider key migration — save to Vault, strip from localStorage, one-time legacy migration
- R15–R18: OPDS catalog credential wiring — strip password before Dexie write, Vault cleanup on delete
- R19–R20, R22: ABS server credential wiring — strip apiKey before Dexie write, Vault cleanup on delete
- R21: **Deferred** — `AudiobookshelfService.ts` read-path migration (20+ call sites); tracked as KI-E95-S02-L01
- R23: Supabase migrations for `opds_catalogs` and `audiobookshelf_servers` tables (no credential columns)

## Scope Boundaries

- Server connection metadata (URL, name, libraryIds) synced in E95-S05, not here
- UI forms for credential input are unchanged; only save/read paths change
- Offline fallback when Vault unreachable is deferred — `readCredential` returning null causes toast + failed API call
- Audit logging for `read-credential` is deferred (future security hardening)
- **`server.apiKey` read-path migration is scoped**: the 20+ call sites in `useAudiobookshelfSocket.ts`, `useAudiobookshelfProgressSync.ts`, `useAudiobookshelfSync.ts`, cover/stream URL helpers, and page-level components are deferred to a follow-up task. **This story covers only the write path** (strip on add/update, delete on remove, plus the in-store API calls already made within `useAudiobookshelfStore.ts`'s own `loadSeries`/`loadCollections` methods). The broader reactive hook migration requires a coordinated refactor across hooks that is out of scope here.

### Deferred to Separate Tasks

- Full `server.apiKey` read-path migration (hooks, components, pages): tracked as known issue KI-E95-S02-L01
- In-memory `readCredential` TTL cache for high-frequency API calls (optimization)

## Context & Research

### Relevant Code and Patterns

- `supabase/functions/stripe-webhook/index.ts` — Edge Function pattern: fail-fast env var guards at top, `createClient` from `https://esm.sh/@supabase/supabase-js@2`, service-role client, extract JWT from `Authorization` header via `supabaseAdmin.auth.getUser(token)`
- `src/lib/checkout.ts` — `supabase.functions.invoke(name, { body, headers })` client invocation pattern
- `supabase/migrations/20260422000001_user_settings.sql` — migration pattern with `BEGIN/COMMIT`, `SECURITY DEFINER` RPC, `REVOKE/GRANT`, rollback companion file
- `src/lib/settings.ts` (E95-S01) — `saveSettingsToSupabase()` pattern: `getUser()` → early-return if no user → call Supabase → swallow errors with `console.warn`
- `src/lib/aiConfiguration.ts` — current AI key storage: `encryptData`/`decryptData` from `src/lib/crypto.ts` (AES-GCM, key stored in IndexedDB via `src/lib/cryptoKeyStore.ts`, device-specific)
- `src/lib/crypto.ts` — `getSessionKey()` loads from IndexedDB or generates; key is device-specific and non-extractable → **migration implication**: the Web Crypto key is device-local. The legacy migration can only run on the originating device (decrypt + store to Vault). On a new device with no localStorage, there is no legacy key to migrate — the user must re-enter credentials once.

### Call-Site Analysis (Resolved During Planning)

**`getConfiguredProviderIds()` — 3 call sites, 2 require `useState`/`useEffect` wrapping:**
- `src/app/components/figma/FeatureModelOverridePanel.tsx` line 104 — already inside a `useEffect` with `setState`; adding `await` is safe
- `src/app/components/settings/WhisperSettings.tsx` line 93 — **render-time call**, must convert to `useState`/`useEffect` pattern
- `src/app/components/figma/AIConfigurationSettings.tsx` line 443 — **render-time call** (`const hasAnyProviderKey = getConfiguredProviderIds().length > 0`), must convert to `useState`/`useEffect` pattern

**`server.apiKey` — 20+ call sites**: Scoped to write path only in this story (see Scope Boundaries). The 4 in-store calls within `useAudiobookshelfStore.ts` itself (`loadSeries`, `loadCollections`) are NOT migrated here either — those read from the in-memory Zustand state which reflects the Dexie row. Once the Dexie row no longer contains `apiKey`, these calls will receive `undefined`. Plan addresses this with a typed guard in Unit 5.

### Vault Upsert Strategy (Resolved During Planning)

Supabase Vault has no native upsert. The idempotent pattern:
1. `SELECT id FROM vault.secrets WHERE name = $key` via service-role client
2. If row exists: `SELECT vault.update_secret(id, secret)`
3. If not: `SELECT vault.create_secret(secret, name, description)`

This is safe from race conditions because secrets are user-scoped by key name and concurrent `store-credential` calls for the same key are unlikely. The Edge Function executes both steps in a single request.

### Institutional Learnings

- E95-S01 pattern: `hydrateSettingsFromSupabase()` is the correct auth init hook for one-time migrations (already async, called with `await` in `useAuthLifecycle.ts`)
- E92 sync pattern: `vaultFields` are explicitly NOT included in sync queue payloads — `audiobookshelfServers` and `opdsCatalogs` Dexie writes must not contain credential fields so the sync engine never sees them

## Key Technical Decisions

- **Edge Function over Postgres RPC**: `vault.decrypted_secrets` requires service-role access; the Edge Function bridges auth boundary
- **Key naming `{userId}:{credentialType}:{credentialId}`**: user scoping without additional RLS; Edge Function enforces prefix match
- **`check-credential` never returns secret**: UI status checks use this endpoint; only `read-credential` returns the plaintext
- **Replace pattern**: credential removed from localStorage/Dexie after Vault store succeeds
- **On-demand credential reads**: `readCredential()` at point-of-API-call only; no eager loading on sign-in
- **Device-local Web Crypto key → migration is opportunistic**: AI key legacy migration only runs if old encrypted data exists in localStorage on the current device. New devices start fresh (no legacy data). Users adding credentials on a new device go through the normal save flow.
- **`server.apiKey` read-path scoped to write path only**: avoids a disruptive refactor of reactive hooks across the full codebase; full read-path migration tracked separately

## Open Questions

### Resolved During Planning

- **Vault upsert idiom**: query-then-upsert (select id by name → update if found, create if not). See Context above.
- **Legacy AI key migration decryptability**: Web Crypto key is device-specific (IndexedDB). Migration is opportunistic — runs on the originating device only; no cross-device migration of the encrypted blob.
- **`server.apiKey` read-path scope**: Limited to write path in this story. The 20+ component/hook call sites require a separate coordinated refactor.
- **`getConfiguredProviderIds()` call sites**: 3 total. 2 are render-time synchronous reads that need `useState`/`useEffect` conversion. 1 is already inside `useEffect`.

### Deferred to Implementation

- Exact TypeScript generic signature for `supabase.functions.invoke` with custom response types — follow `checkout.ts` pattern
- Whether to use `supabaseAdmin.rpc('vault_create_secret', ...)` vs raw `.from('vault.secrets').select(...)` — confirm what the `@supabase/supabase-js@2` Deno client exposes for Vault schema access

## Output Structure

```
supabase/
  functions/
    vault-credentials/
      index.ts             (new Edge Function)
  migrations/
    20260423000001_server_tables_no_credentials.sql  (new)
    rollback/
      20260423000001_server_tables_no_credentials_rollback.sql  (new)
src/
  lib/
    vaultCredentials.ts    (new client module)
    aiConfiguration.ts     (modified — async key migration)
    settings.ts            (modified — legacy migration hook)
    __tests__/
      vaultCredentials.test.ts  (new)
  stores/
    useOpdsCatalogStore.ts      (modified — vault write wiring)
    useAudiobookshelfStore.ts   (modified — vault write wiring + apiKey type guard)
    __tests__/
      useOpdsCatalogStore.test.ts   (modified or new vault section)
      useAudiobookshelfStore.test.ts (modified or new vault section)
  services/
    OpdsService.ts              (modified — OPDS read-path: readCredential at auth call sites)
    BookContentService.ts       (modified — OPDS read-path: readCredential for source.auth.password)
  app/
    components/
      library/
        OpdsBrowser.tsx           (modified — OPDS read-path: readCredential at auth call site)
      settings/
        WhisperSettings.tsx         (modified — async getConfiguredProviderIds)
      figma/
        AIConfigurationSettings.tsx (modified — async getConfiguredProviderIds)
        FeatureModelOverridePanel.tsx (modified — await in useEffect)
  data/
    types.ts               (modified — apiKey?, auth.password? optional)
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
Browser                         Edge Function (Deno)           Supabase
   |                                    |                           |
   |-- POST /vault/store-credential --> |                           |
   |   { credentialType, credentialId, |                           |
   |     secret } + JWT                |                           |
   |                                   |-- getUser(token) -------> |
   |                                   |<-- { user } ------------- |
   |                                   |-- SELECT vault.secrets --> |
   |                                   |   WHERE name = key        |
   |                                   |<-- id or null ----------- |
   |                                   |-- UPDATE or CREATE ------> |
   |                                   |   vault.secrets           |
   |<-- { configured: true } --------- |                           |
   |                                   |                           |
   |-- GET /vault/check-credential --> |                           |
   |                                   |-- SELECT vault.secrets --> |
   |<-- { configured: boolean } ------ |<-- exists? -------------- |
   |                                   |                           |
   |-- GET /vault/read-credential ---> |                           |
   |   (at point-of-API-call only)     |-- SELECT                  |
   |                                   |   vault.decrypted_secrets |
   |<-- { secret: "sk-..." } --------- |<-- plaintext ------------ |
   |   (never persisted)               |                           |
```

Client module flow for store mutations:
```
addCatalog(catalog):
  if catalog.auth.password:
    await storeCredential('opds-catalog', catalog.id, password)
    store catalog WITHOUT password field → Dexie + future Supabase table

removeCatalog(id):
  await db.opdsCatalogs.delete(id)
  void deleteCredential('opds-catalog', id)  // fire-and-forget
```

## Implementation Units

- [ ] **Unit 1: Supabase migration — server tables without credential columns**

**Goal:** Create `opds_catalogs` and `audiobookshelf_servers` tables in Postgres with RLS, explicitly excluding `password` and `api_key` columns.

**Requirements:** R23

**Dependencies:** None (no prior Postgres tables for these entities exist in migrations)

**Files:**
- Create: `supabase/migrations/20260423000001_server_tables_no_credentials.sql`
- Create: `supabase/migrations/rollback/20260423000001_server_tables_no_credentials_rollback.sql`

**Approach:**
- Follow the pattern from `supabase/migrations/20260422000001_user_settings.sql`: `BEGIN/COMMIT`, `IF NOT EXISTS`, comment block at top explaining the design decision
- `opds_catalogs`: `id UUID PK`, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `url TEXT NOT NULL`, `auth_username TEXT` (username only — NOT password), `last_synced TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `audiobookshelf_servers`: `id UUID PK`, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `url TEXT NOT NULL`, `library_ids JSONB NOT NULL DEFAULT '[]'`, `status TEXT NOT NULL DEFAULT 'offline'`, `last_synced_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- RLS on both: enable + policies for SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`
- Add header comment: "No password or api_key columns — credentials live in Supabase Vault (E95-S02)"
- Rollback drops both tables and their policies in reverse order

**Patterns to follow:**
- `supabase/migrations/20260422000001_user_settings.sql` (RLS pattern)
- `supabase/migrations/rollback/20260422000001_user_settings_rollback.sql` (rollback companion)

**Test scenarios:**
- Test expectation: none — DDL migration; behavior verified by the integration tests in Unit 3 and Unit 4

**Verification:**
- Migration runs without error; `opds_catalogs` and `audiobookshelf_servers` tables exist in the Postgres `public` schema
- `\d public.opds_catalogs` shows no `password` column; `\d public.audiobookshelf_servers` shows no `api_key` column
- RLS enabled on both tables

---

- [ ] **Unit 2: Edge Function `vault-credentials`**

**Goal:** Supabase Edge Function that brokers Vault reads/writes using service-role credentials, authenticated via caller JWT.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** Unit 1 (migration sets up Supabase project context, but Edge Function itself has no table dependency)

**Files:**
- Create: `supabase/functions/vault-credentials/index.ts`

**Approach:**
- Follow `supabase/functions/stripe-webhook/index.ts` for structure: top-level env var validation with fail-fast throws, `createClient` from `https://esm.sh/@supabase/supabase-js@2`, single default export `Deno.serve(async (req) => { ... })`
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (both required, fail-fast)
- Extract JWT from `Authorization: Bearer <token>` header; call `supabaseAdmin.auth.getUser(token)` to resolve userId
- 401 if no valid JWT or user not found
- Parse `credentialType` from body (POST) or URL params (GET/DELETE); 400 if not one of `ai-provider | opds-catalog | abs-server`
- Key: `${userId}:${credentialType}:${credentialId}`
- **Route: POST /vault/store-credential**: query `vault.secrets` by name → if found, call `vault.update_secret(id, secret)` → else call `vault.create_secret(secret, name, description)`; return `{ configured: true }`
- **Route: GET /vault/check-credential**: query `vault.secrets WHERE name = key`; return `{ configured: !!row }`
- **Route: GET /vault/read-credential**: query `vault.decrypted_secrets WHERE name = key`; return `{ secret: row.decrypted_secret }` or 404 if not found
- **Route: DELETE /vault/delete-credential**: `DELETE FROM vault.secrets WHERE name = key`; return `{ deleted: true }`
- All responses: `Content-Type: application/json`, explicit status codes (200, 400, 401, 404)
- **CORS**: Handle `OPTIONS` preflight requests by returning 200 with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: authorization, content-type`, `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`. This is required because `vault-credentials` is called directly from the browser (unlike `stripe-webhook` which is server-to-server). Follow `create-checkout/index.ts` CORS pattern if present.
- Route dispatch via `req.method` + URL pathname (same pattern as `create-checkout`)
- Vault SQL access via `supabaseAdmin.rpc()` or `supabaseAdmin.from('vault.secrets').select(...)` — whichever the Deno client exposes for vault schema; verify during implementation

**Patterns to follow:**
- `supabase/functions/stripe-webhook/index.ts` (structure, env guards, service-role client)
- `supabase/functions/create-checkout/index.ts` (route pattern if it shows method dispatch)

**Test scenarios:**
- Test expectation: none for unit tests — Edge Function runs in Deno runtime; mock-based unit tests provide limited value. Behavior verified via `vaultCredentials.ts` integration in Unit 3.

**Verification:**
- `supabase functions serve vault-credentials` starts without error
- `POST` with valid JWT + valid `credentialType` returns `{ configured: true }`
- `GET /check-credential` returns `{ configured: false }` before store, `{ configured: true }` after
- Request without `Authorization` header returns 401
- Request with `credentialType: 'invalid'` returns 400

---

- [ ] **Unit 3: Client module `vaultCredentials.ts`**

**Goal:** Typed async wrapper module for the four Edge Function routes. Provides the `storeCredential`, `checkCredential`, `readCredential`, `deleteCredential` interface used by all store and library consumers.

**Requirements:** R7, R8, R9, R10

**Dependencies:** Unit 2 (Edge Function must be deployed; client calls it via `supabase.functions.invoke`)

**Files:**
- Create: `src/lib/vaultCredentials.ts`
- Create: `src/lib/__tests__/vaultCredentials.test.ts`

**Approach:**
- Export `CredentialType = 'ai-provider' | 'opds-catalog' | 'abs-server'` type
- All four functions check `supabase.auth.getUser()` first; if `!user`, resolve immediately (no-op) — matches E95-S01 `saveSettingsToSupabase` pattern
- `storeCredential(type, id, secret)`: `supabase.functions.invoke('vault-credentials', { method: 'POST', body: { credentialType: type, credentialId: id, secret } })` — on error: `console.warn` + return (non-throwing)
- `checkCredential(type, id)`: invoke with `GET` + query params — return boolean; on error return `false`
- `readCredential(type, id)`: invoke with `GET` + query params on `read-credential` route — return `string | null`; on error return `null`
- `deleteCredential(type, id)`: invoke with `DELETE` — on error: `console.warn` + return (non-throwing)
- Follow invocation pattern from `src/lib/checkout.ts` for `supabase.functions.invoke` usage

**Patterns to follow:**
- `src/lib/checkout.ts` (functions.invoke pattern)
- `src/lib/settings.ts` `saveSettingsToSupabase` (anonymous no-op guard, non-throwing error handling)

**Test scenarios:**
- Happy path: `storeCredential('ai-provider', 'openai', 'sk-abc')` → `supabase.functions.invoke` called with correct arguments
- Happy path: `checkCredential('abs-server', 'server-uuid')` → returns `true` when invoke returns `{ configured: true }`
- Happy path: `readCredential('opds-catalog', 'catalog-uuid')` → returns secret string
- Happy path: `deleteCredential('ai-provider', 'openai')` → invoke called with DELETE method
- Edge case: `storeCredential` when `supabase.auth.getUser()` returns `{ user: null }` → resolves immediately, invoke NOT called
- Edge case: `checkCredential` when `supabase.auth.getUser()` returns no user → returns `false` without calling invoke
- Error path: `checkCredential` when invoke throws/returns error → returns `false` (non-throwing)
- Error path: `readCredential` when invoke returns non-200 → returns `null` (non-throwing)
- Error path: `deleteCredential` failure → `console.warn` called, no throw

**Verification:**
- All tests pass; `checkCredential` + `readCredential` never throw in error paths; `storeCredential`/`deleteCredential` are no-ops for unauthenticated user

---

- [ ] **Unit 4: AI provider key migration (`aiConfiguration.ts` + `hydrateSettingsFromSupabase`)**

**Goal:** Save new AI keys to Vault (remove from localStorage). Run one-time legacy migration for existing Web Crypto-encrypted keys on the originating device.

**Requirements:** R11, R12, R13, R14

**Dependencies:** Unit 3 (`vaultCredentials.ts` available)

**Files:**
- Modify: `src/lib/aiConfiguration.ts`
- Modify: `src/lib/settings.ts` (legacy migration hook in `hydrateSettingsFromSupabase`)
- Modify: `src/app/components/settings/WhisperSettings.tsx` (async `getConfiguredProviderIds`)
- Modify: `src/app/components/figma/AIConfigurationSettings.tsx` (async `getConfiguredProviderIds`)
- Modify: `src/app/components/figma/FeatureModelOverridePanel.tsx` (async `getConfiguredProviderIds`)
- Modify: `src/lib/__tests__/settings.test.ts` (extend with migration tests)

**Approach:**

**`saveApiKey(providerId, key)` in `aiConfiguration.ts`:**
- Call `storeCredential('ai-provider', providerId, key)` (fire-and-forget with logged error)
- Remove `apiKeys[providerId]` from the localStorage `ai-configuration` blob (retain feature consent, selected model)
- Keep `encryptData` / `decryptData` imports only for the one-time legacy migration path

**`getConfiguredProviderIds()` → async:**
- Becomes `async function getConfiguredProviderIds(): Promise<AIProviderId[]>`
- Calls `checkCredential('ai-provider', providerId)` for each known provider; returns filtered array
- Uses `Promise.allSettled` (not `Promise.any` — ES2020 constraint)

**Call-site conversions (3 sites):**
- `WhisperSettings.tsx` line 93: extract to `useEffect(() => { getConfiguredProviderIds().then(setProviders) }, [])` with `useState<AIProviderId[]>([])`
- `AIConfigurationSettings.tsx` line 443: extract `hasAnyProviderKey` to `useState<boolean>(false)` + `useEffect` calling `getConfiguredProviderIds().then(ids => setHasAnyProviderKey(ids.length > 0))`
- `FeatureModelOverridePanel.tsx` line 104: already inside `useEffect` — add `await` before call; update `refresh` callback to be async

**Legacy migration in `hydrateSettingsFromSupabase()`:**
- After existing profile/settings hydration, check if `localStorage['ai-configuration']` contains `apiKeys` field with any entries
- For each entry: `decryptData(entry.iv, entry.encryptedData)` → `storeCredential('ai-provider', providerId, plaintext)` → remove key from localStorage blob
- Migration is opportunistic: runs only if old data present on current device (cross-device migration impossible — Web Crypto key is device-local)
- Wrap in try/catch; decrypt failure is non-fatal (console.warn + skip that provider)

**Patterns to follow:**
- `src/lib/settings.ts` `hydrateSettingsFromSupabase` (hook location, async pattern)
- ES2020: `Promise.allSettled` for parallel `checkCredential` calls

**Test scenarios:**
- Happy path: `saveApiKey('openai', 'sk-new')` → `storeCredential` called with correct args; `localStorage['ai-configuration']` no longer contains `apiKeys.openai`
- Happy path: `getConfiguredProviderIds()` → returns `['openai']` when `checkCredential('ai-provider', 'openai')` resolves true
- Happy path: legacy migration in `hydrateSettingsFromSupabase` → old encrypted `apiKeys.groq` present → `decryptData` called → `storeCredential` called → localStorage blob updated without `apiKeys.groq`
- Edge case: `getConfiguredProviderIds()` → returns `[]` when all `checkCredential` calls return false
- Edge case: legacy migration with no `apiKeys` in localStorage → no `storeCredential` calls made
- Error path: legacy migration decrypt failure → `console.warn` called, other providers still migrated
- Integration: `WhisperSettings.tsx` renders with `configuredProviders` state initially `[]`; after `useEffect` resolves, reflects actual configured providers

**Verification:**
- No render-time synchronous calls to `getConfiguredProviderIds()` remain
- `tsc --noEmit` passes (async return type propagated correctly)
- AI key saved on Device A → `checkCredential('ai-provider', 'openai')` returns `true` on Device B after sign-in

---

- [ ] **Unit 5: OPDS catalog + ABS server write-path Vault wiring**

**Goal:** Strip credentials from Dexie writes for OPDS catalogs and ABS servers; call Vault on add/update/delete. Update TypeScript types to reflect optional credential fields.

**Requirements:** R15, R16, R17, R18, R19, R20, R22 (R21 deferred — see Requirements Trace)

**Dependencies:** Unit 3 (`vaultCredentials.ts` available)

**Files:**
- Modify: `src/stores/useOpdsCatalogStore.ts`
- Modify: `src/services/OpdsService.ts` (OPDS read-path: lines 64, 283 — `auth.password` → `await readCredential(...)`)
- Modify: `src/services/BookContentService.ts` (OPDS read-path: line 140 — `source.auth.password` → `await readCredential(...)`)
- Modify: `src/app/components/library/OpdsBrowser.tsx` (OPDS read-path: line 448 — `selectedCatalog.auth.password` → `await readCredential(...)`)
- Modify: `src/stores/useAudiobookshelfStore.ts`
- Modify: `src/data/types.ts`
- Modify or create: `src/stores/__tests__/useOpdsCatalogStore.test.ts`
- Modify or create: `src/stores/__tests__/useAudiobookshelfStore.test.ts`

**Approach:**

**`useOpdsCatalogStore.ts`:**

- `addCatalog(catalog)`: if `catalog.auth?.password` present → `await storeCredential('opds-catalog', catalog.id, catalog.auth.password)` → strip before Dexie: `db.opdsCatalogs.put({ ...catalog, auth: catalog.auth ? { username: catalog.auth.username } : undefined })`. `storeCredential` must be awaited so the Vault write completes before the record exists in Dexie.
- `updateCatalog(id, updates)`: if `updates.auth?.password` → `await storeCredential(...)` → strip password from updates before Dexie write
- `removeCatalog(id)`: after `db.opdsCatalogs.delete(id)` → `void deleteCredential('opds-catalog', id)` (fire-and-forget)
- `auth.password` usage for actual OPDS API calls: at call site, `await readCredential('opds-catalog', catalog.id)` and pass to request — do NOT write back to store. **OPDS read-path call sites** (must be updated in this story, unlike ABS which is deferred): `src/services/OpdsService.ts` lines 64 and 283 (`auth.password` in Basic auth header construction), `src/services/BookContentService.ts` line 140 (`source.auth.password`), `src/app/components/library/OpdsBrowser.tsx` lines 448 (`selectedCatalog.auth.password`). `OpdsCatalogSettings.tsx` line 101 reads `catalog.auth?.password` for display only — after migration this will always be empty/undefined (expected behavior, no fix needed).

**`useAudiobookshelfStore.ts`:**
- `addServer(server)`: `void storeCredential('abs-server', server.id, server.apiKey)` → strip `apiKey` before Dexie: `db.audiobookshelfServers.add({ ...server, apiKey: undefined })`
- `updateServer(id, updates)`: if `updates.apiKey` → `void storeCredential(...)` → strip `apiKey` from updates before Dexie
- `removeServer(id)`: after Dexie delete → `void deleteCredential('abs-server', id)` (fire-and-forget)
- `loadSeries`, `loadCollections` (in-store API calls at lines 164, 196, 219, 254): these call `server.apiKey` which will be `undefined` after migration. Add a type guard: `if (!server.apiKey) { console.warn('[ABS] apiKey unavailable — API call skipped'); return }` — this is explicitly a temporary guard pending the read-path migration (KI-E95-S02-L01)
- **Do NOT** migrate `useAudiobookshelfSocket.ts`, `useAudiobookshelfProgressSync.ts`, `useAudiobookshelfSync.ts`, component files — those are in-scope for the deferred read-path migration

**`src/data/types.ts`:**
- `OpdsCatalog.auth.password`: mark as `password?: string`
- `AudiobookshelfServer.apiKey`: mark as `apiKey?: string`
- Remove "Must be encrypted before any cloud sync" TODO comments from both (this story fulfills them)

**Patterns to follow:**
- `src/stores/useOpdsCatalogStore.ts` (existing add/update/remove structure to extend)
- `src/lib/settings.ts` `saveSettingsToSupabase` (fire-and-forget void pattern)

**Test scenarios:**
- Happy path: `addCatalog({ id, name, url, auth: { username: 'user', password: 'pw' } })` → `storeCredential('opds-catalog', id, 'pw')` called; `db.opdsCatalogs.put` called with object that has NO `auth.password` field
- Happy path: `removeCatalog(id)` → `db.opdsCatalogs.delete` called; `deleteCredential('opds-catalog', id)` called after
- Happy path: `addServer({ id, name, url, apiKey: 'token-abc' })` → `storeCredential('abs-server', id, 'token-abc')` called; `db.audiobookshelfServers.add` called with object where `apiKey` is `undefined`
- Happy path: `removeServer(id)` → Dexie delete called; `deleteCredential('abs-server', id)` called after
- Edge case: `addCatalog({ ..., auth: { username: 'user' } })` (no password) → `storeCredential` NOT called; username preserved in Dexie write
- Edge case: `updateCatalog(id, { name: 'renamed' })` (no credential in update) → `storeCredential` NOT called
- Error path: `deleteCredential` throws in `removeCatalog` → error swallowed with `console.warn`; Dexie delete already completed (ordering guaranteed)
- Integration: `storeCredential` must be **awaited** before `db.opdsCatalogs.put` to guarantee the Vault write completes before the Dexie record exists — use `await storeCredential(...)` not `void storeCredential(...)` in `addCatalog`/`updateCatalog`. (deleteCredential remains fire-and-forget since Dexie delete happens first.)

**Verification:**
- `tsc --noEmit` passes with `apiKey?: string` and `auth.password?: string` optional types
- After `addServer`, the Dexie `audiobookshelfServers` row does NOT contain an `apiKey` field
- After `removeCatalog`, `checkCredential('opds-catalog', id)` returns false

---

- [ ] **Unit 6: Unit tests + known-issues entry**

**Goal:** Verify all test scenarios from Units 3–5 pass. Document the deferred `server.apiKey` read-path migration as a known issue.

**Requirements:** All (verification layer)

**Dependencies:** Units 3–5

**Files:**
- All test files listed in Units 3–5 (already listed there; this unit collects the run verification)
- Modify: `docs/known-issues.yaml` (add KI-E95-S02-L01)

**Approach:**
- Run `npm run test:unit` — all new and modified test files must pass
- Run `npx tsc --noEmit` — zero TypeScript errors
- Add to `docs/known-issues.yaml`:
  ```yaml
  - id: KI-E95-S02-L01
    status: open
    severity: medium
    description: >
      ABS server apiKey read-path not migrated to Vault. 20+ call sites in hooks
      (useAudiobookshelfSocket, useAudiobookshelfProgressSync, useAudiobookshelfSync),
      components (SeriesCard, CollectionCard, AudiobookshelfSettings), and pages
      (CollectionDetail) still access server.apiKey directly from Dexie/Zustand state.
      These will receive undefined after E95-S02 migration until read-path migration is done.
      In-store calls (loadSeries, loadCollections) have a temporary guard that skips
      the API call with a console.warn.
    workaround: Users with existing ABS server connections will need to re-enter API key after E95-S02 deploys, until read-path migration completes.
    epic: E95
    story: E95-S02
    follow_up: separate coordinated refactor of reactive hooks
  ```

**Test scenarios:**
- Test expectation: none beyond running existing test suites to confirm no regressions

**Verification:**
- `npm run test:unit` exits clean
- `npx tsc --noEmit` exits clean
- `docs/known-issues.yaml` contains KI-E95-S02-L01 entry

## System-Wide Impact

- **Interaction graph**: `hydrateSettingsFromSupabase()` gains a legacy migration code path — runs once on first authenticated load per device. If `supabase.functions.invoke` is slow (cold start), this adds latency to the sign-in sequence. The E95-S01 pattern already makes this async so the UI is not blocked.
- **Error propagation**: `storeCredential` and `deleteCredential` are fire-and-forget; failures log but don't propagate to callers. `readCredential` returns null; callers must handle null (toast + abort API call).
- **State lifecycle risks**: After `addServer`, `server.apiKey` in Zustand state is `undefined`. Any in-memory code that reads `server.apiKey` post-add without going through Vault will silently get `undefined`. The temporary guard in Unit 5 surfaces this as a console.warn rather than a silent failure.
- **API surface parity**: `getConfiguredProviderIds()` signature changes from `() => AIProviderId[]` to `() => Promise<AIProviderId[]>`. All 3 call sites are in the same repo; no exported library consumers.
- **Integration coverage**: Cross-device flow (Device A stores → Device B reads via `checkCredential`) is not covered by unit tests. Manually verify with two browser sessions post-deploy.
- **Unchanged invariants**: The Dexie sync engine (`syncableWrite`) is explicitly not involved in credential storage. The `tableRegistry.ts` entry for `audiobookshelfServers` must NOT gain `apiKey` in its sync field list.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase Vault API differs between Postgres SQL and Deno JS client | Verify available methods during Unit 2 implementation; use raw SQL query fallback if RPC isn't available |
| `server.apiKey` guard causes ABS features to silently stop working after migration | Guard logs `console.warn`; known issue is documented and tracked. User impact: ABS library/series/collections stop loading until read-path migration lands |
| Legacy Web Crypto migration fails (IndexedDB unavailable, key lost) | try/catch with `console.warn`; user must re-enter AI provider keys manually |
| `getConfiguredProviderIds()` async conversion misses a call site | `tsc --noEmit` will catch render-time sync calls (TypeScript will error on `await` missing in non-async context); grep for remaining synchronous reads before PR |
| Edge Function cold start latency on first credential store/check | Acceptable per scope boundaries; no SLA on credential operations |

## Documentation / Operational Notes

- After deploying the migration (`20260423000001_server_tables_no_credentials.sql`), the `opds_catalogs` and `audiobookshelf_servers` tables exist but are empty — no client data is synced here (E95-S05).
- Supabase Vault encryption at rest uses pgsodium (libsodium under the hood). No additional key management is required by the app.
- The Edge Function requires `SUPABASE_SERVICE_ROLE_KEY` to be set in the Supabase project's Edge Function secrets (already set for `stripe-webhook`).

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-e95-s02-api-keys-and-all-credentials-via-supabase-vault-requirements.md](docs/brainstorms/2026-04-19-e95-s02-api-keys-and-all-credentials-via-supabase-vault-requirements.md)
- Edge Function pattern: `supabase/functions/stripe-webhook/index.ts`
- Client invocation pattern: `src/lib/checkout.ts`
- E95-S01 hook pattern: `src/lib/settings.ts`
- Web Crypto: `src/lib/crypto.ts`, `src/lib/cryptoKeyStore.ts`
- AI config: `src/lib/aiConfiguration.ts`
- ABS store: `src/stores/useAudiobookshelfStore.ts`
- OPDS store: `src/stores/useOpdsCatalogStore.ts`
- Data types: `src/data/types.ts`
- Supabase Vault docs: https://supabase.com/docs/guides/database/vault
