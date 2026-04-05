## Test Coverage Review: Course Timeline Rewrite, Sidebar Collapse, and Breadcrumb Fix

**Scope**: Three files changed on `main` (commit `9d07aa86`):
1. `src/app/pages/CourseOverview.tsx` -- Full JSX rewrite from accordion to cinematic timeline layout
2. `src/app/components/course/tabs/LessonsTab.tsx` -- Sidebar UX: collapsed-by-default folders with auto-expand active
3. `src/app/pages/UnifiedLessonPlayer.tsx` -- Breadcrumb fix: show actual course name from adapter

### Change Summary

**CourseOverview.tsx** (major rewrite):
- Hero: centered cinematic layout replaces left-aligned gradient hero
- Tags: single outline badge (first tag only) replaces "What You'll Learn" checklist with `formatTag()`
- Stats: floating glass-morphism bar replaces grid cards; labels changed ("Duration" -> "Total Time", "Level" removed, "PDFs" -> "Resources")
- CTA: brand button in hero replaces sidebar CTA card; "Ready to Start?" / "Welcome Back!" headings removed; "Start First Lesson" label changed to "Start Course"
- Curriculum: timeline with status dots (completed/active/upcoming) replaces accordion with folder icons; "Curriculum" heading renamed to "Course Journey"; "3 lessons" badge removed; "Lesson N" labels removed
- Description: moved to sidebar under "About" heading (was "About This Course")
- Author card: moved to sidebar (was in main content)
- Back button: removed from main layout (was a standalone `<button>`)
- New: `moduleStatuses` computation (completed/active/upcoming) based on progress
- New: "Resume Module" link on active module
- New: "Featured Resources" sidebar section for PDFs
- New: PDFs shown inline within expanded timeline modules

**LessonsTab.tsx** (behavioral change):
- Folders now collapsed by default (was `defaultOpen={isActiveFolder}`)
- Controlled `expandedFolders` state with `useState<Set<string>>`
- Auto-expand active folder on lesson navigation
- Search overrides collapse state (all folders open during search)
- `toggleFolder` callback for manual expand/collapse

**UnifiedLessonPlayer.tsx** (small fix):
- Breadcrumb `courseName` now uses `adapter?.getCourse?.()?.name` as primary source, falling back to `course?.name`

---

### Behavioral Changes Mapped to Existing Tests

Since there is no story file for these changes (they are part of commit `9d07aa86` which is a multi-file feature commit), I am mapping the **behavioral changes** as implicit acceptance criteria.

| # | Behavioral Change | Description |
|---|-------------------|-------------|
| BC1 | Cinematic hero with centered title | Title renders in centered hero with `data-testid="course-overview-title"` |
| BC2 | Single tag badge (first tag only) | Only `course.tags[0]` displayed; "What You'll Learn" section removed entirely |
| BC3 | Floating stats bar | Stats bar with Total Time / Lessons / Videos / Resources labels |
| BC4 | CTA button in hero | Brand button (`data-testid="course-overview-cta"`) is now a `<Button>` (not a link) with label "Start Course" |
| BC5 | Timeline curriculum with module statuses | Modules display as timeline with completed/active/upcoming dot indicators |
| BC6 | "Course Journey" heading | Replaces "Curriculum" heading |
| BC7 | Module status computation | `moduleStatuses` useMemo: completed (all videos >=90%), active (first non-completed), upcoming (rest) |
| BC8 | Description in sidebar under "About" | Replaces "About This Course" in main content |
| BC9 | Author card in sidebar | Moved from main content to sticky sidebar |
| BC10 | Back button removed | No longer has standalone back button in main layout |
| BC11 | Sidebar folders collapsed by default | LessonsTab: folders start collapsed, active auto-expands |
| BC12 | Auto-expand active folder on navigation | `useEffect` expands folder when `activeFolder` changes |
| BC13 | Search overrides collapse state | All folders open when `searchQuery` is truthy |
| BC14 | Breadcrumb shows adapter course name | `adapterCourse?.name ?? course?.name ?? 'Course'` |
| BC15 | PDFs in timeline modules | PDFs now appear inline in expanded module content |
| BC16 | Featured Resources sidebar | Up to 3 PDFs shown in sidebar with "View all N resources" button |

