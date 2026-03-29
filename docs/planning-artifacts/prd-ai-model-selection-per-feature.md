# PRD: AI Model Selection Per Feature (Epic B)

**Date:** 2026-03-29
**Author:** Claude (BMad product manager)
**Status:** Draft
**Epic:** B — AI Model Selection Per Feature
**Depends on:** Epic A (Course Experience Unification) recommended to ship first, but not a hard dependency

---

## 1. Overview & Problem Statement

### Current State

Knowlune's AI features are locked to hardcoded models with no user control over which model runs which task. Models are duplicated across three files with inconsistent defaults:

| Location | Hardcoded Model | Feature |
|----------|----------------|---------|
| `src/ai/llm/anthropic.ts:19` | `claude-haiku-4-5` | Default Anthropic client |
| `src/lib/noteQA.ts:39` | `claude-3-5-haiku-20241022` | Note Q&A (RAG) |
| `src/lib/aiSummary.ts:110` | `claude-3-5-haiku-20241022` | Video summary generation |
| `src/lib/thumbnailService.ts:152` | `gemini-2.0-flash-preview-image-generation` | Thumbnail generation |
| `server/providers.ts:18-21` | `claude-haiku-4-5`, `gpt-4-turbo`, `llama-3.3-70b-versatile`, `gemini-2.0-flash` | Server-side provider defaults |

The OpenAI defaults even conflict between files (`gpt-4o-mini` in aiSummary.ts vs `gpt-4-turbo` in server/providers.ts).

### Problem

1. **No model choice.** Users cannot select which model powers each AI feature. A power user who wants GPT-4o for tutoring and a cheap Haiku model for summaries has no way to configure this.
2. **No model discovery.** Only Ollama has a model picker (via `OllamaModelPicker.tsx`). Cloud providers (OpenAI, Anthropic, Gemini, Groq) offer no model selection at all.
3. **No parameter tuning.** Temperature and max tokens are hardcoded per feature. Users cannot adjust generation behavior.
4. **Single-provider limitation.** The current architecture supports one active provider at a time. Users cannot use Anthropic for Q&A and OpenAI for summaries simultaneously.
5. **Duplicated model constants.** Three separate files maintain independent model mappings that diverge over time.

### Key Research Finding

Claude Code OAuth tokens CANNOT be reused for third-party API calls. Anthropic explicitly prohibited this in February 2026, technically blocking OAuth tokens from unauthorized clients. The correct pattern is BYOK (Bring Your Own API Key). OpenRouter is a viable single-gateway alternative for multi-provider access via one API key.

---

## 2. Goals & Success Metrics

### Goals

| # | Goal | Rationale |
|---|------|-----------|
| G1 | Let users assign specific models to specific AI features | Core value proposition for power users |
| G2 | Provide model discovery for all supported providers | Users should see what models their API key can access |
| G3 | Support multiple simultaneous provider API keys | Required for cross-provider feature assignment |
| G4 | Offer sensible defaults so casual users never need to configure anything | Zero-config for 80% of users |
| G5 | Consolidate all model selection logic into a single module | Eliminate duplication and inconsistency |
| G6 | Add OpenRouter as an optional single-gateway provider | Simplifies multi-model access for users who prefer one API key |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Model configuration adoption | >20% of users with AI enabled customize at least one feature model within 30 days | Settings store analytics (localStorage) |
| Zero-config success rate | 100% of existing users experience no behavior change on upgrade | E2E tests pass with empty `featureModels` config |
| Model resolution DRY-ness | 1 file contains all default model mappings (down from 3) | Code audit |
| Settings page load time | <500ms including model discovery | Playwright performance benchmark |
| API key entry completion rate | >80% of users who start entering a key complete the flow | UI interaction tracking |

---

## 3. User Personas & Use Cases

### Persona 1: Casual Learner (Ana)

- Uses Knowlune to organize YouTube course notes
- Has one API key (OpenAI) entered in Settings
- Does not know or care about model names
- **Needs:** Everything works with zero configuration. Current behavior preserved.

**Use Cases:**
- UC-1A: Ana upgrades Knowlune. All AI features continue working with the same models as before. She sees no new UI unless she looks for it.
- UC-1B: Ana enables a new AI feature (quiz generation). It uses the global default model automatically.

