---
title: "fix: AI features not working — API key persistence and error diagnostics"
type: fix
status: active
date: 2026-05-22
deepened: 2026-05-22
---

# Fix: AI Features Not Working in Production

## Overview

Fix two root causes that prevent AI features (chat, video summaries, Q&A from notes, AI tutor) from working on the production deployment at `knowlune.pedrolages.net`: (1) API keys become unreadable after IndexedDB clears the encryption key, forcing re-entry, and (2) Edge Function errors are swallowed into generic messages that give the user no clue what went wrong.

The Supabase Edge Functions are deployed and active. The URL routing is correct. The network path works. The problems are in **key persistence** and **error observability**.

## Problem Frame

When a user enters their API key in Settings → Integrations & Data and attempts to use any AI feature on `knowlune.pedrolages.net`, one of two things happens:

1. **The API key silently disappears.** The key is AES-GCM encrypted with a CryptoKey stored in IndexedDB. When IndexedDB is cleared (browser restart, storage pressure, private browsing), the encryption key is permanently lost. The encrypted ciphertext remains in localStorage but is undecryptable. The Supabase Vault backup exists (`vault-credentials` Edge Function is deployed) but the Vault write in `saveProviderApiKey()` is fire-and-forget — failures are swallowed with `console.warn`. The user sees no indication that their key was lost; they just get a generic error when AI fails.

2. **Errors are invisible.** When the `ai-stream` Edge Function returns an error (invalid API key, provider unreachable, model not found), the `ProxyLLMClient` receives a non-2xx HTTP response and throws `LLMError` with the raw server message. But the server messages are technical (`"Provider not configured"`, `"No API key available for provider: anthropic"`) and the client wraps them in `"AI proxy error: {message}"` — which the UI may display as a toast or swallow entirely, giving the user no actionable information.

The underlying infrastructure is healthy:
- All 14 Supabase Edge Functions are deployed and active on project `chyvhrbtttpumsyuhgbu`
- The BYOK flow (user provides their own API key in the request body) works — the Edge Function receives the key and forwards it to the AI provider
- The 3-tier model resolution cascade (user override → feature default → provider default) correctly selects the right model
- The consent enforcement (`assertAIFeatureConsent`) correctly gates AI features behind authentication and consent

The AI provider platform keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) are intentionally **not** set as Supabase secrets. Knowlune is BYOK-first: users bring their own keys. This is by design.

## Requirements Trace

**Key Persistence**
- R1. An API key entered once in Settings must remain usable across browser sessions; when Vault recovery is unavailable, the loss is detected and surfaced proactively
- R2. When the Vault backup write fails, the user must be informed so they know the key only exists locally

**Error Diagnostics**
- R3. When an AI request fails, the user must see a specific, actionable error message that identifies the problem (invalid key, provider unreachable, model not found, network error)
- R4. The Settings page must show whether the configured API key is healthy and whether the AI backend is reachable

## Scope Boundaries

- This plan fixes API key persistence and error observability on the production deployment
- This plan does NOT set AI provider platform keys on Supabase — the app remains BYOK-first
- This plan does NOT change the Supabase Edge Function implementations (they already return structured errors). The health check operates entirely client-side by probing the existing endpoint with a sentinel payload — no Edge Function modifications are needed.
- This plan does NOT add guest-mode AI support
- The consent/auth enforcement (`assertAIFeatureConsent`) is not modified
- Local dev server fixes (Express auto-start, Vite proxy routing) are out of scope — those only matter for `localhost:5173`

### Deferred to Separate Tasks

- Set AI provider platform keys on Supabase for a "zero-config" AI experience: separate task when platform-provided AI is prioritized
- Deploy Supabase Edge Functions to additional environments (staging): separate task
- Guest/offline AI mode: future iteration

## Context & Research

### Relevant Code and Patterns

**Client-side AI stack:**
- `src/lib/apiBaseUrl.ts` — URL resolution; resolves to `https://chyvhrbtttpumsyuhgbu.supabase.co/functions/v1/ai-stream` in production (correct)
- `src/ai/llm/proxy-client.ts` — sends AI requests to the Edge Function; error handling at lines 65-73 and 103-113 produces generic `LLMError` messages
- `src/ai/llm/factory.ts` — `getLLMClient()`, `withModelFallback()`, consent enforcement
- `src/ai/llm/client.ts` — `mapHttpStatusToLLMErrorCode()` maps HTTP statuses to error codes

