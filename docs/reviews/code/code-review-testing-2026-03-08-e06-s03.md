# Test Coverage Review Report — E06-S03: Challenge Milestone Celebrations

**Review Date**: 2026-03-08 (Round 2)
**Reviewed By**: Claude Code (code-review-testing agent)

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 25% milestone toast + recorded in IndexedDB | `challengeMilestones.test.ts:34`, `useChallengeStore.test.ts:387` | `story-e06-s03.spec.ts:80, :106` | Partial |
| 2 | 50% "Halfway There" toast | `challengeMilestones.test.ts:79` | `story-e06-s03.spec.ts:136` | Covered |
| 3 | 75% "Almost There" toast | `challengeMilestones.test.ts:81` | `story-e06-s03.spec.ts:166` | Covered |
| 4 | 100% toast + completed visual treatment + completed section | `useChallengeStore.test.ts:270, :387` | `story-e06-s03.spec.ts:197` | Partial |
| 5 | prefers-reduced-motion support | None | `story-e06-s03.spec.ts:244` | Partial |
| 6 | Sequential stagger for simultaneous milestones | `challengeMilestones.test.ts:44`, `useChallengeStore.test.ts:364` | `story-e06-s03.spec.ts:280` | Covered |

**Coverage**: 3/6 fully covered | 3/6 partial | 0 gaps

## Findings

### High Priority

- **H1 — AC1 IndexedDB write not verified end-to-end (confidence: 92)**
  - `story-e06-s03.spec.ts:106` seeds pre-baked `celebratedMilestones: [25]` instead of verifying the write path
  - Fix: After initial toast fires, read IndexedDB to confirm `celebratedMilestones` includes 25

- **H2 — AC4 completed card visual treatment not asserted (confidence: 88)**
  - `story-e06-s03.spec.ts:197-238` verifies toast and section but not amber border, checkmark, or badge
  - Fix: Assert "Completed" badge text visible inside expanded card

- **H3 — Negative assertion uses arbitrary `waitForTimeout(1500)` (confidence: 85)**
  - `story-e06-s03.spec.ts:127`
  - Fix: Use `toHaveCount(0)` with shorter timeout after page settles

- **H4 — AC5 reduced-motion only tests confetti, not badge/card animations (confidence: 82)**
  - `story-e06-s03.spec.ts:244-274`
  - Fix: Also test 100% milestone in reduced-motion mode

### Medium

- **M1 — `seedStore` helper duplicates `indexeddb-fixture.ts` logic (confidence: 78)**
  - Fix: Extract generic `seedStore` into shared fixture

- **M2 — `toast.error` not asserted in DB failure test (confidence: 75)**
  - `useChallengeStore.test.ts:338-362`
  - Fix: Mock `sonner` and assert `toast.error` called

- **M3 — Unit tests only use `type: 'completion'` (confidence: 72)**
  - Fix: Add one test each for `streak` and `time` types

- **M4 — Required test sequencing undocumented (confidence: 70)**
  - Fix: Document navigate → seed → reload pattern

### Nits

- `seedStore` teardown could use shared `indexedDB.clearStore`
- `getChallengeTierConfig` fallback test should use try/finally for `mockRestore`
- Collapsible trigger regex `/Completed \(\d+\)/` could be tighter
- `fake-indexeddb/auto` import undocumented

---

ACs: 3/6 covered | 3/6 partial | Findings: 12 | Blockers: 0 | High: 4 | Medium: 4 | Nits: 4
