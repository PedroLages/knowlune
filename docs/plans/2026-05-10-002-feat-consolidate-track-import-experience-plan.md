---
title: "feat: Consolidate course import and track experience"
type: feat
status: active
date: 2026-05-10
---

# feat: Consolidate Course Import and Track Experience

## Overview

Three tightly-scoped changes that consolidate Knowlune's learning track experience: wiring batch import track creation into the BulkImportDialog, removing the redundant `/learning-paths` route in favor of `/learning-tracks`, and fixing course card spacing/hover overlap on the Courses page.

## Problem Frame

1. **Batch import creates 50 flat courses instead of 1 track.** The `batchImportTrackCourses()` function in `src/lib/trackManifestImport.ts` is fully built but has zero UI callers. When a user imports a parent folder with `track-manifest.json` + 50 subfolders, they currently get 50 flat course cards instead of a single track card.

2. **Two route sets for the same data model.** `/learning-paths` and `/learning-tracks` both render track data. `/learning-tracks` (added in E89) is the newer, more actively maintained UI with better UX. The old `/learning-paths` routes and their exclusive page components are dead weight causing maintenance overhead and confusing navigation.

3. **Course cards overlap on hover.** The `ImportedCourseCard` has two competing translate transforms — one on the `<article>` (`hover:-translate-y-0.5`) and one on the `CardCover` (`group-hover:-translate-y-2`) — that push the cover ~10px upward into the card above's space. The article also lacks `relative` positioning, so `z-index` has no effect.

## Requirements Trace

- R1. When a parent folder with `track-manifest.json` is imported via BulkImportDialog, a LearningPath is auto-created and all imported courses become children of that track.
- R2. When no manifest is detected, the existing per-course persist behavior is preserved unchanged.
- R3. The `/learning-paths` route no longer exists. Navigating to any `/learning-paths/*` URL redirects to `/learning-tracks`.
- R4. All hardcoded `/learning-paths` path references in shared code point to `/learning-tracks` instead.
- R5. The "Learning Paths" sidebar nav entry is removed; "Learning Tracks" remains.
- R6. Course cards on the Courses page have consistent vertical spacing regardless of card variant.
- R7. Course card hover effects stay within card boundaries and do not cover or interfere with adjacent cards.

## Scope Boundaries

- Only `BulkImportDialog` is modified for Task 1 — no changes to `trackManifestImport.ts` or `courseImport.ts` (they already work correctly).
- Shared learning-path components (PathHeroBanner, PathTimeline, PathProgressSidebar, ContinueLearningBento, EditPathDialog, PathCoverDialog, LearningPathCard) are preserved.
- Stores (`useLearningPathStore`), hooks (`usePathProgress`, `usePathMilestones`, `useNextBestCourse`), data utilities (`learningPathUtils`, `pathCoverGradients`), and AI modules (`src/ai/learningPath/`) are preserved.
- `LearningTracks.tsx` and `LearningTrackDetail.tsx` are untouched — they become the sole track UI.
- `tests/e2e/learning-tracks.spec.ts` is preserved.
- Only `ImportedCourseCard` hover/spacing is fixed — compact card and list row variants are already correct.
- No data model or store changes.

### Deferred to Separate Tasks

- E2E test coverage for the manifest-based import flow: separate PR after this lands.

## Context & Research

### Relevant Code and Patterns

- `src/lib/trackManifestImport.ts` — `batchImportTrackCourses(parentDirHandle, manifest)` (line 79) handles the full pipeline: scan → persist → create track → apply ordering. Returns `BatchImportResult` with `trackId`, `trackName`, `courses[]`, `successCount`, `failureCount`.
- `src/app/components/figma/BulkImportDialog.tsx` — Multi-step import dialog. `handleSelectParentFolder` (line 185) already detects `track-manifest.json` via `readTrackManifest()` but discards both the manifest and `parentHandle` after reordering folders. `handleConfirmImport` (line 381) does per-course persist with concurrency-limited loop.
- `src/app/components/figma/CourseCardShell.tsx` — `CardCover` component (line 23) with `group-hover:-translate-y-2` and `group-hover:shadow-[0_10px_30px_var(--shadow-brand)]` on line 28. Used by both `ImportedCourseCard` and `CourseCard`.
- `src/app/components/figma/ImportedCourseCard.tsx` — Grid card with `hover:-translate-y-0.5` on article (line 323), missing `relative` class.
- `src/app/routes.tsx` — Lines 90-98: lazy imports for `LearningPaths`, `LearningPathDetail`, `TemplateSyllabus`. Lines 631-654: three `/learning-paths/*` route definitions.
- `src/app/config/navigation.ts` — Line 65: `{ name: 'Learning Paths', path: '/learning-paths', icon: Route }` in Library group.

### Institutional Learnings

