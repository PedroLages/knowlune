# Design Review Report — Knowledge Retention Dashboard (E11-S02)

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e11-s02-knowledge-retention-dashboard`
**Changed Files**:
- `src/app/pages/RetentionDashboard.tsx`
- `src/app/components/figma/TopicRetentionCard.tsx`
- `src/app/components/figma/EngagementDecayAlert.tsx`
- `src/app/config/navigation.ts`
- `src/app/pages/Reports.tsx`
- `src/lib/retentionMetrics.ts`
- `src/lib/spacedRepetition.ts`

**Affected Route**: `/retention`

---

## Executive Summary

The Knowledge Retention Dashboard is a well-conceived new page that surfaces spaced-repetition data through three clearly structured panels: summary statistics, per-topic retention cards, and engagement health alerts. The implementation correctly uses design tokens, respects `prefers-reduced-motion` via `MotionConfig`, provides proper progress bar ARIA attributes, and avoids horizontal overflow at all tested breakpoints. Three issues require attention before merge: a WCAG AA contrast failure on all `text-xs text-muted-foreground` instances inside white cards, two `<section>` landmark elements missing accessible names, and the "Engagement: Healthy" status residing outside any live region — meaning state changes from healthy to alerted (or vice versa) are silent to screen reader users.

---

## What Works Well

- **Progress bars are fully ARIA-compliant.** Every `role="progressbar"` has `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a descriptive `aria-label` (e.g. `"React retention: 87%"`). This directly satisfies the review requirement.
- **Retention badges avoid color-only encoding.** Each badge renders the text label ("Strong", "Fading", "Weak") alongside the color, and carries `aria-label="Retention: Strong (87%)"` with the numeric percentage — exceeding the minimum requirement.
- **Design token compliance is clean.** Zero hardcoded hex colors or raw Tailwind palette classes (`bg-blue-600` etc.) found in the three new files. All semantic colors use `text-success`, `text-warning`, `text-destructive`, `bg-brand-soft`, `bg-muted`.
- **Loading skeleton is correctly announced.** The skeleton wrapper has `aria-busy="true"` and `aria-label="Loading retention data"`, matching the design principle for loading state UX.
- **`prefers-reduced-motion` is respected.** `<MotionConfig reducedMotion="user">` wraps the entire page, meaning Framer Motion animations will be suppressed for users who prefer reduced motion. Pass.
- **Background color is correct.** Computed `background-color` of `body` is `rgb(250, 245, 238)` — exactly `#FAF5EE`. Pass.
- **Card border radius is correct.** All `[data-slot="card"]` elements compute `border-radius: 24px`. Pass.
- **Stats cards open detail sheets.** The `StatsCard` component wraps each metric in a `SheetTrigger`, providing a full `SheetTitle` + `SheetDescription` — well above the minimum for interactive stat cards.
- **No horizontal overflow at any breakpoint.** Mobile (375px): `scrollWidth 364 < clientWidth 375`. Tablet (768px): no overflow. Large desktop (1536px): no overflow. Pass.
- **Grid layout is correct at all breakpoints.** Mobile: single column. Tablet (768px): 2-column grid (`346.5px 346.5px`). Large desktop (1536px): 3-column grid (`449px × 3`). Matches the design principle.
- **Empty state is implemented.** When `allReviews.length === 0`, an `EmptyState` with an actionable CTA ("Go to Review Queue") is rendered. Pass.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. WCAG AA contrast failure — `text-muted-foreground` on white card background**

All `text-xs` secondary text inside `TopicRetentionCard` renders at **3.88:1** contrast — below the required 4.5:1 for normal (non-large) text at 12px/400 weight.

Affected text instances (verified via `getComputedStyle`):
- Note count: "2 notes", "1 note"
- Retention label: "Retention" (left side of the progress bar row)
- Last reviewed: "Last reviewed: Today"

Computed values:
- Foreground: `rgb(125, 129, 144)` (`--muted-foreground`)
- Background: `rgb(255, 255, 255)` (card surface)
- Contrast ratio: **3.88:1** (required: 4.5:1)

**Impact for learners**: Small supplementary text is the most frequently read text in the retention card — note count and last-reviewed date are key at-a-glance signals. Failing contrast harms users with low-contrast vision sensitivity, common among learners studying in varied lighting conditions.

