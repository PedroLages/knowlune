---
story_id: E22-S01
story_name: "Ollama Provider Integration"
status: done
started: 2026-03-22
completed: 2026-03-22
reviewed: true
review_started: 2026-03-22
review_gates_passed:
  - working_tree_clean
  - build
  - lint_warnings_only
  - type_check
  - prettier
  - unit_tests_story_specific
  - e2e_smoke
  - e2e_story_spec
  - code_review
  - code_review_testing
  - design_review
burn_in_validated: false
---

# Story 22.01: Ollama Provider Integration

## Story

As a user with Ollama running on my local network (e.g., Unraid server),
I want to add Ollama as an AI provider in Settings,
so that I can use my own local models without API keys or costs.

## Acceptance Criteria

- **AC1**: Given I open Settings > AI Configuration, When I view the provider dropdown, Then "Ollama" appears as a selectable provider option
- **AC2**: Given I select Ollama as provider, When the configuration form renders, Then I see a URL input field (not an API key field) with placeholder "http://192.168.1.x:11434"
- **AC3**: Given I have configured an Ollama URL, When AI features make requests, Then requests route through the Express proxy server by default (avoiding CORS issues)
- **AC4**: Given I am a power user, When I toggle "Advanced: Direct Connection" in Ollama settings, Then requests go directly from browser to Ollama (requires CORS configured on server)
- **AC5**: Given I configure an Ollama endpoint URL, When the app initializes, Then the CSP `connect-src` directive allows connections to the user-configured Ollama endpoint
- **AC6**: Given the OllamaLLMClient is used, When streaming a response, Then it correctly parses Ollama's streaming JSON format and yields text chunks

## Tasks / Subtasks

- [x] Task 1: Add Ollama to provider registry (AC: 1, 2)
  - [x] 1.1 Add `'ollama'` to `AIProviderId` type in `src/lib/aiConfiguration.ts`
  - [x] 1.2 Add Ollama provider config with URL validation (not API key)
  - [x] 1.3 Update `AIConfigurationSettings.tsx` to show URL input when Ollama selected
- [x] Task 2: Create OllamaLLMClient (AC: 6)
  - [x] 2.1 Create `src/ai/llm/ollama-client.ts` extending `BaseLLMClient`
  - [x] 2.2 Implement streaming via Ollama's OpenAI-compatible `/v1/chat/completions` SSE
  - [x] 2.3 Proxy mode: `ProxyLLMClient` with Ollama URL passed as apiKey field
- [x] Task 3: Add proxy support (AC: 3)
  - [x] 3.1 Add Ollama adapter to `server/providers.ts` using `createOpenAI` with custom baseURL
  - [x] 3.2 Update proxy routes in `server/index.ts` to accept 'ollama' in Zod schema
  - [x] 3.3 Proxy mode is the default — no Vite config changes needed
- [x] Task 4: Add direct connection mode (AC: 4, 5)
  - [x] 4.1 Add "Direct Connection" toggle to Ollama settings UI (collapsible Advanced section)
  - [x] 4.2 Update CSP meta tag dynamically via `applyOllamaCSP()` + startup init in `main.tsx`
  - [x] 4.3 Factory routes 'ollama' to `OllamaDirectClient` or `ProxyLLMClient` based on setting
- [x] Task 5: Update LLM factory (AC: 3, 6)
  - [x] 5.1 Add `case 'ollama'` to `src/ai/llm/factory.ts`
  - [x] 5.2 Pass connection mode (proxy/direct) to client constructor

## Design Guidance

- Ollama URL input should match existing provider UI style in AIConfigurationSettings
- Use the same Card layout as other providers
- "Direct Connection" toggle should be in a collapsible "Advanced" section
- Show informational tooltip: "Direct connection requires CORS configured on your Ollama server"

## Implementation Notes

- **KEY FINDING: No custom OllamaLLMClient needed.** Ollama exposes an OpenAI-compatible API at `/v1/`.
  Use `createOpenAI` from `@ai-sdk/openai` (already in package.json) with a custom `baseURL`:
  ```typescript
  case 'ollama':
    return createOpenAI({
      baseURL: `${userOllamaUrl}/v1`,
      apiKey: 'ollama',  // Ollama ignores this but SDK requires it
    })(model || 'llama3.2')
  ```
- This gives streaming, chat, embeddings, and structured output for free — zero new dependencies
- Community `ollama-ai-provider` packages are fragmented and stale — skip them
- Ollama default port: 11434, no authentication required
- OpenAI-compat endpoints: `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`
- CSP: Route through existing Express proxy to avoid CSP complexity

## Testing Notes

- Unit test: `createOpenAI` with Ollama baseURL produces correct provider model
- Unit test: Provider registry validates Ollama URL format (http/https, port)
- E2E: Settings page shows Ollama option and URL input
- E2E: Mock Ollama server for integration testing
- Edge case: Ollama URL with trailing slash, non-standard port, HTTPS

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups
- [ ] If story calls external APIs: CSP allowlist configured
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Implementation Plan

See: [docs/implementation-artifacts/plans/e22-s01-ollama-provider-integration.md](plans/e22-s01-ollama-provider-integration.md)

## Dev Agent Record

### Implementation Notes

- Used `createOpenAI` from `@ai-sdk/openai` (already installed) with `baseURL: ollamaUrl/v1` — zero new npm dependencies
- Ollama URL is passed in the proxy request's `apiKey` field; server interprets it as baseURL — no schema changes needed
- `getDecryptedApiKey()` has a special Ollama branch: returns `ollamaBaseUrl` directly (no encryption/decryption)
- `applyOllamaCSP()` updates the runtime CSP meta tag; also called from `main.tsx` IIFE before first render for startup coverage
- `OllamaDirectClient` reuses `BaseLLMClient.parseSSEStream()` — Ollama's `/v1/` SSE format is identical to OpenAI's

### File List

- `src/lib/aiConfiguration.ts` — added `'ollama'` to AIProviderId, two new config fields, Ollama to AI_PROVIDERS, getDecryptedApiKey branch, applyOllamaCSP utility
- `server/index.ts` — added 'ollama' to Zod provider enum
- `server/providers.ts` — added 'ollama' to ProviderId type + Ollama case in getProviderModel
- `src/ai/llm/ollama-client.ts` — new OllamaDirectClient for browser→Ollama direct streaming
- `src/ai/llm/factory.ts` — added 'ollama' case routing to OllamaDirectClient or ProxyLLMClient
- `src/app/components/figma/AIConfigurationSettings.tsx` — Ollama URL input, Advanced section, Direct Connection toggle
- `src/main.tsx` — startup IIFE to apply Ollama URL to CSP before first render
- `src/lib/__tests__/aiConfiguration.test.ts` — added 15 new Ollama-specific tests
- `src/ai/llm/__tests__/ollama-client.test.ts` — new 8-test suite for OllamaDirectClient
- `tests/e2e/story-e22-s01.spec.ts` — new 9 E2E tests covering all ACs

### Change Log

- 2026-03-22: Implemented E22-S01 Ollama Provider Integration (all 6 ACs satisfied)

## Challenges and Lessons Learned

- Ollama's OpenAI-compatible API means zero custom protocol work — just `createOpenAI({ baseURL })`. Verified this before implementation.
- The "URL as credential" pattern (passing Ollama base URL in the `apiKey` proxy field) is a clean way to avoid schema changes while staying consistent with the existing proxy flow.
- CSP `addInitScript` interference: E2E tests that test startup behavior need a fresh browser context (not a reload) because `addInitScript` from `beforeEach` runs on every navigation including reloads.
