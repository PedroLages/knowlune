---
title: WCAG 2.5.7 — Single-Pointer Alternatives for Drag-and-Drop Surfaces
date: 2026-04-25
problem_type: best_practice
category: best-practices
module: accessibility
component: figma/MoveUpDownButtons
tags:
  - wcag
  - accessibility
  - drag-and-drop
  - dnd-kit
  - focus-management
  - aria-disabled
applies_when:
  - Adding a sortable list with @dnd-kit/sortable
  - Auditing existing drag surfaces for WCAG 2.2 AA compliance
  - Building any reorder UI with multi-step focus restoration
---

# WCAG 2.5.7 — Single-Pointer Alternatives for Drag-and-Drop Surfaces

## Context

WCAG 2.5.7 (Dragging Movements, Level AA) requires that any feature operable via dragging movement also be achievable through a single-pointer alternative. In Knowlune, every `@dnd-kit/sortable` surface (learning paths, video lists, chapter editor, dashboard customizer) and the canvas-based avatar crop dialog needed accessible Move Up / Move Down buttons or +/- nudge controls so users with motor impairments — and mobile users who struggle with precise dragging — can operate them without a drag gesture.

Story: E66-S01. Implementation: PR #442.

## Guidance

Five durable lessons fell out of wiring this pattern across 5 sortable surfaces and the crop dialog.

### 1. Use `aria-disabled`, not the HTML `disabled` attribute

For boundary buttons (first row's Move Up, last row's Move Down), use `aria-disabled="true"` and short-circuit the click handler. Do **not** set the HTML `disabled` attribute.

```tsx
<Button
  type="button"
  variant="ghost"
  size="icon"
  aria-disabled={atBoundary || undefined}
  onClick={() => { if (atBoundary) return; onMove() }}
  aria-label={`Move ${itemLabel} up`}
>
  <ChevronUp aria-hidden="true" />
</Button>
```

**Why:** `disabled` removes the element from the focus order, so a screen-reader user tabbing along the row can't even discover that a Move Up control exists at this position. `aria-disabled` keeps the control focusable and announceable while preventing activation. This matches the [W3C ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) guidance for disabled-but-discoverable controls.

### 2. Key focus refs by stable id, not array index

After a reorder the array indices shift, so `refs[index]` after the state update points to a different DOM node than before. Key the ref map by the item's stable id (courseId, videoId, sectionId) and look up by id at focus-restoration time.

```tsx
const moveDownRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

const handleMoveDown = useCallback((index: number) => {
  const id = items[index]?.id              // capture id BEFORE the reorder
  reorder(index, index + 1)
  if (id) requestAnimationFrame(() => moveDownRefs.current.get(id)?.focus())
}, [items, reorder])
```

The `requestAnimationFrame` is load-bearing — focus must be requested **after** React has committed the re-render, otherwise the focus call lands on the not-yet-unmounted node and is lost.

### 3. Extract one component per pattern, not five copies

Five sortable surfaces means five chances to drift. A single `MoveUpDownButtons` component (with `index`, `total`, `itemLabel`, `onMoveUp`, `onMoveDown`, `upRef`, `downRef`, `size`) collapses the surface area: one place to fix any future a11y bug, one place to enforce 44×44 touch targets, one place to standardize the `aria-label` format. The original story even had inline buttons in `LearningPathDetail` using `disabled` instead of `aria-disabled` — extracting let me retire that drift in the same PR.

### 4. Lift a shared `reorderAndPersist(from, to)` helper

When a sortable surface already has `handleDragEnd`, do not rewrite the persistence logic for the button path — extract a shared helper both call into:

```tsx
const reorderAndPersist = useCallback(async (from: number, to: number) => {
  if (from === to) return
  const reordered = arrayMove(items, from, to).map((v, i) => ({ ...v, order: i }))
  onReorder(reordered)
  await persistOrder(reordered)
}, [items, onReorder])

const handleDragEnd = (e) => { /* compute indices */; reorderAndPersist(from, to) }
const handleMoveDown = (i) => { reorderAndPersist(i, i + 1) }
```

