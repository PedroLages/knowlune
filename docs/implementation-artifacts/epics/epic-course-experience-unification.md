# Epic: Course Experience Unification

## Overview

Knowlune currently maintains three parallel course systems (regular/dead, imported/local, YouTube) with separate routes, TypeScript types, Zustand stores, and feature sets. The regular course system is entirely dead code (~1,754 lines) cleared on every app startup, yet it occupies the `/courses/` route namespace and contains feature implementations (notes panel, prev/next nav, breadcrumbs) that the live imported and YouTube players lack.

This epic eliminates the dead code, unifies all course routes under `/courses/:courseId`, builds an adapter layer for source-agnostic data access, and brings feature parity (notes, navigation, breadcrumbs, PDF viewer, quiz wiring) to the unified player. The result is a single course detail page, a single lesson player, and one URL family for all course content.

**PRD:** `docs/planning-artifacts/prd-course-experience-unification.md`
**Architecture:** `docs/planning-artifacts/bmad-architecture-course-unification-ai-models.md`

## Stories

### Story 1: Remove Dead Regular Course Infrastructure

- **ID:** E89-S01
- **Points:** 3
- **Priority:** P0
- **Dependencies:** none
- **Summary:** Delete all dead code related to the unused `Course` type system (~1,754 lines), including page components, store, routes, Dexie table, and the `db.courses.clear()` startup call. Extract reusable component patterns from `LessonPlayer.tsx` as reference notes before deletion.
- **Acceptance Criteria:**
  - AC1: Given `CourseDetail.tsx` (193 lines), `CourseOverview.tsx` (447 lines), `LessonPlayer.tsx` (1,088 lines), and `useCourseStore.ts` (26 lines) are deleted, when `npm run build` runs, then the build succeeds with zero errors.
  - AC2: Given the `Course` interface (lines 92-109 in `types.ts`) is deleted, when grepping the codebase for `Course` type usage (excluding `ImportedCourse`, `CourseSource`, etc.), then zero references remain in production source files.
  - AC3: Given the `db.courses.clear()` call is removed from `main.tsx`, when the app starts, then no Dexie clear operation runs for a non-existent table.
  - AC4: Given a Dexie v30 migration is added with `courses: null`, when an existing user upgrades, then the dead `courses` table is dropped without error and all `importedCourses`, `importedVideos`, `importedPdfs`, `notes`, `progress`, `bookmarks`, and `studySessions` records survive intact.
  - AC5: Given the dead page-level routes for `/courses/:courseId/overview`, `/courses/:courseId`, and `/courses/:courseId/:lessonId` are removed from `routes.tsx`, when navigating to those paths, then a 404 page renders. **Note:** Quiz sub-routes (`/courses/:courseId/lessons/:lessonId/quiz/*`) are KEPT alive (not deleted) — they are re-wired in S09. Only the dead page component bindings (CourseDetail, CourseOverview, LessonPlayer) are removed.
  - AC6: Given `LessonPlayer.tsx` contained notes panel, prev/next nav, and breadcrumb patterns, when this story completes, then the architecture doc section A4 (`docs/planning-artifacts/bmad-architecture-course-unification-ai-models.md`) is sufficient as the extraction reference — no separate document is needed.
  - AC7: All existing E2E tests pass after deletion.
- **Key Files:**
  - DELETE: `src/app/pages/CourseDetail.tsx`, `src/app/pages/CourseOverview.tsx`, `src/app/pages/LessonPlayer.tsx`, `src/stores/useCourseStore.ts`, `src/stores/__tests__/useCourseStore.test.ts`
  - MODIFY: `src/data/types.ts` (remove `Course` interface lines 92-109), `src/main.tsx` (remove `db.courses.clear()`), `src/app/routes.tsx` (remove dead routes + lazy imports), `src/db/schema.ts` (add v30 migration, remove `courses` table), `src/db/checkpoint.ts` (remove `courses` entry)
  - REFERENCE: `docs/planning-artifacts/bmad-architecture-course-unification-ai-models.md` (section A4 — extraction patterns)
