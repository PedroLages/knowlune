---
story_id: E03-S02
story_name: "Side-by-Side Study Layout"
status: in-progress
started: 2026-02-26
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 3.2: Side-by-Side Study Layout

## Story

As a learner,
I want to see the video player and note editor side-by-side on desktop,
So that I can watch and take notes simultaneously without context switching.

## Acceptance Criteria

**AC1** — Desktop resizable split
**Given** the user is on the Lesson Player page on desktop (>= 1024px)
**When** the note editor is open
**Then** the layout shows video player (60% width) and note editor (40% width) side by side
**And** the split is resizable via a drag handle (shadcn/ui Resizable component)
**And** minimum width for each panel prevents content from being unusably small

**AC2** — Notes panel collapsed by default with toggle
**Given** the user navigates to a lesson directly (not via "Continue Learning")
**When** the Lesson Player loads on desktop
**Then** the notes panel is collapsed by default with a toggle button to expand
**And** if the lesson has existing notes, a subtle indicator shows "Notes available"

**AC3** — URL param auto-opens notes
**Given** the user navigates via "Continue Learning" or with `?panel=notes` URL param
**When** the Lesson Player loads
**Then** the notes panel opens automatically with existing notes pre-loaded

**AC4** — Tablet stacked layout
**Given** the user is on tablet (640px-1023px)
**When** the note editor is open
**Then** the layout stacks video on top, notes below
**And** a toggle button allows switching between video-focused and notes-focused view

**AC5** — Mobile full-screen notes
**Given** the user is on mobile (< 640px)
**When** the note editor is open
**Then** the video and notes are fully stacked (video top, notes bottom)
**And** the note editor can expand to full screen for focused note-taking

**AC6** — Regression
**Given** the side-by-side layout has been implemented
**When** the Epic 2 E2E tests run
**Then** all existing LessonPlayer E2E tests pass, including mini-player and theater mode
**And** the following testids are preserved: `video-anchor`, `mini-player`, `lesson-content-scroll`, `desktop-sidebar`
**And** the single scroll container for IntersectionObserver mini-player detection is maintained
**And** VideoPlayer props `onPlayStateChange`, `theaterMode`, `onTheaterModeToggle`, `chapters`, `captions` remain wired from LessonPlayer

## Tasks / Subtasks

- [ ] Task 1: Convert Tabs to controlled component (AC3)
- [ ] Task 2: Add notes panel state and URL param support (AC2, AC3)
- [ ] Task 3: Desktop resizable layout (AC1, AC2)
- [ ] Task 4: Notes toggle button with indicator (AC2)
- [ ] Task 5: Gate Notes tab when side panel open (AC1)
- [ ] Task 6: Hide course sidebar when notes open (AC1)
- [ ] Task 7: Tablet stacked layout (AC4)
- [ ] Task 8: Mobile full-screen notes (AC5)
- [ ] Task 9: Regression verification (AC6)
- [ ] Task 10: ATDD E2E tests

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Implementation Plan

See [plan](../../.claude/plans/groovy-puzzling-moth.md) for implementation approach.
