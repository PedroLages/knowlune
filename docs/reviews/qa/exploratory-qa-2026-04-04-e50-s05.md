## Exploratory QA: E50-S05 — Schedule Editor + Course Integration (2026-04-04)

**Reviewer**: Exploratory QA Agent (Playwright MCP)
**Date**: 2026-04-04
**Story**: E50-S05

### Routes Tested

- `/settings` (Calendar Integration section)
- `/courses/:courseId` (CourseOverview — active route)
- `/courses/:courseId/detail` — 404 (UnifiedCourseDetail not routed)

### Functional Tests

#### AC1: Settings "Add Study Block" button

**Result: BLOCKED** — Calendar feed requires sign-in to enable. The "Add Study Block" button is only visible when `feedEnabled=true`. Without authentication (test environment), the Calendar Integration section shows "Enable to sync your study schedule" message with the toggle. Toggling produces: "You must be signed in to enable the calendar feed."

The sign-in gate is working as designed but prevents verifying AC1 in the unauthenticated test environment.

#### AC3: Course detail → schedule editor

**Result: FAIL** — The `/courses/:courseId` route renders `CourseOverview`, not `CourseHeader`. No "Schedule study time" button exists on this page. The button was added to `CourseHeader` which is only used by the unrouted `UnifiedCourseDetail`.

#### General App Health

- Navigation: all routes work correctly
- Console errors: 4 pre-existing (AI model) — 0 new from this story
- Settings page renders fully without crashes
- CourseOverview renders without errors

### Health Score: 60/100

Deductions:
- AC3 unreachable (-20): Schedule study time button not on active course page
- AC1 untestable in dev environment (-10): Auth gate
- No E2E test coverage (-10)

### Verdict

**BLOCKED** — AC3 implementation is in dead code. Must be moved to the active course page.
