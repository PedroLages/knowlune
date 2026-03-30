# Design Review: E91-S01 — Start/Continue CTA + Last Position Resume

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (inline)
**Verdict:** PASS

## Summary

CTA button added to CourseHeader with proper `variant="brand"`, responsive sizing (`w-full sm:w-auto`), accessible icons with `aria-hidden`, and correct design token usage. No hardcoded colors.

## Findings

### MEDIUM

None.

### LOW

1. **Truncation at 16rem may clip on narrow mobile** — `max-w-[16rem]` on lesson title subtitle. Consider `max-w-full` on mobile breakpoint.

## Accessibility

- Button uses semantic `<Link>` + `<Button>` pattern
- Icons marked `aria-hidden="true"`
- `data-testid` present for automation
- Touch target meets 44x44px minimum via `size="lg"`

## Responsive Behavior

- `w-full sm:w-auto` provides full-width on mobile, auto-width on desktop
- Layout flows naturally within existing CourseHeader flex container
