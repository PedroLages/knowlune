## Test Coverage Audit — Knowlune (2026-03-26)

### Scope and Methodology

This audit maps all 32 production page components to their unit and E2E test coverage, assesses test quality across all test layers, and identifies untested critical flows. Pages in `src/app/pages/prototypes/` and `src/app/pages/legal/` are excluded as they are non-production prototype and static-content routes.

**Test inventory:**
- 32 production page components
- 11 unit test files in `src/app/pages/__tests__/`
- 153 E2E spec files across `tests/e2e/` and `tests/e2e/regression/`
- ~175 additional unit test files in `src/` (lib, stores, components, AI)

---

### Coverage Matrix

| Page / Feature | Unit Test | E2E Test | Coverage | Priority |
|---|---|---|---|---|
| **Overview** (`Overview.tsx`) | `__tests__/Overview.test.tsx` | `tests/e2e/overview.spec.ts`, `overview-card-enhancements.spec.ts`, `story-e10-s02.spec.ts` | Full | High |
| **Courses** (`Courses.tsx`) | `__tests__/Courses.test.tsx` | `tests/e2e/courses.spec.ts`, `story-1-2-course-library.spec.ts`, `story-1-3-organize-by-topic.spec.ts`, `e01-s06-delete-imported-course.spec.ts` | Full | High |
| **MyClass** (`MyClass.tsx`) | `__tests__/MyClass.test.tsx` | `tests/e2e/navigation.spec.ts`, `story-e25-s09.spec.ts` | Full | High |
| **Authors** (`Authors.tsx`) | `__tests__/Authors.test.tsx` (14 tests) | `tests/e2e/regression/story-e07-s01.spec.ts`, `story-e07-s02.spec.ts` | Full | Medium |
| **AuthorProfile** (`AuthorProfile.tsx`) | None | `story-e07-s02.spec.ts` (navigates to `/authors/:id`) | Partial — no unit test, shallow E2E | Medium |
| **Reports** (`Reports.tsx`) | `__tests__/Reports.test.tsx` | `tests/e2e/reports-redesign.spec.ts`, `story-e27-s01.spec.ts`, `story-e27-s02.spec.ts`, `story-e27-s03.spec.ts` | Full | High |
| **Settings** (`Settings.tsx`) | `__tests__/Settings.test.tsx` (9 tests) | `tests/e2e/navigation.spec.ts` (load only) | Full (unit) / Partial (E2E) | High |
| **Notes** (`Notes.tsx`) | `__tests__/Notes.test.tsx` | `story-3-12.spec.ts`, `story-3-13.spec.ts`, `story-3.14.spec.ts`, `story-e03-s08.spec.ts` | Full | High |
| **Quiz** (`Quiz.tsx`) | None | `story-e15-s02.spec.ts`, `story-e18-s04.spec.ts`, `story-e18-s05.spec.ts`, `story-13-4.spec.ts`, `story-14-4.spec.ts` | Partial — E2E only, no unit test | High |
| **QuizResults** (`QuizResults.tsx`) | `__tests__/QuizResults.test.tsx` (15 tests) | `story-e16-s03-score-improvement.spec.ts`, `e18-s10-export-quiz-results.spec.ts` | Full | High |
| **QuizReview** (`QuizReview.tsx`) | `__tests__/QuizReview.test.tsx` | `story-e16-s01.spec.ts`, `story-e16-s02.spec.ts`, `story-e16-s04.spec.ts`, `story-e16-s05.spec.ts` | Full | High |
| **ImportedCourseDetail** (`ImportedCourseDetail.tsx`) | `__tests__/ImportedCourseDetail.test.tsx` (12 tests) | `e01-s06-delete-imported-course.spec.ts`, `story-e01-s05.spec.ts`, `story-2-5.spec.ts` | Full | High |
| **ImportedLessonPlayer** (`ImportedLessonPlayer.tsx`) | `__tests__/ImportedLessonPlayer.test.tsx` | `lesson-player-video.spec.ts`, `lesson-player-pdf.spec.ts`, `lesson-player-error-recovery.spec.ts`, `lesson-player-course-detail.spec.ts`, `story-e02-s02-video-controls.spec.ts` | Full | High |
| **LessonPlayer** (`LessonPlayer.tsx`) | None | `story-e02-s03.spec.ts`, `story-e02-s09.spec.ts`, `story-e02-s10.spec.ts`, `story-e03-s06.spec.ts` | Partial — E2E only, no unit test | High |
| **CourseDetail** (`CourseDetail.tsx`) | None | `story-2-6.spec.ts`, `story-e04-s04.spec.ts`, `story-3-11.spec.ts` | Partial — E2E only, no unit test | High |
| **CourseOverview** (`CourseOverview.tsx`) | None | None found | **None** | High |
| **Flashcards** (`Flashcards.tsx`) | None | `story-e23-s04.spec.ts` (navigation link only) | **None** — Flashcard store unit-tested in isolation | High |
| **ReviewQueue** (`ReviewQueue.tsx`) | None | `story-e11-s01.spec.ts`, `story-e11-s02.spec.ts`, `story-e11-s03.spec.ts`, `story-e11-s05.spec.ts` | Partial — E2E only | High |
| **RetentionDashboard** (`RetentionDashboard.tsx`) | None | `story-e11-s04.spec.ts`, `story-e11-s06.spec.ts` | Partial — E2E only | High |
| **InterleavedReview** (`InterleavedReview.tsx`) | None | `story-e04-s04.spec.ts` (partial, mentions interleaved) | Partial — shallow E2E | Medium |
| **SessionHistory** (`SessionHistory.tsx`) | None | `study-session-history.spec.ts`, `story-e21-s07.spec.ts` | Partial — E2E only | Medium |
| **ChatQA** (`ChatQA.tsx`) | None | `story-e09b-s01.spec.ts`, `story-e09b-s02.spec.ts` | Partial — E2E only, component isolated | Medium |
| **AILearningPath** (`AILearningPath.tsx`) | None | `story-e9b-s03.spec.ts` (3 E2E tests) | Partial — E2E only | Medium |
| **KnowledgeGaps** (`KnowledgeGaps.tsx`) | None | `story-e09b-s04.spec.ts` | Partial — E2E only | Medium |
| **Challenges** (`Challenges.tsx`) | None | `story-e06-s01.spec.ts`, `story-e06-s02.spec.ts`, `story-e06-s03.spec.ts`, `story-e10-s02.spec.ts` | Partial — E2E only | Medium |
| **CareerPaths** (`CareerPaths.tsx`) | None | `tests/e2e/regression/career-paths.spec.ts` (16 tests, full AC coverage) | Partial — no unit test, strong E2E | Medium |
| **CareerPathDetail** (`CareerPathDetail.tsx`) | None | `tests/e2e/regression/career-paths.spec.ts` | Partial — no unit test, strong E2E | Medium |
| **LearningPaths** (`LearningPaths.tsx`) | None | None found (sidebar navigation link only via `story-e25-s08`) | **None** | High |
| **LearningPathDetail** (`LearningPathDetail.tsx`) | None | None found | **None** | High |
| **YouTubeCourseDetail** (`YouTubeCourseDetail.tsx`) | None | `audit-screenshots.spec.ts` (screenshot only, no behavioral assertions) | **None** | High |
| **YouTubeLessonPlayer** (`YouTubeLessonPlayer.tsx`) | None | None found | **None** | High |
| **NotFound** (`NotFound.tsx`) | None | `story-e01-s05.spec.ts` (redirect behavior), `story-e02-s10.spec.ts` | Partial — render not tested | Low |

