# Test Coverage Review: E22-S04 Auto-Categorize Courses on Import

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (automated)
**Story:** E22-S04 — Auto-Categorize Courses on Import

## Test Files Reviewed

- `src/ai/__tests__/courseTagger.test.ts` (26 tests)
- `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` (22 tests, pre-existing + fix)

## Acceptance Criteria Coverage

| AC | Description | Unit Test | E2E Test | Coverage |
|----|------------|-----------|----------|----------|
| AC1 | AI analyzes course metadata to generate tags | Yes (generateCourseTags happy path) | No | Partial |
| AC2 | Shows 2-5 AI-generated topic tags | Yes (parseTagResponse tests) | No | Partial |
| AC3 | Tags persisted in IndexedDB | No (ollamaTagging.ts not unit-tested) | No | Gap |
| AC4 | Graceful degradation when Ollama not configured | Yes (returns empty tags) | No | Partial |
| AC5 | Can edit/remove tags on course card | Pre-existing tests in ImportedCourseCard | No | Covered |
| AC6 | Structured JSON, fast models, 10s timeout | Yes (timeout test, format schema test) | No | Covered |

## Findings

### ADVISORY: No unit tests for `ollamaTagging.ts` orchestrator

The orchestrator module (`ollamaTagging.ts`) has zero test coverage. Key untested behaviors:
- Tag merging with existing tags (dedup logic)
- IndexedDB persistence after successful tagging
- Zustand store update after successful tagging
- Error handling and toast notifications
- Status transitions (analyzing -> complete/error)

The `courseTagger.ts` module is thoroughly tested, but the integration layer that calls it is not.

### ADVISORY: No E2E tests for this story

The story file mentions E2E test expectations (import + verify tags appear, import without Ollama). No E2E spec was created. This is understandable since E2E testing of Ollama integration requires a running Ollama server, but a mock-based E2E could verify the UI indicator appears.

### ADVISORY: ImportedCourseCard test needed fix for `autoAnalysisStatus`

The story added `state.autoAnalysisStatus[course.id]` to the component but didn't update the test mock, causing all 22 tests to fail. This was caught and fixed during review (added `autoAnalysisStatus: {}` to the mock store).

## Test Quality

- **courseTagger.test.ts**: Excellent. Covers 9 scenarios for `generateCourseTags`, 13 scenarios for `parseTagResponse`, and 2 for `isOllamaTaggingAvailable`. Edge cases are well-covered (timeout, abort, empty input, garbage input, dedup, limit).
- **Mock setup**: Clean and well-organized with helper functions.
- **No test anti-patterns detected**: No `Date.now()`, no `waitForTimeout()`, no manual IDB seeding.

## Verdict

Test quality is high for the tested module. The main gap is the untested orchestrator (`ollamaTagging.ts`).
