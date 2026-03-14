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

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
