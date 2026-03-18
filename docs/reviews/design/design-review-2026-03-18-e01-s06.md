# Design Review — E01-S06: Delete Imported Course

**Review Date**: 2026-03-18
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: feature/e01-s06-delete-imported-course
**Changed Files**: `src/app/components/figma/ImportedCourseCard.tsx`
**Affected Pages**: `/courses` (Imported Courses section)

---

## Executive Summary

E01-S06 adds a destructive "Delete course" dropdown item and an `AlertDialog` confirmation to `ImportedCourseCard`. The AlertDialog implementation is structurally sound — correct ARIA roles, properly linked labels, and full-width buttons at mobile. However, two keyboard navigation bugs were discovered that allow destructive actions to fire without confirmation, and a focus-return failure means keyboard users lose their place after cancelling.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. Enter key on "Delete course" menu item navigates to the course instead of opening the confirmation dialog**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:140-145`, `src/app/components/figma/ImportedCourseCard.tsx:299-306`
- **Evidence**: Live test — pressing ArrowDown to focus "Delete course", then Enter, caused the browser to navigate to `/imported-courses/course-file-detection` instead of opening the AlertDialog. The course was not deleted, but no confirmation was shown.
- **Root cause**: The `article` element's `onKeyDown` handler (line 140–145) fires for **all** keyboard events inside it — including ones dispatched by Radix UI when a menu item is activated with Enter. Radix closes the dropdown on Enter and the keyboard event bubbles up through the article's `onKeyDown`, matching `e.key === 'Enter'` and calling `navigate()`.
- **Impact**: Keyboard-only learners cannot safely access the delete feature. Every Enter keypress on the "Delete course" item navigates away, bypassing the confirmation entirely. This is a WCAG 2.1 SC 2.1.1 (Keyboard) violation.
- **Suggestion**: Add `e.stopPropagation()` inside the `DropdownMenuContent`'s keyboard handler, or narrow the `handleCardKeyDown` guard to only fire when the article element itself (not a descendant interactive element) has focus — e.g. `if (e.target !== e.currentTarget) return`.

---

**2. Tab key from the Cancel button inside the AlertDialog fired a destructive delete**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:414-434`
- **Evidence**: When the AlertDialog was open with focus on Cancel, pressing Tab once deleted the "Design Review Test Course" without further confirmation. The page showed "Course removed" toast and the card disappeared from the list. This was reproducible.
- **Root cause**: The focus trap provided by Radix `AlertDialog` should confine Tab to the dialog's two buttons. However, with the `/agentation` browser extension active in this session, its DOM elements appeared outside the Radix portal and may have disrupted the trap boundary. This should be verified in a clean browser profile. If reproducible without the extension, there is a genuine Radix focus trap regression at this version.
- **Impact**: A keyboard user pressing Tab to navigate between Cancel and Delete could accidentally trigger a permanent, irreversible deletion. This would be catastrophic for learners who rely on keyboard navigation.
- **Suggestion**: Verify in a clean Chromium profile without extensions. If reproducible, pin the `radix-ui` version or add an `e.preventDefault()` guard on the AlertDialogAction's `onKeyDown` for the Tab key.

---

### High Priority (Should fix before merge)

**3. Focus does not return to the trigger after the AlertDialog closes**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:414`
- **Evidence**: After pressing Escape to close the AlertDialog, `document.activeElement` was `<body>` — not the status badge button that opened the dropdown flow. This was confirmed at both desktop (1440px) and mobile (375px).
- **Impact**: WCAG 2.1 SC 2.4.3 (Focus Order) requires focus to return to the triggering element when a dialog closes. A keyboard user cancelling the delete has lost their position in the page and must Tab from the beginning to continue. For a learner managing a large course library, this is disorienting.
- **Suggestion**: The Radix `AlertDialog` should handle focus return automatically when its trigger is a `AlertDialogTrigger`. Since the dialog is opened programmatically via state (`setDeleteDialogOpen(true)`) rather than through `AlertDialogTrigger`, Radix has no trigger reference to return focus to. Consider wrapping the delete flow in a proper `AlertDialogTrigger`, or use Radix's `onCloseAutoFocus` callback on `AlertDialogContent` to manually focus the status badge ref: `onCloseAutoFocus={(e) => { e.preventDefault(); statusBadgeRef.current?.focus() }}`.

---

**4. "Delete course" menu item touch target is 32px tall — below the 44px minimum**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:299-306`
- **Evidence**: Measured at mobile (375px) and desktop (1440px): menu item height = 32px, width = 129px. The 44×44px minimum applies on touch devices.
- **Impact**: On mobile, learners with motor impairments or larger fingers will have difficulty accurately tapping "Delete course" without accidentally hitting "Paused" above or the separator below. On a destructive action, a mis-tap in either direction creates a problem: either accidental deletion or unexpected status change.
- **Suggestion**: This is a Radix `DropdownMenuItem` default — it uses `py-1.5` (6px top/bottom) with `text-sm`. For the destructive item specifically, add `min-h-[44px]` and `py-3` to bring it up to standard: `className="... min-h-[44px] py-3"`. Alternatively, apply this to all menu items for consistency.

