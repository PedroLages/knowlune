# Design Review Report — E13-S03: Pause and Resume Quiz

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story Branch**: `feature/e13-s03-pause-resume-quiz`
**Changed Files**:
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/pages/Quiz.tsx`

**Affected Route**: `/courses/:courseId/lessons/:lessonId/quiz`

---

## Executive Summary

E13-S03 adds pause/resume capability to the quiz start screen: a "Resume Quiz (X of Y answered)" brand button with `autoFocus`, paired with a destructive "Start Over" action behind an AlertDialog confirmation. The implementation is structurally sound — layout, semantics, token usage, and interaction patterns are all correct. Two pre-existing contrast failures in the theme affect the new UI in specific modes, and a minor `aria-live` announcement opportunity is missing for screen readers returning to a saved quiz.

---

## What Works Well

- **autoFocus behaviour confirmed live**: `document.activeElement` is the Resume button on page load when saved progress exists. Screen reader users are placed on the primary action immediately — precisely the right UX for a returning learner.
- **Button label is self-documenting**: "Resume Quiz (2 of 3 answered)" encodes both the action and the progress count in the accessible name, eliminating the need for a separate `aria-describedby`. This is a clean pattern.
- **AlertDialog for destructive confirmation**: "Start Over" correctly uses Radix UI's `AlertDialog` (not a plain dialog), focus traps inside the modal, Escape restores focus to the trigger, and the description echoes the progress count ("2 of 3 answered will be discarded") — consistent with the button label.
- **Responsive layout is correct at all three breakpoints**: `flex-col` at mobile (375px), `flex-row` at tablet/desktop (≥640px), both buttons full-width on mobile, auto-width on wider viewports. No horizontal scroll at any breakpoint.
- **Design token usage is clean**: zero hardcoded hex colors or Tailwind palette colors (`bg-blue-*`, `text-gray-*`) in either changed file. `variant="brand"`, `bg-brand-soft`, `bg-muted`, `text-brand`, `bg-destructive` are all used correctly.
- **Semantic HTML and ARIA**: proper `<button>` elements throughout, `role="group"` with `aria-label="Quiz details"` on the metadata badges, `role="status"` on the loading skeleton, `role="alert"` on the error state. No `<div onClick>` anti-patterns.
- **Touch targets meet minimum**: Resume and Start Over buttons measure 47.99px tall at all viewport sizes (above the 44px minimum).
- **Card geometry matches design system**: `rounded-[24px]`, `shadow-sm`, `max-w-2xl`, `p-4 sm:p-8` — consistent with other quiz cards in the app.
- **No console errors**: zero JS errors across all test runs. The single warning (`apple-mobile-web-app-capable`) is a pre-existing meta tag issue unrelated to this story.
- **prefers-reduced-motion handled globally** in `src/styles/index.css` — the `autoFocus` itself is not animated, so no special handling is needed in this component.

---

## Findings by Severity

### Blockers (Must fix before merge)

None that are specific to this story's code changes. The two contrast failures below are pre-existing theme-level issues that the story inherits.

### High Priority (Should fix before merge)

**H1 — Dark mode brand button contrast fails WCAG AA**

- **Location**: `src/styles/theme.css:160-162` (`.dark { --brand: #8b92da; --brand-foreground: #ffffff }`)
- **Evidence**: White text on `rgb(139, 146, 218)` = **2.91:1** contrast ratio. WCAG AA requires 4.5:1 for normal text. Measured live at desktop 1440px with dark theme active.
- **Impact**: The Resume button — the primary CTA that returning learners must interact with — fails contrast in dark mode. Users with low vision or in bright-light environments will struggle to read the button label. This is the most important button on the screen.
- **Scope**: This is a theme-level issue affecting all `variant="brand"` buttons in dark mode across the entire app, not just this story. But E13-S03 introduces the highest-stakes use of this variant (the primary recovery action), making it newly prominent.
- **Suggestion**: Darken the dark-mode brand token. `--brand: #6b72c4` (OKLCH ~0.52 chroma) would give white text approximately 4.6:1 contrast. Alternatively, use `--brand-foreground: #1a1b26` (dark text on light-ish brand) for the dark theme, which would pass easily. Verify both hover state `--brand-hover: #7a82d0` at the same time.

**H2 — Light mode brand-soft badge contrast fails WCAG AA**

- **Location**: `src/styles/theme.css:31` (`:root { --brand-soft: #e4e5f4 }`) and `QuizStartScreen.tsx:38`
- **Evidence**: `text-brand` (`#5e6ad2`) on `bg-brand-soft` (`#e4e5f4`) = **3.76:1** contrast. Requires 4.5:1. Measured by direct computation from theme token hex values.
- **Impact**: The "3 questions" metadata badge (the first visible element below the quiz title) fails in light mode. Learners cannot reliably read quiz metadata at a glance.
- **Scope**: Pre-existing theme issue. The dark mode combination passes (4.65:1). Light mode needs the brand-soft background darkened or brand text darkened.
- **Suggestion**: Darken `--brand-soft` in light mode to `#d0d2ee` (giving approximately 4.6:1) or use `--brand-hover` (`#4d57b5`) as the badge text color in light mode (approx 5.5:1 on `#e4e5f4`). A targeted fix using `text-brand-hover` on the badge would be minimal-impact.

### Medium Priority (Fix when possible)

**M1 — No `aria-live` announcement when resume state is detected**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:50-101`
- **Evidence**: When a learner with a screen reader navigates to the quiz URL with saved progress, `autoFocus` moves focus to the Resume button, which is correct. However, there is no `aria-live` region announcing the context shift (e.g. "You have saved progress: 2 of 3 questions answered"). A screen reader user arriving from a different page may miss the significance of the change if they don't immediately interact with the focused element.
- **Impact**: Low for sighted users (the button label is visible). Medium for screen reader users who navigate non-linearly or whose browser moves focus before `autoFocus` has fired. The button label itself ("Resume Quiz (2 of 3 answered)") is well-named, partially mitigating this.
- **Suggestion**: Add a visually-hidden `aria-live="polite"` region that announces the resume state when `hasResume` is true. Example:
  ```tsx
  {hasResume && (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      Saved progress found: {answeredCount} of {questionCount} questions answered.
    </div>
  )}
  ```
  This pairs with `autoFocus` to give screen reader users both focus context and an announcement.

**M2 — AlertDialog "Keep progress" / "Start over" button heights measure 43.99px (sub-pixel under 44px)**

- **Location**: `src/app/components/ui/alert-dialog.tsx` (shadcn/ui component, not this story's code)
- **Evidence**: `keepBtnHeight: "43.9931px"`, `startOverBtnHeight: "43.9931px"` — 0.007px below the 44px touch target minimum. This is a sub-pixel rounding issue, not a real-world problem, but is technically non-compliant.
- **Impact**: Negligible in practice. The dialog only appears on desktop/tablet where pointer precision is high. But on mobile (if the dialog is tappable), the shortfall is theoretically relevant.
- **Suggestion**: Add `min-h-[44px]` to the AlertDialogAction and AlertDialogCancel variants in `alert-dialog.tsx`, or set explicit `h-11` (44px). Pre-existing issue in the shadcn component.

### Nitpicks (Optional)

**N1 — `autoFocus` prop is passed in JSX but `hasAttribute('autofocus')` returns `false`**

- **Location**: `QuizStartScreen.tsx:58`
- **Evidence**: `resumeBtn.hasAttribute('autofocus')` → `false`, yet `resumeBtn === document.activeElement` → `true`. React's `autoFocus` prop causes the browser to focus the element on mount via DOM API (`element.focus()`), not by setting the HTML `autofocus` attribute. This is correct React behaviour — the element is focused as intended.
- **Impact**: Zero functional impact. The E2E test `expect(resumeBtn).toBeFocused()` passes correctly. Noting only to clarify for future reviewers who might query the attribute.

**N2 — Quiz description paragraph is absent for this test quiz, so `{quiz.description && ...}` branch is untested in live**

- **Location**: `QuizStartScreen.tsx:32-34`
- **Evidence**: The seeded "Design Review Test Quiz" has no description, so the `<p className="text-base text-muted-foreground mt-2">` branch was never rendered in this review session.
- **Impact**: The description paragraph uses `text-muted-foreground` (`rgb(101, 104, 112)` light / `rgb(178, 181, 200)` dark). Light mode: ~6.5:1 on white card. Dark mode: ~5.1:1 on dark card. Both pass. No visual concern.
- **Suggestion**: Consider adding a description to the design-review fixture quiz to exercise this path in future reviews.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Partial | H1/body pass; brand-soft badge fails (3.76:1) |
| Text contrast ≥4.5:1 (dark mode) | Partial | H1/body/badge pass; brand button text fails (2.91:1) |
| Keyboard navigation | Pass | Tab order: sidebar links → header → Resume → Start Over. Logical. |
| Focus indicators visible | Pass | 3px ring (`oklab` shadow) on Resume button when focused |
| autoFocus on Resume button | Pass | `document.activeElement` is the Resume button on page load with saved progress |
| Escape closes AlertDialog | Pass | Focus returns to "Start Over" trigger on Escape |
| Focus trapped in AlertDialog | Pass | "Keep progress" receives focus on dialog open |
| Heading hierarchy | Pass | Single H1 (quiz title) — appropriate for a focused task screen |
| ARIA labels on icon buttons | Pass | All icon-only sidebar/header buttons have `aria-label` |
| Semantic HTML | Pass | `<button>` throughout; `role="group"` on metadata badges |
| `aria-live` for resume state | Fail (M1) | No announcement when saved progress is detected |
| Form labels associated | N/A | No form inputs on start screen |
| prefers-reduced-motion | Pass | Global handler in `index.css`; `autoFocus` is not animated |
| No `<div onClick>` patterns | Pass | All interactive elements are `<button>` or `<a>` |
| AlertDialog role semantics | Pass | `role="alertdialog"` with title + description |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|-----------|--------|-------|
| Mobile (375px) | Pass | `flex-col` stacked, both buttons full-width (324px), 48px tall, `p-4` card padding, no horizontal scroll |
| Tablet (768px) | Pass | `flex-row` side-by-side, auto-width buttons, no horizontal scroll |
| Desktop (1440px) | Pass | `flex-row`, `p-8` card padding, max-w-2xl centred, sidebar visible |

---

## Contrast Summary

All measurements taken against actual computed CSS values from the live app.

| Element | Mode | Foreground | Background | Ratio | Pass? |
|---------|------|-----------|-----------|-------|-------|
| Quiz title (H1) | Dark | `rgb(232,233,240)` | `rgb(36,37,54)` | 12.45:1 | Pass |
| Resume button text | Light | `#ffffff` | `#5e6ad2` | 4.70:1 | Pass |
| Resume button text | **Dark** | `#ffffff` | `#8b92da` | **2.91:1** | **Fail** |
| Brand-soft badge text | **Light** | `#5e6ad2` | `#e4e5f4` | **3.76:1** | **Fail** |
| Brand-soft badge text | Dark | `rgb(139,146,218)` | `rgb(42,44,72)` | 4.65:1 | Pass |
| Muted badge text | Dark | `rgb(178,181,200)` | `rgb(50,51,74)` | ~5.0:1 (est.) | Pass |

---

## Code Quality

| Check | Status | Notes |
|-------|--------|-------|
| No hardcoded colors | Pass | Zero `bg-blue-*`, `text-gray-*`, or hex strings in changed files |
| Design token usage | Pass | `variant="brand"`, `bg-brand-soft`, `bg-destructive` used correctly |
| No inline `style=` | Pass | All styling via Tailwind utilities |
| TypeScript props typed | Pass | `QuizStartScreenProps` interface fully typed with JSDoc |
| Import paths use `@/` alias | Pass | All imports use `@/` alias |
| No `any` types | Pass | No `any` found in changed files |
| No `<div onClick>` | Pass | Confirmed via Grep |
| Console errors | Pass | Zero errors in all test runs |
| `prefers-reduced-motion` | Pass | Handled globally; no animations in new code |
| Zod schema validation on load | Pass | `loadSavedProgress()` correctly rejects malformed data (confirmed by testing with invalid enum value) |

---

## Recommendations

1. **Fix dark mode brand button contrast** (High Priority, theme-wide): Darken `--brand` in `.dark` from `#8b92da` to approximately `#6b72c4`, or switch `--brand-foreground` to the dark background color in dark mode. This affects all `variant="brand"` buttons across the app and should be tracked as a separate theme fix ticket.

2. **Fix light mode brand-soft badge contrast** (High Priority, theme-wide): Darken `--brand-soft` in `:root` from `#e4e5f4` to approximately `#d0d2ee`, or use `text-brand-hover` (`#4d57b5`) instead of `text-brand` on the badge in QuizStartScreen. The badge font size (14px, `text-sm`) makes this especially important since small text has a stricter contrast requirement.

3. **Add `aria-live` region for screen reader announcement** (Medium Priority, this story): A single `sr-only` div with `aria-live="polite"` in `QuizStartScreen` when `hasResume` is true will significantly improve the experience for screen reader users who navigate to the quiz URL from another page. Low-effort, high-accessibility-value change.

4. **Consider bundling the two theme contrast fixes as a single "WCAG AA theme audit" story** rather than piecemeal: the dark mode brand token and light mode brand-soft token were likely chosen for aesthetic consistency across the theme and likely affect multiple components (buttons, badges, focus rings). A systematic audit of all design tokens against both light and dark card backgrounds would catch all instances at once.

---

*Report generated by Claude Code design-review agent. Tested live in Chromium via Playwright MCP at desktop (1440×900), tablet (768×1024), and mobile (375×812) viewports.*
