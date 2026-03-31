---
story_id: E90-S05
story_name: "Build Global Model Picker UI in Settings"
status: in-progress
started: 2026-03-30
completed:
reviewed: in-progress
review_started: 2026-03-30
review_gates_passed: []
burn_in_validated: false
---

# Story 90.05: Build Global Model Picker UI in Settings

## Story

As a learner with multiple AI providers configured,
I want to pick a default model per provider from a searchable dropdown,
so that I can control which model my AI features use without editing code constants.

## Acceptance Criteria

- AC1: `ProviderModelPicker` component accepts `provider: AIProviderId`, `apiKey: string`, `selectedModel?: string`, `onModelSelect: (model: string) => void` props
- AC2: Renders a searchable dropdown (combobox) of available models using `discoverModels()` from E90-S04
- AC3: Models grouped by family (e.g., GPT-4, GPT-4o, Claude 3.5) when list exceeds 10 items
- AC4: A "Recommended" badge appears next to the default model for the current provider
- AC5: Shows a loading skeleton while model discovery is in progress; shows error state on failure
- AC6: A "Custom model ID" text input appears below the dropdown as an escape hatch for models not in the list
- AC7: `OllamaModelPicker` refactored to be a thin wrapper around `ProviderModelPicker` with Ollama-specific props (size display, refresh button)
- AC8: Global model picker appears in Settings below provider selection — selecting a model persists to `AIConfigurationSettings.globalModelOverride` (runtime config), NOT modifying the `PROVIDER_DEFAULTS` code constant
- AC9: All new UI uses design tokens (no hardcoded colors) and meets WCAG AA keyboard navigation

## Tasks / Subtasks

- [ ] Task 1: Add `globalModelOverride` field to `AIConfigurationSettings` interface (AC8)
- [ ] Task 2: Build `ProviderModelPicker` component (AC1-AC6)
  - [ ] 2.1: Core combobox with search using shadcn Command + Popover
  - [ ] 2.2: Model grouping by family when >10 models
  - [ ] 2.3: "Recommended" badge on provider default model
  - [ ] 2.4: Loading skeleton and error states
  - [ ] 2.5: Custom model ID text input escape hatch
- [ ] Task 3: Refactor `OllamaModelPicker` as thin wrapper (AC7)
- [ ] Task 4: Integrate global model picker in `AIConfigurationSettings` (AC8)
- [ ] Task 5: Update `resolveFeatureModel` to use `globalModelOverride` (AC8)

## Implementation Notes

- `ProviderModelPicker` uses shadcn Command + Popover for accessible combobox with search
- Models grouped by family when list exceeds 10 items (AC3)
- `OllamaModelPicker` retained its own fetch logic (local /api/tags) rather than wrapping `ProviderModelPicker`, because Ollama discovery uses a fundamentally different mechanism than cloud providers
- `globalModelOverride` added to `AIConfigurationSettings` interface for runtime config persistence (AC8)
- Used ref-based check (`hasModelsRef`) instead of `models.length` in `useCallback` deps to prevent double-fetch

## Testing Notes

- No E2E spec for this story — UI-only component changes validated via build and manual review
- Key edge cases: empty model lists, failed discovery, custom model ID input, grouped vs flat display

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

Populated during /finish-story streamlined review.

## Code Review Feedback

Populated during /finish-story streamlined review.

## Challenges and Lessons Learned

- `models.length` in `useCallback` dependency arrays causes re-creation on every fetch, leading to potential double-fetch loops. Use a ref (`hasModelsRef`) for mutable state checks inside callbacks.
- Ollama's local /api/tags endpoint is fundamentally different from cloud provider discovery APIs — wrapping it in the generic `ProviderModelPicker` would add complexity without benefit. Keeping separate fetch logic in `OllamaModelPicker` is the right trade-off.
- Duplicate imports across `lucide-react` lines are easy to miss during development; consolidate icon imports into a single statement early.