### Persona 2: Power User (Marco)

- Self-hosts Ollama on a home server for privacy
- Has API keys for Anthropic (for high-quality Q&A) and OpenAI (for cheap summaries)
- Wants fine-grained control over which model handles what
- **Needs:** Per-feature model assignment, multi-provider API keys, parameter tuning.

**Use Cases:**
- UC-2A: Marco assigns `claude-sonnet-4-5` for Note Q&A and `gpt-4o-mini` for video summaries. Each feature uses the assigned model.
- UC-2B: Marco adjusts temperature for quiz generation to 0.1 for more deterministic outputs.
- UC-2C: Marco switches his local Ollama model from `llama3.2` to `qwen2.5:32b` for all Ollama-routed features.
- UC-2D: Marco adds an OpenRouter API key to access models from multiple providers without managing separate keys.

### Persona 3: Budget-Conscious Student (Priya)

- Uses free-tier or low-cost models exclusively
- Wants to understand cost implications before selecting a model
- **Needs:** Cost tier indicators, recommended defaults that optimize for cost.

**Use Cases:**
- UC-3A: Priya sees cost tier badges (free/low/medium/high) next to each model in the picker.
- UC-3B: Priya selects "Recommended" defaults, which favor cost-effective models for high-frequency features (summaries, flashcards).

---

## 4. Functional Requirements

### FR-1: Centralized Model Resolution

**Description:** Consolidate all hardcoded model mappings into a single `modelResolver.ts` module with a three-tier resolution chain: (1) user per-feature override, (2) feature-specific default, (3) global provider default.

**Acceptance Criteria:**
- AC-1.1: A single `PROVIDER_DEFAULTS` map exists in one file, replacing the three current duplicated maps.
- AC-1.2: `resolveFeatureModel(feature: AIFeatureId)` returns `{ provider, model, temperature?, maxTokens? }` using the resolution chain.
- AC-1.3: All AI consumers (`aiSummary.ts`, `noteQA.ts`, `thumbnailService.ts`) call `getLLMClient(featureId)` instead of constructing clients directly.
- AC-1.4: Server-side `DEFAULT_MODELS` in `server/providers.ts` is synchronized with client-side `PROVIDER_DEFAULTS`.

### FR-2: Per-Feature Configuration Type

**Description:** Extend `AIConfigurationSettings` with a `featureModels` map allowing optional per-feature provider + model + parameter overrides.

**Acceptance Criteria:**
- AC-2.1: `AIFeatureId` type enumerates all AI features: `videoSummary`, `noteQA`, `thumbnailGeneration`, `quizGeneration`, `flashcardGeneration`, `learningPath`, `knowledgeGaps`, `noteOrganization`.
- AC-2.2: `FeatureModelConfig` type includes `provider`, `model`, optional `temperature` (0.0-2.0), optional `maxTokens`.
- AC-2.3: `featureModels` field on `AIConfigurationSettings` is `Partial<Record<AIFeatureId, FeatureModelConfig>> | undefined`. Existing configs with no `featureModels` work without migration.
- AC-2.4: Feature overrides persist in IndexedDB/localStorage across sessions.

### FR-3: Multi-Provider BYOK Key Storage

**Description:** Support storing encrypted API keys for multiple providers simultaneously via a `providerKeys` map, migrating from the existing single `apiKeyEncrypted` field.

**Acceptance Criteria:**
- AC-3.1: `providerKeys: Partial<Record<AIProviderId, EncryptedData>>` field added to `AIConfigurationSettings`.
- AC-3.2: `getDecryptedApiKeyForProvider(provider)` checks `providerKeys[provider]` first, then falls back to legacy `apiKeyEncrypted` for the global provider.
- AC-3.3: Existing single-key users experience no breakage. Legacy `apiKeyEncrypted` field is preserved as fallback indefinitely.
- AC-3.4: API keys are encrypted via Web Crypto API (existing `encryptData()`/`decryptData()` pattern). Keys are never sent to a backend or logged.

### FR-4: Model Discovery

**Description:** Implement provider-specific model discovery with dynamic fetching where available and static fallback lists where not.

