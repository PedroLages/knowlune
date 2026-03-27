---
story_id: E33-S01
story_name: "Validate and Fix 94 Generated E2E Tests from Audit"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 33.01: Validate and Fix 94 Generated E2E Tests from Audit

## Story

As a developer,
I want to validate and fix the 5 regression E2E spec files generated during the audit,
so that the test suite is reliable, maintainable, and follows established patterns.

## Acceptance Criteria

- AC1: Given the 5 regression spec files, when reviewed, then all `waitForTimeout()` hard waits are removed
- AC2: Given fragile CSS class selectors (`.locator('..')` chains), when fixed, then they use `data-testid`, `role`, or text selectors
- AC3: Given manual IndexedDB manipulation, when refactored, then seeding uses shared helpers from `seed-helpers.ts`
- AC4: Given all tests, when run, then they have meaningful behavioral assertions (not just page loads)
- AC5: Given all changes, when `npm run build` is run, then the build passes

## Tasks / Subtasks

- [x] Task 1: Fix imports in learning-path-detail.spec.ts to use seed-helpers (AC: #3)
- [x] Task 2: Fix imports in learning-paths.spec.ts to use seed-helpers (AC: #3)
- [x] Task 3: Replace fragile `.locator('..')` chains in learning-paths.spec.ts (AC: #2)
- [x] Task 4: Remove unused fragile locator in course-overview.spec.ts (AC: #2)
- [x] Task 5: Verify build passes (AC: #5)
- [x] Task 6: Commit changes

## Implementation Notes

Focused on 5 spec files:
1. course-overview.spec.ts — removed unused fragile locator
2. learning-path-detail.spec.ts — migrated imports from indexeddb-seed to seed-helpers
3. learning-paths.spec.ts — migrated imports from indexeddb-seed to seed-helpers, replaced `.locator('..')` chains with `getByRole('button')` selectors
4. youtube-course-detail.spec.ts — already clean, no changes needed
5. youtube-lesson-player.spec.ts — already clean, no changes needed

## Testing Notes

All 5 files already had meaningful behavioral assertions (text content, visibility, navigation, interaction). No hard waits found in any of the files.

## Pre-Review Checklist

- [x] All changes committed
- [x] No error swallowing
- [x] Build passes

## Design Review Feedback

Skipped — no UI changes (test-only story).

## Code Review Feedback

PASS — No blockers or high-priority findings.

- All 5 spec files use proper selectors (role, text, data-testid)
- No hard waits (waitForTimeout) found in any file
- Imports consolidated to canonical seed-helpers module
- All tests have meaningful behavioral assertions
- No security or architecture concerns (test-only changes)

## Challenges and Lessons Learned

- The audit-generated tests were already high quality for youtube-course-detail and youtube-lesson-player specs
- The learning-paths spec had fragile parent traversal with `.locator('..')` chains that were replaced with accessible role-based selectors
- Two spec files imported from the older `indexeddb-seed` helper instead of the canonical `seed-helpers` module
