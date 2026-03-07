# Test Coverage Review: E06-S01 — Create Learning Challenges (Round 3)

**Date**: 2026-03-07
**Reviewer**: Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Form displays name, type, target, deadline | None | story-e06-s01.spec.ts:51 | Covered |
| 2 | Type selection updates target metric label | None | story-e06-s01.spec.ts:63,69,75 | Covered |
| 3 | Valid submission saves to IndexedDB + toast | useChallengeStore.test.ts:56,79 | story-e06-s01.spec.ts:82 | Covered |
| 4 | Invalid inputs show inline errors | None | story-e06-s01.spec.ts:138,159,180,200 | Covered |
| 5 | Labels, aria-live, keyboard navigable | None | story-e06-s01.spec.ts:219,252 | Partial |

**Coverage**: 4/5 ACs fully covered | 1 partial | 0 gaps

## High Priority

- E2E afterEach IDB cleanup is async-unsafe (confidence: 88)
- Keyboard nav test doesn't verify actual focus landing (confidence: 85)
- Negative target test may not exercise validation (confidence: 82)
- deleteChallenge rollback position not tested (confidence: 80)

## Medium Priority

- AC2 tests don't verify dynamic label change between types (confidence: 78)
- Toast assertion uses internal Sonner selector (confidence: 76)
- aria-live test submits entirely empty form (confidence: 74)
- Factory default name is static (confidence: 72)
- No schema update test for challenges table (confidence: 70)

## Nits

- Future deadline UTC date split (timezone latent bug)
- afterEach vi.useRealTimers() dead code
- goToChallenges waits for generic h1

## Edge Cases Without Coverage

1. Name 60/61 char boundary
2. Today's date as deadline (boundary reject)
3. Non-numeric target input
4. Fractional target for completion/streak
5. Dialog form reset on cancel
6. Duplicate challenge names
7. Empty state rendering

ACs: 4/5 fully covered, 1 partial | Findings: 10 | High: 4 | Medium: 4 | Nits: 3
