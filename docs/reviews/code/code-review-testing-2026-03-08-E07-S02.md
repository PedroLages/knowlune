# Test Coverage Review: E07-S02 — Recommended Next Dashboard Section

**Date:** 2026-03-08
**Branch:** feature/e07-s02-recommended-next-dashboard-section
**Reviewer:** code-review-testing agent

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 3+ active courses → show exactly 3, ranked by composite score | `recommendations.test.ts:176` (count), `:202` (ranking) | None — 3-course scenario never seeded | **Partial** |
| 2 | <3 active courses → show all available, no padding | `recommendations.test.ts:163` | `story-e07-s02.spec.ts:42` — count not asserted | **Partial** |
| 3 | Clicking a course card navigates to `/courses/:courseId` | None | `story-e07-s02.spec.ts:81` — href only, no click/navigation | **Partial** |
| 4 | No active courses → empty state with import message | None | `story-e07-s02.spec.ts:27` | **Covered** |
| 5 | Rankings refresh after study session | None | None | **Gap** |

**Coverage:** 1/5 ACs fully covered | 1 gap | 3 partial

---

## Findings

### 🔴 Blockers

**[BT1] AC5 has zero test coverage anywhere**
confidence: 95

"Rankings refresh after study session" is untested at both unit and E2E level. The `RecommendedNext` component re-computes via `useMemo([sessions])` — when `sessions` changes the widget re-ranks. There is no test that mutates session data and asserts the card order changes.

Suggested test: Seed two courses where course-B has higher recency. Verify course-B appears first. Then seed a fresh session for course-A via IndexedDB and reload. Assert course-A now appears first.

---

### 🟡 High Priority

**[HT1] AC3 E2E test never clicks or verifies navigation**
`tests/e2e/story-e07-s02.spec.ts:81-107` | confidence: 92

The test reads `href` and asserts it contains `/courses/`. It does not call `click()`, does not verify the URL changed, and does not verify the course detail page loaded. If click handlers are broken, this test still passes.

Fix: `await firstLink.click()` followed by `await expect(page).toHaveURL(/\/courses\/6mx/)`.

---

**[HT2] AC1 is never covered end-to-end**
`tests/e2e/story-e07-s02.spec.ts:42-79` | confidence: 88

The test seeds exactly 2 courses (AC2 territory). No E2E test seeds 3+ active courses and asserts exactly 3 cards render — which is the core constraint of AC1.

Fix: Add `'AC1 — shows exactly 3 cards when 3+ active courses are seeded'` — seed 4 course progress entries, reload, assert card count equals 3.

---

**[HT3] AC2 card count is not asserted**
`tests/e2e/story-e07-s02.spec.ts:42-79` | confidence: 85

The test only checks `await expect(cardsContainer).not.toBeEmpty()` which would pass for any non-zero count. With 2 seeded courses the assertion must be `expect(cards).toHaveCount(2)`.

---

### 🟠 Medium

**[MT1] Brittle card locator selector**
`tests/e2e/story-e07-s02.spec.ts:77` | confidence: 80

`[data-testid^="course-card"], a, [class*="card"]` is a compound selector where `[class*="card"]` matches any element whose class contains "card" — including wrappers, skeletons, and unrelated components.

Fix: Identify the actual `data-testid` emitted by `CourseCard` with `variant="overview"` and use a single specific selector. If `CourseCard` doesn't expose one, add `data-testid="course-card-overview"`.

---

**[MT2] Residual localStorage not cleared before each test**
`tests/e2e/story-e07-s02.spec.ts:19-25` | confidence: 75

The `beforeEach` seeds sidebar state but does not explicitly clear `course-progress`. Residual progress from a prior crashed test could cause the AC4 empty-state test to pass against stale data.

Fix: Call `await localStorage.clearAll()` in the shared `beforeEach` before seeding sidebar state.

---

**[MT3] Missing unit test for `totalLessons === 0` guard**
`src/lib/__tests__/recommendations.test.ts` | confidence: 72

`computeCompositeScore` has an early-return guard at line 28 for courses with zero modules, but no unit test exercises this path.

Fix: Add `it('returns 0 for a course with no lessons', ...)` using `makeCourse({ modules: [] })`.

---

**[MT4] Overview unit test mock adds no AC coverage**
`src/app/pages/__tests__/Overview.test.tsx:99-101` | confidence: 70

`RecommendedNext` is mocked wholesale as a stub div. The test verifies the component mounts but contributes zero coverage to any AC. No assertion verifies the stub is even visible in the rendered output.

Fix: Add `expect(screen.getByTestId('recommended-next')).toBeInTheDocument()` to make the test meaningful as an integration smoke check.

---

### ⚪ Nits

**[NT1]** `story-e07-s02.spec.ts:28-32` — AC4 test calls `page.goto('/')` twice (once in `beforeEach`, once in test body) plus a `reload()`. First `goto` in test body is redundant.

**[NT2]** `recommendations.test.ts:47-57` — `makeProgress` factory sets both `startedAt` and `lastAccessedAt` to the same date. No test exercises the case where they diverge (realistic in production).

**[NT3]** `story-e07-s02.spec.ts:11` — `createCourseProgress` defaults `lastAccessedAt: now`. Two courses seeded simultaneously have identical recency scores and rank by completion only. This implicit assumption should be documented in a comment.

---

## Edge Cases Not Covered by Any Test

| Edge Case | Impact | Priority |
|-----------|--------|----------|
| Score tie-breaking: identical composite scores → non-deterministic `Array.sort` order | Flaky test risk | Medium |
| Sessions beyond 30-day window contribute 0 to frequency score (line 70 in component) | Untested filter branch | Medium |
| `isLoading: true` skeleton → verify skeleton renders and transitions away | AC coverage gap | Medium |
| AC4 empty-state CTA: "Explore courses" link navigates to `/courses` | Partial AC4 coverage | Low |
| `computeCompositeScore` called with zero-lesson course that has a progress entry | Double guard, untested | Low |

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Blocker | 1 |
| 🟡 High | 3 |
| 🟠 Medium | 4 |
| ⚪ Nit | 3 |
| **Total** | **11** |

ACs fully covered: 1/5 | Partial: 3/5 | Gap: 1/5
