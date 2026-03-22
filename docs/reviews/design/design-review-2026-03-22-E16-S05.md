# Design Review — E16-S05: Score Improvement Trajectory Chart

**Review Date**: 2026-03-22
**Reviewed By**: Claude (design-review agent via Playwright MCP)
**Story**: E16-S05 — Display Score Improvement Trajectory Chart
**Branch**: `feature/e16-s05-display-score-improvement-trajectory-chart`

**Changed Files**:
- `src/app/components/quiz/ScoreTrajectoryChart.tsx` (new)
- `src/app/pages/QuizResults.tsx` (modified — chart integration)

**Affected Routes Tested**:
- `/courses/:courseId/lessons/:lessonId/quiz/results` (QuizResults page)

---

## Executive Summary

E16-S05 adds a `ScoreTrajectoryChart` line chart to the QuizResults page, showing quiz score improvement across multiple attempts with a dashed passing-score reference line. The implementation is solid: chart rendering works correctly, design tokens are used appropriately for line and dot colors, responsive height adaptation is implemented, and keyboard tab order is logical. The primary issues are dark-mode contrast failures on hardcoded SVG axis colors inherited from recharts defaults, a heading level jump (H1 → H4), and a missing `aria-label` on the recharts SVG element that receives keyboard focus.

---

## What Works Well

- **Design token usage is strong**: The line stroke (`var(--color-brand)`), dot fills (`var(--color-brand)`, `var(--color-success)`), and reference line stroke and label fill all use CSS custom properties that adapt to dark mode correctly.
- **Responsive height adaptation works**: Chart correctly renders at 300px on desktop/tablet and 200px on mobile (< 640px), verified live at all three breakpoints. No horizontal overflow at any viewport.
- **Semantic section with aria-label**: `<section aria-label="Score trajectory chart">` correctly marks the chart region for screen readers.
- **Animation disabled by default**: `isAnimationActive={false}` on the Line means reduced-motion users are already protected without requiring a media query check.
- **Tooltip is functional**: Hover interaction confirmed working — shows "Attempt N / Score%" format with correct labelling.
- **All touch targets in the QuizResults page meet 44px minimum**: Retake Quiz, Review Answers, and Back to Lesson all have `min-h-[44px]` applied.
- **Spacing follows the 8px grid**: `mt-6` (24px) section margin and `mb-3` (12px) heading margin are both correct.
- **Body background correct**: `rgb(250, 245, 238)` confirmed — matches `#FAF5EE` design token.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. WCAG AA contrast failure — axis tick labels in dark mode**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx` — recharts `XAxis`/`YAxis` default tick fill
- **Evidence**: Computed SVG `<text fill="#666">` on dark card `rgb(36, 37, 54)` = **2.63:1** contrast ratio. Minimum required is 4.5:1 for normal-sized text.
- **Impact**: Learners using dark mode cannot reliably read the axis tick labels ("1", "2", "0", "25", "50", "75", "100"). This affects progress comprehension for the very users most likely to prefer dark mode for extended study sessions.
- **Suggestion**: Pass explicit `tick={{ fill: 'var(--color-muted-foreground)' }}` to both `XAxis` and `YAxis`. Also pass `label={{ ..., fill: 'var(--color-muted-foreground)' }}` for the "Attempt" and "Score %" axis labels (currently `fill="#808080"` = **3.82:1** on dark card, also fails). The `--color-muted-foreground` token is already used for the H4 heading and passes at 7.42:1 in dark mode.

**2. WCAG AA contrast failure — axis label text (`#808080`) in light mode**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx` — XAxis/YAxis `label` prop defaults
- **Evidence**: Computed SVG `<text fill="#808080">` ("Attempt", "Score %") on white card = **3.95:1** contrast ratio. Falls short of the 4.5:1 AA threshold for normal-weight text at 12-14px.
- **Impact**: The axis labels that explain what the chart axes represent are borderline illegible for users with moderate low vision. These labels are not decorative — they are essential for interpreting the data.
- **Suggestion**: Same fix as above — explicitly pass `fill: 'var(--color-muted-foreground)'` via the `label` prop object on both axes.

---

### High Priority (Should fix before merge)

