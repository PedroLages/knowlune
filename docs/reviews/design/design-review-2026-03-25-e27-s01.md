# Design Review Report — E27-S01: Add Analytics Tabs To Reports Page

**Review Date**: 2026-03-25
**Reviewed By**: Claude Code (design-review agent via Playwright + Bash)
**Story**: E27-S01 — Add Analytics Tabs To Reports Page
**Changed Files**:
- `src/app/pages/Reports.tsx` (controlled tabs + URL sync via `useSearchParams`)
- `src/app/components/reports/QuizAnalyticsTab.tsx` (new component, 158 lines)

**Affected Routes Tested**:
- `/reports` (defaults to Study tab)
- `/reports?tab=study`
- `/reports?tab=quizzes`
- `/reports?tab=ai`
- `/reports?tab=invalid` (fallback)

---

## Executive Summary

E27-S01 converts the Reports page from an uncontrolled `defaultValue` tabs pattern to a URL-synced controlled pattern using `useSearchParams`, and introduces a new `QuizAnalyticsTab` component. The implementation is solid: URL sync works correctly, invalid params degrade gracefully to the Study tab, the new component uses consistent design tokens, and both loading and empty states are well-handled. Two issues warrant attention before the next story: tab triggers are 36px tall on mobile (below the 44px touch target minimum), and the tablist lacks an `aria-label` to identify its purpose to screen readers.

---

## What Works Well

1. **URL sync is clean and correct.** Clicking any tab immediately updates the URL (`?tab=quizzes`, `?tab=ai`). Direct navigation to `?tab=quizzes` or `?tab=ai` activates the correct tab with no flash. Invalid params (`?tab=invalid`) silently fall back to "study" — exactly the right defensive behavior.

