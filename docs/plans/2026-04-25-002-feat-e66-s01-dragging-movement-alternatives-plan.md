---
title: "feat(E66-S01): Dragging Movement Alternatives (WCAG 2.5.7)"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e66-s01-dragging-movement-alternatives-requirements.md
---

# feat(E66-S01): Dragging Movement Alternatives (WCAG 2.5.7)

## Overview

Add single-pointer alternatives (Move Up / Move Down icon buttons) to every `@dnd-kit/sortable` surface in Knowlune, plus +/- nudge controls on the Avatar Crop Dialog, so all drag-driven interactions can be operated without dragging movements (WCAG 2.5.7 Level AA). Existing drag UX is preserved.

## Problem Frame

WCAG 2.5.7 requires single-pointer alternatives to any drag interaction. Knowlune currently has 5 sortable surfaces and a canvas-based crop dialog that all require dragging. Users with motor impairments, single-switch users, and many mobile users cannot operate these surfaces today.

(see origin: [docs/brainstorms/2026-04-25-e66-s01-dragging-movement-alternatives-requirements.md](../brainstorms/2026-04-25-e66-s01-dragging-movement-alternatives-requirements.md))

## Requirements Trace

- R1. Each sortable row exposes Move Up / Move Down buttons with `aria-label="Move <itemLabel> up|down"`.
- R2. First item's Move Up and last item's Move Down use `aria-disabled="true"` (focusable but inert).
- R3. Activating a button reorders by 1, persists, and returns focus to the same item's button at the new index.
- R4. Pattern applied to: `LearningPathDetail`, `AILearningPath`, `VideoReorderList`, `YouTubeChapterEditor` (both contexts), `DashboardCustomizer`.
- R5. Avatar Crop Dialog exposes nudge buttons for X, Y offset and zoom-equivalent (size).

## Scope Boundaries

- Existing drag handles and drag UX are preserved unchanged.
- No multi-select, drag-keyboard-sensor, or "move to position" affordance.
- No row redesign beyond inserting the button cluster.

### Deferred to Separate Tasks

- `aria-live` announcements of new position after reorder — nice-to-have, not in AC.

## Context & Research

### Relevant Code and Patterns

- `src/app/pages/LearningPathDetail.tsx` — `SortablePathItem` (~line 103), `useSortable`, `arrayMove`, drag-end handler at ~line 918.
- `src/app/pages/AILearningPath.tsx` — sortable item ~line 48.
- `src/app/components/figma/VideoReorderList.tsx` — `SortableVideoItem` ~line 49.
- `src/app/components/figma/YouTubeChapterEditor.tsx` — two sortable contexts (~lines 586, 834).
- `src/app/components/DashboardCustomizer.tsx` — `SortableWidgetItem` ~line 59.
- `src/app/components/ui/avatar-crop-dialog.tsx` — custom canvas implementation; `cropRegion: { x, y, width, height }` state at line 70.
- `src/app/components/ui/button.tsx` — use `variant="ghost" size="icon"` for icon buttons.

### Institutional Learnings

- Use design tokens only — `text-muted-foreground`, `text-muted-foreground/50` for disabled state (per `.claude/rules/styling.md`).
- 44×44 minimum touch target for mobile (`min-w-11 min-h-11`).
- Use `aria-disabled` instead of `disabled` so screen readers can still focus the control.
- Focus restoration after reorder must use `requestAnimationFrame` since DOM re-renders.

## Key Technical Decisions

- **Reusable component**: Single `MoveUpDownButtons` in `src/app/components/figma/` accepting `index`, `total`, `itemLabel`, `onMoveUp`, `onMoveDown`. Avoids 5x duplication.
- **Ref forwarding**: Component accepts an optional `upRef`/`downRef` (or exposes via callback) so parents can restore focus to the moved item's button at its new index.
- **Persistence reuse**: Each surface already has a drag-end handler that calls `arrayMove` then a setter / persistence call. Button handlers reuse the exact same setter/persistence code path — extract a `handleReorder(from, to)` helper inside each surface where it doesn't already exist.
- **Avatar crop nudge**: Since the crop is a `{x, y, width, height}` rect on a canvas, "zoom" maps to growing/shrinking `width`/`height` while keeping centered. Increments: 8px for position, 16px for size, clamped to canvas bounds and the existing minimum crop size.
- **`aria-disabled` semantics**: Render `<button>` without the HTML `disabled` attribute, but set `aria-disabled="true"` and short-circuit the click handler.

## Open Questions

### Resolved During Planning

- Avatar crop library? **Resolved**: it's a custom canvas component (`avatar-crop-dialog.tsx`); we add nudge buttons that mutate `cropRegion` state directly.
- Where do button handlers persist order? **Resolved**: reuse each surface's existing `handleDragEnd` setter path.

### Deferred to Implementation

