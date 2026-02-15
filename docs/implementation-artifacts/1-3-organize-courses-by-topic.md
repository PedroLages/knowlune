---
story_id: E01-S03
story_name: "Organize Courses by Topic"
status: done
started: 2026-02-15
completed: 2026-02-15
reviewed: true
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

**Reviewed 2026-02-15** — 11 issues (2 blockers [systemic/pre-existing], 2 high, 3 medium, 4 nits)

Blockers are systemic: `bg-blue-600` vs `--primary` theme token mismatch exists across entire codebase, not introduced by this story.

### Key findings

1. TopicFilter button missing `focus-visible:ring-*` for keyboard users (high)
2. Tag badge height `h-5` non-standard; popover width `w-56` may be narrow (medium)
3. Accessibility praised: proper ARIA, `aria-pressed`, `role="group"`, semantic HTML

Full report: `docs/reviews/design/design-review-2026-02-15-e01-s03.md`

## Code Review Feedback

**Reviewed 2026-02-15** — 10 issues (0 blockers, 4 high, 4 medium, 4 nits)

### High Priority
1. `ImportedCourseCard.tsx:14` — `getAllTags()` recomputed per card. Lift to parent and pass as prop.
2. `useCourseImportStore.ts:46-65` — `addImportedCourse` doesn't normalize tags.
3. `useCourseImportStore.test.ts` — Missing unit tests for `updateCourseTags` and `getAllTags`.
4. `Courses.test.tsx:30-41` — Store mock missing `updateCourseTags` and `getAllTags`.

### Medium
1. `TagBadgeList.tsx:18` — Use `cn()` utility instead of string interpolation.
2. `TagEditor.tsx` — No max tag limit.
3. `TagEditor.tsx:51`, `TagBadgeList.tsx:37` — Use Tailwind v4 `size-5` shorthand.
4. `TopicFilter.tsx:41` — Hardcoded colors (acceptable per project convention).

### Nits
1. Lone "+" button margin when no tags. 2. `create-` prefix collision potential.
3. `toLocaleDateString()` without format options. 4. Non-obvious memo dependency.

Full report: `docs/reviews/code/code-review-2026-02-15-e01-s03.md`

## Challenges and Lessons Learned

1. **Lift computed values out of list items.** `getAllTags()` was called inside each `ImportedCourseCard`, recomputing on every render. Compute once in the parent and pass as a prop. Watch for this pattern whenever a store getter appears inside a mapped component.

2. **Systemic theme token debt.** Design review flagged `bg-blue-600` vs `--primary` as a blocker, but the mismatch exists across the entire codebase — not introduced by this story. Worth a dedicated cleanup story to replace hardcoded Tailwind color classes with CSS custom property references.

3. **Tag normalization matters early.** `addImportedCourse` accepted raw tags without trimming or lowercasing. Normalize at the store boundary to prevent "React" and "react" from becoming separate tags.

4. **Autocomplete needs a ceiling.** `TagEditor` has no max tag limit per course. Not a problem with small libraries, but worth adding a cap (e.g., 10) before tag counts grow.

5. **Workflow skills need idempotent steps.** `/start-story` and `/review-story` failed on re-run after interruption. Made all steps check-before-act (branch exists? skip creation; file exists? skip writing). Saves time when resuming after context loss.
