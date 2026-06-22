## Code Review: E77B-S02 — Drive Course Import Metadata and Schema

### What Works Well

1. **Clean v66 migration design.** The no-schema-change migration (`.stores({})`) is the correct approach for optional fields that aren't queried by index. The comment explains why no backfill is needed. The checkpoint version is bumped consistently across `CHECKPOINT_VERSION`, `schema.test.ts`, and `schema-checkpoint.test.ts`.

2. **Thorough test coverage on the happy path.** The `courseImport.drive.test.ts` covers: basic creation, video record creation with `driveFileRef`, non-video file filtering, `pdfCount` tracking, sequential ordering, empty file list, and `driveSource` consistency. The migration test covers read/write of both new fields, backward compatibility with legacy records, and mixed (Drive + local) records in the same course.

3. **Consistent code organization.** The Drive import function follows the established `persistScannedCourse` pattern (syncableWrite calls, `syncableWrite` `as unknown as SyncableRecord` cast) and lives alongside the existing imports in `courseImport.ts` with a clean section comment.

### Findings

#### High Priority

- **`src/lib/courseImport.ts:1197-1233` (confidence: 80) [AI Smell] [Correctness]**: PDF files counted but never persisted.
  
  `importCourseFromDrive` filters PDF files on line 1198 (`const pdfFiles = files.filter(f => f.mimeType === 'application/pdf')`) and stores `pdfCount: pdfFiles.length` on the course object. However, only `ImportedVideo` records are created — `ImportedPdf` records are never written. Any code querying `db.importedPdfs.where('courseId').equals(id)` for a Drive course will find zero records despite `pdfCount > 0`, creating a silent data integrity gap.

  The AC says "each file becomes an ImportedVideo record" which technically only covers video files. But the `pdfCount` field promises PDFs exist when they don't. This is a parallel-structure gap: the code mirrors the local-import pattern (count + filter for both videos and PDFs) but only completes the persist step for videos. The corresponding test on line 87-96 only asserts `pdfCount` is correct without verifying that PDF records actually exist in `importedPdfs`.

  **Fix**: Either (a) persist PDFs as `ImportedPdf` records (wrapped in a `try/catch` since Drive PDF streaming may be deferred), or (b) set `pdfCount` to 0 and add a comment explaining PDF storage is deferred. Option (b) is simpler and less risky but creates a permanent inconsistency between user-visible counts and actual data.

  **Category**: `Correctness` | **Autofix**: `manual` | **~effort**: 15-30 minutes (add persist + update test)

#### Nits

- **Nit** `src/db/checkpoint.ts:1` (confidence: 95) [Maintainability]: Header comment says "Dexie Migration Checkpoint — v61" and references "version 58" in the body. These are stale — the actual checkpoint is now v66. Update to "Dexie Migration Checkpoint — v66" and the correct frozen version reference.

  **Category**: `Maintainability` | **Autofix**: `safe_auto` | **~effort**: < 1 minute

### Recommendations

1. **Fix the PDF data integrity gap first** — this is the only issue that affects correctness. Either persist PDFs or zero out `pdfCount` with documentation. This matters most because consumers (UI, search, export) that rely on `db.importedPdfs.where('courseId')` will silently miss Drive-sourced PDFs.

2. **Update the checkpoint comment** — trivial fix, do it with the first change.

### Design Observations (Not Findings)

- The `source: undefined` on Drive courses is intentional per the AC ("sourceDriveId identifies it as a Drive-native course"). The `CourseSource` type comment says `undefined = 'local'` which is now partially inaccurate — consumers should also check `sourceDriveId`. This is acceptable as-is since no code queries `source` for Drive courses yet (S03+ will use `sourceDriveId`).

- The `null as unknown as FileSystemDirectoryHandle` cast on `directoryHandle` matches the existing codebase pattern (used in `persistScannedCourse`, `scanFromDroppedFiles`). Consistent, albeit fragile — but changing it project-wide is outside this story's scope.

---
Issues found: 2 | Blockers: 0 | High: 1 | Medium: 0 | Nits: 1
Confidence: avg 87 | >= 90: 1 | 70-89: 1 | < 70: 0
