## Test Coverage Review: E77B-S02 — Drive Course Import — Metadata and Schema

### AC Coverage Summary

**Acceptance Criteria Coverage:** 1/3 ACs tested (**33%**)

**COVERAGE GATE:** BLOCKER (<80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | `ImportedCourse` created with `sourceDriveId` and each file becomes `ImportedVideo` with `driveFileRef` | `src/lib/__tests__/courseImport.drive.test.ts` (lines 37-51, 53-69, 72-85, 87-96, 98-117); `src/db/__tests__/migration-v66-drive-source.test.ts` (lines 31-53, 55-80) | None | Covered |
| 2 | Player uses `driveFileRef.fileId` to stream content on-demand via access token | None | None | Gap |
| 3 | `sourceDriveId` identifies a Drive-native course in metadata display (not local, not YouTube) | None | None | Gap |

**Coverage**: 1/3 ACs fully covered | 2 gaps | 0 partial

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC2: "the player uses `driveFileRef.fileId` to stream content on-demand from Google Drive via the access token" has no test. The `importCourseFromDrive()` function writes `driveFileRef` onto each `ImportedVideo` record, and the migration test confirms the field persists, but no test verifies the player actually reads `driveFileRef.fileId` to stream content. This AC describes a runtime behavior of the video player component, which is not part of this data-layer change set. **Suggested resolution**: either remove or defer this AC to a follow-up story that adds the player integration, or add an E2E test once that integration exists. Not testable via the unit/migration tests in this PR.

- **(confidence: 90)** AC3: "`sourceDriveId` identifies it as a Drive-native course (not local, not YouTube)" has no test. The implementation sets `source: undefined` on Drive-imported courses (differentiating from `'local'` and `'youtube'`), but there is no test verifying that a consumer of the data correctly distinguishes Drive courses from other types using the presence of `sourceDriveId`. No UI-level test exists because no UI code was changed. **Suggested test**: In `courseImport.drive.test.ts`, add an assertion on the returned course that `result.source` is `undefined` (confirming it is neither `'local'` nor `'youtube'`), and add a new test "should have source undefined for Drive courses" in that file.

#### High Priority

- **(confidence: 88)** `src/lib/__tests__/courseImport.drive.test.ts`: Missing test for `syncableWrite` failure. The `importCourseFromDrive()` function calls `await syncableWrite('importedCourses', 'add', ...)` and subsequently `await syncableWrite('importedVideos', 'add', ...)` without a try/catch. If the course write succeeds but a video write fails, the course record is orphaned — it exists with no videos. No test verifies this error handling behavior. **Fix**: Add a test that mocks `syncableWrite` to reject on the second call and asserts that the error propagates correctly (or that cleanup happens). Alternatively, note this as a known limitation if partial persistence is acceptable.

- **(confidence: 85)** `src/lib/__tests__/courseImport.drive.test.ts`: Missing test for `source` field semantics. AC3 requires that a Drive course be distinguishable from local and YouTube. The implementation sets `source: undefined` for Drive courses, but this is not tested. **Fix**: In `courseImport.drive.test.ts`, after creating a course, assert that `result.source` is `undefined` and that `result.sourceDriveId` is set. This ensures the data model supports AC3's identification requirement even though no UI code tests exist.

- **(confidence: 80)** `src/lib/__tests__/courseImport.drive.test.ts`: Missing test for empty/unexpected MIME types. The implementation silently skips files where `mimeType` does not start with `'video/'` and is not `'application/pdf'`. A file with an empty `mimeType` string, `mimeType: ''`, or an unexpected type like `mimeType: 'image/png'` results in it being silently ignored. **Fix**: Add a test with mixed files including one with `mimeType: ''` and one with `mimeType: 'image/png'`, asserting they are omitted from both videos and pdfCount.

- **(confidence: 75)** `src/lib/__tests__/courseImport.drive.test.ts`: Missing assertion that Drive videos have empty `path` and `fileHandle` set to null. Drive-sourced courses intentionally omit local file references (`path: ''`, `fileHandle: null`, `duration: 0`, `format: 'mp4'`). The current tests verify `driveFileRef` structure but do not confirm the absence of local-only fields. **Fix**: Add assertions in the existing video-checking test that `videos[0].path === ''`, `videos[0].fileHandle === null`, `videos[0].duration === 0`, and `videos[0].format === 'mp4'`.

#### Medium

- **(confidence: 80)** `src/db/__tests__/migration-v66-drive-source.test.ts` (lines 82-104): The backward compatibility test writes a new record after the migration is complete. This validates that Dexie tolerates missing optional fields on new records, but it does NOT test that an EXISTING v65 database upgrades to v66 without data loss. Since v66 has no schema change and no upgrade callback, this is safe by construction — but a more thorough test would create a v65 DB with existing records, open it at v66, and verify records are unchanged. **Suggested improvement**: Add a `migrateFromV65` helper (pattern used by `v20 migration edge cases` in `schema.test.ts`) that creates a v65 database with seeded courses/videos, then reopens with the full migration chain and asserts the pre-existing records survive.

- **(confidence: 75)** `src/lib/__tests__/courseImport.drive.test.ts` (line 72-85): The "should filter out non-video files" test sends 3 files (1 video, 1 PDF, 1 image) and asserts 1 video result. It also separately tests `pdfCount`. This is reasonable coverage. However, the interplay between `videoCount` and `pdfCount` is tested but the fact that PDFs do NOT produce `ImportedVideo` records could be more explicit. The current test confirms 1 video with `fileId: 'f1'` — it does not verify that no video record was created for the PDF or image. **Suggestion**: After the `toHaveLength(1)` assertion, add `expect(videos.every(v => v.driveFileRef?.fileId === 'f1')).toBe(true)` to confirm only the video file got a DB record.

- **(confidence: 70)** `src/db/__tests__/schema.test.ts` and `schema-checkpoint.test.ts`: Both tests check `db.verno === 66` and verify the table list. Neither test validates that the `importedCourses` and `importedVideos` schema definitions (which did NOT change in v66 — both are absent from the v66 `.stores({})` call) still include their correct indexes. This is consistent with the v66 approach (no schema change), but a regression in one of the pre-existing indexes (e.g., `userId` or `source`) would go undetected. Not a blocker, but schema tests could selectively verify key indexes on `importedCourses` and `importedVideos`.

#### Nits

- **(confidence: 65)** `src/lib/__tests__/courseImport.drive.test.ts` (line 98-117): The "should assign sequential order numbers matching input array order" test uses filename order to assert index-based ordering. The filenames are `c.mp4`, `a.mp4`, `b.mp4` — the assertion checks they appear in input order, not sorted order. The comment explains this well, but the test is slightly fragile: any reordering of the `files` array in the test would silently change what's being tested. Very low risk for a 3-element array.

- **(confidence: 60)** `src/db/__tests__/migration-v66-drive-source.test.ts` (line 55-80): The `driveFileRef` write/read test uses `expect(retrieved!.driveFileRef).toEqual(ref)` and then separately asserts `fileId` and `driveSource`. The `.toEqual()` alone is sufficient — the subsequent two lines are redundant. Minor cleanup opportunity.

### Edge Cases to Consider

1. **`syncableWrite` failure during import**: `importCourseFromDrive()` writes the course first, then videos sequentially. If the course write succeeds but a video write throws, the course exists with zero videos. No test covers this rollback/partial-state scenario. Suggested test uses `vi.mocked(syncableWrite)` to reject mid-sequence.

2. **Duplicate Drive folder name**: Unlike `scanCourseFolder()` which checks for duplicate course names in the `importedCourses` table, `importCourseFromDrive()` does not detect or prevent duplicate imports of the same Drive folder. A user could import the same folder twice, creating duplicate courses. Related edge case: calling `importCourseFromDrive` with the same `folderId` but different `folderName` would produce two courses sharing no duplicate name check.

3. **Drive file with empty `mimeType`**: Files with `mimeType: ''` or `mimeType: undefined` are silently filtered out by the `startsWith`/`===` checks. Not tested.

4. **Non-video/non-PDF `video/*` MIME variant**: MIME types like `video/x-matroska` (for MKV files) would pass the `startsWith('video/')` filter. This is correct behavior, but untested.

5. **Very large file arrays**: No stress or performance test for 1000+ file imports. The sequential `for...of` loop over videos would be slow with no batching.

6. **`pdfCount` ≠ actual ImportedPdf records**: The implementation counts PDFs from the `files` array but never actually persists any `ImportedPdf` records. The `pdfCount` field on the course record is set but no PDF records are written to the DB. This is noted as correct behavior (PDF handling deferred), but could be confusing. No test confirms that no `ImportedPdf` records exist after import.

7. **`driveFileRef.driveSource` is hardcoded to `'google'`**: The `DriveFileRef` type has `driveSource: 'google'` as the only valid value. The import always stamps `'google'`. No test verifies what happens if `driveSource` is omitted or set to a different value (though the type system prevents this at compile time).

---
ACs: 1 covered / 3 total | Findings: 12 | Blockers: 2 | High: 4 | Medium: 3 | Nits: 2 | Unresolved: 0
