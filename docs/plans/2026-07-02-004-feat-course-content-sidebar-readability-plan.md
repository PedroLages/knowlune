---
title: "feat: Course Content sidebar — readability and UX overhaul"
type: feat
status: active
date: 2026-07-02
---

# feat: Course Content sidebar — readability and UX overhaul

## Overview

The Course Content sidebar in the lesson player is nearly unreadable due to five compounding issues: URL-encoded folder/lesson names display raw (`Linux%20Administration%20Bootcamp`), the panel is too narrow for long names, the folder hierarchy wastes horizontal space with excessive indentation, text is aggressively truncated rather than wrapped, and the active lesson is hard to spot. This plan fixes each issue at the appropriate layer — data normalization at the adapter level, layout adjustments at the page level, and rendering improvements in the sidebar component — without touching lesson loading, progress tracking, notes, bookmarks, transcript, AI summary, the Materials tab, or the video player. (Search filtering logic is unchanged; only the search empty state UI is enhanced in Unit 6. `MaterialRow` styling changes in the sidebar are in scope — "materials" here refers to the standalone Materials tab component.)

## Problem Frame

Learners using imported courses (server URL, local folder) see the right sidebar as a dense, unreadable tree rather than a scannable table of contents. The sidebar should help users navigate a course confidently; instead, users cannot tell where they are, what comes next, or even what the lessons are called.

Root causes identified:
1. **`humanizeFilename()` in `courseAdapter.ts`** does not call `decodeURIComponent()` — it strips extensions and numeric prefixes but passes `%20` through unchanged.
2. **`buildFolderTree()` in `LessonsTab.tsx`** uses raw path segments as folder display names — same `%20` problem for folder nodes.
3. **Sidebar width** is `w-96` (384px) — adequate for short names but insufficient when deep nesting consumes ~48px of left margin before lesson text begins.
4. **Text truncation** uses `truncate` (single-line ellipsis) — names like `Linux Administration Bootcamp: Complete Guide to...` become illegible.
5. **Folder nesting** renders every directory level, including container folders like `DevOps/DevOps-Platform-Engineer/` that carry no lessons and only serve as organizational wrappers — adding indentation without information.

## Requirements Trace

- **R1.** No `%20` or other URL-encoded characters visible in the sidebar. *(source: feature request §1)*
- **R2.** Course content is readable at normal desktop width — long section and lesson names are understandable without hovering. *(source: feature request §2, §4)*
- **R3.** The active lesson is visually obvious — highlighted, with a "Now playing" indicator, and auto-scrolled into view. *(source: feature request §5)*
- **R4.** The current section is auto-expanded; previously expanded sections collapse when navigating across sections (accordion behavior). *(already implemented by 2026-06-17 plan; verify no regression)*
- **R5.** Search matches human-readable titles (not raw encoded names). *(source: feature request §6)*
- **R6.** Sidebar header shows course title, current lesson number / total, and progress percentage. *(source: feature request §7)*
- **R7.** Video player, lesson routing, notes, bookmarks, transcript, AI summary, and materials continue to work without regression. *(source: feature request §10)*
- **R8.** Collapsible sections are keyboard-accessible. Active lesson has `aria-current`. Focus indicators are visible. *(source: feature request §9)*
- **R9.** Empty and error states are handled gracefully — no crashes on malformed names or missing metadata. *(source: feature request §8)*
- **R10.** The design stays consistent with the existing dark theme and visual language — no page-wide redesign. *(source: feature request §10)*

## Scope Boundaries

- **In scope:** `LessonsTab` rendering, `humanizeFilename()` normalization, `UnifiedLessonPlayer` sidebar width and header, folder tree display names, text readability (line-clamp, tooltips, font sizing), active lesson highlighting, focus indicators, search empty state.
- **Out of scope:** Redesign of the video player chrome, Materials tab, Notes panel, Transcript tab, AI Summary panel, bookmarks, or the `PlayerSidePanel` tab container (already unused in the current layout). No changes to the `LessonList` component on course detail pages. No changes to the import pipeline — data normalization happens at the adapter/display layer, not at ingestion.
- **Unchanged invariants:** `LessonItem.id` values, `MaterialGroup` structure, `CourseAdapter` interface, lesson routing URLs (`/courses/:courseId/lessons/:lessonId`), `useContentProgressStore` API, `getGroupedLessons()` return shape, folder path keys used for `expandedFolders` state, search filtering logic (already works on `LessonItem.title` — fixing `humanizeFilename` fixes search automatically).

