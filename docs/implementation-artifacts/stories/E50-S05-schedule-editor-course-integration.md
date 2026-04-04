---
story_id: E50-S05
story_name: "Schedule Editor + Course Integration"
status: draft
started:
completed:
reviewed: in-progress
review_started: 2026-04-04
review_gates_passed: []
burn_in_validated: false
---

# Story 50.05: Schedule Editor + Course Integration

## Story

As a learner,
I want a quick form to create study blocks from Settings or directly from a course page,
So that I can schedule study time in under 30 seconds with minimal friction.

## Acceptance Criteria

**AC1:** Given a user clicks "+ Add Study Block" in Settings, when the Sheet opens, then they see a form with course selector, day picker, time picker, duration, and reminder fields with sensible defaults.

**AC2:** Given a user selects Mon/Wed/Fri and 9:00 AM with 60 min duration, when they click Save, then a schedule is created with those values and a toast confirms "Schedule created".

**AC3:** Given a user opens the editor from a course detail page, when the Sheet opens, then the course is pre-selected and the title is "Study: {courseName}".

**AC4:** Given a user has an existing schedule, when they click Edit on it, then the Sheet opens in edit mode with all fields pre-populated.

**AC5:** Given a user clicks Save with no days selected, when validation runs, then an error message appears: "Select at least one day."

## Tasks / Subtasks

- [ ] Task 1: Create `DayPicker` component (AC: 1, 2)
  - [ ] 1.1 Create `src/app/components/figma/DayPicker.tsx` (NEW)
  - [ ] 1.2 Use shadcn `ToggleGroup` (type="multiple") with 7 toggle items
  - [ ] 1.3 Labels: "M", "T", "W", "T", "F", "S", "S" (abbreviated)
  - [ ] 1.4 Values map to `DayOfWeek[]`: monday, tuesday, wednesday, thursday, friday, saturday, sunday
  - [ ] 1.5 Props: `value: DayOfWeek[]`, `onChange: (days: DayOfWeek[]) => void`
  - [ ] 1.6 Mobile-friendly: min 44x44px touch targets, flex-wrap on small screens
  - [ ] 1.7 Use `bg-brand` for selected state, `bg-muted` for unselected

- [ ] Task 2: Create `TimePicker` component (AC: 1, 2)
  - [ ] 2.1 Create `src/app/components/figma/TimePicker.tsx` (NEW)
  - [ ] 2.2 `Popover` containing two `Select` dropdowns: hour (6-22) and minute (00, 15, 30, 45)
  - [ ] 2.3 Props: `value: string` ("HH:MM"), `onChange: (time: string) => void`
  - [ ] 2.4 Default: "09:00"
  - [ ] 2.5 Display: user-locale format via `Intl.DateTimeFormat` (12h/24h), store as 24h "HH:MM" internally
  - [ ] 2.6 Trigger button shows selected time with clock icon

- [ ] Task 3: Create `StudyScheduleEditor` Sheet component (AC: 1, 2, 3, 4, 5)
  - [ ] 3.1 Create `src/app/components/figma/StudyScheduleEditor.tsx` (NEW)
  - [ ] 3.2 Sheet (from right) with form fields:
    - Title: `Input` — auto-populated as "Study: {courseName}" when courseId provided, editable for free-form
    - Course: `Select` dropdown with courses from `useCourseStore` + "Free study block" option
    - Days: `<DayPicker />` component
    - Start time: `<TimePicker />` component
    - Duration: `Select` with options 30, 45, 60, 90, 120 minutes (default 60)
    - Reminder: `Select` with options 0 ("None"), 5, 10, 15, 30 minutes (default 15)
  - [ ] 3.3 Props: `courseId?: string` (pre-populates course), `scheduleId?: string` (edit mode), `open: boolean`, `onOpenChange: (open: boolean) => void`
  - [ ] 3.4 Create mode: calls `addSchedule()` from `useStudyScheduleStore`
  - [ ] 3.5 Edit mode: loads existing schedule, calls `updateSchedule()` on save
  - [ ] 3.6 Validation: at minimum 1 day selected, title non-empty
  - [ ] 3.7 Save button: `variant="brand"`, Cancel button: `variant="ghost"`
  - [ ] 3.8 Success toast: "Schedule created" (create) or "Schedule updated" (edit)

- [ ] Task 4: Add "Schedule study time" button to course detail (AC: 3)
  - [ ] 4.1 Identify course detail component (likely `src/app/pages/` or `src/app/components/figma/`)
  - [ ] 4.2 Add `Button` with `Calendar` icon and text "Schedule study time"
  - [ ] 4.3 Button uses `variant="brand-outline"`
  - [ ] 4.4 Opens `<StudyScheduleEditor courseId={course.id} />` sheet
  - [ ] 4.5 Pre-populates the course selector and auto-generates title

## Design Guidance

**Layout approach:**
- Sheet slides in from right (consistent with existing Sheet patterns in the app)
- Form fields stacked vertically with consistent spacing (gap-4)
- 4 visible fields maximum at once (progressive disclosure if needed)

