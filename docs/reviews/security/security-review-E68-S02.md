# Security Review: E68-S02 — Cache API Validation and OpenAI Fallback

**Date:** 2026-06-22
**Reviewer:** Claude Code security-review agent
**Scope:** Branch `feature/e68-s02-cache-api-validation-and-openai-fallback`
**Files Reviewed:**
- `src/ai/embeddings/openaiProvider.ts` — OpenAI API client
- `src/ai/embeddings/localProvider.ts` — Cache API availability check
- `src/ai/embeddingPipeline.ts` — Orchestration with inline fallback
- `src/ai/workers/coordinator.ts` — Worker crash handling and Cache API probe
- `src/ai/workers/embedding.worker.ts` — Transformers.js worker (model integrity verify)
- `src/ai/embeddings/EmbeddingProvider.ts` — Provider interface
- `src/lib/aiConfiguration.ts` — API key encryption, storage, and retrieval
- `src/lib/crypto.ts` — AES-GCM cryptographic utilities

---

## Summary

This review covers four TypeScript modules implementing an embedding pipeline with local (Transformers.js) and cloud (OpenAI) fallback. The local provider probes the Cache API for model file availability; the OpenAI provider encrypts keys at rest and sends them directly to `api.openai.com` over HTTPS. The coordinator handles worker crashes and probes the Cache API for model cache availability. No BLOCKER or HIGH findings were identified. Two MEDIUM issues were found (direct browser-to-provider API key exposure via extensions, and architecture constraints on memory clearing). Several LOW/INFO findings are recorded for hardening.

---

## Findings

### MEDIUM-1: Direct browser-to-OpenAI fetch exposes API key to extensions

**File:** `src/ai/embeddings/openaiProvider.ts` (lines 165-173)

The OpenAI provider sends the API key directly from the user's browser to `https://api.openai.com/v1/embeddings`:

```typescript
response = await fetch(OPENAI_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.apiKey}`,
  },
  // ...
})
```

This means the API key is transmitted as a Bearer token in the request header. While encrypted over the wire via HTTPS, browser extensions with `webRequest` or `declarativeNetRequest` permissions (including ad-blockers, DevTools extensions, and corporate monitoring agents) can read the Authorization header. By contrast, the rest of the app's connection testing goes through the backend proxy (`/api/ai/models/:provider`) which keeps the API key server-side.

**Risk:** MEDIUM — API key exposure to malicious or compromised browser extensions. This affects all users who have browser extensions installed that can intercept network requests.

**Recommendation:**
1. Add a `X-Proxy-Embeddings` header or configuration flag to route embeddings through the backend proxy as an opt-in for security-conscious users.
2. Document in settings/setup that the current architecture sends API keys directly to OpenAI, and that using a proxy (future work) would keep the key server-side.
3. Consider adding a backend embeddings endpoint (`POST /api/ai/embeddings`) that proxies to OpenAI, matching the pattern used by connection testing in `testViaModelProxy`.

---

### MEDIUM-2: API key cannot be explicitly cleared from memory after use

**File:** `src/ai/embeddings/openaiProvider.ts` (line 114-115), `src/ai/embeddingPipeline.ts` (line 174)

The plaintext API key is stored as a property on the `OpenAIEmbeddingProvider` instance:

```typescript
constructor(apiKey: string) {
  this.apiKey = apiKey.trim()
}
```

In `embeddingPipeline.ts`, a new provider is created on every fallback attempt:

```typescript
const openaiProvider: EmbeddingProvider = new OpenAIEmbeddingProvider(apiKey)
```

JavaScript strings are immutable and cannot be overwritten or zeroed. The key bytes remain in the process heap until the garbage collector reclaims them, and even then the freed memory may persist in the heap. There is no mechanism to release the key explicitly (no `secureZero()` / `clear()` pattern). The same limitation applies to the `apiKey` local variable in `tryOpenAIFallback` (line 164).

This is a fundamental platform limitation of JavaScript/WebAssembly apps, not a code defect. However, it should be documented as an accepted risk.

**Risk:** MEDIUM — A heap snapshot taken after the provider is created but before GC would contain the plaintext key. A malicious extension with `memory.heapSnapshot` Chrome DevTools Protocol access could extract it.

**Recommendation:**
1. Limit the lifetime by reassigning `openaiProvider.apiKey = ''` after the `embed()` call completes (though this only clears the property reference, not the original string bytes in memory). Add a `dispose()` method to the provider that nulls out the key reference so the string is at least eligible for GC sooner.
2. Accept this as a known JavaScript limitation and document it.

---

### LOW-1: Worker crash custom event exposes internal error messages

**File:** `src/ai/workers/coordinator.ts` (lines 388-400)

When a worker crashes, a `worker-crash` custom event is dispatched with the error message:

```typescript
window.dispatchEvent(
  new CustomEvent('worker-crash', {
    detail: {
      workerId,
      error: error?.message ?? 'Unknown error',
      provider: type === 'embed' ? 'local' : undefined,
      cacheUnavailable: !cacheAvailable,
      requestId: pendingRequestIds.join(','),
    },
  })
)
```

For same-origin workers (bundled with the app), `error.message` includes the actual Error's `message` property which may contain internal implementation details (file paths, stack trace fragments, ONNX backend error messages). Any code listening for the `worker-crash` custom event sees these details.

**Risk:** LOW — Custom events are same-origin only and the information exposed (WASM/ONNX error messages, internal worker IDs) does not include user data or secrets. However, it extends the attack surface for any XSS vulnerability.

**Recommendation:**
1. Sanitize the `error` field in the custom event to a fixed message like `'Worker error: see console for details'`. The full error is already logged via `console.error` on line 358 for debugging.
2. Alternatively, leave as-is and document that no sensitive data is in the event (current state), but be aware it lowers the bar for post-XSS information gathering.

---

### LOW-2: Cache API existence check does not validate response integrity

**File:** `src/ai/embeddings/localProvider.ts` (lines 67-75)

The provider checks whether model files exist in the Cache API by matching the URL pattern:

```typescript
const request = new Request(`https://huggingface.co/Xenova/${pattern}`)
const match = await cache.match(request)
return !!match
```

If an attacker can write to the Cache API (through a compromised service worker or via Cache API access from the same origin), they could substitute a malicious model file into the cache. The `isAvailable()` check only verifies that a cache entry exists for the URL pattern, not that the content is the authentic HuggingFace model. The pipeline checks dimension integrity during model load (384-dim verification in `embedding.worker.ts` lines 207-215), which catches output-level discrepancies but does not prevent execution of a substituted model if it happens to produce 384-dim output.

**Risk:** LOW — Exploitation requires same-origin script execution to write to the Cache API, which is the same privilege level needed to modify the app code directly. The dimension check provides limited defense but is not a cryptographic integrity check.

**Recommendation:**
1. Add a SHA-256 content hash check of the downloaded ONNX model against a pinned hash in the source code. This would detect substitution even if the attacker controls the Cache API.
2. Alternatively, document that the dimension check is the only integrity verification and accept the risk, since Cache API write access implies full origin compromise.

---

### LOW-3: API key trimming inconsistency

**File:** `src/ai/embeddings/openaiProvider.ts` (lines 115, 124)

The key is trimmed in the constructor but `isAvailable()` trims again:

```typescript
constructor(apiKey: string) {
  this.apiKey = apiKey.trim()
}

