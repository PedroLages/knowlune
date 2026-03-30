---
story_id: E91-S02
story_name: "Local Course Visual Parity"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, performance-benchmark, security-review, exploratory-qa]
burn_in_validated: false
---

# Story 91.02: Local Course Visual Parity (Progress Bars + Thumbnails)

## Story

As a learner,
I want local imported courses to display per-video progress bars and thumbnails in the lesson list,
so that local courses look as rich and informative as YouTube courses.

## Acceptance Criteria

- AC1: Given a local course with in-progress videos, when the lesson list renders, then each in-progress video shows a horizontal progress bar with completion percentage (same visual as YouTube courses).
- AC2: Given a local course with completed videos, when the lesson list renders, then each completed video shows a completion checkmark badge (same as YouTube).
- AC3: Given a local course video item, when the lesson list renders, then a thumbnail placeholder is shown (icon-based or generated) — matching the visual weight of YouTube thumbnails.
- AC4: Given a local course video with 0% progress, when the lesson list renders, then no progress bar is shown (same as YouTube not-started behavior).
- AC5: The visual design of local video items matches the YouTube video items (same layout, same badge styles, same spacing).

## Tasks / Subtasks

- [ ] Task 1: Read progress data for local videos in `LessonList.tsx` (AC: 1, 2, 4)
  - [ ] 1.1 Accept `progressMap: Map<string, VideoProgress>` prop (already exists for YouTube — confirm it's passed for local too)
  - [ ] 1.2 In `renderLocalGroups()`, look up progress by video.id from progressMap
  - [ ] 1.3 Derive `completionPercent` and `status` for each video
- [ ] Task 2: Render progress bar for local in-progress videos (AC: 1, 4)
  - [ ] 2.1 Reuse the same progress bar JSX already used in YouTube items
  - [ ] 2.2 Only show bar when `completionPercent > 0 && completionPercent < 100`
- [ ] Task 3: Render completion badge for completed local videos (AC: 2)
  - [ ] 3.1 Reuse the checkmark badge JSX from YouTube items
- [ ] Task 4: Add thumbnail placeholder for local video items (AC: 3, 5)
  - [ ] 4.1 Show a `<div>` with `bg-muted` + centered `Video` icon (Lucide)
  - [ ] 4.2 Match the `w-24 h-16` size used by YouTube thumbnails
  - [ ] 4.3 For PDF items: show `FileText` icon placeholder
- [ ] Task 5: Verify `UnifiedCourseDetail.tsx` passes `progressMap` for local courses (AC: 1)
  - [ ] 5.1 Confirm `loadContent()` populates `progressMap` for local courses via `db.progress`
- [ ] Task 6: E2E tests
  - [ ] 6.1 Local course with in-progress video → progress bar visible
  - [ ] 6.2 Local course with completed video → checkmark badge visible
  - [ ] 6.3 Local course → thumbnail placeholder visible for each video

## Design Guidance

- Thumbnail placeholder: `w-24 h-16 rounded-md bg-muted flex items-center justify-center`
- Icon inside: `Video` (lucide), `text-muted-foreground`, size `w-8 h-8`
- Progress bar: reuse existing `<div className="w-full bg-muted rounded-full h-1.5">` pattern from YouTube rendering in LessonList
- Completion badge: reuse `<CheckCircle2 className="text-success" />` pattern
- Percentage label: `<span className="text-xs text-muted-foreground">{percent}%</span>` next to progress bar

## Implementation Notes

- `LessonList.tsx` already has `renderYouTubeGroups()` and `renderLocalGroups()` — the parity work is adding the same progress/thumbnail JSX to `renderLocalGroups()`
- `progressMap: Map<string, VideoProgress>` is keyed by lessonId
- `VideoProgress` has: `completionPercentage`, `isCompleted`, `watchedSeconds`, etc. — check `src/data/types.ts`
- Do NOT duplicate the progress query — `UnifiedCourseDetail` already loads progressMap, just ensure it's passed for local courses too
- Previous E54-S03 work added StatusIndicator dots — this story adds richer progress bars on top of that

## Testing Notes

- Seed `db.progress` with `{ courseId, lessonId: videoId, completionPercentage: 65, isCompleted: false }` for in-progress
- Seed with `{ completionPercentage: 100, isCompleted: true }` for completed
- Target `data-testid="lesson-list"` or similar for assertions

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No hardcoded colors — use design tokens
- [ ] No duplication of progress query — reuse existing data flow
- [ ] Visual parity verified at 375px (mobile) and 1440px (desktop)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
