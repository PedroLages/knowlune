---
title: "Companion PDFs render indefinite skeleton in lesson player due to adapter method mismatch"
date: 2026-05-03
category: ui-bugs
module: lesson-player
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Clicking a companion PDF sub-row in Course Content sidebar navigates to lesson player showing a loading skeleton forever
  - PDF viewer (PdfContent) never mounts despite valid PDF data existing in Dexie
  - Standalone PDFs (not companion-matched) resolve and render correctly — only companion-matched PDFs are affected
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags:
  - companion-pdf
  - lesson-player
  - course-adapter
  - point-lookup
  - adapter-pattern
  - skeleton-bug
---
  
# Companion PDFs render indefinite skeleton in lesson player due to adapter method mismatch

## Problem

Companion PDFs matched to video lessons appear as clickable sub-rows in the Course Content sidebar (fixed by the [sidebar discoverability work](../ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md)), but clicking them navigates to a lesson player that shows a loading skeleton indefinitely. The PDF viewer component (`PdfContent`) is never mounted. The root cause is a semantic mismatch: `useLessonPlayerState` resolved lesson type by searching `adapter.getLessons()`, which intentionally excludes companion PDFs to keep them out of prev/next navigation ordering.

## Symptoms

- Companion PDF sub-rows link to `/courses/:courseId/lessons/:pdfId` but clicking one shows a skeleton forever
- `lessonType` stays `null` in `useLessonPlayerState` because the lesson ID is not found in `getLessons()` output
- `lessonTypeResolved` is derived as `lessonType !== null`, so the skeleton never dismisses
- Standalone PDFs (not matched to any video) are unaffected — they pass through the companion filter in `getLessons()` and resolve correctly
- Video lessons are unaffected — they are always included in `getLessons()`

## What Didn't Work

- **Making `getLessons()` include all PDFs.** This would fix lesson-type resolution but break prev/next navigation, which correctly skips companion PDFs. `getLessons()` is a sequenced list for sequential traversal; lesson lookup is a different operation (point query by ID) and should not be served by filtering a full list.
- **Filtering the full list in the consumer (`useLessonPlayerState`).** The hook could call `adapter.getGroupedLessons()` and flatten all materials, but this duplicates adapter logic in the consumer, couples the hook to internal grouping details, and violates the adapter's single-responsibility boundary. The adapter should own data access patterns; the hook should only call the right method.
- **Deriving `lessonTypeResolved` from `lessonType !== null`.** This was a latent bug for genuinely unknown lesson IDs as well — if `getLesson()` returns `null`, `lessonType` stays `null`, `lessonTypeResolved` stays `false`, and the skeleton persists forever. The fix separates the resolution flag from the type value.

## Solution

Two coordinated changes: a new adapter method for point-lookup, and a consumer-side fix to the resolved-flag derivation.

### 1. Add `getLesson(lessonId)` to the adapter interface

A new point-lookup method on `CourseAdapter` that searches all content by ID, with no companion filtering:

```typescript
// src/lib/courseAdapter.ts — interface addition
export interface CourseAdapter {
  // ... existing methods ...
  getLesson(lessonId: string): Promise<LessonItem | null>  // NEW
}
```

**`LocalCourseAdapter` implementation** — searches videos first, then ALL PDFs (no `getCompanionPdfIds()` filter):

```typescript
async getLesson(lessonId: string): Promise<LessonItem | null> {
  const videoMatch = this.buildVideoLessons().find(v => v.id === lessonId)
  if (videoMatch) return videoMatch

  const pdfMatch = this.buildPdfLessons().find(p => p.id === lessonId)
  return pdfMatch ?? null
}
```

**`YouTubeCourseAdapter` implementation** — videos only (no PDFs in YouTube courses):

```typescript
async getLesson(lessonId: string): Promise<LessonItem | null> {
  const match = this.videos.find(v => v.id === lessonId)
  if (!match) return null
  return { /* ... LessonItem from video ... */ }
}
```

`getLessons()` is left unchanged — companion PDF exclusion is preserved for prev/next navigation.

### 2. Update `useLessonPlayerState` to use point-lookup and separate resolution flag

Replace `adapter.getLessons()` + `.find()` with `adapter.getLesson(lessonId)`, and derive `lessonTypeResolved` from a dedicated `lessonResolved` boolean rather than `lessonType !== null`:

```typescript
// src/app/hooks/useLessonPlayerState.ts

// NEW: dedicated resolution flag (initialized alongside lessonType)
const [lessonResolved, setLessonResolved] = useState(false)

// Reset on lesson change
useEffect(() => {
  // ... existing resets ...
  setLessonResolved(false)
}, [lessonId])

// Resolve lesson metadata via point-lookup
useEffect(() => {
  if (!adapter || !lessonId) return
  let ignore = false
  adapter
    .getLesson(lessonId)
    .then(match => {
      if (ignore) return
      setLessonTitle(match?.title ?? 'Lesson')
      setLessonType(match?.type ?? null)
      setLessonDescription(typeof match?.sourceMetadata?.description === 'string' ? match.sourceMetadata.description : undefined)
      setLessonTags(Array.isArray(match?.sourceMetadata?.tags) ? (match.sourceMetadata.tags as string[]) : undefined)
      setLessonResolved(true)  // always set, even when match is null
    })
    .catch(err => {
      if (ignore) return
      console.error('Failed to load lesson metadata:', err)
      setLessonResolved(true)  // resolve even on error — show error state, not skeleton
    })
  return () => { ignore = true }
}, [adapter, lessonId])

const lessonTypeResolved = lessonResolved  // was: lessonType !== null
```

