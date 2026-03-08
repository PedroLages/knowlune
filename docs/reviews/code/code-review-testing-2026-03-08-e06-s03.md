## Test Coverage Review: E06-S03 — Challenge Milestone Celebrations

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 25% milestone toast with "25% Complete" badge + challenge name, recorded in IndexedDB | None for `detectChallengeMilestones` | `tests/e2e/story-e06-s03.spec.ts:80` (display), `:106` (not re-triggered) | Partial |
| 2 | 50% milestone toast with "Halfway There" badge + supportive message | None | `tests/e2e/story-e06-s03.spec.ts:134` | Partial |
| 3 | 75% milestone toast with "Almost There" badge + encouraging message | None | `tests/e2e/story-e06-s03.spec.ts:161` | Partial |
| 4 | 100% toast "Challenge Complete" + completed visual + moved to Completed section | `useChallengeStore.test.ts:270` (completedAt set) | `tests/e2e/story-e06-s03.spec.ts:189` | Partial |
| 5 | prefers-reduced-motion suppresses animations; toast + badge remain visible | None | `tests/e2e/story-e06-s03.spec.ts:228` | Partial |
| 6 | Simultaneous milestones trigger sequential toasts with stagger; each recorded in IndexedDB | None | `tests/e2e/story-e06-s03.spec.ts:260` | Partial |

**Coverage**: 0/6 ACs fully covered | 6 partial

### Findings

#### High Priority

1. **AC1 IndexedDB assertion is indirect** (confidence: 88) — Test seeds pre-celebrated milestone and checks toast absence, but never reads IndexedDB after first trigger to confirm persistence.

2. **`waitForTimeout(3000)` for absence assertion** (confidence: 85) — Arbitrary sleep for negative assertion; should use deterministic locator count check.

3. **AC4 completed-state visual assertions too shallow** (confidence: 83) — Only checks `getByText(/completed/i)` which is ambiguous. Doesn't verify gold styling or card placement in Completed section.

4. **`detectChallengeMilestones` has zero unit tests** (confidence: 92) — Core business logic with no unit test file. All validation via E2E only.

5. **AC6 per-milestone IndexedDB persistence not verified** (confidence: 80) — Test confirms toasts appear but doesn't verify each milestone individually recorded.

6. **`refreshAllProgress` return value never tested** (confidence: 78) — The milestoneMap return used by Challenges.tsx is never asserted in store unit tests.

#### Medium

1. **Local `seedStore` duplicates shared fixture** (confidence: 72)
2. **AC2/AC3 don't assert supportive/encouraging message text** (confidence: 75)
3. **AC5 reduced-motion: no ARIA assertion** (confidence: 70)
4. **afterEach cleanup incomplete** (confidence: 70)

#### Nits

1. Comment formatting issue (single slash)
2. Inline factory duplicates shared factory
3. `data-testid` attributes present but unused by tests
4. Missing comment opening `/`

### Edge Cases to Consider

1. `targetValue: 1` — all 4 thresholds at once
2. Progress overshoot beyond target
3. Streak/time challenge types (only completion tested)
4. Multiple challenges with overlapping milestones
5. `getChallengeTierConfig` fallback path untested

---
ACs: 0/6 fully covered (all partial) | Findings: 14 | High: 6 | Medium: 4 | Nits: 4
