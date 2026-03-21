# Web Design Guidelines Review: E14-S02 (Multiple Select Questions)

**Date:** 2026-03-21
**Reviewer:** Claude (automated design review)
**Files reviewed:**
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/QuestionDisplay.tsx`

---

## Summary

The MultipleSelectQuestion component is well-implemented with strong accessibility foundations. It correctly mirrors the patterns established by MultipleChoiceQuestion, uses semantic HTML (fieldset/legend), design tokens throughout, and respects `prefers-reduced-motion`. A few issues were identified, mostly MEDIUM/LOW severity.

---

## Findings

### MEDIUM-1: Redundant `role="group"` on div inside fieldset

**Severity:** MEDIUM
**Category:** Semantic HTML / Screen readers
**Location:** `MultipleSelectQuestion.tsx:53`

```tsx
<div className="space-y-3" role="group" aria-labelledby={legendId}>
```

The `<fieldset>` element already implicitly creates a group with its `<legend>` providing the accessible name. Adding `role="group"` with `aria-labelledby` on an inner `<div>` creates a redundant grouping that some screen readers (NVDA, JAWS) will announce twice -- once for the fieldset and once for the group. The MultipleChoiceQuestion avoids this by relying on RadioGroup's own semantics.

**Recommendation:** Remove `role="group"` and `aria-labelledby` from the inner div, since the parent `<fieldset>` + `<legend>` already provides grouping semantics:
```tsx
<div className="space-y-3">
```

---

### MEDIUM-2: Checkbox size is 16px (size-4), below recommended touch target for the control itself

**Severity:** MEDIUM
**Category:** Touch targets / WCAG 2.5.8
**Location:** `MultipleSelectQuestion.tsx:69-74`

The `<Checkbox>` component renders at `size-4` (16x16px). While the wrapping `<label>` provides a large click/tap target (`min-h-12` = 48px, full-width with `p-4`), the visible checkbox indicator is small. This is acceptable because the entire label row is clickable -- users do not need to precisely target the checkbox itself.

**Status:** PASS -- the effective touch target (the label) meets the 44x44px minimum. No action needed, but noted for awareness.

---

### MEDIUM-3: "Select all that apply" hint is outside the legend, potentially missed by screen readers

**Severity:** MEDIUM
**Category:** Screen reader UX
**Location:** `MultipleSelectQuestion.tsx:51`

```tsx
<span className="text-sm text-muted-foreground italic block mb-4">Select all that apply</span>
```

This instruction text sits between the `<legend>` and the checkbox group. While sighted users will see it, screen reader users navigating by form controls (Tab key) may jump directly from the legend to the first checkbox, missing this instruction.

**Recommendation:** Either:
1. Include the hint inside the `<legend>` element (e.g., as a secondary span), or
2. Add `aria-describedby` on the `<fieldset>` pointing to this span's id, so the hint is announced when the fieldset receives focus:

```tsx
<span id={hintId} className="...">Select all that apply</span>
// ...
<fieldset aria-describedby={hintId} className="mt-6">
```

---

### LOW-1: `useMemo` used for side effect (console.warn)

**Severity:** LOW
**Category:** React best practices (not a design/a11y issue)
**Location:** `MultipleSelectQuestion.tsx:26-32`

`useMemo` is intended for memoizing computed values, not triggering side effects. Using it for `console.warn` works but may behave unpredictably under React Strict Mode (double invocation) or future React concurrent features. This is consistent with MultipleChoiceQuestion (same pattern), so it is a pre-existing pattern rather than a regression.

**Recommendation:** Consider `useEffect` for development-only warnings, or accept the current pattern since it matches the existing codebase.

---

### LOW-2: Key prop uses index prefix

**Severity:** LOW
**Category:** React performance
**Location:** `MultipleSelectQuestion.tsx:59`

```tsx
key={`${index}-${option}`}
```

Including `index` in the key is redundant when `option` values are unique (which they should be for a well-formed question). If options are not unique, this masks a data quality issue. Same pattern as MultipleChoiceQuestion.

**Recommendation:** Use `option` alone as the key if options are guaranteed unique, or keep as-is for consistency with MultipleChoiceQuestion.

---

## Checklist Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| **WCAG 2.1 AA contrast** | PASS | All colors use design tokens (`text-foreground`, `text-muted-foreground`, `border-brand`, `bg-brand-soft`, `bg-card`, `bg-accent`) which are defined with appropriate contrast in both light and dark themes |
| **Focus indicators** | PASS | `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` on labels; global `*:focus-visible` in theme.css provides brand-colored outlines on checkboxes |
| **Semantic HTML** | PASS | Proper `<fieldset>` + `<legend>` grouping, `<label>` wrapping each checkbox |
| **Touch targets >= 44px** | PASS | `min-h-12` (48px) with `p-4` padding on each option label |
| **Responsive design** | PASS | `text-lg lg:text-xl` for question text; `space-y-3` stacking works at all widths; no fixed widths |
| **Design token usage** | PASS | Zero hardcoded colors; all classes use token-based utilities (`text-foreground`, `border-brand`, `bg-brand-soft`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-accent`, `ring-ring`) |
| **Keyboard accessibility** | PASS | Tab navigates between checkboxes; Space toggles via Radix Checkbox primitive; `disabled` prop properly set in non-active mode |
| **ARIA attributes** | PASS | `aria-label` on each Checkbox provides accessible name; `disabled` state communicated via native attribute |
| **prefers-reduced-motion** | PASS | `motion-reduce:transition-none` on option labels; Checkbox component uses `transition-shadow` (minimal, acceptable) |
| **Dark mode** | PASS | All tokens have dark mode variants in theme.css |
| **Disabled state** | PASS | `opacity-60` + `cursor-default` for non-active mode; Checkbox `disabled` prop set |
| **Consistency with siblings** | PASS | Pattern closely mirrors MultipleChoiceQuestion (same spacing, border treatment, focus styles, motion handling) |

---

## QuestionDisplay.tsx Review

The polymorphic dispatcher is clean and well-structured:
- Proper type narrowing with `useCallback` wrappers for type-safe `onChange` signatures
- Value coercion (`stringValue` / `arrayValue`) prevents type mismatches
- Fallback for unsupported question types uses `role="status"` and design tokens
- New `multiple-select` case correctly passes `arrayValue` and `arrayOnChange`

**No issues found** in QuestionDisplay.tsx.

---

## Overall Assessment

**Rating: GOOD** -- Ship-ready with minor improvements possible.

The component demonstrates solid accessibility engineering and consistent design system usage. The two MEDIUM findings (redundant group role, hint text discoverability) are non-blocking but would improve screen reader UX if addressed. All design tokens are correctly used with no hardcoded colors. The component faithfully follows the patterns established by MultipleChoiceQuestion.

| Severity | Count |
|----------|-------|
| BLOCKER  | 0     |
| HIGH     | 0     |
| MEDIUM   | 3     |
| LOW      | 2     |
