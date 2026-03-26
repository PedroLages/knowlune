# E22-S01: Ollama Provider Integration — Implementation Plan

**Story:** As a user with Ollama running on my local network, I want to add Ollama as an AI provider in Settings, so that I can use my own local models without API keys or costs.

**Created:** 2026-03-23
**Branch:** `feature/e22-s01-ollama-provider-integration`

---

## Architecture Summary

Ollama exposes an **OpenAI-compatible API** at `/v1/`. Instead of building a custom `OllamaLLMClient`, we reuse `createOpenAI` from `@ai-sdk/openai` (already a dependency) with a custom `baseURL`. This gives streaming, chat, embeddings, and structured output with zero new dependencies.

**Two connection modes:**
1. **Proxy mode (default, AC3):** Browser → Express proxy (`/api/ai/*`) → Ollama server. No CORS issues, works out of the box.
2. **Direct mode (AC4):** Browser → Ollama server directly. Requires user to configure `OLLAMA_ORIGINS` on their server. CSP `connect-src` must be updated dynamically (AC5).

---

## Step-by-Step Implementation

### Step 1: Add Ollama to Provider Type and Registry

**Files to modify:**
- `src/lib/aiConfiguration.ts`

**Changes:**
1. Add `'ollama'` to `AIProviderId` union type (line 16)
2. Add `AIProvider` interface changes:
   - Add optional `requiresApiKey?: boolean` field (default `true`) — Ollama doesn't need one
   - Add optional `urlPlaceholder?: string` field — for URL-based providers
3. Add `AIConfigurationSettings` changes:
   - Add optional `serverUrl?: string` field — stores the Ollama endpoint URL
   - Add optional `directConnection?: boolean` field — toggling proxy vs direct mode
4. Add Ollama entry to `AI_PROVIDERS` registry:
   - `id: 'ollama'`
   - `name: 'Ollama (Local)'`
   - `validateApiKey`: always returns `true` (Ollama has no API key)
   - `testConnection`: stub (real implementation in E22-S03)
5. Update `saveAIConfiguration` to persist `serverUrl` field
6. Add `getOllamaUrl()` helper: returns configured URL or `null`
7. Add URL validation helper: `validateOllamaUrl(url: string) => boolean`
   - Must be `http://` or `https://`
   - Must have host and port (port optional if 80/443)
   - Reject empty, `localhost` without port, etc.

**AC coverage:** AC1 (provider appears in dropdown), AC2 (URL input instead of API key)

**Unit tests:** `src/lib/__tests__/aiConfiguration.test.ts`
- Test Ollama provider exists in `AI_PROVIDERS`
- Test `validateApiKey` always returns `true` for Ollama
- Test `serverUrl` persists and retrieves correctly
- Test URL validation (valid URLs, trailing slashes, missing protocol, empty)

---

### Step 2: Update Settings UI for Ollama

**Files to modify:**
- `src/app/components/figma/AIConfigurationSettings.tsx`

