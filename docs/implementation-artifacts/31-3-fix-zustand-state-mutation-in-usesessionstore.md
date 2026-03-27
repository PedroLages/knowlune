---
story_id: E31-S03
story_name: "Fix Zustand State Mutation in useSessionStore"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 31.3: Fix Zustand State Mutation in useSessionStore

## Story

As a developer,
I want session store updates to use immutable state patterns,
so that Zustand selectors with shallow comparison re-render correctly.

## Acceptance Criteria

**Given** `useSessionStore` updates `activeSession.lastActivity`
**When** the update occurs
**Then** it creates a new object via spread: `{ ...activeSession, lastActivity: now }`
**And** it does NOT directly mutate `activeSession.lastActivity = now`

**Given** components subscribed to `activeSession` via Zustand selector
**When** `lastActivity` changes
**Then** the component re-renders (which it currently doesn't due to reference equality)

## Tasks / Subtasks

- [ ] Task 1: Fix direct mutation at line 107 (AC: 1)
  - [ ] 1.1 Locate the `activeSession.lastActivity = now` assignment at `useSessionStore.ts:107`
  - [ ] 1.2 Replace with immutable update: `set({ activeSession: { ...get().activeSession, lastActivity: now } })`
  - [ ] 1.3 Verify the new object reference triggers Zustand's shallow comparison

- [ ] Task 2: Fix direct mutation at line 119 (AC: 1)
  - [ ] 2.1 Locate the second `activeSession.lastActivity = now` assignment at `useSessionStore.ts:119`
  - [ ] 2.2 Apply the same immutable spread pattern
  - [ ] 2.3 Ensure both locations use the same pattern for consistency

- [ ] Task 3: Audit for other direct mutations in useSessionStore (AC: 1)
  - [ ] 3.1 Search the entire file for direct property assignments on state objects
  - [ ] 3.2 Fix any additional mutations found using the spread pattern
  - [ ] 3.3 Confirm all `set()` calls produce new object references

- [ ] Task 4: Write unit tests verifying re-render behavior (AC: 2)
  - [ ] 4.1 Test that updating `lastActivity` produces a new `activeSession` reference
  - [ ] 4.2 Test that `Object.is(oldSession, newSession)` returns `false` after update
  - [ ] 4.3 Test that a Zustand subscriber with `shallow` comparison receives the update

## Implementation Notes

- **Audit finding:** H1 (confidence 90%)
- **File:** `useSessionStore.ts:107,119`
- **Root cause:** Direct mutation `activeSession.lastActivity = now` modifies the existing object in place. Zustand's `shallow` equality check compares object references, so same reference = no re-render, even though the value changed.
- **Fix pattern:**
  ```typescript
  // BEFORE (broken):
  activeSession.lastActivity = now;
  set({ activeSession });

  // AFTER (correct):
  set({ activeSession: { ...activeSession, lastActivity: now } });
  ```
- **Why not Immer:** Knowlune doesn't use Immer middleware. All other stores use the spread pattern. Keep consistent.
- **Ripple effects:** Components that depend on `activeSession` updates (e.g., session timers, activity indicators) may start re-rendering where they previously didn't. This is the correct behavior — verify no performance regressions.

## Testing Notes

- **Reference equality test:** Create a store instance, capture `activeSession` reference, trigger update, assert new reference is different
- **Value correctness test:** After update, assert `lastActivity` equals the expected timestamp
- **Subscriber test:** Subscribe to the store with `shallow` comparison, trigger update, assert callback fires
- **Regression test:** Verify that other `activeSession` fields are preserved after the spread (no data loss)
- **Performance consideration:** If `lastActivity` updates very frequently (e.g., every second), ensure the spread pattern doesn't cause excessive re-renders. Consider debouncing if needed.

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

- **"INTENTIONAL" mutations were bugs**: Original code had comments citing performance optimization but the mutations prevented Zustand subscribers from detecting changes
- **Throttle still works**: The 30-second heartbeat gate limits update frequency; immutable spread doesn't change this
- **Test was also mutating**: Found a unit test using direct mutation to simulate updates — fixed to use setState()
