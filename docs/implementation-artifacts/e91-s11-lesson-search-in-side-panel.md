---
story_id: E91-S11
story_name: "Lesson Search in Side Panel"
status: done
started: 2026-03-30
completed: 2026-03-30
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.11: Lesson Search in Side Panel

## Story

As a learner navigating a course with many lessons,
I want to search and filter lessons by title in the side panel Lessons tab,
so that I can quickly find a specific lesson without scrolling through a long list.

## Acceptance Criteria

- AC1: Given the Lessons tab in PlayerSidePanel with more than 8 lessons, when the tab renders, then a search input is displayed at the top of the lesson list.
- AC2: Given the search input, when the user types a query, then the lesson list is filtered in real time to show only lessons whose title contains the query (case-insensitive).
- AC3: Given a search query with matches, when matching lessons render, then the matched substring is highlighted using the `<mark>` element (same `bg-warning/30` pattern as ImportedCourseDetail search).
- AC4: Given the search input has text, when the clear button (X icon) is clicked, then the search query is cleared and all lessons are shown again.
- AC5: Given a course with 8 or fewer lessons, when the Lessons tab renders, then the search input is NOT shown (too few to warrant search).
- AC6: Given a search query with no matches, when the list is empty, then an appropriate empty state message is shown (e.g., "No lessons match your search").
- AC7: Given the search input, when focused, then the input receives an `aria-label="Filter lessons by title"` for accessibility.

## Tasks / Subtasks

- [ ] Task 1: Add search state to `LessonsTab` component (AC: 1, 2, 5)
  - [ ] 1.1 Add `const [searchQuery, setSearchQuery] = useState('')`
  - [ ] 1.2 Define `SEARCH_THRESHOLD = 8` constant (same pattern as `ImportedCourseDetail.tsx` line 112)
  - [ ] 1.3 Conditionally render search input when `lessons.length > SEARCH_THRESHOLD`
- [ ] Task 2: Implement filtering logic (AC: 2)
  - [ ] 2.1 Add `const filteredLessons = useMemo(() => { if (!searchQuery) return lessons; const q = searchQuery.toLowerCase(); return lessons.filter(l => l.title.toLowerCase().includes(q)) }, [lessons, searchQuery])`
  - [ ] 2.2 Render `filteredLessons` instead of `lessons` in the list
- [ ] Task 3: Add search input UI (AC: 1, 4, 7)
  - [ ] 3.1 Use `<Input>` component with `type="search"` and `<Search>` icon prefix (same pattern as ImportedCourseDetail lines 337-354)
  - [ ] 3.2 Add clear button (X icon) when `searchQuery` is non-empty
  - [ ] 3.3 `aria-label="Filter lessons by title"`
  - [ ] 3.4 `data-testid="lesson-search-input"`
- [ ] Task 4: Add search highlight (AC: 3)
  - [ ] 4.1 Create `HighlightedText` utility component within `PlayerSidePanel.tsx` (or extract from ImportedCourseDetail pattern at lines 88-110)
  - [ ] 4.2 Wrap lesson title `<p>` with `<HighlightedText text={lesson.title} query={searchQuery} />`
- [ ] Task 5: Add empty search state (AC: 6)
  - [ ] 5.1 When `filteredLessons.length === 0 && searchQuery`, show "No lessons match your search" with `Search` icon
  - [ ] 5.2 `data-testid="lesson-search-empty"`
- [ ] Task 6: E2E tests
  - [ ] 6.1 Course with >8 lessons → search input visible
  - [ ] 6.2 Course with <=8 lessons → search input NOT visible
  - [ ] 6.3 Type query → list filters correctly
  - [ ] 6.4 Clear button → all lessons restored
  - [ ] 6.5 No-match query → empty state shown

## Design Guidance

- Search input: `<Input type="search" placeholder="Search lessons..." className="pl-9 pr-9 rounded-xl" />` with `<Search className="size-4 text-muted-foreground">` positioned absolutely at left
- Clear button: `<X className="size-4">` positioned at right, only visible when query non-empty
- Container: `<div className="px-2 pt-2 pb-1">` above the existing lesson counter text
- Highlight: `<mark className="bg-warning/30 text-inherit rounded-sm px-0.5">`
- Empty state: centered text with `Search` icon, matching `EmptyState` component pattern

## Implementation Notes

- The `LessonsTab` component is defined inside `PlayerSidePanel.tsx` starting at line 411. It receives `courseId`, `lessonId`, `adapter` props.
- The exact same search+filter+highlight pattern already exists in `ImportedCourseDetail.tsx` (lines 130, 204-216, 337-354, 88-110). Replicate that pattern.
- `LessonItem` type from `@/lib/courseAdapter` has `id`, `title`, `type`, `duration`, `order`.
- Ensure the active lesson highlight (`isActive` check) still works when filtering.
- The lesson counter text ("Lesson X of Y") at line 465-469 should reflect total count, not filtered count. Consider showing "X of Y" (total) or "Showing X of Y" when filtering.

## Dependencies

None — can be implemented independently.

## Testing Notes

- Seed a course with 12+ lessons for the search threshold to trigger
- Test both local and YouTube courses
- Verify active lesson remains highlighted when its title matches the search
- Verify search clears when navigating to a different lesson
