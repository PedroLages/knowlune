# Design Review Report — E11-S04: Data Export

**Review Date**: 2026-03-15
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E11-S04 — Data Export
**Branch**: `feature/e11-s04-data-export`
**Changed UI File**: `src/app/pages/Settings.tsx`
**Affected Page**: `/settings` — Data Management card

---

## Executive Summary

E11-S04 extends the existing Data Management card in Settings with four distinct export formats (JSON, CSV, Markdown notes, Open Badges v3.0) plus a JSON re-import service. The section integrates cleanly into the page's visual language with consistent card rows, design token usage, and well-labeled buttons. Two issues require attention before merge: export buttons do not meet the 44px touch-target minimum on mobile, and the "Restore from Backup" Import button is missing an `aria-label`. A heading hierarchy inconsistency and a missing `aria-live` region on the progress indicator are medium-priority concerns.

---

## What Works Well

- **Design token discipline**: All colours use semantic tokens (`bg-success-soft`, `text-brand`, `text-warning`, `bg-destructive/5`). No hardcoded hex values or inline style attributes anywhere in the diff. `bg-warning/10` correctly uses the `--color-warning` CSS variable with opacity — the right pattern given no `warning-soft` token exists.
- **ARIA labels on all export buttons**: Every export/download button has a descriptive `aria-label` (`"Export all data as JSON"`, `"Export all data as CSV"`, `"Export notes as Markdown"`, `"Export achievements as Open Badges"`). Icons are marked `aria-hidden="true"` consistently throughout the section (12 icons confirmed).
- **Focus management**: All buttons carry `focus-visible:ring-[3px]` via the shared button component — keyboard focus will be clearly visible.
- **Semantic HTML structure**: Heading hierarchy within the export section is logical (H3 section titles → H4 item titles). Export rows use `<button>` elements, not `<div onClick>`. No inline styles detected.
- **Hover transitions**: Each export card row carries `hover:bg-surface-elevated/80 transition-colors` — clean, purposeful micro-interaction at the correct ~150ms timing.
- **Disabled-state guard**: `isExporting` flag sets `disabled` on all export buttons while another export is running, preventing concurrent operations. The animation entry on the progress bar (`animate-in fade-in slide-in-from-top-1 duration-300`) matches the 250–350ms content-reveal timing standard.
- **No horizontal scroll**: Confirmed absent at all three tested viewports (375px, 768px, 1280px) via `scrollWidth > clientWidth` check.
- **Zero console errors**: One pre-existing deprecation warning for `apple-mobile-web-app-capable` meta tag — not introduced by this story.

---

## Findings by Severity

### Blockers (Must fix before merge)

**None.**

---

### High Priority (Should fix before merge)

#### 1. All export buttons below 44px touch target on mobile and tablet

- **Location**: `src/app/pages/Settings.tsx:595–674` — all six action buttons in `data-testid="data-export-section"`
- **Evidence**: Computed height at all viewports (375px, 768px, 1280px) is consistently `32px` — this is the `size="sm"` variant (`h-8`). The WCAG 2.5.5 / design-principles minimum is 44×44px for touch devices.
- **Impact**: On a phone or tablet, learners with motor impairments or average finger size (~10mm) will mis-tap neighbouring rows or the surrounding card, triggering frustration at exactly the moment they are trusting the app with a data export or reset. The Danger Zone "Reset" button at 32px is especially risky — an accidental tap leads to irreversible data loss.
- **Suggestion**: Change `size="sm"` to `size="default"` on all six buttons (height becomes `h-9` = 36px, closer) or use `min-h-[44px]` alongside `size="sm"` as is already done on the "Save Profile Changes" button at line 458. A middle ground: `className="gap-2 min-h-[44px]"` keeps the compact visual footprint while meeting the minimum.

---

#### 2. "Restore from Backup" Import button has no `aria-label`

- **Location**: `src/app/pages/Settings.tsx:714–720`
- **Evidence**: Computed `aria-label` is `null`. The button's accessible name resolves only to its inner text content "Import" — which is ambiguous: a screen reader user at this point in the focus order has no indication this imports a backup file vs. other potential import actions.
- **Impact**: Screen reader users navigating by button list (a common NVDA/VoiceOver pattern) will hear "Import" with no context, unlike every neighbouring button which has a full descriptive label.
- **Suggestion**: Add `aria-label="Import data from JSON backup file"` consistent with the other export button labels.

---

### Medium Priority (Fix when possible)

#### 3. Export progress container lacks `aria-live` region

