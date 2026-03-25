# Design Review Report — E18-S07: Surface Quiz Analytics in Reports

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E18-S07 — Surface Quiz Analytics in Reports Section
**Branch**: feature/e18-s07-surface-quiz-analytics-in-reports-section
**Changed Files Reviewed**:
- `src/app/components/reports/QuizAnalyticsDashboard.tsx`
- `src/app/pages/Reports.tsx`
- `src/lib/analytics.ts`

**Affected Pages Tested**: `/reports` (tab=study, tab=quizzes)
**Viewports Tested**: Desktop 1440px, Tablet 768px, Mobile 375px
**Mode Tested**: Dark mode (browser default during session)

---

## Executive Summary

E18-S07 adds a well-structured "Quiz Analytics" tab to the Reports page, surfacing quiz performance data through metric cards, a recent attempts table, and top/needs-improvement lists. The implementation follows established patterns (design tokens, shadcn/ui components, 24px card radius) and ships zero console errors. Three issues require attention before merge: a WCAG AA contrast failure on link text in dark mode, touch targets below the 44px minimum on mobile, and a data logic error causing all quizzes to appear simultaneously in both "Top Performing" and "Quizzes Needing Practice."

---

## What Works Well

- **Design token discipline**: No hardcoded hex colors or raw Tailwind color utilities in `QuizAnalyticsDashboard.tsx`. All colors use semantic tokens (`text-success`, `text-warning`, `text-destructive`, `text-brand`, `text-muted-foreground`).
- **Table accessibility**: `aria-label="Recent quiz attempts"` on the table, `scope="col"` on all column headers, and per-row `aria-label` on "Details" links (`"View details for {quizTitle}"`) — the sr-only "Detail" column header is a clean pattern.
- **Loading skeleton**: The skeleton layout mirrors the final content structure exactly (3-col cards, table height, 2-col lists), which prevents jarring layout shift during data load.
- **Empty state component reuse**: The `EmptyState` component is correctly reused with appropriate props, has `role="status"`, handles `prefers-reduced-motion` via `useReducedMotion()`, and the CTA links to `/courses` as specified in AC2.
- **URL-driven tab state**: Using `useSearchParams` to persist the active tab in the URL is an excellent pattern for bookmarkability and deep linking.
- **Performance metrics**: CLS 0.00, FCP 131ms, LCP 441ms — all rated "good."
- **No horizontal scroll**: Neither mobile (375px) nor tablet (768px) produce horizontal overflow. The page scroll width equals the client width at both breakpoints.
- **Defensive data handling**: The `calculateQuizAnalytics` function correctly handles empty-attempt scenarios and returns a typed zero-value summary.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — WCAG AA contrast failure: `text-brand` links on dark card background**
- **Location**: `QuizAnalyticsDashboard.tsx:186, 217, 249`
- **Evidence**: Computed contrast of `rgb(96, 105, 192)` (brand, dark mode) against `rgb(36, 37, 54)` (card background) = **3.07:1**. WCAG AA requires 4.5:1 for normal-sized text (14px links).
- **Impact**: Learners with low vision or in challenging lighting conditions cannot reliably read "Details" links or quiz title links in the top/needs-improvement cards. This is a legal compliance issue for educational platforms.
- **Suggestion**: Replace `text-brand` with `text-brand-soft-foreground` for links rendered on card backgrounds. Per the project's styling rules, `text-brand-soft-foreground` is specifically designed to pass 4.5:1 on dark-mode card surfaces. Alternatively, use `text-foreground hover:text-brand` if the intent is to reserve color for hover state only.

---

### High Priority (Should fix before merge)

**H1 — Touch targets below 44px minimum on mobile**
- **Location**: `QuizAnalyticsDashboard.tsx:183-191` (table row links), `Reports.tsx:196-204` (tab triggers)
- **Evidence**:
  - "Details" links in the recent quizzes table: measured 44×17px at 375px viewport — meets width but fails height (needs 44px).
  - Tab triggers ("Study Analytics", "Quiz Analytics", "AI Analytics"): measured 121-96×36px — fails height.
  - Table rows themselves are 39px tall, which constrains the link clickable area.
- **Impact**: Mobile learners checking their quiz performance after a study session will have difficulty tapping "Details" links. Misses are frustrating and erode trust in the interface.
- **Suggestion**: For table links, add `py-2 min-h-[44px] flex items-center` to ensure the touch target fills the row height, or use `block py-2.5` on the anchor. For tab triggers, the `TabsList` container is already 44px tall (`h-11`) but the triggers inside use `h-9` — either remove `h-9` from triggers or increase to `h-11`.

