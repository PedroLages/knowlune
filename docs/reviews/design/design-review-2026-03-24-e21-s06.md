# Design Review: E21-S06 Smart Dashboard Reordering

**Date:** 2026-03-24
**Reviewer:** Claude Opus 4.6 (automated)
**Method:** Static code analysis (Playwright MCP not available in this session)

## Component Analysis

### DashboardCustomizer.tsx

**Accessibility (WCAG 2.1 AA):**
- `aria-expanded` on toggle button: PASS
- `aria-controls` linking toggle to panel: PASS
- `role="region"` with `aria-label` on panel: PASS
- `role="list"` / `role="listitem"` on section list: PASS
- `aria-label` on drag handles: PASS (`"Drag to reorder ${label}"`)
- `aria-label` on pin/unpin buttons: PASS (contextual labels)
- `aria-hidden="true"` on decorative icons: PASS
- Keyboard drag-and-drop via dnd-kit KeyboardSensor: PASS

**Design Tokens:**
- No hardcoded colors detected. Uses: `text-muted-foreground`, `bg-card`, `border-border/50`, `bg-brand-soft`, `text-brand-soft-foreground`, `text-brand`, `bg-muted`, `text-warning`
- All conform to the project design token system.

**Responsive Design:**
- Customizer uses `px-3 py-2.5` compact spacing suitable for mobile
- Drag handles use `touch-manipulation` for mobile touch events
- GripVertical icon at `size-4` meets minimum touch target when combined with padding

**Styling:**
- Card radius: `rounded-[24px]` for panel, `rounded-xl` for rows -- matches project convention
- Consistent spacing with Tailwind utilities
- Backdrop blur effect (`backdrop-blur`) for visual depth

### Overview.tsx Integration

**Section Ordering:**
- Hero Zone correctly pinned first (never reordered)
- Import Course empty state correctly pinned last (never reordered)
- All 7 reorderable sections have `data-testid` attributes
- `ref={createSectionRef(sectionId)}` properly attaches IntersectionObserver

**Animation:**
- Framer Motion `MotionConfig reducedMotion="user"` respects user preference: PASS
- `viewportAnimation` with `once: true` prevents re-triggering: PASS

## Findings

### MEDIUM: No visual feedback during drag operation (Story-Related)

The `isDragging` state only applies `opacity-50 shadow-lg`. There is no drag overlay or placeholder indicator. Users may have difficulty seeing where the item will land. Consider adding a `DragOverlay` from dnd-kit for a better drag experience.

### LOW: Reset button always visible when panel is open (Story-Related)

Per AC5, the reset button should only appear "when order differs from default." Currently the Reset button shows whenever the customizer panel is open, regardless of whether the user has customized anything. The `isManuallyOrdered` prop is available but not used to conditionally show the reset button.

### LOW: Missing mobile touch-and-hold guidance (Story-Related)

The design guidance specifies "Drag handles hidden on mobile (touch-and-hold for reorder instead)" but the current implementation shows drag handles at all viewport sizes. No responsive hiding is implemented.

## Pre-Existing Issues

None detected in the design review scope.

## Verdict

**PASS with recommendations.** Accessibility is comprehensive. Design tokens are correctly used. Two LOW items and one MEDIUM item for UX polish -- none are blockers.