- **Technical Notes:** Follow the dead code dependency graph from the architecture doc (A3). Grep every import/reference before deleting. The `ModuleAccordion.tsx` component is only used by dead `LessonPlayer.tsx` — delete it if no live code references it. Run the full Dexie migration chain test (`schema-checkpoint.test.ts`) to validate v30.

---

### Story 2: Create Unified Course Adapter Layer

- **ID:** E89-S02
- **Points:** 3
- **Priority:** P0
- **Dependencies:** E89-S01
- **Summary:** Create a `CourseAdapter` interface with `LocalCourseAdapter` and `YouTubeCourseAdapter` implementations that provide source-agnostic access to course data, plus a factory function and a React hook for consuming adapters in components.
- **Acceptance Criteria:**
  - AC1: Given a `CourseAdapter` interface is defined in `src/lib/courseAdapter.ts`, when inspecting the interface, then it exposes `getCourse()`, `getSource()`, `getLessons()`, `getMediaUrl(lessonId)`, `getTranscript(lessonId)`, `getThumbnailUrl()`, and `getCapabilities()`.
  - AC2: Given `LessonItem` is defined, when a lesson is normalized, then it includes `id`, `title`, `type` (`'video' | 'pdf'`), `duration`, `order`, and optional `sourceMetadata`.
  - AC3: Given `ContentCapabilities` is defined, when queried, then it declares `hasVideo`, `hasPdf`, `hasTranscript`, `supportsNotes`, `supportsQuiz`, `supportsPrevNext`, and `supportsBreadcrumbs` per source.
  - AC4: Given a `LocalCourseAdapter` is created for a local course, when `getLessons()` is called, then it returns a normalized list combining `importedVideos` and `importedPdfs` sorted by order.
  - AC5: Given a `YouTubeCourseAdapter` is created for a YouTube course, when `getMediaUrl(lessonId)` is called, then it returns the YouTube embed URL (not a blob URL).
  - AC6: Given a `createCourseAdapter(course)` factory function, when passed an `ImportedCourse` with `source: 'youtube'`, then it returns a `YouTubeCourseAdapter`; when passed one with `source: undefined` or `source: 'local'`, then it returns a `LocalCourseAdapter`.
  - AC7: Given a `useCourseAdapter(courseId)` hook, when a component calls it, then it loads the course from Dexie, creates the adapter, and returns `{ adapter, loading, error }`.
  - AC8: Unit tests cover both adapter implementations with mock Dexie data.
- **Key Files:**
  - CREATE: `src/lib/courseAdapter.ts`, `src/hooks/useCourseAdapter.ts`, `src/lib/__tests__/courseAdapter.test.ts`
  - MODIFY: none (adapters read from existing Dexie tables without modifying them)
- **Technical Notes:** Adapters are thin data mappers — no heavy computation. `LocalCourseAdapter.getMediaUrl()` reads from `FileSystemFileHandle` and creates a blob URL. `YouTubeCourseAdapter.getMediaUrl()` constructs `https://www.youtube.com/embed/{videoId}`. Follow the interface design from architecture doc section A1.

---

### Story 3: Consolidate Routes with Redirects

- **ID:** E89-S03
- **Points:** 3
- **Priority:** P0
- **Dependencies:** E89-S02
- **Summary:** Consolidate all course routes under `/courses/:courseId` and `/courses/:courseId/lessons/:lessonId`, add redirect routes from old `/imported-courses/*` and `/youtube-courses/*` paths, and update all internal `<Link>` components across the codebase.
- **Acceptance Criteria:**
  - AC1: Given unified routes exist at `/courses/:courseId` (detail) and `/courses/:courseId/lessons/:lessonId` (player), when navigating to either, then the correct unified page component renders.
  - AC2: Given redirect routes for all 4 old URL patterns (`/imported-courses/:courseId`, `/imported-courses/:courseId/lessons/:lessonId`, `/youtube-courses/:courseId`, `/youtube-courses/:courseId/lessons/:lessonId`), when navigating to any old path, then the browser redirects to the corresponding `/courses/` path using `<Navigate replace />`.
  - AC3: Given all internal `<Link>` components in the codebase, when grepping for `/imported-courses/` or `/youtube-courses/` in non-redirect `.tsx` files, then zero occurrences are found.
  - AC4: Given quiz routes are kept under `/courses/:courseId/lessons/:lessonId/quiz`, when navigating to quiz paths, then quizzes render correctly.
  - AC5: Given redirect routes include `// TODO: Remove redirect after Epic E91+` comments, when reviewing the code, then cleanup intent is documented.
  - AC6: All E2E tests are updated to use new `/courses/` URL patterns and pass.
