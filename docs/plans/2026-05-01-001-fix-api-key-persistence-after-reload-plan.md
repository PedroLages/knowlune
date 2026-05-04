---
title: "fix: Preserve LLM API keys across page reloads and codebase updates via Vault fallback"
type: fix
status: active
date: 2026-05-01
---

# Fix API Key Persistence After Page Reload / Codebase Update

## Overview

When a user saves an LLM API key (e.g., Google Gemini), it is encrypted with a device-local AES-256-GCM `CryptoKey` stored in IndexedDB ("CryptoKeyStore"). The encrypted ciphertext lives in localStorage, and a plaintext copy is also stored in Supabase Vault. However, when the IndexedDB `CryptoKey` is cleared — which happens during browser data clearing, service worker updates on codebase changes, or storage quota pressure — the decryption path has **no Vault fallback**. A new `CryptoKey` is generated but cannot decrypt the old ciphertext, so the API key appears missing and the user must re-enter it.

The fix adds a Vault read fallback to `getDecryptedApiKeyForProvider()`: when local decryption fails but the encrypted data exists in localStorage, attempt to retrieve the plaintext key from Supabase Vault. If successful, re-encrypt with the current `CryptoKey` and persist to localStorage (self-healing).

## Problem Frame

**User symptom**: After a service worker update (triggered by a codebase deploy) or browser data clearing, LLM API keys (Google Gemini, OpenAI, Anthropic, etc.) must be re-entered in Settings → AI Configuration.

Note: Plain page reloads (F5/Cmd+R) preserve IndexedDB and do NOT trigger this issue. Only SW lifecycle events and explicit storage clearing cause the CryptoKey loss described below.

**Technical cause**:

```
saveProviderApiKey('gemini', key)
  ├── storeCredential → Supabase Vault ✅ (plaintext, cross-device)
  ├── encryptData(key) → localStorage ✅ (encrypted, device-local)
  └── CryptoKey saved to IndexedDB ✅ (decryption key, device-local)

[SW update (codebase deploy) or browser data clearing removes IndexedDB]
  ├── CryptoKey lost ❌
  ├── New CryptoKey generated ❌ (different key)
  └── Decrypt old localStorage ciphertext → FAIL ❌

getDecryptedApiKeyForProvider('gemini')
  ├── Try local decrypt → null (wrong CryptoKey) ❌
  └── Vault fallback → NOT IMPLEMENTED ❌
```

The encrypted data in localStorage is a tombstone: it proves a key *was* configured, but it's unreadable without the original CryptoKey. The Vault has the plaintext, but the decryption path never consults it.

**Known limitation:** `saveProviderApiKey()` writes to Vault via a fire-and-forget `storeCredential()` call (not awaited). If the user saves a key and closes the page before the Vault write completes, or if the Supabase Edge Function is unreachable at save time, the plaintext never reaches Vault. In that case, the Vault fallback added by this fix will also return `null` — the key must be re-entered. This is an existing limitation of the write path, not a regression. The fix helps when IndexedDB is cleared **after** the Vault write has completed (the common case).

## Requirements Trace

- **R1.** Saved API keys survive page reloads (IndexedDB intact) — already working
- **R2.** Saved API keys survive IndexedDB clearing (browser data clear, SW update) by falling back to Supabase Vault
- **R3.** When Vault fallback succeeds, the key is re-encrypted with the current CryptoKey for future local reads (self-healing)
- **R4.** When Vault fallback fails (unauthenticated, network error, key not in Vault), returns `null` gracefully (existing behavior preserved)
- **R5.** The Vault fallback is transparent to callers — no API changes to `getDecryptedApiKeyForProvider()` or its consumers

## Scope Boundaries

- Only the decryption fallback path in `getDecryptedApiKeyForProvider()` is modified
- No changes to the encryption path (`saveProviderApiKey`, `encryptData`) — those already write to Vault correctly
- No changes to the CryptoKeyStore or IndexedDB persistence layer
- No changes to UI components (Settings page, ProviderKeyAccordion, etc.)

