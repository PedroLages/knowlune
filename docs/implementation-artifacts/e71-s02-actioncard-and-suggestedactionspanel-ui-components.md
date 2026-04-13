---
story_id: E71-S02
story_name: "ActionCard and SuggestedActionsPanel UI Components"
status: in-progress
started: 2026-04-13
completed:
reviewed: true
review_started: 2026-04-13
review_gates_passed: [build, lint, type-check, unit-tests, code-review, code-review-testing, design-review, security-review, performance-benchmark, exploratory-qa, glm-adversarial]
burn_in_validated: false
---

# Story 71.02: ActionCard and SuggestedActionsPanel UI Components

## Story

As a learner,
I want to see visually clear action cards in the Knowledge Map panel,
so that I can quickly understand what to do next for each declining topic.

## Acceptance Criteria

1. `ActionCard` renders topic name, urgency badge (warning/success color per urgency threshold), time estimate, and CTA button
2. CTA button uses `variant="brand"` and links to the action URL
3. `SuggestedActionsPanel` renders a list of `ActionCard`s with a heading and empty state
4. Panel layout: sidebar (desktop), 2-column grid (tablet), horizontal scroll (mobile)
5. Mobile carousel uses `snap-x snap-mandatory` for swipe UX
6. All color tokens from `theme.css` — no hardcoded Tailwind colors
7. `role="list"` / `role="listitem"` ARIA structure correct
8. `aria-label` on CTA uses `actionLabel` (not `ctaLabel`) per spec
9. Touch targets ≥ 44px on mobile
10. `useId()` used for `aria-labelledby` to support multiple panel instances
11. Empty state renders fallback message when no actions provided
12. Component accepts `className` prop for layout composition
13. Design tokens only — no hardcoded colors

## Implementation Notes

- Components: `src/app/components/knowledge/ActionCard.tsx`, `SuggestedActionsPanel.tsx`
- +229 lines total (both components new)
- Review verdict: PASS — 3 MEDIUM accessibility findings (to fix in S03 or before integration)
- MEDIUM findings: ARIA listitem nesting, aria-label uses ctaLabel, CTA touch target < 44px

## Review Findings

| Severity | Finding | Status |
|----------|---------|--------|
| MEDIUM | ARIA listitem not direct child of list container | Open — fix before integration |
| MEDIUM | aria-label uses ctaLabel instead of actionLabel | Open — fix before integration |
| MEDIUM | CTA button touch target below 44px on mobile | Open — fix before integration |
| LOW | Hardcoded id not unique — use useId() | Open |
| LOW | Time estimate badge always says "min review" | Open (matches AC literal) |
| NIT | transition-all could be narrowed | Open |