**Suggestion**: Darken the `--muted-foreground` token on white surfaces, or switch these labels to `text-foreground` / `text-sm` at `font-medium` weight. Target `rgb(100, 104, 117)` or darker to reach 4.5:1 on white. This is a token-level change that would benefit all components using `text-muted-foreground` on white cards — worth coordinating globally rather than patching only this file.

**Location**: `src/app/components/figma/TopicRetentionCard.tsx:41-48, 64-66, 87-89`

---

### High Priority (Should fix before merge)

**2. `<section>` landmarks have no accessible name — invisible to screen reader navigation**

The two `<motion.section>` elements in `RetentionDashboard.tsx` (wrapping "Retention by Topic" and "Engagement Health") have no `aria-label` or `aria-labelledby`. Per the ARIA spec, `<section>` is only exposed as a `region` landmark to assistive technologies when it carries an accessible name. Without one, screen reader users cannot jump to these sections via landmark navigation (the standard F6 / rotor navigation pattern used by NVDA and VoiceOver users).

**Evidence**:
```
sectionDetails: [
  { ariaLabel: null, ariaLabelledby: null, firstHeading: "Retention by Topic" },
  { ariaLabel: null, ariaLabelledby: null, firstHeading: "Engagement Health" }
]
```

**Impact**: A screen reader user cannot navigate directly to "Retention by Topic" without tabbing through every preceding element. In a data-dense dashboard this is a significant navigation burden.

**Suggestion**: Add `aria-labelledby` pointing to the `CardTitle` heading. Since the `CardTitle` renders as `<h3>`, give it an `id`:

```tsx
// RetentionDashboard.tsx
<motion.section variants={fadeUp} aria-labelledby="retention-by-topic-heading">
  <Card className="rounded-[24px]">
    <CardHeader>
      <CardTitle id="retention-by-topic-heading" ...>Retention by Topic</CardTitle>
```

Apply the same pattern to the "Engagement Health" section.

**Location**: `src/app/pages/RetentionDashboard.tsx:110-127, 130-143`

---

**3. "Engagement: Healthy" status is outside any live region — status changes are silent**

`EngagementDecayAlerts` renders two distinct branches: the `aria-live="polite"` alerts list (when alerts exist) and a plain `<div>` with `data-testid="engagement-status-healthy"` (when none). The healthy state `<div>` has no `aria-live`, no `role="status"`, and is not inside any live region.

This means: if a user's engagement status changes from "Healthy" to a decay alert (or back), the change is announced via the live region when alerts appear — but the restoration to "Healthy" is never announced, and on first page load the healthy status reads silently.

**Evidence**:
```
healthyStatusHasLiveRegion: false
healthyDivAriaLive: null
healthyDivRole: null
```

**Impact**: Users relying on screen readers receive no confirmation that their engagement is in good standing — an important positive reinforcement signal in a learning context.

**Suggestion**: Wrap both branches in a shared live region container at the `EngagementDecayAlerts` component level:

```tsx
<div aria-live="polite" aria-atomic="true">
  {alerts.length === 0 ? (
    <div className="flex items-center gap-2" ...>
      {/* healthy state */}
    </div>
  ) : (
    <div className="space-y-3">
      {/* alerts */}
    </div>
  )}
</div>
```

**Location**: `src/app/components/figma/EngagementDecayAlert.tsx:22-63`

---

**4. Heading hierarchy skips H2 — `CardTitle` headings are H3 under an H1 with no H2 between**

The page has one `<h1>` ("Knowledge Retention") and two `<h3>` elements ("Retention by Topic", "Engagement Health") with no `<h2>` anywhere in the page. The stats section has no heading at all.

Per WCAG 2.4.6 (Headings and Labels) and the platform's own design principles, heading levels should not skip. Screen reader users who rely on heading navigation to scan page structure will encounter an unexpected jump from H1 to H3.

**Evidence**: `h2Count: 0, h3Count: 2` — confirmed via `querySelectorAll('h2')`.

**Impact**: Learners using screen readers navigate by heading level. The missing H2 level breaks the expected hierarchy, making the page structure harder to scan mentally.

