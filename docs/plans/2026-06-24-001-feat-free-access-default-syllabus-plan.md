---
title: "feat: Make syllabus courses freely accessible by default"
type: feat
status: active
date: 2026-06-24
---

# feat: Make syllabus courses freely accessible by default

## Overview

Change the default learning track progression mode from `'sequential'` (courses lock until the previous one is completed) to `'free'` (all courses accessible at any time). The "Free access" toggle in the sidebar already exists and works correctly — this plan makes free access the default and adds a syllabus-level toggle so users who prefer guided sequential learning can still opt in.

> **Terminology:** The data model uses `LearningPath` (store, types) while the UI uses "Learning Track" (route, navigation). These refer to the same concept — this plan uses "learning track" in prose and `LearningPath` in code references.

## Problem Frame

Users navigating to `/learning-tracks/:id` see syllabus courses locked with `opacity-60 pointer-events-none` and no action button. They cannot click into a course until they complete all prior courses. A "Free access" toggle exists in `PathProgressSidebar` but is invisible on mobile/tablet (the sidebar is below the fold or absent), and locked course entries give zero indication that a free-access mode exists. The result: users believe sequential completion is mandatory.

## Requirements Trace

- **R1.** All courses in a learning track syllabus are clickable and navigable by default — no courses appear locked on first visit.
- **R2.** The progression mode control (sequential ↔ free) remains available for users who prefer guided sequential learning.
- **R3.** When a user switches from free to sequential mode, the syllabus visually reflects which courses are locked and which are available, consistent with existing locked/available state rendering.
- **R4.** The progression mode control is discoverable at all viewport widths (mobile, tablet, desktop).

## Scope Boundaries

- No changes to how course progress is computed or how completion percentages are displayed.
- No changes to the hero banner CTA ("Start Learning" / "Continue Learning") — it continues to target the first incomplete or in-progress course.
- No changes to the `useNextBestCourse` hook or Overview page resume logic.
- No new data model fields — `LearningPath.progressionMode` already exists.
- No changes to the `@dnd-kit` drag-and-drop reordering in edit mode.

## Context & Research

### Relevant Code and Patterns

- **Progression mode type:** `src/data/types.ts:503-504` — `PathProgressionMode = 'sequential' | 'free'`
- **Store persistence:** `src/stores/useLearningPathStore.ts:303-337` — `setProgressionMode()` writes to Dexie via `syncableWrite`
- **Timeline locking:** `src/app/components/learning-path/PathTimeline.tsx:215` — `isLocked = isFreeMode ? false : !isCompleted && !isInProgress`
- **Sidebar toggle:** `src/app/components/learning-path/PathProgressSidebar.tsx:173-208` — "Free access" Switch, only rendered when `courseCount > 1`
- **Creation paths in store:** `createPath()` (~line 191), `createPathWithCourses()` (~line 1096), and `forkTemplate()` (~line 1262) — none set `progressionMode`
- **Sortable variant:** `src/app/components/learning-path/SortableCourseTimelineEntry.tsx:66` — mirrors the same `isFreeMode` logic
- **Entry action button:** `src/app/components/learning-path/TimelinePrimitives.tsx:210-211` — returns `null` for locked entries (no CTA visible)

### Existing behavior summary

| `progressionMode` | Course card state | Card interaction | CTA button |
|---|---|---|---|
| `undefined` (default) or `'sequential'` | Locked (if prior not completed) | `pointer-events-none opacity-60`, no expand | `null` (hidden) |
| `'free'` | Available | Clickable, expandable | "Start Module" |

### Institutional Learnings

- `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md` — rAF hydration guard pattern used in `LearningTrackDetail` (preserve this)
- `docs/solutions/best-practices/learning-track-detail-reorder-implementation-lessons-2026-05-14.md` — intentional duplication at 2 consumers of timeline entry rendering (preserve this)

## Key Technical Decisions

- **Default to `'free'` rather than adding per-course unlock buttons:** The `'free'` mode already exists and is well-tested. Changing the default is straightforward with predictable behavior. Per-course unlock would require new state management (which courses are unlocked?), new persistence, and new UI — overengineered when the mode toggle already solves the problem.
- **Keep the toggle in the sidebar AND add it near the syllabus header:** Moving the toggle entirely out of the sidebar would break the desktop layout's information hierarchy. Adding a duplicate control near the syllabus heading ensures discoverability at all viewports without removing the sidebar control power users already know. Both toggle instances bind to the same Zustand `path.progressionMode` store value and call the same `handleProgressionModeChange` callback — they stay in sync automatically via React re-renders with no explicit sync mechanism needed.
- **Set `progressionMode: 'free'` at creation time rather than interpreting `undefined` as `'free'`:** Explicit is better than implicit. Existing paths with `undefined` progression mode will continue to behave as sequential (no migration needed — users who want free access toggle it on). Only newly created paths default to free.

