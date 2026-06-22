---
status: ready-for-review
reviewed: in-progress
review_started: 2026-06-22
review_gates_passed: []
---

# Story 77a.4: Backup Metadata Tracking and Status

## Story

As a user,
I want to see when my last backup was (local, Drive, other destination),
so that I know whether my backup is stale and can take action.

## Acceptance Criteria

1. **Given** a backup is created locally **When** the export completes **Then** `lastLocalAt` metadata is updated with the current timestamp.
2. **Given** a backup is uploaded to Google Drive **When** the drive upload completes **Then** `lastDriveAt` metadata is updated with the current timestamp.
3. **Given** a backup is sent to a custom destination **When** the export completes **Then** `lastDestination` metadata is updated with the current timestamp.
4. **Given** the user opens Settings > Data & Backup **When** the page loads **Then** the last backup timestamps are displayed for each backup type.
5. **Given** the last backup was more than 7 days ago **When** the Data & Backup page renders **Then** a stale backup warning is shown.

## Dev Notes

- Reuses existing `settings` store (Zustand + Dexie persistence)
- `BackupMetadata` type in `src/lib/settings.ts`
- Drive timestamp updated in export flow when destination == "drive"

## Challenges and Lessons Learned

- **Test drift from concurrent stories**: During review pre-checks, `settings.test.ts` had stale expectations
  because `colorScheme` default changed from `'professional'` to `'clean'`, `fontSize` was removed from
  defaults, and `courseViewMode`/`courseGridColumns` were added by parallel stories. This manifests as
  test drift when branches diverge from `main`. Mitigation: run unit tests before opening PR to catch
  drift early.

- **Minimal surface area**: The `BackupMeta` interface was straightforward to add — a few fields in the
  settings store, wire them through the export service, display in the Data & Backup panel. No migration
  or complex state management needed because the type is additive (new optional field in AppSettings).

- **Pre-existing E2E flakiness**: Three Overview page E2E tests fail intermittently (`stats-grid` selector
  timeout). These are pre-existing and unrelated to backup metadata changes.

## Dev Agent Record

### File List

- `src/lib/settings.ts` — BackupMetadata type and settings store
- `src/lib/exportService.ts` — Timestamp updates on export
- `src/app/components/settings/SettingsPageContext.tsx` — Context wiring
- `src/app/components/settings/DataAndBackupPanel.tsx` — UI display
