## Code Review (Testing): E30-S03 — Fix Heading Hierarchy in CourseDetail, Settings, PremiumFeaturePage

### Acceptance Criteria Coverage

| AC | Test Coverage | Notes |
|----|--------------|-------|
| AC1: CourseDetail H1 > H2 > H3 hierarchy | Partial | `courses.spec.ts` tests navigation and display but does not assert heading levels. No dedicated heading hierarchy test exists. |
| AC2: Settings card title uses `<h2>` | None | No test asserts heading level on Settings page cards. Pre-existing gap — Settings.tsx was not changed by this story. |
| AC3: PremiumFeaturePage first heading is `<h1>` | Partial | `premium-gating.spec.ts` tests gate visibility and CTA but does not assert that the feature name renders as `<h1>`. |

### Test Quality Assessment

**No new tests were added by this story.** This is a heading-level-only change (semantic HTML), so the risk profile is low. The existing E2E tests cover functional behavior (navigation, content display, premium gating) but do not validate heading hierarchy.

### Gaps

- **ADVISORY**: No test validates heading level order on CourseDetail, PremiumFeaturePage, or Settings. Consider adding a lightweight assertion like:
  ```typescript
  // Verify heading hierarchy (no skips)
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(els =>
    els.map(el => ({ level: parseInt(el.tagName[1]), text: el.textContent?.trim() }))
  )
  // Assert no level skips > 1
  for (let i = 1; i < headings.length; i++) {
    expect(headings[i].level - headings[i - 1].level).toBeLessThanOrEqual(1)
  }
  ```
  This would be best added as part of a broader accessibility test suite (E30 or E33 scope), not necessarily this single story.

- **ADVISORY**: The `CardTitle` `as` prop has no unit test verifying it renders the correct HTML element. Since `CardTitle` is a shared component used 39 times, a unit test like `expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()` would add confidence that the prop works correctly.

### Pre-Existing Test Failures

3 tests in `premium-gating.spec.ts` fail on both main and this branch (pre-existing):
- `free user sees premium gate with blurred preview on flashcards page`
- `premium gate renders on all gated routes`
- `feature highlights are listed in the upgrade CTA`

3 tests in `accessibility-courses.spec.ts` fail on both main and this branch (pre-existing):
- `Courses page - WCAG 2.1 AA violations`
- `Tablet viewport - Accessibility maintained`
- `All pages - Text contrast meets WCAG AA (4.5:1)`

### Summary

**Risk: LOW.** The changes are minimal heading-level adjustments with no behavioral impact. Existing E2E tests pass (excluding pre-existing failures). Test gaps are advisory — heading hierarchy validation would be a valuable addition to the accessibility test suite but is not blocking for this story.
