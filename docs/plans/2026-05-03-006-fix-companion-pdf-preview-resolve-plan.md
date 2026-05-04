---
title: "fix: Companion PDFs show in sidebar but fail to render in lesson player"
type: fix
status: active
date: 2026-05-03
---

# fix: Companion PDFs show in sidebar but fail to render in lesson player

## Overview

Companion PDFs matched to video lessons appear as clickable sub-rows in the Course Content sidebar (fixed by the discoverability plan [003](docs/plans/2026-05-03-003-feat-course-content-sidebar-pdf-access-plan.md)), but clicking them navigates to a lesson player that shows a skeleton forever — the PDF never renders. The root cause is a mismatch between the data source used for sidebar display and the one used for lesson type resolution.

## Problem Frame

`LessonsTab` renders the sidebar using `adapter.getGroupedLessons()`, which includes **all** PDFs — both companion (matched to videos) and standalone. Each companion PDF renders as a `MaterialRow` link to `/courses/:courseId/lessons/:pdfId`.

When the lesson player loads, `useLessonPlayerState` resolves the lesson type by calling `adapter.getLessons()` and searching for the lesson by ID. But `LocalCourseAdapter.getLessons()` calls `getCompanionPdfIds()` to **explicitly exclude companion PDFs** from the flat list. This is intentional for prev/next navigation — companion PDFs should not appear in sequential lesson order — but it also prevents the player from ever resolving their type.

As a result: `lessonType` stays `null` → `lessonTypeResolved` remains `false` → `LessonContentRenderer` shows a loading skeleton indefinitely. The PDF viewer component (`PdfContent`) is never mounted.

Standalone PDFs (not matched to any video) are unaffected — they pass through the companion filter and resolve correctly.

## Requirements Trace

- **R1.** Clicking a companion PDF sub-row in the Course Content sidebar navigates to the unified lesson player and renders the PDF via `PdfContent`.
- **R2.** Standalone PDFs continue to resolve and render correctly (no regression).
- **R3.** Prev/next navigation continues to skip companion PDFs (no change to `getLessons()` ordering).
- **R4.** Video lesson type resolution is unaffected.

## Scope Boundaries

- **In scope:** Add a lesson lookup method to the adapter interface; update `useLessonPlayerState` to use it.
- **Out of scope:** Changes to Materials tab, PDF viewer internals, import pipeline, sidebar UX, prev/next ordering, or the companion matcher algorithm.

## Context & Research

### Relevant Code and Patterns

- `src/app/hooks/useLessonPlayerState.ts:142-165` — resolves `lessonType` by searching `adapter.getLessons()` for the current `lessonId`
- `src/lib/courseAdapter.ts:145-161` — `LocalCourseAdapter.getLessons()` filters out companion PDFs via `getCompanionPdfIds()`
- `src/lib/courseAdapter.ts:138-143` — `LocalCourseAdapter.getGroupedLessons()` includes all PDFs (used by sidebar)
- `src/lib/lessonMaterialMatcher.ts:301-309` — `getCompanionPdfIds()` extracts all matched PDF IDs from groups
- `src/lib/courseAdapter.ts:69-80` — `CourseAdapter` interface definition
- `src/app/components/course/LessonContentRenderer.tsx:74-97` — renders skeleton when `lessonTypeResolved` is false, `PdfContent` only when `isPdf` is true
- `src/app/components/course/tabs/LessonsTab.tsx:267-335` — `MaterialRow` links companion PDFs to the lesson player route

### Institutional Learnings

- [course-content-sidebar-pdf-discoverability-2026-05-03](docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md) — The sidebar fix that made companion PDFs visible. This surface now exposes the resolution gap.
- [lesson-chrome-store-consumer-integration-gaps-2026-05-02](docs/solutions/integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md) — Precedent for store-consumer wiring gaps where state was defined but never connected. This bug follows the same pattern: the sidebar links exist but the resolver can't find the target.

## Key Technical Decisions

- **Add `getLesson(lessonId)` to the adapter interface** rather than making `getLessons()` include all PDFs. Rationale: `getLessons()` is a sequenced list for prev/next navigation and correctly excludes companion PDFs. Lesson lookup is a different operation (point query by ID) and should not be served by filtering a full list.
- **Implement in both adapters.** `LocalCourseAdapter` searches videos + all PDFs (no companion filter). `YouTubeCourseAdapter` searches only videos. This is consistent with each adapter's data model.

## Implementation Units

- [ ] **Unit 1: Add `getLesson` to adapter interface and implementations**