---

### Untested Critical Flows

**Zero coverage (no unit and no behavioral E2E test):**

1. **CourseOverview** (`/courses/:courseId/overview`) — Pre-lesson course summary page. No unit or E2E test of any kind. High risk: it is the entry point before the lesson player flow.

2. **LearningPaths** (`/learning-paths`) — CRUD interface for user-created learning paths (create, rename, delete, reorder, AI-generate). Only mentioned in sidebar navigation tests; no behavioral test validates the CRUD operations.

3. **LearningPathDetail** (`/learning-paths/:pathId`) — Drag-and-drop lesson reordering via `@dnd-kit`, AI-driven sequence generation. Complex interaction surface with zero test coverage.

4. **YouTubeLessonPlayer** (`/yt-courses/:courseId/lessons/:videoId`) — YouTube IFrame player with progress tracking, auto-complete, transcript panel, offline fallback, and study session logging. Implemented in E28-S09/S10; no E2E or unit tests.

5. **YouTubeCourseDetail** (`/yt-courses/:courseId`) — Chapter-structure detail page with metadata refresh, per-video progress bars, and removed-video badges. Implemented in E28-S12; screenshot-only test captures a pixel snapshot but asserts no behavior.

**Shallow coverage (E2E navigates to page, does not test page behavior):**