**Acceptance Criteria:**
- AC-4.1: **Ollama** — dynamic via `GET /api/tags` (already implemented in `OllamaModelPicker`).
- AC-4.2: **OpenAI** — dynamic via `GET /v1/models`, filtered to chat-capable models (exclude embeddings, whisper, dall-e).
- AC-4.3: **Anthropic** — static curated list (no list-models API exists). Includes `claude-opus-4-6`, `claude-sonnet-4-5`, `claude-haiku-4-5` and variants.
- AC-4.4: **Google Gemini** — dynamic via `GET /v1beta/models?key={key}`, filtered to `generateContent`-capable.
- AC-4.5: **Groq** — dynamic via `GET /openai/v1/models`.
- AC-4.6: **OpenRouter** — dynamic via `GET /api/v1/models`, grouped by provider with cost tier.
- AC-4.7: Discovered models are cached in memory for 5 minutes to avoid excessive API calls.
- AC-4.8: On API error, fall back to static model list with a warning toast.
- AC-4.9: A "Custom model ID" text input serves as an escape hatch for models not in any list.

### FR-5: Provider Model Picker Component

**Description:** Build a generic `ProviderModelPicker` component that works for any provider, generalizing the existing `OllamaModelPicker`.

**Acceptance Criteria:**
- AC-5.1: `ProviderModelPicker` accepts a `provider` prop and renders a searchable dropdown of available models.
- AC-5.2: Models are grouped by family (e.g., GPT-4, GPT-4o) when the list exceeds 10 items.
- AC-5.3: A "Recommended" badge appears next to the default model for the given feature context.
- AC-5.4: Cost tier badges (free/low/medium/high) appear next to each model where cost data is available.
- AC-5.5: Shows a loading skeleton while model discovery is in progress.
- AC-5.6: `OllamaModelPicker` is refactored to be a thin wrapper around `ProviderModelPicker`.

### FR-6: Per-Feature Override UI

**Description:** Extend the Settings > AI Configuration panel with per-feature model override controls using progressive disclosure.

**Acceptance Criteria:**
- AC-6.1: **Casual tier:** Existing consent toggles remain unchanged. No new UI appears unless a user expands advanced settings.
- AC-6.2: **Intermediate tier:** A "Global Default Model" dropdown appears below provider selection. All features use this model unless overridden.
- AC-6.3: **Power tier:** Each enabled feature shows an "Override" toggle. When enabled, it expands to show provider dropdown, model dropdown, temperature slider (0.0-2.0), and max tokens input.
- AC-6.4: Override configuration persists and takes effect immediately (no "Save" button -- auto-save on change, matching existing Settings pattern).
- AC-6.5: A "Reset to defaults" button per feature clears the override.
- AC-6.6: The UI follows existing `AIConfigurationSettings.tsx` patterns and uses design tokens (no hardcoded colors).

### FR-7: OpenRouter Integration

**Description:** Add OpenRouter as a new provider option, enabling single-key access to 500+ models across providers.

**Acceptance Criteria:**
- AC-7.1: `'openrouter'` added to `AIProviderId` union type.
- AC-7.2: OpenRouter provider entry includes API key validation (`sk-or-v1-*` pattern) and test connection.
- AC-7.3: Server-side proxy routes OpenRouter requests using `createOpenAI` with `baseURL: 'https://openrouter.ai/api/v1'` and appropriate headers (`HTTP-Referer`, `X-Title`).
- AC-7.4: Model IDs use OpenRouter's `provider/model` format (e.g., `anthropic/claude-haiku-4-5`).
- AC-7.5: OpenRouter appears in the provider selector in Settings alongside existing providers.

### FR-8: LLM Client Factory Refactor

**Description:** Update the LLM client factory to accept an optional `AIFeatureId` parameter and resolve model configuration via the centralized resolver.

**Acceptance Criteria:**
- AC-8.1: `getLLMClient(feature?: AIFeatureId)` signature updated. When `feature` is provided, uses `resolveFeatureModel(feature)` for configuration.
- AC-8.2: When `feature` is omitted, falls back to the global provider default (backward compatible).
- AC-8.3: The factory retrieves the correct API key per provider via `getDecryptedApiKeyForProvider()`.
- AC-8.4: `aiSummary.ts` calls `getLLMClient('videoSummary')` — `PROVIDER_MODELS` map deleted.
- AC-8.5: `noteQA.ts` calls `getLLMClient('noteQA')` — `getModel()` function deleted.
- AC-8.6: `thumbnailService.ts` reads model from `resolveFeatureModel('thumbnailGeneration')`.

