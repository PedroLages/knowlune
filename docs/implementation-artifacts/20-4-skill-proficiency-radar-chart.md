---
story_id: E20-S04
story_name: "Skill Proficiency Radar Chart"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 20.4: Skill Proficiency Radar Chart

## Story

As a learner tracking skill development,
I want to see a spider chart of my proficiency across different domains,
so that I can identify strengths and areas for improvement.

## Acceptance Criteria

- **AC1:** Given the Overview dashboard is loaded, When the user has courses in at least 2 categories, Then a radar chart is displayed showing skill proficiency across all populated skill domains (one axis per category)
- **AC2:** Given courses exist in multiple categories, When the radar chart renders, Then each axis shows proficiency as the average course completion percentage for that category (0-100%)
- **AC3:** Given the radar chart is visible, When the user hovers over a data point, Then a tooltip shows the skill domain name and exact proficiency percentage
- **AC4:** Given no courses exist or only one category is populated, When the Overview dashboard loads, Then the radar chart section is hidden (graceful empty state)
- **AC5:** Given the radar chart is rendered, When a screen reader user navigates to it, Then an accessible description summarizing skill proficiencies is available via aria-label
- **AC6:** Given the Overview dashboard is viewed on mobile (< 640px), When the radar chart section renders, Then it is responsive and legible without horizontal scrolling

## Tasks / Subtasks

- [ ] Task 1: Create `getSkillProficiencyForOverview()` data function in `src/lib/reportStats.ts` (AC: 1, 2, 4)
  - [ ] 1.1 Compute average completion % per course category
  - [ ] 1.2 Return empty array when < 2 categories populated
  - [ ] 1.3 Map category slugs to user-friendly labels
- [ ] Task 2: Create `SkillProficiencyRadar` component (AC: 1, 3, 5, 6)
  - [ ] 2.1 Recharts RadarChart with shadcn/ui ChartContainer
  - [ ] 2.2 Tooltip with domain name + percentage
  - [ ] 2.3 Accessible aria-label with proficiency summary
  - [ ] 2.4 Responsive sizing
- [ ] Task 3: Integrate into `Overview.tsx` (AC: 1, 4, 6)
  - [ ] 3.1 Add radar section between existing dashboard sections
  - [ ] 3.2 Conditional rendering (hide when < 2 categories)
  - [ ] 3.3 Add skeleton state during loading
- [ ] Task 4: Unit tests for data function (AC: 2, 4)
  - [ ] 4.1 Test proficiency calculation per category
  - [ ] 4.2 Test empty/single-category edge cases
  - [ ] 4.3 Test category label formatting
- [ ] Task 5: Unit tests for component (AC: 1, 3, 5)
  - [ ] 5.1 Test chart renders with valid data
  - [ ] 5.2 Test null render with insufficient data
  - [ ] 5.3 Test aria-label content
- [ ] Task 6: E2E test for Overview integration (AC: 1, 6)
  - [ ] 6.1 Verify radar chart visible with seeded courses
  - [ ] 6.2 Verify hidden when no courses

## Design Guidance

**Layout:** Place the radar chart in the "Insight + Action Zone" area of the Overview dashboard, using a Card container with `rounded-[24px]` border consistent with other dashboard sections. Use `lg:grid-cols-[3fr_2fr]` grid alongside an existing widget or as a standalone full-width card.

**Component Pattern:** Follow the existing `CategoryRadar` and `SkillsRadar` component patterns from `src/app/components/reports/`. Use shadcn/ui `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` with `ChartConfig`.

**Responsive:** Chart height 280px on desktop, auto-adjusting on mobile. Use `mx-auto` centering. Labels font-size 11-12px.

**Design Tokens:** Use `var(--chart-1)` through `var(--chart-5)` for chart colors. No hardcoded colors.

**Accessibility:** `role="img"` wrapper with `aria-label` summarizing all proficiency values. Chart content `aria-hidden="true"`.

## Implementation Notes

**Plan:** [e20-s04-skill-proficiency-radar-chart.md](plans/e20-s04-skill-proficiency-radar-chart.md)

[Architecture decisions, patterns used, dependencies added]

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
