# Design Review Report — E51-S01

**Review Date**: 2026-03-28
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E51-S01 — Settings Infrastructure & Display Section Shell
**Branch**: `feature/e51-s01-settings-infrastructure-display-section-shell`
**Changed Files**:
- `src/app/components/settings/DisplayAccessibilitySection.tsx` (new component)
- `src/app/pages/Settings.tsx` (integration at line ~913)

**Affected Pages**: `/settings`

---

## Executive Summary

E51-S01 introduces the `DisplayAccessibilitySection` shell — a new Card-based section on the Settings page housing three placeholder controls (Accessibility Font, Spacious Mode, Motion Preference) and a reset-to-defaults flow. The implementation follows the established `AgeRangeSection` pattern closely, with correct design tokens, clean ARIA usage, and a working AlertDialog reset flow. All five acceptance criteria pass in automated E2E tests. Two medium-priority findings were identified: the AlertDialog confirm button uses the `default` variant instead of the story-specified `brand` variant, and the disabled Switch controls lack `aria-describedby` associations. No blockers or high-priority issues were found.

---

## What Works Well

- **Pixel-perfect pattern adherence**: The Card + CardHeader + CardContent structure mirrors `AgeRangeSection` exactly — `rounded-full bg-brand-soft p-2` icon badge, `border-b border-border/50 bg-surface-sunken/30` header background, `p-6` content padding — all computed styles confirmed in browser.
- **Design token discipline**: Zero hardcoded hex colors or Tailwind palette classes (`bg-blue-*`, `text-gray-*`) detected in the component. All colors go through design tokens.
- **Reset button sizing**: `min-h-[44px] w-full sm:w-auto` correctly delivers 44px height at all viewports and full-width at mobile. Confirmed 266×44px at 375px viewport.
- **No console errors**: Zero JavaScript errors or React warnings across all tested viewports and interaction flows.
- **Body background token**: Confirmed `rgb(250, 245, 238)` — matches the `#FAF5EE` warm off-white requirement.
- **Card border-radius**: Computed 24px on the Card — matches the `rounded-[24px]` design token.
- **Responsive stacking**: Mobile rows correctly render `flex-direction: column` at 375px viewport with no horizontal overflow.
- **AlertDialog border-radius**: 24px — consistent with the card system.
- **Eye icon `aria-hidden="true"`**: Correctly suppressed from the accessibility tree since the heading provides the label.
- **Heading hierarchy**: H1 "Settings" → H2 "Display & Accessibility" — correct nesting, no skipped levels.

---

## Findings by Severity

### Blockers
None.

### High Priority
None.

### Medium Priority

**M1 — AlertDialog confirm button uses `default` variant instead of `brand`**
The story's Design Guidance explicitly states: "AlertDialog actions: Cancel (outline) + Reset (brand variant)". The `<AlertDialogAction>` receives no `className` override, so it falls through to `buttonVariants()` default, which maps to `bg-primary text-primary-foreground` — dark navy in light mode, near-white in dark mode. While the contrast is excellent in both modes (16.67:1 light, 14.12:1 dark), the visual treatment diverges from the specified brand-blue CTA pattern. Elsewhere in the codebase (e.g., the "Re-apply Defaults" button in `AgeRangeSection`) the same pattern applies without a variant override, so this may be intentional — but the spec says `brand`. For destructive-adjacent actions (reset) the `brand` variant (blue) is the Knowlune standard for non-destructive confirmation CTAs.

**Location**: `src/app/components/settings/DisplayAccessibilitySection.tsx:129`

**Suggestion**: Pass `className="bg-brand text-brand-foreground hover:bg-brand-hover"` on `AlertDialogAction`, or add a `variant` prop support to `AlertDialogAction` if this is a recurring need. This aligns the reset CTA visually with other Settings page confirmations.

---

**M2 — Switch controls lack `aria-describedby` for their description text**
The two placeholder Switch elements (`Toggle accessibility font`, `Toggle spacious content density`) each have a visible description line (`<p className="text-xs text-muted-foreground">`), but those descriptions are not programmatically associated via `aria-describedby`. Screen readers will announce the switch label but not its description — a learner using a screen reader won't hear "Use Atkinson Hyperlegible for improved readability" when navigating to the font toggle. This is low-risk now since both are `disabled`, but wiring the descriptions now avoids having to revisit in S02–S04.

**Location**: `src/app/components/settings/DisplayAccessibilitySection.tsx:62-66` and `79-83`

**Evidence**: `switchAriaDescribed: [null, null]` confirmed in accessibility audit.

**Suggestion**:
```tsx
// Add id to description paragraph
<p id="font-switch-desc" className="text-xs text-muted-foreground">
  Use Atkinson Hyperlegible for improved readability
</p>
// Associate on Switch
<Switch aria-label="Toggle accessibility font" aria-describedby="font-switch-desc" ... />
```
Repeat for Spacious Mode with `id="density-switch-desc"`. Since these are placeholder controls, this can be bundled into the S02/S03 wiring stories rather than addressed now.

---

### Nitpicks

