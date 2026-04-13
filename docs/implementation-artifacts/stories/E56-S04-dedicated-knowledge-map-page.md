---
story_id: E56-S04
story_name: "Dedicated Knowledge Map Page"
status: done
started: 2026-04-13
completed: 2026-04-13
reviewed: true
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 56.4: Dedicated Knowledge Map Page

## Story

As a learner who wants a detailed view of all my topic knowledge,
I want a full-screen Knowledge Map page with topic-level treemap, score popovers, and category filtering,
So that I can explore every topic in depth and take targeted action on fading or weak areas.

## Acceptance Criteria

**Given** the route /knowledge-map is registered in routes.tsx
**When** navigating to /knowledge-map
**Then** the KnowledgeMap page loads with a topic-level Recharts Treemap showing all ~40-60 topics, grouped by category, colored by tier

**Given** the treemap renders with topic cells
**When** cell size is determined
**Then** it reflects the topic's lesson count (more lessons = larger cell), and color reflects tier (--success for strong, --warning for fading, --destructive for weak)

**Given** the treemap is rendered
**When** the user clicks a topic cell
**Then** a TopicDetailPopover opens showing: topic name + tier badge, score breakdown (quiz %, flashcard retention %, completion %, recency score with effective weights), confidence level indicator, last engagement date (relative: "45 days ago"), and suggested action buttons

**Given** TopicDetailPopover action buttons are displayed
**When** "Review Flashcards" is clicked
**Then** navigation goes to flashcard review filtered by the topic's course
**And** "Retake Quiz" navigates to the quiz for the course containing the topic
**And** "Rewatch Lesson" navigates to the first incomplete lesson in the topic

**Given** the Knowledge Map page is rendered
**When** category filter chips/sidebar are visible
**Then** clicking a category chip filters the treemap to show only topics in that category, with an "All Categories" option to reset

**Given** the page is viewed on a viewport below 640px
**When** the mobile fallback activates
**Then** the treemap is replaced by a sorted topic list with Card/Progress/Badge/Accordion components, grouped by category, sorted worst-first, with tap to expand topic details

**Given** the page is rendered on desktop
**When** treemap cells are small (width < 60px or height < 30px)
**Then** the topic label is hidden but the score number still shows if width > 40px; hovering shows full details via tooltip

**Given** the Knowledge Map page
**When** the FocusAreasPanel renders
**Then** it shows the same top 3 urgent topics as the Overview widget (reused component)

**Given** a sidebar navigation entry for "Knowledge Map"
**When** the user is on the /knowledge-map route
**Then** the sidebar item shows active state

**Given** the treemap cells
**When** navigated via keyboard (Tab)
**Then** cells receive visible focus indicators and pressing Enter opens the TopicDetailPopover (accessibility)

## Tasks / Subtasks

- [ ] Task 1: Create `src/app/components/knowledge/TopicDetailPopover.tsx` (AC: 3, 4)
  - [ ] 1.1 Accept ScoredTopic prop
  - [ ] 1.2 Render topic name + tier badge header
  - [ ] 1.3 Render score breakdown: quiz %, flashcard retention %, completion %, recency — each with effective weight label
  - [ ] 1.4 Render confidence level indicator (solid/subtle/striped icon)
  - [ ] 1.5 Render relative last engagement date ("45 days ago") using date-fns formatDistanceToNow
  - [ ] 1.6 Render suggested action buttons with click navigation
  - [ ] 1.7 Use shadcn/ui Popover component
- [ ] Task 2: Create `src/app/pages/KnowledgeMap.tsx` (AC: 1, 2, 5, 7, 8)
  - [ ] 2.1 Consume useKnowledgeMapStore for topics, categories, focusAreas
  - [ ] 2.2 Call computeScores() on mount
  - [ ] 2.3 Render topic-level TopicTreemap (40-60 cells, grouped by category)
  - [ ] 2.4 Wire cell click to open TopicDetailPopover
  - [ ] 2.5 Implement category filter state (chips or sidebar)
  - [ ] 2.6 Filter treemap data by selected category
  - [ ] 2.7 "All Categories" chip to reset filter
  - [ ] 2.8 Render FocusAreasPanel (reuse from S03)
  - [ ] 2.9 Mobile fallback: sorted list below 640px
