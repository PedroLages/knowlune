---
story_id: E90-S04
story_name: "Model Discovery for Cloud Providers"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, bundle-analysis, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 90.04: Model Discovery for Cloud Providers

## Story

As a user configuring AI providers,
I want the app to discover which models are available for each provider,
so that I can choose the right model for my needs.

## Acceptance Criteria

- AC1: `discoverModels(provider, apiKey)` function in `modelDiscovery.ts`
- AC2: OpenAI — fetches via server proxy, filters to chat-capable models
- AC3: Anthropic — static curated list (claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5 + dated variants)
- AC4: Gemini — fetches directly, filters to generateContent-capable models
- AC5: Groq — fetches via server proxy
- AC6: GLM — static curated list (glm-4-flash, glm-4-plus)
- AC7: 5-minute in-memory cache
- AC8: API error falls back to static list with console warning
- AC9: DiscoveredModel interface with id, name, provider, costTier, contextWindow, capabilities

## Tasks / Subtasks

- [x] Create DiscoveredModel interface and cache infrastructure
- [x] Create static model catalogs (modelDiscovery.static.ts)
- [x] Implement OpenAI dynamic discovery with aggressive filtering
- [x] Implement Gemini direct API discovery
- [x] Implement Groq dynamic discovery via proxy
- [x] Create server proxy routes (server/routes/models.ts)
- [x] Create Vite dev proxy plugin (modelDiscoveryDevProxy)
- [x] Write unit tests (13 tests covering all providers, cache, fallback)

## Lessons Learned

- Gemini API is CORS-friendly so it can be called directly from browser, unlike OpenAI and Groq which need server-side proxy
- OpenAI returns 100+ models including embeddings, whisper, dall-e, tts — aggressive filtering via include + exclude patterns is essential
- Cache key uses first 8 chars of API key as discriminator to handle multiple keys for the same provider
