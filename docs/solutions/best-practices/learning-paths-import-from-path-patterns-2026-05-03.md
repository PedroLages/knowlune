---
title: Singleton Dialog Guard and Cross-Component Event Communication
date: 2026-05-03
category: best-practices
module: learning_paths
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Multiple UI entry points on different pages can open the same dialog and must prevent duplicates
  - A dialog needs an in-flight target update from sibling components outside its React tree
  - Dialog components embedded in frequently-re-rendering parents need internal state preserved
tags:
  - singleton-guard
  - custom-events
  - dialog-management
  - react-patterns
  - cross-component-communication
  - import-wizard
related_components:
  - frontend_stimulus
---

# Singleton Dialog Guard and Cross-Component Event Communication

## Context

The Import Course wizard has three entry points on learning path pages — the path list header (`LearningPaths.tsx`), each path card's dropdown menu, and the path detail sidebar (`LearningPathDetail.tsx`). Each page renders its own `<ImportWizardDialog>` instance. Without a guard, clicking "Import Course" from a second entry point while the wizard is already open would open a second dialog, creating a stacked-dialog confusion.

Worse, clicking "Import Course" from a *different* path card while the wizard is already open should re-target the open wizard to the new path — not open a second copy. This is a cross-component communication problem that React alone cannot solve synchronously across independent component trees.

During implementation, two additional challenges emerged:

1. **Plan critic finding (session history):** The initial plan proposed tracking the wizard counter on component mount/unmount. This was caught as a HIGH blocker — three page components each render their own `<ImportWizardDialog>` instance, so a mount-based counter would reach 3 on page load even with no wizard visible. The fix: track transitions in `onOpenChange`, not mounts.

2. **Review finding (session history):** The `CreatePathDialog` was defined as an inline function component inside `LearningPaths`. When the Zustand store updated `paths` during the wizard's optimistic `addCourseToPath`, the parent re-rendered — giving `CreatePathDialog` a new function reference. React treats this as a different component type, unmounting and remounting it mid-operation and losing all internal state. The fix: extract dialog declarations to module level.

## Guidance

### Pattern 1: Module-level singleton counter (track open-state transitions, not mounts)

Use a module-level `let` variable with an exported accessor function to track dialog open state. Increment on open, decrement on close — inside the `onOpenChange` handler, not on component mount.

```typescript
let wizardOpenCount = 0

export function isImportWizardOpen(): boolean {
  return wizardOpenCount > 0
}
```

Inside the component, use `useEffect` watching `open` with a ref to detect transitions:

```typescript
const prevOpenRef = useRef(false)

useEffect(() => {
  if (open && !prevOpenRef.current) {
    wizardOpenCount++
  } else if (!open && prevOpenRef.current) {
    wizardOpenCount = Math.max(0, wizardOpenCount - 1)
  }
  prevOpenRef.current = open
}, [open])
```

The defensive `Math.max(0, ...)` on decrement prevents the counter from ever going negative if `onOpenChange` fires in an unexpected order.

### Pattern 2: Custom event for cross-component target updates

Define a custom event name as a `const` export. Pages dispatch it to re-target the existing wizard; the wizard listens via `useEffect` with cleanup.

```typescript
export const IMPORT_WIZARD_SET_TARGET = 'import-wizard-set-target' as const
```

Wizard listener (inside `useEffect` with cleanup):
```typescript
useEffect(() => {
  function handleSetTarget(e: Event) {
    const { pathId } = (e as CustomEvent<{ pathId: string | null }>).detail
    targetPathIdRef.current = pathId ?? undefined
    if (pathId && scannedCourse) {
      setSelectedPathId(pathId)
      setPathChoice('choose')
      setSelectedPosition(1)
      setStep('path')
    }
  }
  window.addEventListener(IMPORT_WIZARD_SET_TARGET, handleSetTarget)
  return () => window.removeEventListener(IMPORT_WIZARD_SET_TARGET, handleSetTarget)
}, [scannedCourse])
```

Caller pattern (synchronous click handler):
```typescript
const handleImportClick = useCallback(() => {
  if (isImportWizardOpen()) {
    window.dispatchEvent(
      new CustomEvent(IMPORT_WIZARD_SET_TARGET, { detail: { pathId: pathId ?? null } })
    )
  } else {
    setImportWizardOpen(true)
  }
}, [pathId])
```

### Pattern 3: Extract dialog components to module level

Inline dialog declarations cause remount on every parent render. Extract to module-level function components.

```typescript
// ❌ Wrong: inline dialog — new function reference every render, state lost on remount
export function LearningPaths() {
  const CreatePathDialog = ({ open, onOpenChange }) => { ... }
  return <CreatePathDialog open={...} onOpenChange={...} />
}

// ✅ Correct: module-level — stable reference, state preserved across parent re-renders
function CreatePathDialog({ open, onOpenChange }: { ... }) {
  const [name, setName] = useState('')
  // ...
}

export function LearningPaths() {
  return <CreatePathDialog open={...} onOpenChange={...} />
}
```

### Pattern 4: Pre-fill, not lock-in

The `targetPathId` prop pre-selects in step 3, but the user can always change the target, create a new path, or skip placement entirely. This avoids the "I clicked import from the wrong path and now I'm stuck" UX trap.

