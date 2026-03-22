# Test Coverage Review — E22-S01: Ollama Provider Integration

**Date**: 2026-03-22
**Branch**: feature/e22-s01-ollama-provider-integration
**Reviewer**: code-review-testing agent

---

## AC Coverage Summary

**5/6 ACs tested (83%)** — Coverage gate: PASS (≥80%)

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Ollama in provider dropdown | `aiConfiguration.test.ts:303` | `story-e22-s01.spec.ts:35` | ✅ Covered |
| AC2 | URL input (not API key), label, validation | `aiConfiguration.test.ts:310-329` | `spec.ts:40,52,125` | ✅ Covered |
| AC3 | Routes through Express proxy by default | None | `spec.ts:76` (toggle default only) | ⚠️ Partial |
| AC4 | Advanced section with Direct Connection toggle | None | `spec.ts:58` | ✅ Covered |
| AC5 | CSP connect-src allows Ollama URL | `aiConfiguration.test.ts:364-403` | `spec.ts:84,108,137` | ✅ Covered |
| AC6 | OllamaDirectClient streams/parses correctly | `ollama-client.test.ts:32` | None (unit coverage noted) | ⚠️ Partial |

Story-specific unit tests ran: **40/40 passed** ✅

---

## Findings

### HIGH (Significant Gaps)

**H1 — `src/ai/llm/factory.ts` has zero unit tests** (confidence: 92)

`getLLMClientForProvider` is the branch-critical routing function for AC3/AC4 — it routes between `ProxyLLMClient` and `OllamaDirectClient` based on `ollamaDirectConnection`. No test validates this routing.

Suggested: `src/ai/llm/__tests__/factory.test.ts`
- `returns ProxyLLMClient for ollama when ollamaDirectConnection is false`
- `returns OllamaDirectClient for ollama when ollamaDirectConnection is true`
- `throws LLMError with ollama-specific message when ollamaBaseUrl is missing`

---

**H2 — `server/providers.ts` Ollama case has zero tests** (confidence: 88)

The `getProviderModel` function's Ollama case (lines 46-53) contains URL normalization (`replace(/\/$/, '')`) and a hardcoded fallback URL. No tests for: empty `apiKey` fallback, trailing-slash normalization, or correct `baseURL` construction. The server directory has no test files at all.

Suggested: `server/__tests__/providers.test.ts`
- `constructs correct baseURL for ollama using apiKey as URL`
- `falls back to localhost:11434 when apiKey is empty for ollama`
- `normalizes trailing slash in ollama base URL`
- `throws for unsupported provider`

---

**H3 — AC3 proxy routing only verified at UI toggle level, not network layer** (confidence: 85)

`spec.ts:76` confirms `aria-checked="false"` on the direct toggle — UI state is correct. But no test confirms the network request goes to `/api/ai/stream` (proxy) rather than directly to the Ollama URL when `ollamaDirectConnection` is false. A unit test on `factory.ts` (H1 above) would resolve this at the right level.

---

### MEDIUM

**M1 — HTTP 403 and HTTP 500 not tested** (`ollama-client.test.ts`, confidence: 78)

403 maps to `AUTH_ERROR` (Ollama can return this when `OLLAMA_ORIGINS` is not set — realistic CORS-adjacent error). 500 maps to `NETWORK_ERROR`. Both untested.

---

**M2 — Null response body path untested** (`ollama-client.ts:77-79`, confidence: 75)

Explicit guard for `!response.body` throws `INVALID_RESPONSE` — never exercised by tests.

---

**M3 — AbortError/timeout path untested** (`ollama-client.ts:57-59`, confidence: 74)

`LLM_REQUEST_TIMEOUT` constant and `AbortError` → `TIMEOUT` conversion untested. Sibling clients (`openai.test.ts`, `anthropic.test.ts`) cover this path — Ollama is inconsistent.

---

**M4 — `saveAIConfiguration` with `ollamaBaseUrl` not tested in unit tests** (`aiConfiguration.test.ts`, confidence: 72)

All `saveAIConfiguration` unit tests use non-Ollama providers. No test verifies `ollamaBaseUrl` is stored plaintext (no `apiKeyEncrypted` field) — a security property stated in the story.

Suggested additions:
- `stores ollamaBaseUrl in plaintext without apiKeyEncrypted when provider is ollama`
- `persists ollamaDirectConnection toggle to localStorage`

---

### NITS

- `spec.ts:131`: `toContainText('http://')` is too loose — any element with that string would pass. Prefer exact error message assertion.
- `ollama-client.test.ts:153-169`: HTTP 429 test uses bare `try/catch` — passes silently if error never thrown. Use `caughtError` pattern from 401 test.

---

## Edge Cases Not Covered

- **Switching provider away from Ollama and back**: Round-trip state coherence (URL re-population from localStorage) untested
- **`applyOllamaCSP` with no `connect-src` token in meta tag**: `replace()` is no-op but silently fails
- **URL with trailing path segment** (`http://host:11434/api`): passes validation, produces `http://host:11434/api/v1/chat/completions` — probably wrong
- **`ollamaDirectConnection` toggle persistence**: Toggle calls `saveAIConfiguration` immediately, but E2E never toggles to `true`, saves, and reloads
- **Proxy 400-path when `apiKey` is empty**: Zod `min(1)` on server returns 400 with `fieldErrors` — untested

---

## Statistics

| Category | Count |
|----------|-------|
| ACs Fully Covered | 4 |
| ACs Partial | 2 |
| ACs Missing | 0 |
| High gaps | 3 |
| Medium gaps | 4 |
| Nits | 2 |
