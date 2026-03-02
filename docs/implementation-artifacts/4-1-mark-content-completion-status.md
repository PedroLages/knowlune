---
story_id: E04-S01
story_name: "Mark Content Completion Status"
status: in-progress
started: 2026-03-02
completed:
reviewed: false
review_started:
review_gates_passed: []
---

# Story 4.1: Mark Content Completion Status

## Story

As a learner,
I want to mark videos and chapters as Not Started, In Progress, or Completed with clear color-coded indicators,
So that I can visually track my progress through course content at a glance.

## Acceptance Criteria

**AC1: Status selector**
**Given** a user is viewing a course's content structure panel
**When** they click on a video or chapter's status indicator
**Then** a status selector appears with three options: Not Started, In Progress, and Completed
**And** each option displays its corresponding color: gray for Not Started, blue for In Progress, green for Completed

**AC2: Atomic state change with optimistic update**
**Given** a user selects a new completion status for a content item
**When** the status change is confirmed
**Then** the state change is atomic — the UI updates optimistically via the Zustand store and persists to Dexie.js IndexedDB
**And** if the IndexedDB write fails, the Zustand state rolls back to the previous value
**And** no partial or inconsistent state is ever visible to the user

**AC3: Color-coded visual indicators**
**Given** a content item has a completion status
**When** the course structure panel renders
**Then** the item displays a color-coded visual indicator: gray circle for Not Started, blue circle for In Progress, green circle with checkmark for Completed
**And** each indicator uses sufficient color contrast (WCAG 2.1 AA) and includes a text label or tooltip for accessibility

**AC4: Auto-complete parent chapter**
**Given** a user marks the last incomplete item in a chapter as Completed
**When** the state updates
**Then** the parent chapter status automatically updates to Completed
**And** the chapter's visual indicator changes to green

**AC5: Auto-revert parent chapter**
**Given** a user changes a Completed item back to In Progress or Not Started
**When** the state updates
**Then** any parent chapter that was auto-completed reverts to In Progress
**And** dependent progress calculations update immediately

## Tasks / Subtasks

- [ ] Task 1: Create completion status data model in Dexie (AC: 2)
  - [ ] 1.1 Add ContentProgress table to Dexie schema
  - [ ] 1.2 Define TypeScript types for completion status
- [ ] Task 2: Create Zustand progress store with optimistic updates (AC: 2)
  - [ ] 2.1 Create progress store with status getters/setters
  - [ ] 2.2 Implement optimistic update with rollback on Dexie failure
  - [ ] 2.3 Implement parent chapter auto-completion logic (AC: 4, 5)
- [ ] Task 3: Build status indicator component (AC: 1, 3)
  - [ ] 3.1 Create StatusIndicator component with color-coded circles
  - [ ] 3.2 Add tooltip/text label for accessibility
- [ ] Task 4: Build status selector popover (AC: 1)
  - [ ] 4.1 Create StatusSelector popover with three options
  - [ ] 4.2 Wire to Zustand store actions
- [ ] Task 5: Integrate into course structure panel (AC: 1, 3, 4, 5)
  - [ ] 5.1 Add StatusIndicator to course structure navigation items
  - [ ] 5.2 Add click handler to open StatusSelector
  - [ ] 5.3 Verify parent chapter cascade behavior

## Implementation Plan

See [plan](../../.claude/plans/robust-noodling-sedgewick.md) for implementation approach.

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