### Deferred to Separate Tasks

- Full Vault→local re-hydration on sign-in (reading all Vault-stored keys and re-encrypting them locally): separate enhancement PR
- Moving the CryptoKey itself to Vault (key sync across devices): separate architecture change

## Context & Research

### Relevant Code and Patterns

- [src/lib/aiConfiguration.ts](src/lib/aiConfiguration.ts) — `getDecryptedApiKeyForProvider()` at line 486-523 is the primary change site
- [src/lib/crypto.ts](src/lib/crypto.ts) — `decryptData()` throws on wrong key; `getSessionKey()` generates new key when IndexedDB is empty
- [src/lib/cryptoKeyStore.ts](src/lib/cryptoKeyStore.ts) — IndexedDB-backed CryptoKey persistence
- [src/lib/vaultCredentials.ts](src/lib/vaultCredentials.ts) — `readCredential()` fetches plaintext from Supabase Vault Edge Function
- [src/lib/credentials/resolverFactory.ts](src/lib/credentials/resolverFactory.ts) — Existing Vault credential resolver with retry ladder (auth refresh on 401), but used only by ABS/OPDS, not AI provider keys
- [src/ai/llm/factory.ts](src/ai/llm/factory.ts) — `getLLMClient()` consumes `getDecryptedApiKeyForProvider()` at line 124 and 181

### Institutional Learnings

