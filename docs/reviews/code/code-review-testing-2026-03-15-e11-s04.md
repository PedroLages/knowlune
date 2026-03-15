# Test Coverage Review: E11-S04 — Data Export

**Date**: 2026-03-15
**Reviewer**: Claude Code (code-review-testing agent)

## AC Coverage Summary

**Coverage:** 7/8 ACs tested (88%) — PASS (>=80%)

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | JSON export with schema version | None | story-e11-s04.spec.ts:60 | Partial |
| 2 | CSV export with separate files | csvSerializer.test.ts:7 | story-e11-s04.spec.ts:73 | Covered |
| 3 | Markdown notes export with YAML frontmatter | noteExport.test.ts:226 | story-e11-s04.spec.ts:85 | Partial |
| 4 | xAPI Actor+Verb+Object structure | xapiStatements.test.ts:14 | None (intentional) | Covered |
| 5 | Open Badges v3.0 | openBadges.test.ts:41 | story-e11-s04.spec.ts:102 | Covered |
| 6 | JSON re-import with schema migration | importService.test.ts:54 | None (intentional) | Partial |
| 7 | Progress indicator, non-blocking UI | None | story-e11-s04.spec.ts:117 | Partial |
| 8 | Toast notification on error, cleanup | None | story-e11-s04.spec.ts:129 | Partial |

## High Priority

1. **AC1 E2E test (confidence: 85)** — Only verifies .json download, doesn't assert schemaVersion field exists. No unit test for exportAllAsJson().

2. **AC3 bulk export path untested (confidence: 82)** — Unit tests cover per-note export, not the bulk path in exportService.ts (soft-delete filtering, lastReviewedAt, duplicate filenames, topic frontmatter).

3. **AC7 non-blocking test is fragile (confidence: 78)** — Export completes near-instantly with empty DB, so progress bar may never be visible. Only checks heading visibility, not actual interactivity.

## Medium

1. **AC6 migration path untested (confidence: 72)** — Only tests same-version round-trip. No test imports older schema version.

2. **AC2 CSV row assertion incomplete (confidence: 68)** — Only checks one data row, not both rows in the test data.

3. **AC8 cleanup not asserted (confidence: 72)** — Toast appears but partial export cleanup not verified.

## Edge Cases Identified

- exportAllAsJson: db.table().toArray() throwing mid-export
- exportNotesAsMarkdown: all notes soft-deleted
- csvSerializer: timezone boundary sessions at 23:59 UTC
- importService: localStorage key collision with sidebar state
- openBadges: combined challenge + milestone badges ordering
