# Design Review Report — Stitch Quiz Enhancements

**Review Date**: 2026-03-20
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/stitch-quiz-enhancements`
**Changed Files**:
- `src/app/components/quiz/AreasForGrowth.tsx`
- `src/app/components/quiz/QuestionBreakdown.tsx`
- `src/app/components/quiz/QuestionHint.tsx`
- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/pages/Quiz.tsx`
- `src/app/pages/QuizResults.tsx`

**Affected Pages**: Quiz (`/courses/:courseId/lessons/:lessonId/quiz`), Quiz Results (`…/quiz/results`)

---

## Executive Summary

This review covers the Stitch quiz enhancements — a redesigned progress ring (ScoreSummary), per-question breakdown (QuestionBreakdown), growth area list (AreasForGrowth), contextual hints (QuestionHint), auto-focus on Next after answering, and a timer with accessible minute-boundary announcements. The implementation is well-structured, uses design tokens consistently, and achieves strong accessibility intent. Two console errors/warnings surfaced during testing that require attention before merge: a React "setState during render" error in QuizHeader and a RadioGroup controlled/uncontrolled cycling warning in MultipleChoiceQuestion.

---

## What Works Well

- **Score ring design**: The SVG progress ring with tier-based color coding (success/brand/warning/destructive) is visually distinctive and uses semantic design tokens correctly. The `motion-reduce:transition-none` guard on the 700ms ring animation is a thoughtful accessibility touch.
- **Touch targets**: Every interactive element measured at the 44px minimum — nav buttons (44px), radio option labels (61px), action buttons (44px), the collapsible trigger (44px). This is exemplary mobile preparation.
- **Responsive layout**: No horizontal overflow at any breakpoint. The `p-4 sm:p-8` padding pattern on the card correctly reduces at mobile. The `flex-col sm:flex-row` action button stack works correctly.
- **Accessible score announcement**: The `aria-live="polite"` `aria-atomic="true"` sr-only region in ScoreSummary correctly announces the score to screen readers without cluttering the visual layout. The SVG ring has `aria-hidden="true"`.
- **Semantic structure on results page**: Clean H1 → H2 heading hierarchy (Results title → "Areas to Review"), `<section aria-labelledby>` on AreasForGrowth, `<nav aria-label="Quiz navigation">` on the quiz footer.
- **Design token compliance**: Zero hardcoded hex colors or raw Tailwind palette colors (e.g. `bg-blue-600`) found across all six changed files. All color usage routes through semantic tokens (`text-brand`, `text-warning`, `text-success`, `text-destructive`).
- **QuestionHint accessibility**: `role="note"`, `aria-label="Question hint"`, icon `aria-hidden="true"`, and a visible "Hint" label heading provide excellent screen reader context.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### 1. React "setState during render" error in QuizHeader

**Issue**: Every time a quiz answer is selected (which triggers a re-render), the browser console logs:
```
[ERROR] Cannot update a component (`Quiz`) while rendering a different component (`QuizHeader`).
```

**Location**: `src/app/components/quiz/QuizHeader.tsx:57-59`

**Evidence**: Consistently reproduced in live testing; captured via `browser_console_messages`. The error fires on every answer selection.

**Root cause**: Inside the `setInterval` updater function, `setLiveAnnouncement()` is called from within the `setRemainingSeconds` functional updater:

```tsx
// QuizHeader.tsx lines 49-61 (the problem)
setRemainingSeconds(s => {
  // ...
  if (next % 60 === 0) {
    setLiveAnnouncement(formatMinuteAnnouncement(next))  // setState inside setState updater
  }
  return next
})
```

React 18 strict mode flags calling one component's `setState` from inside another component's state updater as a violation because updater functions must be pure.

**Impact**: While the UI still functions, this is a React rule violation that will generate errors in production, can cause missed announcements if React batches the update, and signals fragile state coordination that may break in a future React upgrade.

**Suggestion**: Split the two state updates. Use a `useRef` to track the last announced minute, and derive whether to update the live announcement outside the updater:

```tsx
// Replace the setInterval body with:
intervalRef.current = setInterval(() => {
  setRemainingSeconds(prev => {
    if (prev === null || prev <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return 0
    }
    return prev - 1
  })
}, 1000)

// Separately, watch remainingSeconds in a useEffect to set announcement:
useEffect(() => {
  if (remainingSeconds !== null && remainingSeconds % 60 === 0) {
    setLiveAnnouncement(formatMinuteAnnouncement(remainingSeconds))
  }
}, [remainingSeconds])
```

---

#### 2. RadioGroup controlled/uncontrolled cycling warning

