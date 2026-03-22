# Design Review: E15-S05 — Display Performance Summary After Quiz

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E15-S05 — Display Performance Summary After Quiz
**Branch**: `feature/e15-s05-display-performance-summary-after-quiz`
**Changed Files**:
- `src/app/components/quiz/PerformanceInsights.tsx` (new component)
- `src/app/pages/QuizResults.tsx` (integration)
**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz/results`

---

## Executive Summary

E15-S05 adds a `PerformanceInsights` component to the `QuizResults` page that breaks down quiz performance by topic, identifying strengths (≥70%) and growth areas (<70%). The implementation is clean and well-structured — design token usage is exemplary, responsive behaviour works correctly at all three breakpoints, all contrast ratios pass WCAG AA, and the component is display-only with no keyboard interaction required. Two issues require attention before merge: the heading hierarchy jumps from H1 directly to H3, then back to H2 for `AreasForGrowth`, which violates document outline semantics; and the topic-list content inherits `text-center` from the parent card without a counteracting `text-left` on the section, leaving sub-text like "Review questions 3, 4" center-aligned rather than left-aligned as the design principles require for body text.

---

## What Works Well

1. **Exemplary design token compliance.** Every colour class (`text-success`, `text-warning`, `bg-muted`, `text-foreground`, `text-muted-foreground`) uses the semantic token system. No hardcoded colours or Tailwind palette classes anywhere in the component.

2. **Correct responsive grid.** The `sm:grid sm:grid-cols-2 sm:gap-4 space-y-4 sm:space-y-0` pattern fires exactly at the `sm` breakpoint. At 375px both sections stack vertically (tops at 720px and 864px); at 768px+ they are correctly side-by-side (both at top 692px, 296px wide each). No horizontal scroll at any breakpoint.

3. **Solid accessibility groundwork.** Both decorative icons carry `aria-hidden="true"`. Each section uses `<section aria-labelledby>` linked to a live heading ID (generated via `useId()`), which creates proper landmark regions in the accessibility tree. All colour contrasts pass WCAG AA: correct text on card bg is 6.34:1, incorrect text is 7.0:1, heading on muted section bg is 10.15:1, growth percentage on muted bg is 5.71:1.

4. **Color is never the sole indicator.** The summary bar reads "3 correct · 2 incorrect" in plain text — the colour on "correct" and "incorrect" is additive, not essential. Topic names and percentages appear together in both sections. The `TrendingUp` icon in Growth Opportunities and `CheckCircle2` in Strengths provide icon+colour redundancy.

5. **Meaningful `useMemo` usage.** The `analyzeTopicPerformance` call is correctly memoised on `[questions, answers]`, preventing unnecessary recalculation on any unrelated parent re-render.

6. **Conditional rendering logic is clean.** `showTopicSections = hasMultipleTopics && (strengths.length > 0 || growthAreas.length > 0)` correctly suppresses the sections for all-General quizzes without leaving empty containers in the DOM.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### H1 — Heading hierarchy violation: H1 → H3 → H2

**Issue**: The `QuizResults` page document outline reads H1 → H3, H3 → H2. The PerformanceInsights headings are `h3` but appear in DOM order *before* the `AreasForGrowth` `h2`. This inverts the expected nesting and creates a broken outline that screen readers announce in confusing order.

**Location**: `src/app/components/quiz/PerformanceInsights.tsx:47,72` and `src/app/components/quiz/AreasForGrowth.tsx:29`

**Evidence** (computed heading hierarchy from live DOM):
```
H1  — "JavaScript Fundamentals — Results"   (QuizResults)
H3  — "Your Strengths"                      (PerformanceInsights)   ← skips H2
H3  — "Growth Opportunities"                (PerformanceInsights)
H2  — "Areas to Review"                     (AreasForGrowth)        ← goes back up
```

**Impact**: Screen reader users who navigate by heading (a primary navigation strategy) encounter H3 sub-sections before an H2 section heading. This breaks the document outline model that assistive technologies use to build a page map. WCAG 2.1 SC 1.3.1 (Info and Relationships) requires that information conveyed through presentation be programmatically determinable.

**Suggestion**: Change the `PerformanceInsights` headings from `h3` to `h2` — they are direct children of the main quiz result card, parallel to `AreasForGrowth`. The corrected outline would be H1 → H2, H2, H2. Alternatively, if the product intent is that PerformanceInsights is a sub-section of a higher-order "Results Detail" group, wrap both `PerformanceInsights` and `AreasForGrowth` in a containing `<section>` with an H2, and keep the inner headings as H3.

```tsx
// Simplest fix: change h3 → h2 in PerformanceInsights.tsx
<h2 id={strengthsHeadingId} className="text-lg font-semibold text-foreground">
  Your Strengths
