---
story_id: E29-S05
story_name: "Guard JSON.parse in Layout.tsx Sidebar State Parsing"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 29.5: Guard JSON.parse in Layout.tsx Sidebar State Parsing

## Story

As a user,
I want the app to load even if localStorage contains corrupted sidebar state,
So that a single bad value doesn't crash the entire application.

## Acceptance Criteria

**Given** `Layout.tsx` reads sidebar state from localStorage
**When** the stored value is corrupted JSON (e.g., truncated, empty string, `undefined`)
**Then** `JSON.parse` is wrapped in a try/catch
**And** the fallback is the default sidebar state (expanded)
**And** the corrupted value is removed from localStorage

**Given** valid sidebar state in localStorage
**When** Layout.tsx reads it
**Then** behavior is unchanged (no regression)

## Tasks / Subtasks

- [ ] Task 1: Wrap JSON.parse in try/catch (AC: 1, 2)
  - [ ] 1.1 Open `Layout.tsx:250-270` and locate the `JSON.parse` call for sidebar state
  - [ ] 1.2 Wrap in try/catch block
  - [ ] 1.3 In catch: call `localStorage.removeItem()` to clear the corrupted value
  - [ ] 1.4 In catch: return the default sidebar state (expanded)
  - [ ] 1.5 Verify the default state matches what the app uses when no localStorage value exists
- [ ] Task 2: Verify no regression with valid state (AC: 2)
  - [ ] 2.1 Set valid sidebar state in localStorage, verify it loads correctly
  - [ ] 2.2 Collapse sidebar, refresh, verify it stays collapsed
  - [ ] 2.3 Expand sidebar, refresh, verify it stays expanded
- [ ] Task 3: Test corrupted state scenarios (AC: 1)
  - [ ] 3.1 Set corrupted JSON in localStorage (e.g., `{truncated`), verify app loads with default state
  - [ ] 3.2 Set empty string in localStorage, verify app loads with default state
  - [ ] 3.3 Set `undefined` string in localStorage, verify app loads with default state
  - [ ] 3.4 Verify corrupted value is removed from localStorage after recovery

## Implementation Notes

- **File:** `Layout.tsx:250-270`
- **Audit finding:** H9 (confidence 90%)
- **Pattern:** `try { return JSON.parse(stored) } catch { localStorage.removeItem(key); return defaultState }`
- The default sidebar state should be "expanded" (the app's initial state for new users)
- This is a defensive coding fix — no architectural changes needed
- Consider extracting a `safeParseJSON(key, defaultValue)` utility if this pattern is needed elsewhere in the codebase

## Testing Notes

- Unit test: Mock `localStorage.getItem` to return corrupted JSON, verify default state is returned
- Unit test: Mock `localStorage.getItem` to return valid JSON, verify parsed state is returned
- Unit test: Verify `localStorage.removeItem` is called when parse fails
- E2E: Existing layout/sidebar tests should pass unchanged (no regression)
- Consider testing with DevTools by manually corrupting localStorage before page load

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

- **Two JSON.parse calls**: Both `sidebarOpen` and `sidebarCollapsed` had unguarded JSON.parse — both needed wrapping
- **Legacy key cleanup**: Both legacy `eduvi-*` and current `knowlune-*` keys are removed on corruption since either could be the source
- **Safe defaults**: `true` for sidebarOpen (expanded) and `false` for sidebarCollapsed — matches existing fallback behavior