---

## 5. Non-Functional Requirements

### NFR-1: Offline Support

- Per-feature model configuration must be stored locally (IndexedDB/localStorage) and readable without network access.
- When a user selects Ollama as the provider for a feature, that feature must work fully offline.
- Model discovery for cloud providers gracefully degrades to static lists when offline.

### NFR-2: API Key Security

- API keys encrypted at rest using Web Crypto API (`AES-GCM`).
- Keys never sent to Knowlune's backend, logged to console, or included in error reports.
- Keys decrypted only at the moment of API call preparation.
- XSS is the primary attack vector for browser-stored keys. Existing Content Security Policy headers provide mitigation.

### NFR-3: Backward Compatibility

- Existing `AIConfigurationSettings` objects with no `featureModels` or `providerKeys` fields must continue working without migration.
- The legacy `apiKeyEncrypted` field is preserved indefinitely as a fallback.
- All existing AI features produce identical results when no overrides are configured.

### NFR-4: Performance

- Settings page loads in <500ms including model discovery initiation.
- Model resolution (`resolveFeatureModel()`) is synchronous and sub-millisecond (localStorage read + object lookup).
- Model discovery fetches run in background on Settings mount, not blocking UI render.

### NFR-5: Accessibility

- All new UI controls (dropdowns, sliders, toggles) meet WCAG 2.1 AA.
- Model picker dropdowns are keyboard navigable with proper ARIA labels.
- Cost tier badges have accessible text alternatives (not color-only).

---

## 6. Scope

### In Scope

| Item | Notes |
|------|-------|
| `AIFeatureId` type and `FeatureModelConfig` type | Core data model for per-feature configuration |
| `modelResolver.ts` — centralized model resolution | Replaces 3 duplicate model maps |
| `modelDiscovery.ts` — model listing for OpenAI, Anthropic (static), Gemini, Groq, OpenRouter | Dynamic where APIs exist, static fallback elsewhere |
| `ProviderModelPicker` component | Generic model dropdown for all providers |
| `FeatureModelOverride` component | Per-feature override UI with progressive disclosure |
| Temperature and max token controls per feature | Slider + input in override panel |
| Multi-provider BYOK key storage (`providerKeys`) | Encrypted, per-provider API keys |
| Migration from single `apiKeyEncrypted` to `providerKeys` | Backward compatible, non-breaking |
| OpenRouter as optional gateway provider | Single key for multi-provider access |
| LLM client factory refactor (`getLLMClient(feature)`) | Wires resolution chain into all AI consumers |
| Refactor `OllamaModelPicker` to use generic `ProviderModelPicker` | DRY component architecture |

### Out of Scope

| Item | Rationale |
|------|-----------|
| Claude Code OAuth token integration | Explicitly prohibited by Anthropic ToS (Feb 2026). Technically blocked. |
| Building or fine-tuning custom AI models | Research project, not a product feature |
| On-device model hosting beyond Ollama | Ollama handles local models. No need for additional runtimes. |
| Per-course model configuration | Configuration explosion. Per-feature is the right granularity. |
| Cost tracking or billing estimation system | Users manage their own API billing. Cost tier badges are sufficient. |
| Provider failover/fallback chains | Over-engineered for a personal app. Show error, let user switch. |
| Smart model recommendation engine | Static "Recommended" badges based on task type are sufficient. No ML-based recommendations. |
| Model marketplace or browsing UI | Simple dropdowns with known models. Custom model ID as escape hatch. |

---

## 7. Dependencies & Assumptions

### Dependencies

| Dependency | Type | Impact |
|------------|------|--------|
| Existing `AIConfigurationSettings.tsx` UI patterns | Internal | New UI extends the existing settings panel structure |
| Web Crypto API (`encryptData()`/`decryptData()`) | Internal | Multi-provider key encryption reuses existing crypto utilities |
| `OllamaModelPicker.tsx` | Internal | Refactored into generic `ProviderModelPicker` |
| Vite dev server proxy (`server/providers.ts`) | Internal | Server-side routes for model discovery and OpenRouter |
| Provider model list APIs (OpenAI, Gemini, Groq, OpenRouter) | External | Dynamic model discovery depends on provider API availability |