**Issue**: Five console warnings logged per quiz session:
```
[WARNING] RadioGroup is changing from uncontrolled to controlled.
[WARNING] RadioGroup is changing from controlled to uncontrolled.
```
This alternates on every question navigation.

**Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:48-53`

**Evidence**: Confirmed in browser console during testing. The `value` prop to `<RadioGroup>` transitions from `undefined` (first render of a new question before any answer) to a string (after selection), then back to `undefined` when navigating to an unanswered question.

**Root cause**: When navigating to a previously unanswered question, `value` is `undefined`. Radix UI's RadioGroup treats `undefined` as uncontrolled mode; passing a string value switches it to controlled. The alternation between these two modes triggers the React warning and can cause Radix to lose internal state.

**Impact**: Unexpected behavior for learners who navigate back to a question — the previously selected answer may visually appear deselected even though it is stored in the quiz progress. Also triggers the same React controlled/uncontrolled warnings that Radix treats as a bug.

**Suggestion**: Normalize `undefined` to an empty string so the component stays in controlled mode throughout its lifetime:

```tsx
// MultipleChoiceQuestion.tsx
<RadioGroup
  value={value ?? ''}   // never undefined — stays controlled
  onValueChange={isActive ? onChange : undefined}
  disabled={!isActive}
  aria-labelledby={legendId}
>
```

---

### Medium Priority (Fix when possible)

#### 3. Question text truncation in QuestionBreakdown is inaccessible on keyboard

**Issue**: Long question texts in the expanded QuestionBreakdown rows are truncated with CSS `truncate` (text-overflow: ellipsis). A `title` attribute tooltip is set on the span, which works on hover but is inaccessible to keyboard-only users and screen readers.

**Location**: `src/app/components/quiz/QuestionBreakdown.tsx:82-87`

```tsx
<span
  className="text-sm text-foreground flex-1 min-w-0 truncate"
  title={row.question.text}    // tooltip only — not screen reader accessible
>
  {row.question.text}
</span>
```

**Impact**: A learner navigating with a keyboard (or using a screen reader) who wants to read the full question text in the breakdown cannot do so. The visual truncation with tooltip pattern is mouse-only.

**Suggestion**: Since the question text is already in the DOM (it's just clipped by CSS overflow), consider either: (a) removing truncation entirely and letting the text wrap — the 44px `min-h` row will expand gracefully; or (b) keeping truncation but adding an `aria-label` with the full text on the `<li>` element so screen readers read the full name. Option (a) is simpler and eliminates the accessibility gap entirely given these are short educational questions.

---

#### 4. QuestionBreakdown trigger has concatenated accessible name

**Issue**: The collapsible trigger's accessible name is computed as "Question Breakdown2/3 correct" (no space between the two spans). A screen reader will announce this as one run-on string.

**Location**: `src/app/components/quiz/QuestionBreakdown.tsx:56-70`

**Evidence**: Confirmed via accessibility snapshot: `button "Question Breakdown 2/3 correct"` (the accessibility tree normalises whitespace, but the DOM text nodes are directly adjacent with no space).

**Impact**: Minor annoyance for screen reader users — the score summary within the button label runs directly into the heading text. Not a blocker but reduces the quality of the screen reader experience.

**Suggestion**: Add a comma or separator, or use `aria-label` on the trigger to provide a clean, explicit name:

```tsx
<CollapsibleTrigger aria-label={`Question Breakdown, ${correctCount} of ${rows.length} correct`} …>
```

---

#### 5. Missing `motion-reduce` guard on MultipleChoiceQuestion option transitions

**Issue**: The radio option label `transition-colors duration-150` in MultipleChoiceQuestion has no `motion-reduce:transition-none` guard.

**Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx:61`

```tsx
'flex items-start gap-3 rounded-xl p-4 min-h-12 cursor-pointer transition-colors duration-150 border-2',
```

**Impact**: Learners with vestibular disorders who have `prefers-reduced-motion` enabled will still see the color transition on every answer selection. This is inconsistent with ScoreSummary and QuestionBreakdown, both of which already include `motion-reduce:transition-none`.

**Suggestion**: Add `motion-reduce:transition-none` to the label class string — a one-word addition that maintains consistency with the other components in this PR.

---

### Nitpicks (Optional)

#### 6. AreasForGrowth section border radius is `rounded-xl` (14px) where cards use `rounded-[24px]`

The inner `bg-muted` container in AreasForGrowth uses `rounded-xl` (12px/14px computed). The design system specifies `rounded-[24px]` for cards. Since this is a sub-section within the results card rather than a standalone card, `rounded-xl` is defensible, but it creates a slight visual inconsistency with the outer card's 24px radius. If the intention is a nested panel, no change needed; if it should feel like a card, update to `rounded-[24px]`.