6. **AuthorProfile** (`/authors/:id`) — `story-e07-s02.spec.ts` navigates to the profile URL and checks a heading; the social links, course listings, and biography display are untested.

7. **Flashcards** (`/flashcards`) — The `useFlashcardStore` is unit-tested in isolation. The page itself (4 distinct phases: loading, dashboard, reviewing, summary) has no unit test and no E2E test exercising any phase transition.

8. **InterleavedReview** (`/interleaved-review`) — `story-e04-s04.spec.ts` checks the "review" concept broadly; the interleaved session phases (single-course-prompt, reviewing, summary), alert dialog, and shuffle are untested.

---

### Test Quality Summary

#### Selector Quality

The majority of E2E tests use `data-testid` attributes and ARIA role selectors, which is correct. There are isolated instances of CSS class-based selectors in older specs:

- `/tests/e2e/regression/story-3-12.spec.ts` and `story-3-13.spec.ts` use `.tiptap` and `.ProseMirror` class selectors (8+ occurrences). These are acceptable given that TipTap editor does not expose `data-testid` on its contenteditable element; however, they will break if the editor library changes.
- `/tests/e2e/reports-redesign.spec.ts` uses `.overflow-x-auto` and `.min-w-[480px]` class selectors (lines 142, 146). These are structural selectors coupled to Tailwind utility classes and should be replaced with `data-testid` on the chart containers.
- `/tests/e2e/overview-card-enhancements.spec.ts` uses a chained parent traversal (`locator('..')`) to locate the streak section container. Fragile; a `data-testid` on the section container would remove the structural dependency.

#### Hard-Wait Anti-Patterns

`/tests/e2e/overview-card-enhancements.spec.ts` contains 7 calls to `page.waitForTimeout()` (lines 169, 192, 203, 218, 229, 297, 306) with values of 200–500 ms. None have the required justification comment format required by the `test-patterns/no-hard-waits` ESLint rule. These create artificial flakiness risk and increase total test run time.

`/tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts` uses two 2000ms waits (lines 67, 74). These are timing-sensitive by nature (Pomodoro timer), but `page.clock` mocking via `page.clock.tick()` would be more deterministic than real-time sleeps.

#### Test Isolation

All unit tests in `src/app/pages/__tests__/` properly use `beforeEach`/`afterEach` to reset Zustand store state via `setState`. No shared mutable module-level state was found that persists across tests.

E2E tests use isolated Playwright browser contexts (no shared state between test files). Tests that require IndexedDB data use `seedIndexedDBStore` from `tests/support/helpers/seed-helpers.ts` rather than manual `page.evaluate()` calls. This is the correct pattern.

#### Factory Usage

The E2E factory layer (`tests/support/fixtures/factories/`) is well-structured. Quiz, course, note, session, and review factories all exist and produce realistic data with `FIXED_DATE` timestamps for determinism.

Unit tests in `src/app/pages/__tests__/` do not use the shared factories; they define inline fixtures (e.g., `Overview.test.tsx:122` uses `id: 'test-course-1'`). This is a pattern inconsistency — the E2E layer has factories while the unit layer builds test data ad-hoc. For the simpler pages (Overview, MyClass, Notes) this is acceptable given that the inline data is fully typed. However, `Courses.test.tsx` embeds `ImportedCourse` inline objects that duplicate the shape of `imported-course-factory.ts`; those should be unified.

#### Assertion Quality

Unit tests for `QuizResults.test.tsx` and `ImportedCourseDetail.test.tsx` have high assertion quality: they test observable outcomes (badge text, link href, improvement delta values) rather than implementation details. The `QuizResults` tests in particular cover edge cases systematically (1 attempt, regression, equal score, multiple prior attempts).

`Reports.test.tsx` has one weak assertion: `expect(container).toBeTruthy()` (line 246). A truthy container proves only that React did not throw, not that the page rendered meaningful content. The subsequent test on line 254 (`expect(screen.getByText('Reports')).toBeInTheDocument()`) provides the actual render assertion, making the first test redundant.

`MyClass.test.tsx` has only 4 tests and 2 of them assert the same heading (lines 88–94). The tab content (By Status, All Courses, By Category, By Difficulty), empty states per tab, and course card rendering are untested.

---

### Recommendations

**Priority 1 — Highest-traffic unrouted flows (add tests immediately):**

