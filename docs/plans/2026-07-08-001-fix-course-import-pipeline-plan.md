---
title: "fix: Repair server course import pipeline — section structure, data loss, and batch URL import"
type: fix
status: active
date: 2026-07-08
origin: docs/brainstorms/2026-06-28-course-import-experience-requirements.md
---

# Fix Course Import Pipeline

## Overview

Repair the server course import pipeline that loses 80% of content and all section structure, and add batch URL import capability. A deep comparison between the "Linux Administration Bootcamp Go from Beginner to Advanced" course (74 videos, 26 PDFs across 16 sections on the server) and what appears in the app (15 scrambled items, no sections) revealed four compounding root causes in the scan→persist→render chain.

## Problem Frame

Users importing courses from a self-hosted nginx file server (Knowlune Media Server) experience catastrophic data loss. The current `scanCourseFolderFromServer()` pipeline:

1. **Destroys section hierarchy** — flattens 16 directed folders into a single undifferentiated flat list
2. **Derives wrong paths** — uses full server-root-relative paths (`AI/Course/DevOps/01-Overview/001-intro.mp4`) instead of course-folder-relative paths (`01-Overview/001-intro.mp4`), so `getSectionName()` returns `"AI"` for every file instead of the actual section folder
3. **Treats PDFs as standalone lessons** — companion PDFs (cheat sheets, slides, text notes) appear as independent primary items rather than materials attached to their parent video lesson
4. **Drops subtitle files entirely** — 74 `.srt` files are silently discarded because the extension is not in the supported list

Additionally, the existing requirements document (2026-06-28) defines batch URL import capability and dialog redesign that fits naturally alongside these fixes — the same server-scanning code path will be exercised by the new batch URL flow.

## Requirements Trace

### Bug Fix Requirements (from investigation)

- **R-FIX1.** Server-imported video paths must be course-folder-relative, not server-root-relative, so `getSectionName()` can recover the correct section folder name.
- **R-FIX2.** Section/module structure must be preserved during scanning and persisted so the Course Content sidebar renders collapsible sections.
- **R-FIX3.** Companion PDFs (cheat sheets, slides, text notes, worksheets) must be recognized as materials and associated with their parent video lesson, not displayed as standalone primary items.
- **R-FIX4.** SRT subtitle files must be imported and stored in the `videoCaptions` table, keyed by video ID.
- **R-FIX5.** 100% of video files and PDF files present on the server must be imported (zero data loss). The `MAX_SERVER_SCAN_FILES = 5,000` cap is fine; the bug is in path derivation, not the cap.
- **R-FIX6.** Lesson ordering in the sidebar must follow section→lesson numeric sequence, not alphabetical or filesystem order.
- **R-FIX7.** Re-importing an already-imported course must not duplicate lessons. Existing courses may need a re-import migration path.

### Feature Requirements (from origin document)

- **R1.** Batch URL import entry point in BulkImportDialog (card option "Import Multiple from URL").
- **R2.** Server sub-directory discovery via `listServerSubDirectories()` with folder selection UI.
- **R3.** Server folder scanning reuses existing `scanCourseFolderFromServer()` and concurrent infrastructure.
- **R4.** `listServerSubDirectories(url)` function in `src/lib/courseImport.ts`.
- **R5.** Batch URL import available in Learning Tracks create-track flow.
- **R6.** Import dialog source selection redesign (first-class card options, no hidden toggles).
- **R7.** UX polish and error handling.

## Scope Boundaries

- **In scope**: Fix server path normalization, add section structure preservation during server scanning, add PDF material detection, add SRT subtitle import, implement batch URL import + dialog redesign per origin document.
- **Out of scope**: Redesign of the review/importing/results steps (source-agnostic, already functional). Non-nginx server types (Apache autoindex, JSON API). Google Drive batch import. YouTube batch import (already handled separately). Manifest-based course content filtering (`course-manifest.json` support already exists via `applyManifestVideoOrder`).
- **Out of scope**: Auto-migration of already-imported courses. Users with broken imports will need to delete and re-import. Document this in release notes.

### Deferred to Separate Tasks

