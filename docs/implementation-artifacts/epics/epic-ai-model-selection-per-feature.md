# Epic: AI Model Selection Per Feature

## Overview

Knowlune's AI features are locked to hardcoded models scattered across three files (`noteQA.ts`, `aiSummary.ts`, `server/providers.ts`) with conflicting defaults (e.g., `gpt-4o-mini` vs `gpt-4-turbo` for OpenAI). Users have zero control over which model powers which feature, no model discovery for cloud providers, and no ability to use multiple providers simultaneously.

This epic consolidates all model resolution into a single module with a three-tier cascade (user override, feature default, global default), adds model discovery for all providers, builds a per-feature override UI with progressive disclosure, and wires every AI consumer through the new resolution chain. Casual users experience no change; power users gain full per-feature model assignment with temperature and token controls.

## Stories

### Story 1: Define Shared Model Constants and Feature Model Config Type

- **ID:** E90-S01
- **Points:** 2
- **Priority:** P0
- **Dependencies:** none
- **Summary:** Replace hardcoded model strings scattered across `noteQA.ts`, `aiSummary.ts`, and `server/providers.ts` with a centralized `PROVIDER_DEFAULTS` map and new types (`AIFeatureId`, `FeatureModelConfig`) in `aiConfiguration.ts`.
- **Acceptance Criteria:**
  - AC1: `AIFeatureId` union type enumerates all 9 AI features: `videoSummary`, `noteQA`, `thumbnailGeneration`, `quizGeneration`, `flashcardGeneration`, `learningPath`, `knowledgeGaps`, `noteOrganization`, `analytics`
  - AC2: `FeatureModelConfig` interface includes `provider: AIProviderId`, `model: string`, optional `temperature: number` (0.0-2.0), optional `maxTokens: number`
  - AC3: `PROVIDER_DEFAULTS: Record<AIProviderId, string>` map exists in a single file, replacing the three duplicate maps (currently in `aiSummary.ts:108-115`, `noteQA.ts:35-49`, `server/providers.ts:17-23`)
  - AC4: `FEATURE_DEFAULTS: Record<AIFeatureId, { provider: AIProviderId; model: string }>` map provides recommended defaults per feature (e.g., `videoSummary` defaults to Anthropic Haiku for cost efficiency)
  - AC5: `featureModels?: Partial<Record<AIFeatureId, FeatureModelConfig>>` field added to `AIConfigurationSettings` interface. Existing configs with `featureModels: undefined` continue working without migration
  - AC6: `getAIConfiguration()` spreads `featureModels` from storage like other optional fields — no breaking change to existing callers
  - AC7: Build passes (`npm run build`) and all existing unit/E2E tests pass unchanged
- **Key Files:**
  - `src/lib/aiConfiguration.ts` — add types, `PROVIDER_DEFAULTS`, `FEATURE_DEFAULTS`
  - `src/lib/modelDefaults.ts` — NEW: shared constants importable by both client and server
- **Technical Notes:** Move `DEFAULT_MODELS` from `server/providers.ts` into a shared module (`modelDefaults.ts`) importable by both Vite client and Express server to prevent future divergence. Resolve the `gpt-4o-mini` vs `gpt-4-turbo` conflict — use `gpt-4o-mini` as the canonical OpenAI default (cheaper, newer). Do NOT delete the duplicate maps in consumer files yet — that happens in E90-S08.

---

### Story 2: Refactor LLM Client Factory with Feature-Aware Model Resolution

- **ID:** E90-S02
- **Points:** 3
- **Priority:** P0
- **Dependencies:** E90-S01
- **Summary:** Add `resolveFeatureModel()` resolver and update `getLLMClient()` to accept an optional `AIFeatureId` parameter, implementing the three-tier resolution cascade: user per-feature override, feature default, global provider default.
- **Acceptance Criteria:**
  - AC1: `resolveFeatureModel(feature: AIFeatureId)` returns `{ provider: AIProviderId; model: string; temperature?: number; maxTokens?: number }` using the three-tier cascade
  - AC2: When `featureModels[feature]` is set in config, `resolveFeatureModel()` returns the user's override
  - AC3: When `featureModels[feature]` is NOT set, `resolveFeatureModel()` returns `FEATURE_DEFAULTS[feature]`
  - AC4: When a feature has no entry in `FEATURE_DEFAULTS`, resolution falls back to the global provider's default model from `PROVIDER_DEFAULTS`
  - AC5: `getLLMClient(feature?: AIFeatureId)` signature updated — when `feature` is provided, uses `resolveFeatureModel(feature)` for configuration; when omitted, falls back to global provider default (backward compatible)
  - AC6: The factory retrieves the correct API key per provider via `getDecryptedApiKeyForProvider()` (using provider from resolution result, not global config)
  - AC7: Unit tests cover all three resolution tiers and edge cases (missing feature default, missing override, Ollama provider path)