- PR #557 recently added `track-manifest.json` detection and folder reordering in `BulkImportDialog` — this plan extends that work to also call the batch import function.
- `docs/plans/2026-05-09-001-feat-learning-tracks-pages-plan.md` — Created the `/learning-tracks` pages as the canonical track UI. The old `/learning-paths` pages were kept during the transition period.

## Key Technical Decisions

- **Store `parentHandle` in a ref, not state.** `FileSystemDirectoryHandle` is not serializable and React state may clone objects. `useRef` avoids this and is the standard pattern for file handles in the codebase.
- **Store parsed `TrackManifest` in state.** The manifest is a plain JSON object — safe for state. Storing it alongside a `hasManifest` boolean flag keeps the logic clean.
- **Call `batchImportTrackCourses` from `handleConfirmImport` instead of the per-course loop.** The function already handles scanning, persistence, track creation, and ordering. It also shows its own toasts. The dialog's existing flow (scan → review → import → results) integrates naturally.
- **Adapt `onComplete` to pass `trackId` when available.** The current `onComplete(courseIds: string[])` signature doesn't communicate track creation. Adding `trackId` as an optional second parameter lets callers respond differently (e.g., navigate to the track instead of the courses list). Backward-compatible: existing callers ignore the extra param.
- **Remove both `hover:-translate-y-0.5` on article and `group-hover:-translate-y-2` on CardCover for grid cards only.** The two competing translates are the root cause. Replacing with a single, smaller lift (e.g., `hover:-translate-y-0.5` on article only) preserves the interaction feel without the overlap. The CardCover's translate is a shared primitive — removing it from `CourseCardShell.tsx` would also affect `CourseCard` (native courses). The fix should be in `ImportedCourseCard` via a prop or by overriding the translate on the article.
- **Add `relative hover:z-10` to the article.** This ensures the hovered card always paints above adjacent cards, preventing any residual shadow/card overlap.

## Implementation Units

- [ ] **Unit 1: Wire batch import into BulkImportDialog**

