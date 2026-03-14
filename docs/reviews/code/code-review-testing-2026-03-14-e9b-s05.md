# Test Coverage Review: E9B-S05 — AI Note Organization and Cross-Course Links

**Date**: 2026-03-14
**Reviewer**: Claude Code (code-review-testing agent)

## AC Coverage: 6/7 ACs tested (86%)

| AC | Description | Verdict |
|----|-------------|---------|
| 1 | Organize button triggers AI analysis | Covered |
| 2 | Preview panel with accept/reject | Covered |
| 3 | Apply selected changes, rejected discarded | Partial |
| 4 | Related Concepts panel | Partial |
| 5 | Navigation + back-link | Gap |
| 6 | AI unavailable fallback | Partial |
| 7 | Privacy | Covered |

## Blocker

- **AC5 back-link not implemented** (confidence: 95): `RelatedConceptsPanel.tsx:59` passes `state: { fromNote: note.id }` but `Notes.tsx` never reads `location.state` to render a back-link. E2E test guards assertion with `if (await relatedLink.isVisible())` making it a no-op.

## High Priority

- **AC6 "AI unavailable message with retry"** (confidence: 85): AC requires displayable message + retry. Implementation only disables button with tooltip. Test only checks `toBeDisabled()`.
- **AC3 rejected changes not verified in IDB** (confidence: 80): Test only checks toast count, not that rejected note's tags were actually not persisted.
- **AC4 cross-course test doesn't test cross-course** (confidence: 78): Test notes don't share tags across courses. Only exercises same-course matching.

## Medium

- Test data uses raw objects instead of `createDexieNote` factory (confidence: 72).
- `parseResponse()` has zero test coverage — mock bypasses it entirely (confidence: 70).
- AC6 timeout test doesn't distinguish fallback from already-fast tag path (confidence: 68).

## Nits

- Structural selector `.locator('..')` fragile — use `data-testid="note-card"` filter.
- Toast assertion uses `.or()` combinator making actual text unconstrained.
- `seedAIWithOrganizationConsent` parameter name misleading (`videoSummaryConsent`).