### Deferred to Separate Tasks

- **Persistent section expansion preferences across sessions:** Currently expansion state resets on page load. Deferred to a future story.
- **Virtualized/scrolling lesson list for courses with 200+ lessons:** Current DOM rendering is adequate; defer until performance data shows need.
- **Sidebar resizable drag handle:** Currently the sidebar is fixed-width (`w-96` → `w-[400px]`). Making it user-resizable would require integrating into the `ResizablePanelGroup` and is deferred to avoid competing with notes panel resize behavior.
- **Focus management after lesson navigation:** When a user clicks a sidebar lesson link, keyboard focus remains on the clicked link rather than moving to the main content area. This is a broader SPA navigation concern affecting all lesson navigation, not specific to this sidebar — deferred to a separate accessibility pass.
- **Accessible tooltip component:** The `title` attribute provides a native fallback for truncated names but has known limitations (invisible on touch, inconsistent screen reader exposure). A Radix `Tooltip` component from the existing UI library would be more robust — deferred to a separate accessibility enhancement.

## Context & Research

### Relevant Code and Patterns

- [src/app/components/course/tabs/LessonsTab.tsx](src/app/components/course/tabs/LessonsTab.tsx) — Primary change target. Contains `buildFolderTree()`, `FolderTreeNode`, `LessonLink`, `MaterialGroupRow`, `HighlightedLessonTitle`, search, `expandedFolders`/`expandedMaterialGroups` state, auto-expand effects. ~843 lines.
- [src/lib/courseAdapter.ts](src/lib/courseAdapter.ts) — Contains `humanizeFilename()` at lines 25-32. Called by `LocalCourseAdapter.buildVideoLessons()` and `buildPdfLessons()` to produce `LessonItem.title`. Also imported directly by `LessonList.tsx` and `sessionQualityCourseGate.ts`.
- [src/app/pages/UnifiedLessonPlayer.tsx](src/app/pages/UnifiedLessonPlayer.tsx) — Desktop sidebar container at line 704: `w-96`, `sticky`, `bg-card rounded-2xl`. Header at lines 708-710 with course name and "Course Content" subtitle. Mobile sheet trigger at lines 767-790.
- [src/lib/courseServerService.ts](src/lib/courseServerService.ts) — `parseAutoindex()` already calls `decodeURIComponent(href)` at line 105. The filename pipeline has the decode at ingest but `humanizeFilename` doesn't re-decode as a safety net.
- [src/lib/lessonMaterialMatcher.ts](src/lib/lessonMaterialMatcher.ts) — `parseFilenameComponents()` normalizes stems for matching. Already handles decoded names — no change needed; fixing `humanizeFilename` improves match quality automatically.
- [src/app/components/ui/collapsible.tsx](src/app/components/ui/collapsible.tsx) — Radix UI `Collapsible` wrapper used by `FolderTreeNode` and `MaterialGroupRow`.

### Institutional Learnings

