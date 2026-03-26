---
story_id: E25-S05
story_name: "Smart Author Photo Detection from Course Folder"
status: done
started: 2026-03-25
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 25.5: Smart Author Photo Detection from Course Folder

## Story

As a learner importing course folders,
I want the system to automatically detect author photos from the folder contents,
so that my author profiles display a photo without manual upload.

## Acceptance Criteria

### AC1: Score image files as author photo candidates
- **Given** a list of scanned images from a course folder
- **When** the system evaluates each image
- **Then** it assigns a score based on filename patterns (author.jpg, profile.png, etc.) and directory context (about/, instructor/)

### AC2: Select best photo candidate during import
- **Given** scored photo candidates with score > 0
- **When** an author is detected during import and has no existing photo
- **Then** the highest-scoring candidate's file handle is attached to the author record

### AC3: Revoke object URLs on author deletion
- **Given** an author with a resolved photo object URL
- **When** the author is deleted
- **Then** the object URL is revoked to prevent memory leaks

## Implementation Notes

- Added `scoreAuthorPhoto()` and `detectAuthorPhoto()` to `src/lib/authorDetection.ts`
- Added `authorPhotoResolver.ts` with `resolvePhotoHandle()`, `revokePhotoUrl()`, `clearPhotoCache()`
- Integrated photo detection into `courseImport.ts` during the author-linking phase
- Added `revokePhotoUrl()` call in `useAuthorStore.deleteAuthor()`

## Challenges and Lessons Learned

- Scoring logic must handle overlapping conditions carefully to avoid unreachable code paths. The original implementation had a dead `if (isInAuthorDir) return 20` after all `isInAuthorDir` cases were already handled.
- Object URL memory leaks are easy to introduce when creating blob URLs for file handles. Always pair `createObjectURL` with `revokeObjectURL` on cleanup paths (deletion, unmount).
- Inline `import()` types in TypeScript (e.g., `Partial<import('@/data/types').Foo>`) work but hurt readability. Prefer top-level `import type` statements.
