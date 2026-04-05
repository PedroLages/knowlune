## Exploratory QA Report: Course Overview Timeline Redesign

**Date:** 2026-04-04
**Routes tested:** 4 (`/courses`, `/courses/:courseId`, `/courses/:courseId/lessons/:lessonId`, `/courses/nonexistent-id`)
**Health score:** 42/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 20 | 30% | 6 |
| Edge Cases | 60 | 15% | 9 |
| Console | 40 | 15% | 6 |
| UX | 60 | 15% | 9 |
| Links | 60 | 10% | 6 |
| Performance | 60 | 10% | 6 |
| Content | 100 | 5% | 5 |
| **Total** | | | **47/100** |

### Top Issues

1. **CourseOverview crashes with React hooks violation** -- the entire `/courses/:courseId` route is broken for imported courses, rendering a "Something went wrong" error boundary instead of the course overview page.
2. **All 23 existing regression tests for CourseOverview fail** -- they seed the obsolete `courses` IDB store instead of `importedCourses`, indicating the regression suite was not updated after the adapter migration.
3. **Console emits 4 React errors** during CourseOverview navigation, including "Rendered more hooks than during the previous render" and RouteErrorBoundary catch logs.

### Bugs Found

#### BUG-001: CourseOverview crashes with "Rendered more hooks than during the previous render"
**Severity:** Blocker
**Category:** Functional
**Route:** `/courses/:courseId`
**AC:** Hero section, Stats bar, Timeline curriculum, CTA, Sidebar -- all blocked

**Steps to Reproduce:**
1. Seed an `importedCourses` record, corresponding `importedVideos` (with `path` field for folder grouping), and `importedPdfs` into IndexedDB
2. Navigate to `/courses/{courseId}`
3. Observe the RouteErrorBoundary error screen

**Expected:** The CourseOverview page renders with hero section, stats bar, timeline curriculum, sidebar with author card and schedule button.

**Actual:** The page crashes immediately with: `Error: Rendered more hooks than during the previous render.` The RouteErrorBoundary catches it and displays "Something went wrong in this section" with a "Try again" button and "Go to Overview" link. The "Try again" button triggers the same crash.

**Evidence:** Screenshot `test-results/qa-course-overview-Course--48b3e-n-renders-with-course-title-chromium/test-failed-1.png` shows the error boundary with the full React error stack trace. Console logs capture 4 error entries:
- `React has detected a change in the order of Hooks called by %s`
- `Error: Rendered more hooks than during the previous render` (full stack at `updateWorkInProgressHook`)
- `[RouteErrorBoundary] Component: CourseOverview, Error: Rendered more hooks than during the previous render.`
- `[Knowlune:Error] 2026-04-04T17:41:32.617Z | RouteErrorBoundary (CourseOverview) | Rendered more hooks than during the previous render.`

**Root Cause Hypothesis:** The `CourseOverview` component (src/app/pages/CourseOverview.tsx) likely has a conditional code path that changes the number of React hooks called between renders. The `useCourseAdapter` hook returns different states (loading -> loaded) which changes what `adapter?.getCourse()` returns. If any hook call depends on a condition that changes between renders (e.g., `course.tags.length`, `capabilities?.requiresNetwork`), the hook count would vary. Alternatively, the `useLiveQuery` inside `useCourseAdapter` may internally change hook count across renders.

---

#### BUG-002: Regression test suite for CourseOverview seeds obsolete IDB store
**Severity:** High
**Category:** Functional
**Route:** `/courses/:courseId/overview`
**AC:** General

**Steps to Reproduce:**
1. Run `RUN_REGRESSION=1 npx playwright test tests/e2e/regression/course-overview.spec.ts --project=chromium`
2. All 23 tests fail with `Store "courses" not found in "ElearningDB" after 10 retries`

**Expected:** Regression tests pass and validate CourseOverview functionality.

**Actual:** All 23 tests fail because they seed a `courses` store that no longer exists in the IndexedDB schema. The CourseOverview component was migrated to use `importedCourses` via `useCourseAdapter`, but the regression tests were never updated.

