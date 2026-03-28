---
story_id: E55-S03
story_name: "Today's Focus Stats Card"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 55.3: Today's Focus Stats Card

## Story

As a learner reviewing my daily progress,
I want a companion card showing my focus session statistics for today,
So that I can see my total focus time, deep work percentage, and break efficiency at a glance.

## Acceptance Criteria

**Given** the Overview dashboard with the Focus Timer Widget
**When** the FocusStatsCard is rendered alongside it
**Then** it displays three stat rows: "Total Focus" (with `Clock` icon), "Deep Work" (with `Brain` icon), "Break Efficiency" (with `Coffee` icon)

**Given** I have completed 3 focus sessions totaling 75 minutes today
**When** I view the Total Focus stat
**Then** it displays "1h 15m" formatted as hours and minutes

**Given** I have spent 75 minutes in focus and 15 minutes in break today
**When** I view the Deep Work percentage
**Then** it displays "83%" (focus time / (focus time + break time) * 100, rounded)

**Given** I completed 3 breaks and skipped 1 break early (before 80% of configured duration elapsed)
**When** I view the Break Efficiency stat
**Then** it displays "75%" (3 full breaks out of 4 total breaks)

**Given** no focus sessions have been completed today
**When** I view the FocusStatsCard
**Then** all stats show zero/default values: "0m", "0%", "—"

**Given** focus session data
**When** a new day begins (midnight crossing)
**Then** the daily stats reset to zero (keyed by `toLocaleDateString('sv-SE')` date string)

**Given** the stats card needs daily session data
**When** a Pomodoro focus session completes
**Then** the session is recorded in the Zustand store with `{ startedAt, duration, phase, completedAt, wasSkipped }` and persisted to localStorage under a `pomodoro-daily-stats` key

**Given** the card layout
**When** rendered
**Then** each stat row has an icon (design token color), label, and bold value aligned to the right, separated by a subtle border, matching the Stitch Variation A layout

## Tasks / Subtasks

- [ ] Task 1: Extend `usePomodoroStore` with daily session tracking (AC: 6, 7)
  - [ ] 1.1 Add `dailySessions` array to store: `{ startedAt: string, duration: number, phase: PomodoroPhase, completedAt: string, wasSkipped: boolean }`
  - [ ] 1.2 Record session on phase completion (focus complete, break complete, break skipped)
  - [ ] 1.3 Persist `dailySessions` to localStorage key `pomodoro-daily-stats` with date prefix
  - [ ] 1.4 On store hydration: check date key, clear if stale (different day)
- [ ] Task 2: Add computed selectors for stats (AC: 2, 3, 4)
  - [ ] 2.1 `getTotalFocusMinutes()` — sum of completed focus session durations
  - [ ] 2.2 `getDeepWorkPercentage()` — focus time / (focus + break time) * 100
  - [ ] 2.3 `getBreakEfficiency()` — % of breaks where actual >= 80% of configured duration
- [ ] Task 3: Create `src/app/components/figma/FocusStatsCard.tsx` (AC: 1, 5, 8)
  - [ ] 3.1 Three stat rows with icon + label + value layout
  - [ ] 3.2 Format total focus as "Xh Ym" (handle edge cases: 0m, <1h)
  - [ ] 3.3 Zero-state display for empty sessions
  - [ ] 3.4 Border separators between rows (`border-b border-muted`)
- [ ] Task 4: Style with design tokens (AC: 8)
  - [ ] 4.1 Clock icon: `text-warning` (matches Stitch's tertiary-container/schedule color)
  - [ ] 4.2 Brain icon: `text-brand` (matches Stitch's primary/psychology color)
  - [ ] 4.3 Coffee icon: `text-success` (matches Stitch's teal-600/coffee color)
  - [ ] 4.4 Card: `bg-card rounded-[24px] shadow-sm`
- [ ] Task 5: Add to Overview.tsx grid alongside FocusTimerWidget (AC: 1)

## Design Guidance

**Design reference:** Stitch `deep-focus-mode.html` — Variation A: Stats Panel (right column of Section 02)

**Layout:** Companion card to FocusTimerWidget in 2-column grid. "Today Focus Stats" heading at top, 3 stat rows with dividers, optional motivational quote at bottom (stretch goal, not in AC).

**Stat row layout (from Stitch):**
```
[icon]  Label text          Bold Value
─────────────────────────────────────
```

**Lucide icon mapping:**
- schedule/timer -> `Clock`
- psychology -> `Brain`
- coffee -> `Coffee`

**Design tokens:**
- Card: `bg-card rounded-[24px]`
- Heading: `text-foreground font-bold text-2xl`
- Icon colors: `text-warning` (clock), `text-brand` (brain), `text-success` (coffee)
- Value text: `text-foreground font-bold text-lg`
- Label text: `text-foreground font-medium`
- Dividers: `border-b border-muted`

## Implementation Notes

**Files to create:**
- `src/app/components/figma/FocusStatsCard.tsx`

**Files to modify:**
- `src/stores/usePomodoroStore.ts` — add daily session tracking + computed selectors
- `src/app/pages/Overview.tsx` — add FocusStatsCard to dashboard grid

**Dependencies:** `usePomodoroStore` from E55-S01

**Date handling:** Use `toLocaleDateString('sv-SE')` for date keys (project convention from engineering-patterns.md)

## Testing Notes

- Unit test computed selectors: total focus, deep work %, break efficiency
- Unit test edge cases: zero sessions, only focus (no breaks), all breaks skipped
- Unit test midnight crossing: verify daily reset
- E2E: complete a focus session, verify stats update in real-time

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
