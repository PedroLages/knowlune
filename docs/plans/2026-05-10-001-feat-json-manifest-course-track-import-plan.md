---
title: "feat: Add JSON manifest support for course and track import"
type: feat
status: active
date: 2026-05-10
deepened: 2026-05-10
---

# feat: Add JSON manifest support for course and track import

## Overview

Add support for `course-manifest.json` files that users place inside their course folders. When Knowlune imports a course folder, it detects the manifest and uses it to pre-fill metadata (name, description, author, tags, difficulty, category), define module/lesson structure with custom display names, map lessons to video files, and optionally assign the course to a learning track. A parent-level `track-manifest.json` enables batch-importing multiple courses into a track in one operation.

## Problem Frame

Today's import wizard requires manual entry for every piece of metadata: course name defaults to the folder name, there is no description, tags come from AI suggestions (which may be unavailable), and author detection relies on folder-name heuristics ("Author - Course Title"). Video files are ordered alphabetically by filename with no way to define named modules or chapters.

Power users who maintain organized course folders want a declarative way to describe their courses. They want to write a JSON file once, place it in the folder, and have Knowlune read it during import — no manual metadata entry, no re-typing author names, no guessing video order.

The same users often have multiple related courses they want to assemble into a track. A parent-level manifest lets them define an entire track structure (courses + their order) in one file, then batch-import everything.

## Requirements Trace

### Per-Course Manifest

- **R1.** Knowlune detects a `course-manifest.json` file in the root of a folder selected for import.
- **R2.** The manifest pre-fills course metadata: `name`, `description`, `tags`, `difficulty`, `category`, and `author` (matched or created automatically).
- **R3.** The manifest can define module/lesson structure: named modules containing named lessons, each lesson mapped to a video file by filename.
- **R4.** Videos are ordered according to the manifest's module → lesson sequence (flat ordering when no modules are defined).

### Import Wizard Integration

- **R5.** The import wizard shows a "Manifest detected" confirmation in Step 2, displaying pre-filled fields and allowing the user to override any value.

### Batch Track Import

- **R6.** A `track-manifest.json` in a parent directory defines a track (name, description) and lists the course folders it contains, enabling batch import.
- **R7.** During batch import, each course folder is scanned, manifest data applied, and courses are added to the track in the specified order.

### Cross-Cutting

- **R8.** Invalid or missing manifest files degrade gracefully — the import proceeds with the existing manual flow.
- **R9.** The manifest format is versioned so future schema changes can be detected and migrated.
- **R10.** All manifest-driven imports respect existing syncableWrite patterns and do not bypass store persistence.

## Scope Boundaries

- No changes to how YouTube imports work — manifests apply only to local folder imports.
- No changes to the existing AI suggestion pipeline — manifest data replaces or supplements AI suggestions at the user's discretion.
- No new Dexie tables for module/lesson hierarchy — module structure is stored on `ImportedVideo` records (via new optional fields).
- No retroactive manifest support — manifests only apply during import, not to already-imported courses.
- No manifest-driven cover image selection beyond referencing a filename already picked up by the image scan.
- No validation of manifest lesson filenames against actual folder contents at parse time — matching is best-effort at import time.

### Deferred to Separate Tasks

- **Template marketplace with manifest-driven templates**: A gallery where users share manifest-based course templates. Separate feature.
- **Export course as manifest**: Generating a `course-manifest.json` from an already-imported course for sharing or backup. Separate feature.
- **Manifest editor UI**: An in-app editor for creating/editing manifest files. Users currently edit JSON in their text editor.

## Context & Research

### Relevant Code and Patterns

- **Folder scan**: `src/lib/courseImport.ts` `scanCourseFolder()` (line 138) — scans folder for videos/PDFs, builds `ScannedCourse`. This is where manifest detection plugs in.
- **ScannedCourse type**: `src/lib/courseImport.ts` line 110 — carries `id`, `name`, `scannedAt`, `directoryHandle`, `videos`, `pdfs`, `images`. Will be extended with optional `manifestData`.
- **File scanner**: `src/lib/fileSystem.ts` `scanDirectory()` (line 52) — async generator yielding `{ handle, path }` for supported files. Does not currently yield `.json` files. The manifest should be read via a direct `dirHandle.getFileHandle('course-manifest.json')` call rather than through this generator.
- **Import wizard**: `src/app/components/figma/ImportWizardDialog.tsx` (line 122) — 3-step wizard (select → details → path). Step 2 state variables (`courseName`, `description`, `tags`, `selectedCoverImage`) are the pre-fill targets.
- **Persistence**: `src/lib/courseImport.ts` `persistScannedCourse()` (line 358) — accepts `overrides` for name, description, tags, category, coverImageHandle, authorId. Manifest data flows through this override mechanism.
- **Author detection**: `src/lib/authorDetection.ts` `matchOrCreateAuthor()` (line 63) — case-insensitive author lookup/creation. Manifest author name is passed through this function.
- **ImportedVideo type**: `src/data/types.ts` line 203 — flat video record with `filename`, `path`, `order`, `duration`. New optional fields `title` and `moduleTitle` will carry manifest-derived display names and grouping.
- **CurriculumComposer**: `src/app/components/figma/CurriculumComposer.tsx` — track creation dialog. Exports `COURSE_IMPORTED` custom event for import round-trip. The `batchAddCoursesToPath` pattern is relevant for parent-level manifest batch import.
- **ImportWizardDialog singleton guard**: Module-level `wizardOpenCount` counter + `isImportWizardOpen()` + `IMPORT_WIZARD_SET_TARGET` custom event — documented in `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md`.
- **Learning track pages**: `src/app/pages/LearningTracks.tsx` (listing) and `src/app/pages/LearningTrackDetail.tsx` (detail) — built in plan `2026-05-09-001-feat-learning-tracks-pages-plan.md`. Both pages render `ImportWizardDialog` and `CurriculumComposer`.

