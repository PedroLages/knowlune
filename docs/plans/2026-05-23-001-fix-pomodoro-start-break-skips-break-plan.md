---
title: "fix: Pomodoro 'Start Break' Button Skips Break Instead of Starting It"
type: fix
status: active
date: 2026-05-23
---

# fix: Pomodoro "Start Break" Button Skips Break Instead of Starting It

## Overview

When `autoStartBreak` is disabled in Pomodoro preferences, clicking the "Start Break" button that appears after a focus session ends skips the break entirely instead of starting the break countdown. The button is wired to the wrong action — `skip` instead of a new `startBreak` action.

## Problem Frame

On the course detail page (`/courses/:id`), after a focus session completes with `autoStartBreak: false`:

1. The hook transitions to `phase='break', status='stopped'` with `timeRemaining=breakDuration`
2. The UI renders a "Start Break" button at [PomodoroTimer.tsx:186](src/app/components/figma/PomodoroTimer.tsx#L186)
3. That button's `onClick` calls `skip()`, which invokes `handlePhaseComplete('break')` — treating the break as *completed*
4. The break never runs; the timer jumps to idle (or the next focus, if `autoStartFocus` is enabled)

The hook has no action to transition from `phase='break', status='stopped'` to `phase='break', status='running'`. The `start()` action always begins a focus session, and `resume()` only works from the paused state.

## Requirements Trace

- **R1.** Clicking "Start Break" must start the break countdown from `breakDuration`, not skip the break
- **R2.** The fix must not change behavior when `autoStartBreak: true` (existing auto-start flow is correct)
- **R3.** The fix must not change behavior of the Skip button (intentionally skipping a phase is a separate action)

## Scope Boundaries

- Only the manual break-start flow is in scope (`autoStartBreak: false` path)
- No changes to `autoStartFocus`, pause/resume, reset, or the auto-start break flow
- No UI layout or preference changes

## Context & Research

### Relevant Code and Patterns

- [usePomodoroTimer.ts](src/hooks/usePomodoroTimer.ts) — Drift-free countdown hook. `startCountdown(duration, phase)` is the internal primitive that begins any timer phase. `start()` wraps it for focus; no equivalent exists for break.
- [PomodoroTimer.tsx](src/app/components/figma/PomodoroTimer.tsx) — Popover UI. Button wiring at line 186.
- [usePomodoroTimer.test.ts](src/hooks/__tests__/usePomodoroTimer.test.ts) — Existing hook tests with fake timers. Test at line 127 already sets up the `autoStartBreak: false` scenario.
- Original plan: [docs/plans/e21-s03-pomodoro-focus-timer-plan.md](docs/plans/e21-s03-pomodoro-focus-timer-plan.md) — Documents the original `PomodoroActions` interface and the state machine.

### Existing pattern from `useQuizTimer`

The hook already follows the drift-free wall-clock anchoring pattern from `useQuizTimer`. The `startCountdown` function handles all timer mechanics — the fix only adds a public entry point to call it for the break phase.

## Key Technical Decisions

- **Add `startBreak` as a new action** rather than overloading `resume`. `resume` means "continue from paused" and checks `remainingAtPauseRef`. Conflating "start from stopped" with "resume from paused" would make the state machine harder to reason about.
- **Keep `skip` unchanged.** The Skip button is a separate intentional action — it correctly completes the current phase. The bug is only in the "Start Break" button wiring.

## Implementation Units

- [ ] **Unit 1: Add `startBreak` action to `usePomodoroTimer`**

**Goal:** Expose an action that starts the break countdown from a stopped state.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/hooks/usePomodoroTimer.ts`
- Test: `src/hooks/__tests__/usePomodoroTimer.test.ts`

**Approach:**
- Add `startBreak: () => void` to the `PomodoroActions` interface (line 18)
- Add a `startBreak` callback after the existing `start` callback (around line 181):
  - Calls `startCountdown(breakDurationRef.current, 'break')`
  - Same pattern as `start()`, which calls `startCountdown(focusDurationRef.current, 'focus')`
- Include `startBreak` in the return object

**Patterns to follow:**
- `start` callback at [usePomodoroTimer.ts:179](src/hooks/usePomodoroTimer.ts#L179) — the `startBreak` implementation mirrors this exactly, only differing in the phase and duration ref

**Test scenarios:**
- Happy path: Calling `startBreak()` when `phase='break', status='stopped'` (after focus completes with `autoStartBreak: false`) transitions to `phase='break', status='running'` with `timeRemaining` equal to `breakDuration`
- Happy path: After `startBreak()` is called, advancing timers by `breakDuration` fires `onBreakComplete` and transitions to idle (when `autoStartFocus: false`)
- Edge case: Calling `startBreak()` from idle state — should start a break timer regardless (the hook doesn't guard against this; documenting it as acceptable since the UI never exposes this path)

**Verification:**
- `npx vitest run src/hooks/__tests__/usePomodoroTimer.test.ts` passes
- New test cases cover the `startBreak` action

---

- [ ] **Unit 2: Wire "Start Break" button to `startBreak` in `PomodoroTimer`**

**Goal:** The "Start Break" button starts the break countdown instead of skipping the break.

**Requirements:** R1, R3

**Dependencies:** Unit 1 (`startBreak` must exist on the hook)

**Files:**
- Modify: `src/app/components/figma/PomodoroTimer.tsx`

**Approach:**
- Destructure `startBreak` from `usePomodoroTimer` on line 58
- Change line 186 from `onClick={phase === 'break' ? skip : start}` to `onClick={phase === 'break' ? startBreak : start}`

**Patterns to follow:**
- Existing destructuring pattern on line 58

**Test scenarios:**
- Happy path: When `phase='break', status='stopped'` (break pending after focus), clicking the "Start Break" button (`data-testid="pomodoro-start-phase"`) starts the break countdown
- Regression: The Skip button (`data-testid="pomodoro-skip"`) still skips the current phase when clicked during break

**Verification:**
- `npm run build` succeeds (TypeScript checks that `startBreak` exists on the hook return type)

---

- [ ] **Unit 3: Review and update E2E tests**

**Goal:** Ensure E2E tests correctly validate the "Start Break" flow and catch regressions.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 2

**Files:**
- Review: `tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts`

**Approach:**
- Review existing tests for interactions with the `pomodoro-start-phase` button
- If the existing test for manual break start expects the skip behavior, update it to expect the break countdown to run
- If no test covers the manual break start flow, add one

**Test scenarios:**
- Happy path: Disable auto-start break in preferences → start focus → wait for focus to complete → click "Start Break" → verify break countdown is displayed and counting down
- Regression: Enable auto-start break → start focus → wait for focus to complete → verify break starts automatically (no "Start Break" button appears)

**Verification:**
- `npx playwright test tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts` passes

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `startBreak` called from a non-break phase (e.g., idle) | The hook's `startCountdown` sets phase to `'break'` unconditionally — acceptable since the UI never exposes this path. If needed later, a guard can be added. |

## Sources & References

- Original plan: [docs/plans/e21-s03-pomodoro-focus-timer-plan.md](docs/plans/e21-s03-pomodoro-focus-timer-plan.md)
- Hook source: [src/hooks/usePomodoroTimer.ts](src/hooks/usePomodoroTimer.ts)
- Component source: [src/app/components/figma/PomodoroTimer.tsx](src/app/components/figma/PomodoroTimer.tsx)
- Unit tests: [src/hooks/__tests__/usePomodoroTimer.test.ts](src/hooks/__tests__/usePomodoroTimer.test.ts)
- E2E tests: [tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts](tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts)
