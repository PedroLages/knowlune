# Design Review Report

**Review Date**: 2026-03-30
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E69-S01 — Storage Estimation Service and Overview Card
**Branch**: `feature/e89-s12c-design-polish`
**Changed Files**:
- `src/app/components/settings/StorageManagement.tsx` (new, 421 lines)
- `src/app/pages/Settings.tsx` (import + JSX insertion at line 1202)
**Affected Pages**: `/settings` (scroll to bottom — Storage & Usage card)

---

## Executive Summary

E69-S01 introduces a `StorageManagement` card to the Settings page that displays IndexedDB storage usage by category with a stacked bar chart, legend grid, warning/critical banners, and a refresh button. The implementation is structurally sound and closely mirrors the `MyDataSummary` pattern. One blocker exists: `bg-warning-soft` references a CSS token that is not defined in `theme.css`, causing the warning banner background to render transparent instead of amber. Additionally, a contrast issue affects warning text in dark mode, and the inline swatch color in the legend uses `style=` rather than a Tailwind utility — both warrantable callouts. No console errors, no horizontal overflow, and keyboard/focus behavior is correct.

---

## What Works Well

- **Pattern consistency**: Header structure (rounded icon container, `CardTitle`, subtitle paragraph, `border-b border-border/50 bg-surface-sunken/30`) is a pixel-perfect match to `MyDataSummary` — identical composition.
- **Border radius and card background**: `borderRadius: 24px`, `background: rgb(255, 255, 255)` (light) / `rgb(36, 37, 54)` (dark) — both correct theme tokens.
- **Screen reader accessibility**: A `<table class="sr-only">` provides a full text alternative for the chart, with `<caption>`, `<th>` headers, and category rows. This is a thoughtful and uncommon accessibility affordance that should be highlighted as a reference pattern.
- **ARIA completeness on banners**: `role="alert"` with `aria-live="assertive"` on critical and `aria-live="polite"` on warning is textbook correct. Non-dismissible critical banner is the right UX decision.
- **Touch targets**: Refresh button has `min-h-[44px]` and the Dismiss button has `min-h-[44px]` — both meet the 44x44px minimum.
- **Keyboard focus**: Global `*:focus-visible` rule applies `2px solid var(--brand)` to all interactive elements, including the refresh and dismiss buttons. Focus is visible and brand-consistent.
- **Zero console errors**: No runtime errors or React warnings at any breakpoint.
- **No horizontal scroll**: `scrollWidth <= clientWidth` confirmed at 375px, 768px, and 1440px.
- **Scroll target is correct**: `document.getElementById('data-management')` in the "Free Up Space" button correctly targets the `<Card id="data-management">` at line 953 of Settings.tsx.
- **Loading skeleton**: `aria-busy="true"` on `CardContent`, matching skeletons for the summary line, chart bar, and 6 legend tiles — functionally correct for both visual and screen reader users.
- **Dark mode card**: Background `rgb(36, 37, 54)` matches `--card` dark token; title `rgb(232, 233, 240)` matches `--card-foreground` dark token. Header sunken background resolves correctly in dark mode.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. `bg-warning-soft` is an undefined CSS token**

- **Location**: `StorageManagement.tsx:85` and `:102`
- **Evidence**: Computed `getComputedStyle` of `.bg-warning-soft` element returned `rgba(0, 0, 0, 0)` (fully transparent). `getComputedStyle(document.documentElement).getPropertyValue('--warning-soft')` returned `""` (empty). The token `--warning-soft` does not exist in `src/styles/theme.css` — confirmed by grep.
- **Impact**: When storage reaches 80-94%, the warning banner background is invisible. The `border-warning` border and `text-warning-foreground` text both render (border `rgb(134, 98, 36)`, text `rgb(255, 255, 255)`), but white text on a transparent/white background fails completely in light mode. The banner is functionally invisible.
- **Context**: This exact gap was documented in `docs/implementation-artifacts/15-4-provide-immediate-explanatory-feedback-per-question.md:141`: "No `--warning-soft` token: Used `bg-warning/10` pattern (established in ChatQA.tsx, Challenges.tsx)." The established workaround is `bg-warning/10`.
- **Suggestion**: Replace `bg-warning-soft` with `bg-warning/10` on line 85, and `hover:bg-warning-soft` with `hover:bg-warning/10` on line 102. This matches the established codebase pattern and the ESLint `design-tokens/no-hardcoded-colors` rule will not flag it since it uses the `--warning` token with opacity.

