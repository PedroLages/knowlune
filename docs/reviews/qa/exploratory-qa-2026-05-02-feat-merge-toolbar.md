## Exploratory QA Report: feat-merge-toolbar -- Merge Lesson Toolbar into Layout Header

**Date:** 2026-05-02
**Routes tested:** 8
**Health score:** 71/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 60 | 30% | 18.0 |
| Edge Cases | 70 | 15% | 10.5 |
| Console | 80 | 15% | 12.0 |
| UX | 50 | 15% | 7.5 |
| Links | 100 | 10% | 10.0 |
| Performance | 100 | 10% | 10.0 |
| Content | 60 | 5% | 3.0 |
| **Total** | | | **71/100** |

### Top Issues

1. **BLOCKER**: Centered search bar container overlaps and blocks pointer events on the Pomodoro, Reading Mode, and Theater buttons -- 3 of 4 lesson tools are completely unclickable with a mouse.
2. **HIGH**: ESC key does not exit theater mode. The `data-theater-mode` attribute remains `"true"` and the header stays hidden. The plan's documented exit flow ("pressing ESC -> store toggles back -> everything reappears") is broken.
3. **MEDIUM**: Course name in the back link shows the hardcoded fallback "Course" instead of the resolved course name from IndexedDB (e.g., "QA Test Course - React Fundamentals").

### Bugs Found

#### BUG-001: Search bar container blocks pointer events on lesson tools
**Severity:** Blocker
**Category:** Functional / UX
**Route:** `/courses/:courseId/lessons/:lessonId`
**AC:** R1 (Lesson tools render inside Layout header)

**Steps to Reproduce:**
1. Navigate to any lesson page (e.g., `/courses/test-course-qa-001/lessons/test-lesson-qa-001`) at viewport >= 640px
2. Try to click the Pomodoro timer button in the header
3. Try to click the Reading Mode button
4. Try to click the Theater mode button

**Expected:** All lesson tool buttons respond to clicks.
**Actual:** The centered search bar container (`sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:w-96 lg:w-80` div) physically overlaps the tools container on the right by ~198px. The search bar element at x=682-1002 covers tools at x=804-1004, blocking pointer events. The Notes button works because it sits at x=1004+, outside the search overlay zone. Pomodoro, Reading Mode, and Theater buttons cannot receive mouse clicks.

**Evidence:** Playwright reports `intercepts pointer events` for all three buttons. Layout boxes confirm: search container right edge at 1002px, tools div left edge at 804px. Overlap: 198px.

**Root cause:** The search container uses `sm:absolute` positioning with a fixed width (`sm:w-96 lg:w-80` = 384px/320px) but lacks `pointer-events-none` on the container. The search button inside has `bg-muted` (opaque), capturing all pointer events in that region. Fix: add `pointer-events-none` to the search container div and `pointer-events-auto` to the child button.

---

#### BUG-002: ESC key does not exit theater mode
**Severity:** High
**Category:** Functional
**Route:** `/courses/:courseId/lessons/:lessonId`
**AC:** R4 (Theater mode hides all course tools -- theater mode must be exitable)

**Steps to Reproduce:**
1. Navigate to a lesson page
2. Enter theater mode (via button click using keyboard or programmatic access)
3. Press the Escape key
4. Observe that the header remains hidden and `data-theater-mode` remains `"true"` on `<html>`

**Expected:** ESC exits theater mode: `data-theater-mode` removed or set to `"false"`, header reappears. This is documented in the plan's system-wide impact section: "pressing ESC -> store toggles back -> everything reappears."
**Actual:** ESC has no effect. `data-theater-mode` stays `"true"`, header stays `display: none`. Confirmed via both Playwright `keyboard.press('Escape')` and by intercepting DOM keydown events (ESC event fires but no state change occurs).

**Evidence:** Keydown event for Escape is detected at the document level (verified via capture-phase listener), but the Zustand store's `toggleTheater` is never called. The theater mode state persists across hard-refresh (localStorage correctly stores `"true"`).

---

#### BUG-003: Course name resolves to fallback "Course" instead of actual name
**Severity:** Medium
**Category:** Content / UX
**Route:** `/courses/:courseId/lessons/:lessonId` and all `/courses/:courseId/**` routes
**AC:** R2 (back link with course name)

**Steps to Reproduce:**
1. Seed a course with a real name in IndexedDB (IMportedCourses table)
2. Navigate to `/courses/{courseId}/lessons/{lessonId}`
3. Observe the back link text in the header

**Expected:** Back link shows the resolved course name (e.g., "QA Test Course - React Fundamentals") or a skeleton placeholder while loading.
**Actual:** Back link shows "Course" (the hardcoded fallback string). The aria-label says "Back to course" which is correct, but the visible text never resolves to the actual course name stored in IndexedDB.

**Evidence:** In all tests, `backLinkText` was `"Course"` despite the course having `name: "QA Test Course - React Fundamentals"` in `importedCourses`. The `useCourseRoute` hook may not be resolving the name from `useCourseImportStore` correctly, or the store may not be hydrated before the hook reads it.