**3. Heading level jumps from H1 to H4 — skips H2 and H3**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx:46`
- **Evidence**: Live accessibility tree shows `H1 "Math Basics — Results"` → `H4 "Score Trajectory"`. No H2 or H3 exists in the document.
- **Impact**: Screen readers navigate by heading level. A jump from H1 to H4 breaks the logical outline that allows users relying on assistive technology to scan the page structure efficiently. WCAG 1.3.1 (Info and Relationships) is affected.
- **Suggestion**: Change `<h4>` to `<h2>` in `ScoreTrajectoryChart.tsx`. Since the chart is a direct subsection of the results page (not nested within another subsection), H2 is the correct level. Adjust visual styling with `text-sm font-semibold text-muted-foreground` (same as current) to preserve appearance.

**4. Missing `aria-label` on the focusable SVG/recharts application element**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx` — `<ChartContainer>` renders an SVG with `role="application"`
- **Evidence**: Tab order audit confirms the SVG receives keyboard focus as `[role="application"]` with `aria-label: null`. Screen readers will announce "application" with no context.
- **Impact**: Keyboard and screen reader users navigating to the chart receive no announcement of what the interactive element is or how to use it. The wrapping `<section aria-label="Score trajectory chart">` helps but the focusable element itself needs its own label.
- **Suggestion**: Add `aria-label` to `<ChartContainer>`: `<ChartContainer ... aria-label="Score trajectory line chart showing quiz attempts">`. Check whether `ChartContainer` accepts and forwards `aria-label` to its root SVG element — if not, wrap the SVG in a `<div role="img" aria-label="...">` or use the chart's built-in accessibility props.

**5. Hardcoded `#fff` dot stroke does not adapt to dark mode**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx:32`
- **Evidence**: `<circle ... stroke="#fff" strokeWidth={2} />` in `makeCustomDot`. In dark mode the card is `rgb(36, 37, 54)` — white works visually here, but this is not a theme-aware value. In a future card background change it could create invisible dots.
- **Impact**: Minor visual inconsistency today, fragile against theme changes in future.
- **Suggestion**: Replace `stroke="#fff"` with `stroke="var(--color-card)"`. The card token resolves to white in light mode and the dark card colour in dark mode, giving a perfectly adaptive halo effect.

---

### Medium Priority (Fix when possible)

**6. Recharts console warning on initial render**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx:47` — `ChartContainer`
- **Evidence**: Console warning at every page load: `"The width(-1) and height(-1) of chart should be greater than 0"`. This fires because recharts briefly measures the container before layout is complete.
- **Impact**: No user-visible problem today, but the warning indicates a brief render cycle where the chart has invalid dimensions. It also pollutes the console, making genuine errors harder to notice during development.
- **Suggestion**: This is a known recharts/ResizeObserver timing issue. Adding `minWidth: 0` to the chart container (via a `className` rather than `style` if possible) or wrapping with a deferred render (waiting for a non-zero width from a `ResizeObserver`) resolves it. The `ChartContainer` component from shadcn/ui may already handle this — verify whether passing `style={{ minWidth: 0 }}` to the container suppresses the warning without breaking the layout.

