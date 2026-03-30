---
story_id: E33-S02
story_name: "Remove Hard Waits and Fix CSS Class Selectors in Existing Tests"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 33.2: Remove Hard Waits and Fix CSS Class Selectors in Existing Tests

## Story

As a developer,
I want the existing E2E test suite to be deterministic,
So that tests don't flake due to timing or break due to CSS class changes.

## Acceptance Criteria

**AC1: overview-card-enhancements.spec.ts has zero hard waits**

**Given** `tests/e2e/overview-card-enhancements.spec.ts`
**When** reviewed
**Then** all 7 `waitForTimeout()` calls are replaced with deterministic alternatives:
- `expect(locator).toBeVisible()` for element appearance waits
- `waitForSelector()` for DOM readiness waits
- `waitForFunction()` for computed state waits
- `expect.toPass()` for complex polling scenarios
**And** the ESLint rule `test-patterns/no-hard-waits` reports zero violations

**AC2: reports-redesign.spec.ts has zero CSS class selectors**

**Given** `tests/e2e/reports-redesign.spec.ts`
**When** reviewed
**Then** all CSS class selectors (e.g., `.bg-brand`, `.text-muted`, `.rounded-xl`) are replaced with:
- `data-testid` attributes on source components
- `getByRole()` with accessible name
- `getByText()` with content match
- `getByLabel()` for form controls
**And** no selector contains a Tailwind utility class name

**AC3: e21-s03-pomodoro-timer.spec.ts has zero hard waits**

**Given** `tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts`
**When** reviewed
**Then** the 2 `waitForTimeout()` calls are replaced with deterministic alternatives
**And** timer-related waits use `waitForFunction()` to check timer state in the browser context

**AC4: All 3 fixed spec files pass 10-iteration burn-in**

**Given** the 3 fixed spec files
**When** run in a 10-iteration burn-in loop
**Then** all 10 iterations pass with zero failures
**And** no test exhibits timing-dependent behavior

**AC5: Source components have data-testid attributes where needed**

**Given** any source component that was previously selected by CSS class
**When** a `data-testid` is added
**Then** the attribute name follows the convention: `data-testid="component-name-element"` (kebab-case)
**And** the attribute is not conditional (always present in rendered DOM)

## Tasks / Subtasks

- [ ] Task 1: Fix `overview-card-enhancements.spec.ts` -- 7 hard waits (AC: 1)
  - [ ] 1.1 Identify what each `waitForTimeout()` is waiting for (animation, data load, re-render)
  - [ ] 1.2 For animation waits: use `expect(locator).toBeVisible()` or CSS `transitionend` event
  - [ ] 1.3 For data load waits: use `waitForFunction()` checking store hydration state
  - [ ] 1.4 For re-render waits: use `expect(locator).toHaveText()` or `toContainText()` with auto-retry
  - [ ] 1.5 Run the spec file 3x locally to verify no flakes introduced
  - [ ] 1.6 Document the replacement rationale for each wait as inline comments

- [ ] Task 2: Fix `reports-redesign.spec.ts` -- CSS class selectors (AC: 2, 5)
  - [ ] 2.1 List all CSS class selectors in the file (grep for `\.bg-`, `\.text-`, `\.border-`, `\.rounded-`, `\.flex-`, `\.p-`, `\.m-`)
  - [ ] 2.2 For each CSS selector, identify the closest semantic alternative:
    - Chart containers: `data-testid="reports-chart-*"`
    - Metric cards: `data-testid="reports-metric-*"`
    - Filter controls: `getByRole('combobox')` or `getByLabel()`
    - Headings: `getByRole('heading', { name: '...' })`
  - [ ] 2.3 Add `data-testid` attributes to Reports page components where semantic selectors are insufficient
  - [ ] 2.4 Update all selectors in the spec file
  - [ ] 2.5 Run spec and verify all tests still pass