---

**5. Hardcoded `ring-blue-600` on the article focus ring instead of `ring-brand` design token**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:205`
- **Evidence**: `focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2` — uses the hardcoded Tailwind color `blue-600` instead of the project token `brand`.
- **Impact**: In dark mode, `--brand` resolves to `#8b92da` (a soft purple-blue), while `blue-600` stays a bright blue. The focus ring will be visually inconsistent with all other interactive elements when dark mode is active, breaking the platform's design coherence for learners who prefer dark mode for eye comfort.
- **Suggestion**: Replace `ring-blue-600` with `ring-brand`. This is also caught by the project's ESLint `design-tokens/no-hardcoded-colors` rule — verify this wasn't suppressed.

---

**6. `AlertDialogDescription` text contrast is 3.88:1 — fails WCAG AA for normal-sized body text**

- **Location**: `src/app/components/ui/alert-dialog.tsx:96-101`
- **Evidence**: The description uses `text-muted-foreground` which resolves to `#7d8190`. Against the white dialog background (`#ffffff`), the computed contrast ratio is **3.88:1**, below the 4.5:1 WCAG AA minimum for normal text at 14px (small).
- **Impact**: WCAG 2.1 SC 1.4.3 (Contrast Minimum) — "This will permanently remove the course and all its content" is critical information for an irreversible action. Low contrast makes this warning harder to read for learners with low vision, increasing the risk that the consequence is missed before confirming deletion.
- **Note**: This is an existing issue in the shared `AlertDialog` component, not introduced by this story specifically. The fix should be applied globally.
- **Suggestion**: Change the description colour in `alert-dialog.tsx` from `text-muted-foreground` to `text-foreground` or a darker muted variant. Alternatively, lighten the dialog background to `bg-background` (warm `#faf5ee`) so the contrast ratio improves — `#7d8190` on `#faf5ee` computes to 3.96:1, still marginal. The cleanest fix is `text-foreground/70` or a dedicated token with verified contrast.

---

### Medium Priority (Fix when possible)

