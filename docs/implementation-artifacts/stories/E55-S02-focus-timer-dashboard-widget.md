---
story_id: E55-S02
story_name: "Focus Timer Dashboard Widget"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 55.2: Focus Timer Dashboard Widget

## Story

As a learner on the Overview dashboard,
I want a large, immersive focus timer widget with animated SVG ring, phase tabs, and session counter,
So that I can start and manage focus sessions directly from my dashboard without opening a popover.

## Acceptance Criteria

**Given** the Overview dashboard
**When** the FocusTimerWidget is rendered
**Then** it displays a large SVG circular timer ring (~192px) with the time remaining centered inside

**Given** the timer is running
**When** time progresses
**Then** the SVG ring stroke depletes smoothly using CSS `stroke-dashoffset` transition (1s linear), and respects `prefers-reduced-motion` by disabling the transition

**Given** the widget
**When** I view the tab selector
**Then** I see three tabs: "25m Work", "5m Break", "15m Break" (matching the user's Pomodoro preferences for durations)

**Given** the timer is idle or stopped
**When** I click a different duration tab
**Then** the timer resets to that duration and phase (focus or break)

**Given** the widget
**When** I view the control row
**Then** I see Start/Pause (toggle), and Reset (`RotateCcw` icon) buttons

**Given** the timer is running
**When** I click Pause
**Then** the ring animation freezes and the button toggles to a Play icon

**Given** the widget
**When** sessions are completed
**Then** I see "N of M sessions completed" text below the controls (M = 4 default, configurable)

**Given** the widget renders on the Overview page
**When** the timer state changes
**Then** it reads from and writes to `usePomodoroStore` (shared with the popover timer from E55-S01)

**Given** the ring in different phases
**When** the phase is "focus"
**Then** the ring stroke uses `stroke: var(--brand)` color

**Given** the ring in different phases
**When** the phase is "break"
**Then** the ring stroke uses `stroke: var(--success)` color

## Tasks / Subtasks

- [ ] Task 1: Create `src/app/components/figma/FocusTimerWidget.tsx` (AC: 1, 8)
  - [ ] 1.1 Import and consume state from `usePomodoroStore`
  - [ ] 1.2 Build card container with `bg-card rounded-[24px] shadow-sm` styling
- [ ] Task 2: Implement SVG timer ring (AC: 1, 2, 9, 10)
  - [ ] 2.1 Create SVG with track circle (`stroke: var(--muted)`) and progress circle
  - [ ] 2.2 Calculate `stroke-dasharray` = 2 * pi * radius, `stroke-dashoffset` from timeRemaining/totalDuration
  - [ ] 2.3 Add CSS `transition: stroke-dashoffset 1s linear` on progress circle
  - [ ] 2.4 Add `@media (prefers-reduced-motion: reduce)` to disable transition
  - [ ] 2.5 Color ring stroke based on phase: `--brand` for focus, `--success` for break
  - [ ] 2.6 Center time display inside ring: large bold text + "Focusing"/"Break" label
- [ ] Task 3: Build phase tab selector (AC: 3, 4)
  - [ ] 3.1 Pill-shaped tab group: "25m Work" | "5m Break" | "15m Break"
  - [ ] 3.2 Active tab: `bg-card text-brand shadow-sm`, inactive: `text-muted-foreground`
  - [ ] 3.3 Tab click: reset timer to selected phase/duration via store action
  - [ ] 3.4 Read actual durations from Pomodoro preferences (not hardcoded 25/5/15)
- [ ] Task 4: Build control buttons (AC: 5, 6)
  - [ ] 4.1 Start/Pause toggle button (large, brand gradient background)
  - [ ] 4.2 Reset button (`RotateCcw` icon, muted color)
  - [ ] 4.3 Wire buttons to store actions: `start()`, `pause()`, `resume()`, `reset()`
- [ ] Task 5: Session counter display (AC: 7)
  - [ ] 5.1 "N of M sessions completed" pill badge below controls
  - [ ] 5.2 M sourced from preferences (default 4)
- [ ] Task 6: Add to Overview.tsx (AC: 1)
  - [ ] 6.1 Add FocusTimerWidget to the dashboard grid (2-column layout with FocusStatsCard)

## Design Guidance

**Design reference:** Stitch `deep-focus-mode.html` — Variation A: Immersive Focus (Section 02)

**Layout:** 2-column grid on desktop (`md:grid-cols-2`): FocusTimerWidget left, FocusStatsCard right. Full-width stack on mobile.

**SVG Ring specs (from Stitch):**
- Ring container: 192x192px (w-48 h-48)
- Track circle: `r="88"`, `stroke-width="6"`, `stroke: var(--muted)` (design token for `surface-container-low`)
- Progress circle: `r="88"`, `stroke-width="8"`, `stroke-linecap="round"`, `-rotate-90` transform
- Centered text: time in `text-4xl font-black`, phase label in `text-xs uppercase tracking-widest text-muted-foreground`

**Lucide icon mapping:**
- Play -> `Play` (filled variant via fill prop)
- Pause -> `Pause`
- Reset -> `RotateCcw`

**Design tokens (no hardcoded colors):**
- Card bg: `bg-card`
- Ring track: `text-muted` or `text-surface-sunken`
- Focus ring: `text-brand`
- Break ring: `text-success`
- Tab active: `text-brand`
- Tab inactive: `text-muted-foreground`
- Session counter: `bg-surface-sunken text-muted-foreground`

## Implementation Notes

**Files to create:**
- `src/app/components/figma/FocusTimerWidget.tsx`

**Files to modify:**
- `src/app/pages/Overview.tsx` — add FocusTimerWidget to dashboard

**Dependencies:** `usePomodoroStore` from E55-S01

## Testing Notes

- E2E: verify ring renders, start/pause/reset controls work
- E2E: verify tab switching changes timer phase
- Verify `prefers-reduced-motion` disables transition (unit test CSS class presence)
- Verify ring color changes between focus and break phases

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
