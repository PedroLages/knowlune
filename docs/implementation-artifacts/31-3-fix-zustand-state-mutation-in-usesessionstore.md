---
story_id: E31-S03
story_name: "Fix Zustand State Mutation in useSessionStore"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, typecheck, unit-tests, code-review]
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

- [x] Task 1: Fix direct mutation at line 107 (AC: 1)
  - [x] 1.1 Locate the `activeSession.lastActivity = now` assignment at `useSessionStore.ts:107`
  - [x] 1.2 Replace with immutable update: `set({ activeSession: { ...get().activeSession, lastActivity: now } })`
  - [x] 1.3 Verify the new object reference triggers Zustand's shallow comparison

- [x] Task 2: Fix direct mutation at line 119 (AC: 1)
  - [x] 2.1 Locate the second `activeSession.interactionCount` direct mutation
  - [x] 2.2 Apply the same immutable spread pattern
  - [x] 2.3 Ensure both locations use the same pattern for consistency

- [x] Task 3: Audit for other direct mutations in useSessionStore (AC: 1)
  - [x] 3.1 Search the entire file for direct property assignments on state objects
  - [x] 3.2 Fix any additional mutations found using the spread pattern
  - [x] 3.3 Confirm all `set()` calls produce new object references

- [x] Task 4: Write unit tests verifying re-render behavior (AC: 2)
  - [x] 4.1 Test that updating `lastActivity` produces a new `activeSession` reference
  - [x] 4.2 Test that `Object.is(oldSession, newSession)` returns `false` after update
  - [x] 4.3 Test that a Zustand subscriber with `shallow` comparison receives the update

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
- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

N/A — No UI changes in this story (store-only fix).

## Code Review Feedback

**Verdict: PASS** (0 BLOCKER, 0 HIGH)

- All quality gates passed: build, lint, typecheck, unit tests (24/24)
- Fix correctly replaces 2 direct Zustand state mutations with immutable spread patterns
- Test updated to use `setState()` instead of direct property mutation
- Comments accurately document the change rationale

## Challenges and Lessons Learned

- **"INTENTIONAL" mutations were bugs**: Original code had comments citing performance optimization but the mutations prevented Zustand subscribers from detecting changes
- **Throttle still works**: The 30-second heartbeat gate limits update frequency; immutable spread doesn't change this
- **Test was also mutating**: Found a unit test using direct mutation to simulate updates — fixed to use setState()