This fixes both cases: companion PDFs (now found by `getLesson()`) and genuinely unknown lesson IDs (skeleton dismissed, `UnifiedLessonPlayer` shows its existing "Lesson not found" error state).

## Why This Works

The original design had two adapter methods serving different consumers:

| Method | Consumer | Visibility |
|--------|----------|------------|
| `getGroupedLessons()` | Sidebar (`LessonsTab`) | All PDFs, including companions |
| `getLessons()` | Navigation (prev/next) | Excludes companion PDFs |

Lesson-type resolution is a **third concern** — a point query by ID — that was incorrectly served by `getLessons()`. It needs different visibility (all content, like the sidebar) but a different access pattern (single-ID lookup, not a flat list).

**Non-obvious invariant**: `getLessons()` calls `getGroupedLessons()` internally to compute companion IDs, then filters. If `getLesson()` also called `getGroupedLessons()`, it would create a circular dependency in the sidebar flow (sidebar calls `getGroupedLessons()` which is cached, but `getLesson()` would re-trigger that computation). The fix avoids this by having `getLesson()` call the private `buildVideoLessons()` and `buildPdfLessons()` directly — the same canonical data sources both `getLessons()` and `getGroupedLessons()` use.

**Invariants the solution relies on:**

1. **`buildVideoLessons()` and `buildPdfLessons()` are the canonical data sources.** All three adapter methods (`getLessons`, `getGroupedLessons`, `getLesson`) derive from these same private builders. The only difference is which downstream processing each applies (grouping, companion filtering, or none). This guarantees that a lesson found by `getLesson()` has the same `id`, `title`, and `type` as the same lesson appearing in `getGroupedLessons()` or `getLessons()`.

2. **Companion PDF exclusion is solely for navigation ordering.** The `getCompanionPdfIds()` filter in `getLessons()` exists so prev/next skips companion PDFs. No other consumer should rely on this filter — each consumer should call the adapter method that matches its access pattern.

3. **`getLesson()` is a pure point query.** It searches the full dataset without companion awareness. This is correct because "find lesson by ID" should always succeed for any valid lesson ID, regardless of whether the lesson happens to be a companion PDF.

4. **The `ignore` flag pattern prevents stale async results on lesson change.** If the user clicks a companion PDF then quickly clicks a video, the companion PDF's async resolution is discarded by the cleanup function. The separation of `lessonResolved` from `lessonType` means the flag is set unconditionally — a null result from `getLesson()` still resolves, dismissing the skeleton rather than leaving it spinning forever.

## Prevention

- **When adding a new adapter method, audit existing consumers for incorrect method usage.** After the sidebar fix made companion PDFs visible, no one checked whether the lesson player could resolve them. A cross-consumer audit (sidebar links to lesson player routes — can the player render those IDs?) would have caught this gap before it reached review.
- **Prefer point-lookup methods (`getById`) over list-search patterns in consumers.** `adapter.getLessons().find(l => l.id === lessonId)` is two wrong things: it fetches the full list for a single-ID query, and it binds the consumer to whatever filtering the list method applies. A dedicated `getLesson(id)` method is simpler (no in-consumer search), correct for all ID visibility, and more efficient (no full-list allocation just to find one item).
- **Never derive a "done" flag from a value that can legitimately be null.** `lessonTypeResolved = lessonType !== null` assumes that every valid lesson has a type. But a lesson might not exist at all, or might be excluded by a consumer's data source. Track resolution separately with a dedicated boolean.
- **Test the cross-cutting flow, not just the individual units.** The adapter `getLessons()` method had tests. The hook had tests with mocked adapters. The sidebar had tests. But no test exercised the full chain: click sidebar link -> hook resolves type -> player renders content. An integration smoke test that navigates to a companion PDF URL and asserts the PDF viewer appears would have caught this before the sidebar fix shipped.
- **When two adapter methods serve different visibility scopes, document the distinction in the interface JSDoc.** The original `getLessons()` had a comment about excluding companion PDFs, but it was buried in the implementation, not on the interface. An interface-level JSDoc comment on `getLessons()` stating "excludes companion PDFs; use for sequential navigation only" would have warned the hook author.

## Related Issues

- PR: https://github.com/PedroLages/knowlune/pull/496
- Plan: `docs/plans/2026-05-03-006-fix-companion-pdf-preview-resolve-plan.md`
- **Prerequisite fix** (sidebar discoverability): [course-content-sidebar-pdf-discoverability-2026-05-03.md](../ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md) — made companion PDFs visible in the sidebar. This fix addresses the second half of the chain: rendering the PDF once clicked.
- **Related pattern** (store-consumer wiring gaps): [lesson-chrome-store-consumer-integration-gaps-2026-05-02.md](../integration-issues/lesson-chrome-store-consumer-integration-gaps-2026-05-02.md) — same meta-pattern of a provider defining data that a consumer cannot reach, just in a different layer (adapter interface vs Zustand store).
- **Key files modified**: `src/lib/courseAdapter.ts`, `src/app/hooks/useLessonPlayerState.ts`, `src/lib/__tests__/courseAdapter.test.ts`, `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`, `src/app/components/course/__tests__/MaterialsTab.test.tsx`