**Key persistence:**
- `src/lib/cryptoKeyStore.ts` — standalone IndexedDB store for the AES-GCM CryptoKey; `loadCryptoKey()` returns null when IndexedDB is unavailable
- `src/lib/crypto.ts` — `getSessionKey()` silently generates a new key when IndexedDB fails (line 57), making old ciphertext permanently undecryptable
- `src/lib/aiConfiguration.ts` — `saveProviderApiKey()` (line 632) writes to localStorage and fire-and-forgets the Vault write (line 638); `getDecryptedApiKeyForProvider()` (line 538) attempts local decryption, then Vault fallback (lines 583-609)

**Edge Functions (server-side — not modified by this plan):**
- `supabase/functions/ai-stream/index.ts` — streaming AI endpoint; returns structured JSON errors on failure
- `supabase/functions/_shared/entitlement.ts` — `isBYOK()` detects user-provided keys; `resolveEntitlement()` checks subscription tier

**Settings UI:**
- `src/app/components/figma/AIConfigurationSettings.tsx` — provider selection, API key inputs, feature permission toggles
- `src/app/components/figma/ProviderKeyAccordion.tsx` — per-provider API key input with test/delete buttons

### Architecture Context

The production request flow is:

```
Browser (knowlune.pedrolages.net)
  → POST https://chyvhrbtttpumsyuhgbu.supabase.co/functions/v1/ai-stream
    → Supabase Edge Function (Deno)
      → isBYOK() check: user's API key found in request body → skip entitlement
      → Vercel AI SDK streamText() with user's key
      → SSE response stream back to browser
```

The Edge Functions are deployed and active. Six AI provider env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `ZHIPU_API_KEY`) are intentionally not set as Supabase secrets — the app is BYOK-first by design.

### Institutional Learnings

- `docs/plans/2026-04-24-005-refactor-migrate-to-supabase-cloud-plan.md` line 466: "Platform AI keys NOT set as secrets. Knowlune is BYOK-first"
- The `vault-credentials` Edge Function is deployed and active (confirmed returning 401 without JWT, not 404)

## Key Technical Decisions

- **Fix key persistence through observability, not architecture change.** The AES-GCM + IndexedDB CryptoKey + Vault architecture is sound for security. The fix adds health detection and user-visible status instead of weakening encryption. The Vault write in `saveProviderApiKey` is made `await`-ed so failures surface to the UI instead of being silently swallowed.

- **Map Edge Function errors to user-facing messages in the client.** The Edge Functions already return structured errors. The fix is on the client side: parse the error response body and produce actionable messages instead of wrapping the raw server text in a generic prefix. No Edge Function changes needed.

- **Health check is client-side only.** Instead of modifying the Edge Function, probe the existing `ai-stream` endpoint with a minimal sentinel POST payload (`{ _healthCheck: true }`). The Edge Function validates required fields (`provider`, `messages`) before processing; the sentinel payload fails this validation and returns a structured 400 error — or a 401 if the JWT is missing. Both are structured responses confirming the backend is reachable and responding. The existing Edge Functions remain unchanged.

## Open Questions

### Resolved During Planning

- **Are the Supabase Edge Functions deployed?** → Yes, all 14 functions are active on project `chyvhrbtttpumsyuhgbu` as of 2026-04-24.
- **Are AI provider platform keys set?** → No, intentionally not set. The app is BYOK-first.
- **Is the URL routing correct for production?** → Yes. `apiUrl('ai-stream')` correctly resolves to the Supabase Edge Function. The Service Worker does not intercept POST requests to `supabase.co`.

### Deferred to Implementation

- Exact UI copy for each error state — depends on design review
- Whether the health check should be a separate Edge Function or a query parameter on the existing one
- Whether to cache the API key health status between page loads

## Implementation Units

- [ ] **Unit 1: Harden API key persistence and surface crypto key loss**