- **Key Files:**
  - `src/lib/aiConfiguration.ts` — add `resolveFeatureModel()`
  - `src/ai/llm/factory.ts` — update `getLLMClient()` signature and implementation
- **Technical Notes:** `resolveFeatureModel()` must be synchronous (localStorage read + object lookup). The factory's `getLLMClient()` remains async because it decrypts the API key. For Ollama provider resolution, continue using `getOllamaServerUrl()` and `getOllamaSelectedModel()` — Ollama does not use the `model` field from `resolveFeatureModel()` because the user selects the Ollama model via `OllamaModelPicker`.

---

### Story 3: Multi-Provider BYOK Key Storage

- **ID:** E90-S03
- **Points:** 2
- **Priority:** P0
- **Dependencies:** E90-S01
- **Summary:** Extend encrypted API key storage from a single `apiKeyEncrypted` field to a `providerKeys` map, enabling users to store keys for multiple providers simultaneously while maintaining full backward compatibility.
- **Acceptance Criteria:**
  - AC1: `providerKeys?: Partial<Record<AIProviderId, EncryptedData>>` field added to `AIConfigurationSettings`
  - AC2: `getDecryptedApiKeyForProvider(provider: AIProviderId)` implemented — checks `providerKeys[provider]` first, then falls back to legacy `apiKeyEncrypted` for the global provider
  - AC3: Existing single-key users experience no breakage — legacy `apiKeyEncrypted` field preserved as fallback indefinitely
  - AC4: `saveProviderApiKey(provider: AIProviderId, apiKey: string)` encrypts and stores to `providerKeys[provider]` using existing `encryptData()` pattern
  - AC5: API keys are never logged, sent to backend, or stored in plaintext — validated by code review
  - AC6: When a user saves a new provider key, the `ai-configuration-updated` custom event fires for cross-tab sync
  - AC7: Unit tests cover: new key storage, legacy fallback, provider-not-found returns null, Ollama bypass (returns 'ollama' dummy key)
- **Key Files:**
  - `src/lib/aiConfiguration.ts` — add `providerKeys` field, `getDecryptedApiKeyForProvider()`, `saveProviderApiKey()`
- **Technical Notes:** Do NOT auto-migrate `apiKeyEncrypted` to `providerKeys` on load — this avoids re-encryption churn and potential data loss. Instead, `getDecryptedApiKeyForProvider()` transparently falls back. The existing `getDecryptedApiKey()` function should be updated to delegate to `getDecryptedApiKeyForProvider(config.provider)` to avoid duplication.

---

### Story 4: Model Discovery for Cloud Providers

- **ID:** E90-S04
- **Points:** 3
- **Priority:** P1
- **Dependencies:** E90-S03
- **Summary:** Implement provider-specific model discovery with dynamic API fetching (OpenAI, Gemini, Groq) and static curated lists (Anthropic, GLM), with a 5-minute in-memory cache and graceful error fallback.
- **Acceptance Criteria:**
  - AC1: `discoverModels(provider: AIProviderId, apiKey: string): Promise<DiscoveredModel[]>` function implemented in new `modelDiscovery.ts`
  - AC2: **OpenAI** — fetches `GET /v1/models` via server proxy, filters to chat-capable models (excludes embeddings, whisper, dall-e, tts), returns model IDs with family grouping
  - AC3: **Anthropic** — returns static curated list including `claude-opus-4-6`, `claude-sonnet-4-5`, `claude-haiku-4-5` and dated variants
  - AC4: **Google Gemini** — fetches `GET /v1beta/models?key={key}`, filters to `generateContent`-capable models
  - AC5: **Groq** — fetches `GET /openai/v1/models` via server proxy, returns available models
  - AC6: **GLM/Z.ai** — returns static curated list (`glm-4-flash`, `glm-4-plus`)
  - AC7: Discovered models cached in memory for 5 minutes — repeated calls within window return cached results without API calls
  - AC8: On API error, falls back to static model list with a warning toast (`"Could not fetch models — showing defaults"`)
  - AC9: `DiscoveredModel` interface includes `id`, `name`, `provider`, optional `costTier` (`'free' | 'low' | 'medium' | 'high'`), optional `contextWindow`, `capabilities` array