**Component structure:**
- `StudyScheduleEditor` → Sheet > SheetContent > form
- `DayPicker` → ToggleGroup (inline within form)
- `TimePicker` → Popover > two Selects (inline within form)

**Design tokens (mandatory):**
- Day picker selected: `bg-brand text-brand-foreground`
- Day picker unselected: `bg-muted text-muted-foreground`
- Save button: `variant="brand"`
- Cancel button: `variant="ghost"`
- Course detail button: `variant="brand-outline"`
- Error text: `text-destructive`
- Sheet header: `text-foreground` for title, `text-muted-foreground` for description

**Responsive strategy:**
- Sheet: full-width on mobile (side="bottom" below md breakpoint?), right-side on desktop
- DayPicker: flex-wrap ensures 7 toggles fit on small screens
- TimePicker: popover positions above/below based on available space
- All touch targets >= 44x44px

**Accessibility:**
- DayPicker: each toggle has aria-label (e.g., "Monday", not just "M")
- TimePicker: aria-label="Select start time"
- Form validation: errors announced to screen readers via aria-live
- Sheet: proper focus management (first field focused on open, focus trap)
- Save/Cancel: keyboard accessible (Enter to save, Escape to cancel)

## Implementation Notes

**Key files:**
- `src/app/components/figma/DayPicker.tsx` — NEW
- `src/app/components/figma/TimePicker.tsx` — NEW
- `src/app/components/figma/StudyScheduleEditor.tsx` — NEW
- Course detail component — Add "Schedule study time" button

**Dependencies:**
- E50-S01 (StudySchedule type, useStudyScheduleStore with addSchedule/updateSchedule)
- `useCourseStore` (existing — for course dropdown list)

**UX target:** Schedule creation completable in under 30 seconds — sensible defaults mean user can just pick days and save.

**Pattern reference:** See `CourseReminderSettings` pattern in Settings.tsx for Sheet-based form precedent.

## Testing Notes

**E2E tests:**
- Open editor from Settings "Add Study Block" → form visible with defaults
- Select Mon/Wed/Fri, set time, save → schedule created, toast appears
- Open editor from course detail → course pre-selected, title auto-populated
- Edit existing schedule → all fields pre-populated, save updates record
- Save with no days → validation error displayed
- Cancel → no schedule created, sheet closes

**Unit tests:**
- DayPicker: toggle days on/off, verify `onChange` callback with correct `DayOfWeek[]`
- TimePicker: select hour/minute, verify `onChange` with "HH:MM" string
- Validation: empty title rejected, empty days rejected

**Edge cases:**
- All 7 days selected — should work (daily study)
- Course deleted after schedule creation — schedule persists with orphaned courseId (graceful handling)
- Very long course name in title — truncation in Sheet header
- Edit mode with missing scheduleId (schedule was deleted) — handle gracefully

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

- **Missing required type field caught at review time**: The `StudySchedule` type requires a `timezone` field that was omitted from the `scheduleData` object passed to `addSchedule()`. TypeScript caught this during the `/review-story` type-check gate. The fix was straightforward — `Intl.DateTimeFormat().resolvedOptions().timeZone` is the canonical way to get the user's local timezone. Lesson: always cross-check the target type's required fields when constructing an object literal; required fields on a shared data model type are easy to overlook when writing a new consumer.

- **Prettier auto-fixed on review**: Two branch files (`TimePicker.tsx`, `FeedPreview.tsx`) had minor formatting inconsistencies that Prettier auto-corrected during the format-check gate. These were small trailing whitespace and quote style issues. Lesson: run `npx prettier --write` locally before committing to avoid spurious fix commits during review.

- **`useId()` for accessible form label association**: Each form field uses `useId()` to generate unique, stable IDs for `<Label htmlFor>` and `<Input id>` pairing. This avoids collisions when multiple `StudyScheduleEditor` instances are rendered simultaneously (e.g., from different trigger points). React 18's `useId()` is the correct pattern — do not use `Math.random()` or static string IDs for form elements.

- **`FREE_STUDY` sentinel value for optional courseId**: The course selector must support a "Free study block" option where `courseId` is `undefined`. Using a `const FREE_STUDY = '__free__'` sentinel avoids the need to handle `""` (empty string) as a special case in downstream logic. Pattern: use an explicit sentinel constant rather than relying on empty string falsy checks, which are error-prone when a real ID could theoretically be empty.

- **Locale-aware time display via Intl**: The `TimePicker` displays time in the user's locale format (12h or 24h) using `Intl.DateTimeFormat`, while storing the value internally as 24h `HH:MM`. This separation of display format from storage format is the correct pattern — never store locale-formatted strings, always store canonical formats.

- **DayPicker ToggleGroup multiple selection**: The shadcn `ToggleGroup` with `type="multiple"` returns an array of selected values. The `aria-label` for each toggle must use the full day name (e.g., "Monday"), not the abbreviated label ("M"), to satisfy accessibility requirements. This was specified in the story but worth noting as a common oversight in abbreviated toggle UIs.
