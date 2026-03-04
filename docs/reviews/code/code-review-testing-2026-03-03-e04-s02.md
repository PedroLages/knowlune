# Test Coverage Review: E04-S02 — Course Completion Percentage

**Date**: 2026-03-03
**Reviewer**: code-review-testing agent
**Story**: E04-S02 — Course Completion Percentage

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1   | Progress bar displays with ARIA attributes and text equivalent | [src/lib/__tests__/progress.test.ts:171-202](src/lib/__tests__/progress.test.ts#L171-L202) (calculation only) | [tests/e2e/story-e04-s02.spec.ts:14-34](tests/e2e/story-e04-s02.spec.ts#L14-L34) | **Partial** |
| 2   | Progress bar updates in real-time when completion status changes | None | [tests/e2e/story-e04-s02.spec.ts:36-67](tests/e2e/story-e04-s02.spec.ts#L36-L67) | **Gap** |
| 3   | Progress bar shows 0% for courses with no completed items | [src/lib/__tests__/progress.test.ts:176-180](src/lib/__tests__/progress.test.ts#L176-L180) | [tests/e2e/story-e04-s02.spec.ts:69-89](tests/e2e/story-e04-s02.spec.ts#L69-L89) | Covered |
| 4   | Progress bar shows 100% with completion badge for fully completed courses | [src/lib/__tests__/progress.test.ts:187-192](src/lib/__tests__/progress.test.ts#L187-L192) | [tests/e2e/story-e04-s02.spec.ts:91-123](tests/e2e/story-e04-s02.spec.ts#L91-L123) | Covered |
| 5   | Course library displays consistent progress bars on all course cards | None | [tests/e2e/story-e04-s02.spec.ts:125-153](tests/e2e/story-e04-s02.spec.ts#L125-L153) | **Partial** |

**Coverage**: 2/5 ACs fully covered | 2 gaps | 1 partial

## Test Quality Findings

### Blockers (untested ACs)

None — all ACs have at least minimal E2E coverage.

### High Priority

- **[story-e04-s02.spec.ts:125-153](tests/e2e/story-e04-s02.spec.ts#L125-L153) (confidence: 95)**: AC5 test fails on Tablet viewport (768px) because `eduvi-sidebar-v1` localStorage is not seeded, causing the sidebar Sheet overlay to block all pointer events. Test returns 0 course cards when filtering for links with progress bars. Fix: Seed `localStorage.setItem('eduvi-sidebar-v1', 'false')` in `beforeEach` or at test start for tablet viewports (640-1023px).

- **[story-e04-s02.spec.ts:36-67](tests/e2e/story-e04-s02.spec.ts#L36-L67) (confidence: 92)**: AC2 claims to test "real-time updates" but has `if ((await contentItem.count()) > 0)` guard that **always skips the test** because E04-S01 (completion status UI) hasn't been implemented yet. The test never verifies the AC behavior — it's a false positive. Test should either: (1) be marked `.skip()` until E04-S01 is done, or (2) manually manipulate localStorage to simulate completion changes and verify progress bar reactivity.

- **[story-e04-s02.spec.ts:76-83](tests/e2e/story-e04-s02.spec.ts#L76-L83) (confidence: 88)**: AC3 test uses brittle CSS class selector `[class*="card"]` instead of semantic selectors or `data-testid`. This will break if CSS refactors change class names. Fix: Use `page.getByRole('link').filter({ has: page.locator('[role="progressbar"]') })` (pattern used correctly in AC5).

- **AC1 missing unit test (confidence: 85)**: The Progress component ([src/app/components/ui/progress.tsx](src/app/components/ui/progress.tsx)) has **zero unit tests**. While E2E tests cover ARIA attributes (line 26-29), there are no isolated tests for: value normalization (line 21), `showLabel` prop rendering (line 41-45), `labelFormat` customization (line 18), or edge cases (NaN, null, undefined, negative values). Suggested test: `src/app/components/ui/__tests__/progress.test.tsx` covering value prop boundary values, ARIA attribute correctness, and label rendering.

### Medium

- **[progress.tsx:37](src/app/components/ui/progress.tsx#L37) (confidence: 80)**: Progress indicator uses `duration-500` animation but does **not** respect `prefers-reduced-motion` media query. Per AC2 ("animates smoothly"), animation should be conditional. Fix: Add Tailwind's `motion-safe:` or `motion-reduce:` prefixes, e.g., `className="... motion-reduce:transition-none motion-safe:duration-500"`.

- **[story-e04-s02.spec.ts:62-66](tests/e2e/story-e04-s02.spec.ts#L62-L66) (confidence: 75)**: AC2 test verifies animation by checking `transition` CSS property contains "width", but the actual implementation uses `transform: translateX()` (line 38 of progress.tsx), not `width` transitions. Test is checking the wrong property. Fix: Change assertion to `expect(styles).toContain('transform')` or `expect(styles).toMatch(/transform|all/)`.

- **[story-e04-s02.spec.ts:116-119](tests/e2e/story-e04-s02.spec.ts#L116-L119) (confidence: 72)**: AC4 completion badge test uses overly broad selector `[data-testid="completion-badge"], [class*="badge"]` that could match unrelated badges. The CourseDetail page uses `data-testid="completion-badge"` (line 111 of CourseDetail.tsx), but CourseCard library variant does not. Test should verify the specific CheckCircle completion badge structure from CourseCard.tsx lines 270-272.

- **Test isolation issue (confidence: 70)**: Tests do not explicitly seed or clear `course-progress` localStorage between runs. While the `local-storage-fixture.ts` auto-cleanup runs after each test (line 68-73), tests rely on existing app data from the dev server. Tests should use `localStorage.seed('course-progress', {...})` to create deterministic progress states (0%, 33%, 100%) rather than depending on ambient data.

### Nits

- **Nit** [story-e04-s02.spec.ts:86](tests/e2e/story-e04-s02.spec.ts#L86) (confidence: 65): Test uses regex `/0% complete/` which will fail if whitespace changes (e.g., "0%complete" or "0% Complete"). Use case-insensitive regex `/0%\s*complete/i` for robustness.

- **Nit** [story-e04-s02.spec.ts:137](tests/e2e/story-e04-s02.spec.ts#L137) (confidence: 60): Comment says "Verify first 3 cards (to keep test fast)" but this is unnecessary — Playwright is already fast. Either check all cards or justify the limit with a real constraint (e.g., "first 3 to avoid flakiness from dynamic data").

- **Nit** [story-e04-s02.spec.ts:18-19](tests/e2e/story-e04-s02.spec.ts#L18-L19) (confidence: 55): Test navigates to hardcoded `/courses/confidence-reboot` URL. If course IDs change, test breaks. Use `goToCourse(page, 'confidence-reboot')` helper or select the first course card dynamically to make test resilient.

## Edge Cases to Consider

From implementation analysis ([src/app/components/ui/progress.tsx](src/app/components/ui/progress.tsx) and [src/lib/progress.ts](src/lib/progress.ts)):

- **NaN/undefined/null values**: Progress component normalizes to 0-100 (line 21), but what happens if `getCourseCompletionPercent()` receives `totalLessons: undefined`? TypeScript allows this at runtime. Needs unit test.
- **Fractional percentages**: `getCourseCompletionPercent` uses `Math.round()` (line 352 of progress.ts), but Progress component receives already-rounded values. No test verifies rounding edge cases (e.g., 33.4999 → 33, 33.5 → 34).
- **Course with zero modules**: What if a course has `modules: []` and `totalLessons: 0`? Unit test covers `totalLessons: 0` (line 172-174 of progress.test.ts), but no E2E test verifies the UI renders gracefully.
- **Concurrent updates**: If a user rapidly clicks "complete" on multiple lessons, does the progress bar animate smoothly through intermediate states, or does it skip/flicker? No test for rapid state transitions.
- **ARIA label with custom labelFormat**: Progress component accepts `labelFormat` prop (line 11, 18), but ARIA label is always `labelFormat(normalizedValue)` (line 31). If `labelFormat` returns non-numeric text (e.g., "Almost done!"), is the ARIA label still accessible? No test for custom label formats.
- **Long course titles/percentages**: What if `labelFormat` returns a very long string? Does the flex layout break? No visual regression test.
- **Dark mode**: Progress bar uses `bg-primary` (line 37 progress.tsx). Does contrast meet WCAG 2.1 AA in both light/dark themes? No accessibility test.

---

**ACs**: 2 covered / 5 total | **Findings**: 10 | **Blockers**: 0 | **High**: 4 | **Medium**: 4 | **Nits**: 3

**Agent ID**: aca514d
**Total Duration**: 231.8s
**Tool Uses**: 35
