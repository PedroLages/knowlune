---
story_id: E1C-S05
story_name: "Momentum Sort for Imported Courses"
status: in-progress
started: 2026-03-26
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 1C.05: Momentum Sort for Imported Courses

## Story

As a learner,
I want to sort my imported courses by momentum,
so that I can quickly find the courses I'm most actively studying.

## Acceptance Criteria

- AC1: "Sort by Momentum" in sort dropdown -> imported courses sorted by momentum score (highest first)
- AC2: Courses with no study activity appear at end of the list
- AC3: Switch to "Most Recent" -> sort by importedAt (newest first)
- AC4: Zero-momentum courses sorted by importedAt among themselves
- AC5: Momentum sort works alongside active topic/status filters

## Tasks / Subtasks

- [ ] Task 1: Lift sort dropdown to shared position above both sections (AC: 1,3)
- [ ] Task 2: Apply momentum sort to imported courses with tiebreaker (AC: 1,2,4)
- [ ] Task 3: Verify sort interacts correctly with filters (AC: 5)
- [ ] Task 4: Add unit tests for sort logic

## Design Guidance

- Reuse existing sort dropdown pattern from sample courses section
- Design tokens only, no hardcoded colors
- WCAG AA+ compliance

## Lessons Learned

(to be filled after implementation)