- **Path derivation fix for drag-and-drop imports**: `scanFromDroppedFiles` has the same root-path issue. Deferred to a follow-up PR.
- **SRT→VTT/WebVTT conversion**: Storing raw SRT is sufficient for Phase 1; converting to browser-playable WebVTT is deferred.

## Context & Research

### Relevant Code and Patterns

| File | Role |
|------|------|
| `src/lib/courseImport.ts:1400` | `scanCourseFolderFromServer()` — server scanner, flat BFS, broken path derivation |
| `src/lib/courseImport.ts:1412-1414` | `serverRoot` derivation: strips only protocol+host, not base path — **root cause of path bug** |
| `src/lib/courseImport.ts:563` | `persistScannedCourse()` — writes to IndexedDB, calls `applyManifestVideoOrder` when manifest present |
| `src/lib/courseImport.ts:499` | `applyManifestVideoOrder()` — sets `moduleTitle` from manifest; never called for non-manifest courses |
| `src/lib/courseServerService.ts:167` | `fetchDirectoryListing()` — nginx autoindex parser |
| `src/lib/courseServerService.ts:67` | `classifyFile()` — SRT extension not in recognized lists, maps to `'other'` |
| `src/lib/lessonBasedCurriculum.ts:205` | `buildLessonBasedCurriculum()` — groups by numeric prefix, sections by `getSectionName(path)` |
| `src/lib/lessonBasedCurriculum.ts:503` | `getSectionName()` — returns `parts[0]` of path, gives wrong segment for server imports |
| `src/lib/lessonMaterialMatcher.ts:128` | `matchMaterialsToLessons()` — 5-tier filename matching for PDF→video association |
| `src/lib/lessonMaterialMatcher.ts:142` | `isMaterialFilename()` — detects material type from stem |
| `src/data/types.ts:223` | `ImportedVideo` — has `moduleTitle`, `order`, `serverUrl` |
| `src/data/types.ts:263` | `ImportedPdf` — no parent video reference |
| `src/app/components/course/tabs/LessonsTab.tsx` | Sidebar component — calls `adapter.getLessonBasedCurriculum()` |
| `src/app/components/figma/BulkImportDialog.tsx` | Batch import dialog |
| `src/app/components/figma/ImportWizardDialog.tsx` | Single import wizard |

### Institutional Learnings

- **[batch-course-import-track-creation]** Use `onComplete(courseIds: string[])` callback (not CustomEvent) for batch operations. Guard with `completedSuccessfullyRef` that only flips on `'results'` step. See `docs/solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md`.
- **[url-batch-import-lessons]** Wrap heterogeneous sources in `scanCourseFromSource()`. Use mutually exclusive fields pattern (`handle: null` + optional `serverUrl`) not parallel type hierarchies. See `docs/solutions/developer-experience/implementation-lessons-url-batch-import-2026-06-28.md`.
- **[course-content-sidebar-pdf]** `matchMaterialsToLessons` correctly pairs companion PDFs with videos — the data was always correct, only UI rendering was broken. Material count badge was hardcoded to 0. See `docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md`.
- **[lesson-badge-index]** Always use `sortBy('order')` on `importedVideos` queries, never `toArray()`. Use `groupIndexMap` for global position lookup, not `.map()` index. See `docs/solutions/ui-bugs/lesson-badge-local-global-index-mismatch-2026-05-04.md`.
- **[course-import-cover-image]** Two-pass scanning: pass 1 full depth for videos+PDFs, pass 2 `maxDepth: 0` for cover images. `isImageFile` guard prevents non-image leakage. See `docs/solutions/ui-bugs/course-import-cover-image-shows-subdirectory-images-2026-04-30.md`.
- **[track-import-consolidation]** Non-serializable objects must use `useRef`, not `useState`. Every `await` in dialog actions needs try-catch + state recovery. See `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md`.

## Key Technical Decisions

- **Fix path derivation in-place**: Modify `scanCourseFolderFromServer()` to compute the course folder base path from the input URL and strip it from all derived paths. This produces course-relative paths (`01-Overview/001-intro.mp4`) identical to local imports. All downstream consumers (`getSectionName`, `groupByFolder`, `buildLessonBasedCurriculum`) then work correctly without changes.