```typescript
useEffect(() => {
  if (step === 'path' && targetPathIdRef.current && learningPaths.length > 0) {
    const targetPathExists = learningPaths.some(p => p.id === targetPathIdRef.current)
    if (targetPathExists && !selectedPathId) {
      setSelectedPathId(targetPathIdRef.current)
      setPathChoice('choose')
      setSelectedPosition(1)
    }
  }
}, [step, learningPaths, selectedPathId])
```

## Why This Matters

**Singleton guard prevents duplicate dialogs.** Without it, clicking a second "Import Course" button while the wizard is open creates stacked dialogs — confusing and error-prone. Mount-counting doesn't work because multiple parents each render a dialog instance; transition-level counting is the correct primitive.

**Custom events sidestep React's concurrent limitations.** The guard check (`isImportWizardOpen()`) is synchronous in a click handler. Dispatching a custom event is the simplest way to communicate "re-target the existing dialog" across independent component trees without prop drilling, context, or a shared Zustand store — and avoids React 19 concurrent feature issues.

**Module-level extraction prevents silent state loss.** React identifies component types by reference. An inline function creates a new reference every render, causing React to unmount and remount the dialog. The component appears to work in isolation but loses state when its parent re-renders — a class of bug that is easy to miss in development because single-instance renders work fine.

**Pre-fill not lock-in preserves user agency.** If the user clicks "Import Course" from the wrong path, they can correct it in step 3 — no frustration, no data loss, no support ticket.

## When to Apply

- **Dialog singleton guard:** Any dialog that appears in 2+ independent entry points on the same route and should not have duplicates (import wizards, creation dialogs, pickers, file upload overlays).
- **Custom event re-targeting:** When a singleton dialog needs to receive a new target mid-flight from a sibling that is outside its React tree and not related by parent-child.
- **Module-level extraction:** Any dialog or overlay component that manages internal state and is rendered by multiple parents, or by a parent that re-renders frequently (e.g., on store subscription).
- **Pre-fill, not lock-in:** When a dialog opens with context from a specific location, pre-fill the contextual value but allow the user to change or skip it.

## Examples

### Full call-site: LearningPaths header vs card dropdown

```typescript
// Header button — no target path
const handleHeaderImport = useCallback(() => {
  if (isImportWizardOpen()) {
    window.dispatchEvent(new CustomEvent(IMPORT_WIZARD_SET_TARGET, { detail: { pathId: null } }))
  } else {
    setImportTargetPathId(null)
    setImportWizardOpen(true)
  }
}, [])

// Path card dropdown — has target path
const handlePathImport = useCallback((pathId: string) => {
  if (isImportWizardOpen()) {
    window.dispatchEvent(new CustomEvent(IMPORT_WIZARD_SET_TARGET, { detail: { pathId } }))
  } else {
    setImportTargetPathId(pathId)
    setImportWizardOpen(true)
  }
}, [])
```

### Full call-site: LearningPathDetail sidebar

```typescript
const handleImportClick = useCallback(() => {
  if (isImportWizardOpen()) {
    window.dispatchEvent(
      new CustomEvent(IMPORT_WIZARD_SET_TARGET, { detail: { pathId: pathId ?? null } })
    )
  } else {
    setImportWizardOpen(true)
  }
}, [pathId])
```

### AI hook with constrained context

```typescript
const pathPlacement = usePathPlacementSuggestion(
  courseName, tags, description,
  step === 'path' && showPathStep,
  targetPathIdRef.current ?? undefined
)
```

Hook internals: when `targetPathId` is present, filter the path context array to that single path before passing to the AI.

## Related

- `src/app/components/figma/ImportWizardDialog.tsx` — Singleton guard, custom event listener, pre-fill logic
- `src/app/pages/LearningPaths.tsx` — Call sites (header + card dropdown)
- `src/app/pages/LearningPathDetail.tsx` — Call site (sidebar import button)
- `src/ai/hooks/usePathPlacementSuggestion.ts` — Constrained AI context via `targetPathId`

### Related solution docs

- [Module-level singleton guard for in-flight dedup (Vault fallback)](../runtime-errors/api-key-vault-fallback-hardening-2026-05-01.md) — Same module-level singleton pattern applied to deduplicating concurrent API key vault reads. Uses `.finally()` cleanup instead of transition counting but shares the same "prevent duplicate concurrent operations" principle.
- [Dialog-gating state machine (Pure Router Shell)](../best-practices/pure-router-shell-structural-refactoring-2026-04-21.md) — Mutual exclusion of floating UI components (link dialog, upload wizard, download overlay). The state machine approach is a structural alternative to the counter-based guard.
- [Generation counter for stale async results](../best-practices/zustand-stale-async-results-generation-counter-2026-05-03.md) — Generalizes the "is this still relevant?" guard pattern that `wizardOpenCount` implements.
- [Linked vs unlinked branching pattern (Reader Panels)](../design-patterns/reader-contextual-linked-action-panels-2026-04-27.md) — "has context → pre-fill; no context → show full UI" mirrors the pre-fill vs lock-in pattern.
- [Post-E97 ref latching pattern](../best-practices/post-e97-cleanup-lessons-2026-04-21.md) — Ref-latching callback identity for overlay component lifecycles, applicable to wizard `targetPathId` prop management.
