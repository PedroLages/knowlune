# Test Coverage Review: E05-S06 — Streak Milestone Celebrations

**Date**: 2026-03-07
**Reviewer**: Test Coverage Agent
**Focus**: AC-to-test mapping, test quality, isolation, edge case coverage

## AC Coverage Table

| AC# | Description | Unit | E2E | Verdict |
|-----|-------------|------|-----|---------|
| 1 | 7-day milestone toast + confetti | None | `:46`, `:204` | Covered |
| 2 | 30-day milestone toast + celebration | None | `:63` | Covered |
| 3 | 60-day milestone toast + celebration | None | `:77` | Covered |
| 4 | 100-day milestone toast + celebration | None | `:91` | Covered |
| 5 | prefers-reduced-motion suppresses animation | None | `:105` | Partial |
| 6 | Gallery: earned badges + locked placeholders | None | `:127`, `:183` | Partial |
| 7 | Repeat milestones after reset | None | `:157` | Partial |

**Coverage**: 4/7 ACs fully covered | 0 gaps | 3 partial

## Findings

### High Priority

1. **AC7 test doesn't verify new date recorded** (confidence: 92) — `:157-178`: Only checks toast re-appears, never opens gallery to verify second `earnedAt` date persisted. Fix: Query `localStorage.get('streak-milestones')` and assert two entries for `milestoneValue: 7`.

2. **AC6 date assertion too broad** (confidence: 88) — `:183-200`: Regex `/\d/` matches the milestone label number, not the date. Fix: Assert date format `/[A-Z][a-z]+ \d{1,2}, \d{4}/`.

3. **AC5 missing badge assertion** (confidence: 85) — `:105-123`: Checks toast visible but not `milestone-badge-7`. Fix: Add `getByTestId('milestone-badge-7').toBeVisible()`.

4. **Confetti canvas assertion fragile** (confidence: 82) — `:204-216`: Canvas may be removed before assertion. Fix: Mock `canvas-confetti` or use polling.

5. **ACs 2-4 missing confetti assertions** (confidence: 80) — Only AC1 checks for confetti canvas. Fix: Add confetti assertion to all milestone tier tests.

### Medium

6. **`streak-milestones` not in STORAGE_KEYS** (confidence: 78) — `local-storage-fixture.ts:16-28`: Cleanup doesn't clear streak data between tests. Fix: Add `'streak-milestones'` to STORAGE_KEYS.

7. **Double navigation in beforeEach** (confidence: 75) — `:37-44`: Seeds sidebar state after navigation, then tests reload. Fix: Use `page.addInitScript`.

8. **AC7 seed missing factory** (confidence: 72) — `:165-170`: Inline object omits `streakStartDate`. Fix: Create `createStreakMilestone()` factory.

9. **AC6 doesn't test multiple earned badges** (confidence: 70) — Only tests single earned + three locked. Fix: Add test for 30-day streak showing two earned badges.

### Nits

10. **Toast locator uses text filter instead of testid** (confidence: 60).
11. **`buildStreakLog` helper should live in support/helpers** (confidence: 55).
12. **`waitUntil: 'domcontentloaded'` misleading** (confidence: 50).

### Suggested Edge Case Tests

- 6-day streak produces no toast (boundary test)
- Same-streak milestone already celebrated doesn't re-fire
- Multiple simultaneous milestone toasts (e.g., 30-day triggers both 7 and 30)
- Corrupted `streak-milestones` localStorage falls back gracefully
- Zero-streak gallery shows all locked

## Verdict

4/7 ACs fully covered, 3 partial. 0 blockers, 5 high-priority fixes recommended.
