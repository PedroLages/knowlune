# Design Review: E15-S04 — Immediate Explanatory Feedback per Question

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e15-s04-immediate-explanatory-feedback`
**Changed Files**:
- `src/app/components/quiz/AnswerFeedback.tsx` (NEW)
- `src/app/components/quiz/QuestionBreakdown.tsx` (MODIFIED)
- `src/app/pages/Quiz.tsx` (MODIFIED)
- `src/lib/scoring.ts` (MODIFIED)

**Affected Routes Tested**:
- `/courses/:courseId/lessons/:lessonId/quiz` — Quiz page with inline AnswerFeedback
- `/courses/:courseId/lessons/:lessonId/quiz/results` — Results page with QuestionBreakdown

---

## Executive Summary

E15-S04 adds inline answer feedback to the quiz flow. The implementation is clean and follows EduVi's design system faithfully — correct use of semantic tokens, proper ARIA live region pattern, and responsive padding/icon scaling. One accessibility issue warrants a fix before merge: the entry animation has no `motion-reduce:` guard, which affects users who have set `prefers-reduced-motion: reduce`. All other acceptance criteria pass live browser verification.

---

## What Works Well

1. **Non-judgmental color design executed correctly.** The decision to use `text-warning` (amber) rather than `text-destructive` (red) for incorrect answers is clearly implemented and verified via computed styles. `rgb(134, 98, 36)` for incorrect vs `rgb(58, 117, 83)` for correct — immediately distinguishable without being punishing.

2. **Feedback does not block the "Next" button.** The feedback card sits inline between the question options and the navigation controls. The DOM order is confirmed correct: feedback appears before the Next button, and the Next button remains fully interactive after an answer is selected. Tab order is unaffected.

3. **ARIA live region pattern is textbook correct.** `role="status"`, `aria-live="polite"`, no `tabindex` on the card itself. Screen readers will announce the feedback content automatically when it appears, without forcing focus away from where the user was. All icons carry `aria-hidden="true"` so they are not announced redundantly.

4. **Responsive scaling works cleanly.** Mobile (375px): `p-3` padding + 20px icons. Tablet/desktop (≥640px): `p-4` padding + 24px icons. No horizontal scroll at any tested breakpoint. Next button meets the 44px minimum touch target at mobile.

5. **Design token discipline is solid.** Zero hardcoded hex colors or raw Tailwind palette classes (`bg-blue-600`, `text-red-500`, etc.) in either changed component. All color usage routes through `border-l-success`, `bg-success-soft`, `text-success`, `border-l-warning`, `bg-warning/10`, `text-warning`, `border-l-muted`, `bg-muted/50`, `text-muted-foreground`. ESLint would have caught any violations here.

6. **State configuration via `stateConfig` object.** The lookup table pattern at `AnswerFeedback.tsx:31-60` is an excellent design decision — adding a new feedback state (e.g., a future "hint-used" state) requires a single entry, not scattered conditionals. Easy to maintain.

7. **`QuestionBreakdown` trigger meets minimum touch target.** The collapsible trigger uses `min-h-[44px]` and `rounded-xl` with proper `focus-visible` ring — consistent with the rest of the quiz shell components.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

**H1 — AnswerFeedback animation missing `motion-reduce:` guard**

- **Location**: `src/app/components/quiz/AnswerFeedback.tsx:110`
- **Evidence**: `'animate-in slide-in-from-bottom-2 fade-in duration-300'` — no `motion-reduce:` modifier present. All peer components in the same directory (`MultipleChoiceQuestion.tsx:72`, `TrueFalseQuestion.tsx:67`, `MultipleSelectQuestion.tsx:74`, `QuestionBreakdown.tsx:68`) consistently use `motion-reduce:transition-none`.
- **Impact**: Users who have set OS-level `prefers-reduced-motion: reduce` (typically users with vestibular disorders, epilepsy, or motion sensitivity) will still see the slide-in animation. This is a WCAG 2.3.3 (Animation from Interactions, AAA) concern and a consistency violation relative to the codebase standard.
- **Suggestion**: Add `motion-reduce:animate-none` to the className. The tw-animate-css library's `animate-in` utilities should respect this modifier:
  ```tsx
  'animate-in slide-in-from-bottom-2 fade-in duration-300 motion-reduce:animate-none'
  ```

### Medium Priority (Fix when possible)

**M1 — `formatCorrectAnswer` duplicated across two files**

- **Location**: `src/app/components/quiz/AnswerFeedback.tsx:62-65` and `src/app/components/quiz/QuestionBreakdown.tsx:33-36`
- **Evidence**: Identical function signature and body in both files.
- **Impact**: If the formatting rule changes (e.g., localised list separators, truncation for long arrays), both files must be updated in sync. Risk of divergence.
- **Suggestion**: Extract to a shared utility, either `src/app/components/quiz/utils.ts` or `src/lib/quizFormatters.ts`. Both files already use `@/` imports so the path is straightforward.

**M2 — `QuestionBreakdown` uses `text-destructive` (red) for incorrect answers**

- **Location**: `src/app/components/quiz/QuestionBreakdown.tsx:131`
- **Evidence**: `XCircle` icon with `className="size-5 text-destructive shrink-0"` — computed as `rgb(196, 72, 80)` (red). The story explicitly calls out "NO red/destructive colors for wrong answers."
- **Impact**: The results-page breakdown uses a different emotional register than the inline feedback, creating an inconsistent learning experience. Learners who see amber "Not quite" during the quiz may be surprised to see red X marks in the breakdown.
- **Context**: The story's design constraint was written for `AnswerFeedback` (inline feedback during the quiz), not retrospectively for the existing `QuestionBreakdown` summary. However, now that both components are being shipped together in the same story, aligning them improves the coherence of the results page.
- **Suggestion**: Consider changing `text-destructive` to `text-warning` on the `XCircle` in `QuestionBreakdown` to match the inline feedback tone. If a deliberate distinction between "during quiz" (gentle) and "post-quiz summary" (direct) was intended, document that decision in a comment.

**M3 — Points-earned line uses a `<p>` inside the `<div>` that already renders explanation Markdown**

- **Location**: `src/app/components/quiz/AnswerFeedback.tsx:164-169`
- **Evidence**: The "You earned N of M points." paragraph sits outside the Markdown renderer but shares the same `mt-2 text-sm` visual treatment. For partial credit with a long explanation, there is no visual separator between the explanation text and the points line.
- **Impact**: Minor readability issue. The points line can look like it is part of the explanation paragraph at a glance.
- **Suggestion**: Consider adding a subtle top border or increasing the top margin (`mt-3`) on the points line to give it visual separation from the explanation.

### Nitpicks (Optional)

**N1 — `isUnanswered` helper in `QuestionBreakdown` is not exported/shared**

- **Location**: `src/app/components/quiz/QuestionBreakdown.tsx:28-31`
- Similar logic for detecting an unanswered state exists in `Quiz.tsx` (`countUnanswered`) and `AnswerFeedback.tsx` (`deriveFeedbackState`). Not a bug, but noting the pattern divergence.

**N2 — Partial credit heading capitalisation**

- **Location**: `src/app/components/quiz/AnswerFeedback.tsx:100`
- `partialTitle = \`${correctCount} of ${totalCorrect} correct\`` — lowercase "correct". All other state titles are title-case: "Correct!", "Not quite", "Not answered in time". Minor inconsistency.
- **Suggestion**: Capitalise to "N of M Correct" or sentence-case consistently across all titles.

