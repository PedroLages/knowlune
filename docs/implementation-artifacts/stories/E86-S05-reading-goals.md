---
story_id: E86-S05
story_name: "Reading Goals"
status: backlog
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 86.5: Reading Goals

Status: backlog

## Story

As a learner,
I want to set daily reading goals and yearly book targets,
so that I can build consistent reading habits and track my progress toward personal learning milestones.

## Acceptance Criteria

1. **Given** the user navigates to Library settings or a Reading Goals section **When** they set a daily goal **Then** they can choose between minutes per day (15, 30, 45, 60, custom) or pages per day (10, 20, 30, 50, custom) as their daily reading target

2. **Given** the user sets a yearly book goal **When** they enter a number **Then** the system tracks books with status "Finished" and `finishedAt` within the current year toward that goal

3. **Given** a daily reading goal is set **When** the user views the Library page **Then** a compact progress ring shows today's reading progress (e.g., "18/30 min") using `bg-brand` fill color, with `bg-success` when the daily goal is met

4. **Given** a yearly book goal is set **When** the user views the Library page **Then** a yearly progress indicator shows books completed vs target (e.g., "7/24 books") with a pace indicator ("2 books ahead of schedule" or "1 book behind")

5. **Given** the user completes their daily reading goal **When** the session ends **Then** a celebratory toast appears: "Daily reading goal reached!" with a checkmark icon

6. **Given** the user finishes a book **When** it pushes their yearly count to or past the yearly goal **Then** a special celebration toast appears: "Yearly reading goal achieved!"

7. **Given** reading goals exist **When** the user views the Reports page **Then** a "Reading Goals" card shows: current daily streak of goals met, longest daily streak, yearly progress chart (books completed per month vs pace line)

## Tasks / Subtasks

- [ ] Task 1: Add reading goals to data model (AC: 1, 2)
  - [ ] 1.1 Add `ReadingGoal` type to `src/data/types.ts`: `{ dailyType: 'minutes' | 'pages', dailyTarget: number, yearlyBookTarget: number, updatedAt: string }`
  - [ ] 1.2 Store reading goals in `useBookStore` (or a dedicated `useReadingGoalStore`) persisted to Dexie user preferences
  - [ ] 1.3 Add `dailyGoalStreak: number` and `longestDailyStreak: number` tracking fields

- [ ] Task 2: Create Reading Goals settings UI (AC: 1, 2)
  - [ ] 2.1 Create `src/app/components/library/ReadingGoalSettings.tsx`
  - [ ] 2.2 Daily goal: radio group (minutes vs pages) + preset buttons + custom input
  - [ ] 2.3 Yearly goal: number input with +/- stepper buttons
  - [ ] 2.4 Accessible from Library page header menu ("Reading Goals")

- [ ] Task 3: Daily progress ring on Library page (AC: 3)
  - [ ] 3.1 Create `src/app/components/library/DailyGoalRing.tsx`
  - [ ] 3.2 Circular progress using SVG `stroke-dashoffset` technique
  - [ ] 3.3 Colors: `stroke-brand` for in-progress, `stroke-success` when goal met
  - [ ] 3.4 Calculate today's reading from `bookSessions` table filtered to today's date
  - [ ] 3.5 Position: Library page header area, compact size

- [ ] Task 4: Yearly progress indicator (AC: 4)
  - [ ] 4.1 Create `src/app/components/library/YearlyGoalProgress.tsx`
  - [ ] 4.2 Show "X/Y books" with a linear progress bar
  - [ ] 4.3 Calculate pace: (yearlyTarget / 12) * currentMonth vs actual completed
  - [ ] 4.4 Text: "N books ahead/behind schedule" in `text-success` or `text-warning`

- [ ] Task 5: Goal completion celebrations (AC: 5, 6)
  - [ ] 5.1 After each reading session ends, check if daily goal is newly met
  - [ ] 5.2 Show `toast.success("Daily reading goal reached!", { icon: "✓" })`
  - [ ] 5.3 On book finish, check yearly goal progress
  - [ ] 5.4 Show special toast for yearly goal achievement

- [ ] Task 6: Reading Goals card in Reports (AC: 7)
  - [ ] 6.1 Add "Reading Goals" card to Reports page
  - [ ] 6.2 Show current daily streak, longest streak
  - [ ] 6.3 Monthly books completed bar chart vs pace line (recharts or existing chart library)

## Dev Notes

### Why Reading Goals Matter

Research from Bookly and StoryGraph shows reading goals with visual progress tracking drive 40-60% higher daily engagement. Combined with Knowlune's existing study streak, this creates a dual-reinforcement loop: the streak motivates daily activity, while reading goals give that activity a measurable target.

### Integration with Existing Features

- **Study streak**: Reading sessions already count toward the study streak (E85-S06). Reading goals add a *target amount* rather than just binary "did I read today?"
- **Reports page**: Add the Reading Goals card alongside existing study analytics
- **Book status**: Yearly goal counts books where `status === 'finished'` and `finishedAt` is in the current calendar year

### Design Patterns

- Progress ring: Follow the same SVG pattern used in existing dashboard widgets
- Use design tokens: `bg-brand`, `bg-success`, `text-warning` — never hardcoded colors
- Touch targets: all interactive elements >=44x44px

### Dependencies

- E85-S06 (Reading Session Tracking) — needed for daily minutes calculation
- E83-S01 (Book data model) — needed for Book status and finishedAt fields

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
