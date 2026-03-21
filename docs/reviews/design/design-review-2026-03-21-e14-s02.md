# Design Review Report — E14-S02

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E14-S02 — Display Multiple Select Questions with Partial Credit
**Branch**: feature/e14-s02-display-multiple-select-questions-partial-credit
**Changed Files**:
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` (new)
- `src/app/components/quiz/QuestionDisplay.tsx` (multiple-select case added)
- `src/app/pages/LessonPlayer.tsx` (minor changes)
- `src/lib/scoring.ts` (PCM scoring logic)
- `tests/e2e/story-e14-s02.spec.ts` (new)

**Affected Pages**: Quiz flow at `/courses/:courseId/lessons/:lessonId/quiz`

---

## Executive Summary

E14-S02 adds a `MultipleSelectQuestion` component with checkbox-based option cards, "Select all that apply" indicator text, and Partial Credit Model (PCM) scoring. The implementation closely follows the established patterns from `MultipleChoiceQuestion` and `TrueFalseQuestion`, resulting in strong visual consistency. The component passes all core layout, touch-target, and keyboard navigation requirements. Three findings require attention before merge, primarily around a missing screen reader association for the hint text (AC7 gap), a redundant ARIA grouping in the DOM, and a pre-existing Markdown rendering issue now surfaced by this story.

---

## What Works Well

- **Structural consistency**: The `fieldset`/`legend`/`label`/`Checkbox` pattern matches the established quiz component family exactly. A reviewer familiar with `MultipleChoiceQuestion` can read `MultipleSelectQuestion` with zero ramp-up time.
- **Touch targets**: All four option card labels measured 61px tall at every tested viewport (mobile 416px, tablet 853px, desktop 1440px) — comfortably above the 44px WCAG minimum.
- **No horizontal scroll**: Confirmed at all three breakpoints. Cards stack cleanly to full width on mobile.
- **Keyboard navigation**: Tab moves independently between each checkbox (correct behavior — distinct from RadioGroup which uses arrow keys), Space toggles. Verified live. All checkboxes have `tabIndex: 0`.
- **Dual focus ring**: Focused checkboxes show a 3px box-shadow ring on the control itself AND a 4px `focus-within` ring on the parent label card via `ring-2 ring-ring ring-offset-2`. This provides clear, redundant focus indication.
- **Design token hygiene**: Zero hardcoded hex colors or raw Tailwind color classes in any changed file. All states use `border-brand`, `bg-brand-soft`, `bg-card`, `border-border`, `bg-accent`, `text-foreground`, `text-muted-foreground` — fully token-compliant.
- **`motion-reduce:transition-none`**: Correctly applied to card transitions. `prefers-reduced-motion` users will not see card color flicker on selection.
- **PCM scoring implementation**: Clean separation of `isCorrect` (all-or-nothing boolean for the `isCorrect` field) and `pointsEarned` (PCM fractional points) in `scoring.ts`. The dual-path design correctly surfaces partial credit in the ScoreSummary (`1 of 5 correct · 50% to pass`) while the QuestionBreakdown uses the boolean `isCorrect` flag.
- **Console health**: Zero errors across full quiz lifecycle (start → select → submit → results). The only console warning is a pre-existing platform-level `apple-mobile-web-app-capable` meta tag deprecation, unrelated to this story.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### H1 — "Select all that apply" hint is not programmatically associated for screen readers

- **Location**: `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:51`
- **Evidence**: The hint `<span>` has no `id` and no `aria-describedby` reference connects it to the inner `div[role="group"]`. Computed value: `groupHasAriaDescribedby: "none"`, `hintHasId: false`.
- **Impact**: Screen reader users navigating by group landmark will hear the group label ("Which of the following are primary colors?") but not the instruction "Select all that apply". This is the key differentiator between multiple-choice and multiple-select — a user who cannot see the hint has no indication that multiple selections are allowed. This directly undermines AC7.
- **Suggestion**: Assign a stable `id` to the hint span (e.g. via a second `useId()` call or a derived string from `legendId`) and reference it via `aria-describedby` on the inner `div[role="group"]`. The design guidance in the story document (`14-2-display-multiple-select-questions-with-partial-credit.md:148`) explicitly calls out `aria-describedby` as optional but recommended — given this is an accessibility-critical instruction, it should be treated as required.

```tsx
// Suggested pattern
const hintId = `${legendId}-hint`