- **Course Content sidebar PDF discoverability** (`docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md`): The `materialCount` badge uses `text-[10px] px-1.5 py-0 h-4` — extremely small. In a sidebar readability pass, increase badge size or simplify the visual weight.
- **Fill-height flex chain** (`docs/solutions/best-practices/notes-panel-fill-height-flex-chain-2026-05-23.md`): Every layer between viewport and scroll leaf needs `flex-1 min-h-0`. If restructuring the sidebar layout, preserve this chain.
- **Focus ring token** (`docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`): Use `focus-visible:ring-2 ring-focus-ring` on lesson links and folder triggers — the dedicated `--focus-ring` token guarantees visibility against any background including `bg-brand-soft` active state.
- **Fixed dark scrim pattern** (`docs/solutions/best-practices/learning-track-detail-cinematic-redesign-implementation-lessons-2026-06-01.md`): White text over black scrim at ≥0.70 opacity guarantees WCAG AA in all themes. Use for any overlay indicators on the active lesson.
- **Persist Before Navigate** (`docs/engineering-patterns.md` lines 439-453): Lesson link clicks trigger React Router navigation — if adding any pre-navigation save logic, save before `navigate()`.
- **Semantic State Over Computed Style** (`docs/engineering-patterns.md` lines 867-888): Use `data-*` attributes for testable visual states (e.g., `data-active="true"`) rather than asserting computed CSS values.
- **Auto-collapse plan** (`docs/plans/2026-06-17-001-feat-auto-collapse-course-sidebar-plan.md`): The folder auto-expand/collapse effect was recently fixed (replace strategy, not merge). Preserve this behavior — the `useEffect` at line 613-615 is correct.

### External References

- None required — all patterns are established locally.

## Key Technical Decisions

- **Decode at display layer, not at ingestion:** Apply `decodeURIComponent()` in `humanizeFilename()` and `buildFolderTree()` segment names rather than re-importing courses. This is a safe defensive fix — already-decoded strings pass through `decodeURIComponent` unchanged (it only transforms `%XX` sequences), and a `try/catch` wrapper handles malformed sequences gracefully. Rationale: avoids a data migration, works for all existing courses immediately, and protects against future import sources that may produce encoded filenames.
- **Skip single-child-only root folders:** Walk the folder tree from root and flatten nodes that have exactly one child and zero direct items. The innermost skipped folder name is **always** displayed as a breadcrumb subtitle in the sidebar header (e.g., "DevOps Platform Engineer › Linux Administration Bootcamp"), guaranteeing the structural context is never lost. Rationale: removes `DevOps > DevOps-Platform-Engineer >` container indentation while preserving hierarchy context. The full paths remain intact for routing and expanded state. The display roots are always derived from the full folder tree (single source of truth), never stored independently.
- **Line-clamp, not truncate:** Change `truncate` to `line-clamp-2` on lesson titles and `line-clamp-2` on section names. Rationale: `truncate` cuts mid-word at ~25 characters (depending on font size); `line-clamp-2` gives ~50-60 characters, enough for most real-world lesson names.
- **`title` attribute for native tooltips:** Add `title={lesson.title}` on links and `title={node.name}` on folder triggers. Rationale: zero-JS, works in all browsers, accessible to screen readers — no tooltip library needed.
- **`w-[400px]` sidebar width:** Increase from `w-96` (384px) to `w-[400px]` (a 16px gain). Combined with reduced nesting indentation, this recovers ~40-50px of usable text space. Rationale: incremental — large enough to matter, small enough to not crush the video area. The sidebar already hides in theater mode and when the notes panel is open. If extreme-length lesson names remain problematic, increasing to 440px or adding a user-resizable panel are follow-up options — monitor after deployment.
- **Line-clamp-2 scanning tradeoff:** Using 2-line titles reduces the number of visible items per viewport compared to single-line truncation. However, real-world course lesson titles frequently exceed 25 characters (the single-line truncation threshold), making the extra line necessary for comprehension. The net effect is that users see fewer items at a glance but can actually read each one — a worthwhile tradeoff for a learning context where lesson titles carry semantic meaning. The density impact is mitigated by keeping padding and icon sizes unchanged (only the text layout changes).

## Open Questions

### Resolved During Planning

- **Should `humanizeFilename` or the folder tree do the decoding?** Both. `humanizeFilename` fixes lesson titles everywhere they're used (sidebar, course detail page, search). Folder tree segment decoding fixes folder names displayed in `FolderTreeNode`. The two fixes are independent and complementary.
- **What width should the sidebar be?** 400px (`w-[400px]`). User requested 360-440px; 400px is mid-range. The current 384px is close but the indentation reduction effectively adds more readable space than the raw pixel increase suggests.
- **Should the sidebar be resizable?** No — deferred. Making it resizable requires integrating into the `ResizablePanelGroup` which already manages the video/notes split. Adding a second drag handle creates UX conflicts. The sidebar already hides in theater mode and when notes are open.

