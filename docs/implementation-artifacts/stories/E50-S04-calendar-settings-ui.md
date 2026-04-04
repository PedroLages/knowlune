---
story_id: E50-S04
story_name: "Calendar Settings UI"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: true
review_started: 2026-04-04
review_gates_passed:
  - build
  - format-check
  - lint
  - type-check
  - unit-tests-skipped
  - e2e-tests
  - design-review
  - code-review
  - code-review-testing
  - performance-benchmark
  - security-review
  - exploratory-qa-skipped
  - glm-code-review
  - openai-code-review-skipped
burn_in_validated: false
---

# Story 50.04: Calendar Settings UI

## Story

As a learner,
I want a Calendar Integration section in Settings,
So that I can enable the feed, copy the URL, preview upcoming events, and manage my study schedule.

## Acceptance Criteria

**AC1:** Given a user navigates to Settings, when they scroll to Calendar Integration, then they see a disabled section with explanation text ("Enable to sync your study schedule with Google Calendar, Apple Calendar, or Outlook") and a toggle switch.

**AC2:** Given a user enables the feed, when the toggle is switched on, then the feed URL appears in a read-only input with a copy button.

**AC3:** Given a user clicks "Copy", when the URL is in the input, then it's copied to clipboard and a "Copied!" toast appears.

**AC4:** Given a user clicks "Regenerate", when they confirm in the AlertDialog, then the URL changes and a warning toast says "Old calendar subscriptions will stop updating."

**AC5:** Given a user has 3 study schedules, when viewing the weekly summary, then all 3 appear grouped by day with correct times and course names, and the footer shows total hours/week.

**AC6:** Given a user clicks "Download .ics", when they have schedules, then a file downloads and can be imported into a calendar app.

## Tasks / Subtasks

- [ ] Task 1: Create `CalendarSettingsSection` component (AC: 1, 2, 3, 4, 6)
  - [ ] 1.1 Create `src/app/components/figma/CalendarSettingsSection.tsx` (NEW)
  - [ ] 1.2 Card header: Calendar icon in `bg-brand-soft` circle + "Calendar Integration" title + `Switch` toggle
  - [ ] 1.3 Disabled state: explanation text with `text-muted-foreground`
  - [ ] 1.4 Enabled state: feed URL in read-only `Input` with copy `Button` (variant="brand-outline")
  - [ ] 1.5 Copy handler: `navigator.clipboard.writeText()` + `toast("Copied!")`
  - [ ] 1.6 "Regenerate Feed URL" `Button` (variant="destructive") inside `AlertDialog` confirmation
  - [ ] 1.7 "Download .ics" `Button` (variant="brand-outline") — calls `generateIcsDownload()`
  - [ ] 1.8 Warning text with `text-warning`: "Google Calendar refreshes subscribed feeds every 12-24 hours. Changes may not appear immediately."
  - [ ] 1.9 "+ Add Study Block" `Button` (variant="brand") — opens `StudyScheduleEditor` sheet (from E50-S05)

- [ ] Task 2: Create `FeedPreview` component (AC: 2)
  - [ ] 2.1 Create `src/app/components/figma/FeedPreview.tsx` (NEW)
  - [ ] 2.2 `ScrollArea` list showing next 5 scheduled events from `useStudyScheduleStore`
  - [ ] 2.3 Each item: course badge (colored) + day name + time range + duration
  - [ ] 2.4 Empty state: "No upcoming study blocks" with `text-muted-foreground`

- [ ] Task 3: Create `StudyScheduleSummary` component (AC: 5)
  - [ ] 3.1 Create `src/app/components/figma/StudyScheduleSummary.tsx` (NEW)
  - [ ] 3.2 Group schedules by day (Mon → Sun)
  - [ ] 3.3 Each day row: day label + time range + course badge (e.g., "Mon: 9-10am ML, 2-3pm React")
  - [ ] 3.4 Footer: "Total: X hours/week across Y subjects"
  - [ ] 3.5 Empty state: "No study blocks scheduled yet. Create one to get started!"
  - [ ] 3.6 This component is reused by the Overview dashboard widget (E50-S06)

- [ ] Task 4: Integrate into Settings page (AC: 1)
  - [ ] 4.1 Import `CalendarSettingsSection` in `src/app/pages/Settings.tsx`
  - [ ] 4.2 Add `<CalendarSettingsSection />` after existing notification/reminder sections
  - [ ] 4.3 Settings.tsx is ~12K lines — add import and component reference only; all logic lives in the new component

## Design Guidance

**Layout approach:**
- Card-based section matching existing Settings patterns (see CourseReminderSettings for reference)
- `bg-surface-sunken/30` for card header background
- `bg-brand-soft` circle for calendar icon in header

