# Design Review — E07-S07: Error Path — Corrupted IndexedDB Sessions

**Review Date**: 2026-03-19
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e07-s07-error-path-corrupted-indexeddb-sessions`
**Changed Files** (UI-relevant):
- `src/lib/momentum.ts` — Added `isValidSession` guard, upstream filtering of corrupted sessions
- `src/app/pages/Courses.tsx` — Added `rawSessions` → `sessions` filter before grouping
- `src/app/components/StudyScheduleWidget.tsx` — Added `typeof s.courseId === 'string'` guard in `buildActiveCoursesWithMomentum`
- `src/app/components/quiz/ScoreSummary.tsx` — Formatting-only (line length), no visual change
- `src/app/pages/Quiz.tsx` / `src/app/pages/QuizResults.tsx` — Formatting-only, no visual change

**Affected Routes Tested**: `/` (Overview), `/courses` (Course Catalog)
**Viewport Breakpoints Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

E07-S07 adds defensive validation to the momentum calculation pipeline, guarding against corrupted IndexedDB sessions with invalid `courseId`, `startTime`, or `duration` fields. The changes are purely logic-layer — no new UI components were introduced. Momentum badges continue to render correctly across all breakpoints, sort-by-momentum works as expected, and no visual regressions were found. The story achieves its goal with zero design impact.

---

## What Works Well

- **Momentum badges render correctly** at all three breakpoints — 3 "Warm" badges display with scores 34, 40, and 49, using resolved design tokens (`text-momentum-warm`, `bg-momentum-warm-bg`) with no hardcoded colors in the changed files.
- **Contrast passes WCAG AA** — warm badge: 6.81:1 (text requires 4.5:1 at 12px). Well above threshold.
- **Sort-by-momentum is correct** — switching to "Sort by Momentum" reorders cards to Operative Six (49) → Authority (40) → 6MX (34) with zero-score courses trailing. The defensive filter does not disrupt sort logic.
- **No horizontal scroll** at any breakpoint (375px scrollWidth: 364px vs clientWidth: 375px).
- **Responsive grid is correct** — 1 column at 375px, 3 columns at 768px, 5 columns at 1440px.
- **StudyScheduleWidget renders cleanly** in the `schedule-insufficient-data` state at all viewport sizes. The filter guard (`typeof s.courseId === 'string'`) applies before momentum score calculation without breaking the insufficient-data path.
- **Zero console errors** across both tested routes.
- **CLS is 0.00** on `/courses` — no layout shift introduced.
- **Heading hierarchy is clean** — H1 "All Courses" → H2 "Imported Courses" → H3 per course card.
- **All semantic landmarks present** — `main`, `nav`, `header`, `aside[aria-label]`.
- **No inline `style=` attributes** introduced by this story's changes.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

#### 1. MomentumBadge tooltip is not keyboard-reachable

- **Location**: `src/app/components/figma/MomentumBadge.tsx:34`
- **Evidence**: The `<span data-testid="momentum-badge">` is the Radix TooltipTrigger (via `asChild`) but has `tabIndex: -1`. It cannot receive keyboard focus. The tooltip content "Momentum score: X/100" is therefore only accessible via mouse hover.
- **Impact**: Keyboard-only learners cannot discover the numeric momentum score. However, the severity is mitigated because the `aria-label` on the span already encodes the score: `"Momentum: Warm (34)"` — a screen reader reads the full value without needing the tooltip. The tooltip is supplementary, not the sole information source.
- **Suggestion**: This is a pre-existing condition, not introduced by E07-S07. Consider adding `tabIndex={0}` to the badge span in a future polish pass so keyboard users can tab to it and trigger the tooltip. The badge is display-only (not a button), so `cursor-default` is appropriate — just add focusability.

### Nitpicks (Optional)

#### 2. `console.warn` in `calculateMomentumScore` will log to production console

- **Location**: `src/lib/momentum.ts:38-41`
- **Evidence**: The `[Momentum] Skipped N corrupted session(s)` warning fires whenever corrupted sessions are encountered. During the test session no such warnings appeared (clean data), which is the expected happy path.
- **Impact**: In production with actual corrupted data, this will log to the user's browser console. While not harmful and useful for debugging, some teams prefer silent defensive failures in production or log to a dedicated monitoring channel.
- **Suggestion**: Consider wrapping in `if (import.meta.env.DEV)` if the app has other production-silent patterns, or accept as-is since the message aids support debugging. Not a UI concern — noted for completeness.

#### 3. Upstream filter in `Courses.tsx` uses a slightly different guard than `isValidSession`

- **Location**: `src/app/pages/Courses.tsx:72`
- **Evidence**: `rawSessions.filter(s => typeof s.courseId === 'string' && s.courseId)` — this only validates `courseId`, while `isValidSession` in `momentum.ts` also validates `startTime` and `duration`. A session with a valid `courseId` but invalid `startTime` will pass the upstream filter and reach `calculateMomentumScore`, where it will then be filtered by `isValidSession`.
- **Impact**: No visible UI effect — the inner guard in `calculateMomentumScore` catches it. This is a minor layering inconsistency, not a bug.
- **Suggestion**: For defense-in-depth consistency, consider exporting `isValidSession` from `momentum.ts` and reusing it in `Courses.tsx` and `StudyScheduleWidget.tsx` as the single source of truth for session validity. This would also prevent the upstream filter from diverging silently in future.

---

## Detailed Findings

### Finding 1 — MomentumBadge tooltip not keyboard-focusable (Medium)

The `<TooltipTrigger asChild>` pattern in `MomentumBadge` passes its props to the child `<span>`, giving it `data-state="closed"` for hover tracking. However, Radix Tooltip requires the trigger to be focusable to show the tooltip on keyboard focus. The span has `tabIndex: -1` which prevents this.

The `aria-label="Momentum: Warm (34)"` on the span does make the value screen-reader-accessible — so this is not a WCAG failure for blind users. It is a gap for sighted keyboard-only users who cannot hover.

Pre-existing condition. Not introduced by E07-S07.

### Finding 2 — `console.warn` in production code (Nitpick)

`src/lib/momentum.ts:38-41` logs to the console when corrupted sessions are skipped. Since no corrupted sessions exist in the test environment, this was not observed during review. The warning text is well-structured and helpful for debugging.

### Finding 3 — Layered validation guards (Nitpick)

The filtering at `Courses.tsx:72` and `StudyScheduleWidget.tsx:40-42` are correct but validate only `courseId`. The deeper `isValidSession` guard validates all three fields. Both guards together provide complete protection; the inconsistency is structural rather than functional.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Pass | Warm badge: 6.81:1. No new text colors introduced |
| Keyboard navigation | Pass | Course cards: `role="link" tabIndex={0}` with visible focus ring |
| Focus indicators visible | Pass | `focus-visible:ring-2 focus-visible:ring-brand` on card wrappers |
| Heading hierarchy | Pass | H1 → H2 → H3, no skipped levels |
| ARIA labels on icon buttons | Pass | All app buttons in `<main>` have accessible names; unnamed buttons are third-party `/agentation` extension |
| Semantic HTML | Pass | `<main>`, `<nav>`, `<header>`, `<aside aria-label>` all present |
| Form labels associated | Pass | Search input has `aria-label="Search courses"` |
| Progress bars accessible | Pass | `aria-valuenow`, `aria-valuemax`, `aria-label`, `aria-valuetext` all populated |
| `prefers-reduced-motion` | Pass | `motion-safe:` and `motion-reduce:` Tailwind modifiers present in stylesheet |
| MomentumBadge tooltip focusable | Note | `tabIndex: -1` means tooltip not keyboard-triggered; `aria-label` on span compensates for screen readers. Pre-existing. |
| Images have alt text | Pass | All `<img>` in `<main>` have `alt` attributes |
| No `div[onClick]` misuse | Pass | Zero instances found |

---

## Responsive Design Verification

| Breakpoint | Horizontal Scroll | Grid | Badges | Status |
|------------|-------------------|------|--------|--------|
| Mobile (375px) | None (scrollWidth 364px) | 1 column (305px) | 3 rendered | Pass |
| Tablet (768px) | None | 3 columns (~217px each) | 3 rendered | Pass |
| Desktop (1440px) | None | 5 columns (~236px each) | 3 rendered | Pass |

At mobile, the sidebar correctly collapses to a bottom tab bar. At tablet (640–1023px), the sidebar collapses and a hamburger "Open navigation menu" button appears in the header. At desktop, the sidebar is persistently visible.

---

## Console Health

| Route | Errors | Warnings |
|-------|--------|---------|
| `/` (Overview) | 0 | 1 (deprecated `apple-mobile-web-app-capable` meta tag — pre-existing) |
| `/courses` | 0 | 1 (same deprecated meta tag) |

No Momentum-related warnings were observed during the review session, confirming the happy path (clean data) produces no console noise. The `[Momentum] Skipped N corrupted session(s)` warning is correctly guarded by the `validSessions.length < sessions.length` condition.

---

## Recommendations

1. **No blockers** — this story is clear to merge as-is.
2. In a future polish pass, add `tabIndex={0}` to `MomentumBadge`'s inner span so keyboard users can focus the badge and trigger the tooltip. This would fully satisfy WCAG 2.1 SC 1.4.13 (Content on Hover or Focus) for sighted keyboard users.
3. Consider exporting `isValidSession` from `momentum.ts` for reuse in `Courses.tsx` and `StudyScheduleWidget.tsx`, eliminating the partial-guard duplication. Low priority — both files are functionally correct today.
4. The deprecated `apple-mobile-web-app-capable` meta tag warning appears on every route — worth addressing in a dedicated housekeeping story to keep the console clean for future debugging.
