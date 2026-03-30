---
story_id: E54-S03
story_name: "Completion Checkmarks in ImportedCourseDetail"
status: in-progress
started: 2026-03-30
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 54.3: Completion Checkmarks in ImportedCourseDetail

## Story

As a learner browsing my imported course,
I want to see completion checkmarks and a progress bar in the course detail sidebar,
So that I can quickly identify which videos I have watched and track my overall course progress.

## Acceptance Criteria

**Given** an imported course detail page
**When** videos have been completed via the lesson player
**Then** a colored StatusIndicator (green check) appears next to each completed video in the list

**Given** an imported course detail page with some videos completed
**When** the page renders
**Then** an "Overall Progress" summary shows "{completed}/{total} completed" with a progress bar

**Given** an imported course where no videos have been watched
**When** the page renders
**Then** all StatusIndicators show as not-started (gray circle) and the progress bar shows 0%

## Tasks / Subtasks

- [ ] Task 1: Add progress store to ImportedCourseDetail (AC: 1, 2, 3)
  - [ ] 1.1 Import `useContentProgressStore` (`loadCourseProgress`, `statusMap`)
  - [ ] 1.2 Call `loadCourseProgress(courseId)` on mount
  - [ ] 1.3 Extract status per video using compound key `courseId:videoId`

- [ ] Task 2: Add StatusIndicator to each video row (AC: 1, 3)
  - [ ] 2.1 Import `StatusIndicator` from `@/app/components/figma/StatusIndicator`
  - [ ] 2.2 Add `<StatusIndicator status={status} itemId={videoId} mode="display" />` before each video title
  - [ ] 2.3 Use `mode="display"` (non-interactive — clicking navigates to lesson, not changes status)
  - [ ] 2.4 Map statuses: green check for completed, blue filled for in-progress, gray circle for not-started

- [ ] Task 3: Add completion count summary and progress bar (AC: 2, 3)
  - [ ] 3.1 Compute `completedCount` from `statusMap` (count entries with status 'completed' for this courseId)
  - [ ] 3.2 Import `Progress` from `@/app/components/ui/progress`
  - [ ] 3.3 Display "{completedCount}/{totalVideos} completed" near the course header
  - [ ] 3.4 Render `<Progress value={percentage} />` bar
  - [ ] 3.5 Follow YouTubeCourseDetail's "Overall Progress" card layout

## Design Guidance

- StatusIndicator in `mode="display"` renders as a colored dot/check — non-interactive
- Progress bar follows the same visual pattern as YouTubeCourseDetail's "Overall Progress" card
- Summary text: "{N}/{M} completed" with a `<Progress>` bar below
- Position progress summary near the course header (above the video list)
- All colors use design tokens — no hardcoded Tailwind colors

## Implementation Notes

**Key files to reference:**
- `src/app/pages/ImportedCourseDetail.tsx` — target file (needs checkmarks added)
- `src/app/pages/YouTubeCourseDetail.tsx` — reference for progress card layout (has CheckCircle2 + progress bars)
- `src/app/pages/CourseDetail.tsx` — reference for ModuleAccordion + StatusIndicator pattern
- `src/app/components/figma/StatusIndicator.tsx` — reuse in display mode
- `src/app/components/ui/progress.tsx` — shadcn progress bar
- `src/stores/useContentProgressStore.ts` — progress store

**Pattern notes:**
- ImportedCourseDetail uses a flat list of imported videos (no modules)
- StatusIndicator goes inline before each video title in the list
- `statusMap` uses compound key format `courseId:videoId`
- YouTubeCourseDetail already has its own checkmarks via CheckCircle2 — no changes needed there

## Testing Notes

- New or extend: `tests/e2e/regression/imported-course-detail.spec.ts`
- Test StatusIndicator shows correct status per video (completed, in-progress, not-started)
- Test progress bar reflects correct percentage
- Test with zero completions (all gray, 0%)
- Test with all completions (all green, 100%)
- Verify progress updates when navigating back from lesson player after completing a video

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
