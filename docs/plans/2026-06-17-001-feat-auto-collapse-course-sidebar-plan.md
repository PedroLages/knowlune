---
title: "feat: Auto-collapse previous section in Course Content sidebar when navigating between sections"
type: feat
status: completed
date: 2026-06-17
---

# feat: Auto-collapse previous section in Course Content sidebar

## Overview

When watching a course video, the Course Content sidebar shows expandable/collapsible sections (folders). Currently, when navigating from the last video in section 01 to the first video in section 02, section 02 auto-expands but section 01 stays expanded — the user must manually collapse it. This change makes the sidebar auto-collapse non-ancestor folders on navigation: only the ancestor folder chain of the currently active lesson stays expanded; all other folders auto-collapse. (This is not a strict accordion — deeply nested ancestors remain open together, e.g., `A`, `A/B`, and `A/B/C` all stay expanded when the active lesson is in `A/B/C`.)

## Problem Frame

The Course Content sidebar in `LessonsTab` manages folder expansion via `expandedFolders: Set<string>`. An auto-expansion `useEffect` merges ancestor folder paths of the active lesson into the set whenever `activePaths` changes. Because it merges (adds) rather than replaces, previously expanded folders **never auto-collapse** — they accumulate over time as the user navigates across sections, leaving the sidebar cluttered with multiple open sections.

The user's request: navigating to a different section should automatically close the previously open section and open only the new one.

## Requirements Trace

