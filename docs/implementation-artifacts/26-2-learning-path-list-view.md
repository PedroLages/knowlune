---
story_id: E26-S02
story_name: "Learning Path List View"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 26.2: Learning Path List View

## Story

As a learner who wants structured learning direction,
I want to browse all available learning paths in a card-based list view,
So that I can discover, compare, and enroll in multi-course learning journeys.

## Acceptance Criteria

**AC1: Learning Paths page route and navigation**

**Given** the app loads
**When** I click "Learning Paths" in the sidebar navigation
**Then** I navigate to `/learning-paths`
**And** the sidebar item shows as active
**And** the page loads with a heading "Learning Paths" at level 1

**AC2: Path cards display metadata**

**Given** one or more learning paths exist in IndexedDB
**When** the Learning Paths page loads
**Then** each path is displayed as a card showing: title, description (truncated to 2 lines), total course count (sum across all stages), total estimated hours, enrollment status badge, and completion progress (if enrolled)
**And** cards are arranged in a responsive grid (1 column mobile, 2 tablet, 3 desktop)

**AC3: Enrollment status badges**

**Given** a learning path card is displayed
**When** the user views the card
**Then** enrolled paths show a "Enrolled" badge with a brand-soft background
**And** non-enrolled paths show no enrollment badge
**And** paths where all stages are complete show a "Completed" badge with a success background

**AC4: Progress indicator for enrolled paths**

**Given** the user is enrolled in a learning path
**When** the card is displayed
**Then** a progress bar shows the percentage of completed courses across all stages
**And** the progress label shows "X of Y courses completed"

**AC5: Empty state when no paths exist**

**Given** no learning paths exist in IndexedDB
**When** the user navigates to `/learning-paths`
**Then** an empty state is displayed with the `EmptyState` component
**And** the icon is `Route` (from lucide-react)
**And** the title is "No learning paths yet"
**And** the description is "Create your first learning path to organize courses into a structured journey"
**And** an action button "Create Path" is shown that navigates to the path creation flow

**AC6: Card click navigates to detail view**

**Given** a learning path card is displayed
**When** the user clicks the card
**Then** the app navigates to `/learning-paths/:pathId`
**And** (the detail view is handled by E26-S03 — for now, render a placeholder)

**AC7: Source indicator on cards**

**Given** a learning path has a `source` field
**When** the card is displayed
**Then** AI-generated paths show a Sparkles icon with "AI Generated" label
**And** manually created paths show no source indicator
**And** curated paths show a BookOpen icon with "Curated" label

**AC8: Archived paths are hidden**

**Given** some learning paths have `isArchived: true`
**When** the page loads
**Then** archived paths are NOT displayed in the list
**And** only non-archived paths appear

## Tasks / Subtasks

- [ ] Task 1: Create `LearningPaths` page component (AC: 1, 2, 5, 8)
  - [ ] 1.1 Create `src/app/pages/LearningPaths.tsx` with page layout
  - [ ] 1.2 Load paths from `useLearningPathsStore` (filter out archived)
  - [ ] 1.3 Load enrollments for badge/progress display
  - [ ] 1.4 Implement empty state with `EmptyState` component

- [ ] Task 2: Create `LearningPathCard` component (AC: 2, 3, 4, 6, 7)
  - [ ] 2.1 Create `src/app/components/figma/LearningPathCard.tsx`
  - [ ] 2.2 Display title, description, course count, estimated hours
  - [ ] 2.3 Add enrollment status badge (Enrolled / Completed / none)
  - [ ] 2.4 Add progress bar for enrolled paths
  - [ ] 2.5 Add source indicator (AI / Curated / none)
  - [ ] 2.6 Navigate to `/learning-paths/:pathId` on click

- [ ] Task 3: Add route and navigation (AC: 1)
  - [ ] 3.1 Add lazy import and route in `src/app/routes.tsx`
  - [ ] 3.2 Update navigation item in `src/app/config/navigation.ts`

- [ ] Task 4: Add detail route placeholder (AC: 6)
  - [ ] 4.1 Create `src/app/pages/LearningPathDetail.tsx` placeholder
  - [ ] 4.2 Add route for `/learning-paths/:pathId`

- [ ] Task 5: E2E tests (AC: 1-8)
  - [ ] 5.1 Create `tests/e2e/learning-paths.spec.ts`
  - [ ] 5.2 Test empty state display
  - [ ] 5.3 Test path cards with seeded data
  - [ ] 5.4 Test navigation and active sidebar state
  - [ ] 5.5 Test archived paths are hidden

## Design Guidance

**Layout:** Follow the Courses page pattern — header section with title/description, followed by responsive card grid.

**Card Design:** Follow `ImportedCourseCard` pattern with `rounded-[24px]`, hover shadow/scale animation, and clear visual hierarchy.

**Color/Badge tokens:** Use `bg-brand-soft text-brand-soft-foreground` for Enrolled badge, `bg-success/10 text-success` for Completed badge. Source indicators use muted tones.

**Responsive grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`

**Progress bar:** Use existing `Progress` component from shadcn/ui with `showLabel`.

## Implementation Notes

**Plan:** [docs/implementation-artifacts/plans/e26-s02-learning-path-list-view.md](plans/e26-s02-learning-path-list-view.md)

**Dependency:** This story depends on E26-S01 (data model) for:
- `LearningPath`, `LearningPathStage`, `LearningPathEnrollment` types
- `useLearningPathsStore` Zustand store with `loadPaths()` action
- Dexie v20 schema with `learningPaths` and `learningPathEnrollments` tables

If E26-S01 is not yet merged, this story must either:
1. Be implemented on a branch based on E26-S01's branch, OR
2. Include the data model changes inline (not recommended — violates separation)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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
