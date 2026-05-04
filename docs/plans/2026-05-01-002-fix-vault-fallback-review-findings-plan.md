---
title: "fix: Harden Vault fallback against review findings — silent re-encrypt, dedup, retry, guard fix"
type: fix
status: active
date: 2026-05-01
origin: docs/plans/2026-05-01-001-fix-api-key-persistence-after-reload-plan.md
---

# Fix Review Findings in Vault Fallback

## Overview

The Vault fallback added in [#001](docs/plans/2026-05-01-001-fix-api-key-persistence-after-reload-plan.md) passed code review but 6 actionable findings were identified. This plan addresses them, with the central change being a silent re-encrypt helper that replaces the `saveProviderApiKey()` call during Vault recovery — eliminating the `ai-configuration-updated` event dispatch from a read function and the redundant fire-and-forget Vault re-write.

## Problem Frame

The current Vault fallback in `getDecryptedApiKeyForProvider()` has these issues:

1. **Re-encrypt dispatches `ai-configuration-updated`** (P1) — 7 components/hooks listen for this event. Calling `saveProviderApiKey()` during Vault recovery triggers all of them as a side effect of a read operation, causing unnecessary re-renders and potential re-entrant cycles.

2. **Null-only guard misses empty-string decryption** (P2) — `decryptedResult === null` at lines 514 and 525 won't catch a validly-encrypted empty plaintext, skipping the legacy and Vault fallback cascade. Low practical impact (empty keys are rejected by validation), but semantically narrower than the accumulator pattern intends.

3. **No in-flight deduplication for concurrent Vault reads** (P2) — When the same provider is resolved from multiple call sites within the same event-loop tick (e.g., rapid React re-renders, or a component and a hook both calling `getDecryptedApiKeyForProvider('gemini')` concurrently), each call independently triggers a Vault Edge Function invocation.

4. **No retry for transient Vault failures** (P2) — A single flaky network response from the Vault Edge Function returns null, forcing the user to re-enter their API key. The original plan chose simplicity over the resolverFactory retry ladder, but a lightweight 2-attempt retry is proportionate.

5. **Legacy `apiKeyEncrypted` Vault fallback lacks integration test coverage** (P2) — The `providerKeys` path is integration-tested with real crypto, but the legacy `apiKeyEncrypted` path is only unit-tested with mocked crypto.

6. **localStorage quota exceeded during re-encrypt creates perpetual Vault round-trips** (P2) — Partially mitigated by the existing re-encrypt try/catch (key is still returned). Further mitigation: the silent re-encrypt helper (Unit 1) writes only to localStorage without the Vault fire-and-forget, reducing the write payload and eliminating the redundant Vault call.

## Requirements Trace

### Side Effects & Guard Logic

- **R1.** `getDecryptedApiKeyForProvider()` must not dispatch `ai-configuration-updated` during Vault recovery (read function, no side effects)
- **R2.** Empty-string decryption results must trigger the same fallback cascade as `null` (legacy fallback, Vault fallback)

### Concurrency & Reliability

- **R3.** Concurrent Vault reads for the same provider within the same tick must coalesce into a single Edge Function call
- **R4.** Transient Vault network failures must be retried once (2 attempts total) before returning null

### Test Coverage

- **R5.** Legacy `apiKeyEncrypted` Vault fallback must have real-crypto integration test coverage

### API Contract

- **R6.** `getDecryptedApiKeyForProvider()` API contract must be preserved: signature, return type, and error behavior are unchanged. The removal of `ai-configuration-updated` dispatch during Vault recovery is an intentional behavioral change — the event is a side effect, not part of the API contract.

## Scope Boundaries

- Only the Vault fallback path in `getDecryptedApiKeyForProvider()` is modified
- No changes to `saveProviderApiKey()`, `saveAIConfiguration()`, or `deleteProviderApiKey()` — those are correctly dispatched writes
- No changes to Supabase Vault Edge Function or `vaultCredentials.ts`
- No changes to the `hasEncryptedData` gate (by design — see "Deferred Design Decision" below)
- No changes to UI components or hooks

### Deferred Design Decision

The `hasEncryptedData` gate requires encrypted data in localStorage as proof a key was configured. This means full site-data clears (which wipe both IndexedDB and localStorage) still lose API keys. The gate was an explicit design choice in [#001](docs/plans/2026-05-01-001-fix-api-key-persistence-after-reload-plan.md) to avoid unnecessary Vault network calls for unconfigured providers. A lightweight `checkCredential` probe when localStorage is empty is a separate enhancement (requires changes to the Vault credential check path and possibly a new `credentialType` for existence-checking). Deferred to a future iteration.

### Deferred to Separate Tasks

- Vault Edge Function timeout configuration (in `vaultCredentials.ts`, not part of this fix scope)
- `decryptData` failure mode differentiation (pre-existing, broader crypto layer change)
- Cross-tab credential delete race (pre-existing, low probability, requires cross-tab synchronization)

## Context & Research

### Relevant Code and Patterns

- [src/lib/aiConfiguration.ts:486-551](src/lib/aiConfiguration.ts#L486-L551) — `getDecryptedApiKeyForProvider()` (current state after the Vault fallback was added)
- [src/lib/aiConfiguration.ts:570-599](src/lib/aiConfiguration.ts#L570-L599) — `saveProviderApiKey()` (called during Vault re-encrypt; dispatches event on line 596)
- [src/lib/vaultCredentials.ts:127-133](src/lib/vaultCredentials.ts#L127-L133) — `readCredential()` (Vault read function)
- [src/lib/vaultCredentials.ts:135-180](src/lib/vaultCredentials.ts#L135-L180) — `readCredentialWithStatus()` (discriminated-result variant for auth-failure detection)
- [src/lib/__tests__/aiConfiguration.test.ts](src/lib/__tests__/aiConfiguration.test.ts) — Unit tests for Vault fallback (10 tests added in #001)
- [src/lib/__tests__/cryptoKeyPersistence.integration.test.ts](src/lib/__tests__/cryptoKeyPersistence.integration.test.ts) — Integration tests (3 new tests added in #001)

### Event Listeners (7 components/hooks)

| Component/Hook | Line | Purpose |
|---|---|---|
| `AIUnavailableBadge.tsx` | 43 | Availability badge refresh |
| `AISummaryPanel.tsx` | 58 | Summary panel reconfiguration |
| `ProviderKeyAccordion.tsx` | 116 | Key status refresh |
| `FeatureModelOverridePanel.tsx` | 108 | Model override panel refresh |
| `AIConfigurationSettings.tsx` | 142 | Settings form update |
| `useMissingCredentials.tsx` | 145 | Credential banner refresh |
| `useNoteQAAvailability.ts` | 51 | Note QA availability check |

All 7 fire when `saveProviderApiKey()` dispatches the event during Vault recovery — a read operation triggering a full UI refresh cycle across all AI configuration surfaces.

### Institutional Learnings

- [docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md](docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md) — Documents that 6 components listen to `ai-configuration-updated` (a 7th was identified in this plan: `useNoteQAAvailability`) and warns about side effects in read functions. Recommends extracting a silent re-encrypt helper.

### External References

- N/A — codebase-internal fix using existing infrastructure

## Key Technical Decisions

- **Extract silent `reEncryptProviderKeyLocally()` helper** (not inline in `getDecryptedApiKeyForProvider`): Keeps the read function readable while isolating the write concern. The helper encrypts, writes to localStorage, and returns — no event dispatch, no Vault call. The Vault already has the plaintext (it was just read from it), so re-writing is redundant.

- **Change `=== null` to `!==` / `!` for guard checks**: The `decryptData` return type is `Promise<string>` — it cannot return `0`, `false`, or `undefined`. Only `null` (from the accumulator default) and `""` (valid empty decryption) need catching. Using `!decryptedResult` is safe and idiomatic.

- **Module-level `Map` for in-flight deduplication** (not a class or Zustand store): A simple `Map<AIProviderId, Promise<string | null>>` scoped to the module is sufficient. Entries are deleted when the promise settles. This is the same pattern used by TanStack Query's `queryClient.fetchQuery` and is well-understood.

- **Two-attempt retry with 1s delay** (not resolverFactory retry ladder): The resolverFactory retry-on-401 pattern in `credentials/resolverFactory.ts` is designed for sync credentials (ABS/OPDS) where silent failure breaks background sync. For AI provider keys, a simple 2-attempt retry catches transient network blips without the complexity of auth refresh, cache invalidation, and telemetry. Skip retry on 401/403 by checking `readCredentialWithStatus` result reason.

- **`readCredential` stays the primary interface**: Retry logic wraps `readCredential`, not `readCredentialWithStatus`. The inner retry helper uses `readCredentialWithStatus` to detect auth failures (skip retry), but the outer interface remains the same `Promise<string | null>`.

## Implementation Units

- [ ] **Unit 1: Extract silent re-encrypt helper and use it in Vault fallback**

**Goal:** Replace `saveProviderApiKey()` in the Vault fallback path with a private helper that writes to localStorage without dispatching `ai-configuration-updated` or calling `storeCredential`.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/lib/aiConfiguration.ts` (extract helper, update Vault fallback call site)
- Modify: `src/lib/__tests__/aiConfiguration.test.ts` (update re-encrypt assertions)

**Approach:**

Extract a private function `reEncryptProviderKeyLocally(provider, apiKey)` that:
1. Calls `encryptData(apiKey)` (same Web Crypto encrypt as `saveProviderApiKey`)
2. Reads current config via `getAIConfiguration()`
3. Spreads `providerKeys[provider]` with the new encrypted data
4. Calls `localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))`
5. Returns the updated config — no event dispatch, no Vault call

Replace the `await saveProviderApiKey(provider, vaultSecret)` call at line 536 with `await reEncryptProviderKeyLocally(provider, vaultSecret)`.

Add `reEncryptProviderKeyLocally` to the internal exports (for testing — prefix with `_` convention: `_reEncryptProviderKeyLocallyForTesting`).

**Patterns to follow:**
- `saveProviderApiKey()` lines 570-599 for localStorage write pattern (minus event dispatch and Vault call)
- `deleteProviderApiKey()` lines 613-632 for config spread-and-write pattern
- Existing `_`-prefixed test exports in `aiConfiguration.ts` (if any) or `crypto.ts` (`_resetKeyCache`)

**Test scenarios:**

- Happy path: `_reEncryptProviderKeyLocally('gemini', 'test-key')` writes encrypted data to `localStorage.getItem('ai-configuration')` with correct `providerKeys.gemini` shape
- Edge case: `_reEncryptProviderKeyLocally` does NOT dispatch `ai-configuration-updated` (verify `window.dispatchEvent` is NOT called)
- Edge case: `_reEncryptProviderKeyLocally` does NOT call `storeCredential` (verify Vault mock is NOT called)
- Integration: Vault fallback in `getDecryptedApiKeyForProvider` uses `_reEncryptProviderKeyLocally` instead of `saveProviderApiKey` — verify localStorage is updated but event is NOT dispatched
- Existing test update: "re-encrypts locally when Vault fallback succeeds" test — update to verify `dispatchEvent` was NOT called and `storeCredential` was NOT called

**Verification:**
- `npm run test:unit` passes (aiConfiguration.test.ts, cryptoKeyPersistence.integration.test.ts)
- Manual: save a key in Settings → clear IndexedDB → reload → verify key is recovered AND Settings UI doesn't flash/re-render unexpectedly

---

- [ ] **Unit 2: Widen null-only guard to handle empty-string decryption**

**Goal:** Change `decryptedResult === null` guards to `!decryptedResult` so empty-string decryption results also trigger the fallback cascade.

**Requirements:** R2, R6

**Dependencies:** None (independent of Unit 1, but can stack on it)

**Files:**
- Modify: `src/lib/aiConfiguration.ts` (lines 514, 525)
- Modify: `src/lib/__tests__/aiConfiguration.test.ts` (add empty-string test case)

**Approach:**

Two sites need the change:
1. Line 514: `if (decryptedResult === null && provider === config.provider && config.apiKeyEncrypted)` → `if (!decryptedResult && provider === config.provider && config.apiKeyEncrypted)`
2. Line 525: `if (decryptedResult === null)` → `if (!decryptedResult)`

`decryptData` returns `Promise<string>` — it cannot return `0`, `false`, or `undefined`. The only falsy values possible are `null` (accumulator default — no decryption attempted or decryption failed) and `""` (validly encrypted empty plaintext). Using `!` is safe and catches both.

**Patterns to follow:**
- Existing truthiness guards in the codebase: `if (vaultSecret)` at line 533, `if (providerKeyData)` at line 505

**Test scenarios:**

- Edge case: encrypt empty string, store as provider key, CryptoKey intact — `decryptData` returns `""`, `!""` is `true`, Vault fallback fires. If Vault has no better key, returns `""`. This is the correct behavior under `!decryptedResult`: empty-string and null both trigger the same fallback cascade. The Vault round-trip is harmless since the fallback returns whatever Vault has (or the empty string if Vault is empty).
- Edge case: encrypt empty string with old key, corrupt CryptoKey (clear IndexedDB) — `decryptData` throws, `decryptedResult` stays `null`, `!null` is `true`, Vault fallback fires, recovering the real key from Vault.
- Happy path: existing tests that decrypt successfully (non-empty) still pass — `!decryptedResult` evaluates the same as `decryptedResult === null` for non-empty strings (they are truthy).

**Verification:**
- `npm run test:unit` passes
- Existing tests for Vault fallback still pass (no regression for non-empty keys)

---

- [ ] **Unit 3: Add in-flight Vault read deduplication**

**Goal:** Prevent duplicate Vault Edge Function calls when multiple `getDecryptedApiKeyForProvider()` invocations for the same provider happen concurrently.

**Requirements:** R3

**Dependencies:** None (independent of Units 1-2, but all three stack cleanly)

**Files:**
- Modify: `src/lib/aiConfiguration.ts` (add module-level cache, wrap Vault read)
- Modify: `src/lib/__tests__/aiConfiguration.test.ts` (add concurrency test)

**Approach:**

Add a module-level cache near the top of the Vault fallback section:

```
const inFlightVaultReads = new Map<AIProviderId, Promise<string | null>>()
```

In the Vault fallback path, before calling `readCredential`:
1. Check `inFlightVaultReads.get(provider)` — if found, await the cached promise
2. If not found, create the promise (`readCredential('ai-provider', provider)`), store it, and `.finally(() => inFlightVaultReads.delete(provider))` to clean up after settlement
3. Both success and failure paths delete the cache entry — a failed read should be retried on the next call

This is a single-tick dedup (across concurrent calls within the same event loop), not a TTL cache. Failed reads are not cached — the entry is deleted immediately after settlement.

**Patterns to follow:**
- TanStack Query's `fetchQuery` internal dedup (conceptual, no code dependency)
- Module-level singleton pattern already used in `aiConfiguration.ts` for `cachedDefaults` and other state

**Test scenarios:**

- Happy path: call `getDecryptedApiKeyForProvider('gemini')` twice concurrently (Promise.all or unawaited calls) — `readCredential` is called exactly once, both calls return the same value
- Edge case: first concurrent call succeeds, second concurrent call gets the same cached result without a second Vault call
- Edge case: first concurrent call fails, cache entry is deleted, second standalone call retries Vault fresh
- Edge case: different providers (gemini + openai) called concurrently — each gets its own cache entry, `readCredential` is called once per provider

**Verification:**
- `npm run test:unit` passes with new concurrency tests
- Manual: open Settings AI Configuration page — check network tab to verify at most 1 Vault Edge Function call per provider on mount

---

- [ ] **Unit 4: Add Vault read retry (2 attempts, 1s backoff)**

**Goal:** Retry transient Vault network failures once before returning null.

**Requirements:** R4

**Dependencies:** In-flight dedup (Unit 3) should land first — the retry wrapper composes naturally with the dedup cache

**Files:**
- Modify: `src/lib/aiConfiguration.ts` (add retry wrapper around `readCredential`)
- Modify: `src/lib/__tests__/aiConfiguration.test.ts` (add retry behavior tests)

**Approach:**

Add a private helper `readVaultCredentialWithRetry(provider)` that:
1. Calls `readCredentialWithStatus('ai-provider', provider)` to get the discriminated result
2. If `ok: true`, returns the value (null or string)
3. If `ok: false` with `reason: 'unauthenticated'` or `reason: 'auth-failed'`, returns null immediately (no retry for auth failures — user must re-authenticate)
4. If `ok: false` with `reason: 'error'` (network/unknown), waits 1s and retries once
5. If both attempts fail, returns null

Replace the direct `readCredential('ai-provider', provider)` call in the Vault fallback path with `readVaultCredentialWithRetry(provider)`. The in-flight dedup cache (Unit 3) wraps this retry helper — so concurrent callers share the same retry promise.

The `readCredentialWithStatus` import must be added to the vaultCredentials import (line 20 of `aiConfiguration.ts`).

**Test mock update:** The existing `vaultMocks` object in `aiConfiguration.test.ts` currently exports only `readCredential`, `storeCredential`, and `checkCredential`. After adding `readCredentialWithStatus` to the import, the hoisted mock must also expose `readCredentialWithStatus: vi.fn()`. Test implementations for Unit 4 will use `vaultMocks.readCredentialWithStatus.mockResolvedValue(...)` with discriminated-result shapes (`{ ok: true, value: 'key' }`, `{ ok: false, reason: 'error' }`, `{ ok: false, reason: 'unauthenticated' }`).

**Patterns to follow:**
- `readCredential()` implementation in [vaultCredentials.ts:127-133](src/lib/vaultCredentials.ts#L127-L133) — wraps `readCredentialWithStatus`
- `resolverFactory.ts` retry pattern (conceptual — skip auth refresh, keep it simple)
- Existing `await new Promise(r => setTimeout(r, ms))` delay pattern if used elsewhere in the codebase

**Test scenarios:**

- Happy path: Vault succeeds on first attempt → returns key, no retry
- Happy path: Vault fails with network error on first attempt, succeeds on retry → returns key, exactly 2 `readCredential` calls
- Error path: Vault fails with network error on both attempts → returns null, exactly 2 `readCredential` calls
- Error path: Vault returns `reason: 'unauthenticated'` → returns null immediately, no retry (1 call)
- Error path: Vault returns `reason: 'auth-failed'` → returns null immediately, no retry (1 call)
- Edge case: Retry delay is ~1s (verify with fake timers or approximate timing check)

**Verification:**
- `npm run test:unit` passes with new retry tests
- Manual: disconnect network → trigger Vault fallback → verify it returns null after ~1s (one 1s retry delay) rather than immediately

---

- [ ] **Unit 5: Add integration test for legacy apiKeyEncrypted Vault fallback**

**Goal:** Add a real-crypto integration test for the legacy `apiKeyEncrypted` Vault fallback path, matching the existing coverage for the `providerKeys` path.

**Requirements:** R5

**Dependencies:** Unit 1 (the silent re-encrypt helper changes the re-encrypt behavior, so integration tests should land after it)

**Files:**
- Modify: `src/lib/__tests__/cryptoKeyPersistence.integration.test.ts`

**Approach:**

Add a new test case in the `API key persistence across page refresh` describe block:

1. Save a global API key via `saveAIConfiguration({ provider: 'openai' }, 'sk-legacy-test-key')` — this stores in `apiKeyEncrypted` (legacy path), not `providerKeys`
2. Clear IndexedDB (simulate CryptoKey loss)
3. Mock Vault to return `'sk-legacy-test-key'`
4. Call `getDecryptedApiKeyForProvider('openai')`
5. Assert the key is recovered from Vault
6. Assert `readCredential` was called with `('ai-provider', 'openai')`

Also add a second test: "legacy apiKeyEncrypted with cleared IndexedDB and empty Vault returns null" — mirroring the existing `providerKeys` null test.

**Patterns to follow:**
- Existing Vault-recovery integration test at line 87-98 of the integration test file
- Existing Vault-empty integration test at line 100-112

**Test scenarios:**

- Happy path: legacy `apiKeyEncrypted` key saved, IndexedDB cleared, Vault returns key → recovered and re-encrypted
- Error path: legacy `apiKeyEncrypted` key saved, IndexedDB cleared, Vault empty → returns null
- Self-healing (optional, can infer from Unit 1 tests): legacy path recovery also re-encrypts locally

**Verification:**
- `npm run test:unit` passes with new integration tests
- Both providerKeys and apiKeyEncrypted paths have real-crypto integration coverage for Vault fallback

## System-Wide Impact

- **Interaction graph:** The silent re-encrypt helper (Unit 1) removes the `ai-configuration-updated` event from the Vault recovery path. The 7 components/hooks that listen for this event will no longer fire during recovery. This is the desired behavior — recovery is transparent to the UI.
- **Error propagation:** The retry wrapper (Unit 4) adds a 1s delay to the Vault fallback path on first failure. Callers already `await` this function and handle `null` as "no key configured" — the added latency is acceptable for a recovery path.
- **State lifecycle risks:** The silent re-encrypt helper writes only to localStorage (no Vault call). If localStorage is unavailable (quota, private browsing), the re-encrypt fails silently but the key is still returned (already set as `decryptedResult` before the re-encrypt attempt). The dedup cache is in-memory only and resets on page load — no stale cache risk.
- **API surface parity:** No API changes. `getDecryptedApiKeyForProvider()` signature, return type, and error behavior are preserved.
- **Integration coverage:** The dedup and retry behavior is unit-tested with mocks. Integration tests cover the full crypto + IndexedDB + localStorage chain for both `providerKeys` and `apiKeyEncrypted` paths.
- **Unchanged invariants:** `saveProviderApiKey()` and `saveAIConfiguration()` continue to dispatch `ai-configuration-updated` (write functions only). The `hasEncryptedData` gate is preserved (by design). Ollama is still excluded. The E2E test escape hatch is untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Unit 1 changes re-encrypt behavior — existing tests that asserted `saveProviderApiKey` behavior may need updating | The 3 new integration tests and 10 unit tests added in #001 explicitly test re-encrypt behavior. These will be updated as part of Unit 1. |
| Adding `readCredentialWithStatus` import for retry adds a new dependency | `readCredentialWithStatus` is already exported from the same `vaultCredentials.ts` module. The import is co-located with existing vaultCredentials imports. |
| Retry adds ~1s latency to Vault recovery path on first failure | Acceptable — this is a recovery path, not the hot path (IndexedDB-intact reads have zero added latency). The retry only fires on network errors, not on auth failures or missing credentials. |
| In-flight dedup cache is module-level (singleton) — could retain entries if promises never settle | `.finally(() => cache.delete(provider))` guarantees cleanup. If `readCredential` hangs (no timeout), the cache entry persists and **all subsequent calls for that provider block on the same hung promise** — a regression from the current behavior where each call spawns an independent `readCredential`. Mitigation: the Vault Edge Function timeout gap in `vaultCredentials.ts` (deferred to separate tasks) should be addressed before or alongside this change. Until then, a hung Edge Function already blocks the app (the first call hangs the UI), and the user would page-refresh in either case. |

## Sources & References

- **Origin plan:** [docs/plans/2026-05-01-001-fix-api-key-persistence-after-reload-plan.md](docs/plans/2026-05-01-001-fix-api-key-persistence-after-reload-plan.md)
- **Code review:** `.context/compound-engineering/ce-review/20260501-194619-ad16b0f3/` (9 agents, 6 actionable findings)
- Related code: [src/lib/aiConfiguration.ts:486-551](src/lib/aiConfiguration.ts#L486-L551), [src/lib/vaultCredentials.ts:127-180](src/lib/vaultCredentials.ts#L127-L180)
- Related tests: [src/lib/__tests__/aiConfiguration.test.ts](src/lib/__tests__/aiConfiguration.test.ts), [src/lib/__tests__/cryptoKeyPersistence.integration.test.ts](src/lib/__tests__/cryptoKeyPersistence.integration.test.ts)
- Known pattern: [docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md](docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md) (event dispatch in read functions)
