# Web Interface Guidelines Review — E18-S04
**Story:** Verify Contrast Ratios and Touch Targets
**Date:** 2026-03-23
**Files Reviewed:**
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/components/quiz/MarkForReview.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/styles/theme.css`

---

## src/app/components/quiz/QuestionGrid.tsx

src/app/components/quiz/QuestionGrid.tsx:39 - focus ring inner edge fails WCAG 1.4.11 Non-Text Contrast in dark mode: `ring-brand` (#6069c0) against answered button fill `brand-soft` (#2a2c48) = 2.76:1 (needs 3:1). The ring-offset-background creates a 2px gap of background (#1a1b26) before the ring, but the inner edge of the ring sits directly against the brand-soft fill — that pair fails. Fix: increase dark `--brand` chroma/lightness so ring contrasts 3:1 against `--brand-soft`, or use a lighter ring token (e.g. `--brand-foreground` #ffffff) for dark mode ring when element is filled.

src/app/components/quiz/QuestionGrid.tsx:39 - `focus-visible:outline-none` suppresses the global `*:focus-visible { outline }` rule from theme.css:324. This is intentional (ring replaces outline), but it means the focus style is entirely dependent on Tailwind ring classes — ensure the ring is always present on all interactive states including when JavaScript is disabled or ring classes are purged.

## src/app/components/quiz/MarkForReview.tsx

src/app/components/quiz/MarkForReview.tsx:14 & :24 - `min-h-[44px]` applied to both container div and the label inside it. The label already provides the 44px minimum; the container duplicate is harmless but redundant — remove from line 14 or line 24 for clarity.

src/app/components/quiz/MarkForReview.tsx:24 - label uses `text-sm` (14px), which triggers the 4.5:1 WCAG AA requirement. `text-muted-foreground` (#656870) on `--background` (#faf5ee) = 5.14:1 (PASS) in light; `#b2b5c8` on `#1a1b26` = 8.41:1 (PASS) in dark. No action needed — documenting as verified pass.

## src/app/components/quiz/questions/MultipleChoiceQuestion.tsx

src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:86 - `min-h-12` = 48px touch target. PASS. (`size-11` equivalent is 44px on QuestionGrid buttons — both meet minimum.)

src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:95 - `kbd` uses `text-xs` (12px), non-bold — requires 4.5:1. `text-muted-foreground` (#656870) on `--muted` (#e9e7e4) = 4.52:1 (PASS light); dark = 6.05:1 (PASS). Marginal light pass — one token shade lighter on muted would fail. Flagging as borderline.

src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:89 - `focus-within:ring-brand` focus ring on answered (selected) options: inner edge of ring (#5e6ad2) against `bg-brand-soft` (#d0d2ee) in light mode = 3.16:1 (PASS 3:1 WCAG 1.4.11). Dark mode inner edge: #6069c0 against #2a2c48 = 2.76:1 (FAIL 3:1). Same dark-mode ring contrast issue as QuestionGrid — same root cause, same fix needed.

## src/app/components/quiz/questions/TrueFalseQuestion.tsx

src/app/components/quiz/questions/TrueFalseQuestion.tsx:84 - same dark-mode focus ring inner edge issue as MultipleChoiceQuestion.tsx:89. `ring-brand` (#6069c0) vs `bg-brand-soft` (#2a2c48) inner edge = 2.76:1 (FAIL). Same fix applies.

src/app/components/quiz/questions/TrueFalseQuestion.tsx:81 - `min-h-12` = 48px touch target. PASS.

## src/app/components/quiz/questions/MultipleSelectQuestion.tsx

src/app/components/quiz/questions/MultipleSelectQuestion.tsx:94 - same dark-mode focus ring issue. `ring-brand` inner edge vs `bg-brand-soft` = 2.76:1 (FAIL).

src/app/components/quiz/questions/MultipleSelectQuestion.tsx:91 - `min-h-12` = 48px. PASS.

src/app/components/quiz/questions/MultipleSelectQuestion.tsx:61 - "Select all that apply" uses `text-sm text-muted-foreground italic` — 14px italic is still normal-weight equivalent for WCAG purposes (only bold 14px gets large-text treatment). Contrast: 5.14:1 light, 8.41:1 dark. PASS.

## src/styles/theme.css

src/styles/theme.css:112 - `.dark` class does not include `color-scheme: dark`. Guidelines require `color-scheme: dark` on `<html>` (or `.dark`) to fix native scrollbar, form inputs, and select theming in dark mode. Add `color-scheme: dark;` inside the `.dark { }` block.

src/styles/theme.css:140 - `--brand-soft-foreground` bumped from `#8b92da` → `#a0a8eb` in dark mode. Contrast vs `--brand-soft` (#2a2c48): old = 4.65:1, new = 5.99:1. Improvement. PASS.

src/styles/theme.css:33 - light `--brand-soft-foreground: #3d46b8` on `--brand-soft: #d0d2ee` = 5.11:1 (PASS AA). Verified.

src/styles/theme.css:324–336 - global `*:focus-visible { outline: 2px solid var(--brand) }` + explicit overrides for `button`/`a`/`[role=button]`. The explicit overrides duplicate the `*` rule without adding specificity benefit — consider removing the redundant block at lines 331–336.

---

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| FAIL (WCAG 1.4.11) | 1 | Dark-mode focus ring inner edge: `ring-brand` (#6069c0) vs `bg-brand-soft` (#2a2c48) = 2.76:1 < 3:1. Affects QuestionGrid.tsx:39, MultipleChoiceQuestion.tsx:89, TrueFalseQuestion.tsx:84, MultipleSelectQuestion.tsx:94 |
| ADVISORY | 1 | `color-scheme: dark` missing in `.dark` class (theme.css:112) |
| ADVISORY | 1 | `kbd` text-xs contrast is borderline in light mode (4.52:1 — passes but has minimal margin) |
| CLEANUP | 1 | Redundant `min-h-[44px]` on both container and label in MarkForReview.tsx:14/:24 |
| PASS | — | All touch targets ≥44px, all text contrast ratios AA-compliant except noted ring issue, `motion-reduce` honored, semantic HTML correct, ARIA labels present, `aria-hidden` on decorative icons |

### Recommended Fix for Dark Focus Ring

In `src/styles/theme.css`, add a dark-mode override for the focus ring or increase `--brand` lightness in dark mode so the ring clears 3:1 against `--brand-soft`:

```css
/* Current dark brand: #6069c0 vs brand-soft #2a2c48 = 2.76:1 — fails WCAG 1.4.11 */
/* Option A: lighten dark --brand to clear 3:1 vs #2a2c48 (need ~#7480d4 or lighter) */
/* Option B: use a distinct high-contrast ring token for filled-state focus */
```

Minimum required dark `--brand` to pass 3:1 against `#2a2c48` is approximately `#7a82de` (≈3.02:1).
