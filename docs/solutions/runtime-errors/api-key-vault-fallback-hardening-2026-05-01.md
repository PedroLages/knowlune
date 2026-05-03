---
title: API key Vault fallback hardening — CQS, dedup, retry, and edge cases
date: 2026-05-01
category: docs/solutions/runtime-errors/
module: aiConfiguration
problem_type: runtime_error
component: authentication
severity: high
symptoms:
  - "7 component re-renders on every Vault recovery due to saveProviderApiKey firing ai-configuration-updated event"
  - "Empty strings from edge-case decryption silently accepted as valid API keys"
  - "Duplicate Supabase Vault Edge Function invocations when multiple components mount simultaneously"
  - "Permanent Vault fallback failure after a single transient network error"
  - "Legacy apiKeyEncrypted path had no Vault fallback integration tests"
root_cause: logic_error
resolution_type: code_fix
tags:
  - vault-fallback
  - crypto-keys
  - indexeddb
  - dexie
  - web-crypto
  - concurrent-reads
  - retry-logic
  - cqs-violation
---

# API key Vault fallback hardening — CQS, dedup, retry, and edge cases

## Problem

The Vault fallback in `getDecryptedApiKeyForProvider()` recovered encrypted API keys from Supabase Vault when the local IndexedDB crypto key was lost, but the initial implementation had six hardening gaps: a CQS violation causing unnecessary re-renders, a too-weak null guard, no in-flight deduplication for concurrent reads, no retry for transient network errors, and missing integration tests for the legacy single-key path.

## Symptoms

- Every Vault-recovered key triggered `window.dispatchEvent(new CustomEvent('ai-configuration-updated'))`, causing all 7 subscribing components to re-render unnecessarily.
- An empty string produced by edge-case decryption passed the strict `=== null` guard and was treated as a valid API key.
- Multiple components mounting simultaneously each independently called the Vault Edge Function, producing duplicate network requests for the same credential.
- A single transient network failure (e.g., DNS blip, connection reset) caused permanent Vault fallback failure because there was no retry and no way to distinguish auth-failure from network-error.
- The legacy `saveAIConfiguration()`/`apiKeyEncrypted` single-key path had no tests covering Vault-based recovery after IndexedDB loss.

## What Didn't Work

- **Using `saveProviderApiKey()` for re-encryption**: This public function fires the `ai-configuration-updated` CustomEvent, which is correct for user-initiated saves but wrong for a silent Vault recovery that happens transparently during a read.
- **Strict `=== null` check**: Failed to handle the edge case where decryption succeeds but produces an empty string, which should also be treated as no valid key.
- **Independent network calls**: Each call to `getDecryptedApiKeyForProvider()` independently invoked the Vault fallback with no coordination, so N concurrent calls produced N Edge Function invocations.
- **Binary `string | null` return from `readCredential()`**: Gave no way to distinguish "credential not found" (expected, no retry) from "network error" (transient, should retry), so the only safe option was to never retry.

## Solution

**1. Silent re-encryption helper (CQS fix).** Extracted `reEncryptProviderKeyLocally()` that writes encrypted data directly to localStorage without dispatching events:

```typescript
async function reEncryptProviderKeyLocally(
  provider: AIProviderId,
  apiKey: string
): Promise<AIConfigurationSettings> {
  const encrypted = await encryptData(apiKey)
  const current = getAIConfiguration()
  const updatedProviderKeys: Partial<Record<AIProviderId, EncryptedData>> = {
    ...current.providerKeys,
    [provider]: encrypted,
  }
  const updated: AIConfigurationSettings = {
    ...current,
    providerKeys: updatedProviderKeys,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}
```

**2. Falsy guard for empty-string edge case.** Changed from `decryptedResult === null` to `!decryptedResult`:

```typescript
// Before: strict null check misses empty string
if (decryptedResult === null && hasEncryptedData) { /* Vault fallback */ }

// After: falsy check catches empty strings too
if (!decryptedResult && hasEncryptedData) { /* Vault fallback */ }
```

**3. In-flight promise cache for concurrent dedup.** Module-level `Map<AIProviderId, Promise<string | null>>` shared across all concurrent callers:

```typescript
const inFlightVaultReads = new Map<AIProviderId, Promise<string | null>>()

// Inside Vault fallback path:
let vaultSecretPromise: Promise<string | null>
const inFlight = inFlightVaultReads.get(provider)
if (inFlight) {
  vaultSecretPromise = inFlight  // reuse existing in-flight request
} else {
  vaultSecretPromise = readVaultCredentialWithRetry(provider)
  inFlightVaultReads.set(provider, vaultSecretPromise)
  vaultSecretPromise.finally(() => inFlightVaultReads.delete(provider))
}
const vaultSecret = await vaultSecretPromise
```

