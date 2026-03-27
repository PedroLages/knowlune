---
story_id: E29-S03
story_name: "Fix CareerPaths Mislabelling and Add Missing Sidebar Nav Entry"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 29.3: Fix CareerPaths Mislabelling and Add Missing Sidebar Nav Entry

## Story

As a user,
I want the Career Paths page to be correctly labelled and reachable from the sidebar,
So that I can find and navigate to it without confusion.

## Acceptance Criteria

**Given** the Career Paths page at `/career-paths`
**When** the page renders
**Then** the `<h1>` heading reads "Career Paths" (not "Learning Paths")
**And** screen readers announce "Career Paths" as the page title

**Given** the sidebar navigation
**When** viewing the Library group
**Then** a "Career Paths" entry exists with the correct icon and route
**And** it highlights as active when on `/career-paths` or `/career-paths/:id`
**And** keyboard-only users can navigate to it via Tab

**Given** `CareerPathDetail.tsx`
**When** the back-link is rendered
**Then** it reads "Back to career paths" (not "Back to learning paths")

## Tasks / Subtasks

- [ ] Task 1: Fix heading mislabel in CareerPaths.tsx (AC: 1)
  - [ ] 1.1 Open `CareerPaths.tsx:255` and change `<h1>` from "Learning Paths" to "Career Paths"
  - [ ] 1.2 Verify screen reader announcement matches (check `document.title` or `aria-label` if applicable)
- [ ] Task 2: Add sidebar nav entry for Career Paths (AC: 2)
  - [ ] 2.1 Open `navigation.ts` and add a "Career Paths" entry to the Library group
  - [ ] 2.2 Set the correct icon (match existing navigation pattern)
  - [ ] 2.3 Set route to `/career-paths`
  - [ ] 2.4 Verify active state highlights on both `/career-paths` and `/career-paths/:id`
  - [ ] 2.5 Verify keyboard Tab navigation reaches the new entry
- [ ] Task 3: Fix back-link text in CareerPathDetail.tsx (AC: 3)
  - [ ] 3.1 Open `CareerPathDetail.tsx:354` and change "Back to learning paths" to "Back to career paths"
  - [ ] 3.2 Verify the link navigates to `/career-paths`

## Implementation Notes

- **Files:**
  - `CareerPaths.tsx:255` — heading mislabel (B3)
  - `navigation.ts` — missing sidebar entry (B4)
  - `CareerPathDetail.tsx:354` — wrong back-link text (H28)
- **Audit findings:** B3 (heading mislabel), B4 (missing nav entry), H28 (wrong back-link)
- These are simple text/config changes — no architectural decisions needed
- Ensure the sidebar nav entry follows the same pattern as existing entries (icon, label, route, active matching)

## Testing Notes

- E2E: Navigate to `/career-paths`, verify heading text is "Career Paths"
- E2E: Verify sidebar shows "Career Paths" entry in Library group
- E2E: Click sidebar entry, verify navigation to `/career-paths`
- E2E: Navigate to a career path detail, verify back-link text and navigation
- Accessibility: Tab through sidebar, verify "Career Paths" entry is reachable
- Run existing E2E tests to verify no regression in sidebar navigation

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

## Challenges and Lessons Learned

- **Compass icon**: Used Compass from lucide-react for Career Paths to differentiate from Learning Paths (Route icon)
- **Active state**: `getIsActive` with `pathname.startsWith(item.path)` already handles both `/career-paths` and `/career-paths/:id` — no special logic needed
- **Multiple mislabel locations**: The "Learning Paths" text appeared in 2 places in CareerPaths.tsx (error state + main render) plus the back-link in CareerPathDetail.tsx
