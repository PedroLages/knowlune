---
story_id: E22-S02
story_name: "Model Auto-Discovery"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 22.02: Model Auto-Discovery

## Story

As a user,
I want to see my available Ollama models in a dropdown after entering my server URL,
so that I don't have to manually type model names.

## Acceptance Criteria

- **AC1**: Given I have entered a valid Ollama URL, When the URL is saved, Then the app calls `GET /api/tags` and populates a model dropdown
- **AC2**: Given models are fetched successfully, When I view the model dropdown, Then each model shows its name and size (e.g., "llama3.2:3b — 2.0 GB")
- **AC3**: Given I select a model, When I save the configuration, Then the selected model name is persisted in AI configuration localStorage
- **AC4**: Given Ollama is unreachable, When model fetch fails, Then a clear error message is shown: "Cannot reach Ollama at {url}. Is the server running?"
- **AC5**: Given I change the Ollama URL, When the URL field loses focus or I press Enter, Then the model list refreshes automatically

## Tasks / Subtasks

- [ ] Task 1: Implement model listing (AC: 1, 2)
  - [ ] 1.1 Add `listModels()` method to OllamaLLMClient calling `GET /api/tags`
  - [ ] 1.2 Parse response: `{ models: [{ name, size, modified_at, details }] }`
  - [ ] 1.3 Format model display: name + human-readable size
- [ ] Task 2: Model picker UI (AC: 2, 3, 5)
  - [ ] 2.1 Add searchable Select/Combobox dropdown to AIConfigurationSettings
  - [ ] 2.2 Trigger model fetch on URL change (debounced, 500ms)
  - [ ] 2.3 Show loading spinner while fetching models
  - [ ] 2.4 Persist selected model in aiConfiguration localStorage
- [ ] Task 3: Error handling (AC: 4)
  - [ ] 3.1 Handle network errors with user-friendly messages
  - [ ] 3.2 Handle empty model list: "No models found. Pull a model with `ollama pull llama3.2`"
  - [ ] 3.3 Handle timeout (5s) for slow/unreachable servers

## Design Guidance

- Use shadcn/ui Select or Combobox component for model dropdown
- Model dropdown should appear below the URL input, only when Ollama is selected provider
- Loading state: skeleton/spinner inside the dropdown area
- Error state: red text below dropdown with troubleshooting hint

## Implementation Notes

- Ollama `/api/tags` response format: `{ models: [{ name: "llama3.2:3b", size: 2000000000, modified_at: "...", details: { family, parameter_size, quantization_level } }] }`
- Size is in bytes — convert to human-readable (GB/MB)
- Model names include tag (e.g., "llama3.2:3b") — show as-is
- Debounce URL input to avoid spamming requests while typing

## Testing Notes

- Unit test: `listModels()` parses Ollama API response correctly
- Unit test: Size formatting (bytes to GB/MB)
- E2E: Model dropdown populates after entering valid URL
- E2E: Error message shown for unreachable URL
- Edge case: Empty model list, very long model names, many models (50+)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] Read [engineering-patterns.md](../engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
