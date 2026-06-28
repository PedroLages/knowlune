# Deferred Issues — URL Batch Import & Dialog Redesign

**Created:** 2026-06-28
**Branch:** feature/ce-2026-06-28-course-import-experience
**Status:** Deferred after R3 review — all non-blocking edge cases

## Review Summary

| Severity | Resolved | Deferred |
|----------|----------|----------|
| BLOCKER | 1 | 0 |
| HIGH | 16 | 0 |
| MEDIUM | 21 | 11 |
| LOW | 10 | 11 |

## Remaining MEDIUM Findings (P2 — Edge Cases & Hardening)

| # | Title | File | Description |
|---|-------|------|-------------|
| R3-004 | Double-scan guard on Enter | BulkImportDialog.tsx | Enter key fires scan even when already scanning — needs `!isScanningUrl` guard |
| R3-005 | Concurrent retry lock | BulkImportDialog.tsx | `handleRetry` can be double-triggered — needs `retryingFolders` Set guard |
| R3-006 | Stale closure in Escape key | BulkImportDialog.tsx | Keydown handler reads `isScanningUrl` state instead of ref — race condition |
| R3-007 | E2E test: URL→track creation | tests/e2e/ | Happy path "scan server → manifest → track created" lacks E2E coverage |
| R3-008 | ImportWizardDialog abortRef | ImportWizardDialog.tsx | Async handlers can run after dialog close (same bug already fixed in BulkImportDialog) |
| R3-009 | serverUrl lost on persist | BulkImportDialog.tsx, courseImport.ts | Retry won't work for server-imported courses — source URL not preserved per-item |
| R3-010 | Server BFS depth/file limits | courseImport.ts | `scanCourseFolderFromServer` has no MAX_DEPTH or MAX_FILES — resource exhaustion risk |
| R3-011 | Missing data-testid on wizard URL | ImportWizardDialog.tsx | Can't target URL input in E2E tests |
| R3-012 | Test: all-folders-empty flow | tests/ | No test for when every scanned folder returns no-files |
| R3-013 | Duplicate authors on re-import | trackManifestImport.ts | `batchImportTrackCourses` doesn't check for existing authors before creating |

## Adversarial Review — All Resolved

All 4 findings from the plan-level adversarial review (a3e77ec4) were resolved:
- **ServerResult `ok:` vs `success:`** — Fixed in plan deepening (corrected to `ok:`)
- **CORS error indistinguishability** — Browser limitation acknowledged; error messages improved
- **FolderEntry.handle nullability** — Full blast-radius enumeration done (8 sites in BulkImportDialog)
- **Scanning loop error asymmetry** — Addressed via `scanCourseFromSource()` wrapper function

## When to Address

Schedule these in a future story/epic focused on import hardening. None are user-facing bugs — all are edge-case safety nets and test coverage gaps.

## Related Artifacts

- Plan: [docs/plans/2026-06-28-001-feat-url-batch-import-dialog-redesign-plan.md](../plans/2026-06-28-001-feat-url-batch-import-dialog-redesign-plan.md)
- Requirements: [docs/brainstorms/2026-06-28-course-import-experience-requirements.md](../brainstorms/2026-06-28-course-import-experience-requirements.md)
