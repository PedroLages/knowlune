---
story_id: E22-S05
story_name: "Dynamic Filter Chips from AI Tags"
status: in-progress
started: 2026-03-22
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 22.05: Dynamic Filter Chips from AI Tags

## Story

As a user,
I want the Courses page to show filter chips based on AI-generated tags from my imported courses,
so that I can quickly find courses by topic across my entire library.

## Acceptance Criteria

- **AC1**: Given I have imported courses with AI-generated tags, When I view the Courses page, Then filter chips include both pre-seeded course categories AND imported course AI tags
- **AC2**: Given multiple courses share the same tag, When filter chips render, Then chips are deduplicated and sorted by frequency (most courses first)
- **AC3**: Given I click a filter chip, When the courses filter, Then BOTH imported courses and pre-seeded courses matching that tag/category are shown
- **AC4**: Given I have active filters, When I click "Clear filters", Then all filters reset and all courses are shown
- **AC5**: Given I just imported a new course with AI tags, When tagging completes, Then the new tags appear in the filter chips without requiring a page refresh

## Tasks / Subtasks

- [ ] Task 1: Merge tag sources (AC: 1, 2)
  - [ ] 1.1 In `Courses.tsx`, extract AI tags from imported courses via `useCourseImportStore`
  - [ ] 1.2 Merge imported course tags with pre-seeded `categoryLabels` into unified chip list
  - [ ] 1.3 Deduplicate tags (case-insensitive comparison)
  - [ ] 1.4 Sort chips: "All" first, then by frequency (how many courses match each tag)
- [ ] Task 2: Unified filtering logic (AC: 3)
  - [ ] 2.1 Update `selectedCategory` state to handle both category slugs and free-text AI tags
  - [ ] 2.2 Filter pre-seeded courses by `course.category` match
  - [ ] 2.3 Filter imported courses by `course.tags` includes match
  - [ ] 2.4 Display both course types in a single grid when filtered
- [ ] Task 3: Clear filters (AC: 4)
  - [ ] 3.1 Add "Clear filters" button (already exists in TopicFilter pattern)
  - [ ] 3.2 Reset `selectedCategory` to empty string (show all)
- [ ] Task 4: Reactive updates (AC: 5)
  - [ ] 4.1 Ensure `useCourseImportStore` reactivity triggers re-render when tags update
  - [ ] 4.2 New tags from async auto-tagging should appear in chips without manual refresh
  - [ ] 4.3 Test with Zustand subscription to verify reactivity

## Design Guidance

- Filter chips should use the same styling as current ToggleGroup implementation
- AI-generated tags use same pill style as pre-seeded categories — no visual distinction needed
- Consider showing tag count in parentheses: "Python (3)" — optional, only if it doesn't clutter
- "Clear filters" link appears only when a filter is active (same as TopicFilter pattern)

## Implementation Notes

- Pre-seeded course categories use `CourseCategory` type and `categoryLabels` map
- Imported course tags are free-text strings in `course.tags: string[]`
- Need case-insensitive dedup: "python" and "Python" should merge into one chip
- Display label: use the most common casing, or title-case normalize
- This story builds on the dynamic filter chips already implemented in this session
- The ToggleGroup with `type="single"` is already in place — extend its data source

## Testing Notes

- Unit test: Tag merging deduplicates correctly (case-insensitive)
- Unit test: Frequency sorting puts most common tags first
- E2E: Filter chips show both pre-seeded and imported tags
- E2E: Clicking a tag filters both course types
- E2E: New import triggers chip list update without refresh
- Edge case: No imported courses (only pre-seeded chips), no pre-seeded courses (only AI chips), both empty

## Implementation Plan

[2026-03-22-e22-s05-dynamic-filter-chips-from-ai-tags.md](plans/2026-03-22-e22-s05-dynamic-filter-chips-from-ai-tags.md)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] Read [engineering-patterns.md](../engineering-patterns.md)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