```tsx
// Line 85 — change:
className="flex items-start gap-3 rounded-lg border border-warning bg-warning/10 p-4"
// Line 102 — change:
className="flex-shrink-0 text-warning-foreground hover:bg-warning/10 min-h-[44px]"
```

---

### High Priority (Should fix before merge)

**2. Warning banner text contrast fails in dark mode**

- **Location**: `StorageManagement.tsx:91-95` — `text-warning-foreground` on `bg-warning/10` background
- **Evidence**: In dark mode, `text-warning-foreground` resolves to `rgb(26, 27, 38)` (very dark, nearly black — this is `--warning-foreground: #1a1b26` from dark theme.css). The banner background with `bg-warning/10` resolves to approximately `oklab(0.677 / 0.1)` — a faint amber tint over the dark card background `rgb(36, 37, 54)`. Dark text on a near-dark background fails WCAG AA (contrast would be approximately 1.5:1 — well below 4.5:1 required).
- **Impact**: Users in dark mode cannot read the warning message — the very scenario where storage alerts are most critical.
- **Root cause**: `--warning-foreground` in dark mode is set to `#1a1b26` (dark ink), which is intended for use on a full-strength `--warning` background (amber button). On the soft `bg-warning/10` tint, there is not enough contrast against the dark card.
- **Suggestion**: Use `text-warning` instead of `text-warning-foreground` for banner text in the warning state. `text-warning` resolves to `rgb(218, 168, 96)` in dark mode (the amber itself), which has sufficient contrast against the dark card background. Apply to both the heading (`p.font-medium`) and body text:

```tsx
// Replace text-warning-foreground with text-warning throughout QuotaWarningBanner
<p className="text-sm font-medium text-warning">
  Storage is getting full ({percent}%)
</p>
<p className="text-xs text-warning/80 mt-1">
  Consider cleaning up unused data to free space.
</p>
// Dismiss button:
className="flex-shrink-0 text-warning hover:bg-warning/10 min-h-[44px]"
```

**3. Legend swatch color dot uses `style=` inline**

- **Location**: `StorageManagement.tsx:211-213`
- **Evidence**:
```tsx
style={{
  backgroundColor: chartConfig[cat.category as StorageCategory]?.color,
}}
```
- **Impact**: The ESLint `react-best-practices/no-inline-styles` rule will flag this as a warning. The color values are CSS variable references (`var(--chart-1)` etc.), so they cannot be expressed as static Tailwind utilities — the inline usage is justified by the dynamic nature.
- **Suggestion**: Add an `// inline-style-ok — chart color CSS variable cannot be expressed as static Tailwind class` comment to document the intentional exception and suppress the lint warning. This is consistent with how the codebase handles other justified inline style cases.

```tsx
{/* inline-style-ok — chart color CSS variable cannot be expressed as static Tailwind class */}
<span
  className="size-2.5 rounded-full flex-shrink-0"
  style={{ backgroundColor: chartConfig[cat.category as StorageCategory]?.color }}
  aria-hidden="true"
/>
```

---

### Medium Priority (Fix when possible)

**4. Heading hierarchy: StorageManagement uses `H3` but the surrounding section heading is absent at the card level**

