## Test Coverage Review: E14-S04 — Support Rich Text Formatting in Questions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3.5/4 ACs tested (**88%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Code blocks (monospace, bg highlighting), inline code distinguished, lists with indentation, bold/italic | `MarkdownRenderer.test.tsx:6-64` (code blocks, inline code, lists, bold, italic); `MultipleChoiceQuestion.test.tsx:123-163` (bold, inline code, GFM strikethrough) | `story-14-4.spec.ts:107-154` (4 discrete tests) | Covered |
| 2 | Code blocks horizontal scroll, contrast >=4.5:1, light/dark themes using design tokens | `MarkdownRenderer.test.tsx:6-16` (overflow-x-auto class present); `MarkdownRenderer.test.tsx:83-91` (pre resets inner code styles) | `story-14-4.spec.ts:160-187` (horizontal scroll computed style; background color non-transparent) | Partial |
| 3 | Mobile 375px — text wraps, code blocks scroll independently, content readable | None | `story-14-4.spec.ts:193-218` (no page horizontal scroll; code block overflow-x: auto) | Partial |
| 4 | Markdown in legends uses aria-labelledby pattern | `MultipleChoiceQuestion.test.tsx:241-277` (fieldset + aria-labelledby present, referenced element exists); `TrueFalseQuestion.test.tsx:118-147` (fieldset + aria-labelledby present) | `story-14-4.spec.ts:224-237` (fieldset aria-labelledby, referenced element visible and contains text) | Covered |

**Coverage**: 2 ACs fully covered | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have at least one test.

---

#### High Priority

- **`tests/e2e/story-14-4.spec.ts:176-187` (confidence: 85)**: The AC2 contrast test does not verify a >=4.5:1 WCAG ratio. It only asserts `bgColor !== ''` and `bgColor !== 'rgba(0, 0, 0, 0)'`. A non-transparent background is necessary but not sufficient to satisfy "contrast >=4.5:1". The story notes explicitly call out a luminance computation approach ("computed actual luminance from computed RGB styles, verifying >=4.5:1 ratio programmatically"), which the test does not implement. The assertion is a presence check, not a contrast check.

  Fix: Extend the E2E test to extract both the `backgroundColor` of `pre` and the `color` of the inner `code` element, compute relative luminance for each channel, and assert the contrast ratio is >=4.5. A helper for this is straightforward with `page.evaluate`.

- **`tests/e2e/story-14-4.spec.ts` (confidence: 80)**: AC2 explicitly requires that "code blocks and inline code render correctly in both light and dark themes using design tokens." No test exercises dark mode. Toggling the app's color scheme (via `prefers-color-scheme` media feature emulation or adding the `dark` class to `<html>`) and verifying that `bg-surface-sunken` / `bg-muted` resolve to the dark-mode token values is entirely absent. The unit tests only check class names, not resolved CSS custom property values.

  Fix: Add an E2E test that calls `page.emulateMedia({ colorScheme: 'dark' })` before navigating, then asserts that the `pre` element's computed `backgroundColor` differs from the light-mode value and remains non-transparent.

- **`src/app/components/quiz/__tests__/` (confidence: 78)**: `MultipleSelectQuestion` and `FillInBlankQuestion` are both refactored to use `MarkdownRenderer` (confirmed in source), but neither component has a dedicated unit test file for its new Markdown behaviour. The only coverage for these two components comes from `QuestionDisplay.test.tsx`, which dispatches to them without exercising any Markdown content in either. AC1 states that bold/italic, inline code, and code blocks should work "in questions" — implying all four question types. Two of four question types have no Markdown unit test.

  Fix: Add `MultipleSelectQuestion.test.tsx` and `FillInBlankQuestion.test.tsx` (or extend `QuestionDisplay.edge-cases.test.tsx`) with at least one Markdown rendering assertion each — e.g., `makeQuestion({ type: 'multiple-select', text: 'What does `Array.map` return?' })` and asserting the `<code>` element is present with correct class names.

---

#### Medium

- **`src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx:83-91` (confidence: 72)**: The test for "resets inline code styles inside `<pre>` blocks" asserts that `pre.className` contains `[&>code]:bg-transparent` and `[&>code]:p-0`. These are Tailwind arbitrary-variant class strings — they verify what class strings are in the DOM, not whether the CSS actually resets the `<code>` background inside `<pre>`. In jsdom (the Vitest environment), Tailwind classes are not processed, so the assertions confirm only that the class string was written, not that the visual reset occurs. This is an inherent jsdom limitation, but the test name implies behavioral verification. It is acceptable given the environment, but should be annotated to set expectations.

  Fix: Add a comment to the test noting it verifies class presence, not computed styles, and that the visual reset is verified by the E2E contrast test.

