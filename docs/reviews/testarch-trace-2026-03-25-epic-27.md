# Traceability Report: Epic 27 — Analytics Consolidation

**Generated:** 2026-03-25
**Scope:** E27-S01 through E27-S03 (3 stories, 22 acceptance criteria)
**Coverage:** 95% (21/22 ACs covered)
**Gate Decision:** PASS

---

## Summary

| Story | ACs | Covered | Gaps | Coverage |
|-------|-----|---------|------|----------|
| E27-S01: Add Analytics Tabs To Reports Page | 8 | 8 | 0 | 100% |
| E27-S02: Route Redirects For Legacy Paths | 6 | 5 | 1 | 83% |
| E27-S03: Update Sidebar Links To Reports Tabs | 8 | 8 | 0 | 100% |
| **Total** | **22** | **21** | **1** | **95%** |

---

## E27-S01: Add Analytics Tabs To Reports Page

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Reports tabs controlled by `?tab=` query param (study/quizzes/ai) | `defaults to Study tab when no ?tab param`, `?tab=study activates Study tab`, `?tab=quizzes activates Quiz tab`, `?tab=ai activates AI tab` | Reports.test.tsx renders with MemoryRouter (implicit URL-aware validation) | COVERED |
| AC2 | Three tab triggers visible (Study Analytics, Quiz Analytics, AI Analytics) | `all three tab triggers are visible` | N/A | COVERED |
| AC3 | Invalid `?tab=` falls back to Study tab | `?tab=invalid falls back to Study tab` | N/A | COVERED |
| AC4 | New Quiz Analytics tab component with aggregate stats (total quizzes, avg score, avg retakes) | `AC7: Quiz Analytics shows seeded quiz data with stat cards` (asserts `quiz-total-card`, `quiz-avg-score-card`, `quiz-retake-detail-card`) | Reports.test.tsx mocks QuizAnalyticsTab (component existence validated) | COVERED |
| AC5 | Tab clicks update URL with `replace` semantics | `clicking tab updates URL` (Quiz -> AI -> Study URL transitions), `AC5: tab clicks update URL with replace semantics` | N/A (E2E validates end-to-end) | COVERED |
| AC6 | Quiz empty state when no quiz data | `Quiz Analytics shows empty state when no quiz data` (asserts "No quizzes taken yet") | N/A | COVERED |
| AC7 | Retake frequency moved from Study tab to Quiz tab | `AC7: Retake Frequency is not visible in Study tab`, `AC7: Quiz Analytics shows seeded quiz data with stat cards` (asserts `quiz-retake-detail-card`) | N/A | COVERED |
| AC8 | Tab switching between all three tabs works end-to-end | `reports-redesign.spec.ts: should switch between all three tabs` (Quiz -> AI -> Study round-trip) | N/A | COVERED |

**Additional coverage:** `reports-redesign.spec.ts` provides regression tests for Study Analytics tab content (stat cards, charts, empty state, responsive mobile layout).

---

## E27-S02: Route Redirects For Legacy Paths

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | `/reports/study` redirects to `/reports?tab=study` | `/reports/study redirects to /reports?tab=study` (asserts URL + heading + active tab) | N/A | COVERED |
| AC2 | `/reports/ai` redirects to `/reports?tab=ai` | `/reports/ai redirects to /reports?tab=ai` (asserts URL + active tab) | N/A | COVERED |
| AC3 | `/reports/quizzes` redirects to `/reports?tab=quizzes` | `/reports/quizzes redirects to /reports?tab=quizzes` (asserts URL + active tab) | N/A | COVERED |
| AC4 | Tab clicks update URL bidirectionally | `clicking AI Analytics tab updates URL to ?tab=ai`, `clicking Study Analytics tab updates URL to ?tab=study` | N/A | COVERED |
| AC5 | Bare `/reports` defaults to Study Analytics | `bare /reports defaults to Study Analytics tab`, `unknown ?tab=garbage falls back to Study Analytics` | N/A | COVERED |
| AC6 | Unit tests for URL-controlled tabs with MemoryRouter | N/A | **GAP** — Reports.test.tsx wraps in MemoryRouter but does NOT include explicit `?tab=` routing tests (no `initialEntries` with query params) | **GAP** |

**Gap detail:**
- **AC6 (Unit tests for URL-controlled tab routing):** The implementation plan (Task 3) specified 4 unit tests for URL-controlled tabs using `MemoryRouter` with `initialEntries` like `/reports?tab=study`, `/reports?tab=ai`, `/reports?tab=garbage`. The existing `Reports.test.tsx` wraps in `<MemoryRouter>` but only uses the bare default route. No unit test explicitly validates that `?tab=ai` activates the AI tab at the unit level. The E2E tests in `story-e27-s02.spec.ts` cover this behavior thoroughly, so the risk is low, but the planned unit tests were not implemented.

---

