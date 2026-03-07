# Test Coverage Review: E05-S04 — Study History Calendar

**Date**: 2026-03-07 (re-run)
**Reviewer**: Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Calendar month view with highlighted study days | `studyCalendar.test.ts:15-27`, `:34-52` | `story-e05-s04.spec.ts:36-68` | Covered |
| 2 | Month navigation with correct study highlights | None | `story-e05-s04.spec.ts:70-93` (label only) | Partial |
| 3 | Day detail popover: course name, action type, timestamp | None | `story-e05-s04.spec.ts:95-122` | Partial |
| 4 | Empty day detail message | None | `story-e05-s04.spec.ts:124-141` | Covered |
| 5 | Freeze day visual distinction | `studyCalendar.test.ts:95-123` | `story-e05-s04.spec.ts:143-197` | Covered |
| 6 | Mobile responsiveness with 44x44px touch targets | None | `story-e05-s04.spec.ts:199-233` | Partial |

**Coverage**: 3/6 ACs fully covered | 0 gaps | 3 partial

## Findings

### High Priority

- **AC2 highlights not verified after navigation (confidence: 88)**: Test only asserts label change, not that study highlights appear/disappear for the navigated month.
- **AC3 only one action type branch tested (confidence: 85)**: `actionLabel` has 5 branches but only `lesson_complete` is exercised.
- **AC6 only measures `prevBtn`, not `nextBtn` (confidence: 82)**: Touch target measurement incomplete.
- **Missing `getMonthStudyData` integration test (confidence: 78)**: No test for localStorage wrapper or corrupt storage fallback.

### Medium

- **Duplicate AC1 setup without shared fixture (confidence: 72)**
- **AC5 freeze+activity coexistence test targets non-specific selector (confidence: 75)**
- **No `localStorage.clearAll()` in `beforeEach` (confidence: 70)**
- **Local `makeAction` factory instead of shared factory (confidence: 55)**

### Nits

- Popover heading selected by tag `h4` instead of role (confidence: 60)
- Wildcard `[data-has-activity]` matches both true/false (confidence: 58)
- Overly permissive regex `/ba-101|Business/i` (confidence: 52)
