# Web Interface Guidelines Review — E18-S03

**Story:** Ensure Semantic HTML and Proper ARIA Attributes
**Date:** 2026-03-23
**Reviewed files:**
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/components/quiz/QuizTimer.tsx`
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/AnswerFeedback.tsx`
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`

Guidelines source: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

---

## Findings

### 1. Accessibility

`src/app/components/quiz/QuizHeader.tsx:36-51` — Two `role="progressbar"` elements share the same `aria-label="Quiz progress"`. Screen readers will announce both when navigating by landmarks/roles; the sr-only duplicate exists specifically to expose question-count values to AT, but the identical label creates ambiguity. Consider distinguishing labels: `"Quiz progress percentage"` for the visual bar and `"Quiz progress by question"` for the sr-only one.

`src/app/components/quiz/questions/FillInBlankQuestion.tsx:72` — `<legend className="sr-only" />` is an empty self-closing element. An empty `<legend>` provides no accessible name to the `<fieldset>`; the accessible name is coming entirely from `aria-labelledby` on the `<fieldset>`. This is valid (ARIA overrides the native legend), but the comment says the empty legend "satisfies semantic HTML requirement" — that framing is misleading: an empty `<legend>` satisfies the structural rule but contributes nothing semantically. The pattern is technically safe but the same applies to MultipleChoiceQuestion.tsx:75, MultipleSelectQuestion.tsx:56, and TrueFalseQuestion.tsx:67.

`src/app/components/quiz/QuizActions.tsx:31` — `aria-label="Previous question"` on a button that already renders visible text "Previous" with a chevron icon is slightly redundant; the label matches the visible text too closely to add value. Redundancy is harmless but consider whether the label conveys more context than the text alone warrants (e.g., "Go to previous question" vs the visible "Previous"). Same applies to line 43 "Next question".

`src/app/pages/Quiz.tsx:456-458` — `<h2 className="sr-only">` announces "Question N of M" — this duplicates the identical visible text already rendered in `QuizHeader.tsx:53-55` (`<p>Question {currentQuestion} of {totalQuestions}</p>`). A screen reader user navigating by headings will encounter the h2, then shortly after the live `<p>` text while also having the sr-only progressbar announce the same count. This is three separate channels announcing the same information.

### 2. Focus States

`src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:115` and `TrueFalseQuestion.tsx:108` and `MultipleSelectQuestion.tsx:97` — Option labels use `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`. This is a valid `:focus-within` ring pattern, but the ring renders on the parent `<label>` while the native radio/checkbox inside also has its own Radix focus ring. This can produce a double-ring on some browsers. The inner `RadioGroupItem`/`Checkbox` should have their own focus ring suppressed if the outer label ring is the intended indicator — verify visually that focus rings are not doubled.

### 3. Forms

`src/app/components/quiz/questions/FillInBlankQuestion.tsx:82-96` — Input has `aria-labelledby={labelId}` pointing to the question text div (id set via `useId()`). The `<fieldset>` also has `aria-labelledby={labelId}`. Both the fieldset and the input reference the same id. AT will compute the same accessible name for the input whether it reads the fieldset's label or the input's own `aria-labelledby`. This is not a bug, but the double-reference (fieldset + input both pointing to the same id) could produce a verbose double-announcement on some AT. The input's own `aria-labelledby` is sufficient; removing it from the fieldset or ensuring they reference distinct elements would be cleaner.

`src/app/components/quiz/questions/FillInBlankQuestion.tsx:91` — `autoComplete="off"` is appropriate for a quiz answer. `spellCheck={false}` is good for answers where spelling is intentionally checked by the quiz engine. ✓

`src/app/components/quiz/questions/FillInBlankQuestion.tsx:89` — `maxLength={500}` set on input but the counter `{inputValue.length} / {MAX_LENGTH}` only appears when `isActive`. No truncation warning is shown before the user hits the limit. Low impact but worth noting: browsers silently discard characters at `maxLength` without feedback — the counter mitigates this but only in active mode.

### 4. Animation

`src/app/components/quiz/AnswerFeedback.tsx:106` — `animate-in slide-in-from-bottom-2 fade-in duration-300 motion-reduce:animate-none` correctly respects `prefers-reduced-motion` via `motion-reduce:animate-none`. ✓

`src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:112` and `MultipleSelectQuestion.tsx:94` and `TrueFalseQuestion.tsx:105` — `transition-colors duration-150 motion-reduce:transition-none` correctly suppresses transitions. ✓

### 5. Typography

`src/app/pages/Quiz.tsx:541` — `'Submitting…'` uses the correct Unicode ellipsis character (`…`). ✓

`src/app/components/quiz/AnswerFeedback.tsx:114` — `<h4>` used for the feedback title inside an ARIA live region (`role="status"`). The heading level 4 is appropriate for a subsection within the card, assuming h1 (quiz title) and h2 (question area, sr-only) are present in the document outline. ✓

### 6. Content Handling

`src/app/pages/Quiz.tsx:489` — "No question found at index {currentProgress.currentQuestionIndex}" is a developer-facing error string visible to end users. This is an edge-case fallback, but consider a more user-friendly message.

`src/app/components/quiz/questions/FillInBlankQuestion.tsx:129` — `{userTrimmed || '(no answer)'}` is a good empty-state guard. ✓

### 7. Images

No images added or modified in this story. ✓

### 8. Performance

No large lists or new data-fetching patterns introduced. ✓

### 9. Navigation & State

`src/app/pages/Quiz.tsx:442-453` — `<section aria-label="Quiz header">` and `<section aria-label="Question area">` correctly landmark the page regions. ✓

`src/app/pages/Quiz.tsx:503` — Comment `{/* QuizNavigation renders <nav aria-label="Quiz navigation"> internally */}` confirms nav landmark is present. ✓

`src/app/pages/Quiz.tsx:516-545` — `AlertDialog` for submit confirmation has proper `AlertDialogTitle` and `AlertDialogDescription`. Destructive action ("Submit Anyway") is clearly differentiated. ✓

### 10. Touch & Interaction

`src/app/components/quiz/QuizActions.tsx:28` — `min-h-[44px]` on Previous, Next, and Submit buttons meets the 44×44px minimum touch target requirement. ✓

`src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:112` and `MultipleSelectQuestion.tsx:94` — Option labels use `min-h-12` (48px), exceeding the 44px minimum. ✓

`src/app/components/quiz/questions/FillInBlankQuestion.tsx:95` — Input has `min-h-[44px]`. ✓

### 11. Dark Mode & Localization

All color classes use design tokens (`text-destructive`, `text-warning`, `text-muted-foreground`, `bg-brand-soft`, `bg-success-soft`, etc.) rather than hardcoded colors. Dark mode support is implicit via CSS variables. ✓

No date/number formatting introduced in this story. ✓

### 12. Hydration Safety

No SSR-specific code. App is client-side only. ✓

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| Medium   | 2     | Duplicate `aria-label` on two progressbars; sr-only h2 triple-announces question count |
| Low      | 3     | Empty `<legend>` comment misleading (4 files); potential double focus ring on option labels; input + fieldset both reference same labelledby id |
| Advisory | 2     | Developer-facing error message shown to users; redundant `aria-label` on nav buttons that mirrors visible text |
| Pass     | ~18   | Touch targets, motion-reduce, design tokens, focus states, form inputs, dialog, landmarks, nav, animations, typography |

### Recommended Actions

1. **Medium — Disambiguate progressbar labels** (`QuizHeader.tsx:39,47`): Rename the sr-only progressbar's `aria-label` to something distinct from the visual bar (e.g., `"Question count"` or `"Quiz progress by question"`).

2. **Medium — Eliminate triple-announcement of question position** (`Quiz.tsx:456-458`, `QuizHeader.tsx:53-55`, `QuizHeader.tsx:45-52`): The sr-only `<h2>`, the visible `<p>`, and the sr-only progressbar all announce "Question N of M". Remove the sr-only `<h2>` or consolidate — the progressbar + visible paragraph is sufficient.

3. **Low — Verify focus rings are not doubled** on option labels across `MultipleChoiceQuestion.tsx`, `MultipleSelectQuestion.tsx`, and `TrueFalseQuestion.tsx`: check in browser with keyboard navigation that only one ring is visible per focused option.

4. **Advisory — User-facing error message** (`Quiz.tsx:489`): Replace `"No question found at index {n}"` with a user-friendly string.