**N1 — `toastSuccess.saved` used where `toastSuccess.reset` is semantically correct**
`toastSuccess.saved('Display settings reset to defaults')` calls the "saved" helper with a manually specified message. There is a dedicated `toastSuccess.reset('Display settings')` that produces the same output (`"Display settings reset to defaults"`) with idiomatic helper usage. This is a minor semantic inconsistency with no user-visible difference.

**Location**: `src/app/components/settings/DisplayAccessibilitySection.tsx:35`

**Suggestion**: Replace with `toastSuccess.reset('Display settings')`.

---

**N2 — Motion Preference uses `<span>` display instead of a control stub**
The two switch subsections render a disabled `<Switch>`. The Motion Preference subsection renders a plain `<span className="text-xs text-muted-foreground capitalize">` showing the current value text (e.g., "Follow system"). This is inconsistent — a learner encountering the section might wonder why two rows have toggles and one has a text label. A disabled `<RadioGroup>` stub (as called for in story task 3.4) would be more consistent.

**Location**: `src/app/components/settings/DisplayAccessibilitySection.tsx:96-102`

**Impact**: Minor visual inconsistency — the two rows above appear interactive (disabled switch) while this row appears informational. No functional impact since all three are placeholders.

**Suggestion**: Replace the `<span>` with a disabled `<RadioGroup>` stub (single visible option) to match the Switch treatment above, or document in the component that the RadioGroup stub is deferred to S04.

---

## Acceptance Criteria Verification

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Section appears with Eye icon, title "Display & Accessibility", description "Customize how content looks and moves" | Pass — E2E confirmed, computed styles verified |
| AC2 | Reset button opens AlertDialog with correct title and description | Pass — Dialog opens, title and description match spec |
| AC3 | Reset reverts settings, shows "Display settings reset to defaults" toast | Pass — E2E confirmed |
| AC4 | Fresh app returns correct defaults | Pass — Unit + E2E confirmed |
| AC5 | Mobile: 44x44px touch targets, full-width reset button | Conditional Pass — Reset button is 266×44px (full-width). Disabled Switch controls are 32×18px but are not interactive; see M2 note for when S02/S03 wires them up |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | H2 contrast computed high; confirm button 16.67:1 |
| Text contrast ≥4.5:1 (dark mode) | Pass | Confirm button 14.12:1; body text contrast verified |
| Keyboard navigation | Pass | AlertDialog opens and closes with keyboard; focus trap verified by Radix |
| Focus indicators visible | Pass | `focus-visible:ring-[3px]` on button via shadcn classes |
| Heading hierarchy | Pass | H1 "Settings" → H2 "Display & Accessibility" |
| ARIA labels on icon buttons | Pass | Eye: `aria-hidden="true"`, Reset: `aria-label` present |
| Semantic HTML | Pass | Correct use of `<Card>`, `<Button>`, `<Switch>` with semantic roles |
| Form labels associated | Medium | Switch `aria-describedby` missing — see M2 |
| `prefers-reduced-motion` | Deferred | No custom animations in this shell; relies on shadcn defaults |
| `aria-live` for dynamic content | Pass | Toast uses Sonner (manages its own live region) |
| Separators decorative | Pass | `role="none"` on all three Separators — correct for decorative dividers |
| `data-testid` for E2E | Pass | `data-testid="display-accessibility-section"` on CardContent |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | No horizontal overflow; reset button full-width 266px; subsection rows stack `flex-col`; viewport body 364px |
| Tablet (768px) | Pass | No horizontal overflow; reset button auto-width 267px; layout transitions to `sm:flex-row` |
| Desktop (1440px) | Pass | Reset button 267px, correctly not full-width; card 24px border-radius confirmed |

---

## Code Health Analysis

| Check | Status | Notes |
|-------|--------|-------|
| Hardcoded Tailwind colors | Pass | None found — all classes use design tokens |
| Inline style attributes | Pass | None found |
| TypeScript `any` types | Pass | None found; props typed via `AppSettings` interface |
| `@/` import aliases | Pass | All imports use `@/` alias correctly |
| Inline styles | Pass | None found |
| Design token compliance | Pass | `bg-brand-soft`, `text-brand`, `text-muted-foreground`, `border-border/50`, `bg-surface-sunken/30` all used |
| Component follows AgeRangeSection pattern | Pass | Header, icon badge, card structure identical |

---

## Recommendations

1. **Address M1 before S02**: Add `className="bg-brand text-brand-foreground hover:bg-brand-hover"` to `<AlertDialogAction>` to align with the story's design guidance. This is a one-line change.

2. **Bundle M2 into S02/S03**: When wiring the Font and Density switches in upcoming stories, add `aria-describedby` associations at that time to avoid a second pass. Document this in the S02 and S03 story files.

3. **N2 motion stub**: Either add a disabled RadioGroup stub to the Motion Preference row for visual consistency, or add a comment noting it's intentionally deferred to S04.

4. **N1 toast helper**: Replace `toastSuccess.saved(...)` with `toastSuccess.reset(...)` in a follow-up commit — 30-second change that keeps the codebase idiomatically consistent.

---

*Report generated by Claude Code (design-review agent) via Playwright MCP browser automation. Browser: Chromium 1.58.2. Viewports tested: 375×812 (mobile), 768×1024 (tablet), 1440×900 (desktop). Color modes tested: light, dark.*