---

### AC Coverage Table

| BC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| BC1 | Cinematic hero with centered title | None | `course-overview.spec.ts:144-151` (title check) and `story-e91-s10.spec.ts:73-80` (testid check) | **Covered** -- title assertion still valid, `data-testid` unchanged |
| BC2 | Single tag badge (first tag only) | None | `course-overview.spec.ts:237-248` checks "What You'll Learn" and formatted tags | **BROKEN** -- test expects "What You'll Learn" heading and formatted multi-tag list which no longer exist |
| BC3 | Floating stats bar | None | `story-e91-s10.spec.ts:82-97` checks stats counts; `course-overview.spec.ts:167-179` checks "Duration" and "Level" labels | **Partial** -- E91-S10 checks counts by `data-testid` (likely still passes); course-overview.spec checks "Duration" and "Level" labels which no longer exist |
| BC4 | CTA button in hero | None | `story-e91-s10.spec.ts:130-137` checks `data-testid="course-overview-cta"` and text "Start Course"; `course-overview.spec.ts:255-269` checks `getByRole('link', { name: /Start First Lesson/ })` and "Ready to Start?" | **Partial** -- E91-S10 likely still passes (testid preserved, label matches); course-overview.spec will BREAK ("Start First Lesson" -> "Start Course", "Ready to Start?" removed, element changed from link to button) |
| BC5 | Timeline curriculum with module statuses | None | None | **Gap** -- no test verifies timeline dots or completed/active/upcoming visual states |
| BC6 | "Course Journey" heading | None | `course-overview.spec.ts:277-283` expects "Curriculum" text and "3 lessons" badge | **BROKEN** -- "Curriculum" renamed to "Course Journey"; "3 lessons" badge removed |
| BC7 | Module status computation | None | None | **Gap** -- `moduleStatuses` useMemo logic (completed when all videos >=90%, first non-completed = active, rest = upcoming) has zero unit test coverage |
| BC8 | Description in sidebar under "About" | None | `story-e91-s10.spec.ts:99-106` checks `data-testid="course-overview-description"` content; `course-overview.spec.ts:181-191` checks "About This Course" text | **Partial** -- E91-S10 uses testid (likely passes); course-overview.spec looks for "About This Course" which is now just "About" |
| BC9 | Author card in sidebar | None | `course-overview.spec.ts:198-229` checks author card (testid + content) | **Covered** -- `data-testid="course-overview-author"` preserved; content assertions (name, initials, link) should still pass |
| BC10 | Back button removed | None | `course-overview.spec.ts:421-427` expects `getByRole('button', { name: /Back/ })` | **BROKEN** -- back button no longer exists in the main layout |
| BC11 | Sidebar folders collapsed by default | None | None | **Gap** -- no test for collapsed-by-default folder behavior in LessonsTab |
| BC12 | Auto-expand active folder on navigation | None | None | **Gap** -- no test for auto-expand behavior when navigating to a lesson in a different folder |
| BC13 | Search overrides collapse state | None | `story-e91-s11.spec.ts` tests search filtering but not folder expansion during search | **Partial** -- search functionality tested but not the "all folders expand during search" override |
| BC14 | Breadcrumb shows adapter course name | None (CourseBreadcrumb mocked in unit test) | None | **Gap** -- no test verifies breadcrumb receives adapter course name; unit test mocks CourseBreadcrumb entirely |
| BC15 | PDFs in timeline modules | None | None | **Gap** -- PDFs were previously in a separate section; now inline in modules but untested |
| BC16 | Featured Resources sidebar | None | None | **Gap** -- new sidebar section with PDF links and "View all N resources" button is untested |

**Coverage**: 2 fully covered / 16 behavioral changes | 5 broken tests | 4 partial | 7 gaps

---

### Test Quality Findings

#### Blockers (broken/failing E2E tests)

- **(confidence: 95)** `tests/e2e/regression/course-overview.spec.ts:237-248` -- "What You'll Learn" section test. The test expects `page.getByText("What You'll Learn")` to be visible and checks formatted tags ("Body Language", "Micro Expressions", "Deception Detection"). The new layout removed this section entirely; only `course.tags[0]` shows as an outline badge. **This test will fail.**

