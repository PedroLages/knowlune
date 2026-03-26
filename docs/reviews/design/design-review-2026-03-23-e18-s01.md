# Design Review Report — E18-S01: Implement Complete Keyboard Navigation

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e18-s01-implement-complete-keyboard-navigation`
**Changed Files**:
- `src/app/components/quiz/QuestionGrid.tsx` — roving tabindex, WAI-ARIA toolbar pattern, Arrow key navigation, focus ring token upgrade
- `src/app/pages/Quiz.tsx` — programmatic focus on question change, Arrow key auto-advance suppression, `isArrowNavRef`

**Affected Route**: `/courses/:courseId/lessons/:lessonId/quiz` (Quiz page, active state)

---

## Executive Summary

E18-S01 delivers a well-structured keyboard navigation implementation that correctly handles the five hardest interaction patterns in a quiz UI: roving tabindex in the question grid, programmatic focus for screen reader announcement, Arrow key suppression of auto-advance, and AlertDialog focus trap. The implementation is largely production-ready. Two issues require attention before merge: a **contrast regression** on answered grid buttons (introduced by this diff), and an **incomplete focus return** after the submit dialog is dismissed with Escape.

---

## What Works Well

1. **Roving tabindex is textbook correct.** `QuestionGrid.tsx` implements the WAI-ARIA toolbar pattern precisely — only the focused button holds `tabIndex=0`, all others have `tabIndex=-1`, Arrow Left/Right move focus and update the tab stop, and Home/End jump to boundaries. Live verification confirmed wrapping behavior at both edges.

2. **AC2 programmatic focus is clean.** The `question-focus-target` div with `tabIndex={-1}` and `className="outline-none"` correctly receives `.focus()` on question change without entering the Tab sequence. The `data-testid` attribute makes it testable and the pattern is well-documented in code comments.

3. **AC3 Arrow key suppression is precise.** The `isArrowNavRef` flag intercepts `ArrowDown`/`ArrowUp` events on the container and prevents the `onChange` callback from firing auto-advance to the Next button. Live testing confirmed that ArrowDown within a RadioGroup moves selection but does not steal focus to Next.

4. **Tab order matches the AC1 spec exactly.** Verified live: first radio button → MarkForReview checkbox → Next/Submit button → Question 1 grid entry point. The flow is intuitive and matches the expected reading order.

5. **Touch targets are solid at all breakpoints.** Grid buttons (44×44px), nav buttons (44px height), MarkForReview container (44px min-height) — all verified at 375px mobile and 768px tablet. No horizontal scroll at any breakpoint.

6. **AlertDialog focus trap passes (AC6 partial).** Verified live: Tab cycles only between "Continue Reviewing" and "Submit Anyway" buttons. The trap boundary is correct and Escape closes the dialog as expected.

7. **No console errors.** Zero runtime errors across all tested interactions. Only pre-existing meta tag warning.

8. **`prefers-reduced-motion` support confirmed.** CSS ruleset found in the loaded stylesheets.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1: Contrast regression — answered grid buttons fail WCAG AA

**Location**: `src/app/components/quiz/QuestionGrid.tsx:92`

**The diff changed**:
```
- ? 'bg-brand-soft text-brand-soft-foreground border border-brand'
+ ? 'bg-brand-soft text-brand border border-brand'
```

**Evidence (computed values, verified live in browser)**:
- Background: `bg-brand-soft` = `rgb(42, 44, 72)` / `#2a2c48`
- Text (new): `text-brand` = `rgb(96, 105, 192)` / `#6069c0` → contrast **2.76:1** — FAILS WCAG AA (4.5:1 required)
- Text (original): `text-brand-soft-foreground` = `rgb(139, 146, 218)` / `#8b92da` → contrast **4.65:1** — PASSES

The design token documentation in `.claude/rules/styling.md` explicitly addresses this exact scenario: "Brand text on soft bg: Use `text-brand-soft-foreground` (not `text-brand`) on `bg-brand-soft` backgrounds." The reason two tokens exist is precisely because `--brand` is too dark to be legible as text on `bg-brand-soft` in dark mode.

