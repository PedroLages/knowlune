## Test Coverage Review: E18-S04 — Verify Contrast Ratios and Touch Targets

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Normal text >=4.5:1 contrast ratio (light mode) | None | `story-e18-s04.spec.ts:101` (axe-core scan on start screen + all question types + answered state) | Covered |
| 2 | Non-text UI components >=3:1 contrast | None | `story-e18-s04.spec.ts:101` (same axe-core scans; axe `color-contrast` rule covers both text and UI component boundaries via wcag21aa tag set) | Covered |
| 3 | Interactive elements >=44px touch targets on mobile | None | `story-e18-s04.spec.ts:252–352` (7 direct boundingBox assertions across start button, MC options, TF options, Prev/Next, fill-in-blank input, MarkForReview label, no-horizontal-scroll) | Covered |
| 4 | Focus indicators >=3:1 contrast, >=2px thick | `MultipleChoiceQuestion.test.tsx:307`, `TrueFalseQuestion.test.tsx:183` | `story-e18-s04.spec.ts:360–395` (3 `.toBeFocused()` assertions) | Partial |
| 5 | Dark mode: all contrast ratios meet WCAG 2.1 AA | None | `story-e18-s04.spec.ts:206–243` (axe-core scan in dark mode on start screen + active quiz with answered state) | Covered |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None — all five ACs have at least one test.

---

#### High Priority

