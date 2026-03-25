---
story_id: E23-S04
story_name: "Restructure Sidebar Navigation Groups"
status: done
started: 2026-03-23
completed: 2026-03-23
reviewed: true
review_started: 2026-03-23
review_gates_passed:
  - build
  - lint
  - types
  - format
  - unit-tests
  - e2e-smoke
  - e2e-story
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 23.4: Restructure Sidebar Navigation Groups

## Story

As a **self-directed learner**,
I want the sidebar navigation to be organized into clear, balanced groups that reflect my learning workflow,
So that I can quickly find features related to studying, reviewing, or tracking my progress.

## Acceptance Criteria

- **AC1**: Given the sidebar navigation renders on desktop, when the user views the group labels, then there are exactly 3 groups: "Learn", "Review", and "Track" (replacing the current "Learn"/"Connect"/"Track" structure)
- **AC2**: Given the "Learn" group, when the user views its items, then it contains: Overview, My Courses, Courses, Authors, Notes (5 items total — Authors moved from the former "Connect" group)
- **AC3**: Given the "Review" group, when the user views its items, then it contains: Learning Path, Knowledge Gaps, Review, Retention (4 items — extracted from the former overloaded "Learn" group)
- **AC4**: Given the "Track" group, when the user views its items, then it contains: Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics (5 items — unchanged)
- **AC5**: Given the mobile bottom bar, when the user taps "More", then the overflow drawer displays all navigation items grouped consistently with the sidebar structure
- **AC6**: Given the collapsed sidebar on desktop, when group separators are shown between icon-only items, then separators align with the new 3-group boundaries
- **AC7**: Given the application loads, when viewed on mobile (375px), tablet (768px), and desktop (1440px), then the layout remains responsive and visually correct with no overflow or broken alignment

## Tasks / Subtasks

- [ ] Task 1: Update navigation config with new group structure (AC: 1-4)
  - [ ] 1.1 Reorganize `navigationGroups` in `src/app/config/navigation.ts`
  - [ ] 1.2 Move Authors from "Connect" to "Learn" (after Courses, before Notes)
  - [ ] 1.3 Create "Review" group with Learning Path, Knowledge Gaps, Review, Retention
  - [ ] 1.4 Keep "Track" group unchanged (Challenges, Session History, 3 analytics tabs)
- [ ] Task 2: Update mobile bottom bar primary items (AC: 5)
  - [ ] 2.1 Verify `primaryNavPaths` still makes sense with new grouping
  - [ ] 2.2 Test overflow drawer renders all items correctly
- [ ] Task 3: Verify collapsed sidebar separators (AC: 6)
  - [ ] 3.1 Confirm Layout.tsx separator logic works with 3 groups (already idx > 0)
- [ ] Task 4: Write E2E tests (AC: 1-7)
  - [ ] 4.1 Test group labels visible in sidebar
  - [ ] 4.2 Test item ordering within each group
  - [ ] 4.3 Test mobile overflow drawer
  - [ ] 4.4 Test responsive layout at 3 breakpoints
- [ ] Task 5: Update unit tests for navigation config (AC: 1-4)

## Design Guidance

### Scope

This story restructures the **navigation group assignments** and labels in `src/app/config/navigation.ts`. No new pages, routes, or components are added. The visual styling of the sidebar remains unchanged.

### Proposed Group Structure (5-4-5)

| Group | Items | Rationale |
|-------|-------|-----------|
| **Learn** | Overview, My Courses, Courses, Authors, Notes | Core content access — everything you need to study |
| **Review** | Learning Path, Knowledge Gaps, Review, Retention | Retention & reinforcement — AI-assisted and spaced review |
| **Track** | Challenges, Session History, Study Analytics, Quiz Analytics, AI Analytics | Progress tracking and analytics |

### Key Changes from Current Structure

1. **"Connect" group eliminated** — Authors (the sole item) moves to "Learn" between Courses and Notes
2. **"Learn" reduced from 8 to 5 items** — retention features extracted to new "Review" group
3. **New "Review" group created** (4 items) — Learning Path, Knowledge Gaps, Review, Retention
4. **"Track" unchanged** (5 items)

### Design Token Compliance

No styling changes needed — existing group label rendering uses `text-muted-foreground` and `text-[10px]` from Layout.tsx.

### Responsive Considerations

- Collapsed sidebar: separator logic (`idx > 0`) already handles arbitrary group counts
- Mobile bottom bar: `primaryNavPaths` stays `['/', '/my-class', '/courses', '/notes']` — unchanged
- Overflow drawer: automatically picks up all non-primary items — no code change needed

## Implementation Plan

See [plan](plans/e23-s04-restructure-sidebar-navigation-groups.md) for implementation approach.

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

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story -- Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
