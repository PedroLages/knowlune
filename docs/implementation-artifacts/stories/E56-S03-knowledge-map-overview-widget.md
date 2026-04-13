---
story_id: E56-S03
story_name: "Knowledge Map Overview Widget"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 56.3: Knowledge Map Overview Widget

## Story

As a learner viewing my Overview dashboard,
I want to see a Knowledge Map widget showing my category-level knowledge and top focus areas,
So that I can quickly understand my overall knowledge health and know what needs attention without leaving the dashboard.

## Acceptance Criteria

**Given** the Overview page renders with dashboard sections
**When** 'knowledge-map' is registered as a DashboardSectionId in `src/lib/dashboardOrder.ts`
**Then** it appears in the section list with label "Knowledge Map", positioned after 'skill-proficiency' and before 'insight-action' in DEFAULT_ORDER (current order has 10 sections)

**Given** knowledge scores have been computed for topics across 5 categories
**When** the KnowledgeMapWidget renders
**Then** a category-level Recharts Treemap displays with 5 cells, each showing category name and average score, colored by tier (success/warning/destructive design tokens)

**Given** the Knowledge Map widget is rendered
**When** Focus Areas panel is visible below the treemap
**Then** it shows the top 3 most urgent topics with: topic name, score + tier badge, days since engagement, and 1-2 action buttons (e.g., "Review Flashcards", "Retake Quiz")

**Given** the widget is rendered on a viewport below 640px
**When** the mobile fallback activates
**Then** the treemap is replaced by a sorted topic list using Card, Progress, and Badge components, grouped by category via Accordion, sorted worst-first within each group

**Given** the widget uses design tokens for all colors
**When** dark mode is active
**Then** treemap cells, tier badges, and text all render correctly with proper contrast (no hardcoded colors)

**Given** the KnowledgeMapWidget is rendered
**When** the user clicks "See full map" link
**Then** navigation goes to /knowledge-map

**Given** no course data exists (empty state)
**When** the widget renders
**Then** a friendly empty state message is shown (e.g., "Import courses to build your Knowledge Map")

**Given** the widget's Focus Areas action buttons
**When** clicked
**Then** they navigate to the appropriate route (flashcard review filtered by course, quiz page, or lesson player)

## Tasks / Subtasks

- [ ] Task 1: Register 'knowledge-map' as DashboardSectionId (AC: 1)
  - [ ] 1.1 Add 'knowledge-map' to DashboardSectionId type in `src/lib/dashboardOrder.ts`
  - [ ] 1.2 Add to SECTION_LABELS: 'knowledge-map': 'Knowledge Map'
  - [ ] 1.3 Add to DEFAULT_ORDER after 'skill-proficiency', before 'insight-action'
- [ ] Task 2: Create `src/app/components/knowledge/TopicTreemap.tsx` (AC: 2, 5)
  - [ ] 2.1 Build Recharts Treemap wrapper accepting data prop (category-level or topic-level)
  - [ ] 2.2 Custom cell renderer: tier-colored fill using getTierColor() with design tokens
  - [ ] 2.3 Cell labels: show category/topic name + score when cell is large enough
  - [ ] 2.4 Handle dark mode via CSS variable color values
- [ ] Task 3: Create `src/app/components/knowledge/FocusAreasPanel.tsx` (AC: 3, 8)
  - [ ] 3.1 Accept focusAreas: ScoredTopic[] prop
  - [ ] 3.2 Render ordered list with topic name, score, tier badge, days since engagement
  - [ ] 3.3 Render 1-2 action buttons per topic (from suggestedActions)
  - [ ] 3.4 Action buttons navigate to appropriate routes on click
- [ ] Task 4: Create `src/app/components/knowledge/KnowledgeMapWidget.tsx` (AC: 2, 3, 4, 6, 7)
  - [ ] 4.1 Consume useKnowledgeMapStore for categories and focusAreas
  - [ ] 4.2 Call computeScores() on mount
  - [ ] 4.3 Render TopicTreemap (category-level, 5 cells)
  - [ ] 4.4 Render FocusAreasPanel below treemap
  - [ ] 4.5 Add "See full map" link to /knowledge-map
  - [ ] 4.6 Mobile fallback: sorted list below 640px using useMediaQuery or Tailwind responsive
  - [ ] 4.7 Empty state when no courses exist
- [ ] Task 5: Wire widget into Overview.tsx (AC: 1)
  - [ ] 5.1 Import and render KnowledgeMapWidget in the dashboard section renderer
  - [ ] 5.2 Register with section visibility observer for auto-reordering stats
- [ ] Task 6: Write E2E test (AC: 1, 2, 3, 6, 7)
  - [ ] 6.1 Test widget renders on Overview with "Knowledge Map" heading
  - [ ] 6.2 Test treemap cells are visible with category labels
  - [ ] 6.3 Test Focus Areas shows top 3 topics
  - [ ] 6.4 Test "See full map" link navigates to /knowledge-map
  - [ ] 6.5 Test empty state when no course data

## Design Guidance

**Layout approach:**
- Category treemap takes ~60% of widget height, Focus Areas panel below
- Treemap uses `<ResponsiveContainer>` for fluid width
- Focus Areas is a compact `<ol>` with 3 items

**Component structure:**
- TopicTreemap: shared between widget (category-level) and page (topic-level) via data prop
- FocusAreasPanel: shared between widget and page (same component)
- KnowledgeMapWidget: widget-specific wrapper

**Design system usage:**
- Tier colors: `var(--success)`, `var(--warning)`, `var(--destructive)` for treemap cells
- Badge variants for tier labels
- Card component for widget container (follows existing dashboard section pattern)
- Progress component for mobile list fallback

**Responsive strategy:**
- Desktop/tablet: Recharts Treemap with 5 cells
- Mobile (< 640px): Accordion-grouped sorted list with Progress bars

**Accessibility:**
- Treemap cells include text labels (not color-only information)
- Focus Areas uses semantic `<ol>` with descriptive text
- All action buttons have `aria-label` attributes

## Implementation Notes

**Key files to create:**
- `src/app/components/knowledge/TopicTreemap.tsx` (~150 lines)
- `src/app/components/knowledge/FocusAreasPanel.tsx` (~100 lines)
- `src/app/components/knowledge/KnowledgeMapWidget.tsx` (~80 lines)

**Key files to modify:**
- `src/lib/dashboardOrder.ts` — add 'knowledge-map' to type, labels, default order
- `src/app/pages/Overview.tsx` — render KnowledgeMapWidget in section renderer

**Key files to reference:**
- `src/app/pages/Overview.tsx` — DashboardSectionId rendering pattern
- `src/lib/dashboardOrder.ts` — section registration pattern
- Existing Recharts usage throughout the app (12+ chart instances)

## Testing Notes

- E2E test with seeded course/progress data to verify widget rendering
- Test mobile fallback at 639px viewport
- Test dark mode rendering
- Test empty state (no courses)

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
