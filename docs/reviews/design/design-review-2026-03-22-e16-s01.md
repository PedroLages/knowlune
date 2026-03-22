# Design Review — E16-S01: Quiz Review Page

**Review Date:** 2026-03-22
**Reviewed By:** Claude Code (design-review agent via Playwright MCP)
**Branch:** `feature/e16-s01-review-all-questions-and-answers-after-completion`
**Changed Files:**
- `src/app/components/quiz/PerformanceInsights.tsx`
- `src/app/components/quiz/ReviewQuestionGrid.tsx`
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`
- `src/app/pages/QuizResults.tsx`
- `src/app/pages/QuizReview.tsx`
- (+ `QuizReviewContent.tsx`, `AnswerFeedback.tsx` — implicitly reviewed)

**Affected Routes:** `/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId`
**Test Attempt Used:** `attempt-e15s05-01` (quiz `quiz-e15s05-mixed` — 5 questions, 3 correct/2 incorrect, mixed state)
**Viewports Tested:** Desktop 1440×900, Tablet 768×1024, Mobile 375×667

---

## Executive Summary

E16-S01 delivers a well-structured quiz review page that allows learners to step through their completed quiz attempt question by question with clear correct/incorrect feedback. The implementation is largely solid — correct use of design tokens throughout, no hardcoded colours, full responsive behaviour, and meaningful semantic structure. Three findings warrant attention before merge: a duplicate "Back to Results" element creates redundancy that may confuse screen readers, the error state is missing `role="alert"` so screen readers won't be notified on navigation failure, and there is a heading-level gap (H1 → H4) in the feedback banner.

---

## What Works Well

1. **Design token compliance is exemplary.** Every colour class in the new files uses semantic tokens (`bg-success-soft`, `bg-warning/10`, `text-success`, `text-warning`, `text-brand`, `text-foreground`, `text-muted-foreground`). Zero hardcoded hex values were found across all changed files.

2. **Correct/incorrect visual differentiation is clear and non-judgmental.** Correct answers receive green (`bg-success-soft`, `border-success`) and incorrect answers receive amber (`bg-warning/10`, `border-warning`) — a deliberate "Not quite" tone rather than alarming red. Both states also display simultaneously when navigating an incorrect question (the user's wrong answer is amber-highlighted while the correct answer is green-highlighted), which is excellent pedagogical design.

3. **Touch targets are consistently 44×44px across all breakpoints.** Navigation buttons (Previous/Next/Back to Results), question-grid circle buttons, and answer option rows all meet the minimum at desktop, tablet, and mobile. The `min-h-[44px]` pattern is applied consistently.

4. **Responsive layout is clean with no horizontal overflow.** At 375px the card uses `p-4` (16px padding), at 768px it switches to `p-8` (32px), and at 1440px the card is appropriately constrained to `max-w-2xl`. No horizontal scroll was detected at any breakpoint.

5. **`prefers-reduced-motion` is respected.** The progress bar uses `motion-reduce:transition-none motion-safe:transition-all`, and the `AnswerFeedback` component uses `motion-reduce:animate-none`. This is an accessibility win that is often missed.

6. **The question-jump grid is an excellent UX addition.** Colour-coded circle buttons (green for correct, amber for incorrect, brand-blue for current) let learners see their overall score pattern at a glance and jump to any question directly. Each button carries an `aria-label` like "Question 3, incorrect" and `aria-current="step"` for the active question — well-implemented.

7. **Skeleton loading state is properly ARIA-annotated** with `role="status"`, `aria-busy="true"`, and `aria-label="Loading quiz review"`.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1: Duplicate "Back to Results" elements on the last question**

- **Location:** `src/app/components/quiz/QuizReviewContent.tsx:83–113`
- **Evidence:** On question 5 (the last question), two "Back to Results" controls are present simultaneously: a `<Button variant="brand">` inside the `<nav aria-label="Review navigation">` element AND the always-visible `<a>` link at the bottom of the card. Their computed sizes were `133.8×44px` (button) and `121.8×44px` (link), both fully tappable. The button appears 16px above the link in the visual hierarchy.
- **Impact:** Screen readers will encounter "Back to Results" twice in sequence during linear navigation. A learner using a screen reader who has already activated the button link may be confused to hear the same label again immediately after. It also slightly inflates the cognitive load of the final question view — two identical affordances create uncertainty about which to use.
- **Suggestion:** On the last question, the always-visible `<a>` link at the bottom already provides reliable navigation back. Consider either (a) hiding the back link on the last question when the button is already visible, or (b) keeping only the always-visible link and removing the contextual button. The always-visible link is arguably the better pattern since it remains consistent across all questions — predictability matters more than prominence here.

---

**H2: Error state missing `role="alert"` — screen readers not notified on navigation failure**

- **Location:** `src/app/pages/QuizReview.tsx:42–58` (`QuizReviewError` component)
- **Evidence:** Navigating to `/courses/test-course/lessons/test-lesson/quiz/review/nonexistent-attempt-id` renders the error card correctly visually (amber AlertCircle icon, "Quiz attempt not found" heading, descriptive paragraph, back link). However, `document.querySelector('[role="alert"]')` returned null. The card has no live region announcement.
- **Impact:** A screen reader user who follows a stale link from a notification or shared URL will hear nothing change — the page title remains "Knowlune" and no announcement is made. They would need to manually explore the page to discover the error. For learners using assistive technology this creates a dead-end experience with no feedback.
- **Suggestion:** Add `role="alert"` (or `aria-live="assertive"`) to the outer card `<div>` in `QuizReviewError`. The `role="alert"` pattern is appropriate here because it is an error that requires immediate attention — unlike `role="status"` (polite) used for the feedback banner.

---

### Medium Priority (Fix when possible)

**M1: Heading hierarchy skips from H1 to H4 in the feedback banner**

- **Location:** `src/app/components/quiz/AnswerFeedback.tsx:113`
- **Evidence:** The page heading is `<h1>JavaScript Fundamentals — Review</h1>`. The feedback banner uses `<h4 className="font-semibold text-lg text-foreground">{title}</h4>` ("Correct!" or "Not quite"). No H2 or H3 headings exist between them.
- **Impact:** Screen reader users navigating by heading (a common shortcut) will jump from H1 directly to H4 with no structural context. WCAG 2.4.6 (AAA) requires headings to describe topic/purpose; skipping levels creates confusion about nesting. For learners who rely on heading navigation to skim review content, this makes the feedback feel semantically detached from the question.
- **Suggestion:** Change the feedback banner's `<h4>` to a `<p>` with `role="status"` (already present on the wrapper), or use `<h2>` to correctly nest under the page H1. Given the feedback is already inside a `role="status"` live region that announces to screen readers, demoting to a styled `<p>` is the lower-risk fix.

---

**M2: Focus indicator width is 1.11px — below WCAG 2.2 recommendation**

- **Location:** Sidebar navigation links and all interactive elements (system-wide, not specific to this story)
- **Evidence:** When tabbing through the page, focused elements show `outlineWidth: "1.11111px"` (the rendered width of Tailwind's `ring-1` / `focus-visible:ring-[3px]` — the value computed to ~1.1px at this zoom level). WCAG 2.2 Success Criterion 2.4.11 (AA) requires focus indicators to have a minimum area equivalent to the perimeter of the component × 2px.
- **Impact:** This is a system-wide concern, not introduced by this story. Noting it here as it affects the review page equally. For learners who are low-vision or motor-impaired and rely on keyboard navigation, thin focus rings become invisible against dark backgrounds.
- **Suggestion:** Increase to `focus-visible:ring-2` (2px) or `focus-visible:ring-[3px]` with sufficient contrast. The `QuizReviewContent.tsx` navigation buttons already use `focus-visible:ring-[3px] focus-visible:ring-ring/50` which is better, but the question grid buttons only use `focus-visible:ring-[3px]` without the `ring/50` offset which should be verified visually.

---

**M3: Template literal Tailwind classes in `FillInBlankQuestion.tsx` may cause purge issues**

- **Location:** `src/app/components/quiz/questions/FillInBlankQuestion.tsx:116`
- **Evidence:** The review feedback div uses string interpolation: `` `mt-2 rounded-lg p-3 text-sm ${isCorrect ? 'bg-success-soft text-foreground' : 'bg-warning/10 text-foreground'}` ``. While both branches use design tokens (no hardcoded colours), the dynamic class construction pattern means Tailwind's static scanner cannot guarantee these classes will be included in the production bundle unless the full class strings appear elsewhere.
- **Impact:** In production builds, `bg-success-soft` or `bg-warning/10` could be absent from the CSS bundle if they don't appear as complete strings elsewhere in the source. This would cause a silent visual regression where the fill-in-blank review state renders without background colour.
- **Suggestion:** Replace the template literal with a `cn()` conditional: `cn('mt-2 rounded-lg p-3 text-sm', isCorrect ? 'bg-success-soft text-foreground' : 'bg-warning/10 text-foreground')`. Both classes are already used in `AnswerFeedback.tsx`, so the purge risk may be low in practice, but the pattern should be corrected for correctness.

---

### Low Priority (Nitpicks)

**L1: `radiogroup` is missing an accessible name**

- **Location:** `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` (inferred from rendered output)
- **Evidence:** `document.querySelector('[role="radiogroup"]').getAttribute('aria-labelledby')` returned `null` (the radiogroup has no explicit label). The question text is in a sibling `<div>` with `aria-labelledby` on the `<fieldset>`, but the inner `radiogroup` div does not inherit this association.
- **Impact:** Screen readers may announce the radiogroup without context ("radio group" with no name). Since the question fieldset is `aria-labelledby` the question text, the association is likely still conveyed for most AT, but a direct `aria-labelledby` on the radiogroup pointing to the question text ID would make the relationship unambiguous.
- **Suggestion:** Add `aria-labelledby={labelId}` to the radiogroup `<div>`, where `labelId` is the ID of the question text container — the same ID used on the fieldset.

**L2: The `status` live region has no `aria-atomic`**

- **Location:** `src/app/components/quiz/AnswerFeedback.tsx:102`
- **Evidence:** `role="status"` with `aria-live="polite"` but `aria-atomic` is absent (defaults to `false`). When navigating between questions, the status div updates its content entirely (correct/incorrect banner replaces previous content). With `aria-atomic="false"`, some screen readers may only announce the changed portion rather than the whole feedback.
- **Suggestion:** Add `aria-atomic="true"` to ensure the full feedback message ("Correct! — You earned 1 of 1 point") is announced as a complete unit when the question changes.

**L3: `← Back to Quiz` uses a literal arrow character in the error state**

- **Location:** `src/app/pages/QuizReview.tsx:53`
- **Evidence:** The back link text in the error state is `← Back to Quiz`. The `←` character (U+2190) reads as "left-pointing arrow" or may be skipped depending on screen reader verbosity settings. The working review page uses a proper Lucide `<ArrowLeft>` icon with `aria-hidden="true"`.
- **Suggestion:** Replace the literal `←` with a `<ArrowLeft className="size-4" aria-hidden="true" />` component, consistent with the pattern used in `QuizReviewContent.tsx:111` and `QuizResults.tsx:176`.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | All text uses `text-foreground` (rgb 232,233,240) on dark card (rgb 36,37,54) — approximately 9:1. Muted text `rgb(178,181,200)` on card — approximately 5.8:1. |
| Keyboard navigation | Pass | Tab order is logical: Previous → Next/Back to Results → Q1→Q5 grid → Back to Results link. Disabled radio buttons intentionally removed from tab order in review mode. |
| Focus indicators visible | Partial | Focus rings present but `outlineWidth` computed at ~1.1px system-wide. Question grid and nav buttons have `focus-visible:ring-[3px]` which is better but still merits verification. |
| Heading hierarchy | Fail | H1 → H4 skip in feedback banner. No H2 or H3 between page title and "Correct!"/"Not quite" headings. |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label`. Question grid buttons: "Question 1, correct" etc. Navigation buttons labelled by visible text. |
| Semantic HTML | Pass | `<nav>` for navigation regions, `<fieldset>` for question groups, `<button>` for all interactive elements, `<a>` for the back link. No `<div onClick>` patterns found. |
| Form labels associated | Pass | Fieldset uses `aria-labelledby` referencing question text ID. |
| `prefers-reduced-motion` | Pass | Progress bar and AnswerFeedback animation both respect `motion-reduce:`. |
| Live regions for dynamic content | Partial | `role="status" aria-live="polite"` on feedback — good. `aria-atomic` missing (L2). Error state missing `role="alert"` (H2). |
| Error messages specific and helpful | Pass | "Quiz attempt not found — The quiz attempt you are looking for does not exist or may have been deleted." is clear and actionable. |

