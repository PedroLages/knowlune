# Design Review: E05-S03 — Study Goals & Weekly Adherence (Re-run)

**Review Date**: 2026-03-07
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)

## Changed Files
- `src/app/components/StudyGoalsWidget.tsx` (new)
- `src/app/components/StudyGoalConfigDialog.tsx` (new)
- `src/app/pages/Overview.tsx` (modified)

**Affected Pages**: `/` (Overview Dashboard)

## Executive Summary

Re-run after blocker fixes. Previous blockers (edit button 16px touch target, ProgressRing SVG missing aria-hidden) are resolved. The edit button now has proper 44px touch target with focus-visible styles, text-success replaces hardcoded text-green-600, and ProgressRing respects prefers-reduced-motion. Two new high-priority findings: CTA button and dialog footer buttons below 44px minimum.

## Findings

### High Priority

1. **CTA button `size="sm"` renders at 32px** (`StudyGoalsWidget.tsx:80`)
   - Fix: Change to `size="default" className="min-h-[44px]"`.

2. **Dialog footer buttons (Back/Save) render at 36px** (`StudyGoalConfigDialog.tsx:167,178`)
   - Fix: Add `className="min-h-[44px]"` to both.

### Medium

3. **Custom target `<input>` at 38px** (`StudyGoalConfigDialog.tsx:150`)
   - Fix: Add `min-h-[44px]` or increase to `py-3`.

4. **No `aria-live="polite"` on widget wrapper** (`StudyGoalsWidget.tsx:52`)
   - Screen readers miss empty → active transition after saving.

### Nits

5. **OptionCard buttons lack `aria-pressed={selected}`** (`StudyGoalConfigDialog.tsx:204`)
   - Visual selection state not communicated to assistive technologies.

## Previous Blockers — Verified Fixed

- Edit button touch target: Now 44x44px with focus-visible styles ✓
- ProgressRing SVG: `aria-hidden="true"` present ✓
- Hardcoded `text-green-600`: Now uses `text-success` ✓
- `prefers-reduced-motion`: ProgressRing respects it ✓

## Accessibility Checklist

| Check | Status |
|-------|--------|
| Text contrast ≥4.5:1 | Pass |
| Keyboard navigation | Pass |
| ARIA labels on icon buttons | Pass |
| Touch targets ≥44x44px | Partial (CTA button, dialog footer buttons) |
| ProgressRing SVG hidden from AT | Pass |
| prefers-reduced-motion | Pass |

## Responsive Verification

- **Mobile (375px)**: Layout pass, touch target findings apply
- **Tablet (768px)**: Layout pass
- **Desktop (1440px)**: Full pass