---

#### BUG-004: Pre-existing sync engine errors in console
**Severity:** Low
**Category:** Console
**Route:** All routes
**AC:** General

**Steps to Reproduce:**
1. Navigate to any app route
2. Open browser console

**Expected:** Clean console (no errors).
**Actual:** Two consistent sync engine errors appear on every page load:
- `[syncEngine] Download error for table "quiz_attempts": column quiz_attempts.updated_at does not exist`
- `[syncEngine] Download error for table "ai_usage_events": column ai_usage_events.updated_at does not exist`

**Evidence:** Present on every route tested. These are pre-existing issues (not caused by this PR) related to Dexie/Supabase schema mismatch.

---

#### BUG-005: 404 error on video resource on lesson page
**Severity:** Low
**Category:** Console
**Route:** `/courses/:courseId/lessons/:lessonId`
**AC:** General

**Steps to Reproduce:**
1. Navigate to a lesson page for a course with invalid/incomplete video data
2. Check console

**Expected:** Graceful handling of missing video files with a user-friendly message.
**Actual:** A 404 HTTP error appears: `Failed to load resource: the server responded with a status of 404 (Not Found)`. The UI shows "Video file not found" which is acceptable, but the console error indicates the network request was made before the UI fallback triggered.

**Evidence:** 404 error in console alongside the "Video file not found" UI message. This may be acceptable behavior (the 404 is expected when video data is missing), but could be improved by checking file existence before attempting to load.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| R1 | Lesson tools render inside Layout header on lesson player pages | **Partial** | Tools are rendered but 3 of 4 are unclickable due to search overlay (BUG-001) |
| R2 | Back link with course name on all course sub-pages | **Partial** | Back link appears on all course routes, but course name shows "Course" fallback (BUG-003) |
| R3 | Responsive collapse tiers (desktop/tablet/mobile) | **Pass** | Desktop: all tools visible. Mobile: contextual BottomNav with Back/Notes/Complete/More. Tablet inherits desktop layout. |
| R4 | Theater mode hides all course tools via data-theater-hide | **Partial** | Theater mode correctly hides header via CSS. ES5 key exit is broken (BUG-002). |
| R5 | Reading mode exit accessible via status bar in UnifiedLessonPlayer | **Pass** | Reading mode toggle has `data-testid="reading-mode-toggle"` in header. Status bar exit path preserved in player. |
| R6 | 2px brand bottom border on header on lesson pages | **Pass** | `border-b-2 border-brand` correctly applied only on lesson routes. |
| R7 | Old sticky toolbar removed from UnifiedLessonPlayer | **Pass** | No sentinel element, no IntersectionObserver errors, no stuck state, no sticky back links. Only 1 `<header>` element. |
| R8 | Search bar centered in header on all pages | **Pass** | Search uses `sm:absolute sm:left-1/2 sm:-translate-x-1/2` centering on all routes. |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 4 unique | 2 sync engine (pre-existing), 1 400 Bad Request (pre-existing), 1 404 (missing video file) |
| Warnings | 1 unique | Canvas2D `willReadFrequently` performance hint (pre-existing) |
| Info | 26 total | React DevTools notice, performance metrics (FCP 316-661ms, LCP 966ms -- all "good"), embed worker lifecycle |

**React-specific:** No React warnings (no key prop issues, no deprecated lifecycle, no act() warnings, no PropTypes failures). Clean React render.

### What Works Well

1. **Old toolbar removal is clean and complete.** No sentinel element, no IntersectionObserver errors, no stuck-state logic, no sticky back links found anywhere on the lesson page. The single-header architecture works exactly as designed -- a clear improvement over the previous two-bar layout.

2. **Route-aware header is correctly scoped.** The back link appears on `/courses/:id`, `/courses/:id/flashcards`, `/courses/:id/lessons/:id`, and `/courses/:id/lessons/:id/quiz` but NOT on `/overview`, `/library`, `/courses`, or `/settings`. Lesson tools (Pomodoro, Reading Mode, Theater, Notes) only appear on the exact lesson player route, not on quiz or flashcards sub-routes. This precise scoping matches the plan perfectly.

3. **Mobile BottomNav contextualization works.** On mobile (375px), the BottomNav correctly switches to lesson mode showing "Back", "Notes", "Complete", "More" instead of the standard navigation items. This is a sophisticated responsive enhancement.

4. **Theater mode state persists across hard refresh.** When theater mode is enabled, `data-theater-mode` and `localStorage` state survive a full page reload. The header correctly re-hides after refresh. This is critical for a feature where users may accidentally refresh.

5. **Accessibility attributes are thorough.** All interactive elements have proper `aria-label` values ("Back to course", "Enter theater mode", "Enter reading mode (Cmd+Shift+R)", "Open search (Cmd+K)", "Pomodoro focus timer"). Keyboard shortcuts are documented in labels. 11 focusable elements in the header, all with descriptive attributes.

---
Health: 71/100 | Bugs: 5 | Blockers: 1 | ACs: 5/8 verified (3 partial)