- **Key Files:**
  - MODIFY: `src/app/routes.tsx` (replace imported/youtube route entries with redirects, add unified routes), all `.tsx` files containing `/imported-courses/` or `/youtube-courses/` link paths (estimated ~15-20 files based on grep), all E2E `.spec.ts` files referencing old URL patterns
  - CREATE: Redirect wrapper components (inline in `routes.tsx` or separate file)
- **Technical Notes:** Use the `InstructorProfileRedirect` pattern already in `routes.tsx` as a reference for redirect wrapper components. The unified routes should render placeholder components initially (can render existing `ImportedCourseDetail`/`ImportedLessonPlayer` via adapter detection) — full unified pages come in S04/S05. Comprehensive grep for old paths across `.tsx` and `.spec.ts` files is critical.

---

### Story 4: Build Unified CourseDetail Page

- **ID:** E89-S04
- **Points:** 5
- **Priority:** P1
- **Dependencies:** E89-S03
- **Summary:** Build `UnifiedCourseDetail` page that replaces both `ImportedCourseDetail` (553 lines) and `YouTubeCourseDetail` (470 lines), using the adapter layer for source-agnostic rendering of course metadata, lesson lists, and course management actions.
- **Acceptance Criteria:**
  - AC1: Given a local course exists, when navigating to `/courses/:courseId`, then the unified detail page renders course name, description, tags, author info, lesson list with video/PDF items, and course thumbnail.
  - AC2: Given a YouTube course exists, when navigating to `/courses/:courseId`, then the unified detail page renders course name, YouTube channel info, lesson list with video items, and YouTube thumbnail.
  - AC3: Given the lesson list is rendered, when a video item is clicked, then navigation goes to `/courses/:courseId/lessons/:lessonId`.
  - AC4: Given the lesson list is rendered, when a PDF item is clicked, then navigation goes to `/courses/:courseId/lessons/:lessonId` (PDF viewer page).
  - AC5: Given a local course with videos in subdirectories, when viewing the lesson list, then videos are grouped by folder with collapsible folder headers (reusing existing `ImportedCourseDetail` folder grouping logic).
  - AC6: Given course management actions (edit title, edit tags, delete course), when performed, then they work identically for local and YouTube courses via the existing store methods.
  - AC7: Given the page replaces two existing pages, when comparing behavior, then all 10 functions are preserved: (1) file status badges, (2) search/filter input, (3) permissions re-grant prompt for local courses, (4) delete course action, (5) edit title inline, (6) edit tags, (7) thumbnail display, (8) video/PDF count display, (9) folder grouping for local courses, (10) YouTube channel info for YouTube courses.
  - AC8: The unified page component does not exceed 300 lines (uses composition with extracted sub-components).
- **Key Files:**
  - CREATE: `src/app/pages/UnifiedCourseDetail.tsx`, supporting sub-components as needed (e.g., `src/app/components/course/LessonList.tsx`, `src/app/components/course/CourseHeader.tsx`)
  - MODIFY: `src/app/routes.tsx` (point `/courses/:courseId` to `UnifiedCourseDetail`)
- **Technical Notes:** Extract shared patterns from `ImportedCourseDetail.tsx` (553 lines) and `YouTubeCourseDetail.tsx` (470 lines). Source-specific behavior (file status verification for local, YouTube metadata for YouTube) lives in the adapter or adapter-aware sub-components. The unified component must never check `course.source` directly — all branching goes through `adapter.getCapabilities()`.

