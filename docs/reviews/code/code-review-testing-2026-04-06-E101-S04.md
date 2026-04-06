# Test Coverage Review: E101-S04 — Streaming Playback

**Date:** 2026-04-06
**Story:** E101-S04

## Acceptance Criteria Coverage

| AC | Description | E2E Test | Unit Test | Status |
|----|-------------|----------|-----------|--------|
| AC1 | ABS audiobook opens in BookReader layout | streaming.spec.ts:126 | — | FAILING |
| AC2 | Audio streams via URL with token | streaming.spec.ts:175 | AudiobookshelfService.test.ts (pre-existing) | FAILING |
| AC3 | Local audiobooks still use OPFS (regression) | streaming.spec.ts:193 | M4bParserService.test.ts:274 (FAILING) | PARTIAL |
| AC4 | Play/pause controls work | streaming.spec.ts:151 | — | FAILING |
| AC5 | Playback speed 0.5x-3x | — | — | NOT TESTED |
| AC6 | Sleep timer works | — | — | NOT TESTED (inherited from E87) |
| AC7 | Chapter list displays ABS metadata | streaming.spec.ts:163 | — | FAILING |
| AC8 | Session resume from last position | — | — | NOT TESTED |
| AC9 | Streaming error shows toast | — | — | NOT TESTED (toast visible in screenshot but no dedicated test) |

## Test Quality

- Tests use `FIXED_DATE` correctly (no `Date.now()` / `new Date()` in test code)
- Tests use `seedIndexedDBStore` helper correctly
- Tests properly seed localStorage for onboarding/sidebar
- Test data is well-structured with clear constants
- No `waitForTimeout()` used

## Gaps

1. **AC5 (speed control)**: No test for playback speed changes during streaming
2. **AC8 (session resume)**: No test for position persistence and restore
3. **AC9 (error handling)**: Toast is visible in screenshots but no dedicated assertion test
4. **All 4 E2E tests failing**: Need MSW/route mocking for the streaming endpoint

## Verdict

Test structure is sound but all E2E tests fail due to missing network mocking. Unit test for `isSingleFileAudiobook` needs updating.
