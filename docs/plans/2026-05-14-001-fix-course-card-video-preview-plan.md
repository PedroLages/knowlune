---
title: "fix: Restore video preview on imported course card hover"
type: fix
status: active
date: 2026-05-14
---

# Fix: Restore Video Preview on Imported Course Card Hover

## Overview

The video preview that should play on `ImportedCourseCard` hover never works. The root cause is a multi-condition gate where every failure mode is completely silent — no loading indicator, no error message, no console warning. The primary concrete issue is the `!showPlay` condition that blocks preview for all "not-started" courses (the default status after import). Additional silent failure paths in `useVideoFromHandle` and the DB query compound the problem.

## Problem Frame

Hovering over an imported course card in the Courses page should show a muted, looping video preview over the card cover after a 1-second delay. This feature works in the legacy `CourseCard` (for built-in courses) but is broken in `ImportedCourseCard` (for user-imported courses).

The preview gate on [ImportedCourseCard.tsx:347](src/app/components/figma/ImportedCourseCard.tsx#L347):

```tsx
{showPreview && previewBlobUrl && !showPlay && (
```

has three conditions, all must be true:
1. `showPreview` — requires 1s sustained hover AND reduced motion disabled
2. `previewBlobUrl` — requires successful DB query → file handle permission → blob URL creation
3. `!showPlay` — blocks ALL "not-started" courses (default import status)

Failed conditions produce zero user feedback. The user sees nothing and has no way to know why.

## Requirements Trace

### Behavioral Requirements

- **R1.** Video preview renders on hover for any imported course with at least one locally-stored video, regardless of course status
- **R5.** YouTube-imported courses (no local file handles) skip the preview gracefully without useless DB queries
- **R6.** Video preview activates on hover after 1s delay regardless of course status, matching the legacy `CourseCard` behavior

### UI State Requirements

- **R2.** A visible loading state appears while the preview is preparing (DB query + blob creation)
- **R3.** A visible error state appears when preview cannot load (permission denied, no videos, invalid handle)

### Developer Tooling

- **R4.** Console warnings are emitted at each failure point for developer debugging

## Scope Boundaries

- Only the hover video preview on `ImportedCourseCard` (grid view) — not the full-screen dialog preview
- Not the compact card or list row (those intentionally lack video preview)
- Not the legacy `CourseCard` (which already works)
- No changes to the `FileSystemFileHandle` import flow

## Context & Research

### Relevant Code and Patterns

- [ImportedCourseCard.tsx:162-201](src/app/components/figma/ImportedCourseCard.tsx#L162-L201) — preview state management, DB query, condition gate
- [ImportedCourseCard.tsx:347](src/app/components/figma/ImportedCourseCard.tsx#L347) — the render condition: `showPreview && previewBlobUrl && !showPlay`
- [useCourseCardPreview.ts](src/hooks/useCourseCardPreview.ts) — composition hook: hover + reduced motion + guardNavigation
- [useHoverPreview.ts](src/hooks/useHoverPreview.ts) — 1-second delay timer on mouse enter/leave
- [useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts) — FileSystemFileHandle → blob URL conversion (silent errors)
- [useReducedMotion.ts](src/hooks/useReducedMotion.ts) — three-mode reduced motion preference
- [CourseCard.tsx:188](src/app/components/figma/CourseCard.tsx#L188) — legacy card: `showPreview && previewSrc &&` (no `!showPlay`, no status gate)

### Institutional Learnings

- The `!showPlay` condition was added intentionally ("suppressed on not-started cards so the Start Learning button has visual primacy"), but this blocks preview for every newly imported course
- The `preload="none"` attribute causes a full re-download on every hover, increasing the time-to-first-frame. `VideoPlayer.tsx` uses `preload="metadata"` instead

### External References

- File System Access API: `FileSystemFileHandle.queryPermission()` / `requestPermission()` — permissions persist across sessions for IndexedDB-stored handles
- Blob URLs created via `URL.createObjectURL()` must be revoked with `URL.revokeObjectURL()` to prevent memory leaks

## Key Technical Decisions

- **Remove `!showPlay` gate**: The "Start Learning" button has its own visual primacy through brand color, full width, and placement below the card body. Removing this gate matches the legacy `CourseCard` behavior and is the single highest-impact fix.
- **Add loading/error states rather than toasts**: Since hover preview is ephemeral and non-blocking, toast notifications would be too intrusive. Subtle inline indicators on the card cover provide feedback without disruption.
- **Add console warnings at each failure boundary**: Gives developers the ability to debug without changing the user-facing experience.
- **Change `preload="none"` to `preload="metadata"`**: Reduces time-to-first-frame on hover. Metadata is typically <5% of file size, so bandwidth impact is negligible.

## Implementation Units

- [ ] **Unit 1: Remove `!showPlay` gate**

**Goal:** Enable video preview for all courses regardless of status, matching legacy `CourseCard` behavior.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`

**Approach:**
- Remove `!showPlay` from the render condition on line 347
- Remove the `showPlay` variable declaration (line 289) if it's no longer used — check: it IS still used for the "Start Learning" button rendering on lines 734-745, so keep it
- Change line 347 from `{showPreview && previewBlobUrl && !showPlay && (` to `{showPreview && previewBlobUrl && (`
- Update the comment on line 346 to reflect the new behavior

**Patterns to follow:**
- Legacy `CourseCard.tsx:188`: `showPreview && previewSrc &&` (no status gate)

**Test scenarios:**
- Happy path: Hovering a "not-started" course with videos shows the video preview after 1s delay
- Happy path: Hovering an "active" course with videos shows the video preview (existing behavior preserved)
- Edge case: Hovering a course with 0 videos does NOT show preview (existing guard `course.videoCount === 0` preserved)
- Edge case: Hovering a course with `videoCount > 0` but no videos in DB shows loading then error state (Unit 2)

**Verification:**
- Video preview appears on hover for a not-started course with at least one video
- The "Start Learning" button remains visible and functional below the card body

- [ ] **Unit 2: Add visible loading and error states**

**Goal:** Replace the silent failure with visible feedback so users know the preview is loading or unavailable.

**Requirements:** R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`

**Approach:**
- Destructure `loading` and `error` from the preview `useVideoFromHandle` call (currently only `blobUrl` is destructured as `previewBlobUrl`)
- Destructure `loading` and `error` from the preview `useVideoFromHandle` call as `previewLoading` and `previewError`
- Add a loading spinner overlay inside the card cover when `showPreview && previewLoading`:
  ```tsx
  {showPreview && previewLoading && (
    <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <Loader2 className="size-5 text-white/80 animate-spin" aria-hidden="true" />
    </div>
  )}
  ```
- Add an error indicator when `showPreview && previewError && !previewLoading`:
  ```tsx
  {showPreview && previewError && !previewLoading && (
    <div className="absolute bottom-2 left-2 z-30 rounded-full px-2 py-1 bg-black/60 text-white backdrop-blur-sm border border-white/10 text-[11px] font-medium" role="status">
      Preview unavailable
    </div>
  )}
  ```
- Both indicators follow the `OVERLAY_SCRIM_CLASS` glassmorphic convention from `CourseCardShell.tsx`

**Patterns to follow:**
- Skeleton usage in the same file (lines 827-828 for dialog preview loading)
- `OVERLAY_SCRIM_CLASS` from `CourseCardShell.tsx` for glassmorphic overlays

**Test scenarios:**
- Happy path: Hover triggers loading spinner, which transitions to video when ready
- Edge case: Loading spinner disappears if mouse leaves before video loads
- Error path: Permission denied → error indicator appears
- Error path: No videos in DB → error indicator appears
- Error path: Null file handle (YouTube import) → error indicator appears (or YouTube fallback, see Unit 4)

**Verification:**
- On hover, a spinner appears within the card cover during the async load
- If the load fails, an error icon replaces the spinner
- If the load succeeds, the video fades in (existing `opacity-100` transition)

- [ ] **Unit 3: Add console warnings at each failure boundary**

**Goal:** Make the silent failure paths debuggable for developers.

**Requirements:** R4

**Dependencies:** Unit 4 (must be applied after Unit 4's YouTube guard to avoid spurious warnings for YouTube courses)

**Files:**
- Modify: `src/hooks/useVideoFromHandle.ts`
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`

**Approach:**
- In `useVideoFromHandle.ts`: add `console.warn()` only for genuine failure paths where a non-null handle is provided but access fails:
  - Permission denied (after `requestPermission` rejection): `'[useVideoFromHandle] Permission denied — user declined file access'`
  - Catch block (after `getFile()` or `createObjectURL()` failure): `'[useVideoFromHandle] Error accessing file:'` with the error object
  - Do NOT warn for null/undefined handle — that is the normal "no video to load" sentinel used by both callers on every render
  - Update the `// silent-catch-ok` comment on line 32 to: `// silent-catch-ok — error state rendered by consuming component; console.warn emitted for developer debugging`
- In `ImportedCourseCard.tsx`: add `console.warn()`, a `.catch()` handler, AND `setPreviewHandle(null)` on the DB query in the `useEffect` (lines 188-201):
  - No videos found: `console.warn('[CourseCardPreview] No videos found for course', course.id)` then `setPreviewHandle(null)`
  - First video has null fileHandle: `console.warn('[CourseCardPreview] First video has null fileHandle', vids[0].filename, course.id)` then `setPreviewHandle(null)`
  - DB query failure in `.catch()`: `console.warn('[CourseCardPreview] DB query failed for course', course.id, err)` then `setPreviewHandle(null)`

**Patterns to follow:**
- Existing error handling pattern in `useVideoFromHandle.ts` catch block (line 32: `// silent-catch-ok`)
- The `setPreviewHandle(null)` call ensures the error path in `useVideoFromHandle` triggers correctly instead of retaining a stale handle from a previous hover

**Test scenarios:**
- Test expectation: none — this is a developer tooling change (console warnings). Manually verify by opening DevTools console during hover.

**Verification:**
- Console warnings appear in DevTools when video preview fails for any reason
- No warnings appear during normal successful preview operation

- [ ] **Unit 4: Handle YouTube courses and edge cases**

**Goal:** Skip the useless DB query for YouTube courses (which have no local file handles) and prevent unnecessary work.

**Requirements:** R5

**Dependencies:** None (independent)

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`

**Approach:**
- In the `useEffect` that queries for the first video (lines 182-201), add `course.source === 'youtube'` to the early-return guard AND add `course.source` to the dependency array:
  ```tsx
  if (!showPreview || course.videoCount === 0 || course.source === 'youtube') {
  ```
  ```tsx
  }, [showPreview, course.id, course.videoCount, course.source])
  ```
- Change `preload="none"` to `preload="metadata"` on the video element (line 357) to reduce time-to-first-frame — matches `VideoPlayer.tsx` pattern

**Patterns to follow:**
- `VideoPlayer.tsx` uses `preload="metadata"` for the same reason

**Test scenarios:**
- Edge case: Hovering a YouTube-imported course does NOT trigger a DB query for local videos
- Edge case: Hovering a YouTube-imported course shows the YouTube thumbnail (existing behavior), no video preview attempt
- Happy path: Hovering a local-import course shows video preview with `preload="metadata"`, reducing time-to-first-frame

**Verification:**
- No `importedVideos` DB query in DevTools Network/IndexedDB panel when hovering YouTube courses
- Video preview starts playing faster than before for local courses

- [ ] **Unit 5: Add test coverage**

**Goal:** Prevent regression and verify the fix works across all states.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** Units 1-4 (tests validate the implementation)

**Files:**
- Already exists — extend: `src/hooks/__tests__/useHoverPreview.test.ts` (102 lines, 7 tests covering activation, delay, deactivation, cleanup)
- Already exists — extend: `src/hooks/__tests__/useVideoFromHandle.test.ts` (117 lines, 7 tests covering null/undefined handles, permission flow, errors, URL cleanup)
- Modify: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx`

**Approach:**

Existing `useHoverPreview.test.ts` and `useVideoFromHandle.test.ts` already have comprehensive coverage of basic behavior. Review and extend only with new test cases for changes introduced by this plan.

`ImportedCourseCard.test.tsx` — refactor mocks to support per-test overrides, then add test scenarios below. The current module-level `vi.mock` for `useCourseCardPreview` and `useVideoFromHandle` returns fixed values; these must be converted to factories that read test-scoped variables to allow different return values per test case.

`ImportedCourseCard.test.tsx`:
- Renders video element when `showPreview && previewBlobUrl` are true
- Does NOT render video when `showPreview` is false
- Shows loading spinner when preview is loading
- Shows error indicator when preview fails
- Shows preview for not-started courses (post-Unit-1)
- Does NOT query DB for YouTube courses
- Does NOT render video for courses with 0 videos

**Patterns to follow:**
- Existing test files in `src/hooks/__tests__/` for hook testing patterns
- Existing `ImportedCourseCard.test.tsx` for component test patterns (Vitest + React Testing Library)

**Test scenarios:** (per-unit tests detailed above in each section)

**Verification:**
- `npm run test:unit` passes all new and existing tests
- Tests cover happy path, edge cases, and error paths for the video preview flow

## System-Wide Impact

- **Interaction graph:** No other components call `useCourseCardPreview` or `useHoverPreview`. Only `ImportedCourseCard` and `CourseCard` use the preview system. Changes are isolated to `ImportedCourseCard`.
- **Error propagation:** Console warnings are developer-facing only. Inline error indicators are card-local and don't affect surrounding layout.
- **State lifecycle risks:** The `!showPlay` removal means video previews will render on not-started cards. The video's `pointer-events-none` ensures it doesn't interfere with card clicks or the "Start Learning" button.
- **API surface parity:** Legacy `CourseCard` already has this behavior (no status gate). This fix brings `ImportedCourseCard` into parity.
- **Integration coverage:** The hover → DB query → blob URL → video render chain is tested at the hook level and component level.
- **Unchanged invariants:** The 1-second hover delay, `useReducedMotion` integration, full-screen dialog preview, and card click navigation are all preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `FileSystemFileHandle.requestPermission()` may require a user gesture, which the 1s-delayed `setTimeout` context may not satisfy | If permission is already granted (from import), `queryPermission` returns `'granted'` and no prompt is needed. The console warnings from Unit 3 will surface if this is happening. |
| `preload="metadata"` may increase bandwidth usage if users rapidly hover many cards | Metadata is <5% of file size. The 1s hover delay acts as a throttle. Acceptable trade-off. |
| YouTube courses have `videoCount > 0` but no local videos, so the old code would query DB uselessly | Unit 4 adds `course.source === 'youtube'` guard to skip the query entirely. |

## Sources & References

- Related code: [ImportedCourseCard.tsx](src/app/components/figma/ImportedCourseCard.tsx)
- Related code: [CourseCard.tsx](src/app/components/figma/CourseCard.tsx) (legacy reference)
- Related code: [useCourseCardPreview.ts](src/hooks/useCourseCardPreview.ts)
- Related code: [useHoverPreview.ts](src/hooks/useHoverPreview.ts)
- Related code: [useVideoFromHandle.ts](src/hooks/useVideoFromHandle.ts)
- Related code: [useReducedMotion.ts](src/hooks/useReducedMotion.ts)
- Related code: [CourseCardShell.tsx](src/app/components/figma/CourseCardShell.tsx)