---

### Story 5: Build Unified LessonPlayer Page (Video Playback)

- **ID:** E89-S05
- **Points:** 5
- **Priority:** P1
- **Dependencies:** E89-S03
- **Summary:** Build `UnifiedLessonPlayer` page that replaces both `ImportedLessonPlayer` (264 lines) and `YouTubeLessonPlayer` (407 lines), with adapter-driven media resolution, local video player and YouTube iframe embed, resizable panel layout, and mobile sheet fallback.
- **Acceptance Criteria:**
  - AC1: Given a local video lesson, when navigating to `/courses/:courseId/lessons/:lessonId`, then the unified player renders the `VideoPlayer` component with a blob URL from `FileSystemFileHandle`.
  - AC2: Given a YouTube video lesson, when navigating to `/courses/:courseId/lessons/:lessonId`, then the unified player renders a YouTube iframe embed using the adapter's media URL.
  - AC3: Given the player is on a desktop viewport, when the page renders, then a `ResizablePanelGroup` layout shows the video in the main panel and a side panel placeholder (tabs populated in S07).
  - AC4: Given the player is on a mobile viewport, when the user taps the side panel trigger, then a `Sheet` (bottom drawer) opens with the panel content.
  - AC5: Given session tracking exists in both current players, when the unified player mounts and the user watches >30 seconds of video, then a `StudySession` record exists in IndexedDB with `duration > 0` (reusing `useSessionStore` and `useIdleDetection`).
  - AC6: Given video progress tracking exists, when the user watches a video, then progress is saved to IndexedDB (reusing existing progress hooks).
  - AC7: Given the player handles error states (missing file, permission denied, video not found), when an error occurs, then appropriate error UI renders with retry/re-grant options.
  - AC8: Given a local course whose directory handle permissions have been revoked, when the unified player loads, then a re-grant permission prompt renders with a button that triggers `requestPermission()` on the handle, and upon granting, the video loads without page refresh.
  - AC9: The unified page component does not exceed 300 lines.
- **Key Files:**
  - CREATE: `src/app/pages/UnifiedLessonPlayer.tsx`, supporting sub-components as needed
  - MODIFY: `src/app/routes.tsx` (point `/courses/:courseId/lessons/:lessonId` to `UnifiedLessonPlayer`)
- **Technical Notes:** The adapter's `getMediaUrl()` returns either a blob URL (local) or YouTube embed URL (YouTube). The player component uses `adapter.getCapabilities().hasVideo` to decide which player to render. Reuse `useVideoFromHandle` hook for local courses and `YouTubePlayer` component for YouTube courses. Caption/transcript loading should go through the adapter.

---

### Story 6: Add PDF Inline Viewer to Unified Player

- **ID:** E89-S06
- **Points:** 3
- **Priority:** P1
- **Dependencies:** E89-S05
- **Summary:** Support PDF content items within the unified lesson player. When a lesson item has `type: 'pdf'`, render a PDF viewer instead of the video player, with page navigation, zoom, and scroll support.
- **Acceptance Criteria:**
  - AC1: Given a lesson item with `type: 'pdf'` in a local course, when navigating to `/courses/:courseId/lessons/:lessonId`, then a PDF viewer renders instead of the video player.
  - AC2: Given the PDF viewer is rendered, when interacting with it, then page navigation (prev/next page, page number input), zoom (in/out/reset), and scroll work correctly.
  - AC3: Given a PDF is displayed, when the side panel is also visible, then the `ResizablePanelGroup` layout accommodates both PDF viewer and side panel (notes tab available alongside PDF).
  - AC4: Given a course with mixed video and PDF lessons, when using prev/next navigation (from S08), then transitions between video and PDF lessons work seamlessly.
  - AC5: Given the PDF `FileSystemFileHandle`, when permissions are revoked, then an appropriate error state renders with a re-grant option.
  - AC6: The PDF viewer is keyboard-navigable (arrow keys for page turn, +/- for zoom) and meets WCAG 2.1 AA requirements.
