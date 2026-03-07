# Design Review Report — E05-S06 Streak Milestone Celebrations

**Review Date**: 2026-03-07
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e05-s06-streak-milestone-celebrations`
**Changed Files**:
- `src/app/components/MilestoneGallery.tsx`
- `src/app/components/StudyStreakCalendar.tsx`
- `src/app/components/celebrations/StreakMilestoneToast.tsx`
- `src/lib/streakMilestones.ts`
**Affected Pages**: `/` (Overview Dashboard — Study Streak widget)

---

## Executive Summary

This story adds streak milestone celebrations to the LevelUp platform: a Sonner-based custom toast notification with tier-specific confetti when a learner hits 7, 30, 60, or 100 consecutive study days, plus a Milestone Gallery popover showing earned and locked badges. The implementation is well-structured, largely accessible, and visually consistent with the design system. Three issues require attention before merge: the removal of `tabIndex={0}` from heatmap cells breaks keyboard access to per-day activity details; the custom toast's `role="status"` div nested inside Sonner's own `aria-live="polite"` container creates a double-announcement for screen readers; and locked gallery badges lack a textual "Locked" indicator that screen readers can surface in context.

---

## What Works Well

1. **Earned vs. locked badge states are immediately legible.** Full-opacity gradient backgrounds for earned badges (opacity `1`) versus `opacity-50` with dashed borders for locked badges produces clear visual hierarchy that communicates progress without requiring color alone.

2. **Popover heading connection is correctly wired.** The `aria-labelledby="milestone-gallery-heading"` on `PopoverContent` paired with `id="milestone-gallery-heading"` on the `h4` element follows best practice — the dialog role in the accessibility tree is properly named.

3. **`prefers-reduced-motion` is respected at the right level.** The confetti effect checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` directly before firing, which is the correct imperative guard. The heatmap cells use `motion-safe:` Tailwind modifiers for hover transitions, keeping both paths consistent.

4. **Session storage dedup guard is robust.** The `milestones-checked-{streak}` sessionStorage key prevents toast re-firing on React StrictMode double-mount or hot-module reloads, and the surrounding `try/catch` with `console.warn` ensures detection failures never surface as uncaught errors.

5. **Tier configuration has been correctly extracted.** Moving `TIER_CONFIG` and `getTierConfig` from `StreakMilestoneToast.tsx` to `streakMilestones.ts` — the authoritative domain module — and re-exporting from the component for backwards compatibility is a clean refactor that eliminates cross-module coupling.

6. **All touch targets meet the 44px minimum.** Measured at 375px mobile: Milestones button 107×44px, Freeze Days 135×44px, Resume Streak 131×44px. All pass.

7. **Zero console errors across all three viewports.** The single warning present (`recharts` width) is pre-existing and unrelated to this story.

8. **No horizontal overflow at any breakpoint.** 375px: scrollWidth 364 < clientWidth 375. 768px: scrollWidth 757 < clientWidth 768. 1440px: scrollWidth 1429 < clientWidth 1440.

9. **Background color is correct.** Computed body background is `rgb(250, 245, 238)` = `#FAF5EE` across all viewports.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Heatmap cells are keyboard-inaccessible after `tabIndex={0}` removal**

The diff removes `tabIndex={0}` from the 188 activity-cell `<div role="img">` elements inside the heatmap. After this change, those cells have `tabIndex: null` — they do not receive keyboard focus and their associated Radix tooltips (which carry the per-day lesson count detail) are therefore completely inaccessible to keyboard-only users. The `role="img"` with `aria-label` is present, but without focus the information conveyed by the aria-label is available only to a screen reader navigating in browse/virtual cursor mode, not to a sighted keyboard user who relies on focus to trigger the tooltip.

