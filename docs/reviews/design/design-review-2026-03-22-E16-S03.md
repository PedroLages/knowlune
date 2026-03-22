# Design Review: E16-S03 — Calculate and Display Score Improvement

**Review Date**: 2026-03-22
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Story**: E16-S03 — Calculate and Display Score Improvement
**Branch**: `feature/e16-s03-calculate-and-display-score-improvement`

**Changed Files Reviewed**:
- `src/app/components/quiz/ScoreSummary.tsx` — primary UI change (ScoreImprovementPanel + sr-only live region)
- `src/app/pages/QuizResults.tsx` — wires `improvementData` into ScoreSummary
- `src/lib/analytics.ts` — `calculateImprovement()` and `ImprovementData` type
- `src/app/components/quiz/PerformanceInsights.tsx` — related quiz component (incidental review)

**Affected Routes Tested**: `/courses/:courseId/lessons/:lessonId/quiz/results`

---

## Executive Summary

E16-S03 adds a `ScoreImprovementPanel` sub-component to `ScoreSummary` that surfaces four distinct states: first attempt, new personal best, regression, and (via the same best-path branch) an intermediate improvement. The implementation is clean, semantically correct, and uses design tokens throughout. All four states were verified in a live browser. No blockers were found. Two medium-priority items warrant attention before the next epic.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

**[Medium] Light-mode `text-success` on `bg-surface-sunken` is borderline contrast**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:134`, also the "+X%" span at line 154
- **Evidence**: Computed contrast ratio = 5.01:1 (success `#3a7553` on `oklch(0.97 0.005 80)` ≈ `rgb(247,245,241)`). Passes WCAG AA (4.5:1 minimum) but leaves only 0.51 of margin. Any future lightening of `--surface-sunken` or darkening of the surrounding card would push it below threshold.
- **Impact**: Learners with mild contrast sensitivity, particularly on lower-quality LCD screens in bright environments, may struggle to distinguish the success green from the panel background.
- **Suggestion**: No immediate change needed — it passes. Record a tracking note to re-verify if either `--surface-sunken` or `--success` tokens are adjusted in future theme work.

**[Medium] Inconsistent element type for `data-testid="improvement-summary"` between states**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:115` (first-attempt) vs `ScoreSummary.tsx:128` (multi-attempt)
- **Evidence**: First-attempt state returns `<p data-testid="improvement-summary">`. All subsequent states return `<div data-testid="improvement-summary">`. The same testid is on semantically different elements.
- **Impact**: Not a user-facing issue, but creates a minor semantic inconsistency — `<p>` implies a paragraph of prose while `<div>` implies a generic container. E2E tests that rely on the testid will work (they do), but the structural shift could confuse future contributors who expect the element type to be stable.
- **Suggestion**: Promote the first-attempt state to a `<div>` with a nested `<p>` for the message text, keeping element type consistent across all states. This also makes room for future first-attempt panel content (e.g., a motivational illustration) without restructuring.

### Nitpicks (Optional)

**[Nitpick] The improvement sign calculation uses a prefix string instead of a template literal**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:124-125`
- **Evidence**: `const sign = roundedImprovement >= 0 ? '+' : ''` then `{sign}{roundedImprovement}%`. Negative values already carry their own `-` sign from `Math.round()`, so the logic is correct. However, the explicit empty-string branch for negatives is slightly surprising — a reader must reason that `-10` already contains a minus.
- **Suggestion**: A comment like `// negative values carry their own minus sign` would make the intent immediately clear to future editors.

**[Nitpick] `ScoreImprovementPanel` is a file-private component with no export — consider co-location clarity**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:111`
- **Evidence**: `ScoreImprovementPanel` is declared as a module-private function component alongside `ScoreRing` and the parent `ScoreSummary`. The file is already well-organized, but as the panel grows in complexity it may benefit from its own file.
- **Suggestion**: No action needed now. If the panel gains its own tests or state, extract it. The current co-location is appropriate for its current size (~60 lines).

---

## What Works Well

1. **Token compliance is perfect.** Zero hardcoded colors across all changed files. Every color decision uses semantic tokens: `text-success`, `text-muted-foreground`, `text-foreground`, `bg-surface-sunken`, `border-border`. The ESLint enforcement is visibly working.

2. **The three-state color logic is exactly right.** Success green is strictly gated to `isNewBest === true`. Regression uses `text-muted-foreground` (not `text-destructive`). The improvement value shows as `text-muted-foreground` even when numerically positive during regression, correctly avoiding a false celebration. This is nuanced and implemented precisely.

3. **Screen reader live region is thorough.** The `aria-live="polite" aria-atomic="true"` region at `ScoreSummary.tsx:193` announces a complete, human-readable summary for all three states. The new-best announcement reads: "New personal best! Improved by 25 percentage points from first attempt of 60 percent." — this gives screen reader users full context without needing to navigate the visual panel.

4. **`motion-reduce:transition-none` is applied to the score ring arc animation** (`ScoreSummary.tsx:92`). Users who have enabled `prefers-reduced-motion` get the ring drawn statically. This is correctly scoped to the one animation in the component.

5. **Touch targets pass at all breakpoints.** Every interactive element (Retake Quiz, Review Answers, Question Breakdown, Back to Lesson) measured at or above 44px height at 375px mobile viewport. No horizontal scroll was detected at any tested width.

---

## Detailed Findings

### Finding 1: Light-mode success contrast is borderline

- **Issue**: `text-success` (`#3a7553`) on `bg-surface-sunken` (`oklch(0.97 0.005 80)`) yields 5.01:1 in light mode
- **Location**: `src/app/components/quiz/ScoreSummary.tsx:134` (trophy icon), line 154 (improvement value span)
- **Evidence**: Computed via luminance formula using theme.css token values: `contrast([58,117,83], [247,245,241]) = 5.01`
- **Impact**: Marginal WCAG AA pass. Acceptable now, fragile if tokens shift.
- **Suggestion**: No code change required. Add to design token review checklist for any future `--success` or `--surface-sunken` adjustments.

