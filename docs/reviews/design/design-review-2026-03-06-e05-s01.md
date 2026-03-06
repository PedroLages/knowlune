# Design Review: E05-S01 — Daily Study Streak Counter

**Date**: 2026-03-06
**Reviewer**: Design Review Agent (Playwright MCP)
**Routes tested**: `/` (Overview)
**Viewports**: 375px (mobile), 768px (tablet), 1440px (desktop)

## Summary

The StudyStreakCalendar component is well-built with strong accessibility fundamentals, correct design token usage, and solid responsive behavior across all three breakpoints.

## Findings

### High Priority

- **H1 — `motion-safe:` gap on calendar hover animations** (`StudyStreakCalendar.tsx:136`): Calendar cell `hover:scale-110 hover:shadow-md` is not guarded by `motion-safe:` prefix. The global CSS rule in `index.css` sets `transition-duration: 0.01ms !important` which effectively suppresses it, but explicitly using `motion-safe:hover:scale-110` would make the intent self-documenting at the component level.

### Medium Priority

- **M3 — Missing `aria-live` on streak count** (`StudyStreakCalendar.tsx`): When the streak counter updates live (AC2), there's no `aria-live` region to announce the change to screen readers.

### Nits

- Components correctly use theme tokens from `theme.css`
- Spacing follows 8px grid
- Card radius uses `rounded-[24px]` as expected
- Responsive behavior correct at all breakpoints
- Keyboard navigation works for calendar cells

## Verdict

**PASS with 2 warnings** — No blockers. H1 and M3 should be addressed but don't block shipping.

## Files Referenced

| File | Role |
|------|------|
| `src/app/components/StudyStreakCalendar.tsx` | Primary new component |
| `src/app/components/StudyStreak.tsx` | Orphan widget — not imported anywhere |
| `src/app/pages/Overview.tsx` | Integrates StudyStreakCalendar |
| `src/app/components/ContinueLearning.tsx` | Correctly uses `motion-safe:` — no issues |