- **Location**: `src/app/components/StudyStreakCalendar.tsx` line 360 (the `<div role="img" ...>` inside `TooltipTrigger asChild`)
- **Evidence**: `document.querySelector('[role="img"]').getAttribute('tabindex')` returns `null`; Playwright accessibility snapshot confirms no focusable elements inside `role="group"` calendar
- **Impact**: Any learner navigating by keyboard cannot inspect their daily study history — a core dashboard feature. WCAG 2.1 SC 2.1.1 (Keyboard) failure.
- **Suggestion**: Restore `tabIndex={0}` on the cell `<div>`. The element has both `role="img"` and `aria-label` which makes it a meaningful non-interactive content element, but the tooltip trigger wrapping it requires focus to activate. Alternatively, if the tooltip itself is considered decoration, ensure the calendar data is fully conveyed through the `aria-label` alone and the tooltip can be skipped — but `tabIndex` must remain for the tooltip to be keyboard-triggerable.

---

### High Priority (Should fix before merge)

**H1 — `role="status"` inside Sonner's `aria-live="polite"` container causes double announcement**

The `StreakMilestoneToast` root element has `role="status"` (which is an implicit `aria-live="polite"` landmark). Sonner itself renders its toast list container with `aria-live="polite"` and `aria-atomic="false"`. When the toast mounts, screen readers will receive two separate announcements of its content: one from Sonner's container detecting DOM insertion, and a second from the nested `role="status"` region activating. This creates a jarring and confusing screen reader experience — particularly disruptive during a positive milestone moment.

- **Location**: `src/app/components/celebrations/StreakMilestoneToast.tsx` line 34
- **Evidence**: `node_modules/sonner/dist/index.js:1075` sets `aria-live: "polite"` on the Sonner toaster container. The custom component then adds a second live region at line 34.
- **Impact**: Screen reader users hear the milestone text announced twice in quick succession, which disrupts the celebratory experience and may confuse users into thinking two events occurred.
- **Suggestion**: Remove `role="status"` from the toast's root `<div>`. The `aria-label` prop can remain for labelling purposes, but `role="status"` should be dropped since Sonner already handles announcement. The `aria-label` on the outer div does not trigger announcements by itself.

**H2 — Locked gallery badges missing accessible "Locked" text for screen reader context**

Locked milestone `<li>` elements contain only `<Lock aria-hidden="true">` and `<p>{value}-Day Streak</p>`. A screen reader user navigating the gallery list hears "7-Day Streak", "30-Day Streak", etc. for both earned and locked items — with no way to distinguish status. The visual distinction (dashed border, 50% opacity, lock icon) is entirely suppressed from the accessibility tree.

- **Location**: `src/app/components/MilestoneGallery.tsx` lines 34–46
- **Evidence**: Accessibility snapshot shows `listitem` containing only `img` (ref only) and `paragraph: "30-Day Streak"` for locked items — no lock state text. The `Lock` icon has `aria-hidden="true"` with no fallback text.
- **Impact**: Screen reader users cannot distinguish which milestones are earned versus locked, removing the motivational "X days to go" awareness that drives streak behavior.
- **Suggestion**: Add a visually hidden but screen-reader-accessible indicator. For example:
  ```tsx
  <li aria-label={`${value}-Day Streak — Locked`} ...>
  ```
  or use a `<span className="sr-only">Locked</span>` inside the `<li>`. Earned items could similarly carry `aria-label={`${value}-Day Streak — Earned`}` for symmetry.

---

### Medium Priority (Fix when possible)

**M1 — Toast `min-w-[280px]` is hardcoded, not using a design token**

The toast minimum width of `min-w-[280px]` is an arbitrary value that bypasses the design system's spacing scale. At 375px mobile, this works (280px fits within 375px), but it uses a raw pixel value rather than a Tailwind spacing multiple.

- **Location**: `src/app/components/celebrations/StreakMilestoneToast.tsx` line 38
- **Evidence**: Class string `'flex items-center gap-3 rounded-xl border bg-gradient-to-r p-4 shadow-lg min-w-[280px]'`
- **Impact**: Minor — purely a code consistency concern. The toast renders correctly at all viewports tested.
- **Suggestion**: Consider `min-w-72` (288px, closest grid multiple) or `min-w-64` (256px) depending on the minimum content width needed, keeping within the 8px grid.

**M2 — The `useEffect` dep array fix introduces a subtle re-check risk**

