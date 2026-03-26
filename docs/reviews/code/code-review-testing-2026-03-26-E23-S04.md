# Test Coverage Review -- E23-S04: Restructure Sidebar Navigation

**Date**: 2026-03-26
**Story**: E23-S04 -- Restructure Sidebar Navigation Groups
**Reviewer**: Claude Code (test-coverage-review agent)
**Branch**: feature/e23-s04-restructure-sidebar-navigation

---

## Summary

Unit tests cover navigation config structure thoroughly. E2E tests have 2 blockers preventing execution.

## Unit Tests (`src/app/config/__tests__/navigation.test.ts`)

| Test | AC Mapped | Status |
|------|-----------|--------|
| 3 groups: Library, Study, Track | AC1 | PASS |
| Library group has 4 items in correct order | AC2 | PASS |
| Study group has 5 items in correct order | AC3 | PASS |
| Track group has 7 items in correct order | AC4 | PASS |
| Unique navigation keys | Guard | PASS |
| No "Connect" group | AC1 | PASS |
| 4 primary items for mobile | AC5 | PASS |
| 13 overflow items | AC6 | PASS |

All 8 unit tests pass. Coverage is comprehensive for the config module.

## E2E Tests (`tests/e2e/regression/story-e23-s04.spec.ts`)

| Test | AC Mapped | Status | Issue |
|------|-----------|--------|-------|
| AC1: group labels | AC1 | BLOCKED | Wrong import path |
| AC2: Library items | AC2 | BLOCKED | Wrong import path + no disclosure seeding |
| AC3: Study items | AC3 | BLOCKED | Wrong import path + no disclosure seeding |
| AC4: Track items | AC4 | BLOCKED | Wrong import path + no disclosure seeding |
| AC5: mobile bottom bar | AC5 | BLOCKED | Wrong import path + no disclosure seeding |
| AC6: mobile overflow | AC6 | BLOCKED | Wrong import path + no disclosure seeding |
| AC7: collapsed separators | AC7 | BLOCKED | Wrong import path |
| AC8: no overflow | AC8 | BLOCKED | Wrong import path |

### Fixes Required

1. **Import paths**: Change `../support/fixtures` to `../../support/fixtures` and `../support/helpers/navigation` to `../../support/helpers/navigation`

2. **Progressive disclosure seeding**: Add `beforeEach` hook:
   ```typescript
   test.beforeEach(async ({ page }) => {
     await page.addInitScript(() => {
       localStorage.setItem('knowlune-sidebar-show-all-v1', JSON.stringify(true))
       localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }))
     })
   })
   ```

3. **AC5 assertion for Notes**: The test expects Notes in the mobile bottom bar, but Notes has `disclosureKey: 'note-created'`. Even with show-all, the bottom bar may filter differently. Verify behavior after seeding.

## Gaps

- No test for keyboard navigation through the new groups
- No test verifying the order of items matches `navigation.ts` config (E2E tests check presence, not ordering within groups)

## Verdict

Unit tests: PASS (8/8)
E2E tests: BLOCKED (0/8 runnable due to import path error)