**Component structure:**
- `CalendarSettingsSection` → parent Card containing all sub-components
- `FeedPreview` → ScrollArea list (inline within card)
- `StudyScheduleSummary` → text-based weekly view (inline within card)
- All use shadcn/ui primitives: Card, CardHeader, CardContent, Switch, Input, Button, AlertDialog, ScrollArea

**Design tokens (mandatory):**
- Toggle: Switch component (default styling)
- Copy button: `variant="brand-outline"`
- Regenerate button: `variant="destructive"`
- Download button: `variant="brand-outline"`
- Add block button: `variant="brand"`
- Warning text: `text-warning`
- Muted text: `text-muted-foreground`
- Card backgrounds: `bg-card` / `bg-surface-sunken/30`

**Responsive strategy:**
- Feed URL input + copy button: stack vertically on mobile
- Weekly summary: single column on all breakpoints (text-based, naturally responsive)
- Touch targets: all buttons >= 44x44px

**Accessibility:**
- Switch: aria-label="Enable calendar feed"
- Copy button: aria-label="Copy feed URL to clipboard"
- AlertDialog: proper focus trap and keyboard navigation
- Feed URL input: readonly with aria-label="Calendar feed subscription URL"

## Implementation Notes

**Key files:**
- `src/app/components/figma/CalendarSettingsSection.tsx` — NEW
- `src/app/components/figma/FeedPreview.tsx` — NEW
- `src/app/components/figma/StudyScheduleSummary.tsx` — NEW (reused by E50-S06)
- `src/app/pages/Settings.tsx` — Add import and component reference

**Dependencies:**
- E50-S01 (StudySchedule type and useStudyScheduleStore)
- E50-S03 (feedToken state, generateFeedToken, regenerateFeedToken, disableFeed, generateIcsDownload)
- E50-S05 (StudyScheduleEditor sheet — can be conditionally rendered if not yet built)

**Note on implementation order:** This story is positioned after S05 (schedule editor) in the recommended sequence (S01 → S02 → S03 → S05 → S04 → S06). The "+ Add Study Block" button opens the StudyScheduleEditor from S05.

## Testing Notes

**E2E tests:**
- Navigate to Settings → Calendar section visible with toggle off
- Enable toggle → feed URL appears with copy button
- Click copy → clipboard contains URL, toast appears
- Click Regenerate → AlertDialog opens → confirm → URL changes, toast appears
- Weekly summary shows correct day groupings
- Download .ics → file download triggers
- Disable toggle → feed URL section hidden

**Edge cases:**
- Clipboard API unavailable (HTTP, not HTTPS) — fallback or error toast
- 0 schedules — empty states render correctly
- Very long feed URL — input should truncate with ellipsis but copy full URL
- Rapid toggle on/off — should not create orphan tokens

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

Full report: `docs/reviews/design/design-review-2026-04-04-e50-s04.md`

**Summary**: No visual blockers. Design token compliance is excellent (zero hardcoded colors). All ARIA labels present. Touch targets ≥44px. Section renders correctly in the Settings page flow.

**MEDIUM**: Calendar section is far down the page — discoverability concern. Consider jump navigation or reordering sections in a future story.

**LOW**: "Add Study Block" button is permanently disabled (E50-S05 not yet built) — consider hiding it until S05 ships to avoid confusing users.

## Code Review Feedback

Full reports:
- `docs/reviews/code/code-review-2026-04-04-e50-s04.md`
- `docs/reviews/code/glm-code-review-2026-04-04-e50-s04.md`
- `docs/reviews/code/code-review-testing-2026-04-04-e50-s04.md`

**HIGH (fix before ship)**: Double toast on regenerate — `handleRegenerate` fires `toast.warning(...)` after `regenerateFeedToken()`, but the store already fires `toast.success(...)` on success. Remove the component-level toast or update the store's message to include the subscription warning.

**MEDIUM**: `isLoaded` in `useEffect` deps causes `loadFeedToken()` to re-run when schedules finish loading. Remove `isLoaded` from deps and call `loadSchedules()` unconditionally (store should deduplicate).

**LOW**: `key={i}` (array index) used in FeedPreview event list. Use a stable composite key: `` `${event.title}-${event.dayLabel}-${event.time}` ``.

**No E2E spec**: All 6 ACs lack automated test coverage. Add `tests/e2e/story-e50-s04.spec.ts` before finish-story.

**GLM also flagged**: Unhandled promise rejection in `handleToggle` and `handleRegenerate` (async callbacks without try/catch). The store handles errors with toasts, but component-level wrapping would be more resilient. Consider adding try/catch to both.

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
