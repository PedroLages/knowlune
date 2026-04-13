---
story_id: E71-S03
story_name: "Knowledge Map Integration and Tests"
status: in-progress
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, unit-tests, e2e-tests, code-review, code-review-testing, design-review, security-review, performance-benchmark, exploratory-qa, glm-adversarial]
burn_in_validated: false
---

# Story 71.03: Knowledge Map Integration and Tests

## Story

As a learner,
I want to see contextual action suggestions directly in the Knowledge Map page,
so that I can immediately act on topics that need attention without navigating elsewhere.

## Acceptance Criteria

1. `useKnowledgeMapStore` exposes `suggestions` state (pre-computed `TopicWithScore[]`)
2. `getSuggestedActions()` getter returns `get().suggestions` for backward compatibility
3. `suggestions` recomputed reactively when `scoredTopics` changes
4. `SuggestedActionsPanel` renders in Knowledge Map page layout
5. Desktop layout: panel in sticky right sidebar (w-80)
6. Mobile layout: panel inline above topic list
7. Panel hidden when `suggestions` is empty
8. Empty state shows fallback message when topics exist but no suggestions
9. CTA buttons navigate to correct action URLs
10. Integration unit tests: mixed FSRS/recency scenarios, mixed activity types
11. E2E tests: panel visibility, CTA navigation, empty state, responsive behavior
12. No infinite re-render from store selector

## Implementation Notes

- Files changed: `src/app/pages/KnowledgeMap.tsx`, `src/stores/useKnowledgeMapStore.ts`, `src/lib/__tests__/actionSuggestions.test.ts`, `tests/e2e/story-e71-s03.spec.ts`
- +376 lines (380 insertions, 3 deletions + 1 deletion fix)
- Review: 2 rounds — R1 found 1 BLOCKER + 1 HIGH + 2 MEDIUM, R2 PASS

## Review Findings

| Severity | Finding | Status |
|----------|---------|--------|
| BLOCKER | Infinite re-render from selector calling getSuggestedActions() | FIXED — pre-computed reactive store state |
| HIGH | All 4 E2E tests failing | FIXED — 4/4 passing |
| MEDIUM | Duplicate FocusAreasPanel rendered twice | FIXED — single instance with JS conditionals |
| MEDIUM | Missing TODO on lesson time approximation | FIXED — TODO(E56-S04) added |
| LOW | fsrsStability map not passed to generateActionSuggestions | Deferred — future story enhancement |
| NIT | getSuggestedActions() backward compat method unused | Removed |
