# Design Review Report — Quiz Results Page & Quiz Flow

**Review Date**: 2026-03-20
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e13-s02-mark-questions-for-review`
**Affected Files**:
- `src/app/pages/QuizResults.tsx`
- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/components/quiz/QuizNavigation.tsx`
- `src/app/components/quiz/MarkForReview.tsx`
- `src/app/components/quiz/ReviewSummary.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`

**Test Route**: `/courses/test-course/lessons/test-lesson/quiz` → `/quiz/results`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

The Quiz Results page and quiz-taking flow are well-structured with correct design token usage throughout, solid accessibility foundations, and a thoughtful dark-mode-aware palette. The primary issue requiring attention before release is a **geometric defect in the score ring**: the "100%" text label at both mobile and desktop font sizes is wider than the ring's inner diameter, causing it to visually overlap the progress stroke. Secondary issues include a RadioGroup controlled/uncontrolled React warning during answer selection, and the `Back to Lesson` link missing an explicit `focus-visible` class (though it does inherit a browser default outline in this browser).

---

## What Works Well

- **Design token discipline is excellent.** No hardcoded hex colors, no hardcoded pixel spacing, no inline `style=` attributes across all 11 files reviewed. Every color reference uses `text-brand`, `text-success`, `text-warning`, `text-muted-foreground`, `bg-card`, `bg-brand-soft`, etc.
- **Accessibility foundations are strong.** The `aria-live="polite" aria-atomic="true"` sr-only region in `ScoreSummary` announces the score result to screen readers on load. The `QuizHeader` timer uses a separate sr-only live region that fires once per minute (not every second) — a thoughtful choice that avoids screen reader noise. The score ring SVG is correctly `aria-hidden="true"`.
- **Touch targets meet the 44px minimum everywhere it counts.** All buttons (Previous, Next, Submit, Retake, Review Answers), all QuestionGrid bubbles, and the Back to Lesson link all measure 44px tall or more. The QuestionGrid bubbles are 44×44px exactly.
- **Responsive layout is correct at all three viewports.** No horizontal scroll at any breakpoint. The card collapses from `p-8` (32px) to `p-4` (16px) correctly at mobile. Buttons stack vertically at mobile and switch to row at tablet/desktop. The score ring scales from `size-24` (96px) at mobile to `size-32` (128px) at desktop.
- **Contrast ratios pass WCAG AA comprehensively in dark mode.** H1 text: 12.45:1. Muted paragraph text: 7.42:1. Warning color text: 7.00:1. Brand link color: 5.18:1. All well above 4.5:1 for normal text.
- **Keyboard navigation is complete and logical.** Tab order progresses: skip link → sidebar navigation → header controls → Retake Quiz → Review Answers → Back to Lesson. All three main content interactive elements have visible focus rings (buttons use box-shadow ring, links use 2px solid outline).
- **`motion-reduce:transition-none` is applied** on the score ring progress arc transition. The animation correctly respects `prefers-reduced-motion`.
- **Semantic HTML is correct throughout.** `<fieldset>` and `<legend>` wrap the question options in `MultipleChoiceQuestion`. `<nav aria-label="Quiz navigation">` wraps QuizNavigation. The submit confirmation uses a Radix `AlertDialog`. All clickable elements are native `<button>` or `<a>` elements.
- **No console errors** on the results page. Zero JS errors across the entire tested flow.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B-1: "100%" text overflows the score ring at both viewports**

At desktop (`sm:text-5xl` = 48px bold), "100%" measures **130px wide**. The ring's inner diameter (total diameter 128px minus 8px stroke × 2) is only **112px** — an overflow of 18px (9px each side). At mobile (`text-3xl` = 30px bold), "100%" measures **82px wide** against an inner diameter of **80px** — an overflow of 2px.

