## Test Coverage Review: E14-S04 — Support Rich Text Formatting in Questions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Code blocks, inline code, lists, bold/italic render correctly | `MarkdownRenderer.test.tsx:6-91` (code block, inline code, ul, ol, bold, italic); `MultipleChoiceQuestion.test.tsx:123-163`; `MultipleSelectQuestion.test.tsx:17-43`; `FillInBlankQuestion.test.tsx:17-43` | `story-14-4.spec.ts:107-154` (4 tests) | Covered |
| 2 | Code block scrolls horizontally; contrast >=4.5:1; light+dark theme tokens | `MarkdownRenderer.test.tsx:6-16` (overflow-x-auto class); `MarkdownRenderer.test.tsx:83-91` (pre reset styles) | `story-14-4.spec.ts:160-264` (horizontal scroll, real WCAG luminance ratio light, real WCAG luminance ratio dark) | Covered |
| 3 | Mobile 375px — text wraps, code blocks scroll independently, content readable | None (no mobile unit test possible in JSDOM) | `story-14-4.spec.ts:270-301` (no horizontal scroll on page, questionText does not overflow, code block overflow-x:auto at 375px) | Covered |
| 4 | Markdown rendered outside `<legend>` via `aria-labelledby`; visual association preserved | `MultipleChoiceQuestion.test.tsx:241-277`; `TrueFalseQuestion.test.tsx:118-153`; `MultipleSelectQuestion.test.tsx:45-63`; `FillInBlankQuestion.test.tsx:45-63` | `story-14-4.spec.ts:307-320` (fieldset aria-labelledby present and references element containing question text) | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/story-14-4.spec.ts:160-174` (confidence: 75)**: The horizontal-scroll test for AC2 verifies `overflow-x: auto` on the `<pre>` computed style, which confirms the CSS property is applied but does not confirm that the code block actually requires scrolling (i.e., that `scrollWidth > clientWidth`). The long-code question (q2) does not guarantee overflow at the default Chromium viewport. A test that explicitly asserts `pre.scrollWidth > pre.clientWidth` after navigating to question 2 would make the "scrolls horizontally when too wide" AC bullet testable as behavior rather than CSS property. Fix: add `await expect(pre.evaluate(el => el.scrollWidth > el.clientWidth)).resolves.toBe(true)` after navigating to q2.

- **`tests/e2e/story-14-4.spec.ts:220-264` (confidence: 72)**: The dark mode E2E test calls `page.emulateMedia({ colorScheme: 'dark' })` before `navigateToQuiz`, which correctly activates dark mode. However the contrast assertion uses the same canvas-readback helper duplicated verbatim from the light mode test (lines 187-215). This duplication means future changes to the helper will need to be applied in two places. Confidence is moderate because this is a maintainability concern, not a correctness gap. Fix: extract the WCAG ratio computation into a shared Playwright helper function (e.g., `tests/support/helpers/wcag-contrast.ts`) used by both tests.

#### Medium

- **`src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx` (confidence: 65)**: The `MarkdownRenderer` source handles three additional element types — links (`a`), images (`img`), and tables (`table`) — none of which have unit test coverage. Links are intentionally rendered as `<span>` (navigation prevention), images get `max-w-full`, and tables get an `overflow-x-auto` wrapper. These are real behaviors described in the XSS/safety documentation comment. While they are not explicitly called out in any AC, they are part of the component's public contract. Suggested additions in `MarkdownRenderer.test.tsx`:
  - `it('renders links as plain text span (no navigation)')` — assert `<a>` is not present, `<span>` is.
  - `it('wraps tables in overflow-x-auto container')` — assert outer `div.overflow-x-auto` wraps `<table>`.

- **`src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx` (confidence: 62)**: The component handles `content ?? ''` defensively for a `null`/`undefined` prop, but no unit test exercises this path. Given the prop type is `string` (not `string | null | undefined`), this guard is purely defensive; however it indicates a real concern the author anticipated. A test for `content=""` (empty string) would also confirm the component renders without error or layout shift. Fix: add `it('renders empty content without error', ...)` with `render(<MarkdownRenderer content="" />)` asserting no throw and an empty wrapper div.

- **`src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx` (confidence: 68)**: The `MultipleSelectQuestion` tests cover only Markdown rendering and the `aria-labelledby` pattern (3 tests). Unlike the `MultipleChoiceQuestion` tests (19 tests), there is no coverage for: checkbox interaction (toggle on/off), pre-selected state rendering, disabled state in review modes, touch target class (`min-h-12`), or keyboard shortcut toggling. These are not AC1-4 concerns for E14-S04 specifically, but the component has no prior test file — this story introduced the first tests for it. The gap should be remedied, ideally in a follow-up story or as a separate task. Confidence is moderate because the missing tests do not block AC coverage.

- **`src/app/components/quiz/__tests__/FillInBlankQuestion.test.tsx` (confidence: 68)**: Same pattern as `MultipleSelectQuestion` — only 3 tests introduced by this story (Markdown rendering + aria-labelledby). The debounced `onChange` behavior, `handleBlur` flush, character counter (`counterId`), `maxLength` enforcement, and disabled state in review mode are all untested. The debounce logic in particular (`DEBOUNCE_MS = 300`, `userEdited` ref, `timerRef` cleanup) is non-trivial and has no test exercising the timing path or the cleanup return. Fix: expand `FillInBlankQuestion.test.tsx` with at least: input renders with `aria-describedby` counter, disabled state in review mode, and `handleBlur` triggers `onChange` synchronously.

#### Nits

- **Nit `tests/e2e/story-14-4.spec.ts:307-320` (confidence: 55)**: The AC4 E2E test asserts `labelledBy` is truthy and the referenced element is visible and contains "JavaScript". It only tests the `multiple-choice` question (q1). The `true-false` question (q2 in the E2E data) also uses the same `aria-labelledby` pattern and would give broader coverage. Since unit tests for `TrueFalseQuestion`, `MultipleSelectQuestion`, and `FillInBlankQuestion` all verify the pattern, the E2E spot-check on one question type is acceptable. No action required.

- **Nit `src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx:83-91` (confidence: 50)**: The test for "resets inline code styles inside `<pre>` blocks" checks for `[&>code]:bg-transparent` and `[&>code]:p-0` class strings on the `<pre>` element. These are Tailwind arbitrary-value classes and the assertion is checking className strings, which is an implementation detail. If Tailwind purges or renames these classes, the test could fail without the behavior changing. A stronger assertion would use `getComputedStyle` in JSDOM (which won't resolve Tailwind) or accept this as a class-contract test. Low impact since the class approach is consistent with the rest of the unit test suite.

- **Nit `tests/e2e/story-14-4.spec.ts:86-88` (confidence: 50)**: `localStorage.setItem('knowlune-sidebar-v1', 'false')` is seeded inside `addInitScript` correctly. This is good practice per the project memory rule. No action required.

---

### Edge Cases to Consider

1. **`MarkdownRenderer` with content containing raw HTML** — the component intentionally strips raw HTML by not using `rehype-raw`. No test currently confirms that injected HTML (e.g., `<script>alert(1)</script>`) is rendered as escaped text rather than executed. A unit test asserting no `<script>` element appears in the rendered output would provide regression protection for the XSS safety comment at `MarkdownRenderer.tsx:19`.

2. **Very long inline code strings** — `inline code` inside a paragraph does not get `overflow-x-auto` (only `<pre>` blocks do). A very long inline code token on mobile could cause horizontal overflow of the paragraph. This is an edge case not covered by any mobile test. Worth a manual smoke-test at 375px with a long inline code string.

3. **Markdown in question option text** — the question `options` array strings are rendered as plain text (not via `MarkdownRenderer`) in `MultipleChoiceQuestion` and `TrueFalseQuestion`. If a quiz author puts Markdown in an option label, it will not render. This is likely intentional but is not documented or tested as a boundary. No test verifies that option text is NOT parsed as Markdown.

4. **`aria-labelledby` with dynamically generated `useId()` values** — the E2E test at `story-14-4.spec.ts:313-318` constructs the selector as `page.locator('[id="${labelledBy}"]')`. React's `useId()` generates IDs like `:r0:` that contain colons. The `locator` string interpolation may fail to match if the `:` characters are not properly escaped for CSS selectors. The test currently passes (per testing notes), which means Playwright's `locator` handles the raw `id` attribute match without CSS escaping. This is worth noting as a fragile pattern if the selector were ever changed to `#${labelledBy}` (which would require `CSS.escape()`). The unit tests use `CSS.escape()` correctly at `MultipleChoiceQuestion.test.tsx:256`.

---

ACs: 4 covered / 4 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 2
