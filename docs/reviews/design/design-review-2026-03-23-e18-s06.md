# Design Review: E18-S06 — Display Quiz Performance in Overview Dashboard

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E18-S06 — Display Quiz Performance in Overview Dashboard
**Changed Files**:
- `src/app/components/dashboard/QuizPerformanceCard.tsx` (new)
- `src/app/pages/Overview.tsx` (integration)
**Affected Routes**: `/` (Overview Dashboard)
**Viewport Tested**: Desktop 1440px, Tablet 768px, Mobile 375px
**Color Scheme Tested**: Dark mode (active in browser), Light mode (computed via token inspection)

---

## Executive Summary

The `QuizPerformanceCard` is a well-implemented, token-clean summary widget that integrates naturally into the Overview dashboard. Skeleton loading, empty state, and data-populated states are all present and structurally sound. Two issues require attention before merge: a WCAG AA contrast failure on the "View Detailed Analytics" link in dark mode (3.07:1 vs. the required 4.5:1 for 12px text), and an HTML validity violation where an `<a>` element is nested directly inside a `<button>`. These are targeted, fixable issues on an otherwise solid implementation.

---

## What Works Well

- Design token compliance is excellent — no hardcoded hex colors or raw Tailwind palette classes found anywhere in the component. All colors use `bg-card`, `text-muted-foreground`, `text-brand`, `bg-brand-soft`, `text-brand-soft-foreground` etc.
- Card border radius (`24px`) and padding (`24px`) exactly match the `rounded-[24px]` + `p-6` pattern used by Study History and Study Schedule sections on the same page.
- The skeleton's `aria-busy="true"` and `aria-label="Loading quiz performance"` attributes are correctly implemented, giving screen readers accurate feedback during the async load.
- The empty state correctly uses `bg-brand-soft` for the icon container and `text-brand-soft-foreground` for the icon — the design-token contrast rule that the styling guide specifically calls out as a common pitfall (dark mode icon-on-soft-bg: 4.65:1, passing AA).
- Motion accessibility is handled correctly: `motion-safe:transition-colors` on the card and `MotionConfig reducedMotion="user"` in `Overview.tsx` both respect the user's `prefers-reduced-motion` preference.
- Heading hierarchy is correct — "Quiz Performance" is an H2 under the single H1 "Your Learning Studio", consistent with every other dashboard section.
- No horizontal scroll was detected at any tested breakpoint (375px, 768px, 1440px).
- No console errors introduced by the new component. The two existing warnings (deprecated apple-mobile-web-app-capable meta tag; Recharts sizing) are pre-existing and unrelated.
- The `ignore` flag pattern in `useEffect` is correctly used to prevent setting state on an unmounted component.
- All imports use the `@/` alias — no relative `../` paths.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1: WCAG AA Contrast Failure — "View Detailed Analytics" Link (Dark Mode)

- **Location**: `src/app/components/dashboard/QuizPerformanceCard.tsx:125`
- **Evidence**:
  - Computed link color in dark mode: `rgb(96, 105, 192)` (the `--brand` token, `#6069c0`)
  - Card background in dark mode: `rgb(36, 37, 54)` (the `--card` token, `#242536`)
  - Measured contrast ratio: **3.07:1**
  - Required for 12px (`text-xs`) normal weight text: **4.5:1 (WCAG AA)**
  - In light mode this passes (4.70:1 on white), so this is dark-mode specific.
- **Impact**: Learners using dark mode — a common preference for extended study sessions — cannot reliably read the link to access detailed analytics. This directly undermines the feature's navigational purpose.
- **Suggestion**: Replace `text-brand` on this link with a higher-contrast token for dark mode. The `text-brand-soft-foreground` token (`#8b92da`) achieves 4.65:1 against the dark card background and is already used correctly in the empty state icon. Alternatively, increasing the link to `text-sm` (14px) would classify it as "large text" where 3:1 suffices — but using the correct token is cleaner.

---

### High Priority (Should fix before merge)

#### H1: `<a>` Nested Inside `<button>` — HTML Validity Violation

