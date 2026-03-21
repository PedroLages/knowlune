# Design Review Report — E14-S04: Support Rich Text Formatting in Questions

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Review Type**: Re-validation after H1 fix (previous review found code block overflow)
**Changed Files**:
- `src/app/components/quiz/MarkdownRenderer.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`

**Affected Routes**: `/courses/:courseId/lessons/:lessonId/quiz`
**Test Data**: Seeded via IndexedDB — quiz `quiz-e14s04` with two Markdown-formatted questions

---

## Executive Summary

The `max-w-full` fix applied to `<pre>` has resolved the previous H1 (overflow breaking the card boundary). All AC1 formatting elements render correctly, both contrast ratios pass WCAG AA by a wide margin, and the AC4 `aria-labelledby` pattern is correctly implemented across all four question types. One residual issue remains: the browser UA stylesheet sets `min-width: min-content` on `<fieldset>` by default, which causes `<fieldset>` itself to expand to fit un-wrappable code content. On a very long single-line code block (Q2), this expands the fieldset to 1145px, causing horizontal scrolling at the `<main>` level rather than the `<pre>` level. The fix requires adding `min-w-0` to every `fieldset` className. This is classified as High Priority because it partially defeats AC3 (code must scroll *within* the container, not cause the whole quiz card to scroll sideways).

---

## What Works Well

- **AC1 fully verified**: Bold (`<strong>`), italic (`<em>`), inline code (`<code>`), fenced code block (`<pre><code>`), bullet list (`<ul>`), ordered list (`<ol>`) all render via `MarkdownRenderer` on question 1. All six element types confirmed present in the live DOM.
- **Code block contrast is excellent**: Block code — `rgb(232, 233, 240)` on `rgb(21, 22, 32)` — achieves **14.86:1**, far above the 4.5:1 WCAG AA threshold.
- **Inline code contrast is excellent**: `rgb(232, 233, 240)` on `rgb(50, 51, 74)` achieves **10.15:1**.
- **AC4 implemented consistently**: All four question components (`MultipleChoiceQuestion`, `TrueFalseQuestion`, `MultipleSelectQuestion`, `FillInBlankQuestion`) use `fieldset` + `aria-labelledby` pointing to a `div` that wraps the `MarkdownRenderer`. The `id`/`aria-labelledby` pairing was verified live — `document.getElementById(labelId)` resolves and its `textContent` matches the question text.
- **Touch targets pass on mobile**: All four multiple-choice option labels measure 61px tall at 375px viewport — well above the 44px minimum.
- **No console errors**: Zero JavaScript errors across all navigation and interaction tested.
- **No hardcoded colors**: Grep across all five changed files found no hardcoded hex colors or non-token Tailwind color utilities.
- **Security posture**: `rehype-raw` is intentionally excluded; raw HTML is stripped. Comment documents this intentional decision.
- **`max-w-full` fix confirmed present**: `pre.className` includes `max-w-full` and `overflow-x-auto`. The `pre` is correctly constrained to 100% of its own parent.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1 (residual): Fieldset `min-width: min-content` causes horizontal scroll at the wrong level**

- **Issue**: The browser UA stylesheet sets `min-width: min-content` on all `<fieldset>` elements. `min-content` resolves to the widest un-wrappable child, which for Q2 (a 132-character single-line code block) computes to 1145px. This makes the `fieldset` 1145px wide regardless of its parent's width. Because `<pre>` uses `max-w-full`, it correctly sizes to 100% of the fieldset — but that 100% is 1145px. The `overflow-x-auto` on `<pre>` is therefore never triggered because the `pre` is not overflowing its own parent; instead, the `fieldset` is overflowing the card.

- **Evidence (mobile 375px viewport)**:
  - `pre.offsetWidth: 1145px` (should be ~312px)
  - `fieldset.offsetWidth: 1145px` with `fieldsetMinWidth: "min-content"`
  - `card.offsetWidth: 356px` but `card.scrollWidth: 1161px`
  - `main.scrollWidth: 1185px` vs `main.offsetWidth: 404px` — main scrolls horizontally

- **Evidence (tablet 768px viewport)**:
  - `fieldset.offsetWidth: 1145px`, `main.hasHorizScroll: true`

- **Evidence (desktop 1440px viewport)**:
  - `pre.offsetWidth: 1145px`, `card.scrollWidth: 1177px` vs `card.offsetWidth: 672px`
  - No visible page-level scroll only because the sidebar leaves enough space in the viewport at this width

- **Proof the fix works**: Setting `fieldset.style.minWidth = '0'` inline via browser evaluate drops `pre.offsetWidth` from 1145px to 312px and `fieldset.offsetWidth` to 312px. The `pre`'s `overflow-x-auto` then kicks in correctly — the code block scrolls internally.

- **Location**: All four question files, `fieldset` element:
  - `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:41`
  - `src/app/components/quiz/questions/TrueFalseQuestion.tsx:36`
  - `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:48`
  - `src/app/components/quiz/questions/FillInBlankQuestion.tsx:63`

- **Impact**: On mobile and tablet, a quiz question with a long code block causes the entire quiz card — including the question text, answer options, and navigation buttons — to scroll horizontally as a unit. The learner cannot answer the question without first scrolling right to see the full code, and the answer options are partially off-screen. This is a significant UX degradation on the devices most likely to be used for quick quiz sessions.

- **Fix**: Add `min-w-0` to the `className` of every `<fieldset>`:
  ```
  // Before
  <fieldset className="mt-6" aria-labelledby={labelId} ...>

  // After
  <fieldset className="mt-6 min-w-0" aria-labelledby={labelId} ...>
  ```
  This overrides the browser UA `min-width: min-content` with `min-width: 0`, allowing the fieldset to shrink below its content's `min-content` size. The `pre`'s `overflow-x-auto` then functions as intended — the code scrolls inside its own box, and the card stays within the viewport.