### Institutional Learnings

- **Read manifest during scan, not after** (`docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`): The `ScannedCourse` is built at the end of `scanCourseFolder()`. Read the manifest there so it can pre-fill metadata before the wizard displays it.
- **Direct file read, not scanner extension** (`docs/solutions/ui-bugs/course-import-cover-image-shows-subdirectory-images-2026-04-30.md`): `scanDirectory()` only yields video/image files. Adding `.json` as a supported format would change its contract. Instead, read `course-manifest.json` directly via `dirHandle.getFileHandle()` — simpler and more targeted.
- **Author via `matchOrCreateAuthor`** (`docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md`): Do not create author records directly from manifest data. Pass the manifest author name through the existing `matchOrCreateAuthor()` function for case-insensitive dedup.
- **Store mutations must go through store methods** (`docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md`): Direct property assignment on Zustand state bypasses `syncableWrite`. All manifest-driven updates must use store methods.
- **Batch operations accept partial failure** (`docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`): `syncableWrite` has no batch API. Batch imports iterate sequentially; each course records success/failure individually.
- **Singleton wizard guard** (`docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md`): Already implemented. Parent-level manifest import should reuse the existing wizard singleton, not create a parallel mechanism.

### External References

None required. The codebase has strong local patterns for all changes: the scan → wizard → persist pipeline, author detection, store persistence, and the curriculum composer's batch-add patterns. No external APIs or new libraries are needed.

## Key Technical Decisions

- **Per-course manifest filename: `course-manifest.json`**: Placed in the root of a course folder. Read during `scanCourseFolder()` via a direct `getFileHandle()` call, not through the media scanner.
- **Parent-level manifest filename: `track-manifest.json`**: Placed in a parent directory containing course subdirectories. Defines a track and lists the course folders it contains.
- **Manifest versioning**: A required `"version": "1.0"` field at the root. Future schema changes increment the version; the parser rejects unknown versions with a clear error message.
- **Manifest data flows through existing override mechanism**: `ScannedCourse` gains an optional `manifestData` field. The wizard reads it to pre-fill state variables. Metadata overrides (name, description, tags, difficulty, category, author) flow through `persistScannedCourse()`'s existing `overrides` parameter. The module/lesson mapping reads `scanned.manifestData` directly inside `persistScannedCourse()` (the one new data path, documented in Unit 4).
- **Module/lesson names stored on `ImportedVideo`**: Two new optional fields — `title?: string` and `moduleTitle?: string`. When a manifest defines named lessons, `title` is set to the manifest lesson name. `moduleTitle` groups videos into modules at display time. This avoids new Dexie tables while supporting the hierarchical structure the manifest defines.
- **Best-effort filename matching**: Manifest lessons specify a `filename` field. During import, each video's `filename` is matched against manifest lessons. Matched videos get the manifest's title, module, and order. Unmatched videos are appended after matched ones in alphabetical order. Unmatched manifest lessons (no video file found) are logged as warnings but don't block import.
- **Parent-level manifest batch flow**: A new UI entry point — "Import Track" button on the learning tracks page — opens a folder picker for the parent directory. The wizard scans for `track-manifest.json`, then iterates through listed course subdirectories, scanning and importing each one. The track is created (or matched by name if it exists) and all courses are added to it.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### JSON Manifest Schema

**Per-course manifest (`course-manifest.json`):**

```jsonc
{
  "version": "1.0",
  "course": {
    "name": "Advanced Behavioral Design",
    "description": "A comprehensive course on behavioral design patterns...",
    "category": "behavioral-analysis",
    "difficulty": "advanced",
    "tags": ["psychology", "design", "ux"],
    "author": {
      "name": "Dr. Sarah Chen",
      "title": "Behavioral Psychologist",
      "bio": "15 years of experience in behavioral design...",
      "avatar": "sarah-chen.jpg"
    },
    // Optional: flat lesson list (when no module hierarchy needed)
    "lessons": [
      { "title": "Introduction", "filename": "01-intro.mp4" },
      { "title": "Core Principles", "filename": "02-principles.mp4" }
    ],
    // Optional: hierarchical modules (takes precedence over flat lessons)
    "modules": [
      {
        "title": "Module 1: Foundations",
        "description": "Core concepts and terminology",
        "lessons": [
          { "title": "Welcome & Overview", "filename": "01-welcome.mp4", "description": "Course introduction and roadmap" },
          { "title": "Key Concepts", "filename": "02-concepts.mp4" }
        ]
      },
      {
        "title": "Module 2: Application",
        "lessons": [
          { "title": "Case Study: E-commerce", "filename": "03-ecommerce.mp4" },
          { "title": "Case Study: Healthcare", "filename": "04-healthcare.mp4" }
        ]
      }
    ],
    // Optional: track assignment (auto-add to track after import)
    "track": {
      "name": "Behavioral Design Mastery",
      "position": 1
    },
    // Optional: cover image reference
    "coverImage": "cover.png"
  }
}
```

**Parent-level track manifest (`track-manifest.json`):**

```jsonc
{
  "version": "1.0",
  "track": {
    "name": "Behavioral Design Mastery",
    "description": "Master behavioral design from foundations to advanced applications.",
    "difficulty": "advanced",
    "courses": [
      { "folder": "01-foundations", "position": 1 },
      { "folder": "02-advanced-patterns", "position": 2 },
      { "folder": "03-capstone-project", "position": 3 }
    ]
  }
}
```

The `folder` field must be a single directory name (no path separators like `/`). The File System Access API's `getDirectoryHandle(name)` throws `TypeError` on names containing `/`. Nested paths are not supported in v1.0 — if needed, the implementer can add recursive directory resolution later.

