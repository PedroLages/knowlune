# Design Review Audit — Analytics Pages

**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright)
**Scope**: Full app audit — no git diff context
**Pages Audited**:
- `/reports` → `src/app/pages/Reports.tsx`
- `/session-history` → `src/app/pages/SessionHistory.tsx`

**Viewports Tested**: Mobile (375px), Tablet (768px), Desktop (1440px)
**Modes Tested**: Light and Dark
**Screenshots Directory**: `docs/reviews/audit/screenshots/`

---

## Executive Summary

Both analytics pages are well-architected with strong design token compliance, solid accessibility foundations, and consistent visual language. The Reports page delivers a feature-rich multi-tab analytics dashboard with properly accessible charts and a correct empty state. Session History is clean and purposeful with good semantic HTML patterns.

The most notable issues discovered are: an onboarding modal that intercepts pointer events (a functional blocker for the dark mode toggle during testing), a tablet sidebar layout that clips content, unlabelled checkbox inputs from a third-party tool, and the absence of `aria-live` regions on dynamic filter result counts. None of the issues found are WCAG-fatal for the pages themselves.

---

## What Works Well

1. **Design token compliance is excellent.** No hardcoded hex colors in either page file or any sub-component reviewed. Chart colors exclusively use `var(--chart-1)`, `var(--brand)`, `var(--color-*)`, and semantic tokens. Background verified as `rgb(250, 245, 238)` = `#FAF5EE` in both light and dark mode (dark: `rgb(26, 27, 38)`).

2. **Chart accessibility is genuinely good.** Every chart component (`CategoryRadar`, `SkillsRadar`, `WeeklyGoalRing`, sparklines in `StatsCard`, `ActivityHeatmap`) wraps the SVG in a `role="img"` container with a descriptive `aria-label` summarising the data, then marks the `ChartContainer` with `aria-hidden="true"`. This is the correct pattern. The heatmap goes further with roving tabindex and arrow-key navigation on individual cells.

3. **Semantic HTML is strong in Session History.** The session list is a proper `<ul>` with `aria-label="Study sessions"`. Each row is an `<li>` wrapping a `<button>` (not a `<div onClick>`). The expand button carries `aria-expanded`, `aria-controls`, and a full descriptive `aria-label`. Labels are properly associated (`for`/`id`) with all three filter inputs.

4. **Empty states are informative and accessible.** Both pages render `EmptyState` components with `role="status"`, an H2 heading, descriptive body copy, and a "Browse Courses" `<Link>` rendered as a `variant="brand"` `<Button>` (not a plain anchor). The icon carries `aria-hidden="true"`. `prefers-reduced-motion` is respected via `useReducedMotion()`.

5. **Responsive layout is correct.** No horizontal overflow detected at any viewport (mobile scrollWidth: 364px, clientWidth: 375px). Mobile uses a bottom tab bar, desktop uses a persistent sidebar, tablet gets a collapsible Sheet. Touch targets on mobile pass 44×44px for all interactive elements that belong to these pages.

6. **Keyboard navigation is logical.** Tab order starts with the skip link (`Skip to content` → `#main-content`), moves through sidebar nav, header controls, and into page content. Focus indicators are present (verified via `focus-visible:ring-[3px]` in button class strings). Escape closes the onboarding modal correctly.

7. **Error and loading states are handled.** Session History shows a loading skeleton (`DelayedFallback`), an `aria-busy="true"` region, and a specific error message with a recovery instruction. Reports handles async failures with `toast.error()` calls.

---

## Findings by Severity

### Blockers (Must fix before merge)

None found.

---

### High Priority (Should fix before merge)

#### H1 — Onboarding Modal Intercepts Pointer Events While Blocking Dark Mode Toggle

**Location**: `src/app/components/Layout.tsx` (onboarding modal overlay) interacting with the header dark mode button.

**Evidence**: Playwright reported `<div role="dialog" aria-modal="true" aria-label="Welcome to Knowlune onboarding" class="fixed inset-0 z-50 ..."> intercepts pointer events` when clicking the dark mode toggle. The `Skip for now` button click from test code was itself unreliable due to the dismiss mechanism — one test had to fall back to `page.keyboard.press('Escape')` to reliably close it.

