---
title: "feat: Add free progression mode toggle to learning tracks"
type: feat
status: active
date: 2026-06-22
---

# feat: Add free progression mode toggle to learning tracks

## Overview

Add a per-track toggle that lets users switch between **sequential** (current behavior — courses lock until the previous one is completed) and **free** (all courses accessible at any time) progression modes. The setting persists per-track via IndexedDB and the existing sync infrastructure.

## Problem Frame

Learning tracks currently enforce strict sequential progression: only the first incomplete course is accessible; everything after it is visually locked (`opacity-60 pointer-events-none`) and non-interactive. Users who want to jump between courses in the same track — for example, to sample different topics before committing, or to return to a track after a break and pick up at a later course — are blocked by the UI. There is no data-model or UI mechanism to disable this behavior.

The core issue is that locking is **purely a UI computation** in `PathTimeline.tsx` (no route guards, no store enforcement), but it is **unconditional** — there is no way for a user to opt out.

## Requirements Trace

**UI & Behavior**

- **R1.** User can toggle a track between sequential and free progression from the track detail page.
- **R2.** In free mode, all courses in the track are accessible — no course is visually locked or non-interactive.
- **R3.** In sequential mode, behavior is unchanged from current (first incomplete course is "up next," subsequent courses are locked).


- **R6.** Gap entries (courses not yet imported) remain unaffected by the mode toggle — they continue to display their resolution UI regardless of mode.

**Data Integrity**

- **R4.** The progression mode persists across page reloads and browser sessions.
- **R5.** Switching modes does not lose or reset course progress data — course completion percentages and module completion records remain identical before and after toggling the mode.

## Scope Boundaries

- **In scope:** Per-track progression mode toggle on the track detail page; data model, store, and persistence changes; timeline rendering update; status badge and action button behavior in free mode.
- **Out of scope:** Route-level access enforcement (courses are already directly navigable by URL — this is an existing non-enforcement, not a regression). Toggle on the track list page (`LearningTracks.tsx`). Per-course prerequisites. Time-based or conditional unlocking rules.
- **Not in scope:** Changing the locking algorithm itself — `nextUnlockedIndex` logic remains unchanged for sequential mode.

### Deferred to Separate Tasks

- **Supabase `learning_paths.progression_mode` column migration**: Column does not exist on the remote table. The Dexie-side field will sync as `progression_mode` via default camelCase→snake_case mapping, but the Supabase schema must be updated to accept it. Deferred to a Postgres migration task or manual column addition; the feature works fully offline without it. Without the column, the sync push may silently drop the field.
- **List-page batch mode toggle**: Adding a toggle to `LearningTracks.tsx` card actions for quick mode switching without opening the detail page.

## Context & Research

### Relevant Code and Patterns

| File | Role |
|------|------|
| `src/data/types.ts:484-509` | `LearningPath` and `LearningPathEntry` type definitions — no progression field exists today |
| `src/db/schema.ts` | Dexie schema v66 — `learningPaths` table with checkpoint-schema + legacy-migration pattern |
| `src/stores/useLearningPathStore.ts` | Zustand store for path CRUD — `updateDescription` (lines 267-300) is the pattern to follow for a new per-path field mutation |
| `src/app/pages/LearningTrackDetail.tsx` | Track detail page — loads path data, renders `PathHeroBanner` + `PathTimeline` + `PathProgressSidebar` |
| `src/app/components/learning-path/PathTimeline.tsx:506-517` | Locking logic — `nextUnlockedIndex` finds first non-completed entry; everything after is locked |
| `src/app/components/learning-path/PathTimeline.tsx:710-714` | Per-entry `isInProgress`/`isLocked` computation |
| `src/app/components/learning-path/PathTimeline.tsx:347-374` | Locked card rendering — `opacity-60 pointer-events-none`, no click/keyboard handlers |
| `src/app/components/learning-path/TimelinePrimitives.tsx:17` | Entry status enum: `'completed' | 'in-progress' | 'available' | 'locked' | 'gap'` |
| `src/app/components/learning-path/TimelinePrimitives.tsx:210` | `EntryActionButton` — returns `null` for locked state |
| `src/app/components/learning-path/PathProgressSidebar.tsx` | Right-column sidebar with progress ring, stats, and track info |
| `src/app/components/learning-path/EditPathDialog.tsx` | Edit path name/description dialog — no progression setting today |
| `src/app/components/ui/switch.tsx` | Radix UI Switch primitive — existing component to reuse |
| `src/stores/__tests__/useLearningPathStore.test.ts` | Store test suite |
| `src/app/components/learning-path/__tests__/PathTimeline.test.tsx` | Timeline test suite |
| `src/lib/exportService.ts` | Export serialization — must include new field |
| `src/lib/sync/tableRegistry.ts` | Sync table registry — default camelCase→snake_case mapping handles `progressionMode` → `progression_mode` |