- Exact button placement (left of drag handle vs. stacked vertically) — final pixel placement decided in JSX based on row layout, validated in design review.
- Whether `YouTubeChapterEditor`'s two sortable contexts share enough structure to extract a sub-component — decided when reading the code in unit 5.

## Implementation Units

- [ ] **Unit 1: Create `MoveUpDownButtons` reusable component**

**Goal:** Single accessible component that renders Move Up + Move Down icon buttons with proper a11y semantics.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `src/app/components/figma/MoveUpDownButtons.tsx`
- Test: `src/app/components/figma/__tests__/MoveUpDownButtons.test.tsx`

**Approach:**
- Props: `{ index: number; total: number; itemLabel: string; onMoveUp: () => void; onMoveDown: () => void; orientation?: 'horizontal' | 'vertical' }`.
- Use `ChevronUp` / `ChevronDown` from lucide-react.
- Use shadcn `Button` with `variant="ghost" size="icon"` and `min-w-11 min-h-11`.
- Disabled state: `aria-disabled="true"` + `text-muted-foreground/50`, click handler short-circuits when disabled.
- `aria-label`: `Move ${itemLabel} up` / `Move ${itemLabel} down`.
- Forward refs via `React.forwardRef` plus a secondary `downRef` callback prop, so parents can manage focus on both buttons.

**Patterns to follow:**
- Other figma/ icon-button components in `src/app/components/figma/`.
- Design tokens per `.claude/rules/styling.md`.

**Test scenarios:**
- Happy path: renders both buttons with correct `aria-label` derived from `itemLabel`.
- Edge case: when `index === 0`, Move Up has `aria-disabled="true"` and click does not fire `onMoveUp`.
- Edge case: when `index === total - 1`, Move Down has `aria-disabled="true"` and click does not fire `onMoveDown`.
- Edge case: when `total === 1`, both buttons disabled.
- Happy path: clicking active Move Up fires `onMoveUp`; clicking active Move Down fires `onMoveDown`.
- Happy path: meets 44×44 min size (assert classes).

**Verification:**
- All unit tests green.
- ESLint clean (no hardcoded colors).

- [ ] **Unit 2: Wire into `LearningPathDetail.tsx`**

**Goal:** Reorder courses in a learning path via Move Up/Down with focus preservation.

**Requirements:** R1–R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/LearningPathDetail.tsx`

**Approach:**
- Inside `SortablePathItem`, render `MoveUpDownButtons` adjacent to the existing `{...listeners}` drag handle.
- Lift a `handleReorder(fromIndex, toIndex)` helper from existing `handleDragEnd` so both drag and button paths use it.
- Maintain `buttonRefs.current: Array<HTMLButtonElement | null>` indexed by item id; after reorder, `requestAnimationFrame(() => buttonRefs.current[newIndex]?.focus())`.
- `itemLabel` = course name/title.

**Patterns to follow:** existing `handleDragEnd` + `arrayMove` usage.

**Test scenarios:**
- Integration (E2E in Unit 8): clicking Move Down on a middle course reorders it down by one and persists.
- Integration: clicking Move Up on first item is a no-op (button is `aria-disabled`).

**Verification:**
- Manual: drag still works; buttons reorder and focus stays on the moved item.

- [ ] **Unit 3: Wire into `AILearningPath.tsx`**

**Goal:** Same pattern on the AI learning path sortable.

**Requirements:** R1–R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/pages/AILearningPath.tsx`

**Approach:** Mirror Unit 2 pattern in this file's sortable item (~line 48). Reuse the file's existing setter / persistence path.

**Test scenarios:**
- Integration (manual + E2E audit): buttons present and disabled at boundaries.

**Verification:** drag UX unchanged; buttons reorder.

- [ ] **Unit 4: Wire into `VideoReorderList.tsx`**

**Goal:** Same pattern on `SortableVideoItem`.

**Requirements:** R1–R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/VideoReorderList.tsx`

**Approach:** Mirror Unit 2. `itemLabel` = video title.

**Test scenarios:**
- Integration: buttons present, reorder works, focus preserved.

**Verification:** drag UX unchanged.

- [ ] **Unit 5: Wire into `YouTubeChapterEditor.tsx` (both contexts)**

**Goal:** Cover both sortable contexts (~lines 586 and 834).

**Requirements:** R1–R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/figma/YouTubeChapterEditor.tsx`

**Approach:** Add `MoveUpDownButtons` to each sortable item in both contexts. If both contexts share an inner item shape, extract a small local sub-component; otherwise duplicate the wiring.

**Test scenarios:**
- Integration: Both lists render Move Up/Down.
- Edge case: Independent lists — moving an item in list A doesn't affect list B.

**Verification:** drag UX unchanged in both lists.

- [ ] **Unit 6: Wire into `DashboardCustomizer.tsx`**