- **Location**: `src/app/components/dashboard/QuizPerformanceCard.tsx:99, 123`
- **Evidence**: The outer card is `<button onClick={() => navigate(...)}>`. Inside it, when data is loaded, a React Router `<Link to="/reports?tab=quizzes">` renders an `<a href>`. Both elements have `tabIndex: 0` (confirmed via computed DOM inspection), making both individually focusable. The HTML spec explicitly forbids interactive content (including `<a href`) inside `<button>`.
- **Impact**:
  1. **Screen readers**: NVDA and JAWS interpret `<button>` as a non-interactive container when it contains an `<a>`. Some announce the card as the button's label text plus the link text, creating redundant or confusing announcements ("Quiz Performance — view detailed analytics, link, View Detailed Analytics").
  2. **Keyboard navigation**: Tab will land on the outer `<button>` first, then Tab again lands on the inner `<a>` — two stops for what is conceptually one card with one secondary action.
  3. **Browser parsing**: Browsers silently repair invalid HTML in ways that differ across engines, meaning the rendered DOM may not match what React rendered.
- **Suggestion**: Two clean alternatives:
  - Convert the outer wrapper from `<button>` to a `<div>` or `<article>` with `role="group"` or no role, and make the entire card clickable via a visually hidden `<Link>` as a block overlay (common "card link" pattern). The "View Detailed Analytics" link then becomes the only focusable element.
  - Keep the outer `<button>` for card-click navigation, but move the "View Detailed Analytics" link outside the `<button>`, positioned visually below it using flexbox on the parent.

---

### Medium Priority (Fix when possible)

#### M1: Animation Pattern Inconsistency — `whileInView` vs. `variants={fadeUp}`

- **Location**: `src/app/pages/Overview.tsx:244-251`
- **Evidence**: The three earliest dashboard sections (Hero Zone, Recommended Next, Metrics Strip) use `variants={fadeUp}` and participate in the `staggerContainer` sequence — they animate in a coordinated stagger. The Quiz Performance section (and all sections below it) uses `initial={{ opacity: 0, y: 20 }} whileInView=...` with an explicit transition. This is functionally correct and motion-safe, but it breaks the stagger sequence started by the outer `motion.div`. The section animates independently rather than as part of the coordinated reveal.
- **Impact**: On a wide/fast display where all content is visible on load, the stagger-then-whileInView pattern creates a subtle visual jank — some cards enter as a group, then the Quiz Performance card enters on its own trigger. The experience is slightly less polished than it could be.
- **Suggestion**: Align with `variants={fadeUp}` for consistency with the other early sections, OR document the intentional split (sections above the fold use stagger; sections below use whileInView) as a deliberate scroll-reveal strategy. Both approaches are valid; the current implicit mix is just unclear.

#### M2: Touch Target Too Small — "View Detailed Analytics" Link on Mobile

- **Location**: `src/app/components/dashboard/QuizPerformanceCard.tsx:123-130`
- **Evidence**: Measured link height at all viewports: **16px**. The minimum touch target size per WCAG 2.5.5 and the project design principles is **44x44px**.
- **Impact**: On mobile (375px viewport), tapping the link is imprecise and may accidentally trigger the outer card button's `navigate()` instead of the `<Link>`. This compounds the nested-interactive-element issue (H1 above).
- **Suggestion**: Add `py-2 -my-2` (or equivalent) padding to increase the tappable area without changing visual spacing. The `inline-flex` display already supports this. Note: this is secondary to fixing H1 — the right fix for both issues together is to resolve the nesting structure first.

---

### Nitpicks (Optional)

#### N1: `Completion Rate` Always Displays 100%

- **Location**: `src/lib/quizMetrics.ts:37` and `QuizPerformanceCard.tsx:119`
- The `quizMetrics.ts` file itself documents this limitation clearly (the note about Story 17.1), but the card displays `100%` for all users with any quiz data. This may look like a bug to learners who know they didn't complete every quiz they started. The metric row label "Completion Rate" without any contextual tooltip could be misleading.
- **Suggestion**: Either add a tooltip or parenthetical ("submitted attempts") to clarify what is being measured, or defer showing the Completion Rate row until Story 17.1 adds the abandoned-attempt data. This is a product decision more than a design one — flagging for awareness.

#### N2: Card Full-Width Layout at Desktop