### Institutional Learnings

- **[learning-track-detail-reorder-implementation-lessons](docs/solutions/best-practices/learning-track-detail-reorder-implementation-lessons-2026-05-14.md)**: Documents the `nextUnlockedIndex` algorithm, unlock animation pattern (`motion.div` with `justUnlocked` ref tracking), and the component split between `CourseTimelineEntry` (read mode) and `SortableCourseTimelineEntry` (edit mode). Any change to locking must account for both components.
- **[learning-tracks-pages-implementation-patterns](docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md)**: Documents the `rAF` hydration guard pattern for track detail pages — critical for preventing "Track not found" flash on direct URL navigation. Not directly affected by this change but important for any loading-state wiring.
- **[paths-as-study-plan-implementation-lessons](docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md)**: Documents `syncableWrite` batching and the rule that store mutations MUST go through the store's update method (not direct property assignment) to avoid silent data loss. The new `setProgressionMode` action must follow this pattern.
- **[lesson-badge-local-global-index-mismatch](docs/solutions/ui-bugs/lesson-badge-local-global-index-mismatch-2026-05-04.md)**: Documents that display indices must come from pre-computed lookup maps, not `.map()` callback index. Relevant when computing status badges for courses in free mode.

## Key Technical Decisions

- **Per-track field on `LearningPath`**: Store `progressionMode` as an optional field on the `LearningPath` type rather than in a separate user-preference table or localStorage. This is the natural home — the setting is about a specific track's behavior, not a global preference. It also inherits sync for free via the existing `syncableWrite` pattern.
- **Default `undefined` = sequential**: Backward-compatible — all existing tracks default to sequential without a migration. Only explicitly toggled tracks get the `'free'` value written.
- **Toggle placement in `PathProgressSidebar`**: The right-column sidebar already displays track-level metadata (difficulty, estimated hours, course count). Adding a progression mode row fits the information hierarchy and avoids cluttering the main timeline area.
- **Switch component from Radix UI**: Reuse the existing `Switch` primitive at `src/app/components/ui/switch.tsx` — it provides `role="switch"`, `aria-checked`, and keyboard interaction out of the box.
- **Non-indexed Dexie field**: `progressionMode` is only read when the track detail page loads a single path by ID (`paths.find(p => p.id === trackId)`). No cross-track queries by mode are needed. A non-indexed field avoids adding index overhead to the `learningPaths` table.
- **Suppress bulk unlock animation on mode switch**: When toggling from sequential to free, multiple courses transition from locked to unlocked simultaneously. Running the per-entry `motion.div` unlock animation for all of them at once would be visually chaotic. Detect the mode switch and skip the animation.

## Open Questions

### Resolved During Planning

- **Q: Toggle label and description?** → **A:** Label: "Free access". Description: "Start any course without completing previous ones." Rendered as a row in the `PathProgressSidebar` track-info section.
- **Q: Status badges for courses that would be locked in sequential mode?** → **A:** Show "Available" badge with a distinct visual style (muted but not locked-dimmed) for courses that are accessible due to free mode but have no progress. "Locked" badge and lock icon are never shown in free mode.
- **Q: Action button text for non-sequential unlocked courses?** → **A:** "Start Module" for any course with 0% progress in free mode (treat all as if they were "Up Next").
- **Q: Toggle visibility for 0 or 1 course tracks?** → **A:** Hidden entirely when `courseEntries.length <= 1`. Single-course tracks have no behavioral difference between modes.
- **Q: Progression mode field indexing in Dexie?** → **A:** Non-indexed. Only accessed per-track by ID.
- **Q: Bulk unlock animation handling?** → **A:** Suppress per-entry unlock animations on mode-switch transitions. Detect by comparing `previousMode !== currentMode` rather than individual lock-state changes.
- **Q: Export/import scope?** → **A:** Include `progressionMode` in serialized export shape. Import defaults to `undefined` (sequential) when the field is missing from imported data.

