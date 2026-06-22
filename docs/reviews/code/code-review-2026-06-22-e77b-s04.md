## Code Review: E77B-S04 — Drive Source Management UI and Sync Validation

### What Works Well

1. **Clean design token usage throughout.** The Drive badge uses `bg-brand-soft/80` + `text-brand-soft-foreground`, the settings card uses `bg-surface-sunken/30` + `bg-surface-elevated`, and the success indicators use `bg-success-soft` + `text-success`. No hardcoded colors anywhere in the new code.

2. **All 8 acceptance criteria are implemented and correctly scoped.** Every AC has a corresponding code path that handles the described scenario (Drive badge on card, banner on detail page, reconnect flow with filename matching, toast with match count, settings card with email/scope/disconnect, grant access button, disconnect confirmation, and store update for `sourceDriveId`). The existing `handleCourseDetails` update pattern is elegantly extended with an optional `sourceDriveId` field.

3. **Well-documented tradeoffs in dev notes.** The reconnect file-matching approach (case-insensitive filename comparison), the fire-and-forget scope authorization redirect, and the sign-out-disconnects-everything limitation are all explicitly acknowledged. This shows clear understanding of the constraints and avoids future confusion.

### Findings

#### Medium

- **`src/app/pages/UnifiedCourseDetail.tsx:280` (confidence: 80) [Correctness]**: Drive reconnect ignores `updateCourseDetails` return value, risking state inconsistency.

  **What**: `handleReconnectFolder` calls `await updateCourseDetails(courseId, { sourceDriveId: result.folderId })` but discards the returned `boolean`. If the update fails (returns `false`), the flow continues to update video `driveFileRef` records. This creates a window where video files have new Drive file IDs but the course record still has the old `sourceDriveId` — the course metadata and its files are out of sync.

  **Why**: A learner who reconnects to a new folder but hits a Dexie write failure mid-flow would see "success" indicators (videos updated) but the course would retain the old `sourceDriveId`. Any future reconnect or Drive-related operation using `sourceDriveId` would read stale data.

  **Fix**: Check the return value and bail out early on failure:

  ```typescript
  const ok = await updateCourseDetails(courseId, { sourceDriveId: result.folderId })
  if (!ok) {
    toast.error('Failed to update Drive folder reference. Reconnect was not completed.')
    return
  }
  ```

  **Effort**: 3 lines. `autofix_class: gated_auto`

- **`src/app/pages/UnifiedCourseDetail.tsx:305` (confidence: 82) [Correctness]**: Reconnect success toast inflates the denominator with non-video files.

  **What**: The toast reads `` `Drive folder reconnected. ${matchedCount} of ${result.files.length} files matched.` ``. But `result.files` includes all Drive files from the selected folder (videos, PDFs, images, etc.), while the matching loop only checks against `importedVideos`. A folder with 10 videos and 5 PDFs would show "7 of 15 files matched" instead of "7 of 10 videos matched" — the 5 PDFs are counted in the denominator but were never matchable.

  **Why**: Learners see an apparently incomplete match count and may think the reconnect was partially unsuccessful or broken, when in reality it worked correctly for all video files.

  **Fix**: Filter `result.files` to video-type files before computing the denominator:

  ```typescript
  const videoFiles = result.files.filter(f => f.mimeType.startsWith('video/'))
  // ... then use videoFiles.length in the message ...
  toast.success(
    `Drive folder reconnected. ${matchedCount} of ${videoFiles.length} videos matched.`
  )
  ```

  **Effort**: 4 lines. `autofix_class: manual`

#### Nits

- **Nit** `src/app/components/settings/DriveConfigurationSettings.tsx:44` (confidence: 80) [Maintainability]: Uncommitted whitespace-only change in the working tree (line break removed from the `googleEmail` assignment). Should be committed or discarded before the branch is merged to keep the working tree clean. `autofix_class: safe_auto`

### Recommendations

1. **Fix the `updateCourseDetails` return-value check** (Medium #1) — this is the highest-impact fix if the app ever hits a Dexie write failure during reconnect. Without it, course metadata and video files drift apart.
2. **Fix the toast denominator** (Medium #2) — quick change that eliminates a UX confusion point for Drive users.
3. **Discard or commit the whitespace change** (Nit) — working tree should be clean.

### Additional Notes

- **Test coverage gap (AC2-AC8)**: Only AC1 (Drive badge) has a unit test. The remaining ACs for the source banner, reconnect flow with file matching, settings card, and disconnect dialog are untested. The dev notes acknowledge this gap and suggest a follow-up E2E spec. This is noted for awareness — the code itself is structurally sound, but regression risk is higher without coverage of the interactive flows.

---
Issues found: 3 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 1
Confidence: avg 81 | >= 90: 0 | 70-89: 3 | < 70: 0
