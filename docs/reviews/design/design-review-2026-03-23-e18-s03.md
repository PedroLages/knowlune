# Design Review Report — E18-S03

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e18-s03-ensure-semantic-html-proper-aria-attributes`
**Changed Files**:
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/components/quiz/QuizTimer.tsx`
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/AnswerFeedback.tsx`
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`

**Affected Routes Tested**: `/courses/test-course-e18s03/lessons/test-lesson-e18s03/quiz`

---

## Executive Summary

E18-S03 adds semantic HTML landmarks, a proper heading hierarchy, ARIA roles for dynamic widgets, and accessible names to quiz navigation controls. The changes are purely additive — no visual regression was detected at any tested breakpoint. All ARIA additions are either `sr-only` (invisible to sighted users) or attribute-only (no DOM structure changes), confirming zero layout impact.

---

## What Works Well

1. **Zero visual regression across all breakpoints.** The `section aria-label` wrappers, `sr-only` h2, and empty `legend` elements produce no layout shift. Computed card geometry, padding, and border-radius are unchanged from baseline at 1440px, 768px, and 375px.

2. **Dual-progressbar pattern is cleanly executed.** The visual `<Progress>` (percentage-based, aria-valuemax=100) and the sr-only `<div role="progressbar">` (question-count-based, aria-valuemax=2) are both present in the ARIA tree. The sr-only element correctly uses `clip: rect(0px,0px,0px,0px)` — it is visually invisible but accessible to screen readers.

3. **Timer `role="timer"` with `aria-live="off"` is correct.** The live countdown does not announce on every tick. Minute-boundary announcements are delegated to the separate sr-only `<span aria-live="polite" aria-atomic="true">` which updates only at meaningful intervals, preventing announcement flood.

4. **Navigation button accessible names are unambiguous.** `aria-label="Previous question"` and `aria-label="Next question"` override the generic icon+text labels, giving screen readers the question-scoped context that sighted users get from position. These had no visual effect — the visible "Previous"/"Next" text is unchanged.

5. **All touch targets pass at mobile (375px).** Navigation buttons (Previous: 111×44px, Next: 85×44px, Question grid: 44×44px), radio option wrappers (284×62px), and the Mark for Review label (284×44px) all meet the 44×44px minimum. The 16×16px Radix radio indicator dots are not standalone interactive targets — their 284×62px `<label>` wrapper is the actual click target.

6. **`aria-atomic="true"` on AnswerFeedback is correctly scoped.** The feedback container (`role="status" aria-live="polite" aria-atomic="true"`) ensures the entire card — title, explanation, and correct answer — is announced as a single unit when it appears, rather than as a stream of fragments. This matters especially for "Not quite" states where the correct answer text follows.

7. **Empty `<legend className="sr-only">` pattern is sound.** All four question types (`MultipleChoice`, `MultipleSelect`, `TrueFalse`, `FillInBlank`) use `aria-labelledby` on the `<fieldset>` for accessible naming, and the empty legend satisfies the HTML spec's structural requirement without adding duplicate text to the accessibility tree. Computed clip confirms proper hiding.

8. **No hardcoded colors, no inline styles, no console errors.** The changed files are clean — no `#rrggbb` literals, no `style={}` attributes, and zero quiz-related console errors or warnings during testing.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

#### H1: Duplicate `aria-label="Quiz progress"` on both progressbars

**Issue**: Both the visual `<Progress>` component and the sr-only `<div role="progressbar">` share the identical accessible name `aria-label="Quiz progress"`. In the ARIA tree they appear as two consecutive `progressbar "Quiz progress"` nodes. Screen readers will announce both when navigating landmarks, and the names give no indication of which provides percentage vs. question-count values.

**Location**: `src/app/components/quiz/QuizHeader.tsx:39` and `src/app/components/quiz/QuizHeader.tsx:47`

**Evidence**: Accessibility snapshot shows:
```
- progressbar "Quiz progress" [ref=e162]    ← visual, valuenow=50, valuemax=100
- progressbar "Quiz progress" [ref=e164]    ← sr-only, valuenow=1, valuemax=2
```