- **Add server-side section structure**: Track the current directory during BFS traversal and emit a `moduleTitle` derived from the directory name for each file. Pass this through to `ScannedVideo` (add optional `moduleTitle?: string`) and persist it in `ImportedVideo.moduleTitle`. This gives `buildLessonBasedCurriculum` a direct source of truth for section grouping that works for ALL imports, not just manifest-based ones.

- **Material detection during scan**: Extract `isMaterialFilename()` from `src/lib/lessonBasedCurriculum.ts:142` (currently a non-exported local function) to `src/lib/lessonMaterialMatcher.ts` so both modules can import it. Apply it during server scanning to classify PDFs as materials when their filenames contain material indicators (text, cheat-sheet, slides, etc.). See Unit 0.

- **Add SRT to recognized extensions**: Add `.srt` and `.vtt` to `VIDEO_EXTENSIONS` / `SUPPORTED_FILE_EXTENSIONS` (or a separate caption set). During scan, match SRT files to their parent video by filename stem and store as `VideoCaptionRecord`.

- **Reuse existing `scanCourseFromSource` wrapper**: The batch URL import flow can dispatch server-sourced folders through the existing `scanCourseFromSource()` function (line 1031), which already handles the server vs. local branching. No new scan function needed.

- **Dialog redesign reuses existing card pattern**: The `ImportedCard`/card-based layout already exists in BulkImportDialog. Extend it with a fourth card option and adapt ImportWizardDialog to use the same pattern.

## Implementation Units

### Phase 1: Core Pipeline Fixes

- [ ] **Unit 1: Fix server path normalization in `scanCourseFolderFromServer`**

**Goal:** All server-imported video and PDF paths are course-folder-relative, matching local import behavior.

**Requirements:** R-FIX1, R-FIX6

**Dependencies:** None

**Files:**
- Modify: `src/lib/courseImport.ts` (lines 1408-1414, 1460-1461, 1472-1473)
- Test: `src/lib/__tests__/courseServerImport.test.ts`

**Approach:**
- Compute `courseBasePath` from the input `folderUrl`: strip protocol+host from the URL and use the path as the base prefix to strip from derived file paths
- Change `relPath` computation from `file.url.replace(serverRoot + '/', '')` to `file.url.replace(courseBaseUrl + '/', '')` where `courseBaseUrl` includes the full path to the course folder
- This produces paths like `01 - Overview/001 Course Overview.mp4` instead of `Academy/DevOps/DevOps-Platform-Engineer/Linux Administration.../01 - Overview/001 Course Overview.mp4`

**Patterns to follow:**
- `scanCourseFolderFromHandle` (line 886) — local imports already produce correct course-relative paths

**Test scenarios:**
- Happy path: Server URL `http://server/Academy/DevOps/MyCourse/` → video path `01-Overview/001-intro.mp4` (not `Academy/DevOps/MyCourse/01-Overview/001-intro.mp4`)
- Happy path: Server URL with trailing slash handled identically to without
- Edge case: Server URL at root (`http://server/MyCourse/`) → path `01-Overview/001-intro.mp4`
- Edge case: URL-encoded characters in path segments decoded correctly
- Integration: `getSectionName(path)` returns `"01 - Overview"` (correct section folder)
- Integration: `buildSections()` produces multiple sections instead of one

**Verification:**
- `getSectionName()` test helper returns the correct section folder for server-imported paths
- `buildLessonBasedCurriculum()` produces 16 sections for the Linux Administration course
- Existing local import tests pass unchanged (no regression)

---

- [ ] **Unit 2: Preserve section structure during server scanning**

**Goal:** `ScannedVideo` records carry `moduleTitle` derived from the directory name they were found in.