**H2 — All quizzes appear in both "Top Performing" and "Quizzes Needing Practice"**
- **Location**: `src/lib/analytics.ts:105-107`
- **Evidence**: With the current seed data (4 unique quizzes), the `needsImprovement` calculation uses `[...sortedByScore].reverse().slice(0, 5)`, which with 4 total quizzes produces the same 4-quiz list as `topPerforming`. Confirmed live: all 4 quizzes ("Unknown Quiz", "Math Basics", "Mixed Knowledge Quiz", "Discrimination Test Quiz") appear in both panels simultaneously.
- **Impact**: A learner sees the same quizzes labelled both as their best and their worst performance, which is confusing and undermines the pedagogical intent of the feature. The "Quizzes Needing Practice" section loses its motivational value if it doesn't actually highlight weaker areas.
- **Suggestion**: Filter `needsImprovement` to exclude quizzes already in `topPerforming`, or apply a meaningful threshold (e.g., only include quizzes where `averageScore < 80`). A simple fix: `sortedByScore.filter(q => q.averageScore < 80).slice(0, 5)` for needs-improvement, ensuring there's meaningful differentiation.

**H3 — Missing H2 heading inside the Quiz Analytics tab panel**
- **Location**: `QuizAnalyticsDashboard.tsx` (entire component)
- **Evidence**: The tab panel (`role="tabpanel"` labelled "Quiz Analytics") jumps directly from H1 ("Reports") to H3 headings for each card title. No H2 exists to introduce the section, creating a heading hierarchy gap: H1 → H3.
- **Impact**: Screen reader users navigating by headings encounter an unexpected jump. The Study Analytics tab correctly uses `<h2 className="sr-only">Study Analytics</h2>` inside its `TabsContent` to bridge the hierarchy.
- **Suggestion**: Add `<h2 className="sr-only">Quiz Analytics</h2>` as the first element inside the `QuizAnalyticsDashboard` return, matching the established pattern in the Study Analytics tab.

---

### Medium Priority (Fix when possible)

**M1 — `motion.div` variants are silently inert in the Quiz Analytics tab**
- **Location**: `QuizAnalyticsDashboard.tsx:81-265` (all `motion.div` blocks)
- **Evidence**: The `QuizAnalyticsDashboard` component uses `motion.div` with `variants={fadeUp}` but provides no `initial` or `animate` props. It relies on variant propagation from the parent `staggerContainer`. However, the propagation chain is broken: `Reports.tsx` wraps its own content with `staggerContainer initial="hidden" animate="visible"`, but `QuizAnalyticsDashboard` is rendered inside a Radix `TabsContent` element, which is not a `motion` component. Variant context does not propagate across non-motion DOM boundaries. Confirmed at runtime: `getComputedStyle(metricCards).transform === 'none'` (no transform applied, animation never ran).
- **Impact**: The `fadeUp` entrance animations on metric cards, the retake frequency card, the recent quizzes table, and the top/needs-improvement lists do not animate when switching to the Quiz Analytics tab. The UX is functional but lacks the visual polish present in the other two tabs.
- **Suggestion**: Add `initial="hidden" animate="visible"` to the root `<div className="space-y-6">` of `QuizAnalyticsDashboard`, or wrap it in a `motion.div` with those props. Alternatively, add `<MotionConfig reducedMotion="user">` inside the component to ensure the animations also respect the user's motion preference.

**M2 — "Unknown Quiz" title surfaces in production-facing analytics**
- **Location**: `src/lib/analytics.ts:83, 102`
- **Evidence**: The fallback string `'Unknown Quiz'` appears in the Top Performing list when a `QuizAttempt` references a `quizId` that has no corresponding entry in `db.quizzes`. Confirmed live in the seeded dev data.
- **Impact**: The fallback is a defensive measure, but the string "Unknown Quiz" is technically-derived language that would confuse learners who completed a quiz that apparently has no name. A quiz's title is its primary identifier in this context.
- **Suggestion**: Use a more learner-friendly fallback: `'Quiz (not found)'` or omit the entry from the analytics entirely if the quiz no longer exists. Consider whether quiz attempts should be cleaned up when a quiz is deleted.

**M3 — Tab list has no `aria-label`**
- **Location**: `Reports.tsx:195` (the `<TabsList>`)
- **Evidence**: `document.querySelector('[role="tablist"]').getAttribute('aria-label')` returns `null`.
- **Impact**: Screen readers announce the tablist without context — NVDA and VoiceOver would say "tab list" with no indication of what it selects. Since the page title is "Reports" and there's an H1 with "Reports", the context is implied but not explicit.
- **Suggestion**: Add `aria-label="Reports sections"` or `aria-label="Analytics views"` to the `<TabsList>` component.

---

### Nitpicks (Optional)

**N1 — `scoreColor()` function duplicates inline string concatenation in `className`**
- **Location**: `QuizAnalyticsDashboard.tsx:109, 128` — `className={\`text-3xl font-bold ${scoreColor(...)}\`}`
- **Note**: The pattern works and is readable, but `cn(...)` from the project's utility would be more idiomatic and safer if other conditional classes are ever added. Minor consistency preference.

