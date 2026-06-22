## Test Coverage Review: E77B-S04 — Drive Source Management UI and Sync Validation

### AC Coverage Summary

**Acceptance Criteria Coverage:** 1/8 ACs tested (**12.5%**)

**COVERAGE GATE:** BLOCKER (<80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Drive-imported course card shows "Drive" badge with HardDrive icon next to file metadata | `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx:153-178` | None | Partial |
| 2 | Drive-imported course detail page shows Google Drive source banner with "Reconnect" button | None | None | Gap |
| 3 | Reconnect button clicked maps new file IDs to existing lessons by filename and updates `sourceDriveId` | None | None | Gap |
| 4 | Toast shows match count (e.g., "X of Y files matched") after reconnect | None | None | Gap |
| 5 | Settings page Integrations & Data shows Google Drive configuration card with connected account, scope status, disconnect | None | None | Gap |
| 6 | "Grant Access" button available when read scope not granted | None | None | Gap |
| 7 | "Disconnect Google Drive" shows confirmation dialog and signs out on confirm | None | None | Gap |
| 8 | `updateCourseDetails` with `sourceDriveId` updates the field on the database record | None | None | Gap |

**Coverage:** 1/8 ACs fully covered | 0 full | 1 partial | 7 gaps

### Test Quality Findings

#### Blockers (Untested ACs)

- **(confidence: 100) AC #2**: "Drive-imported course detail page shows Google Drive source banner with 'Reconnect' button" has no test of any kind. The banner is rendered at `UnifiedCourseDetail.tsx:403-428` when `storeCourse?.source === 'drive'`. Suggested test: `describe('Drive source banner')` in a new test file `src/app/pages/__tests__/UnifiedCourseDetail.driveSource.test.tsx` asserting that the banner with `data-testid="drive-source-banner"` appears only for Drive-sourced courses and that the "Reconnect" button is present.

- **(confidence: 100) AC #3**: "Reconnect maps new file IDs to existing lessons by filename and updates `sourceDriveId`" has no test. The function `handleReconnectFolder` at `UnifiedCourseDetail.tsx:273-316` performs file matching (`f.name.toLowerCase() === video.filename.toLowerCase()`), calls `updateCourseDetails(courseId, { sourceDriveId: result.folderId })`, and updates `driveFileRef` on matched videos via Dexie. Suggested test: a unit test in `src/app/pages/__tests__/UnifiedCourseDetail.driveSource.test.tsx` that mocks the store and Dexie, calls the callback with a `DriveFolderBrowserResult`, and asserts `updateCourseDetails` was called with the correct `sourceDriveId` and that `db.importedVideos.update` was called for matched filenames. A test for case-insensitive filename matching should also be included per the dev notes.

- **(confidence: 100) AC #4**: "Toast shows match count after reconnect" has no test. The toast at `UnifiedCourseDetail.tsx:304-306` formats `"X of Y files matched"`. Suggested test: extend the reconnect unit test above to assert `toast.success` was called with a string containing the match count using the data from `result.files.length`.

- **(confidence: 100) AC #5**: "Settings page Integrations & Data shows Google Drive configuration card" has no test. `DriveConfigurationSettings` is rendered at `IntegrationsDataSection.tsx:81`. Suggested test: a unit test for `DriveConfigurationSettings` in a new file `src/app/components/settings/__tests__/DriveConfigurationSettings.test.tsx` that renders the component and asserts the card renders with connected account email or "Not connected" state, scope status badge, and disconnect action. An E2E test would be better given this is a user-facing settings page.

- **(confidence: 100) AC #6**: "Grant Access button available when read scope not granted" has no test. The button at `DriveConfigurationSettings.tsx:181-192` is conditionally rendered when `!readScopeGranted && hasDriveToken`. Suggested test: mock `hasDriveReadScope` to return `false`, render `DriveConfigurationSettings` with a session containing `provider_token`, and assert the "Grant Access" button with `aria-label="Grant Drive read permission"` is visible.

- **(confidence: 100) AC #7**: "Disconnect confirmation dialog appears and on confirm signs out" has no test. The `AlertDialog` at `DriveConfigurationSettings.tsx:219-237` wraps `handleDisconnect` which calls `signOut()`. Suggested test: render `DriveConfigurationSettings`, click "Disconnect Google Drive" (with `aria-label`), assert the dialog content appears, click confirm, and assert `signOut` was called. An E2E test is strongly preferred here since this involves a real dialog interaction flow.

- **(confidence: 100) AC #8**: "`updateCourseDetails` with `sourceDriveId` updates the field on the database record" has no test. Although `updateCourseDetails` tests exist at `src/stores/__tests__/useCourseImportStore.test.ts:338-410`, none of them exercise the `sourceDriveId` field. The `sourceDriveId` is handled at `src/stores/useCourseImportStore.ts:329` (`if (details.sourceDriveId !== undefined) patch.sourceDriveId = details.sourceDriveId`). Suggested test: add a test case `'should set sourceDriveId on database record'` to the existing `describe('updateCourseDetails')` block that calls `updateCourseDetails(course.id, { sourceDriveId: 'folder-123' })` and verifies the course in IndexedDB has `sourceDriveId: 'folder-123'`.

#### High Priority

- **(confidence: 90) `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx:157`**: AC #1 asserts the badge shows a "HardDrive icon next to file metadata" but the test only checks `toHaveTextContent('Drive')` without verifying the icon renders or that the badge is positioned in the file-metadata row. The test would pass even if the icon were removed from the component. Fix: Assert the HardDrive icon element exists within the badge (e.g., via `within(badge).getByRole('img', { hidden: true })` for SVG icons, or check for a Lucide-specific data attribute) and verify the badge renders inside the metadata row (container with `data-testid="course-card-video-count"` sibling context).

- **(confidence: 85) No E2E tests at all**: This story adds substantial user-facing UI (badge on card, banner+reconnect on detail page, full Drive configuration card in settings) spanning three different pages/routes. The dev notes acknowledge "No story-specific E2E spec" but this contradicts the test-quality framework rule that "ACs involving user interaction or navigation flows MUST have E2E coverage." ACs 2, 3, 5, 6, and 7 all involve browser interaction patterns (opening a page, clicking buttons, navigating to settings). The unit test for AC1 is insufficient to validate the complete interactive experience.

#### Medium

- **(confidence: 85) `src/stores/__tests__/useCourseImportStore.test.ts:338-410`**: The existing `describe('updateCourseDetails')` tests use a generic `makeCourse()` factory that does not set `sourceDriveId` in the initial course. The factory at line 13-26 has no `sourceDriveId` default, so all courses are created without it. This means the rollback test (line 368-383) never validates rollback of the `sourceDriveId` field. Fix: either add `sourceDriveId: undefined` explicitly to the factory and add a scenario where it is set-then-failed, or ensure any new `sourceDriveId` test isolates from the existing tests.

- **(confidence: 70) `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx:13`**: The comment "Per-test override variables for mocks — mutated in test bodies" flags a known shared-mutable-state pattern. While `beforeEach` resets, the architecture relies on module-level mutable references (`mockCourseCardPreview`, `mockVideoFromHandle`) which could leak state between tests if a `beforeEach` reset is ever missed. This is a latent isolation risk.

#### Nits

- **(confidence: 80) `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx:161`**: Test name "does not show Drive source badge for local courses" checks `source: undefined` but the actual default source for local courses is `'local'` per the `ImportedCourse` type. Using `undefined` is slightly misleading. Suggest using an explicit `source: 'local'` override for clarity, or document that `undefined` represents the local default.

- **(confidence: 70) `src/app/components/courses/__tests__/CourseCard.driveSource.test.tsx:152-178`**: The `renderCard` helper at line 121 is not TypeScript-typed to accept `source` as a direct prop — it flows through `overrides: Partial<ImportedCourse>`. This is fine for the factory pattern, but the test reader needs to know that `source` is an `ImportedCourse` field, not a component prop. Consider extracting a type-safe builder or adding a JSDoc to `renderCard`.

### Edge Cases to Consider

- **Case-insensitive filename matching**: AC #3/Dev Notes specify `f.name.toLowerCase() === video.filename.toLowerCase()` for reconnect matching. No test validates either case-insensitive equality or the case where no files match (0 of Y matched toast).
- **Empty reconnect result**: `DriveFolderBrowserResult.files` could be empty after reconnect selection. The toast would show "0 of 0 files matched" — this is likely confusing. No test or guard handles this.
- **Reconnect while reconnecting**: The `isReconnecting` guard prevents double-triggers (line 275) but no test verifies this debounce behavior.
- **Drive source banner on non-Drive courses**: The condition `storeCourse?.source === 'drive'` at line 403 relies on `storeCourse` which is found via `importedCourses.find()`. If the course exists in the adapter but not in the store (edge case during sync), the banner would not render despite a Drive-sourced course. No test covers this mismatch.
- **Scope check loading state**: `DriveConfigurationSettings.tsx:167-170` shows a "Checking..." badge while `scopeCheckLoading` is true. No test verifies this intermediate state renders.
- **Disconnect error path**: `handleDisconnect` at line 83-98 has a catch block (line 93) that shows a toast on unexpected errors, but the primary error path from `signOut()` (line 86-88) checks `error` property. If both `signOut()` throws *and* returns an error, the catch block handles it. No test covers either error path.

---
ACs: 1 covered / 8 total | Findings: 11 | Blockers: 7 | High: 2 | Medium: 2 | Nits: 2
