---
story_id: E01-S03
story_name: "Organize Courses by Topic"
status: in-progress
started: 2026-02-15
completed:
reviewed: false
---

# Story 1.3: Organize Courses by Topic

## Story

As a learner,
I want to tag my courses with topics and filter the library by subject,
So that I can find related courses quickly as my library grows.

## Acceptance Criteria

**Given** the user is viewing a course card or course detail
**When** the user adds topic tags (e.g., "React", "TypeScript", "System Design")
**Then** the tags are persisted in IndexedDB on the course record
**And** tags are displayed as badges on the course card
**And** tags use the Dexie.js multi-entry index (`*tags`) for efficient querying

**Given** the user has tagged courses with various topics
**When** the user selects a topic filter on the Courses page
**Then** only courses matching the selected topic are displayed
**And** the filter can be cleared to show all courses again

**Given** the user wants to manage tags
**When** the user edits tags on a course
**Then** existing tags can be removed and new tags added
**And** tag input supports autocomplete from previously used tags across all courses

## Tasks / Subtasks

- [ ] Task 1: Add `updateCourseTags` and `getAllTags` to Zustand store (AC: 1, 3)
  - [ ] 1.1 Add `updateCourseTags(courseId, tags)` with optimistic update + rollback
  - [ ] 1.2 Add `getAllTags()` computed getter for unique sorted tags
- [ ] Task 2: Create `TagBadgeList` component (AC: 1)
  - [ ] 2.1 Render tags as Badge components with optional remove button
  - [ ] 2.2 Support `maxVisible` truncation with "+N more"
- [ ] Task 3: Create `TagEditor` component (AC: 3)
  - [ ] 3.1 Popover + Command autocomplete for adding tags
  - [ ] 3.2 Create-new-tag option when input doesn't match existing
- [ ] Task 4: Create `TopicFilter` component (AC: 2)
  - [ ] 4.1 Horizontal row of clickable tag badges with selected/unselected states
  - [ ] 4.2 "Clear filters" button when any tags selected
- [ ] Task 5: Integrate into `ImportedCourseCard` (AC: 1, 3)
  - [ ] 5.1 Add TagBadgeList with maxVisible=3 and remove handler
  - [ ] 5.2 Add TagEditor "+" button with autocomplete
- [ ] Task 6: Integrate topic filter into `Courses.tsx` (AC: 2)
  - [ ] 6.1 Add selectedTopics state and TopicFilter component
  - [ ] 6.2 Update filteredImportedCourses memo with AND-logic topic filter
- [ ] Task 7: Write E2E tests
- [ ] Task 8: Write unit tests

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