1. **YouTubeLessonPlayer** — Add `tests/e2e/regression/story-e28-s09-youtube-player.spec.ts`. Seed a `YouTubeCourse` record and an `ImportedVideo` with `sourceType: 'youtube'` in IndexedDB. Assert: player renders, progress polling triggers `contentProgress` update, manual completion toggle changes badge, offline fallback renders `WifiOff` when `navigator.onLine` is mocked to `false`. Add a unit test `src/app/pages/__tests__/YouTubeLessonPlayer.test.tsx` mocking `YouTubePlayer`, `TranscriptPanel`, and `useIdleDetection`.

2. **YouTubeCourseDetail** — Add `tests/e2e/regression/story-e28-s12-youtube-course-detail.spec.ts`. Seed a YouTube course with chapters and at least one `contentProgress` record. Assert: chapter structure renders, per-video progress bar reflects seeded progress, "Refresh metadata" button triggers `refreshCourseMetadata`, offline badge appears when offline.

3. **LearningPaths + LearningPathDetail** — Add `tests/e2e/regression/story-e26-learning-paths.spec.ts`. Assert: empty state when no paths, create dialog opens and creates a record, path appears in list, navigating to detail shows the course sequence, drag-and-drop reorder persists after reload.

4. **CourseOverview** — Add `tests/e2e/regression/course-overview.spec.ts`. Seed a static course and navigate to `/courses/:courseId/overview`. Assert: heading shows course title, lesson count is displayed, "Start Course" button navigates to the first lesson.

**Priority 2 — Strengthen shallow-covered pages:**

5. **Flashcards** — Add `src/app/pages/__tests__/Flashcards.test.tsx`. Mock `useFlashcardStore` to exercise: loading skeleton (phase `loading`), dashboard with stats (phase `dashboard`), reviewing mode with a card showing front/back (phase `reviewing`), summary screen (phase `summary`). E2E test via `story-e23-s04.spec.ts` should be augmented to navigate to `/flashcards` and assert dashboard stats render.

6. **MyClass** — Add tests for each tab (By Status, All Courses, By Category, By Difficulty) showing the correct course groupings and empty state per tab when no courses match.

7. **Quiz** — Add `src/app/pages/__tests__/Quiz.test.tsx` to cover the pre-quiz start screen (question count, timer display, Start button), answer selection, navigation between questions, and submit confirmation.

8. **LessonPlayer / CourseDetail** — Add unit tests for the loading skeleton, 404 state for missing course/lesson, and the progression controls (Previous/Next lesson links).

**Priority 3 — Test quality fixes:**

9. **Replace class selectors** in `reports-redesign.spec.ts` (lines 142, 146): add `data-testid="chart-scroll-container"` to the chart container in `Reports.tsx`, then use `getByTestId` in the test.

10. **Remove hard waits** in `overview-card-enhancements.spec.ts`: replace all `waitForTimeout()` calls with `await expect(locator).toBeVisible()` or `await expect(locator).toHaveAttribute(...)` assertions using Playwright's built-in retry mechanism.

11. **Consolidate Courses unit test inline data** with `imported-course-factory.ts`: replace the 15+ inline `ImportedCourse` literals in `Courses.test.tsx` with `createImportedCourse(overrides)` calls.

12. **Remove duplicate assertion** in `Reports.test.tsx` line 246 (`expect(container).toBeTruthy()`).

---

### Coverage Totals

| Layer | Tested | Total | Coverage |
|---|---|---|---|
| Pages with any test | 27 | 32 | 84% |
| Pages with unit test | 11 | 32 | 34% |
| Pages with behavioral E2E | 24 | 32 | 75% |
| Pages with both unit + E2E | 10 | 32 | 31% |
| Pages with zero coverage | 5 | 32 | — |

**Zero-coverage pages:** `CourseOverview`, `LearningPaths`, `LearningPathDetail`, `YouTubeLessonPlayer`, `YouTubeCourseDetail`

**Lib/store unit test coverage** is excellent: 120+ unit test files cover the business logic layer (spaced repetition, quiz scoring, analytics, study sessions, YouTube pipeline, AI/RAG stack).

---

ACs: N/A (full-app audit, no story ACs) | Pages: 32 total | Zero coverage: 5 | Shallow coverage: 8 | Full coverage: 19 | Quality findings: 12 | Blockers: 0 | High: 4 | Medium: 8 | Nits: 3
