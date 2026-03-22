---
story_id: E23-S02
story_name: "Rename My Classes to My Courses"
status: in-progress
started: 2026-03-23
completed:
reviewed: in-progress
review_started: 2026-03-23
review_gates_passed: []
burn_in_validated: false
---

# Story 23.2: Rename "My Classes" to "My Courses"

## Story

As a **self-directed learner**,
I want the navigation to say "My Courses" instead of "My Classes",
So that the terminology matches self-directed learning rather than a school/LMS context.

## Acceptance Criteria

**Given** the app renders the sidebar navigation
**When** the user views the navigation items
**Then** "My Classes" is displayed as "My Courses" in the sidebar, mobile bottom bar, and search command palette
**And** the route path remains `/my-class` for backwards compatibility
**And** the page title inside MyClass.tsx reads "My Courses"

## Tasks / Subtasks

- [ ] Task 1: Update sidebar navigation label from "My Classes" to "My Courses" (AC: 1)
- [ ] Task 2: Update mobile bottom bar label (AC: 1)
- [ ] Task 3: Update search command palette entry (AC: 1)
- [ ] Task 4: Update page title in MyClass.tsx to "My Courses" (AC: 3)
- [ ] Task 5: Verify route path `/my-class` remains unchanged (AC: 2)

## Implementation Plan

See [plan](plans/e23-s02-rename-my-classes-to-my-courses.md) for implementation approach.

## Design Guidance

Skipped — this is a label rename story with no visual/layout changes.

## Implementation Notes

- Changed label in 3 surfaces: sidebar navigation (`Layout.tsx`), mobile bottom bar (`Layout.tsx`), and search command palette (`SearchCommandPalette.tsx`)
- Updated page heading in `MyClass.tsx` from "My Classes" to "My Courses"
- Route path `/my-class` preserved for backwards compatibility — only display labels changed
- No new dependencies added

## Testing Notes

- 5 E2E test cases covering all ACs: sidebar label, mobile bottom bar, command palette, route compatibility, page heading
- ATDD test selectors required a fix commit (`33bd901d`) to handle navigation ambiguity — desktop sidebar vs mobile bottom bar both contain "My Courses", resolved with viewport-specific selectors
- Navigation helper updated to use "My Courses" label for route matching

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

- **Selector ambiguity in E2E tests**: The rename introduced ambiguity when both desktop sidebar and mobile bottom bar render "My Courses" simultaneously. Initial ATDD tests failed because `getByRole('link', { name: 'My Courses' })` matched multiple elements. Fixed by scoping selectors to specific navigation containers (e.g., `nav[aria-label="Main navigation"]` for sidebar, viewport-based visibility for mobile bar).
- **Worktree dev server isolation**: Running E2E tests in a worktree while the main workspace has a dev server on port 5173 requires starting a separate server on port 5174 and passing `BASE_URL=http://localhost:5174` to Playwright. Without this, `reuseExistingServer: true` silently uses the main workspace's stale code.
- **Minimal scope discipline**: This story touched only display labels, not route paths or component file names. Keeping `MyClass.tsx` as the filename and `/my-class` as the route avoids cascading rename changes across imports, tests, and routing config — a pragmatic backwards-compatibility choice.
