---
story_id: E54-S01
story_name: "Wire Lesson Flow to ImportedLessonPlayer"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, typecheck, format, unit-tests, e2e-tests, design-review, code-review, test-coverage-review]
burn_in_validated: false
---

# Story 54.1: Wire Lesson Flow to ImportedLessonPlayer

## Story

As a learner studying an imported course,
I want auto-advance countdown, completion celebrations, and prev/next navigation when I finish a video,
So that I have the same seamless learning flow as regular courses without manually hunting for the next lesson.

## Acceptance Criteria

**Given** an imported course with multiple videos
**When** a video finishes playing (onEnded fires)
**Then** the lesson is marked complete in useContentProgressStore and a lesson completion celebration modal appears

**Given** an imported course video finishes and a next video exists
**When** the celebration modal is dismissed
**Then** an auto-advance countdown (5 seconds) appears showing the next video title with a cancel button

**Given** the auto-advance countdown is active
**When** the countdown reaches 0
**Then** the player navigates to the next video in the course

**Given** the auto-advance countdown is active
**When** the user clicks "Cancel"
**Then** the countdown is dismissed and the user stays on the current video

**Given** an imported course with multiple videos
**When** viewing any video
**Then** prev/next navigation buttons are visible; prev is disabled on the first video, next is disabled on the last video

**Given** the user is on the last video of an imported course
**When** that video finishes
**Then** a course-level completion celebration (type='course') appears instead of a lesson-level one

**Given** an imported video is playing
**When** the user clicks the manual completion toggle
**Then** the lesson status toggles between completed and not-started, and a celebration appears on mark-complete

**Given** the auto-advance countdown is showing
**When** the user presses Tab and Enter on the Cancel button
**Then** the countdown is dismissed (keyboard accessibility)

## Tasks / Subtasks

- [ ] Task 1: Add progress store integration to ImportedLessonPlayer (AC: 1, 6)
  - [ ] 1.1 Import `useContentProgressStore` (`loadCourseProgress`, `getItemStatus`, `setItemStatus`)
  - [ ] 1.2 Call `loadCourseProgress(courseId)` on mount
  - [ ] 1.3 Add completion state tracking from `getItemStatus` with compound key `courseId:lessonId`

- [ ] Task 2: Load video list for prev/next navigation (AC: 5)
  - [ ] 2.1 Query `db.importedVideos.where('courseId').equals(courseId)` on mount (match ImportedCourseDetail sort order)
  - [ ] 2.2 Compute `currentIndex`, `prevVideo`, `nextVideo` from the video array
  - [ ] 2.3 Store video list in component state

- [ ] Task 3: Add prev/next navigation buttons (AC: 5)
  - [ ] 3.1 Add `useNavigate()` from React Router
  - [ ] 3.2 Render prev/next `<Button>` elements with ChevronLeft/ChevronRight icons in header area
  - [ ] 3.3 Navigate to `/imported-courses/${courseId}/lessons/${prevVideo.id}` or `nextVideo.id`
  - [ ] 3.4 Disable prev on first video, disable next on last video

- [ ] Task 4: Add `onEnded` handler and auto-advance countdown (AC: 1, 2, 3, 4, 8)
  - [ ] 4.1 Add `onEnded` prop to the `<VideoPlayer>` component
  - [ ] 4.2 In handler: mark lesson complete via `setItemStatus(courseId, lessonId, 'completed', [])`
  - [ ] 4.3 Check if all videos completed → set celebration type ('course' vs 'lesson')
  - [ ] 4.4 Set `showAutoAdvance(true)` if `nextVideo` exists
  - [ ] 4.5 Import and render `<AutoAdvanceCountdown>` with 5-second countdown
  - [ ] 4.6 On advance: navigate to next video; on cancel: hide countdown

- [ ] Task 5: Add completion celebration modal (AC: 1, 6)
  - [ ] 5.1 Add state: `celebrationModal`, `celebrationType`, `celebrationTitle`
  - [ ] 5.2 Import and render `<CompletionModal>` from celebrations
  - [ ] 5.3 On video end: check completion percentage (completed count vs total video count)
  - [ ] 5.4 If all complete: `type='course'`; else: `type='lesson'`
  - [ ] 5.5 Wire "Continue Learning" button to navigate to next video

- [ ] Task 6: Add manual completion toggle (AC: 7)
  - [ ] 6.1 Add a completion toggle button (CheckCircle2/Circle icon) in the lesson header
  - [ ] 6.2 On click: toggle between completed/not-started via `setItemStatus`
  - [ ] 6.3 Trigger celebration on mark-complete

## Design Guidance

- Follow LessonPlayer.tsx layout exactly for button placement and styling
- Auto-advance countdown renders below the video player (same position as LessonPlayer)
- Prev/next buttons use the same icon + text pattern as LessonPlayer header nav
- Manual completion toggle uses CheckCircle2 (completed) / Circle (not-started) icons
- All colors use design tokens — no hardcoded Tailwind colors

## Implementation Notes

**Key files to reference:**
- `src/app/pages/LessonPlayer.tsx` — gold standard, copy state management pattern
- `src/app/pages/ImportedLessonPlayer.tsx` — target file (~265 lines currently)
- `src/app/components/figma/AutoAdvanceCountdown.tsx` — reuse as-is
- `src/app/components/celebrations/CompletionModal.tsx` — reuse as-is
- `src/stores/useContentProgressStore.ts` — progress store with compound keys
- `src/lib/progress.ts` — helper functions

**Pattern to follow:** LessonPlayer's `handleVideoEnded` → `markLessonComplete` → check course completion % → `setCelebrationType` → `setCelebrationModal` → `setShowAutoAdvance`

**Risk:** Video list ordering must match ImportedCourseDetail's sort order for prev/next to be consistent with what the user sees in the sidebar.

## Testing Notes

- New E2E spec: `tests/e2e/regression/imported-lesson-player.spec.ts`
- Test auto-advance countdown (verify 5s, cancel button works)
- Test completion modal (lesson vs course level)
- Test prev/next navigation (boundary conditions: first/last video)
- Test manual completion toggle
- Verify keyboard accessibility on cancel button (Tab + Enter)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
