---
title: "Course import cover image grid shows subdirectory images"
date: 2026-04-30
category: ui-bugs
module: course-import
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Cover image selection grid in Import Wizard shows images from all subdirectories, not just the course root folder"
  - "Users see irrelevant module/resource images as cover candidates"
root_cause: scope_issue
resolution_type: code_fix
severity: medium
tags:
  - course-import
  - cover-image
  - scan-directory
  - image-filtering
  - max-depth
related_components:
  - tooling
---

# Course import cover image grid shows subdirectory images

## Problem

When importing courses into Knowlune, the cover image selection grid in the Import Wizard shows images from ALL subdirectories of the course folder (e.g., `module-1/`, `resources/`), not just images from the course root folder. This leads to a cluttered and confusing selection experience where users must hunt through irrelevant images to find a course cover.

## Symptoms

- Cover image grid displays irrelevant images from nested folders like `module-1/thumbnails/`, `resources/icons/`, and `assets/backgrounds/`
- Users must hunt through unrelated images to find the correct course cover image
- Import flow feels broken or unpolished, reducing user confidence in the tool
- Folders with large media libraries in subdirectories produce an overwhelming number of cover image options

## What Didn't Work

- **Single-pass scanning**: The original `scanDirectory()` call with `includeImages: true` walked the full tree depth, yielding every image from every subfolder. No depth filter existed — the function had no mechanism for depth-limited traversal.
- **Post-filtering by path prefix** (rejected during implementation): Would require collecting all results first (defeating the async generator pattern), then filtering by path depth. Fragile, wastes I/O on files that will be discarded, and doesn't scale for folders with thousands of deep-nested images.
- **Counting path segments at the call site** (rejected): Depth logic belongs in the generator itself — callers should not have to reimplement path-depth bookkeeping for every use case. No prior session had identified or investigated this bug (session history).

## Solution

### Part 1: Add `maxDepth` option to `scanDirectory`

Extended the `scanDirectory()` async generator in `src/lib/fileSystem.ts` with an optional `maxDepth` parameter. The generator computes `currentDepth` from `basePath` — root calls pass `''` (yielding `currentDepth = 0`), so `maxDepth: 0` means "root only" and `maxDepth: 1` means "one level deep." Leaving it `undefined` preserves the original unlimited-recursion behavior.

```typescript
export async function* scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
  options?: { includeImages?: boolean; maxDepth?: number }
): AsyncGenerator<{ handle: FileSystemFileHandle; path: string }> {
  const currentDepth = basePath ? basePath.split('/').length : 0

  for await (const entry of dirHandle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name
    if (entry.kind === 'file') {
      if (isSupportedFile(entry.name) || (options?.includeImages && isImageFile(entry.name))) {
        yield { handle: entry as FileSystemFileHandle, path: entryPath }
      }
    } else if (entry.kind === 'directory') {
      if (options?.maxDepth !== undefined && currentDepth >= options.maxDepth) continue
      yield* scanDirectory(entry as FileSystemDirectoryHandle, entryPath, options)
    }
  }
}
```

Key design: the depth check sits at the directory traversal point, not the file yield point. If `maxDepth` is exceeded, the entire subtree is skipped in one check per directory — no wasted iteration inside rejected branches.

### Part 2: Two-pass scanning in import functions

Both `scanCourseFolder()` and `scanCourseFolderFromHandle()` in `src/lib/courseImport.ts` now perform a two-pass scan:

```typescript
// Pass 1: Recursive for videos + PDFs (needs full depth)
for await (const entry of scanDirectory(dirHandle, '', { includeImages: false })) {
  if (isSupportedVideoFormat(entry.handle.name)) { videoFiles.push(entry); continue }
  pdfFiles.push(entry)
}

// Pass 2: Root-only for images (avoids subdirectory clutter)
for await (const entry of scanDirectory(dirHandle, '', { includeImages: true, maxDepth: 0 })) {
  if (isImageFile(entry.handle.name)) imageFiles.push(entry)
}
```

Pass 1 walks the full tree for instructional content (videos and PDFs). Pass 2 restricts images to `maxDepth: 0` — only files directly in the course root folder.

### Part 3: `isImageFile` guard in second pass

Critical bug found during code review: `scanDirectory` with `includeImages: true` uses **OR logic** — it yields supported files (`.mp4`, `.pdf`) PLUS images. Without the `isImageFile()` guard on `imageFiles.push()`, any root-level `.mp4` or `.pdf` files would leak into the image collection and appear as broken cover images:

```typescript
if (isImageFile(entry.handle.name)) imageFiles.push(entry)
```

### Part 4: Options-aware test mock

The test mock in `scanAndPersist.test.ts`'s `setupScanMocks` function was updated to simulate two-pass behavior — pass 1 yields only non-image files, pass 2 yields only images:

```typescript
fileSystemMocks.scanDirectory.mockImplementation(async function* (_dirHandle, _basePath, options) {
  for (const file of files) {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
    if (options?.includeImages ? isImage : !isImage) {
      yield { handle: createMockFileHandle(file.name), path: file.name }
    }
  }
})
```

## Why This Works

The root cause was that `scanDirectory()` had no mechanism for depth-limited traversal and the import functions used a single pass for all file types. Cover images only make sense at the course root level (the folder the user selects in the file picker), but the generator treated every image at every depth equally.

The `maxDepth` parameter cleanly separates two concerns: the generator owns the traversal logic (how deep to go), and the caller owns the collection logic (what to collect from yielded results). By computing `currentDepth` from `basePath` segments, the check is O(1) per directory entry and requires no state mutation or external bookkeeping.

The two-pass approach also reflects the correct semantic split: instructional materials (videos, PDFs) are genuinely nested inside subdirectories and need full-depth scanning. Cover images are a presentation concern that only makes sense at the root. These are different use cases and should use different traversal depths.

The `isImageFile` guard fixes a subtle interaction between `scanDirectory`'s OR logic for `includeImages` and the collection code — without it, the fix would have introduced a regression where `.mp4` and `.pdf` files from the root appear as broken cover images.

## Prevention

- When adding a new `scanDirectory` caller, always ask: "At what depth are the files I care about?" If the answer is "root only," pass `maxDepth: 0` rather than post-filtering.
- Any collection loop over `scanDirectory` results with `includeImages: true` must also guard with an `isImageFile()` check — the OR logic in the generator means non-image files are still yielded.
- Prefer adding options to the generator (`maxDepth`) over post-filtering results — it keeps the async generator lazy and avoids wasted I/O on files that will be discarded.
- Test mocks for multi-pass scanning should be options-aware — a static file list that ignores the `options` parameter will silently test the wrong behavior for one of the passes.

## Related Issues

- No related GitHub issues found
- No related solution docs in `docs/solutions/`
- No prior session history for this specific bug