- **Key Files:**
  - `src/lib/modelDiscovery.ts` — NEW: discovery service with dynamic + static fallback
  - `src/lib/modelDiscovery.static.ts` — NEW: static model catalog (separated for easy updates)
  - `server/routes/models.ts` — NEW: proxy endpoints for model list APIs (handles CORS)
- **Technical Notes:** Model list APIs are proxied through the Vite dev server to avoid CORS issues. OpenAI returns 100+ models — filter aggressively (only `gpt-*` chat models). Use the existing Vite proxy pattern from `server/providers.ts`. Anthropic has no model listing API — the static list must be manually updated when new models launch.

---

### Story 5: Build Global Model Picker UI in Settings

- **ID:** E90-S05
- **Points:** 3
- **Priority:** P1
- **Dependencies:** E90-S04
- **Summary:** Build a generic `ProviderModelPicker` component that works for any provider (generalizing the existing `OllamaModelPicker` pattern), and integrate it into the Settings > AI Configuration panel as a global default model selector per provider.
- **Acceptance Criteria:**
  - AC1: `ProviderModelPicker` component accepts `provider: AIProviderId`, `apiKey: string`, `selectedModel?: string`, `onModelSelect: (model: string) => void` props
  - AC2: Renders a searchable dropdown (combobox) of available models using `discoverModels()` from E90-S04
  - AC3: Models grouped by family (e.g., GPT-4, GPT-4o, Claude 3.5) when list exceeds 10 items
  - AC4: A "Recommended" badge appears next to the default model for the current provider
  - AC5: Shows a loading skeleton while model discovery is in progress; shows error state on failure
  - AC6: A "Custom model ID" text input appears below the dropdown as an escape hatch for models not in the list
  - AC7: `OllamaModelPicker` refactored to be a thin wrapper around `ProviderModelPicker` with Ollama-specific props (size display, refresh button)
  - AC8: Global model picker appears in Settings below provider selection — selecting a model persists to `AIConfigurationSettings.globalModelOverride` (runtime config), NOT modifying the `PROVIDER_DEFAULTS` code constant
  - AC9: All new UI uses design tokens (no hardcoded colors) and meets WCAG AA keyboard navigation
- **Key Files:**
  - `src/app/components/figma/ProviderModelPicker.tsx` — NEW: generic model picker component
  - `src/app/components/figma/OllamaModelPicker.tsx` — refactor to wrap `ProviderModelPicker`
  - `src/app/components/figma/AIConfigurationSettings.tsx` — integrate global model picker
- **Technical Notes:** Follow the existing `OllamaModelPicker.tsx` patterns: shadcn `Command` combobox, `Popover` for dropdown, loading/error states. The generic component should accept a `renderModelItem` prop for provider-specific rendering (Ollama shows size, OpenAI shows family). Use the existing `cn()` utility and design tokens from `theme.css`.

---

### Story 6: Build Per-Feature Model Override UI

- **ID:** E90-S06
- **Points:** 3
- **Priority:** P1
- **Dependencies:** E90-S05, E90-S02
- **Summary:** Add progressive disclosure per-feature model override controls under each consent toggle in Settings, allowing power users to assign specific provider/model combinations to individual AI features.
- **Acceptance Criteria:**
  - AC1: Each enabled consent toggle gains an "Override model" toggle beneath it. Disabled by default — existing consent toggles remain unchanged for casual users
  - AC2: When "Override model" is enabled, an expandable panel shows: provider dropdown, model picker (using `ProviderModelPicker`), and a "Reset to defaults" button
  - AC3: Override configuration persists to `featureModels` in config via `saveAIConfiguration()` — auto-saves on change (no "Save" button), matching existing Settings pattern
  - AC4: "Reset to defaults" clears the feature's entry from `featureModels` and collapses the override panel
  - AC5: Disabled consent toggles hide the override section entirely (cannot configure a model for a disabled feature)
  - AC6: Override provider dropdown only shows providers that have an API key configured in `providerKeys` (or the global provider)
  - AC7: All new UI follows `AIConfigurationSettings.tsx` layout patterns, uses design tokens, and meets WCAG AA (keyboard navigable, proper ARIA labels)
  - AC8: Existing E2E tests for consent toggles continue passing unchanged
- **Key Files:**
  - `src/app/components/figma/FeatureModelOverride.tsx` — NEW: per-feature override panel component
  - `src/app/components/figma/AIConfigurationSettings.tsx` — integrate override panels beneath consent toggles
  - `src/lib/aiConfiguration.ts` — `saveFeatureModelOverride(feature, config)` and `clearFeatureModelOverride(feature)` helpers