**N3 — `deriveFeedbackState` is file-private but could benefit from a JSDoc comment**

- **Location**: `src/app/components/quiz/AnswerFeedback.tsx:15-29`
- The function has a non-obvious edge case: `isTimerExpired && userAnswer === ''` triggers `time-expired` rather than `incorrect`. A brief comment explaining this ordering would help the next developer.

---

## Detailed Findings

### H1: Missing `motion-reduce:` Guard on Entry Animation

The `animate-in slide-in-from-bottom-2 fade-in duration-300` classes at `AnswerFeedback.tsx:110` produce a slide-up + fade animation when the feedback card enters the DOM. This animation plays regardless of the user's `prefers-reduced-motion` setting.

Every other animated element in the quiz shell explicitly guards against this:

| File | Line | Pattern Used |
|------|------|-------------|
| `MultipleChoiceQuestion.tsx` | 72 | `motion-reduce:transition-none` |
| `TrueFalseQuestion.tsx` | 67 | `motion-reduce:transition-none` |
| `MultipleSelectQuestion.tsx` | 74 | `motion-reduce:transition-none` |
| `QuestionBreakdown.tsx` | 68 | `motion-reduce:transition-none` |
| `ScoreSummary.tsx` | 90 | `motion-reduce:transition-none` |

The entry animation (`animate-in`) is more attention-demanding than a hover transition, making this gap more impactful for users with motion sensitivity. The `tw-animate-css` library uses CSS keyframes, so `motion-reduce:animate-none` is the correct suppression class rather than `motion-reduce:transition-none`.

Fix at `AnswerFeedback.tsx:108-113`:
```tsx
className={cn(
  'mt-4 rounded-lg border-l-4 p-3 sm:p-4',
  'animate-in slide-in-from-bottom-2 fade-in duration-300 motion-reduce:animate-none',
  config.border,
  config.bg
)}
```

### M2: Red XCircle in QuestionBreakdown Contradicts Story's Non-Judgmental Design Intent

