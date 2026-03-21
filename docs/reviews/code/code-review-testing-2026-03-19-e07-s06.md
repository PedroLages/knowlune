## Test Coverage Review: E07-S06 — E2E Test for Course Suggestion Tiebreaker

### AC Coverage Summary

**Acceptance Criteria Coverage:** 1/1 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Given 2 completed courses seeded, 2 incomplete candidates with identical 2-tag overlap seeded, when last lesson of Course A is completed, then suggestion selects course with highest momentum score (tiebreaker) | `src/lib/__tests__/` (pre-existing) | `tests/e2e/regression/story-e07-s03.spec.ts:445` | Covered — with caveats (see findings) |

**Coverage**: 1/1 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

_None._

---

#### High Priority

- **`tests/e2e/regression/story-e07-s03.spec.ts:527` (confidence: 85)**: The new tiebreaker test seeds the "loser" candidate's progress under key `'behavior-skills'` (lines 526–535), but the actual course ID is `'behavior-skills-breakthrough'` (see `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/.worktrees/feature/e07-s06-e2e-test-course-suggestion-tiebreaker/src/data/courses/behavior-skills.ts:6`). The algorithm at `src/lib/suggestions.ts:40` resolves progress with `allProgress[course.id]`, so it looks up `allProgress['behavior-skills-breakthrough']` and finds `undefined`. The behavior-skills candidate is therefore scored with zero progress and zero recency — not the "low momentum" scenario described in the comments.

  The test still passes (confidence-reboot at 0.457 beats a zero-momentum behavior-skills at 0.171), but it does not validate the tiebreaker scenario it claims to test. The test documents: "progress = 3/13 ≈ 23%, recency = 10 days ago → low momentum" — none of that seeded data is actually read by the algorithm. What is exercised is "high momentum vs zero momentum," not "high momentum vs low momentum."

  **Fix**: Change line 527's progress key to `'behavior-skills-breakthrough'` and the `courseId` field value at line 528 to `'behavior-skills-breakthrough'` to match the actual course ID. The same applies to the `ALL_COURSE_IDS` constant at line 35 (pre-existing bug, not introduced here, but worth noting).

- **`tests/e2e/regression/story-e07-s03.spec.ts:445` (confidence: 72)**: The new test is labeled `'AC2: tiebreaker selects highest momentum when tag overlap counts match'` but there is already a test named `'AC2: 60/40 weighting ranks course with higher tag overlap despite lower momentum'` at line 244. Both tests claim AC2 ownership. The story's own Gherkin AC describes tiebreaker behavior, not 60/40 weighting. The naming collision makes traceability ambiguous and will confuse future readers about which test covers which AC.

  **Fix**: Rename the new test to `'AC1: tiebreaker selects highest momentum when tag overlap counts match'` to match E07-S06's single AC, or clarify as `'E07-S06-AC1: tiebreaker selects highest momentum when tag overlap counts match'` to distinguish it from E07-S03 ACs.

---

#### Medium

- **`tests/e2e/regression/story-e07-s03.spec.ts:466` (confidence: 60)**: The test comment states `progress = 10/20 = 50%` for confidence-reboot. The course's `totalLessons` field is `18` (see `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/.worktrees/feature/e07-s06-e2e-test-course-suggestion-tiebreaker/src/data/courses/confidence-reboot.ts:13`), but the algorithm counts actual module lesson objects which total 20 (including `cr-course-resources`). The comment's "20 total lessons" is consistent with how the algorithm computes the denominator, so the math is actually correct — but the `totalLessons: 18` data field is misleading and could cause confusion when this test is revisited.

  **Fix**: No change needed to the test. A comment annotation clarifying "algorithm counts 20 module lessons (not the totalLessons:18 field)" would help future maintainers.

- **`tests/e2e/regression/story-e07-s03.spec.ts:345` (confidence: 55)**: The pre-existing `'AC3: tiebreaker applies momentum when courses have identical tag overlap'` test (added before this story) has a documented comment bug: it seeds three courses with 1, 2, and 1 shared tags with authority (not identical overlap), so the primary sort by finalScore resolves ordering before the tiebreaker fires. The assertion at line 440 accepts any of the three courses as valid: `toHaveURL(/\/courses\/(confidence-reboot|6mx|operative-six)/)`. This makes it a non-discriminating test — it would pass even if the algorithm were broken. The new test (this story) corrects the substance of what AC3 should have tested, but the old AC3 test remains in the suite with misleading intent.

  This is pre-existing and out of scope for this story, but worth tracking. **Suggested follow-up**: Remove or tighten the pre-existing AC3 tiebreaker test now that the new test correctly validates identical-overlap tiebreaker behavior.

---

#### Nits

- **Nit** `tests/e2e/regression/story-e07-s03.spec.ts:461` (confidence: 50): Comment at line 461 says `behavior-skills: 'influence', 'authority'` — this is factually correct (both tags are present in `behavior-skills-breakthrough`), but readers will cross-reference the source data by the course ID shown in the progress seeding (`behavior-skills`), not by the course title. The comment could note the actual course ID: `behavior-skills-breakthrough` has these tags.

- **Nit** `tests/e2e/regression/story-e07-s03.spec.ts:513` (confidence: 45): The comment says "20 total lessons, seed 10 as complete" (line 513). Given the `totalLessons:18` field in the course data file, this will seem wrong to any reviewer who reads the course data without knowing the algorithm uses module-counted lessons. A short parenthetical `(module-derived count used by algorithm)` would remove ambiguity.

---

### Edge Cases to Consider

- **behavior-skills-breakthrough never studied (zero momentum)**: Because of the course ID mismatch, the current test inadvertently exercises the edge case of a candidate with no prior progress record. This is actually a valid edge case for the suggestion algorithm. Once the ID mismatch is fixed and behavior-skills gets real progress seeded, consider whether a separate test for the "never-started candidate" edge case is worthwhile.

- **Tiebreaker with exactly equal final scores**: The algorithm sorts by `score desc`, then `tagOverlapCount desc`, then `momentumProxy desc`. The new test covers the case where scores differ because momentum differs. There is no test for the case where finalScores are numerically equal (floating-point). This is an edge case the unit tests may already cover — no action needed here unless it's not covered at the unit level.

- **`closeCompletionModal` helper scoping fix**: The diff correctly scopes the modal close button to the dialog element (line 66–67). This is a good fix documented in Lessons Learned. No further action needed.

---

### Summary

The story delivers its stated goal: an E2E test that validates the momentum tiebreaker for identical-tag-overlap candidates. The core behavior (suggestion shows confidence-reboot over behavior-skills) is exercised and the assertion is discriminating. The critical issue is that the "loser" candidate's momentum data is silently discarded due to a course ID mismatch, meaning the test validates "high momentum vs no-progress course" rather than the documented "high momentum vs low momentum" scenario. The test still passes for the correct reasons (confidence-reboot is ranked first) but the fixture setup does not match the intent described in its comments.

---

ACs: 1 covered / 1 total | Findings: 6 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 2
