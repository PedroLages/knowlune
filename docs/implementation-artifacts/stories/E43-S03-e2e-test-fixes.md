---
story_id: E43-S03
story_name: "Test Health — E2E Test Fixes (KI-021 to KI-025)"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.3: Test Health — E2E Test Fixes (KI-021 to KI-025)

## Story

As a developer,
I want E2E tests passing with correct selectors and timing,
so that all 10 E2E failures are resolved.

## Acceptance Criteria

**Given** the Courses page E2E spec (KI-021) with 2 failing tests
**When** the page rendering issue is fixed
**Then** both tests pass (display heading, display cards)

**Given** KI-022 (navigation to Courses) and KI-024 (accessibility-courses accordion)
**When** the Courses page renders correctly (KI-021 fixed)
**Then** cascading failures resolve automatically
**And** any independently broken tests are fixed individually

**Given** KI-023 (dashboard reordering) with timing/localStorage issues
**When** the timing and localStorage handling is corrected
**Then** the dashboard reordering tests pass

**Given** KI-025 (export button) with a relocated selector
**When** the selector is updated to match the current DOM structure
**Then** the export button tests pass

**Given** all 5 E2E spec files complete
**When** `npx playwright test --project=chromium` runs
**Then** all 10 E2E tests pass (cumulative: 56 of 56 resolved)

## Tasks / Subtasks

- [ ] Task 1: Fix KI-021 — Courses page E2E cascade root (AC: 1)
  - [ ] 1.1 Investigate `tests/e2e/courses.spec.ts:14` and `:20` — determine if rendering issue, selector mismatch, or data seeding problem
  - [ ] 1.2 Fix the Courses page rendering/selector issue
  - [ ] 1.3 Verify both tests pass: `npx playwright test tests/e2e/courses.spec.ts --project=chromium`
- [ ] Task 2: Verify KI-022 and KI-024 cascading resolution (AC: 2)
  - [ ] 2.1 Run `npx playwright test tests/e2e/navigation.spec.ts --project=chromium` — check if KI-021 fix resolved navigation tests
  - [ ] 2.2 Run `npx playwright test tests/e2e/accessibility-courses.spec.ts --project=chromium` — check if KI-021 fix resolved accessibility test
  - [ ] 2.3 Fix any independently broken tests that didn't cascade-resolve
- [ ] Task 3: Fix KI-023 — Dashboard reordering (AC: 3)
  - [ ] 3.1 Investigate `tests/e2e/dashboard-reordering.spec.ts` — 4 failing tests at lines 86, 118, 247, 288
  - [ ] 3.2 Fix timing/localStorage seeding issues (independent from Courses cascade)
  - [ ] 3.3 Verify all tests pass: `npx playwright test tests/e2e/dashboard-reordering.spec.ts --project=chromium`
- [ ] Task 4: Fix KI-025 — Export button selector (AC: 4)
  - [ ] 4.1 Investigate `tests/e2e/nfr35-export.spec.ts:90` — find where export button moved in DOM
  - [ ] 4.2 Update selector to match current DOM structure
  - [ ] 4.3 Verify test passes: `npx playwright test tests/e2e/nfr35-export.spec.ts --project=chromium`
- [ ] Task 5: Full E2E regression check (AC: 5)
  - [ ] 5.1 Run `npx playwright test --project=chromium` — all E2E tests
  - [ ] 5.2 Confirm 0 failures (56 of 56 total test failures resolved across E43-S01 through S03)

## Implementation Notes

- **Fix in dependency order:** KI-021 first (cascade root) -> verify KI-022/KI-024 cascade -> KI-023 and KI-025 independently
- **KI-021 is the cascade root:** Courses page rendering affects 3 downstream specs (KI-022, KI-024, and KI-021 itself)
- **KI-023:** Independent issue — timing/localStorage on dashboard reordering (4 tests: unpin, reset, manual order, reset button visibility)
- **KI-025:** Independent issue — button selector moved after UI refactor
- **Run Playwright after each fix group** to verify cascade resolution before moving to next group
- **Prior fix reference:** KI-004/KI-005 were fixed with overlay dismissal in `navigateAndWait()` — KI-021 may be a different root cause
- **Key test files:**
  - `tests/e2e/courses.spec.ts` (KI-021)
  - `tests/e2e/navigation.spec.ts` (KI-022)
  - `tests/e2e/accessibility-courses.spec.ts` (KI-024)
  - `tests/e2e/dashboard-reordering.spec.ts` (KI-023)
  - `tests/e2e/nfr35-export.spec.ts` (KI-025)

## Testing Notes

- Use `--project=chromium` for all Playwright runs (per project convention)
- Run individual specs after each fix to validate before moving on
- Final validation: full `npx playwright test --project=chromium` must show 0 failures
- This story completes the test health objective: all 56 failures resolved across S01-S03

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