- **Technical Notes:** Use shadcn `Collapsible` for progressive disclosure (already imported in `AIConfigurationSettings.tsx`). The override panel should animate open/closed. Provider dropdown filters to providers with configured keys by reading `providerKeys` from config. When a provider is selected, the model picker fetches models for that provider specifically.

---

### Story 7: Add Temperature and Max-Token Sliders Per Feature

- **ID:** E90-S07
- **Points:** 2
- **Priority:** P2
- **Dependencies:** E90-S06
- **Summary:** Extend the per-feature override panel with temperature and max-token controls, giving power users fine-grained control over AI generation behavior per feature.
- **Acceptance Criteria:**
  - AC1: Temperature slider (0.0-2.0, step 0.1) appears in the override panel when "Override model" is enabled
  - AC2: Max tokens input (number field, range 100-32000) appears below temperature slider
  - AC3: Both controls show their current value and a "Default" indicator when unset (using the model's default)
  - AC4: Changes auto-save to `featureModels[feature].temperature` and `featureModels[feature].maxTokens` respectively
  - AC5: "Reset to defaults" also clears temperature and maxTokens overrides
  - AC6: Slider and input are accessible: proper labels, keyboard operable, screen reader announces value changes
  - AC7: Tooltip on temperature slider explains the effect: "Lower = more deterministic, Higher = more creative"
- **Key Files:**
  - `src/app/components/figma/FeatureModelOverride.tsx` — add temperature slider and max-token input
- **Technical Notes:** Use shadcn `Slider` component for temperature (already available in the component library). Max tokens uses shadcn `Input` with `type="number"`. Debounce auto-save by 500ms to avoid excessive localStorage writes while user drags the slider. Show preset suggestions: "Precise (0.1)" for quizzes, "Balanced (0.7)" for summaries, "Creative (1.2)" for learning paths.

---

### Story 8: Wire All AI Features to Use New Config

- **ID:** E90-S08
- **Points:** 5
- **Priority:** P0
- **Dependencies:** E90-S02
- **Summary:** Migrate all AI consumer files to call `getLLMClient(featureId)` instead of constructing clients with hardcoded models. Delete the duplicate model maps from consumer files.
- **Acceptance Criteria:**
  - AC1: `aiSummary.ts` calls `getLLMClient('videoSummary')` — the `PROVIDER_MODELS` map (lines 108-115) is deleted
  - AC2: `noteQA.ts` calls `getLLMClient('noteQA')` — the `getModel()` function (lines 35-55) is deleted
  - AC3: `thumbnailService.ts` reads model from `resolveFeatureModel('thumbnailGeneration').model` instead of hardcoded `gemini-2.0-flash-preview-image-generation`
  - AC4: `server/providers.ts` `DEFAULT_MODELS` map replaced with import from shared `modelDefaults.ts` (from E90-S01)
  - AC5: Zero-override backward compatibility: when `featureModels` is empty/undefined, every AI feature produces requests to the same models as before this epic
  - AC6: All existing E2E tests for AI features (summary generation, Q&A, thumbnail) pass unchanged
  - AC7: No duplicate model constant maps remain in the codebase — verified by grep for `PROVIDER_MODELS`, `DEFAULT_MODELS` (except the canonical `PROVIDER_DEFAULTS`)
  - AC8: Given a user configures a model their API key does not have access to, when the feature triggers and the API returns a 403/model-not-found error, then the system falls back to the provider default model and shows a toast warning ("Model unavailable, using default")
- **Key Files:**
  - `src/lib/aiSummary.ts` — replace `PROVIDER_MODELS` with `getLLMClient('videoSummary')`
  - `src/lib/noteQA.ts` — replace `getModel()` with `getLLMClient('noteQA')`
  - `src/lib/thumbnailService.ts` — use `resolveFeatureModel('thumbnailGeneration')`
  - `server/providers.ts` — import from `modelDefaults.ts`
  - `src/ai/llm/anthropic.ts` — remove hardcoded `claude-haiku-4-5` default
- **Technical Notes:** This is the high-risk story. Each consumer file has slightly different client construction patterns (some use dynamic imports, some use the proxy client). Test each migration individually. The key invariant to verify: with empty `featureModels`, every consumer file requests the EXACT same model as it did before this epic. Create a manual checklist mapping old hardcoded model to new resolved model for each file.

---

### Story 9: Add OpenRouter as Optional Single-Gateway Provider

- **ID:** E90-S09
- **Points:** 3
- **Priority:** P2
- **Dependencies:** E90-S04, E90-S03
- **Summary:** Add OpenRouter as a new provider option, enabling single-key access to 500+ models across providers without needing individual API keys per provider.
- **Acceptance Criteria:**
  - AC1: `'openrouter'` added to `AIProviderId` union type in `aiConfiguration.ts`
  - AC2: OpenRouter entry in `AI_PROVIDERS` registry with key validation (`sk-or-v1-*` pattern) and test connection
  - AC3: Server-side proxy route uses `createOpenAI` with `baseURL: 'https://openrouter.ai/api/v1'` and headers (`HTTP-Referer: Knowlune`, `X-Title: Knowlune`)
  - AC4: Model discovery for OpenRouter fetches `GET /api/v1/models`, grouped by source provider, with cost tier badges
  - AC5: Model IDs use OpenRouter's `provider/model` format (e.g., `anthropic/claude-haiku-4-5`)
  - AC6: OpenRouter appears in the provider selector in Settings alongside existing providers
  - AC7: A user can select OpenRouter as the provider for a per-feature override (e.g., use `anthropic/claude-sonnet-4-5` via OpenRouter for noteQA)
  - AC8: CSP allowlist updated to permit requests to `openrouter.ai` domain
- **Key Files:**
  - `src/lib/aiConfiguration.ts` — add `'openrouter'` to `AIProviderId`, add to `AI_PROVIDERS`
  - `server/routes/openrouter.ts` — NEW: proxy route for OpenRouter API calls
  - `src/lib/modelDiscovery.ts` — add OpenRouter model discovery
  - `src/app/components/figma/AIConfigurationSettings.tsx` — add OpenRouter to provider selector
  - `vite.config.ts` — add CSP entry for `openrouter.ai`
- **Technical Notes:** OpenRouter uses the OpenAI-compatible API format, so the existing `ProxyLLMClient` can handle it with a `baseURL` override. The model list from OpenRouter can return 500+ entries — limit to 50 most popular and add search filtering. Group models by provider prefix (e.g., all `anthropic/*` models together). Show pricing info from the API response as cost tier badges.

---

### Story 10: Multi-Provider API Key Management UI

- **ID:** E90-S10
- **Points:** 2
- **Priority:** P1
- **Dependencies:** E90-S03
- **Summary:** Build the Settings UI for managing API keys across multiple providers simultaneously, extending the existing single-key input to an accordion of per-provider key entries with connection testing.
- **Acceptance Criteria:**
  - AC1: Given the AI Configuration panel in Settings, when a user has multiple providers available, then an accordion shows one section per provider with API key input, test connection button, and status indicator.
  - AC2: Given a user enters an API key for a provider (e.g., Anthropic), when they click "Test Connection", then the key is validated and encrypted via `saveProviderApiKey()` from E90-S03.
  - AC3: Given a user has keys for both OpenAI and Anthropic, when selecting per-feature overrides (E90-S06), then both providers appear in the provider dropdown.
  - AC4: Given the legacy single-key UI, when a user upgrades, then the existing key is shown under its provider section with no re-entry required.
  - AC5: API key inputs use `type="password"` and keys are never displayed in plaintext after save.
  - AC6: All new UI uses design tokens and meets WCAG AA.
- **Key Files:**
  - MODIFY: `src/app/components/figma/AIConfigurationSettings.tsx` — replace single key input with per-provider accordion
- **Technical Notes:** Use shadcn `Accordion` component. Each provider section shows: provider name + logo, API key input, test connection button, status badge (connected/error/not configured). Only show providers that the user might use — Ollama always shows (local), others show when user expands "Add provider" section.

---

### Story 11: E2E Tests for Model Selection Flows

- **ID:** E90-S11
- **Points:** 2
- **Priority:** P1
- **Dependencies:** E90-S08
- **Summary:** Write E2E tests covering model selection flows, multi-provider configuration, per-feature override, and zero-override backward compatibility.
- **Acceptance Criteria:**
  - AC1: E2E test verifies that with no `featureModels` configured, AI features use the same default models as before this epic (backward compatibility).
  - AC2: E2E test verifies that configuring a global model picker updates the model used by all features.
  - AC3: E2E test verifies that a per-feature override takes precedence over the global model.
  - AC4: E2E test verifies that "Reset to defaults" clears the override and reverts to global model.
  - AC5: E2E test verifies that the Settings page renders model picker, per-feature overrides, and temperature sliders without console errors.
  - AC6: E2E test verifies that multi-provider key entry works (enter key for Provider A, switch feature to Provider A, verify feature uses Provider A's model).
- **Key Files:**
  - CREATE: `tests/e2e/ai-model-selection.spec.ts`
- **Technical Notes:** Use Playwright's `page.addInitScript()` to seed AI configuration in localStorage before page load. Mock API responses for model discovery endpoints. Focus on Settings UI interaction + config persistence verification rather than actual AI calls.