**Impact**: A screen reader user navigating by landmarks or using "next form element" will encounter two identically-named progressbars with different value semantics. This creates confusion: "which Quiz progress is at 50%? which is at 1 of 2?" The sr-only version exists precisely to communicate question count, but its name must distinguish it from the visual one to deliver that value.

**Suggestion**: Differentiate the sr-only progressbar's label to reflect its question-count semantics. Options:
- `aria-label="Quiz question progress"` on the sr-only div
- `aria-label="Question 1 of 2"` (mirroring the visible paragraph text below)
- `aria-label="Questions completed"` 

The visual `<Progress>` could also be made `aria-hidden="true"` since the sr-only version fully covers the screen reader need, though that depends on whether the percentage value is independently useful to AT users.

---

#### H2: AnswerFeedback uses `<h4>` with no `<h3>` in the heading hierarchy

**Issue**: The visible heading hierarchy in the active quiz view jumps from `<h2>` (sr-only, "Question 1 of 2") directly to `<h4>` (visible, "Correct!" in AnswerFeedback). No `<h3>` exists anywhere in the quiz card. WCAG 1.3.1 (Info and Relationships) requires that heading levels are not skipped.

**Location**: `src/app/components/quiz/AnswerFeedback.tsx:114`

**Evidence**: Full heading hierarchy found at runtime:
```
H1 — "Accessibility Test Quiz"           18px/600  visible
H2 — "Question 1 of 2"                   20px/400  sr-only
H4 — "Correct!"                          18px/600  visible  ← H3 skipped
```

**Impact**: Screen reader users navigating by headings (`H` key in NVDA/VoiceOver) encounter a gap at H3. This is a WCAG 1.3.1 violation and would fail an automated axe-core audit. For a learner using heading navigation to skim quiz feedback, the skip creates an unexpected structural hole.

**Suggestion**: Change `<h4>` to `<h3>` in `AnswerFeedback.tsx:114`. The feedback card sits at the third level of the document outline (page > quiz section > feedback within a question), so `<h3>` is semantically correct. No visual change is required — the `font-semibold text-lg` classes provide the visual treatment independently of the heading tag.

---

### Medium Priority (Fix when possible)

#### M1: Section landmark label "Quiz header" is imprecise

**Issue**: `<section aria-label="Quiz header">` wraps `QuizHeader` and `TimerWarnings`. The label "Quiz header" describes the component name rather than its purpose. Screen reader users navigating landmarks will hear "Quiz header region" without understanding what it contains.

**Location**: `src/app/pages/Quiz.tsx:442`

**Evidence**: ARIA tree shows `region "Quiz header"` directly, surfacing to AT as a named landmark.

**Impact**: Landmark names should describe content purpose for navigation. "Quiz header" is an implementation detail. A more communicative label would help screen reader users decide whether to enter the region.

**Suggestion**: Consider `aria-label="Quiz progress and timer"` or `aria-label="Quiz overview"`. This makes the region's purpose scannable during landmarks navigation (`D` key in NVDA).

#### M2: h2's default browser font-size is larger than h1

**Issue**: The sr-only `<h2>` has a computed font-size of 20px (browser default for h2) while `<h1>` is styled to 18px (`text-lg`). Though this has no visual impact (the h2 is fully sr-only), it represents a heading where the subordinate level has a visually larger intrinsic size than its parent, which could create confusion if the sr-only class is ever removed.

**Location**: `src/app/pages/Quiz.tsx:456`

**Evidence**: Computed styles:
```
H1: font-size 18px, font-weight 600
H2: font-size 20px (browser default), font-weight 400 (browser default)
```

**Impact**: Low risk while sr-only. If the h2 becomes visible in a future state (e.g., a non-sr-only variant), it would appear larger than the h1, breaking visual hierarchy.

**Suggestion**: Add `text-sm` or `text-base` to the sr-only h2 class list so it carries explicit sizing tokens: `<h2 className="sr-only text-base">`. This is defensive and costs nothing visually.

#### M3: `<section aria-label="Question area">` contains `<MarkForReview>`

**Issue**: The `MarkForReview` control is rendered inside the "Question area" section (Quiz.tsx:494–500) even though it is a navigation/utility action rather than question content. The section boundary ends after `MarkForReview`, placing a persistent UI control semantically inside the question content region.