<span id={hintId} className="text-sm text-muted-foreground italic block mb-4">
  Select all that apply
</span>

<div className="space-y-3" role="group" aria-labelledby={legendId} aria-describedby={hintId}>
```

---

#### H2 — Redundant `role="group"` on inner div doubles the landmark for screen readers

- **Location**: `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:53`
- **Evidence**: The component already uses `<fieldset>` (which implicitly has `role="group"`) with `<legend>` as its label. The inner `<div role="group" aria-labelledby={legendId}>` creates a second group landmark with the same label. Screen readers will announce the group label twice when entering the div: once for the fieldset and once for the inner group.
- **Impact**: Redundant announcements add cognitive overhead for screen reader users, which conflicts with the platform's learning-first principle. The `<fieldset>` already provides the correct semantic container for the checkboxes.
- **Suggestion**: Remove `role="group"` and `aria-labelledby` from the inner `<div>`, keeping it as a plain layout container. If the inner group is needed for some other purpose, verify with screen reader testing first. The `MultipleChoiceQuestion` uses `<RadioGroup aria-labelledby={legendId}>` as a single inner wrapper — but `RadioGroup` from Radix has specific keyboard behavior that justifies its own role. Plain `div` checkboxes do not.

```tsx
// Before
<div className="space-y-3" role="group" aria-labelledby={legendId}>

// After
<div className="space-y-3">
```

---

### Medium Priority (Fix when possible)

#### M1 — "Select all that apply" hint has only 4px gap below the legend (visual tightness)

- **Location**: `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:45`
- **Evidence**: The legend has `pb-1` (4px padding-bottom). `MultipleChoiceQuestion` and `TrueFalseQuestion` both use `pb-4` (16px). The hint span then adds `mb-4` (16px) before the option cards. The net effect is 4px between the legend text and the hint, versus 16px in the sibling components.
- **Impact**: The hint text ("Select all that apply") reads as cramped relative to the question text. Learners scanning quickly may read question text → options without registering the hint, missing the multiple-selection affordance.
- **Suggestion**: Change `pb-1` to `pb-2` (8px) on the legend, or remove it entirely and rely on the hint's own `mb-4` for spacing. Either keeps the hint tightly coupled to the question while improving visual breathing room.

```tsx
// Before
className="text-lg lg:text-xl text-foreground leading-relaxed pb-1"

