---
story_id: E73-S02
story_name: 'ELI5 Mode — Simple Explanations with Analogies'
status: in-progress
started: 2026-04-13
completed:
reviewed: in-progress
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests]
burn_in_validated: false
---

# Story 73.02: ELI5 Mode — Simple Explanations with Analogies

## Story

As a learner who finds technical content hard to grasp,
I want an ELI5 (Explain Like I'm Five) tutoring mode,
so that I can get plain-language explanations with analogies whenever a concept feels over my head.

## Acceptance Criteria

- AC1: ELI5 mode is registered in the mode registry and switchable from the tutor panel.
- AC2: ELI5 prompt template enforces simple language, analogies, and comprehension check-ins.
- AC3: The empty state for ELI5 mode displays appropriate placeholder text.
- AC4: Token budget for ELI5 system prompt stays within the 100-150 token slot-2 allocation.
- AC5: Unit tests cover the prompt builder output contract.

## Tasks / Subtasks

- [x] Task 1: Implement ELI5 prompt builder (`src/ai/prompts/modes/eli5.ts`) (AC: 2, 4)
- [x] Task 2: Register ELI5 in `modeRegistry.ts` (AC: 1)
- [x] Task 3: Update `TutorEmptyState.tsx` for ELI5 mode (AC: 3)
- [x] Task 4: Write unit tests for eli5 prompt builder (AC: 5)

## Implementation Notes

- `buildELI5Prompt` is a pure function — no side effects, no context dependencies.
- Does not use hintLevel, learnerModel, or transcript context (`updatesLearnerModel=false`, `requiresTranscript=false`, `hintLadderEnabled=false`).
- Token approximation ratio documented in tests (see `eli5.test.ts`).
- Depends on E73-S01 MODE_REGISTRY (S01 already done).

## Testing Notes

- Unit tests in `src/ai/prompts/__tests__/eli5.test.ts`.
- Tests cover: prompt structure, required instructions, token budget, behavioral contract.

## Pre-Review Checklist

- [x] All changes committed (`git status` clean)
- [x] No error swallowing
- [x] Pure function — no cleanup concerns
- [x] AC → UI trace: ELI5 mode visible via TutorEmptyState and modeRegistry

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- Token budget for ELI5 system prompts needs to be explicitly documented in tests — ratio approximation matters for slot allocation.
