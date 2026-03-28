---
story_id: E55-S01
story_name: "Lift Pomodoro State to Zustand Store with localStorage Persistence"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 55.1: Lift Pomodoro State to Zustand Store with localStorage Persistence

## Story

As a learner using the Pomodoro timer,
I want my timer state to persist across page navigation and be shared between UI contexts,
So that switching between the Overview dashboard and the lesson player does not interrupt my focus session.

## Acceptance Criteria

**Given** the existing `usePomodoroTimer` hook manages all timer state locally
**When** I create a new `usePomodoroStore` Zustand store
**Then** the store exposes the same state interface (`PomodoroState`) and actions (`PomodoroActions`) as the current hook

**Given** the timer is running on the Overview page
**When** I navigate to a lesson page where the popover timer lives
**Then** both UIs reflect the same timer state (time remaining, phase, session count)

**Given** the timer is running
**When** I close the browser tab and reopen it within the session duration
**Then** the timer resumes from the correct wall-clock position (using the persisted `endTime`)

**Given** the timer was running but the session has expired while the tab was closed
**When** I reopen the app
**Then** the timer shows the session as completed and increments the session counter appropriately

**Given** the store writes to localStorage
**When** the timer state changes (start, pause, resume, reset, phase transition)
**Then** the state is persisted within 1 second of the transition (not on every tick)

**Given** `PomodoroTimer.tsx` (existing popover component)
**When** it is refactored to consume from `usePomodoroStore`
**Then** all existing popover functionality remains identical (start, pause, resume, skip, reset, preferences, audio chimes)

## Tasks / Subtasks

- [ ] Task 1: Create `src/stores/usePomodoroStore.ts` Zustand store (AC: 1)
  - [ ] 1.1 Define store state matching `PomodoroState` interface from `usePomodoroTimer.ts`
  - [ ] 1.2 Implement all actions: `start`, `pause`, `resume`, `reset`, `skip`
  - [ ] 1.3 Port drift-free wall-clock anchoring logic from `usePomodoroTimer` hook
  - [ ] 1.4 Add `setInterval`/`clearInterval` management within store actions
- [ ] Task 2: Add localStorage persistence middleware (AC: 3, 4, 5)
  - [ ] 2.1 Persist `{ phase, timeRemaining, endTime, completedSessions, status }` to `pomodoro-state` key
  - [ ] 2.2 Write on state transitions only (not every tick) — use Zustand `subscribe` or middleware
  - [ ] 2.3 On store init: hydrate from localStorage, check if `endTime` is still in future
  - [ ] 2.4 Handle expired sessions: if `endTime` has passed, mark session complete
- [ ] Task 3: Refactor `PomodoroTimer.tsx` to consume `usePomodoroStore` (AC: 2, 6)
  - [ ] 3.1 Replace `usePomodoroTimer()` hook call with `usePomodoroStore()` selectors
  - [ ] 3.2 Verify all existing functionality: start/pause/resume/skip/reset
  - [ ] 3.3 Verify preferences integration (focus/break duration, auto-start toggles)
  - [ ] 3.4 Verify audio chime callbacks still fire on phase completion
- [ ] Task 4: Add `visibilitychange` listener in store for tab-switch recovery (AC: 3)
- [ ] Task 5: Write unit tests for store hydration and persistence (AC: 3, 4, 5)

## Design Guidance

This is a state management refactoring story — no UI changes. The store follows existing patterns from `useSessionStore`, `useCourseStore`, `useCourseImportStore` (all Zustand stores in the project).

**Key architectural decisions (from brainstorming):**
- Zustand chosen over React Context to avoid re-rendering all consumers on every tick
- localStorage chosen over IndexedDB for simplicity (small payload, synchronous reads on mount)
- Wall-clock anchoring pattern preserved from existing hook (prevents timer drift)

## Implementation Notes

**Files to create:**
- `src/stores/usePomodoroStore.ts` — new Zustand store

**Files to modify:**
- `src/app/components/figma/PomodoroTimer.tsx` — refactor to consume store instead of hook
- `src/hooks/usePomodoroTimer.ts` — may keep as adapter or deprecate (if store replaces all usage)

**Dependencies:** None new (Zustand already in project)

**Edge case review findings (HIGH severity — must address):**
- **EC-HIGH: Laptop sleep/wake.** On `visibilitychange` visible: if `endTime` has passed, call `handlePhaseComplete()` instead of just recalculating remaining time. Timer shows 0 but never triggers phase completion after sleep.
- **EC-HIGH: Multiple tabs.** Both tabs hydrate and run timers concurrently → duplicate session counts, conflicting states. Add BroadcastChannel or `storage` event listener for cross-tab sync; or use leader election (only one tab runs the interval).
- **EC-HIGH: Corrupted localStorage.** Wrap `JSON.parse` in try-catch with schema validation; fallback to default state on parse failure. Older schema versions could crash the store.
- **EC-HIGH: Idempotent start().** Store.start() must be idempotent: if status is already 'running', no-op. Prevents double-start race from popover + widget both calling start().

## Testing Notes

- Unit test store hydration from stale localStorage (expired endTime)
- Unit test store hydration from valid localStorage (still-running timer)
- Verify no regression in existing `usePomodoroTimer.test.ts` tests
- E2E: navigate between Overview and lesson page, verify timer state persists

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
