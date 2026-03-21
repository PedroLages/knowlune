# Plan: E07-S06 — E2E Test for Course Suggestion Tiebreaker

## Context

The traceability analysis (2026-03-08) identified that E07-S03-AC2's tiebreaker behavior has unit test coverage but no E2E test. The existing "AC3: tiebreaker" test in `story-e07-s03.spec.ts:344` **has a comment bug** — it claims 3 courses share 1 tag, but they actually have different overlap counts (3, 2, 1), so the primary sort resolves ordering before any tiebreaker fires. This story adds a test where candidates have **identical** tag overlap, forcing momentum to be the deciding factor.

## Approach

Add a single new test to the existing `tests/e2e/regression/story-e07-s03.spec.ts` file. The test validates that when two courses share the same number of tags with the completed course, the one with higher momentum (recency + progress) is suggested.

### Test Design

**Candidate pair:** `confidence-reboot` and `behavior-skills` — both share exactly **2 tags** with `authority`:
- confidence-reboot: confidence, composure
- behavior-skills: influence, authority

**Setup:**
1. Mock `Date.now()` for deterministic recency
2. Seed authority with 6/7 lessons complete (N-1 pattern from existing tests)
3. Mark ALL other courses (nci-access, 6mx, operative-six, ops-manual, study-materials) as 100% complete → excluded from candidates
4. Seed confidence-reboot with **high momentum** (recent + more progress)
5. Seed behavior-skills with **low momentum** (old + less progress)

**Assertion:** After completing authority's last lesson, the suggestion card should show `confidence-reboot` (higher momentum wins the tiebreaker).

### Math Proof

Both candidates: tagScore = 2/7 ≈ 0.286

**confidence-reboot** (winner):
- progress: ~50% (9/18 lessons)
- recency: 1 day ago → recencyScore ≈ 0.929
- momentumProxy = (0.929 × 0.5) + (0.5 × 0.5) = 0.714
- finalScore = (0.286 × 0.6) + (0.714 × 0.4) = 0.171 + 0.286 = **0.457**

**behavior-skills** (loser):
- progress: ~20% (need to check total lessons)
- recency: 10 days ago → recencyScore = 1 - 10/14 ≈ 0.286
- momentumProxy = (0.286 × 0.5) + (0.2 × 0.5) = 0.243
- finalScore = (0.286 × 0.6) + (0.243 × 0.4) = 0.171 + 0.097 = **0.268**

Margin: 0.457 vs 0.268 — clear separation, robust test.

### Note on AC Adaptation

The gap coverage doc says "3 incomplete courses" but the real course data only has **pairs** with identical tag overlap (no natural group of 3). Using 2 candidates is sufficient to validate tiebreaker behavior. The 3rd wouldn't add test value — the key assertion is "identical overlap → momentum decides."

## Tasks

1. **Add tiebreaker E2E test** to `tests/e2e/regression/story-e07-s03.spec.ts`
   - New test: `'AC2: tiebreaker selects highest momentum when tag overlap counts match'`
   - Mock Date.now, seed data, complete authority, verify suggestion title
   - Follow existing test patterns (closeSidebar, seedAuthorityAlmostComplete, TIMEOUTS)
   - Need to check behavior-skills total lesson count before computing progress seed

2. **Verify test passes** by running it with RUN_REGRESSION=1

## Critical Files

| File | Action |
|------|--------|
| `tests/e2e/regression/story-e07-s03.spec.ts` | Add new test |
| `src/lib/suggestions.ts` | Read-only — algorithm reference |
| `src/data/courses/authority.ts` | Read-only — 7 tags, 7 lessons |
| `src/data/courses/confidence-reboot.ts` | Read-only — tags + lesson count |
| `src/data/courses/behavior-skills.ts` | Read-only — tags + lesson count |
| `tests/support/fixtures/` | Reuse existing localStorage fixture |
| `tests/utils/test-time.ts` | Reuse FIXED_DATE, getRelativeDate |

## Verification

```bash
# Kill any stale dev server from main workspace (worktree E2E warning)
lsof -ti:5173 | xargs kill 2>/dev/null

# Run only the tiebreaker test
cd .worktrees/feature/e07-s06-e2e-test-course-suggestion-tiebreaker
RUN_REGRESSION=1 npx playwright test story-e07-s03 --grep "tiebreaker selects highest momentum" --project="Desktop Chrome"

# Run full E07-S03 regression suite
RUN_REGRESSION=1 npx playwright test story-e07-s03 --project="Desktop Chrome"
```
