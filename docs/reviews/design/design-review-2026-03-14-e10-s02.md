# Design Review Report

**Review Date**: 2026-03-14
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e10-s02-empty-state-guidance`
**Changed Files**:
- `src/app/pages/Reports.tsx` (complete rewrite of Study Analytics tab)
- `src/app/components/reports/CategoryRadar.tsx` (new)
- `src/app/components/reports/SkillsRadar.tsx` (new)
- `src/app/components/reports/WeeklyGoalRing.tsx` (new)
- `src/app/components/reports/RecentActivityTimeline.tsx` (new)
- `src/lib/reportStats.ts` (new)

**Affected Pages**: `/reports` (Study Analytics tab)
**Viewports Tested**: 1440px desktop, 768px tablet, 375px mobile
**Themes Tested**: Dark mode (primary), Light mode (verified toggle)

---

## Executive Summary

The Reports page Study Analytics tab has been substantially redesigned from a simple stats-plus-pie-chart layout into a rich five-row analytics dashboard. The architecture is sound, the component decomposition is clean, and the accessibility groundwork (ARIA labels on all charts, MotionConfig with `reducedMotion="user"`) is genuinely good work. Two issues require attention before merge: the horizontal bar chart's Y-axis label column becomes unreadably narrow on mobile, and the recharts SVG elements inside the WeeklyGoalRing and radar charts receive keyboard focus with no accessible name.

---

## What Works Well

- **Chart ARIA labels are excellent.** Each chart wrapper has a descriptive `aria-label` that summarises the data (e.g. `"Learning profile: Completion 0%, Consistency 0%, Breadth 100%, Depth 0%, Engagement 0%"`). This is non-trivial to implement correctly and was done right across all five chart components.
- **Design token discipline is clean.** No hardcoded hex colors or Tailwind palette classes appear anywhere in the app code. All chart stroke/fill values use `var(--chart-1)`, `var(--brand)`, `var(--success)`, `var(--warning)`, `var(--destructive)` — exactly correct.
- **`reducedMotion="user"` on MotionConfig** respects the OS-level `prefers-reduced-motion` setting for all Framer Motion animations on the page. This is the correct approach and requires no per-animation attention.
- **Light/dark mode is fully functional.** Background resolves to `#faf5ee` (`rgb(250, 245, 238)`) in light mode and `#1a1b26` in dark mode. Chart colors adapt correctly via CSS custom properties in both themes.
- **Empty states are clear and helpful.** Every component that can receive no data (RecentActivityTimeline, WeeklyGoalRing skeleton, StudyTimeAnalytics message) provides a specific, actionable message rather than a blank area.
- **Card border radius of `24px` is correct** and consistent across all five chart cards.
- **No horizontal scroll at any viewport** (1440px, 768px, 375px all passed).
- **Single-column stacking on mobile** is correct — all grid rows collapse cleanly.
- **Tab switching works correctly** — Study Analytics and AI Analytics tabs switch without error; the AI Analytics empty state links to Settings.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. Horizontal bar chart plot area collapses to ~47px on mobile**
- **Location**: `src/app/pages/Reports.tsx:225` — `<YAxis ... width={160} />`
- **Evidence**: At 375px viewport, the chart SVG is 255px wide total. The hardcoded `width={160}` Y-axis label column consumes 63% of the available space, leaving only ~47px for the actual bar plot area. This renders the bars invisible at zero-value state and extremely narrow at any non-zero value.
- **Impact**: A learner viewing their course completion on mobile cannot read the chart. The labels are truncated in the recharts snapshot (`"6-Minute X-Ray(6MX) BehaviorCourse"` is already broken across two lines at desktop). On mobile this becomes unreadable.
- **Suggestion**: Reduce the Y-axis width at smaller viewports, or truncate labels more aggressively for mobile. One approach: compute `yAxisWidth` dynamically as `Math.min(160, chartContainerWidth * 0.45)` so it never exceeds 45% of available width. Alternatively, use a `minWidth` class on the ChartContainer (`min-w-[480px]`) with horizontal scroll enabled on the card at mobile — trading scrollability for legibility.

---

### High Priority (Should fix before merge)

