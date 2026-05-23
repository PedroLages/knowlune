---
module: pomodoro_timer
date: 2026-05-23
problem_type: ui_bug
component: frontend_stimulus
severity: high
symptoms:
  - "Start Break button calls skip() instead of beginning the break countdown"
  - "Break phase is immediately completed when user clicks Start Break"
  - "Timer transitions directly to idle or next focus session without break"
  - "autoStartBreak disabled users cannot take a break after focus ends"
  - "No way to start a manual break from the UI when autoStartBreak is off"
root_cause: wrong_api
resolution_type: code_fix
tags:
  - pomodoro
  - timer
  - break
  - button-wrong-action
  - use-pomodoro-timer
  - ui-interaction
---

# Pomodoro "Start Break" Button Wired to skip() Instead of startBreak()

## Problem

When `autoStartBreak` is disabled, clicking the "Start Break" button skipped the break timer instead of starting it — jumping directly to idle or the next focus session. The button was wired to the wrong action because the hook had no `startBreak` action.

## Symptoms

- After a focus session ends (with `autoStartBreak: false`), "Start Break" button appears but calls `skip()` instead of starting the break
- The break timer never runs — the state jumps from `break/stopped` directly to `idle` (or next focus if `autoStartFocus` is enabled)
- No way to manually start a break timer from the UI

## What Didn't Work

- **Overloading `resume()`:** `resume` checks `remainingAtPauseRef` and is designed for paused→running transitions. Conflating "start from stopped" with "resume from paused" would make the state machine harder to reason about and introduce subtle bugs from stale `remainingAtPauseRef` values.

## Solution

The `usePomodoroTimer` hook was missing an action to transition from `phase='break', status='stopped'` to `phase='break', status='running'`. The fix adds a `startBreak` action mirroring the existing `start()` pattern.

**1. Added `startBreak` to the `PomodoroActions` interface** (`src/hooks/usePomodoroTimer.ts`):

```ts
export interface PomodoroActions {
  start: () => void
  startBreak: () => void  // new
  pause: () => void
  resume: () => void
  reset: () => void
  skip: () => void
}
```

**2. Implemented the callback, mirroring `start()`:**

```ts
const startBreak = useCallback(() => {
  startCountdown(breakDurationRef.current, 'break')
}, [startCountdown])
```

**3. Exposed it in the hook's return object** (typed as `PomodoroState & PomodoroActions`).

**4. Rewired the button** (`src/app/components/figma/PomodoroTimer.tsx`):

Before:
```tsx
onClick={phase === 'break' ? skip : start}
```

After:
```tsx
onClick={phase === 'break' ? startBreak : start}
```

## Why This Works

`startBreak` delegates to the same `startCountdown` primitive that `start()` uses. `startCountdown` handles the full timer lifecycle: drift-free wall-clock anchoring via `Date.now()`, interval management, phase-completion callbacks, and auto-transitions to the next phase. The button's existing guard (`phase === 'break'`) was already correct — it was just dispatching to the semantically wrong function. No state machine changes were needed.

## Prevention

- **State-machine action audit:** When adding user-facing buttons that map to timer states, verify every arrow in the state diagram has a corresponding callback in the hook. Missing transitions manifest as buttons wired to the closest-looking but wrong action.
- **Unit test coverage for manual-start paths:** The existing tests covered `start()` and `resume()` but not manual break start. Add a test for every "stopped → running" transition: focus-start, break-start, and resume-from-pause, for both automatic and manual triggers.
- **Button-label/action pairing:** If a button says "Start X", its `onClick` should call `startX` or delegate through it. A mismatched name (`skip` behind "Start Break") is a code smell that review should catch.

## Related

- Fix plan: [docs/plans/2026-05-23-001-fix-pomodoro-start-break-skips-break-plan.md](../plans/2026-05-23-001-fix-pomodoro-start-break-skips-break-plan.md)
- Original implementation plan: [docs/plans/e21-s03-pomodoro-focus-timer-plan.md](../plans/e21-s03-pomodoro-focus-timer-plan.md)
- Hook source: [src/hooks/usePomodoroTimer.ts](../../src/hooks/usePomodoroTimer.ts)
- Component source: [src/app/components/figma/PomodoroTimer.tsx](../../src/app/components/figma/PomodoroTimer.tsx)
