# Design Review Report — E14-S02 v2 (Second Review)

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E14-S02 — Display Multiple Select Questions with Partial Credit
**Review Round**: 2 of 2 (follow-up after first-round fixes)
**Changed Files**:
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/QuizNavigation.tsx`
- `src/app/components/quiz/QuestionDisplay.tsx`
- `src/app/pages/Quiz.tsx`
- `src/lib/scoring.ts`

**Affected Pages**: Quiz flow (`/courses/:courseId/lessons/:lessonId/quiz`)

---

## Executive Summary

This second-round review confirms that all first-round blockers and high-priority findings have been resolved. The `aria-describedby` hint connection, redundant `role="group"`, legend spacing (`pb-2` on MultipleSelect, `pb-4` on TrueFalse/MultipleChoice), and number key shortcut badges are correctly implemented across all three question types. The keyboard shortcut implementation has notably improved: the original `useCallback`+`document.addEventListener` pattern was replaced with a clean `onKeyDown` on the `fieldset`, scoped to the component rather than the document. Two minor observations remain — one pre-existing and one nitpick — neither of which block merge.

---

## What Works Well

- **kbd badge implementation is consistent and accessible.** All three question types (MultipleSelect, TrueFalse, MultipleChoice) render `aria-hidden="true"` kbd badges before the input control, matching the specified DOM order. Badges render at 20x20px with correct mono font and muted styling.
- **Keyboard shortcut scope is correct.** Using `onKeyDown` on `<fieldset>` rather than `document.addEventListener` means shortcuts are scoped to when the question area has focus. The guard `e.isComposing || e.metaKey || e.ctrlKey || e.altKey` prevents interference with browser shortcuts. The `Math.min(options.length, 9)` cap in MultipleSelect and MultipleChoice prevents badge rendering for option 10+ correctly.
- **aria-describedby wired correctly on MultipleSelectQuestion.** `fieldset[aria-describedby]` points to the hint `<span id>`, confirmed at runtime: `fieldsetDescribedBy: "_r_k_"`, `hintText: "Select all that apply"`, `hintDisplay: "block"`.
- **Redundant `role="group"` removed from inner div.** Verified at runtime: `innerDivRole: null`. The fieldset/legend pair provides the semantic grouping natively.
- **Legend spacing corrected.** MultipleSelectQuestion legend computed `paddingBottom: 8px` (pb-2) as intended — it has the "Select all that apply" hint immediately below so tighter spacing is appropriate. TrueFalseQuestion legend has `paddingBottom: 16px` (pb-4), correct.
- **No horizontal overflow at any breakpoint.** Confirmed `scrollWidth === clientWidth` at 375px, 768px, and 1440px.
- **Option row touch targets well above minimum.** Each label row measures 61.3px height at all tested viewports — far exceeding the 44px minimum, even accounting for the 16px padding.
- **Quiz card uses correct design tokens.** Card `borderRadius: 24px`, `bg-card` token (not hardcoded), card padding responsive: 16px on mobile (`p-4`) → 32px on `sm:` (`sm:p-8`).
- **QuizActions `forwardRef` works correctly.** The Next/Submit button is programmatically focusable (`document.activeElement === nextBtn` confirmed), enabling the auto-advance focus after single-answer selection.
- **Zero console errors.** 0 errors across all tested states: start screen, active question, multi-option selection, and navigation.
- **Both focus indicators are present.** On keyboard Tab, the focused checkbox gets a 3px ring shadow; the parent label gets a 4px `oklch(0.45 0.05 270)` ring via `focus-within:ring-2`. Both are visible.

---

## Findings by Severity

### Blockers
None.

### High Priority
None.

### Medium Priority

#### Redundant `aria-labelledby` on RadioGroup inside fieldset (TrueFalseQuestion and MultipleChoiceQuestion)

- **Location**: `src/app/components/quiz/questions/TrueFalseQuestion.tsx:52`, `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:57`
- **Evidence**: Runtime confirms `radioGroupAriaLabelledBy: "_r_m_"` pointing to the legend id, and the legend text is the question text. The accessibility snapshot shows both `group "The Earth orbits the Sun."` (the fieldset) and `radiogroup "The Earth orbits the Sun."` (the RadioGroup) bearing the same label. Screen readers will announce the question text twice — once for the fieldset landmark and once when entering the radiogroup.
- **Impact**: For learners using screen readers (NVDA, JAWS, VoiceOver), question text is spoken twice per question. Over a 20-question quiz this is meaningful cognitive overhead and may cause learners to doubt whether they missed something. This is a WCAG 2.4.6 (Headings and Labels) concern, not a blocker, but it degrades the assisted experience.
- **Note**: This pattern is pre-existing on TrueFalse and MultipleChoice — it predates this PR and was not introduced here. Flagging it because the kbd-badge work touched these files and this is a reasonable opportunity to fix it.
- **Suggestion**: Remove `aria-labelledby={legendId}` from the `RadioGroup` component in both files. The `<fieldset>` + `<legend>` already provides the accessible name for the group natively; the RadioGroup inherits this context. The `legendId` `useId()` call can also be removed from TrueFalse and MultipleChoice if no other element needs it.

### Nitpicks

#### Number key badge for numeric option text creates visual ambiguity (MultipleSelectQuestion)

- **Location**: `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:80-86`
- **Evidence**: The accessibility tree for Q2 ("Select all even numbers", options: 2, 3, 5, 8) shows: `generic: "1"` (kbd badge) followed by `checkbox "2"` followed by `generic: "2"` (option text). Visually the row reads `[1] □ 2`, `[2] □ 3`, `[3] □ 5`, `[4] □ 8`. The kbd badge "1" next to option text "2" is potentially confusing — a learner pressing "1" activates option "2".
- **Impact**: Low — the kbd badge styling (monospace, bordered, muted) clearly differentiates it from the option label. Sighted users will adapt quickly. This is only a concern for the edge case of numeric option text (e.g. math quizzes), not typical word-based options.
- **Suggestion**: No immediate action required. If numeric answer options become common, consider adding a tooltip or a one-time hint (e.g. "Press 1–4 to select options") in the hint area rather than per-row badges. This is a future consideration only.

---

## First-Round Findings Resolution

| Finding (v1) | Severity | Status |
|---|---|---|
| Missing `aria-describedby` on MultipleSelectQuestion fieldset | Blocker | **Resolved** — `fieldset[aria-describedby]` confirmed wired to hint span at runtime |
| Redundant `role="group"` on inner `div` | High | **Resolved** — `innerDivRole: null` confirmed |
| Legend spacing `pb-1` too tight | High | **Resolved** — legend `paddingBottom: 8px` (pb-2) on MultipleSelect; 16px (pb-4) on TrueFalse/MultipleChoice |
| Number key shortcuts missing kbd affordance | High | **Resolved** — kbd badges present, aria-hidden, correct DOM order (before input) |
| Keyboard shortcut used `document.addEventListener` leaking globally | Medium | **Resolved** — replaced with `onKeyDown` on `<fieldset>` scoped to component |
| QuizActions missing `forwardRef` for Enter-to-advance | Medium | **Resolved** — `forwardRef` confirmed working, button programmatically focusable |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Hint text `rgb(178,181,200)` on card `rgb(36,37,54)` — approximately 5.1:1 in dark mode. Option text `rgb(232,233,240)` is near-white on dark card. |
| Keyboard navigation | Pass | Tab cycles through checkboxes; each gets dual focus ring (checkbox 3px + label 4px). |
| Focus indicators visible | Pass | Both `focus-within:ring-2` on label and native ring on checkbox/radio confirmed active. |
| Heading hierarchy | Pass | H1 for quiz title, question text in `<legend>` (not a heading — correct for form grouping). |
| ARIA labels on icon buttons | Pass | Submit button has `aria-label` with full description. ChevronLeft/Right icons are `aria-hidden`. |
| Semantic HTML | Pass | `<fieldset>/<legend>` for question grouping, `<label>` wrapping inputs, `<kbd>` for shortcut hints. |
| Form labels associated | Pass | Checkboxes inside `<label>` elements; labels wrap both the Checkbox component and the text span. |
| `prefers-reduced-motion` | Pass | `motion-reduce:transition-none` applied to all option row transitions. |
| `aria-describedby` on MultipleSelect | Pass | Confirmed wired at runtime. |
| No redundant `role="group"` on inner div | Pass | Confirmed removed. |
| Double `aria-labelledby` on RadioGroup | Warn | Pre-existing on TrueFalse/MultipleChoice — question text announced twice for screen readers. See Medium finding above. |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|---|---|---|
| Mobile (375px) | Pass | No horizontal scroll. kbd badges visible (20x20px). Option rows 61px tall. Card padding 16px. Bottom mobile nav present. |
| Tablet (768px) | Pass | No horizontal scroll. kbd badges visible. Card padding 32px (sm: breakpoint). Sidebar collapsed. |
| Desktop (1440px) | Pass | Full sidebar. TrueFalse grid goes 2-column (`grid-cols-1 lg:grid-cols-2`). Option rows full-width at 608px. Quiz card max-width 2xl (42rem) centered. |

---

## Detailed Findings

### Medium — Double aria-labelledby on RadioGroup

- **Issue**: `RadioGroup` receives `aria-labelledby={legendId}` pointing to the `<legend>` element, while the enclosing `<fieldset>` already names the group through the legend natively. This creates double-announcement.
- **Location**: `TrueFalseQuestion.tsx:52`, `MultipleChoiceQuestion.tsx:57`
- **Evidence**: Accessibility tree shows `group "The Earth orbits the Sun."` wrapping `radiogroup "The Earth orbits the Sun."` — both bearing identical accessible names derived from the same legend element.
- **Impact**: Screen reader users hear the question text spoken twice on each question. Over a full quiz sitting this compounds meaningfully and erodes trust in the screen reader output.
- **Suggestion**: Remove `aria-labelledby={legendId}` from the `RadioGroup` in both components. The `legendId` state variable and `useId()` call can also be removed from both files, simplifying the code.

---

## Recommendations

1. **Remove `aria-labelledby={legendId}` from RadioGroup** in `TrueFalseQuestion.tsx` and `MultipleChoiceQuestion.tsx`. This is a one-line change per file and a meaningful screen reader improvement. It also simplifies the component — `legendId` and `useId()` can be deleted from both.

2. **Ship as-is for all other items.** Every first-round finding is resolved. The kbd badge feature is cleanly implemented with correct DOM order, aria-hidden, scoped keyboard handling, and consistent styling across all three question types.

3. **Monitor numeric option text edge cases.** If content authors create quizzes where option text is single digits (math, numbering questions), the kbd badge / option text visual pairing may cause brief confusion. A content authoring note or future hint-area affordance could address this without code changes today.

---

## Verdict

**Ready to merge after the Medium finding is addressed** (one-line remove of `aria-labelledby` in two files). All first-round blockers and high-priority findings are resolved. The implementation is solid: correct semantics, scoped keyboard handling, accessible focus indicators, responsive at all breakpoints, and zero console errors.