Each course folder listed in the track manifest can optionally contain its own `course-manifest.json` for per-course metadata. If absent, course metadata is derived from the folder scan as usual.

**Conflict resolution during batch import:** When a per-course manifest's `track` field and the parent-level `track-manifest.json` both specify track assignment, the parent-level manifest wins. All courses in the batch go into the parent's track, the per-course `track` field is ignored during batch import, and the parent manifest's `courses[].position` takes precedence. The `persistScannedCourse()` call during batch import suppresses per-course track assignment by not passing the manifest's `track` field when a parent manifest context is active.

**Store position limitation:** The current `createPathWithCourses()` and `batchAddCoursesToPath()` methods auto-assign sequential positions and do not accept explicit position overrides. During implementation, either (a) extend these methods with an optional `positions` parameter, or (b) add courses first, then call `reorderCourse()` for each course to set the manifest-specified positions via a post-creation reorder pass. Option (a) is preferred if the store method signature change is clean; option (b) is the fallback.

### Data Flow

```
scanCourseFolder()
  ├── Scan for videos, PDFs, images (existing)
  ├── Read course-manifest.json via getFileHandle()
  │     ├── Parse JSON → validate against schema
  │     ├── On success: attach ManifestData to ScannedCourse
  │     └── On failure (missing, invalid): ScannedCourse.manifestData = undefined
  └── Return ScannedCourse (with optional manifestData)
        ↓
ImportWizardDialog (Step 2)
  ├── If manifestData exists: pre-fill courseName, description, tags, difficulty
  ├── Show "Manifest detected" badge/banner
  ├── User can override any pre-filled field
  └── On "Import": pass overrides to persistScannedCourse()
        ↓
persistScannedCourse(scanned, overrides)
  ├── Apply manifest lesson titles/modules to ImportedVideo records
  ├── Match manifest author via matchOrCreateAuthor()
  ├── Apply manifest coverImage filename → match against scanned.images
  └── If manifest.track specified:
        ├── Match or create track by name via useLearningPathStore
        └── Add course to track at specified position
```

### Parent-Level Manifest Batch Flow

```
LearningTracks page
  └── "Import Track" button
        ↓
Folder picker (parent directory)
  ├── Scan for track-manifest.json
  ├── Parse and validate
  ├── Show confirmation: track name, course list
        ↓
For each course folder (sequential):
  ├── scanCourseFolder(courseSubdirectory)
  ├── Apply per-course manifest (if present in subdirectory)
  ├── persistScannedCourse(subdirScanned, overrides)
  └── Dispatch COURSE_IMPORTED event
        ↓
Create track (or match existing by name)
  └── batchAddCoursesToPath(trackId, courseIds)
        └── Post-creation reorder via reorderCourse() for manifest-specified positions
             (or extend store with positions param — see Store position limitation below)
        ↓
Navigate to track detail page
```

## Implementation Units

- [x] **Unit 1: Manifest schema types and validation**

**Goal:** Define TypeScript types for both manifest formats and a validation function that parses raw JSON into typed manifest data with clear error reporting.

**Requirements:** R1, R9

**Dependencies:** None

**Files:**
- Create: `src/lib/courseManifest.ts`
- Test: `src/lib/__tests__/courseManifest.test.ts`

**Approach:**
- Define `CourseManifest` interface matching the per-course JSON schema (version, course name, description, category, difficulty, tags, author, lessons, modules, track, coverImage).
- Define `TrackManifest` interface matching the parent-level JSON schema (version, track name, description, courses array with folder + position).
- Export a `parseCourseManifest(json: unknown): ParseResult<CourseManifest>` function that:
  - Checks `version` is `"1.0"` (rejects unknown versions with a specific error code).
  - Validates required fields (`course.name` at minimum).
  - Validates `difficulty` against the `Difficulty` union type.
  - Validates `category` against known `CourseCategory` values.
  - Normalizes optional fields (empty arrays for missing `tags`/`lessons`/`modules`, undefined for missing optional strings).
  - Returns a discriminated union: `{ ok: true, manifest: CourseManifest }` | `{ ok: false, errors: ManifestError[] }`.
- Export a `parseTrackManifest(json: unknown): ParseResult<TrackManifest>` with similar validation.
- Export a `ManifestError` type with `path` (JSON path to the error) and `message` for clear user-facing error reporting.
- The module is pure TypeScript — no React, no Dexie, no browser APIs. This keeps it independently testable.

**Patterns to follow:**
- Discriminated union pattern from `src/lib/sync/` (result types).
- Validation style from `src/lib/courseImport.ts` `ImportError` class.

**Test scenarios:**
- Happy path: Valid course manifest with all fields parses successfully, all optional fields present.
- Happy path: Minimal manifest (version + course.name only) parses with defaults for all optional fields.
- Happy path: Manifest with modules (no flat lessons) — modules array populated, lessons array empty.
- Happy path: Track manifest with 3 course folders parses successfully.
- Edge case: Unknown version string → `ok: false` with clear error about supported versions.
- Edge case: Invalid difficulty value → `ok: false` with path pointing to `course.difficulty`.
- Edge case: Missing `course.name` → `ok: false` with path pointing to `course.name`.
- Edge case: Empty modules array in course manifest → valid, treated as no module structure.
- Error path: Malformed JSON (not an object, array, or null) → `ok: false`.
- Error path: Valid JSON that doesn't match the schema shape → specific field-level errors.

**Verification:**
- Unit tests pass for all parse scenarios.
- `courseManifest.ts` has no imports from React, Dexie, or browser APIs.

---

- [x] **Unit 2: Manifest detection in folder scan**