### Deferred to Implementation

- **Exact number of folder levels to skip:** The flattening algorithm (skip single-child-only nodes) is defined; the exact stopping heuristic (stop when node has direct items OR multiple children) will be tuned against real course data during implementation.
- **Exact progress percentage source:** May use `useContentProgressStore` aggregated across all lessons, or a simpler `completedCount / totalCount` from material groups. Determine during implementation based on performance of the Zustand selector.
- **Font size adjustments:** Keep lesson titles at `text-sm` (already reasonable). Increase folder/section names from `text-xs` to `text-sm`. Exact sizes to be validated visually against the design system.

## Implementation Units

### Unit 1: Decode URL-encoded characters in lesson and folder names

**Goal:** Eliminate all `%20` and other URL-encoded sequences from the Course Content sidebar.

**Requirements:** R1, R5, R9

**Dependencies:** None

**Files:**
- Modify: `src/lib/courseAdapter.ts`
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/lib/__tests__/courseAdapter.test.ts`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- Add a `safeDecodeURIComponent(s: string): string` helper (try/catch wrapper around `decodeURIComponent`) in `courseAdapter.ts`.
- In `humanizeFilename()`, call `safeDecodeURIComponent(filename)` as the first operation, before stripping extensions/prefixes.
- In `buildFolderTree()` (LessonsTab.tsx line 120), apply `safeDecodeURIComponent(segments[i])` when creating the folder node's `name` property. The `path` key (used for expanded state) must remain the raw encoded path to match the source data.
- Import `humanizeFilename`'s decode helper or duplicate the one-liner in `LessonsTab.tsx` — prefer extracting to a shared location if both files need it.

**Patterns to follow:**
- Existing `decodeURIComponent` usage in `courseServerService.ts:105` and `courseImport.ts:1395` — same pattern, same try/catch safety approach.
- `humanizeFilename` already handles edge cases (no extension, leading numbers, underscores) — the decode step is purely additive at the start of the pipeline.

**Test scenarios:**
- **Happy path — `%20` in filename:** `humanizeFilename("01%20-%20Overview.mp4")` → `"01 - Overview"`. Verify the numeric prefix is preserved, `%20` becomes space.
- **Happy path — complex encoding:** `humanizeFilename("Linux%20Administration%20Bootcamp%3A%20Guide.mp4")` → `"Linux Administration Bootcamp: Guide"`.
- **Happy path — already decoded input (idempotent):** `humanizeFilename("01 - Introduction.mp4")` → `"Introduction"` (unchanged behavior for already-clean names).
- **Happy path — folder segment:** `buildFolderTree` with path `"Linux%20Admin/01%20-%20Setup/video.mp4"` → folder nodes display "Linux Admin" and "01 - Setup", not encoded strings.
- **Edge case — malformed encoding:** `humanizeFilename("bad%ZZfile.mp4")` → does not throw; returns `"bad%ZZfile"` (stripped extension, encoding left as-is since `decodeURIComponent` throws on `%ZZ`).
- **Edge case — empty string:** `humanizeFilename("")` → `""` (no error).
- **Edge case — only encoded chars:** `humanizeFilename("%20%20%20.mp4")` → `""` (stripped to whitespace then trimmed).
- **Integration — search still works:** After decoding, searching for "Overview" matches a lesson whose raw filename was `01%20-%20Overview.mp4`.

**Verification:**
- No `%20` visible in the Course Content sidebar for any imported course (local or server).
- Existing tests in `courseAdapter.test.ts` continue to pass (update expected values for any test that used encoded filenames as input).
- `LessonsTab` renders folder names and lesson titles without URL-encoded characters.

---

### Unit 2: Improve sidebar width and header information architecture

**Goal:** Give the sidebar more horizontal space and show useful context in the header.

**Requirements:** R2, R6, R7, R10

**Dependencies:** None (can ship independently of Unit 1)

**Files:**
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`
- Test: `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`

