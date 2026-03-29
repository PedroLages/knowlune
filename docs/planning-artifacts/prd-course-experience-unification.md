# PRD: Course Experience Unification

**Epic:** A — Course Experience Unification
**Date:** 2026-03-29
**Author:** Claude (BMad Product Manager)
**Status:** Draft
**Inputs:** Brainstorming doc, Architecture doc, Domain research

---

## 1. Overview & Problem Statement

Knowlune currently maintains three parallel course systems with separate routes, TypeScript types, Zustand stores, and feature sets:

| System | Route Family | Store | Status |
|--------|-------------|-------|--------|
| Regular Courses | `/courses/:id` | `useCourseStore` | **Dead code** — `db.courses.clear()` runs on every app startup. ~3,000 lines of unreachable code. |
| Imported Courses | `/imported-courses/:id` | `useCourseImportStore` | Primary user-facing system. Missing notes panel, prev/next nav, breadcrumbs, quiz access. |
| YouTube Courses | `/youtube-courses/:id` | `useYouTubeImportStore` | Secondary user-facing system. Same feature gaps as imported courses. |

This fragmentation creates four concrete problems:

1. **Dead code confusion.** The `Course` type (types.ts:92-109), `useCourseStore`, `CourseDetail.tsx`, `CourseOverview.tsx`, and `LessonPlayer.tsx` (1,088 lines) are entirely unreachable but appear canonical. New contributors or AI agents may accidentally reference them.
2. **Feature disparity.** The dead `LessonPlayer.tsx` has a notes panel, prev/next navigation, breadcrumbs, and quiz access. The live `ImportedLessonPlayer.tsx` (264 lines) and `YouTubeLessonPlayer.tsx` (407 lines) have none of these. Users of the only working course systems get a degraded experience.
3. **Three URL families.** Users see `/courses/`, `/imported-courses/`, and `/youtube-courses/` for the same concept. Bookmarks, shared links, and E2E tests reference inconsistent paths.
4. **Triple maintenance burden.** Every new feature must be implemented in two live players (and potentially three route families). This multiplies development cost and bug surface.

---

## 2. Goals & Success Metrics

### Primary Goals

| # | Goal | Measurable Outcome |
|---|------|--------------------|
| G1 | Eliminate dead code | 0 references to `Course` type, `useCourseStore`, or dead route paths in the codebase. ~3,000 lines removed. |
| G2 | Unify all course types under a single route tree | All course URLs match `/courses/:courseId` or `/courses/:courseId/lessons/:lessonId`. Zero user-facing references to `/imported-courses/` or `/youtube-courses/`. |
| G3 | Achieve feature parity across course sources | Notes panel, prev/next navigation, breadcrumbs, and quiz access available for both local and YouTube courses. |
| G4 | Zero data loss during migration | 100% of existing imported courses, YouTube courses, videos, PDFs, notes, progress, and bookmarks survive the transition. Validated by automated migration test. |

### Success Metrics

| Metric | Baseline (Today) | Target (Post-Epic) | Measurement |
|--------|-------------------|---------------------|-------------|
| Unique route families for courses | 3 | 1 | Grep count in `routes.tsx` |
| Dead code lines (Course system) | ~3,000 | 0 | LOC count of deleted files |
| Feature coverage: notes in player | 0% of live courses | 100% | E2E test: notes panel renders for local + YouTube |
| Feature coverage: prev/next nav | 0% of live courses | 100% | E2E test: nav buttons render and navigate correctly |
| Feature coverage: breadcrumbs | 0% of live courses | 100% | E2E test: breadcrumb renders course > lesson path |
| Feature coverage: quiz access from player | 0% of live courses | 100% | E2E test: quiz button navigates to quiz page |
| Redirect coverage for old URLs | N/A | 100% of old patterns redirect | E2E test: all 4 old URL patterns redirect to `/courses/` |
| IndexedDB migration success rate | N/A | 100% | Unit test: Dexie v30 migration completes without error |

---

## 3. User Personas & Use Cases

### Persona 1: Self-Learner (Local Courses)

**Profile:** Imports course folders from local filesystem (video files + PDFs organized in directories). Uses Knowlune as their primary study dashboard.

**Current frustration:** Cannot take notes alongside video playback. Must manually track which lesson comes next. No breadcrumb context showing their position in the course.