**Goal:** Extend `scanCourseFolder()` and `scanFromDroppedFiles()` to detect and read `course-manifest.json` during the scan phase, parse it, and attach the result to `ScannedCourse`.

**Requirements:** R1, R8

**Dependencies:** Unit 1 (manifest types and parser)

**Files:**
- Modify: `src/lib/courseImport.ts`
- Modify: `src/lib/fileSystem.ts` (if needed to read a specific file by name from a directory handle)
- Test: `src/lib/__tests__/courseManifest.test.ts` (extend with integration scenarios)

**Approach:**
- Add optional `manifestData?: CourseManifest` to the `ScannedCourse` interface.
- In `scanCourseFolder()`, after the duplicate check and before the recursive scan, attempt to read `course-manifest.json` from the directory handle:
  ```ts
  try {
    const fileHandle = await dirHandle.getFileHandle('course-manifest.json')
    const file = await fileHandle.getFile()
    const text = await file.text()
    const json = JSON.parse(text)
    const result = parseCourseManifest(json)
    if (result.ok) manifestData = result.manifest
    else console.warn('[scanCourseFolder] Manifest parse errors:', result.errors)
  } catch (err) {
    // File not found or can't read — silently continue (manifest is optional)
    if (err instanceof DOMException && err.name === 'NotFoundError') { /* no manifest */ }
    else console.warn('[scanCourseFolder] Failed to read manifest:', err)
  }
  ```
- Attach `manifestData` to the returned `ScannedCourse`.
- In `scanFromDroppedFiles()`, manifest detection works differently: the function receives `File[]` and has a null `directoryHandle`. Instead of `getFileHandle`, scan the `File[]` array for an entry named `course-manifest.json` and parse its text content via `file.text()`. Apply the same parse + attach pattern used in `scanCourseFolder()`.
- If the manifest parses successfully but the `course.name` differs from the folder name, keep the manifest name — it takes precedence (the wizard pre-fills from it).
- If parsing fails, `manifestData` stays `undefined` and the import proceeds normally (R8: graceful degradation).

**Execution note:** The manifest read is a single `getFileHandle` + `getFile` + `text()` call on the root directory — not a recursive scan. This keeps it fast and avoids changing `scanDirectory()`'s contract.

**Patterns to follow:**
- Existing error handling in `scanCourseFolder()` — `ImportError` for blocking errors, `console.warn` for non-blocking.
- `dirHandle.getFileHandle()` usage already exists in the codebase for image file access.

**Test scenarios:**
- Happy path: Folder with `course-manifest.json` → `ScannedCourse.manifestData` is populated with parsed manifest.
- Happy path: Folder without `course-manifest.json` → `ScannedCourse.manifestData` is `undefined`, scan proceeds normally.
- Edge case: Manifest has parse errors → `manifestData` is `undefined`, warning logged, scan proceeds.
- Edge case: Manifest file exists but is empty → JSON.parse throws, caught, `manifestData` undefined.
- Error path: Manifest file exists but can't be read (permission) → caught, warning logged, scan proceeds.
- Integration: `scanFromDroppedFiles()` with a dropped folder containing a manifest → same behavior as `scanCourseFolder()`.

**Verification:**
- Import a folder with a valid manifest → wizard Step 2 shows pre-filled metadata (tested in Unit 3).
- Import a folder without a manifest → wizard behaves exactly as before (no regression).
- Import a folder with an invalid manifest → import proceeds with manual entry (graceful degradation).

---

- [x] **Unit 3: Import wizard manifest integration**

**Goal:** When a `ScannedCourse` carries manifest data, pre-fill the wizard's Step 2 fields and show a "Manifest detected" confirmation. Pass manifest-derived values through to `persistScannedCourse()`.

**Requirements:** R2, R5, R8

**Dependencies:** Unit 2 (ScannedCourse must carry manifestData)

**Files:**
- Modify: `src/app/components/figma/ImportWizardDialog.tsx`
- Test: `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx`

**Approach:**
- After `scanCourseFolder()` resolves (in `handleSelectFolder` and the drag-drop handler), check `scannedCourse.manifestData`.
- If manifest data is present:
  - Pre-fill `courseName` from `manifest.course.name` (unless the user already typed something).
  - Pre-fill `description` from `manifest.course.description ?? ''`.
  - Pre-fill `tags` from `manifest.course.tags ?? []`.
  - Set `selectedDifficulty` from `manifest.course.difficulty` (new state variable — see below).
  - Set `selectedCategory` from `manifest.course.category` (if different from auto-detected).
  - If `manifest.course.coverImage` is specified, match against `scannedCourse.images` by filename and pre-select.
  - Store the full `manifestData` in a ref for metadata access in `handleImport()`. Note: the module/lesson structure from the manifest is read directly from `scanned.manifestData` inside `persistScannedCourse()` (Unit 4), not passed through the wizard ref.
- Add a `selectedDifficulty` state variable (`Difficulty | undefined`, default undefined) and a `selectedCategory` state variable (`string`, default auto-detected) to the wizard. These are new wizard fields that were previously only set post-import.
- In Step 2, when manifest data is present, show a banner above the form:
  ```
  [FileIcon] Manifest detected — fields pre-filled from course-manifest.json.
             You can edit any field below.
  ```
  Use `bg-brand-soft border border-brand/20` styling for the banner.
- Add `difficulty` and `category` UI controls to Step 2 (Select dropdowns) — these were previously absent from the wizard entirely. The difficulty Select shows the four `Difficulty` values; category Select shows the five `CourseCategory` values. Both are optional.
- On import (`handleImport`), extend the `overrides` object passed to `persistScannedCourse()`:
  - Include `difficulty: selectedDifficulty` (new override field — `persistScannedCourse` must map this onto the `ImportedCourse.difficulty` field, which already exists on the type but is not currently set by the function).
  - Include author name from `manifestData.course.author?.name` — passed as a new `authorName` override that `persistScannedCourse` resolves via `matchOrCreateAuthor`.
  - If `authorName` is provided in overrides, the existing `authorId` override is ignored — `persistScannedCourse` resolves the name instead of using a pre-resolved ID.