**Approach:**
- Change sidebar width from `w-96` to `w-[400px]` at line 704.
- Enhance the sidebar header (lines 708-710) to show: course title (larger, with `line-clamp-1`), "Lesson X of Y" count, and a subtle progress bar or percentage.
- The course title is already available via `course?.name`. Lesson count: the "Lesson X of Y" counter uses `materialGroups.length` for Y and `currentIndex + 1` for X (matching the existing behavior at line 772). This counts primary lesson groups, not individual companion PDF sub-rows.
- Progress percentage: compute from `useContentProgressStore` by counting completed lesson statuses across all lessons in the course, or accept as a prop from the parent.
- **Progress loading state:** Show a subtle skeleton or `"-- %"` placeholder while the progress computation is pending, avoiding a flash of `0%` that would be misleading.
- Keep the "Course Content" label as a smaller subtitle or replace it with the lesson count.
- Ensure the sidebar still hides correctly in theater mode and when notes panel is open.

**Patterns to follow:**
- Existing header pattern at lines 708-710: `px-4 py-3 border-b border-border flex-shrink-0`.
- Progress display: the `CourseProgress` component in `UnifiedCourseDetail.tsx` shows course-level progress — use a simplified inline variant (e.g., a subtle text percentage + thin progress bar).

**Test scenarios:**
- **Happy path — header displays info:** Navigate to a lesson. Sidebar header shows course name, "Lesson 3 of 82", and a progress indicator.
- **Happy path — width is wider:** At desktop (≥1024px), sidebar renders at 400px width. Video area remains usable (no horizontal scroll at common viewport widths).
- **Edge case — course with 1 lesson:** Header shows "Lesson 1 of 1", progress shows 0% or 100% depending on completion.
- **Edge case — very long course name:** Course name is clamped to 1 line with ellipsis; full name available via `title` attribute.
- **Regression — theater mode:** Sidebar is hidden when theater mode is active.
- **Regression — notes panel open:** Sidebar is hidden when desktop notes panel is open.
- **Regression — mobile:** On mobile, the sidebar is accessed via floating button sheet (unchanged).

**Verification:**
- Sidebar is noticeably wider on desktop and can display longer lesson names.
- Header gives clear context about course and position.
- No layout breakage at common viewport widths (1024px, 1280px, 1440px, 1920px).

---

### Unit 3: Reduce visual nesting by skipping single-child container folders

**Goal:** Remove unnecessary indentation levels from the folder tree without losing the section/lesson hierarchy.

**Requirements:** R2, R7, R9

**Dependencies:** Unit 1 (works correctly with decoded names but is not blocked by it)

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- Add a `getDisplayRoots(nodes: FolderNode[]): FolderNode[]` function that walks the tree and skips nodes that have exactly one child and zero direct items. This effectively flattens `DevOps > DevOps-Platform-Engineer > CourseName` down to just `CourseName` (or its children, if CourseName also has no direct items).
- The function recurses: if a node has no direct items and exactly one child, skip it by returning `getDisplayRoots([child])`. If the node has direct items OR multiple children, keep it but recursively flatten its children. The recursion applies at every level — not just the root — so intermediate single-child-only nodes are also skipped. (The test scenario for `A/B/C/lesson` + `A/B/D/lesson` correctly expects A to be skipped but B to remain — B has two children C and D, so it stays as a top-level folder with C and D as subfolders.)
- Apply `getDisplayRoots` to `folderTree` before passing it to the render logic. The `hasMultipleFolders` branching gate must also use the flattened display roots (not the raw `folderTree`) so the branch selection matches what is actually rendered.
- The original `folderTree` is still used for `getAncestorPaths()` (which needs the full hierarchy for path-based lookups). The display logic uses the flattened roots.
- If significant root nodes were skipped, extract the innermost skipped folder name and display it in or near the sidebar header (as additional context). This can be done by tracking the last skipped name during the flatten walk.

**Patterns to follow:**
- Existing tree manipulation in `LessonsTab`: `buildFolderTree()`, `getAncestorPaths()`, `nodeContainsLesson()` — all pure functions operating on `FolderNode[]`.
- The `rootItems` pattern (lines 592-598) that separates root-level items from folder items — similar concept extended.

