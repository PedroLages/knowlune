---
story_id: E44-S01
story_name: "Export Format v2 (21 Tables)"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 44.1: Export Format v2 (21 Tables)

## Story

As a learner,
I want my data exports to include ALL my data (flashcards, quizzes, authors, etc.),
so that I have a complete backup before enabling sync.

## Acceptance Criteria

**Given** the export service at CURRENT_SCHEMA_VERSION = 14 with 13 tables
**When** I trigger a JSON export from Settings > Data > Export
**Then** the exported file includes all 21 user-relevant tables
**And** the export contains `formatVersion: 2` (independent of Dexie schema version)
**And** the export contains `schemaVersion: 27` (current Dexie version, informational)
**And** non-serializable fields (FileSystemHandles, Blobs) are stripped automatically
**And** screenshots export metadata only (no binary imageData)

**Given** a v1 export file (legacy, 13 tables)
**When** I check the export format
**Then** it has no `formatVersion` field (backward compatible detection)

## Tasks / Subtasks

- [ ] Task 1: Decouple export format version from Dexie schema version (AC: 1)
  - [ ] 1.1 Replace `CURRENT_SCHEMA_VERSION = 14` with `EXPORT_FORMAT_VERSION = 2` in `src/lib/exportService.ts`
  - [ ] 1.2 Add `formatVersion` field to `KnowluneExport` interface alongside existing `schemaVersion`
  - [ ] 1.3 Set `schemaVersion` to current Dexie `CHECKPOINT_VERSION` (27), `formatVersion` to `EXPORT_FORMAT_VERSION` (2)
- [ ] Task 2: Add 8 missing tables to export (AC: 1)
  - [ ] 2.1 Add table entries for: flashcards, quizzes, quizAttempts, authors, courses, careerPaths, pathEnrollments, courseReminders, screenshots
  - [ ] 2.2 Add corresponding fields to `KnowluneExport` data type
  - [ ] 2.3 Update `exportAllAsJson()` tables array and data object to include all 21 tables
- [ ] Task 3: Implement generic `stripNonSerializable()` (AC: 1)
  - [ ] 3.1 Create `stripNonSerializable<T>()` that removes FileSystemHandle, FileSystemDirectoryHandle, Blob, ArrayBuffer fields
  - [ ] 3.2 Replace the three dedicated strip functions (`stripDirectoryHandle`, `stripFileHandleVideo`, `stripFileHandlePdf`) with the generic version
  - [ ] 3.3 Apply `stripNonSerializable()` to all tables that may contain non-serializable fields (importedCourses, importedVideos, importedPdfs, flashcards, authors)
- [ ] Task 4: Screenshots metadata-only export (AC: 1)
  - [ ] 4.1 Create `ScreenshotMetadata` type in `src/data/types.ts` that excludes `imageData`
  - [ ] 4.2 Map screenshots to metadata-only records before including in export (strip binary `imageData`)
- [ ] Task 5: Update progress reporting (AC: 1)
  - [ ] 5.1 Update progress callback to accurately report all 21 tables during export
- [ ] Task 6: Update tests (AC: 1, 2)
  - [ ] 6.1 Update `src/lib/__tests__/exportService.test.ts` to verify `EXPORT_FORMAT_VERSION` replaces `CURRENT_SCHEMA_VERSION`
  - [ ] 6.2 Add test verifying all 21 tables are present in export output
  - [ ] 6.3 Add test verifying `formatVersion: 2` and `schemaVersion: 27` fields
  - [ ] 6.4 Add test verifying screenshots contain metadata only (no imageData)
  - [ ] 6.5 Add test verifying non-serializable fields are stripped

## Implementation Notes

- **Key file:** `src/lib/exportService.ts` (primary, ~50 lines of changes)
- **Type file:** `src/data/types.ts` (add `ScreenshotMetadata` type)
- **Test file:** `src/lib/__tests__/exportService.test.ts`
- **Architecture spec:** `_bmad-output/planning-artifacts/quick-spec-export-service-reconciliation.md`
- **Tables to ADD:** flashcards, quizzes, quizAttempts, authors, courses, careerPaths, pathEnrollments, courseReminders, screenshots (metadata only)
- **Tables to SKIP:** embeddings, courseThumbnails, entitlements, videoCaptions, youtubeVideoCache, youtubeTranscripts, youtubeChapters (regenerable/cache/auth-managed)
- The generic `stripNonSerializable()` is more maintainable than per-table strip functions and automatically handles future non-serializable fields
- `EXPORT_FORMAT_VERSION` increments only when export structure changes (new/removed tables, field renames) -- independent of Dexie version

## Testing Notes

- Unit test: export output contains all 21 table keys in `data` object
- Unit test: `formatVersion === 2` and `schemaVersion === 27` in export header
- Unit test: screenshots have no `imageData` field
- Unit test: FileSystemHandle/Blob fields are stripped from importedCourses, importedVideos, importedPdfs
- Unit test: progress callback fires for all 21 tables
- Manual test: export file size remains reasonable (< 50MB for typical use)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
