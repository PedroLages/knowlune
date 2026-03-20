# Design Review Report — E13-S02: Mark Questions for Review

**Review Date**: 2026-03-20
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E13-S02 — Mark Questions for Review
**Changed Files**:
- `src/app/components/quiz/MarkForReview.tsx` (new)
- `src/app/components/quiz/ReviewSummary.tsx` (new)
- `src/app/components/quiz/QuestionGrid.tsx` (modified — review indicators)
- `src/app/components/quiz/QuizActions.tsx` (modified — aria-label)
- `src/app/components/quiz/QuizNavigation.tsx` (modified — passes markedForReview)
- `src/app/pages/Quiz.tsx` (modified — integrates MarkForReview + ReviewSummary)

**Affected Routes**: `/courses/:courseId/lessons/:lessonId/quiz`
**Test Viewports**: 1440px (desktop), 640px (tablet), 375px (mobile)

---

## Executive Summary

E13-S02 adds a bookmark-based "Mark for Review" workflow to the quiz experience: a checkbox below each question, bookmark icons on the question grid, and a ReviewSummary with jump links in the submit confirmation dialog. The overall interaction model is well-conceived and the component structure is clean. Two issues require resolution before merge: a WCAG contrast failure on the Submit Quiz button in dark mode (2.91:1 vs the 4.5:1 requirement), and a missing accessible name on the Radix Checkbox that leaves screen readers without a meaningful label for the control.

---

## What Works Well

- **Interaction model is learner-friendly.** The bookmark icon appearing on the question grid immediately after marking is responsive and reassuring — learners get clear visual confirmation that their mark was recorded without leaving the question.
- **QuestionGrid touch targets pass everywhere.** All question grid buttons measure exactly 44x44px at every tested viewport, satisfying the WCAG 2.5.5 minimum.
- **ReviewSummary placement is contextually appropriate.** Surfacing marked questions inside the submit confirmation dialog — precisely when a learner is deciding whether to submit — is the right moment. It provides a low-friction escape hatch back to those questions.
- **Dynamic aria-label on Submit Quiz button.** Switching the label to `"Submitting quiz…"` during the submitting state keeps screen reader users informed without relying on visual change alone. This is a well-considered detail.
- **No horizontal scroll at any breakpoint.** Tested at 375px, 640px, and 1440px — no overflow.
- **No console errors.** The page is clean at runtime.
- **QuizNavigation responsive stacking.** `flex-col` at mobile / `sm:flex-row` at tablet and above is correct and verified.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Submit Quiz button contrast fails WCAG AA in dark mode**

In dark mode, the Submit Quiz button renders white text (`rgb(255, 255, 255)`) on a medium-blue background (`rgb(139, 146, 218)`), yielding a contrast ratio of **2.91:1** — below the WCAG AA minimum of 4.5:1 for normal-weight text.

- **Location**: `src/app/components/quiz/QuizActions.tsx:42`
- **Evidence**: `submitTextColor: "rgb(255, 255, 255)"`, `submitBgColor: "rgb(139, 146, 218)"`, `submitContrast: "2.91"` (computed live)
- **Root cause**: The button uses manual class composition (`bg-brand text-brand-foreground hover:bg-brand-hover`) instead of `variant="brand"`. The `brand-foreground` token resolves to white in dark mode, but the `bg-brand` dark-mode hue is too light for white text to pass contrast.
- **Impact**: Learners with low vision who use dark mode cannot reliably read the most consequential action button on the quiz — the one that ends their attempt and locks in their score.
- **Suggestion**: Replace the manual color classes with `variant="brand"` per the project's brand button variant system (see `styling.md`). The variant already handles correct dark/light foreground pairing. If a custom overrideis truly needed, verify the resulting contrast with the computed values before shipping.

```tsx
// Before
<Button
  className="bg-brand text-brand-foreground hover:bg-brand-hover rounded-xl min-h-[44px]"
  ...
>

// After
<Button
  variant="brand"
  className="rounded-xl min-h-[44px]"
  ...
>
```

---

**B2 — MarkForReview checkbox has no accessible name for screen readers**

The Radix UI `Checkbox` component renders as `role="checkbox" type="button"`. The native `<label htmlFor={id}>` association provides click-forwarding behavior and visual association, but because this is a button element (not `<input>`), the `htmlFor` link does not supply an accessible name. The checkbox also uses `aria-describedby` pointing to the label element, which makes the label text a *supplementary description* rather than the *primary name*. Screen readers announce the control without a name.

