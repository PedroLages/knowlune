# Design Review: E06-S01 — Create Learning Challenges (Round 3)

**Date**: 2026-03-07
**Reviewer**: Design Review Agent (Playwright MCP)
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)
**Affected Pages**: `/challenges`

## Executive Summary

Clean, well-structured addition. Page and dialog follow design system faithfully — correct background (#FAF5EE), card radius (rounded-[24px]), token-based colors, proper form semantics, and solid accessibility. Four issues, none blockers.

## What Works Well

1. Background and card tokens correct (#FAF5EE, rounded-[24px], bg-card)
2. Full success/error flow polished — dialog, toast, reset, card appears
3. Accessibility scaffolding thorough — labels, aria-invalid, aria-describedby, role="alert"
4. Touch targets pass on mobile (buttons 44px, full-width in footer)
5. Zero console errors/warnings
6. Dynamic label update works (videos/hours/days)

## Findings

### High Priority

**H1 — Stale validation errors do not clear on field change**
- Location: `CreateChallengeDialog.tsx:60-93` and onChange handlers
- Errors persist after user corrects field. aria-invalid stays true.
- Fix: Clear field error on onChange

### Medium Priority

**M1 — Mobile header row has no flex-wrap**
- Location: `Challenges.tsx:109-115`
- At 375px, title + button fit but fragile layout
- Fix: Add `flex-wrap gap-2`

**M2 — Icon container 36x36px (size-9), below 44px guideline**
- Location: `Challenges.tsx:55`
- Decorative, not interactive — not a violation but improves scannability
- Fix: Change to `size-10` or `size-11`

**M3 — Progress bar h-2 (8px) very thin**
- Location: `Challenges.tsx:77`
- At 0% progress nearly invisible
- Fix: Change to `h-2.5` or `h-3`

### Nits

**N1 — Seed data mismatch**: "Read 20 books" with type:time shows "20 hours"
**N2 — aria-live implicit via role="alert"**: Consider always-present containers for max AT compat

## Accessibility Checklist — All pass except H1 (errors don't clear on correction)

## Responsive Verification — Pass at all 3 breakpoints