**Test scenarios:**
- **Happy path — deep nesting flattened:** A course with path `DevOps/DevOps-Platform-Engineer/Linux Admin/01-Overview/video.mp4` renders "01-Overview" as a top-level folder (skipping the three container levels).
- **Happy path — mixed items and folders:** Root has both direct items AND a subfolder → root stays, items render flat, subfolder renders as child folder.
- **Happy path — single folder with items:** A course with `Section 01/lesson.mp4` (one level of nesting with items in the section) renders "Section 01" as top-level folder.
- **Edge case — flat course (no folders):** `buildFolderTree` returns empty roots, all items in `rootItems`. `getDisplayRoots([])` returns `[]`. Flat list renders as before.
- **Edge case — multiple top-level folders:** Two sibling folders `A/lesson.mp4` and `B/lesson.mp4` → both stay as top-level folders (multiple children means no skip).
- **Edge case — deeply nested with multiple branches:** `A/B/C/lesson1.mp4` and `A/B/D/lesson2.mp4` → A and B are skipped (single child each), C and D become top-level folders.
- **Regression — search mode:** When `searchQuery` is set, `forceOpen=true` on all folders. The flattening does not affect search behavior (search still matches lesson titles, not folder names).
- **Regression — active lesson expansion:** `getAncestorPaths` still uses the full `folderTree` for path computation. Auto-expand continues to work correctly even though display roots are flattened.

**Verification:**
- For a typical nested course (3+ container levels), the sidebar shows at most 1-2 levels of folder nesting above the lessons.
- Active lesson auto-expand still works correctly.
- Folder collapse/expand keyboard interaction unchanged.

---

### Unit 4: Improve text readability — line-clamp, tooltips, font sizing

**Goal:** Make section and lesson names readable without sacrificing information density.

**Requirements:** R2, R8, R10

**Dependencies:** Unit 3 (works best with reduced nesting, not blocked)

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- In `LessonLink` (line 223): Change `truncate` to `line-clamp-2` on the title `<p>`. Add `title={lesson.title}` to the wrapping `<Link>` for native tooltip on hover.
- In `MaterialRow` (line 327): Same change — `truncate` → `line-clamp-2`, `title` attribute.
- In `FolderTreeNode` (line 480): Change the folder name span from `text-xs truncate` to `text-sm line-clamp-2`. Add `title={node.name}`.
- For completion strikethrough text: verify it still works with `line-clamp-2` (CSS `line-through` works on multi-line text).
- **Spacing and icon sizes preserved:** Keep existing `py-2` padding, `size-3.5` icon sizes, and badge dimensions (`text-[10px]`, `h-4`) unchanged to maintain vertical density. The readability gains come from text layout changes alone — no spacing increases.

**Patterns to follow:**
- Existing `line-clamp-2` usage in the codebase (Tailwind v4 utility).
- Design token cheat sheet for text sizing and spacing.
- `title` attribute usage already present on some interactive elements in the app.

**Test scenarios:**
- **Happy path — long lesson name:** A lesson titled "Complete Guide to Linux Administration and System Configuration for DevOps Engineers" wraps to 2 lines instead of truncating mid-word.
- **Happy path — tooltip on hover:** Hovering over a truncated lesson name shows the full title in a native browser tooltip.
- **Happy path — section name wraps:** A folder name like "Advanced Configuration and Troubleshooting Techniques" wraps to 2 lines.
- **Edge case — very long single word:** A filename like "Supercalifragilisticexpialidocious.mp4" (no spaces) still truncates with ellipsis after 2 lines of the word — acceptable, rare edge case.
- **Regression — completion strikethrough:** A completed lesson with a 2-line title shows strikethrough across both lines.
- **Regression — search highlight:** `<mark>` highlighting works correctly on wrapped text.
- **Accessibility — keyboard focus:** `FolderTreeNode` trigger receives visible focus ring via `focus-visible:ring-2 ring-focus-ring`.

**Verification:**
- Lesson titles that were previously truncated mid-word are now readable.
- Section/folder names have better visual weight and readability.
- No layout shifts or overflow issues in the sidebar.

---

### Unit 5: Enhance active lesson state and focus indicators

**Goal:** Make the currently playing lesson instantly identifiable and add proper keyboard focus indicators.