**Use cases:**
- UC-1: Import a local course folder and view it at `/courses/:courseId`
- UC-2: Play a video lesson and take notes in a side panel without leaving the player
- UC-3: Navigate to the next/previous lesson using in-player buttons
- UC-4: See breadcrumb trail (Course Name > Lesson Title) while watching a lesson
- UC-5: Access quiz for the current lesson directly from the player

### Persona 2: Self-Learner (YouTube Courses)

**Profile:** Imports YouTube playlists as structured courses. Studies technical topics via YouTube lecture series.

**Current frustration:** Same feature gaps as local courses. Additionally, YouTube courses live at a different URL family (`/youtube-courses/`), creating a disjointed experience when switching between local and YouTube content.

**Use cases:**
- UC-6: Import a YouTube playlist and access it at `/courses/:courseId` (same URL pattern as local courses)
- UC-7: Watch YouTube lesson with notes panel, prev/next nav, and breadcrumbs (same UX as local courses)
- UC-8: Navigate from `/youtube-courses/:id` bookmark and be redirected to `/courses/:id`
- UC-9: Reorder lessons within the video reorder dialog, grouped by folder/chapter

### Persona 3: Returning User (Bookmarks)

**Profile:** Has bookmarks or saved links to `/imported-courses/` or `/youtube-courses/` URLs.

**Use cases:**
- UC-10: Click an old bookmark to `/imported-courses/:id` and arrive at the correct course via redirect
- UC-11: Click an old bookmark to `/youtube-courses/:id/lessons/:lessonId` and arrive at the correct lesson via redirect

---

## 4. Functional Requirements

### FR-1: Dead Code Removal

**Description:** Remove all code related to the dead `Course` system that is cleared on every app startup.

**Acceptance Criteria:**
- FR-1.1: Delete `CourseDetail.tsx`, `CourseOverview.tsx`, `LessonPlayer.tsx`, and `useCourseStore.ts` entirely.
- FR-1.2: Delete the `Course` interface from `types.ts` (lines 92-109).
- FR-1.3: Remove `db.courses.clear()` call from `main.tsx`.
- FR-1.4: Remove the dead `courses` table from the Dexie schema via a v30 migration (`courses: null`).
- FR-1.5: Remove all 6 dead route definitions for the old `/courses/*` paths from `routes.tsx`.
- FR-1.6: The app builds successfully (`npm run build`) and all existing E2E tests pass after deletion.
- FR-1.7: Before deletion, extract reusable component patterns (notes panel integration, prev/next navigation logic, breadcrumbs) from `LessonPlayer.tsx` as reference for FR-4.

### FR-2: Course Adapter Layer

**Description:** Create a `CourseAdapter` interface that provides source-agnostic access to course data, with `LocalCourseAdapter` and `YouTubeCourseAdapter` implementations.

**Acceptance Criteria:**
- FR-2.1: `CourseAdapter` interface exposes: `getCourse()`, `getSource()`, `getLessons()`, `getMediaUrl(lessonId)`, `getTranscript(lessonId)`, `getThumbnailUrl()`, `getCapabilities()`.
- FR-2.2: `LessonItem` normalizes lessons with `id`, `title`, `type`, `duration`, `order`, and optional `sourceMetadata`.
- FR-2.3: `ContentCapabilities` declares available features per source: `hasVideo`, `hasPdf`, `hasTranscript`, `supportsNotes`, `supportsQuiz`, `supportsPrevNext`, `supportsBreadcrumbs`.
- FR-2.4: `LocalCourseAdapter` reads from `importedCourses` + `importedVideos` + `importedPdfs` tables for `source: 'local'` courses.
- FR-2.5: `YouTubeCourseAdapter` reads from `importedCourses` + `importedVideos` tables for `source: 'youtube'` courses, handling YouTube-specific fields (playlist ID, channel, iframe embed URL).
- FR-2.6: Unified components consume adapters exclusively and never check `course.source` directly.
- FR-2.7: Adapter factory function creates the correct adapter based on `course.source` field.

### FR-3: Route Consolidation with Redirects

**Description:** Consolidate all course routes under `/courses/:courseId` with permanent redirects from old URL patterns.

