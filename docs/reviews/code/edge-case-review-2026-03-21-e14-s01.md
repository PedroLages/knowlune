## Edge Case Review — E14-S01 (2026-03-21)

### Unhandled Edge Cases

**TrueFalseQuestion.tsx:24 — `question.options` is `undefined`** — `question.options is undefined or null`
> Consequence: Component renders zero radio buttons (empty RadioGroup). The learner sees a question with no way to answer. The `options.length !== 2` warning fires but the component still renders a broken UI with no options.
> Guard: `if (!options.length) return <div role="alert">This question has no options configured.</div>`

---

**TrueFalseQuestion.tsx:47 — `value` passed as empty string to RadioGroup** — `value prop is undefined, coerced to ''`
> Consequence: Radix RadioGroup treats `value=""` as a controlled value that matches no item, which is correct. However, if a question option were ever an empty string (malformed data), it would appear pre-selected. Low risk given Zod `z.string().min(1)` validation on options, but the coercion from `undefined` to `''` is unnecessary indirection. Passing `undefined` directly is the idiomatic Radix pattern for "no selection."
> Guard: `value={value}` (pass `undefined` directly instead of `value ?? ''`)

---

**TrueFalseQuestion.tsx:53 — `key` uses index + option text** — `Two options have identical text (e.g., both "True")`
> Consequence: React key collision (`0-True` and `1-True` are unique, so this is actually safe). However, if `question.options` contains duplicate strings, both radio buttons would have the same `value` attribute, making it impossible to distinguish which was selected. The Zod schema does not enforce uniqueness on the options array.
> Guard: `Add a Zod refinement: .refine(opts => new Set(opts).size === opts.length, 'Options must be unique')` or deduplicate at render time.

---

**TrueFalseQuestion.tsx:48 — `onValueChange` set to `undefined` in non-active mode** — `User clicks option in review mode`
> Consequence: RadioGroup is `disabled` AND `onValueChange` is `undefined`, providing double protection. No issue here, but if Radix ever changes `disabled` behavior (e.g., allowing programmatic value changes), the `undefined` handler silently swallows the event rather than explicitly no-oping. Minor defensive concern only.
> Guard: `onValueChange={isActive ? onChange : () => {}}` (explicit no-op over `undefined`)

---

**QuestionDisplay.tsx:47 — `value` is `string[]` for true-false type** — `Quiz state holds an array answer from a previous question type change`
> Consequence: The `typeof value === 'string'` check correctly falls through to `undefined` when value is an array. However, the user's previous answer is silently discarded with no indication. If a question's type is changed from `multiple-select` to `true-false` mid-session (admin edit), the learner loses their answer without feedback.
> Guard: `if (Array.isArray(value)) console.warn('[QuestionDisplay] Array answer found for true-false question, resetting')`

---

**TrueFalseQuestion.tsx:41 — `question.text` is empty or whitespace** — `Question text is an empty string`
> Consequence: The `<legend>` renders as an empty element. The radiogroup's `aria-labelledby` points to an empty legend, making the question inaccessible to screen readers. Zod enforces `z.string().min(1)` on `text`, but only at parse time -- if the object is constructed without validation, an empty legend is rendered.
> Guard: `{question.text.trim() || 'Question text unavailable'}`

---

**TrueFalseQuestion.tsx:61 — hover styles applied in non-active mode** — `Component is in review-correct/review-incorrect mode`
> Consequence: Unselected options show `hover:bg-accent` even when `!isActive`, giving the visual impression they are clickable despite being disabled. The `opacity-60` and `cursor-default` partially mitigate this, but the hover color change is still visible and misleading.
> Guard: `isActive ? 'hover:bg-accent' : ''` (conditionally apply hover styles)

---

**E2E story-e14-s01.spec.ts:759 — label filter `{ hasText: 'True' }` ambiguity** — `Page contains other elements with text "True" (e.g., a "True/False" heading)`
> Consequence: `page.locator('label').filter({ hasText: 'True' })` matches any label containing the substring "True". If future UI adds labels like "True/False Question Type", this locator would match multiple elements and the test would become flaky or fail.
> Guard: `page.locator('label').filter({ hasText: /^True$/ })` (exact text match via regex)

---

**TrueFalseQuestion.tsx:28-32 — warning fires on every render** — `Component re-renders due to parent state change`
> Consequence: The `console.warn` for invalid option count runs on every render cycle, not just once. In development with React StrictMode (double-rendering), this produces duplicate warnings. In production, frequent parent re-renders (e.g., timer ticking) flood the console.
> Guard: Wrap in `useEffect(() => { if (options.length !== 2) console.warn(...) }, [options.length, question.id])`

---

**TrueFalseQuestion.tsx:66 — `RadioGroupItem` with no explicit `id`** — `Multiple TrueFalseQuestion instances on same page`
> Consequence: Radix RadioGroupItem auto-generates IDs, so this is safe. However, the `<label>` wrapping approach relies on implicit association (label wraps input). If CSS or a browser extension inserts elements between the label and the RadioGroupItem, the click target association breaks. Using explicit `htmlFor` + `id` would be more robust.
> Guard: `const optionId = useId(); <label htmlFor={optionId}> <RadioGroupItem id={optionId} ...>`

---

**Total:** 10 unhandled edge cases found.
