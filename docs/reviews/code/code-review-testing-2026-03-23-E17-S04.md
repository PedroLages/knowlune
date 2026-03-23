# Test Coverage Review: E17-S04 — Calculate Discrimination Indices
**Date:** 2026-03-23
**Branch:** feature/e17-s04-calculate-discrimination-indices
**Reviewer:** code-review-testing agent

---

## AC Coverage Summary

**Story file uses 0.2/0.3 thresholds.** Implementation matches. The prompt's 0.1/0.3 thresholds differ from the story file — story file is authoritative.

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 5+ attempts → discrimination analysis section visible | `analytics.test.ts:609,624` | `story-e17-s04.spec.ts:150` | ✅ Covered |
| 2 | <5 attempts → "Need at least 5 attempts" message | `analytics.test.ts:594,603` | `story-e17-s04.spec.ts:165` | ✅ Covered |
| 3 | rpb > 0.3 → "High discriminator" label | `analytics.test.ts:747` | `story-e17-s04.spec.ts:157` | ✅ Covered |
| 4 | 0.2 ≤ rpb ≤ 0.3 → "Moderate discriminator" label | **None** | **None** | ❌ Gap |
| 5 | rpb < 0.2 → "Low discriminator" label | `analytics.test.ts:787` | None | ⚠️ Partial |

**Coverage: 4/5 ACs fully covered | 1 gap (AC4) | 1 partial (AC5)**

---

## Findings

### Blockers

**[BLOCKER] AC4: "Moderate discriminator" (0.2 ≤ rpb ≤ 0.3) has zero tests (confidence: 95)**
No unit test, no E2E test. The `'Moderate discriminator'` string appears nowhere in any test file. The interpretation branch at `analytics.ts:379` is completely untested.
**Fix:** Add unit test in `calculateDiscriminationIndices` describe block with attempts yielding rpb ≈ 0.25, assert `result[0].interpretation` contains `'Moderate discriminator'`. Add E2E test for the same scenario.

### High Priority

**[HIGH] AC5 E2E missing (confidence: 85)**
The file header comment at `story-e17-s04.spec.ts:1-8` lists "AC5: Low discrimination question shows 'Low discriminator' text" as covered, but no test body exists for it. Only AC1 (line 150), AC3 (line 157), and AC2 (line 165) have E2E tests.
**Fix:** Add `test('AC5: Low discriminator question shows correct interpretation', ...)`.

**[HIGH] No `DiscriminationAnalysis` component unit test (confidence: 80)**
`src/app/components/quiz/__tests__/` has `ItemDifficultyAnalysis.test.tsx` but no `DiscriminationAnalysis.test.tsx`. Two rendering paths (empty state and populated list with `data-testid` attributes, `.toFixed(2)` formatting, interpretation text) are only partially exercised by E2E.
**Fix:** Create `src/app/components/quiz/__tests__/DiscriminationAnalysis.test.tsx` covering: empty state, populated card, formatted rpb values, interpretation text rendering.

**[HIGH] Boundary values at rpb = 0.3 and rpb = 0.2 untested (confidence: 75)**
Implementation uses `rpb > 0.3` (strict) and `rpb >= 0.2` (inclusive). No test pins behavior at exactly 0.3 (should be "Moderate", not "High") or exactly 0.2 (should be "Moderate", not "Low"). Float precision issues near boundaries are also unverified.

### Medium

**[MEDIUM] Low discriminator test data has thin margin (confidence: 65)**
`analytics.test.ts:787` produces rpb ≈ 0.193 vs threshold 0.2 — razor-thin. A clearly low (near-zero or negative) rpb would be more robust.

**[MEDIUM] `afterEach` doesn't clear localStorage (confidence: 60)**
`story-e17-s04.spec.ts:146-148` clears `quizzes` and `quizAttempts` but tests write to `localStorage` (`levelup-quiz-store`). Not a current flakiness risk, but a hygiene gap.

**[MEDIUM] `makeTestQuiz` bypasses shared factory (confidence: 55)**
Duplicates the `Quiz` shape inline rather than using `makeQuiz` from `quiz-factory.ts` (already imported at the top of the file).

### Nits

**[NIT]** `analytics.test.ts:625` and `:844` — near-duplicate tests using identical data asserting rpb ≈ 0.894.
**[NIT]** `story-e17-s04.spec.ts:166` — uses 2 attempts for the <5 test; 4 attempts would pin the boundary more precisely.
**[NIT]** `story-e17-s04.spec.ts:172` — `not.toBeVisible()` on an element that's never in the DOM; prefer `not.toBeAttached()`.

---

**Issues: 9 | Blockers: 1 | High: 3 | Medium: 3 | Nits: 3**
