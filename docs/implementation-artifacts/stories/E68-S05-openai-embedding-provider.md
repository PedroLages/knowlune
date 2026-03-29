# Story 68.5: OpenAI Embedding Provider

Status: ready-for-dev

## Story

As a learner with an OpenAI API key configured,
I want the option to use OpenAI's embedding API for potentially higher quality search results,
so that I can choose between free on-device embeddings and premium cloud embeddings based on my preference.

## Acceptance Criteria

1. **Given** the user has configured an OpenAI API key in Settings and selected OpenAI as their AI provider **When** the embedding provider factory creates a provider **Then** it returns an `OpenAIEmbeddingProvider` instance.

2. **Given** the `OpenAIEmbeddingProvider` is active **When** `embed(texts)` is called **Then** it sends a request to `https://api.openai.com/v1/embeddings` with model `text-embedding-3-small` and `dimensions: 384` **And** returns `Float32Array[]` with exactly 384 dimensions per vector.

3. **Given** the OpenAI API returns embeddings with dimensions != 384 (e.g., older model ignores `dimensions` param) **When** the response is validated **Then** the provider throws an error with message `Dimension mismatch: expected 384, got {actual}` (EC19).

4. **Given** the OpenAI API call fails (network error, rate limit, invalid key) **When** the error is caught **Then** the provider throws to trigger the fallback chain (on-device retry or skip).

5. **Given** the user has a non-OpenAI provider selected (Anthropic, Groq, Ollama) **When** the fallback chain considers cloud fallback **Then** the OpenAI embedding provider is only used if the user has specifically configured an OpenAI API key (regardless of chat provider selection) (EC7).

## Tasks / Subtasks

- [ ] Task 1: Create `src/ai/embeddings/openaiEmbeddingProvider.ts` (AC: #1, #2, #3, #4)
  - [ ] Implement `OpenAIEmbeddingProvider` class implementing `EmbeddingProvider` from Story 68.4
  - [ ] `id: 'openai'`, `dimensions: 384`
  - [ ] Constructor takes `apiKey: string`
  - [ ] `embed(texts)`: POST to `https://api.openai.com/v1/embeddings` with body `{ model: 'text-embedding-3-small', input: texts, dimensions: 384 }`
  - [ ] Parse response: `response.data[].embedding` -> `Float32Array[]`
  - [ ] Validate each embedding has exactly 384 dimensions, throw `Dimension mismatch` if not (EC19)
  - [ ] `isAvailable()`: return `true` if API key is non-empty
  - [ ] Filter empty/whitespace texts before API call (consistent with TransformersJsProvider)

- [ ] Task 2: Handle API errors with appropriate error messages (AC: #4)
  - [ ] 401: `'OpenAI API key is invalid'`
  - [ ] 429: `'OpenAI rate limit exceeded'`
  - [ ] Network error: `'Failed to reach OpenAI API'`
  - [ ] Always throw (let fallback chain handle recovery)

- [ ] Task 3: Update factory to support OpenAI provider (AC: #1, #5)
  - [ ] In `src/ai/embeddings/factory.ts`, add OpenAI branch
  - [ ] Check for OpenAI API key availability via `getDecryptedApiKey()` from `src/lib/aiConfiguration.ts`
  - [ ] Per EC7: check specifically for OpenAI API key, not just current provider selection
  - [ ] Factory logic: if user's chat provider is OpenAI AND connected -> use OpenAI embeddings; otherwise fallback provider (Story 68.6) will handle the chain

- [ ] Task 4: Unit tests (AC: #1-#5)
  - [ ] Test `embed()` sends correct request body with `dimensions: 384`
  - [ ] Test dimension validation rejects non-384 responses
  - [ ] Test error handling for 401, 429, network errors
  - [ ] Test `isAvailable()` based on API key presence
  - [ ] Test factory returns OpenAI provider when configured

## Dev Notes

### Existing Infrastructure

- **`getDecryptedApiKey()`** at `src/lib/aiConfiguration.ts` -- decrypts stored API key for the current provider. Use this to get the OpenAI key.
- **`getAIConfiguration()`** -- returns `{ provider: AIProviderId, connectionStatus, ... }`. Check `provider === 'openai'` and `connectionStatus === 'connected'`.
- **`ProxyLLMClient`** at `src/ai/llm/proxy-client.ts` -- existing OpenAI API caller for chat. Reference for auth header pattern: `Authorization: Bearer ${apiKey}`.
- **No proxy needed for embeddings**: The existing proxy at `functions/api/ai/[provider].ts` is for chat completions. Embeddings can call OpenAI directly since there's no streaming and the request is simple.

### Critical Implementation Details

- **`dimensions: 384` parameter**: OpenAI's `text-embedding-3-small` supports native dimension reduction via the `dimensions` parameter. This returns a truncated, re-normalized vector -- not a naive slice. This is critical for maintaining compatibility with the existing `BruteForceVectorStore`.
- **BYOK (Bring Your Own Key)**: The API call goes directly to OpenAI, not through any proxy. The key never leaves the browser except in the HTTPS request to OpenAI.
- **Rate limits**: OpenAI rate limits `text-embedding-3-small` at 3,000 RPM / 1,000,000 TPM. For personal use, this is effectively unlimited. No retry logic needed -- let the fallback chain handle it.
- **Cost**: $0.02 per 1M tokens. A typical note (~200 tokens) costs $0.000004. Negligible for personal use.
- **EC7 nuance**: A user might use Anthropic for chat but still have an OpenAI key configured from before. The fallback chain (Story 68.6) should try OpenAI embeddings if the key exists, regardless of chat provider. The factory determines the PRIMARY provider; the fallback chain determines the FALLBACK order.

### File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/ai/embeddings/openaiEmbeddingProvider.ts` | CREATE | OpenAI embedding provider |
| `src/ai/embeddings/factory.ts` | MODIFY | Add OpenAI provider branch (created in Story 68.4) |

### Project Structure Notes

- New file in `src/ai/embeddings/` alongside `transformersJsProvider.ts` from Story 68.4
- Follows same class pattern as TransformersJsProvider
- Uses direct `fetch()` call, no new dependencies

### References

- [Source: _bmad-output/planning-artifacts/epics-on-device-embeddings.md - Story 68.5]
- [Source: _bmad-output/planning-artifacts/architecture-on-device-embeddings.md - ADR-2, ADR-3]
- [Source: src/ai/llm/proxy-client.ts - Reference for OpenAI API auth pattern]
- [Source: src/lib/aiConfiguration.ts - getDecryptedApiKey(), getAIConfiguration()]
- [OpenAI Embeddings API: https://platform.openai.com/docs/api-reference/embeddings]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