- This unit only handles the metadata pre-fill. The module/lesson structure from the manifest is read directly by `persistScannedCourse()` from `scanned.manifestData` — see Unit 4.

**Execution note:** The `difficulty` and `category` Select dropdowns are new wizard UI. Keep them simple — single Select components matching the existing tag input pattern. The `category` auto-detection from E22-S04 still runs; the manifest value is the default, but the user can override.

**Patterns to follow:**
- Existing wizard state pattern: `const [courseName, setCourseName] = useState('')` at line 125.
- Existing `tags` state management (add/remove tag).
- Existing `overrides` construction at lines 419-427.
- `Select` component usage from `src/app/components/ui/select.tsx` (already used in wizard for path selection).

**Test scenarios:**
- Happy path: Import folder with valid manifest → Step 2 shows pre-filled name, description, tags, difficulty, category. "Manifest detected" banner visible.
- Happy path: User edits a pre-filled field → user's value takes precedence on import.
- Happy path: Manifest without optional fields → only present fields are pre-filled, others remain empty.
- Happy path: Import folder without manifest → Step 2 behaves exactly as before (no banner, no pre-fill beyond folder name).
- Edge case: Manifest specifies a cover image filename not found in scanned images → no cover pre-selected, no error.
- Edge case: User clears a pre-filled field → empty value is passed to `persistScannedCourse`.
- Error path: Manifest JSON is valid but has no `course.name` → should not happen (parser rejects this in Unit 1), but if it does, fall back to folder name.

**Verification:**
- Open import wizard with a manifest-equipped folder → Step 2 fields are pre-filled.
- Banner text is visible and styled correctly.
- Override edits are respected.
- Regression: importing without a manifest works identically to before.

---

- [x] **Unit 4: Module/lesson structure from manifest**

**Goal:** When a manifest defines `lessons` or `modules`, match them against scanned videos by filename, set video `title` and `moduleTitle` fields, and order videos according to the manifest structure during persistence.

**Requirements:** R3, R4

**Dependencies:** Unit 2 (manifest data on ScannedCourse). Note: does NOT depend on Unit 3 — manifest lesson data is read from `scanned.manifestData` (set by Unit 2 during scan), not from wizard state.

**Files:**
- Modify: `src/lib/courseImport.ts` (`persistScannedCourse` — apply manifest lesson mapping before building ImportedVideo records)
- Modify: `src/data/types.ts` (add optional `title` and `moduleTitle` to `ImportedVideo`)
- Modify: `src/db/schema.ts` (verify Dexie auto-migrates for new non-indexed fields — no version bump needed)
- Test: `src/lib/__tests__/courseManifest.test.ts` (extend with filename matching)
- Test: `src/lib/__tests__/courseImport.test.ts` (extend if exists)

**Approach:**
- Add optional fields to `ImportedVideo` in `src/data/types.ts`:
  ```ts
  export interface ImportedVideo {
    // ... existing fields ...
    title?: string        // Display title from manifest (falls back to filename-derived)
    moduleTitle?: string  // Module grouping key from manifest
  }
  ```
- In `persistScannedCourse()`, if `scanned.manifestData` has `modules` or `lessons` (see normalisation note below):
  - Flatten the module/lesson structure into an ordered list of `{ filename, title, moduleTitle, order }`.
  - For each scanned video, look up its `filename` in the flattened list.
  - If matched: set `title` to the manifest lesson name, `moduleTitle` to the manifest module name, and `order` to the manifest position.
  - If unmatched: append at the end with `title` derived from filename (existing behavior), `moduleTitle` undefined, and `order` after the last manifest position.
  - If a manifest lesson has no matching video: log a warning and skip it.
- The `ImportedVideo` records are built with `title` and `moduleTitle` set accordingly before being written via `syncableWrite`.
- Dexie 4 auto-detects new non-indexed fields on existing tables — no explicit migration needed for optional string fields. Verify with `npm run build` that no schema mismatch error occurs (the actual schema is at `src/db/schema.ts`, not a non-existent `src/db.ts`).
- **Display components:** All consumers that derive display titles from `video.filename` must be updated to use `video.title ?? deriveTitleFromFilename(video.filename)`. Affected components include `PathTimeline`'s `LessonRow`, `CourseOverview`'s curriculum section, and `LessonList`. Where possible, extract a shared `getVideoDisplayTitle(video: ImportedVideo): string` utility to centralize the fallback.
- **Manifest lesson normalisation:** The parser normalises both representations at parse time: when `lessons` is present (flat list), it is wrapped into `modules: [{ title: "", lessons }]` internally. When `modules` is present, it is used directly. When both are present, `modules` takes precedence and `lessons` is ignored. This means `persistScannedCourse` always sees `modules` — no branching.

**Patterns to follow:**
- Existing video ordering in `persistScannedCourse()` (lines 359-393) — videos are sorted by filename then assigned sequential `order`. The manifest order overrides this.
- Existing `overrides` parameter pattern — extend to accept `manifestModules` or read from `scanned.manifestData` directly.