**Requirements:** R-FIX2

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/courseImport.ts` (ScannedVideo interface, scanCourseFolderFromServer)
- Modify: `src/lib/courseImport.ts` (persistScannedCourse — copy moduleTitle to ImportedVideo)
- Modify: `src/data/types.ts` (optional: no change needed — ImportedVideo already has moduleTitle)
- Test: `src/lib/__tests__/courseServerImport.test.ts`
- Test: `src/lib/__tests__/lessonBasedCurriculum.test.ts`

**Approach:**
- During BFS traversal in `scanCourseFolderFromServer`, track which directory (`pendingDir`) each file came from
- Extract the directory's last path segment as `moduleTitle` (e.g., `"01 - Overview"` from URL path `.../01 - Overview/`)
- Strip the numeric prefix for display: `"01 - Overview"` → `"Overview"` (use existing `cleanSectionTitle` logic or inline)
- Add `moduleTitle?: string` to `ScannedVideo` interface
- In `persistScannedCourse`, copy `moduleTitle` from `ScannedVideo` to `ImportedVideo` when present (bypass when manifest already provides it)

**Patterns to follow:**
- `applyManifestVideoOrder()` line 527 — already sets `moduleTitle` from manifest modules; the new code path complements it

**Test scenarios:**
- Happy path: File in `01 - Overview/` → `moduleTitle = "Overview"`
- Happy path: File in `03 - Linux Fundamentals/` → `moduleTitle = "Linux Fundamentals"`
- Happy path: File at root (no parent dir) → `moduleTitle = undefined`
- Edge case: `moduleTitle` from scan is overwritten by manifest when both present (manifest wins)
- Edge case: Sections with only PDFs (no videos) still appear as sections in curriculum
- Integration: Course Content sidebar shows 16 collapsible sections for the Linux Administration course

**Verification:**
- After import, `db.importedVideos.where('courseId').equals(id).toArray()` shows distinct `moduleTitle` values per section
- `buildLessonBasedCurriculum()` groups lessons into sections matching server folder names

---

- [ ] **Unit 3: Classify companion PDFs as materials during import**

**Goal:** PDFs whose filenames indicate they are supplementary materials (cheat sheets, slides, text notes, worksheets) are flagged as materials and associated with their parent video lesson during import.

**Requirements:** R-FIX3

**Dependencies:** Unit 0, Unit 1, Unit 2
- Modify: `src/lib/lessonBasedCurriculum.ts` (use import-time material flag when available)
- Test: `src/lib/__tests__/lessonMaterialMatcher.test.ts` (add server scanning integration cases)
- Test: `src/lib/__tests__/courseServerImport.test.ts`

**Approach:**
- During server scan, after collecting all videos and PDFs, run a post-scan material classification pass over the PDF list:
  - For each PDF, check `isMaterialFilename(pdf.name)` from `lessonMaterialMatcher.ts`
  - If true, attempt to find the matching video by same numeric prefix and section
  - Associate the PDF with its parent video via a new `materialOf?: string` (video ID) field on `ScannedPdf`
- In `persistScannedCourse`, when a PDF has `materialOf`, store it but do NOT count it toward `pdfCount` for standalone display
- In `buildLessonBasedCurriculum`, respect the pre-computed material association: PDFs flagged as materials with a parent video are attached as `materials[]` rather than creating standalone `LessonGroup` entries

**Patterns to follow:**
- `isMaterialFilename()` in `src/lib/lessonMaterialMatcher.ts:142` — already has the detection patterns
- `matchMaterialsToLessons()` in `src/lib/lessonMaterialMatcher.ts:128` — already does 5-tier matching at render time; the import-time classification complements this

**Technical design (directional):**
> After scan, for each PDF: if `isMaterialFilename(pdf.name)`, find the video with the same numeric prefix in the same section. If found, set `pdf.materialOf = video.id`. This pre-computes the association so `buildLessonBasedCurriculum` can skip render-time matching for already-classified materials.

**Test scenarios:**
- Happy path: `011 vi-cheat-sheet.pdf` in same section as `011 Editing Files in Vi.mp4` → flagged as material, attached to video
- Happy path: `001 Linux-Distros.pdf` with stem not matching material keywords → treated as primary (it's a standalone reading)
- Happy path: `002 Welcome-to-Shell-Text.pdf` (stem contains "Text") → flagged as material
- Edge case: Material PDF with no matching video at same prefix → kept as standalone
- Edge case: Multiple material PDFs at same prefix → all attached to the one video
- Edge case: PDF at a prefix with no video → kept as standalone reading
- Integration: Course Content sidebar shows PDFs nested under parent videos with collapsible materials toggle

**Verification:**
- After import, `db.importedPdfs.where('courseId').equals(id).toArray()` shows material PDFs with correct parent video IDs
- `buildLessonBasedCurriculum()` produces `LessonGroup` entries where materials are attached, not standalone

---

- [ ] **Unit 4: Import SRT subtitle files during server scan**

**Goal:** SRT subtitle files discovered during server scanning are imported and stored as `VideoCaptionRecord` entries in the `videoCaptions` Dexie table.

**Requirements:** R-FIX4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/courseServerService.ts` (add `.srt`, `.vtt` to recognized extensions, add `'caption'` type to `ServerFile.type`)
- Modify: `src/lib/courseImport.ts` (scanCourseFolderFromServer — collect SRT files, match to videos by stem)
- Modify: `src/lib/courseImport.ts` (persistScannedCourse — write VideoCaptionRecord entries)
- Modify: `src/db/schema.ts` (ensure videoCaptions table has necessary indexes)
- Create: `src/lib/__tests__/courseServerImport.test.ts` (add SRT import cases)