The ring container uses `overflow: visible`, so the text is not clipped — it physically extends over the ring stroke on both sides. For a learner who gets a perfect score, the most celebratory state the UI can show renders with text visually breaking out of its containing circle. This undermines the achievement moment the design is meant to celebrate.

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:62`
- **Evidence**: Measured at runtime — `text100Width: 130, innerDiameter: 112, overflowAmount: 18` at desktop; `text100Width: 82, innerDiameter: 80` at mobile
- **Impact**: Perfect scores (100%) display with the percentage label overlapping the ring arc, breaking the visual design at exactly the most positive learner moment
- **Suggestion**: Two viable fixes:
  1. **Reduce font size for 3-digit percentages**: In `ScoreRing`, use `text-2xl sm:text-4xl` when `percentage === 100` (or when the rendered string is 4 chars). This keeps the ring unchanged.
  2. **Increase the ring size**: Change `size-24 sm:size-32` to `size-28 sm:size-40` — giving 80px inner at mobile and 144px inner at desktop. "100%" at 48px bold would then fit comfortably.
  3. **Reduce the font size unconditionally** to `text-2xl sm:text-4xl` — "100%" at 36px bold is approximately 98px wide, fitting within 112px. Lower percentages would also be smaller but still very readable.

  Option 1 (conditional sizing) is the most surgical fix with no visual regression for common scores.

---

### High Priority (Should fix before merge)

**H-1: RadioGroup controlled/uncontrolled React warning on first answer selection**

When a learner selects their first answer on any question, the `MultipleChoiceQuestion` component triggers a React warning: `"RadioGroup is changing from uncontrolled to controlled"`. This happens because `value` starts as `undefined` (uncontrolled) and becomes a string on first selection (controlled). While not visible to learners, it indicates a prop management issue that can cause unpredictable re-render behavior in edge cases.

- **Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:49` — the `value` prop passed to `<RadioGroup value={value}>`
- **Evidence**: Console warning `RadioGroup is changing from uncontrolled...` logged 5 times during a 3-question quiz session
- **Impact**: React's reconciler treats controlled/uncontrolled transitions as bugs. In practice this manifests as the selected option occasionally not visually persisting if state updates race during rapid navigation
- **Suggestion**: Ensure `value` is always either a defined string or an explicit empty string `''` — never `undefined`. In `MultipleChoiceQuestion`, change the prop type from `string | undefined` to `string` and default to `''` at the call site in `QuestionDisplay`, or convert in the component: `value={value ?? ''}`.

**H-2: `Back to Lesson` link missing explicit `focus-visible` Tailwind classes**

The link's class string is `text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 min-h-[44px]` — no `focus-visible:` utilities are present. It receives a visible 2px outline in this browser because the global stylesheet provides a fallback, but this behavior is browser-dependent and not guaranteed across all environments.

- **Location**: `src/app/pages/QuizResults.tsx:110`
- **Evidence**: `hasFocusVisibleClass: false` from class inspection; focus ring relies on inherited browser default rather than Tailwind's `focus-visible:ring-2 focus-visible:ring-ring` pattern used elsewhere in the codebase
- **Impact**: Inconsistent focus indicator appearance across browsers; learners using keyboard navigation may not see a focus ring in some environments
- **Suggestion**: Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded` to match the pattern used on the layout's sidebar links

**H-3: QuestionGrid `aria-current` uses string `"true"` instead of boolean `true`**

The question bubble for the active question uses `aria-current={isCurrent ? 'true' : undefined}`. The ARIA spec for `aria-current` accepts `"true"` as a valid string value for the default `"page"` case, but `aria-current="true"` is semantically ambiguous — the correct pattern for a "current item in a set" is `aria-current="true"` (valid) or more specifically `aria-current="step"` for sequential processes like a quiz. The JSX attribute `aria-current={isCurrent ? 'true' : undefined}` also passes a string where a boolean would be more idiomatic.

- **Location**: `src/app/components/quiz/QuestionGrid.tsx:36`
- **Evidence**: `ariaCurrent: "true"` on the active question button from computed DOM inspection
- **Impact**: Screen readers announce the active question differently depending on the value — `aria-current="step"` would announce "current step" which more accurately describes a question in a sequential quiz flow
- **Suggestion**: Change to `aria-current={isCurrent ? 'step' : undefined}` — this is semantically precise for a step-based flow and is supported by all major screen readers

---

### Medium Priority (Fix when possible)

**M-1: `Circle` icon used for "not passed" state is semantically ambiguous**

In `ScoreSummary`, the not-passed state renders a `<Circle>` icon from Lucide alongside "Keep Going! You got X of Y correct." The filled `CheckCircle` for passing clearly communicates success, but an empty `Circle` for failure is visually unclear — it could be read as "neutral" or "in progress" rather than "not passed".

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:99`
- **Evidence**: `<Circle className="size-5 text-warning" aria-hidden="true" />` — the empty circle carries no inherent "not passed" meaning
- **Impact**: Learners may not immediately understand whether the circle means they failed or simply have unfinished work. The encouraging message helps, but the icon choice undermines quick scanability.
- **Suggestion**: Consider `XCircle` (which visually contrasts with `CheckCircle`) or `AlertCircle` for the not-passed state. Both convey "something went wrong / try again" more clearly than an empty circle.

**M-2: Score ring track circle has very low contrast against card background**