## Implementation Units

- [ ] **Unit 1: Change default progression mode to `'free'` for new paths**

**Goal:** Newly created learning paths default to free access instead of sequential.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/stores/useLearningPathStore.ts` — `createPath()` (~line 191), `createPathWithCourses()` (~line 1096), `forkTemplate()` (~line 1262)
- Modify: `src/data/types.ts` — update JSDoc on `progressionMode` (~line 499)

**Approach:**
- In `createPath()`, set `progressionMode: 'free'` on the new `LearningPath` object
- In `createPathWithCourses()`, set `progressionMode: 'free'` on the new `LearningPath` object
- In `forkTemplate()`, set `progressionMode: 'free'` on the new `LearningPath` object (line ~1262). Templates may carry their own `progressionMode` in the future — for now, forked paths get the same default as other creation paths.
- Update the JSDoc comment on `LearningPath.progressionMode` from `undefined defaults to sequential` to `undefined defaults to sequential (legacy); new paths default to 'free'`
- Existing paths with `undefined` progression mode are unchanged — they continue as sequential
- `generatePath()` (~line 782) calls `createPath()` internally and inherits the new default automatically; no separate change needed

**Patterns to follow:**
- `src/stores/useLearningPathStore.ts:191-229` — existing `createPath` implementation
- `src/stores/useLearningPathStore.ts:1096-1162` — existing `createPathWithCourses` implementation
- `src/stores/useLearningPathStore.ts:1226-1357` — existing `forkTemplate` implementation

**Test scenarios:**
- Happy path: Creating a new learning path via `createPath()` produces a path with `progressionMode === 'free'`
- Happy path: Creating a new learning path via `createPathWithCourses()` produces a path with `progressionMode === 'free'`
- Happy path: Forking a template via `forkTemplate()` produces a path with `progressionMode === 'free'`
- Happy path: Navigating to a newly created path's detail page shows all syllabus courses as available (not locked)
- Edge case: An existing path with `progressionMode: undefined` (created before this change) still shows locked courses — user must toggle free access manually

**Verification:**
- New paths show all courses as available/clickable in the syllabus without toggling any setting
- Existing paths are unaffected

---

- [ ] **Unit 2: Add syllabus-level progression mode control**

**Goal:** A progression mode toggle is visible near the "Syllabus" heading at all viewport widths.

**Requirements:** R2, R3, R4

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Create: `src/app/components/learning-path/ProgressionModeToggle.tsx` — new shared component
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx` — use extracted component
- Modify: `src/app/pages/LearningTrackDetail.tsx` — render toggle in syllabus card header

**Approach:**
- Extract the progression mode toggle JSX from `PathProgressSidebar.tsx:176-208` into a new shared `ProgressionModeToggle` component with props `{ mode, onChange, disabled? }`
- Replace the inline toggle in `PathProgressSidebar` with `<ProgressionModeToggle>`, preserving the existing `courseCount > 1` guard (sidebar only — the syllabus header renders the toggle unconditionally)
- Render `<ProgressionModeToggle>` in the syllabus card header (`LearningTrackDetail.tsx` lines ~642-656), between the course count and the "Edit" button. Both toggle instances read from `path.progressionMode` and call the same `handleProgressionModeChange` — they stay in sync automatically via React re-renders; no explicit sync mechanism is needed
- The sidebar toggle keeps its `courseCount > 1` guard (existing behavior — a single-course track has nothing to lock)
- The syllabus-level toggle renders regardless of course count (single-course edge case is harmless — toggling has no visual effect)

**Technical design:**
> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
ProgressionModeToggle (new shared component)
├── Props: { mode: PathProgressionMode, onChange: (mode: PathProgressionMode) => void, disabled?: boolean }
├── Renders: inline flex row with Unlock icon + label "Free access" + Switch
└── Used in: PathProgressSidebar (existing, courseCount > 1 guard) + LearningTrackDetail syllabus header (new, unconditional)