- **Location**: `src/app/components/quiz/MarkForReview.tsx:15-20`
- **Evidence**: Live DOM shows `aria-label: null`, `aria-labelledby: null`, `aria-describedby: "mark-review-q3-label"` on the checkbox button. Accessibility snapshot shows `checkbox ""` (empty name).
- **Impact**: Screen reader users (NVDA, VoiceOver) hear "checkbox, unchecked" with no indication of what is being marked for review. This is a WCAG 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value) failure.
- **Suggestion**: Replace `aria-describedby` with `aria-labelledby` on the `Checkbox` component. The label element already has the correct `id`. Alternatively, add an explicit `aria-label="Mark for Review"` directly on the Checkbox.

```tsx
// Before
<Checkbox
  id={id}
  checked={isMarked}
  onCheckedChange={onToggle}
  aria-describedby={`${id}-label`}
/>
<Label id={`${id}-label`} htmlFor={id} ...>

// After (option A — labelledby)
<Checkbox
  id={id}
  checked={isMarked}
  onCheckedChange={onToggle}
  aria-labelledby={`${id}-label`}
/>

// After (option B — explicit label)
<Checkbox
  id={id}
  checked={isMarked}
  onCheckedChange={onToggle}
  aria-label="Mark for Review"
/>
```

---

### High Priority (Should fix before merge)

**H1 — MarkForReview touch target row is 20px tall on mobile**

The MarkForReview checkbox+label row has a computed height of 20px at 375px viewport. While the label text is clickable, 20px is less than half the 44px minimum touch target height recommended by WCAG 2.5.5 and the design system. The checkbox itself is 16x16px.

- **Location**: `src/app/components/quiz/MarkForReview.tsx:14` (`div` container, `mt-4`)
- **Evidence**: `markRowHeight: 20` at 375px viewport (measured live). Checkbox reports 16x16px.
- **Impact**: On touch devices, learners are likely to miss the tap target, especially when moving quickly through a quiz. A misfire could accidentally mark or unmark a question without the learner noticing.
- **Suggestion**: Add `min-h-[44px]` to the container `div` and use `items-center` (already present) to vertically center. This gives the full row a proper touch target without changing the visual appearance on desktop:

```tsx
<div className="flex items-center gap-2 mt-4 min-h-[44px]">
```

---

**H2 — Bookmark indicator renders as outline-only stroke, not filled**

The bookmark icon in the QuestionGrid uses `fill-warning text-warning` on the Lucide `Bookmark` SVG element. However, the Bookmark icon's internal `<path>` has an explicit `fill="none"` attribute that takes precedence over the Tailwind `fill-warning` class applied to the SVG container. The computed `fill` on the path is `none` — the icon renders as a thin amber outline stroke at `size-3` (12px).

- **Location**: `src/app/components/quiz/QuestionGrid.tsx:51`
- **Evidence**: `pathFills: [{ fill: null, computedFill: "none" }]` — the path inherits `none` not the warning fill token. The icon `svgColor` is `rgb(218, 168, 96)` (stroke only).
- **Impact**: A 12px outlined bookmark on a 44px circle button is very small. At a glance during a timed quiz, the indicator may not be salient enough — learners might miss that a question is marked. The design intent (yellow warning indicator) is only partially achieved.
- **Suggestion**: Use `BookmarkCheck` or ensure the Bookmark icon is explicitly filled. Lucide's `Bookmark` filled variant requires the `fill` attribute on the path, which Tailwind's `fill-*` utilities do not override when the SVG child has an explicit `fill="none"`. The most reliable fix is to use the filled variant via inline style, or switch to `BookmarkCheck` which has a visible filled state. Alternatively, wrap the icon in a small badge `span` with a solid `bg-warning` background so the indicator is visible regardless of SVG fill behavior:

```tsx
// Option A: solid background badge (most robust)
<span className="absolute -top-1 -right-1 size-3 rounded-full bg-warning" aria-hidden="true" />

// Option B: use style prop to force SVG fill
<Bookmark
  className="size-3 text-warning"
  style={{ fill: 'currentColor' }}
  aria-hidden="true"
/>
```

---

**H3 — Hardcoded dark-mode color in QuestionGrid**

The current question button uses `dark:text-[#1a1b26]` — a hardcoded hex value for the dark background color intended to ensure dark text on the brand-colored button.