**4. Discriminated union + single retry for transient errors.** Switched from `readCredential()` returning `string | null` to `readCredentialWithStatus()` returning `{ ok: true, value: string | null } | { ok: false, reason: 'unauthenticated' | 'auth-failed' | 'network-error' | 'unknown' }`, with a wrapper that retries once for transient failures:

```typescript
async function readVaultCredentialWithRetry(
  provider: AIProviderId
): Promise<string | null> {
  const result = await readCredentialWithStatus('ai-provider', provider)
  if (result.ok) {
    return result.value
  }
  if (result.reason === 'unauthenticated' || result.reason === 'auth-failed') {
    return null  // don't retry auth failures
  }
  // Retry once after 1s for transient errors
  await new Promise(resolve => setTimeout(resolve, 1000))
  const retryResult = await readCredentialWithStatus('ai-provider', provider)
  return retryResult.ok ? retryResult.value : null
}
```

**5. Legacy path integration tests.** Added two tests covering the `apiKeyEncrypted` single-key path with Vault fallback:

```typescript
it('recovers legacy apiKeyEncrypted key from Vault when IndexedDB is cleared', async () => {
  await saveAIConfiguration({ provider: 'openai' }, 'sk-legacy-test-key')
  _resetKeyCache()
  await _resetDBForTesting()
  indexedDB.deleteDatabase('CryptoKeyStore')
  vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: 'sk-legacy-test-key' })
  const decrypted = await getDecryptedApiKeyForProvider('openai')
  expect(decrypted).toBe('sk-legacy-test-key')
})

it('returns null when legacy apiKeyEncrypted with cleared IndexedDB and empty Vault', async () => {
  await saveAIConfiguration({ provider: 'openai' }, 'sk-legacy-will-be-lost')
  _resetKeyCache()
  await _resetDBForTesting()
  indexedDB.deleteDatabase('CryptoKeyStore')
  vaultMocks.readCredentialWithStatus.mockResolvedValue({ ok: true, value: null })
  const decrypted = await getDecryptedApiKeyForProvider('openai')
  expect(decrypted).toBeNull()
})
```

## Why This Works

- **CQS separation**: `reEncryptProviderKeyLocally()` is a pure write function. It mutates localStorage synchronously and returns the updated settings, with no event dispatch. Callers that need to notify the UI (user-initiated saves) call `saveProviderApiKey()`; silent recovery uses the private helper. This prevents the 7-component cascade re-render.

- **Falsy guard**: Any value that coerces to falsy — null, undefined, or empty string — now triggers the Vault fallback check. An empty string cannot be a valid API key, so treating it as "no key" is correct.

- **Promise cache dedup**: By storing the in-flight promise in a module-scoped Map keyed by provider ID, all concurrent callers for the same provider await the same Promise. The `.finally()` cleanup prevents stale entries from accumulating. No additional Edge Function invocations beyond the first one.

- **Discriminated union retry**: The `reason` field cleanly separates permanent failures (auth) from transient ones (network). The single 1-second retry is sufficient for short-lived disruptions (TCP reset, DNS resolution glitch) without introducing excessive latency for persistent failures.

- **Legacy test coverage**: The two new tests exercise both the happy path (key found in Vault and re-encrypted locally) and the empty-vault path (key truly gone, return null), ensuring the `apiKeyEncrypted` legacy path has parity with the `providerKeys` path.

## Prevention

- **Always separate query from command**: When a function named `get...()` triggers a save as a side effect, extract a private helper that writes without signaling. Name it with a verb indicating it is a command (`reEncrypt...Locally()`), not a query.
- **Use falsy guards for deterministic-empty values**: When a function can return empty-string as well as null to indicate "no value," use `!result` rather than `result === null` to catch both cases.
- **Add in-flight dedup for any async I/O that can be called concurrently**: If multiple mount/effect paths can independently request the same resource, a module-level `Map<K, Promise<V>>` with `.finally()` cleanup eliminates redundant calls with minimal complexity.
- **Return discriminated unions from any I/O that can fail for different reasons**: A plain `string | null` collapses all failure modes. A `reason` field enables caller policy decisions (retry auth failures? no. retry network errors? yes).
- **Test the legacy path whenever testing the new path**: The `apiKeyEncrypted` single-key format and `providerKeys` multi-provider format share recovery logic. Both need `_resetDBForTesting()` + `indexedDB.deleteDatabase()` + Vault mock scenarios.

## Related

- [docs/solutions/2026-04-23-zombie-supabase-session.md](../2026-04-23-zombie-supabase-session.md) — Stale Supabase sessions cause silent Vault write failures for AI provider keys (same Vault + API key domain)
- [docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md](../logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md) — References `getDecryptedApiKeyForProvider` and its async decrypt patterns
- [docs/solutions/best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md](../best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md) — Governs `supabase.functions.invoke()` body-error guards (used by the Vault read path)