- The QuizPerformanceCard spans the full 1296px content width at 1440px viewport. The three metric rows — "Quizzes Completed: 14", "Average Score: 70%", "Completion Rate: 100%" — look slightly sparse at this width, with most of the card's horizontal space empty. Other dashboard data cards (Study History, Study Schedule) also span full width and use the space for richer content.
- **Suggestion**: Consider whether a narrower column layout (e.g., `max-w-sm` or integration into a two-column grid alongside another compact widget) would make better use of the horizontal space at desktop. This is an aesthetic observation, not a functional issue.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal) | Fail | "View Detailed Analytics" link: 3.07:1 in dark mode (see B1) |
| Text contrast ≥3:1 (large text) | Pass | H2 heading: 12.45:1; metric values: 12.45:1 |
| Muted text contrast | Pass | `text-muted-foreground` labels: 7.42:1 in dark mode |
| Keyboard navigation | Partial | Card is focusable (tabIndex 0); nested `<a>` creates two tab stops (see H1) |
| Focus indicators visible | Pass | 2px solid `outline-ring` with 2px offset; consistent with StatsCard pattern |
| Heading hierarchy | Pass | H2 "Quiz Performance" under H1 "Your Learning Studio" |
| ARIA labels on icon buttons | Pass | Card `aria-label="Quiz Performance — view detailed analytics"` present |
| Semantic HTML | Fail | `<a>` nested inside `<button>` is invalid HTML (see H1) |
| Skeleton ARIA | Pass | `aria-busy="true"` + `aria-label="Loading quiz performance"` present |
| Form labels associated | N/A | No form inputs in this component |
| prefers-reduced-motion | Pass | `motion-safe:` prefix on card transition; `MotionConfig reducedMotion="user"` in Overview |
| Touch targets ≥44px | Fail | "View Detailed Analytics" link: 16px height (see M2) |
| Alt text on images | Pass | `aria-hidden="true"` on all decorative icons |
| Color not sole indicator | Pass | Metric values use text labels, not just color |

---

## Responsive Design Verification

| Breakpoint | Horizontal Scroll | Card Width | Layout | Status |
|------------|-------------------|------------|--------|--------|
| Mobile (375px) | None | 327px | Single column, full width | Pass |
| Tablet (768px) | None | 720px | Single column, full width | Pass |
| Desktop (1440px) | None | 1296px | Single column, full width | Pass |

All breakpoints render without horizontal scroll. Card padding (24px) is consistent across all viewports. The card scales gracefully with no content overflow or text truncation observed.

---

## Detailed Findings Summary

| # | Severity | Issue | File | Line |
|---|----------|-------|------|------|
| B1 | Blocker | Dark mode contrast failure on "View Detailed Analytics" link (3.07:1, needs 4.5:1) | `QuizPerformanceCard.tsx` | 125 |
| H1 | High | `<a>` nested inside `<button>` — invalid HTML, breaks screen reader announcement | `QuizPerformanceCard.tsx` | 99, 123 |
| M1 | Medium | Animation pattern inconsistency (`whileInView` vs `variants={fadeUp}`) | `Overview.tsx` | 244 |
| M2 | Medium | "View Detailed Analytics" link touch target 16px (needs 44px on mobile) | `QuizPerformanceCard.tsx` | 123 |
| N1 | Nitpick | Completion Rate always 100% — potentially misleading without context | `quizMetrics.ts` | 37 |
| N2 | Nitpick | Card content sparse at 1296px desktop width | `Overview.tsx` | 250 |

---

## Recommendations

1. **Fix B1 first**: Change `text-brand` to `text-brand-soft-foreground` on the "View Detailed Analytics" link. One-line fix, unambiguous improvement, unblocks merge.

2. **Resolve the nested interactive element (H1)**: The cleanest path is to replace the outer `<button>` with a non-interactive wrapper and use the React Router `<Link>` as a full-card overlay link (visually hidden, positioned absolute, fills the card), with the "View Detailed Analytics" link visible below it. This simultaneously resolves M2 (touch target) since the visible link can then have proper padding.

3. **Align animation pattern (M1)**: After the structural fix in point 2, check whether the section can adopt `variants={fadeUp}` to join the stagger sequence — this is a one-property swap and keeps the codebase consistent.

4. **Post-Story-17.1**: Revisit the Completion Rate display (N1). Once abandoned-attempt tracking exists, the metric will be meaningful. Until then, consider a tooltip or deferring the row.
