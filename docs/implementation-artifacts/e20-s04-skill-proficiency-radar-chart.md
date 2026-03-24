---
story_id: E20-S04
story_name: "Skill Proficiency Radar Chart"
status: done
started: 2026-03-24
completed: 2026-03-24
reviewed: done
review_started: 2026-03-24
review_gates_passed: []
burn_in_validated: false
---

# Story 20.4: Skill Proficiency Radar Chart

## Story

As a learner tracking skill development,
I want to see a spider chart of my proficiency across different domains (Design, Coding, Marketing, etc.),
so that I can identify strengths and areas for improvement.

## Acceptance Criteria

**Given** the user has courses with assigned topics/categories
**When** the user views the Overview dashboard
**Then** a radar chart displays proficiency across 5-7 skill axes (e.g., Design, Coding, Marketing, Business, Soft Skills)
**And** proficiency for each skill is calculated from course completion % per skill domain

**Given** the radar chart is displayed
**When** the user hovers over a skill axis
**Then** a tooltip shows the skill name and proficiency percentage

**Given** the user has no courses or no courses with assigned topics
**When** the user views the Overview dashboard
**Then** the radar chart shows an appropriate empty state or placeholder message

**Given** the radar chart is rendered
**When** the user views it on different screen sizes
**Then** the chart is responsive and readable on mobile, tablet, and desktop

## Tasks / Subtasks

- [x] Task 1: Create skill taxonomy mapping (topic -> skill domain) (AC: 1)
  - [x] 1.1 Define skill domains and topic-to-skill mapping
  - [x] 1.2 Create proficiency calculation logic (course completion % per skill)
- [x] Task 2: Create SkillRadarChart component with Recharts (AC: 1, 2)
  - [x] 2.1 Build radar chart using Recharts RadarChart
  - [x] 2.2 Add hover tooltip with skill name and proficiency %
  - [x] 2.3 Style with design tokens (no hardcoded colors)
- [x] Task 3: Handle empty state (AC: 3)
  - [x] 3.1 Display placeholder when no courses or no skill data available
- [x] Task 4: Add radar chart section to Overview page (AC: 1, 4)
  - [x] 4.1 Integrate SkillRadarChart into Overview dashboard
  - [x] 4.2 Ensure responsive layout across breakpoints

## Design Guidance

[Optional -- populated by /start-story if UI story detected]

## Implementation Notes

- Built `SkillProficiencyRadar` component using Recharts `RadarChart` with `PolarAngleAxis`, `PolarGrid`, `PolarRadiusAxis`, and `Radar` elements, wrapped in shadcn/ui `ChartContainer`
- Data sourced from Dexie `courses` table via `useCourseStore`, with `getSkillProficiencyForOverview()` computing average completion per category
- Extracted shared `computeAvgCompletionByCategory()` private helper to eliminate duplication between `getCategoryCompletionForRadar()` and `getSkillProficiencyForOverview()`
- Guard: returns empty array when fewer than 2 categories exist, and the component returns `null` for 0-length data -- Overview conditionally renders the section
- All chart colors use design tokens (`var(--chart-3)`, `var(--border)`, `var(--muted-foreground)`)
- Accessible: `role="img"` wrapper with `aria-label` summarizing all proficiency values, chart content `aria-hidden="true"`
- Removed radar skeleton from loading state to avoid flash-then-nothing for users with fewer than 2 categories

## Testing Notes

- 41 unit tests in `src/lib/__tests__/reportStats.test.ts` covering `getSkillProficiencyForOverview()`: empty courses, single category (returns []), 2+ categories, averaging within categories, label formatting, and `fullMark` invariant
- Unit tests for `SkillProficiencyRadar` component cover rendering with valid data, null render for empty data, and aria-label content
- 3 E2E tests in `tests/e2e/regression/story-e20-s04.spec.ts`: radar chart visibility with seeded multi-category courses, aria-label verification, and empty state (AC4) confirming radar section is hidden without courses
- Deterministic seeding strategy: courses seeded into IndexedDB before reload to avoid requestIdleCallback timing issues

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing -- catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md -- CSP Configuration) -- N/A, no external APIs

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story -- Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

- **Duplication between radar functions:** `getSkillProficiencyForOverview()` initially duplicated the grouping logic from `getCategoryCompletionForRadar()`. Refactored into a shared `computeAvgCompletionByCategory()` helper, eliminating ~20 lines of duplication while keeping both public APIs stable.
- **Skeleton flash for conditional sections:** The radar skeleton rendered during loading even when the user had fewer than 2 categories, causing a brief flash before the section disappeared. Resolved by removing the radar-specific skeleton -- the section simply appears after loading if data qualifies.
- **E2E empty state coverage:** Initial E2E tests only covered the happy path (courses present). Added a dedicated test navigating without seeded courses to verify the radar section is correctly hidden (AC4).