**Location**: `src/app/components/quiz/AreasForGrowth.tsx:26`

---

#### 7. The `Back to Lesson` link uses inline `min-h-[44px]` instead of a Tailwind component token

Minor: `min-h-[44px]` is used directly as an arbitrary value in both `Quiz.tsx` and `QuizResults.tsx`. The rest of the codebase consistently uses this pattern for touch targets, so it's not inconsistent, but if a `min-h-touch` utility token were ever added to the theme, these would need updating.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | All text tokens render with sufficient contrast in both light and dark mode. Warning amber (#DAA860 in dark mode) on card background passes at large text sizes. |
| Keyboard navigation | Pass | Tab order follows visual layout. RadioGroup uses Radix's roving tabindex pattern correctly (group gets focus, arrows navigate within). |
| Focus indicators visible | Pass | `focus-visible:ring-[3px]` on buttons and `focus-within:ring-2` on radio labels provide clear keyboard indicators. Skip link uses `focus:bg-brand` styling. |
| Heading hierarchy | Pass | H1 ("Introduction Quiz — Results") → H2 ("Areas to Review"). No skipped levels. |
| ARIA labels on icon buttons | Pass | All icon-only interactive elements in quiz components have accessible names. CheckCircle2 and XCircle in breakdown have `role="img" aria-label="Correct/Incorrect"`. |
| Semantic HTML | Pass | `<section aria-labelledby>`, `<nav aria-label>`, `<fieldset>/<legend>` for questions, `role="note"` for hints. |
| Form labels associated | Pass | RadioGroup items use `<label>` wrapping the `<RadioGroupItem>` — correct association. |
| Score ring screen reader | Pass | `aria-live="polite" aria-atomic="true"` sr-only region announces score on results load. SVG has `aria-hidden="true"`. |
| prefers-reduced-motion | Partial | ScoreSummary ring and QuestionBreakdown trigger have `motion-reduce:transition-none`. MultipleChoiceQuestion option transitions do not (see finding #5). |
| No color as sole indicator | Pass | Correct/Incorrect icons in breakdown use both icon shape and aria-label, not color alone. Score tier uses label text ("NEEDS REVIEW") alongside color. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal overflow. Card padding reduces correctly to `p-4` (16px). All touch targets ≥44px. Action buttons stack to single column. Mobile bottom navigation appears. |
| Tablet (768px) | Pass | No horizontal overflow. Card width 672px with full `sm:p-8` padding. Hamburger menu replaces sidebar correctly. Neither sidebar nor mobile nav creates layout conflict. |
| Desktop (1440px) | Pass | Card maxes at `max-w-2xl` (672px) and centers correctly. Sidebar visible and collapsed to icon-width. Score ring responsive size (`size-40 sm:size-44`) scales appropriately. |

---

## Detailed Findings Summary

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | `setState` inside `setState` updater in QuizHeader timer | `QuizHeader.tsx:57-59` | High |
| 2 | RadioGroup `undefined`/string value cycling | `MultipleChoiceQuestion.tsx:48` | High |
| 3 | Truncated question text inaccessible to keyboard/screen readers | `QuestionBreakdown.tsx:83` | Medium |
| 4 | Concatenated accessible name on breakdown trigger | `QuestionBreakdown.tsx:56-70` | Medium |
| 5 | Missing `motion-reduce:transition-none` on radio option labels | `MultipleChoiceQuestion.tsx:61` | Medium |
| 6 | AreasForGrowth inner panel uses `rounded-xl` vs outer card `rounded-[24px]` | `AreasForGrowth.tsx:26` | Nitpick |
| 7 | Inline `min-h-[44px]` not using a theme token | `Quiz.tsx`, `QuizResults.tsx` | Nitpick |

---

## Recommendations

1. **Fix the two High Priority console issues before merge.** The `setState-in-render` error is a React violation that will appear in production and could cause missed screen reader announcements. The RadioGroup fix is a one-line change (`value ?? ''`) that eliminates five warnings per quiz session.

2. **Add `motion-reduce:transition-none` to MultipleChoiceQuestion option labels** — it is a one-word addition that makes this component consistent with all others in the PR that already include it.

3. **Consider removing truncation in QuestionBreakdown rows** rather than trying to paper over it with tooltips. The question texts in this dataset are short (under 60 characters) and will wrap gracefully without causing layout problems, while improving accessibility for keyboard users.

4. **The broader sidebar navigation accessibility gap** (all nav links have empty text and no aria-labels — pre-existing, not introduced in this PR) should be tracked in a dedicated story. It caused the second Tab stop to land on an unlabelled link during keyboard testing.