**Suggestion**: Either promote the two card titles to `<h2>` (adjust `CardTitle` via `asChild` or override the default tag), or add a visually hidden `<h2>` wrapping the stats grid. If the shadcn `CardTitle` renders as `<h3>` by default, check whether it supports an `as` prop or use `<CardTitle asChild><h2>...</h2></CardTitle>`.

**Location**: `src/app/pages/RetentionDashboard.tsx` — heading structure; `src/app/components/figma/TopicRetentionCard.tsx` — no heading issue here, card is display-only.

---

### Medium Priority (Fix when possible)

**5. Progress bar fill uses inline `style={{ width: ... }}` rather than a CSS variable or Tailwind arbitrary value**

The retention bar fill width is set via `style={{ width: \`${Math.max(2, topic.retention)}%\` }}`. This is the one inline style in the new code. While functionally correct, inline styles suppress Tailwind's `transition-all` class from working predictably in all browsers and prevent CSS-based theming.

**Evidence**: `src/app/components/figma/TopicRetentionCard.tsx:76`

**Impact**: Minor — the `transition-all duration-500` class still applies, but mixing inline styles with Tailwind transitions can cause specificity surprises in future. More importantly, the `eslint-plugin-react-best-practices/no-inline-styles` rule will flag this as a warning.

**Suggestion**: Use a CSS custom property instead:
```tsx
<div
  className="h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
  style={{ '--retention-width': `${Math.max(2, topic.retention)}%` } as React.CSSProperties}
  ...
/>
```
With a supporting CSS rule `width: var(--retention-width)`. Alternatively, since this is a dynamic percentage, the inline style is a widely accepted exception — add an ESLint disable comment with justification if keeping it.

**Location**: `src/app/components/figma/TopicRetentionCard.tsx:76`

---

**6. Progress bar fill transitions lack `motion-reduce:transition-none`**

`TopicRetentionCard` applies `transition-all duration-500` to the progress bar fill but does not guard it with `motion-reduce:transition-none`. While `MotionConfig reducedMotion="user"` on the page-level motion elements is correct, Tailwind CSS transitions are separate from Framer Motion and require their own `motion-reduce:` prefix to be suppressed.

**Evidence**: `src/app/components/figma/TopicRetentionCard.tsx:71` — `'h-full rounded-full transition-all duration-500'` with no `motion-reduce:` variant. The card's `transition-shadow duration-200` on line 30 has the same gap.

**Impact**: Low — only 1 in ~100 users has this preference active, but for those users animated progress bars are an accessibility concern (vestibular disorders).

**Suggestion**:
```tsx
'h-full rounded-full transition-all duration-500 motion-reduce:transition-none'
```

---

**7. `DialogContent` console errors present at tablet viewport (pre-existing, not from E11-S02)**

Two Radix UI errors fire when the viewport is resized to tablet width:

```
ERROR: `DialogContent` requires a `DialogTitle` for screen reader users.
WARNING: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}
```

These originate from other components (confirmed by searching — `RetentionDashboard.tsx` contains no `DialogContent`). The errors are pre-existing and triggered by sidebar or other layout components activating on resize. They are noted here as they appear in the console during the review session and affect the overall accessible quality of the page load context.

**Recommendation**: Track as a separate issue. Search for `DialogContent` usages in `src/app/components/figma/CourseCard.tsx`, `ThumbnailPickerDialog.tsx`, and `StudyStreakCalendar.tsx` — the likely sources.

---

### Nitpicks (Optional)

**8. Stats section has no visible or hidden heading**

The three stats cards (Notes at Risk, Due Today, Avg Retention) are grouped in a `<motion.div data-testid="retention-stats">` with no section heading. The individual card labels serve as implicit labels, but a visually-hidden `<h2>Summary Statistics</h2>` would complete the heading outline cleanly.

**9. Hover shadow on `TopicRetentionCard` suggests interactivity that doesn't exist**