- **Location**: All `CardTitle` renders in `StorageManagement.tsx` (lines 299, 326, 356, 383)
- **Evidence**: The Settings page heading hierarchy shows: `H1: Settings` → `H2: Data Management` (parent section) → `H3: Export Your Data, Full Data Export, Notes Export, Achievements Export`. The Storage card's `CardTitle` also renders as `H3: Storage & Usage` — this is contextually correct, but the card has four separate `H3` instances (one per render state: loading, unavailable, empty, normal). All are "Storage & Usage", so screen reader users navigating by heading will encounter the same heading multiple times in the outline if states were ever simultaneously rendered.
- **Impact**: Low risk since only one state renders at a time, but the heading duplication is a mild structural smell. Not a blocker.
- **Suggestion**: No change needed for now — the single-render-state architecture prevents the duplication from being observable. Consider extracting a shared `StorageCardHeader` sub-component in a future refactor to eliminate the four identical `CardHeader` blocks (lines 293-312, 318-341, 348-371, 376-405).

**5. `CardContent` does not receive `aria-busy="true"` in the loading skeleton state**

- **Location**: `StorageManagement.tsx:302`
- **Evidence**: The code at line 302 shows `<CardContent className="p-6 space-y-4" aria-busy="true">` — this is correctly implemented in the code. However, the live browser evaluation of all `[data-slot="card-content"]` elements returned all as `ariabusy: null`. This suggests that either: (a) the loading state resolves too quickly in the test environment, or (b) the `aria-busy` attribute is being stripped. The code is correct; this observation is noted as a verification gap only.
- **Suggestion**: No code change needed — the `aria-busy` implementation is present. Add a brief loading delay in development or a Playwright test to verify the loading skeleton state is reachable in tests.

**6. Empty state lacks an actionable CTA button**

- **Location**: `StorageManagement.tsx:363-367`
- **Evidence**:
```tsx
<p className="text-sm text-muted-foreground">
  No learning data stored yet. Import a course to get started!
</p>
```
- **Impact**: The text says "Import a course to get started!" but there is no button or link. Compare to other Settings empty states in the codebase which include an action button. A learner reading this card on mobile has no direct path to act on the suggestion.
- **Suggestion**: Add a `<Button variant="outline" size="sm" asChild>` wrapping a `<Link to="/courses">Browse Courses</Link>` or a similar contextual CTA. This brings the empty state in line with the design principle "Error states with recovery actions."

---

### Nitpicks (Optional)

**7. ChartContainer height 32px via inline style — minor consistency observation**

- **Location**: `StorageManagement.tsx:139`
- **Evidence**: `style={{ height: 32 }}` uses a raw pixel integer, not a Tailwind utility like `h-8` (32px = 2rem = 8 Tailwind units).
- **Context**: The `ScoreTrajectoryChart` and `ImprovementChart` components use the same `style={{ height: chartHeight }}` pattern with dynamic values, so this is consistent with the established chart pattern.
- **Suggestion**: Change to `className="w-full h-8"` and remove the `style` prop to eliminate the inline style entirely. `h-8` = 32px exactly. This removes the one remaining unjustified inline style.

**8. Four near-identical `CardHeader` blocks across render states**

