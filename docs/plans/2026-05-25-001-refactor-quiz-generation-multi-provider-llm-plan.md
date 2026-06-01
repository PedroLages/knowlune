---
title: "refactor: Multi-Provider LLM for Quiz Generation"
type: refactor
status: active
date: 2026-05-25
---

# refactor: Multi-Provider LLM for Quiz Generation

## Overview

The quiz generation feature on the lesson player page is hardcoded to Ollama only. When the Ollama server is unreachable, the "Generate Quiz" button is disabled with the message "Quiz generation unavailable -- Ollama server is offline" — even when the user has a valid API key for OpenAI, Anthropic, or another cloud provider configured in Settings.

The system already has a multi-provider BYOK architecture (`getLLMClient` factory, consent guards, API key vault) used by every other AI feature. Quiz generation is one of two remaining features that bypass this infrastructure with a custom `callOllamaChat()` function that talks directly to Ollama's native API.

This plan brings quiz generation onto the multi-provider path so it works with any configured provider.

## Problem Frame

The lesson player page renders a `GenerateQuizButton` below the video. The button is wired to `useQuizGeneration`, a React hook that:
1. Checks if the globally selected AI provider is Ollama
2. Pings the Ollama server to verify it's reachable
3. Disables the button if either check fails

Meanwhile, `quizGenerationService.ts` has a `callOllamaChat()` function that:
- Reads the Ollama server URL and model directly from config
- POSTs to Ollama's native `/api/chat` endpoint with its JSON `format` parameter
- Returns `null` (never throws) on any failure

Both layers assume the only valid LLM is a local Ollama server. Users who configured Anthropic or OpenAI in Settings have a working AI configuration — but the quiz button is disabled and the service would fail even if the button were enabled.

The exact same bug was previously fixed for Note Q&A in April 2026 (see `docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md`). The pattern is identical: a feature bypassing the multi-provider factory, checking a hardcoded provider, and returning false unavailability.

## Requirements Trace