### Assumptions

| # | Assumption | Risk if Wrong |
|---|-----------|---------------|
| A1 | Anthropic will not add a model listing API in the near term | Low — static list still works; dynamic can be added later |
| A2 | OpenRouter's OpenAI-compatible API format will remain stable | Low — it is their core value proposition |
| A3 | Users with multiple API keys represent <30% of the user base | Low — progressive disclosure ensures casual users are unaffected |
| A4 | Existing `featureModels: undefined` (no override) produces identical behavior to current hardcoded models | Medium — must validate default model IDs match current hardcoded values exactly |
| A5 | 5-minute model discovery cache is sufficient (model lists change infrequently) | Very low — worst case is a stale list for 5 minutes |
| A6 | Epic A (Course Experience Unification) ships first, reducing the number of AI consumer touchpoints | Low — Epic B works independently, but wiring is simpler with fewer player components |

---

## 8. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Model list staleness for static providers (Anthropic) | High | Low | Static list updated each epic. "Custom model ID" escape hatch for new models. |
| R2 | User selects a model their API key cannot access | Medium | Medium | Validate model on first use. Fall back to default with toast warning. |
| R3 | Cost surprise from selecting expensive models for high-frequency features | Medium | Medium | Show cost tier badges. Warn when assigning high-cost model to auto-triggered features (e.g., auto-tagging). |
| R4 | Refactoring model resolution breaks existing AI features | Medium | High | Unit tests for `resolveFeatureModel()` covering all resolution paths. E2E tests for summary + Q&A. Zero-override config must produce identical behavior to current hardcoded models. |
| R5 | Settings page becomes overwhelming with per-feature controls | Medium | Medium | Progressive disclosure: override sections hidden by default. Only visible when user explicitly expands. |
| R6 | OpenRouter adds latency (extra network hop) | Medium | Low | OpenRouter is optional. Users with direct API keys can use individual providers. |
| R7 | Multiple API keys increase browser-side security surface | Low | Medium | Keys encrypted at rest (Web Crypto). Never logged. CSP headers mitigate XSS. |
| R8 | Server-side `DEFAULT_MODELS` diverges from client-side `PROVIDER_DEFAULTS` | Low | Medium | Move shared constants to a file importable by both client and server. |
| R9 | OpenAI model list API returns 100+ models, overwhelming the dropdown | High | Low | Filter to chat-capable models. Group by family. Limit display to 20 with search. |

---

## 9. Release Plan / Phasing

### Phase 1: Foundation (Stories 1-3)

**Goal:** Consolidate model resolution and extend the configuration type. No UI changes visible to users.

| Story | Description | Effort |
|-------|-------------|--------|
| S01 | DRY up model constants into `modelResolver.ts` with `PROVIDER_DEFAULTS` and `resolveFeatureModel()` | Small |
| S02 | Add `AIFeatureId`, `FeatureModelConfig`, `featureModels`, `providerKeys` to `AIConfigurationSettings` type | Small |
| S03 | Build `modelDiscovery.ts` — dynamic fetching for OpenAI, Gemini, Groq + static lists for Anthropic + cache layer | Medium |

**User impact:** None. All behavior identical to pre-upgrade. Internal refactoring only.

### Phase 2: Global Model Picker (Stories 4-5)

**Goal:** Users can pick a model per provider (extending the Ollama pattern to all providers). Multi-provider API key entry.

| Story | Description | Effort |
|-------|-------------|--------|
| S04 | Build `ProviderModelPicker` component, refactor `OllamaModelPicker` as wrapper | Medium |
| S05 | Add multi-provider BYOK UI — per-provider API key entry with accordion in Settings | Medium |

**User impact:** Intermediate. Users can now pick which model their provider uses globally, and enter keys for multiple providers.

### Phase 3: Per-Feature Override (Stories 6-7)

**Goal:** Power users can assign specific models + parameters to individual features. OpenRouter available as gateway.

| Story | Description | Effort |
|-------|-------------|--------|
| S06 | Build `FeatureModelOverride` component with per-feature provider/model/temperature/maxTokens controls | Medium |
| S07 | Add OpenRouter as provider option with model discovery and server-side proxy | Medium |

**User impact:** Full per-feature model customization for power users. OpenRouter as single-key multi-provider option.

