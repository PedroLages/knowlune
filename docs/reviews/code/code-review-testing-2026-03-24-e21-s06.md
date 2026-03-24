# Test Coverage Review: E21-S06 Smart Dashboard Reordering

**Date:** 2026-03-24
**Reviewer:** Claude Opus 4.6 (automated)
**Spec File:** `tests/e2e/dashboard-reordering.spec.ts`
**Tests:** 9 passed, 0 failed

## Acceptance Criteria Coverage

| AC | Description | Tests | Status |
|----|-------------|-------|--------|
| AC1 | Track section interactions | Implicit (IntersectionObserver fires on page load) | PARTIAL |
| AC2 | Auto-reorder by relevance | Not directly tested | GAP |
| AC3 | Manual drag-and-drop override | Not directly tested (dnd-kit drag simulation is complex in Playwright) | GAP |
| AC4 | Pin to top | `should pin a section to the top`, `should unpin a previously pinned section` | COVERED |
| AC5 | Reset to default | `should reset to default order` | COVERED |
| AC6 | Keyboard accessibility | `customizer panel should be keyboard accessible` | PARTIAL |

## Test Quality Assessment

**Strengths:**
- Good use of `localStorage` fixture for test data seeding
- `data-testid` attributes provide stable selectors
- Tests are independent (no test ordering dependency)
- Cleanup handled automatically by localStorage fixture (`clearAll` in afterEach)
- Assertions use Playwright auto-retry patterns (`toBeVisible`, `toHaveText`, `toHaveAttribute`)

**Gaps:**

### HIGH: AC2 (Auto-reorder) not tested

No test validates that sections reorder based on interaction data. A test should seed `dashboard-section-stats` with interaction data (high views/time for a non-default-first section) and verify the auto-computed order differs from default.

### HIGH: AC3 (Drag-and-drop) not tested

No test validates the drag-and-drop reordering mechanism. While dnd-kit drag simulation in Playwright is non-trivial, it can be done with `page.mouse.move()` / `page.mouse.down()` / `page.mouse.up()` sequences. Alternatively, test the effect by seeding a manual order via localStorage and verifying the `isManuallyOrdered` flag.

### MEDIUM: AC6 (Keyboard drag) only partially tested

The keyboard accessibility test verifies `aria-expanded` and `role="region"` attributes but does not test keyboard-driven section reordering (Space + Arrow keys with dnd-kit's keyboard sensor). This is the primary keyboard accessibility requirement.

### LOW: AC1 (Interaction tracking) not directly validated

No test verifies that scrolling a section into view records interaction data in localStorage. Could be tested by navigating, scrolling, then checking `dashboard-section-stats` via the localStorage fixture's `get()` method.

## Recommendations

1. Add a test for AC2: seed `dashboard-section-stats` with heavily-used stats for `course-gallery`, load the page without manual ordering, verify `course-gallery` appears before default sections.
2. Add a test for AC3: either simulate mouse drag or seed `isManuallyOrdered: true` with a custom order and verify persistence after reload.
3. Expand AC6 test: focus a drag handle, press Space, then ArrowUp/ArrowDown, verify order changes.

## Verdict

**GAPS FOUND.** 4 of 6 ACs have test coverage. AC2 (auto-reorder) and AC3 (drag-and-drop) lack direct E2E tests. These are HIGH priority gaps since they represent core story functionality.