- [src/lib/__tests__/cryptoKeyPersistence.integration.test.ts:82-93](src/lib/__tests__/cryptoKeyPersistence.integration.test.ts#L82-L93) — Existing test explicitly documents and accepts the "IndexedDB cleared → key null" behavior as known
- `saveProviderApiKey()` at line 548 already stores to Vault via `storeCredential('ai-provider', provider, apiKey)` — the plaintext IS in Vault, we just never read it back

### External References

- N/A — this is a codebase-internal fix using existing infrastructure

## Key Technical Decisions

- **Vault fallback in `getDecryptedApiKeyForProvider()`** (not a separate resolver): Keeps the change minimal and transparent to all ~10 call sites. The function already returns `Promise<string | null>`, so the async Vault read fits naturally.
- **Re-encrypt on successful Vault fallback**: Self-healing ensures the Vault round-trip happens at most once per provider per IndexedDB-clearing event. After re-encryption, subsequent reads use fast local decryption.
- **Guard Vault read with "encrypted data exists" check**: Only attempt Vault read when `providerKeys?.[provider]` or `apiKeyEncrypted` is non-null. This avoids unnecessary network calls for providers that were never configured, and the encrypted data serves as a definitive signal that a key *was* saved.
- **No retry ladder for AI provider keys**: The resolverFactory's retry-on-401 pattern is overkill here. A single `readCredential()` call is sufficient — if it fails, return null. The user can re-enter the key. This simplifies the implementation and avoids importing the full resolver/telemetry machinery into `aiConfiguration.ts`.
- **Use `readCredential` (not `readCredentialWithStatus`)** for simplicity: The plain `readCredential` function already handles unauthenticated (returns null) and errors (logs warning, returns null), which is exactly the graceful degradation we want.

## Open Questions

### Resolved During Planning

- **Should we use the resolverFactory pattern?** → No. The resolverFactory's retry ladder and telemetry are designed for sync credentials (ABS/OPDS) where silent failure breaks background sync. For AI provider keys, the user gets immediate feedback ("No API key configured") and can re-enter. A simple `readCredential()` call is proportionate.
- **Should we also fix the Vault upload path?** → No. `saveProviderApiKey()` already writes to Vault (line 548). The upload path is correct; only the read path is missing the fallback.

### Deferred to Implementation

- Exact console warning message wording for Vault fallback attempt/failure
- Whether to debounce re-encryption attempts across rapid calls to `getDecryptedApiKeyForProvider()`

## Implementation Units

- [ ] **Unit 1: Add Vault fallback to `getDecryptedApiKeyForProvider()`**

**Goal:** When local decryption fails, attempt to read the plaintext key from Supabase Vault and re-encrypt locally.

**Requirements:** R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/lib/aiConfiguration.ts` (lines ~486-523, `getDecryptedApiKeyForProvider` function)
- Test: `src/lib/__tests__/aiConfiguration.test.ts`

**Approach:**

Extend `getDecryptedApiKeyForProvider()` with a fallback path after local decryption returns null:

0. **Structural prerequisite:** The two existing catch blocks (providerKeys path and legacy `apiKeyEncrypted` path) each `return null` — which exits the function immediately. Replace both `return null` statements with a shared `let decryptedResult: string | null = null` variable assignment, then fall through to the Vault fallback check below. Only return `null` if both local decryption AND Vault fallback fail.
1. After the existing providerKey and legacy fallback blocks complete (with `decryptedResult` set or still null), check whether encrypted data exists in localStorage for this provider (`providerKeys?.[provider]` or legacy `apiKeyEncrypted`) — if no encrypted data exists AND `decryptedResult` is null, return `null` (provider was never configured)
2. If `decryptedResult` is null but encrypted data exists, call `readCredential('ai-provider', provider)` (add `readCredential` to the existing `vaultCredentials` import on line 20 of `aiConfiguration.ts`)
3. If Vault returns a non-null secret, re-encrypt with current CryptoKey and call `saveProviderApiKey(provider, secret)` to persist locally. Set `decryptedResult = secret`.
4. Return `decryptedResult` (plaintext from local decrypt, Vault, or null)
5. If Vault read fails or returns null, return null (existing behavior)

The Vault read must be wrapped in its own try/catch so a network error during fallback does not surface as an exception — it should degrade to returning null with a console warning.

**Patterns to follow:**
- Existing `getDecryptedApiKeyForProvider()` local-decrypt logic (lines 486-523) for structure
- `storeCredential()` call in `saveProviderApiKey()` (line 548) for Vault interaction pattern
- Existing try/catch with console.warn for error handling (lines 506-509)

**Test scenarios:**

- Happy path: Local decryption succeeds with valid CryptoKey → returns plaintext (no Vault call, verify `readCredential` is NOT called)
- Happy path: Local decryption fails, encrypted data exists, Vault returns plaintext → returns plaintext, re-encrypts locally (verify `saveProviderApiKey` is called to persist)
- Happy path: Local decryption fails, encrypted data exists, Vault returns plaintext → subsequent call decrypts locally without Vault (self-healing verified)
- Edge case: Local decryption fails, no encrypted data exists for provider → returns null, skips Vault call entirely
- Edge case: Local decryption fails, encrypted data exists, Vault returns null (not configured) → returns null
- Error path: Local decryption fails, encrypted data exists, Vault read throws (network error) → returns null, console.warn logged
- Error path: Local decryption fails, encrypted data exists, Vault returns key but re-encrypt/save fails → still returns plaintext (key usable for this session)
- Error path: User is unauthenticated (no Supabase session) → Vault read returns null gracefully (handled by `readCredential` internals), returns null
- Integration: Ollama provider is excluded from Vault fallback (ollama has no API keys, uses server URL)

**Verification:**
- Existing tests in `cryptoKeyPersistence.integration.test.ts` continue to pass
- New unit tests in `aiConfiguration.test.ts` cover the Vault fallback paths
- Manually: save Gemini key, clear IndexedDB ("CryptoKeyStore"), reload page, verify key is still available without re-entering

- [ ] **Unit 2: Update integration test for IndexedDB-clearing scenario**

**Goal:** Update the existing integration test that documents "IndexedDB cleared → null" to verify the new Vault fallback behavior.

**Requirements:** R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/__tests__/cryptoKeyPersistence.integration.test.ts`
- Modify: `src/lib/__tests__/aiConfiguration.test.ts`

**Approach:**

The existing test at line 82-93 of `cryptoKeyPersistence.integration.test.ts` expects `null` after IndexedDB clearing. Update it to expect the original key (recovered from Vault) when a Vault mock returns the plaintext.

Add a new test case: "returns null when IndexedDB is cleared AND Vault has no credential" to preserve coverage for the degraded case.

**Patterns to follow:**
- Existing `fake-indexeddb/auto` setup in the integration test
- Existing Vault mock pattern in `vaultCredentials.test.ts`

**Test scenarios:**

- When IndexedDB is cleared and Vault has the credential → returns plaintext (Vault fallback succeeds)
- When IndexedDB is cleared and Vault is empty → returns null (graceful degradation)
- When IndexedDB is cleared and Vault returns the key → next call decrypts locally (self-healing)

**Verification:**
- `npm run test:unit` passes with the updated expectations
- The test that previously asserted "cleared IndexedDB → null" now asserts either recovery or null depending on Vault state

## System-Wide Impact

- **Interaction graph:** `getDecryptedApiKeyForProvider()` is called by: `getLLMClient()`, `getLLMClientForProvider()`, `getNoteQAAvailability()`, `ProviderKeyAccordion`, `FeatureModelOverridePanel`, `AIConfigurationSettings`. All benefit transparently from the fallback — no caller changes needed.
- **Error propagation:** Vault read failures are swallowed with console.warn — the function returns `null` as before, and callers already handle `null` by showing "No API key configured" errors.
- **State lifecycle risks:** The re-encrypt-on-fallback path calls `saveProviderApiKey()` which triggers `localStorage.setItem()` + `dispatchEvent('ai-configuration-updated')`. This could cause a re-render cycle if called during a React render. Since `getDecryptedApiKeyForProvider()` is always called from async contexts (event handlers, effects), this is safe — but worth noting.
- **API surface parity:** No API changes. Return type, parameters, and error behavior are preserved.
- **Integration coverage:** The Vault fallback crosses IndexedDB → localStorage → Supabase Edge Function boundaries. Unit tests mock the Vault layer; the integration test in `cryptoKeyPersistence.integration.test.ts` covers the crypto+IDB+localStorage chain.
- **Unchanged invariants:** `getDecryptedApiKeyForProvider()` still returns `null` for unconfigured providers. Ollama is still excluded (uses server URL, not Vault credential). The encryption path (`saveProviderApiKey`, `encryptData`) is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Vault read adds ~200-500ms latency to first `getDecryptedApiKeyForProvider()` call after IndexedDB clearing | Acceptable — this is a recovery path, not the hot path. Normal operation (IndexedDB intact) has zero added latency. |
| `saveProviderApiKey()` re-encryption triggers `ai-configuration-updated` event, causing React re-renders | The event is already dispatched during normal save flows and consumers handle it correctly. The re-encryption happens during an async function call, not during render. |
| Vault read could expose plaintext key in memory longer than current flow | The key is already held in memory by the caller (e.g., `getLLMClient()` stores it in the `ProxyLLMClient` instance). No regression. |

## Sources & References

- Origin: User report — API keys require re-entry after page reload / codebase update
- Related code: [src/lib/aiConfiguration.ts:486-523](src/lib/aiConfiguration.ts#L486-L523) (change site), [src/lib/vaultCredentials.ts:127-131](src/lib/vaultCredentials.ts#L127-L131) (Vault read function), [src/lib/crypto.ts:42-70](src/lib/crypto.ts#L42-L70) (CryptoKey lifecycle)
- Related tests: [src/lib/__tests__/cryptoKeyPersistence.integration.test.ts:82-93](src/lib/__tests__/cryptoKeyPersistence.integration.test.ts#L82-L93) (existing cleared-IDB test), [src/lib/__tests__/aiConfiguration.test.ts](src/lib/__tests__/aiConfiguration.test.ts) (primary unit test file)
