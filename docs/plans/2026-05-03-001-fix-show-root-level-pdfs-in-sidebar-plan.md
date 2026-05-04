---
title: "fix: Show root-level PDFs in course lesson sidebar"
type: fix
status: active
date: 2026-05-03
---

# fix: Show root-level PDFs in course lesson sidebar

## Overview

Remove the `displayGroups` filter in `LessonsTab.tsx` that hides standalone PDFs located at the course root directory. After the fix, all PDFs — regardless of directory depth — appear in the sidebar in their natural order alongside videos.

## Problem Frame

In the course lesson player (`UnifiedLessonPlayer`), the right sidebar renders the "Course Content" lesson list via `LessonsTab`. A filter on lines 566-574 intentionally excludes standalone PDFs whose `sourceMetadata.path` has no directory component (root-level). The filter comment states these are "course-level books/manuals — accessible via Materials tab."

The filter was introduced in commit `1b521f848` (April 5, 2026) as part of "video-first navigation and nested folder sidebar." Before that commit, ALL PDFs were excluded from the sidebar. The new approach was more inclusive (showing PDFs in subdirectories) but still excluded root-level ones.

In practice, this means:
- A course with a flat structure (all files in root) shows ZERO PDFs in the sidebar
- A course with mixed structure hides root-level PDFs (e.g., `syllabus.pdf`, `01-Resources.pdf`) while showing nested ones

Users cannot navigate to root-level PDF lessons from the sidebar — they can only reach them through the Materials tab's "View all" mode, which requires extra clicks and shows PDFs as inline viewers rather than navigable lesson links.

## Requirements Trace

- **R1.** All lessons (video and PDF, regardless of directory depth) appear in the sidebar in their natural `order` position, navigable via click to the lesson player.
- **R2.** Root-level standalone PDFs render with the same `LessonLink` row as other primary lessons — showing type icon (`FileText`), title, completion status, and page count where available.
- **R3.** The sidebar's "Lesson N of M" counter, search/filter, folder tree, and material group expansion continue to work correctly with the expanded lesson set.

## Scope Boundaries

- Only the root-level PDF exclusion filter is removed — no new components, no data model changes
- No changes to the Materials tab or how it renders PDFs
- No changes to companion PDF sub-rows (already implemented via `MaterialGroupRow` collapsible)
- No changes to navigation logic (`useLessonNavigation` already handles PDF lessons — they are returned in the flat lesson list and navigable)

## Context & Research

### Relevant Code and Patterns

