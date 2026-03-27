# Design Review: E29-S04 — Remove focus-visible:outline-none from Legal Pages

**Date:** 2026-03-27
**Reviewer:** Claude Opus 4.6 (Playwright MCP)
**Story:** E29-S04 — Remove focus-visible:outline-none from Legal Pages

## Summary

PASS — All acceptance criteria verified visually via Playwright browser automation.

## Findings

### Privacy Policy (`/privacy`)

| Check | Result | Notes |
|-------|--------|-------|
| TOC links show focus ring on Tab | PASS | `ring-2 ring-brand ring-offset-2` visible on all 10 TOC links |
| `focus-visible:outline-none` absent | PASS | Replaced with `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` |
| WCAG 2.4.7 Focus Visible | PASS | Focus indicator clearly visible |

### Terms of Service (`/terms`)

| Check | Result | Notes |
|-------|--------|-------|
| TOC links show focus ring on Tab | PASS | `ring-2 ring-brand ring-offset-2` visible on all 13 TOC links |
| Cross-page Privacy Policy link (Section 1) shows focus ring | PASS | Computed styles confirm 2px solid brand-color outline with offset |
| `focus-visible:outline-none` absent | PASS | All 3 occurrences replaced |
| WCAG 2.4.7 Focus Visible | PASS | Focus indicator clearly visible |

### Dark Mode

| Check | Result | Notes |
|-------|--------|-------|
| Focus ring visible in dark mode | PASS | Brand color ring visible against dark background |
| Ring offset contrast | PASS | White offset gap provides clear separation |

## Issues Found

None. All acceptance criteria satisfied.

## Notes

- 31 other files in the codebase still contain `focus-visible:outline-none` — this is outside the scope of E29-S04 which targets only legal pages
- The `ring-offset-2` default uses white, which works well in light mode but creates a small white gap in dark mode; this is standard Tailwind behavior and acceptable
