---
story_id: E95-S02
story_name: "API Keys and All Credentials via Supabase Vault"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 95.02: API Keys and All Credentials via Supabase Vault

## Story

As a learner who uses Knowlune on multiple devices,
I want my server credentials (AI provider API keys, OPDS catalog passwords, Audiobookshelf API keys) stored securely in Supabase Vault,
so that the raw secret never lives in my browser localStorage or unencrypted in a Postgres row — and I can sign in on a new device without re-entering every credential.

## Acceptance Criteria

**AC1 — AI provider API key stored and retrievable via Vault:**
Given I save an OpenAI API key in AI Configuration Settings.
When I call `GET /vault/check-credential?credentialType=ai-provider&credentialId=openai`.
Then the response is `{ configured: true }`.
And the key is NOT present in Postgres `user_settings.settings` or any Postgres row.
And the key is NOT present in `localStorage['ai-configuration']` as plaintext.

**AC2 — OPDS catalog password stored in Vault, not Postgres:**
Given I add an OPDS catalog with basic-auth username/password.
When the catalog is saved.
Then the `password` field is stored in `vault.secrets` (via Edge Function).
And the Supabase `opds_catalogs` row has no `password` column.
And `check-credential` for that catalog returns `{ configured: true }`.

**AC3 — ABS server API key stored in Vault, not Postgres:**
Given I add an Audiobookshelf server with an API key.
When the server is saved.
Then the `apiKey` field is stored in Vault.
And the Supabase `audiobookshelf_servers` row has no `api_key` column.
And `check-credential` for that server returns `{ configured: true }`.

**AC4 — `check-credential` returns false when not stored:**
Given I call `GET /vault/check-credential?credentialType=ai-provider&credentialId=anthropic`.
When no Anthropic key has been stored for this user.
Then the response is `{ configured: false }`.

**AC5 — Vault secret deleted when record is deleted:**
Given an OPDS catalog with a stored Vault secret.
When I delete the catalog.
Then `check-credential` for that catalog returns `{ configured: false }`.
And `audiobookshelf_servers` deletion similarly cleans up its Vault secret.

**AC6 — Raw credential never present in Postgres or localStorage:**
Given any credential has been stored via the Vault Edge Function.
When I inspect `vault.secrets` directly (as admin).
Then I see an encrypted row with key `{userId}:{credentialType}:{credentialId}`.
When I inspect all Postgres public tables.
Then no column contains the raw credential string.
When I inspect `localStorage`.
Then no key contains the raw credential string.

**AC7 — Read-credential returns the secret for API call use:**
Given an ABS server with a stored Vault API key.
When the client needs to make an ABS API call.
Then `GET /vault/read-credential?credentialType=abs-server&credentialId={serverId}` returns `{ secret: "sk-..." }`.
And the client uses this to make the API call but does not persist the result.

## Tasks / Subtasks