2. **Design tokens are used throughout.** `QuizAnalyticsTab.tsx` uses `bg-brand-soft`, `text-brand-soft-foreground`, and `text-muted-foreground` consistently — no hardcoded hex values detected. Icons carry `aria-hidden="true"`. The background color confirms `rgb(250, 245, 238)` (#FAF5EE) across all breakpoints.

3. **Loading and empty states are well-crafted.** The skeleton loader uses `aria-busy="true"` and `aria-label="Loading quiz analytics"` — an accessibility pattern that goes above what the codebase typically provides. The empty state ("No quizzes taken yet") gives clear next-step guidance with a "Browse Courses" CTA whose measured height is exactly 44px.

4. **Retake frequency migration is clean.** The retake card was correctly removed from the Study tab and rebuilt within the Quiz tab. The Study tab contains zero instances of "Average Retake Frequency" (verified by browser test). The data-testid naming is consistent.

5. **`prefers-reduced-motion` is respected.** The outer `<MotionConfig reducedMotion="user">` in `Reports.tsx` covers all motion within the page. `QuizAnalyticsTab` itself uses no animations, which is appropriate since it is a leaf component rendered inside that config boundary.

6. **No console errors.** Zero errors logged during a full Study → Quiz → AI → Study tab-switching round trip (verified programmatically).

7. **Semantic HTML on the new component.** `QuizAnalyticsTab` wraps its content in `<section aria-labelledby="quiz-analytics-heading">` with a visually-hidden `<h2>` — consistent with how `StudyAnalytics` in `Reports.tsx` uses `<h2 className="sr-only">`.

---

## Findings by Severity

### High Priority (Should fix before merge)

#### H1 — Tab triggers are 36px tall on mobile (below 44px touch target minimum)

**Location**: `src/app/pages/Reports.tsx:206-216`

**Evidence**: Playwright measurement at 375px viewport:
```
"Study Analytics"  — height: 36px, padding: 4px 8px
"Quiz Analytics"   — height: 36px, padding: 4px 8px
"AI Analytics"     — height: 36px, padding: 4px 8px
```
The `TabsList` wrapper is `h-11` (44px) but `TabsTrigger` is `h-9` (36px) per the explicit class. The 4px gap between trigger edge and list edge is not part of the tappable target.

**Impact**: Users on mobile devices — particularly those with motor impairments — are more likely to miss-tap adjacent triggers. WCAG 2.5.5 (AAA) recommends 44px; the design principles document mandates 44px minimum for touch devices.

**Suggestion**: Remove `className="h-9"` from each `TabsTrigger` so they inherit the full container height, or change the outer `TabsList` to use `h-auto` with `py-1` and remove the manual trigger height override.

---

#### H2 — `TabsList` has no `aria-label`

**Location**: `src/app/pages/Reports.tsx:206`

**Evidence**: Playwright evaluation returned `ariaLabel: null` for `[role="tablist"]`. Radix UI passes through `aria-label` but none is provided at the call site.

**Impact**: Screen readers announce the element as "tab list" with no context. A learner navigating by landmark or element type has no way to know which tablist they are in without reading surrounding content. The Radix `TabsPrimitive.List` does include `aria-orientation="horizontal"` (confirmed: `"ariaOrientation":"horizontal"`), which is good, but the label is missing.

**Suggestion**: Add `aria-label="Reports navigation"` (or similar) to `<TabsList>`:
```tsx
<TabsList className="h-11" aria-label="Reports navigation">
```

---

### Medium Priority (Fix when possible)

#### M1 — Retake frequency is displayed twice on the Quiz tab

**Location**: `src/app/components/reports/QuizAnalyticsTab.tsx:125-155`

**Evidence**: `quiz-retake-card` (the small stat card, line 125) and `quiz-retake-detail-card` (the expanded card with prose interpretation, line 141) both display `data.retakeData.averageRetakes.toFixed(1)`. The stat card shows "Average Retakes" and the detail card shows the same number plus contextual copy from `interpretRetakeFrequency()`.

**Impact**: The repetition creates visual redundancy and increases cognitive load. A learner scanning the Quiz tab sees the retake count twice before they can synthesise the meaning. The detail card alone, placed where the stat card currently sits, would serve both purposes.

**Suggestion**: Consolidate into a single card. The detail card (with the interpreted prose) is the more informative of the two. If three stat cards are desired for visual symmetry, consider replacing the retake stat card with a "completion rate" stat (total attempts vs unique quizzes) — information that is not yet surfaced on this tab but is available from the loaded data (`data.totalAttempts / data.totalQuizzes`).

---

#### M2 — Tab switching uses `replace: true`, so browser Back does not navigate between tabs

**Location**: `src/app/pages/Reports.tsx:202`

```tsx
onValueChange={value => setSearchParams({ tab: value }, { replace: true })}
```

**Evidence**: Playwright history length measurement showed `window.history.length` remained at 3 across three tab switches. Pressing Back after switching Study → Quizzes → AI navigated to the previous page (`/overview`), not back to the Quiz tab.

**Impact**: This is a deliberate trade-off — `replace: true` prevents tab-switching from polluting the browser history stack, which is a common and accepted pattern for tab UI. The risk is that a learner who deep-links to `/reports?tab=quizzes`, switches to AI, and then wants to "go back" to quizzes will instead leave the Reports page entirely.

**Whether this is an issue depends on product intent.** If tabs are considered distinct views users may want to navigate between with the back button, use `replace: false` (or omit the option, since `false` is the default for `setSearchParams`). If tabs are considered local UI state with no meaningful history, `replace: true` is correct. This finding is flagged for a conscious product decision, not as a definite bug.

---

#### M3 — `QuizAnalyticsTab` has no stagger/reveal animation

**Location**: `src/app/components/reports/QuizAnalyticsTab.tsx:91-156`

**Evidence**: No `motion.*` usage detected in the file. The Study tab content uses `motion.div` with `variants={fadeUp}` for each row. When switching to the Quiz tab, cards appear instantaneously rather than with the same reveal pattern.

**Impact**: Minor visual inconsistency. The transition from Study (animated) to Quiz (no animation) is noticeable on a slower connection when the async data loads. `AIAnalyticsTab` also uses no motion, so this is consistent between the two new tabs — but inconsistent with the Study tab.

**Suggestion**: Wrap the stat card grid and the detail card each in `<motion.div variants={fadeUp}>` inside a `<motion.div variants={staggerContainer} initial="hidden" animate="visible">`. Import `staggerContainer` and `fadeUp` from `@/lib/motion`. This is already the dependency set used in `Reports.tsx`.

---

### Nitpicks (Optional)

#### N1 — `aria-busy="true"` is a static attribute on the skeleton element

**Location**: `src/app/components/reports/QuizAnalyticsTab.tsx:68`

```tsx
<div className="space-y-6" aria-busy="true" aria-label="Loading quiz analytics">
```

`aria-busy` should be on the container that _becomes_ busy, toggled between `true` during loading and `false` (or removed) when content loads. Here the skeleton div is conditionally rendered — it is only in the DOM while loading — so `aria-busy="true"` is effectively always true when this element exists, and the element disappears rather than transitioning to `aria-busy="false"`. This works correctly in practice but is semantically imprecise; a live region approach (`aria-live="polite"`) on the outer container would be more accurate. Not a WCAG failure.

#### N2 — Tab order in JSX differs from rendered visual order

**Location**: `src/app/pages/Reports.tsx:219-226`

```tsx
<TabsContent value="ai" ...>...</TabsContent>       {/* rendered first */}
<TabsContent value="quizzes" ...>...</TabsContent>  {/* rendered second */}
<TabsContent value="study" ...>...</TabsContent>    {/* rendered third */}
```

The visual tab order in `TabsList` is Study → Quiz → AI, but `TabsContent` panels are written AI → Quiz → Study. Radix UI's tab panel mechanism links panels by value, not DOM order, so this has no functional or accessibility impact. However, keeping the DOM order consistent with the visual order makes the component easier to scan and maintain.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Design tokens used throughout; `text-brand-soft-foreground` on `bg-brand-soft` is the correct pairing |
| Keyboard navigation (Tab, Arrow) | Pass | Tab to reach tablist; ArrowRight moves focus to "Quiz Analytics"; Enter activates and updates URL |
| Focus indicators visible | Pass | Radix UI `focus-visible:ring-[3px]` is present in `TabsTrigger` class string; confirmed visible in screenshot |
| Heading hierarchy | Pass | `<h1>Reports</h1>` → `<h2 class="sr-only">Quiz Analytics</h2>` — correct nesting |
| ARIA labels on icon-only buttons | Pass | All icons in QuizAnalyticsTab carry `aria-hidden="true"`; no icon-only buttons without labels |
| Semantic HTML | Pass | `<section aria-labelledby>` wraps quiz content; proper role="tab", role="tabpanel" via Radix |
| Form labels associated | N/A | No forms on this page |
| `prefers-reduced-motion` | Pass | `<MotionConfig reducedMotion="user">` wraps all page motion |
| Tab triggers >= 44px touch target (mobile) | Fail | Measured 36px height on 375px viewport — see H1 |
| `aria-label` on tablist | Fail | `null` returned — see H2 |
| Loading state accessible | Pass | `aria-busy="true"` + `aria-label` on skeleton container |
| Empty state accessible | Pass | Descriptive copy + visible CTA with correct button height (44px) |

---

## Responsive Design Verification

**Desktop (1440px)**: Pass

The tab bar, stat cards, and empty state all render correctly. The three tabs are visible and correctly spaced in a single row. The Study tab grid (1→2→4 columns) is unaffected by this story's changes. Screenshot evidence: `/tmp/dr-01-desktop-study-tab.png`, `/tmp/dr-03-quiz-tab.png`.

**Tablet (768px)**: Pass

The layout correctly adapts. The tablist renders in a single row and remains usable. The sidebar collapses as expected. No horizontal overflow detected. The stat card grid adjusts to 2 columns (`sm:grid-cols-2`) at this breakpoint. Screenshot evidence: `/tmp/dr-f03-tablet-full.png`.

**Mobile (375px)**: Conditional Pass

No horizontal scroll (verified: `scrollWidth === clientWidth`). The tab labels fit within the 375px viewport without wrapping or truncation. The mobile bottom nav (Overview, My Courses, Courses, Notes, More) is unaffected. **The touch target height issue (H1) applies at this breakpoint.** Screenshot evidence: `/tmp/dr-f08-mobile-tablist.png`.

---

## Detailed Findings Summary

| ID | Severity | File | Line | Issue |
|----|----------|------|------|-------|
| H1 | High | `Reports.tsx` | 207, 210, 213 | Tab triggers 36px on mobile, below 44px minimum |
| H2 | High | `Reports.tsx` | 206 | `TabsList` missing `aria-label` |
| M1 | Medium | `QuizAnalyticsTab.tsx` | 125-155 | Retake frequency shown twice (stat card + detail card) |
| M2 | Medium | `Reports.tsx` | 202 | `replace: true` skips tab history — confirm product intent |
| M3 | Medium | `QuizAnalyticsTab.tsx` | 91 | No entrance animations (inconsistent with Study tab) |
| N1 | Nitpick | `QuizAnalyticsTab.tsx` | 68 | `aria-busy` is static on conditionally-rendered element |
| N2 | Nitpick | `Reports.tsx` | 219-226 | `TabsContent` DOM order differs from visual tab order |

---

## Recommendations

1. **Fix H1 first (touch targets).** This is the only WCAG-relevant failure that affects all mobile users. Removing `className="h-9"` from each `TabsTrigger` is a one-line change per trigger.

2. **Add `aria-label` to `TabsList` (H2).** Three-word change. High impact for screen-reader users relative to effort.

3. **Decide on `replace: true` deliberately (M2).** Document the decision in a code comment. If the intent is to prevent back-button tab navigation, add a comment explaining why; if not, remove `replace: true`.

4. **Consolidate the retake display (M1).** The detail card is more informative — retire the retake stat card or replace it with a different metric (e.g., completion rate per quiz).
