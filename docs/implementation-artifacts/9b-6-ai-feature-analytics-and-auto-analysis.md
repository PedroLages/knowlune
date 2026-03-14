---
story_id: E9B-S06
story_name: "AI Feature Analytics & Auto-Analysis"
status: in-progress
started: 2026-03-14
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 9.7: AI Feature Analytics & Auto-Analysis

## Story

As a learner,
I want to see usage statistics for AI features and have new courses automatically analyzed on import,
so that I can track my AI-assisted study habits and benefit from immediate AI insights on new content.

## Acceptance Criteria

**Given** I navigate to the AI Analytics section
**When** the dashboard loads
**Then** I see usage statistics for each AI feature (summaries generated, Q&A questions asked, learning paths created, notes organized, gaps detected)
**And** statistics are viewable over daily, weekly, and monthly time periods via a toggle
**And** each metric includes a trend indicator (up, down, or stable compared to the previous period)

**Given** I am viewing AI feature statistics
**When** I switch between daily, weekly, and monthly views
**Then** the statistics update to reflect the selected time period
**And** the transition is smooth with no layout shift

**Given** I import a new course
**When** the import completes successfully
**Then** the system automatically triggers AI analysis on the course content
**And** summary generation and topic tagging begin in the background
**And** a progress indicator shows the auto-analysis status on the course card

**Given** auto-analysis is running on a newly imported course
**When** the analysis completes
**Then** AI-generated topic tags are applied to the course
**And** a preliminary content summary is available on the course detail page
**And** a notification informs me that auto-analysis is complete

**Given** auto-analysis is running
**When** the AI provider fails or becomes unavailable
**Then** the system falls back to non-AI workflows within 2 seconds
**And** the course import is preserved without AI enrichment
**And** a status message indicates auto-analysis could not complete and offers manual retry

**Given** I have the AI consent toggle for auto-analysis disabled
**When** I import a new course
**Then** no automatic AI analysis is triggered
**And** the course imports normally without any data sent to the AI provider

## Tasks / Subtasks

- [ ] Task 1: Create AI usage event tracking system (AC: 1, 2)
  - [ ] 1.1 Define AI usage event types and Dexie schema
  - [ ] 1.2 Add event recording hooks to existing AI features
  - [ ] 1.3 Create aggregation queries (daily/weekly/monthly)
  - [ ] 1.4 Calculate trend indicators (up/down/stable)

- [ ] Task 2: Build AI Analytics dashboard UI (AC: 1, 2)
  - [ ] 2.1 Create AI Analytics section/page
  - [ ] 2.2 Build usage statistics cards with trend indicators
  - [ ] 2.3 Implement time period toggle (daily/weekly/monthly)
  - [ ] 2.4 Ensure smooth transitions with no layout shift

- [ ] Task 3: Implement auto-analysis on course import (AC: 3, 4)
  - [ ] 3.1 Hook into course import completion flow
  - [ ] 3.2 Trigger background AI analysis (summary + topic tagging)
  - [ ] 3.3 Show progress indicator on course card
  - [ ] 3.4 Apply AI-generated tags and summary on completion
  - [ ] 3.5 Send notification on analysis completion

- [ ] Task 4: Error handling and consent controls (AC: 5, 6)
  - [ ] 4.1 Implement AI provider failure fallback (<2s)
  - [ ] 4.2 Preserve course import without AI enrichment on failure
  - [ ] 4.3 Show status message with manual retry option
  - [ ] 4.4 Add auto-analysis consent toggle
  - [ ] 4.5 Respect consent setting during course import

**Dependencies:** Story 9.1 (AI provider configuration), Stories 9.2-9.6 (AI features to track), Story 1.1 (course import trigger)

**Complexity:** Medium (3-5 hours)

**Testing Requirements:** Unit tests for usage statistics aggregation and trend indicators, E2E for analytics dashboard, period toggles, auto-analysis on import, consent toggle, and AI unavailable fallback

## Design Guidance

### Layout Approach

**AI Analytics Section** — Add as a new section within the Reports page (or as a tab/subsection) following existing analytics patterns:
- Grid layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`
- Each AI feature gets a stat card (5 cards: summaries, Q&A, learning paths, notes organized, gaps detected)
- Below cards: area chart showing AI usage trends over selected period

**Auto-Analysis Progress** — Overlay on course cards during import processing:
- Progress indicator integrated into existing course card component
- Notification via toast (Sonner) on completion
- Error state with retry button

### Component Structure

| Component | Pattern | Reference |
|-----------|---------|-----------|
| AI stat cards | `StatsCard` pattern with NumberFlow + trend arrows + sparkline | `src/app/components/figma/StatsCard.tsx` |
| Period toggle | Button group (default/outline variants) with `role="group"` | `StudyTimeAnalytics.tsx` pattern |
| Usage trend chart | `ChartContainer` + `AreaChart` with gradient fill | `ProgressChart.tsx` pattern |
| Auto-analysis progress | `Progress` bar inside course card with status text | `src/app/components/ui/progress.tsx` |
| Consent toggle | Switch + label following AI config pattern | `AIConfigurationSettings.tsx` |
| Completion notification | Sonner toast with `Sparkles` icon | Existing toast patterns |

### Design System Tokens

- **AI feature accent**: Use `var(--chart-1)` through `var(--chart-5)` for per-feature colors
- **Trend up**: `text-success` (green) with `TrendingUp` icon
- **Trend down**: `text-destructive` (red) with `TrendingDown` icon
- **Trend stable**: `text-muted-foreground` with `Minus` icon
- **AI indicator**: `Sparkles` icon from Lucide, `bg-brand-soft text-brand` badge
- **Card styling**: `rounded-[24px] border bg-card` with `p-6` padding
- **No hardcoded colors** — ESLint `design-tokens/no-hardcoded-colors` enforced

### Responsive Strategy

- **Mobile** (< 640px): Single column, stacked stat cards, full-width chart
- **Tablet** (640-1023px): 2-3 column grid for stats, close sidebar to prevent overlay
- **Desktop** (1024px+): 5-column stat grid, side-by-side layouts where applicable
- Touch targets ≥ 44x44px on mobile for toggles and buttons

### Accessibility Requirements

- `aria-live="polite"` on stat values and trend indicators (dynamic content)
- `role="group" aria-label="Time period selection"` on toggle buttons
- Chart wrapped in `role="img"` with `aria-label` describing the data
- Progress bars with `aria-label` describing analysis status
- Keyboard navigable toggles and retry buttons
- Loading skeletons with `aria-busy="true"`

### Animation Strategy

- NumberFlow animated number transitions on stat values
- Framer Motion stagger on card grid entrance (`motion-safe`)
- Smooth toggle transitions — use `min-h-[value]` to prevent layout shift during period switching
- Progress bar animated fill for auto-analysis

## Implementation Plan

See [plan](plans/e9b-s06-ai-feature-analytics-auto-analysis.md) for implementation approach.

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

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