**2. Inner recharts SVGs receive keyboard focus with no accessible name**
- **Location**: `src/app/components/reports/WeeklyGoalRing.tsx:65-88`, `src/app/components/reports/CategoryRadar.tsx:25`, `src/app/components/reports/SkillsRadar.tsx:25`
- **Evidence**: The outer wrapper `div` has `role="img"` with a correct `aria-label`. However recharts injects a child `svg[role="application"][tabIndex="0"]` with an empty `<title>` element. This creates a second focusable stop with no name that screen readers will announce as an unlabelled interactive region. Verified: `innerSvgAriaLabel: null, innerSvgTitle: ""`.
- **Impact**: A keyboard/screen reader user tabbing through the page encounters silent focus traps on every chart — they land on a `role="application"` element that announces nothing and offers no indication of what to do. This fails WCAG 2.1 SC 4.1.2 (Name, Role, Value).
- **Suggestion**: Add `aria-hidden="true"` to the `ChartContainer` in each of the three components. The outer `div[role="img"]` already carries the semantic description; the inner recharts SVG does not need to be separately announced. Example in `WeeklyGoalRing.tsx:65`:
  ```tsx
  <ChartContainer config={chartConfig} className="mx-auto h-[220px] w-full" aria-hidden="true">
  ```
  Apply the same to `CategoryRadar.tsx:25` and `SkillsRadar.tsx:25`.

**3. Heading hierarchy skips H2 — all card titles are H3 directly under H1**
- **Location**: `src/app/pages/Reports.tsx` — CardTitle renders as H3 throughout; no H2 exists on the page.
- **Evidence**: Accessibility snapshot shows: `H1 "Reports"` → `H3 "Weekly Study Goal"`, `H3 "Course Completion"`, etc. The `H2` level is entirely absent.
- **Impact**: Screen reader users navigating by heading (a primary navigation strategy) encounter a structural jump from H1 to H3 with no H2 landmark to organise the sections. This fails WCAG 2.1 SC 1.3.1 (Info and Relationships) advisory criterion.
- **Suggestion**: Either add an implicit H2 by giving the TabPanel a section heading (e.g. `<h2 className="sr-only">Study Analytics</h2>`), or override the CardTitle heading level on these cards to H2 via the `as` prop if the shadcn CardTitle supports it. The simplest fix is a visually-hidden `<h2>` at the top of the `TabsContent` for "Study Analytics".

**4. Recharts `width(-1) height(-1)` warnings fire on every tab switch (11 total)**
- **Location**: All five `ChartContainer` components — triggered when recharts mounts inside a hidden tab panel
- **Evidence**: Console shows 5 warnings per tab switch cycle. After switching AI Analytics → Study Analytics, the warning count reaches 11+.
- **Impact**: Not user-visible, but pollutes the console and indicates recharts is attempting layout measurement before the container has rendered dimensions. Long-term this can cause initial render flash.
- **Suggestion**: This is a known recharts + tabs issue. The standard fix is to delay chart rendering until the tab is active, or use `minWidth`/`minHeight` on the ChartContainer so recharts always has a non-negative dimension. Adding `className="min-h-[1px]"` to each ChartContainer is often sufficient to suppress the warning.

---

### Medium Priority (Fix when possible)

**5. Tab buttons are 29px tall — below the 44px mobile touch target minimum**
- **Location**: `src/app/pages/Reports.tsx:147-150` — TabsList/TabsTrigger
- **Evidence**: Measured via `getBoundingClientRect()`: `{ text: "Study Analytics", w: 121, h: 29 }`. This applies at all viewports since the height is set by the shadcn TabsList component.
- **Impact**: On touch devices, users with imprecise touch (motor impairment, stylus) may miss the tab target. WCAG 2.5.5 (Target Size) requires 44x44px for interactive elements.
- **Suggestion**: Override the shadcn TabsList height on the `TabsList` component via `className="h-11"` (44px) and add matching padding to `TabsTrigger`.

**6. Inline `style={{ height: barChartHeight }}` on ChartContainer**
- **Location**: `src/app/pages/Reports.tsx:204`
- **Evidence**: `<ChartContainer config={barChartConfig} className="w-full" style={{ height: barChartHeight }}>` — this inline style is necessary for the dynamic height computation but violates the project's `react-best-practices/no-inline-styles` ESLint rule.
- **Impact**: Low — the inline style uses a calculated number, not a hardcoded color or spacing value. However it bypasses the ESLint rule and makes the height invisible to Tailwind tooling.
- **Suggestion**: Move the dynamic height to a CSS custom property or a Tailwind arbitrary value via a template literal: `className={\`w-full h-[${barChartHeight}px]\`}`. This keeps the dynamic behavior while using Tailwind's class system.

**7. WeeklyGoalRing inline `style={{ color }}` on the center label span**
- **Location**: `src/app/components/reports/WeeklyGoalRing.tsx:92`
- **Evidence**: `<span className="text-3xl font-bold tabular-nums" style={{ color }}>` where `color` resolves to e.g. `var(--destructive)`. This is a CSS variable reference (not hardcoded), so it does not trigger the design token ESLint rule, but it does trigger `no-inline-styles`.
- **Impact**: Very low. The dynamic color selection logic (`getProgressColor`) is correct and uses proper tokens. The pattern could be refactored to data attributes or Tailwind variants.
- **Suggestion**: Use a `data-progress` attribute and CSS, or pass a className variant: map the three progress states to `text-destructive`, `text-warning`, `text-success` Tailwind classes instead of the inline style.