**Goal:** When IndexedDB clears and the encryption key is lost, the user sees a clear status indicator in Settings instead of silently failing AI requests. When the Vault backup write fails, the user is warned.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/cryptoKeyStore.ts` — add `isCryptoKeyAvailable()` health check export
- Modify: `src/lib/aiConfiguration.ts` — `saveProviderApiKey()`: await the Vault write; `getDecryptedApiKeyForProvider()`: set `keyLostAt` timestamp when decryption fails; add `getAPIKeyHealth()` helper
- Modify: `src/app/components/figma/AIConfigurationSettings.tsx` — show per-provider key health indicators
- Modify: `src/app/components/figma/ProviderKeyAccordion.tsx` — show Vault write failure warning
- Test: `src/lib/__tests__/aiConfiguration.test.ts` (extend existing tests)

**Approach:**
- In `cryptoKeyStore.ts`, export `isCryptoKeyAvailable()` that tests whether IndexedDB is accessible and the key record exists
- In `aiConfiguration.ts`:
  - `saveProviderApiKey()`: `await` the Vault `storeCredential` call wrapped with a 5-second timeout. Use `storeCredentialWithStatus` (which returns a `StoreCredentialResult` discriminated union) wrapped with a `withTimeout` helper that uses `Promise.race` (ES2015, compatible with the project's ES2020 target — no need for `Promise.any`). On timeout, return `{ ok: false, reason: 'error', message: 'Cloud backup timed out' }` — still write to localStorage but return a status indicating Vault failure. Surface a user-facing warning: "Cloud backup timed out — key saved locally only."
  - `getDecryptedApiKeyForProvider()`: when encrypted data exists in localStorage but decryption fails, set a `keyLostAt` timestamp in the config. When the Vault self-heal path (lines 595-604 of `aiConfiguration.ts`) successfully re-encrypts the key locally, clear the `keyLostAt` timestamp so `getAPIKeyHealth()` returns `'ok'` after recovery. This lets the UI detect the state across page loads while avoiding stale `undecryptable` status
  - Add `getAPIKeyHealth(provider)` that returns `'ok' | 'missing' | 'undecryptable' | 'vault-only'`
- In `AIConfigurationSettings.tsx`, use `getAPIKeyHealth()` to show an inline status indicator next to each provider:
  - Green dot + "Key configured" when `ok`
  - Blue dot + "Recovering from vault..." when `vault-only` (transient — the self-heal is in progress)
  - Amber dot + "Key needs re-entry — encryption key was reset" when `undecryptable`
  - Grey dot + "No key configured" when `missing`
- In `ProviderKeyAccordion.tsx`, catch the Vault failure status from `saveProviderApiKey` and show a warning toast: "API key saved locally but cloud backup failed. The key will be lost if browser storage is cleared."

**Patterns to follow:**
- Existing `getNoteQAAvailability()` in `aiConfiguration.ts` — returns a structured status object consumed by UI
- Existing connection status display patterns in `AIConfigurationSettings.tsx`

**Test scenarios:**
- Happy path: After saving a key, `getAPIKeyHealth('anthropic')` returns `'ok'`
- Error path: After simulating IndexedDB key loss, `getAPIKeyHealth('anthropic')` returns `'undecryptable'`
- Error path: `saveProviderApiKey` returns a Vault-failure status, UI shows warning toast
- Edge case: No key ever saved → `getAPIKeyHealth('anthropic')` returns `'missing'`
- Integration: After Vault backup succeeded but local key is lost, `getDecryptedApiKeyForProvider` recovers from Vault and re-encrypts locally (existing self-heal, now verified by the health check)

**Verification:**
- Save API key → green indicator in Settings
- Clear IndexedDB (DevTools → Application → IndexedDB → CryptoKeyStore → Clear) → reload → amber "needs re-entry" indicator
- Re-enter key → green indicator restored

---

- [ ] **Unit 2: Map Edge Function errors to actionable user-facing messages**

**Goal:** When an AI request fails, the user sees a specific message identifying what went wrong and how to fix it, instead of a generic "AI proxy error" or "Proxy request failed".

**Requirements:** R3

**Dependencies:** Unit 1 (imports `getAPIKeyHealth` from `aiConfiguration.ts` for pre-flight key loss detection)

**Files:**
- Modify: `src/ai/llm/proxy-client.ts` — parse error response body and produce categorized messages
- Modify: `src/ai/llm/ollama-client.ts` — add Ollama-specific error messages
- Test: `src/ai/llm/__tests__/proxy-client.test.ts` (create or extend)

**Approach:**
- **Pre-flight key loss detection (wiring with Unit 1):** At the top of `streamCompletion()`, before making the fetch call, import and call `getAPIKeyHealth(providerId)` from `src/lib/aiConfiguration.ts`. If the health status is `'undecryptable'` (meaning `keyLostAt` is set), throw an `LLMError` immediately with a user-facing message: "Your API key for {providerId} was lost because the encryption key was reset. Go to Settings > Integrations & Data to re-enter it." This avoids a network round-trip when the key is known to be unrecoverable.
- In `proxy-client.ts`, when a non-2xx response is received, parse the JSON error body from the Edge Function and map it to a user-facing message. The Edge Function returns errors in the form `{ error: "message" }`. Map based on the message content:

  | Edge Function error | User-facing message |
  |---|---|
  | `"No API key available for provider: {p}"` | `"No API key configured for {p}. Add your API key in Settings → Integrations & Data."` |
  | `"Provider not configured"` | `"The AI provider is not configured on the server. Contact support if this persists."` |
  | `"Invalid API key"` or 401 status | `"Your API key was rejected by {provider}. Check that it's valid and has credits."` |
  | `"Rate limited"` or 429 status | `"Too many requests. Wait a moment and try again."` |
  | `"Model not found"` | `"The model '{model}' is not available. Try a different model in Settings → Integrations & Data."` |
  | `"fetch failed"` or `"ECONNREFUSED"` (network error) | `"Cannot reach the AI service. Check your internet connection."` |
  | Timeout (30s) | `"AI request timed out. The model may be overloaded. Try again."` |
  | Unknown error | Pass through the original message, prefixed with `"AI error: "` |

- In `ollama-client.ts`, add specific messages for Ollama failures:
  - `ECONNREFUSED` → `"Ollama is not running. Start Ollama and verify the server URL in Settings."`
  - 404 → `"Model not found in Ollama. Pull it with 'ollama pull {model}'."`
  - Timeout (120s) → `"Ollama request timed out. The model may still be loading into memory."`

**Patterns to follow:**
- Existing error mapping in `src/ai/llm/client.ts` (`mapHttpStatusToLLMErrorCode`)
- Error display patterns in `ProviderKeyAccordion.tsx` (inline error messages below inputs)

**Technical design:** *(directional guidance — not implementation specification)*

The change is in the error handling branches of `ProxyLLMClient.streamCompletion()`. Before the fetch, add a pre-flight check using `getAPIKeyHealth()`. After the fetch, instead of throwing a generic `LLMError` with the raw server message, parse the response body and select a user-facing message template.

```
// Sketch of the error categorization approach
// Pre-flight: check for lost encryption key before making network request
const keyHealth = getAPIKeyHealth(providerId)
if (keyHealth === 'undecryptable') {
  return `Your API key for ${providerId} was lost because the encryption key was reset. Go to Settings > Integrations & Data to re-enter it.`
}

