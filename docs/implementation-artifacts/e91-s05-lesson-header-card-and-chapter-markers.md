---
story_id: E91-S05
story_name: "Lesson Header Card + Chapter Markers"
status: done
started: 2026-03-30
completed: 2026-03-31
reviewed: true
review_started: 2026-03-31
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 91.05: Lesson Header Card + Chapter Markers

## Story

As a learner,
I want to see the lesson title, description, and resource badges below the video, and chapter markers in the video timeline,
so that I have immediate context about what I'm watching and can navigate to specific sections.

## Acceptance Criteria

- AC1: Given any lesson (video or PDF), when the lesson player renders, then a lesson header card is displayed below the main content showing: lesson title (h2), description (if present), resource type badges, and key topics/tags.
- AC2: Given a local video with chapter metadata, when the video timeline renders, then chapter markers appear as tick marks on the progress bar.
- AC3: Given a YouTube video with chapter data (from YouTubeCourseChapter), when the video timeline renders, then chapter markers appear.
- AC4: Given no chapter data, when the video renders, then no chapter markers are shown (graceful empty state).
- AC5: The lesson header card uses the project design system (rounded-[24px] card, design tokens, no hardcoded colors).
- AC6: Given chapter markers, when a marker is clicked, then the video seeks to that chapter's timestamp.

## Tasks / Subtasks

- [ ] Task 1: Create `src/app/components/course/LessonHeaderCard.tsx` (AC: 1, 5)
  - [ ] 1.1 Props: `title: string`, `description?: string`, `resourceTypes: string[]`, `tags?: string[]`
  - [ ] 1.2 Layout: Card with `rounded-[24px] p-6`
  - [ ] 1.3 Title: `text-xl font-semibold`
  - [ ] 1.4 Description: `text-muted-foreground text-sm` (if present)
  - [ ] 1.5 Resource type badges: `Badge variant="secondary"` for each type
  - [ ] 1.6 Tags: small `Badge variant="outline"` for each tag
- [ ] Task 2: Integrate `LessonHeaderCard` in `UnifiedLessonPlayer.tsx` (AC: 1)
  - [ ] 2.1 Render below the video/PDF content and above `LessonNavigation`
  - [ ] 2.2 Extract title, description, tags from current lesson via adapter
  - [ ] 2.3 Derive resource types from lesson type (Video, PDF, YouTube)
- [ ] Task 3: Add chapter markers to `LocalVideoContent.tsx` (AC: 2, 4, 6)
  - [ ] 3.1 Accept `chapters?: { title: string; startTime: number }[]` prop
  - [ ] 3.2 Render chapter tick marks as absolutely-positioned divs on the video's progress bar container
  - [ ] 3.3 On marker click: `videoRef.current.currentTime = chapter.startTime`
  - [ ] 3.4 Show chapter title tooltip on hover
- [ ] Task 4: Extract chapter data from adapter for YouTube (AC: 3)
  - [ ] 4.1 In `UnifiedLessonPlayer`, get chapters from `adapter.getChapters(lessonId)` or from `chapters` state
  - [ ] 4.2 Pass to the video content component
- [ ] Task 5: E2E tests
  - [ ] 5.1 Lesson header card visible with title and description
  - [ ] 5.2 Resource type badge shown (e.g., "Video")
  - [ ] 5.3 Chapter markers visible when chapter data present
  - [ ] 5.4 Click chapter marker → video seeks to correct time

## Design Guidance

- LessonHeaderCard: `Card` component with `rounded-[24px] p-6 mt-4`
- Title: `text-xl font-semibold text-foreground`
- Description: `mt-2 text-sm text-muted-foreground leading-relaxed`
- Resource badges: `<Badge variant="secondary" className="mr-1">Video</Badge>`
- Tags: `<Badge variant="outline" className="mr-1 text-xs">{tag}</Badge>`
- Chapter markers: `position: absolute; top: 0; bottom: 0; width: 2px; bg-brand; cursor-pointer`
  - Tooltip: `title={chapter.title}` attribute for native tooltip

## Implementation Notes

- Check `src/data/types.ts` for the lesson/video type fields — look for `description`, `tags`, `chapters`
- `ImportedVideo` has: `id`, `filename`, `duration`, `folderId`, `courseId` — may NOT have description/tags
  - If no description field: hide description section gracefully
  - Tags: check if `ImportedVideo` or the parent course has tags
- `YouTubeCourseChapter` has: `title`, `startTime` (seconds), `courseId`
- For chapter markers on native HTML5 video: the `<video>` progress bar is browser-controlled
  - Custom chapter markers need to be overlaid on a custom progress indicator, NOT the native browser controls
  - Use a custom progress bar overlay (check if VideoPlayer component already has one)
- If VideoPlayer component already renders a custom progress bar, add chapter markers there

## Testing Notes

- For chapter markers E2E: seed test course with chapter data in the lesson metadata
- Video seek assertion: after clicking marker, check `video.currentTime` via `page.evaluate`

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed
- [ ] LessonHeaderCard handles missing description/tags gracefully (no empty sections)
- [ ] Chapter markers only render when chapters array is non-empty
- [ ] Click-to-seek works for both local and YouTube
- [ ] No hardcoded colors in LessonHeaderCard

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

- **AC2/AC3/AC6 E2E coverage gap**: Seeded ImportedVideo records lack a `fileHandle` (File System Access API cannot be faked in Playwright), so `<video>` never mounts and no progress bar renders. Chapter marker visibility and click-to-seek behavior cannot be asserted in E2E tests. These ACs are verified manually and via unit tests on the ChapterMarkers component. This is documented as a comment in `tests/e2e/story-e91-s05.spec.ts`.
- **`resourceTypes` memo**: The derived `resourceTypes` array was rebuilt every render; wrapped in `useMemo` keyed on `[lessonTypeResolved, isPdf, isYouTube]`.