The previous implementation used `// eslint-disable-next-line react-hooks/exhaustive-deps` to suppress the warning on an empty dep array `[]`. The fix replaces this with `[celebrateMilestones]` as a dependency. Since `celebrateMilestones` is created with `useCallback([], [])`, the reference is stable across renders and the behavior is identical. However, if `celebrateMilestones` ever adds dependencies in the future, the `useEffect` will re-run, which could fire toasts repeatedly if the sessionStorage guard key doesn't account for a changed streak value.

- **Location**: `src/app/components/StudyStreakCalendar.tsx` lines 138–140
- **Evidence**: The sessionStorage key is `milestones-checked-${currentStreak}`, scoped to streak value. If the streak increments within a session, a new key is generated and the check re-runs — which is the intended behavior. This is actually correct but worth documenting.
- **Impact**: None currently. The fix is correct and the ESLint suppression removal is a genuine improvement.
- **Suggestion**: Add a brief comment above the `useEffect` explaining that `celebrateMilestones` is stable by `useCallback` design, to prevent future developers from inadvertently adding deps to the callback.

**M3 — The `30-Day Streak` tier color is visually weak as a "silver" achievement**

The 30-day tier uses `text-slate-700` on a `from-slate-100 to-blue-50` gradient background. Computed color is `oklch(0.553 0.195 38.402)` for earned text (orange-700, correct for 7-day). For the 30-day earned badge, `text-slate-700` on a very light slate/blue gradient may feel like a "lesser" or "disabled" tier rather than a meaningful achievement step between the warm orange (7 days) and golden yellow (60 days).

- **Location**: `src/lib/streakMilestones.ts` lines 33–41
- **Evidence**: The tier label colors are orange (7d), slate/grey (30d), gold/yellow (60d), purple (100d). The slate tier at 30 days breaks the escalating warmth/prestige feel.
- **Impact**: Low functional impact, but may reduce the celebratory resonance for learners reaching a 30-day streak.
- **Suggestion**: Consider a blue theme (`from-blue-100 to-sky-50`, `text-blue-700`) to maintain a distinct escalation: fire → water/calm → gold → royalty. This also avoids conflating slate-grey with incomplete/locked badge aesthetics.

---

### Nitpicks (Optional)

**N1 — `TIER_CONFIG` re-export from `StreakMilestoneToast.tsx` creates an unusual pattern**

```typescript
// Re-export for backwards compatibility
export { getTierConfig, TIER_CONFIG }
```

Since both `MilestoneGallery` and `StudyStreakCalendar` have been updated to import directly from `@/lib/streakMilestones`, there are no remaining consumers of the component-level re-exports. Unless external test files reference the component export path, this re-export can be removed.

- **Location**: `src/app/components/celebrations/StreakMilestoneToast.tsx` lines 7–8
- **Suggestion**: Run `grep -r "from.*StreakMilestoneToast" src/` to confirm no consumers remain, then remove the re-export. Clean module boundaries reduce future confusion about where the source of truth lives.

**N2 — Milestone gallery `<ul>` has no accessible list label**

The `<ul className="grid grid-cols-2 gap-3">` in `MilestoneGallery.tsx` has no `aria-label` or `aria-labelledby`. The popover heading "Streak Milestones" labels the popover dialog but not the list itself. A screen reader user in list navigation mode may encounter an unlabelled list.

