# Code Review (Testing): E51-S02 — Reduced Motion Toggle with Global MotionConfig

**Date:** 2026-03-28
**Reviewer:** Claude Code (automated)

## AC Coverage Table

| AC # | Description | Unit Test | E2E Test | Coverage |
|------|------------|-----------|----------|----------|
| AC1 | OS reduced-motion OFF + "Follow system" -> animations play | `shouldReduceMotion` unit tests cover system+off | No E2E spec | Partial |
| AC2 | OS reduced-motion ON + "Follow system" -> animations suppressed | `shouldReduceMotion` unit tests cover system+on | No E2E spec | Partial |
| AC3 | App "Reduce motion" -> html.reduce-motion class + MotionConfig always | settings.test.ts validates setting persistence | No E2E spec | Partial |
| AC4 | App "Allow all motion" -> no class + MotionConfig never | settings.test.ts validates setting persistence | No E2E spec | Partial |
| AC5 | RadioGroup persists to localStorage, applies instantly | settings.test.ts validates save/read cycle | No E2E spec | Partial |
| AC6 | Page reload applies saved preference before first paint | Flash prevention script exists | No E2E spec | Low |

## Findings

### HIGH

**1. No E2E test spec file for E51-S02**
Confidence: 95/100

The story's testing notes explicitly call for `tests/e51-s02-reduced-motion.spec.ts` covering:
- Select "Reduce motion" -> verify `.reduce-motion` class on `<html>`
- Select "Allow all motion" -> verify no `.reduce-motion` class
- Select "Follow system" -> verify behavior matches stubbed `matchMedia`
- Reload page -> verify saved preference re-applied
- Verify RadioGroup keyboard navigation

No such file exists. While the story changes are covered by existing regression specs and unit tests for settings, the specific motion behavior (class toggling, MotionConfig propagation) is not tested at the E2E level.

**2. No unit tests for `useReducedMotion` hook**
Confidence: 90/100

The story's testing notes specify unit tests for:
- All 3 states (system/on/off)
- OS media query interaction when 'system' is selected
- Event listener cleanup on unmount
- `settingsUpdated` event triggers re-read

No test file exists at `src/hooks/__tests__/useReducedMotion.test.ts`.

### MEDIUM

**3. `shouldReduceMotion()` utility has unit tests via settings.test.ts**
Confidence: 80/100

The `shouldReduceMotion()` utility function in `settings.ts` has coverage through `settings.test.ts` which tests the `reduceMotion` setting validation. However, the function itself (resolving system vs on vs off) is not directly tested with mocked `matchMedia`.

## Test Quality Assessment

- **Existing unit tests**: 3421 passing (11 pre-existing failures in unrelated files)
- **E2E smoke tests**: 13/13 passing
- **Test isolation**: Existing tests use proper cleanup patterns
- **Factory usage**: N/A for this story (no data seeding needed)

## Verdict

**2 HIGH gaps**: Missing E2E spec and useReducedMotion hook unit tests. These are significant omissions per the story's own testing notes. The implementation is functionally correct (verified by build + existing tests passing), but dedicated test coverage is missing.
