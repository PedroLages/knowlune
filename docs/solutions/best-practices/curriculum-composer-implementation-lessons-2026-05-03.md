---
title: Curriculum Composer — Shared Picker, Import Round-Trip, and Batch-Add Patterns
date: 2026-05-03
category: best-practices
module: learning-paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Building a shared component that serves both multi-select and single-select interaction modes
  - A dialog/wizard needs to communicate a completed action back to its opener without re-mounting
  - Batch-persisting N records where the parent record timestamp must reflect the batch add
  - A collapsible panel benefits from a user-preference toggle persisted to localStorage
tags:
  - curriculum-composer
  - inline-course-picker
  - custom-events
  - optimistic-updates
  - syncable-write
  - zustand
  - multi-select
  - localStorage
related_components:
  - tooling
---

# Curriculum Composer — Shared Picker, Import Round-Trip, and Batch-Add Patterns

## Context

The Curriculum Composer feature replaced a two-dialog path-creation flow (open `CreatePathDialog` for name, then `CoursePickerDialog` repeatedly for individual courses) with a single unified dialog containing an inline multi-select course picker. The same picker component also replaced the modal course picker on the detail page. Four non-obvious patterns emerged during implementation that each solved a distinct coordination, state-preservation, or data-integrity problem.

## Guidance

### 1. Import Wizard Round-Trip via CustomEvent (`COURSE_IMPORTED`)

