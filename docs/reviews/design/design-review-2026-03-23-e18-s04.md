# Design Review Report — E18-S04: Verify Contrast Ratios and Touch Targets

**Review Date**: 2026-03-23  
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)  
**Story**: E18-S04 — Verify Contrast Ratios and Touch Targets  
**Branch**: feature/e18-s04-verify-contrast-ratios-and-touch-targets  
**Changed Files**:
- `src/app/components/quiz/QuestionGrid.tsx` — `ring-ring/50` → `ring-brand`; answered state uses `text-brand-soft-foreground`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` — `focus-within:ring-ring` → `ring-brand`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx` — `focus-within:ring-ring` → `ring-brand`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` — `focus-within:ring-ring` → `ring-brand`
- `src/app/components/quiz/MarkForReview.tsx` — added `min-h-[44px]` to label touch target
- `src/styles/theme.css` — `--brand-soft-foreground` dark value brightened (`#8b92da` → `#a0a8eb`)

**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz` (start screen, active quiz Q1–Q4, all question types)

---

## Executive Summary

E18-S04 successfully addresses the core accessibility deficiencies identified in the story: the `ring-ring/50` focus tokens that were invisible against dark backgrounds have been replaced with `ring-brand`, the `brand-soft-foreground` dark mode token has been brightened from `#8b92da` to `#a0a8eb` (+14% luminance), and the MarkForReview touch target has been expanded to 44px. The overall WCAG 2.1 AA posture of the quiz is substantially improved. Two medium-priority focus ring issues remain for the question grid buttons in dark mode, and one informational note on the MarkForReview checkbox widget itself.

---

## What Works Well

1. **Dark mode `brand-soft-foreground` fix lands correctly.** The answered-state QuestionGrid button (`text-brand-soft-foreground` on `bg-brand-soft`) now achieves **5.99:1** in dark mode — up from the pre-fix value and well above the 4.5:1 text threshold. Live measurement confirmed `rgb(160, 168, 235)` on `rgb(42, 44, 72)`.

2. **All question option labels are generously sized.** Multiple-choice, true-false, and multiple-select labels render at **62px tall** (`min-h-12` + padding) at all viewports — 41% above the 44px minimum touch target. Keyboard shortcut `<kbd>` elements are decorative (`aria-hidden`) and do not create focus traps.

3. **No horizontal scroll at any tested viewport.** Mobile (375px): `scrollWidth=364 < clientWidth=375`. Tablet (768px): `scrollWidth=757 < clientWidth=768`. Desktop (1440px): clean layout.

4. **Semantic structure is solid.** `<fieldset aria-labelledby>` wraps every question type (no `<legend>` needed since `aria-labelledby` is used), all buttons have accessible names, live regions are present (`aria-live="polite"` for character count on fill-in-blank), no `<div onClick>` anti-patterns, no images missing alt text within the quiz.

5. **Console is clean.** Zero errors; one pre-existing unrelated warning (`apple-mobile-web-app-capable` deprecated meta tag).

6. **Light mode contrast is excellent across the board.** Foreground on card: 16.67:1. Muted foreground on card: 5.57:1. Brand button (white on brand): 4.70:1. All text pairs clear 4.5:1 comfortably.

---

## Findings by Severity

### High Priority (Should fix before merge)

#### H1: Focus ring on dark-mode answered QuestionGrid button — borderline pass

**Issue**: When a QuestionGrid button transitions to the answered state (`bg-brand-soft` = `#2a2c48`), the focus ring uses `ring-brand` (`#6069c0`) with `ring-offset-2` in card background (`#242536`). The ring-offset gap (`#242536`) vs the answered button background (`#2a2c48`) yields **1.11:1** — these two are nearly indistinguishable to the eye. While the brand ring itself is visible against the gap (3.07:1 ring vs gap, passes), the boundary between the button and the ring-offset gap is invisible, making the focus halo hard to perceive for low-vision users.

