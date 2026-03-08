# Design Review: E07-S01 — Momentum Score Calculation & Display

**Date**: 2026-03-08
**Reviewer**: Design Review Agent (Playwright MCP)

## Summary

Tested MomentumBadge component, CourseCard integration, and Courses page sort at desktop (1440px), tablet (768px), and mobile (375px) viewports.

## Findings

### Blockers

1. **MomentumBadge color contrast in dark mode** — `MomentumBadge.tsx:13-28`
   - Hardcoded `text-orange-500`, `text-amber-500`, `text-blue-400` do not meet WCAG AA contrast on dark backgrounds
   - Fix: Use `text-orange-700 dark:text-orange-500`, `text-amber-700 dark:text-amber-500`, `text-blue-700 dark:text-blue-400`

### High Priority

2. **Keyboard tooltip access** — `MomentumBadge.tsx:39`
   - Badge `<span>` is not focusable — keyboard users cannot access the tooltip showing numeric score
   - Fix: Add `tabIndex={0}` and `focus-visible:ring-1 focus-visible:ring-current rounded-sm`

### Medium

3. **Imported courses momentum gap** — `Courses.tsx:248`
   - `ImportedCourseCard` accepts `momentumScore` prop but Courses page never passes it
   - Either wire up momentum for imported courses or add `// TODO` documenting the intentional scope boundary

### Passed

- Badge positioning on course card thumbnails correct at all viewports
- Sort select functional and accessible
- ARIA labels on badges properly formatted
- Responsive layout: badges visible and properly sized at mobile
- No horizontal scroll issues