**Approach:**
- Add `.srt` and `.vtt` extensions to a new `CAPTION_EXTENSIONS` set in `courseServerService.ts`
- Add `'caption'` to the `ServerFile.type` union
- In `scanCourseFolderFromServer`, collect caption files alongside videos/PDFs
- Match caption files to their parent video by filename stem (e.g., `001 Course Overview_en.srt` → `001 Course Overview.mp4`)
  - **Language suffix list (explicit constant):** `const CAPTION_LANG_SUFFIXES = ['_en', '_fr', '_es', '_de', '_ja', '_zh', '_ko', '_pt', '_ar', '_ru', '_it', '_nl', '_pl', '_sv', '_tr', '_hi', '_vi', '_th'] as const`. Defined in `src/lib/courseImport.ts` alongside caption matching logic. An explicit list avoids false positives from broad regex patterns like `_[a-z]{2}$` that would incorrectly strip legitimate filename suffixes.
  - Fallback: if no match after suffix stripping, try the full stem as a last resort
- Add `captions: ScannedCaption[]` to `ScannedCourse` interface, where:
  - `ScannedCaption = { videoStem: string; language?: string; srtContent: string; serverUrl: string }` — videoStem is the raw stem before suffix stripping, language is the detected code if a suffix was stripped (e.g., `"en"`), srtContent is raw SRT text
- In `persistScannedCourse`, write matched captions to `videoCaptions` as `VideoCaptionRecord` entries (matches `src/data/types.ts:30-37`)

**Patterns to follow:**
- Existing `VideoCaptionRecord` type at `src/data/types.ts:30-37`
- Existing `videoCaptions` table in the Dexie schema

**Test scenarios:**
- Happy path: `001 Course Overview_en.srt` matched to `001 Course Overview.mp4` → caption record created
- Edge case: `001 Course Overview_en.srt` — language suffix `_en` stripped before matching → matches video `001 Course Overview.mp4`
- Edge case: `001 Course Overview_fr.srt` — `_fr` stripped → matches same video → stored alongside `_en` caption
- Edge case: `001 Course Overview_raw.srt` — `_raw` is NOT in the language suffix list → full stem `001 Course Overview_raw` used for matching (may not match if video stem differs)
- Edge case: SRT file with no matching video → skipped, logged as warning
- Edge case: Multiple SRT files for same video (different languages) → all stored
- Edge case: VTT file handled identically to SRT file
- Integration: Captions are retrievable via `db.videoCaptions.where('videoId').equals(id)`

**Verification:**
- After import, captions appear in the videoCaptions table for matched videos
- Caption count in test matches expected (74 SRTs for 74 videos in Linux Admin course)

---

### Phase 2: Batch URL Import

- [ ] **Unit 5: Add `listServerSubDirectories()` function**

**Goal:** A new function discovers course folders at a given server URL.

**Requirements:** R4, R2.1-R2.6

**Dependencies:** None (parallel with Phase 1)

**Files:**
- Create: (function in existing file) `src/lib/courseImport.ts` (around line 1098)
- Test: `src/lib/__tests__/courseServerImport.test.ts`