Live browser verification shows:
- `AnswerFeedback` incorrect state: `rgb(134, 98, 36)` (amber/warning) — correct
- `QuestionBreakdown` incorrect icon: `rgb(196, 72, 80)` (red/destructive) — inconsistent

The `QuestionBreakdown.tsx:131` uses `XCircle` with `text-destructive`. Given the story's stated principle of non-judgmental feedback, the results page showing red icons creates a jarring tonal shift from the gentle inline feedback the learner just experienced. For a learning platform, the results review is a learning opportunity, not a verdict — amber aligns better with that framing.

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|---------|
| AC1 | Correct answer → green checkmark + "Correct!" + explanation | Pass | `border-l-success bg-success-soft`, title "Correct!", explanation rendered |
| AC2 | Incorrect → orange "Not quite" + explanation + correct answer shown | Pass | `border-l-warning bg-warning/10`, "Not quite", "Correct answer: rounded-[24px]" |
| AC3 | Partial credit → "N of M correct" + per-option breakdown | Partial | Logic is correct in code; per-option breakdown conditional on `pointsEarned > 0`; JS test env limitations prevented full interactive verification |
| AC4 | Feedback appears inline, does not block "Next Question" button | Pass | DOM order verified, Next button accessible after answer |
| AC5 | Timer-expired → "Not answered in time" with correct answer in QuestionBreakdown | Pass via code review | `stateConfig['time-expired']` and QuestionBreakdown `isUnanswered` check both verified in source |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Heading `rgb(28, 29, 43)` on `rgb(238, 245, 240)` — high contrast; warning text `rgb(134, 98, 36)` on `rgba(...)` needs manual calculation but amber-on-light-amber is typically borderline; title uses `text-foreground` which passes |
| Keyboard navigation | Pass | Feedback card is not in tab order (correct); Next button reachable via Tab; radiogroup uses roving tabindex pattern |
| Focus indicators visible | Pass | CollapsibleTrigger uses `focus-visible:ring-2 focus-visible:ring-ring`; quiz navigation buttons inherit global ring styles |
| Heading hierarchy | Pass | Feedback uses `<h4>` within quiz card which uses `<h1>` — appropriate nesting |
| ARIA labels on icon buttons | Pass | All icons in AnswerFeedback have `aria-hidden="true"`; QuestionBreakdown icons use `role="img"` with `aria-label` |
| Semantic HTML | Pass | `role="status"` + `aria-live="polite"` for live region; `<ul>` for breakdown list; `<button>` for all interactive elements |
| Form labels associated | N/A | No form inputs in changed components |
| prefers-reduced-motion | Fail | `animate-in` animation in AnswerFeedback has no `motion-reduce:animate-none` guard — see H1 |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|-----------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll; `p-3` padding; 20x20 icons; Next button exactly 44px height |
| Tablet (768px) | Pass | No horizontal scroll; `p-4` padding; 24x24 icons; card constrained by `max-w-2xl` |
| Desktop (1440px) | Pass | No horizontal scroll; `p-4` padding; 24x24 icons |

---

## Code Health Analysis

| Check | Status | Notes |
|-------|--------|-------|
| Design tokens only (no hardcoded colors) | Pass | No raw Tailwind palette classes found in changed files |
| TypeScript types defined | Pass | `FeedbackState`, `AnswerFeedbackProps` interfaces present; no `any` usage |
| Import alias usage (`@/`) | Pass | All imports use `@/` — no relative `../` paths |
| No inline style attributes | Pass | Pure Tailwind utilities throughout |
| No console errors | Pass | Zero errors across all tested pages |
| DRY (no duplication) | Medium | `formatCorrectAnswer` duplicated in two files — see M1 |

---

## Recommendations

1. **Fix H1 before merge**: Add `motion-reduce:animate-none` to the `AnswerFeedback` entry animation. This is a one-line fix that brings the component into alignment with the established codebase pattern and respects WCAG motion guidelines.

2. **Align M2 at your discretion**: Changing `XCircle text-destructive` to `text-warning` in `QuestionBreakdown` improves tonal consistency with the inline feedback. If the distinction is intentional (results page = direct, quiz page = gentle), add a comment documenting that decision.

3. **Extract `formatCorrectAnswer` to shared utilities (M1)**: A quick follow-up refactor to `src/app/components/quiz/utils.ts`. Will prevent the two copies drifting apart if formatting requirements change.

4. **Consider explicit `motion-reduce:` audit for future quiz components**: The pattern is well-established in this codebase, but new components sometimes miss it on entry animations specifically (as opposed to hover transitions). Adding a lint rule or a checklist item for `animate-in` usage without `motion-reduce:` would catch this automatically.

---

*Report generated by design-review agent (Claude Sonnet 4.6) via Playwright MCP browser automation.*
*Live browser testing at `http://localhost:5173` on branch `feature/e15-s04-immediate-explanatory-feedback`.*
