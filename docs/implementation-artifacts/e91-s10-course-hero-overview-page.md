---
story_id: E91-S10
story_name: "Course Hero Overview Page"
status: complete
started: 2026-03-30
completed: 2026-03-30
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.10: Course Hero Overview Page

## Story

As a learner,
I want a visually rich course landing page with a hero section, stats, curriculum, and call-to-action,
so that I can understand what a course offers before starting and feel motivated to begin learning.

## Acceptance Criteria

- AC1: Given the route `/courses/:courseId/overview`, when the page loads, then a hero overview page is rendered for the course.
- AC2: Given the hero section, when displayed, then it shows a gradient background using design tokens (no hardcoded colors), the course thumbnail (or fallback), and the course title.
- AC3: Given the stats row, when displayed, then it shows 4 stat cards: Total Duration, Lesson Count, Video Count, PDF Count — derived from adapter data.
- AC4: Given the "About This Course" section, when the course has a description or tags, then it displays them; otherwise the section is hidden gracefully.
- AC5: Given a local course with an author, when the author section is rendered, then it shows an author card with avatar, name, title, and link to `/authors/:authorId`.
- AC6: Given the "What You'll Learn" section, when the course has tags, then tags are displayed as a checklist with checkmark icons.
- AC7: Given the CTA card, when the course has not been started, then it shows "Start Course"; when in progress, "Continue Learning"; when completed, "Review Course" — reusing E91-S01 logic.
- AC8: Given the curriculum section, when displayed, then it shows all lessons grouped by folder (local) or chapter (YouTube) in an expandable accordion with lesson type icons, durations, and completion status.
- AC9: Given the course detail page (`/courses/:courseId`), when a "View Overview" button is clicked, then the user navigates to `/courses/:courseId/overview`.
- AC10: Given the hero overview page, when accessed for both local and YouTube courses, then it works correctly via the adapter pattern (never checks `course.source`).
- AC11: Given any viewport (mobile 375px, tablet 768px, desktop 1440px), then the layout is responsive and visually correct.
- AC12: Given a course with videos that have duration data, when the CourseHeader renders on the course detail page, then the total duration is displayed in the metadata line (e.g., "3:45:20 total"). *(Absorbed from E91-S11)*
- AC13: Given duration formatting, when the total is >=1 hour, then it displays as `H:MM:SS`; when <1 hour, as `M:SS`. *(Absorbed from E91-S11)*
- AC14: Given a course where all videos have zero or missing duration, then the total duration is NOT shown in the CourseHeader (hidden gracefully). *(Absorbed from E91-S11)*

## Tasks / Subtasks

- [x] Task 1: Create route (AC: 1)
  - [x] 1.1 Add `/courses/:courseId/overview` route in `src/app/routes.tsx`
  - [x] 1.2 Lazy-load `CourseOverview` component
  - [x] 1.3 Add `RouteErrorBoundary` wrapper
- [x] Task 2: Create `CourseOverview.tsx` page (AC: 2, 10)
  - [x] 2.1 Create `src/app/pages/CourseOverview.tsx`
  - [x] 2.2 Use `useCourseAdapter(courseId)` for all data access
  - [x] 2.3 Load videos, PDFs, chapters, progress from Dexie (same pattern as UnifiedCourseDetail)
  - [x] 2.4 Load author data from `useAuthorStore` (local courses only)
  - [x] 2.5 Loading skeleton and error/not-found states
- [x] Task 3: Hero section (AC: 2)
  - [x] 3.1 Gradient background: `linear-gradient(160deg, var(--brand-soft) 0%, var(--accent-violet-muted) 50%, var(--card) 100%)`
  - [x] 3.2 Course thumbnail overlay (opacity-20) or fallback icon
  - [x] 3.3 Gradient overlay for text readability
  - [x] 3.4 Course title (h1, text-3xl md:text-4xl)
  - [x] 3.5 Tag badges below title (if tags exist)
  - [x] 3.6 Container: `rounded-[24px] overflow-hidden shadow-sm min-h-[280px]` *(Implementation uses `shadow-studio` — the project-standard elevated shadow token, preferred over `shadow-sm`)*
- [x] Task 4: Stats row (AC: 3)
  - [x] 4.1 Grid: `grid-cols-2 md:grid-cols-4 gap-3`
  - [x] 4.2 4 cards: Duration (Clock), Lessons (BookOpen), Videos (Play), PDFs (FileText)
  - [x] 4.3 Total duration computed from video durations
  - [x] 4.4 Card: `bg-card rounded-xl p-4 text-center shadow-sm border border-border/50`
- [x] Task 5: Two-column layout (AC: 4, 5, 6)
  - [x] 5.1 Grid: `grid-cols-1 lg:grid-cols-3 gap-[var(--content-gap)]`
  - [x] 5.2 Left (2/3): "About This Course" card with description + Author card with avatar
  - [x] 5.3 Right (1/3): "What You'll Learn" tags checklist + CTA card
  - [x] 5.4 Hide "About" section if no description available
  - [x] 5.5 Author card: only for local courses (`!isYouTube`), links to author profile
