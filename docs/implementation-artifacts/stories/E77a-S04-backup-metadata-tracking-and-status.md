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

## Dev Agent Record

### File List

- `src/lib/settings.ts` — BackupMetadata type and settings store
- `src/lib/exportService.ts` — Timestamp updates on export
- `src/app/components/settings/SettingsPageContext.tsx` — Context wiring
- `src/app/components/settings/DataAndBackupPanel.tsx` — UI display