**Approach:**
- Implement `listServerSubDirectories(url: string): Promise<ServerResult<{name: string; url: string}[]>>` per R4 spec
- Call `fetchDirectoryListing(url)` to get the directory listing
- Filter for entries with `type === 'directory'`
- Return `{name, url}` objects (URL composed from parent URL + directory name)
- Handle errors: non-200, CORS, network, empty directory — all as `{ok: false, error: "..."}`

**Patterns to follow:**
- `fetchDirectoryListing()` at `src/lib/courseServerService.ts:167` — existing nginx autoindex parsing
- `ServerResult<T>` type at `src/lib/courseServerService.ts:30` — discriminated union pattern

**Test scenarios:**
- Happy path: Valid nginx URL → returns array of sub-directory entries
- Happy path: Empty directory (no sub-folders) → returns empty array
- Error path: Non-200 response → `{ok: false, error: "..."}`
- Error path: Invalid URL → `{ok: false, error: "..."}`
- Error path: Network failure → `{ok: false, error: "..."}`

**Verification:**
- Function exports correctly from `courseImport.ts`
- Unit tests pass with mocked HTTP responses

---

- [ ] **Unit 6: Add batch URL import to BulkImportDialog**

**Goal:** Users can paste a server URL in BulkImportDialog, discover course folders, select them, and import them.

**Requirements:** R1, R2, R3, R5