**Changes:**
1. **Conditional input rendering:** When `settings.provider === 'ollama'`:
   - Hide API key `<Input>` field
   - Show URL `<Input>` field with:
     - `placeholder="http://192.168.1.x:11434"`
     - `type="url"`
     - `data-testid="ollama-url-input"`
   - Change save button label to "Save" (no "Test Connection" — that's E22-S03)

2. **Advanced section (collapsible):** Below the URL input:
   - `<Collapsible>` from shadcn/ui with label "Advanced"
   - Direct Connection `<Switch>` toggle:
     - `data-testid="direct-connection-toggle"`
     - Tooltip: "Direct connection requires CORS configured on your Ollama server"
     - Off by default (proxy mode)
   - Use existing `Tooltip` component from UI library

3. **Save handler changes:**
   - When provider is Ollama: validate URL format, save `serverUrl` + `directConnection`
   - Skip API key validation/encryption for Ollama
   - Set `connectionStatus: 'connected'` on save (real health check in E22-S03)

**AC coverage:** AC1, AC2, AC4 (direct connection toggle)

**No new dependencies needed** — `Collapsible` and `Tooltip` are already in `src/app/components/ui/`.

---

### Step 3: Add Ollama to Server-Side Provider Registry

**Files to modify:**
- `server/providers.ts`

**Changes:**
1. Add `'ollama'` to `ProviderId` type
2. Add `case 'ollama'` to `getProviderModel`:
   ```typescript
   case 'ollama':
     return createOpenAI({
       baseURL: `${ollamaUrl}/v1`,
       apiKey: 'ollama',  // Ollama ignores this but SDK requires it
     })(model || 'llama3.2')
   ```
3. Update function signature to accept optional `ollamaUrl` parameter
4. Add `'llama3.2'` to `DEFAULT_MODELS` record

**AC coverage:** AC3 (proxy routing), AC6 (streaming via OpenAI-compatible API)

**Key insight:** `createOpenAI` with a custom `baseURL` handles Ollama's `/v1/chat/completions` endpoint natively. No custom streaming parser needed.

---

### Step 4: Update Express Proxy Routes

**Files to modify:**
- `server/index.ts`

**Changes:**
1. Add `'ollama'` to the `RequestSchema.provider` enum (line 28)
2. For Ollama requests, extract `ollamaUrl` from request body:
   - Add `ollamaUrl: z.string().url().optional()` to `RequestSchema`
   - Pass `ollamaUrl` to `getProviderModel` for Ollama provider
3. Remove the GLM-style early return for Ollama — it IS supported
4. **Security consideration:** Validate that `ollamaUrl` is a private/local network address:
   - Allow: `http://192.168.*`, `http://10.*`, `http://172.16-31.*`, `http://localhost`, `http://127.0.0.1`
   - Block: public URLs (prevent SSRF via the proxy)

**AC coverage:** AC3 (proxy routing)

**Unit tests:** Would be in `server/__tests__/` if they exist (currently no server tests — note this as a gap).

---

### Step 5: Update Browser-Side LLM Factory

**Files to modify:**
- `src/ai/llm/factory.ts`

**Changes:**
1. Add `'ollama'` to the `supported` array in `getLLMClientForProvider` (line 61)
2. In `getLLMClient`, handle Ollama specially:
   - Ollama doesn't require an API key — skip the `if (!apiKey)` guard for Ollama
   - Instead, check that `serverUrl` is configured
   - Pass a dummy API key `'ollama'` to `ProxyLLMClient`
3. The `ProxyLLMClient` already sends `provider` in the request body, so the proxy will handle Ollama correctly via Step 4.

**For direct connection mode (AC4):**
- If `directConnection` is `true`, create an `OpenAIClient` with `baseURL` pointing to Ollama URL directly (instead of `ProxyLLMClient`)
- This requires either extending `OpenAIClient` to accept a custom base URL, OR creating a thin `DirectOllamaClient` wrapper

**Decision:** Extend `ProxyLLMClient` constructor to accept an optional `baseUrl` override. When `baseUrl` is set, the client POSTs directly to `{baseUrl}/v1/chat/completions` instead of `/api/ai/stream`. This reuses all existing SSE parsing logic.

Alternative (simpler): For direct mode, just use `OpenAIClient` with the Ollama URL as the API URL. The OpenAI client already handles SSE streaming identically.

**Recommended approach:** Use `OpenAIClient` for direct mode (cleaner separation):
```typescript
case 'ollama':
  if (config.directConnection) {
    return new OpenAIClient('ollama', 'llama3.2', `${ollamaUrl}/v1/chat/completions`)
  }
  return new ProxyLLMClient('ollama', 'ollama')
```
This requires making `OpenAIClient`'s API URL configurable (currently hardcoded constant).

**AC coverage:** AC3, AC4, AC6

**Unit tests:** `src/ai/llm/__tests__/factory.test.ts` (new file)
- Test `getLLMClient` returns `ProxyLLMClient` for Ollama (proxy mode)
- Test `getLLMClient` returns direct client for Ollama (direct mode)
- Test Ollama works without API key

---

### Step 6: Dynamic CSP Update for Direct Connection

**Files to modify:**
- `index.html` (CSP meta tag)
- New utility: `src/lib/csp.ts`

**Changes:**
1. Create `src/lib/csp.ts` with:
   - `updateConnectSrc(url: string)`: Modifies the CSP meta tag to add the Ollama URL to `connect-src`
   - `removeConnectSrc(url: string)`: Removes the URL when switching away from Ollama
2. Call `updateConnectSrc` on app initialization when Ollama direct mode is configured
3. Call `updateConnectSrc` when user saves Ollama settings with direct mode enabled

**AC coverage:** AC5

**Important note:** Modifying CSP meta tags at runtime is supported by browsers, but the new policy applies only to **future** requests (not already-loaded resources). This is fine for our use case since AI requests are made on-demand.

**Security consideration:** Only add the specific Ollama URL to `connect-src`, not a wildcard. Validate URL before adding.

**Unit tests:** `src/lib/__tests__/csp.test.ts`
- Test CSP meta tag is updated with Ollama URL
- Test CSP meta tag is cleaned up when URL removed
- Test invalid URLs are rejected

---

### Step 7: Update Vite Dev Proxy (Optional Enhancement)

**Files to modify:**
- `vite.config.ts`

**Changes:**
- The existing `/api/ai` proxy rule already covers Ollama proxy requests (they go through the same Express server). **No changes needed** unless we want a dedicated `/api/ai/ollama` prefix.

**Decision:** No changes. The proxy already forwards all `/api/ai/*` to `localhost:3001`.

---

## File Change Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `src/lib/aiConfiguration.ts` | Modify | ~40 |
| `src/lib/__tests__/aiConfiguration.test.ts` | Modify | ~30 |
| `src/app/components/figma/AIConfigurationSettings.tsx` | Modify | ~60 |
| `server/providers.ts` | Modify | ~15 |
| `server/index.ts` | Modify | ~20 |
| `src/ai/llm/factory.ts` | Modify | ~25 |
| `src/ai/llm/openai.ts` | Modify | ~10 (make URL configurable) |
| `src/lib/csp.ts` | Create | ~40 |
| `src/lib/__tests__/csp.test.ts` | Create | ~40 |
| `src/ai/llm/__tests__/factory.test.ts` | Create | ~50 |
| **Total** | | **~330 lines** |

---

## Testing Strategy

### Unit Tests
1. **aiConfiguration.test.ts**: Ollama provider registry, URL validation, serverUrl persistence
2. **factory.test.ts** (new): Ollama client creation for proxy and direct modes
3. **csp.test.ts** (new): Dynamic CSP meta tag manipulation
4. **proxy-client.test.ts**: Add Ollama provider to constructor variation tests

### E2E Tests (`tests/e2e/story-e22-s01.spec.ts`)
1. **AC1**: Navigate to Settings, verify "Ollama (Local)" appears in provider dropdown
2. **AC2**: Select Ollama, verify URL input appears (not API key input), check placeholder text
3. **AC3**: (Proxy routing) — Mock `/api/ai/stream` endpoint, verify Ollama request forwarded correctly
4. **AC4**: Toggle "Direct Connection", verify settings persist
5. **AC5**: (CSP) — Verify meta tag updated when direct mode + URL configured
6. **AC6**: (Streaming) — Mock Ollama-compatible SSE response, verify text chunks rendered

### Edge Cases
- Ollama URL with trailing slash (`http://192.168.1.100:11434/`)
- Ollama URL without port (`http://ollama.local`)
- HTTPS Ollama URL
- Switching from Ollama to OpenAI and back (settings persistence)
- Direct mode with unreachable server (graceful error)

---

## Dependencies

- **No new npm packages needed** — `@ai-sdk/openai` with custom `baseURL` handles everything
- No database migrations
- No new routes (uses existing `/api/ai/*` proxy)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSP meta tag runtime modification may not work in all browsers | Medium | Test in Chrome, Firefox, Safari. Fallback: proxy-only mode (no direct connection) |
| SSRF via proxy (user provides malicious URL) | High | Validate URL is private/local network address in Express proxy |
| `createOpenAI` with Ollama `baseURL` may have edge cases | Low | Ollama's OpenAI compatibility is well-documented and widely used |
| Ollama streaming format diverges from OpenAI in edge cases | Low | The `/v1/` endpoint is spec-compliant; use proxy path as primary |

---

## Implementation Order

1. Step 1 (provider type + registry) — foundation, no UI changes
2. Step 3 (server provider) — backend ready before frontend
3. Step 4 (proxy routes) — backend complete
4. Step 5 (factory) — client-side routing complete
5. Step 2 (Settings UI) — frontend wired to backend
6. Step 6 (CSP) — last, only needed for direct mode
7. Step 7 (Vite proxy) — no-op, verify existing config suffices

Estimated commits: 3-4 (backend, frontend, tests, CSP)