---

## Responsive Design Verification

| Breakpoint | Overflow | Card Padding | Touch Targets | Layout |
|------------|----------|--------------|---------------|--------|
| Mobile 375px | None | 16px (p-4) | All 44px | Single column, bottom nav visible |
| Tablet 768px | None | 32px (p-8) | All 44px | Card fills ~78% width, collapsible sidebar |
| Desktop 1440px | None | 32px (p-8) | All 44px | Persistent sidebar, card max-w-2xl centred |

All three breakpoints pass. The `sm:p-8` responsive padding breakpoint works correctly.

---

## Code Health

- No hardcoded hex colours across all reviewed files
- No inline `style=` attributes in any new components
- All imports use `@/` alias correctly
- `cn()` utility used from correct path (`@/app/components/ui/utils`)
- Template literal Tailwind class interpolation in `FillInBlankQuestion.tsx:116` should be migrated to `cn()` (see M3)
- TypeScript interfaces defined for all props
- Zero console errors, one pre-existing warning (`apple-mobile-web-app-capable` meta tag — not introduced by this story)

---

## Recommendations (Prioritised)

1. **Fix the duplicate "Back to Results" [H1]** — remove or hide the always-visible link when on the last question (where the branded button is already present), or remove the contextual button and use only the link. Either approach reduces cognitive redundancy for all learners.

2. **Add `role="alert"` to the error state [H2]** — a one-line change in `QuizReviewError` that ensures screen reader users receive immediate notification of the failure on navigation.

3. **Fix the heading gap H1→H4 [M1]** — change the `<h4>` in `AnswerFeedback.tsx:113` to a `<p>` (the live region wrapper already handles announcement) or to `<h2>`.

4. **Migrate template literal Tailwind in `FillInBlankQuestion.tsx:116` to `cn()` [M3]** — low-effort, eliminates potential production bundle purge risk.