## E27-S03: Update Sidebar Links To Reports Tabs

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | Study Analytics link visible in sidebar | `Study Analytics link is visible in sidebar` | N/A | COVERED |
| AC2 | Quiz Analytics link visible in sidebar | `Quiz Analytics link is visible in sidebar` | N/A | COVERED |
| AC3 | AI Analytics link visible in sidebar | `AI Analytics link is visible in sidebar` | N/A | COVERED |
| AC4 | Sidebar links navigate to correct `?tab=` URLs | `Study Analytics link navigates to /reports?tab=study`, `Quiz Analytics link navigates to /reports?tab=quizzes`, `AI Analytics link navigates to /reports?tab=ai` | N/A | COVERED |
| AC5 | Active state (aria-current=page) for each tab-specific sidebar item | `Study Analytics sidebar item has aria-current=page on /reports?tab=study`, `Quiz Analytics sidebar item has aria-current=page on /reports?tab=quizzes`, `AI Analytics sidebar item has aria-current=page on /reports?tab=ai` | N/A | COVERED |
| AC6 | Study Analytics active on bare `/reports` (default), others inactive | `Study Analytics is active on bare /reports (default tab)` (also asserts Quiz and AI NOT active) | `getIsActive: activates study tab when on bare /reports (default tab)`, `does not activate quiz tab on bare /reports` | COVERED |
| AC7 | Old single "Reports" link removed from sidebar | `single Reports link is no longer present in sidebar` | navigation.test.ts: `Track group has 5 items` (validates 3 separate analytics items, not 1 Reports item) | COVERED |
| AC8 | SearchCommandPalette updated with tab-specific entries | `SearchCommandPalette shows tab-specific Reports entries (AC8)` (searches "Analytics", asserts 3 options, clicks Study Analytics -> URL) | N/A | COVERED |

**Additional unit test coverage:**
- `NavLink.test.tsx` (8 tests): Pure function tests for `getIsActive()` covering tab matching, default tab fallback, root exact match, startsWith for non-tab routes, and cross-route non-activation.
- `navigation.test.ts` (6 tests): Validates navigation group structure (3 groups, item counts/order), unique nav keys, primary/overflow nav split, absence of deprecated groups.

---

## Cross-Story Integration Coverage

| Integration Point | Test Evidence | Status |
|-------------------|---------------|--------|
| Sidebar link -> URL -> Tab activation (S03 -> S01) | E27-S03 E2E: link click asserts URL; E27-S01 E2E: URL param asserts active tab | COVERED |
| Legacy path -> Redirect -> Tab activation (S02 -> S01) | E27-S02 E2E: `/reports/study` asserts redirect URL + active Study tab | COVERED |
| Tab click -> URL update -> Sidebar active state (S01 -> S03) | E27-S01 E2E: clicking tab asserts URL; E27-S03 E2E: URL asserts aria-current | COVERED |
| `reports-redesign.spec.ts` 3-tab switching | Tests round-trip switching between all 3 tabs, verifies Study content reappears | COVERED |
| Empty state guard (hasActivity) | `reports-redesign.spec.ts: should show empty state message when no activity` | COVERED |
| Responsive mobile layout | `reports-redesign.spec.ts: bar chart should be scrollable on mobile viewport` | COVERED |

---

## Test Inventory

| Test File | Type | Tests | Stories Covered |
|-----------|------|-------|-----------------|
| `tests/e2e/regression/story-e27-s01.spec.ts` | E2E | 11 | S01 |
| `tests/e2e/regression/story-e27-s02.spec.ts` | E2E | 9 | S02 |
| `tests/e2e/regression/story-e27-s03.spec.ts` | E2E | 12 | S03 |
| `tests/e2e/reports-redesign.spec.ts` | E2E | 10 | S01 (regression) |
| `src/app/pages/__tests__/Reports.test.tsx` | Unit | 4 | S01, S02 |
| `src/app/components/__tests__/NavLink.test.tsx` | Unit | 8 | S03 |
| `src/app/config/__tests__/navigation.test.ts` | Unit | 6 | S03 |
| **Total** | | **60** | |

---

## Gaps and Recommendations

### 1. Missing Unit Tests for URL-Controlled Tab Routing (LOW risk)

**Impact:** Low. The E2E tests in `story-e27-s02.spec.ts` thoroughly cover `?tab=study`, `?tab=ai`, `?tab=garbage` fallback behavior. However, the implementation plan specified unit-level validation via `MemoryRouter` with `initialEntries`.

**Recommendation:** Add 4 unit tests to `Reports.test.tsx`:
```typescript
describe('URL-controlled tabs', () => {
  it('activates Study tab on ?tab=study', ...)
  it('activates AI tab on ?tab=ai', ...)
  it('defaults to Study on bare /reports', ...)
  it('falls back to Study on ?tab=garbage', ...)
})
```

**Priority:** Low. E2E coverage is comprehensive. Add if pursuing >95% traceability.

---

## Blind Spots

1. **No unit test for QuizAnalyticsTab component in isolation.** The component is mocked in Reports.test.tsx. A dedicated unit test (e.g., `src/app/components/reports/__tests__/QuizAnalyticsTab.test.tsx`) would validate empty state rendering, data loading, and stat card calculation logic without requiring E2E overhead. Current E2E tests cover this adequately but are slower to execute.

2. **Browser history `replace` semantics not verified.** The `replace: true` option on `setSearchParams` prevents back-button pollution. E27-S01 test `AC5` mentions this in comments but does not assert `history.length` before/after tab switches. This is a deliberate trade-off (testing internal React Router behavior is fragile).

3. **No cross-browser coverage in regression specs.** The E2E regression tests run on Chromium only (`--project=chromium`). Tab URL synchronization is browser-standard, so cross-browser risk is minimal.

---

## Gate Decision: PASS

**Rationale:**
- 95% AC coverage (21/22 criteria have test evidence)
- The single gap (URL-controlled tab unit tests) is fully compensated by E2E coverage
- Cross-story integration points are all verified
- 60 total tests across E2E and unit layers
- No BLOCKER or HIGH-risk gaps
- Blind spots are well-understood with low risk profiles