**Acceptance Criteria:**
- FR-3.1: New unified routes: `/courses/:courseId` (detail) and `/courses/:courseId/lessons/:lessonId` (player).
- FR-3.2: Quiz routes re-parented under `/courses/:courseId/lessons/:lessonId/quiz`, `/quiz/results`, `/quiz/review/:attemptId`.
- FR-3.3: Redirect routes for all 4 old URL patterns:
  - `/imported-courses/:courseId` -> `/courses/:courseId`
  - `/imported-courses/:courseId/lessons/:lessonId` -> `/courses/:courseId/lessons/:lessonId`
  - `/youtube-courses/:courseId` -> `/courses/:courseId`
  - `/youtube-courses/:courseId/lessons/:lessonId` -> `/courses/:courseId/lessons/:lessonId`
- FR-3.4: Redirects use `<Navigate replace />` (client-side permanent redirect).
- FR-3.5: All internal `<Link>` components updated to use `/courses/` paths. Zero occurrences of `/imported-courses/` or `/youtube-courses/` in non-redirect `.tsx` files.
- FR-3.6: All E2E tests updated to use new URL patterns.
- FR-3.7: Redirect routes include a `// TODO: Remove redirect after Epic X+2` comment for future cleanup.

### FR-4: Notes Panel in Video Player

**Description:** Integrate the existing `NoteEditor` component into the unified lesson player as a resizable side panel.

**Acceptance Criteria:**
- FR-4.1: Notes panel renders in a `ResizablePanelGroup` alongside the video player on desktop viewports.
- FR-4.2: Notes panel renders as a `Sheet` (bottom drawer) on mobile viewports.
- FR-4.3: Notes are persisted to IndexedDB using the existing `courseId + videoId` key pattern.
- FR-4.4: Notes panel is part of a tabbed interface alongside Transcript, AI Summary, and Bookmarks tabs.
- FR-4.5: Notes panel works identically for local and YouTube courses (verified via E2E tests for both sources).

### FR-5: Prev/Next Video Navigation

**Description:** Add prev/next lesson navigation buttons within the unified player.

**Acceptance Criteria:**
- FR-5.1: A `useLessonNavigation(courseId, lessonId)` hook returns `{ prevLesson, nextLesson, currentIndex, totalLessons }` using the adapter's `getLessons()`.
- FR-5.2: Prev/Next buttons render below (or beside) the video player. "Previous" is disabled on the first lesson; "Next" is disabled on the last lesson.
- FR-5.3: Clicking Next/Previous navigates to `/courses/:courseId/lessons/:nextLessonId` without full page reload.
- FR-5.4: Auto-advance countdown triggers after lesson completion, navigating to the next lesson (reuses existing `AutoAdvanceCountdown` component).
- FR-5.5: Works for both local and YouTube courses.

### FR-6: Breadcrumbs

**Description:** Display a breadcrumb trail showing the user's position within a course.

**Acceptance Criteria:**
- FR-6.1: A `<CourseBreadcrumb>` component renders `Courses > [Course Name] > [Lesson Title]` using shadcn's `Breadcrumb` component.
- FR-6.2: "Courses" links to `/courses`. Course name links to `/courses/:courseId`. Lesson title is non-clickable (current page).
- FR-6.3: Breadcrumb renders at the top of both `UnifiedCourseDetail` and `UnifiedLessonPlayer`.
- FR-6.4: Long course or lesson names truncate with ellipsis, with full text in a tooltip.

### FR-7: Video Reorder Dialog — Folder Grouping

**Description:** Enhance the video reorder dialog to group videos by folder/chapter for local courses and by playlist section for YouTube courses.

**Acceptance Criteria:**
- FR-7.1: Videos in the reorder dialog are visually grouped by their parent folder (local) or chapter (YouTube).
- FR-7.2: Drag-and-drop reordering works within and across groups.
- FR-7.3: Group headers display the folder/chapter name.

### FR-8: Quiz Wiring to Unified Course IDs

**Description:** Connect quiz functionality to the unified course route so quizzes are accessible from the unified player.

**Acceptance Criteria:**
- FR-8.1: A "Take Quiz" button in the unified player links to `/courses/:courseId/lessons/:lessonId/quiz`.
- FR-8.2: Quiz page resolves the course and lesson via the adapter layer.
- FR-8.3: Quiz results and review pages are accessible under the unified route tree.
- FR-8.4: Existing quiz data (stored by courseId + lessonId) is compatible with the unified routes without data migration.

### FR-9: PDF Viewer in Unified Player

**Description:** Support PDF content items within the unified lesson player.

