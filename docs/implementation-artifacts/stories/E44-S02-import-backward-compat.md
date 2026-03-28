---
story_id: E44-S02
story_name: "Import Backward Compatibility"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 44.2: Import Backward Compatibility

## Story

As a learner,
I want to import both old and new export formats,
so that my existing backups remain usable after the export update.

## Acceptance Criteria

**Given** a v1 export file (no `formatVersion` field, 13 tables)
**When** I import it
**Then** all 13 tables import correctly with no errors
**And** missing tables (flashcards, etc.) are silently skipped

**Given** a v2 export file (`formatVersion: 2`, 21 tables)
**When** I import it
**Then** all 21 tables import correctly
**And** progress UI shows "Importing v2 format (21 tables)"

**Given** a v3+ export file (future, `formatVersion > 2`)
**When** I import it
**Then** a warning displays: "This export was created by a newer version"
**And** the import attempts anyway, skipping unknown tables

**Given** a round-trip test (export > import > export)
**When** I compare the two exports
**Then** they are identical (excluding `exportedAt` timestamp)

## Tasks / Subtasks

- [ ] Task 1: Add format version detection to import logic (AC: 1, 2, 3)
  - [ ] 1.1 Update `src/lib/importService.ts` to detect format version: no `formatVersion` field = v1, `formatVersion === 2` = v2, `formatVersion > 2` = future
  - [ ] 1.2 Replace schema version migration path with format-version-based import routing
  - [ ] 1.3 Update `CURRENT_SCHEMA_VERSION` import from exportService to use new `EXPORT_FORMAT_VERSION`
- [ ] Task 2: Implement v1 import path (AC: 1)
  - [ ] 2.1 Ensure existing 13-table import logic is preserved as the v1 code path
  - [ ] 2.2 Silently skip missing tables (flashcards, etc.) without errors
- [ ] Task 3: Implement v2 import path (AC: 2)
  - [ ] 3.1 Add import handling for all 21 tables
  - [ ] 3.2 Import screenshots as metadata-only records
  - [ ] 3.3 Handle tables present in export but missing from current DB schema (forward-compat, silently skip)
- [ ] Task 4: Future version warning (AC: 3)
  - [ ] 4.1 When `formatVersion > EXPORT_FORMAT_VERSION`, display warning toast: "This export was created by a newer version of Knowlune. Some data may not import correctly."
  - [ ] 4.2 Attempt import anyway, skipping unknown tables gracefully
- [ ] Task 5: Update progress UI (AC: 2)
  - [ ] 5.1 Show format-aware progress messages: "Importing v1 format (13 tables)" or "Importing v2 format (21 tables)"
  - [ ] 5.2 Log any tables present in DB but missing from import (informational, not blocking)
- [ ] Task 6: Round-trip verification tests (AC: 4)
  - [ ] 6.1 Add unit test: export v2 > import v2 > export v2 > compare (identical except `exportedAt`)
  - [ ] 6.2 Add unit test: v1 import with missing tables produces no errors
  - [ ] 6.3 Add unit test: v3+ import shows warning and processes known tables
  - [ ] 6.4 Add unit test: unknown tables in import data are silently skipped

## Implementation Notes

- **Key files:** `src/lib/importService.ts` (primary), `src/lib/exportService.ts` (type imports)
- **UI file:** Settings page import component (format version display in progress UI)
- **Test file:** `src/lib/__tests__/importService.test.ts` (or create if not exists)
- **Architecture spec:** `_bmad-output/planning-artifacts/quick-spec-export-service-reconciliation.md`
- **Dependency:** E44-S01 must be completed first (provides `EXPORT_FORMAT_VERSION` and v2 export format)
- Import should iterate over known table names and attempt to import each one from the export data -- if a table key is missing in the export, skip it
- The format version detection pattern: `exportData.formatVersion ?? 1` (undefined = legacy v1)
- Forward-compatibility strategy: never fail on unknown data, just log and skip

## Testing Notes

- Unit test: v1 file (no formatVersion) imports all 13 tables successfully
- Unit test: v1 file with missing tables in data object does not throw
- Unit test: v2 file imports all 21 tables successfully
- Unit test: v3+ file triggers warning and imports known tables
- Unit test: round-trip export > import > export produces identical output (minus exportedAt)
- Unit test: tables in export but not in DB schema are skipped without error
- Manual test: import a real v1 export from current app, verify data integrity
- E2E test: Settings > Data > Import flow with v1 and v2 files

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