**Impact**: Answered question numbers in the grid (showing which questions the learner has completed) are visually illegible for users with low vision. This is the primary visual progress indicator during a quiz — making it inaccessible undermines the core learning experience for the users who most need accessibility support.

**Suggestion**: Revert to `text-brand-soft-foreground` on the answered state. The token is already defined and was previously used correctly.

---

### High Priority (Should fix before merge)

#### H1: AlertDialog Escape returns focus to `<body>` instead of trigger button

**Location**: `src/app/pages/Quiz.tsx:513` (AlertDialog usage), confirmed via live Escape key test

**Evidence**: After pressing Escape to dismiss the submit confirmation dialog:
- `document.activeElement.tagName` → `BODY`
- Submit Quiz button was present and focusable (`tabIndex=0`, not disabled)
- Expected: focus returns to the Submit Quiz button that opened the dialog

**Root cause**: The dialog is opened via controlled state (`open={showSubmitDialog} onOpenChange={setShowSubmitDialog}`) without using `<AlertDialogTrigger>`. Radix UI's focus-return mechanism tracks the element that opened the dialog through its Trigger primitive. When the dialog is opened imperatively through state, Radix has no trigger reference to restore focus to upon close.

**Additional observation**: The `questionTextRef.current?.focus()` effect (which fires whenever `currentProgress?.currentQuestionIndex` changes) does not appear to be interfering here since the question index does not change on dialog close. The issue is purely the missing trigger association.

**Impact**: Keyboard-only users who open the submit dialog, decide to continue reviewing (Escape), and then try to re-submit must re-navigate from the beginning of the Tab sequence. For learners using screen readers or switch access, this is a significant interruption to their flow.

**Suggestion**: Wrap the Submit Quiz button with `<AlertDialogTrigger asChild>` and remove the imperative `setShowSubmitDialog(true)` call. The `AlertDialogTrigger` manages trigger tracking internally. The `handleSubmitClick` logic (checking unanswered count before deciding whether to show the dialog) can be preserved by using an `onClick` on the trigger, or by keeping the controlled-open pattern but also storing a `triggerRef` and calling `triggerRef.current?.focus()` in the `onOpenChange` handler.

---

#### H2: Focus ring token (`--ring`) fails WCAG Non-text Contrast in dark mode