### Finding 2: `<p>` vs `<div>` for improvement-summary testid

- **Issue**: First-attempt branch uses `<p>`, all other branches use `<div>` for the same `data-testid`
- **Location**: `src/app/components/quiz/ScoreSummary.tsx:115` vs `ScoreSummary.tsx:128`
- **Evidence**: Code review — first-attempt early-return at line 113-118 returns a bare paragraph; multi-attempt path returns a div with structured children
- **Impact**: Minor semantic inconsistency; not user-visible. Does not affect test reliability as E2E tests query by testid content, not element type.
- **Suggestion**: Wrap the first-attempt message in a `<div data-testid="improvement-summary">` with a nested `<p>` for the message, consistent with the multi-attempt layout.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (dark mode) | Pass | Success: 7.56:1, Muted: 8.85:1, Foreground: 14.86:1 |
| Text contrast ≥4.5:1 (light mode) | Pass | Success: 5.01:1 (borderline), Muted: 5.12:1, Foreground: 15.31:1 |
| Keyboard navigation | Pass | Tab order: Question Breakdown → Retake Quiz → Review Answers → Back to Lesson. Logical and complete. |
| Focus indicators visible | Pass | `focus-visible` styles present on all interactive elements; verified via ARIA tree |
| Heading hierarchy | Pass | Single H1 "Improvement Test Quiz — Results" on page; no skipped levels |
| ARIA labels on icon buttons | Pass | All icon-only buttons in main content area have labels; Trophy SVG has `aria-hidden="true"` |
| Semantic HTML | Pass | Score ring SVG: `aria-hidden="true"`. Improvement panel rows use native `<span>` with text content. |
| ARIA live region for dynamic content | Pass | `aria-live="polite" aria-atomic="true" className="sr-only"` announces full score + improvement context |
| Form labels associated | N/A | No form inputs in this component |
| prefers-reduced-motion | Pass | `motion-reduce:transition-none` applied to score ring arc animation at `ScoreSummary.tsx:92` |
| No `text-destructive` in regression state | Pass | Verified via computed style check: no destructive classes present in regression panel |

---

## Responsive Design Verification

All tests used the "new personal best" state (most visually complex: trophy row + three data rows).

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | Panel: 320px wide (max-w-xs respected). Ring: 160px (size-40). No horizontal scroll. All buttons 44px tall. Mobile bottom nav active. |
| Tablet (768px) | Pass | Panel: 320px (max-w-xs). Ring: 176px (size-44, responsive upgrade). Card padding: 32px (sm:p-8 applied). No sidebar (correct — sheet-based on tablet). |
| Desktop (1440px) | Pass | Sidebar: 220px, visible and persistent. Card: max-w-2xl = 672px, centered. Panel: 320px. No horizontal scroll. |

---

## Code Health Analysis

| Check | Status | Notes |
|-------|--------|-------|
| No hardcoded Tailwind colors | Pass | Zero matches for `bg-blue-`, `text-green-`, `text-red-`, `text-gray-` in changed files |
| No hardcoded hex colors | Pass | Zero `#RRGGBB` patterns in ScoreSummary.tsx or analytics.ts |
| No inline style attributes | Pass | Zero `style={` in ScoreSummary.tsx |
| TypeScript types defined | Pass | `ScoreSummaryProps`, `ScoreTier`, `ImprovementData` all fully typed; no `any` usage |
| Import paths use `@/` alias | Pass | All imports use `@/app/`, `@/lib/`, `@/stores/` — no relative `../` paths |
| No relative import paths | Pass | Zero `../` in changed source files |
| Single Responsibility | Pass | `ScoreImprovementPanel` is a focused 60-line presentational component with clear input/output contract |
| `calculateImprovement()` edge cases | Pass | Handles: empty attempts array, single attempt, tied scores, regression. Logic is correct per code review. |

---

## Recommendations

1. **Ship as-is.** No blockers or high-priority items. The implementation is clean and correct across all four states.

2. **Track the light-mode success contrast** as a token health note. At 5.01:1 it passes but has minimal margin. Add a comment in `theme.css` near `--success` noting this constraint.

3. **Standardize the improvement panel element type** (Medium priority, trivial fix): change the first-attempt `<p>` to a `<div>` wrapper with a nested `<p>` message to make both code branches structurally consistent.

4. **Consider adding a visual separator** between the `ScoreImprovementPanel` and the score details above it (the "X of Y correct · Z% to pass" line). Currently the `mt-4` on the panel provides separation, but a thin `<hr>` or additional spacing might help learners more clearly distinguish "how I did" from "how I compare to before." This is a future enhancement, not a current issue.
