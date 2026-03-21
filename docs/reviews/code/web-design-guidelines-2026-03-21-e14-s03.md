# Web Design Guidelines Review: E14-S03 Fill-in-Blank Question

**Date:** 2026-03-21
**Component:** `FillInBlankQuestion.tsx`, `QuestionDisplay.tsx`
**Reviewer:** Claude (automated)

---

## Findings

### HIGH

**1. Character counter not associated with input via `aria-describedby`**
The `<span>` showing `N / 500` is visually adjacent but not programmatically linked to the input. Screen readers will not announce the character count. Add an `id` to the counter span and reference it with `aria-describedby` on the `<Input>`.

**2. No live region for character count updates**
As the user types, the counter updates silently. Use `aria-live="polite"` on the character counter so assistive technology announces remaining characters (especially important near the limit). Consider announcing only at thresholds (e.g., 50, 10 remaining) to avoid verbosity.

### MEDIUM

**3. Placeholder as sole instruction**
The placeholder "Type your answer here" disappears on focus/input, leaving no persistent label or instruction. The `fieldset/legend` provides the question text (good), but consider adding a visible `<label htmlFor={inputId}>` with brief instructions (e.g., "Your answer") for clarity. The `aria-labelledby={legendId}` partially compensates, but a visible label is a WCAG 2.1 best practice (1.3.1, 3.3.2).

**4. `max-w-md` may be too narrow on large screens**
The input is capped at `max-w-md` (28rem / 448px). For fill-in-blank answers that could be a sentence or short paragraph, this may feel cramped. Consider `max-w-lg` or `max-w-xl`, or use a `<textarea>` if multi-line answers are expected.

**5. No visual feedback approaching character limit**
The counter shows current/max but does not change appearance as the user approaches the limit. Consider adding a warning color (e.g., `text-warning`) when within 50 characters of the limit and `text-destructive` when at the limit.

### LOW

**6. Disabled state uses `opacity-60` on wrapper instead of relying solely on input's built-in disabled styling**
The `<Input>` component already applies `disabled:opacity-50`. The wrapper's `opacity-60` stacks with this, resulting in approximately `0.6 * 0.5 = 0.3` effective opacity on the input in review mode, which may reduce readability. Either remove the wrapper opacity or remove the input's disabled opacity override.

**7. `legendId` is generated but only used for `aria-labelledby` -- the `id` on `<legend>` is redundant with fieldset/legend semantics**
A `<legend>` inside a `<fieldset>` already labels the fieldset implicitly. The explicit `aria-labelledby={legendId}` on the input is not harmful but is technically redundant since the input is already within the fieldset. This is fine as a defensive measure.

**8. Debounce does not flush on unmount**
If the component unmounts before the 300ms debounce fires (e.g., quick navigation), the latest typed value may be lost. The `onBlur` handler mitigates this for focus-loss scenarios, but programmatic navigation could still lose data. Consider flushing on cleanup.

## Passing Areas

- **Semantic HTML:** Correct use of `fieldset/legend` for grouping.
- **Design tokens:** All colors use semantic tokens (`text-foreground`, `text-muted-foreground`, `border-input`, etc.). No hardcoded colors detected.
- **Keyboard navigation:** Standard `<input>` element, fully keyboard-accessible. Focus ring styling via `focus-visible:` is present in the base Input component.
- **Responsive design:** `text-lg lg:text-xl` for question text scales appropriately. `w-full max-w-md` provides fluid width.
- **Disabled state:** Uses native `disabled` attribute, which prevents interaction and announces disabled state to screen readers.
- **QuestionDisplay dispatch:** Clean polymorphic pattern with proper type narrowing for `string` vs `string[]` values.

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 2     |
| MEDIUM   | 3     |
| LOW      | 3     |

**Recommendation:** Fix the two HIGH items (`aria-describedby` and `aria-live` on the character counter) before shipping. The MEDIUM items are improvements worth considering but not blockers.
