---
story_id: E54-S02
story_name: "Wire Lesson Flow to YouTubeLessonPlayer"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: true
review_started: 2026-03-30
review_gates_passed: [build, lint, typecheck, unit-tests, e2e-tests, design-review, code-review, test-coverage-review]
burn_in_validated: false
---

# Story 54.2: Wire Lesson Flow to YouTubeLessonPlayer

## Story

As a learner studying a YouTube course,
I want auto-advance countdown, completion celebrations, and prev/next navigation after a video auto-completes at 90%,
So that my YouTube course experience matches the flow of regular and imported courses.

## Acceptance Criteria

**Given** a YouTube course with multiple videos
**When** a video auto-completes (>90% watched)
**Then** a celebration modal appears and (if next video exists) auto-advance countdown shows after modal dismissal

**Given** a YouTube course
**When** viewing any video
**Then** prev/next navigation buttons are visible and functional, navigating to `/youtube-courses/${courseId}/lessons/${videoId}`

**Given** the user manually sets status to "Completed" via the dropdown
**When** the status changes
**Then** a celebration modal appears; if it is the last video in the course, a course-level celebration appears

**Given** the auto-advance countdown reaches 0
**When** the next video exists
**Then** the player navigates to the next YouTube video

## Tasks / Subtasks

- [ ] Task 1: Load video list for prev/next navigation (AC: 2)
  - [ ] 1.1 Query `db.importedVideos.where('courseId').equals(courseId).toArray()` on mount
  - [ ] 1.2 Compute `currentIndex`, `prevVideo`, `nextVideo` from the array
  - [ ] 1.3 Add `useNavigate()` from React Router

- [ ] Task 2: Add prev/next navigation buttons (AC: 2)
  - [ ] 2.1 Render prev/next navigation buttons in the header area (ChevronLeft/ChevronRight icons)
  - [ ] 2.2 Navigate to `/youtube-courses/${courseId}/lessons/${video.id}`
  - [ ] 2.3 Disable prev on first video, disable next on last video

- [ ] Task 3: Wire celebration modal into auto-complete and manual toggle (AC: 1, 3)
  - [ ] 3.1 Import `CompletionModal` from `@/app/components/celebrations/CompletionModal`
  - [ ] 3.2 Add celebration state (`celebrationModal`, `celebrationType`, `celebrationTitle`)
  - [ ] 3.3 In existing `handleAutoComplete` callback: after `setItemStatus`, check course completion
  - [ ] 3.4 Count completed statuses in `statusMap` vs total video count for course-level detection
  - [ ] 3.5 Wire celebration into existing manual status dropdown when user selects "Completed"

- [ ] Task 4: Add auto-advance countdown (AC: 1, 4)
  - [ ] 4.1 Import `AutoAdvanceCountdown` from `@/app/components/figma/AutoAdvanceCountdown`
  - [ ] 4.2 Add `showAutoAdvance` state
  - [ ] 4.3 After auto-complete or manual completion: if `nextVideo` exists, show countdown
  - [ ] 4.4 Render below the YouTube player
  - [ ] 4.5 On advance: navigate to next video; on cancel: hide countdown

## Design Guidance

- Follow LessonPlayer.tsx layout for button placement and styling
- Auto-advance countdown renders below the YouTube embed (same position as LessonPlayer)
- Prev/next buttons match the pattern used in E54-S01 (ImportedLessonPlayer)
- All colors use design tokens — no hardcoded Tailwind colors

## Implementation Notes

**Key files to reference:**
- `src/app/pages/LessonPlayer.tsx` — gold standard reference
- `src/app/pages/YouTubeLessonPlayer.tsx` — target file (already has `useContentProgressStore`, `handleAutoComplete`)
- `src/app/components/figma/AutoAdvanceCountdown.tsx` — reuse as-is
- `src/app/components/celebrations/CompletionModal.tsx` — reuse as-is

**Already wired (no work needed):**
- `useContentProgressStore` — already imported with `getItemStatus`, `setItemStatus`, `loadCourseProgress`
- Auto-complete at >90% — already fires `handleAutoComplete` callback
- Manual status dropdown — already exists

**Key difference from LessonPlayer:** YouTubePlayer triggers completion at >90% via `handleAutoComplete` rather than via an `onEnded` event. Wire auto-advance from this callback, not from a video ended event.

**Risk: Dual progress systems.** YouTubeCourseDetail uses `db.progress` table directly while YouTubeLessonPlayer uses `useContentProgressStore`. The celebration course-completion check should count from `statusMap` (useContentProgressStore) since that is what the lesson player writes to. Verify that YouTubeCourseDetail's checkmarks still reflect correctly — if divergence is found, document it as a known issue for future reconciliation.

## Testing Notes

- Extend existing spec: `tests/e2e/regression/youtube-lesson-player.spec.ts`
- Test auto-advance countdown after auto-complete at >90%
- Test completion modal (lesson vs course level)
- Test prev/next navigation (boundary conditions)
- Test manual status dropdown triggers celebration
- Verify `tests/e2e/regression/youtube-course-detail.spec.ts` still passes (checkmarks unaffected)

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
