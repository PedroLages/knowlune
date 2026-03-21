# Design Review Report — E13-S01: Navigate Between Questions

**Review Date**: 2026-03-20
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e13-s02-mark-questions-for-review`
**Changed Files**:
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/QuizNavigation.tsx`
- `src/app/pages/Quiz.tsx`

**Affected Routes**: `/courses/{courseId}/lessons/{lessonId}/quiz`

---

## Executive Summary

E13-S01 delivers a well-executed quiz navigation system with correct Previous/Next button behaviour, functional question grid bubbles, and proper Submit Quiz reveal on the last question. The implementation is clean — zero hardcoded colors, no inline styles, correct design token usage throughout. Three issues require attention before this is considered fully production-ready: a React controlled/uncontrolled warning on the RadioGroup during first answer selection, an `aria-current` value that is semantically imprecise, and a missing `aria-label` on the Submit Quiz button.

---

## What Works Well

- **All core navigation AC pass**: Previous disabled on Q1, Next advances questions, Submit Quiz correctly replaces Next on the last question, bubble click-to-jump works, answer persistence verified across forward and back navigation.
- **Design token discipline**: Zero hardcoded colors or pixel spacing in any of the four changed files. All bubble states (`bg-brand`, `bg-brand-soft`, `bg-card`) use correct semantic tokens.
- **Touch targets**: All interactive elements meet or exceed 44×44px on mobile. Bubbles are exactly 44×44px via `min-w-[44px] min-h-[44px]`. Action buttons use `min-h-[44px]`.
- **Responsive layout**: The `nav` element correctly switches from `flex-col` on mobile (<640px) to `flex-row` on tablet/desktop (≥640px via `sm:flex-row`). No horizontal overflow at any breakpoint tested.
- **Semantic structure**: The quiz navigation is wrapped in a `<nav aria-label="Quiz navigation">` landmark. The progress bar has `aria-label`, `aria-valuenow`, `aria-valuemax`, and `aria-valuetext`. Heading hierarchy is correct (single H1).
- **Keyboard navigation**: Tab order flows logically through Previous → Next/Submit → bubble 1 → bubble 2 → bubble 3. Enter activates focused buttons correctly. Focus indicators are visible on all elements.
- **Focus rings**: Action buttons use shadcn's `focus-visible:ring-[3px]` box-shadow ring. Bubbles show a 2px solid outline at 2px offset on focus. Both are clearly visible.
- **No console errors**: Zero JavaScript errors across all navigation interactions tested.
- **Composition architecture**: Separating `QuizActions`, `QuestionGrid`, and `QuizNavigation` into distinct files with typed interfaces follows Single Responsibility Principle well.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1 — RadioGroup controlled/uncontrolled React warning**
- **Issue**: The `RadioGroup` in `MultipleChoiceQuestion.tsx` receives `value={value}` where `value` starts as `undefined` (no answer yet), then transitions to a string on first selection. React warns: "RadioGroup is changing from uncontrolled to controlled." This occurs on every first answer per question, and again when navigating back to an unanswered question.
- **Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:49`
- **Evidence**: Console warning captured 3 times during test session — on first answer, on backward navigation to an answered question (controlled → uncontrolled), and on return (uncontrolled → controlled).
- **Impact**: While not user-visible today, this is a React anti-pattern that can cause unpredictable re-render behaviour and silent state management bugs, particularly if the Radix RadioGroup primitive has edge-case handling differences between controlled/uncontrolled modes.
- **Suggestion**: Pass `value={value ?? ''}` to keep the RadioGroup always controlled. An empty string will not match any option, so no option will appear selected — identical visual result to `undefined`, but without the controlled/uncontrolled transition warning.

### Medium Priority (Fix when possible)

**M1 — `aria-current="true"` should be `aria-current="step"`**
- **Issue**: The active question bubble uses `aria-current="true"`. The `aria-current` attribute accepts `"page"`, `"step"`, `"location"`, `"date"`, `"time"`, or `"true"`. For a sequential question position in a wizard-like flow, `"step"` is semantically correct.
- **Location**: `src/app/components/quiz/QuestionGrid.tsx:32`
- **Evidence**: `aria-current={isCurrent ? 'true' : undefined}` — observed in accessibility snapshot and computed attributes.
- **Impact**: Screen readers announce `aria-current="true"` as "current" with no context. `aria-current="step"` would announce as "current step" — more meaningful for learners using assistive technology who need to understand their position in a multi-step quiz.
- **Suggestion**: Change to `aria-current={isCurrent ? 'step' : undefined}`.

**M2 — Submit Quiz button has no `aria-label`**
- **Issue**: The Submit Quiz button (`QuizActions.tsx:41`) has no `aria-label`. While the visible text "Submit Quiz" is descriptive, the button is dynamically rendered (replaces Next) and its appearance represents a significant workflow transition. Screen reader users navigating by button would benefit from additional context about the consequence.
- **Location**: `src/app/components/quiz/QuizActions.tsx:41`
- **Evidence**: Confirmed `ariaLabel: null` in computed button properties. Accessibility snapshot shows `button "Submit Quiz"` with no additional description.
- **Impact**: Low — the visible text is self-describing. However, `aria-describedby` pointing to a brief description ("Submitting will end the quiz and calculate your score") would make the high-stakes action clearer for screen reader users.
- **Suggestion**: Add `aria-describedby` referencing a visually hidden description element, or at minimum add `aria-label="Submit Quiz — ends the quiz"`. Given the unanswered-questions confirmation dialog already provides recovery, this is a polish item rather than a blocker.

**M3 — "undefined min" shown in quiz start screen details**
- **Issue**: The quiz start screen renders `"undefined min"` in the quiz metadata badges when `timeLimit` is absent from the quiz record.
- **Location**: `src/app/components/quiz/QuizStartScreen.tsx` (not in this story's changed files, but surfaced during testing)
- **Evidence**: `<span class="bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm">undefined min</span>` observed in the DOM before starting the quiz.
- **Impact**: Unprofessional presentation. A learner about to take a timed exam seeing "undefined min" creates distrust in the platform's reliability.
- **Suggestion**: Guard the time limit render: only show the duration badge when `timeLimit` is a valid number. This is out of scope for E13-S01 but should be filed as a defect.

### Nitpicks (Optional)

**N1 — Bubble visual sizing: `w-8 h-8` combined with `min-w-[44px] min-h-[44px]`**
- **Issue**: The bubble applies both `w-8 h-8` (32×32px) and `min-w-[44px] min-h-[44px]` (44×44px). The `min-*` wins at runtime (confirmed: computed size is 44×44px). The `w-8 h-8` classes are redundant dead code.
- **Location**: `src/app/components/quiz/QuestionGrid.tsx:34`
- **Suggestion**: Remove `w-8 h-8` and keep only `min-w-[44px] min-h-[44px]`. This eliminates the class conflict and makes the intent explicit — the touch target is the designed size.

**N2 — No `prefers-reduced-motion` accommodation in `QuizNavigation`**
- **Issue**: The progress bar in `QuizHeader` uses `motion-safe:transition-all motion-safe:duration-500` (which correctly respects `prefers-reduced-motion`). However, the question option labels in `MultipleChoiceQuestion` use `transition-colors duration-150` without the `motion-safe:` prefix.
- **Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:61`
- **Impact**: For users with vestibular disorders or motion sensitivity, answer option hover transitions will still fire even with `prefers-reduced-motion: reduce` set. The effect is subtle (color only, no transform) so this is low severity.
- **Suggestion**: Change `transition-colors duration-150` to `motion-safe:transition-colors motion-safe:duration-150`.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Pass | Counter text `rgb(178,181,200)` on `rgb(36,37,54)` card — estimated ~5.2:1 in dark mode |
| Text contrast ≥3:1 (large text) | Pass | Question text uses `text-foreground` on `bg-card` — system tokens ensure compliance |
| Keyboard navigation | Pass | Tab order: Previous → Next/Submit → Q1 bubble → Q2 → Q3. Enter activates all buttons |
| Focus indicators visible | Pass | Action buttons: 3px box-shadow ring. Bubbles: 2px solid outline at 2px offset |
| Heading hierarchy | Pass | Single H1 (quiz title). No skipped levels |
| ARIA labels on icon buttons | Pass | ChevronLeft/Right icons have `aria-hidden="true"`. Bubbles have `aria-label="Question N"` |
| Semantic HTML | Pass | `<nav aria-label="Quiz navigation">`, `<fieldset>/<legend>` for questions, `<button>` elements throughout (no div-as-button) |
| `aria-current` on active bubble | Partial Pass | Present and functional, but `"true"` should be `"step"` (M1) |
| ARIA labels on Submit Quiz button | Partial Pass | Visible text is descriptive; no `aria-describedby` for high-stakes action (M2) |
| Form labels associated | Pass | `RadioGroup` uses `aria-labelledby` pointing to `<legend id>`. Option `<label>` elements wrap `RadioGroupItem` |
| `prefers-reduced-motion` | Partial Pass | Progress bar: correct. Option hover transitions: missing `motion-safe:` prefix (N2) |
| Screen reader live regions | Pass | `aria-live="polite"` region present for dynamic content |
| No horizontal overflow | Pass | Verified at 375px, 768px, and 1440px viewports |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — Nav stacks vertically (`flex-direction: column`). All touch targets 44×44px. No horizontal overflow (`scrollWidth: 284px` within `clientWidth: 375px`).
- **Tablet (768px)**: Pass — Nav switches to row layout (`flex-direction: row`). No overflow.
- **Desktop (1440px)**: Pass — Quiz card `max-w-2xl` centers correctly. Padding scales from `p-4` to `sm:p-8`. No overflow (`scrollWidth: 1429px` within `clientWidth: 1440px`).