**Test scenarios:**
- Happy path: Manifest with 3 flat lessons, folder has 3 matching videos → videos are ordered 1, 2, 3 with manifest titles.
- Happy path: Manifest with 2 modules, 2 lessons each → videos have correct `moduleTitle` and `title`, ordered 1-4.
- Happy path: Folder has extra video not in manifest → appended after manifest-ordered videos with filename-derived title.
- Edge case: Manifest lesson has no matching video file → warning logged, lesson skipped, remaining videos keep contiguous order.
- Edge case: Video filename matches by basename only (ignore path prefix) → e.g., manifest says `"intro.mp4"`, video is at `subdir/intro.mp4` → should match.
- Edge case: Multiple videos match the same manifest lesson filename → first match wins, rest treated as unmatched (appended).
- Edge case: Manifest with modules but no lessons within a module → that module is skipped (no videos to place).
- Regression: Import without manifest → videos ordered by filename as before, `title` and `moduleTitle` are undefined.

**Verification:**
- Import course with manifest defining modules → videos in Dexie have correct `title`, `moduleTitle`, and `order`.
- Learning track detail page displays manifest-defined lesson titles in the syllabus (PathTimeline).
- Course overview page shows manifest-defined module grouping.

---

- [x] **Unit 5: Parent-level manifest batch import**

**Goal:** Add an "Import Track" entry point that reads a `track-manifest.json` from a parent directory, scans each listed course subdirectory, imports all courses, and creates a track with the courses in order.

**Requirements:** R6, R7, R10

**Dependencies:** Units 2-4 (per-course manifest support must work; batch import calls the same scan + persist functions). Note: does NOT depend on Unit 3 — the batch flow calls `scanCourseFolder` and `persistScannedCourse` directly and uses its own confirmation dialog, not the ImportWizardDialog.

**Files:**
- Create: `src/lib/trackManifestImport.ts` (batch import orchestrator)
- Modify: `src/app/pages/LearningTracks.tsx` (add "Import Track" button)
- Test: `tests/e2e/learning-tracks.spec.ts` (extend with manifest import flow)

**Approach:**
- Create a `src/lib/trackManifestImport.ts` module exporting `importTrackFromManifest(parentDirHandle: FileSystemDirectoryHandle): Promise<ImportTrackResult>`:
  1. Read `track-manifest.json` from the parent directory (same pattern as Unit 2).
  2. Parse with `parseTrackManifest()` from Unit 1.
  3. Return a summary for the confirmation step: track name, description, course folders listed.
  4. The caller (wizard or page) shows confirmation, then calls the batch import function.