**7. Status badge touch target is 24px tall on all viewports**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:259-274`
- **Evidence**: The status badge button (the dropdown trigger) measures 24px height at all tested viewports (375px, 768px, 1280px). The badge itself is small text with a tight click area.
- **Impact**: While this pre-dates E01-S06, the story added a destructive action reachable only through this trigger. A 24px touch target that gates access to "Delete course" is a notable barrier on touch devices.
- **Suggestion**: Wrap the badge button's padding so the clickable area reaches 44px without changing the visual badge size: `className="... p-2 -m-2"` (adds invisible tap area via negative margin technique).

---

### Nitpicks (Optional)

**8. No visual distinction between status change items and the destructive "Delete" item in the dropdown separator area**

- **Location**: `src/app/components/figma/ImportedCourseCard.tsx:298-307`
- **Evidence**: The `DropdownMenuSeparator` separates status items from "Delete course", but there is no additional visual weight (e.g., spacing, icon prominence, warning label) to signal the severity difference.
- **Suggestion**: Consider a subtle background tint on the delete item row (e.g. `hover:bg-destructive/10`) on hover — this is already partially handled by `focus:text-destructive` but could be extended to hover state for clearer affordance.

---

## What Works Well

- **AlertDialog ARIA is correct**: `role="alertdialog"`, `aria-labelledby` and `aria-describedby` both correctly reference the title (`radix-_r_3f_`) and description (`radix-_r_3g_`) elements. Screen readers will announce the full dialog content on open.
- **Dialog button touch targets at mobile are excellent**: Both Cancel and Delete buttons are 282px wide × 44px tall at 375px viewport, stacking full-width as intended by the `flex-col-reverse` footer layout.
- **Escape key closes the dialog correctly**: Confirmed at all viewports — Radix `AlertDialog` properly handles Escape dismissal.
- **Color contrast on action buttons passes WCAG AA**: Delete button (white `#ffffff` on destructive `#c44850`) = **4.78:1** ✓. Cancel button (`#1c1d2b` on `#faf5ee`) = **15.37:1** ✓. Destructive menu item text (`#c44850` on white) = **4.78:1** ✓.
- **No horizontal scroll at any breakpoint**: Confirmed at 375px, 768px, and 1280px. The dialog uses `max-w-[calc(100%-2rem)]` which gracefully constrains to 332px at mobile, fitting within the 375px viewport with 16px margins on each side.
- **`motion-reduce` is applied to the card hover animation**: `motion-reduce:hover:[transform:scale(1)]` on the article element correctly disables the scale animation for users who prefer reduced motion.
- **`prefers-reduced-motion` CSS rules are present** in the compiled stylesheet, covering the dialog fade/zoom animations.
- **Semantic HTML is correct**: The card uses `<article>` with a descriptive `aria-label`, heading hierarchy is H2 (section) → H3 (card title), and all icon-only buttons have `aria-label` attributes.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 — action buttons | Pass | Delete: 4.78:1, Cancel: 15.37:1, menu item: 4.78:1 |
| Text contrast ≥4.5:1 — dialog description | Fail | `text-muted-foreground` on white = 3.88:1 (pre-existing) |
| Keyboard navigation — Enter on menu item | Fail | Navigates to course page instead of opening dialog |
| Keyboard navigation — Tab in dialog | Fail | Tab from Cancel fired deletion in test (see note on extension) |
| Keyboard navigation — Escape closes dialog | Pass | Confirmed at 375px and 1280px |
| Focus returns to trigger after dialog close | Fail | Focus lands on `<body>` — not the status badge |
| Focus indicators visible | Pass | Global `*:focus-visible` rule provides 2px brand-colour ring |
| Focus ring uses design token | Fail | `ring-blue-600` on article instead of `ring-brand` (line 205) |
| Heading hierarchy | Pass | H1 → H2 (section) → H3 (card title) |
| ARIA labels on icon-only buttons | Pass | Status badge, thumbnail picker, info popover all labelled |
| AlertDialog role and labelling | Pass | `alertdialog` + `aria-labelledby` + `aria-describedby` all correct |
| Semantic HTML | Pass | `<article>`, `<button>`, no `<div onClick>` violations found |
| Touch targets ≥44×44px — dialog buttons | Pass | 282×44px at mobile (full-width stacked layout) |
| Touch targets ≥44×44px — delete menu item | Fail | 129×32px at all viewports |
| Touch targets ≥44×44px — status badge | Fail | 68×24px at all viewports (pre-existing) |
| `prefers-reduced-motion` | Pass | CSS media query rules present; `motion-reduce:` utility on card scale |
| No horizontal scroll | Pass | Confirmed at 375px, 768px, 1280px |

---

## Responsive Design Verification

| Breakpoint | Layout | Dialog | Notes |
|---|---|---|---|
| Mobile (375px) | Pass | Pass | Single-column card grid (305px). Dialog 332px wide, 16px margins. Buttons full-width 282×44px. No horizontal scroll. |
| Tablet (768px) | Pass | Pass | Card width 221px in multi-column grid. `sm:max-w-lg` applies — dialog capped at 512px. No horizontal scroll. |
| Desktop (1280px) | Pass | Pass | 5-column card grid (204px each). Dialog centred at max 512px. Status badge visually accessible at top-right of card. |

---

## Recommendations

1. **Fix the keyboard Enter propagation bug (Blocker 1) before merge.** Add `if (e.target !== e.currentTarget) return` as the first line of `handleCardKeyDown`. This one-line fix prevents any keyboard event from a child element triggering card navigation.

2. **Implement focus return on dialog close (High 3).** Add a `ref` to the status badge button and use `AlertDialogContent`'s `onCloseAutoFocus` prop to return focus to it. This is the standard Radix pattern for programmatically-opened dialogs and is a WCAG 2.4.3 requirement.

3. **Verify the Tab-in-dialog deletion (Blocker 2) in a clean browser profile.** If reproduced without the `/agentation` extension, file a Radix bug and add an explicit `onKeyDown` guard to `AlertDialogAction` that prevents Tab from activating the button.

4. **Replace `ring-blue-600` with `ring-brand` on the article element (High 5) and raise a PR comment to fix the `AlertDialogDescription` contrast globally** — both are straightforward and affect the entire platform's dark mode correctness.