- **Location**: `src/app/components/MilestoneGallery.tsx` line 27
- **Suggestion**: `<ul aria-label="Milestone badges" ...>` provides a minimal, useful label without being redundant.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 — earned badge label | Pass | `oklch(0.553 0.195 38.402)` (orange-700) on orange-100/amber-100 gradient — passes for bold 12px |
| Text contrast ≥4.5:1 — date text | Pass | `rgb(91, 106, 125)` (muted-foreground) on white/light bg — passes WCAG AA |
| Text contrast ≥4.5:1 — locked badge text | Needs review | `rgb(91, 106, 125)` at `opacity: 0.5` applied to the whole `<li>` — the effective contrast of the text is halved by opacity. Actual rendered contrast may fall below 4.5:1. The opacity approach should be verified or replaced with a lower-contrast explicit color that still meets AA without needing opacity. |
| Keyboard navigation — milestone button | Pass | Focusable, Escape closes popover and returns focus to trigger |
| Keyboard navigation — heatmap cells | Fail | `tabIndex={0}` removed — cells not keyboard-focusable (B1) |
| Focus indicators visible | Pass | Milestone button uses `box-shadow: oklab(0.708 0 0 / 0.5) 0px 0px 0px 3px` — visible 3px ring |
| Heading hierarchy | Pass | H2 "Study Streak" → H3 "Activity"; popover H4 "Streak Milestones" |
| ARIA labels on icon buttons | Pass | All icon-only elements use `aria-hidden="true"`; buttons have text labels |
| Semantic HTML — gallery list | Pass | Changed from `<div>` to `<ul>/<li>` — correct upgrade |
| Screen reader announcement — toast | Fail | Double announcement from nested `role="status"` inside Sonner's `aria-live` (H1) |
| Locked badge screen reader context | Fail | No "Locked" text available to screen readers (H2) |
| `prefers-reduced-motion` — confetti | Pass | `window.matchMedia('(prefers-reduced-motion: reduce)').matches` checked before firing |
| `prefers-reduced-motion` — heatmap hover | Pass | `motion-safe:` Tailwind modifiers used throughout |
| Form labels associated | Pass | No form inputs in this feature |
| `aria-labelledby` on popover | Pass | `aria-labelledby="milestone-gallery-heading"` wired to `<h4 id="milestone-gallery-heading">` |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal overflow (scrollWidth 364 < 375). All buttons 44px tall. Streak stats remain 2-column (144.5px each). Bottom nav present. |
| Tablet (768px) | Pass | No horizontal overflow (scrollWidth 757 < 768). Calendar heatmap fits without internal overflow. Hamburger nav active. |
| Desktop (1440px) | Pass | No horizontal overflow (scrollWidth 1429 < 1440). Persistent sidebar. All streak controls correctly laid out. Milestone popover renders in-viewport. |

**One additional note on toast at mobile**: the toast has `min-w-[280px]`. At 375px viewport, Sonner positions toasts at the bottom with some horizontal padding. The 280px minimum fits within the 375px viewport. This was verified by checking no overflow occurred after page load.

---

## Code Quality Summary

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript interfaces defined | Pass | `TierConfig`, `StreakMilestoneToastProps`, `StudyStreakCalendarProps` all typed |
| No `any` type usage | Pass | No `any` found in changed files |
| `@/` import alias used | Pass | All imports in changed files use `@/` — no relative `../` paths |
| No inline `style=` attributes | Pass | No style props found in changed components |
| No hardcoded hex colors in UI | Pass | Hex colors exist only in `streakMilestones.ts` as confetti particle data, not Tailwind class values |
| `cn()` utility used consistently | Pass | All conditional class joins now use `cn()` — template literal concatenation removed |
| `useCallback` and `useEffect` deps correct | Pass | ESLint suppression comment removed; `celebrateMilestones` correctly listed as dep |
| Error boundary around milestone detection | Pass | `try/catch` with `console.warn` in `celebrateMilestones` |
| Re-export for backwards compatibility noted | Nitpick | `export { getTierConfig, TIER_CONFIG }` from toast file may now be unused (N1) |

---

## Recommendations

1. **Fix B1 first** — restore `tabIndex={0}` to the heatmap cell `<div role="img">`. This is a one-line change with no design impact but prevents a WCAG 2.1.1 failure.

2. **Fix H1 and H2 together** — remove `role="status"` from the toast root and add locked-badge accessibility text. These are small, isolated changes in two files that together bring the feature to full WCAG AA compliance.

3. **Verify opacity contrast for locked badges** — the `opacity-50` approach applied to the full `<li>` reduces text contrast below what the computed muted-foreground color would suggest. Measure the actual rendered contrast against the background or replace opacity with explicit lower-value text tokens (`text-muted-foreground/40` targeting the text only, not the container).

4. **Remove the re-export once consumers are confirmed absent** — a quick grep confirms whether any test files still import `getTierConfig` from the component path, then the backwards-compat re-export can be cleaned up for clearer module boundaries.

---

*Report generated by automated design review agent (Claude Code) on 2026-03-07.*
*All measurements taken via live Playwright browser sessions at 375px, 768px, and 1440px viewports.*
