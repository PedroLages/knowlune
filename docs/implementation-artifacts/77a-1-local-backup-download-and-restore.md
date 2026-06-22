---
story_id: E77a-S01
story_name: "Local Backup Download and Restore"
status: completed
started: 2026-06-22
completed: 2026-06-22
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 77a.1: Local Backup Download and Restore

## Story

As a Knowlune user,
I want to download a backup of all my data and restore from a backup file,
so that I can protect against data loss.

## Acceptance Criteria

- R6: One-click "Download backup" produces a `.knowlune.json` file containing all syncable IndexedDB tables + localStorage settings, schema-versioned, restorable.
- R7: One-click "Restore from backup" reads a `.knowlune.json` file, runs schema migration if older, validates counts, commits atomically to IndexedDB, refreshes Zustand stores.
- R8: A pre-restore safety backup (auto-download) runs by default before any restore, with opt-out.
- R10: The feature surfaces in Settings > Data & Backup (not a new top-level page).

## Tasks / Subtasks

- [ ] 1. Create `exportAllAsBlob()` in `src/lib/exportService.ts`
- [ ] 2. Create `src/lib/importService.ts` with atomic restore + migration + validation
- [ ] 3. Create `src/app/components/settings/DataAndBackupPanel.tsx`
- [ ] 4. Create `src/app/components/settings/RestoreConfirmationDialog.tsx`
- [ ] 5. Integrate panel into `src/app/pages/Settings.tsx`
- [ ] 6. Test exportService (blob shape, filename format)
- [ ] 7. Test importService (migration path, rollback on partial failure)
- [ ] 8. Test DataAndBackupPanel (render, download, restore flow)

## Implementation Plan

See [implementation spec](#step-2-implement) — this story follows the spec provided.

## Implementation Notes

- Filename: `knowlune-backup-YYYY-MM-DD-HHmmss.json`
- Download uses `URL.createObjectURL(blob)` + anchor click
- Restore uses existing Dexie transaction + schema migration path
- Safety backup is always local download (not cloud)
- Design tokens from theme.css, never hardcoded colors
- Sonner toast for success/error feedback
- Uses existing settings panel layout patterns from E119 privacy panel and E90 model picker

## Testing Notes

- Export: unit test blob shape, filename format
- Import: unit test migration path, rollback on partial failure
- Panel: unit test render, download flow, restore flow