The track (background) circle uses `text-accent` (`rgb(50, 51, 74)`) on the card background (`rgb(36, 37, 54)`). The contrast ratio between these two colors is approximately 1.2:1 — the track is barely distinguishable from the card. At smaller ring sizes (mobile: 96px) this makes the incomplete portion of the ring nearly invisible.

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:44` — `className="text-accent"`
- **Evidence**: `trackColor: "rgb(50, 51, 74)"`, `cardBg: "rgb(36, 37, 54)"` — computed at runtime
- **Impact**: Learners cannot easily perceive how much of the ring is "unfilled" since the track blends into the card. At 33% score, the 67% unfilled arc is almost invisible.
- **Suggestion**: Use a slightly lighter token for the track circle — `text-muted` or a custom token with better separation from `bg-card`. A value around `rgb(70, 72, 100)` would give a clear track without being distracting.

**M-3: `ScoreSummary` information hierarchy has too many items at the same visual weight**

The score summary renders six consecutive `<p>` elements at `text-sm text-muted-foreground` with identical spacing (`gap-4` = 16px between all items):
1. "1 of 3 correct" 
2. [pass/fail badge with icon]
3. "70% required to pass"
4. "Keep practicing! Focus on the topics below."
5. "Completed in 1m 31s"

All five lines after the ring compete for equal attention. The passing threshold ("70% required to pass") and completion time ("Completed in 1m 31s") are supporting metadata, while the pass/fail status and encouraging message are primary. They should read at different visual weights.

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:87–111`
- **Impact**: Learners take longer to parse what matters: did I pass? what do I do next? The flat hierarchy slows comprehension at the critical post-quiz moment.
- **Suggestion**: Group primary (pass/fail, score fraction) and secondary (threshold, time) information with a visual separator or lighter text weight. Increase gap between the pass/fail badge group and the metadata lines.

**M-4: `QuizNavigation` on mobile wraps actions above grid with center alignment creating imbalance**