Without this, retry semantics, optimistic-update rollback, and toast feedback inevitably diverge between the two paths and screen-reader users get a different (worse) error story than mouse users.

### 5. `[data-testid^="prefix-"]` is greedy when you nest scoped testids

When a parent row has `data-testid="section-row-foo"` and you give its child Move Up button `data-testid="section-row-foo-move-up"`, a Playwright selector like `[data-testid^="section-row-"]` returns **both**. Filtering with `/^section-row-[^-]+$/` also fails because real ids contain hyphens (e.g. `recommended-next`). Use anchored negative-lookahead filtering instead:

```ts
const rows = await panel.locator('[data-testid^="section-row-"]').evaluateAll(els =>
  els
    .map(el => el.getAttribute('data-testid'))
    .filter((tid): tid is string =>
      !!tid && /^section-row-/.test(tid) && !/-move-(up|down)$/.test(tid)
    )
)
```

Or — cleaner — give the row container and the move buttons disjoint prefixes (`row-{id}` vs `row-{id}-move-up`).

## Why This Matters

WCAG 2.5.7 became Level AA in WCAG 2.1 / 2.2, so it is mandatory for any product that claims AA conformance. Beyond compliance, a button-driven reorder is significantly faster than drag for keyboard users, single-switch users, and anyone on a phone in a moving vehicle. The cost (a 44×44 icon-button pair per row) is trivial compared to the user experience win — and we shipped it without removing or even modifying the drag UX.

## When to Apply

- Any new sortable list. Wire `MoveUpDownButtons` from day 1; retrofitting later means revisiting persistence and focus management twice.
- Any drag-positioning UI (crop, image-pan, slider-with-handle). Provide visible nudge buttons (+/- for each axis), not just keyboard arrow handlers — many users never discover keyboard shortcuts.
- Any audit of an existing surface that uses `useSortable`. Search for `{...listeners}` to find drag handles; every one needs an adjacent button alternative.

## Examples

The reusable component lives at [`src/app/components/figma/MoveUpDownButtons.tsx`](../../../src/app/components/figma/MoveUpDownButtons.tsx). Wired-up call sites:

- [`src/app/pages/LearningPathDetail.tsx`](../../../src/app/pages/LearningPathDetail.tsx) — `SortableCourseRow`
- [`src/app/pages/AILearningPath.tsx`](../../../src/app/pages/AILearningPath.tsx) — `SortableCourseCard`
- [`src/app/components/figma/VideoReorderList.tsx`](../../../src/app/components/figma/VideoReorderList.tsx) — `SortableVideoRow`
- [`src/app/components/figma/YouTubeChapterEditor.tsx`](../../../src/app/components/figma/YouTubeChapterEditor.tsx) — `SortableChapter` and `SortableVideoRow` (both contexts)
- [`src/app/components/DashboardCustomizer.tsx`](../../../src/app/components/DashboardCustomizer.tsx) — `SortableSectionRow`
- [`src/app/components/ui/avatar-crop-dialog.tsx`](../../../src/app/components/ui/avatar-crop-dialog.tsx) — nudge toolbar (axis arrows + zoom +/-)

E2E audit pattern: [`tests/e2e/e66-s01-drag-alternatives.spec.ts`](../../../tests/e2e/e66-s01-drag-alternatives.spec.ts).

## References

- WCAG 2.5.7 Dragging Movements: <https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures.html>
- W3C ARIA Authoring Practices, "disabled vs aria-disabled": <https://www.w3.org/WAI/ARIA/apg/practices/hiding-and-updating-content/>
- Story: `docs/implementation-artifacts/stories/E66-S01-dragging-movement-alternatives.md`
- Plan: `docs/plans/2026-04-25-002-feat-e66-s01-dragging-movement-alternatives-plan.md`