When a user clicks "Import new course" from inside the `CurriculumComposer`, the import wizard opens. On successful import, the wizard must tell the composer to auto-select the newly imported course. Because the wizard and composer are separate React trees (the wizard is rendered in the composer's parent to preserve its singleton state), React props cannot bridge them.

**Solution:** Follow the existing `IMPORT_WIZARD_SET_TARGET` pattern. The composer exports a `COURSE_IMPORTED` constant and listens for it on `window`:

```typescript
// CurriculumComposer.tsx — exports the event name
export const COURSE_IMPORTED = 'course-imported' as const

// Listen for the event after successful import
useEffect(() => {
  function handleCourseImported(e: Event) {
    const event = e as CourseImportedEvent
    if (event.detail?.courseId) {
      setSelectedCourseIds(prev => {
        if (prev.includes(event.detail.courseId)) return prev
        return [...prev, event.detail.courseId]
      })
      loadImportedCourses().catch(() => {})
    }
  }
  window.addEventListener(COURSE_IMPORTED, handleCourseImported)
  return () => window.removeEventListener(COURSE_IMPORTED, handleCourseImported)
}, [loadImportedCourses])
```

```typescript
// ImportWizardDialog.tsx — dispatches on success
import { COURSE_IMPORTED } from './CurriculumComposer'

// After persistScannedCourse completes:
window.dispatchEvent(
  new CustomEvent(COURSE_IMPORTED, { detail: { courseId: newCourse.id } })
)
```

**Why this works:** The CustomEvent pattern avoids coupling between the two component trees. The wizard does not import the composer — it only dispatches a standard DOM event. Any component that needs to react to a new course import can listen for the same event. This is the same pattern used by `IMPORT_WIZARD_SET_TARGET` for the singleton wizard guard (documented separately in `learning-paths-import-from-path-patterns-2026-05-03.md`).

### 2. Multi-Select vs Single-Select Mode in a Shared Picker

The `InlineCoursePicker` serves two distinct contexts:

| Context | Mode | Interaction | Footer |
|---------|------|-------------|--------|
| `CurriculumComposer` (create flow) | `multiSelect` | Checkboxes + selection count + reorder buttons | "Add N Courses" confirm button |
| `LearningPathDetail` (add to existing) | `singleSelect` | Per-row "Add" button, immediate add | "Import new course" action only |

**Solution:** A single `mode` prop drives all behavioral divergence. The key design decisions:

- **Controlled selection in multiSelect**: `selectedCourseIds` and `onSelectionChange` are external props. The composer owns selection state and can prepopulate it (e.g., after `COURSE_IMPORTED`). Reorder state is also controlled — `handleMoveUp`/`handleMoveDown` mutate the external array.

- **Callback-based add in singleSelect**: `onAdd` receives `[{ courseId, courseType }]` and the caller decides whether to close the panel (respecting the "keep panel open" toggle).

- **Single `CourseRow` renders differently per mode**: In `multiSelect`, it renders a styled checkbox. In `singleSelect`, it renders an "Add" `Button`. Reorder buttons only appear for selected rows in `multiSelect`.

```typescript
// Mode-driven row actions
{mode === 'multiSelect' ? (
  <label htmlFor={`picker-checkbox-${course.id}`} ...>
    <input type="checkbox" checked={isSelected} ... />
    {isSelected && <CheckIcon />}
  </label>
) : (
  <Button variant="brand-outline" size="sm"
    onClick={() => onAdd(course.id, course.type)}>
    Add
  </Button>
)}
```

**Why this works:** A single component with a mode enum is easier to keep consistent than two separate components. The controlled/uncontrolled boundary is explicit: multiSelect is fully controlled (parent owns selection, order, confirm action), singleSelect is fire-and-forget (parent receives individual add events). The `hideConfirmButton` and `showImportAction` props let each context suppress or reveal footer actions independently.

### 3. "Keep Panel Open" localStorage Toggle

On the detail page, the inline picker lives in a `Collapsible` panel. In single-select mode, adding a course closes the panel by default — forcing the user to reopen it for each additional course. A "Keep panel open" checkbox lets users override this.

**Solution:** The preference is stored in `localStorage` and read on component mount via a lazy `useState` initializer:

```typescript
const [keepPanelOpen, setKeepPanelOpen] = useState(() => {
  try {
    return localStorage.getItem('keepCoursePanelOpen') === 'true'
  } catch {
    return false
  }
})

useEffect(() => {
  try {
    localStorage.setItem('keepCoursePanelOpen', String(keepPanelOpen))
  } catch {
    // silent-catch-ok: localStorage may be unavailable
  }
}, [keepPanelOpen])
```

The add handler respects the toggle:

```typescript
const handlePickerAddCourse = useCallback(
  (courses) => {
    if (!pathId || courses.length === 0) return
    addCourseToPath(pathId, courses[0].courseId, courses[0].courseType).catch(...)
    if (!keepPanelOpen) {
      setPickerOpen(false)
    }
  },
  [pathId, addCourseToPath, keepPanelOpen]
)
```

**Why this works:** The lazy `useState` initializer reads from `localStorage` synchronously on mount, avoiding a flash of the default value. The try/catch guards against environments where `localStorage` throws (private browsing in some browsers). The toggle is a simple checkbox rendered inside the `CollapsibleContent` so it only appears when the panel is open.

### 4. batchAddCoursesToPath — Reading Optimistically-Updated State for Sync Accuracy

When `batchAddCoursesToPath` persists entries, it must also update the parent path's `updatedAt` timestamp so the sync layer detects the change. The naive approach reads the path from Dexie inside the persist callback:

```typescript
// WRONG: reads stale pre-update path from Dexie
const existingPath = await db.learningPaths.get(pathId)
if (existingPath) {
  await syncableWrite('learningPaths', 'put', existingPath)
}
```

This is wrong because Dexie still holds the old `updatedAt` — the optimistic update changed Zustand state, not Dexie. The sync layer would receive a path with the old timestamp and may not detect the change.

**Solution:** Read the optimistically-updated path from Zustand state inside the persist callback:

```typescript
await persistWithRetry(async () => {
  for (const entry of pathEntries) {
    await syncableWrite('learningPathEntries', 'add', entry as unknown as SyncableRecord)
  }
  // Read from optimistically-updated Zustand state, NOT from Dexie
  const updatedPath = get().paths.find(p => p.id === pathId)
  if (updatedPath) {
    await syncableWrite('learningPaths', 'put', updatedPath as unknown as SyncableRecord)
  }
})
```

The optimistic update sets the new `updatedAt` on the in-memory path object:

```typescript
set(state => ({
  entries: [...state.entries, ...pathEntries],
  paths: state.paths.map(p =>
    p.id === pathId ? { ...p, updatedAt: new Date().toISOString() } : p
  ),
  error: null,
}))
```

**Why this works:** By the time `persistWithRetry` executes its callback, `get().paths` already contains the path with the new `updatedAt` timestamp. The sync layer receives the correct timestamp and can compute the LWW (last-writer-wins) comparison accurately. This pattern applies to any batch operation that modifies a parent record's metadata — always read from the optimistic state, not from the database.

## Why This Matters

These four patterns address problems that would otherwise cause subtle, hard-to-diagnose issues:

1. **Without the CustomEvent round-trip**: The composer would need to poll or receive a callback through a shared parent — coupling the two components and breaking when either tree remounts.

2. **Without mode-driven divergence**: Two separate picker components would drift apart as each context evolves, duplicating search, filtering, and rendering logic.

3. **Without localStorage persistence**: The "keep panel open" preference would reset on every page reload, frustrating users who add multiple courses in a session.

4. **Without optimistic state read**: The sync layer would write the parent path with a stale `updatedAt`, potentially causing sync conflicts or missed updates.

## When to Apply

- When a shared component needs to serve both selection and immediate-action contexts — use a `mode` prop rather than separate components.
- When a child component (dialog/wizard) produces a result that a sibling component needs — use CustomEvent on `window` rather than prop drilling or context.
- When persisting a batch of child records that affects a parent record's metadata — read the optimistically-updated parent from in-memory state, not from the database.
- When a UI preference should survive page reloads but does not need server persistence — use `localStorage` with a lazy `useState` initializer and a sync `useEffect`.

## Examples

### Before: Two-Dialog Flow (What Didn't Work)

The original flow required three steps and two separate dialogs to create a path with courses:

1. Open `CreatePathDialog` (name + description only)
2. Land on empty `LearningPathDetail` page
3. Open `CoursePickerDialog` repeatedly to add courses one at a time

This was every new user's first impression of learning paths — an empty page with no courses.

### After: Single Unified Composer

The `CurriculumComposer` combines all three steps into one dialog:

1. Open `CurriculumComposer` (name + description + multi-select course picker in one view)
2. Select courses, optionally reorder them, import new ones inline
3. Click "Create Path" — lands on `LearningPathDetail` with courses already populated

The `hideConfirmButton` prop on the picker means the composer's own submit button handles creation; the picker is purely for selection.

## Related

- [Singleton Dialog Guard and Cross-Component Event Communication](./learning-paths-import-from-path-patterns-2026-05-03.md) — the `IMPORT_WIZARD_SET_TARGET` pattern that `COURSE_IMPORTED` follows
- [Single Write Path for Synced Mutations](./single-write-path-for-synced-mutations-2026-04-18.md) — the `syncableWrite` infrastructure used by `batchAddCoursesToPath`
- [Compound PK/RecordID Synthesis in syncableWrite](./compound-pk-recordid-synthesis-in-syncable-write-2026-04-19.md) — how `syncableWrite` derives record identifiers for LWW comparison
- PR: https://github.com/PedroLages/knowlune/pull/495
- Plan: docs/plans/2026-05-03-005-feat-curriculum-composer-plan.md
- Demo: https://files.catbox.moe/d9343l.gif