</h2>
// ...
<h2 id={growthHeadingId} className="text-lg font-semibold text-foreground">
  Growth Opportunities
</h2>
```

---

### Medium Priority (Fix when possible)

#### M1 — "Review questions" hint text is center-aligned

**Issue**: The `PerformanceInsights` component renders inside a parent card that carries `text-center`. The `<section>` elements in `PerformanceInsights` do not declare `text-left`, so all descendant text — including the "Review questions 3, 4" hint paragraph — inherits center alignment. The `justify-between` flex layout on the topic/percentage rows works visually for those rows, but block-level text like the hint `<p>` is centered.

**Location**: `src/app/components/quiz/PerformanceInsights.tsx:68,87`

**Evidence** (computed from live DOM):
```
li[display=list-item].textAlign: "center"
p "Review questions 3, 4".textAlign: "center"
```
Contrast with `AreasForGrowth`, which correctly declares `className="text-left"` on its `<section>` wrapper.

**Impact**: The design principles state "Left-aligned text for LTR languages (never center-align body text)". Centered hint text in a narrow card is harder to scan, especially as topic lists grow longer, and it is visually inconsistent with the `AreasForGrowth` section immediately below which is left-aligned.

**Suggestion**: Add `text-left` to each `<section>` in `PerformanceInsights`, mirroring the pattern in `AreasForGrowth`:

```tsx
// In PerformanceInsights.tsx — Strengths section
<section
  aria-labelledby={strengthsHeadingId}
  className="bg-muted rounded-xl p-5 sm:p-6 space-y-3 text-left"
>

// Growth Opportunities section
<section
  aria-labelledby={growthHeadingId}
  className="bg-muted rounded-xl p-5 sm:p-6 space-y-3 text-left"
