# Design Review — E9B-S06: AI Feature Analytics & Auto-Analysis

**Review Date**: 2026-03-14
**Reviewer**: Design Review Agent (Playwright MCP)

## Executive Summary

The AI Analytics tab is well-structured with all four states (loading, not-configured, empty data, populated data) rendering correctly. Design token discipline is excellent — zero hardcoded colors. ARIA implementation is thorough. Three issues need attention.

## What Works Well

- Design tokens throughout — no hardcoded colors
- Responsive grid verified at all breakpoints (375px/768px/1440px)
- Touch targets: period buttons exactly 44px tall
- Thorough ARIA: aria-pressed, aria-live, role="group", aria-busy, aria-hidden
- Keyboard navigation works correctly
- Knowledge Gaps "Coming soon" badge with opacity dimming
- Light mode contrast passes WCAG AA (5.09:1)
- Zero console errors

## Findings

### HIGH

1. **"Not configured" state: no actionable path to Settings** (AIAnalyticsTab.tsx:169-180)
   - Message says "Set up an AI provider in Settings" but "Settings" is not a link
   - Fix: Add `<Link to="/settings">Settings</Link>`

2. **Dark mode: 12px muted text contrast borderline** (AIAnalyticsTab.tsx:259-267)
   - oklch(0.708 0 0) on oklch(0.145 0 0) ≈ 3.89:1 (AA requires 4.5:1 for <18px text)
   - Fix: Bump to `text-sm` (14px) or `text-foreground`

### MEDIUM

3. **Dark mode focus ring low contrast** (Period toggle buttons)
   - `focus-visible:ring-ring/50` resolves to semi-transparent mid-grey
   - Fix: Theme-level change to `--ring` in dark mode

### NITS

4. `auto_analysis` and `summary` share `Sparkles` icon — no impact now but will duplicate if surfaced later

## Accessibility Checklist

| Check | Status |
|-------|--------|
| Text contrast (light mode) | Pass (5.09:1) |
| Text contrast (dark mode, large) | Pass (~5.31:1) |
| Text contrast (dark mode, 12px) | Borderline (~3.89:1) |
| Keyboard navigation | Pass |
| Focus indicators (light) | Pass |
| Focus indicators (dark) | Caution |
| ARIA live regions | Pass |
| Semantic HTML | Pass |
| Loading state | Pass |
| Empty/error states | Pass |

## Responsive Design

- Mobile (375px): Pass — single column, no overflow
- Tablet (768px): Pass — two columns, sidebar collapses
- Desktop (1440px): Pass — five columns, persistent sidebar