Syllabus card header (LearningTrackDetail):
├── "Syllabus" heading (h2)
├── Course count badge ("N Courses")
├── ProgressionModeToggle  ← NEW (visible at all viewports)
└── Edit/Done button
```

**Patterns to follow:**
- `src/app/components/learning-path/PathProgressSidebar.tsx:173-208` — existing toggle implementation to extract
- `src/app/components/figma/PathProgressRing.tsx` — example of a shared component in the figma directory
- Use `Switch` from `src/app/components/ui/switch.tsx`

**Test scenarios:**
- Happy path: Syllabus card header shows "Free access" toggle at desktop (1440px), tablet (768px), and mobile (375px) viewports
- Happy path: Toggling free access off (sequential mode) immediately locks non-completed, non-in-progress courses in the syllabus — locked cards show `opacity-60`, `pointer-events-none`, `Lock` icon + "Locked" badge, consistent with existing locked-state rendering (R3)
- Happy path: Toggling free access on immediately unlocks all non-completed courses
- Happy path: Sidebar toggle and syllabus header toggle reflect the same state at all times (both bound to same Zustand atom; React re-renders keep them in sync)
- Edge case: Track with only 1 course — syllabus toggle renders and is operable; toggling has no visual effect on the single entry

**Verification:**
- Progression mode toggle is visible in the syllabus section on mobile (375px), tablet (768px), and desktop (1440px)
- Toggle state matches sidebar toggle state
- Locked/unlocked course rendering is consistent with existing behavior

---

- [ ] **Unit 3: Update E2E tests for new default**

**Goal:** Existing tests pass with the new default, and new tests cover free-access behavior.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Units 1-2

**Files:**
- Modify: `tests/e2e/learning-track-detail.spec.ts` — update seed data and add new tests
- Modify: `tests/e2e/learning-track-hero.spec.ts` — verify unaffected by default change
- Modify: `tests/e2e/learning-tracks.spec.ts` — if path creation tests exist, update for new default

**Approach:**
- In `learning-track-detail.spec.ts`: paths seeded without explicit `progressionMode` will now need `progressionMode: 'sequential'` for tests that verify locked behavior (since the default is now `'free'`)
- Add a new test: "syllabus courses are accessible by default without toggling free access" — creates a path (defaults to free), visits the detail page, verifies all course entries are clickable
- Add a new test: "syllabus-level progression mode toggle switches between free and sequential" — toggles the switch in the syllabus header, verifies course state changes
- Add a new test: "sidebar and syllabus toggle stay in sync" — toggles one, verifies the other reflects the same state
- Verify hero CTA tests still pass (hero CTA logic is independent of progression mode — it always targets the first incomplete course)

**Test scenarios:**
- Happy path: Newly created path shows all courses as available/clickable (no locked courses by default)
- Happy path: Toggling sequential mode in the syllabus header locks non-completed courses
- Happy path: Toggling back to free mode in the syllabus header unlocks all courses
- Happy path: Sidebar toggle and syllabus toggle reflect the same state
- Edge case: Path with single course — syllabus toggle renders, toggling has no locking effect
- Regression: Hero CTA "Start Learning" still navigates to the first course

**Verification:**
- `npx playwright test tests/e2e/learning-track-detail.spec.ts` passes
- `npx playwright test tests/e2e/learning-track-hero.spec.ts` passes
- No regressions in `tests/e2e/learning-tracks.spec.ts`

## System-Wide Impact

- **Interaction graph:** `LearningTrackDetail` → `PathTimeline` (progressionMode prop) → `CourseTimelineEntry` + `SortableCourseTimelineEntry` (locked state). `PathProgressSidebar` → `ProgressionModeToggle`. New: syllabus header → `ProgressionModeToggle`. Both toggle instances share the same Zustand store value — sync is automatic via React.
- **Unchanged invariants:** `useNextBestCourse` and hero CTA logic are unaffected — they continue targeting the first incomplete course regardless of progression mode. The `resumeLearning` module is untouched.
- **API surface parity:** No changes to Supabase sync schemas, storage buckets, or external APIs.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Users who rely on sequential-by-default may be confused when new paths start in free mode | The toggle remains visible in both the syllabus header and sidebar; sequential mode still works exactly as before |
| Extracting `ProgressionModeToggle` could introduce subtle style differences from the original | Match the existing sidebar toggle's spacing, font sizes, and Switch component exactly |

## Sources & References

- **Type definition:** `src/data/types.ts:484-504` — `LearningPath` interface and `PathProgressionMode`
- **Store (all creation paths):** `src/stores/useLearningPathStore.ts:191-229` (`createPath`), `:1096-1162` (`createPathWithCourses`), `:1226-1357` (`forkTemplate`), `:303-337` (`setProgressionMode`)
- **Timeline:** `src/app/components/learning-path/PathTimeline.tsx:180-469` — `CourseTimelineEntry`
- **Sidebar toggle:** `src/app/components/learning-path/PathProgressSidebar.tsx:173-208`
- **Detail page:** `src/app/pages/LearningTrackDetail.tsx:634-694` — syllabus card
- **E2E tests:** `tests/e2e/learning-track-detail.spec.ts`