### Deferred to Implementation

- **Exact `CHECKPOINT_SCHEMA` string for v67**: Generated from the current schema definition; the implementer should read the existing checkpoint and verify the field list matches.
- **Supabase column addition**: Whether to add `progression_mode TEXT` via a Postgres migration script or manually via the Supabase dashboard. The feature works without it; sync may silently drop the field until the column exists.
- **Toast message text on mode switch**: Optional UX enhancement — "All courses are now accessible" on free mode activation, "Courses must be completed in order" on sequential mode activation. The implementer can add these if they improve UX without clutter.

## Implementation Units

### Unit 1: Add `progressionMode` to data model and Dexie schema

**Goal:** Define the `PathProgressionMode` type, add the field to `LearningPath`, and bump the Dexie schema version so IndexedDB can store the new field.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/db/schema.ts`

**Approach:**
- Add `export type PathProgressionMode = 'sequential' | 'free'` to `src/data/types.ts`
- Add `progressionMode?: PathProgressionMode` to the `LearningPath` interface — `undefined` means sequential (backward-compatible)
- Bump Dexie schema from v66 to v67
- Use an empty stores object (`database.version(67).stores({})`) since the field is non-indexed — this is sufficient for Dexie to recognize optional field additions to existing tables
- Update both the `declareLegacyMigrations` chain in `schema.ts` and the `CHECKPOINT_SCHEMA`/`CHECKPOINT_VERSION` constants in `checkpoint.ts` to reflect v67

**Patterns to follow:**
- Existing `LearningPath` field additions (e.g., `coverImageUrl`, `coverPreset`) — optional fields added without index changes
- Dexie version bump pattern: `src/db/schema.ts` `declareLegacyMigrations` function

**Test scenarios:**
- **Happy path:** A `LearningPath` object with `progressionMode: 'free'` passes TypeScript type checking and can be written to/read from the `learningPaths` Dexie table
- **Edge case:** A `LearningPath` object without `progressionMode` (legacy data) is read as `undefined` — the app treats `undefined` as sequential
- **Edge case:** Dexie v66→v67 migration runs without error on existing databases; all existing rows retain their data

**Verification:**
- TypeScript compiles with `progressionMode` on `LearningPath`
- Dexie schema version is 67
- Existing E2E and unit tests pass with the schema change

---

### Unit 2: Add `setProgressionMode` store action

**Goal:** Add a Zustand store action that updates the progression mode for a track, following the existing optimistic-update-with-rollback pattern used by `updateDescription`.

**Requirements:** R1, R4

**Dependencies:** Unit 1 (type must exist)

**Files:**
- Modify: `src/stores/useLearningPathStore.ts`
- Test: `src/stores/__tests__/useLearningPathStore.test.ts`

**Approach:**
- Add `setProgressionMode(pathId: string, mode: PathProgressionMode)` action
- Pattern (mirrors `updateDescription`):
  1. Read current path from Zustand state
  2. Optimistically update the path in Zustand state with the new `progressionMode`
  3. Persist via `syncableWrite('learningPaths', 'put', updatedPath)`
  4. On error: roll back the optimistic update in Zustand, show `toast.error('Failed to update progression mode')`
- Export the action in the store's public interface

**Patterns to follow:**
- `updateDescription` at `src/stores/useLearningPathStore.ts:267-300` — same optimistic-update + syncableWrite + rollback shape
- `paths-as-study-plan-implementation-lessons` — store mutations MUST go through the store's update method, never direct property assignment

**Test scenarios:**
- **Happy path:** Calling `setProgressionMode(pathId, 'free')` updates the path in Zustand state and persists to Dexie
- **Happy path:** Calling `setProgressionMode(pathId, 'sequential')` updates the path and persists
- **Edge case:** Calling with a non-existent `pathId` does not crash; no state change occurs
- **Error path:** When `syncableWrite` fails (mocked), the optimistic update is rolled back and `toast.error` is called

**Verification:**
- Store test passes with the new action
- Manual test: toggle mode, refresh page, mode persists

---

### Unit 3: Add free-progression toggle to `PathProgressSidebar`

**Goal:** Add a Switch toggle in the track detail sidebar that displays and controls the current progression mode.

**Requirements:** R1

**Dependencies:** Unit 2 (store action must exist)

**Files:**
- Modify: `src/app/components/learning-path/PathProgressSidebar.tsx`

**Approach:**
- Extend `PathProgressSidebarProps` with:
  - `progressionMode?: PathProgressionMode` — current mode (undefined = sequential)
  - `onProgressionModeChange?: (mode: PathProgressionMode) => void` — callback
  - Note: `courseCount` already exists on the props interface — no addition needed
- Add a "Free access" row in the track-info section:
  - Label: "Free access" with muted description "Start any course without completing previous ones"
  - `Switch` component (checked = `progressionMode === 'free'`)
  - `aria-label="Enable free access mode"` on the Switch
  - `aria-describedby` linking to the description text for screen readers
- Conditionally render: hidden when `courseCount <= 1`
- Use design tokens: `text-muted-foreground` for description, `text-sm` for label
- Toggle calls `onProgressionModeChange('free')` on check, `onProgressionModeChange('sequential')` on uncheck

**Patterns to follow:**
- `PathProgressSidebar` existing track-info rows (difficulty, estimated hours) for layout and typography
- `Switch` component from `src/app/components/ui/switch.tsx`
- Design token system: no hardcoded colors

**Test scenarios:**
- **Happy path:** Toggle is visible when `courseCount > 1`; Switch reflects `progressionMode === 'free'`
- **Happy path:** Clicking the Switch calls `onProgressionModeChange` with the opposite mode
- **Edge case:** Toggle is not rendered when `courseCount <= 1`
- **Edge case:** When `progressionMode` is `undefined` or `'sequential'`, Switch is unchecked

**Verification:**
- Visual: toggle renders in sidebar below track stats, above course list info
- Accessibility: Switch has proper ARIA labels, keyboard-operable
- Responsive: layout works at mobile (375px), tablet (768px), desktop (1440px)

---

### Unit 4: Update `PathTimeline` locking logic for free mode

**Goal:** When `progressionMode` is `'free'`, skip the sequential locking computation — all courses are accessible and interactive.

**Requirements:** R2, R3, R6

**Dependencies:** Unit 1 (type must exist)

**Files:**
- Modify: `src/app/components/learning-path/PathTimeline.tsx`
- Modify: `src/app/components/learning-path/SortableCourseTimelineEntry.tsx`
- Modify: `src/app/components/learning-path/TimelinePrimitives.tsx`
- Test: `src/app/components/learning-path/__tests__/PathTimeline.test.tsx`

**Approach:**

1. **Extend component props**: Add `progressionMode?: PathProgressionMode` to `PathTimelineProps`, and thread it through to `CourseTimelineEntry` and `SortableCourseTimelineEntry`. Both entry components compute `isLocked` and `status` internally from `isCompleted`/`isInProgress` props — the free-mode override must happen **inside** each component, not in `PathTimeline`'s per-iteration loop. When `progressionMode === 'free'`, the entry components override `isLocked = false` for all non-completed, non-gap entries and display `'available'` status instead of `'locked'`.

2. **Locking logic change** (entry components): Inside `CourseTimelineEntry` (read mode, ~line 209) and `SortableCourseTimelineEntry` (edit mode, ~line 62):
   ```
   const isFreeMode = progressionMode === 'free'
   const isLocked = isFreeMode ? false : (!isCompleted && !isInProgress)
   const status = isCompleted ? 'completed'
     : isFreeMode ? 'available'
     : isInProgress ? 'in-progress'
     : 'locked'
   ```
   Gap entries (`courseId === ''`) are already excluded before reaching this code — they return early with their own rendering path. The `isFreeMode` guard must still exclude gap entries explicitly to satisfy R6.

3. **Status badge change**: `TimelinePrimitives.tsx` — add an `'available'` variant to `StatusCircle` (visual style: muted but not dimmed, distinct from locked) and extend `EntryActionButton` (line 210) to handle `'available'` status the same as `'in-progress'` — return "Start Module" button when there is 0% progress, or "Continue" when there is partial progress. **Courses with partial progress in free mode retain their "In Progress" status** — the `'available'` badge only applies to courses with 0% completion that would be locked in sequential mode. Courses the user has already started continue to show "In Progress" with the "Continue Module" action.

4. **Animation suppression**: When the parent detects a mode switch (via `prevModeRef !== progressionMode` in `PathTimeline`), pass a `suppressAnimations: boolean` prop to both `CourseTimelineEntry` and `SortableCourseTimelineEntry`. When `suppressAnimations` is true, skip the per-entry `motion.div` unlock animation (`justUnlocked` ref logic). Track previous mode with `useRef(progressionMode)` and compare on render.

5. **Gap entries**: Unaffected — gap entries (`courseId === ''`) continue to be skipped in locking logic and render their resolution UI regardless of mode. Verify existing gap-entry handling is unchanged in free mode.

**Patterns to follow:**
- Current `isLocked`/`isInProgress` computation at lines 710-714 — extend, don't replace
- `justUnlocked` animation pattern at line 222-224 — suppress on bulk transitions
- `SortableCourseTimelineEntry` — must also receive and respect `progressionMode` (edit-mode entry variant)

**Test scenarios:**
- **Happy path — free mode:** All non-gap, non-completed entries show as accessible (no `opacity-60`, no `pointer-events-none`, clickable, with "Available" or "Start Module" badge)
- **Happy path — sequential mode:** Behavior unchanged from current — first incomplete entry is "Up Next", subsequent entries are locked
- **Happy path — mode switch:** Toggling from sequential to free unlocks all entries immediately; toggling back re-locks based on current progress
- **Edge case — gap entries in free mode:** Gap entries still render with dashed border and resolution buttons, are not affected by mode
- **Edge case — all courses completed:** Both modes show all entries as "Completed" — no behavioral difference
- **Edge case — no progress data:** In free mode, all entries show as accessible (not locked). In sequential mode, first entry is "in-progress" (existing behavior)
- **Edge case — animation suppression:** When switching from sequential to free, no unlock animation fires on individual entries
- **Integration — R5 progress preservation:** Toggling from sequential to free and back does not modify any course's completion percentage, completed lesson count, or module completion records. Verify progress data is bit-identical before and after mode toggle.

**Verification:**
- Unit tests pass for both modes
- Manual test: open a multi-course track, toggle free mode, verify all courses are clickable
- Manual test: in free mode, directly navigate to a course that would be locked in sequential mode — verify it loads normally (no change needed, already works)

---

### Unit 5: Wire progression mode in `LearningTrackDetail`

**Goal:** Connect the store action, sidebar toggle, and timeline rendering in the track detail page.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Units 2, 3, 4

**Files:**
- Modify: `src/app/pages/LearningTrackDetail.tsx`

**Approach:**
- Extract `progressionMode` from the resolved `path` object — already available via Zustand
- Pass `progressionMode` to `PathTimeline` and `PathProgressSidebar`
- Wire `onProgressionModeChange` callback that calls `setProgressionMode(pathId, mode)` from the store
- Pass `courseEntries.length` to sidebar for toggle visibility gating
- Handle loading state: during the `isReady` gate, the toggle is not rendered (sidebar shows skeleton)

**Patterns to follow:**
- Existing prop threading from `LearningTrackDetail` → child components (e.g., `path`, `courseEntries`, `isEditing`)
- `useLearningPathStore` selector pattern — use `useShallow` for derived state selectors

**Test scenarios:**
- **Integration:** Loading a track detail page with `progressionMode: 'free'` shows all courses unlocked
- **Integration:** Toggling the switch updates the timeline in real time (no page reload needed)
- **Integration:** Refreshing the page preserves the mode (reads from Dexie via Zustand hydration)
- **Edge case:** Toggle is not visible when track has 0 or 1 courses (sidebar hides it)
- **Error path:** If the store action fails, the toggle reverts to its previous state (optimistic rollback)

**Verification:**
- Full flow works: open track → toggle to free → courses unlock → refresh → courses still unlocked → toggle back → courses re-lock

---

### Unit 6: Export/import compatibility

**Goal:** Ensure `progressionMode` is included in data export and gracefully handled on import.

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/lib/exportService.ts`

