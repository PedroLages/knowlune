---
story_id: E90-S10
story_name: "Multi-Provider API Key Management UI"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests-skipped, design-review, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 90.10: Multi-Provider API Key Management UI

## Story

As a learner using multiple AI providers,
I want to manage API keys for each provider in one place,
so that I can configure per-feature overrides across different providers.

## Acceptance Criteria

- AC1: Given the AI Configuration panel in Settings, when a user has multiple providers available, then an accordion shows one section per provider with API key input, test connection button, and status indicator.
- AC2: Given a user enters an API key for a provider (e.g., Anthropic), when they click "Test Connection", then the key is validated and encrypted via `saveProviderApiKey()` from E90-S03.
- AC3: Given a user has keys for both OpenAI and Anthropic, when selecting per-feature overrides (E90-S06), then both providers appear in the provider dropdown.
- AC4: Given the legacy single-key UI, when a user upgrades, then the existing key is shown under its provider section with no re-entry required.
- AC5: API key inputs use `type="password"` and keys are never displayed in plaintext after save.
- AC6: All new UI uses design tokens and meets WCAG AA.

## Tasks / Subtasks

- [x] Task 1: Create ProviderKeyAccordion component (AC: 1, 5, 6)
- [x] Task 2: Wire up test connection + save via saveProviderApiKey (AC: 2)
- [x] Task 3: Show configured status badges per provider (AC: 1)
- [x] Task 4: Ensure legacy key migration displays correctly (AC: 4)
- [x] Task 5: Integrate into AIConfigurationSettings replacing single-key input (AC: 1, 3)

## Lessons Learned

- The existing component already had providerKeys and saveProviderApiKey infrastructure from E90-S03, making this mostly a UI story.
- Missing affordance: there is no "remove/delete key" button per provider. Users can only overwrite keys, not revoke them. A "delete key" action should be added in a future story.