**Evidence:** Test output shows `Error: Store "courses" not found in "ElearningDB" after 10 retries` for every test. Only 2 tests pass (not-found state tests that don't need seeded data).

---

#### BUG-003: Console warnings from chart component on Overview page
**Severity:** Low
**Category:** Console
**Route:** `/` (Overview)
**AC:** General

**Steps to Reproduce:**
1. Navigate to the Overview page (`/`)
2. Check browser console

**Expected:** No warnings.

**Actual:** Two identical warnings: `The width(-1) and height(-1) of chart should be greater than 0, please check the style of container...`

**Evidence:** Captured during console health audit in TC15. These appear to be from a Recharts component rendering before its container has dimensions.

---

#### BUG-004: Canvas2D performance warnings in lesson player
**Severity:** Low
**Category:** Console
**Route:** `/courses/:courseId/lessons/:lessonId`
**AC:** General

**Steps to Reproduce:**
1. Navigate to any lesson in the lesson player
2. Check browser console

**Expected:** No warnings.

**Actual:** Three identical Canvas2D warnings: `Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true.`

**Evidence:** Captured during lesson player console health audit. Likely from the video player or waveform visualization component.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Hero section renders with course title and CTA button | Fail | BUG-001: CourseOverview crashes before rendering |
| 2 | Stats bar shows correct metrics (duration, lessons, videos, PDFs) | Fail | BUG-001: CourseOverview crashes before rendering |
| 3 | Timeline curriculum shows modules with correct visual states | Fail | BUG-001: CourseOverview crashes before rendering |
| 4 | Clicking a module card expands/collapses to show lessons | Fail | BUG-001: CourseOverview crashes before rendering |
| 5 | Clicking "Resume Module" or CTA navigates to lesson player | Fail | BUG-001: CourseOverview crashes before rendering |
| 6 | Sidebar shows featured resources, author card, schedule button | Fail | BUG-001: CourseOverview crashes before rendering |
| 7 | Only active folder expanded by default in lesson sidebar | Pass | Module 2 expanded when navigating to v4; Module 1 and 3 collapsed |
| 8 | Other folders collapsed in lesson sidebar | Pass | Verified via data-state="closed" on non-active folders |
| 9 | Clicking collapsed folder expands it | Pass | Clicking Module 1 trigger expands to show its 3 lessons |
| 10 | Search expands all folders to show matches | Pass | Searching "Suspense" shows Module 3 expanded with match highlighted |
| 11 | Breadcrumb shows actual course name (not "Course") | Pass | Shows "Courses > Advanced React Patterns > 01-Intro.mp4" |
| 12 | No console errors during navigation | Partial | 0 errors in lesson player; 4 errors on CourseOverview (BUG-001) |
| 13 | Navigation flow: courses -> overview -> lesson -> back | Fail | CourseOverview crash blocks the flow at step 2 |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 4 | All from CourseOverview hooks violation (BUG-001). Lesson player: 0 errors. |
| Warnings | 5 | 2x Recharts width/height on Overview (BUG-003), 3x Canvas2D in lesson player (BUG-004) |
| Info | 0 | Clean |

### What Works Well

1. **Lesson sidebar folder grouping** is well-implemented: the active folder auto-expands, other folders stay collapsed, and folder labels derive cleanly from the file path structure.
2. **Breadcrumb** correctly shows the actual imported course name and lesson filename, with proper truncation via tooltips for long names.
3. **Search in sidebar** works correctly with result count feedback ("Showing 1 of 10 lessons"), highlighted matches, and automatic folder expansion during search.
4. **Error boundary** gracefully catches the CourseOverview crash and offers recovery options ("Try again", "Go to Overview") rather than showing a white screen.
5. **Invalid course ID** shows a helpful "Course not found" message with a "Back to Courses" link -- the not-found state works correctly.

---
Health: 47/100 | Bugs: 4 | Blockers: 1 | ACs: 5/13 verified (6 blocked by BUG-001)