- **Location**: `src/app/components/quiz/QuestionGrid.tsx:42`
- **Evidence**: `'bg-brand text-brand-foreground dark:text-[#1a1b26]'`
- **Impact**: This hardcodes a specific dark theme color that will drift out of sync if the dark theme background is updated. It also triggers the project's `design-tokens/no-hardcoded-colors` ESLint rule. The intent (dark text on the brand button in dark mode) is already handled by the `brand-foreground` token in dark mode — but the live contrast measurement showed `q3TextColor: "rgb(26, 27, 38)"` which matches `#1a1b26`, suggesting the token isn't resolving to the expected value.
- **Suggestion**: Remove `dark:text-[#1a1b26]` and rely solely on `text-brand-foreground`. If the token is resolving incorrectly in dark mode, investigate `theme.css` to ensure `--color-brand-foreground` has a proper dark-mode override. Do not patch token resolution issues with hardcoded hex values.

---

### Medium Priority (Fix when possible)

**M1 — ReviewSummary placed inside AlertDialogHeader, causing semantic mismatch**

`ReviewSummary` is rendered as a child of `AlertDialogHeader` in `Quiz.tsx` (lines 307-314). The `AlertDialogHeader` is a presentational grouping that typically contains only the title and description. Adding interactive content (the Q-number jump link buttons) inside the description region creates an unexpected pattern — some screen readers may not announce interactive content within `aria-describedby` regions correctly.

- **Location**: `src/app/pages/Quiz.tsx:307-314`
- **Evidence**: `headerContainsReview: true` (confirmed via live DOM traversal). The `ReviewSummary` contains `<button>` elements inside what is semantically the dialog's description area.
- **Suggestion**: Move `ReviewSummary` between `AlertDialogHeader` and `AlertDialogFooter` as a sibling, not a child of the header. This keeps the header clean (title + description only) and lets the review links exist in their own properly-announced region.

```tsx
// Before (ReviewSummary inside AlertDialogHeader)
<AlertDialogHeader>
  <AlertDialogTitle>Submit quiz?</AlertDialogTitle>
  <AlertDialogDescription>...</AlertDialogDescription>
  <ReviewSummary ... />   {/* inside header */}
</AlertDialogHeader>

// After (ReviewSummary between header and footer)
<AlertDialogHeader>
  <AlertDialogTitle>Submit quiz?</AlertDialogTitle>
  <AlertDialogDescription>...</AlertDialogDescription>
</AlertDialogHeader>
<ReviewSummary ... />   {/* standalone, before footer */}
<AlertDialogFooter>
```

---

**M2 — ReviewSummary `aria-label` on a `div` provides no announced region landmark**

`ReviewSummary` wraps its content in `<div aria-label="Questions marked for review">`. A `div` with `aria-label` does not create an announced landmark unless it also has an appropriate `role`. Screen readers will not announce the label when entering this section.

- **Location**: `src/app/components/quiz/ReviewSummary.tsx:20`
- **Evidence**: `<div className="mt-3" aria-label="Questions marked for review">` — no `role` attribute.
- **Suggestion**: Add `role="region"` to make it an announced landmark, or use `role="group"` if a region is semantically too strong for this context:

```tsx
<div className="mt-3" role="group" aria-label="Questions marked for review">
```

---

**M3 — QuizActions Submit button uses manual brand classes instead of `variant="brand"`**

Beyond the contrast issue (B1), the pattern itself diverges from the project convention documented in `styling.md`: "Use `variant="brand"` instead of manual `bg-brand` className overrides on `<Button>`."

- **Location**: `src/app/components/quiz/QuizActions.tsx:42`
- **Impact**: Design-token divergence accumulates technical debt. When the brand color system updates, manual overrides must be hunted down rather than being automatically inherited.
- **Suggestion**: This is resolved by fixing B1 (switching to `variant="brand"`).

---

### Nitpicks (Optional)

**N1 — Bookmark icon size (12px) may be too small for peripheral vision during timed quizzes**

`size-3` on the bookmark renders as a 12x12px icon overlaid at `-top-1 -right-1` of the 44px question button. This is a fine size for a decorative badge but may be too subtle for learners in a time-pressured state. Consider `size-3.5` (14px) or a small filled dot badge instead for stronger salience.

**N2 — `MarkForReview` label icon (Bookmark `size-3.5`) and checkbox `size-4` create slight vertical misalignment**

The label includes a `size-3.5` Bookmark icon alongside 14px label text. The checkbox is Radix's default `size-4` (16px). The combination can produce a subtle one-pixel vertical baseline difference. `items-center` on the container should handle this, but worth verifying visually across platforms.

**N3 — ReviewSummary Q-number buttons have no hover background state**

The Q-link buttons rely solely on `hover:underline` for their hover feedback. Adding a subtle `hover:bg-brand-soft` or `hover:bg-muted` would make the interactive affordance clearer, especially for learners who might not expect a link-style button inside a dialog.

