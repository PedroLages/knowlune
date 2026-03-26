# Design Review — E18-S10: Export Quiz Results

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e18-s10-export-quiz-results`
**Changed Files (UI-relevant)**:
- `src/app/components/reports/QuizExportCard.tsx` (new component)
- `src/app/pages/Reports.tsx` (integration)

**Affected Pages**: `/reports` (Study Analytics tab)

---

## Executive Summary

E18-S10 adds a `QuizExportCard` component to the Reports page, enabling learners to download quiz results as CSV or PDF. The implementation is structurally solid: it follows established card patterns, uses correct design tokens, and demonstrates well-considered accessibility engineering (ARIA disabled pattern, keyboard-navigable dropdown, focus restoration on Escape). Two issues require attention before merge — a pre-existing theme-level contrast failure on `variant="brand-outline"` in dark mode that this component now surfaces prominently, and a sub-44px touch target on the export button at mobile sizes.

---

## What Works Well

1. **Disabled state pattern is textbook correct.** The `<span tabIndex={0}>` wrapper around the `aria-disabled` / `pointer-events-none` button is the right solution for disabled buttons that need tooltip support (disabled elements do not fire mouse events). The inline comment explains exactly why, which is excellent for future maintainers.

2. **Keyboard navigation is complete.** Enter opens the dropdown, ArrowDown/ArrowUp navigate items, Escape closes and returns focus to the trigger — all verified live. This is Radix `DropdownMenu` doing its job, and the component wires it correctly.

3. **Visual hierarchy and page placement.** The export card sits logically between "Average Retake Frequency" and "Recent Activity" — contextually adjacent to the quiz data it exports. Card border-radius (`24px`), background, border, and 24px inter-card gap all match the surrounding cards precisely.

4. **Icon and ARIA hygiene.** The `Download` icon in both the card title and the button correctly carries `aria-hidden="true"`. `aria-haspopup="menu"` and `aria-expanded` are injected automatically by Radix — screen readers will announce "Export quiz results, collapsed, has popup menu".

5. **Clean ESLint pass.** Zero linting errors. No hardcoded colours, no inline styles, correct `@/` import aliases.

6. **Loading state implemented.** `Loader2` with `animate-spin` replaces the Download icon during export — provides immediate visual feedback for operations that may take >200ms (PDF generation).

7. **Smart summary copy.** "14 attempts across 6 quizzes" gives learners just enough context to know the export is meaningful before they trigger it — reduces anxious "will this file be empty?" uncertainty.

---

## Findings by Severity

### Blockers (Must fix before merge)

None introduced by this story. See High Priority for inherited theme issue.

### High Priority (Should fix before merge)

#### H1 — Button text contrast failure in dark mode (WCAG AA violation)

- **Location**: `src/app/components/ui/button.tsx:21` (inherited), surfaced by `QuizExportCard.tsx:95`
- **Evidence (measured live)**:
  - Button text: `rgb(96, 105, 192)` (`--brand: #6069c0` in dark mode)
  - Button background: `rgb(42, 44, 72)` (`--brand-soft: #2a2c48` in dark mode)
  - Computed contrast ratio: **2.76:1** — fails WCAG AA minimum of 4.5:1 for normal-weight text at 14px
- **Impact**: The export button label "Export As…" and the Download icon stroke are the primary way learners know this control exists. At 2.76:1 in dark mode (used by most learners in evening study sessions) the button text is visually muddy against its own background, reducing discoverability — a real barrier for learners with even mild contrast sensitivity.
- **Root cause**: `brand-outline` variant in `button.tsx` uses `text-brand` for all states. In dark mode `--brand` resolves to `#6069c0`, which does not meet 4.5:1 against `--brand-soft` (`#2a2c48`). The correct token already exists: `--brand-soft-foreground: #8b92da` passes contrast comfortably.
- **Suggestion**: Update `brand-outline` variant text to use `text-brand-soft-foreground` (which the design token cheat-sheet already identifies as the right pairing for text on `bg-brand-soft`). Scope: one line in `button.tsx:21`. This fixes the issue across all `brand-outline` usages site-wide, not just this component. Note: in light mode the current value (`--brand: #5e6ad2` on white `--card`) achieves ~5.0:1 and passes — only dark mode is affected.

#### H2 — Export button below 44px touch target on mobile

- **Location**: `src/app/components/ui/button.tsx:26` (`size="sm"` = `h-8`), used at `QuizExportCard.tsx:97`
- **Evidence (measured live at 375px viewport)**:
  - Button rendered height: **32px** (8px below the 44px minimum)
  - Button width: 127.6px (adequate)
- **Impact**: On touch devices, a 32px-tall button creates a frustrating tapping experience. Learners accessing their quiz data on a phone after a study session — a prime use case — will frequently miss the target, especially when scrolling near it.
- **Suggestion**: Use `size="touch"` (`h-11`, 44px) on mobile via a responsive class, or consider `size="default"` (`min-h-11`) consistently since the card layout accommodates the larger size. Alternatively, add `min-h-[44px]` conditionally at mobile breakpoints via `sm:h-8` + `h-11` pairing.

### Medium Priority (Fix when possible)

#### M1 — No responsive stack at mobile: text and button can get crowded

- **Location**: `QuizExportCard.tsx:87` — `flex items-center justify-between gap-4`
- **Evidence (measured live at 375px)**:
  - Card width: 327px
  - Button width: 127px — leaves 172px for the text "14 attempts across 6 quizzes"
  - `flex-direction: row`, `flex-wrap: nowrap` — no responsive fallback