**Approach:**
- Include `progressionMode` in the serialized `LearningPath` shape during export
- On import, when deserializing a `LearningPath` that lacks the `progressionMode` field, default to `undefined` (sequential) — this is automatic with the optional field, but verify the import path does not strip unknown fields
- No migration logic needed on import since the field is optional

**Patterns to follow:**
- Existing export serialization of `LearningPath` fields

**Test scenarios:**
- **Happy path:** Exporting a track with `progressionMode: 'free'` includes the field in the exported JSON
- **Edge case:** Importing a JSON file where the field is absent defaults to sequential mode
- **Edge case:** Importing a JSON file with `progressionMode: 'free'` preserves the value

**Verification:**
- Export a track with free mode, inspect JSON, confirm field is present
- Import a legacy export (no field), verify track defaults to sequential

## System-Wide Impact

- **Interaction graph:** `LearningTrackDetail` → `PathTimeline` (locking logic) + `PathProgressSidebar` (toggle UI). `useLearningPathStore` → `syncableWrite` → Sync engine → Supabase. `exportService` → serialized path data.
- **Error propagation:** Store action failures surface via `toast.error` and optimistic rollback (same pattern as `updateDescription`). Sync push failures for the new field are silent (existing sync error handling) — the field may not sync until Supabase schema is updated.
- **State lifecycle risks:** Low. The field is additive and optional. No existing data is mutated or restructured. The optimistic update pattern (write Zustand first, then Dexie, rollback on failure) is well-established in this store.
- **API surface parity:** The `hydrateFromRemote` method in `useLearningPathStore` does `db.learningPaths.bulkPut(paths)` — rows from Supabase lacking the new column will overwrite with `undefined`, which is the correct default (sequential). No change needed until Supabase schema is updated.
- **Integration coverage:** The toggle → timeline reactivity path is integration-tested via the `LearningTrackDetail` wiring (Unit 5). The sync path (`syncableWrite` → Supabase) is not integration-tested in this plan — existing sync E2E tests cover the general pattern.
- **Unchanged invariants:** Route-level course access is unchanged (no guards added or removed). Manual module completion via `useManualModuleCompletion` is unchanged — manual completions still count as completed in both modes. Course reordering (edit mode) is unchanged. `ContinueLearningBento` (in-progress course card) behavior is unchanged — it still picks the first entry with partial progress. `PathProgressSidebar` progress ring and stats are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase `learning_paths` table lacks `progression_mode` column — sync push may silently drop the field | Feature works fully offline. Deferred Supabase migration task documented in Scope Boundaries. Field loss on sync is non-destructive (defaults back to sequential on next pull until column exists). |
| Bulk animation suppression logic is fragile — `prevModeRef` comparison may miss edge cases | Scope the suppression to a simple boolean `suppressAnimation` derived from `progressionMode !== prevModeRef.current`. If it regresses, the worst case is a harmless visual glitch (multiple unlock animations). |
| `SortableCourseTimelineEntry` (edit mode) may render locked courses differently | Verify the component receives `progressionMode` and applies the same free-mode logic. If missed, locked courses in edit mode would still show `opacity-60 pointer-events-none`, which conflicts with drag-and-drop reordering. |

## Sources & References

- **Feature request:** User request via `/ce-plan` — "unlock all courses in a track so the user can start a different course even without finishing the previous one"
- **Relevant code:** `src/app/components/learning-path/PathTimeline.tsx` (locking logic), `src/stores/useLearningPathStore.ts` (store pattern), `src/data/types.ts` (data model)
- **Institutional learnings:** `docs/solutions/best-practices/learning-track-detail-reorder-implementation-lessons-2026-05-14.md`, `docs/solutions/best-practices/paths-as-study-plan-implementation-lessons-2026-05-04.md`
- **Related plans:** `docs/plans/2026-05-09-001-feat-learning-tracks-pages-plan.md`, `docs/plans/2026-05-09-003-feat-learning-track-ux-improvements-plan.md`