**`tests/e2e/story-e18-s04.spec.ts:360–395` (confidence: 87)**
AC4 focus indicator tests only assert `.toBeFocused()` — they confirm the element can receive focus but do not verify the contrast or thickness of the rendered ring. The AC specifies >=3:1 contrast and >=2px thickness. The fix changed `ring-ring/50` to `ring-brand` in three components; the tests do not verify that `ring-brand` is applied or that the rendered ring meets the contrast threshold. A complete AC4 test would need either (a) an axe-core scan triggered while a specific element is focused (axe's `color-contrast` rule on focus styles), or (b) a CSS property assertion using `page.evaluate` to read the computed `outline-color` / `box-shadow` value and check it is the brand token value, not a near-white neutral. The current three tests would pass even if the fix were reverted back to `ring-ring/50`.

Suggested test: in `tests/e2e/story-e18-s04.spec.ts`, extend the AC4 describe block with:
```
'AC4: Question grid button focus ring uses brand token (not ring-ring)'
```
Focus the element, then assert `await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor)` is not `rgba(0,0,0,0)` and not the neutral `rgb(180,180,180)` family. Alternatively, trigger an axe scan after programmatically focusing the element so axe evaluates focus-visible styles.

**`src/app/components/quiz/ReviewQuestionGrid.tsx:33` (confidence: 85)**
`ReviewQuestionGrid` was not modified in this story and still carries the unfixed focus ring: `focus-visible:ring-[3px] focus-visible:ring-ring/50`. This is the same pattern the story explicitly identified as a near-1:1 contrast failure. None of the E2E tests cover the review flow (post-submission question review screen), so this component's focus ring is neither fixed nor tested. An axe scan on the review/results page while a `ReviewQuestionGrid` button is focused would catch this failure at runtime.

Suggested test: `'AC4: Review question grid buttons show brand focus ring on keyboard focus'` in the Focus Indicators describe block, navigating to `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz/results` after seeding an attempt (using `makeAttempt` + `seedQuizAttempts`), then focusing a ReviewQuestionGrid button and running an axe scan.

**`src/app/components/quiz/QuizReviewContent.tsx:109` (confidence: 75)**
The "Back to Results" `<Link>` inside `QuizReviewContent` uses `focus-visible:ring-ring` (not `ring-brand`), which is also a contrast failure by the same logic as the components this story fixed. This element is reachable only on the post-quiz review screen, which is not navigated to by any test in this spec. Coverage of this element's focus contrast is zero.

Suggested test: AC4 review-mode focus scan (same test as described for `ReviewQuestionGrid` above) would also exercise this link.

---

#### Medium

**`tests/e2e/story-e18-s04.spec.ts:262–277` (confidence: 72)**
The multiple-choice touch target test walks answer options via `options.nth(i).locator('xpath=ancestor::label')`. The XPath ancestor traversal is fragile — if the label element is restructured (e.g., a wrapping `div` inserted between the radio and its label), the locator silently resolves to no element and `boundingBox()` returns `null`, causing the test to fail on the null check rather than on the sizing assertion. A more resilient approach would use `page.getByRole('radio').nth(i)` then walk to the containing clickable region via `locator('..').locator('..')` up to a known testid, or add `data-testid="answer-option"` to the label element and select directly. This is a selector quality concern, not an AC gap.

**`tests/e2e/story-e18-s04.spec.ts:249–353` (confidence: 68)**
Touch target tests use `test.use({ viewport: { width: 375, height: 667 } })` inside the describe block, which overrides the viewport for those tests. However, the spec does not seed `localStorage.setItem('knowlune-sidebar-v1', 'false')` at a point that is guaranteed to fire before the 375px viewport is active. The `seedAndNavigateToQuizStart` helper does set this key, but it does so after `page.goto('/')` at the default viewport — then the 375px viewport applies for subsequent navigations within the describe. Because each test constructs a fresh browser context, and `test.use` sets the viewport from the start of each test, the sidebar seed fires while the page is already at 375px width. Per the project's sidebar gotcha documentation, at 375px (which falls in the 640-1023px Sheet-overlay range), the sidebar defaults `open: true` if localStorage is empty at first render. The `seedAndNavigateToQuizStart` helper does set the key before the quiz navigation, so this is likely safe in practice — but worth noting because the key is set after `page.goto('/')` renders, which means the sidebar may flash open momentarily before the key is read on the subsequent navigation.

**`tests/e2e/story-e18-s04.spec.ts:383–394` (confidence: 65)**
The fill-in-blank focus test at line 383 is titled "AC4: Fill-in-blank input shows focus on focus" — the title is tautological and the comment at line 388 says "Navigate to Q4" without explaining what AC4 behavior is being verified. Minor readability issue; rename to "AC4: Fill-in-blank input receives and holds keyboard focus."

---

#### Nits

**Nit `tests/e2e/story-e18-s04.spec.ts:1–11` (confidence: 55)**: The file-level comment accurately maps ACs 1-5, which is good. However AC2 ("Non-text UI elements >=3:1 contrast") is tested implicitly through the same axe scans as AC1 — they share test bodies entirely. Consider separating the AC1/AC2 label in test names to `'AC1: Normal text passes WCAG 2.1 AA axe-core audit'` and adding a dedicated axe scan that scans only `[role=button]` elements to make the AC2 intent explicit in the test output.

**Nit `tests/e2e/story-e18-s04.spec.ts:136` (confidence: 50)**: The true/false and multiple-select navigation tests use `page.getByRole('button', { name: 'Question 2' })` and `'Question 3'` as hard-coded strings that depend on the question grid rendering "Question N" as the accessible label. These are correct per the current `QuestionGrid` aria-label format (`aria-label={\`Question ${i + 1}...\`}`), but are fragile if the label format changes. Adding a `data-testid="question-grid-item-{i}"` attribute to the grid buttons would provide a more stable selector that does not couple the test to a specific label string pattern.

**Nit `tests/e2e/story-e18-s04.spec.ts:338` (confidence: 50)**: The "Mark for Review" touch target test selects via `page.getByText('Mark for Review')`. This will match any text node containing that string — including any toast, tooltip, or aria-label that happens to contain the phrase. Prefer `page.getByRole('checkbox', { name: /mark for review/i }).locator('xpath=ancestor::label')` or add `data-testid="mark-for-review-label"` to the label element.

---

### Edge Cases to Consider

1. **ReviewQuestionGrid focus ring**: `src/app/components/quiz/ReviewQuestionGrid.tsx:33` still uses `focus-visible:ring-ring/50` — the same failing pattern this story fixed in `QuestionGrid`. The story tasks list only `QuestionGrid` as fixed; this sibling component in the review flow was missed. No test covers it.

2. **Large text contrast threshold**: The AC in the story file includes "large text (>=18pt or >=14pt bold) has >=3:1 contrast ratio." The axe-core scans cover this rule (included in `wcag2aa` tag), but there is no explicit test that navigates to a state where large text (e.g., the question title at `text-2xl font-bold` in `QuizReviewContent`) is visible. The review-mode screen is never visited by any test in this spec.

3. **Multiple-select touch target**: The spec tests MC and TF option heights but has no equivalent test for multiple-select checkboxes (`type: 'multiple-select'`). The checkbox labels use the same `min-h-12` class as MC options, so the real value is `min-h-[48px]` which exceeds 44px, but no test confirms this explicitly.

4. **QuestionGrid button is 44px exactly**: `size-11` in Tailwind resolves to 44px (2.75rem). The touch target tests verify answer option labels are >=44px tall, but no test measures the QuestionGrid navigation buttons themselves. These buttons are used on mobile to jump between questions and represent a distinct touch-target surface.

5. **Dark mode focus contrast**: The dark mode axe scans run on the start screen and on an active quiz with an answered question — but the axe scan is not triggered while any element is focused. Axe evaluates static computed styles; it may not evaluate `focus-visible` pseudo-class styles unless the element is actually focused at scan time. This means the `ring-brand` fix for dark-mode focus contrast may not be exercised by the AC5 tests.

---

ACs: 5 covered / 5 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 3