**Location**: `src/app/pages/Quiz.tsx:494–501`

**Evidence**: ARIA tree section nesting:
```
region "Question area"
  heading "Question 1 of 2" [level=2]
  group "What is the capital of France?"
    ...radio options...
  checkbox "Mark for Review"    ← inside question area section
```

**Impact**: Screen reader users navigating the "Question area" region to interact with question content will also encounter the review-marking control within that region. This creates a mild semantic mismatch — the mark-for-review control is a quiz-level action, not part of the question content itself.

**Suggestion**: Move `<MarkForReview>` outside the "Question area" section, either as a sibling section with `aria-label="Question actions"` or within the "Quiz navigation" nav element if semantically appropriate.

---

### Nitpicks (Optional)

#### N1: `aria-label` on buttons with visible text is redundant

`aria-label="Previous question"` and `aria-label="Next question"` override the visible "Previous" / "Next" button text. While the context-adding labels are useful here (they make the control more specific), the pattern technically creates a discrepancy between the visible label ("Previous") and the accessible name ("Previous question"). WCAG 2.5.3 (Label in Name) requires the accessible name to *contain* the visible text, which these do — but reviewers of the PR may flag this pattern.

**Location**: `src/app/components/quiz/QuizActions.tsx:31` and `43`

**Suggestion**: This is acceptable and passes WCAG 2.5.3 since "Previous question" contains "Previous". No action needed, but a comment noting the intentional override would prevent future cleanup attempts.

#### N2: `TimerWarnings` live regions present but currently empty

In the ARIA tree, both a `status` and an `alert` appear inside "Quiz header" at their initial empty state. These are the TimerWarnings live regions, correctly present but not yet populated (no warning threshold hit during testing). This is by design, but worth confirming their initial state is truly empty (not containing stale content from a prior quiz session).

