---
date: 2026-04-19
topic: e95-s02-api-keys-and-all-credentials-via-supabase-vault
---

# API Keys and All Credentials via Supabase Vault

## Problem Frame

Knowlune stores three classes of sensitive credentials entirely on the client:
- **AI provider API keys** — Web Crypto encrypted in `localStorage['ai-configuration']`
- **OPDS catalog passwords** — plaintext in Dexie `opdsCatalogs` table (acknowledged TODO in `src/data/types.ts`)
- **Audiobookshelf API keys** — plaintext in Dexie `audiobookshelfServers` table (acknowledged TODO)

The design was appropriate for local-first, single-device use. With cross-device sync now live (E92–E94), these credentials need to be accessible on new devices without requiring users to re-enter them. The naive path — syncing them through the Dexie/Supabase sync engine — would put raw credentials in unencrypted Postgres rows, which is not acceptable.

The solution is Supabase Vault (pgsodium-based), already enabled via `CREATE EXTENSION IF NOT EXISTS supabase_vault` in the P0 migration. Credentials go into Vault, never into Postgres public tables or the sync queue.

## Requirements

**Edge Function — vault-credentials**
- R1. A Supabase Edge Function `vault-credentials` exposes four routes scoped by the caller's JWT userId: `POST /store-credential`, `GET /check-credential`, `GET /read-credential`, `DELETE /delete-credential`.
- R2. `store-credential` upserts a secret in `vault.secrets` keyed as `{userId}:{credentialType}:{credentialId}` and returns `{ configured: true }`. Supported `credentialType` values: `ai-provider`, `opds-catalog`, `abs-server`.
- R3. `check-credential` returns `{ configured: boolean }` — never returns the secret itself. Used for UI "status badges" without exposing the credential to the browser.
- R4. `read-credential` returns `{ secret: string }` from `vault.decrypted_secrets`. Called only at point-of-use (making an API call); the result is never persisted by the caller.
- R5. `delete-credential` removes the secret from `vault.secrets` and returns `{ deleted: boolean }`.
- R6. All four routes reject unauthenticated requests with 401. Requests with invalid `credentialType` return 400. The function uses a service-role Supabase client internally (required because `vault.decrypted_secrets` is not accessible via authenticated/anon keys).

**Client Module — vaultCredentials.ts**
- R7. A `src/lib/vaultCredentials.ts` module wraps the four Edge Function routes into typed async functions: `storeCredential`, `checkCredential`, `readCredential`, `deleteCredential`.
- R8. All four functions are no-ops (resolve immediately without calling the Edge Function) when the current user is not authenticated.
- R9. `checkCredential` and `readCredential` return `false` / `null` respectively on network failure — no throw propagated to callers.
- R10. `deleteCredential` swallows failures with `console.warn` — deletion errors never block record deletion.

**AI Provider API Keys Migration**
- R11. Saving an AI provider key calls `storeCredential('ai-provider', providerId, key)`, then removes the credential from the localStorage blob (non-credential fields like feature consent and selected model remain in localStorage).
- R12. Reading an AI provider key at point-of-use (when making an AI API call) calls `readCredential('ai-provider', providerId)` — this call is async; call sites that previously read synchronously must be updated to `await`.
- R13. `getConfiguredProviderIds()` becomes async and internally calls `checkCredential` per provider.
- R14. Inside `hydrateSettingsFromSupabase()` (the authenticated user init hook from E95-S01), any legacy `apiKeys.*` entries found in `localStorage['ai-configuration']` are migrated to Vault (decrypt with existing Web Crypto path → `storeCredential` → remove from localStorage). This migration runs once and is idempotent.

**OPDS Catalog Credentials**
- R15. `addCatalog()` and `updateCatalog()` in `useOpdsCatalogStore`: when `auth.password` is present, call `storeCredential('opds-catalog', catalog.id, password)` then strip `password` before writing to Dexie. The `username` field is NOT sensitive and remains in Dexie.
- R16. `removeCatalog()` calls `deleteCredential('opds-catalog', id)` after the Dexie deletion (fire-and-forget; failure warns but does not block).
- R17. When an OPDS API call needs the password, the caller invokes `readCredential('opds-catalog', catalog.id)` — the result is used for the request and never written back to Dexie or Zustand state.
- R18. `OpdsCatalog.auth.password` in TypeScript types is marked optional to reflect that it is absent from stored rows.

**ABS Server API Keys**
- R19. `addServer()` and `updateServer()` in `useAudiobookshelfStore`: call `storeCredential('abs-server', server.id, apiKey)` then strip `apiKey` before writing to Dexie.
- R20. `removeServer()` calls `deleteCredential('abs-server', id)` after the Dexie deletion (fire-and-forget).
- R21. `AudiobookshelfService.ts` (or equivalent API call paths) replaces direct `server.apiKey` field access with `await readCredential('abs-server', server.id)` at the HTTP call site.
- R22. `AudiobookshelfServer.apiKey` in TypeScript types is marked optional.

