## External Code Review: E62-S04 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-14
**Story**: E62-S04

### Findings

#### Blockers

#### High Priority

#### Medium

- **[tests/e2e/story-e62-s04.spec.ts:243-248 (confidence: 85)]**: **Race condition / order-of-operations in AC-6**: `page.evaluate()` to set the dark mode class and localStorage is called *after* `await page.goto('/')` resolves in `beforeEach`, but `seedAllData()` and `page.goto('/knowledge-map')` run after that. However, `page.goto('/knowledge-map')` triggers a full navigation, which will destroy the `document.documentElement.classList.add('dark')` applied to the previous document. The `localStorage.setItem('knowlune-theme', 'dark')` persists across navigations, but if the app reads the class (not localStorage) during SSR/initial render, dark mode won't be active. More critically, the `consoleErrors` listener is registered *before* `seedAllData()`, but the `page.on('console')` handler references the outer `consoleErrors` array. If the page object is reused and `consoleErrors` is declared inside the test, this is fine — but if any errors fire during the `seedAllData()` or the preceding `beforeEach` navigation, they'd be captured too. The real issue is that the dark mode class applied via `page.evaluate` before the second `goto` may be lost on navigation. Fix: Use `page.addInitScript` in this test (or in `beforeEach` conditionally) to set `document.documentElement.classList.add('dark')` before the page loads, ensuring dark mode is active after navigation, or move the `localStorage.setItem` + class addition before the first `goto` in `beforeEach`.

- **[tests/e2e/story-e62-s04.spec.ts:236-272 (confidence: 75)]**: **False-negative risk in AC-6 dark mode test**: The test only checks that text elements have non-zero opacity and that no console errors contain "treemap"/"color"/"NaN". It does not verify that dark-mode-specific colors are actually applied to treemap cells. If dark mode fails silently (e.g., cells render with light-theme colors because the class was lost during navigation), the test would still pass. Fix: After ensuring dark mode is properly activated, also assert that at least one treemap cell's `rect` has a fill color consistent with dark mode (e.g., different from the light-mode baseline), or assert that `document.documentElement.classList.contains('dark')` is true after the `/knowledge-map` page loads.

- **[tests/e2e/story-e62-s04.spec.ts:197-198 (confidence: 70)]**: **Fragile popover selector in AC-4 and AC-5**: The locator `[data-radix-popper-content-wrapper]` is an internal Radix implementation detail that may change across versions. If the Radix library is updated, these tests will break silently (false negatives). Fix: Add a `data-testid` attribute to the TopicDetailPopover root element and use `page.getByTestId('topic-detail-popover')` instead.

#### Nits

- **[tests/e2e/story-e62-s04.spec.ts:244 (confidence: 60)]**: The `eslint-disable` comment on line 281 references `test-patterns/deterministic-time` but uses raw `Date.now()` inside `page.evaluate`. Since this is intentionally verifying the mock is active (not computing retention), the disable comment is appropriate but could be clearer about why the exception is warranted.

---
Issues found: 4 | Blockers: 0 | High: 0 | Medium: 3 | Nits: 1