- [ ] Task 3: Fix `e21-s03-pomodoro-timer.spec.ts` -- 2 hard waits (AC: 3)
  - [ ] 3.1 Identify what each `waitForTimeout()` is waiting for (timer tick, state transition)
  - [ ] 3.2 For timer tick waits: use `waitForFunction()` checking the timer display value or state
  - [ ] 3.3 For state transition waits: use `expect(locator).toHaveAttribute()` or `toHaveText()`
  - [ ] 3.4 Run the spec file 3x locally to verify stability

- [ ] Task 4: Run 10-iteration burn-in on all 3 files (AC: 4)
  - [ ] 4.1 Run burn-in: `scripts/burn-in.sh tests/e2e/overview-card-enhancements.spec.ts 10`
  - [ ] 4.2 Run burn-in: `scripts/burn-in.sh tests/e2e/reports-redesign.spec.ts 10`
  - [ ] 4.3 Run burn-in: `scripts/burn-in.sh tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts 10`
  - [ ] 4.4 If any iteration fails, diagnose the root cause and fix
  - [ ] 4.5 Re-run full burn-in after any fix

## Implementation Notes

**Files to modify:**
- `tests/e2e/overview-card-enhancements.spec.ts` (7 `waitForTimeout()` calls)
- `tests/e2e/reports-redesign.spec.ts` (CSS class selectors)
- `tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts` (2 `waitForTimeout()` calls)
- Various `src/app/pages/` and `src/app/components/` files for `data-testid` additions

**Hard wait replacement patterns (from `.claude/rules/testing/test-patterns.md`):**

```typescript
// Animation completion
// OLD: await page.waitForTimeout(300)
// NEW:
await expect(page.getByTestId('card')).toBeVisible()

// Data load from IndexedDB
// OLD: await page.waitForTimeout(1000)
// NEW:
await page.waitForFunction(() => {
  return document.querySelector('[data-testid="metric-value"]')?.textContent !== '--'
})

// Timer tick
// OLD: await page.waitForTimeout(1000)
// NEW:
await expect(async () => {
  const text = await page.getByTestId('timer-display').textContent()
  expect(text).not.toBe('25:00')
}).toPass({ timeout: 5000 })
```

**CSS selector replacement examples:**
```typescript
// OLD: page.locator('.bg-brand.rounded-xl')
// NEW: page.getByTestId('reports-summary-card')

// OLD: page.locator('.text-muted-foreground')
// NEW: page.getByText('Total study time')

// OLD: page.locator('div.flex.items-center.gap-2')
// NEW: page.getByRole('group', { name: 'Date range' })
```

**ESLint enforcement:**
- `test-patterns/no-hard-waits` (ERROR) will flag any remaining `waitForTimeout()` without justification comment
- Run `npx eslint tests/e2e/overview-card-enhancements.spec.ts tests/e2e/reports-redesign.spec.ts tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts` after fixes

## Testing Notes

This story fixes existing tests for determinism. The primary validation is the 10-iteration burn-in (AC4).

**Burn-in execution:**
```bash
# Individual file burn-in
scripts/burn-in.sh tests/e2e/overview-card-enhancements.spec.ts 10
scripts/burn-in.sh tests/e2e/reports-redesign.spec.ts 10
scripts/burn-in.sh tests/e2e/regression/e21-s03-pomodoro-timer.spec.ts 10
```

**What to watch for during burn-in:**
- Iterations 1-3 passing but 4+ failing = race condition (timing-dependent)
- First iteration failing = wrong selector or missing data-testid
- Random single failures = non-deterministic wait still present

**Pomodoro timer testing considerations:**
- Timer tests are inherently time-sensitive. The replacement for `waitForTimeout()` must account for the timer's tick interval (typically 1s).
- Use `page.clock` API if available in Playwright config, or `waitForFunction()` checking the displayed time value.
- Consider mocking `setInterval` via `page.addInitScript()` for fully deterministic timer tests.

**Risk: Selector changes breaking other tests**
- After adding `data-testid` to source components, run the full smoke suite (`npx playwright test tests/e2e/smoke/`) to verify no regressions.

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document during implementation]