---

### No Other Issues Found

The remaining AC items all pass:

- **AC1**: All six Markdown element types confirmed in DOM — pass.
- **AC2 (partial)**: The `max-w-full` + `overflow-x-auto` on `pre` is correctly applied. The contrast ratios are excellent (14.86:1 block, 10.15:1 inline). The overflow mechanism fails only because the fieldset's UA `min-width` prevents the `pre` from ever needing to scroll.
- **AC3 (partial)**: Text wrapping on mobile works correctly for Q1 (shorter code, pre: 312px within 344px card). Only Q2's very long single-line content triggers the regression.
- **AC4**: `fieldset` + `aria-labelledby` pattern confirmed on all four question types. The `labelledByTarget` resolves correctly via `document.getElementById()`.

---

## Detailed Findings

### Finding 1: Code Block Overflow — Root Cause Analysis

**The full chain at mobile (375px)**:

| Element | offsetWidth | scrollWidth | overflowX | minWidth |
|---------|------------|-------------|-----------|----------|
| `<pre>` | 1145px | 1145px | auto | 0px |
| `<div>` (MarkdownRenderer wrapper) | 1145px | 1145px | visible | 0px |
| `<div data-testid="question-text">` | 1145px | 1145px | visible | 0px |
| `<fieldset>` | 1145px | 1145px | visible | **min-content** |
| `<div class="bg-card rounded-[24px]...">` | 356px | 1161px | visible | 0px |
| `<main>` | 404px | 1185px | **auto** | auto |

The chain shows that the `fieldset` is the first element that cannot be constrained — every ancestor up to `<main>` inherits the expansion. The `<main>` element's `overflow-auto` contains it at the page level, which is why `document.documentElement.scrollWidth` does not exceed the viewport, but it means the quiz card content scrolls within main rather than the code scrolling within `<pre>`.

**Why the previous fix was incomplete**: Adding `max-w-full` to `<pre>` correctly prevents the `pre` from exceeding 100% of its *own* parent. But the parent (the `<fieldset>`) has already expanded to 1145px via `min-width: min-content`, so 100% of the parent is 1145px. The fix addressed the symptom at the wrong level.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Block code: 14.86:1. Inline code: 10.15:1. Both measured via computed styles. |
| Keyboard navigation | Pass | Tab order and keyboard shortcut handling (1–4 for options) present in all components. |
| Focus indicators visible | Pass | `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` on option labels. |
| Heading hierarchy | Pass | Quiz title uses `<h1>` in QuizHeader. |
| ARIA labels on icon buttons | Not applicable | No icon-only buttons in changed components. |
| Semantic HTML | Pass | `<fieldset>` + `<label>` + `<div id>` for question text. |
| Form labels associated | Pass | `aria-labelledby` wires `fieldset` to the rendered question text in all four components. |
| Touch targets ≥44px | Pass | Option labels: 61px height at 375px viewport. |
| `prefers-reduced-motion` | Pass | `motion-reduce:transition-none` present on option labels. |

---

## Responsive Design Verification

- **Mobile (375px)**: Partial fail — Q1 (short code block) lays out correctly, no overflow. Q2 (long single-line code) causes `main` to scroll horizontally. Text wraps correctly. Touch targets pass. Root cause: fieldset `min-width: min-content`.
- **Tablet (768px)**: Partial fail — Same fieldset issue. `main.hasHorizScroll: true` confirmed at this viewport.
- **Desktop (1440px)**: Pass in practice — the wide viewport provides enough space that the horizontal overflow in `main` is not noticeable to the user, but the structural overflow remains present (`card.scrollWidth: 1177px` vs `card.offsetWidth: 672px`).

---

## AC Verification Summary

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| AC1 | Code blocks, inline code, lists, bold/italic render | Pass | All 6 element types confirmed in live DOM |
| AC2 | Code blocks scroll horizontally, contrast ≥4.5:1 | Partial | Contrast passes (14.86:1). Scroll mechanism present but triggered at wrong level due to fieldset min-width. |
| AC3 | Mobile: text wraps, code blocks scroll WITHIN container | Partial | Text wraps (pass). Short code blocks fit (pass). Long code scrolls main, not pre (fail). |
| AC4 | `aria-labelledby` pattern, Markdown outside legend | Pass | All 4 question types use fieldset + aria-labelledby. Label targets resolve correctly. |

---

## Recommendations

1. **Fix `min-w-0` on all four fieldsets** (High Priority — blocks full AC3 pass): Add `min-w-0` to the `className` of `<fieldset>` in all four question components. This is a one-line change per file and is the correct CSS fix for fieldset's UA `min-width: min-content` behaviour.

2. **Consider adding `min-w-0` to MarkdownRenderer wrapper div**: The `<div>` wrapping `<Markdown>` in `MarkdownRenderer.tsx:63` also has no `min-w-0`. While the fieldset fix alone is sufficient, adding `min-w-0` to the MarkdownRenderer's root `div` as well provides defence-in-depth for future rendering contexts outside of fieldsets.

3. **Add a test case for the long-code-block overflow**: The E2E spec (`tests/e2e/story-14-4.spec.ts`) includes `q2-long-code-block` in the quiz data but the AC3 test should explicitly assert that `pre.scrollWidth > pre.clientWidth` (i.e., the `pre` itself is what scrolls, not `main`). This would have caught the fieldset issue automatically.

4. **No action needed on AC1, AC4, or contrast**: These all pass cleanly and are well-implemented.

---

*Review conducted via Playwright MCP browser automation with live DOM measurement at 375px, 768px, and 1440px viewports.*