- Create a `batchImportTrackCourses(parentDirHandle, manifest): Promise<BatchImportResult>` function:
  1. For each course entry in `manifest.track.courses`:
     - Get the subdirectory handle: `parentDirHandle.getDirectoryHandle(entry.folder)`.
     - Scan the subdirectory (reuse `scanCourseFolderFromHandle()` or similar — may need to expose an internal scan variant that takes a handle instead of calling `showDirectoryPicker()`).
     - If the subdirectory has its own `course-manifest.json`, apply it (already handled by Unit 2's scan extension).
     - Call `persistScannedCourse()` for each course.
     - Track success/failure per course (partial failure is acceptable — R10 guidance from institutional learnings).
  2. After all courses are imported: create the track via `useLearningPathStore.getState().createPathWithCourses()` with the collected course IDs and positions from the manifest.
  3. If a track with the same name already exists: add courses to the existing track (match-or-add behavior).
- Add "Import Track" button to `LearningTracks.tsx` page header, alongside "Create Track" and "Import Course":
  - Opens a folder picker for the parent directory.
  - Reads `track-manifest.json`, parses it, shows a confirmation dialog with track name and course list.
  - On confirm: runs `batchImportTrackCourses()` with progress indicators.
  - On completion: navigates to the new/existing track detail page.
  - On error: shows toast with per-course failure details.
- The confirmation dialog can be a simple `AlertDialog` or a lightweight custom dialog showing:
  - Track name and description
  - List of course folders to import
  - "Import N Courses" confirm button

**Execution note:** The scan-for-handle variant (`scanCourseFolderFromHandle`) already exists at `src/lib/courseImport.ts` line 596. Verify its signature accepts a `FileSystemDirectoryHandle` and returns `ScannedCourse`. If it requires `showDirectoryPicker` internally, extract the scan logic into a shared function that both entry points call.

**Patterns to follow:**
- `persistScannedCourse()` existing error handling — per-course try/catch, collect results.
- `CurriculumComposer`'s `batchAddCoursesToPath` pattern — sequential iteration, Zustand state reads.
- `ImportWizardDialog`'s progress tracking via `useImportProgressStore`.
- `LearningTracks.tsx` existing button layout (Create Track + Import Course + Search).

**Test scenarios:**
- Happy path: Parent folder with `track-manifest.json` + 3 course subdirectories each with videos → all 3 courses imported, track created with courses in order, navigated to track detail.
- Happy path: Course subdirectories each have their own `course-manifest.json` → per-course metadata applied on top of track manifest.
- Happy path: Track name matches existing track → courses added to existing track (no duplicate track created).
- Edge case: One course subdirectory is empty or missing → that course skipped, warning shown, remaining courses imported.
- Edge case: Course subdirectory produces a duplicate (same folder name as already-imported course) → skipped with warning, not blocking. Track is still created with successfully imported courses.
- Edge case: `track-manifest.json` is missing from selected folder → error shown, user prompted to select a folder with a manifest.
- Edge case: Parent folder contains extra subdirectories not listed in manifest → ignored (only listed folders are imported).
- Error path: All course subdirectories fail to import → track is not created, error toast with details.
- Error path: Folder picker cancelled → no state changes.

**Verification:**
- "Import Track" button visible on `/learning-tracks` page.
- End-to-end flow: select parent folder → see confirmation → import → track created with courses.
- Partial failure handling: one bad subdirectory doesn't block the others.
- No regression on existing "Create Track" and "Import Course" buttons.

---

- [x] **Unit 6: Author creation and cover image from manifest**

**Goal:** When a manifest specifies author details or a cover image filename, resolve them during import — create/match the author and pre-select the cover image.

**Requirements:** R2

**Dependencies:** Unit 2 (manifest data available), Unit 3 (wizard passes manifest data through)

**Files:**
- Modify: `src/lib/courseImport.ts` (`persistScannedCourse` — add author name resolution from manifest)
- Modify: `src/app/components/figma/ImportWizardDialog.tsx` (cover image pre-selection logic)
- Modify: `src/lib/authorDetection.ts` (if needed — extend `matchOrCreateAuthor` to accept optional bio/title fields)
- Test: `src/lib/__tests__/courseImport.test.ts` (extend with manifest author scenarios)

**Approach:**
- **Author resolution in `persistScannedCourse()`:**
  - Add `authorName?: string` to the `overrides` parameter.
  - Add `authorTitle?: string` and `authorBio?: string` for extended author metadata from manifest.
  - When `authorName` is provided in overrides: call `matchOrCreateAuthor(authorName)`. If the manifest also provides `author.title` and `author.bio`, update the author record with those fields (only if the author was just created — don't overwrite existing author data).
  - The existing folder-name-based author detection still runs as fallback when `authorName` is not in overrides.
  - If the manifest specifies `author.avatar` (a filename referencing an image in the course folder), match it against `scanned.images` and set it as the author's avatar. This is a best-effort operation — failure to set the avatar doesn't block import.
- **Cover image pre-selection in wizard:**
  - After scan, if `manifestData.course.coverImage` is set: find an image in `scannedCourse.images` whose filename matches (case-insensitive comparison).
  - If found: set `selectedCoverImage` state to that image.
  - If not found: leave cover unselected (no error).
- **Extend `matchOrCreateAuthor`** signature to `(authorName: string | null, authorDetails?: { title?: string; bio?: string }): Promise<string | null>`. When creating a new author, spread `authorDetails` onto the author record. When matching an existing author, leave existing fields unchanged.

**Patterns to follow:**
- Existing `persistScannedCourse` author logic at lines 397-411.
- `matchOrCreateAuthor()` in `src/lib/authorDetection.ts` lines 37-94.
- Wizard cover image selection pattern at lines 788-878.

**Test scenarios:**
- Happy path: Manifest with full author details → new author created with name, title, bio. Course linked to author.
- Happy path: Manifest author name matches existing author → existing author used, title/bio not overwritten.
- Happy path: Manifest specifies cover image filename that exists in folder → image pre-selected in wizard Step 2.
- Edge case: Manifest author avatar filename not found in scanned images → author created without avatar, no error.
- Edge case: Manifest has author name but no title/bio → author created with just name.
- Edge case: Manifest cover image filename doesn't match any scanned image → cover not pre-selected.
- Integration: Full import with manifest author + cover → course in library shows correct author and cover.

**Verification:**
- Import with manifest author → author appears in Authors page, linked to the course.
- Cover image from manifest is pre-selected in wizard and saved with the course.

---

- [ ] **Unit 7: E2E and integration tests**

**Goal:** Add comprehensive tests covering manifest parsing, scan integration, wizard pre-fill, module ordering, author creation, and batch track import.

**Requirements:** R1-R10 (coverage across all requirements)

**Dependencies:** Units 1-6 (all features must be implemented)

**Files:**
- Create/Extend: `src/lib/__tests__/courseManifest.test.ts` (Unit 1)
- Extend: `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx` (Unit 3)
- Extend: `tests/e2e/learning-tracks.spec.ts` (Unit 5)
- Create: `tests/e2e/manifest-import.spec.ts`

**Approach:**
- **Unit tests for manifest parsing** (in `courseManifest.test.ts`):
  - Valid manifests of varying complexity (minimal, full, modules-only, lessons-only).
  - Invalid manifests (wrong version, missing name, bad difficulty, bad JSON).
  - Track manifest parsing (valid, invalid, missing courses).
- **Unit tests for wizard integration** (extend `ImportWizardDialog.test.tsx`):
  - Wizard receives `ScannedCourse` with `manifestData` → Step 2 fields pre-filled.
  - Wizard receives `ScannedCourse` without `manifestData` → normal behavior.
  - User overrides pre-filled fields → overrides respected.
- **E2E test for manifest import** (`manifest-import.spec.ts`):
  - Set up test fixtures: create temp folder structure with `course-manifest.json` and mock video files.
  - Test import flow: folder picker → wizard Step 2 shows pre-filled fields → import completes → course appears in library with correct metadata.
  - Test manifest with modules: import → verify lesson titles and order in course detail.
- **E2E test for track manifest** (extend `learning-tracks.spec.ts`):
  - Test "Import Track" flow with a parent folder containing `track-manifest.json` + course subdirectories.

**Patterns to follow:**
- Existing test patterns from `ImportWizardDialog.test.tsx` (store mocking, AI hook mocking).
- E2E patterns from `.claude/rules/testing/test-patterns.md` (deterministic time, IndexedDB seeding).
- File System Access API mocking strategy (already used in import tests).

**Test scenarios:**
- E2E: Import course folder with valid manifest → course name, description, author, and tags are correctly set after import.
- E2E: Import course folder without manifest → no regression (existing import flow works).
- E2E: Import course with module structure → lesson titles and order match manifest.
- E2E: Import track from parent manifest → all courses imported, track created, courses in correct order.
- E2E: Import track where one course folder is missing → partial success, error toast shown.

**Verification:**
- `npm run test:unit` passes (all manifest parsing and wizard integration tests).
- `npx playwright test tests/e2e/manifest-import.spec.ts` passes (Chromium).
- No flakiness in 3 consecutive E2E runs.

## System-Wide Impact

- **Interaction graph:** `scanCourseFolder()` gains a manifest read step. `ImportWizardDialog` gains difficulty/category UI controls. `persistScannedCourse()` gains author name, difficulty overrides, and video title/moduleTitle assignment. `LearningTracks` page gains an "Import Track" button. `ImportedVideo` gains two optional fields.
- **Error propagation:** Manifest parse failures are non-blocking — the import proceeds with manual entry. Batch import partial failures are collected and reported without blocking successful imports. Manifest-driven author creation failures don't block course import.
- **State lifecycle risks:** Manifest data is read once during scan and carried through the wizard in a ref. No persistent manifest state beyond what's stored on the imported course/video records. Batch import uses sequential `syncableWrite` calls (no transactions) — partial failure is handled per the established pattern.
- **API surface parity:** The `ScannedCourse` type gains one optional field (`manifestData`). The `ImportedVideo` type gains two optional fields (`title`, `moduleTitle`). The `persistScannedCourse` overrides gain `authorName`, `authorTitle`, `authorBio`, and `difficulty`. All additions are backward-compatible.
- **Integration coverage:** The manifest → wizard → persist pipeline must be tested end-to-end (Unit 7 E2E tests). Unit tests alone won't prove the full flow works because of File System Access API interactions.
- **Accessibility:** New UI elements (difficulty/category selects, manifest banner, Import Track button, batch confirmation dialog) must meet WCAG 2.1 AA+. The "Manifest detected" banner uses `role="status" aria-live="polite"` for screen reader announcement. Confirmation dialog follows AlertDialog pattern (focus trapping, Escape dismiss). All new form controls have visible labels. Import Track button placement must not cause horizontal overflow at 375px viewport — wrap into a dropdown if the header action bar exceeds available width.
- **Unchanged invariants:** The import wizard's 3-step structure is preserved. The `scanDirectory()` generator's contract does not change. Dexie table schemas are extended with optional fields only (no required new columns, no new tables). YouTube import flow is completely untouched. Sync engine (`syncableWrite`) behavior is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| File System Access API `getFileHandle` for `.json` files may have browser-specific quirks | The API is well-supported in Chromium-based browsers. `getFileHandle` is the same method already used for image files in the codebase. Add try/catch for `NotFoundError` and `NotAllowedError`. |
| Manifest schema evolves and existing manifests break | The `version` field gates parsing. Unknown versions produce a clear error. When v2 is needed, add a new parser path while keeping v1 support. |
| `ImportedVideo` gaining `title`/`moduleTitle` could conflict with existing code that derives titles from filenames | All existing title derivation (e.g., in `PathTimeline`'s `LessonRow`, course overview) should check `video.title` first, falling back to filename-derived title. This is an implementation detail deferred to Unit 4. |
| Batch import of many courses could be slow (sequential scans) | Each course is scanned and persisted sequentially. For a typical track (3-5 courses), this is acceptable. If this becomes a bottleneck, parallel scanning can be added later — the sequential approach is deliberate to avoid IndexedDB transaction contention. |
| Parent-level manifest folder picker can't enforce that the selected directory contains course subdirectories | The picker is a standard `showDirectoryPicker()`. Validate after selection — if no `track-manifest.json` is found, show an error and let the user retry. |
| Silent degradation on invalid manifest frustrates power users (the target audience) — they write a manifest, get a parse error, and see the wizard as if no manifest existed with no feedback about what went wrong | Show a toast or inline banner on parse failure with the first error message. This lets the user know their manifest was found but has issues, giving them a chance to fix it rather than silently falling through to manual entry. Include the JSON path and error description from the parser's `ManifestError` type. |
| New UI elements (difficulty/category selects, "Manifest detected" banner, "Import Track" button, batch confirmation dialog) lack explicit accessibility requirements — the plan does not specify ARIA roles, focus management, or keyboard navigation | All new interactive elements must follow WCAG 2.1 AA+ (existing codebase standard). Dynamic content (banner) uses `role="status"` with `aria-live="polite"`. New Select components inherit shadcn/ui's built-in keyboard support. Batch confirmation dialog uses `AlertDialog` which includes focus trapping. Import Track button on narrow viewports should wrap into a dropdown or overflow menu to avoid horizontal scroll. Touch targets ≥44×44px. |

## Documentation / Operational Notes

- Update `CLAUDE.md` "File Structure" section if new files (`src/lib/courseManifest.ts`, `src/lib/trackManifestImport.ts`) represent new conventions.
- No monitoring or rollout concerns — this is a client-side feature with no server-side changes.

## Sources & References

- **Import wizard:** `src/app/components/figma/ImportWizardDialog.tsx`
- **Course import lib:** `src/lib/courseImport.ts`
- **File system utilities:** `src/lib/fileSystem.ts`
- **Author detection:** `src/lib/authorDetection.ts`
- **Data types:** `src/data/types.ts` (`ImportedCourse`, `ImportedVideo`)
- **Track pages:** `src/app/pages/LearningTracks.tsx`, `src/app/pages/LearningTrackDetail.tsx`
- **Curriculum composer:** `src/app/components/figma/CurriculumComposer.tsx`
- **Related plan (import-from-path):** `docs/plans/2026-05-03-001-feat-import-from-path-plan.md`
- **Related plan (learning tracks):** `docs/plans/2026-05-09-001-feat-learning-tracks-pages-plan.md`
- **Institutional learning (curriculum composer):** `docs/solutions/best-practices/curriculum-composer-implementation-lessons-2026-05-03.md`
- **Institutional learning (import wizard):** `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md`
- **Institutional learning (syncableWrite batching):** `docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md`
- **Institutional learning (author patterns):** `docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md`
- **Institutional learning (scan directory):** `docs/solutions/ui-bugs/course-import-cover-image-shows-subdirectory-images-2026-04-30.md`
