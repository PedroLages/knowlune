---
story_id: E18-S03
story_name: "Ensure Semantic HTML and Proper ARIA Attributes"
status: in-progress
started: 2026-03-23
completed:
reviewed: true
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 18.3: Ensure Semantic HTML and Proper ARIA Attributes

## Story

As a screen reader user,
I want quiz components to use proper semantic HTML,
So that I can understand the structure and navigate efficiently.

**FRs Fulfilled: QFR45**

## Acceptance Criteria

**Given** quiz components use form controls
**When** rendering questions
**Then** radio button groups use `<fieldset>` and `<legend>`
**And** all inputs have associated `<label>` elements
**And** related controls are grouped logically

**Given** quiz pages render
**When** inspecting the document structure
**Then** headings follow a logical hierarchy (h1 for quiz title, h2 for question, h3 for subsections)
**And** a `<nav>` landmark wraps the question grid navigation
**And** the quiz content area uses `<main>` with `<section>` for distinct regions (question area, navigation, timer)

**Given** quiz displays dynamic content
**When** content changes (feedback, score, warnings)
**Then** appropriate ARIA roles are used (`role="status"`, `role="alert"`)
**And** `aria-atomic="true"` ensures full message is read

**Given** quiz has navigation controls
**When** rendering buttons and links
**Then** all have descriptive accessible names
**And** icon-only buttons have `aria-label` (e.g., aria-label="Next question")

