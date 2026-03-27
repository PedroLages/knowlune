# Design Review: E29-S03 — Fix CareerPaths Mislabelling and Add Sidebar Nav Entry

**Date:** 2026-03-27
**Reviewer:** Claude (automated, Playwright MCP)
**Viewports tested:** 800x461 (mobile/tablet)
**Verdict:** PASS (with notes)

## AC Verification via Browser

### AC1: Page heading reads "Career Paths"
- **PASS** — `<h1>` heading renders as "Career Paths" on `/career-paths`
- **NOTE** — 6 other text strings in CareerPaths.tsx still say "learning paths" (error messages, aria-labels, empty states). These are not visible in the happy-path render but affect screen readers and error/empty states. See code review B1.

### AC2: Sidebar "Career Paths" entry exists
- **PASS** — "Career Paths" entry visible in sidebar navigation under Library group
- **PASS** — Entry highlights as active on `/career-paths` and `/career-paths/:id` (verified on both routes)
- **PASS** — Compass icon differentiates from Learning Paths (Route icon)
- Keyboard navigation not testable in headless mode but code uses standard `<Link>` element which is natively focusable

### AC3: Back-link reads "Back to career paths"
- **PASS** — `aria-label="Back to career paths"` confirmed on back-link element
- **PASS** — Badge text reads "Career Path" (not "Learning Path")
- **PASS** — Link navigates to `/career-paths`

## Visual Consistency
- Sidebar entry follows same pattern as other Library entries (icon + label)
- No layout shifts or visual regressions observed
- Heading typography consistent with other pages (text-4xl/5xl/6xl responsive)

## Accessibility Notes
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand` on back-link is correct pattern (replaces default outline with ring)
- The remaining `aria-label="Learning paths"` on the path list (line 346) and `aria-label="Search learning paths"` (line 315) are accessibility bugs — see code review B1