**Location**: `src/app/components/quiz/TimerWarnings.tsx` (unchanged file, not diff'd)

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | H1 `rgb(232,233,240)` on `rgb(36,37,54)` — dark mode card. Timer muted text on same dark bg passes ≥4.5:1. AnswerFeedback "Correct!" on `rgb(26,46,34)` passes. |
| Keyboard navigation | Pass | Tab sequence: radio indicator → Next button → Mark for Review → Question 1 → Question 2. Logical order. |
| Focus indicators visible | Pass | Brand focus ring (`oklab(0.45 ... / 0.5) 0px 0px 0px 3px`) confirmed on Next button. Radio wrappers have matching ring. |
| Heading hierarchy | Fail | H2 → H4 skip in AnswerFeedback (see H2 finding). H1→H2 is correct. |
| ARIA labels on icon buttons | Pass | Previous/Next have `aria-label`. All icons have `aria-hidden="true"`. |
| Semantic HTML | Pass | `<section>` landmarks, `<nav>`, `<fieldset>` with `<legend>`, `<h1>` in header — all present and correctly used. |
| Form labels associated | Pass | Each `<fieldset>` has `aria-labelledby` pointing to the question text div. |
| `prefers-reduced-motion` | Pass | `motion-reduce:animate-none` on AnswerFeedback, `motion-reduce:transition-none` on option labels. |
| Dual progressbar distinction | Fail | Both share `aria-label="Quiz progress"` — see H1 finding. |
| `aria-live` regions | Pass | Timer uses `aria-live="off"` + sr-only polite span for minute announcements. Feedback uses `aria-live="polite" aria-atomic="true"`. |
| Touch targets ≥44×44px | Pass | All interactive elements in quiz card meet minimum at 375px. |
| No horizontal scroll at mobile | Pass | Confirmed at 375px viewport. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Desktop (1440px) | Pass | Card: 608px wide, centered with shadow. Timer inline with h1. Progress bar full width. Question grid at 44×44px per button. |
| Tablet (768px) | Pass | Card: 672px, no horizontal overflow. Timer stays inline. Nav buttons 44px height maintained. |
| Mobile (375px) | Pass | Card: 316px with 16px padding. Timer scales to `text-sm` (14px). Radio wrappers 284×62px. All nav buttons 44px height. No layout shift. |

---

## Detailed Findings

### H1: Duplicate aria-label on progressbars

- **Issue**: Both `<Progress>` and the sr-only `<div role="progressbar">` use `aria-label="Quiz progress"`, creating two identically-named progressbar nodes in the ARIA tree.
- **Location**: `src/app/components/quiz/QuizHeader.tsx:39` and `:47`
- **Evidence**: ARIA tree confirms `progressbar "Quiz progress"` × 2; first has `aria-valuenow=50 aria-valuemax=100`, second has `aria-valuenow=1 aria-valuemax=2`.
- **Impact**: Screen reader users cannot distinguish which progressbar communicates percentage completion vs. question count. The sr-only element's primary purpose — providing question-count semantics — is undermined by the ambiguous name.
- **Suggestion**: Rename the sr-only progressbar to `aria-label="Quiz question progress"` or `aria-label="Question 1 of 2"`.

### H2: Skipped heading level H2→H4 in AnswerFeedback

- **Issue**: No `<h3>` exists between the sr-only `<h2>` ("Question 1 of 2") and the visible `<h4>` ("Correct!") in `AnswerFeedback`.
- **Location**: `src/app/components/quiz/AnswerFeedback.tsx:114`
- **Evidence**: Runtime heading hierarchy: `H1 (18px/600, visible) → H2 (20px/400, sr-only) → H4 (18px/600, visible)`.
- **Impact**: WCAG 1.3.1 violation. Heading navigation for screen readers has a structural gap at H3. Learners who rely on heading navigation to skim feedback content will experience an unexpected jump.
- **Suggestion**: Change `<h4 className="font-semibold text-lg text-foreground">` to `<h3 className="font-semibold text-lg text-foreground">`. Zero visual change since font sizing is from Tailwind classes, not the heading tag's browser default.

### M1: Imprecise section landmark label

- **Issue**: `<section aria-label="Quiz header">` uses a component-name label rather than a content-purpose label.
- **Location**: `src/app/pages/Quiz.tsx:442`
- **Evidence**: ARIA tree: `region "Quiz header"`.
- **Impact**: Low friction for most screen reader users, but landmark navigation quality degrades when labels describe implementation rather than content.
- **Suggestion**: `aria-label="Quiz progress and timer"`.

### M2: sr-only h2 carries browser-default h2 font size

- **Issue**: sr-only `<h2>` computed at 20px (browser default), larger than the visible `<h1>` at 18px.
- **Location**: `src/app/pages/Quiz.tsx:456`
- **Evidence**: Computed: `H2 { font-size: 20px, font-weight: 400 }`.
- **Impact**: Defensive concern only — currently invisible. Becomes a visual hierarchy bug if ever un-hidden.
- **Suggestion**: Add `text-base` to the sr-only h2 class list.

### M3: MarkForReview inside "Question area" section

- **Issue**: The `<MarkForReview>` control is structurally inside `<section aria-label="Question area">`, mixing a navigation utility action into the question content region.
- **Location**: `src/app/pages/Quiz.tsx:494`
- **Evidence**: ARIA tree places `checkbox "Mark for Review"` as a child of `region "Question area"`.
- **Impact**: Mild semantic mismatch. AT users entering the question area region will encounter the review control as part of question content.
- **Suggestion**: Move `<MarkForReview>` outside the "Question area" section close tag, placing it as a direct sibling of the two sections.

---

## Recommendations

1. **Fix the heading skip (H2) before merge.** Change `<h4>` to `<h3>` in `AnswerFeedback.tsx:114` — one character change, zero visual impact, removes a WCAG 1.3.1 violation.

2. **Differentiate the sr-only progressbar label (H1) before merge.** Change `aria-label="Quiz progress"` on the sr-only div to `aria-label="Quiz question progress"`. This directly fulfills the intent of AC5 (screen readers receive question-count values) and removes the ambiguity introduced by the dual-progressbar pattern.

3. **Relocate MarkForReview outside the question section (M3) when possible.** This is the cleanest change and improves landmark semantics without changing any visible behaviour.

4. **Add `text-base` to the sr-only h2 (M2) as a defensive measure.** A three-word Tailwind addition that prevents a future visual regression if the heading is ever revealed.

---

*Report generated by the design-review agent. Live browser tests conducted against dev server at `http://localhost:5173` using Playwright MCP.*
