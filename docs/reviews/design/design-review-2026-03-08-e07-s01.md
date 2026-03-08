# Design Review: E07-S01 — Momentum Score Calculation & Display

**Date**: 2026-03-08
**Reviewer**: Design Review Agent (Playwright MCP)
**Routes tested**: /courses

## Findings

### Blocker

- **Remove `tabIndex={0}` from MomentumBadge** (`src/app/components/figma/MomentumBadge.tsx:40`): The badge is a static annotation, not an interactive element. Adding it to the tab order creates a confusing keyboard experience where users tab through dozens of non-interactive badges. Remove `tabIndex` — tooltip on hover only.

### High Priority

- **Suppress zero-score badges on unstarted courses** (`src/app/components/figma/CourseCard.tsx:506-510`): Cold badges with score 0 display on courses the user has never started. This creates visual noise and is misleading. Add `momentumScore.score > 0` guard.

### Medium

- **Add background tint and padding to badge** (`src/app/components/figma/MomentumBadge.tsx` `tierConfig`): Badges are text-only with no background container, making them hard to distinguish from surrounding content. Add subtle background tint (`bg-orange-50`, `bg-amber-50`, `bg-blue-50`) with `px-1.5 py-0.5 rounded-sm`.

## Summary

- Blockers: 1
- High Priority: 1
- Medium: 1
- Nits: 0