- **R1.** Quiz generation must work with any configured AI provider (OpenAI, Anthropic, Groq, GLM, Gemini, OpenRouter, Ollama), not just Ollama
- **R2.** The button must be enabled when the resolved provider for quiz generation is available, disabled with a generic message when no provider is configured
- **R3.** Quiz generation must pass through the same consent and provider-alignment gates as other AI features (`assertAIFeatureConsent`)
- **R4.** Existing quiz quality pipeline (transcript chunking, Bloom's prompts, Zod validation, QC) must be preserved unchanged
- **R5.** Existing quiz caching (transcript hash → stored quiz lookup) must be preserved unchanged
- **R6.** Ollama users must experience no regression — the feature should work identically for them

## Scope Boundaries

- The quiz generation **prompt, chunking, and quality control** layers are unchanged. Only the LLM call layer changes.
- The `GenerateQuizButton` Bloom's taxonomy dropdown is preserved unchanged.
- Quiz storage (`syncableWrite('quizzes', 'put', ...)`) is unchanged.

### Deferred to Separate Tasks

- `src/ai/courseTagger.ts`: Has the same hardcoded `callOllamaChat` pattern. Separate refactor in a future PR.
- `withModelFallback` integration for quiz generation: The factory's `withModelFallback` provides automatic fallback to provider default model on AUTH_ERROR. This can be layered on after the initial migration.

## Context & Research

### Relevant Code and Patterns

- **`getLLMClient` factory** (`src/ai/llm/factory.ts:92`): Takes `featureId` + optional `{ resolved }` snapshot. Routes Ollama → `OllamaLLMClient`, cloud → `ProxyLLMClient`. Throws `LLMError`, `ConsentError`, `ProviderReconsentError`.
- **`LLMClient` interface** (`src/ai/llm/client.ts:14`): Exposes `streamCompletion(messages)` returning `AsyncGenerator<LLMStreamChunk>`. No non-streaming method exists — consumers must collect the stream.
- **`collectStreamWithTimeout`** (`src/ai/youtube/courseStructurer.ts:181`): Collects an `AsyncGenerator<{content: string}>` into a full string with timeout and abort support. This is the only existing pattern for non-streaming collection from the factory.
- **`getNoteQAAvailability`** (`src/lib/aiConfiguration.ts:888`): Feature-scoped availability helper. Resolves the feature model, checks consent and provider key health. Returns `{ available: boolean, provider, model, reason? }`. This is the exact pattern to follow for quiz generation.
- **`resolveFeatureModel('quizGeneration')`** (`src/lib/modelDefaults.ts:122`): Already resolves to `{ provider: 'anthropic', model: 'claude-haiku-4-5' }` via the 3-tier cascade. Currently never read by quiz generation code.
- **Snapshot-at-source pattern** (`docs/solutions/ui-bugs/qa-chat-panel-uuid-leakage-overflow-auto-scroll-2026-04-29.md`): Resolve the feature model once, pass the snapshot through consent and into `getLLMClient({ resolved })`, preventing TOCTOU between consent check and client creation.

### Institutional Learnings

- **`note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md`**: The exact same class of bug — a feature bypassing the factory and hardcoding Ollama, causing false unavailability. The fix was adding a feature-scoped availability helper and switching from `isAIAvailable()` / `testOllamaConnection()` to `resolveFeatureModel()` + key health check. Same pattern applied here.
- **`note-qa-provider-reconsent-modal-2026-04-27.md`**: Documents the two-layer consent check (`assertAIFeatureConsent` → `purpose granted` + `provider-aligned`). Quiz generation currently bypasses consent with `isFeatureEnabled('noteQA')` as a proxy. Must wire in `assertAIFeatureConsent('quizGeneration')`.
- **`zustand-stale-async-results-generation-counter-2026-05-03.md`**: Generation counter pattern for preventing stale async results. Quiz generation runs for 30+ seconds across multiple chunks — a generation counter should be added to avoid stale writes on navigation.

## Key Technical Decisions

- **Stream collection over interface change**: Use a `collectStreamWithTimeout` helper rather than adding `generateText()` to the `LLMClient` interface. Rationale: Following the established `courseStructurer.ts` pattern avoids interface changes that ripple to all provider implementations, `ProxyLLMClient`, and the Supabase Edge Functions. The stream-collection pattern is already tested and works across all providers.
- **`getLLMClient` over `withModelFallback`**: Quiz generation has custom per-chunk retry logic (2 retries on validation/QC failure) that doesn't map cleanly to `withModelFallback`'s single-fallback-on-auth-error. Use `getLLMClient` directly and handle errors at the chunk level.
- **Preserve `QUIZ_RESPONSE_SCHEMA` for Ollama via provider-aware code path**: The `OllamaLLMClient` uses the OpenAI-compatible endpoint (`/v1/chat/completions`) which does not support Ollama's native `format` parameter for JSON schema enforcement. Local Ollama models (especially the default `llama3.2`) rely on this for valid structured output. To satisfy R6 (no regression for Ollama users), introduce a lightweight provider-aware branch in the chunk generation: when `resolved.provider === 'ollama'`, route through the existing native `/api/chat` endpoint with `format: QUIZ_RESPONSE_SCHEMA`. For all cloud providers, rely on prompt-based JSON instruction and `parseAndValidate()` fallback parsing (cloud models are more reliable at JSON output than local Ollama models). This preserves the exact current behavior for Ollama users while enabling cloud providers.
- **Feature-scoped availability helper with Ollama reachability ping**: Add `getQuizGenerationAvailability()` to `aiConfiguration.ts`. For cloud providers, follow the `getNoteQAAvailability()` pattern (check API key health). For Ollama, diverge from the `getNoteQAAvailability()` pattern by performing an actual HTTP reachability check (`testOllamaConnection()`) rather than only checking whether the server URL is configured — Ollama is a local server that can go offline, unlike cloud API keys. This preserves the current hook's reachability-aware behavior.

## Implementation Units

### Unit 1: Add quiz generation availability helper

**Goal:** Provide a feature-scoped availability check that replaces the hardcoded Ollama ping in `useQuizGeneration`.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/aiConfiguration.ts`
- Test: `src/lib/__tests__/aiConfiguration.test.ts` (if it exists; otherwise test scenarios below cover it via the hook)

**Approach:**
- Add `getQuizGenerationAvailability()` function
- Extend the `ConsentSettings` interface in `aiConfiguration.ts` to include `quizGeneration: boolean` (and add `quizGeneration: true` to `DEFAULTS`). **Consent fallback behavior:** When reading settings, the consent getter (e.g., `getQuizGenerationAvailability()` or the underlying settings read) must first check the stored `quizGeneration` key. If `quizGeneration` is absent from stored settings (existing users), fall back to the stored `noteQA` value — NOT to `DEFAULTS.quizGeneration`. This ensures existing users who explicitly disabled `noteQA: false` are not silently opted in. New installations get `quizGeneration: true` from DEFAULTS, which is correct for fresh setups.
- Resolve `quizGeneration` feature model, check consent, check provider credentials
- For Ollama: perform an HTTP reachability check via `testOllamaConnection()` (not just config check — Ollama is a local server that can go offline)
- For cloud providers: check API key exists via `getDecryptedApiKeyForProvider()`
- Return `QuizGenerationAvailability` type: `{ available: boolean, provider, providerName, model, reason? }`

**Patterns to follow:**
- `getNoteQAAvailability()` at `src/lib/aiConfiguration.ts:888`

**Test scenarios:**
- Happy path: Ollama configured with server URL → `{ available: true }`
- Happy path: Anthropic key present → `{ available: true }`
- Edge case: No AI configured at all → `{ available: false }`
- Edge case: Feature consent disabled (quiz generation consent not granted) → `{ available: false, reason: 'feature-disabled' }`
- Edge case: Ollama selected but no server URL → `{ available: false, reason: 'missing-ollama-url' }`
- Edge case: Cloud provider selected but no API key → `{ available: false, reason: 'missing-provider-key' }`
- Consent fallback: stored `quizGeneration` absent + stored `noteQA` false → `{ available: false }` (does not fall through to DEFAULTS)
- Consent fallback: stored `quizGeneration` absent + stored `noteQA` true → `{ available: true }` (inherits from noteQA)
- Consent fallback: stored `quizGeneration` explicitly false + stored `noteQA` true → `{ available: false }` (explicit false overrides noteQA true)
- Consent fallback: fresh install (no stored settings at all) → `{ available: true }` (from DEFAULTS.quizGeneration)

**Verification:**
- Calling `getQuizGenerationAvailability()` with Ollama configured returns `available: true`
- Calling with Anthropic key configured returns `available: true`
- Calling with no AI configured returns `available: false`

---

### Unit 2: Refactor quiz generation service to use multi-provider factory

**Goal:** Replace the hardcoded `callOllamaChat()` with the LLM client factory, preserving the existing quality pipeline.

**Requirements:** R1, R3, R4, R5, R6

**Dependencies:** None (the factory already exists)

**Files:**
- Create: `src/ai/llm/streamUtils.ts` (new, extracted from courseStructurer.ts)
- Modify: `src/ai/quizGenerationService.ts`
- Test: `src/ai/__tests__/quizGenerationService.test.ts`
- Modify: `src/ai/youtube/courseStructurer.ts` (import from new streamUtils.ts)

**Approach:**

1. **Imports**: Remove `getOllamaServerUrl`, `getOllamaSelectedModel`, `isOllamaDirectConnection`, `apiUrl`. Keep `QUIZ_RESPONSE_SCHEMA` — it remains imported because the Ollama provider-aware branch (step 9) references this constant for the native `/api/chat` `format` parameter. Add `resolveFeatureModel` from `@/lib/aiConfiguration`, `getLLMClient` from `@/ai/llm/factory`, `LLMClient` and `LLMMessage` types, and `LLMError`/`ConsentError`.

2. **Delete `getOllamaConfig()`** (lines 420-431): No longer needed.

3. **Delete `callOllamaChat()`** (lines 250-314): Replaced by a new `callLLMForQuizChunk()` that collects the stream from the client.

4. **Extract `collectStreamWithTimeout` to a shared utility**: The function at `courseStructurer.ts:181` is module-private. Extract it to `src/ai/llm/streamUtils.ts` (or similar shared location) and export it so both `courseStructurer.ts` and `quizGenerationService.ts` can import it. The function signature (`AsyncGenerator<{ content: string }, void, unknown>`) is already compatible with `LLMStreamChunk`. The quiz generation's 30s timeout is a call-site parameter, not a function-body change.

5. **Add `callLLMForQuizChunk()`**: Takes `client: LLMClient`, system prompt, user prompt, and signal. Calls `client.streamCompletion(messages)`, collects via `collectStreamWithTimeout`. Returns `string | null` (never-throw pattern preserved).

6. **Update `generateQuizForLesson()` entry point** (lines 127-131): Replace the `getOllamaConfig()` check with:
   - `resolveFeatureModel('quizGeneration')` to get the resolved provider/model snapshot
   - `assertAIFeatureConsent('quizGeneration', resolved)` for consent (catches `ConsentError` / `ProviderReconsentError`)
   - `getLLMClient('quizGeneration', { resolved })` to create the client
   - Pass `client` and `resolved` through the pipeline instead of `ollamaConfig`

7. **Update `generateQuestionsForChunk()`**: Change first param from `ollamaConfig` to `client: LLMClient`. Inline `callLLMForQuizChunk(client, systemPrompt, userPrompt, signal)`.

8. **Update `buildQuiz()` call** (line 206): Change `modelId` from `ollamaConfig.model` to `\`${resolved.provider}/${resolved.model}\``.

9. **Remove `QUIZ_RESPONSE_SCHEMA` from the chunk generation for cloud providers only**: When `resolved.provider === 'ollama'`, preserve the current behavior — route through the native `/api/chat` endpoint with `format: QUIZ_RESPONSE_SCHEMA` (this satisfies R6). When the provider is any cloud provider, drop the schema parameter (not supported) and rely on prompt-based JSON instruction + `parseAndValidate()` fallback. This is a lightweight provider-aware branch at the chunk generation level, not a separate LLM client.

10. **Handle errors from the factory and stream with appropriate scope**:
    - **Entry-point errors** (from `getLLMClient()` / `assertAIFeatureConsent()`): `ConsentError`, `ProviderReconsentError`, and `LLMError` for missing configuration → caught in `generateQuizForLesson()`, returned as fail-fast structured error results
    - **Per-chunk errors** (from `streamCompletion()`): network timeouts, rate limits, auth failures → caught in `callLLMForQuizChunk()`, return `null` for that chunk, preserving the existing per-chunk retry loop

**Patterns to follow:**
- `collectStreamWithTimeout` at `src/ai/youtube/courseStructurer.ts:181`
- `getLLMClient` usage with `{ resolved }` snapshot in `src/ai/hooks/useChatQA.ts`
- `assertAIFeatureConsent` usage in `src/ai/llm/factory.ts`

**Test scenarios:**
- Happy path: Configured Anthropic client generates valid JSON → quiz returned
- Happy path: Configured Ollama client generates valid JSON → quiz returned
- Happy path: Transcript hash matches cached quiz → cached quiz returned (no LLM call)
- Error path: No AI provider configured → `{ error: 'AI provider not configured for quiz generation.' }`
- Error path: Consent not granted → `{ error: 'Quiz generation unavailable. AI features must be enabled in Settings.' }` (ConsentError); provider mismatch → `{ error: 'Provider consent required. Please review your AI provider settings.' }` (ProviderReconsentError)
- Error path: LLM returns invalid JSON → retry (up to 2), then `null` for that chunk
- Error path: LLM call times out (30s) → `null` for that chunk
- Error path: All chunks fail → `{ error: 'All chunks failed question generation' }`
- Edge case: Abort signal fired mid-generation → `{ error: 'Generation cancelled' }`
- Edge case: No transcript available → `{ error: 'No valid transcript available' }`
- Integration: Quiz stored via `syncableWrite('quizzes', 'put', ...)` with correct `modelId`

**Verification:**
- With an Anthropic API key configured, calling `generateQuizForLesson` makes an LLM call through the factory and returns a valid quiz
- With no AI configured, calling `generateQuizForLesson` returns the appropriate error without throwing
- Existing Ollama users see no behavior change

---

### Unit 3: Update useQuizGeneration hook

**Goal:** Replace the Ollama-only availability check with feature-scoped availability, and add stale async protection.

**Requirements:** R2, R3

**Dependencies:** Unit 1 (availability helper), Unit 2 (service signature)

**Files:**
- Modify: `src/hooks/useQuizGeneration.ts`

**Approach:**

1. **Replace imports**: Remove `testOllamaConnection`, `getOllamaSelectedModel`, `getAIConfiguration`. Add `getQuizGenerationAvailability` from `@/lib/aiConfiguration`.

2. **Rename state**: `ollamaAvailable` → `aiAvailable`, `setOllamaAvailable` → `setAiAvailable`. Update the return type interface.

3. **Replace availability check** (lines 94-144): Replace the 50-line `useEffect` that checks `isAIAvailable()` → `config.provider === 'ollama'` → `testOllamaConnection()` with a call to `getQuizGenerationAvailability()`:
   - Call `getQuizGenerationAvailability()` on mount and every 30s
   - Set `aiAvailable` from `result.available`
   - This automatically handles both Ollama (server ping via `testOllamaConnection`) and cloud providers (key health via `getAPIKeyHealth`)

4. **Rely on existing AbortController for stale async protection**: The hook already has a complete stale-async protection mechanism: (a) cleanup effect aborts the controller on unmount, (b) each new `generate()` call aborts the previous controller, (c) after each `await`, the code checks `if (controller.signal.aborted) return`. This pattern is sufficient for `useState`-based hooks. The generation counter pattern is designed for Zustand stores and is not needed here.

**Patterns to follow:**
- `getNoteQAAvailability()` integration pattern from `src/ai/hooks/useChatQA.ts`
- Existing `AbortController` ref pattern in `useQuizGeneration.ts` (lines 147-175)

**Test scenarios:**
- Happy path: Ollama available → `aiAvailable: true`
- Happy path: Anthropic API key present → `aiAvailable: true`
- Edge case: No AI configured → `aiAvailable: false`
- Edge case: Feature consent disabled → `aiAvailable: false`
- Edge case: User navigates away during generation → AbortController fires, stale result discarded, no state update

**Verification:**
- The button is enabled when any quiz generation provider is available
- The button is disabled with a generic message when no provider is configured
- Quick navigation during generation does not leave stale state (AbortController handles this)
- The initial checking state has a maximum duration of 10s (if the check takes longer, show "Checking AI availability..." and fall back to disabled)
- The availability poll at 30s intervals does NOT toggle the button through a disabled checking state on re-check — only the initial mount check shows the checking state; subsequent polls silently update availability

---

### Unit 4: Update GenerateQuizButton for generic AI messaging

**Goal:** Replace Ollama-specific prop names and error messages with provider-agnostic ones.

**Requirements:** R2

**Dependencies:** Unit 3 (hook interface change)

**Files:**
- Modify: `src/app/components/figma/GenerateQuizButton.tsx`

**Approach:**
- Rename prop `ollamaAvailable` → `aiAvailable`
- Update JSDoc
- Update disabled tooltip: "Quiz generation unavailable -- Ollama server is offline" → "Quiz generation unavailable -- AI provider is offline or not configured"
- Update ARIA label to match
- No structural changes to the component

**Patterns to follow:**
- Existing component structure (unchanged)

**Test scenarios:**
- Happy path: `aiAvailable: true` → button enabled
- Edge case: `aiAvailable: false, checkingAvailability: false` → button disabled, correct tooltip
- Edge case: `checkingAvailability: true` → button disabled, no tooltip
- Edge case: `isGenerating: true` → button disabled, skeleton shown

**Verification:**
- With no AI configured, the button tooltip reads "AI provider is offline or not configured" (not "Ollama")

---

### Unit 5: Update UnifiedLessonPlayer props

**Goal:** Wire the renamed hook return value to the renamed button prop.

**Requirements:** R2

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`

**Approach:**
- Change `ollamaAvailable={quizGen.ollamaAvailable}` → `aiAvailable={quizGen.aiAvailable}` (line ~555)
- One-line mechanical rename

**Test scenarios:**
- Test expectation: none — mechanical rename with no behavioral change

**Verification:**
- The page compiles and renders without errors
- The button is enabled when AI is available

---

### Unit 6: Update quiz generation tests

**Goal:** Replace Ollama-specific test mocks with factory-level mocks.

**Requirements:** R1, R4, R5

**Dependencies:** Unit 2

**Files:**
- Modify: `src/ai/__tests__/quizGenerationService.test.ts`

**Approach:**

1. **Replace `fetch`-level mocks with factory-level mocks**: Mock `@/ai/llm/factory`'s `getLLMClient` to return a mock `LLMClient` with controllable `streamCompletion()`.

2. **Replace `aiConfiguration` mocks**: Mock `resolveFeatureModel` → returns `{ provider: 'anthropic', model: 'claude-haiku-4-5' }`. Mock `assertAIFeatureConsent` → resolves (or throws for consent error tests).

3. **Update test helpers**: Rename `configureOllama()` → `configureAIProvider()`. Replace `mockValidLLMResponse()` (which set `mockFetch` to return Ollama-shaped JSON) → `mockStreamChunks()` (which makes `mockStreamCompletion` yield text chunks).

4. **Update error message assertions**: "Ollama not configured" → "AI provider not configured for quiz generation."

5. **Add new test cases**: Consent error, provider key missing, streaming timeout.

**Patterns to follow:**
- Factory-level mocking from `src/lib/__tests__/aiSummary.test.ts`

**Test scenarios:**
- Happy path: Mock client streams valid JSON → quiz generated
- Happy path: Transcript hash matches → cached quiz returned (no client call)
- Error path: `getLLMClient` throws `ConsentError` → error returned
- Error path: `getLLMClient` throws `LLMError(AUTH_ERROR)` → error returned
- Error path: Stream yields invalid JSON → retry then null
- Error path: Stream times out → null
- Edge case: Abort signal → generation cancelled

**Verification:**
- All existing test cases pass with updated mocks
- New consent and provider error test cases pass

## System-Wide Impact

- **Interaction graph:** The `useQuizGeneration` hook is the sole consumer of `quizGenerationService`. The `GenerateQuizButton` is the sole consumer of the hook. No other components or features depend on these modules.
- **Error propagation:** The service's never-throw pattern is preserved — factory errors (`LLMError`, `ConsentError`) are caught and returned as structured error results. The hook catches errors from `generate()`/`regenerate()` and shows a toast.
- **State lifecycle risks:** The existing `AbortController` ref handles stale results: cleanup aborts on unmount, new generations abort the previous controller, and post-await checks skip updates when aborted. No additional stale-protection mechanism is needed.
- **API surface parity:** `courseTagger.ts` has the same `callOllamaChat` pattern (deferred to separate task). The `QUIZ_RESPONSE_SCHEMA` constant remains in `quizPrompts.ts` for reference.
- **Integration coverage:** The `syncableWrite('quizzes', 'put', ...)` call at the end of generation must still store with the correct model identifier. The new identifier format (`provider/model`) is different from the old (`llama3.2`) — this is informational metadata only and does not affect quiz lookup or rendering.
- **Unchanged invariants:** Transcript chunking, Bloom's taxonomy prompt templates, Zod validation schemas, quality control pipeline, quiz storage path, and the `GenerateQuizButton` UX (Bloom's dropdown, skeleton state, ARIA announcements) are all preserved exactly as-is.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| JSON output quality degrades without Ollama's `format` schema enforcement | The prompt already instructs JSON output. Cloud models (GPT-4o-mini, Claude Haiku) are more reliable at JSON than local Ollama models. `parseAndValidate()` has markdown-fence fallback. Retry-on-validation-failure is preserved. |
| Streaming latency increases quiz generation time vs. Ollama's non-streaming `stream: false` | Cloud providers are significantly faster than local Ollama, so total generation time should decrease or stay similar. The 30s timeout per chunk is preserved. |
| `courseTagger.ts` becomes the last remaining Ollama-hardcoded feature | Deferred to separate task. Not a regression — `courseTagger.ts` already only works with Ollama. |
| `modelId` format change in stored quizzes | Audit all quiz UI components (badges, debug panes, error messages) to confirm `modelId` is not surfaced. Existing cached quizzes retain the old format. If no consumer displays it, no migration needed. If a consumer surfaces it, normalize the format before display. |

## Sources & References

- **Origin document:** None (direct user request)
- **Prior art fix (same bug class):** `docs/solutions/logic-errors/note-qa-course-reader-legacy-ai-availability-mismatch-2026-04-27.md`
- **Pattern: feature availability helper:** `src/lib/aiConfiguration.ts:888` (`getNoteQAAvailability`)
- **Pattern: stream collection:** `src/ai/youtube/courseStructurer.ts:181` (`collectStreamWithTimeout`)
- **Pattern: snapshot-at-source:** `src/ai/hooks/useChatQA.ts`
- **Pattern: factory mock in tests:** `src/lib/__tests__/aiSummary.test.ts`
- **Related code:** `src/ai/quizGenerationService.ts`, `src/hooks/useQuizGeneration.ts`, `src/ai/llm/factory.ts`, `src/lib/modelDefaults.ts`
- **Design note — availability helper duplication:** `getQuizGenerationAvailability()` structurally follows `getNoteQAAvailability()` (~50 lines each). This is intentional and follows the established codebase pattern. A generalized `getFeatureAvailability(featureId)` factory can be extracted as a follow-up refactor when a third feature availability helper is needed (e.g., for `courseTagger.ts`).