**Requirements:** R3, R4, R8

**Dependencies:** Unit 4 (refined text styles provide a better base for active state)

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- **Active lesson indicator:** Keep the existing `bg-brand-soft text-brand-soft-foreground` background. Change the `PlayCircle` icon from `size-3.5` to `size-4` and add a "Now playing" text label at `text-[11px] text-brand font-medium` next to the duration/metadata line. This gives a clear text cue without consuming horizontal title space. The play icon + label are sufficient; no left-border accent is needed (avoids indicator overload — 3 visual cues: background, icon, text label).
- **Focus indicators:** Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1` to lesson links and folder trigger buttons. Per the institutional learning, the `--focus-ring` token guarantees visibility against any background.
- **Auto-expand verification:** The existing effect at lines 613-615 already sets `expandedFolders` to a new `Set(activePaths)` on lesson change. Verify this works correctly with the flattened folder tree from Unit 3.
- **Scroll into view:** The existing `useEffect` at lines 571-575 already scrolls `activeRef.current` into view. Change `block: 'center'` to `block: 'nearest'` — the active lesson scrolls just enough to be visible rather than always centering.
- **`aria-current`:** Already present on `LessonLink` (line 202) and `MaterialRow` (line 301). Verify correctness.

**Patterns to follow:**
- Focus ring: `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md` — use `ring-focus-ring`, not `ring-ring`.
- Left border accent: existing pattern in the codebase uses `border-l-2 border-brand` for active nav items.
- Semantic state: add `data-active="true"` attribute on active lesson link for testability (per `docs/engineering-patterns.md` lines 867-888).

**Test scenarios:**
- **Happy path — active lesson highlighted:** The active lesson has `bg-brand-soft` background + left border accent + play icon. It is visually distinct from all other lessons.
- **Happy path — "Now playing" visible:** The active lesson shows a small "Now playing" label or a clearly distinguishable play icon.
- **Happy path — section auto-expanded:** Navigating to a lesson auto-expands its ancestor folder chain. Other folders are collapsed.
- **Happy path — scroll into view:** On page load, the active lesson is scrolled into the visible area of the sidebar.
- **Accessibility — keyboard focus:** Tab-navigating through lesson links and folder triggers shows a visible focus ring on each element.
- **Accessibility — aria-current:** The active lesson link has `aria-current="page"`.
- **Regression — completion checkmark:** Completed (but not active) lessons still show the green checkmark, not the play icon.
- **Regression — MaterialRow focus:** Material sub-rows also show focus indicators when tabbed.

**Verification:**
- The active lesson is obvious at a glance — even in a long list.
- Keyboard navigation through the sidebar is fully visible and meets WCAG focus indicator requirements.
- The previous auto-collapse behavior (2026-06-17 plan) is preserved.

---

### Unit 6: Improve search empty state and error handling

**Goal:** Ensure the sidebar degrades gracefully when lessons fail to load or search yields no results.

**Requirements:** R5, R9

**Dependencies:** Unit 1 (search works on decoded titles automatically)

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`
- Test: `src/app/components/course/__tests__/LessonsTab.test.tsx`

**Approach:**
- **Search empty state:** The current empty state (lines 775-782) uses a `Search` icon and "No lessons match your search" text. Enhance with a subtle suggestion: "Try a different search term or clear the filter." Add a "Clear search" button inline (currently only available via the X button in the search input).
- **Error state:** The current `catch` at line 561 is silent (`silent-catch-ok`). Enhance it to set an `error` state that renders an `EmptyState` component with: `AlertTriangle` icon (lucide-react), title "Failed to load course content", description "Please check your connection and try again", and a `Button variant="outline"` for "Retry". The layout uses the existing centered `EmptyState` pattern (icon at top, text below, button at bottom).
- **Retry mechanism:** Add a `retryCount` state (`useState(0)`) and include it in the load `useEffect` dependency array alongside `adapter`. The Retry button's `onClick` increments `retryCount`, causing the effect to re-run and re-call `adapter.getGroupedLessons()`.
- **Malformed data safety:** In `buildFolderTree()`, guard against items without `sourceMetadata.path` (already handled by `getDirPath` which defaults to `''`). Add a try/catch around the tree building to fall back to a flat list if any unexpected data shape causes an exception.
- **Search result count:** Already shows "Showing X of Y lessons" — keep this. Ensure it updates correctly after Unit 1's title normalization.

