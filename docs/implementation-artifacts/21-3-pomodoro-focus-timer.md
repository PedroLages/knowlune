---
story_id: E21-S03
story_name: 'Pomodoro Focus Timer'
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 21.3: Pomodoro Focus Timer

## Story

As a learner practicing sustained study sessions,
I want a Pomodoro timer (25min focus / 5min break) integrated in the lesson player,
so that I maintain optimal focus and avoid burnout.

## Acceptance Criteria

**AC1: Focus Timer Display**

- Given I am on the lesson player page
- When I click the Pomodoro timer button in the lesson header
- Then a timer popover appears showing "25:00" in focus mode with start/pause controls

**AC2: Focus Countdown**

- Given the Pomodoro timer is running in focus mode
- When the 25-minute countdown reaches 00:00
- Then an audio notification plays and the timer switches to break mode (05:00)

**AC3: Break Countdown**

- Given the Pomodoro timer is running in break mode
- When the 5-minute break countdown reaches 00:00
- Then an audio notification plays, the session counter increments, and the timer resets to focus mode

**AC4: Session Counter**

- Given I have completed one or more Pomodoro cycles
- When I view the timer popover
- Then I see the count of completed focus sessions (e.g., "3 sessions")

**AC5: Timer Controls**

- Given the timer popover is visible
- When I interact with the controls
- Then I can start, pause, resume, and reset the timer

**AC6: Preferences Persistence**

- Given I have configured Pomodoro preferences (auto-start breaks, notification volume)
- When I close and reopen the browser
- Then my preferences are restored from localStorage

**AC7: Audio Notification**

- Given the timer reaches 00:00 (focus or break)
- When the notification fires
- Then a brief chime sound plays (respecting the user's volume preference)

## Tasks / Subtasks

- [x] Task 1: Create `usePomodoroTimer` hook with drift-free countdown (AC: 1,2,3,5)
- [x] Task 2: Create `PomodoroTimer` component with popover UI (AC: 1,4,5)
- [x] Task 3: Integrate timer button into LessonPlayer header (AC: 1)
- [x] Task 4: Add audio notification system with Web Audio API (AC: 7)
- [x] Task 5: Add Pomodoro preferences to localStorage settings (AC: 6)
- [x] Task 6: Connect session counter and cycle tracking (AC: 3,4)
- [x] Task 7: Write E2E tests for Pomodoro timer (AC: 1-7)
- [x] Task 8: Write unit tests for `usePomodoroTimer` hook (AC: 2,3,5)

## Design Guidance

[To be populated during implementation]

## Implementation Notes

**Implementation Plan:** [docs/plans/e21-s03-pomodoro-focus-timer-plan.md](plans/e21-s03-pomodoro-focus-timer-plan.md)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Web Design Guidelines Review

[Populated by /review-story]

## Challenges and Lessons Learned

- **Web Audio API for offline-safe chimes:** Used `AudioContext` with `OscillatorNode` to generate notification chimes programmatically instead of loading audio files. This avoids network dependencies and works offline, matching the local-first architecture.
- **Drift-free wall-clock countdown pattern:** Anchored the timer to an absolute `endTime` computed from `Date.now()` and recalculated remaining time on every tick and `visibilitychange` event. This prevents drift from `setInterval` throttling in background tabs — same pattern as `useQuizTimer`.
- **`phaseRef` to avoid stale closures:** The `setInterval` callback captures the phase at creation time. Using a `phaseRef` that stays in sync with React state ensures `handlePhaseComplete` always sees the current phase, not the one from when the interval was created.
- **Refs for callback stability:** All option callbacks (`onFocusComplete`, `onBreakComplete`) and boolean flags (`autoStartBreak`, `autoStartFocus`) are stored in refs to avoid re-triggering `useEffect` dependencies or recreating the interval on every render.
- **E2E hard waits justified:** The pause/resume test requires real elapsed time to verify the countdown freezes and resumes. Playwright clock API was considered but the timer uses `Date.now()` wall-clock anchoring, making real-time waits the most accurate validation approach.