**Acceptance Criteria:**
- FR-9.1: When a lesson item has `type: 'pdf'`, the player renders a PDF viewer instead of a video player.
- FR-9.2: PDF viewer supports page navigation, zoom, and scroll.
- FR-9.3: Notes panel remains available alongside the PDF viewer.
- FR-9.4: Prev/next navigation works across mixed video and PDF lessons within the same course.

---

## 5. Non-Functional Requirements

### NFR-1: Performance

- NFR-1.1: Unified player page load (FCP) must not regress more than 10% compared to current `ImportedLessonPlayer` baseline. Measured via Playwright performance benchmark agent.
- NFR-1.2: Adapter layer adds no more than 5ms overhead to course data resolution (thin data mapper, not computation-heavy).
- NFR-1.3: Bundle size increase from new unified components must not exceed 25% of current course-related chunk size (enforced by existing bundle analysis gate).

### NFR-2: Migration Safety

- NFR-2.1: Dexie v30 migration (dropping dead `courses` table) must complete without error for users with existing data. Validated by unit test against the full migration chain.
- NFR-2.2: Zero data loss guarantee: all `importedCourses`, `importedVideos`, `importedPdfs`, `notes`, `progress`, `bookmarks`, and `studySessions` records survive migration. Validated by automated test that seeds data, runs migration, and verifies record counts.
- NFR-2.3: Migration is forward-only. No rollback mechanism needed since the dropped `courses` table was empty (cleared on every startup).

### NFR-3: Backward Compatibility

- NFR-3.1: Old URL patterns (`/imported-courses/*`, `/youtube-courses/*`) must redirect to new routes for at least 2 epics after this migration.
- NFR-3.2: Import wizards (local file import, YouTube playlist import) remain unchanged. They continue to produce `ImportedCourse` records in the `importedCourses` table. The adapter layer reads from this table transparently.
- NFR-3.3: All existing E2E tests pass after migration (with updated URL patterns).

### NFR-4: Accessibility

- NFR-4.1: Notes panel, prev/next buttons, and breadcrumbs meet WCAG 2.1 AA requirements (4.5:1 contrast, keyboard navigable, proper ARIA labels).
- NFR-4.2: Prev/next buttons have `aria-label` attributes indicating the target lesson name.
- NFR-4.3: PDF viewer supports keyboard navigation for page turning and zoom.

### NFR-5: Maintainability

- NFR-5.1: After this epic, there is exactly 1 course detail page component and 1 lesson player component (plus the adapter layer). No parallel implementations.
- NFR-5.2: Adding a new course source (e.g., Notion import) requires only: (a) a new adapter implementation, (b) extending the `CourseSource` union type, and (c) an import wizard page. No changes to the unified player, detail page, or route tree.

---

## 6. Scope

### IN Scope

| Item | Rationale |
|------|-----------|
| Dead code removal (~3,000 lines) | Eliminates confusion and frees the `/courses/` route namespace |
| Adapter layer (`CourseAdapter` interface + 2 implementations) | Source-agnostic data access without premature schema migration |
| Route consolidation to `/courses/:courseId` | Single URL family for all courses |
| Redirect layer for old URLs | Preserves bookmarks and links |
| Notes panel in unified player | Feature parity with dead player's capabilities |
| Prev/next video navigation | Feature parity with dead player's capabilities |
| Breadcrumbs in detail + player pages | Feature parity with dead player's capabilities |
| Video reorder dialog folder grouping | Improved organization UX |
| Quiz wiring to unified route IDs | Feature parity with dead player's capabilities |
| PDF viewer in unified player | Support mixed media courses |
| Dexie v30 migration (drop dead table) | Clean schema |
| Internal link updates across all components | Consistency |
| E2E test updates for new URLs | Test coverage |

### OUT of Scope

| Item | Rationale |
|------|-----------|
| New course creation wizard | No user need — courses come from import wizards |
| Social/sharing features | Not aligned with personal learning app scope |
| Backend/cloud sync for course data | IndexedDB-first architecture; cloud sync is a separate epic |
| AI-powered features (smart summaries, model selection) | Covered by Epic B (AI Model Selection Per Feature) |
| Rename `ImportedCourse` type to `Course` | Deferred to Phase 2 (when Notion/Readwise imports land). Adapter layer provides the UX benefit without touching ~40 files. |
| Rename `importedCourses` Dexie table to `courses` | Same as above — Phase 2 only if new import sources arrive |
| Slug-based URLs (`/courses/react-fundamentals`) | Can be added later as SEO layer over UUID-based routes |
| Unifying import wizards | Local file import and YouTube import have fundamentally different UX flows |
| Per-course AI preferences | Requires both Epic A and Epic B to be complete |

