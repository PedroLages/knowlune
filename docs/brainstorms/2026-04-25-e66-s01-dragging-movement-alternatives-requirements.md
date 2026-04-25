# E66-S01: Dragging Movement Alternatives — Requirements

**Status:** ready-for-planning
**Source story:** [docs/implementation-artifacts/stories/E66-S01-dragging-movement-alternatives.md](../implementation-artifacts/stories/E66-S01-dragging-movement-alternatives.md)
**Date:** 2026-04-25

## Problem

WCAG 2.5.7 (Dragging Movements, Level AA) requires that any functionality operable via dragging movement also be achievable through a single-pointer alternative. Knowlune currently has multiple `@dnd-kit/sortable` reorder surfaces and an avatar crop that depend on drag interactions. Users with motor impairments cannot reliably reorder courses, chapters, widgets, or position avatar crops without dragging.

## Goal

Add accessible single-pointer alternatives (Move Up/Move Down icon buttons, and +/- nudge controls for the avatar crop) to every drag-and-drop surface in the app, while preserving the existing drag UX for users who prefer it.

## Users / Persona

- Users with motor impairments (tremors, limited dexterity, single-switch input) who cannot perform drag gestures.
- Mobile users who find precise dragging on small touch targets frustrating.
- Keyboard-only users who need a focusable, click/Enter-activatable alternative.

## Acceptance Criteria (from story)

1. Each sortable row exposes Move Up / Move Down icon buttons alongside the drag handle, with `aria-label` of the form `Move <itemLabel> up|down`.
2. First item's Move Up is `aria-disabled="true"`; last item's Move Down is `aria-disabled="true"` (element stays focusable).
3. Activating Move Up / Down reorders the item by one position, persists the new order, and keeps focus on the same item's button.
4. Pattern is applied to: `LearningPathDetail`, `AILearningPath`, `VideoReorderList`, `YouTubeChapterEditor` (both sortable contexts), `DashboardCustomizer`.
5. Avatar crop dialog exposes nudge controls (+/- buttons) for X offset, Y offset, and zoom, each labeled, allowing crop positioning without dragging.

## In Scope

- New reusable `MoveUpDownButtons` component in `src/app/components/figma/` with ChevronUp/ChevronDown icons, 44px min touch target, `aria-disabled` semantics, and `aria-label` derived from `itemLabel`.
- Wire the component into all 5 sortable surfaces with handlers using `arrayMove` and the existing persistence path (whatever each surface already calls after a drag-end).
- Focus restoration via `requestAnimationFrame` + ref to the moved item's button at its new index.
- Avatar crop nudge controls (locate the crop component, add `+/-` buttons for X, Y, zoom).
- Unit tests for `MoveUpDownButtons` (disabled states, aria-label, click handlers).
- E2E audit spec at `tests/e2e/e66-s01-drag-alternatives.spec.ts` validating presence on all sortable surfaces and a reorder via buttons on `LearningPathDetail`.

## Out of Scope

- Removing or redesigning the existing drag handles (buttons are supplemental).
- Keyboard drag-and-drop via `@dnd-kit` keyboard sensor enhancements (orthogonal — buttons supersede this for the AC).
- Bulk reorder (multi-select / move-to-position).
- Visual redesign of the rows beyond placing the new buttons.
- Accessibility audits of unrelated drag surfaces (e.g., Kanban-style boards) not listed in the story.

## Dependencies / Constraints

- Already installed: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `lucide-react`.
- Must use design tokens (no hardcoded colors). Use `variant="ghost"` `size="icon"` from shadcn Button or matching custom icon-button styles.
- Must preserve existing persistence semantics — buttons must call into the same setter / persistence path the drag-end handler currently uses.
- Avatar crop library is unknown; locate it before designing the nudge UI (likely `react-easy-crop`).

## Risks

1. **Focus management drift** after re-render — mitigated by `requestAnimationFrame` + indexed refs.
2. **Two sortable contexts in `YouTubeChapterEditor`** — must wire both, not just the first.
3. **Persistence side effects** — some surfaces may rely on drag-end events to persist; need to extract or duplicate that logic for button-driven reorder.
4. **Mobile layout overflow** — adding 2 buttons + drag handle may overflow narrow rows; verify responsive layout.

## Success Metrics

- All 5 sortable surfaces + avatar crop pass WCAG 2.5.7 manual audit.
- E2E audit spec green.
- No regression in existing drag UX (snapshot of drag-end handlers preserved).

## Open Questions

- Should keyboard activation announce the new position via `aria-live`? (Nice-to-have, not in AC.)
- Is the avatar crop library `react-easy-crop` or custom? (Determines nudge implementation.)

## References

- WCAG 2.5.7: <https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures.html>
- Existing patterns: `src/app/pages/LearningPathDetail.tsx` (SortablePathItem)
- Design tokens: `src/styles/theme.css`
- Story file: `docs/implementation-artifacts/stories/E66-S01-dragging-movement-alternatives.md`