---

## Detailed Findings

### Finding B1: Submit Button Contrast (Dark Mode)

| Attribute | Value |
|-----------|-------|
| Element | `<Button>` "Submit Quiz" |
| File | `src/app/components/quiz/QuizActions.tsx:42` |
| Text color | `rgb(255, 255, 255)` (white) |
| Background | `rgb(139, 146, 218)` (brand blue in dark mode) |
| Contrast ratio | **2.91:1** |
| Required | 4.5:1 (WCAG AA normal text) |
| Failure type | WCAG 1.4.3 Contrast (Minimum) |

### Finding B2: Checkbox Accessible Name

| Attribute | Value |
|-----------|-------|
| Element | Radix `Checkbox` (renders as `role="checkbox" type="button"`) |
| File | `src/app/components/quiz/MarkForReview.tsx:15` |
| aria-label | `null` |
| aria-labelledby | `null` |
| aria-describedby | `"mark-review-q3-label"` |
| Associated label text | "Mark for Review" (via `htmlFor`, not announced as name) |
| Screen reader output | "checkbox, unchecked" (no name) |
| Failure type | WCAG 4.1.2 Name, Role, Value |

### Finding H1: Touch Target Measurements

| Breakpoint | Checkbox size | Row height | Pass 44px? |
|------------|--------------|------------|------------|
| 1440px desktop | 16x16px | 20px | No |
| 640px tablet | 16x16px | 20px | No |
| 375px mobile | 16x16px | 20px | No |

Note: The `<Label>` click area is 126x20px, which helps on desktop where precision pointing is available. On touch devices the 20px height is the primary concern.

### Finding H3: Hardcoded Color

| Attribute | Value |
|-----------|-------|
| File | `src/app/components/quiz/QuestionGrid.tsx:42` |
| Value | `dark:text-[#1a1b26]` |
| ESLint rule | `design-tokens/no-hardcoded-colors` (ERROR) |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Fail | Submit Quiz button: 2.91:1 in dark mode (B1) |
| Keyboard navigation | Pass | All quiz controls reachable via Tab |
| Focus indicators visible | Pass | `focus-visible:ring-[3px]` present on all interactive elements |
| Heading hierarchy | Pass | H1 for quiz title, no skipped levels |
| ARIA labels on icon buttons | Pass | QuestionGrid buttons have descriptive `aria-label` including marked state |
| Semantic HTML | Pass | `<nav>`, `<button>`, `<checkbox>` used correctly |
| Form labels associated | Fail | Checkbox accessible name not provided (B2) |
| prefers-reduced-motion | Not checked | No motion-specific code found in changed files; inherits from app-level CSS |
| Touch targets ≥44px (interactive) | Partial | QuestionGrid buttons: pass (44x44px). MarkForReview row: fail (20px height, H1) |
| Color as sole indicator | Pass | Question status uses both color and aria-label; marked state uses both bookmark icon and aria-label |
| Live regions for dynamic content | Pass | QuestionGrid uses `aria-current="step"` and `aria-label` updates on mark |

---

## Responsive Design Verification

| Viewport | Horizontal Scroll | Nav Layout | QuestionGrid | MarkForReview row |
|----------|------------------|------------|--------------|-------------------|
| 375px mobile | None (pass) | `flex-col` (correct) | 44x44px buttons (pass) | 20px height (fail — H1) |
| 640px tablet | None (pass) | `flex-row` (correct) | 44x44px buttons (pass) | 20px height (fail — H1) |
| 1440px desktop | None (pass) | `flex-row` (correct) | 44x44px buttons (pass) | 20px height (fail — H1) |

---

## Recommendations

1. **Fix the Submit button contrast before merge** (B1). Switch to `variant="brand"` — this is a one-line change that also resolves M3 and aligns with the existing brand button system. Verify dark-mode contrast is ≥4.5:1 after the change.

2. **Fix the Checkbox accessible name before merge** (B2). Replace `aria-describedby` with `aria-labelledby` pointing to the label element, or add an explicit `aria-label="Mark for Review"`. This is a two-character change with no visual impact.

3. **Add `min-h-[44px]` to the MarkForReview container** (H1). This is a one-property addition that has no desktop visual impact and eliminates the mobile touch target deficiency.

4. **Fix the bookmark fill rendering** (H2). The outlined-only bookmark at 12px may not be salient enough in practice. A solid color indicator — whether a filled SVG or a dot badge — provides stronger at-a-glance confirmation that a question is marked. Consider `style={{ fill: 'currentColor' }}` on the Bookmark icon as the lowest-effort fix.

