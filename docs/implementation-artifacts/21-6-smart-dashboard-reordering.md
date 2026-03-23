---
story_id: E21-S06
story_name: "Smart Dashboard Reordering"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 21.6: Smart Dashboard Reordering

## Story

As a returning user,
I want the dashboard sections to automatically reorder based on my usage patterns,
so that my most-used features are always at the top.

## Acceptance Criteria

### AC1: Track section interactions
**Given** I am viewing the Overview dashboard
**When** I scroll a section into view or interact with it (click, hover > 2s)
**Then** the system records the interaction (section ID, timestamp, duration) in localStorage

### AC2: Auto-reorder by relevance
**Given** I have accumulated at least 7 days of interaction data
**When** I load the Overview dashboard
**Then** sections are ordered by a relevance score (weighted: frequency × recency × duration)
**And** the Hero Zone always remains first (pinned by default)

### AC3: Manual drag-and-drop override
**Given** I am viewing the Overview dashboard
**When** I drag a section to a new position using the drag handle
**Then** the section moves to the new position
**And** the custom order is persisted and overrides auto-reorder for that section

### AC4: Pin to top
**Given** I right-click or long-press a section header
**When** I select "Pin to top" from the context menu
**Then** the section is pinned to the top (after Hero Zone)
**And** pinned sections maintain their relative order

### AC5: Reset to default
**Given** I have customized the dashboard order
**When** I click "Reset to Default" in dashboard settings or the section context menu
**Then** all sections return to the original fixed order
**And** all interaction data and pins are cleared

### AC6: Keyboard accessibility
**Given** I am navigating with keyboard only
**When** I focus a section drag handle and press Space, then use arrow keys
**Then** the section moves up/down in the dashboard order
**And** the change is announced via aria-live

## Tasks / Subtasks

- [ ] Task 1: Create `useDashboardOrderStore` (Zustand + localStorage persist) (AC: 1,2,3,5)
  - [ ] 1.1 Define section IDs enum and default order
  - [ ] 1.2 Implement interaction tracking (section views, clicks)
  - [ ] 1.3 Implement relevance scoring algorithm
  - [ ] 1.4 Implement manual order override storage
  - [ ] 1.5 Implement reset to defaults
- [ ] Task 2: Refactor Overview.tsx to use section ordering (AC: 2)
  - [ ] 2.1 Extract each section into a named, sortable component
  - [ ] 2.2 Render sections dynamically from ordered array
- [ ] Task 3: Add drag-and-drop reordering with dnd-kit (AC: 3,6)
  - [ ] 3.1 Wrap sections with DndContext + SortableContext
  - [ ] 3.2 Add drag handle to each section header
  - [ ] 3.3 Implement keyboard drag with aria-live announcements
- [ ] Task 4: Add pin-to-top and context menu (AC: 4)
  - [ ] 4.1 Create section header context menu component
  - [ ] 4.2 Implement pin/unpin logic in store
- [ ] Task 5: Add "Reset to Default" UI (AC: 5)
  - [ ] 5.1 Add reset button to dashboard (only when customized)
- [ ] Task 6: E2E tests (AC: 1-6)
  - [ ] 6.1 Test auto-reorder with seeded interaction data
  - [ ] 6.2 Test drag-and-drop reorder
  - [ ] 6.3 Test pin-to-top
  - [ ] 6.4 Test reset to default
  - [ ] 6.5 Test keyboard accessibility

## Design Guidance

- **Drag handles**: Use GripVertical icon (lucide-react) on each section header, visible on hover/focus
- **Context menu**: Use shadcn/ui ContextMenu on section headers
- **Pin indicator**: Small pin icon next to pinned section titles
- **Reset button**: Subtle link-style button at top of dashboard, only visible when order differs from default
- **Animation**: Use framer-motion for reorder transitions (layoutId)
- **Responsive**: Drag handles hidden on mobile (touch-and-hold for reorder instead)

## Implementation Plan

[Full plan](plans/e21-s06-smart-dashboard-reordering.md)

## Implementation Notes

[To be filled during implementation]

## Testing Notes

[To be filled during implementation]

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