- [src/app/components/course/tabs/LessonsTab.tsx:566-574](src/app/components/course/tabs/LessonsTab.tsx#L566-L574) — the filter to remove
- [src/app/components/course/tabs/LessonsTab.tsx:161-258](src/app/components/course/tabs/LessonsTab.tsx#L161-L258) — `LessonLink` already handles `type: 'pdf'` with `FileText` icon
- [src/app/components/course/tabs/LessonsTab.tsx:339-426](src/app/components/course/tabs/LessonsTab.tsx#L339-L426) — `MaterialGroupRow` already supports material sub-rows
- [src/lib/lessonMaterialMatcher.ts:254-261](src/lib/lessonMaterialMatcher.ts#L254-L261) — unmatched standalone PDFs become their own `MaterialGroup` with `primary: pdf, materials: []`
- [src/lib/lessonMaterialMatcher.ts:267-283](src/lib/lessonMaterialMatcher.ts#L267-L283) — `mergeByOrder` interleaves standalone PDF groups with video groups by `order`

### Institutional Learnings

- The brainstorm requirements doc (`docs/brainstorms/2026-05-02-course-lesson-player-polish-requirements.md`) R3 explicitly identifies PDFs as "invisible and unnavigable from the sidebar" — this aligns with the fix
- The implementation plan (`docs/plans/2026-05-02-002-feat-course-lesson-player-polish-plan.md`) Unit 3 implemented companion PDF sub-rows, but standalone PDF filtering was out of scope for that plan
- Design review (`docs/reviews/design/design-review-2026-04-05-lessonlist-sidebar-ux.md`) confirms `LessonsTab.tsx` is the live sidebar component — not `LessonList.tsx`

## Key Technical Decisions

- **Remove the filter entirely rather than making it conditional.** The original rationale (root-level PDFs are "course books") doesn't match how users organize their courses. The `order` field on each lesson already controls positioning — if a PDF should appear last, its `order` value reflects that. No need for a separate path-based exclusion mechanism.
- **No UI toggle or preference.** This is a fix restoring expected behavior, not a new feature. All lessons should be navigable from the sidebar.

## Implementation Units

- [ ] **Unit 1: Remove root-level PDF exclusion filter**

**Goal:** Stop hiding standalone PDFs at the course root from the sidebar lesson list.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`

**Approach:**
- Remove lines 565-574 (the `displayGroups` `useMemo` that filters out root-level PDFs)
- Replace all references to `displayGroups` with `materialGroups` throughout the component
- The `materialGroups` state variable already contains all groups (videos + standalone PDFs + companion PDFs) from `adapter.getGroupedLessons()`
- The `filteredGroups` memo (search filtering) continues to work — it already operates on `displayGroups`, so it will now operate on `materialGroups` instead
- Note: The search bar visibility threshold (`LESSON_SEARCH_THRESHOLD = 8`) now counts root-level PDFs. A course with 6 videos and 2 root-level PDFs will now show the search bar (8 ≥ 8). This is accepted — the threshold was already arbitrary and root-level PDFs are now sidebar peers of videos.

Specifically, the variables affected:
- `displayGroups` → replaced by `materialGroups`
- `showSearch` threshold check
- `filteredGroups` search memo input
- `folderTree` / `rootItems` memo inputs
- `groupIndexMap` memo input
- `currentIndex` computation
- Loading/empty state conditions
- Render branch conditions

**Approach (additional — page count in LessonLink):**
- `LessonLink` currently shows `duration` for videos (line 228-230) but nothing for PDFs. Add a parallel `pageCount` display so PDF rows show e.g. "24 pgs" — matching the pattern already used in `MaterialRow` (lines 324-329)
- The `lesson` prop already carries `sourceMetadata?.pageCount`; no prop changes needed
- Conditional: show page count when `lesson.type === 'pdf' && lesson.sourceMetadata?.pageCount`, otherwise fall through to the existing duration display

**Patterns to follow:**
- Existing `LessonLink` rendering for PDF type icon (lines 223-227)
- Existing `MaterialRow` page count display pattern (lines 324-329) — apply same pattern in `LessonLink`
- Existing `MaterialGroupRow` for groups with/without materials
- Existing folder tree rendering for nested paths

**Test scenarios:**
- Happy path: A course with a root-level standalone PDF renders it as a clickable `LessonLink` row with `FileText` icon in the sidebar
- Happy path: A course with mixed root-level videos and PDFs shows them interleaved by `order`
- Happy path: A course with nested PDFs (in subdirectories) continues to show them in their folder tree nodes
- Edge case: A course with ONLY root-level PDFs (no videos) shows all PDFs as lesson rows
- Edge case: Root-level PDFs that were previously hidden now appear in the "Lesson N of M" counter
- Edge case: Search filtering continues to match root-level PDF titles
- Integration: Clicking a root-level PDF lesson link navigates to the lesson player, which renders `PdfContent`

**Verification:**
- Root-level PDFs appear in the sidebar alongside videos in correct `order` position
- The sidebar counter reflects the total including PDFs
- No build errors, no type errors
- Existing tests pass

---

- [ ] **Unit 2: Update unit tests for expanded sidebar content**

**Goal:** Add test coverage for the now-visible root-level PDFs and verify existing sidebar behavior is preserved.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- Add a test case: sidebar renders a root-level standalone PDF as a lesson row with `FileText` icon
- Add a test case: sidebar renders a root-level PDF with its page count metadata
- Add a test case: mixed root-level videos and PDFs appear interleaved by `order`
- Verify existing tests still pass (no regressions)

**Patterns to follow:**
- Existing test patterns in `LessonsTab.test.tsx` (mock adapter, mock stores, render with wrapper)

**Test scenarios:**
- Happy path: PDF with `type: 'pdf'` and `path: 'syllabus.pdf'` (no directory) renders as a lesson row
- Happy path: PDF lesson row shows `FileText` icon (not `Video` icon)
- Happy path: PDF with `sourceMetadata.pageCount` shows page count in the row
- Edge case: PDF with empty `sourceMetadata.path` (falsy path) renders as a lesson row
- Regression: Video-only course renders identically to before
- Accessibility: All root-level PDF lesson rows have correct `aria-current` when active, tab order flows naturally through the expanded list, and screen readers announce the correct lesson count including PDFs

**Verification:**
- New tests pass
- All existing `LessonsTab.test.tsx` tests pass
- Full unit test suite passes (`npm run test:unit`)

## System-Wide Impact

- **Interaction graph:** The sidebar `LessonsTab` is the only consumer of the filter. `UnifiedLessonPlayer` passes `adapter` to `LessonsTab` but does not filter lessons itself. `useLessonNavigation` already returns all lesson types including PDFs.
- **Error propagation:** No change — the adapter's `getGroupedLessons()` error handling remains the same (catch sets `isLoading: false` without clearing `materialGroups`; stale data from a previous adapter is a pre-existing defect outside this fix's scope).
- **State lifecycle risks:** None. The `materialGroups` state is set once on mount via `useEffect`. Removing the derived `displayGroups` filter reduces derived state, which is a simplification.
- **API surface parity:** No API changes. The adapter interface is unchanged.
- **Integration coverage:** Navigation to a root-level PDF lesson triggers the existing `LessonContentRenderer` → `PdfContent` path, which is already tested.
- **Unchanged invariants:**
  - Companion PDF sub-rows under videos (collapsible `MaterialGroupRow`) are unchanged
  - Folder tree rendering (`buildFolderTree`, `FolderTreeNode`) is unchanged
  - Search/filter behavior is unchanged
  - Completion status display (checkmarks) is unchanged
  - `MaterialGroup` type and `getGroupedLessons()` return value are unchanged

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Root-level PDFs clutter the sidebar in courses with many reference materials | The `order` field controls positioning — course authors can assign high order values to move reference PDFs to the bottom. If this proves insufficient, a follow-up could add a "Show reference materials" toggle. |

## Sources & References

- **Filter origin:** commit `1b521f848` — `feat: video-first navigation and nested folder sidebar` (2026-04-05)
- Related requirements: `docs/brainstorms/2026-05-02-course-lesson-player-polish-requirements.md` (R3)
- Related plan: `docs/plans/2026-05-02-002-feat-course-lesson-player-polish-plan.md` (Unit 3)
- Related component: `src/app/components/course/tabs/LessonsTab.tsx`
- Related matcher: `src/lib/lessonMaterialMatcher.ts`