**Patterns to follow:**
- Existing `EmptyState` component in `src/app/components/EmptyState.tsx` — already used for the empty lessons state (line 732).
- Error handling pattern: `docs/engineering-patterns.md` — catch → set error state → render recovery UI.

**Test scenarios:**
- **Happy path — search with no matches:** Typing "xyznonexistent" shows the empty state with helpful message and clear button.
- **Happy path — search then clear:** Typing a query, seeing filtered results, then clicking "Clear search" restores the full list.
- **Error path — adapter throws:** If `adapter.getGroupedLessons()` rejects, an error message with retry button is shown instead of an empty list.
- **Edge case — malformed path:** A lesson with `sourceMetadata.path = null` or missing `sourceMetadata` does not crash the tree builder.
- **Edge case — 0 lessons:** Empty course shows the existing `EmptyState` component (unchanged).

**Verification:**
- Search empty state is helpful and actionable.
- Error states are visible and offer recovery.
- No crashes on malformed course data.

---

## System-Wide Impact

- **Interaction graph:** `UnifiedLessonPlayer` → desktop sidebar container → `LessonsTab`. `LessonsTab` is also rendered inside the mobile `Sheet`. No other consumers of `LessonsTab`. `humanizeFilename` is also used by `LessonList` (course detail page) — the decode fix benefits that component too.
- **Error propagation:** Adapter load failures are caught in `LessonsTab` and (after Unit 6) rendered as an error state. No error propagation changes.
- **State lifecycle risks:** The `expandedFolders` state uses path keys — these must remain the raw (encoded) paths for consistency. The display name decoding in `buildFolderTree` only affects `node.name`, not `node.path`. Verified safe.
- **API surface parity:** `CourseAdapter` interface unchanged. `getGroupedLessons()` return type unchanged. `LessonItem.title` now returns decoded titles (breaking change in value, not type) — all consumers already render titles as display text, so this is a fix, not a break.
- **Unchanged invariants:** Lesson routing URLs, `MaterialGroup` structure, `useContentProgressStore` status keys, `expandedFolders` path keys, `expandedMaterialGroups` group IDs, `onFocusMaterials` callback signature — all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `humanizeFilename` decode changes lesson titles used as keys/identifiers | `LessonItem.id` is the canonical identifier, not `title`. Titles are display-only. Verified that no code path uses `title` for lookup or equality checks. |
| Folder tree flattening breaks auto-expand path matching | `getAncestorPaths` continues to use the full `folderTree`, not the flattened display roots. Path keys are preserved. |
| Wider sidebar + reduced nesting may still not be enough for extreme cases | Accept for now. Names longer than ~50 chars will still line-clamp. The `title` tooltip provides fallback access. |
| `decodeURIComponent` throws on malformed sequences | Wrapped in try/catch — returns original string on failure. |

## Documentation / Operational Notes

- No docs changes required. The sidebar behavior change is self-documenting in the UI.
- No new environment variables, API changes, or deployment considerations.

## Sources & References

- **Feature request:** `/ce-plan` invocation with detailed sidebar UX requirements (2026-07-02)
- Related plan (auto-collapse): [docs/plans/2026-06-17-001-feat-auto-collapse-course-sidebar-plan.md](docs/plans/2026-06-17-001-feat-auto-collapse-course-sidebar-plan.md)
- Related plan (PDF discoverability): [docs/plans/2026-05-03-003-feat-course-content-sidebar-pdf-access-plan.md](docs/plans/2026-05-03-003-feat-course-content-sidebar-pdf-access-plan.md)
- Learnings: [docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md](docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md)
- Learnings: [docs/solutions/2026-04-25-focus-ring-token-additive-migration.md](docs/solutions/2026-04-25-focus-ring-token-additive-migration.md)
- Patterns: [docs/engineering-patterns.md](docs/engineering-patterns.md)