---

## Detailed Findings

### H1 — RadioGroup controlled/uncontrolled warning

- **Issue**: `value={value}` on `RadioGroup` where `value` is `string | undefined`, causing React controlled/uncontrolled transition warning on first answer and on navigation back to unanswered questions
- **Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:49`
- **Evidence**: 3× console warning `"RadioGroup is changing from uncontrolled to controlled"` captured during test session — on first answer, backward navigation, and return to unanswered question
- **Impact**: React component state instability; Radix primitive may have edge-case behaviour differences between controlled/uncontrolled modes that could surface as bugs under certain interaction patterns
- **Suggestion**: `value={value ?? ''}` — keeps RadioGroup always in controlled mode; empty string matches no option so visual behaviour is unchanged

### M1 — `aria-current` semantic precision

- **Issue**: `aria-current="true"` used for active question bubble; `"step"` is the correct value for a position in a sequential multi-step process
- **Location**: `src/app/components/quiz/QuestionGrid.tsx:32`
- **Evidence**: `aria-current={isCurrent ? 'true' : undefined}` in source; confirmed `aria-current="true"` in DOM
- **Impact**: Screen readers announce "current" without context; "current step" is more meaningful for learners using assistive technology
- **Suggestion**: `aria-current={isCurrent ? 'step' : undefined}`

### M2 — Submit Quiz missing accessible description

- **Issue**: Submit Quiz button has no ARIA description for a high-stakes destructive-adjacent action
- **Location**: `src/app/components/quiz/QuizActions.tsx:41`
- **Evidence**: Confirmed `ariaLabel: null` in computed attributes; button visible text "Submit Quiz" is the only semantic hook
- **Impact**: Screen reader users lack warning that this action ends the quiz and calculates their score; the confirmation dialog provides a safety net but only after activation
- **Suggestion**: Add `aria-describedby` pointing to a visually-hidden hint, or an `aria-label` that adds context: `aria-label="Submit Quiz — ends the quiz and shows your results"`

### N1 — Redundant sizing classes on bubble

- **Issue**: Both `w-8 h-8` (32px) and `min-w-[44px] min-h-[44px]` (44px) applied; min-* wins
- **Location**: `src/app/components/quiz/QuestionGrid.tsx:34`
- **Evidence**: Computed size confirmed as 44×44px; `w-8 h-8` has no effect
- **Suggestion**: Remove `w-8 h-8`

### N2 — Option hover transition not motion-safe

- **Issue**: `transition-colors duration-150` on answer option labels lacks `motion-safe:` guard
- **Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:61`
- **Evidence**: No `motion-safe:` prefix in class string; design principles require `prefers-reduced-motion` respect
- **Suggestion**: `motion-safe:transition-colors motion-safe:duration-150`