---

### Nitpicks (Optional)

**8. `StudyTimeAnalytics` wrapped in `p-0` CardContent but component has its own internal padding**
- **Location**: `src/app/pages/Reports.tsx:185` — `<CardContent className="p-0">`
- **Impact**: The StudyTimeAnalytics component manages its own padding, which is fine. The `p-0` override is intentional to avoid double-padding. Document this decision with a comment so future maintainers don't remove it.

**9. Category labels in the radar charts use raw slug format**
- **Location**: `src/app/components/reports/CategoryRadar.tsx` — the `category` field from data (e.g. `"behavioral-analysis"`, `"influence-authority"`) is displayed as-is on the radar axis labels.
- **Impact**: Learners see machine-formatted slugs rather than human-readable labels. This is a data layer issue in `reportStats.ts` — `getCategoryCompletionForRadar()` returns raw category strings from the course data.
- **Suggestion**: Add a `formatCategoryLabel` utility that converts slugs to title case (`"behavioral-analysis"` → `"Behavioral Analysis"`), or transform labels in the radar component's `tick` formatter.

**10. `as never` type cast on custom Bar shape prop**
- **Location**: `src/app/pages/Reports.tsx:261` — `}) as never`
- **Impact**: Suppresses TypeScript's type checking on the custom recharts bar shape renderer. The `eslint-disable` comment above it shows this was intentional. The actual `as never` cast is unusually aggressive — `as unknown as React.ReactElement` would be more precise and self-documenting.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Light: foreground `#1c1d2b` on `#ffffff` card (~16:1). Dark: `#e8e9f0` on `#1a1b26` (~14:1). Muted foreground `#7d8190` on white is ~4.6:1. |
| Keyboard navigation | Partial | Tab order is logical. StatsCard buttons, tab switchers, and chart SVGs are all reachable. Inner chart SVGs have no accessible name (see Finding 2). |
| Focus indicators visible | Pass | shadcn components provide visible focus rings. Not independently verified via browser focus, but design system enforces this. |
| Heading hierarchy | Fail | H1 → H3 with no H2 (see Finding 3). |
| ARIA labels on icon buttons | Pass | Clock icon in Weekly Study Goal card has `aria-hidden="true"`. StatsCard icons are decorative. |
| ARIA labels on charts | Pass | All five chart components have `role="img"` with descriptive `aria-label` summaries. Excellent. |
| Semantic HTML | Pass | `main`, `nav`, `complementary`, `banner` landmarks are present. |
| prefers-reduced-motion | Pass | `<MotionConfig reducedMotion="user">` wraps all Framer Motion animations. |
| Empty states | Pass | All data-empty states show helpful, non-generic messages. |
| Form labels | N/A | No form inputs on this page. |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass — 4-column StatsCards, 1/3 + 2/3 splits on rows 2–4, full-width timeline. No horizontal scroll. Card border-radius `24px` correct. Background `#faf5ee` correct.
- **Tablet (768px)**: Pass — StatsCards collapse to 2 columns (`sm:grid-cols-2`). Rows 2–4 stack to single column (`lg:grid-cols-3` → full width). Sidebar becomes collapsible Sheet. No horizontal scroll. The `DialogContent` missing title error fires here (pre-existing sidebar issue, not from this PR).
- **Mobile (375px)**: Partial — Single-column stack is correct. No horizontal overflow. Bar chart plot area collapses to **~47px** due to hardcoded 160px Y-axis width (see Finding 1 — Blocker). All other charts render at 255px width with correct heights.

---

## Recommendations

1. **Fix the bar chart Y-axis width at mobile** (Blocker) — either make it responsive (`Math.min(160, availableWidth * 0.45)`) or enable horizontal scroll on the card for small viewports. This is the only issue that actively breaks the UI for learners.

2. **Add `aria-hidden="true"` to ChartContainers inside `role="img"` wrappers** (High) — WeeklyGoalRing, CategoryRadar, and SkillsRadar all have this pattern. It's a 3-line fix across 3 files.

3. **Add a visually-hidden H2** at the top of the Study Analytics TabsContent to restore correct heading hierarchy (High). A single `<h2 className="sr-only">Study Analytics</h2>` is sufficient.

4. **Replace `style={{ color }}` in WeeklyGoalRing** with a Tailwind class map (Medium) — this removes the last inline style from the new component code and makes the three visual states (`text-destructive`, `text-warning`, `text-success`) explicit and theme-safe.

---

*Report saved to `docs/reviews/design/design-review-2026-03-14-e10-s02.md`*