### Phase 4: Wiring & Testing (Stories 8-9)

**Goal:** Connect the resolution chain through all AI consumers. Validate with E2E tests.

| Story | Description | Effort |
|-------|-------------|--------|
| S08 | Wire `getLLMClient(feature)` through `aiSummary.ts`, `noteQA.ts`, `thumbnailService.ts`. Delete duplicate model maps. | Medium |
| S09 | E2E tests for model selection flows, multi-provider configuration, and zero-override backward compatibility | Medium |

**User impact:** All configuration choices now take effect. The system is fully wired end-to-end.

---

## 10. Open Questions

| # | Question | Owner | Status | Impact |
|---|----------|-------|--------|--------|
| OQ-1 | Should `server/providers.ts` DEFAULT_MODELS be moved to a shared constants file importable by both client and server, or should the server read from `PROVIDER_DEFAULTS` at runtime? | Architecture | Open | Affects build configuration (shared module between Vite client and Express server) |
| OQ-2 | Should OpenRouter model discovery show ALL 500+ models, or filter to a curated "popular" subset? | Product | Open | UX complexity vs completeness trade-off |
| OQ-3 | Should we show estimated per-operation cost next to model names (e.g., "~$0.003 per summary"), or are cost tier badges (free/low/medium/high) sufficient? | Product | Open | Per-operation cost requires maintaining a pricing table that changes frequently |
| OQ-4 | Should the `featureModels` config be exportable/importable for users who want to share their configuration? | Product | Open | Low priority but useful for power user community |
| OQ-5 | When a user changes their global provider, should existing per-feature overrides for the old provider be preserved or cleared? | UX | Open | Preserved is safer (no data loss) but may leave stale configs |
| OQ-6 | Should model discovery proxy requests go through the existing Vite dev server proxy, or should browser-direct CORS requests be attempted first? | Architecture | Open | Browser-direct reduces server load but may hit CORS issues with some providers |
| OQ-7 | What is the migration story for the inconsistent defaults (`gpt-4o-mini` in aiSummary.ts vs `gpt-4-turbo` in server/providers.ts)? Which becomes the canonical OpenAI default? | Architecture | Open | Affects existing behavior for OpenAI users during the transition |

---

## Appendix: Hardcoded Model Inventory

Complete list of hardcoded models to replace, confirmed via codebase search:

| File | Line | Current Value | Target Resolution |
|------|------|---------------|-------------------|
| `src/ai/llm/anthropic.ts` | 19 | `claude-haiku-4-5` | `resolveFeatureModel(feature).model` via factory |
| `src/lib/noteQA.ts` | 39 | `claude-3-5-haiku-20241022` | `getLLMClient('noteQA')` |
| `src/lib/noteQA.ts` | 43 | `llama-3.3-70b-versatile` | `getLLMClient('noteQA')` |
| `src/lib/noteQA.ts` | 51 | `gemini-2.0-flash-exp` | `getLLMClient('noteQA')` |
| `src/lib/aiSummary.ts` | 110 | `claude-3-5-haiku-20241022` | `getLLMClient('videoSummary')` |
| `src/lib/aiSummary.ts` | 111 | `llama-3.3-70b-versatile` | `getLLMClient('videoSummary')` |
| `src/lib/thumbnailService.ts` | 152 | `gemini-2.0-flash-preview-image-generation` | `resolveFeatureModel('thumbnailGeneration').model` |
| `server/providers.ts` | 18-21 | `claude-haiku-4-5`, `gpt-4-turbo`, `llama-3.3-70b-versatile`, `gemini-2.0-flash` | Shared `PROVIDER_DEFAULTS` constant |

---

## References

- [Brainstorming doc](bmad-brainstorming-course-unification-ai-models.md) — Approaches B1-B4, anti-patterns, sequencing rationale
- [Architecture doc](bmad-architecture-course-unification-ai-models.md) — B1-B7 technical decisions, type designs, file inventory
- [Domain research](../research/bmad-domain-research-course-unification-ai-models.md) — Industry patterns (BYOK, task-based routing, progressive disclosure), Anthropic OAuth policy
- [Anthropic OAuth prohibition](../research/bmad-domain-research-course-unification-ai-models.md#3-claude-code--anthropic-subscription-auth-reuse) — Feb 2026 policy, community impact, allowed alternatives
