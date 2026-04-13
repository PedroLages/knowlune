# Design Review: E71-S03

**Date**: 2026-04-13
**Story**: E71-S03 — Knowledge Map Integration and Tests

## Status: BLOCKED

The Knowledge Map page crashes with "Maximum update depth exceeded" (infinite re-render loop) before any UI renders. The error boundary catches it and shows a fallback. No visual design review is possible until BLOCKER B1 is resolved.

## Code-Level Design Observations

From code review of the JSX structure:

1. **Desktop layout**: `flex gap-6` with treemap as `flex-1` and sidebar as `w-80` — matches AC2.
2. **Mobile layout**: `SuggestedActionsPanel` rendered inline above topic list via `isMobile` conditional — matches AC3.
3. **Sticky sidebar**: `sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-y-auto` — good for long action lists.
4. **Design tokens**: All classes use tokens (bg-brand, text-muted-foreground, etc.) — compliant.

## Pending After Fix

- Visual regression at 375px, 768px, 1440px
- Contrast verification on action cards
- Touch target sizes on mobile CTA buttons
- Panel scroll behavior on desktop with many suggestions