- [ ] Task 1: Create Edge Function `vault-credentials` (AC1–AC7)
  - [ ] 1.1 Create `supabase/functions/vault-credentials/index.ts` with four routes:
    - `POST /vault/store-credential` — body: `{ credentialType: 'ai-provider'|'opds-catalog'|'abs-server', credentialId: string, secret: string }` → calls `vault.create_secret(name, secret)` or `vault.update_secret(id, secret)`; key naming: `{userId}:{credentialType}:{credentialId}`; returns `{ configured: true }`
    - `GET /vault/check-credential?credentialType=...&credentialId=...` → queries `vault.secrets` by key; returns `{ configured: boolean }` (NEVER returns the secret)
    - `GET /vault/read-credential?credentialType=...&credentialId=...` → queries `vault.decrypted_secrets` by key; returns `{ secret: string }` (only called at point-of-use for API calls; result never persisted)
    - `DELETE /vault/delete-credential?credentialType=...&credentialId=...` → deletes from `vault.secrets` by key; returns `{ deleted: boolean }`
  - [ ] 1.2 JWT verification: extract `userId` from JWT (`Authorization: Bearer <jwt>`) using `Deno.env.get('SUPABASE_JWT_SECRET')` or by calling `supabase.auth.getUser()` — do NOT trust `credentialType`/`credentialId` from request without userId binding
  - [ ] 1.3 Return 401 if no valid JWT; return 400 if `credentialType` is not one of the three allowed values
  - [ ] 1.4 Follow the stripe-webhook pattern: validate env vars at startup with fail-fast guard (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`)

- [ ] Task 2: Create `src/lib/vaultCredentials.ts` client module (AC1–AC7)
  - [ ] 2.1 Export `storeCredential(credentialType, credentialId, secret): Promise<void>` — calls `POST /vault/store-credential` via `supabase.functions.invoke('vault-credentials', ...)`
  - [ ] 2.2 Export `checkCredential(credentialType, credentialId): Promise<boolean>` — calls `GET /vault/check-credential`; returns `false` on network error (non-throwing)
  - [ ] 2.3 Export `readCredential(credentialType, credentialId): Promise<string | null>` — calls `GET /vault/read-credential`; returns `null` on error
  - [ ] 2.4 Export `deleteCredential(credentialType, credentialId): Promise<void>` — calls `DELETE /vault/delete-credential`; swallows errors with `console.warn`
  - [ ] 2.5 All functions are no-ops (resolve immediately) when user is not authenticated (check via `supabase.auth.getUser()`)

- [ ] Task 3: Migrate AI provider API keys to Vault (AC1, AC6)
  - [ ] 3.1 In `src/lib/aiConfiguration.ts`: replace localStorage plaintext + Web Crypto encryption pattern with `storeCredential('ai-provider', providerId, apiKey)` on save and `readCredential('ai-provider', providerId)` on read
  - [ ] 3.2 On save: call `storeCredential(...)` then remove the key from the localStorage blob (keep non-credential fields like feature consent, selected model in localStorage)
  - [ ] 3.3 On read (when making AI API call): call `readCredential(...)` — this is async, so callers that previously read synchronously must be updated to `await`
  - [ ] 3.4 `getConfiguredProviderIds()` → replace with async `getConfiguredProviderIds(): Promise<AIProviderId[]>` that calls `checkCredential(...)` for each provider
  - [ ] 3.5 Keep backward compatibility: on app init, check if old localStorage credential exists → migrate to Vault → remove from localStorage (one-time migration)
  - [ ] 3.6 Update all call sites that read `getConfiguredProviderIds()` or `getAIConfiguration().apiKeys.*` to handle async

- [ ] Task 4: Wire OPDS catalog add/update/delete to Vault (AC2, AC5, AC6)
  - [ ] 4.1 In `src/stores/useOpdsCatalogStore.ts` `addCatalog()`: if `catalog.auth.password` present → call `storeCredential('opds-catalog', catalog.id, catalog.auth.password)` → store catalog WITHOUT `auth.password` field in Dexie (strip before `db.opdsCatalogs.put(...)`)
  - [ ] 4.2 `updateCatalog()`: if update includes `auth.password` → call `storeCredential(...)` → strip before Dexie write
  - [ ] 4.3 `removeCatalog()`: after `db.opdsCatalogs.delete(id)` → call `deleteCredential('opds-catalog', id)` (fire-and-forget with warn on error)
  - [ ] 4.4 When reading catalog for an API call that needs the password → call `readCredential('opds-catalog', catalog.id)` to retrieve; do NOT store result back to Dexie or Zustand
  - [ ] 4.5 Update `OpdsCatalog` Dexie type: mark `auth.password` as optional (it will be absent in storage, present only transiently during save flow)

- [ ] Task 5: Wire ABS server add/update/delete to Vault (AC3, AC5, AC6)
  - [ ] 5.1 In `src/stores/useAudiobookshelfStore.ts` `addServer()`: call `storeCredential('abs-server', server.id, server.apiKey)` → store server WITHOUT `apiKey` in Dexie
  - [ ] 5.2 `updateServer()`: if update includes `apiKey` → call `storeCredential(...)` → strip before Dexie write
  - [ ] 5.3 `removeServer()`: after Dexie delete → call `deleteCredential('abs-server', server.id)` (fire-and-forget)
  - [ ] 5.4 `AudiobookshelfService.ts` or the store's API call path: replace direct `server.apiKey` usage with `await readCredential('abs-server', server.id)` at point of HTTP call
  - [ ] 5.5 Update `AudiobookshelfServer` Dexie type: mark `apiKey` as optional (absent in storage)
  - [ ] 5.6 Update `src/data/types.ts` comments: remove "Must be encrypted before any cloud sync" TODOs from `OpdsCatalog.auth.password` and `AudiobookshelfServer.apiKey` — this story fulfills them

- [ ] Task 6: Supabase migration for `opds_catalogs` and `audiobookshelf_servers` tables (AC2, AC3)
  - [ ] 6.1 Create `supabase/migrations/20260423000001_server_tables_no_credentials.sql`:
    - `opds_catalogs` table: `id UUID PK`, `user_id UUID REFERENCES auth.users`, `name TEXT`, `url TEXT`, `auth_username TEXT` (username is NOT sensitive — no password column), `last_synced TIMESTAMPTZ`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
    - `audiobookshelf_servers` table: `id UUID PK`, `user_id UUID REFERENCES auth.users`, `name TEXT`, `url TEXT`, `library_ids JSONB`, `status TEXT`, `last_synced_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
    - No `password` column on `opds_catalogs`, no `api_key` column on `audiobookshelf_servers` — credentials live in Vault only
    - RLS: SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`
  - [ ] 6.2 Create matching rollback `supabase/migrations/rollback/20260423000001_server_tables_no_credentials_rollback.sql`

- [ ] Task 7: Unit tests (AC1–AC7)
  - [ ] 7.1 Test `vaultCredentials.ts`: mock `supabase.functions.invoke`; verify `storeCredential` calls correct endpoint; verify `checkCredential` returns boolean; verify `readCredential` returns null on error; verify `deleteCredential` swallows errors
  - [ ] 7.2 Test `useOpdsCatalogStore` `addCatalog()`: verify `storeCredential` called with correct type/id/secret; verify password stripped from Dexie write; verify `deleteCredential` called on `removeCatalog`
  - [ ] 7.3 Test `useAudiobookshelfStore` `addServer()`: verify `storeCredential` called; verify `apiKey` absent from Dexie write; verify `deleteCredential` called on `removeServer`
  - [ ] 7.4 Test AI key migration: localStorage credential → `storeCredential` called → removed from localStorage on next read
  - [ ] 7.5 Test anonymous user: `storeCredential` returns immediately without calling Edge Function when not authenticated

## Design Guidance

Minimal UI changes — the Settings credential input forms (AI Configuration, OPDS setup, ABS setup) already exist. The UX change is:
- After save, the raw key is NOT stored in the form state or Zustand. A `configured: boolean` flag per credential is stored instead (already implied by `checkCredential` pattern).
- Connection status badge/indicator uses `checkCredential()` result (async) — show a loading state while checking.
- If `readCredential()` fails (Vault unavailable), surface a toast: "Credential unavailable — check your connection." Don't silently fail API calls.

## Implementation Notes

### Edge Function Pattern (follow stripe-webhook/index.ts)

The existing `stripe-webhook/index.ts` is the pattern to follow:
- Validate env vars at startup with `Deno.env.get(...)` + fail-fast throw
- Use `createClient` from `https://esm.sh/@supabase/supabase-js@2`
- Use service-role client for Vault writes (Vault is NOT accessible via anon key or RLS)
- Parse JWT from `Authorization` header to get userId: `const { data: { user } } = await supabaseAdmin.auth.getUser(token)`
- Return JSON with explicit `Content-Type: application/json` headers

### Supabase Vault API (pgsodium-based)

Supabase Vault stores secrets as rows in `vault.secrets`. The extension is already enabled (`CREATE EXTENSION IF NOT EXISTS supabase_vault` in P0 migration). Key Vault functions available via SQL:

```sql
-- Create a secret
SELECT vault.create_secret(
  secret := 'sk-abc123',
  name   := 'user-uuid:ai-provider:openai',
  description := 'AI provider API key'
)  -- returns: vault secret UUID

-- Update a secret (if name already exists, replace)
SELECT vault.update_secret(
  id     := existing_secret_id,
  secret := 'sk-newkey'
)

-- Read decrypted (never expose this to untrusted callers)
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'user-uuid:ai-provider:openai'

-- Delete
DELETE FROM vault.secrets WHERE name = 'user-uuid:ai-provider:openai'
```

In the Edge Function, use these via `supabaseAdmin.rpc(...)` or raw SQL query via `supabaseAdmin.from('vault.secrets').select(...)`.

**Key naming convention**: `{userId}:{credentialType}:{credentialId}`
- `credentialType`: `'ai-provider' | 'opds-catalog' | 'abs-server'`
- `credentialId`: provider id (e.g., `'openai'`) or record UUID

### Why Edge Function (not Postgres RPC)?

Supabase Vault's `vault.decrypted_secrets` view is only accessible via service-role key (not anon/authenticated). An Edge Function with a service-role client bridges the gap — the client calls the Edge Function with their JWT, the function validates auth server-side, then reads from Vault with service-role credentials.

### Backward Compatibility for AI Keys

`aiConfiguration.ts` currently uses Web Crypto (`crypto.subtle.encrypt`) + localStorage. The migration path on app init:
1. Check if `localStorage['ai-configuration']` contains `apiKeys.*` entries
2. For each configured provider: decrypt the localStorage key, call `storeCredential('ai-provider', providerId, decryptedKey)`, then remove `apiKeys[providerId]` from the localStorage object
3. This one-time migration should run inside `hydrateSettingsFromSupabase()` or on authenticated user init (after userId is known)

### `getConfiguredProviderIds()` Async Migration

This function is called from `WhisperSettings.tsx` and other components. The refactor path:
- Make it `async`: `export async function getConfiguredProviderIds(): Promise<AIProviderId[]>`
- Internally calls `checkCredential('ai-provider', providerId)` for each known provider
- Call sites must use `useEffect` with `useState` (not render-time calls) — most already do given async component patterns

### Files to Create
- `supabase/functions/vault-credentials/index.ts`
- `supabase/migrations/20260423000001_server_tables_no_credentials.sql`
- `supabase/migrations/rollback/20260423000001_server_tables_no_credentials_rollback.sql`
- `src/lib/vaultCredentials.ts`
- `src/lib/__tests__/vaultCredentials.test.ts`
- `src/stores/__tests__/useOpdsCatalogStore-vault.test.ts` (or extend existing test file)
- `src/stores/__tests__/useAudiobookshelfStore-vault.test.ts` (or extend existing test file)

### Files to Modify
- `src/lib/aiConfiguration.ts` — replace localStorage key storage with Vault; make `getConfiguredProviderIds()` async
- `src/stores/useOpdsCatalogStore.ts` — strip password before Dexie write; add vault calls
- `src/stores/useAudiobookshelfStore.ts` — strip apiKey before Dexie write; add vault calls
- `src/data/types.ts` — mark `OpdsCatalog.auth.password` and `AudiobookshelfServer.apiKey` as optional + remove TODO comments
- `src/services/AudiobookshelfService.ts` — update API call paths to use `readCredential` instead of `server.apiKey`

### ES2020 Constraints (from project memory)
- No `Promise.any` — use `Promise.allSettled`
- `??` and `?.` available
- `async/await` available

### Dexie Schema Change
`audiobookshelfServers` schema already excludes `apiKey` from the Dexie index definition. However, the TypeScript interface `AudiobookshelfServer.apiKey` must be marked `apiKey?: string` (optional) to reflect that it may be absent from stored rows. Update `src/db/__tests__/schema.test.ts` if any test asserts `apiKey` is present on stored rows.

### Previous Story Intelligence (E95-S01)

E95-S01 (just shipped) established the fire-and-forget dual-write pattern for settings: stores call `void saveSettingsToSupabase(...)` alongside localStorage. E95-S02 follows a different pattern — this is not dual-write but **replace**: after successful Vault storage, the credential is removed from localStorage. The net result: credential fields move entirely off the client.

The `hydrateSettingsFromSupabase()` from E95-S01 fetches `user_settings.settings` (preferences only). Credential hydration in E95-S02 is NOT done via `user_settings` — credentials are fetched on-demand via `readCredential()` at the point of API call, not eagerly loaded.

### OPDS Catalog: Username Is NOT Sensitive

OPDS basic auth has `{ username, password }`. Only `password` goes to Vault. `username` is safe to store in the Dexie `opdsCatalogs` row and Supabase `opds_catalogs` table (it's a service account name, not a personal secret).

## Testing Notes

- All tests are unit tests (no E2E — no UI changes in this story beyond async state handling)
- Mock `supabase.functions.invoke` in all vault tests — never hit a real Edge Function
- Test the one-time localStorage → Vault migration path explicitly
- Test that `apiKey` and `password` are stripped from the objects passed to `db.audiobookshelfServers.add(...)` and `db.opdsCatalogs.put(...)` — assert that the mock Dexie call did NOT receive the credential field
- Test anonymous user path: `storeCredential` called while `supabase.auth.getUser()` returns `{ user: null }` → resolves without calling Edge Function
- Test vault unavailable: `readCredential` returns `null` when Edge Function returns non-200; no throw propagated
- Test delete cascade: `removeCatalog` → verifies `deleteCredential` called AFTER Dexie delete (ordering matters for cleanup guarantee)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors (credential failures must show toast, not silent fail)
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after Vault write confirms
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] Dexie schema: `apiKey` on `AudiobookshelfServer` marked optional; update `src/db/__tests__/schema.test.ts`
- [ ] `tsc --noEmit`: runs clean (zero TypeScript errors) before submission
- [ ] CRUD completeness: for OPDS and ABS, all four CRUD paths (add/update/remove/read) are vault-wired and tested
- [ ] Raw credential verification: grep for `apiKey` and `password` in Dexie write paths — confirm they're absent
- [ ] Backward compat: old localStorage AI key migration tested for one-time migration case
- [ ] Edge Function: confirm `SUPABASE_JWT_SECRET` or equivalent auth verification; no endpoint accepts requests without valid JWT
- [ ] `storeCredential` returns immediately when user is not authenticated (no unauthenticated Vault writes)
- [ ] `deleteCredential` failure (e.g., secret not found) does not block record deletion — warn and continue
- [ ] `readCredential` result is NEVER written back to Dexie, Zustand, or localStorage
- [ ] `check-credential` endpoint NEVER returns the secret value — only `{ configured: boolean }`

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
