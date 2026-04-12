# Design Review Report — E111-S03: Sleep Timer End of Chapter

**Review Date**: 2026-04-12
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e111-s03-sleep-timer-end-of-chapter`
**Story**: E111-S03 — Sleep Timer End of Chapter (fade-out, race condition fix, chapter progress bar)
**Changed Files**:
- `src/app/components/audiobook/SleepTimer.tsx` — EOC chapter progress bar in popover, `data-testid="sleep-timer-button"`
- `src/app/components/audiobook/AudiobookRenderer.tsx` — computes and passes `chapterProgressPercent` prop

**Affected Route**: `/library/:bookId/read` (audiobook player)

---

## Executive Summary

E111-S03 adds a chapter progress bar inside the sleep timer popover, displayed only when End-of-Chapter (EOC) mode is active. The implementation is clean: design tokens are used correctly, ARIA attributes are complete, touch targets meet the 44px minimum, and the feature is hidden by default (conditional rendering). All 7 acceptance-criteria tests pass. The review found one medium issue (missing `motion-reduce` on the progress bar transition), with all critical axe violations traced to pre-existing components unrelated to this story. The feature is ready to merge.

---

## What Works Well

1. **Correct conditional rendering** — The progress bar only appears when `activeOption === 'end-of-chapter'` AND `chapterProgressPercent != null`. This prevents spurious rendering in countdown or off modes.

2. **Full ARIA implementation** — The progressbar element has `role="progressbar"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`, and `aria-label="Current chapter progress"`. Screen readers receive all required state information.

3. **Design token compliance** — Track uses `bg-muted` (`rgb(233, 231, 228)` verified in browser), fill uses `bg-brand` (`rgb(94, 106, 210)` verified). No hardcoded colors. Both tokens adapt correctly in dark mode.

4. **Touch target compliance** — Sleep timer button is exactly 44×44px (`min-h-[44px] min-w-[44px]`) at all tested viewports (375px, 768px, 1440px).

5. **Keyboard accessibility** — Popover opens via Enter, closes via Escape. `aria-label` on the button updates to `"Sleep timer: EOC"` when active, giving screen reader users contextual state.

6. **No layout regressions** — Zero horizontal scroll at mobile (375px). Popover at 208px wide stays fully within the 375px viewport (x=61, right edge=269). No overflow at any breakpoint.

7. **Proportional spacing** — Progress bar section uses `px-3 pb-1.5 pt-2`, consistent with the 8px grid. The 6px height (`h-1.5`) is appropriate for a supplementary indicator inside a compact popover.

---

## Findings by Severity

### Blockers (0)

None.

### High Priority (0)

None.

### Medium Priority (1)

**M1 — Progress bar fill transition missing `motion-reduce:transition-none`**

The fill `<div>` at `SleepTimer.tsx:119` uses `transition-[width] duration-300`. The project standard (and WCAG SC 2.3.3) requires `prefers-reduced-motion` handling for all CSS transitions. All other animated elements in the codebase add `motion-reduce:transition-none` (examples: `figma/TopicRetentionCard.tsx:71`, `ui/progress.tsx:40`). Without this, learners who have requested reduced motion will still see the animated bar width update.

- **Location**: `src/app/components/audiobook/SleepTimer.tsx:119`
- **Evidence**: Missing `motion-reduce:transition-none` on `className="h-full rounded-full bg-brand transition-[width] duration-300"`. The `ui/progress.tsx` component uses `motion-safe:transition-all motion-safe:duration-500 motion-reduce:transition-none` as the project pattern.
- **Impact**: Fails WCAG 2.1 SC 2.3.3 (Animation from Interactions, AAA) and violates the platform's `prefers-reduced-motion` convention.
- **Suggestion**: Add `motion-reduce:transition-none` to the fill div's className.

### Nitpicks (1)

**N1 — Label text is not associated with the progressbar element**

The "Chapter progress" `<span>` at `SleepTimer.tsx:109` describes the bar immediately below it, but there is no `aria-labelledby` linking them. The bar has `aria-label="Current chapter progress"` which covers screen readers, so this is redundant but slightly inconsistent: AT users hear "Current chapter progress" (from aria-label), while sighted users read "Chapter progress" (from the span). The two strings are subtly different.

- **Location**: `src/app/components/audiobook/SleepTimer.tsx:109-116`
- **Suggestion**: Either use `id="chapter-progress-label"` on the span and `aria-labelledby="chapter-progress-label"` on the progressbar (removing `aria-label`), or align the visible text to read "Current chapter progress" to match the aria-label exactly.

---

## Axe-Core WCAG 2.1 AA Scan Results

Scan run with popover open and EOC progress bar visible at 1440px desktop.

**3 violations found, 0 new in this story:**

| ID | Impact | Nodes | Source | E111-S03? |
|----|--------|-------|--------|-----------|
| `button-name` | critical | 7 | `agentation` library (third-party CSS module) | No — pre-existing |
| `label` | critical | 3 | `AudiobookSettingsPanel` toggle switches | No — pre-existing |
| `nested-interactive` | serious | 8 | `li[role="option"]` wrapping `<button>` in SleepTimer | No — pre-existing (since E87) |

**31 passes, 2 incomplete.**

The `nested-interactive` violation (`li[role="option"]` containing `<button>`) is a pre-existing pattern in SleepTimer that predates E111-S03 (confirmed via `git show 33b9371e`). It should be addressed in a dedicated accessibility story, but is not a regression from this change.

---

## Detailed Findings

### M1: Missing `motion-reduce:transition-none` on progress bar fill

- **Issue**: `transition-[width] duration-300` on the fill div animates the width property over 300ms. No `motion-reduce:transition-none` guard is present.
- **Location**: `src/app/components/audiobook/SleepTimer.tsx:119`
- **Evidence**: The class string is `"h-full rounded-full bg-brand transition-[width] duration-300"`. Compare to `src/app/components/figma/TopicRetentionCard.tsx:71` which uses `"h-full rounded-full transition-all duration-500 motion-reduce:transition-none"` as the established pattern.
- **Impact**: Learners who have enabled "Reduce Motion" in their OS settings (often for vestibular disorders, epilepsy, or motion sensitivity) will still see animated bar updates, violating their expressed preference.
- **Suggestion**: Change the className to `"h-full rounded-full bg-brand transition-[width] duration-300 motion-reduce:transition-none"`.

### N1: Label string mismatch between visible text and aria-label

- **Issue**: Visible label reads "Chapter progress" (line 109), aria-label reads "Current chapter progress" (line 116). These differ by the word "Current".
- **Location**: `src/app/components/audiobook/SleepTimer.tsx:109,116`
- **Impact**: Low — both convey the same meaning. Minor inconsistency between what sighted and AT users read.
- **Suggestion**: Align both to the same string. Prefer keeping the aria-label ("Current chapter progress") and updating the visible span to match.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Brand fill on muted track: high contrast. Label text uses `text-muted-foreground` on card background. |
| Keyboard navigation | Pass | Enter opens popover, Escape closes, options keyboard-reachable |
| Focus indicators visible | Pass | Button uses Radix/shadcn focus-visible ring |
| Heading hierarchy | Pass | No new headings introduced |
| ARIA labels on icon buttons | Pass | Sleep timer button has `aria-label`, updates dynamically when active |
| Semantic HTML | Pass | `role="progressbar"` on the div, `aria-valuenow/min/max` all present |
| Form labels associated | N/A | No new form inputs |
| prefers-reduced-motion | Fail | Progress bar fill `transition-[width]` missing `motion-reduce:transition-none` (M1) |
| Dark mode contrast | Pass | `bg-muted` and `bg-brand` are theme tokens with dark mode variants |

---

## Responsive Design Verification

**Evidence collected via Playwright browser testing:**

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll. Touch target 44×44px. Popover x=61, width=208, no overflow. |
| Tablet (768px) | Pass | No horizontal scroll. Progress bar renders correctly when EOC active. |
| Desktop (1440px) | Pass | Popover renders at 208px wide. Progress bar visible. EOC badge correct. |

---

## Code Quality Notes

- No hardcoded colors found in SleepTimer.tsx
- No hardcoded pixel spacing found
- Design tokens: `bg-muted`, `bg-brand`, `text-muted-foreground`, `text-brand-foreground` all used correctly
- Inline `style` for `width` prop is the correct approach for dynamic percentage values (Tailwind cannot compute arbitrary runtime values)
- `Math.min(100, Math.max(0, ...))` clamping applied at both the fill div and the `aria-valuenow` value — robust against edge cases

---

## Recommendations

1. **Fix M1 before merge** (5 min): Add `motion-reduce:transition-none` to the progress bar fill div at `SleepTimer.tsx:119`.

2. **Track N1 as tech debt** (low priority): Align visible label and aria-label strings. Can be done in the next accessibility pass.

3. **Pre-existing accessibility debt** (future story): The `nested-interactive` pattern in the sleep timer listbox (`li[role="option"]` wrapping `<button>`) should be migrated to `role="menu"` / `role="menuitem"` in a dedicated accessibility refactor. This affects SpeedControl.tsx as well (flagged in E111-S02 review).

