## Code Review (Testing): E50-S05 — Schedule Editor + Course Integration (2026-04-04)

**Reviewer**: Test Coverage Agent (Claude Sonnet)
**Date**: 2026-04-04
**Story**: E50-S05

### AC Coverage

| AC | Description | Test | Status |
|----|-------------|------|--------|
| AC1 | Settings "+ Add Study Block" opens sheet with all form fields | No E2E spec | MISSING |
| AC2 | Mon/Wed/Fri + 9AM + 60min → save → toast "Schedule created" | No E2E spec | MISSING |
| AC3 | Course detail → sheet opens with course pre-selected | No E2E spec + Integration is dead code | MISSING |
| AC4 | Edit existing schedule → all fields pre-populated | No E2E spec | MISSING |
| AC5 | Save with no days → "Select at least one day." error | No E2E spec | MISSING |

### Findings

#### High

- **No E2E spec file exists for E50-S05.** The story has no `tests/e2e/story-e50-s05.spec.ts` or equivalent file. All 5 acceptance criteria are untested by automated tests. The story testing notes specify detailed scenarios, none of which were implemented. ~effort: 2-3h to write.

#### Medium

- **Unit tests specified but not implemented.** The story testing notes call for unit tests for DayPicker (toggle on/off), TimePicker (onChange with "HH:MM"), and validation logic. None found in `src/app/components/figma/__tests__/`.

#### Low

- **Regression spec for E50-S04 was auto-formatted but not enhanced.** The Prettier fix committed is harmless.

### Summary

0/5 ACs have automated test coverage. No E2E spec, no unit tests. This is a complete testing gap. The implementation quality is good, but the lack of tests means regressions won't be caught.

### Verdict

**Advisory** — No tests block shipping but represent significant coverage debt.