- **Key Files:**
  - CREATE: `src/app/components/course/PdfViewer.tsx`
  - MODIFY: `src/app/pages/UnifiedLessonPlayer.tsx` (add PDF rendering branch based on `lesson.type`)
- **Technical Notes:** Use a lightweight PDF rendering approach — either `<iframe>` with blob URL for simple viewing, or a library like `react-pdf` (pdfjs-dist) for full controls. The adapter's `getMediaUrl()` for PDF lessons should return a blob URL from the `FileSystemFileHandle`. Consider lazy-loading the PDF viewer component to avoid bundle size impact for video-only users.

---

### Story 7: Add Notes Panel to Unified Video Player

- **ID:** E89-S07
- **Points:** 3
- **Priority:** P1
- **Dependencies:** E89-S05
- **Summary:** Integrate the existing `NoteEditor` component into the unified lesson player as part of a tabbed side panel with Notes, Transcript, AI Summary, and Bookmarks tabs. The panel renders as a resizable side panel on desktop and a Sheet on mobile.
- **Acceptance Criteria:**
  - AC1: Given the unified player's side panel, when it renders on desktop, then a tabbed interface shows Notes, Transcript, AI Summary, and Bookmarks tabs within the `ResizablePanelGroup`.
  - AC2: Given the Notes tab is active, when the user types, then notes are persisted to IndexedDB using the existing `courseId + videoId` key pattern via `NoteEditor`.
  - AC3: Given the Transcript tab is active, when viewing a local video with captions, then the transcript displays using existing `TranscriptPanel`. For YouTube videos, the transcript loads via the adapter's `getTranscript()`.
  - AC4: Given the Bookmarks tab is active, when viewing bookmarks, then the existing `BookmarksSection` component renders with video bookmarks for the current lesson.
  - AC5: Given the panel is on a mobile viewport, when the user taps the panel trigger, then tabs render inside a `Sheet` (bottom drawer).
  - AC6: Notes panel works identically for local and YouTube courses (verified by manual testing or E2E for both sources).
  - AC7: The Notes tab is the default active tab when the panel opens.
- **Key Files:**
  - MODIFY: `src/app/pages/UnifiedLessonPlayer.tsx` (populate side panel tabs)
  - CREATE: `src/app/components/course/PlayerSidePanel.tsx` (extracted tabbed panel component)
  - REUSE: `src/app/components/notes/NoteEditor.tsx`, `src/app/components/figma/TranscriptPanel.tsx`, `src/app/components/figma/AISummaryPanel.tsx`, `src/app/components/figma/BookmarksSection.tsx`
- **Technical Notes:** Reference the extraction notes from S01 (`docs/plans/lesson-player-extraction-notes.md`) for the dead `LessonPlayer.tsx` tab layout pattern. The `NoteEditor` is already standalone. `TranscriptPanel` may need a minor update to accept transcript source from the adapter instead of assuming local file. Keep the `PlayerSidePanel` component under 200 lines.

---

### Story 8: Add Prev/Next Video Navigation and Breadcrumbs

- **ID:** E89-S08
- **Points:** 3
- **Priority:** P1
- **Dependencies:** E89-S05
- **Summary:** Add prev/next lesson navigation buttons within the unified player using a `useLessonNavigation` hook, integrate `AutoAdvanceCountdown` for auto-advance after lesson completion, and add a `CourseBreadcrumb` component to both the detail and player pages.
- **Acceptance Criteria:**
  - AC1: Given a `useLessonNavigation(courseId, lessonId)` hook, when called, then it returns `{ prevLesson, nextLesson, currentIndex, totalLessons }` using the adapter's `getLessons()`.
  - AC2: Given prev/next buttons render in the player, when on the first lesson, then "Previous" is disabled; when on the last lesson, then "Next" is disabled.
  - AC3: Given the user clicks "Next", when the next lesson exists, then navigation goes to `/courses/:courseId/lessons/:nextLessonId` without full page reload.
  - AC4: Given a lesson completes (the HTML5 video element fires the `ended` event, or YouTube player fires `onStateChange` with state `0`), when auto-advance is enabled, then the existing `AutoAdvanceCountdown` component triggers and navigates to the next lesson.
  - AC5: Given a `CourseBreadcrumb` component, when rendered on the player page, then it shows `Courses > [Course Name] > [Lesson Title]` with "Courses" linking to `/courses` and course name linking to `/courses/:courseId`.
  - AC6: Given long course or lesson names in the breadcrumb, when they exceed available space, then they truncate with ellipsis and show full text in a tooltip.
  - AC7: Given the breadcrumb renders on `UnifiedCourseDetail`, then it shows `Courses > [Course Name]` (lesson segment omitted).
  - AC8: Prev/next buttons have `aria-label` attributes indicating the target lesson name (e.g., `aria-label="Next: Lesson 3 - Advanced Topics"`).