- **(confidence: 95)** `tests/e2e/regression/course-overview.spec.ts:255-269` -- CTA section tests. Two assertions will break: (1) `getByRole('link', { name: /Start First Lesson/ })` -- the CTA is now a `<Button>` (not a link) with label "Start Course"; (2) `page.getByText('Ready to Start?')` -- this heading was removed. **Both tests will fail.**

- **(confidence: 95)** `tests/e2e/regression/course-overview.spec.ts:277-283` -- Curriculum heading test. Expects `page.getByText('Curriculum')` and `page.getByText('3 lessons')`. Heading is now "Course Journey" and the "3 lessons" badge was removed. **This test will fail.**

- **(confidence: 90)** `tests/e2e/regression/course-overview.spec.ts:167-179` -- Stats row label test. Expects `page.getByText('Duration')` and `page.getByText('Level')`. New layout uses "Total Time" instead of "Duration" and "Level" stat was removed entirely. **This test will fail.**

- **(confidence: 90)** `tests/e2e/regression/course-overview.spec.ts:181-191` -- About section test. Expects `page.getByText('About This Course')`. New layout uses just "About" as the heading. **This test will fail.**

- **(confidence: 90)** `tests/e2e/regression/course-overview.spec.ts:421-427` -- Back button test. Expects `page.getByRole('button', { name: /Back/ })`. The standalone back button was removed from the main layout. **This test will fail.**

- **(confidence: 85)** `tests/e2e/regression/course-overview.spec.ts:350-356` -- "Lesson N" labels test. Expects `page.getByText('Lesson 1')` and `page.getByText('Lesson 2')`. The new timeline layout removed per-lesson "Lesson N" labels; modules now show "Module N" labels instead. **This test will likely fail** (depends on whether any other text on the page contains "Lesson 1").

- **(confidence: 80)** `tests/e2e/regression/story-e50-s05.spec.ts:87-91` -- Schedule study time button test. The button `data-testid="schedule-study-time-button"` is preserved in the new layout, but this test navigates to `/courses/${COURSE_ID}` (not `/overview`) so it may render a different page component. **Verify the route still renders CourseOverview.** If it does, this test likely passes since the testid is preserved.

#### High Priority

- **(confidence: 92)** BC7: `moduleStatuses` computation at `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/CourseOverview.tsx:351-367` has no unit test. This is a pure computation (completed/active/upcoming) that determines timeline dot states. The logic has subtle semantics: groups with zero videos always fall through to `!foundActive` (marking them "active" even with no videos). **Suggested test**: `CourseOverview.moduleStatuses.test.ts` in `src/app/pages/__tests__/` extracting the computation to a utility function and testing: (a) all modules completed, (b) first module incomplete = active + rest upcoming, (c) empty groups with no videos, (d) threshold boundary (89% vs 90%).

- **(confidence: 88)** BC11/BC12: LessonsTab collapsed-by-default and auto-expand behavior at `/Volumes/SSD/Dev/Apps/Knowlune/src/app/components/course/tabs/LessonsTab.tsx:290-310` has no test. This is a user-facing UX change (folders start collapsed, active auto-expands). **Suggested test**: E2E spec `tests/e2e/regression/lessons-tab-folders.spec.ts` with assertions: (a) non-active folder is collapsed, (b) active folder is expanded, (c) navigating to lesson in different folder auto-expands that folder.

- **(confidence: 85)** BC14: Breadcrumb fix at `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/UnifiedLessonPlayer.tsx:91-92` has no test. The `CourseBreadcrumb` component is completely mocked in the unit test at line 109 (`CourseBreadcrumb: () => <div>Breadcrumb</div>`), so the `courseName` prop change is invisible to tests. **Suggested test**: Either (a) update the mock to capture props and assert `courseName` receives adapter name, or (b) add an E2E test that seeds a course via adapter and verifies the breadcrumb text matches the adapter course name.

- **(confidence: 80)** BC5: Timeline visual states. No test verifies the completed/active/upcoming dot classes. While visual styling is harder to test, the semantic meaning (completed = success color, active = violet glow, upcoming = muted) drives user comprehension. **Suggested test**: E2E spec that seeds a course with some completed lessons and verifies the timeline structure -- e.g., first module card has elevated styling class, completed modules show checkmark icon.

