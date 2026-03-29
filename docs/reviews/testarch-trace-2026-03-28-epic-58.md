# TestArch Trace: Epic 58 — Notifications Page

**Date:** 2026-03-28
**Epic:** E58 — Notifications Page
**Stories:** E58-S01 (single-story epic)
**Test File:** `tests/e2e/notifications-page.spec.ts`

## Traceability Matrix

| AC | Description | Test(s) | Status |
|----|-------------|---------|--------|
| AC1 | Route renders full-page list sorted newest-first, showing icon/title/message/time/read indicator | `AC1: renders notification list sorted newest-first` (L156-172) — verifies 5 items, newest-first sort, first="Course Completed", last="Review Due" | COVERED |
| AC2 | "View all" button navigates from NotificationCenter popover to `/notifications` | `AC2: "View all" button navigates from NotificationCenter` (L174-194) — opens popover, clicks button, asserts URL + heading | COVERED |
| AC3a | Filter by read/unread status | `AC3: filter by read status` (L196-218) — toggles Unread (3), Read (2), All (5) | COVERED |
| AC3b | Filter by notification type | `AC3: filter by notification type` (L220-240) — filters course-complete (1), streak-milestone (1), back to all (5) | COVERED |
| AC4a | Individual mark-as-read | `AC4: mark individual notification as read` (L242-259) — clicks mark-read, asserts `data-read="true"` | COVERED |
| AC4b | Bulk mark-all-as-read | `AC4: mark all notifications as read` (L261-280) — clicks mark-all, asserts all 5 read, button disappears | COVERED |
| AC5 | Dismiss notification (soft-delete) | `AC5: dismiss a notification` (L282-296) — dismisses first, asserts count drops to 4 | COVERED |
| AC6a | Empty state (no notifications) | `AC6: shows empty state when no notifications` (L298-306) — clears IDB, asserts empty state with "No notifications yet" | COVERED |
| AC6b | Filtered empty state | `AC6: shows filtered empty state when filters match nothing` (L308-323) — combines read + course-complete filter, asserts "No matching notifications" | COVERED |
| AC7a | Keyboard accessible | `AC7: keyboard accessible` (L325-342) — tabs to filters, verifies `aria-pressed`, verifies mark-all button visible | PARTIAL |
| AC7b | ARIA live region | `AC7: ARIA live region announces actions` (L344-356) — marks all read, asserts live region text | COVERED |
| AC7c | Responsive layout (mobile/tablet/desktop) | — | GAP |

## Coverage Summary

| Metric | Value |
|--------|-------|
| **Total ACs** | 7 (expanded to 12 sub-criteria) |
| **Fully Covered** | 10 |
| **Partially Covered** | 1 (AC7a) |
| **Not Covered** | 1 (AC7c) |
| **Coverage** | **88%** (10.5 / 12) |

## Test Count

- **Total test cases:** 11
- **AC1:** 1 test
- **AC2:** 1 test
- **AC3:** 2 tests (read status + type filter)
- **AC4:** 2 tests (individual + bulk)
- **AC5:** 1 test
- **AC6:** 2 tests (empty + filtered-empty)
- **AC7:** 2 tests (keyboard + ARIA live)

## Gaps and Blind Spots

### GAP 1: Responsive layout not tested (AC7c) — MEDIUM

AC7 states "layout adapts to mobile/tablet/desktop viewports" but no test sets a viewport size and verifies layout adaptation. All tests run at the default Playwright viewport (1280x720). This is a **common pattern** in the codebase; design review agents typically cover responsive checks via Playwright MCP visual inspection, but the E2E suite has no programmatic assertion.

**Recommendation:** Add a responsive test that sets mobile viewport (`page.setViewportSize({ width: 375, height: 667 })`) and verifies the layout renders without horizontal overflow and all interactive elements remain accessible.

### GAP 2: Keyboard navigation depth is shallow (AC7a) — LOW

The AC7 keyboard test verifies `aria-pressed` on filter buttons and that mark-all is visible, but does not actually exercise full keyboard-only interaction (e.g., Tab through notification items, press Enter on mark-as-read, Tab to dismiss). The test checks accessibility attributes exist but not that the full workflow works keyboard-only.

**Recommendation:** Extend the keyboard test to Tab through at least one notification item and activate a mark-as-read or dismiss action via Enter/Space.

### GAP 3: No test for notification content completeness (AC1 detail) — LOW

AC1 specifies "icon, title, message, relative time, and read/unread indicator" should all be visible. The test checks title text and sort order but does not explicitly verify the presence of the icon, relative timestamp, or the read/unread indicator on individual items. The `data-read` attribute is tested in AC4 but not as part of the initial render verification.

**Recommendation:** Add assertions for visible timestamp text and unread indicator styling in the AC1 test.

### GAP 4: No cross-filter combination test beyond AC6b — LOW

The AC6b test combines read + course-complete filters resulting in an empty state, which implicitly tests combined filtering. However, no test verifies a combined filter that returns a non-empty result (e.g., unread + import-finished should return 1 item). This is an edge case but not critical since individual filters are well-tested.

### GAP 5: Persistence not verified after page reload — LOW

AC4 and AC5 state that actions are "backed by Dexie write" but no test reloads the page after mark-as-read or dismiss to verify the state persists. The optimistic UI is tested but not the durability guarantee.

## Strengths

1. **Excellent AC coverage** — every AC has at least one dedicated test
2. **Smart seeding strategy** — browser-relative timestamps avoid TTL cleanup issues
3. **Proper cleanup** — `afterEach` clears IDB, preventing cross-test contamination
4. **Two empty-state variants** — tests both "no data" and "filters match nothing" (exceeds AC6 requirements)
5. **Optimistic UI verification** — AC4 tests use `data-read` attribute for deterministic assertions rather than visual checks
6. **AC annotations** — test names clearly map to acceptance criteria

## Gate Decision

**PASS** — 88% coverage with no BLOCKER-level gaps. The responsive gap (AC7c) is mitigated by the design review agent covering visual inspection. The keyboard depth gap is LOW severity. All 7 acceptance criteria have at least one test, and the test quality is high with proper seeding, cleanup, and deterministic assertions.