- **Key Files:**
  - CREATE: `src/app/hooks/useLessonNavigation.ts`, `src/app/components/course/CourseBreadcrumb.tsx`, `src/app/components/course/LessonNavigation.tsx`
  - MODIFY: `src/app/pages/UnifiedLessonPlayer.tsx` (add nav buttons and breadcrumb), `src/app/pages/UnifiedCourseDetail.tsx` (add breadcrumb)
  - REUSE: `src/app/components/figma/AutoAdvanceCountdown.tsx`, `src/app/components/celebrations/CompletionModal.tsx`
- **Technical Notes:** Reference the extraction notes from S01 for the dead `LessonPlayer.tsx` prev/next logic. Use shadcn `Breadcrumb` component as the base. The `useLessonNavigation` hook should consume the adapter's `getLessons()` and memoize the result. Navigation uses React Router's `navigate()` for SPA transitions.

---

### Story 9: Wire Quiz System to Unified Course IDs

- **ID:** E89-S09
- **Points:** 2
- **Priority:** P2
- **Dependencies:** E89-S05, E89-S03
- **Summary:** Connect quiz functionality to the unified course routes so quizzes are accessible from the unified player via a "Take Quiz" button, and verify quiz data compatibility with unified route IDs.
- **Acceptance Criteria:**
  - AC1: Given the unified player renders a lesson, when a "Take Quiz" button is clicked, then navigation goes to `/courses/:courseId/lessons/:lessonId/quiz`.
  - AC2: Given the quiz page at `/courses/:courseId/lessons/:lessonId/quiz`, when it loads, then it resolves the course and lesson via the adapter layer (or directly from Dexie using the same IDs).
  - AC3: Given quiz results are stored by `courseId + lessonId`, when accessed from the unified route, then existing quiz data is compatible without any data migration.
  - AC4: Given quiz results and review pages, when navigated to under `/courses/:courseId/lessons/:lessonId/quiz/results` and `/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId`, then they render correctly.
  - AC5: Given the adapter's `getCapabilities().supportsQuiz` returns true, when the capability is true, then the "Take Quiz" button is visible in the player; when false, then it is hidden.
- **Key Files:**
  - MODIFY: `src/app/pages/UnifiedLessonPlayer.tsx` (add "Take Quiz" button), `src/app/pages/Quiz.tsx` (verify adapter compatibility), `src/app/pages/QuizResults.tsx` (verify route params), `src/app/pages/QuizReview.tsx` (verify route params)
- **Technical Notes:** Quiz routes already exist under `/courses/:courseId/lessons/:lessonId/quiz` from the dead system and were kept during S01. The main work is wiring the "Take Quiz" button in the unified player and verifying that quiz pages resolve data correctly with imported course IDs. No quiz data migration should be needed since quizzes store by courseId + lessonId which remain unchanged.

---

### Story 10: Fix Video Reorder Dialog — Folder Grouping and Correct Ordering