- **Impact**: With longer strings (e.g., "143 attempts across 12 quizzes") the text will truncate or push the button off-screen on narrow viewports. Currently passes with the test data but is fragile.
- **Suggestion**: Add `flex-wrap: wrap` and `gap-y-3` so the text and button stack vertically on mobile: `className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"`. This keeps the desktop side-by-side layout while gracefully stacking on narrow screens.

#### M2 — Empty state card missing when no attempts: layout asymmetry between active and disabled state

- **Location**: `QuizExportCard.tsx:120–144` — disabled branch renders just a button, no descriptive text
- **Evidence**: When `hasAttempts` is false, the card body contains only the tooltip-wrapped disabled button. The active state shows "14 attempts across 6 quizzes" + button. The disabled state has no equivalent summary text.
- **Impact**: The card feels visually hollow when empty — a 136px-tall card with a single centred (left-aligned) button feels like an incomplete UI to learners encountering it for the first time.
- **Suggestion**: Add a short informational line alongside the disabled button, e.g., a `<p className="text-sm text-muted-foreground">No quiz attempts yet</p>` in the disabled branch, mirroring the active state's structure. This also gives the tooltip more context as a secondary signal.

### Nitpicks (Optional)

#### N1 — Card title icon uses `Download` in both header and button

- **Location**: `QuizExportCard.tsx:81` and `QuizExportCard.tsx:105`
- **Observation**: The same `Download` icon appears in the card `CardTitle` and inside the trigger button. On its own this is fine, but an icon like `FileDown` or `ArrowDownToLine` (both available in Lucide) in the header could distinguish the card's identity from the button's action, following the pattern set by `RotateCcw` in the adjacent retake card.

#### N2 — `ExportFormat` type is local; consider exporting for test use

- **Location**: `QuizExportCard.tsx:30`
- **Observation**: `type ExportFormat = 'csv' | 'pdf'` is only used internally. If future stories add format options this type will be duplicated. Low impact now.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast — card title | Pass | 12.45:1 (dark mode, excellent) |
| Text contrast — summary paragraph | Pass | 7.42:1 (dark mode, well above AA) |
| Text contrast — button label | FAIL | 2.76:1 in dark mode — WCAG AA requires 4.5:1 (see H1) |
| Keyboard navigation — dropdown open | Pass | Enter key opens menu correctly |
| Keyboard navigation — menu items | Pass | ArrowDown/ArrowUp navigate; Enter selects |
| Keyboard navigation — close | Pass | Escape closes menu and returns focus to trigger |
| Focus indicator visible | Pass | 3px ring via `focus-visible:ring-[3px]` box-shadow |
| Heading hierarchy | Pass | H3 within card, consistent with sibling cards |
| ARIA labels on icon buttons | Pass | `aria-label="Export quiz results"` on trigger button |
| `aria-haspopup="menu"` on trigger | Pass | Injected by Radix DropdownMenuTrigger |
| `aria-expanded` on trigger | Pass | Toggled correctly by Radix |
| `aria-disabled="true"` on disabled button | Pass | Correct pattern; `tabIndex={-1}` prevents button focus |
| Tooltip accessible on span wrapper | Pass | `tabIndex={0}` on span receives focus; tooltip fires |
| SVG icons aria-hidden | Pass | All decorative SVGs have `aria-hidden="true"` |
| Semantic HTML | Pass | `<button>` elements, no `div`-as-button antipatterns |
| Loading state announced | Partial | Spinner visible but no `aria-busy` or live region on the button — screen readers won't announce export in progress |
| prefers-reduced-motion | Pass | Parent `MotionConfig reducedMotion="user"` covers animation; no custom animations in component |
| Touch targets (44px minimum) | FAIL | Button height 32px on mobile (see H2) |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Desktop (1440px) | Pass | Card spans full content width (1296px), text and button side-by-side with good proportions |
| Tablet (768px) | Pass | Card width 720px, layout holds, no horizontal overflow |
| Mobile (375px) | Partial | No horizontal overflow, but button height 32px below 44px touch target minimum; text/button may crowd at longer copy |

---

## Code Health

| Check | Status | Notes |
|-------|--------|-------|
| ESLint | Pass | Zero errors or warnings |
| Hardcoded colours | Pass | None — uses `text-brand`, `text-muted-foreground` tokens throughout |
| Inline styles | Pass | None |
| `@/` import aliases | Pass | All imports correctly use `@/` prefix |
| TypeScript — no untyped `any` | Pass | Zero `any` usages |
| Props interfaces defined | N/A | Component takes no props (self-contained with DB access) |
| Error handling | Pass | `try/catch` with `toastError.saveFailed()` — user-visible feedback on failure |
| Async cleanup pattern | Pass | `ignore` flag in `useEffect` prevents state update on unmounted component |
| Silent `console.error` on DB load failure | Note | `loadCounts` catches and logs to console but shows no user-visible feedback. Acceptable for a count query (card will just show the empty/disabled state) but worth noting. |

---

## Recommendations

1. **Fix `brand-outline` contrast in dark mode** — one-line change to `button.tsx:21` replacing `text-brand` with `text-brand-soft-foreground`. This fixes a WCAG AA violation across the entire app, not just this component. Highest priority.

2. **Increase touch target on mobile** — use `size="touch"` or add responsive height classes to the export trigger. Mobile quiz review is a natural use pattern; the button needs to be reliably tappable.

3. **Add empty-state text to the disabled branch** — a single muted paragraph alongside the disabled button fills the visual gap and gives learners context without requiring them to hover for the tooltip.

4. **Add `aria-busy` to the button during export** — a minor addition that allows screen reader users to know an export is in progress: `aria-busy={isExporting}`. The spinner is visual-only today.