**Supabase Migrations**
- R23. A new migration `supabase/migrations/20260423000001_server_tables_no_credentials.sql` creates `opds_catalogs` and `audiobookshelf_servers` tables in Postgres with RLS (`auth.uid() = user_id`) but with **no** `password` or `api_key` columns — credentials live exclusively in Vault.

## Success Criteria

- A raw credential string (API key, password) is absent from all Postgres public table columns, the Dexie sync queue payload, and all localStorage entries after the credential is saved via the Vault path.
- `check-credential` returns `{ configured: true }` for any credential successfully stored, and `{ configured: false }` after the associated record is deleted.
- An authenticated user who adds an ABS server on Device A can immediately make ABS API calls on Device B after signing in (credential retrieved from Vault, not from Dexie sync).
- The legacy localStorage AI key migration path correctly migrates and clears the old Web Crypto blob on first authenticated load.

## Scope Boundaries

- **Not in this story:** syncing OPDS catalog metadata (name, URL) or ABS server metadata (name, URL, libraryIds) cross-device — that is E95-S05.
- **Not in this story:** UI redesign of credential input forms — the existing form components are unchanged; only the save/read path changes.
- **Not in this story:** server-side streaming or real-time Vault sync — credentials are fetched on-demand via `readCredential`, not pushed.
- **Not in this story:** offline fallback when Vault is unreachable — if `readCredential` returns null, the API call fails and a toast is shown. A more sophisticated offline credential cache is deferred.
- **Not in this story:** server-side streak calculation (E95-S04) or entitlement management (E95-S03).
- **Not in this story:** audit logging for `read-credential` calls (e.g., server-side `credential_reads_log` table). Rate limiting and anomaly detection on credential reads are future security hardening work. The current threat model assumes JWT compromise is mitigated at the auth layer (refresh token rotation, short-lived JWTs).

## Key Decisions

- **Edge Function over Postgres RPC**: `vault.decrypted_secrets` is not accessible via authenticated Postgres keys — only via service-role. An Edge Function bridges this gap without exposing service-role credentials to the client.
- **Key naming `{userId}:{credentialType}:{credentialId}`**: scopes secrets per user without needing a separate RLS-like lookup; the Edge Function enforces the userId prefix matches the JWT before any read/write.
- **`check-credential` never returns the secret**: UI status badges and "is configured?" checks use this endpoint; the raw secret is only returned by `read-credential` at the point of making an API call.
- **Replace (not dual-write) for credentials**: unlike E95-S01 preferences which dual-write to both localStorage and Supabase, credentials follow a replace pattern — once stored in Vault, removed from localStorage entirely.
- **Credential hydration is on-demand, not eager**: credentials are not eagerly loaded on sign-in (unlike `user_settings` preferences from E95-S01). They are fetched at the moment an API call needs them via `readCredential()`. This avoids loading all secrets into browser memory unnecessarily and prevents the credentials from existing in JS heap except during active use.
- **Username is not sensitive**: OPDS basic-auth usernames are stored in Dexie and Supabase normally — only the password goes to Vault.
- **Client uses anon key to call Edge Function**: `supabase.functions.invoke(...)` uses the existing Supabase client initialized with the anon key. The Edge Function internally escalates to service-role for Vault access. The service-role key never leaves the server.

## Dependencies / Assumptions

- `supabase_vault` extension is already installed (verified: `CREATE EXTENSION IF NOT EXISTS supabase_vault` in `supabase/migrations/20260413000001_p0_sync_foundation.sql`).
- E95-S01 shipped — `hydrateSettingsFromSupabase()` is async and the auth lifecycle calls it with `await`. The one-time AI key migration hooks into this existing auth init flow.
- `supabase.functions.invoke` is available on the Supabase client already used throughout the codebase; it sends the caller's JWT automatically via the anon-key-initialized client.
- ABS server metadata sync (E95-S05) depends on this story completing first — the Supabase `audiobookshelf_servers` table will be created here without an `api_key` column.
- The rate-limiting posture of `read-credential` (called per-API-call) is acceptable: Supabase Edge Functions have generous invocation limits and the calls are user-initiated, not automated loops. Caching in-memory for the session lifetime is not required for correctness but may be added as a future optimization.

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Should `store-credential` use `vault.create_secret` + catch-and-update, or query-then-upsert? The Vault API does not have a native upsert — verify the right idempotent pattern for the Deno/Supabase JS client.
- [Affects R14][Technical] The one-time legacy migration decrypts using the existing Web Crypto key. Is that key derived from a fixed salt or from something user-specific? Verify `src/lib/crypto.ts` before coding the migration to avoid decryption failures.
- [Affects R21][Needs research] `AudiobookshelfService.ts` makes several API calls. Enumerate all call sites that directly access `server.apiKey` to ensure none are missed in the migration.
- [Affects R13][Needs research] Enumerate all call sites of `getConfiguredProviderIds()` and `getAIConfiguration().apiKeys.*` before committing to the async refactor approach. Any synchronous render-time reads must be identified and converted to `useEffect`/`useState` patterns to avoid runtime errors.

## Next Steps

`-> /ce:plan` for structured implementation planning
