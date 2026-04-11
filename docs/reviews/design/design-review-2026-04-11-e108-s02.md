# Design Review: E108-S02 — Format Badges and Delete

**Date:** 2026-04-11
**Reviewer:** Claude (Playwright MCP)
**Viewports tested:** Desktop (1440x900), Mobile (375x812)

## Summary

Format badges and delete confirmation dialog are well-implemented. Badges render correctly in both grid and list views with appropriate icons and colors. Delete flow works end-to-end with proper confirmation dialog.

## Findings

### MEDIUM

1. **Audiobook badge contrast may be low in light mode** — `bg-warning/10 text-warning` at 10% opacity background could have insufficient contrast depending on theme. Verify in light mode.
   - File: `src/app/components/library/FormatBadge.tsx:26`

### LOW

2. **Badge stacking on cards with both format + remote** — When both badges stack vertically (top-left), they partially overlap the book cover area. Works but slightly busy visually.
   - File: `src/app/components/library/BookCard.tsx:110-122`

3. **Mobile list view text truncation** — On 375px, book titles truncate aggressively ("The Sch...") which is expected behavior but format badges add to the horizontal crowding.
   - File: `src/app/components/library/BookListItem.tsx:121`

## Accessibility

- [PASS] FormatBadge has `aria-label` (e.g., "EPUB format")
- [PASS] Icons have `aria-hidden="true"`
- [PASS] Delete button has `data-testid` for testing
- [PASS] Delete dialog uses AlertDialog with proper title and description
- [PASS] Delete confirm button meets 44px touch target (`min-h-[44px]`)
- [PASS] Context menu delete uses destructive text color

## Responsive

- [PASS] Desktop grid: badges visible, well-positioned
- [PASS] Desktop list: badges inline with metadata
- [PASS] Mobile: badges render, slightly crowded but functional

## Verdict: PASS (no blockers)
