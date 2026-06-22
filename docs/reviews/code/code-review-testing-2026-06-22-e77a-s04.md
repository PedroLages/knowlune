# Test Coverage Review: E77A-S04 — Backup Metadata Tracking and Status

## AC Coverage Summary

**Acceptance Criteria Coverage:** 2/5 ACs tested (**40%**)

**COVERAGE GATE:** BLOCKER (<60%). Must add tests to reach 80% minimum.

## AC Coverage Table

| AC# | Description                                                            | Unit Test                                        | E2E Test | Verdict           |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------ | -------- | ----------------- |
| 1   | Local backup completes -> `lastLocalAt` updated with current timestamp | None                                             | None     | **Gap**           |
| 2   | Drive upload completes -> `lastDriveAt` updated with current timestamp | None                                             | None     | **Gap**           |
| 3   | Custom destination completes -> `lastDestination` updated              | None                                             | None     | **Unimplemented** |
| 4   | Settings > Data & Backup shows last backup timestamps                  | `DataAndBackupPanel.meta.test.tsx` lines 72-189  | None     | **Covered**       |
| 5   | Backup >7 days ago -> stale warning shown                              | `DataAndBackupPanel.meta.test.tsx` lines 115-149 | None     | **Partial**       |

**Coverage**: 2/5 ACs | 2 gaps | 1 unimplemented | threshold mismatch on AC5

## Test Quality Findings

### Blockers (untested ACs)

1. **(confidence: 95) AC1: Core `updateBackupMeta` local path is never tested.**
   The `updateBackupMeta('local')` call path (via `SettingsPageContext.handleExportJson()` -> `downloadJson()` -> `updateBackupMeta('local')`) has zero test coverage. Neither the `exportService.test.ts` file nor any component test verifies that a local export triggers the metadata update.

- **Suggested test**: In `DataAndBackupPanel.meta.test.tsx`, add a test that renders the panel, triggers a local export mock, and asserts `updateBackupMeta` was called with `'local'`. Alternatively, add a direct unit test for `updateBackupMeta` in `exportService.test.ts`.

2. **(confidence: 95) AC2: Drive upload success path does not assert `updateBackupMeta('drive')` was called.**
   `DataAndBackupPanel.drive.test.tsx` line 172 ("shows success toast with webViewLink and progress reaches 100% (AC2)") covers the Drive upload success flow but never asserts that `updateBackupMeta('drive')` was called. The mock is set up (`vi.fn()`) at line 50 but never verified.

- **Suggested test**: Add `expect(updateBackupMeta).toHaveBeenCalledWith('drive')` to the existing success test at line 172.

3. **(confidence: 100) AC3: "Custom destination" is not implemented.**
   The `BackupMeta` type in `src/lib/settings.ts` only supports `'local' | 'drive'` as destinations. No "custom destination" flow exists in the UI or the export service. This AC is unimplemented and untested.

- **Action**: Either implement custom destination support or update the story ACs to reflect scope.

### High Priority

4. **(confidence: 85) AC5 threshold mismatch: AC says 7 days, implementation uses 30 days.**
   The AC states "more than 7 days ago" triggers the stale warning, but `DataAndBackupPanel.tsx` line 19 defines `THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000` (30 days). Tests at `DataAndBackupPanel.meta.test.tsx` line 115 ("shows red stale warning when last backup is >30 days ago") match the implementation (31 days), not the AC (7 days). This is a specification/implementation discrepancy.

- **Action**: Update the AC to say 30 days or change the implementation to 7 days, then align the test threshold accordingly.

5. **(confidence: 80) `updateBackupMeta` function has zero direct unit tests.**
   The function at `src/lib/exportService.ts` lines 67-81 is the core business logic for AC1, AC2, and AC3. It is the only function in `exportService.ts` not covered by `exportService.test.ts`. A direct unit test should verify:
   - Calling with `'local'` sets `lastLocalAt` to the current timestamp and `lastDestination` to `'local'`
   - Calling with `'drive'` sets `lastDriveAt` to the current timestamp and `lastDestination` to `'drive'`
   - It preserves existing `backupMeta` fields (e.g., calling with `'drive'` when `lastLocalAt` already exists)
   - It dispatches a `settingsUpdated` event
   - It handles `undefined` `backupMeta` gracefully (creates new object)

- **Suggested file**: `src/lib/__tests__/exportService.test.ts` (new `describe('updateBackupMeta', ...)` block)

### Medium

6. **(confidence: 65) Weak assertion in Drive success toast test.**
   `DataAndBackupPanel.drive.test.tsx` line 197-198 asserts `toast.success` was called with `expect.objectContaining({})` and `expect.anything()`. This would pass for any `toast.success` call regardless of content — it does not verify the success message includes the Drive `webViewLink` or "Saved to Drive" text.

- **Fix**: Assert `toast.success` was called with content that includes `webViewLink` or the "View" link text, e.g. check the first argument contains `result.webViewLink`.

7. **(confidence: 60) `SettingsPageContext.handleExportJson()` is not tested.**
   The `handleExportJson` method in `SettingsPageContext.tsx` orchestrates the full local export flow: `exportAllAsJson()` -> `downloadJson()` -> `updateBackupMeta('local')`. This is the primary integration path for AC1 but has no test coverage.

- **Suggested test**: Either render the `SettingsPageProvider` and simulate the export flow, or extract `handleExportJson` as a standalone function that can be tested in isolation.

### Nits

8. **(confidence: 50) `backupStatusBanner` data attributes use boolean-as-string pattern.**
   `DataAndBackupPanel.tsx` lines 181-182 set `data-stale={display?.isStale ?? false}` and `data-never={display === null}`. These will render as `data-stale="false"` / `data-never="false"` rather than being absent, which is technically correct for data- attributes but the tests assert string values rather than the more robust boolean presence check.

- No action required — the current pattern works, but prefer removing the attribute entirely when false for cleaner selectors.

9. **(confidence: 40) No E2E test for backup metadata display.**
   AC4 and AC5 involve visual UI states (timestamp display, stale warnings) that benefit from end-to-end verification through the actual settings data flow. While the unit tests in `DataAndBackupPanel.meta.test.tsx` are thorough, an E2E test would verify that the Data & Backup page loads correctly with real `getSettings()` calls rather than mocked data.

- **Suggested test**: A Playwright spec in `tests/e2e/` that navigates to Settings > Data & Backup, seeds `localStorage` with backup metadata, and asserts the backup status banner renders correctly.

## Edge Cases to Consider

- **Concurrent backup timestamps**: What happens when a local export and a Drive upload complete in the same millisecond? The `lastDestination` field would be overwritten by whichever completes last.
- **Clock skew / manual time changes**: `Date.now()` is used for timestamps. If the user changes their system clock, backup timestamps could appear in the future or past.
- **`settingsUpdated` event propagation**: `updateBackupMeta` dispatches `settingsUpdated` but the `DataAndBackupPanel` reads `settings` from `getSettings()` on every render — there is no reactive subscription. The display only updates on re-render (navigation, state change). This is not tested.

---

ACs: 2 covered / 5 total | Findings: 9 | Blockers: 3 | High: 2 | Medium: 2 | Nits: 2
