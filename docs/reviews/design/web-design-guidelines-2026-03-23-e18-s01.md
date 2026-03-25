# Web Interface Guidelines Review — E18-S01
**Date:** 2026-03-23
**Story:** E18-S01 — Implement Complete Keyboard Navigation
**Files reviewed:**
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/pages/Quiz.tsx`

**Guidelines source:** https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

---

## Findings

### src/app/components/quiz/QuestionGrid.tsx

**PASS** — `aria-label` on icon-free buttons: each `<button>` has an explicit `aria-label` (`Question ${i + 1}${isMarked ? ', marked for review' : ''}`) — compliant.

**PASS** — Focus states: `focus-visible:ring-[3px] focus-visible:ring-ring` present on every button; `outline-none` is paired with the ring replacement — compliant.

**PASS** — Keyboard handler: `onKeyDown` on the toolbar container handles `ArrowLeft`, `ArrowRight`, `Home`, `End`, `Enter` — compliant.

**PASS** — Semantic HTML: native `<button>` elements used throughout — compliant.

**PASS** — ARIA roles: `role="toolbar"` with `aria-label="Question grid"` is a correct ARIA landmark for a set of related controls — compliant.

**PASS** — `aria-current="step"` on the active question button — correct use of token value for step indicators.

**PASS** — `aria-hidden="true"` on the decorative marker `<span>` — compliant.

**ISSUE (Low) — QuestionGrid.tsx:101** — The inner `<span>` that renders the warning dot has no dimensions applied via Tailwind; `size-3` is correct, but the outer `<span>` wrapper is a bare `<span>` with only positioning classes. No impact on keyboard navigation, but the double-span structure is unnecessary and the inner `<span className="size-3 rounded-full bg-warning" />` is a self-closing element that renders nothing visible without display block context. Verify the dot renders at the intended size in all browsers (bare `<span>` defaults to `display: inline`, collapsing a sized flex/grid child).

**PASS** — No `transition: all`, no `outline-none` without replacement, no `<div onClick>` — compliant.

---

### src/app/pages/Quiz.tsx

**ISSUE (Medium) — Quiz.tsx:455–467** — `<div tabIndex={-1} className="outline-none" ...>` suppresses the focus outline on a programmatically focused element. While `tabIndex={-1}` is correct (removes from Tab order; allows `.focus()`), `outline-none` removes the visible focus ring that screen-reader users and keyboard users who observe focus movement would see. The element is a structural wrapper, not a visible button, so no ring is desired — but the guideline flags `outline-none` without a replacement. This is an intentional accessibility trade-off (focus is for SR announcement only, not visual indication), so the suppression is acceptable, but should be documented with a comment. The existing comment (`// tabIndex={-1}: programmatically focusable…`) partially covers intent but does not explicitly justify `outline-none`. **Recommendation:** add `/* intentional: focus is SR-only, visual ring not needed on question wrapper */` inline with the className.

**PASS** — `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on the `<Link>` at line 402 — compliant.

**PASS** — Destructive action (`Submit Anyway`) is gated behind an `AlertDialog` confirmation — compliant.

**PASS** — `AlertDialog` returns focus to the Submit button on close via `requestAnimationFrame(() => nextBtnRef.current?.focus())` — correct focus-return pattern.

**PASS** — `aria-busy="true"` and `aria-label="Loading quiz"` on the loading skeleton container — compliant.

**PASS** — `role="alert"` on the error state container — compliant.

**PASS** — No `onPaste` with `preventDefault`, no `user-scalable=no`, no `transition: all` — compliant.

**PASS** — `cancelAnimationFrame` cleanup in the `useEffect` return — compliant.

**PASS** — No hardcoded color classes in the changed diff; design tokens used throughout (`bg-brand`, `text-brand-foreground`, `bg-destructive`, `text-destructive-foreground`, `bg-brand-soft`, `text-brand-soft-foreground`) — compliant with project token rules.

**ISSUE (Low) — Quiz.tsx:477–481** — `isArrowNavRef` is reset to `false` inside `onChange` after the conditional check. If `submitAnswer` triggers a re-render before `isArrowNavRef.current = false` executes, the flag could remain `true` for the next interaction. This is unlikely given React's batching, but the reset occurs after the side-effect path rather than at the start of `onChange`. Consider resetting at the top of the handler unconditionally and capturing the value in a local variable: `const wasArrowNav = isArrowNavRef.current; isArrowNavRef.current = false; …`. Minor robustness issue, not a guideline violation per se, but noted.

**PASS** — No unjustified `autoFocus` usage; programmatic focus is driven by user navigation actions and is justified — compliant.

**PASS** — `<AlertDialogAction>` uses design token classes (`bg-destructive text-destructive-foreground hover:bg-destructive/90`) — compliant.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| Medium   | 1     | `outline-none` on question wrapper needs inline justification comment |
| Low      | 2     | Warning dot span display context; `isArrowNavRef` reset ordering |
| Pass     | 18    | All other checked rules |

No blockers. The implementation correctly applies roving tabindex, ARIA roles, focus-visible rings, keyboard handlers, focus return patterns, and semantic HTML. The one medium finding is a documentation gap rather than a functional defect.