- **`tests/e2e/story-14-4.spec.ts:193-204` (confidence: 70)**: The AC3 "text wraps without horizontal scroll" test checks `document.documentElement.scrollWidth > clientWidth` at the page level. This detects page-level horizontal overflow but does not verify that text within the question container wraps naturally (i.e., that `word-break` or `overflow-wrap` is applied). A wide word that causes layout shift but does not trigger document scroll (e.g., because the quiz container itself clips overflow) would pass the test while failing the AC.

  Fix: Add a secondary assertion that checks the question text container's `scrollWidth <= clientWidth` directly: `page.locator('[data-testid="question-text"]').evaluate(el => el.scrollWidth <= el.clientWidth)`.

- **`src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx:118-131` (confidence: 68)**: The `aria-labelledby` test for `TrueFalseQuestion` asserts only that `fieldset` has a truthy `aria-labelledby` attribute. It does not verify that the referenced element actually exists in the DOM (unlike `MultipleChoiceQuestion.test.tsx:241-258` which resolves the `labelId` and queries `#${labelId}`). If the `id` were generated but the `<div>` with that id were removed, the TrueFalseQuestion test would still pass.

  Fix: Extend the TrueFalseQuestion `aria-labelledby` test to resolve the `labelId` and assert `container.querySelector('#${labelId}')` is present, mirroring the MultipleChoiceQuestion pattern.

---

#### Nits

- **Nit** `tests/e2e/story-14-4.spec.ts:112-113` (confidence: 55)**: `page.locator('pre')` and `page.locator('code')` are unscoped element selectors. If the quiz page ever renders `<pre>` or `<code>` elements outside the question area (e.g., in debug panels or help text), these selectors would silently match the wrong element. Prefer scoping to the question container: `page.locator('[data-testid="question-text"] pre')`.

- **Nit** `src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx:66-74` (confidence: 50)**: The paragraph spacing test asserts `paragraphs.length >= 2` rather than exactly 2. This is intentionally permissive but could hide a regression where extra `<p>` elements are emitted unexpectedly. Consider asserting `toHaveLength(2)` and documenting why if react-markdown emits trailing paragraphs.

- **Nit** `tests/e2e/story-14-4.spec.ts:80-94` (confidence: 50)**: `seedQuizData` is called inside `navigateToQuiz` after the first `page.goto('/')`. Because `seedIndexedDBStore` seeds data into the live page context after navigation, any race between the seed write and the quiz page rendering could cause intermittent failures if the quiz page loads before the seed resolves. The established project pattern seeds data before navigation. Consider seeding before `page.goto('/')` or using `addInitScript` for deterministic ordering.

---

### Edge Cases to Consider

- **Empty Markdown string**: `MarkdownRenderer` is never tested with `content=""`. An empty string is a valid edge case (question with no text) — the component should render nothing or a minimal wrapper without throwing.

- **Markdown with only whitespace**: Related to above — `content="   "` or `content="\n\n"` would render blank paragraphs. The question components do not guard against this before passing to `MarkdownRenderer`.

- **Very long unbroken inline code**: An inline `code` element containing a 200-character variable name with no spaces would not wrap and could overflow its container on mobile. Neither unit nor E2E tests cover this boundary.

- **Nested Markdown in list items**: None of the unit tests verify that a list item containing inline code (e.g., `- Use \`Array.map\` here`) renders correctly — specifically that the inline code inside `<li>` gets `bg-muted` styling rather than inheriting `<pre>` resets.

- **GFM table rendering**: `remarkGfm` is enabled, which supports tables. No styling override is defined in `markdownComponents` for `table`, `thead`, `tbody`, `tr`, `th`, `td`. A question containing a Markdown table would render with browser-default unstyled table markup. This is an unguarded extension point in the implementation.

- **AC4 coverage for MultipleSelectQuestion and FillInBlankQuestion**: The E2E `aria-labelledby` test (AC4) uses only the first `fieldset` on the page, which is the `multiple-choice` question. There is no unit or E2E test verifying that `MultipleSelectQuestion` and `FillInBlankQuestion` also implement the `aria-labelledby` pattern. Both components do implement it (confirmed in source), but the pattern is untested for them.

---

ACs: 3.5 covered / 4 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 3