**Goal:** When a `track-manifest.json` is detected during folder selection, store the manifest and parentHandle, then call `batchImportTrackCourses()` during import confirmation instead of the manual per-course persist loop.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`
- Test: `src/app/components/figma/__tests__/BulkImportDialog.test.tsx` (if exists)

**Approach:**
1. Add two refs: `parentHandleRef` (`useRef<FileSystemDirectoryHandle | null>(null)`) and `trackManifestRef` (`useRef<TrackManifest | null>(null)`)
2. In `handleSelectParentFolder`, after `readTrackManifest` succeeds, store `parentHandle` and `manifestResult.manifest` in the refs
3. In `handleConfirmImport`, check if `trackManifestRef.current` is set:
   - If yes: call `batchImportTrackCourses(parentHandleRef.current!, trackManifestRef.current)`, then transition to results step with the batch result's course list
   - If no: run the existing per-course persist loop (unchanged)
4. In `handleOpenChange`, when firing `onComplete`, also pass the `trackId` from the batch result if available. Add `trackId?: string` as an optional second parameter to the callback.
5. Clear both refs in `resetDialog()`
6. The review step (`step === 'review'`) should show a track-level header when a manifest is present — e.g., "Track: {trackName}" above the course list — so users know the import will create a track. Use the manifest's `track.name` for the header.

**Patterns to follow:**
- `batchImportTrackCourses` already shows its own toasts for per-course status — the dialog should not duplicate them
- The function already calls `useCourseImportStore.getState().loadImportedCourses()` internally, but the dialog also calls it after the manual persist loop (line 470) — skip the dialog's call when using batch mode to avoid double-loading

**Test scenarios:**
- Happy path: Select parent folder with `track-manifest.json` + 3 subfolders → scan → review shows "Track: {name}" header → confirm → `batchImportTrackCourses` called → results show 3 courses → dialog closes → `onComplete` fires with `courseIds` and `trackId`
- Happy path: Select parent folder without manifest → existing per-course persist loop runs unchanged
- Edge case: Manifest present but all courses fail import → `batchImportTrackCourses` returns `successCount: 0` and no `trackId` → `onComplete` fires with empty `courseIds` and no `trackId`
- Edge case: User goes back from review to select-folders, then re-scans → manifest refs are still valid (parentHandle is same folder)
- Edge case: Dialog is closed externally during import → abort ref prevents further work, `onComplete` not fired (existing guard via `completedSuccessfullyRef`)

**Verification:**
- Importing a parent folder with `track-manifest.json` creates a LearningPath with the correct name and courses
- Importing without manifest behaves identically to current behavior
- `npm run build` and `npx tsc --noEmit` pass

---

- [ ] **Unit 2: Delete /learning-paths route and orphaned files**

**Goal:** Remove the `/learning-paths` route, its 3 page components, 6 orphaned components, and 3 test files. Add a redirect from `/learning-paths/*` to `/learning-tracks`. Update all 7 files with hardcoded `/learning-paths` paths.

**Requirements:** R3, R4, R5

**Dependencies:** None (can run in parallel with Unit 1)

**Files:**
- Delete: `src/app/pages/LearningPaths.tsx`
- Delete: `src/app/pages/LearningPathDetail.tsx`
- Delete: `src/app/pages/TemplateSyllabus.tsx`
- Delete: `src/app/pages/__tests__/LearningPaths.test.tsx`
- Delete: `src/app/pages/__tests__/LearningPathDetail.test.tsx`
- Delete: `src/app/components/learning-path/ControlCenter.tsx`
- Delete: `src/app/components/learning-path/CollapsibleCardSection.tsx`
- Delete: `src/app/components/learning-path/PlanMyWeekButton.tsx`
- Delete: `src/app/components/learning-path/PlanMyWeekPreview.tsx`
- Delete: `src/app/components/learning-path/PathScheduleList.tsx`
- Delete: `src/app/components/learning-path/FocusPanel.tsx`
- Delete: `src/app/components/learning-path/__tests__/ControlCenter.test.tsx`
- Delete: `src/app/components/learning-path/__tests__/PathSummaryPanel.test.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/config/navigation.ts`
- Modify: `src/app/pages/AILearningPath.tsx`
- Modify: `src/app/components/ContinueLearningPathSection.tsx`
- Modify: `src/app/components/NextInPath.tsx`
- Modify: `src/app/components/learning-path/PathHeroBanner.tsx`
- Modify: `src/app/components/figma/CurriculumComposer.tsx`
- Modify: `src/app/components/reports/PathAnalyticsTab.tsx`
- Modify: `src/app/components/challenges/PathMilestoneCard.tsx`

**Approach:**

**Step A — Delete files:** Remove all 12 files listed above.

**Step B — Modify `routes.tsx`:**
- Remove lazy imports for `LearningPaths`, `LearningPathDetail`, `TemplateSyllabus` (lines 90-98)
- Remove the three route objects at lines 631-654
- Add a redirect route: `{ path: 'learning-paths/*', element: <Navigate to="/learning-tracks" replace /> }` — needs import of `Navigate` from react-router (already imported)

**Step C — Modify `navigation.ts`:**
- Remove line 65: `{ name: 'Learning Paths', path: '/learning-paths', icon: Route }`

**Step D — Update hardcoded `/learning-paths` paths in 7 files:**
| File | Current | Replacement |
|---|---|---|
| `AILearningPath.tsx:26` | `navigate('/learning-paths')` | `navigate('/learning-tracks')` |
| `ContinueLearningPathSection.tsx:190` | ``navigate(`/learning-paths/${pathId}`)`` | ``navigate(`/learning-tracks/${pathId}`)`` |
| `NextInPath.tsx:55` | ``navigate(`/learning-paths/${pathId}`)`` | ``navigate(`/learning-tracks/${pathId}`)`` |
| `PathHeroBanner.tsx:44-45` | `backUrl = '/learning-paths'` and `backLabel = 'Back to Learning Paths'` | `backUrl = '/learning-tracks'` and `backLabel = 'Back to Learning Tracks'` |
| `CurriculumComposer.tsx:76` | `redirectBase = '/learning-paths'` | `redirectBase = '/learning-tracks'` |
| `PathAnalyticsTab.tsx:256` | `<Link to="/learning-paths">` | `<Link to="/learning-tracks">` |
| `PathMilestoneCard.tsx:158` | ``to={`/learning-paths/${pathId}`}`` | ``to={`/learning-tracks/${pathId}`}`` |

**Test scenarios:**
- Happy path: Navigate to `/learning-paths` → redirects to `/learning-tracks` (HTTP 301 client-side)
- Happy path: Navigate to `/learning-paths/abc123` → redirects to `/learning-tracks`
- Happy path: Navigate to `/learning-paths/templates/t1` → redirects to `/learning-tracks`
- Happy path: "Learning Paths" no longer appears in sidebar navigation
- Happy path: All previously-hardcoded `/learning-paths` links now go to `/learning-tracks`
- Edge case: Direct navigation to `/learning-tracks` works as before (no regression)

**Verification:**
- `npm run build` passes
- `npx tsc --noEmit` passes
- `npm run lint` passes (0 errors)
- `grep -r "learning-paths" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."` returns only the redirect route in `routes.tsx`
- `grep -r "LearningPaths\|LearningPathDetail\|TemplateSyllabus" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."` returns no results (no remaining importers)

---

- [ ] **Unit 3: Fix course card vertical spacing and hover overlap**

**Goal:** Eliminate inconsistent vertical spacing between course cards and prevent hover effects from overlapping adjacent cards.

**Requirements:** R6, R7

**Dependencies:** None (can run in parallel with Units 1 and 2)

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Test: `src/app/components/figma/__tests__/ImportedCourseCard.test.tsx` (if exists)

**Approach:**

The root cause is two competing translate transforms and a missing `relative` positioning:

1. **Add `relative hover:relative hover:z-10` to the `<article>` element** (line 322). This makes `z-index` functional and ensures the hovered card always paints on top of neighbors. The `z-10` class currently on line 324 is conditional on `showPreview && videoReady` and ineffective without `relative`. Simplify to always apply `relative` and use `hover:z-10`.

2. **Keep `hover:-translate-y-0.5` on the article** as the singular lift. The overlap was caused by two competing translates (article at -0.5 and CardCover at -2) both pushing upward. Keeping only the article's translate eliminates the conflict while preserving the subtle lift interaction. The 0.5-unit shift alone does not cause meaningful overlap.

3. **Override CardCover's `group-hover:-translate-y-2` for the `ImportedCourseCard`.** Since `CardCover` is a shared primitive in `CourseCardShell.tsx`, we can't remove the translate there without affecting `CourseCard`. Neutralize it in `ImportedCourseCard` by wrapping the CardCover element in a `<div className="group-hover:translate-y-2">`. This counteracts the -2 translate (applied when the parent article is hovered), effectively zeroing out the cover lift while keeping the shadow effect.

4. **Add box-shadow elevation on hover** for additional visual feedback alongside the translate lift. Add `hover:shadow-lg` (or `hover:shadow-card-elevated` if a custom token is available) to the article so there's a clear hover affordance that stays within bounds.

**Patterns to follow:**
- `ImportedCourseCompactCard` (line 233) already uses `relative` correctly — no hover overlap there
- The `transition-shadow` on hover is the established pattern for non-overlapping hover feedback

**Test scenarios:**
- Happy path: Hover over any course card → card elevates visually (shadow) but does not overlap the card above it
- Happy path: Buttons on a card above are fully clickable when the card below is hovered
- Happy path: All cards in the grid have equal vertical spacing (no card is closer to its neighbor than others)
- Edge case: Rapid hover/unhover between adjacent cards → no flickering or z-index fighting
- Edge case: Card with video preview (`showPreview`) → preview stays within card bounds, doesn't overlap card above
- Edge case: Keyboard focus on card → focus ring is visible and not clipped by adjacent cards

**Verification:**
- Manual: Open Courses page, hover over cards in grid view — no overlap with card above
- Manual: Verify buttons on card above remain clickable when card below is hovered
- `npm run build` passes
- `npx tsc --noEmit` passes

## System-Wide Impact

- **Interaction graph:** `BulkImportDialog.onComplete` gains an optional `trackId` parameter — all existing callers pass only `courseIds` so no breakage. `Courses.tsx` (the primary caller via `useBulkImport`) already handles the `courseIds` array.
- **Error propagation:** `batchImportTrackCourses` shows its own toasts for per-course failures. The dialog should not duplicate these. Track-level failure (0 courses imported) is already handled — no track created, toast shown.
- **Unchanged invariants:** `useLearningPathStore` API is unchanged. `batchImportTrackCourses` and `courseImport.ts` functions are unchanged. The `/learning-tracks` pages are untouched. The `track-manifest.json` schema is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `FileSystemDirectoryHandle` stored in ref becomes invalid if user re-selects a different parent folder | Reset refs in both `handleSelectParentFolder` (before new read) and `resetDialog` |
| Removing `CardCover` translate affects `CourseCard` (native courses) | Fix applied only in `ImportedCourseCard`, not in `CourseCardShell` shared primitive |
| Deleting `TemplateSyllabus` breaks the template discovery feature | `LearningTracks` page uses `TemplateCard` directly and does not route through `TemplateSyllabus` — confirmed safe |
| `CurriculumComposer` default `redirectBase` change affects `AILearningPath` | `AILearningPath` does not override `redirectBase`, so after change it will redirect to `/learning-tracks` — confirmed this is the correct behavior since `/learning-tracks` is now the sole track UI |

## Sources & References

- Origin document: (self-contained feature description)
- Related PR: #557 — added `track-manifest.json` detection and folder reordering in `BulkImportDialog`
- Related code: `src/lib/trackManifestImport.ts` — `batchImportTrackCourses()`
- Related code: `src/lib/courseManifest.ts` — `parseTrackManifest()`
- Related code: `src/app/components/figma/CourseCardShell.tsx` — shared `CardCover` component
- Related plan: `docs/plans/2026-05-09-001-feat-learning-tracks-pages-plan.md`
- Related plan: `docs/plans/2026-05-10-001-feat-json-manifest-course-track-import-plan.md`
