---
story_id: E71-S01
story_name: "Action Suggestion Data Layer"
status: in-progress
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 71.01: Action Suggestion Data Layer

## Story

As a learner,
I want the app to identify which topics need my attention,
so that I can prioritize review sessions effectively.

## Acceptance Criteria

1. `getSuggestedActions(topics, options?)` returns actions sorted by urgency score descending
2. Urgency formula: `(100 - score) * 0.6 + decayFactor * 0.4`
3. FSRS optional param supported; recency decay used as fallback
4. Module has no React, Zustand, or Dexie imports (pure function)
5. All inputs are clamped/validated (no NaN, no negative scores)
6. URL-safe lesson route params are encoded
7. Deterministic sort tiebreaker when urgency scores are equal
8. Unit tests cover all 10 acceptance criteria
9. Function exported from `src/lib/actionSuggestions.ts`
10. Module follows established `qualityScore.ts` pattern

## Tasks / Subtasks

- [x] Task 1: Implement `actionSuggestions.ts` pure function module (AC: 1-5, 9, 10)
- [x] Task 2: Add URL encoding for lesson route params (AC: 6)
- [x] Task 3: Add deterministic sort tiebreaker (AC: 7)
- [x] Task 4: Write unit tests with full AC coverage (AC: 8)

## Implementation Notes

- Pure function module at `src/lib/actionSuggestions.ts` — no framework dependencies
- Urgency formula: `(100 - score) * 0.6 + decayFactor * 0.4`
- Input clamping guards against NaN and out-of-range values
- Tiebreaker uses topic ID string comparison for deterministic ordering
- Lesson route params URL-encoded via `encodeURIComponent`
- Follows the `qualityScore.ts` module pattern

## Testing Notes

- 22 unit tests in `src/lib/__tests__/actionSuggestions.test.ts`
- Covers: formula correctness, edge cases, input clamping, sort stability, URL encoding
- No E2E tests (data layer only — no UI)

## Challenges and Lessons Learned

- Input clamping (0–100 range) needed to prevent urgency formula producing negative or >100 values
- URL encoding lesson params critical when topic names contain spaces or special characters
- Deterministic tiebreaker prevents test flakiness when multiple topics share identical urgency scores
