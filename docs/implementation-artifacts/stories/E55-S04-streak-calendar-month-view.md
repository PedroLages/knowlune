---
story_id: E55-S04
story_name: "Streak Calendar Month-View Mode"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 55.4: Streak Calendar Month-View Mode

## Story

As a learner tracking my study habits,
I want a month-view calendar showing which days I studied with a binary visual (studied vs not),
So that I can quickly see my consistency for the current month at a glance.

## Acceptance Criteria

**Given** the StudyStreakCalendar component
**When** I click the view toggle (`CalendarDays` icon for month-view, `Grid3x3` icon for heatmap)
**Then** the view switches between the existing heatmap grid and the new month-view calendar

**Given** the month-view is active
**When** rendered
**Then** it shows a 7-column grid with day-of-week headers (M T W T F S S), day numbers for the current month, and overflow days from previous/next months in dimmed text (`text-muted-foreground/30`)

**Given** a day where I completed at least one study action
**When** rendered in the month-view
**Then** that day cell has `bg-brand text-brand-foreground rounded-2xl` styling (binary: studied = brand, not studied = default)

**Given** today's date has not yet had study activity
**When** rendered in the month-view
**Then** today's cell has a `ring-2 ring-brand ring-offset-2` outline to highlight it without filling

**Given** a freeze day (rest day that doesn't break streak)
**When** rendered in the month-view
**Then** the cell shows `bg-brand-soft text-freeze-day-text` background with a small `Snowflake` icon in the top-right corner

**Given** the month-view
**When** I click the left/right chevron arrows (`ChevronLeft`/`ChevronRight`)
**Then** the calendar navigates to the previous/next month

**Given** the existing confetti milestone functionality
**When** a milestone is reached while in month-view mode
**Then** confetti and milestone toasts still fire (position anchored to the streak header)

**Given** the view toggle preference
**When** I switch to month-view and navigate away then return
**Then** the preference is persisted in localStorage and restored on mount

**Given** a day cell in the month-view
**When** I hover over it
**Then** a tooltip shows the same information as the heatmap tooltip (date, lesson count, study minutes, courses)

## Tasks / Subtasks

- [ ] Task 1: Add view toggle to StudyStreakCalendar header (AC: 1, 8)
  - [ ] 1.1 Add state: `viewMode: 'heatmap' | 'month'` with localStorage persistence
  - [ ] 1.2 Add toggle button group with `CalendarDays` and `Grid3x3` Lucide icons
  - [ ] 1.3 Style active toggle: `bg-card shadow-sm`, inactive: `text-muted-foreground`
- [ ] Task 2: Extract existing heatmap into conditional rendering block (AC: 1)
  - [ ] 2.1 Wrap existing heatmap grid in `{viewMode === 'heatmap' && ...}` conditional
  - [ ] 2.2 Verify heatmap still works identically when active
- [ ] Task 3: Create month-view grid component (AC: 2, 6)
  - [ ] 3.1 Calculate first day of month, number of days, overflow days from prev/next months
  - [ ] 3.2 Render 7-column CSS grid with day-of-week headers
  - [ ] 3.3 Render day cells with correct numbers
  - [ ] 3.4 Add month navigation with `ChevronLeft`/`ChevronRight` buttons + "Month YYYY" heading
  - [ ] 3.5 Overflow days: `text-muted-foreground/30` opacity
- [ ] Task 4: Apply study day styling (AC: 3, 4, 5)
  - [ ] 4.1 Studied day: `bg-brand text-brand-foreground rounded-2xl font-bold`
  - [ ] 4.2 Today (not studied): `ring-2 ring-brand ring-offset-2 rounded-2xl`
  - [ ] 4.3 Today (studied): `bg-brand text-brand-foreground rounded-2xl ring-2 ring-brand ring-offset-2`
  - [ ] 4.4 Freeze day: `bg-brand-soft text-freeze-day-text rounded-2xl` + small `Snowflake` icon overlay
  - [ ] 4.5 Future days: `text-muted-foreground`
  - [ ] 4.6 Missed past days: default text, no background
- [ ] Task 5: Tooltips on day cells (AC: 9)
  - [ ] 5.1 Reuse existing `TooltipContent` from heatmap: date, lesson count, study minutes, courses
  - [ ] 5.2 Wrap each day cell in `Tooltip`/`TooltipTrigger`/`TooltipContent`
- [ ] Task 6: Verify confetti and milestones still work (AC: 7)
  - [ ] 6.1 Ensure `ConfettiExplosion` trigger is view-agnostic
  - [ ] 6.2 Milestone toasts via Sonner remain unchanged

## Design Guidance

**Design reference:** Stitch `streak-calendar.html` — Variation A: Month Focus (Section 2)

**Month-view layout (from Stitch):**
```
     M   T   W   T   F   S   S
    ┌───┬───┬───┬───┬───┬───┬───┐
    │23 │24 │25 │26 │27 │28 │ 1 │  <- overflow days dimmed
    ├───┼───┼───┼───┼───┼───┼───┤
    │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │  <- studied days = bg-brand
    └───┴───┴───┴───┴───┴───┴───┘
```

**Cell sizing:** `aspect-square` cells with centered day numbers, `rounded-2xl`

**Lucide icon mapping:**
- CalendarDays -> `CalendarDays` (month-view toggle)
- Grid3x3 -> `Grid3x3` (heatmap toggle)
- chevron_left -> `ChevronLeft`
- chevron_right -> `ChevronRight`
- ac_unit -> `Snowflake` (freeze days)

**Design tokens (no hardcoded colors):**
- Studied: `bg-brand text-brand-foreground`
- Today ring: `ring-brand ring-offset-2`
- Freeze: `bg-brand-soft text-freeze-day-text`
- Overflow: `text-muted-foreground` at 30% opacity
- Future: `text-muted-foreground`
- Headers: `text-muted-foreground font-bold text-sm tracking-widest`

## Implementation Notes

**Files to modify:**
- `src/app/components/StudyStreakCalendar.tsx` — add view toggle + month-view rendering

**Data source:** Reuse existing `StreakSnapshot` and activity data from `studyLog.ts` — no new data needed. The `getStudyLogActivity()` and `getStudyDaysSet()` functions already provide the day-level data.

**Month calculation:** Use standard JS `Date` for first-day-of-month offset and days-in-month. No new date library needed.

## Testing Notes

- E2E: toggle between heatmap and month-view
- E2E: verify studied days show brand background
- E2E: verify today highlighting (ring)
- E2E: verify month navigation (back/forward)
- E2E: verify freeze day icon rendering
- E2E: verify tooltip on hover
- E2E: verify localStorage persistence of view preference
- Verify confetti still fires on milestone in month-view

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