// After
className="text-lg lg:text-xl text-foreground leading-relaxed pb-2"
```

---

#### M2 — `useMemo` used for a side effect (console.warn) instead of `useEffect`

- **Location**: `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:26-32`
- **Evidence**: `useMemo(() => { console.warn(...) }, [question.id, options.length])` — `useMemo` is for memoizing computed values and returning them. Using it solely to run a side effect is semantically incorrect and may be optimized away by future React versions (React is permitted to skip memo recomputation under concurrent mode).
- **Impact**: This is a latent correctness risk. In development it works, but React's concurrent renderer can call the memo function multiple times or skip it. The warn may fire erratically or not at all. This pattern is identical in `MultipleChoiceQuestion` and `TrueFalseQuestion` — the issue predates this story but is being repeated here.
- **Suggestion**: Use `useEffect` with a ref guard to warn only when the value first appears problematic, or — more simply — move the validation to a plain conditional at the top of the render function (it runs on every render, which is fine for a dev-only warn).

```tsx
// Simplest correct approach
if (process.env.NODE_ENV !== 'production' && options.length < 2) {
  console.warn(`[MultipleSelectQuestion] Question "${question.id}" has ${options.length} options (expected ≥2)`)
}
```

---

#### M3 — Raw Markdown syntax rendered as plain text in AreasForGrowth (pre-existing, surfaced by this story)

- **Location**: `src/app/components/quiz/AreasForGrowth.tsx:41`
- **Evidence**: Live browser evaluation confirmed: `"Which of the following are **primary colors**?"` appears verbatim with asterisks in the Areas to Review section after quiz submission. The `MultipleSelectQuestion` renders the same text through `react-markdown` in the question view, but `AreasForGrowth` uses a plain `<span>`.
- **Impact**: Learners see raw Markdown syntax (`**bold**`) in the post-quiz review, which is visually distracting and unprofessional. This was not visible before E14-S02 because previous question types (multiple-choice, true-false) may not have used Markdown in their test data. The new story's seeded question text exposes this gap.
- **Suggestion**: Wrap `item.questionText` in the same `react-markdown` + `MARKDOWN_COMPONENTS` setup used by the question components. Since this is a review list context, prose mode is appropriate. This fix is in `AreasForGrowth.tsx`, not in the story's primary file, but it directly affects the feedback experience for multiple-select questions with formatted text.

---

#### M4 — AC6 per-option feedback indicators deferred (scope clarification needed)

- **Location**: `src/app/components/quiz/QuizResults.tsx` / results flow; `Review Answers` button
- **Evidence**: Clicking "Review Answers" on the results screen shows a toast: "Answer review is coming soon. Use Question Breakdown below to see your results." The E14-S02 story AC6 specifies: "Multiple Select questions show 'X of Y correct' with per-option indicators (correct selected, correct missed, incorrect selected)." The `ScoreSummary` shows "X of Y correct" globally. The `QuestionBreakdown` shows per-question correct/incorrect + points. Per-option indicators (which option was correct-selected, correct-missed, or incorrect-selected) do not exist.
- **Impact**: The story AC as written implies per-option indicators are part of this story's scope. If this is intentionally deferred to a future story (Epic 16 review mode is referenced in `QuestionDisplay.tsx:9`), the AC should be updated to reflect the deferral. If it is in scope, it is a missing feature.
- **Suggestion**: Clarify in the story file whether AC6's per-option indicators are deferred to Epic 16's `review-correct/review-incorrect` mode (where `MultipleSelectQuestion` would receive a non-`active` mode and render feedback styling). If deferred, update the AC to say "Score summary shows 'X of Y correct'" and track per-option indicators in a separate story. The current component accepts a `mode` prop that could drive this, but the rendering logic for review modes is not yet implemented.

---

### Nitpicks (Optional)

#### N1 — Legend `pb-1` class name is inconsistent with sibling components without a documented reason

The discrepancy between `pb-1` (MultipleSelectQuestion) and `pb-4` (MultipleChoiceQuestion, TrueFalseQuestion) on the legend is not documented in the implementation notes. If intentional (because the hint span provides the visual separation), a brief comment would prevent future devs from "fixing" it to match siblings and inadvertently increasing the gap.

#### N2 — `key` prop uses array index concatenated with option text

- **Location**: `src/app/components/quiz/questions/MultipleSelectQuestion.tsx:59`
- **Evidence**: `key={\`${index}-${option}\`}` — same pattern as `MultipleChoiceQuestion`. If options are ever reordered (e.g., shuffled quiz), the index prefix makes the key unstable. Using `option` alone as the key would be more stable for static option sets.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Tokens `text-foreground` / `text-muted-foreground` on `bg-card` use OKLCH-calibrated pairs; verified in dark mode (active during test) |
| Keyboard navigation | Pass | Tab moves between checkboxes independently; Space toggles. Verified live. |
| Focus indicators visible | Pass | Dual ring: 3px box-shadow on checkbox + 4px `focus-within` ring on parent label card |
| Heading hierarchy | Pass | `h1` (quiz title) → `h2` (Areas to Review) — correct structure |
| ARIA labels on icon buttons | Pass | `Checkbox` components each have `aria-label={option}` |
| Semantic HTML | Partial | `<fieldset>`/`<legend>` correct; inner `div[role="group"]` is redundant (see H2) |
| Form labels associated | Pass | Each `<Checkbox>` is wrapped in a `<label>` with visible text + `aria-label` |
| "Select all that apply" hint associated | Fail | Hint span has no `id` and is not referenced via `aria-describedby` (see H1) |
| `prefers-reduced-motion` | Pass | `motion-reduce:transition-none` on card transition |
| No hardcoded colors | Pass | All styling via design tokens |
| No inline styles | Pass | Pure Tailwind utilities throughout |

---

## Responsive Design Verification

All measurements taken with active quiz state (question 1 rendered), dark mode active.

| Breakpoint | Viewport (actual) | Touch Targets | Horizontal Scroll | Layout |
|------------|-------------------|---------------|-------------------|--------|
| Mobile (375px) | 416px × 902px | 61px height (pass) | None | Single column, full-width cards |
| Tablet (768px) | 853px × 1138px | 61px height (pass) | None | Single column, constrained to max-w-2xl |
| Desktop (1440px) | 1584px × 982px | 61px height (pass) | None | Single column, constrained to max-w-2xl |

Single-column layout for multiple-select is correct per the design guidance — vertical scanning suits 4+ option sets better than the 2-column grid used by TrueFalseQuestion.

---

## Detailed Findings Summary

| ID | Severity | File | Line | Issue |
|----|----------|------|------|-------|
| H1 | High | `MultipleSelectQuestion.tsx` | 51–53 | Hint span not associated to group via aria-describedby |
| H2 | High | `MultipleSelectQuestion.tsx` | 53 | Redundant `role="group"` on inner div duplicates fieldset landmark |
| M1 | Medium | `MultipleSelectQuestion.tsx` | 45 | Legend `pb-1` (4px) creates cramped gap before hint vs `pb-4` in siblings |
| M2 | Medium | `MultipleSelectQuestion.tsx` | 26 | `useMemo` used for side effect — should be `useEffect` or inline conditional |
| M3 | Medium | `AreasForGrowth.tsx` | 41 | Raw Markdown syntax shown in Areas to Review (pre-existing, surfaced here) |
| M4 | Medium | Story AC6 | — | Per-option feedback indicators deferred or unimplemented — scope needs clarification |
| N1 | Nitpick | `MultipleSelectQuestion.tsx` | 45 | `pb-1` inconsistency undocumented |
| N2 | Nitpick | `MultipleSelectQuestion.tsx` | 59 | Key uses index prefix which is unstable under option shuffling |

---

## Recommendations

1. **Fix H1 before merge**: Add `id` to the hint span and `aria-describedby` on the inner group div. This is a 3-line change that closes a real gap for screen reader users who need the "Select all that apply" instruction.

2. **Fix H2 before merge**: Remove `role="group"` and `aria-labelledby` from the inner div. The `<fieldset>` already provides the group semantics. This reduces redundant announcements and simplifies the DOM.

3. **Clarify AC6 scope**: Decide whether per-option feedback indicators (`review-correct`/`review-incorrect` mode rendering) are in scope for E14-S02 or deferred to Epic 16. Update the story AC accordingly. The `mode` prop infrastructure already exists for this future work.

4. **Fix M3 opportunistically**: `AreasForGrowth.tsx:41` rendering raw Markdown is a straightforward fix (`<Markdown>` wrapper) that will affect any question type with Markdown-formatted text. Worth bundling into this PR since the story introduces the first seeded question with Markdown content that makes the bug visible.

