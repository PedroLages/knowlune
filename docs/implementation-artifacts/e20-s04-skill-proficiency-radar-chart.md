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

- [ ] Task 1: Create skill taxonomy mapping (topic → skill domain) (AC: 1)
  - [ ] 1.1 Define skill domains and topic-to-skill mapping
  - [ ] 1.2 Create proficiency calculation logic (course completion % per skill)
- [ ] Task 2: Create SkillRadarChart component with Recharts (AC: 1, 2)
  - [ ] 2.1 Build radar chart using Recharts RadarChart
  - [ ] 2.2 Add hover tooltip with skill name and proficiency %
  - [ ] 2.3 Style with design tokens (no hardcoded colors)
- [ ] Task 3: Handle empty state (AC: 3)
  - [ ] 3.1 Display placeholder when no courses or no skill data available
- [ ] Task 4: Add radar chart section to Overview page (AC: 1, 4)
  - [ ] 4.1 Integrate SkillRadarChart into Overview dashboard
  - [ ] 4.2 Ensure responsive layout across breakpoints

## Design Guidance

[Optional — populated by /start-story if UI story detected]

## Implementation Notes

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
