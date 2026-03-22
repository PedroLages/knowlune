# Implementation Plan: E22-S01 Ollama Provider Integration

**Story:** E22-S01 — Ollama Provider Integration
**Branch:** `feature/e22-s01-ollama-provider-integration`
**Date:** 2026-03-22
**Complexity:** Medium (estimated 4-5 hours)

---

## Context & Key Findings

Ollama exposes an **OpenAI-compatible `/v1/` API**. All existing providers route through:

```
Browser → ProxyLLMClient → POST /api/ai/stream → Express server → server/providers.ts
         (getProviderModel) → createOpenAI/createAnthropic/etc. (Vercel AI SDK)
```

For Ollama:
- **Proxy mode (default):** Same path. Server calls `createOpenAI({ baseURL: ollamaUrl/v1, apiKey: 'ollama' })`. The Ollama URL is passed via the `apiKey` field in the proxy request body (Ollama doesn't need a real key).
- **Direct mode (advanced):** Browser calls Ollama `/v1/chat/completions` directly using a new `OllamaDirectClient`. Requires CORS configured on the Ollama server.

Zero new npm dependencies — `@ai-sdk/openai` (already installed) handles Ollama via custom `baseURL`.

---

## Architecture Decision

### How Ollama URL flows through the system

For proxy mode, the proxy request body currently carries `{ provider, apiKey, messages }`. For Ollama, there is no real API key — instead the Ollama **base URL** is the credential. We pass it in the `apiKey` field:

```
ProxyLLMClient sends: { provider: 'ollama', apiKey: 'http://192.168.1.x:11434', messages: [...] }
server/providers.ts: case 'ollama' → createOpenAI({ baseURL: apiKey + '/v1', apiKey: 'ollama' })(model)
```

This avoids any schema changes to the proxy request format.

### CSP

- **Proxy mode:** `connect-src 'self'` already covers it (same-origin proxy). No changes.
- **Direct mode:** Requires adding the user-configured URL to `connect-src`. Implement by dynamically updating the `<meta http-equiv="Content-Security-Policy">` tag in `index.html` when the Ollama URL is saved. This is the only viable client-side approach without a build step or server.

---

## Files to Create

### 1. `src/ai/llm/ollama-client.ts`
New `OllamaDirectClient` for direct browser-to-Ollama connections (AC4, AC6).

```typescript
// Extends BaseLLMClient
// Calls Ollama's OpenAI-compat endpoint: POST {baseUrl}/v1/chat/completions
// Uses SSE streaming format (same as OpenAI)
// No Authorization header needed (Ollama ignores auth by default)
```

### 2. `tests/e2e/story-e22-s01.spec.ts`
E2E tests covering all ACs.

---

## Files to Modify

### 3. `src/lib/aiConfiguration.ts`

**Changes:**
1. Add `'ollama'` to `AIProviderId` type
2. Add two fields to `AIConfigurationSettings` interface:
   - `ollamaBaseUrl?: string` — user-entered URL (e.g., `http://192.168.1.x:11434`)
   - `ollamaDirectConnection?: boolean` — true = direct mode, false/undefined = proxy mode
3. Add Ollama to `AI_PROVIDERS` array:
   - Name: `'Ollama (Local)'`
   - `requiresApiKey: false` (or equivalent — need to check the provider schema)
   - URL validation: must be `http://` or `https://` with optional port
4. Update `saveAIConfiguration`: skip API key encryption for Ollama; save `ollamaBaseUrl` as plaintext
5. Update `getDecryptedApiKey`: return `ollamaBaseUrl` for Ollama provider (used by factory/proxy as the "key")
6. Update `isAIAvailable`: treat Ollama as available when `ollamaBaseUrl` is non-empty + status is connected

**Key type changes:**
```typescript
export type AIProviderId = 'openai' | 'anthropic' | 'groq' | 'glm' | 'gemini' | 'ollama'

export interface AIConfigurationSettings {
  // ... existing fields ...
  ollamaBaseUrl?: string
  ollamaDirectConnection?: boolean
}
```

### 4. `src/app/components/figma/AIConfigurationSettings.tsx`

**Changes:**
1. Conditional input rendering: when `provider === 'ollama'` show URL input, not password input
   - Placeholder: `http://192.168.1.x:11434`
   - Type: `text` (not `password`)
   - Label: "Ollama Server URL"
2. Add "Advanced" collapsible section (only visible when Ollama selected) containing:
   - "Direct Connection" toggle (Switch component)
   - Info tooltip: "Direct connection requires CORS configured on your Ollama server (`OLLAMA_ORIGINS=*`)"
3. Wire `ollamaBaseUrl` state field — persisted to `AIConfigurationSettings`
4. Wire `ollamaDirectConnection` toggle
5. URL validation on save: basic http/https URL format check
6. When Ollama URL is saved, dynamically add URL to CSP meta tag (AC5)

**CSP dynamic update (AC5):**
```typescript
// After saving Ollama URL, update connect-src in meta CSP tag
function updateCSPForOllama(baseUrl: string) {
  const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  if (!metaCSP) return
  const content = metaCSP.getAttribute('content') ?? ''
  if (!content.includes(baseUrl)) {
    const updated = content.replace('connect-src', `connect-src ${baseUrl}`)
    metaCSP.setAttribute('content', updated)
  }
}
```
Note: This covers same-session requests. A full solution would require persisting to localStorage and re-applying on app load.

### 5. `src/ai/llm/factory.ts`

**Changes:**
Add `case 'ollama'` to `getLLMClientForProvider()`:

```typescript
case 'ollama': {
  const config = getAIConfiguration()
  const baseUrl = config.ollamaBaseUrl || 'http://localhost:11434'
  const model = config.selectedModel || 'llama3.2'
  if (config.ollamaDirectConnection) {
    return new OllamaDirectClient(baseUrl, model)
  }
  // Proxy mode: pass URL in apiKey field (server interprets it as baseURL)
  return new ProxyLLMClient('ollama', baseUrl, model)
}
```

### 6. `server/providers.ts`

**Changes:**
Add `case 'ollama'` to `getProviderModel()`:

```typescript
case 'ollama': {
  // apiKey field carries the Ollama base URL (e.g., 'http://192.168.1.x:11434')
  const ollamaUrl = apiKey || 'http://localhost:11434'
  return createOpenAI({
    baseURL: `${ollamaUrl.replace(/\/$/, '')}/v1`,
    apiKey: 'ollama',  // Ollama ignores auth but SDK requires non-empty key
  })(model || 'llama3.2')
}
```

### 7. `server/index.ts`

**Changes:**
Update the Zod validation schema to allow `'ollama'` in the `provider` enum field (if using strict Zod enum):

```typescript
// Before: z.enum(['openai', 'anthropic', 'groq', 'gemini', 'glm'])
// After:  z.enum(['openai', 'anthropic', 'groq', 'gemini', 'glm', 'ollama'])
```

Also update the `generate` endpoint if it has the same provider enum.

---

## Implementation Order

Execute in this sequence to avoid broken states:

1. **`src/lib/aiConfiguration.ts`** — Type extension first (unblocks TypeScript compilation)
2. **`server/index.ts`** — Extend Zod schema to accept 'ollama'
3. **`server/providers.ts`** — Add Ollama case to provider registry
4. **`src/ai/llm/ollama-client.ts`** — Create direct client (AC4/AC6)
5. **`src/ai/llm/factory.ts`** — Wire factory case
6. **`src/app/components/figma/AIConfigurationSettings.tsx`** — UI changes last (depends on all above)
7. **`tests/e2e/story-e22-s01.spec.ts`** — E2E tests

---

## Acceptance Criteria Mapping

| AC | Implementation |
|----|---------------|
| AC1: Ollama in provider dropdown | `AI_PROVIDERS` entry in `aiConfiguration.ts` |
| AC2: URL input instead of API key | Conditional input in `AIConfigurationSettings.tsx` |
| AC3: Proxy routing (default) | `ProxyLLMClient` + `server/providers.ts` Ollama case |
| AC4: Direct connection toggle | `OllamaDirectClient` + toggle UI + factory switch |
| AC5: CSP allows Ollama URL | Dynamic CSP meta update + apply on load |
| AC6: Streaming via OllamaDirectClient | `OllamaDirectClient.streamCompletion()` |

---

## OllamaDirectClient Design (AC6)

Ollama's `/v1/chat/completions` uses **SSE streaming** (same format as OpenAI). The `BaseLLMClient.parseSSEStream()` helper already handles this format. Implementation is minimal:

```typescript
export class OllamaDirectClient extends BaseLLMClient {
  constructor(private baseUrl: string, private model: string) { super() }

  getProviderId() { return 'ollama' }

  async *streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No Authorization header — Ollama ignores auth
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
    }, LLM_REQUEST_TIMEOUT)

    if (!response.ok) {
      // Map HTTP errors to LLMError codes
      const code = response.status === 401 ? 'AUTH_ERROR'
        : response.status === 429 ? 'RATE_LIMIT'
        : 'NETWORK_ERROR'
      throw new LLMError(`Ollama error ${response.status}`, code, 'ollama')
    }

    const reader = response.body!.getReader()
    for await (const data of this.parseSSEStream(reader)) {
      // Parse OpenAI-compat SSE chunk
      const parsed = JSON.parse(data) as {
        choices: [{ delta: { content?: string }, finish_reason?: string }]
      }
      const content = parsed.choices[0]?.delta?.content ?? ''
      const finishReason = parsed.choices[0]?.finish_reason
      if (content) yield { content }
      if (finishReason === 'stop') yield { content: '', finishReason: 'stop' }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests (vitest)
- `aiConfiguration.ts`: `'ollama'` is a valid `AIProviderId`, URL validation accepts valid URLs, rejects non-URL strings
- `factory.ts`: with Ollama config, returns `ProxyLLMClient` in proxy mode and `OllamaDirectClient` in direct mode
- `ollama-client.ts`: `streamCompletion` parses OpenAI SSE chunks correctly; maps HTTP 401 → `AUTH_ERROR`

### E2E Tests (Playwright)
```
Scenario 1 - Provider selection (AC1):
  Given I navigate to Settings
  When I open the AI Configuration section
  Then I see "Ollama (Local)" in the provider dropdown

Scenario 2 - URL input UI (AC2):
  Given I select "Ollama" as the provider
  Then I see a text input (not password) with placeholder "http://192.168.1.x:11434"
  And I do NOT see the API key input

Scenario 3 - Advanced toggle (AC4):
  Given Ollama is selected
  When I open the "Advanced" section
  Then I see a "Direct Connection" toggle
  And toggling it shows the CORS requirement tooltip

Scenario 4 - Save and persist (AC2, AC5):
  Given I enter a valid Ollama URL
  When I save the configuration
  Then the URL is persisted to localStorage under 'ai-configuration'
  And the CSP meta tag's connect-src includes the saved URL

Scenario 5 - Mock Ollama server (AC3, AC6):
  Given the Express proxy is running
  And a mock Ollama server is available
  When an AI feature sends a request with provider='ollama'
  Then the proxy routes it correctly to the Ollama URL
```

---

## Edge Cases to Handle

1. **Trailing slash in URL**: Normalize with `.replace(/\/$/, '')` before appending `/v1`
2. **Non-standard port**: Any valid URL with port should work (e.g., `http://localhost:11435`)
3. **HTTPS Ollama**: Should work if user has SSL configured
4. **Empty URL on save**: Show validation error, don't save
5. **URL changes after configuration**: `ai-configuration-updated` event triggers re-sync across tabs
6. **Ollama provider selected but URL empty**: `isAIAvailable()` should return false
7. **CSP update on page load**: Must re-apply Ollama URL to CSP on app init if Ollama is configured

---

## Notes on CSP (AC5)

The `index.html` CSP meta tag has:
```
connect-src 'self' ws: wss: https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com
```

For **proxy mode**: covered by `'self'` — no changes needed.
For **direct mode**: must add the user's Ollama URL (e.g., `http://192.168.1.x:11434`) to `connect-src`.

Implementation approach:
1. Add `applyOllamaCSP(url: string)` utility to `aiConfiguration.ts`
2. Call on app startup in `main.tsx` if Ollama is configured
3. Call after saving Ollama URL in `AIConfigurationSettings.tsx`

This covers the in-session case. The CSP meta tag update is transient (not persisted to `index.html`), which is expected — re-applied each session.

---

## Pre-Implementation Checks

- [x] Branch `feature/e22-s01-ollama-provider-integration` created from `main`
- [x] Story file exists at `docs/implementation-artifacts/22-1-ollama-provider-integration.md`
- [x] Design document at `docs/plans/2026-03-22-ollama-integration-design.md` reviewed
- [x] Existing AI infrastructure fully analyzed
- [x] Zero new npm dependencies confirmed (`@ai-sdk/openai` already installed)
