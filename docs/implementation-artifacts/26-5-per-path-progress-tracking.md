---
story_id: E26-S05
story_name: "Per Path Progress Tracking"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 26.5: Per Path Progress Tracking

## Story

As a learner enrolled in one or more learning paths,
I want to see my completion progress for each path (overall and per-stage),
so that I understand how far I've come and what remains in each learning journey.

## Acceptance Criteria

**AC1: Path-level completion percentage**
Given a learning path containing N courses across one or more stages
When I view the learning path (list or detail view)
Then I see an overall completion percentage calculated as: (completed courses / total courses) × 100
And the percentage updates in real-time when I complete a course lesson

**AC2: Stage-level completion indicators**
Given a learning path with multiple stages (e.g., "Foundations", "Intermediate", "Advanced")
When I view the path detail page
Then each stage shows its own completion percentage and a visual progress bar
And completed stages show a checkmark badge

**AC3: Course-level progress within path**
Given a course appears in a learning path
When I view the path detail page
Then each course card shows its individual completion percentage (lessons completed / total lessons)
And the percentage matches the existing course progress from the content progress system

**AC4: Progress summary on path list view**
Given I have multiple learning paths
When I view the learning paths list page
Then each path card shows: overall completion %, courses completed count (e.g., "3/8 courses"), and a progress bar
And paths are sortable by completion percentage

**AC5: Path completion celebration**
Given a learning path reaches 100% completion (all courses in all stages completed)
When the final course lesson is marked complete
Then a celebration toast/animation appears congratulating the learner
And the path card shows a "Completed" badge with the completion date

**AC6: Empty/zero progress state**
Given a learning path where no courses have been started
When I view the path
Then the overall progress shows 0% with messaging like "Start your first course to begin tracking"
And course cards show "Not started" status indicators

**AC7: Progress persistence and accuracy**
Given progress is tracked via the existing contentProgress IndexedDB table
When I reload the page or navigate away and return
Then all path progress percentages are accurately restored from persisted data
And there is no progress data duplication or drift

## Dependencies

- **E26-S01** (Multi-Path Data Model and Migration) — provides the `learningPaths` table, path-course associations, and stage definitions
- **E26-S02** (Learning Path List View) — provides the list page where path-level progress is displayed
- **E26-S03** (Path Detail View with Drag-Drop Editor) — provides the detail page where stage/course-level progress is displayed
- **E26-S04** (AI Path Placement Suggestion) — may influence course ordering within paths

## Tasks / Subtasks

- [ ] Task 1: Create path progress calculation utilities (AC: 1, 2, 3, 7)
  - [ ] 1.1 Create `src/lib/pathProgress.ts` with pure functions for computing per-path, per-stage, and per-course progress
  - [ ] 1.2 Integrate with existing `contentProgress` store for per-course completion data
  - [ ] 1.3 Handle edge cases: empty paths, courses with 0 lessons, removed courses

- [ ] Task 2: Create `usePathProgressStore` or extend existing store (AC: 1, 7)
  - [ ] 2.1 Zustand store that aggregates contentProgress data into path-level metrics
  - [ ] 2.2 Reactive updates when underlying course progress changes
  - [ ] 2.3 Persist-on-read pattern (no new DB table — derived from existing data)

- [ ] Task 3: Add progress UI to path list view (AC: 4, 6)
  - [ ] 3.1 Progress bar component on each path card
  - [ ] 3.2 "X/Y courses completed" count
  - [ ] 3.3 Sort-by-completion option
  - [ ] 3.4 Empty/zero progress state messaging

- [ ] Task 4: Add progress UI to path detail view (AC: 2, 3, 6)
  - [ ] 4.1 Overall path progress bar at top of detail page
  - [ ] 4.2 Per-stage progress bars with completion badges
  - [ ] 4.3 Per-course completion percentage on course cards
  - [ ] 4.4 "Not started" state indicators

- [ ] Task 5: Path completion celebration (AC: 5)
  - [ ] 5.1 Detect 100% completion transition
  - [ ] 5.2 Celebration toast/animation (reuse existing streak celebration pattern)
  - [ ] 5.3 "Completed" badge with date on path card

- [ ] Task 6: E2E tests (AC: all)
  - [ ] 6.1 Test progress calculation with seeded course progress data
  - [ ] 6.2 Test progress updates when marking lessons complete
  - [ ] 6.3 Test completion celebration flow
  - [ ] 6.4 Test persistence across navigation

## Design Guidance

### Layout Approach
- **Path list view**: Add progress bar below path description, "X/Y courses" subtitle
- **Path detail view**: Full-width progress bar in header area, per-stage collapsible sections with individual progress bars
- **Course cards within path**: Circular or linear progress indicator showing completion %

### Component Structure
- `PathProgressBar` — reusable linear progress bar with percentage label (uses existing `Progress` shadcn component)
- `StageProgressSection` — collapsible stage with progress bar and course list
- `PathCompletionBadge` — "Completed" badge overlay for finished paths

### Design System Usage
- Progress bars: `bg-brand` fill on `bg-brand-soft` track
- Completed badges: `bg-success` with `text-success-foreground`
- "Not started" indicators: `text-muted-foreground`
- Celebration: Reuse `sonner` toast with confetti-style messaging

### Responsive Strategy
- Progress bars scale to container width
- Mobile: Stack progress info vertically below path title
- Desktop: Progress bar inline with path metadata

### Accessibility
- Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Screen reader text: "Path X: Y% complete, Z of N courses finished"
- Completion celebration uses `aria-live="polite"` announcement

## Implementation Notes

### Key Architecture Decision: Derived vs. Stored Progress
Path progress should be **derived** from existing `contentProgress` data, not stored separately. This avoids data duplication and ensures consistency with the source of truth (individual lesson completion).

### Progress Calculation Strategy
```
pathCompletion = sum(courseCompletionPercents) / numberOfCourses
stageCompletion = sum(stageCourseCompletionPercents) / numberOfCoursesInStage
courseCompletion = completedLessons / totalLessons (already computed by progress.ts)
```

### Integration Points
- `useContentProgressStore` — source of per-course lesson completion
- `progress.ts:getCourseCompletionPercent()` — existing per-course % calculation
- `useCourseImportStore` — course metadata (lesson counts, structure)
- Path data model from E26-S01 — path definitions, stage structure, course assignments

## Testing Notes

- Seed IndexedDB with multi-path data (from E26-S01 schema) and contentProgress records
- Use deterministic test data: paths with 0%, 50%, 100% completion scenarios
- Test reactive updates: mark lesson complete → verify path % recalculates
- Test edge cases: path with deleted course, course with 0 lessons, single-course path

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

## Plan

See [implementation plan](plans/e26-s05-per-path-progress-tracking.md)