**Location**: `src/app/components/quiz/QuestionGrid.tsx` line 39 — `focus-visible:ring-brand focus-visible:ring-offset-2`

**Evidence (live measurement)**:
```
ring-offset gap (#242536) vs answered btn bg (#2a2c48): 1.11:1  [FAIL — < 3:1]
brand ring (#6069c0) vs ring-offset gap (#242536): 3.07:1        [PASS]
brand ring (#6069c0) vs answered btn bg (#2a2c48): 2.76:1        [FAIL — < 3:1]
```

**Impact**: A learner who relies on keyboard navigation and has reached Q1 (answered, navigated away) cannot reliably perceive the focus ring when tabbing back to that grid button. This undermines the purpose of the E18-S04 fix for keyboard users in dark mode.

**Suggestion**: Use `ring-offset-background` explicitly set to the page background rather than the card, or switch to a `ring-offset-4` with a contrasting offset color, or use a different focus indicator technique (e.g., `outline` with `outline-offset`) that establishes clearer separation. A white or very light offset color would create a strong 13:1+ boundary against the dark answered state background.

---

### Medium Priority (Fix when possible)

#### M1: Focus ring on dark-mode current/active QuestionGrid button — 1:1 ring-to-button contrast

**Issue**: When a QuestionGrid button is in the current/active state (`bg-brand` = `#6069c0`), the focus ring color is also brand (`#6069c0`). The ring itself is invisible against the button background — **1:1 contrast**. The ring-offset gap (card = `#242536`) separates them with 3.07:1, so the halo is technically perceivable via the gap contrast, but the 2px ring band appears to merge with the button surface.

**Location**: `src/app/components/quiz/QuestionGrid.tsx` line 39

**Evidence (live measurement)**:
```
brand ring (#6069c0) vs current btn bg (#6069c0): 1.00:1   [ring invisible against button]
ring-offset gap (#242536) vs brand ring (#6069c0): 3.07:1  [gap creates separation — barely passes]
```

**Impact**: A keyboard user on the currently-active question may not see any visual focus change on the grid button. Since `aria-current="step"` is set, screen readers handle it, but sighted keyboard users lose the visual cue.

**Suggestion**: Consider a `ring-offset-white` or `ring-2 ring-white` approach on the current state specifically, or use `outline` with a contrasting color (e.g., white or `--brand-foreground`) to ensure the indicator is visible against the brand-colored button background.

---

#### M2: MarkForReview checkbox widget itself is 16x16px (below 44px)

**Issue**: The `<Checkbox>` element within MarkForReview renders at 16x16px. While the associated `<Label>` is 44px tall and correctly wired via `htmlFor`/`id`, the checkbox widget itself is positioned 14px above the label top (`checkbox.top=761, label.top=747`). A user tapping precisely on the visible checkbox indicator — rather than the label text — hits a 16x16px target.

**Location**: `src/app/components/quiz/MarkForReview.tsx` lines 15–24

**Evidence (live measurement at 375px)**:
```
Checkbox element: 16x16px  (top=761, left=40)
Label element:    126x44px (top=747, left=64)
Container div:    284x44px min-h-[44px]
```

**Impact**: This is a partial improvement from E18-S04 (the label and container now have `min-h-[44px]`). The fix works correctly for users tapping the "Mark for Review" text. However, a user who precisely targets the visual checkbox box itself — which is the conventional tap area for checkbox UI — encounters a 16x16 target. This is a marginal case but worth noting for completeness.

**Suggestion**: Add `p-3` or equivalent padding to the `<Checkbox>` component usage in MarkForReview, or increase the Checkbox component's hit area via `size-11` wrapper, to match the 44px label height. Alternatively, document that the label is the intended touch target and this pattern is acceptable (it is a common web pattern).

---

#### M3: Light-mode focus ring on page background is 4.33:1 (below 4.5:1 text threshold, but passes 3:1 non-text)

