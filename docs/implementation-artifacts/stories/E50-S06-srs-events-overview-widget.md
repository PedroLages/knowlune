---
story_id: E50-S06
story_name: "SRS Events in Feed + Overview Widget"
status: in-progress
started: 2026-04-04
completed:
reviewed: in-progress
review_started: 2026-04-04
review_gates_passed: []
burn_in_validated: false
---

# Story 50.06: SRS Events in Feed + Overview Widget

## Story

As a learner,
I want SRS review reminders in my calendar feed and a "Today's Study Plan" on my dashboard,
So that I never forget flashcard reviews and can see my daily study agenda at a glance.

## Acceptance Criteria

**AC1:** Given a user with flashcards due tomorrow, when the feed is generated, then a "Review: X flashcards due" event appears for tomorrow at the user's timezone.

**AC2:** Given a user with no flashcards due on a given day, when the feed is generated, then no SRS event appears for that day.

**AC3:** Given today is Wednesday and the user has 2 study blocks on Wednesday, when they open Overview, then "Today's Study Plan" shows both blocks in time order.

**AC4:** Given 5 flashcards are due today, when the user views the Overview widget, then "5 flashcards due for review" appears with a "Review now" button.

**AC5:** Given no schedules or due cards exist for today, when the user views Overview, then the widget shows "No study blocks today" with a CTA to create one.

**AC6:** Given a user clicks "Start" on a study block linked to a course, when the button is clicked, then they navigate to that course page.

## Tasks / Subtasks

- [ ] Task 1: Add SRS event generation to feed endpoint (AC: 1, 2)
  - [ ] 1.1 Update `server/routes/calendar.ts` — after generating study block events, add SRS summary events
  - [ ] 1.2 Query `flashcards` table for records with `nextReviewAt` in the next 90 days
  - [ ] 1.3 Aggregate by date: count cards due per day
  - [ ] 1.4 For each day with due cards, generate VEVENT:
    - UID: `srs-{YYYY-MM-DD}@knowlune.app`
    - SUMMARY: `"Review: {count} flashcards due"`
    - DTSTART: user's preferred review time (default 09:00) in their timezone
    - DURATION: `PT30M` (estimated 30 min)
    - No RRULE (each day is individual — SRS intervals are irregular)
    - DESCRIPTION: `"You have {count} flashcards due for spaced repetition review in Knowlune."`
  - [ ] 1.5 Skip days with 0 due cards
  - [ ] 1.6 Implement full `generateSRSSummaryEvents()` in `src/lib/icalFeedGenerator.ts` (was stubbed in E50-S02)

- [ ] Task 2: Create `TodaysStudyPlan` widget component (AC: 3, 4, 5, 6)
  - [ ] 2.1 Create `src/app/components/figma/TodaysStudyPlan.tsx` (NEW)
  - [ ] 2.2 Card widget matching existing Overview dashboard pattern (Card/CardHeader/CardContent)
  - [ ] 2.3 Header: "Today's Study Plan" with Calendar icon + `text-brand` accent
  - [ ] 2.4 Body: time-ordered list of today's study blocks:
    - Each block: time badge (`bg-brand-soft text-brand-soft-foreground`) + course name + duration + "Start" button
    - "Start" button: `variant="brand-ghost"` — navigates to course page via React Router
  - [ ] 2.5 SRS section: "X flashcards due for review" with `variant="brand-outline"` "Review now" button (navigates to flashcard review page)
  - [ ] 2.6 Empty state: "No study blocks today." with `text-muted-foreground` + "Schedule study time" CTA link (navigates to Settings > Calendar)
  - [ ] 2.7 Footer: "View full schedule" link to Settings > Calendar section
  - [ ] 2.8 Query `useStudyScheduleStore.getSchedulesForDay(todayDayOfWeek)` for today's blocks
  - [ ] 2.9 Query `useFlashcardStore` for due flashcard count (cards with `nextReviewAt <= today`)

- [ ] Task 3: Integrate widget into Overview page (AC: 3, 4, 5)
  - [ ] 3.1 Import `TodaysStudyPlan` in `src/app/pages/Overview.tsx`
  - [ ] 3.2 Add `<TodaysStudyPlan />` widget — place prominently (before or after existing stats widgets, based on existing layout grid)
  - [ ] 3.3 Widget loads schedule data on mount via `useStudyScheduleStore.loadSchedules()` if not already loaded
  - [ ] 3.4 Determine today's day of week using `new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()` mapped to `DayOfWeek`