---

## Acceptance Criteria Validation

| AC | Description | Status | Evidence |
|----|-------------|--------|---------|
| AC1 | Previous/Next buttons work | Pass | Navigated Q1→Q2→Q3 via Next, Q3→Q2→Q1 via Previous |
| AC2 | Previous disabled on Q1 | Pass | `disabled` attribute present; opacity 0.5; pointer-events: none |
| AC3 | Submit Quiz on last question, Next hidden | Pass | Bubble click to Q3 shows Submit Quiz; Next not in DOM |
| AC4 | Click bubble jumps to that question | Pass | Q3 bubble click advanced from Q2 to Q3; Q1 Enter from Q3 returned to Q1 |
| AC5 | Answer auto-saved on navigation | Pass | Paris selected on Q1, navigated to Q2 and back — Paris still checked |
| AC6 | Touch targets ≥44×44px | Pass | Bubbles: 44×44px. Action buttons: height 44px |
| AC7 | Keyboard navigable (Tab, Enter/Space) | Pass | Tab traverses all nav elements; Enter activates bubble and jumps questions |
| AC8 | ARIA: `aria-label="Question N"`, `aria-current` on active bubble | Partial Pass | Labels present; `aria-current="true"` functional but should be `"step"` |
| AC9 | Responsive: stack vertically below 640px | Pass | `flex-direction: column` confirmed at 375px |

---

## Recommendations

1. **Fix the RadioGroup warning now (H1)**: The one-character change `value ?? ''` eliminates a class of state management risk and keeps the codebase warning-free. This is the highest-value fix relative to effort.

2. **Update `aria-current` to `"step"` (M1)**: A two-character change that meaningfully improves screen reader announcements for the substantial learner population using assistive technology.

3. **File a defect for "undefined min" (M3)**: This was observed in the quiz start screen (out of scope for E13-S01) and should be tracked separately. The `QuizStartScreen` component needs a guard on its `timeLimit` badge render.

4. **Remove `w-8 h-8` from bubble (N1)**: Eliminates dead code and makes the intentional 44px touch target explicit. Good hygiene for the next developer reading this component.