**Given** quiz displays timer or progress
**When** showing countdown or progress bar
**Then** `role="timer"` is used for the countdown display with `aria-live="off"` (warning announcements are handled separately by Story 18.2's tiered live region)
**And** `role="progressbar"` is used for question progress
**And** `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are set correctly

## Tasks / Subtasks

- [ ] Task 1: Add semantic form controls to question components (AC: 1)
  - [ ] 1.1 Wrap radio groups in `<fieldset>` with `<legend>`
  - [ ] 1.2 Ensure all inputs have associated `<label>` elements
  - [ ] 1.3 Group related controls logically
- [ ] Task 2: Add landmark structure to quiz pages (AC: 2)
  - [ ] 2.1 Add logical heading hierarchy (h1 > h2 > h3)
  - [ ] 2.2 Wrap question grid navigation in `<nav>`
  - [ ] 2.3 Use `<main>` with `<section>` for distinct regions
- [ ] Task 3: Add ARIA roles for dynamic content (AC: 3)
  - [ ] 3.1 Add `role="status"` and `role="alert"` where appropriate
  - [ ] 3.2 Add `aria-atomic="true"` for full message reading
- [ ] Task 4: Add accessible names to navigation controls (AC: 4)
  - [ ] 4.1 Add descriptive accessible names to all buttons/links
  - [ ] 4.2 Add `aria-label` to icon-only buttons
- [ ] Task 5: Add ARIA attributes for timer and progress (AC: 5)
  - [ ] 5.1 Add `role="timer"` with `aria-live="off"` to countdown
  - [ ] 5.2 Add `role="progressbar"` with aria-value* attributes to progress indicator

## Design Guidance

[Optional -- populated by /start-story if UI story detected]

## Implementation Plan

See [plan](plans/e18-s03-ensure-semantic-html-proper-aria-attributes.md) for implementation approach.

## Implementation Notes

**Key decisions:**
- Empty `<legend className="sr-only" />` used instead of legend with question text to avoid duplicate text nodes (which break `getByText()` locators in strict mode). The `aria-labelledby` on the fieldset provides the accessible name.
- `<section>` landmarks added to Quiz.tsx active state (not a second `<main>` — Layout provides the outer `<main>`).
- Two progressbars in QuizHeader: visual `<Progress>` (0-100 percentage) + sr-only `<div role="progressbar">` (1-based question count per AC5).
- QuestionGrid `role="toolbar"` kept — it's already inside `<nav aria-label="Quiz navigation">`, satisfying the landmark requirement.
- story-12-6 pre-existing test failures (2): E17 added difficulty badges causing `getByText('100%')` ambiguity on results page — not caused by this story.

## Testing Notes

Testing requirements from epic:
- Automated axe-core scan -> zero violations
- Manual screen reader test -> all controls announced correctly
- Landmark navigation -> proper structure (main, nav, sections)
- Heading hierarchy check -> logical h1 > h2 > h3 nesting

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

Reviewed 2026-03-23. Report: `docs/reviews/design/design-review-2026-03-23-e18-s03.md`

- **[HIGH]** `QuizHeader.tsx:47` — sr-only progressbar shares `aria-label="Quiz progress"` with visual bar; distinguish labels
- **[HIGH]** `AnswerFeedback.tsx:114` — `<h4>` skips h3, violating WCAG 1.3.1; change to `<h3>`
- **[MEDIUM]** Section `aria-label="Quiz header"` should describe content: `"Quiz progress and timer"`
- **[MEDIUM]** Dual-progressbar (visual + sr-only) renders correctly with zero visual regression across all breakpoints

## Code Review Feedback

Reviewed 2026-03-23. Reports: `docs/reviews/code/code-review-2026-03-23-e18-s03.md`, `docs/reviews/code/code-review-testing-2026-03-23-e18-s03.md`, `docs/reviews/code/edge-case-review-2026-03-23-e18-s03.md`

**Blockers:**
- `AnswerFeedback.tsx:114` — `<h4>` skips `<h3>`, violating AC2 heading hierarchy and WCAG 1.3.1
- `QuizHeader.tsx:39,47` — both progressbars have identical `aria-label="Quiz progress"`; sr-only one must be differentiated

**High:**
- All 4 question components: empty `<legend />` provides no accessible name; should use `<legend className="sr-only">{question.text}</legend>` for AT fallback
- `Quiz.tsx:435` — `currentProgress.questionOrder.length` without `?.` will throw if `questionOrder` is null/undefined
- `Quiz.tsx:445-447` — `currentQuestionIndex` can be undefined → NaN in sr-only h2 heading text
- Missing AC3 test for `role="alert"` on timer warnings
- `QuizHeader.tsx:36-42` — explicit `aria-label="Quiz progress"` on `<Progress>` loses the dynamic "45% complete" label

**Medium:**
- `QuizHeader.tsx:44-51` — `aria-valuenow` can exceed `aria-valuemax` on off-by-one; clamp with `Math.min`
- `QuizActions.tsx:28-46` — focus lost when last question is reached (Next button unmounts); need fallback focus target
- Add untimed-quiz test asserting `role="timer"` is absent when no `timeLimit`

**Nits:** `aria-label` on buttons with visible text causes voice-control divergence; add `data-testid` to sr-only progressbar for stable selectors

## Web Design Guidelines Review

Reviewed 2026-03-23. Report: `docs/reviews/code/web-design-guidelines-2026-03-23-e18-s03.md`

- **[MEDIUM]** `QuizHeader.tsx:39,47` — two identically-named progressbars (same finding as code review)
- **[MEDIUM]** Triple-announcement of question position (sr-only h2, visible p, sr-only progressbar) — redundant for AT users
- No blockers; touch targets, motion-reduce, design tokens, keyboard nav, landmark structure all pass

## Challenges and Lessons Learned

**Duplicate text nodes from `<legend>` with visible content:**
The first approach placed the question text inside `<legend>` for semantic correctness. This caused `getByText()` to find two elements (one in the legend, one in the visible question text), breaking Playwright's strict-mode locators. The fix was to use an empty `<legend className="sr-only" />` (visually hidden but structurally present) and rely on `aria-labelledby` pointing to the visible question heading. This pattern — empty/sr-only legend + aria-labelledby — satisfies both WCAG fieldset labelling rules and DOM uniqueness for tests.

**`<main>` vs `<section>` for page regions:**
Quiz.tsx couldn't use a second `<main>` element because Layout.tsx already provides the outer `<main>`. Adding nested `<main>` elements is invalid HTML. The correct approach is `<section aria-label="...">` for distinct content regions within the existing `<main>`. This applies to any component that renders inside a layout wrapper.

**Two progressbars for single progress concept:**
AC5 requires `role="progressbar"` with 1-based question-count values (e.g., `aria-valuenow=2` for question 2 of 10, `aria-valuemax=10`). The existing shadcn `<Progress>` component renders a visual 0–100 percentage bar. Rather than modify the visual bar's ARIA values (which would show 20% visually but claim to be question 2), the solution was to keep the visual bar untouched and add an sr-only `<div role="progressbar">` with the correct 1-based values. This avoids diverging visual and semantic representations.

**`role="toolbar"` coexists with `<nav>` landmark:**
The QuestionGrid already used `role="toolbar"` for the question navigation buttons. Adding a `<nav aria-label="Quiz navigation">` wrapper satisfies the landmark requirement without removing `role="toolbar"` — the two are independent: landmark vs. widget role. This was validated by the E2E test checking that `nav[aria-label="Quiz navigation"]` contains the toolbar.

**Pre-existing unit test failures from E17:**
Two unit tests in `Courses.test.tsx` (localStorage collapse state) fail on both `main` and this branch — caused by E17's difficulty badges creating `getByText()` ambiguity. These are inherited debt, not regressions introduced by E18-S03. Confirmed by running the failing tests in isolation on `main`.

**ARIA live region separation of concerns:**
`role="timer"` requires `aria-live="off"` per AC5 because constant time updates would be extremely noisy for screen reader users. Warning announcements (low-time alerts) are handled by Story 18.2's tiered live region infrastructure — not the timer element itself. This separation avoids both silent timers and over-announcing designs.
