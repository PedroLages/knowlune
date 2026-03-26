---
story_id: E1C-S05
story_name: "Momentum Sort for Imported Courses"
status: done
started: 2026-03-26
completed: 2026-03-26
reviewed: true
review_started: 2026-03-26
review_gates_passed: [build, lint, type-check, unit-tests]
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

- [x] Task 1: Lift sort dropdown to shared position above both sections (AC: 1,3)
- [x] Task 2: Apply momentum sort to imported courses with tiebreaker (AC: 1,2,4)
- [x] Task 3: Verify sort interacts correctly with filters (AC: 5)
- [x] Task 4: Add unit tests for sort logic + fix pre-existing test mock gaps

## Design Guidance

- Reuse existing sort dropdown pattern from sample courses section
- Design tokens only, no hardcoded colors
- WCAG AA+ compliance

## Lessons Learned

- **Sort dropdown placement matters for UX**: Moving the sort dropdown from inside the sample courses collapsible to the shared filter bar ensures it applies to both imported and sample courses. Previously, users with collapsed sample courses would never see the sort control.
- **Pre-existing test mock drift**: The Courses.test.tsx mocks were missing `getTagsWithCounts`, `renameTagGlobally`, and `deleteTagGlobally` from the store, plus `db.studySessions` from the DB mock. This caused all 16 tests to fail silently (the test file was likely not being run regularly). Fixing mock drift should be part of any story touching shared components.
- **useMemo for sort stability**: Wrapping the sort in `useMemo` with proper dependencies (`filteredImportedCourses`, `sortMode`, `momentumMap`) prevents unnecessary re-sorts on unrelated state changes. The previous inline `.sort()` call ran on every render.
- **Tiebreaker design**: Using `importedAt` as the tiebreaker for equal momentum scores (including zero-momentum) provides a stable, predictable secondary sort that matches user expectations (newer courses first when momentum is equal).
