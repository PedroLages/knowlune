---
story_id: E02-S05
story_name: "Course Structure Navigation"
status: in-progress
started: 2026-02-21
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 2.5: Course Structure Navigation

## Story

As a learner,
I want to see the full course structure and navigate between videos and PDFs within a course,
So that I can browse the curriculum and jump to any lesson.

## Acceptance Criteria

**AC1: Collapsible ModuleAccordion in sidebar**
**Given** the user is on the Lesson Player page
**When** the course sidebar/panel is visible
**Then** the full course structure is displayed as a collapsible ModuleAccordion
**And** each module shows its title, lesson count, and completion status

**AC2: Lesson details in course structure**
**Given** the course structure is displayed
**Then** each lesson shows its title, duration (videos) or page count (PDFs), and type icon (video/PDF)

**AC3: Switch lessons without page reload**
**Given** the user is viewing a lesson
**When** the user clicks a different lesson in the course structure
**Then** the Lesson Player switches to the selected lesson without full page reload
**And** the current lesson is highlighted in the course structure list

**AC4: Next Lesson button**
**Given** the user completes the current video
**When** they want to continue to the next lesson
**Then** a "Next Lesson" button is visible that loads the next lesson in sequence

**AC5: Auto-advance 5s countdown with cancel**
**Given** the user completes the current video
**When** auto-advance triggers
**Then** a 5-second countdown is visible with a cancel option
**And** auto-advance navigates to the next lesson after countdown

**AC6: Mobile Sheet panel**
**Given** the course structure on mobile (< 640px)
**When** the user wants to navigate
**Then** the course structure is accessible via a slide-out panel (Sheet component)
**And** the panel can be opened/closed without losing video state

## Tasks / Subtasks

- [ ] Task 1: Enhance ModuleAccordion with active lesson support (AC: 1, 3)
  - [ ] 1.1 Add `activeLessonId` prop
  - [ ] 1.2 Highlight active lesson with blue background
  - [ ] 1.3 Auto-expand module containing active lesson
- [ ] Task 2: Replace LessonList with ModuleAccordion in LessonPlayer (AC: 1, 2, 3, 6)
  - [ ] 2.1 Swap desktop sidebar component
  - [ ] 2.2 Swap mobile Sheet component
- [ ] Task 3: Build AutoAdvanceCountdown component (AC: 5)
  - [ ] 3.1 Create component with countdown timer
  - [ ] 3.2 Add cancel button
  - [ ] 3.3 Add accessibility (role="status", aria-live)
  - [ ] 3.4 Respect prefers-reduced-motion
- [ ] Task 4: Integrate auto-advance into LessonPlayer (AC: 4, 5)
  - [ ] 4.1 Add showAutoAdvance state
  - [ ] 4.2 Wire up video end → countdown → navigate flow
  - [ ] 4.3 Clear countdown on lesson change
- [ ] Task 5: Verify and polish (AC: 1-6)

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

See [plan](../../.claude/plans/noble-dazzling-beacon.md) for implementation approach.