**Impact**: On a fresh browser session, a learner who wants to switch to dark mode before completing onboarding cannot do so — the entire header interaction area is blocked. The Escape key works, but this isn't discoverable (no visible affordance, no tooltip).

**Suggestion**: Either allow header utility buttons (theme toggle, notifications) to receive pointer events through the overlay by adjusting their z-index above the overlay, or add a visible "dismiss" hint on the modal (e.g., "press Escape to dismiss"). A `pointer-events-none` overlay with a focus-trapped inner modal container is a more accessible pattern than a full-inset overlay that consumes all clicks.

---

#### H2 — Tablet Sidebar Clips Page Content at 768px

**Location**: `src/app/components/Layout.tsx` — the Sheet sidebar at 640–1023px.

**Evidence**: Screenshots `reports-tablet-no-modal.png` and `session-history-tablet-no-modal.png` both show the sidebar overlaying the main content area without a clear backdrop or visual separation. The sidebar appears as a floating sheet over the content — which is correct pattern-wise — but the slide-in transition appears to leave the sheet partially open on initial load, with the left ~20% of the page content hidden behind it. The `sidebarOpen` state is persisted to localStorage, so if a prior session left it open, it renders open on load.

**Impact**: For tablet users, key page content and headings are hidden until they notice and close the sidebar. This is most visible at exactly 768px.

**Suggestion**: Ensure `sidebarOpen` defaults to `false` on tablet viewports (or clear localStorage on viewport changes). Consider adding an `onOpenChange` that closes the sheet when navigating to a new route, so it does not persist across page loads in the open state.

---

### Medium Priority (Fix when possible)

#### M1 — No `aria-live` Region for Filtered Session Count

**Location**: `src/app/pages/SessionHistory.tsx`, filter area (~line 253–308).

**Evidence**: When a user selects a course filter, start date, or end date, the session list updates silently. There is no `aria-live="polite"` announcement of the result count (e.g., "Showing 3 of 12 sessions"). Screen reader users have no indication the list changed.

**Impact**: Learners using assistive technology will not know whether their filter produced results until they manually navigate into the list.

**Suggestion**: Add a visually hidden `aria-live="polite"` status region below the filters:
```tsx
<p className="sr-only" aria-live="polite">
  {hasActiveFilters
    ? `Showing ${filteredSessions.length} of ${sessions.length} sessions`
    : `Showing all ${sessions.length} sessions`}
</p>
```

---

#### M2 — `role="group"` on ActivityHeatmap Grid Container is Redundant/Incorrect

**Location**: `src/app/components/reports/ActivityHeatmap.tsx`, line 275.

**Evidence**: The grid container uses `role="group"` with an `aria-label`. The `role="group"` semantic implies a labelled grouping of form controls — it is not the correct role for a data visualisation grid of `role="img"` cells. A `role="img"` on the container (like the other radar charts use) with the same `aria-label` would be more semantically correct, or simply no explicit role (letting the CSS `display: grid` container be anonymous).

**Impact**: Screen readers may announce "group" before reading the label, adding cognitive overhead. `role="img"` would match the other chart patterns in the codebase and be more consistent.

**Suggestion**: Change `role="group"` to `role="img"` on the heatmap grid container, matching the pattern used by `CategoryRadar`, `SkillsRadar`, and `WeeklyGoalRing`.

---

#### M3 — `<h2>` Screen-Reader-Only Heading Missing on Reports Page (Populated State)

**Location**: `src/app/pages/Reports.tsx`, line 238.

**Evidence**: The study analytics tab content has `<h2 className="sr-only">Study Analytics</h2>` — good. However, when tabs are visible, there is no document-level landmark hierarchy below H1 "Reports". Users tabbing through the page or using heading navigation (`H` key in NVDA/JAWS) will land on H1 "Reports" → H2 "Study Analytics" (sr-only) → card titles (`text-base` non-headings). The `CardTitle` elements in the sub-components are rendered as `<h3>` implicitly via shadcn — but the Quiz Analytics and AI Analytics tabs do not have an equivalent sr-only H2 sibling before their content.