// Post-fetch: categorize error from Edge Function response
function categorizeProxyError(status, body, providerId): string {
  const msg = body?.error ?? ''
  if (status === 401 || /invalid.*key/i.test(msg))
    return `Your API key was rejected by ${providerId}. Check that it's valid and has credits.`
  if (/no api key available/i.test(msg))
    return `No API key configured for ${providerId}. Add your API key in Settings → Integrations & Data.`
  if (/provider not configured/i.test(msg))
    return `The AI provider is not configured on the server. Contact support.`
  // ... etc
  return `AI error: ${msg || 'Unknown error'}`
}
```

**Test scenarios:**
- Error path: Edge Function returns `{"error": "No API key available for provider: anthropic"}` → user sees "No API key configured for anthropic. Add your API key in Settings..."
- Error path: Edge Function returns 401 with `{"error": "Invalid API key"}` → user sees "Your API key was rejected by openai..."
- Error path (pre-flight): `getAPIKeyHealth(providerId)` returns `'undecryptable'` → `streamCompletion()` throws `LLMError` with "Your API key was lost because the encryption key was reset..." without making a network request
- Error path: Network failure (fetch throws) → user sees "Cannot reach the AI service. Check your internet connection."
- Error path: Request times out → user sees "AI request timed out..."
- Edge case: Edge Function returns unknown error format → user sees "AI error: {original message}"

**Verification:**
- Configure an intentionally invalid API key → trigger AI → see "key rejected" message (not "AI proxy error")
- Disconnect internet → trigger AI → see "Cannot reach the AI service" message

---

- [ ] **Unit 3: Add AI connectivity health check to Settings**

**Goal:** The Settings page shows whether the AI backend is reachable, so users can diagnose connectivity issues without attempting a full AI request.

**Requirements:** R4

**Dependencies:** Unit 1 (key health indicators should exist first)

**Files:**
- Modify: `src/app/components/figma/AIConfigurationSettings.tsx` — add "Test Connection" button per provider
- Modify: `src/app/components/figma/ProviderKeyAccordion.tsx` — add health check integration
- Test: `src/app/components/figma/__tests__/AIConfigurationSettings.test.tsx` (extend if exists)

**Approach:**
- The health check is entirely client-side. No Edge Function modifications are needed. The existing `testConnection` function in `aiConfiguration.ts` already validates API keys by making a lightweight POST to the `ai-stream` endpoint. For backend reachability checks (without a valid key), probe the endpoint with a sentinel payload `{ _healthCheck: true }` — the Edge Function validates required fields first and returns a structured error for the sentinel payload (400 for missing provider/messages, or 401 if the JWT is absent), which is sufficient to confirm the backend is reachable and responding.
- In `ProviderKeyAccordion.tsx`, after the existing "Test & Save" button flow, show the test result with a colored status indicator:
  - Green: "Connected — {provider} is reachable" (with latency)
  - Red: "Connection failed: {reason}" (with the specific error from Unit 2's error mapping)
  - Amber (spinner): "Testing..." while the test is in progress
- In `AIConfigurationSettings.tsx`, add a summary section at the top of the AI Configuration card:
  - "AI Status: Ready" (green) when at least one provider has a healthy key and the backend is reachable
  - "AI Status: Needs setup" (amber) when no key is configured or the key is undecryptable
  - "AI Status: Unavailable" (red) when keys are configured but the backend is unreachable

**Patterns to follow:**
- Existing `testConnection` function in `aiConfiguration.ts` — already validates API keys against the Edge Function
- Existing test button in `ProviderKeyAccordion.tsx`

**Test scenarios:**
- Happy path: Valid API key + backend reachable → "Test Connection" shows green "Connected" with latency
- Error path: Invalid API key → "Test Connection" shows red with "key rejected" message
- Error path: Backend unreachable → "Test Connection" shows red with network error message
- Edge case: No key configured → "Test Connection" button is disabled with tooltip "Add an API key first"
- Integration: After saving a key (Unit 1), the status summary updates to "Ready"

**Verification:**
- Open Settings → Integrations & Data with a valid API key → see "AI Status: Ready"
- Remove the API key → see "AI Status: Needs setup"
- Enter invalid key → test shows red failure with specific reason

## System-Wide Impact

- **Interaction graph:** `aiConfiguration.ts` → `cryptoKeyStore.ts` (key health) + `vaultCredentials.ts` (Vault status). `proxy-client.ts` → error mapping → `LLMError` → UI toast. `AIConfigurationSettings.tsx` + `ProviderKeyAccordion.tsx` → key health indicators + connection test results.
- **Error propagation:** Current: Edge Function error → generic `LLMError("AI proxy error: ...")` → possibly swallowed. After fix: Edge Function error → categorized user-facing message → `LLMError` with actionable text → UI toast with specific guidance.
- **State lifecycle risks:** The `keyLostAt` timestamp is written to localStorage config. If the config grows too large or is corrupted, `getAIConfiguration()` returns defaults (existing behavior). The new fields are additive and don't change the storage schema.
- **Unchanged invariants:** Supabase auth flows are untouched. The Edge Functions are not modified. The encryption architecture (AES-GCM + IndexedDB CryptoKey + Vault) is preserved — only observability is added. The BYOK-first design is maintained.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `saveProviderApiKey` awaiting Vault write could slow down the save UX if Vault is slow | Wrap the Vault `storeCredential` call with a 5-second timeout via the `withTimeout` helper (uses `Promise.race` — ES2015 compatible). On timeout, save locally and surface a user-facing warning: "Cloud backup timed out — key saved locally only" |
| Error message matching could produce false positives if the Edge Function changes its error format | Use case-insensitive substring matching (not exact match); include a fallthrough for unknown errors |
| `keyLostAt` detection relies on the encrypted data still being present in localStorage | If both IndexedDB AND localStorage are cleared, the state is `'missing'` — same as never having saved a key. This is correct behavior |

## Documentation / Operational Notes

- No Supabase secrets need to be set — the app remains BYOK-first
- The `vault-credentials` Edge Function is deployed and active; the Vault self-heal path works when the user is authenticated
- If AI provider platform keys are added as Supabase secrets in the future, the BYOK detection in `isBYOK()` will still prefer the user's key when one is provided in the request

## Sources & References

- Related code: `src/lib/aiConfiguration.ts`, `src/lib/cryptoKeyStore.ts`, `src/lib/crypto.ts`
- Related code: `src/ai/llm/proxy-client.ts`, `src/ai/llm/ollama-client.ts`, `src/ai/llm/factory.ts`
- Related UI: `src/app/components/figma/AIConfigurationSettings.tsx`, `src/app/components/figma/ProviderKeyAccordion.tsx`
- Edge Functions: `supabase/functions/ai-stream/index.ts`, `supabase/functions/_shared/entitlement.ts`
- Migration context: `docs/plans/2026-04-24-005-refactor-migrate-to-supabase-cloud-plan.md` (line 466: BYOK-first decision)
- Prior investigation: Session from 2026-05-22 — comprehensive AI stack investigation and document review