`TopicRetentionCard` has `hover:shadow-md` and `transition-shadow duration-200` but contains no interactive element and is not keyboard-focusable. The hover shadow is a strong affordance signal that typically indicates a clickable card. Since no click action exists on these cards (the stats cards open sheets, but topic cards don't), consider removing the hover shadow or adding a navigate-to-filtered-review action.

**Location**: `src/app/components/figma/TopicRetentionCard.tsx:30`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | FAIL | `text-muted-foreground` 12px/400 on white cards: 3.88:1 — see Finding 1 |
| Text contrast ≥3:1 (large text) | PASS | All headings and bold values pass |
| Retention badge contrast | PASS | "Strong" badge: 4.92:1 on `rgb(238,245,240)` — passes AA |
| Keyboard navigation — stat cards | PASS | Three `<button>` elements in `main`, focusable, `aria-label` present |
| Keyboard navigation — topic cards | N/A | Cards are display-only; no interactive affordance present |
| Focus indicators visible | PASS | Stats card buttons: `outline: oklch(0.708 0 0) solid 2px` on focus |
| Focus indicator — skip link | PASS | Skip link `href="#main-content"` present; `main` has `id="main-content"` |
| Heading hierarchy | FAIL | H1 → H3 with no H2; see Finding 4 |
| `<section>` landmarks accessible | FAIL | Two sections lack `aria-label`/`aria-labelledby`; see Finding 2 |
| `role="progressbar"` complete | PASS | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` all present |
| Retention indicator non-color | PASS | Text labels "Strong"/"Fading"/"Weak" always rendered; `aria-label` includes percentage |
| ARIA live regions — alerts | PASS | Alert list: `aria-live="polite"` present |
| ARIA live region — healthy state | FAIL | Healthy status `<div>` has no `aria-live` or `role="status"`; see Finding 3 |
| Loading state announced | PASS | `aria-busy="true"` + `aria-label` on skeleton wrapper |
| Empty state implemented | PASS | `EmptyState` with actionable CTA renders when no review data |
| Semantic HTML — main landmark | PASS | `<main id="main-content">` present |
| Semantic HTML — nav landmark | PASS | Sidebar uses `<nav aria-label="Main navigation">` |
| Icons decorative | PASS | All `LucideIcon` instances have `aria-hidden="true"` |
| `prefers-reduced-motion` — Framer Motion | PASS | `<MotionConfig reducedMotion="user">` wraps page |
| `prefers-reduced-motion` — CSS transitions | FAIL | `transition-all duration-500` on progress fill lacks `motion-reduce:transition-none`; see Finding 6 |
| No hardcoded colors | PASS | Zero hex codes or raw Tailwind palette classes in new files |
| No horizontal scroll (mobile 375px) | PASS | `scrollWidth 364 < clientWidth 375` |
| No horizontal scroll (tablet 768px) | PASS | Confirmed no overflow |
| No horizontal scroll (large desktop 1536px) | PASS | Confirmed no overflow |
| Background `#FAF5EE` | PASS | `rgb(250, 245, 238)` confirmed on `body` |
| Card border radius 24px | PASS | All cards compute `border-radius: 24px` |

---

## Responsive Design Verification

| Breakpoint | Layout | Overflow | Notes |
|------------|--------|----------|-------|
| Mobile 375px | Single column (305px stats, 255px topic cards) | None | Both grids stack correctly to 1 column |
| Tablet 768px | 2-column grid (`346.5px × 2` for stats, `321.5px × 2` for topics) | None | Sidebar remains visible at 280px width |
| Desktop 1440px | 3-column grid | None | Tested at 1440px (standard) |
| Large desktop 1536px | 3-column grid (`449px × 3` for stats, `433px × 3` for topics) | None | Breakpoint `lg:grid-cols-3` activates correctly |

---

## Recommendations (Prioritized)

1. **Fix contrast (Blocker)** — Adjust `--muted-foreground` token or promote small supplementary labels to a higher-contrast value on white card surfaces. This single token change resolves four failing text instances across both topic cards.

2. **Add accessible names to `<section>` elements (High)** — Add `aria-labelledby` pointing to each `CardTitle` and assign matching `id` props. This is a two-line change per section.

3. **Add `aria-live` to healthy engagement state (High)** — Wrap both branches of `EngagementDecayAlerts` in a single `<div aria-live="polite" aria-atomic="true">`. Ensures dynamic status changes are announced regardless of which branch is active.

4. **Fix heading hierarchy (High)** — Promote card section titles from H3 to H2, or add a visually hidden H2 above the stats grid. This is the minimum needed to restore correct heading outline (`H1 → H2 → H3`).