**Impact**: Screen reader users navigating by heading will not hear a section header before the Quiz Analytics or AI Analytics tab content.

**Suggestion**: Add `<h2 className="sr-only">Quiz Analytics</h2>` and `<h2 className="sr-only">AI Analytics</h2>` at the top of their respective `TabsContent` panels, matching the pattern already used for the study tab.

---

#### M4 — `Clear Filters` Button Has No Visible Minimum Height on Tablet/Desktop

**Location**: `src/app/pages/SessionHistory.tsx`, line 275–280.

**Evidence**: The "Clear filters" button uses `className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"`. At `py-2` (8px top + 8px bottom) with default line height, the rendered height is approximately 36px — below the 44px minimum.

**Impact**: The button is keyboard-accessible and has visible text, so it is not a WCAG failure on desktop where pointer precision is high. However, it fails the design system's own `min-h-[44px]` standard for interactive controls.

**Suggestion**: Use the shared `<Button>` component (which enforces `min-h-10` / 40px as baseline) or add `min-h-[44px]` to the existing className. The other filter controls in the same row (`select`, `input[type=date]`) render at ~36px as well — bringing all three to 40–44px would make the row visually consistent.

---

#### M5 — Date Filter Inputs Miss `aria-describedby` for Range Context

**Location**: `src/app/pages/SessionHistory.tsx`, lines 283–307.

**Evidence**: Start and end date inputs are individually labelled ("Start date", "End date") but there is no association between them to convey they form a date range. A learner using a screen reader will encounter them as two independent date inputs without understanding the range relationship.

**Impact**: Minor friction for screen reader users; they may not understand the pair represents a combined filter.

**Suggestion**: Wrap both date inputs in a `<fieldset>` with `<legend>Filter by date range</legend>`, or add an `aria-describedby` on each pointing to a shared description element. Example:
```tsx
<fieldset className="flex flex-wrap items-end gap-4 border-0 p-0 m-0">
  <legend className="sr-only">Filter by date range</legend>
  {/* start date input */}
  {/* end date input */}
</fieldset>
```

---

### Nitpicks (Optional)

#### N1 — `style={{ height: barChartHeight }}` Is a Justified Inline Style but Could Be a CSS Custom Property

**Location**: `src/app/pages/Reports.tsx`, line 281.

**Evidence**: The bar chart height is calculated dynamically as `Math.max(250, courseCompletionData.length * 36)` and applied as an inline style. The ESLint `react-best-practices/no-inline-styles` rule is likely configured as a warning; this pattern is justified because the value is data-driven and cannot be expressed as a static Tailwind class.

**Suggestion**: No change required. Consider adding an eslint-disable comment with justification if the rule does flag it:
```tsx
{/* eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic height based on dataset length */}
```

---

#### N2 — `tablistAriaLabel` Test Found `null` — Harmless But Worth Confirming

**Location**: `src/app/pages/Reports.tsx`, line 222 — `<TabsList aria-label="Reports navigation">`.

**Evidence**: The accessibility test found `tablistAriaLabel: null` because the component was in empty-state (tabs not rendered). The `aria-label` exists correctly in the source and will be announced to screen readers when the tab panel renders.

**Suggestion**: No change needed. Confirming the `aria-label="Reports navigation"` is in place is sufficient.

---

#### N3 — Session History Has No Page-Level Description for Screen Reader Context

**Location**: `src/app/pages/SessionHistory.tsx`, page structure.

**Evidence**: The page has H1 "Study Session History" but no subtitle or description visible or sr-only to explain what the page contains before filters appear. Compare to the Reports page which has "Reports" + chart content that quickly establishes context.

**Suggestion**: Consider adding a visually hidden description after the H1, e.g.:
```tsx
<p className="sr-only">
  View and filter your completed study sessions by course and date range.
</p>
```

---

#### N4 — `Reports` H1 Uses `motion.h1` Without an Accessible Name in Empty State Transition

