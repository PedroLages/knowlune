# Design Review (v2): E03-S01 — Markdown Note Editor with Autosave

**Date**: 2026-02-23
**Type**: Re-review after blocker fixes
**Reviewer**: Design Review Agent (Playwright MCP)
**Route tested**: `/courses/operative-six/op6-introduction` (Notes tab)
**Viewports**: Desktop (1440px), Tablet (768px), Mobile (375px)

## Previous Blocker Verification

### B1: Missing focus ring on ToolbarButton — FIXED
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` working correctly
- Ring: 2px solid blue-600, 1px white offset
- Only appears on keyboard focus (`:focus-visible`), not on mouse clicks

### B2: Duplicate Link extension — FIXED
- Link configured through StarterKit with `protocols: ['video']`
- No standalone `@tiptap/extension-link` import
- Zero Tiptap console warnings

## Findings

### High Priority
- **H1**: Toolbar buttons 32x32px — below 44px WCAG 2.5.5 minimum (persists from v1)
- **H2**: `window.prompt()` for link insertion — no validation, blocks thread (persists from v1)

### Medium
- **M1**: Add Timestamp button focus ring style differs slightly from ToolbarButton (3px vs 2px)
- **M2**: Status bar renders 32px empty space when autosave indicator is hidden

### Nits
- **N1**: Toolbar separator dividers lack `role="separator"`
- **N2**: ToolbarButton missing `aria-pressed` for toggle state

## Verdict
**Blockers resolved.** No new blockers. H1/H2 persist from v1 (user chose to defer).