**Dependencies:** Unit 5, Units 1-4 (needs fixed server scan)

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`
- Test: `src/app/components/figma/__tests__/BulkImportDialog.test.tsx`

**Approach:**
- Add `'enter-url'` to the `DialogStep` type
- Add fourth card option "Import Multiple from URL" in the `'choose'` step
- Add `'enter-url'` step with URL input, validation, and "Scan" button
- On scan, call `listServerSubDirectories()` and transition to `'select-folders'` step
- Extend `FolderEntry` with optional `serverUrl?: string` field
- Reuse existing `'select-folders'` step UI (checkbox list) for server-discovered folders
- Pass server-sourced folders through existing `scanCourseFromSource()` for scanning
- Handle `track-manifest.json` detection for server URLs (R2.6)

**Patterns to follow:**
- Existing card pattern in BulkImportDialog `'choose'` step
- `scanCourseFromSource()` at `src/lib/courseImport.ts:1031` — already handles server vs. local branching
- `completedSuccessfullyRef` guard pattern from `docs/solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md`

**Test scenarios:**
- Happy path: Paste server URL → scan → select folders → import → courses appear
- Happy path: Enter key triggers scan (keyboard navigation)
- Error path: Invalid URL → inline error message
- Error path: Scan fails → user-friendly error, back to URL step
- Edge case: Empty selection → "Import" button disabled
- Integration: Courses imported from URL appear in Learning Track when initiated from CurriculumComposer

**Verification:**
- Batch URL import flow works end-to-end: URL → discover → select → scan → import
- Existing local batch import still works (no regression)

---

### Phase 3: Dialog Redesign

- [ ] **Unit 7: Redesign ImportWizardDialog source selection**

**Goal:** All import sources in ImportWizardDialog are first-class card options — no hidden toggle for URL import.

**Requirements:** R6, R7

**Dependencies:** None (parallel with other units)

**Files:**
- Modify: `src/app/components/figma/ImportWizardDialog.tsx`
- Test: `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx`

**Approach:**
- Restyle the "Import from URL" toggle button as a first-class primary card option (icon, title, description) — this is a visual redesign, NOT a removal. Single-URL import functionality is preserved; the toggle is visually promoted to a card, matching the existing card pattern used in BulkImportDialog.
- Use consistent card design across both import dialogs: `rounded-xl border`, icon in brand-soft circle, title, one-line description, hover `bg-accent`, `focus-visible:ring`
- Ensure card layout accommodates 2x2 grid and 1-column list layouts
- Test responsive behavior at 375px, 768px, 1440px
- Touch targets ≥ 44×44px on mobile

**Patterns to follow:**
- Existing card pattern in BulkImportDialog `'choose'` step
- Design tokens from `src/styles/theme.css` (no hardcoded colors)
- Styling conventions in `.claude/rules/styling.md`

**Test scenarios:**
- Happy path: URL import card visible and clickable in ImportWizardDialog
- Happy path: Single folder import card visible (existing functionality preserved)
- Happy path: YouTube import card visible (existing functionality preserved)
- Responsive: Cards render correctly at 375px (mobile), 768px (tablet), 1440px (desktop)
- Accessibility: All cards keyboard-navigable with visible focus rings
- Regression: Existing single URL import flow still works

**Verification:**
- No toggle button for URL import — URL is a first-class card
- `/design-review` produces no Blocker findings at any breakpoint

---

### Phase 3.5: Re-Import Safety

- [ ] **Unit 8: Add re-import dedup/update logic**

**Goal:** Re-importing an already-imported server course must not create duplicate video/PDF/caption records. Existing records are updated in place.

**Requirements:** R-FIX7

**Dependencies:** Units 1-4 (needs fixed path derivation + material + caption data)

**Files:**
- Modify: `src/lib/courseImport.ts` (persistScannedCourse — add upsert logic)
- Test: `src/lib/__tests__/courseServerImport.test.ts` (re-import cases)
- Test: `tests/e2e/course-import-pipeline.spec.ts` (end-to-end re-import scenario)

**Approach:**
- Before persisting a `ScannedVideo`, check if a record with the same `courseId` + `serverUrl` (or `path` for local imports) already exists in the `importedVideos` table
- If exists: update the existing record's metadata (`filename`, `moduleTitle`, `serverUrl`) in place via `db.importedVideos.put(id, updatedRecord)` — preserves the original `id` so references (progress, notes) remain intact
- If not exists: create new record as before
- Apply the same upsert pattern to `importedPdfs` and `videoCaptions`
- Use a unique key of `(courseId, serverUrl)` for server imports and `(courseId, path)` for local imports to determine "same lesson"
- On re-import, orphaned records (files that existed in the old import but not in the new one) should be pruned: after persisting all scanned items, delete any `importedVideos`/`importedPdfs`/`videoCaptions` for this `courseId` whose IDs were NOT in the current scan set

**Patterns to follow:**
- Dexie's `put()` for upsert (overwrites if key exists, inserts if not)
- Existing `syncableWrite` wrapper for atomicity

**Test scenarios:**
- Happy path: Import course once → 74 videos, 26 PDFs, 74 captions. Re-import same course URL → still 74 videos, 26 PDFs, 74 captions. No duplicates.
- Happy path: Re-import after adding a new video to the server folder → new video appears, old videos update in place
- Edge case: Re-import after server folder content changes (videos added, removed, renamed) → final state matches current server content, no orphaned records
- Integration: Progress data preserved after re-import (existing video IDs survive)

**Verification:**
- `db.importedVideos.where('courseId').equals(id).count()` unchanged after re-import
- `db.importedPdfs.where('courseId').equals(id).count()` unchanged after re-import
- No orphaned `videoCaptions` records after re-import

---

### Phase 4: Integration & Polish

- [ ] **Unit 9: End-to-end integration test and validation**

**Goal:** Verify the complete fixed pipeline against the Linux Administration course and prevent regressions.

**Requirements:** R-FIX5, R-FIX7

**Dependencies:** Units 1-8 (new E2E spec)
- Modify: `src/lib/__tests__/courseServerImport.test.ts` (integration cases)

**Approach:**
- Write an E2E test that imports the Linux Administration course from the test server and verifies:
  - 74 video lessons present
  - 16 sections visible in sidebar
  - 26 PDFs present (as materials, not standalone)
  - 74 SRT captions stored
  - Correct section ordering (01-16)
- Run existing test suite to confirm no regressions:
  - `src/lib/__tests__/courseImport.test.ts`
  - `src/lib/__tests__/scanAndPersist.test.ts`
  - `src/lib/__tests__/courseServerImport.test.ts`
  - `src/lib/__tests__/curriculumGrouping.test.ts`
  - `src/lib/__tests__/lessonBasedCurriculum.test.ts`
  - `src/lib/__tests__/lessonMaterialMatcher.test.ts`
- Run `npm run build`, `npx tsc --noEmit`, `npm run lint`

**Test scenarios:**
- Integration: Full pipeline — scan server folder → persist → read-back → verify counts match server
- Integration: Re-import same course → no duplicates, existing records updated
- Regression: Local filesystem import unchanged
- Regression: Single URL import via ImportWizardDialog unchanged
- Regression: All existing import E2E tests pass

**Verification:**
- Linux Administration course imports with 74 videos, 16 sections, 26 PDFs, 74 captions
- `npm run ci` passes (build + typecheck + lint + format:check + test:unit)

## System-Wide Impact

- **Interaction graph:** `scanCourseFolderFromServer` → `persistScannedCourse` → `buildLessonBasedCurriculum` → `LessonsTab` sidebar. The path fix at the scan level flows automatically through all downstream consumers because they all read the `path` field.
- **Error propagation:** Server scan failures (CORS, network, non-nginx) already surface via `ServerResult<T>` discriminated unions. The new `listServerSubDirectories` follows the same pattern.
- **State lifecycle risks:** Partial import (interrupted mid-import) already handled by `syncableWrite` per-record atomicity. The `truncated` flag on `ScannedCourse` already signals cap hits. New material classification is post-scan (happens after all files collected), so partial scans don't produce inconsistent material associations.
- **API surface parity:** The `ScannedVideo` interface gains `moduleTitle?: string`. The `ScannedPdf` interface gains `materialOf?: string`. The `ScannedCourse` interface gains `captions?: ScannedCaption[]`. These are additive optional fields — existing callers that don't read them compile and behave identically.
- **Integration coverage:** The critical cross-layer scenario is server-scan → persist → read-back → render. Unit 8 provides an integration test for this path.
- **Unchanged invariants:** Local filesystem import (`scanCourseFolder`, `scanCourseFolderFromHandle`, `scanFromDroppedFiles`) path derivation unchanged. Manifest-based ordering (`applyManifestVideoOrder`) unchanged — manifest wins when present. YouTube import path unchanged. The `ScannedCourse` interface shape is backward-compatible (only additive optional fields).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Path normalization change breaks existing server-imported courses | Paths are only changed during new imports. Existing courses keep their broken paths — users must re-import. Release note will document this. |
| SRT files are large (74 SRTs ≈ several MB) | Store as text in IndexedDB (SRT files are plain text, typically 1-5 KB each). 74 × 3 KB ≈ 220 KB — negligible. |
| Material classification false positives (legitimate PDFs misclassified as materials) | The `isMaterialFilename` function has been validated by the existing `lessonMaterialMatcher` tests. False positives are rare because the detection relies on explicit keywords in stems. PDFs with numeric prefixes matching videos are always primary unless explicitly flagged as material. |
| Dialog redesign breaks existing import flows | Card-based layout is already the pattern in BulkImportDialog. ImportWizardDialog change is additive (adding URL as a card, not removing existing functionality). |
| `buildLessonBasedCurriculum` may not handle `moduleTitle` from scans | The function already groups by folder path via `getSectionName`. Adding `moduleTitle` as a fallback section identifier when the path segment is insufficient is a complementary enhancement, not a dependency. |

## Documentation / Operational Notes

- **Release note**: Users with courses imported from a server before this fix must delete and re-import those courses. The "Re-import" button (if available) or manual delete+import will produce correct results.
- **No database migration needed**: The `ImportedVideo.moduleTitle` field already exists. The path field format changes but existing courses are not auto-migrated.
- **Design review**: After Unit 7, run `/design-review` for comprehensive design QA on the redesigned import dialogs.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-28-course-import-experience-requirements.md](../brainstorms/2026-06-28-course-import-experience-requirements.md)
- Related solutions:
  - `docs/solutions/developer-experience/implementation-lessons-url-batch-import-2026-06-28.md`
  - `docs/solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md`
  - `docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md`
  - `docs/solutions/ui-bugs/lesson-badge-local-global-index-mismatch-2026-05-04.md`
  - `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md`
- Key files: `src/lib/courseImport.ts`, `src/lib/courseServerService.ts`, `src/lib/lessonBasedCurriculum.ts`, `src/lib/lessonMaterialMatcher.ts`, `src/data/types.ts`