- **Location**: `src/app/pages/Settings.tsx:678–692`, the `data-testid="export-progress"` div
- **Evidence**: The container has no `aria-live` or `role="status"` attribute. The inner `<Progress>` has `aria-label="Export progress"` but that only names the bar — it does not announce when the phase text changes dynamically.
- **Impact**: Screen reader users who activate an export get no audible feedback that the operation has started or completed. They must navigate back to the progress bar manually to check its value.
- **Suggestion**: Add `aria-live="polite" role="status"` to the `data-testid="export-progress"` container. This matches the pattern already used for the upload progress area at line 340 (which also lacks `aria-live` — that's a pre-existing gap, but worth noting).

---

#### 4. Heading hierarchy skips a level within the Data Management card

- **Location**: `src/app/pages/Settings.tsx:578, 699, 738`
- **Evidence**: The page heading tree (confirmed via DOM query) is:
  - H1: Settings
  - H2: Your Profile / Appearance
  - H3: Data Management *(card title)*
  - H3: Export Your Data *(sub-section inside Data Management)*
  - H4: Full Data Export / Notes Export / Achievements Export
  - H3: Import Data *(sub-section)*
  - H3: Danger Zone *(sub-section)*
- "Export Your Data", "Import Data", and "Danger Zone" are all sub-sections *inside* the Data Management card — they are semantically subordinate to the H3 "Data Management" heading and should be H4. Currently they sit at the same level, which breaks the outline for assistive technology users navigating by headings.
- **Impact**: Screen reader users relying on heading navigation (H key in NVDA/JAWS) see "Export Your Data" and "Data Management" as peers, which misrepresents the page structure.
- **Suggestion**: Change the three sub-section `<h3>` tags at lines 578, 699, and 738 to `<h4>` (and update their Tailwind classes accordingly — they use `text-sm font-medium` which doesn't change). The H4 item titles (Full Data Export, Notes Export, etc.) would then need to become `<h5>` or be converted to non-heading visual labels (e.g., a `<p className="font-medium">`) since five heading levels for a settings card is excessive.

---

#### 5. Full Data Export row button pair can overflow on narrow mobile viewports

- **Location**: `src/app/pages/Settings.tsx:594–618` — the `flex items-center gap-2` button group containing JSON + CSV
- **Evidence**: At 375px viewport, the JSON button extends to `right: 272px` and CSV to `right: 354px`, while the parent row's right edge is at `~303px`. The `justify-between` layout pushes buttons beyond the row's visible boundary. The `isOverflowing` flag confirmed `true` for this row.
- **Impact**: At 375px the two buttons are partially clipped by the card's internal padding, making the CSV button's text harder to read and tap accurately. This is not a full breakage (no horizontal scroll on the page) but it is a visual polish gap at the smallest supported viewport.
- **Suggestion**: On small screens, stack the description text and the button group vertically. A responsive pattern: add `flex-col sm:flex-row` to the outer row div and `self-start sm:self-center` to the button group. Alternatively, stack the two buttons vertically with `flex-col` on mobile.

---

### Nitpicks (Optional)

#### 6. "Export" button label on Notes and Achievements rows is less descriptive than needed for visual disambiguation

- **Location**: `src/app/pages/Settings.tsx:635–645, 663–673`
- **Context**: The `aria-label` attributes are correct and descriptive. This is purely a visual concern — sighted users see two buttons both labelled "Export" in proximity, relying on the row context to differentiate them. The JSON/CSV buttons use the format name as the label ("JSON", "CSV") which is more immediately scannable.
- **Suggestion**: Consider "Markdown" and "Badges" as button text to match the JSON/CSV pattern, keeping the icon for visual reinforcement.

#### 7. Progress bar phase text uses `text-center` — breaks left-alignment convention

- **Location**: `src/app/pages/Settings.tsx:688`
- **Context**: All other descriptive text in the page is left-aligned per the typography standard. The phase message (e.g., "Preparing export...") is centred below the progress bar.
- **Suggestion**: Remove `text-center` or consider whether centring is intentional for this transient status message (it may be defensible given it sits under a full-width bar).

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Section headings: `rgb(232,233,240)` on dark card bg — high contrast. Muted text `rgb(138,141,160)` on `rgb(42,43,62)` ≈ 4.8:1 — passes AA. |
| Keyboard navigation | Pass | All buttons focusable, confirmed focus lands on "Export all data as JSON" when programmatically focused. |
| Focus indicators visible | Pass | `focus-visible:ring-[3px]` applied via shared Button component on all six action buttons. |
| Heading hierarchy | Fail (Medium) | Three H3 sub-section labels inside an H3 card — should be H4. See Finding #4. |
| ARIA labels on icon buttons | Partial | 4/5 action buttons have `aria-label`. Import button missing. See Finding #2. |
| Semantic HTML | Pass | Buttons use `<button>`, icons use `aria-hidden`, no `<div onClick>` patterns detected. |
| Form labels associated | Pass | No form inputs in the export section. |
| ARIA live regions for dynamic content | Fail (Medium) | Export progress container has no `aria-live`. See Finding #3. |
| `prefers-reduced-motion` | Pass | Global `@media (prefers-reduced-motion: reduce)` in `src/styles/index.css` and `tailwind.css` covers the `animate-in` utilities used here. |
| Touch targets ≥44×44px | Fail (High) | All export/import/reset buttons are 32px tall. See Finding #1. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|-----------|--------|-------|
| Desktop (1280px) | Pass | Section width 670px within `max-w-2xl` container. All rows render with comfortable whitespace. Button group on Full Data Export row has ample horizontal space. |
| Tablet (768px) | Pass | No horizontal scroll. Rows are 588px wide. Button layout holds without wrapping. Single-button rows have 317–363px for text content — readable. |
| Mobile (375px) | Partial | No page-level horizontal scroll. However, the JSON+CSV dual-button row overflows its inner flex row bounds (buttons extend 51px beyond row right edge). Visual clipping occurs. See Finding #5. |

---

## Recommendations (Prioritised)

1. **Before merge — touch targets**: Add `min-h-[44px]` to all six export/import/reset buttons. This is a one-line change per button and is consistent with the existing `min-h-[44px]` already present on the Save Profile button.

2. **Before merge — Import aria-label**: Add `aria-label="Import data from JSON backup file"` to the Import button at line 718.

3. **Post-merge — Export progress live region**: Add `aria-live="polite" role="status"` to the `data-testid="export-progress"` div so screen readers announce the phase label when an export starts.

4. **Post-merge — Heading hierarchy**: Demote "Export Your Data", "Import Data", and "Danger Zone" from H3 to H4, and convert "Full Data Export" / "Notes Export" / "Achievements Export" / "Restore from Backup" / "Reset All Data" from H4 to `<p className="text-sm font-medium">` to keep the heading tree clean without excessive nesting.