#### Medium

- **(confidence: 75)** BC15/BC16: PDFs in timeline and Featured Resources sidebar. Previously PDFs were in a separate accordion section. Now they appear in two places: inline in expanded modules and in a "Featured Resources" sidebar card. Zero test coverage for either. **Suggested test**: E2E test in course-overview spec that seeds a course with PDFs and verifies (a) PDF links appear in expanded module, (b) Featured Resources card shows up to 3 PDFs, (c) "View all N resources" button appears when >3 PDFs.

- **(confidence: 72)** `tests/e2e/regression/story-e91-s10.spec.ts:108-116` -- "What You'll Learn" tags test. Checks `data-testid="course-overview-tags"` which no longer exists in the new layout. **This test will fail.** (Listing as Medium since E91-S10 is an archived regression spec and the fix is the same as the course-overview.spec blocker.)

- **(confidence: 70)** `tests/e2e/regression/story-e91-s10.spec.ts:99-106` -- About section test. Checks `data-testid="course-overview-description"` which is preserved, but the parent heading "About This Course" may be checked elsewhere. The testid-based assertion should pass, but verify the test does not also check heading text.

#### Nits

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/regression/course-overview.spec.ts:1-14` (confidence: 60): The file header comment describes UI elements ("Stats row", "What You'll Learn tags", "CTA card") that no longer match the actual layout. Should be updated to reflect timeline layout, floating stats bar, and hero CTA.

- **Nit** `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/regression/course-overview.spec.ts:153-165` (confidence: 55): The "shows category and difficulty badges" test checks for "Behavioral Analysis" text and "intermediate" badges. The new layout only shows `course.tags[0]` as a single outline badge and no longer displays category/difficulty separately. This test may still pass if the first tag or category text happens to match, but its intent no longer aligns with the UI.

### Edge Cases to Consider

- **Module with zero videos**: The `moduleStatuses` computation checks `groupVideos.every(...)` on an empty array, which returns `true` for `every()`. But it also checks `groupVideos.length > 0`, so empty groups fall through to the `foundActive` logic. A module with only PDFs and no videos would be marked "active" (first) or "upcoming" (subsequent), never "completed". This is an implicit design decision that should be tested.

- **Single-module course**: When `groupedContent.length === 1`, the title defaults to "All Lessons". The timeline with a single dot may look odd. No test covers single-module rendering.

- **Course with no progress data**: When `progressMap` is empty, all modules will be upcoming except the first (which will be active). This is the default state for a new course. The existing E2E tests seed courses without progress, so this path is indirectly exercised, but no assertion verifies the timeline dots specifically.

- **Rapid folder toggling in LessonsTab**: The `toggleFolder` uses a `Set` copy pattern. Rapid toggling should be safe since React batches state updates, but no test verifies stability under rapid interaction.

- **Adapter without `getCourse` method**: The breadcrumb fix uses optional chaining (`adapter?.getCourse?.()`). If `getCourse` is undefined, it falls back correctly. The unit test mocks `adapter` without `getCourse`, so this path is indirectly covered.

---

### Summary

The `CourseOverview.tsx` rewrite is a major UI overhaul that invalidates a significant portion of the existing E2E test suite. At minimum **7 test assertions across 2 E2E spec files will fail** due to removed/renamed UI elements. The new timeline curriculum, module status computation, LessonsTab collapse behavior, and breadcrumb fix introduce behavioral changes with **zero dedicated test coverage**.

**Recommended priority actions:**
1. Update `tests/e2e/regression/course-overview.spec.ts` to match the new layout (fix all 7 broken assertions)
2. Update `tests/e2e/regression/story-e91-s10.spec.ts` to remove "What You'll Learn" tag assertions
3. Add unit test for `moduleStatuses` computation (extract to utility, test boundary conditions)
4. Add E2E coverage for LessonsTab collapsed-by-default and auto-expand behavior
5. Add breadcrumb prop assertion in UnifiedLessonPlayer unit test (or E2E)

---
Behavioral Changes: 2 covered / 16 total | Findings: 17 | Blockers: 7 | High: 4 | Medium: 3 | Nits: 2
