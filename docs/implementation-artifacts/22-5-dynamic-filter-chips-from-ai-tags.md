---
story_id: E22-S05
story_name: "Dynamic Filter Chips from AI Tags"
status: done
started: 2026-03-23
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing]
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

## Implementation Plan

See [docs/plans/2026-03-23-e22-s05-dynamic-filter-chips.md](../plans/2026-03-23-e22-s05-dynamic-filter-chips.md)

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

- **Case-insensitive normalization must be end-to-end.** Tag deduplication normalized to lowercase for chip display, but the filter comparison on imported courses used exact `includes()`. Always trace the normalized value through every comparison site, not just the display layer.
- **E2E `hasText` substring matching causes false positives.** Short tag names like "ai" matched substrings in other button labels (e.g., "entrainment"). Use regex with word boundaries (`/^ai\b/`) for short filter text in Playwright locators.
- **`seedAndReload` localStorage access before navigation fails.** Setting localStorage via `page.evaluate` on `about:blank` triggers SecurityError. Use `addInitScript` instead, which runs after navigation when the page origin is established.
- **Zustand store subscriptions provide free reactivity for tag updates.** No special subscription or effect was needed for AC5 (reactive tag appearance) — the `useCourseImportStore` hook re-renders the component automatically when tags are added post-import.