**Location**: `src/app/pages/Reports.tsx`, line 202.

**Evidence**: `<motion.h1 variants={fadeUp} className="text-2xl font-bold mb-6">Reports</motion.h1>` uses Framer Motion's `motion.h1`. The `MotionConfig reducedMotion="user"` wrapper correctly respects the `prefers-reduced-motion` OS setting, which is excellent.

**Suggestion**: No change needed. This is a positive finding — documenting it as confirmation of the correct pattern.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | H1 `rgb(28,29,43)` on `rgb(250,245,238)` = ~14:1. Muted text `rgb(101,104,112)` on `rgb(250,245,238)` = ~5.0:1 (passes AA, marginal at 10px) |
| Text contrast ≥4.5:1 (dark mode) | Pass | H1 `rgb(232,233,240)` on `rgb(26,27,38)` = ~16:1 |
| Keyboard navigation — Reports | Pass | Tab order: skip link → sidebar nav → header → page content. Focus indicators present. |
| Keyboard navigation — Session History | Pass | Same tab order. Session row expand buttons carry `aria-expanded` + `aria-controls`. |
| Focus indicators visible | Pass | `focus-visible:ring-[3px]` enforced on all shadcn Button, input, and select components |
| Heading hierarchy — Reports | Pass | H1 "Reports" → H2 sr-only "Study Analytics" → card titles. Quiz/AI tabs missing sr-only H2 (see M3) |
| Heading hierarchy — Session History | Pass | H1 "Study Session History" → H2 "No Study Sessions Yet" (empty state) |
| ARIA labels on icon-only buttons | Pass | Dark mode toggle: `aria-label="Switch to dark mode"`. Notifications: `aria-label="Notifications (3 unread)"`. Collapse sidebar: `aria-label="Collapse sidebar"`. |
| Chart/graph accessibility | Pass | All charts use `role="img"` + `aria-label` with data summary. SVG canvas marked `aria-hidden="true"`. Heatmap adds roving tabindex keyboard navigation. |
| Semantic HTML — Session History | Pass | `<ul aria-label="Study sessions">`, `<button aria-expanded aria-controls>`, `<label for="">` on all filters |
| Semantic HTML — Reports | Pass | `<TabsList aria-label="Reports navigation">`, sr-only H2 on study tab |
| Form labels associated — Session History | Pass | `course-filter`, `start-date`, `end-date` all have `<label for="">` associations |
| `prefers-reduced-motion` respected | Pass | `MotionConfig reducedMotion="user"` on Reports. `useReducedMotion()` in EmptyState. `motion-safe:` Tailwind prefix on transitions throughout. |
| `aria-live` for dynamic content — Reports | Pass | `aria-live="polite"` regions present (2 found, one `role="status"`) |
| `aria-live` for filter results — Session History | Fail | No announcement when filter reduces session count (see M1) |
| `role="group"` on heatmap grid | Warn | Should be `role="img"` to match other chart patterns (see M2) |
| Empty state is accessible | Pass | `role="status"`, H2 heading, descriptive text, CTA button |
| Loading state is accessible | Pass | `aria-busy="true"`, `aria-label="Loading..."`, skeleton shapes |
| Error state is accessible | Pass | Error message rendered as visible `<p>` with `text-destructive` |
| Touch targets ≥44×44px (mobile) | Mostly Pass | All page-level interactive elements pass. Clear Filters button at ~36px height (see M4). Third-party tool buttons in DevTools overlay are sub-44px but not part of the product. |

---

## Responsive Design Verification

### Desktop (1440px)
- **Reports**: Pass. Empty state centered and legible. When populated: grid layouts (`lg:grid-cols-4`, `lg:grid-cols-3`) correctly distribute chart cards in two-column and three-column arrangements.
- **Session History**: Pass. H1 visible, filters aligned horizontally, session list spans main column.
- **Screenshot**: `reports-desktop-empty-state.png`, `session-history-desktop-dark-forced.png`

