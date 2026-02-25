# Design Review: E03-S12 — Code & Media Blocks

**Date**: 2026-02-24
**Story**: E03-S12 — Code & Media Blocks
**Route tested**: `/courses/intro-to-ui-ux-design/lesson-1` (LessonPlayer with NoteEditor)

## Viewports Tested

- Desktop: 1440px
- Tablet: 768px
- Mobile: 375px

## Evidence Summary

All findings backed by live Playwright measurements:

- **Background colour**: `rgb(250, 245, 238)` confirmed via `getComputedStyle(document.body).backgroundColor` — matches `#FAF5EE`
- **YouTube 16:9**: aspect ratio `0.563` = `9/16` confirmed at all three viewports via `getBoundingClientRect()`
- **Toolbar button sizes**: all 14 visible buttons measured at exactly `44x44px` on mobile
- **Details toggle button**: `20x20px` measured at both desktop and mobile
- **Dialog buttons**: `32px` height confirmed via `getBoundingClientRect()`
- **YouTube iframe**: `title: null` confirmed via `getAttribute('title')`
- **Details toggle**: `aria-label: null` and `aria-expanded: null` confirmed via DOM inspection
- **Language select focus ring**: native browser outline `rgb(37,99,235) solid 2px` observed when focused via Tab key
- **Console errors**: two CSP errors — both pre-existing dev environment issues (Google Fonts + YouTube iframe), not application bugs

## Findings

### High Priority

1. **Details toggle button 20x20px** — below 44px minimum touch target (WCAG 2.5.5). Learners on mobile will struggle to tap the tiny triangle. Increase clickable area to at least 44x44px while keeping visual triangle small.

2. **YouTube iframe missing `title` attribute** — WCAG 2.4.1 requires iframes to have descriptive titles. Add `title="YouTube video"` or similar.

3. **Details toggle missing ARIA attributes** — No `aria-label` or `aria-expanded` on the toggle button. Screen readers cannot convey the toggle state.

4. **Dialog buttons at 32px height** — Below 44px mobile touch target recommendation. Consider increasing dialog action button padding.

### Medium

5. **Language selector relies on native `<select>`** — Functional but visually inconsistent with the shadcn/ui design language. Consider a custom dropdown in future iteration.

### Passes

- Background colour: correct `#FAF5EE`
- YouTube 16:9 responsive at all viewports
- Toolbar buttons: 44px touch targets
- Code block syntax highlighting: visible and themed
- Responsive layout: editor fills available space at all viewports
- No application console errors
