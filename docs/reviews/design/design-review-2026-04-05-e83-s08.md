# Design Review: E83-S08 PWA Offline Shell for Library

**Date:** 2026-04-05
**Reviewer:** Claude Opus 4.6 (1M context)
**Story:** E83-S08 PWA Offline Shell for Library

## Viewports Tested

- Desktop (1400x900) via Playwright MCP

## Findings

### Verified Correct

1. **Online state**: No offline badge shown when online -- correct behavior confirmed via screenshot
2. **Offline badge markup**: Uses `role="status"`, `aria-label="You are offline"`, `aria-hidden="true"` on icon -- proper accessibility
3. **Design tokens**: Uses `bg-warning/10` and `text-warning-foreground` -- correct token usage, no hardcoded colors
4. **Badge styling**: `rounded-full`, `text-xs`, `font-medium` with WifiOff icon at `size-3` -- consistent with app badge patterns
5. **Layout**: Badge sits inline with "Books" heading via `flex items-center gap-3` -- clean alignment

### LOW

1. **Offline badge not visually testable in dev mode** -- Cannot simulate offline in Playwright MCP without CDP network emulation. Badge logic depends on `navigator.onLine` which cannot be toggled in this test environment. Visual verification deferred to manual testing.

## Verdict

**PASS** -- Design implementation is clean, accessible, and follows design system conventions.