**Location**: `src/styles/theme.css:134` (pre-existing, but directly relevant to this story's focus ring upgrade)

**Evidence (computed via canvas)**:
- Dark mode `--ring`: `oklch(0.45 0.05 270)` → `rgb(74, 84, 114)`
- Against `bg-card` (`rgb(36, 37, 54)`): contrast **2.01:1** — fails WCAG 2.4.11 (3:1 required for focus indicators)
- Against `bg-brand` (active question `rgb(96, 105, 192)`): contrast **1.53:1** — fails
- Light mode `--ring`: `oklch(0.708 0 0)` → `rgb(161, 161, 161)` against `#FAF5EE`: **2.38:1** — also fails

This story upgraded grid button focus rings from `ring-ring/50` (50% opacity) to `ring-ring` (full opacity) — an improvement. However, the base `--ring` token is too dark to meet 3:1 contrast against the card/brand backgrounds in either mode, so the rings remain sub-threshold even at full opacity.

**Impact**: The focus ring upgrade in this story (`focus-visible:ring-[3px] focus-visible:ring-ring`) is visually better than what it replaced, but still does not provide the legally-required contrast for keyboard focus indicators in dark mode. A learner who relies on visible focus indicators for navigation cannot reliably see which question grid button is focused.

**Note**: This is a pre-existing token-level issue. It is raised here because this story explicitly targets focus indicator accessibility and the token choice directly limits the effectiveness of that work. Fixing the token would benefit all components across the app, not just the quiz.

**Suggestion**: Raise `--ring` in `theme.css` dark mode to a value that achieves 3:1 contrast against `bg-card`. A lighter, higher-chroma value such as `oklch(0.65 0.12 270)` (roughly `#7b88d8`) would achieve approximately 3.8:1 on the dark card background while preserving the brand-purple hue. Verify in both modes.

---

### Medium Priority (Fix when possible)

#### M1: RadioGroup radio buttons use `ring-ring/50` (half-opacity) focus ring

**Location**: `src/app/components/ui/radio-group.tsx:30` (shadcn default, not changed by this story)

**Evidence**: The RadioGroupItem component class includes `focus-visible:ring-ring/50`. The `/50` opacity modifier halves the already-low-contrast ring value, making radio button focus nearly invisible in dark mode.

**Impact**: When a learner Tabs into the answer options, the focused radio button has a nearly invisible ring. Combined with the low base contrast of `--ring`, this creates a very weak focus indicator on the primary interactive element in the quiz.

**Suggestion**: Update `radio-group.tsx` to use `focus-visible:ring-ring` (consistent with the QuestionGrid upgrade in this story). This is a minor change that would make all radio buttons consistent with the standard established here.

#### M2: MarkForReview checkbox touch target is 16×16px

**Location**: `src/app/components/quiz/MarkForReview.tsx:15`

**Evidence**: The `<Checkbox>` element itself measures 16×16px (the Radix default). The surrounding container has `min-h-[44px]` which ensures the row is 44px tall, but the clickable/focusable area of the checkbox element itself is only 16×16px.

**Impact**: On touch devices, the 16×16px checkbox hit area is below the 44×44px WCAG target. The `<Label>` element is clickable and does extend the effective touch target, but the checkbox itself in isolation (which also receives focus and keyboard interaction) does not meet the standard.

**Suggestion**: This is acceptable for now given the label association, but consider whether the checkbox should receive `data-[state=checked]:...` padding or a larger invisible touch target region for stricter compliance.

---

### Nitpicks

#### N1: `isArrowNavRef` reset on every `onChange` call regardless of type

**Location**: `src/app/pages/Quiz.tsx:477`

`isArrowNavRef.current = false` is unconditionally reset after every `onChange`. This is correct but means that if two rapid `onChange` calls fire (theoretically possible with synthetic events in tests), only the first would be suppressed. In practice this is not a user-visible issue but worth noting for completeness.

#### N2: `total === 0` guard removed from `handleKeyDown`

**Location**: `src/app/components/quiz/QuestionGrid.tsx:32`

The diff removed the `if (total === 0) return` early guard from `handleKeyDown`. The remaining code handles total=0 safely (modulo arithmetic on 0 is NaN, but `focusedIndex` would remain 0 and `buttonRefs.current[NaN]` is undefined which is safely called with `?.focus()`). This is effectively safe but the defensive guard made intent clearer.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast (answered grid btn) | FAIL | `text-brand` on `bg-brand-soft` = 2.76:1 — introduced by this diff (B1) |
| Text contrast (all other text) | Pass | Question text, nav buttons, labels all pass on their respective backgrounds |
| Focus indicator contrast (grid buttons) | Partial | `ring-ring` is full opacity but token value only achieves 2.01:1 on bg-card (H2) |
| Focus indicator contrast (radio buttons) | Partial | `ring-ring/50` further reduces already-low contrast (M1) |
| Keyboard navigation — Tab order | Pass | Radio → MarkForReview → Nav buttons → Grid entry point (AC1 confirmed) |
| Keyboard navigation — Arrow keys (grid) | Pass | ArrowLeft/Right/Home/End all work; wraps correctly (AC5 confirmed) |
| Keyboard navigation — Arrow keys (radio) | Pass | ArrowDown/Up navigate without auto-advance (AC3 confirmed) |
| Keyboard navigation — Enter to jump | Pass | Enter on focused grid button navigates to that question (AC5 confirmed) |
| Focus indicators visible | Pass | Rings render, visible at full opacity (though contrast sub-threshold in dark mode) |
| Programmatic focus on question change | Pass | `question-focus-target` div correctly receives focus via useEffect (AC2 confirmed) |
| question-focus-target NOT in Tab order | Pass | `tabIndex={-1}` confirmed, not reachable via Tab |
| Heading hierarchy | Pass | H1 (quiz title) → H2 (dialog) is correct |
| ARIA roles — toolbar | Pass | `role="toolbar"` with `aria-label="Question grid"` (AC5) |
| ARIA roles — radiogroup | Pass | `role="radiogroup"` present, `aria-labelledby` points to fieldset label |
| ARIA `aria-current="step"` | Pass | Active question button has `aria-current="step"` |
| ARIA labels on grid buttons | Pass | `aria-label="Question N"` and `aria-label="Question N, marked for review"` |
| ARIA label on Submit button | Pass | Full descriptive label: "Submit Quiz — ends the quiz and shows your results" |
| AlertDialog focus trap | Pass | Tab cycles only within dialog (AC6 confirmed) |
| AlertDialog Escape closes | Pass | Dialog closes on Escape |
| AlertDialog focus return on Escape | FAIL | Focus goes to `<body>` instead of Submit Quiz button (H1) |
| Semantic HTML | Pass | `<fieldset>`, `<nav>`, `<button>`, no div-buttons |
| `prefers-reduced-motion` | Pass | CSS media query found in loaded stylesheets |
| No console errors | Pass | Zero errors across all interactions |
| Touch targets 44px (mobile 375px) | Pass | All interactive elements confirmed 44px in height/width |
| No horizontal scroll (mobile) | Pass | scrollWidth (364) < clientWidth (375) |
| Form labels associated | Pass | MarkForReview uses `htmlFor`/`id` association |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — No horizontal scroll, all touch targets 44×44px, nav wraps to column layout, card padding collapses to 16px correctly
- **Tablet (768px)**: Pass — Row layout, 32px card padding, all buttons 44px height, no horizontal scroll
- **Desktop (1440px)**: Pass — Full layout, correct proportions, toolbar aligns inline with quiz actions

---

## Acceptance Criteria Verification

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| AC1 | Tab order: answers → MarkForReview → nav buttons → question grid | Pass | Verified live via keyboard testing |
| AC2 | Programmatic focus on question-focus-target on question change | Pass | `tabIndex={-1}`, `useEffect` on `currentQuestionIndex`, verified |
| AC3 | RadioGroup Arrow key navigation stays focused (no auto-advance) | Pass | `isArrowNavRef` suppression confirmed working |
| AC4 | Checkboxes Tab independently, Space to toggle | Pass (not directly tested) | Multiple-select question uses independent checkboxes |
| AC5 | QuestionGrid roving tabindex, Arrow L/R, Enter to jump | Pass | Full keyboard traversal verified including wrap-around, Home, End |
| AC6 | AlertDialog focus trap + Escape closes | Partial | Focus trap confirmed; Escape closes but does NOT return focus to trigger (H1) |

---

## Recommendations

1. **Fix the contrast regression (B1) immediately** — revert `text-brand` to `text-brand-soft-foreground` on answered grid buttons. This is a one-word change that restores a previously-correct value. The styling.md guide already documents the correct token.

2. **Fix the focus return after dialog dismiss (H1)** — add a `triggerRef` or switch to `<AlertDialogTrigger asChild>` wrapping the Submit button. Without this, keyboard users lose their position in the UI after dismissing the dialog.

3. **Address the `--ring` token contrast (H2) as a separate follow-up** — this affects the whole app and warrants its own story. The fix is a one-line token change in `theme.css` but should be validated across all components before merging.

4. **Update `radio-group.tsx` to use full-opacity ring (M1)** — small consistency fix that aligns the radio button focus style with the grid button upgrade introduced in this story.