- **Location**: Lines 293-312 (loading), 318-341 (unavailable), 348-371 (empty), 376-405 (normal)
- **Observation**: The `CardHeader` content is repeated verbatim across all four render states. This is not a bug, but it creates a maintenance burden — if the subtitle or icon changes, it must be updated in four places.
- **Suggestion**: Extract a `StorageCardShell` component that accepts `children` and renders the consistent header wrapper. This follows the Single Responsibility Principle from the design principles doc.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light) | Pass | `muted-foreground` on white card: `rgb(101,104,112)` on `rgb(255,255,255)` — approximately 4.6:1 |
| Text contrast ≥4.5:1 (dark) | Fail | Warning banner: `text-warning-foreground` (`rgb(26,27,38)`) on `bg-warning/10` tint — fails in dark mode (see Finding #2) |
| Keyboard navigation | Pass | Focus indicators present on all interactive elements via global `*:focus-visible` rule |
| Focus indicators visible | Pass | `2px solid var(--brand)` outline at 2px offset — clearly visible |
| Heading hierarchy | Pass | H3 within H2 Data Management section — correct nesting |
| ARIA labels on icon buttons | Pass | Refresh button `aria-label="Refresh storage estimates"`, Dismiss `aria-label="Dismiss storage warning"` |
| Semantic HTML | Pass | `role="alert"`, `role="list"`, `role="listitem"`, `<table class="sr-only">` for chart alternative |
| `aria-live` on dynamic regions | Pass | `aria-live="assertive"` on critical, `aria-live="polite"` on warning |
| Screen reader chart alternative | Pass | Full `<table class="sr-only">` with caption, headers, and per-category rows |
| Form labels associated | N/A | No form inputs in this component |
| `prefers-reduced-motion` | Pass | Global `@media (prefers-reduced-motion: reduce)` in `index.css` covers `animate-spin` on Loader2 |
| Touch targets ≥44x44px | Pass | Refresh and Dismiss buttons both have `min-h-[44px]` |
| Color as sole indicator | Pass | Category labels accompany all color swatches; SR table provides text alternative for chart colors |
| No horizontal scroll | Pass | Verified at 375px, 768px, 1440px — `scrollWidth <= clientWidth` confirmed |
| `aria-describedby` on help text | N/A | No form fields with separate help text |
| `aria-expanded` on collapsibles | N/A | No collapsible elements |
| `aria-current="page"` on nav | Pass | Handled by Layout, not this component |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — Card renders correctly, no overflow, empty state text fits within the card. The onboarding modal overlays on initial load (not a StorageManagement issue). No horizontal scroll confirmed.
- **Tablet (768px)**: Pass — Card renders in the single-column Settings layout. Sidebar visible at 231px width. No layout breakage.
- **Desktop (1440px)**: Pass — Card at full Settings page width with correct `rounded-[24px]` radius and `bg-card` white background. Header structure consistent with MyDataSummary.

### Legend Grid Breakpoints (code-verified, not live-tested since no data in test environment)

The legend uses `grid-cols-2 md:grid-cols-3 gap-3` — correct responsive columns (2-col on mobile, 3-col on md+ which maps to 768px+). This matches the design specification.

---

## Recommendations

1. **Fix `bg-warning-soft` immediately** (Blocker #1): Replace with `bg-warning/10` on lines 85 and 102. This is a one-line fix that unblocks the warning banner from being invisible.

2. **Fix warning text in dark mode** (High #2): Replace `text-warning-foreground` with `text-warning` throughout `QuotaWarningBanner`. The `--warning` token in dark mode (`#daa860` / `rgb(218,168,96)`) has adequate contrast against the dark card background.

3. **Add suppression comment to the legend swatch inline style** (High #3): Prevents the `react-best-practices/no-inline-styles` ESLint warning from surfacing in future lint runs.

4. **Consider adding a CTA to the empty state** (Medium #6): "Import a course to get started!" without an actionable button leaves the learner with advice but no path forward. A `<Link to="/courses">` inside an outline button would complete the affordance.

---

## Summary Table

| # | Issue | Location | Severity | Action |
|---|-------|----------|----------|--------|
| 1 | `bg-warning-soft` undefined token — transparent banner | `StorageManagement.tsx:85,102` | Blocker | Replace with `bg-warning/10` |
| 2 | Warning text contrast fails dark mode | `StorageManagement.tsx:91-102` | High | Replace `text-warning-foreground` with `text-warning` |
| 3 | Legend swatch inline style missing lint suppression | `StorageManagement.tsx:211` | High | Add `// inline-style-ok` comment |
| 4 | Heading duplication across 4 render states | Lines 299/326/356/383 | Medium | Extract `StorageCardShell` (future refactor) |
| 5 | `aria-busy` loading state unverified | Line 302 | Medium | Add test coverage for skeleton state |
| 6 | Empty state lacks CTA | Lines 363-367 | Medium | Add `<Link to="/courses">` button |
| 7 | `style={{ height: 32 }}` on chart — use `className="h-8"` | Line 139 | Nitpick | Replace with Tailwind utility |
| 8 | Four identical `CardHeader` blocks | Lines 293/318/348/376 | Nitpick | Extract shared header component |