---

## 7. Dependencies & Assumptions

### Dependencies

| Dependency | Type | Impact |
|------------|------|--------|
| Existing `NoteEditor` component (`src/app/components/notes/NoteEditor.tsx`) | Internal | FR-4 depends on this being a standalone, reusable component (confirmed: it already is) |
| Existing `AutoAdvanceCountdown` component | Internal | FR-5 auto-advance reuses this component |
| Existing `CompletionModal` component | Internal | Unified player reuses the existing celebration modal |
| shadcn/ui `Breadcrumb`, `ResizablePanelGroup`, `Sheet`, `Tabs` components | Internal | Already in the component library (~50 components) |
| Dexie v4 migration API | External | v30 migration uses `stores({ courses: null })` to drop table |
| React Router v7 `<Navigate>` | External | Redirect layer uses this for client-side redirects |

### Assumptions

| # | Assumption | Risk if Wrong |
|---|-----------|---------------|
| A1 | The dead `courses` Dexie table is always empty for all users (cleared on every startup since it was introduced). | If a user somehow has data in this table, it will be lost on v30 migration. Risk: near zero — the clear runs before any UI renders. |
| A2 | YouTube course IDs (UUIDs) do not collide with local course IDs (UUIDs). | If they collide, the unified `/courses/:courseId` route would be ambiguous. Risk: near zero — UUIDs are cryptographically unique. |
| A3 | `NoteEditor` works correctly with YouTube course video IDs (not just local video IDs). | Notes use `courseId + videoId` as key. YouTube videos have unique IDs. Risk: low — needs E2E verification. |
| A4 | No external systems or services reference `/imported-courses/` or `/youtube-courses/` URLs. | If external systems deep-link to these, they need the redirect layer. Risk: low — personal app. |
| A5 | The `FileSystemDirectoryHandle` permission model (for local courses) is unaffected by route changes. | Handle permissions are stored per-origin, not per-URL. Risk: near zero. |

---

## 8. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Bookmark/URL breakage for existing users | High | Medium | Ship redirect layer (FR-3) in the first story, before any route removals. E2E tests validate all 4 redirect patterns. |
| R2 | Feature regression in unified player compared to existing imported/YouTube players | Medium | High | Write E2E tests for existing player behavior BEFORE building the unified player. Run regression suite after each story. |
| R3 | Adapter abstraction leaks source-specific behavior into unified components | Medium | Medium | Code review gate: unified components must never check `course.source` directly. All source-specific logic lives in adapter implementations. |
| R4 | YouTube-specific edge cases (iframe embed, playlist chapters, external thumbnails) | Medium | Medium | `YouTubeCourseAdapter` encapsulates all YouTube-specific logic. Dedicated E2E tests for YouTube course playback. |
| R5 | Dexie v30 migration failure on upgrade | Very Low | High | Migration only drops an empty table (simplest possible operation). Unit test validates the full migration chain v1-v30. |
| R6 | `FileSystemDirectoryHandle` permissions lost between sessions | Medium | High | This is a pre-existing issue, not introduced by this epic. Document as known limitation. Handle re-permission prompts gracefully in the adapter. |
| R7 | Large unified player component (risk of replicating the 1,088-line monolith) | Medium | Medium | Composition architecture: player is assembled from small, tested components (VideoPlayer, NoteEditor, LessonNav, Breadcrumb). No single component exceeds 300 lines. |
| R8 | Internal links missed during URL migration | Medium | Medium | Comprehensive grep for `/imported-courses/` and `/youtube-courses/` across all `.tsx` and `.spec.ts` files. CI build + full E2E suite catches missed references. |

---

## 9. Release Plan / Phasing

### Phase 1: Foundation (Stories 1-3)

