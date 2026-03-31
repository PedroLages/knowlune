---
story_id: E90-S03
story_name: "Multi-Provider BYOK Key Storage"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 90.03: Multi-Provider BYOK Key Storage

## Story

As a power user with multiple AI provider accounts,
I want to store API keys for multiple providers simultaneously,
so that I can use different providers for different AI features without re-entering keys.

## Acceptance Criteria

- AC1: `providerKeys?: Partial<Record<AIProviderId, EncryptedData>>` field added to `AIConfigurationSettings`
- AC2: `getDecryptedApiKeyForProvider(provider: AIProviderId)` implemented — checks `providerKeys[provider]` first, then falls back to legacy `apiKeyEncrypted` for the global provider
- AC3: Existing single-key users experience no breakage — legacy `apiKeyEncrypted` field preserved as fallback indefinitely
- AC4: `saveProviderApiKey(provider: AIProviderId, apiKey: string)` encrypts and stores to `providerKeys[provider]` using existing `encryptData()` pattern
- AC5: API keys are never logged, sent to backend, or stored in plaintext — validated by code review
- AC6: When a user saves a new provider key, the `ai-configuration-updated` custom event fires for cross-tab sync
- AC7: Unit tests cover: new key storage, legacy fallback, provider-not-found returns null, Ollama bypass (returns 'ollama' dummy key)

## Tasks / Subtasks

- [x] Task 1: Implement `saveProviderApiKey()` in aiConfiguration.ts (AC4, AC5, AC6)
- [x] Task 2: Refactor `getDecryptedApiKey()` to delegate to `getDecryptedApiKeyForProvider()` (AC2, AC3)
- [x] Task 3: Write unit tests covering all AC7 scenarios (AC7)

## Implementation Notes

- `providerKeys` field and `getDecryptedApiKeyForProvider()` were already scaffolded in E90-S01/S02
- `getDecryptedApiKey()` refactored to delegate to `getDecryptedApiKeyForProvider(config.provider)` — eliminates code duplication
- Legacy `apiKeyEncrypted` field is never modified by `saveProviderApiKey()` — backward compatibility preserved
- `saveProviderApiKey()` uses the same `encryptData()` pattern as existing `saveAIConfiguration()`

## Testing Notes

- 18 unit tests in `src/lib/__tests__/providerKeyStorage.test.ts`
- Existing 29 tests in `aiConfiguration.test.ts` and 16 in `resolveFeatureModel.test.ts` pass unchanged

## Challenges and Lessons Learned

- Most of the infrastructure (types, fields, `getDecryptedApiKeyForProvider()`) was already in place from E90-S01/S02. The main new work was `saveProviderApiKey()` and the `getDecryptedApiKey()` delegation refactor.