**Issue**: The brand focus ring (`#5e6ad2`) against the warm off-white page background (`#faf5ee`) yields **4.33:1**. This is below the 4.5:1 threshold for normal text but above the 3:1 required for non-text UI components (which focus indicators fall under per WCAG 2.1 SC 1.4.11).

**Location**: `src/styles/theme.css` — `--brand: #5e6ad2` in `:root`

**Evidence (computed)**:
```
brand ring (#5e6ad2) vs page bg (#faf5ee): 4.33:1
Required for non-text UI indicator: ≥3:1       [PASS]
Required for text: ≥4.5:1                      [N/A — this is a focus ring, not text]
```

**Impact**: Technically passes WCAG 2.1 AA. Noted for awareness as it sits closer to the threshold than ideal. No action required.

---

### Nitpicks

#### N1: `ring-offset` color differs between question label focus rings

In dark mode, the label `focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2` produces a **white** ring-offset (`rgb(255,255,255)`), not the card background color. This likely comes from the `ring-offset-background` CSS variable resolving differently within the label context. The white offset creates a very visible 15:1 gap against the dark card — which is visually strong — but it creates an unexpected bright flash on dark backgrounds that may feel out-of-place in the dark theme. This is cosmetic only and does not affect accessibility.

**Location**: All three question components at `focus-within:ring-offset-2` on `<label>` elements.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Lowest measured: muted-fg on card 5.57:1 |
| Text contrast ≥4.5:1 (dark mode) | Pass | Lowest measured: muted-fg on card 6.05:1; brand-soft-fg on brand-soft 5.99:1 |
| Non-text UI ≥3:1 (light mode) | Pass | Brand-soft-fg on brand-soft 5.11:1 |
| Non-text UI ≥3:1 (dark mode) | Pass | All active/unanswered grid states pass; answered state borderline (see H1) |
| Keyboard navigation — tab order | Pass | Logical: grid buttons → question area → mark-for-review → nav buttons |
| Focus indicators visible | Partial | Dark mode answered grid button: ring-to-button boundary 1.11:1 (see H1) |
| Focus indicator ≥2px thick | Pass | 2px Tailwind ring confirmed via computed box-shadow |
| Focus indicator ≥3:1 contrast | Partial | Ring vs gap 3.07:1 passes; ring vs answered bg 2.76:1 fails (see H1) |
| Heading hierarchy | Pass | Single H1 "Accessibility Standards Quiz", no skipped levels |
| ARIA labels on icon buttons | Pass | All grid buttons have `aria-label="Question N"`, no unnamed buttons found |
| Semantic HTML | Pass | `<fieldset aria-labelledby>`, `<label htmlFor>`, `<button>` (no div-buttons) |
| Form labels associated | Pass | All inputs have label associations; fill-in-blank input has ARIA label via fieldset |
| ARIA live regions | Pass | `aria-live="polite"` on character counter; timer uses live region |
| prefers-reduced-motion | Pass | `motion-reduce:transition-none` applied to all option labels |
| Touch targets ≥44px (mobile) | Pass | All key elements meet threshold; checkbox label pattern is correct |
| No horizontal scroll (mobile) | Pass | scrollWidth < clientWidth at 375px and 768px |
| Bottom nav on mobile | Pass | `navigation "Mobile navigation"` replaces sidebar at 375px |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass. Bottom tab navigation. No horizontal scroll (`scrollWidth=364`). Grid buttons 44x44, option labels 62px, nav buttons 44px, MarkForReview label 44px. Quiz card fills available width correctly.
- **Tablet (768px)**: Pass. Quiz renders in single-column layout with full-width card. No horizontal scroll (`scrollWidth=757`). All touch targets maintained. Sidebar not present (quiz is immersive focus mode — this is correct behavior).
- **Desktop (1440px)**: Pass. Quiz card constrained to `max-w-2xl` centered. Question options at full 608px width. Question grid and navigation well-spaced. Card uses `rounded-[24px]` consistent with design system.

---

## Contrast Ratio Summary Table

### Dark Mode (live measurements)

