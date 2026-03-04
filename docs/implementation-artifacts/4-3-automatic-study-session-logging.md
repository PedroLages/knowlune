---
story_id: E04-S03
story_name: "Automatic Study Session Logging"
status: done
started: 2026-03-03
completed: 2026-03-04
reviewed: true    # false | in-progress | true
review_started: 2026-03-04  # YYYY-MM-DD — set when /review-story begins
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]  # tracks completed gates: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 4.3: Automatic Study Session Logging

## Story

As a learner,
I want my study sessions to be automatically tracked with date, duration, and content covered,
so that I can understand my study habits without manual effort and see my total study time across all courses.

## Acceptance Criteria

**Given** a user navigates into a course's focused content interface
**When** the content interface mounts
**Then** a new study session record is created in the Zustand session store with the current date, start timestamp, course ID, and content item ID
**And** the session is persisted to Dexie.js IndexedDB

**Given** an active study session is in progress
**When** the user navigates away from the content interface, closes the tab, or the browser fires a visibilitychange event to hidden
**Then** the session end timestamp is recorded and the duration is calculated
**And** the session record is updated with: total duration, list of videos watched, and pages viewed during the session

**Given** an active study session is in progress
**When** the user is idle for more than 5 minutes (no mouse, keyboard, or touch events)
**Then** the session is automatically paused
**And** idle time is excluded from the session duration
**And** when the user resumes activity, the session continues without creating a new record

**Given** multiple study sessions have been logged across different courses
**When** the user views their total study time
**Then** the system displays an aggregate total study time calculated from all session durations across all courses
**And** per-course study time totals are also available

**Given** the user's browser crashes or is force-closed during an active session
**When** the application next loads
**Then** the system detects any orphaned session records (sessions with a start time but no end time)
**And** closes them with the last known activity timestamp as the end time

## Tasks / Subtasks

- [ ] Task 1: Create study session data schema and Zustand store (AC: 1, 2, 3, 4, 5)
  - [ ] 1.1 Define StudySession type in TypeScript
  - [ ] 1.2 Create Zustand store with session state and actions
  - [ ] 1.3 Add Dexie.js table for sessions
  - [ ] 1.4 Implement session CRUD operations

- [ ] Task 2: Implement automatic session start on content mount (AC: 1)
  - [ ] 2.1 Add session start hook in LessonPlayer component
  - [ ] 2.2 Create session record with course/content metadata
  - [ ] 2.3 Persist to IndexedDB

- [ ] Task 3: Implement session end detection (AC: 2)
  - [ ] 3.1 Add visibilitychange event listener
  - [ ] 3.2 Add beforeunload/pagehide handlers
  - [ ] 3.3 Calculate and save session duration
  - [ ] 3.4 Track content items accessed during session

- [ ] Task 4: Implement idle detection and auto-pause (AC: 3)
  - [ ] 4.1 Create idle timer using mouse/keyboard/touch events
  - [ ] 4.2 Pause session after 5 minutes of inactivity
  - [ ] 4.3 Resume session on user activity
  - [ ] 4.4 Exclude idle time from duration calculation

- [ ] Task 5: Implement aggregate study time display (AC: 4)
  - [ ] 5.1 Create function to calculate total study time
  - [ ] 5.2 Add per-course study time calculation
  - [ ] 5.3 Display totals in UI (location TBD)

- [ ] Task 6: Implement orphaned session detection (AC: 5)
  - [ ] 6.1 Check for orphaned sessions on app load
  - [ ] 6.2 Close orphaned sessions with last activity timestamp
  - [ ] 6.3 Add last_activity_timestamp field to session records

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

See [plan](plans/partitioned-mixing-blum.md) for implementation approach.