- [ ] Task 3: Register route in routes.tsx (AC: 1)
  - [ ] 3.1 Add lazy-loaded route: `{ path: 'knowledge-map', lazy: () => import('./pages/KnowledgeMap') }`
- [ ] Task 4: Add sidebar navigation entry in Layout.tsx (AC: 9)
  - [ ] 4.1 Add "Knowledge Map" nav item with appropriate icon (e.g., Map, Brain from lucide-react)
  - [ ] 4.2 Active state management on /knowledge-map route
- [ ] Task 5: Enhance TopicTreemap for topic-level rendering (AC: 2, 7, 10)
  - [ ] 5.1 Support nested data: categories -> topics hierarchy
  - [ ] 5.2 Cell size = lesson count, color = tier
  - [ ] 5.3 Adaptive label rendering: hide label when cell width < 60px, hide score when width < 40px
  - [ ] 5.4 Keyboard navigation: cells focusable via Tab, Enter opens popover
  - [ ] 5.5 Hover tooltip for small cells
- [ ] Task 6: Write E2E tests (AC: 1, 3, 4, 5, 6, 9)
  - [ ] 6.1 Test page renders with treemap containing topic cells
  - [ ] 6.2 Test cell click opens TopicDetailPopover with score breakdown
  - [ ] 6.3 Test action buttons navigate to correct routes
  - [ ] 6.4 Test category filter chips filter treemap content
  - [ ] 6.5 Test mobile fallback at 639px viewport
  - [ ] 6.6 Test sidebar nav active state on /knowledge-map
  - [ ] 6.7 Test keyboard navigation (Tab to cell, Enter opens popover)

## Design Guidance

**Layout approach:**
- Full-width page with category filter chips across the top
- Treemap occupies main content area (~70% height)
- FocusAreasPanel in a sidebar (desktop) or below treemap (tablet/mobile)

**Component structure:**
- TopicDetailPopover: shadcn/ui Popover with structured content
- TopicTreemap: reused from S03, enhanced for topic-level data
- FocusAreasPanel: reused from S03

**Design system usage:**
- Tier colors: `var(--success)`, `var(--warning)`, `var(--destructive)` for treemap cells
- Category chips: use Badge or ToggleGroup component from shadcn/ui
- Popover: standard shadcn/ui Popover with `p-4` padding
- Action buttons: `variant="brand-outline"` for primary action, `variant="outline"` for secondary

**Responsive strategy:**
- Desktop (>= 1024px): treemap + sidebar FocusAreasPanel
- Tablet (640-1023px): treemap full-width, FocusAreasPanel below
- Mobile (< 640px): sorted list with Accordion, FocusAreasPanel below

**Accessibility:**
- Treemap cells: `role="button"`, `tabIndex={0}`, `aria-label="Topic: [name], knowledge score: [score] percent, status: [tier]"`
- Keyboard: Tab cycles through cells, Enter opens popover, Escape closes
- Popover: focus trap, auto-focus first action button
- Mobile list: fully accessible via standard shadcn/ui components

## Implementation Notes

**Key files to create:**
- `src/app/components/knowledge/TopicDetailPopover.tsx` (~120 lines)
- `src/app/pages/KnowledgeMap.tsx` (~150 lines)

**Key files to modify:**
- `src/app/routes.tsx` — add /knowledge-map route
- `src/app/components/Layout.tsx` — add sidebar nav entry
- `src/app/components/knowledge/TopicTreemap.tsx` (from S03) — enhance for topic-level data

**Key files to reference:**
- `src/app/pages/Overview.tsx` — page layout pattern
- `src/app/routes.tsx` — lazy route registration pattern
- `src/app/components/Layout.tsx` — sidebar nav pattern

## Testing Notes

- E2E tests with seeded course/progress/quiz/flashcard data
- Test popover opens and displays correct score breakdown
- Test action buttons navigate correctly
- Test category filter state management
- Test mobile list at 639px viewport width
- Test keyboard navigation through treemap cells

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

[Document issues, solutions, and patterns worth remembering]