async isAvailable(): Promise<boolean> {
  return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0
}
```

The double trim is functionally harmless (trimming an already-trimmed string is idempotent). However, it indicates a minor code quality inconsistency. If a subclass or future refactor bypassed the constructor, `isAvailable()` would use the raw key while `embed()` would use the trimmed version, potentially causing a mismatch.

**Risk:** LOW — No exploitable vulnerability. Reducing code quality finding.

**Recommendation:** Remove the redundant `.trim()` from `isAvailable()` and rely on constructor trimming. Or, if constructor-side effects are undesirable, move all trimming to `isAvailable()` and use `this.apiKey.trim()` consistently.

---

### INFO-1: Vault write failure does not block key storage

**File:** `src/lib/aiConfiguration.ts` (lines 837-886)

```typescript
const vaultResult = await withTimeout(
  storeCredentialWithStatus('ai-provider', provider, apiKey),
  5_000,
  'Cloud backup timed out'
)
// ... on failure: vaultFailed = true, sets vaultBackupFailedAt timestamp
```

If the Supabase Vault write fails or times out, the key is still saved to localStorage with local AES-GCM encryption. The `vaultBackupFailedAt` timestamp is set, but the embedding pipeline does not check this flag. A user who clears browser data will permanently lose their API key without knowing it was never backed up.

**Risk:** INFO — User experience issue, not a direct security vulnerability. The key is still encrypted locally; the risk is data loss, not exposure.

**Recommendation:** Surfacing the `vaultBackupFailedAt` in the settings UI would be valuable (out of scope for this story).

---

### INFO-2: No rate-limiting or circuit breaker for OpenAI fallback calls

**File:** `src/ai/embeddingPipeline.ts` (lines 161-203), `src/ai/embeddings/openaiProvider.ts` (lines 160-216)

The OpenAI provider has retry logic for 429 responses (max 3 retries with exponential backoff). However, if every note save triggers the OpenAI fallback (because the local provider is unavailable), there is no circuit breaker preventing repeated calls at the pipeline level. Each call to `indexNote()` that fails locally will retry 3 times on OpenAI for 429s, then the next `indexNote()` call will repeat this pattern.

**Risk:** INFO in this review (rate limiting is a reliability/operational concern), but it could become a security concern if billing is considered a security domain (unbounded API key spending).

**Recommendation:** Add a per-session circuit breaker that prevents OpenAI fallback calls after N consecutive failures in a rolling window. A simple flag like `openaiUnavailable` that resets after 5 minutes would suffice. Out of scope for E68-S02, but worth tracking.

---

## OWASP Top 10 Mapping

| OWASP Category | Finding(s) | Rating |
|---|---|---|
| A01:2021 Broken Access Control | N/A — No access control in scope | -- |
| A02:2021 Cryptographic Failures | Encryption design is sound (AES-GCM 256, non-extractable key, Supabase Vault backup). No hardcoded keys. | PASS |
| A03:2021 Injection | Note text sent to workers for embedding; worker validates `texts` is a non-empty array. No SQL/NoSQL injection vector. | PASS |
| A04:2021 Insecure Design | API key exposed to browser extensions via direct fetch (MEDIUM-1). No memory-zeroing for secrets (MEDIUM-2, platform constraint). | MEDIUM |
| A05:2021 Security Misconfiguration | Key trimming inconsistency (LOW-3). | LOW |
| A06:2021 Vulnerable Components | Transformers.js model loaded from HuggingFace. Pinned model path `Xenova/all-MiniLM-L6-v2` is fixed-version, not floating. | PASS |
| A07:2021 Identification and Auth Failures | N/A — authentication is OAuth-based and out of scope. | -- |
| A08:2021 Software and Data Integrity Failures | No content hash verification for cached model (LOW-2). Model dimension check provides limited integrity. | LOW |
| A09:2021 Security Logging and Monitoring Failures | Error messages and telemetry logged at appropriate levels (`console.warn`/`console.info`). Debounce prevents toast spam. | PASS |
| A10:2021 Server-Side Request Forgery | `OPENAI_API_URL` is a hardcoded constant. No user input in URL construction. | PASS |

---

## Secrets Verification

- **Hardcoded API keys:** None found in the diff.
- **API keys in logs:** The pipeline logs `{ provider: 'openai', error: ... , code: ... }` — never the key itself. The `getDecryptedApiKeyForProvider` function has a JSdoc security note: "Never log or display the returned value." No violations found.
- **`.env` / `.env.local` exposure:** No `.env` leaks in the diff.
- **`_testApiKey` guard:** The test-only bypass (`config._testApiKey`) is properly gated with `import.meta.env.DEV`, ensuring dead-code elimination in production builds.

---

## Threat Model (Per-File)

### `openaiProvider.ts`
- **Asset:** OpenAI API key (financial value, access to paid LLM services)
- **Threat:** Key exfiltration via browser extension reading Authorization header
- **Threat:** Key exfiltration via heap snapshot
- **Mitigation:** HTTPS-only endpoint, key trimmed on input, typed errors avoid leaking key details, 401/403 produces generic "Invalid or missing API key" message
- **Residual risk:** MEDIUM — extension-level interception is an accepted tradeoff for client-side apps

### `localProvider.ts`
- **Asset:** Model binary integrity
- **Threat:** Malicious model substitution via Cache API
- **Mitigation:** Model loaded from pinned HuggingFace URL; runtime dimension check in worker
- **Residual risk:** LOW — Cache API write access implies full origin compromise

### `embeddingPipeline.ts`
- **Asset:** User note content (semantic meaning extractable from embeddings)
- **Threat:** Unauthorized transmission of content to OpenAI when local provider fails
- **Mitigation:** Consent gates checked before any embedding attempt (`isGranted`, `isGrantedForProvider`). Content is note text (analyzed only — no metadata or PII per `sanitizeAIRequestPayload`). OpenAI fallback only triggers if user configured a key.
- **Residual risk:** LOW — consent is permissive by default; user must actively disable AI embeddings consent

### `coordinator.ts`
- **Asset:** Worker crash telemetry
- **Threat:** Sensitive internal data leaked via CustomEvent
- **Mitigation:** Error messages are from ONNX/WASM runtime, not user data; error already logged to console
- **Residual risk:** LOW — post-XSS intelligence gathering

---

## Verdict

No exploitable vulnerabilities (BLOCKER/HIGH) found in this diff. The codebase demonstrates good security practices:

- API keys encrypted at rest with AES-GCM 256-bit (non-extractable key)
- No hardcoded secrets
- Typed error classes that avoid leaking sensitive details to users
- Consent gates checked before embedding attempts
- Graceful degradation (notes save without embedding on failure)
- Model dimension integrity verification on load
- HTTPS-only OpenAI endpoint with request timeout and exponential backoff retry
- Vault backup with automatic self-healing for lost encryption keys

The two MEDIUM findings (browser extension key exposure, inability to clear secrets from memory) are fundamental architectural constraints of client-side TypeScript apps. The LOW findings (sanitized worker crash events, model integrity, key trimming) are hardening opportunities for future stories.