>
```

---

#### M2 — No `aria-live` region for dynamically injected results content

**Issue**: The `PerformanceInsights` component (and the `QuizResults` page in general) renders after quiz submission — the content does not exist in the DOM at page load, it appears as a result of navigation. The `ScoreSummary` component does have an `aria-live="polite"` div for the score announcement, but `PerformanceInsights` adds topic-based content with no equivalent announcement.

**Location**: `src/app/components/quiz/PerformanceInsights.tsx:23` and `src/app/pages/QuizResults.tsx:122-178`

**Evidence**: `insightsAriaLive: null` from computed DOM inspection. The score `aria-live` region in `ScoreSummary` only announces the numeric score, not the topic breakdown.

**Impact**: Screen reader users who navigate to the results page will hear the score announcement, but will need to manually explore to discover the Strengths and Growth Opportunities sections. There is no audible cue that topic-specific performance data is available.

**Suggestion**: This is a medium priority rather than a blocker because the sections are properly labelled landmarks (via `aria-labelledby`) that screen reader users can navigate to via the regions list. A lightweight option is to add a brief visually-hidden announcement once both sections are known to be present:

```tsx
{showTopicSections && (
  <p className="sr-only" aria-live="polite">
    Topic performance summary available: {strengths.length} strength
    {strengths.length !== 1 ? 's' : ''} and {growthAreas.length} growth area
    {growthAreas.length !== 1 ? 's' : ''} identified.
  </p>
)}
```

---

### Nitpicks (Optional)

#### N1 — Summary bar `text-center` is redundant given the parent context

**Location**: `src/app/components/quiz/PerformanceInsights.tsx:25`

The summary `<p>` carries `text-center`, but this is already inherited from the parent card's `text-center` class. Not harmful, but can be removed for class hygiene once the `text-left` sections fix (M1) is applied — at that point the summary bar will still be centered by the parent card, and the explicit class is still harmless.

#### N2 — Strengths section border radius uses `rounded-xl` (14px) while AreasForGrowth also uses `rounded-xl` — consistent

This was verified: the project's Tailwind configuration resolves `rounded-xl` to 14px, not the default 12px. Both components use `rounded-xl` for their inner cards. This is internally consistent.

#### N3 — `skippedCount` zero-state is silently omitted from the summary bar

**Location**: `src/app/components/quiz/PerformanceInsights.tsx:29-34`

When `skippedCount` is 0 the span is not rendered, which is the correct UX decision — no noise for the common case. This is a positive nitpick flagging intentional behaviour.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | All measured pairs: correct/card 6.34:1, incorrect/card 7.0:1, muted/card 7.42:1, heading/section 10.15:1, warning pct/section 5.71:1, hint/section 6.05:1 |
| Keyboard navigation | Pass | Component is display-only; no interactive elements to navigate |
| Focus indicators visible | Pass | No focusable elements in the component |
| Heading hierarchy | Fail | H1 → H3, H3 → H2 — see H1 finding |
| ARIA labels on icon buttons | Pass | No icon-only buttons in this component |
| Semantic HTML | Pass | `<section aria-labelledby>`, `<ul>/<li>`, `<p>`, proper heading elements |
| Screen reader landmark regions | Pass | Both sections registered as `region` with linked heading IDs |
| Color as sole indicator | Pass | All colour use is supplementary; text labels carry the meaning |
| `prefers-reduced-motion` | Pass | Component has no animations; no `motion-reduce` needed |
| Form labels associated | Pass | No form inputs in this component |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | Sections stack vertically (top offsets: 720px, 864px). No horizontal scroll (scrollWidth 404 < clientWidth 416). All touch targets height ≥ 44px. |
| Tablet (768px) | Pass | Sections are side-by-side (both at top 692px, each 296px wide). `sm:grid-cols-2` activates correctly. |
| Desktop (1440px) | Pass | Sections are side-by-side within the max-w-2xl card. Adequate padding (24px), readable line lengths. |

---

## Code Health Summary

| Check | Status | Notes |
|-------|--------|-------|
| Design token compliance | Pass | All colour classes use semantic tokens; no hardcoded palette colours found |
| Inline style attributes | Pass | None |
| TypeScript: no `any` types | Pass | Props interface fully typed; `analyzeTopicPerformance` return type is `TopicAnalysis` |
| Import conventions | Pass | All imports use `@/` alias |
| Tailwind utility usage | Pass | No inline `style=` attributes; responsive modifiers used correctly |
| No console errors | Pass | 0 errors during full test session |
| Console warnings | Pass | One pre-existing meta tag deprecation warning unrelated to this story |
| `useMemo` correctness | Pass | `analyzeTopicPerformance` memoised on `[questions, answers]` |

---

## Recommendations

1. **Fix the heading hierarchy (H1).** Change the two `h3` elements in `PerformanceInsights` to `h2`. This is the most impactful accessibility fix and a one-line change per heading.

2. **Add `text-left` to both sections (M1).** Mirror the `AreasForGrowth` pattern. This aligns the "Review questions" hint text and future multi-line topic content with the left-align body text principle.

3. **Consider a lightweight `aria-live` announcement for topic results (M2).** A single `sr-only` paragraph announcing the count of strengths and growth areas found gives screen reader users an audible cue they don't currently get. Low implementation effort, meaningful impact.

4. **No action needed on responsive layout, tokens, or contrast.** These are all clean and match the existing quiz component patterns faithfully.