| Element | Foreground | Background | Ratio | Pass |
|---------|-----------|------------|-------|------|
| Question text (H1 + question-text) | `#e8e9f0` | `#242536` (card) | 12.45:1 | Yes |
| Option label text | `#e8e9f0` | `#242536` (card) | 12.45:1 | Yes |
| Muted text (hint "Select all that apply") | `#b2b5c8` | `#242536` (card) | 7.42:1 | Yes |
| Kbd shortcut | `#b2b5c8` | `#32334a` (muted) | 6.05:1 | Yes |
| Mark for Review label | `#b2b5c8` | `#242536` (card) | 7.42:1 | Yes |
| Grid btn — unanswered | `#b2b5c8` | `#242536` (card) | 7.42:1 | Yes |
| Grid btn — answered (E18-S04 fix) | `#a0a8eb` | `#2a2c48` (brand-soft) | **5.99:1** | Yes |
| Grid btn — current/active | `#ffffff` | `#6069c0` (brand) | 4.91:1 | Yes |
| Start Quiz button | `#ffffff` | `#6069c0` (brand) | 4.91:1 | Yes |
| "4 questions" badge (brand-soft) | `#a0a8eb` | `#2a2c48` | **5.99:1** | Yes |
| "Untimed" badge (muted) | `#b2b5c8` | `#32334a` | 6.05:1 | Yes |

### Light Mode (computed from theme tokens)

| Element | Foreground | Background | Ratio | Pass |
|---------|-----------|------------|-------|------|
| Question text | `#1c1d2b` | `#ffffff` (card) | 16.67:1 | Yes |
| Muted text | `#656870` | `#ffffff` (card) | 5.57:1 | Yes |
| Muted text on page bg | `#656870` | `#faf5ee` | 5.14:1 | Yes |
| Brand button (white text) | `#ffffff` | `#5e6ad2` (brand) | 4.70:1 | Yes |
| Grid btn — answered | `#3d46b8` | `#d0d2ee` (brand-soft) | **5.11:1** | Yes |
| Grid btn — current | `#ffffff` | `#5e6ad2` (brand) | 4.70:1 | Yes |
| Focus ring vs page bg | `#5e6ad2` | `#faf5ee` | 4.33:1 | Yes (non-text ≥3:1) |
| Focus ring vs brand-soft (answered) | `#5e6ad2` | `#d0d2ee` | 3.16:1 | Yes (non-text ≥3:1) |
| Warning border on card | `#866224` | `#ffffff` | 5.55:1 | Yes |
| Success on success-soft | `#3a7553` | `#eef5f0` | 4.92:1 | Yes |

---

## Recommendations

1. **Address dark-mode focus ring on answered QuestionGrid button (H1).** The 1.11:1 gap between the ring-offset and the answered button background means the focus halo effectively starts and ends in identical darkness. The fix in E18-S04 correctly switched from `ring-ring/50` to `ring-brand`, but the ring-offset color needs to be more distinct from `bg-brand-soft`. Consider `ring-offset-background` (page bg `#1a1b26`) rather than card bg, which would give the gap a 3.48:1 contrast against the ring.

2. **Differentiate focus indicator on current grid button in dark mode (M1).** When a learner is on Q2 and tabs to the Q2 grid button, the brand ring against the brand background is 1:1. Adding a `ring-white` or `ring-offset-4` variant specifically for the `isCurrent` state would resolve this without affecting other states.

3. **Document the MarkForReview checkbox touch target pattern (M2).** The `htmlFor`/`id` wiring is correct and the label is the intended touch target. Consider adding a code comment explaining this pattern, and optionally adding `p-2` to the Checkbox element to extend its visual hit area slightly for precision tappers.

4. **The `brand-soft-foreground` dark mode brightening (`#8b92da` → `#a0a8eb`) is correct and well-measured.** The 5.99:1 ratio in dark mode and 5.11:1 in light mode for the answered state are the highest-priority fixes in this story and are fully working. No further action needed on this token.
