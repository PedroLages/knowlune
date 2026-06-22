## Test Coverage Review: E77A-S04 — Backup Metadata Tracking and Status

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Given a backup is created locally When the export completes Then lastLocalAt metadata is updated with the current timestamp. | src/lib/__tests__/exportService.test.ts:652 (updateBackupMeta('local')) | None | Covered |
| 2 | Given a backup is uploaded to Google Drive When the drive upload completes Then lastDriveAt metadata is updated with the current timestamp. | src/lib/__tests__/exportService.test.ts:664 (updateBackupMeta('drive')), src/app/components/settings/__tests__/DataAndBackupPanel.drive.test.tsx:202 (asserts updateBackupMeta called with 'drive') | None | Covered |
| 3 | Given the user opens Settings > Data & Backup When the page loads Then the last backup timestamps are displayed for each backup type. | src/app/components/settings/__tests__/DataAndBackupPanel.meta.test.tsx:72 (Local), :89 (Drive), :105 (never backed up), :159 (fallback, no lastDestination), :174 (Drive more recent, no lastDestination) | None | Covered |
| 4 | Given the last backup was more than 30 days ago When the Data & Backup page renders Then a stale backup warning is shown. | src/app/components/settings/__tests__/DataAndBackupPanel.meta.test.tsx:115 (Drive stale >30d), :134 (Local stale >30d) | None | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)
None. All 4 ACs have tests.

#### High Priority
None.

#### Medium

1. **`DataAndBackupPanel.tsx` formatRelativeTime error path not tested (confidence: 80)**: The `formatRelativeTime` function has a `try/catch` block (lines 27-29) that returns `'unknown'` when `formatDistanceToNow` throws (e.g., with an invalid/NaN timestamp). This error path has no test coverage. While unlikely in production, it is dead code without coverage. Suggested test: `DataAndBackupPanel.meta.test.tsx` — add a test case "returns 'unknown' for invalid timestamp" that seeds `backupMeta.lastLocalAt` with `NaN` or `Infinity` and asserts the label shows "unknown".

2. **Boundary condition at exactly 30 days not tested (confidence: 75)**: The staleness check is `Date.now() - latestTimestamp > THIRTY_DAYS_MS` (strictly greater than), meaning a backup at exactly 30 days is NOT stale. The tests use 31 days (line 115) and 40 days (line 134) but never the boundary value of exactly 30 days. Suggested test: `DataAndBackupPanel.meta.test.tsx` — add a test case "does not show stale warning when last backup is exactly 30 days ago" that seeds a timestamp at exactly 30 days ago and asserts data-stale is "false".

#### Nits

1. **`DataAndBackupPanel.meta.test.tsx` uses inline factory instead of shared factory (confidence: 80)**: The `createSettings` helper function in `DataAndBackupPanel.meta.test.tsx` (lines 51-69) duplicates the AppSettings default shape from `settings.ts`. It also uses `colorScheme: 'professional'` while the actual defaults now use `'clean'`. Since the mock completely replaces `getSettings`, the factory values don't need to match the real defaults exactly, but this creates a subtle drift risk. Consider using the shared factory from `tests/support/fixtures/factories/` if one exists, or at minimum keep the colorScheme in sync with the actual source defaults.

### Edge Cases to Consider

- **Invalid/NaN timestamp in backupMeta**: `formatRelativeTime` catches the error and returns `'unknown'`, but this path is untested.
- **Exactly 30 days boundary**: Tests cover >30 days but not the ==30 day boundary where `isStale` should be `false`.
- **`updateBackupMeta('local')` call in SettingsPageContext**: The integration between `SettingsPageContext.handleExportJson` and `updateBackupMeta` is not tested at the component level — only the `updateBackupMeta` unit function is tested. This is a pre-existing gap (no SettingsPageContext test file exists) and is outside the scope of this story.
- **Negative diffMs (future timestamp)**: If `Date.now() - timestamp` produces a negative value (future backup), `formatRelativeTime` returns `'just now'` due to the `diffMs < 60_000` guard. Low-likelihood but untested behavior.

---
ACs: 4 covered / 4 total | Findings: 3 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 1