At 375px, the `QuizNavigation` `<nav>` is `flex-col items-center`. The Previous/Next/Submit buttons are left-heavy (Previous is disabled on Q1, so only Next shows — it's left-aligned in its row). The QuestionGrid bubbles then appear below, also centered. This creates a visual rhythm where the nav controls and the grid jump between different horizontal alignments.

- **Location**: `src/app/components/quiz/QuizNavigation.tsx:25`
- **Evidence**: At 375px, `navFlexDir: "column", navAlignItems: "center"` with `actionsFlexDir: "row"` inside
- **Impact**: The navigational controls feel disconnected from the question bubbles at mobile. A learner may not immediately understand the relationship between the Previous/Next buttons and the grid.
- **Suggestion**: Change `items-center` to `items-start` on the `<nav>` at mobile, so both the action buttons and the question grid align to the left edge of the card. Or consider a sticky bottom bar pattern for mobile that keeps the nav controls always visible without scrolling.

---

### Nitpicks (Optional)

**N-1: `QuizStartScreen` badge row uses `rounded-full` (pills) but card uses `rounded-[24px]`**

The metadata badges ("3 questions", "Untimed", "70% to pass") use `rounded-full`. This is a reasonable pill/tag convention, but mixing `rounded-full` badges inside a `rounded-[24px]` card alongside `rounded-xl` buttons creates three different radius values in one component. Consider using `rounded-xl` for badges to reduce the number of active border-radius tokens.

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:38–46`

**N-2: `MarkForReview` checkbox visual hit target**

The Radix `<Checkbox>` renders a 16×16px indicator element. The overall `<div>` containing the checkbox and label is `flex items-center gap-2` — the label is `cursor-pointer` and includes the full text, so the effective tap area extends beyond 16px. However, the `<Checkbox>` itself has no explicit size class making it 44px. The `<Label>` is clickable and serves as the expanded target, but on mobile the full row height is only `~24px` — below the 44px minimum if the user taps precisely on the checkbox icon rather than the label text.

- **Location**: `src/app/components/quiz/MarkForReview.tsx:14`
- **Suggestion**: Add `min-h-[44px]` to the wrapping `<div>` and `items-center` is already present, or add a `p-2` to the label to increase the tap area.

**N-3: `ReviewSummary` jump buttons have `min-h-[44px]` and `px-2` but no explicit `rounded`**

The Q1, Q2, Q3 jump buttons in the submit dialog's ReviewSummary use `text-brand hover:underline underline-offset-2 min-h-[44px] px-2` with no border-radius class. They render with the browser default (0px radius). A `rounded` or `rounded-md` would make them consistent with the rest of the interactive elements.

- **Location**: `src/app/components/quiz/ReviewSummary.tsx:30`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | H1: 12.45:1, muted text: 7.42:1, warning: 7.00:1, brand link: 5.18:1 — all pass |
| Keyboard navigation | Pass | All 3 results page elements reachable via Tab in logical order |
| Focus indicators visible | Pass | Buttons: box-shadow ring. Links: 2px solid outline. Both visible. Back to Lesson relies on inherited outline (see H-2) |
| Heading hierarchy | Pass | Single H1 on results page. Quiz page has single H1 (quiz title) in header. No skipped levels. |
| ARIA labels on icon buttons | Pass | All buttons have visible text labels. SVGs are aria-hidden. |
| Semantic HTML | Pass | `<fieldset>`/`<legend>` for question options. `<nav>` for quiz navigation. `<button>` for all click targets. No div-as-button. |
| Form labels associated | Pass | `<Label htmlFor={id}>` correctly associated with `<Checkbox id={id}>` in MarkForReview |
| prefers-reduced-motion | Pass | `motion-reduce:transition-none` on score ring arc animation |
| Screen reader score announcement | Pass | `aria-live="polite" aria-atomic="true"` sr-only div announces full result on mount |
| `aria-current` on active question | Partial | Uses `"true"` string — valid but `"step"` would be semantically richer (see H-3) |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass with caveats | No horizontal scroll. Card: 305px wide, 16px padding. Ring: 96×96px. Score text: 30px. Buttons stack full-width. "100%" would overflow ring by 2px (B-1). |
| Tablet (768px) | Pass | No horizontal scroll. Card: 672px (max-width reached). Ring: 128×128px (sm: breakpoint active). Buttons side-by-side, natural widths. |
| Desktop (1440px) | Pass with caveats | No horizontal scroll. Card: 672px centered. Ring: 128×128px. Score text: 48px bold. "100%" overflows ring inner diameter by 18px (B-1). |

---

## Detailed Findings Summary

### Score Ring Geometry (B-1 — detailed)

The ring is implemented as a fixed 128×128px SVG with an 8px stroke, giving a 60px radius and ~376.99px circumference. The math is correct — `strokeDashoffset` for 33% computes to 251.45, which matches the expected 252.58 within SVG rendering tolerance. The `-rotate-90` class correctly starts the arc at the top of the circle. The `strokeLinecap="round"` creates rounded arc ends, which is a positive visual polish touch.

The critical defect is in the text sizing relative to ring geometry:

```
Desktop ring inner diameter: 128 - (8 × 2) = 112px
"100%" at text-5xl (48px bold): ~130px wide → overflows by 18px

Mobile ring inner diameter: 96 - (8 × 2) = 80px  
"100%" at text-3xl (30px bold): ~82px wide → overflows by 2px
```

The container is `overflow: visible` so the overflow is rendered, not clipped. The text sits on top of the ring arc strokes at both ends. For scores 0–99% this is never triggered (max 3 characters: "99%"). Only at 100% does the 4-character string cause the overflow.

**Minimum viable fix** (2 lines in `ScoreSummary.tsx`):

```tsx
// ScoreSummary.tsx:62 — current
<span className="absolute text-3xl sm:text-5xl font-bold text-foreground">

// Fix: reduce by one step when 4 characters
<span className={cn(
  "absolute font-bold text-foreground",
  percentage === 100 ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl"
)}>
```

At `text-4xl` (36px), "100%" measures approximately 104px — fitting within the 112px desktop inner diameter with 8px clearance. At `text-2xl` (24px), it measures approximately 66px, fitting within the 80px mobile inner diameter with 14px clearance.

---

## Console Output Summary

- **Errors**: 0 (on results page)
- **Warnings (quiz flow)**: `RadioGroup is changing from uncontrolled to controlled` — fires once per question when the learner makes their first selection (see H-1)
- **Warnings (global)**: `<meta name="apple-mobile-web-app-capable">` deprecation — pre-existing, unrelated to this story
- **Performance**: FCP 254ms (good), LCP 521ms (good), CLS 0.00 (good), TTFB 33ms (good)

---

## Recommendations

1. **Fix B-1 now** — it takes 2 lines of code and directly affects the celebratory 100% state. This is the most visible defect and the easiest to fix.

2. **Fix H-1 (RadioGroup warning)** before the sprint ends — the `value ?? ''` change is a one-liner at the `QuestionDisplay` call site and eliminates a React anti-pattern that could cause subtle bugs during rapid question navigation.

3. **Address H-2 (Back to Lesson focus ring)** in the same pass — adding `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded` to the link class string makes keyboard navigation behavior explicit and consistent across all browsers.

4. **Prioritize M-2 (track circle contrast)** for the next iteration — the nearly-invisible track arc at mobile is a perception issue that reduces the meaning of the score ring for all users, not just those with visual impairments.