| Story | Description | Dependencies |
|-------|-------------|-------------|
| S01 | Dead code removal: delete `Course` type, `useCourseStore`, `CourseDetail.tsx`, `CourseOverview.tsx`, `LessonPlayer.tsx`, dead routes. Drop `courses` table via Dexie v30. Extract reusable patterns as reference notes before deletion. | None |
| S02 | Adapter layer: `CourseAdapter` interface, `LocalCourseAdapter`, `YouTubeCourseAdapter`, adapter factory. Unit tests for both adapters. | S01 (clean codebase) |
| S03 | Route consolidation: unified routes + redirect layer + internal link updates across all components. E2E tests for redirects. | S02 (adapters available) |

### Phase 2: Unified Pages (Stories 4-6)

| Story | Description | Dependencies |
|-------|-------------|-------------|
| S04 | `UnifiedCourseDetail` page: course metadata display, lesson list, PDF viewer trigger, folder-grouped video reorder dialog. Replaces `ImportedCourseDetail` + `YouTubeCourseDetail`. | S03 (routes in place) |
| S05 | `UnifiedLessonPlayer` — video playback: adapter-driven media resolution, local video player + YouTube iframe embed, resizable panel layout, mobile sheet fallback. | S03 (routes in place) |
| S06 | `UnifiedLessonPlayer` — PDF viewer: render PDF lessons in the player, page navigation, zoom, scroll. Notes panel alongside PDF. | S05 (player foundation) |

### Phase 3: Feature Parity (Stories 7-10)

| Story | Description | Dependencies |
|-------|-------------|-------------|
| S07 | Notes panel integration: `NoteEditor` in resizable side panel (desktop) / sheet (mobile). Tabbed interface with Transcript, AI Summary, Bookmarks. | S05 (player exists) |
| S08 | Prev/next navigation: `useLessonNavigation` hook, nav buttons, auto-advance countdown, completion modal. | S05 (player exists) |
| S09 | Breadcrumbs: `CourseBreadcrumb` component on detail + player pages. Truncation with tooltip. | S04 + S05 (pages exist) |
| S10 | Quiz wiring: "Take Quiz" button in player, quiz route under unified tree, quiz page adapter integration. | S05 + S03 (player + routes) |

### Phase 4: Cleanup (Story 11)

| Story | Description | Dependencies |
|-------|-------------|-------------|
| S11 | Delete old page components (`ImportedCourseDetail.tsx`, `ImportedLessonPlayer.tsx`, `YouTubeCourseDetail.tsx`, `YouTubeLessonPlayer.tsx`). Remove import wizard route registrations that are no longer needed. Final E2E validation pass. | S04-S10 (all unified pages complete) |

### Estimated Total: 11 stories

---

## 10. Open Questions

| # | Question | Impact | Proposed Resolution |
|---|----------|--------|---------------------|
| OQ-1 | Should slug-based URLs (`/courses/react-fundamentals`) be implemented now or deferred? | UX polish vs. effort. Slugs require uniqueness enforcement and a lookup mechanism. | **Defer.** UUID-based routes work. Slugs can be layered on top in a future story without breaking existing links. |
| OQ-2 | Should the `ImportedCourse` type be renamed to `Course` as part of this epic? | ~40 files need updating. No user-facing benefit. | **Defer to Phase 2.** Only execute if/when a new import source (Notion, Readwise) lands and the adapter layer is no longer sufficient. |
| OQ-3 | How should `FileSystemDirectoryHandle` permission revocation be handled in the unified player? | Users may see a "permission denied" state when returning to a local course after browser restart. | **Document as known limitation.** Show a re-permission prompt in the adapter. This is a pre-existing issue, not introduced by this epic. |
| OQ-4 | Should redirect routes be removed after a specific timeframe? | Dead redirect routes accumulate as tech debt. | **Remove after 2 epics.** Add `// TODO` comment and track in `known-issues.yaml`. |
| OQ-5 | Should the video reorder dialog support cross-folder drag-and-drop, or only within-folder reordering? | Cross-folder DnD is more complex but more flexible. | **Start with within-folder only (FR-7.2).** Cross-folder can be added if users request it. |
| OQ-6 | What is the maximum acceptable component size for `UnifiedLessonPlayer.tsx`? | Risk of replicating the 1,088-line monolith. | **300 lines max.** Enforce via composition: player assembles small components, does not inline their logic. |
| OQ-7 | Should the adapter layer support future sources (Notion, Readwise) now or wait? | YAGNI vs. forward planning. | **Wait.** The adapter interface is extensible by design. Adding a new adapter implementation is a single-file change. No need to pre-build for hypothetical sources. |