**Goal:** Provide a point-lookup method that finds any lesson by ID, regardless of companion status.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/courseAdapter.ts`
- Test: `src/lib/__tests__/courseAdapter.test.ts` (create if absent, or add to existing adapter tests)

**Approach:**
- Add `getLesson(lessonId: string): Promise<LessonItem | null>` to the `CourseAdapter` interface
- In `LocalCourseAdapter`: search `buildVideoLessons()` first, then `buildPdfLessons()` (the full list, not the companion-filtered one). Return the match or null.
- In `YouTubeCourseAdapter`: search videos only. Return the match or null.
- Keep `getLessons()` unchanged — companion PDF exclusion is preserved for prev/next.

**Patterns to follow:**
- `LocalCourseAdapter.buildVideoLessons()` and `buildPdfLessons()` — reuse these existing private methods
- `LocalCourseAdapter.getMediaUrl()` — already does the same video-then-PDF lookup pattern

**Test scenarios:**
- Happy path: `getLesson(companionPdfId)` returns the PDF `LessonItem` with `type: 'pdf'` and correct title
- Happy path: `getLesson(videoId)` returns the video `LessonItem` with `type: 'video'`
- Happy path: `getLesson(standalonePdfId)` returns the standalone PDF (not companion-matched)
- Edge case: `getLesson('nonexistent-id')` returns `null`
- Edge case: YouTube adapter `getLesson(anyId)` only searches videos, returns `null` for unknown IDs

**Verification:**
- Unit tests pass; adapter method can be called and returns correct lesson metadata.

---

- [ ] **Unit 2: Update `useLessonPlayerState` to use `adapter.getLesson()`**

**Goal:** Resolve lesson type for companion PDFs that are excluded from `getLessons()`.

**Requirements:** R1, R2, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/hooks/useLessonPlayerState.ts`
- Test: `src/app/hooks/__tests__/useLessonPlayerState.test.ts` (if test file exists) or rely on existing integration coverage

**Approach:**
- Replace the `adapter.getLessons()` → `lessons.find(l => l.id === lessonId)` pattern with `adapter.getLesson(lessonId)`
- The effect at lines 142-165 currently fetches the full lesson list and searches. Change it to call `adapter.getLesson(lessonId)` directly.
- When `getLesson()` returns a lesson: set `lessonTitle`, `lessonType`, `lessonDescription`, `lessonTags` from it.
- When `getLesson()` returns null (lesson not found): set lesson title to a default ("Lesson") and keep `lessonType` as null, but ensure `lessonTypeResolved` becomes true so the skeleton is dismissed. Currently `lessonTypeResolved` is derived as `lessonType !== null`, which means a null result from `getLesson()` would keep the skeleton visible forever — the same class of bug this plan fixes, just for a different reason (genuinely missing lesson vs filtered-out lesson). Fix this by tracking resolution separately: add a `lessonResolved` boolean state, set it to true after the adapter promise settles (regardless of result), and derive `lessonTypeResolved` from `lessonResolved` instead of `lessonType !== null`. This way, when the lesson isn't found, `UnifiedLessonPlayer` shows its existing "Lesson not found" error state rather than an indefinite skeleton.
- Use the same `ignore` flag pattern for cleanup.

**Technical design:**
> *Directional guidance — the implementing agent should treat this as context, not code to reproduce.*

The current effect pattern:
```
adapter.getLessons() → lessons.find(id match) → set state
```
Becomes:
```
adapter.getLesson(lessonId) → set state
```
This is simpler (point lookup replaces list traversal) and correct for all lesson types.

**Patterns to follow:**
- Existing `ignore` flag + catch pattern in the current `useLessonPlayerState` effect (lines 142-165)

**Test scenarios:**
- Happy path: Navigating to a companion PDF URL renders `PdfContent` (the skeleton resolves to a PDF viewer)
- Happy path: Navigating to a video lesson still renders the video player
- Happy path: Navigating to a standalone PDF still renders `PdfContent`
- Edge case: Navigation to a non-existent lesson ID resolves (dismisses skeleton) and shows UnifiedLessonPlayer's existing "Lesson not found" error state
- Regression: Prev/next buttons skip companion PDFs (unchanged behavior, verified via `useLessonNavigation`)

**Verification:**
- Manual testing: click a companion PDF sub-row in the sidebar → PDF renders in the lesson player
- Manual testing: click a video lesson → video player renders
- Manual testing: prev/next navigation still skips companion PDFs
- Manual spot-check: Materials tab PDF inline rendering is unaffected (Materials tab loads PDFs directly from Dexie, not via `getLessons()`)

**Test maintenance:** Existing test mocks for `CourseAdapter` (e.g., `UnifiedLessonPlayer.test.tsx`) define `getLessons` as a mock function. After adding `getLesson` to the interface, these mocks will need a `getLesson` mock added. The type checker will surface this — it is a one-line addition per mock object.

## System-Wide Impact

- **Interaction graph:** `useLessonPlayerState` → `LessonContentRenderer` → `PdfContent`. No sidebar, navigation, or Materials tab changes.
- **Unchanged invariants:** `getLessons()` companion exclusion preserved. `getGroupedLessons()` unchanged. Prev/next ordering unchanged. Lesson routes unchanged. `PdfContent` internal logic unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `getLesson()` introduces a second code path for lesson lookup that could diverge from `getLessons()` | Both use the same `buildVideoLessons()` / `buildPdfLessons()` methods; the only difference is the companion filter |
| YouTube adapter has no PDFs but interface requires the method | Implementation is trivial — search videos only, return null if not found |

## Sources & References

- **Related plan:** [docs/plans/2026-05-03-003-feat-course-content-sidebar-pdf-access-plan.md](docs/plans/2026-05-03-003-feat-course-content-sidebar-pdf-access-plan.md)
- **Related solution:** [docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md](docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md)
- Key files: `src/lib/courseAdapter.ts`, `src/app/hooks/useLessonPlayerState.ts`, `src/lib/lessonMaterialMatcher.ts`