- [x] Task 6: CTA card (AC: 7)
  - [x] 6.1 Gradient CTA card: `linear-gradient(135deg, var(--brand) 0%, var(--accent-violet) 100%)`
  - [x] 6.2 Reuse E91-S01 logic: `getLastWatchedLesson()` / `getFirstLesson()` to determine state
  - [x] 6.3 Button: "Start Course" / "Continue Learning" / "Review Course"
  - [x] 6.4 Navigate to first/last-watched lesson on click
- [x] Task 7: Curriculum accordion (AC: 8)
  - [x] 7.1 Lesson list grouped by folder (local) or chapter (YouTube) — reuse `groupByFolder` / `groupByChapter` from LessonList
  - [x] 7.2 Each group as a collapsible section with module number, title, lesson count
  - [x] 7.3 Lessons show: type icon (Video/FileText), title, duration badge, completion indicator
  - [x] 7.4 First group auto-expanded, rest collapsed
  - [x] 7.5 Click lesson → navigate to player (`/courses/:courseId/lessons/:lessonId`)
- [x] Task 8: "View Overview" button on course detail (AC: 9)
  - [x] 8.1 Add button/link to `CourseHeader.tsx`: "View Overview" with `Eye` or `LayoutDashboard` icon
  - [x] 8.2 Links to `/courses/:courseId/overview`
- [x] Task 9: Responsive design (AC: 11)
  - [x] 9.1 Mobile: single column, stacked sections, full-width hero
  - [x] 9.2 Tablet: 2-column stats, single-column content
  - [x] 9.3 Desktop: 4-column stats, 3-column (2/3 + 1/3) content
- [x] Task 10: E2E tests
  - [x] 10.1 Navigate to `/courses/:courseId/overview` → hero page renders
  - [x] 10.2 Stats row shows correct counts (videos, PDFs, duration)
  - [x] 10.3 Author card visible for local course, hidden for YouTube
  - [x] 10.4 CTA button text matches course state (start/continue/review)
  - [x] 10.5 Click CTA → navigates to correct lesson
  - [x] 10.6 Curriculum accordion: expand/collapse, click lesson → navigate
  - [x] 10.7 Responsive: test at 375px, 768px, 1440px
  - [x] 10.8 Course with duration data → total duration shown in CourseHeader
  - [x] 10.9 Course with zero durations → total duration not shown in CourseHeader
- [x] Task 11: Add total duration to CourseHeader (AC: 12, 13, 14)
  - [x] 11.1 Add `totalDuration?: number` prop to `CourseHeaderProps`
  - [x] 11.2 Compute `totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0)` in `UnifiedCourseDetail.tsx`
  - [x] 11.3 Pass to `<CourseHeader totalDuration={totalDuration} />`
  - [x] 11.4 Render in metadata line when `totalDuration > 0`: `<Clock className="size-3.5" /> {formatDuration(totalDuration)} total`
  - [x] 11.5 Reuse `formatDuration` from `LessonList.tsx` or create locally (H:MM:SS vs M:SS)

## Design Guidance

- Reference the deleted `CourseOverview.tsx` from git: `git show 0b72708d^:src/app/pages/CourseOverview.tsx`
- All gradients MUST use CSS custom properties from theme.css (e.g., `var(--brand-soft)`, `var(--accent-violet-muted)`) — NO hardcoded hex colors
- Use Framer Motion (`motion/react`) for entry animations only if already imported; otherwise use CSS transitions
- Cards: `rounded-[24px] shadow-sm border border-border/50`
- Typography: `font-display` for headings where appropriate
- Stats labels: `text-[10px] uppercase tracking-[0.15em] text-muted-foreground`
- Back button: same pattern as CourseHeader with `group-hover:-translate-x-0.5` micro-animation

## Implementation Notes

- The old `CourseOverview.tsx` (447 lines) is available in git at commit `0b72708d^` — use as design reference but rewrite completely for the adapter pattern
- The old page used `useCourseStore` and the `Course` type with `modules`, `lessons`, `resources` — the new page must use `useCourseAdapter` and `ImportedCourse` + `ImportedVideo[]` + `ImportedPdf[]`
- For the curriculum accordion: consider extracting a reusable `CurriculumAccordion` component or reuse grouping logic from `LessonList.tsx`
- The CTA logic from E91-S01 (`getLastWatchedLesson`, `getFirstLesson`) should be implemented first (S01 is a dependency)
- YouTube courses: show channel title in hero instead of author
- Local courses without description: hide the "About" section entirely, expand the right column

## Dependencies

- **E91-S01** (Start/Continue CTA) must be implemented first — the CTA card reuses its logic

## Testing Notes

- Seed a course with multiple videos, PDFs, tags, and an author for comprehensive testing
- Test both local and YouTube courses
- Test empty states: course with no tags (hide "What You'll Learn"), no description (hide "About")
- Test course states: not started, in progress (with progress data), completed
- Verify no hardcoded colors (ESLint `design-tokens/no-hardcoded-colors` will catch)
- `formatDuration` already exists in `LessonList.tsx` — consider extracting to shared utility or duplicating locally
- **Note:** This story absorbed E91-S11 (Total Duration in Course Header). AC12-14 and Task 11 were originally a separate story but are too small (~10 lines) to justify standalone delivery.
