# Adversarial Review: Epic 90 — AI Model Selection Per Feature

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Epic:** E90 — 11 stories, all marked done
**Verdict:** PASS WITH CONCERNS (3 critical, 4 high, 5 medium)

---

## Critical Findings

### C1. OpenRouter and GLM are dead providers at runtime (BUG)

**File:** `src/ai/llm/factory.ts:130`

`getLLMClientForProvider()` hardcodes a `supported` array: `['openai', 'anthropic', 'groq', 'gemini', 'ollama']`. Neither `openrouter` nor `glm` is included. Any user who configures OpenRouter or GLM as a per-feature override will get `LLMError: Unsupported AI provider: openrouter` at inference time. The entire S09 story (OpenRouter provider) ships a UI that lets users select a provider that throws at runtime. This passed code review and E2E tests because tests mock the LLM client layer and never exercise this code path with real provider IDs.

**Severity:** CRITICAL — Feature is broken for 2 of 7 providers.

### C2. `hashKey()` for cache keys is collision-prone

**File:** `src/lib/modelDiscovery.ts:51-57`

The cache uses a simple djb2-style hash to avoid storing raw API keys. This hash produces a 32-bit integer, meaning collision probability hits 50% at ~77K entries (birthday paradox). More practically: two different API keys for the same provider could collide and return stale/wrong model lists. The MAX_CACHE_ENTRIES=50 limit mitigates this somewhat, but the hash is still fundamentally weak. If two users share a browser profile or a user rotates keys, they could see cached results from the old key.

**Severity:** CRITICAL — Silent data corruption (wrong model list served).

### C3. No rate limiting or cost guardrails on model selection

The epic lets users select any model from any provider per feature — including expensive models like `gpt-4-turbo`, `claude-opus-4`, or `o3`. There are no cost warnings, spending caps, or confirmation dialogs. A user could unknowingly rack up significant API bills by selecting a high-cost model for a high-frequency feature (e.g., noteQA with Opus). The `costTier` field exists in `DiscoveredModel` but is never surfaced in the UI or used for warnings.

**Severity:** CRITICAL — Financial risk to users with no guardrails.

---

## High Findings

### H1. Duplicated fallback logic across aiSummary.ts and noteQA.ts (acknowledged, not fixed)

The code review for S08 flagged this as MEDIUM. A shared `withModelFallback()` was eventually added to `factory.ts:157-211`, but the original copy-pasted fallback blocks in `aiSummary.ts` and `noteQA.ts` were not removed — they still exist alongside the new shared helper. This means there are now THREE fallback implementations: the shared one and two copies. The consumers may or may not be using the shared version.

**Severity:** HIGH — Maintenance burden and divergence risk.

### H2. Temperature/maxTokens sliders have no validation against provider limits

**File:** `src/app/components/figma/FeatureModelOverridePanel.tsx:50-54`

Temperature range is hardcoded 0.0-2.0 and max tokens 100-32000, but different providers have different limits. OpenAI allows temperature 0-2, Anthropic 0-1, Ollama varies by model. Groq caps max_tokens differently per model. A user could set temperature=1.8 for an Anthropic model, which would either error at inference or be silently clamped by the API — neither is communicated to the user.

**Severity:** HIGH — Silent failures or confusing errors at inference time.

### H3. 9 features defined, only 3 wired

`AIFeatureId` enumerates 9 features: videoSummary, noteQA, thumbnailGeneration, quizGeneration, flashcardGeneration, learningPath, knowledgeGaps, noteOrganization, analytics. S08 only wired videoSummary, noteQA, and thumbnailGeneration. The remaining 6 features appear in the UI override panel but are ghost options — selecting a model for `quizGeneration` does nothing because no consumer calls `getLLMClient('quizGeneration')`. Users see 9 configurable features but only 3 actually respect the configuration.

**Severity:** HIGH — Misleading UI, user trust erosion.

### H4. `testConnection` catch swallows errors silently

**File:** `src/lib/aiConfiguration.ts:225`

The `catch {}` block in `testConnection` for OpenRouter returns `false` with no logging. When a user clicks "Test Connection" and it fails, they get a generic failure with no diagnostic information. The code review noted this as LOW but for a BYOK feature where users are troubleshooting their own API keys, silent error swallowing is particularly harmful.

**Severity:** HIGH — Poor debuggability for the primary user action (key validation).

---

## Medium Findings

### M1. Model discovery cache uses `Date.now()` — not deterministic in tests

**File:** `src/lib/modelDiscovery.ts:68,92`

Two `Date.now()` calls in production code. While tests clear the cache, any test that relies on cache TTL behavior would be flaky. The project's ESLint rule `test-patterns/deterministic-time` only catches `Date.now()` in test files, not in production code that tests exercise.

### M2. OpenRouter `.slice(0, 50)` applied after sort (S09 fix) but before relevance ranking

**File:** `src/lib/modelDiscovery.ts:340`

The code review for S09 noted that slicing was done before sort. The fix sorted first, then sliced. But the sort is alphabetical by family+id — not by popularity, usage, or relevance. Users see 50 alphabetically-first models, not the 50 most useful ones. OpenRouter returns 1000+ models; the top 50 alphabetically will be dominated by obscure providers starting with "a".

### M3. No migration path for legacy single-key users

S03 added `providerKeys` map alongside the legacy `apiKeyEncrypted` field. `getDecryptedApiKeyForProvider()` falls back to legacy. But there is no one-time migration that copies the legacy key into the new `providerKeys` map. This means legacy users permanently live on the fallback path, and the legacy field can never be removed without a breaking migration.

### M4. 25 pre-existing failing unit tests acknowledged but not addressed

The code review for S08 noted 25 pre-existing test failures in `isPremium.test.ts`, `AtRiskBadge.test.tsx`, `VideoReorderList.test.tsx`. These failures predate E90 but create a "broken windows" environment where new failures might be dismissed as pre-existing.

### M5. E2E tests use `__mockLLMClient` window injection — brittle and non-representative

**File:** `src/ai/llm/factory.ts:47-52`

The LLM factory checks `window.__mockLLMClient` before any real logic. This means E2E tests never exercise the actual provider resolution, API key retrieval, or client construction. The C1 bug (OpenRouter not in supported list) was invisible to E2E tests precisely because of this mock injection pattern. The tests validate UI behavior but not the integration they claim to test.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 3 | C1 (OpenRouter/GLM broken), C2 (cache collision), C3 (no cost guardrails) |
| HIGH | 4 | H1 (triple fallback), H2 (provider-specific limits), H3 (6 ghost features), H4 (silent catch) |
| MEDIUM | 5 | M1 (Date.now), M2 (alphabetical slice), M3 (no migration), M4 (broken windows), M5 (mock bypass) |
| **Total** | **12** | |

## Recommendations

1. **Immediate:** Fix C1 — add `'openrouter'` and `'glm'` to the supported array in `getLLMClientForProvider()`, or better, derive it from `AIProviderId` type to prevent future drift.
2. **Immediate:** Add cost tier warnings in the model picker UI (C3) — even a simple badge is better than nothing.
3. **Short-term:** Replace `hashKey()` with `crypto.subtle.digest('SHA-256', ...)` for cache keys (C2).
4. **Short-term:** Add provider-specific parameter validation or at minimum show provider limits in the UI (H2).
5. **Short-term:** Hide or disable the 6 unwired features in the override panel, or add a "coming soon" indicator (H3).
6. **Medium-term:** Write integration-level E2E tests that exercise real provider resolution without `__mockLLMClient` (M5).