- **ID:** E89-S10
- **Points:** 3
- **Priority:** P2
- **Dependencies:** E89-S04
- **Summary:** Enhance the video reorder dialog in the unified course detail page to group videos by folder (local courses) or chapter (YouTube courses), with drag-and-drop reordering within and across groups.
- **Acceptance Criteria:**
  - AC1: Given a local course with videos in subdirectories, when the reorder dialog opens, then videos are visually grouped by their parent folder with folder name headers.
  - AC2: Given a YouTube course with chapters, when the reorder dialog opens, then videos are grouped by chapter with chapter name headers.
  - AC3: Given the reorder dialog with grouped videos, when drag-and-drop is used within a group, then items reorder correctly and the new order persists to IndexedDB.
  - AC4: Given the reorder dialog with grouped videos, when drag-and-drop is used across groups, then items move between groups and the order updates correctly.
  - AC5: Given the reorder dialog, when the order is saved, then the lesson list on the detail page reflects the new order immediately.
  - AC6: Group headers display the folder/chapter name and the count of items in each group.
- **Key Files:**
  - MODIFY: existing reorder dialog component (likely in `ImportedCourseDetail.tsx` patterns, migrated to `UnifiedCourseDetail.tsx` sub-component)
  - CREATE: `src/app/components/course/VideoReorderDialog.tsx` (if not already extracted)
- **Technical Notes:** The `getFolderName()` utility already exists in `ImportedCourseDetail.tsx`. For YouTube courses, grouping uses the `chapters` field from `ImportedVideo`. Use the existing drag-and-drop library (likely `@dnd-kit` or native HTML DnD) already in use for reordering. Start with within-group and cross-group DnD per FR-7.2 of the PRD.

---

### Story 11: Delete Old Page Components and Remove Redirect Shims

- **ID:** E89-S11
- **Points:** 2
- **Priority:** P3
- **Dependencies:** E89-S04, E89-S05, E89-S06, E89-S07, E89-S08, E89-S09, E89-S10
- **Summary:** Delete the old page components (`ImportedCourseDetail.tsx`, `ImportedLessonPlayer.tsx`, `YouTubeCourseDetail.tsx`, `YouTubeLessonPlayer.tsx`) now that the unified pages fully replace them, and validate the complete migration with a full E2E test pass.
- **Acceptance Criteria:**
  - AC1: Given `ImportedCourseDetail.tsx` (553 lines), `ImportedLessonPlayer.tsx` (264 lines), `YouTubeCourseDetail.tsx` (470 lines), and `YouTubeLessonPlayer.tsx` (407 lines) are deleted, when `npm run build` runs, then the build succeeds with zero errors.
  - AC2: Given the lazy imports for deleted pages are removed from `routes.tsx`, when inspecting the route configuration, then only unified page imports remain for course routes.
  - AC3: Given redirect routes (`/imported-courses/*`, `/youtube-courses/*`) are kept (NOT removed in this story — they stay for 2 epics per NFR-3.1), when navigating to old paths, then redirects still work.
  - AC4: Given all old page components are removed, when grepping for `ImportedCourseDetail`, `ImportedLessonPlayer`, `YouTubeCourseDetail`, `YouTubeLessonPlayer` in `.tsx` files, then zero non-doc references remain.
  - AC5: Given the full E2E test suite runs, when all tests execute, then 100% pass rate with no regressions.
  - AC6: Given the deletion removes ~1,694 lines of old page code, when combined with S01's ~1,754 lines, then the total dead/duplicate code removed is ~3,448 lines.
- **Key Files:**
  - DELETE: `src/app/pages/ImportedCourseDetail.tsx`, `src/app/pages/ImportedLessonPlayer.tsx`, `src/app/pages/YouTubeCourseDetail.tsx`, `src/app/pages/YouTubeLessonPlayer.tsx`
  - MODIFY: `src/app/routes.tsx` (remove lazy imports for deleted pages, keep redirect routes)
- **Technical Notes:** This is a cleanup story that should only be executed after all unified pages (S04-S10) are complete and validated. The redirect routes from S03 remain in place per NFR-3.1 (kept for 2 epics). Run the full E2E suite including smoke tests before and after deletion to catch any regressions. Check for any test files that import deleted page components.