**N2 — Average Retake Frequency appears in both the Study Analytics tab and the Quiz Analytics tab**
- **Location**: `Reports.tsx:409-434` (Study tab), `QuizAnalyticsDashboard.tsx:136-151` (Quiz tab)
- **Note**: The retake frequency card is intentionally duplicated — it's a bridge metric that fits both contexts. However, the Study tab version shows the interpretation string (`interpretRetakeFrequency()`) while the Quiz tab version does not. Consider whether the fuller version belongs in the more analytics-focused quiz tab.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Fail | `text-brand` links on dark card bg = 3.07:1. All other text passes (metric values 12.45:1, muted-fg 7.42:1, success badges 6.34:1) |
| Keyboard navigation (tab to interactive elements) | Pass | All 13 focusable elements in the panel are reachable via Tab |
| Focus indicators visible | Pass | Links: 2px solid brand outline with 2px offset. Tab triggers: 1px solid outline |
| Heading hierarchy | Fail | H1 → H3 skip (missing H2 for section introduction) |
| ARIA labels on icon buttons | Pass | All Lucide icons have `aria-hidden="true"`, no icon-only buttons without labels |
| Semantic HTML | Pass | `<table>` with `aria-label`, `<th scope="col">`, links with descriptive `aria-label` |
| Form labels associated | N/A | No form inputs in this component |
| prefers-reduced-motion | Pass (partial) | `EmptyState` uses `useReducedMotion()`. Parent `MotionConfig reducedMotion="user"` covers the page. `motion.div` animations are inert anyway (M1) |
| Tab panel accessible name | Pass | Panel has `aria-labelledby` pointing to the "Quiz Analytics" tab trigger |
| Tab list accessible name | Fail | `role="tablist"` has no `aria-label` |
| Table column headers | Pass | All 4 headers use `scope="col"`, last column uses `<span class="sr-only">Detail</span>` |
| Touch targets ≥44×44px on mobile | Fail | Tab triggers 36px tall, table "Details" links 17px tall, table rows 39px tall |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass (layout) / Fail (touch targets). Metric cards collapse to 1-column (`grid-cols-1`). Top/needs-improvement collapses to 1-column. No horizontal scroll. Touch targets on "Details" links and tab triggers fail 44px minimum height.
- **Tablet (768px)**: Pass. Metric cards expand to 3-column (`sm:grid-cols-3`). Top/needs-improvement shows 2-column side-by-side. No horizontal scroll.
- **Desktop (1440px)**: Pass. Layout, spacing, and proportions are correct. Cards use `rounded-[24px]`. Computed card border radius verified at 24px.

---

## Detailed Findings Summary

### Finding B1 — Contrast failure on brand links (dark mode)

| Metric | Value |
|--------|-------|
| Location | `QuizAnalyticsDashboard.tsx:186, 217, 249` |
| Token used | `text-brand` |
| Computed color | `rgb(96, 105, 192)` (#6069c0 dark mode) |
| Background | `rgb(36, 37, 54)` (card, dark mode) |
| Measured contrast | 3.07:1 |
| WCAG AA requirement | 4.5:1 for normal text |
| Status | FAIL — 1.43:1 below threshold |

All three link usage sites:
- `QuizAnalyticsDashboard.tsx:186` — "Details" link in recent quizzes table
- `QuizAnalyticsDashboard.tsx:217` — Quiz title link in top-performing list
- `QuizAnalyticsDashboard.tsx:249` — Quiz title link in needs-improvement list

### Finding H2 — Duplicate list content (same quizzes in both panels)

With 4 seed quizzes, `topPerforming` and `needsImprovement` are identical reversed arrays containing all 4 quizzes. This occurs because:
```
sortedByScore = [quiz-A(83%), quiz-B(80%), quiz-C(75%), quiz-D(61%)]
topPerforming = sortedByScore.slice(0, 5)       // all 4
needsImprovement = [...sortedByScore].reverse().slice(0, 5) // all 4, reversed
```
With a small dataset there is no differentiation. This will self-correct with >10 quizzes, but the boundary condition at 4-5 quizzes produces a confusing experience.

---

## Recommendations

1. **Fix the brand link contrast (B1)** — Replace `text-brand` with `text-brand-soft-foreground` on all three link sites in `QuizAnalyticsDashboard.tsx`. This is a one-line fix per site and the token already exists for exactly this purpose.

2. **Add the missing H2 (H3)** — Insert `<h2 className="sr-only">Quiz Analytics</h2>` as the first element in the `QuizAnalyticsDashboard` return. The Study Analytics tab already uses this pattern.

3. **Fix the needs-improvement logic (H2)** — Apply a score threshold to the `needsImprovement` filter in `src/lib/analytics.ts` so quizzes only appear there if they genuinely have room for improvement. The boundary condition where all quizzes appear in both lists degrades the feature's pedagogical value.

4. **Increase table row touch targets (H1)** — The "Details" link at 17px touch height is the most impactful mobile issue. Adding `py-2.5` to the anchor element would bring it to approximately 40px — still short, but significantly better. A proper fix requires the table row to define its minimum height.
