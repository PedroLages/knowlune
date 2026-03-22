# Test Coverage Review: E03-S03 — Timestamp Notes and Video Navigation

**Date:** 2026-02-27
**Story:** E03-S03
**Reviewer:** Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Alt+T or timestamp button inserts `[MM:SS](video://lessonId#t=seconds)` at cursor | None | `story-e03-s03.spec.ts:29,53,74` | Partial |
| 2 | Clicking timestamp link in preview seeks video within 1 second | None | `story-e03-s03.spec.ts:89` | Partial |
| 3 | Timestamps render as blue-600 links with clock icon; hover shows tooltip | None | `story-e03-s03.spec.ts:122,139,154` | Partial |

**Coverage**: 0/3 fully covered | 3 partial (all have E2E but lack unit tests)

## Findings

### High Priority

**H1: Alt+T cursor-position assertion doesn't verify ordering (confidence: 88)**
- File: `tests/e2e/story-e03-s03.spec.ts:53-72`
- Three separate `expect` calls verify `'Before '`, timestamp regex, and `' After'` are in `value` — but don't assert their order.
- Fix: Use single pattern `expect(value).toMatch(/^Before \[\d+:\d{2}\]...After$/)`.

**H2: Seek test lacks video load guard (confidence: 85)**
- File: `tests/e2e/story-e03-s03.spec.ts:89-112`
- If video asset can't load, `currentTime` stays at 0 and `toPass` times out opaquely.
- Fix: Assert video readyState before seeking.

**H3: Blue styling test asserts class name, not computed color (confidence: 85)**
- File: `tests/e2e/story-e03-s03.spec.ts:139-152`
- `toHaveClass(/text-brand|text-blue/)` doesn't verify actual blue-600 rendering.
- Fix: Assert computed color via `getComputedStyle`.

**H4: Button state race — no wait for React re-render (confidence: 92)**
- File: `tests/e2e/story-e03-s03.spec.ts:29-51`
- After dispatching `timeupdate`, test clicks button without waiting for React state update.
- Fix: Add `await expect(timestampBtn).toBeEnabled()` guard.

### Medium

**M1: No unit tests for `parseVideoSeconds` and `formatTimestamp` (confidence: 75)**
- Both pure functions have real logic and multiple code paths (legacy/new format, hour+ timestamps).
- Fix: Add Vitest unit tests.

**M2: `knowlune-sidebar-v1` not in STORAGE_KEYS cleanup array (confidence: 75)**
- Tests use `addInitScript` to set it, but fixture cleanup doesn't remove it.
- Fix: Add to `STORAGE_KEYS` in fixtures.

### Edge Cases Not Tested

1. Boundary timestamp `t=0` — button disabled but manual link works
2. Hour-plus timestamps `[1:01:01]` — E2E regex `\d+:\d{2}` won't match
3. Legacy `video://154` format rendering and seeking
4. `onVideoSeek` not provided — dead link rendering
5. Cursor at position 0 or end of text
6. Rapid double-click on timestamp button