**Goal:** Reorder dashboard widgets via buttons.

**Requirements:** R1–R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/app/components/DashboardCustomizer.tsx`

**Approach:** Mirror Unit 2 pattern on `SortableWidgetItem`. `itemLabel` = widget name.

**Test scenarios:**
- Integration: widgets reorder via buttons; persistence path unchanged.

**Verification:** drag UX unchanged.

- [ ] **Unit 7: Avatar Crop Dialog nudge controls**

**Goal:** Position and size the crop without dragging.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/ui/avatar-crop-dialog.tsx`

**Approach:**
- Add a small toolbar of icon buttons under or beside the canvas:
  - Move crop left / right / up / down (8px steps, clamped to canvas bounds).
  - Zoom in / out (size +/- 16px while keeping center, clamped to `MIN_CROP_SIZE` and canvas size).
- Each button: `variant="ghost" size="icon"`, `min-w-11 min-h-11`, `aria-label` like "Move crop left", "Zoom crop in", etc.
- Mutates the existing `cropRegion` state — re-uses the existing canvas redraw effect.

**Test scenarios:**
- Happy path (manual + spec assertion): clicking right shifts `cropRegion.x` by +8, redraws.
- Edge case: clicking left at `x === 0` clamps (no negative x).
- Edge case: zoom-out at min size clamps to `MIN_CROP_SIZE`.
- Edge case: zoom-in at canvas bounds clamps.

**Verification:** Crop can be fully positioned and sized using only the new buttons.

- [ ] **Unit 8: E2E audit spec**

**Goal:** Regression-proof presence of Move Up/Down across sortable surfaces and exercise the LearningPathDetail flow.

**Requirements:** R1–R4

**Dependencies:** Units 1–6

**Files:**
- Create: `tests/e2e/e66-s01-drag-alternatives.spec.ts`

**Approach:**
- Navigate to LearningPathDetail with seeded data; assert each course row has buttons with the expected `aria-label`.
- Click Move Down on the first course; assert order changed and that the same course's Move Down button is focused.
- For the other surfaces (AI Learning Path, VideoReorderList, YouTubeChapterEditor, DashboardCustomizer), assert buttons exist with correct labels (presence audit; reorder behavior covered for one surface to keep runtime bounded).

**Patterns to follow:** existing E2E specs in `tests/e2e/`, deterministic time + IndexedDB seeding helpers per `.claude/rules/testing/test-patterns.md`.

**Test scenarios:**
- Happy path: reorder via Move Down on LearningPathDetail.
- Edge case: First-row Move Up has `aria-disabled="true"`.
- Edge case: Last-row Move Down has `aria-disabled="true"`.
- Audit: presence on every sortable surface listed in R4.

**Verification:** spec green in Chromium.

## System-Wide Impact

- **Interaction graph:** Each sortable surface's `handleDragEnd` and the new button handlers must converge on the same `handleReorder(from, to)` function so persistence is identical regardless of input modality.
- **Error propagation:** No new IO — same persistence path as drag. No new error surfaces.
- **State lifecycle risks:** Focus refs must be cleared/recreated when items mount/unmount; use a `Map<id, HTMLButtonElement>` keyed by stable item id, not array index.
- **API surface parity:** No public API changes; `MoveUpDownButtons` is an internal component.
- **Integration coverage:** E2E audit (Unit 8) covers cross-component presence — unit tests alone cannot prove all 5 surfaces wired.
- **Unchanged invariants:** Existing drag handles, drag-end persistence, and visual layout outside the new button cluster.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Focus drift after re-render (refs stale) | Key refs by item id (not index); `requestAnimationFrame` + lookup by new index. |
| Mobile row overflow with extra buttons | Validate in design review on 375px width; if cramped, use vertical stack or hide drag handle on mobile (drag-on-touch is already poor). |
| `YouTubeChapterEditor` second context missed | Plan explicitly enumerates both contexts; E2E audit asserts both. |
| Avatar crop clamping bugs (off-by-one at canvas bounds) | Unit assertions on min/max clamping in unit 7 manual checks. |
| Hardcoded color regression | ESLint `design-tokens/no-hardcoded-colors` blocks at save-time. |

## Documentation / Operational Notes

- Story file (`E66-S01`) updated with completed checkboxes and lessons learned during `ce:work`.
- No CSP, env, or rollout concerns — pure UI/a11y.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-e66-s01-dragging-movement-alternatives-requirements.md](../brainstorms/2026-04-25-e66-s01-dragging-movement-alternatives-requirements.md)
- Story file: [docs/implementation-artifacts/stories/E66-S01-dragging-movement-alternatives.md](../implementation-artifacts/stories/E66-S01-dragging-movement-alternatives.md)
- WCAG 2.5.7: <https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures.html>
- Design tokens: `src/styles/theme.css`, `.claude/rules/styling.md`