**7. `isAnimationActive={false}` suppresses animation entirely — `prefers-reduced-motion` is not honoured, it is circumvented**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx:90`
- **Evidence**: `isAnimationActive={false}` disables animation for all users, not just those who have requested reduced motion.
- **Impact**: The draw animation on a score trajectory chart can be genuinely helpful — it visually narrates the learner's journey from first to most recent attempt. Users who have not opted into reduced motion are missing a potentially meaningful, motivation-relevant micro-interaction.
- **Suggestion**: Replace with a `prefers-reduced-motion` media query: `const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches` (or a `useReducedMotion` hook) and pass `isAnimationActive={!prefersReducedMotion}`. This respects the user's system preference while restoring the animation for the majority who have not opted out.

---

### Nitpicks (Optional)

**8. Section `text-left` override is a workaround for parent `text-center`**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx:45`
- **Evidence**: `<section ... className="mt-6 text-left">` overrides the parent card's `text-center`. This works but couples the component to its parent's styling context.
- **Suggestion**: Consider whether the chart section heading should be left-aligned by default (removing the parent's `text-center` influence) or whether the component should document this coupling with a comment. Not a functional issue.

**9. `activeDot={{ r: 7 }}` uses no token for the active dot fill**

- **Location**: `src/app/components/quiz/ScoreTrajectoryChart.tsx:89`
- **Evidence**: `activeDot={{ r: 7 }}` — recharts will fill this with its default color (inherited from `stroke`). The active dot should ideally match the custom dot colour logic.
- **Suggestion**: Consider `activeDot={{ r: 7, fill: 'var(--color-brand)', stroke: 'var(--color-card)', strokeWidth: 2 }}` for visual consistency with the custom dots.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Partial Fail | `#808080` axis labels = 3.95:1 on white — fails for "Attempt" and "Score %" labels |
| Text contrast ≥4.5:1 (dark mode) | Fail | `#666` ticks = 2.63:1, `#808080` labels = 3.82:1 on dark card |
| Heading hierarchy | Fail | H1 → H4 jump; H2 and H3 skipped |
| ARIA landmarks | Pass | `main`, `nav`, `banner`, `complementary` all present |
| Chart section aria-label | Pass | `<section aria-label="Score trajectory chart">` |
| Focusable chart element aria-label | Fail | `role="application"` SVG receives focus with no `aria-label` |
| Keyboard navigation reachable | Pass | Chart SVG is in tab order after sidebar/header |
| Focus indicators visible | Pass | 2px solid `rgb(94, 106, 210)` outline confirmed |
| Touch targets ≥44px | Pass | All interactive elements in QuizResults meet minimum |
| Semantic HTML | Pass | `<section>` for chart region, proper button/link elements |
| Form labels associated | N/A | No form inputs in this component |
| prefers-reduced-motion | Partial | Animation fully disabled (safe, but animation is never shown to any user) |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass — chart renders at 300px height, 608px width, no overflow. Tooltip works on hover.
- **Tablet (768px)**: Pass — chart stays at 300px height (correct: `useIsMobile` uses 639px breakpoint, not 768px). No horizontal scroll.
- **Mobile (375px)**: Pass — chart correctly reduces to 200px height, section width 284px. No horizontal scroll.

**Breakpoint note**: The `useIsMobile` hook uses `max-width: 639px` (Tailwind `sm`), meaning the mobile height (200px) kicks in between 0–639px, and the desktop height (300px) applies from 640px upward. This is consistent with Tailwind conventions and documented behaviour.

---

## Detailed Code Quality Analysis

**Design token usage** — Score: Good with one gap

| Attribute | Value | Token-aware? |
|-----------|-------|-------------|
| Line stroke | `var(--color-brand)` | Yes |
| Dot fill (passing) | `var(--color-success)` | Yes |
| Dot fill (failing) | `var(--color-brand)` | Yes |
| Dot stroke | `#fff` | **No** — hardcoded |
| Reference line stroke | `var(--color-success)` | Yes |
| Reference label fill | `var(--color-success)` | Yes |
| Axis tick labels | `#666` (recharts default) | **No** — hardcoded |
| Axis label text | `#808080` (recharts default) | **No** — hardcoded |
| H4 heading colour | `text-muted-foreground` | Yes (via Tailwind token) |

**TypeScript quality**: No `any` types in the component. Props interface is well-defined. `makeCustomDot` closure pattern is clean. The explicit `DotProps` type annotation on the inner function is correct.

**Import conventions**: All imports use `@/` alias correctly. No relative `../` paths.

**Inline styles**: One instance — `style={{ height: chartHeight }}` on `ChartContainer`. This is necessary because recharts requires a numeric pixel height and cannot use Tailwind height utilities for this particular prop. It is an acceptable use of inline style for a library integration constraint. No ESLint `no-inline-styles` violation since it is programmatic rather than a static style.

**Console errors from this story's code**: None. The `DialogContent requires a DialogTitle` error that appeared at 768px is pre-existing (originates from the sidebar collapse dialog, not this story).

---

## Recommendations (Prioritised)

1. **Fix axis color tokens** (Blocker + High): Pass `tick={{ fill: 'var(--color-muted-foreground)' }}` and `label={{ ..., fill: 'var(--color-muted-foreground)' }}` to both `XAxis` and `YAxis`. This resolves the two contrast blockers and the dark mode issue simultaneously. One change in `ScoreTrajectoryChart.tsx`.

2. **Fix heading level** (High): Change `<h4>` to `<h2>` for the "Score Trajectory" label. Zero visual change, significant screen reader improvement.

3. **Add aria-label to chart element** (High): Add an `aria-label` to `ChartContainer` describing the chart's purpose and content. Verify the prop is forwarded to the SVG.

4. **Fix dot stroke token** (High): Replace `stroke="#fff"` with `stroke="var(--color-card)"` in `makeCustomDot`.

5. **Restore animation with motion preference check** (Medium): Replace `isAnimationActive={false}` with `isAnimationActive={!prefersReducedMotion}` using a hook or media query check.

---

*Report generated by design-review agent. Live browser testing performed via Playwright MCP at desktop (1440px), tablet (768px), and mobile (375px) viewports in both light and dark mode.*