## Design Guidance

**Layout approach:**
- Card widget consistent with existing Overview dashboard cards
- Time-ordered vertical list for study blocks
- SRS section separated by a `Separator` component

**Component structure:**
- `TodaysStudyPlan` → Card > CardHeader + CardContent
- Study block items → flex row: time badge | course name | duration | Start button
- SRS row → flex row: flashcard icon | count text | Review now button

**Design tokens (mandatory):**
- Card: `bg-card` background
- Header icon: `text-brand`
- Time badge: `bg-brand-soft text-brand-soft-foreground rounded-md px-2 py-1 text-xs font-medium`
- Course name: `text-foreground font-medium`
- Duration: `text-muted-foreground text-sm`
- Start button: `variant="brand-ghost"` with `size="sm"`
- SRS count: `text-foreground` (neutral, not alarming)
- Review now button: `variant="brand-outline"` with `size="sm"`
- Empty state text: `text-muted-foreground`
- CTA link: `text-brand hover:underline`
- Footer link: `text-muted-foreground hover:text-foreground text-sm`

**Responsive strategy:**
- Widget full-width on mobile, fits within existing Overview grid on desktop
- Study block items: stack time + course vertically on mobile, inline on desktop
- Touch targets >= 44x44px for Start and Review now buttons

**Accessibility:**
- Card: role="region" with aria-label="Today's study plan"
- Start button: aria-label="Start studying {courseName}"
- Review now button: aria-label="Review {count} due flashcards"
- Empty state CTA: descriptive link text
- Time badges: not announced as separate elements (decorative, info in aria-label of parent)

## Implementation Notes

**Key files:**
- `server/routes/calendar.ts` — Add SRS event generation to feed
- `src/lib/icalFeedGenerator.ts` — Full `generateSRSSummaryEvents()` implementation
- `src/app/components/figma/TodaysStudyPlan.tsx` — NEW
- `src/app/pages/Overview.tsx` — Add widget import and placement

**Dependencies:**
- E50-S01 (useStudyScheduleStore with getSchedulesForDay)
- E50-S02 (calendar route and iCal generation utilities)
- E50-S05 (schedule editor — for "Schedule study time" CTA navigation)
- `useFlashcardStore` (existing — for due flashcard count query)

**SRS event notes:**
- 90-day rolling window prevents feed bloat
- Each SRS event is a standalone VEVENT (no RRULE) because SRS intervals are irregular
- UID `srs-{YYYY-MM-DD}@knowlune.app` ensures calendar apps update counts on feed refresh
- SRS events use neutral language: "Review: X flashcards due" (not "OVERDUE")

**Today's day calculation:**
- Use `Intl.DateTimeFormat` or `toLocaleDateString` for current day, map to `DayOfWeek` type
- Note: use deterministic time in tests (FIXED_DATE pattern per test-patterns.md)

## Testing Notes

**API tests (SRS events):**
- Feed with flashcards due in next 90 days → SRS VEVENT per day with due cards
- Feed with no flashcards → no SRS VEVENTs
- SRS event UID format: `srs-{YYYY-MM-DD}@knowlune.app`
- SRS event DURATION is `PT30M`
- SRS events respect user timezone

**E2E tests (Overview widget):**
- Seed study blocks for today's day → widget shows blocks in time order
- Seed due flashcards → widget shows count with Review now button
- No schedules or cards today → empty state with CTA
- Click Start → navigates to course page
- Click Review now → navigates to flashcard review

**Unit tests:**
- `generateSRSSummaryEvents()` with 3 days of due cards → 3 SRS events
- `generateSRSSummaryEvents()` with 0 due cards → empty array
- Day-of-week calculation matches DayOfWeek type

**Edge cases:**
- Flashcard count = 0 for today but > 0 for tomorrow — widget shows "No study blocks" (SRS only in feed, not widget unless due today)
- 100+ flashcards due — singular/plural handling ("1 flashcard" vs "100 flashcards")
- User in UTC-12 timezone — day boundary edge case
- Study block spans midnight — show in correct day

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