- R1. When the user navigates to a lesson in a different folder/section, all previously expanded folders that are not ancestors of the new lesson must auto-collapse.
- R2. On navigation, the ancestor folder chain of the active lesson must auto-expand. (A user's manual collapse of an ancestor folder persists until the next section-crossing navigation — R4 takes precedence for manual toggles.)
- R3. Navigating between lessons within the **same leaf folder** (i.e., two lessons both directly inside `01-Introduction/`) must not change folder expansion state. "Folder" here means any node in the folder tree at any depth — moving between sibling sub-folders (e.g., `A/B/C` → `A/B/D`) is a folder change that triggers collapse.
- R4. Manual folder toggles by the user must continue to work and persist until the next section-crossing navigation.
- R5. Search mode behavior (all folders force-opened) must remain unchanged.

## Scope Boundaries

- This change only affects the folder-level accordion in the Course Content sidebar (`LessonsTab.tsx`).
- Does **not** change the material-group (companion PDF) collapse behavior — that uses a separate state and mechanism.
- Does **not** change the `CourseOverview` syllabus accordion — that is a different component (`LessonList.tsx` / `CourseOverview.tsx`).
- Does **not** change mobile vs. desktop behavior — both render the same `LessonsTab`.
- Does **not** persist user expansion preferences across sessions (that is deferred to a separate task if needed).

## Context & Research

### Relevant Code and Patterns

- [src/app/components/course/tabs/LessonsTab.tsx](src/app/components/course/tabs/LessonsTab.tsx) — The component containing `expandedFolders` state and the auto-expansion `useEffect` (lines 604–615). This is the **only file** that needs modification.
- [src/app/components/course/tabs/LessonsTab.tsx:604](src/app/components/course/tabs/LessonsTab.tsx#L604) — `expandedFolders` state initialized from `activePaths`.
- [src/app/components/course/tabs/LessonsTab.tsx:607-615](src/app/components/course/tabs/LessonsTab.tsx#L607-L615) — The `useEffect` that currently merges ancestor paths (the bug).
- [src/app/components/course/tabs/LessonsTab.tsx:617-624](src/app/components/course/tabs/LessonsTab.tsx#L617-L624) — `toggleFolder` callback for manual user toggles.
- [src/app/components/course/tabs/LessonsTab.tsx:143-155](src/app/components/course/tabs/LessonsTab.tsx#L143-L155) — `getAncestorPaths()` computes the folder path chain to the active lesson.
- [src/app/components/ui/collapsible.tsx](src/app/components/ui/collapsible.tsx) — Radix UI `Collapsible` wrapper used by folder tree nodes.

### Institutional Learnings

- [docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md](docs/solutions/ui-bugs/course-content-sidebar-pdf-discoverability-2026-05-03.md) — Documents the dual-collapse pattern: folder-level (`expandedFolders`) and material-level (`expandedMaterialGroups`). The material-level auto-expand uses a sophisticated merge-only-new-IDs strategy (to preserve manual collapses); the folder-level auto-expand is simpler and should use a replace strategy instead.
- [docs/solutions/ui-bugs/lesson-badge-local-global-index-mismatch-2026-05-04.md](docs/solutions/ui-bugs/lesson-badge-local-global-index-mismatch-2026-05-04.md) — Documents the `groupIndexMap` pattern for computing global lesson indices within collapsible folder trees.

## Key Technical Decisions

- **Replace, don't merge in the auto-expand effect**: The current `useEffect` does `new Set(prev)` then adds `activePaths`. Changing it to set `new Set(activePaths)` directly gives the desired accordion behavior. This is the simplest possible change — one expression modified.
- **Keep manual toggle separate**: The `toggleFolder` callback remains unchanged. User manual expansions persist across re-renders of the same lesson but are naturally overwritten when `activePaths` changes (i.e., when navigating to a different section). This is the correct behavior — the auto-expand effect only fires on `activePaths` changes, so navigating between lessons in the same folder leaves manual toggles intact.
- **No new state or refs needed**: The existing `expandedFolders` state and `activePaths` memo are sufficient. No need for tracking "previously expanded by user" vs. "auto-expanded" — the timing of the effect (only on `activePaths` change) naturally separates the two.

## Open Questions

### Resolved During Planning

- **Should manual user expansions be preserved when navigating within the same section?**: Yes — the `useEffect` dependency is `activePaths.join(',')`, which does not change when navigating within the same folder tree. Manual toggles persist until the next section-crossing navigation.
- **Does this affect the mobile sheet?**: No — both desktop sidebar and mobile sheet render the same `LessonsTab` component. The fix applies uniformly.

### Deferred to Implementation

- **Exact test assertion selectors**: Will be determined by inspecting the DOM structure rendered by `FolderTreeNode`, specifically the `CollapsibleTrigger` data attributes or `aria-expanded` state of folder nodes.
- **Screen reader announcement of auto-collapse**: The `aria-expanded` attribute on `CollapsibleTrigger` updates automatically when folders collapse, providing baseline AT feedback. An `aria-live` region announcing section changes ("Showing section 2 of 5") is a potential future enhancement deferred to a separate accessibility pass.

## Implementation Units

### Unit 1: Change auto-expand effect from merge to replace ✅

**Goal:** Make the folder auto-expansion `useEffect` set `expandedFolders` to exactly the ancestor paths of the active lesson instead of merging into the previous set.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/tabs/LessonsTab.tsx`

**Approach:**
- In the `useEffect` at lines 607–615, remove the `if (activePaths.length > 0)` guard and replace the merge logic with a direct set. The guard must be removed because: (a) the functional updater `prev => new Set(prev)` the guard was protecting is being replaced with a direct value `new Set(activePaths)` that does not reference `prev`; (b) keeping the guard would leave stale expanded folders when navigating to a root-level lesson (where `activePaths` is `[]`), violating R1.
  ```ts
  // Before (lines 607-615 — merge, never collapses):
  useEffect(() => {
    if (activePaths.length > 0) {
      setExpandedFolders(prev => {
        const next = new Set(prev)
        for (const p of activePaths) next.add(p)
        return next
      })
    }
  }, [activePaths.join(',')])

  // After (replace — only current chain stays open, including root-level lessons):
  useEffect(() => {
    setExpandedFolders(new Set(activePaths))
  }, [activePaths.join(',')])
  ```
- The effect already only fires when `activePaths.join(',')` changes (i.e., when the active lesson moves to a different folder tree), so navigating within the same folder does not trigger a collapse. Search on/off cycles are safe because `activePaths.join(',')` returns to its original value when the folder tree returns to its unfiltered shape — the effect does not re-fire, preserving any manual toggles made before search.
- The `toggleFolder` callback is unchanged and continues to work; its changes persist until the next `activePaths` change.

**Patterns to follow:**
- The material-level auto-expand logic (lines 644–678) uses a different strategy (merge-only-new) because it serves a different UX purpose (discoverability of companion PDFs). Do not change that logic.
- The existing `activePaths` initialization via `useState(() => new Set(activePaths))` at line 604 already uses the replace pattern for first render.

**Test scenarios:**
- **Happy path — cross-section navigation:** Seed a course with two folder sections, each with 2+ lessons. Navigate from the last lesson in section 01 to the first lesson in section 02. Assert that section 01's folder is collapsed (`aria-expanded="false"` or `data-state="closed"` on the `Collapsible`) and section 02's folder is expanded.
- **Happy path — same-section navigation:** Navigate from lesson 1 to lesson 2 within the same folder section. Assert that no folder collapse/expand state changes occur.
- **Happy path — deeply nested folders:** Navigate from a lesson in `A/B/C` to a lesson in `A/B/D`. Assert that `A` and `A/B/D` are expanded, while `A/B/C` is collapsed.
- **Edge case — manual toggle persistence:** While on a lesson in section 02, manually expand section 01 via the chevron toggle. Assert both sections are expanded. Navigate to the next lesson in section 02. Assert section 01 remains expanded (same section, no `activePaths` change).
- **Edge case — manual toggle overwritten on section change:** While on a lesson in section 02, manually expand section 01. Then navigate to a lesson in section 03. Assert section 01 is now collapsed and only section 03's chain is expanded.
- **Edge case — single-section course:** A course with lessons all in one folder (or no folders). Assert no errors and the single section behaves normally (no collapse flicker).
- **Edge case — search mode:** Precondition: no manual folder expansions exist (start from a clean navigation state). Type in the search input. Assert all folders are force-opened (`forceOpen=true`). Clear search. Assert only the active lesson's ancestor chain stays expanded. (Search bypasses `expandedFolders` via `forceOpen`; `activePaths.join(',')` is unchanged when the folder tree returns to its original shape, so the effect does not re-fire. The precondition ensures a deterministic assertion.)
- **Edge case — search-click-navigate:** Type a search query that matches a lesson in a different folder. Click the search result to navigate. Assert that the new lesson's ancestor chain is expanded and the previous folder chain is collapsed. (The navigation triggers an `activePaths` change, which fires the replace effect.)
- **Edge case — root-level lesson navigation:** Navigate from a lesson inside a folder (e.g., `01-Introduction/video-1`) to a root-level lesson with no folder ancestor. Assert that all folders are collapsed (`activePaths` is `[]` → `expandedFolders` becomes an empty set).
- **Integration — collapse animation and accessibility:** The existing Radix UI `Collapsible` CSS transition drives the collapse animation by default (no new animation needed). Radix respects `prefers-reduced-motion` natively. React batches the state update so collapse and navigation render in the same frame — no intermediate flicker. Screen reader announcement of auto-collapse is deferred to a future accessibility pass (the `aria-expanded` attribute on the `CollapsibleTrigger` updates automatically, providing baseline AT feedback).

**Verification:**
- Build passes (`npm run build`).
- Manually verify: open a multi-section course, play through the last video in section 01, observe the sidebar auto-collapses section 01 when section 02 opens.
- Existing E2E tests for the lesson player continue to pass.