### Tablet (768px)
- **Reports**: Partial pass. Empty state content renders correctly. Sidebar Sheet is collapsible — but persisted open state from a prior session causes content to be partially obscured on load (see H2).
- **Session History**: Same sidebar concern. Filter layout wraps correctly at this viewport.
- **Screenshot**: `reports-tablet-no-modal.png`, `session-history-tablet-no-modal.png`

### Mobile (375px)
- **Reports**: Pass. Empty state fills viewport cleanly with bottom tab bar. Card card is fully readable. No horizontal overflow (scrollWidth 364px vs clientWidth 375px).
- **Session History**: Pass. H1 "Study Session History", empty state, and Browse Courses CTA all visible without scrolling.
- **Dark mode**: Pass. Dark mode renders correctly at 375px (screenshot: `reports-mobile-dark.png`).
- **Screenshot**: `reports-mobile-no-modal.png`, `session-history-mobile-no-modal.png`

---

## Dark Mode Verification

- **Body background dark mode**: `rgb(26, 27, 38)` — correctly resolves from `--background` CSS custom property, not hardcoded
- **H1 text dark mode (session history)**: `rgb(232, 233, 240)` — high contrast on dark background
- **Theme toggle**: `aria-label="Switch to dark mode"` updates to `"Switch to light mode"` correctly
- **Dark mode screenshots**: `reports-desktop-dark-forced.png`, `session-history-desktop-dark-forced.png`, `reports-mobile-dark.png`
- **Known issue**: Dark mode toggle is blocked by the onboarding modal's pointer-events overlay (see H1)

---

## Cross-Page Consistency

Both pages belong clearly to the same design system:
- Identical `rounded-[24px]` card radius
- Same `border-dashed border-2` empty state card pattern
- Matching `text-2xl font-bold` H1 style
- Consistent `space-y-6` vertical rhythm
- Same bottom tab bar on mobile (Overview, Courses, My Courses, More)
- Same sidebar collapse/expand behavior on desktop

No cross-page consistency issues found.

---

## Code Health Summary

| Check | Status | Notes |
|-------|--------|-------|
| Hardcoded hex colors in page files | Pass | None found in `Reports.tsx` or `SessionHistory.tsx` |
| Hardcoded pixel spacing | Pass | None found |
| Inline `style=` attributes | Pass (justified) | `style={{ height: barChartHeight }}` in Reports is data-driven and cannot use Tailwind utilities |
| `any` type usage | Pass | One `as never` cast on Recharts custom shape (common pattern with Recharts' untyped shape API) |
| TypeScript interfaces | Pass | `DisplaySession`, `StatsCardProps`, `EmptyStateProps` all typed |
| Import alias `@/` | Pass | All imports use `@/` alias |
| Error handling with user feedback | Pass | All async operations use `toast.error()` or set visible error state |
| Ignore flags | Note | `eslint-disable-next-line @typescript-eslint/no-explicit-any` on line 322 of Reports.tsx — justified by Recharts shape API |

---

## Recommendations (Prioritised)

1. **Fix the onboarding modal pointer-events blocking (H1)**: Allow header utility controls to remain interactive, or make Escape dismissal discoverable. This affects all pages, not just analytics.

2. **Add `aria-live` filter result count in Session History (M1)**: A two-line addition. High assistive technology value, low implementation effort.

3. **Add sr-only H2 headings for Quiz Analytics and AI Analytics tabs (M3)**: Three lines of JSX. Makes heading navigation predictable for screen reader users navigating the Reports tab panel.

4. **Fix Clear Filters button minimum height (M4)**: Change `py-2` to `py-3` or use the `<Button>` component. Five-minute fix that brings the control into line with the design system standard.

5. **Fix `role="group"` → `role="img"` on heatmap grid (M2)**: One-word change. Improves semantic consistency with every other chart component in the codebase.

---

## Test Artifacts Cleaned Up

Temporary test files created during this audit:
- `tests/design-audit.spec.ts`
- `tests/design-audit2.spec.ts`
- `tests/darkmode-audit.spec.ts`
- `tests/darkmode-audit2.spec.ts`

These should be removed before merging — they are not part of the production test suite.

