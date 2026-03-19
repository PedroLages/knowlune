# Design Review Report — E12-S06: Calculate and Display Quiz Score

**Review Date**: 2026-03-19
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E12-S06 — Calculate and Display Quiz Score
**Changed Files**:
- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/pages/QuizResults.tsx`
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/components/quiz/QuestionDisplay.tsx`
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`

**Testing Method**: Live browser via Playwright MCP with seeded IndexedDB quiz data. Full flow tested: Start Screen → Active Quiz (3 questions) → Submit → Results. AlertDialog tested with unanswered questions. All 3 viewports verified.

---

## Executive Summary

The E12-S06 quiz scoring feature is well-structured and largely follows LevelUp design conventions. The ScoreRing animation, responsive layout, semantic HTML, and design token usage are all strong. Three contrast ratio failures were identified — including the `warning` color used for not-passing learners, which is the most important state to get right pedagogically. One medium-priority UX issue was found in the passing score conditional display, and a code quality concern exists in the routing architecture.

---

## What Works Well

- **Zero hardcoded colors**: Every color in all seven quiz component files uses design tokens (`text-success`, `text-warning`, `bg-brand`, `bg-brand-soft`, etc.). The ESLint enforcement is clearly working.
- **Score ring implementation**: The SVG ring correctly uses `size-24 sm:size-32` (96px mobile / 128px desktop), `motion-reduce:transition-none` respects reduced-motion preferences, and `aria-hidden="true"` on the SVG with a separate `sr-only` live region is the right accessibility pattern.
- **Touch targets**: All interactive elements (Previous, Next, Submit Quiz, Retake Quiz, Review Answers, Back to Lesson) measured at exactly 44px height on mobile — meeting the WCAG minimum.
- **Responsive buttons**: Results page buttons correctly stack to `flex-col` on mobile and `flex-row` at `sm:` breakpoint. No horizontal overflow at any viewport.
- **AlertDialog keyboard behavior**: Escape key correctly closes the dialog and returns focus. Dialog has `role="alertdialog"`, overlay is present, and both buttons meet the 44px touch target minimum.
- **RadioGroup semantics**: `<fieldset>` + `<legend>` used correctly for question groups. `aria-labelledby` on the RadioGroup references a valid element ID. The `focus-within:ring-2` on option labels gives a clear keyboard focus indicator.
- **Timer accessibility**: QuizHeader uses `aria-hidden="true"` on the visual countdown (avoids per-second announcements) with a separate `sr-only` live region that announces once per minute — a thoughtful pattern.
- **Loading and error states**: Both Quiz.tsx and QuizResults.tsx have full Skeleton loading states with `role="status" aria-busy="true"` and proper error states with `role="alert"`.
- **Card design tokens**: `bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm` is consistently applied across all quiz card surfaces. Computed border-radius confirmed 24px at runtime.

---

## Findings by Severity

### Blockers (Must fix before merge)

**1. `warning` color fails WCAG AA contrast for normal text**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:106–108`
- **Evidence**: `text-warning` (`#9a7235`, `rgb(154, 114, 53)`) on card background (`#ffffff`) measures **4.35:1** — below the 4.5:1 AA threshold for normal text.
- **Impact**: Learners who did not pass rely on the "Keep Going!" status message for motivation and clarity. This is the most emotionally significant text on the results page, and it fails contrast for roughly 8% of users with low-vision or specific contrast sensitivities. Educational equity requires fixing this first.
- **Suggestion**: Darken the light-mode `--warning` token in `src/styles/theme.css` to achieve at least 4.5:1 on white. Target `#7d5c1e` or similar (approx. 5.1:1). Alternatively add a `warning-accessible` token specifically for text-on-white use cases, distinct from the badge/icon use case where `warning` at 3:1 (large text / non-text) is acceptable.

**2. `brand` color fails WCAG AA contrast for normal-sized text (two locations)**

- **Location A**: `src/app/pages/QuizResults.tsx:100–106` — "Back to Lesson" link
- **Location B**: `src/app/components/quiz/QuizStartScreen.tsx:38–40` — metadata badge text
- **Evidence**:
  - `brand` (`#5e6ad2`, `rgb(94, 106, 210)`) on page background (`#faf5ee`): **4.33:1** — fails AA (14px normal text needs 4.5:1).
  - `brand` on `brand-soft` (`#e4e5f4`): **3.76:1** — fails AA for normal text.
- **Impact**: The "Back to Lesson" link and question-count/time-limit badges are 14px normal-weight text. Screen users with low-vision who rely on color contrast cannot reliably read these.
- **Suggestion**: For the Back to Lesson link, consider adding `font-medium` or `font-semibold` (which promotes it to "large text" at 18px bold equivalent, where 3:1 suffices), or use `text-foreground hover:text-brand` instead. For the badges in QuizStartScreen, the `brand-soft` background lightens the contrast — consider `bg-muted text-foreground` for metadata badges, reserving `bg-brand-soft text-brand` for decorative highlights where the text is not load-bearing.

---

### High Priority (Should fix before merge)

**3. Passing score threshold hidden from failing learners**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:113–117`
- **Evidence**:
  ```tsx
  {passed && (
    <p className="text-sm text-muted-foreground">
      {passingScore}% required to pass
    </p>
  )}
  ```
- **Impact**: A learner who scored 60% on a quiz that requires 70% to pass never sees what score they need. They see "Keep Going! You got 2 of 3 correct" but have no target to work toward. This directly undermines the learning goal — knowing the benchmark is essential for motivated re-study.
- **Suggestion**: Show the passing threshold unconditionally, and on failure make it even more prominent:
  ```tsx
  <p className="text-sm text-muted-foreground">
    {passed
      ? `${passingScore}% required to pass`
      : `${passingScore}% required to pass — you scored ${Math.round(percentage)}%`}
  </p>
  ```

**4. AlertDialog "Submit Anyway" action uses `bg-primary` instead of `bg-destructive`**

- **Location**: `src/app/pages/Quiz.tsx:331` (the `<AlertDialogAction>` element)
- **Evidence**: Computed `backgroundColor` is `rgb(28, 29, 43)` (primary, dark navy). The `destructive` token is `#c44850`.
- **Impact**: The AlertDialog component's default `AlertDialogAction` style applies `bg-primary`. But "Submit Anyway" with unanswered questions is a consequential, lossy action — it irreversibly scores blanks as wrong. Design principles state "Destructive: Red for delete/remove operations." The visual styling does not signal the weight of this action. The "Start Over" dialog in `QuizStartScreen.tsx` correctly uses `bg-destructive` — this is inconsistent.
- **Suggestion**: Add an explicit className to the AlertDialogAction:
  ```tsx
  <AlertDialogAction
    onClick={handleSubmitConfirm}
    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
  >
    Submit Anyway
  </AlertDialogAction>
  ```

**5. AlertDialog background uses page background color, not card color**

- **Location**: `src/app/pages/Quiz.tsx:319–336`
- **Evidence**: `dialogBg` computed as `rgb(250, 245, 238)` — the page background (`#FAF5EE`), not the card background (`#ffffff`). All other quiz cards use `bg-card` (white). The dialog appears against a warm off-white which is correct for the Radix overlay, but the dialog panel itself should render on `bg-card` for elevation contrast.
- **Impact**: Low visual elevation hierarchy — the dialog does not visually "float" above the page with the expected white surface. In dark mode this will be particularly noticeable.
- **Suggestion**: This is likely the default Radix AlertDialogContent background inheriting from `--background` rather than `--card`. Check `src/app/components/ui/alert-dialog.tsx` and ensure the content element uses `bg-card` (or `bg-popover` which resolves to white/dark-card).

---

### Medium Priority (Fix when possible)

**6. RadioGroup controlled/uncontrolled React warning on every question navigation**

- **Location**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` (runtime, triggered on navigation)
- **Evidence**: Console captured 6 warnings during the test session: `"RadioGroup is changing from uncontrolled to controlled"` and `"RadioGroup is changing from controlled to uncontrolled"` — alternating on each Next/Previous click.
- **Impact**: These warnings indicate that the `value` prop passed to `RadioGroup` transitions between `undefined` and a string value as the user navigates. React treats `undefined` as uncontrolled and a string as controlled. This does not break functionality but causes unnecessary internal reconciliation and will surface as a real bug if Radix adds stricter controlled/uncontrolled enforcement in a future version.
- **Suggestion**: In `MultipleChoiceQuestion.tsx`, change the default from `undefined` to an empty string when no answer exists:
  ```tsx
  // In QuestionDisplay.tsx
  const mcValue = typeof value === 'string' ? value : ''
  ```
  This keeps the RadioGroup always controlled. Radix RadioGroup treats `''` as "no selection" correctly.

**7. Inconsistent routing: lesson viewer uses `courses/:courseId/:lessonId` but quiz uses `courses/:courseId/lessons/:lessonId/quiz`**

- **Location**: `src/app/routes.tsx:125` vs `src/app/routes.tsx:133`
- **Evidence**:
  - Lesson viewer route: `courses/:courseId/:lessonId`
  - Quiz route: `courses/:courseId/lessons/:lessonId/quiz`
- **Impact**: The asymmetry makes the URL structure harder to reason about and will cause confusion when building links between quizzes and lessons (as the `QuizResults.tsx` Back to Lesson link demonstrates — initially appeared to be a bug until the inconsistent route was found). Future developers are likely to introduce real link bugs because the pattern is not obvious.
- **Suggestion**: Normalise to `courses/:courseId/lessons/:lessonId` for both the lesson viewer and quiz routes. This is a larger refactor but worth scheduling before more routes are added that depend on this pattern.

**8. LCP performance poor on quiz page (15042ms)**

- **Evidence**: Console log: `[LevelUp:Perf] LCP: 15042.08ms (rating: poor)`. This was measured during active quiz testing after interaction, so it may reflect a long-running animation being tracked as LCP. Worth investigating whether the ScoreRing SVG or a large image is triggering this. The results page LCP was also `4675ms` on initial load.
- **Impact**: Poor LCP signals a slow perceived load for the learner. For quiz flows where engagement is high and time-sensitive, slow loading undermines the experience.
- **Suggestion**: Profile with Chrome DevTools to identify the LCP element. If the SVG score ring is the LCP element, marking it `aria-hidden="true"` (already done) should help the browser deprioritise it — but the LCP element may still be the `%` text inside the ring. Consider adding `loading="eager"` or explicit size attributes if images are involved.

**9. `min-h-[44px]` on Back to Lesson link inline text is not truly 44px tall in practice**

- **Location**: `src/app/pages/QuizResults.tsx:102`
- **Evidence**: At 375px mobile, the Back to Lesson link measured 44px height via `getBoundingClientRect()` — which passes. However the link text is 14px with `min-h-[44px]` only enforcing a minimum, and the inline-flex layout means the actual tap area depends on content. This is fine as implemented, but worth noting that `min-h-[44px]` achieves the target only if the flex container stretches.
- **Impact**: Low — passes in practice. Worth a comment in code for future maintainers.

---

### Nitpicks (Optional)

**10. Encouraging message shows in italic but not centred with other content**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:119–121`
- The `italic` style on the encouraging message (`"Excellent work! You've mastered this material."`) is a pleasant touch. However, at desktop the card is `text-center` but the italic text sits below the pass/fail status in a way that feels like a secondary label. Consider `text-base` (currently defaults to `text-sm`) and removing the `italic` to give it the same visual weight as the other status lines.

**11. `CheckCircle` vs `Circle` icon choice for not-passed state**

- **Location**: `src/app/components/quiz/ScoreSummary.tsx:105`
- A plain `Circle` (unfilled) is used for the not-passed state. A more semantically appropriate choice might be `XCircle` or `AlertCircle` from lucide-react — the filled circle outline conveys completion/neutral rather than "not yet." `Circle` is valid and inoffensive; this is purely a polish suggestion.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 (normal text) | FAIL | `warning` text: 4.35:1; `brand` on `background`: 4.33:1; `brand` on `brand-soft`: 3.76:1 |
| Text contrast >= 3:1 (large text / non-text) | PASS | All large text and icon pairs pass |
| Keyboard navigation | PASS | Tab order logical; Previous/Next/Submit reachable; Escape closes dialog |
| Focus indicators visible | PASS | `focus-visible` ring defined globally in `theme.css`; `focus-within:ring-2` on option labels |
| Heading hierarchy | PASS | Single H1 per page (`quiz.title`); no skipped levels |
| ARIA labels on icon buttons | PARTIAL | 8 icon-only buttons without aria-label detected — these belong to the Agentation overlay tool, not the quiz UI itself; quiz-specific buttons all have visible text labels |
| Semantic HTML (fieldset/legend) | PASS | Question group uses `<fieldset>` + `<legend>`; RadioGroup uses `aria-labelledby` pointing to a valid element |
| ARIA live regions for score | PASS | `sr-only` div with `aria-live="polite" aria-atomic="true"` announces score on results page |
| Form labels associated | PASS | Radio options use `<label>` wrapping the `<RadioGroupItem>` |
| `prefers-reduced-motion` | PASS | `motion-reduce:transition-none` on score ring SVG stroke animation |
| Timer screen reader announcements | PASS | Visual timer has `aria-hidden="true"`; separate `sr-only` live region announces per-minute |
| AlertDialog semantics | PASS | `role="alertdialog"`, overlay present, focus trapped inside dialog |
| No hardcoded colors | PASS | Zero hex literals or raw Tailwind color utilities found across all 7 files |
| No inline style attributes | PASS | No `style={}` props in quiz components |

---

## Responsive Design Verification

- **Mobile (375px)**: PASS — Ring: 96×96px (correct `size-24`). Buttons stacked `flex-col`. No horizontal overflow. All touch targets 44px. Card padding responsive `p-4`.
- **Tablet (768px)**: PASS — Ring: 128×128px (correct `sm:size-32`). Buttons in `flex-row`. Card constrained to 672px (`max-w-2xl`). No horizontal overflow.
- **Desktop (1440px)**: PASS — Ring: 128×128px. Sidebar persistent. Card centred with `mx-auto`. All spacing correct.

---

## Detailed Findings Summary

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| 1 | Blocker | `ScoreSummary.tsx` | 106 | `text-warning` 4.35:1 contrast on white — fails AA |
| 2 | Blocker | `QuizResults.tsx` / `QuizStartScreen.tsx` | 102 / 38 | `text-brand` 4.33:1 on background, 3.76:1 on `brand-soft` — fails AA |
| 3 | High | `ScoreSummary.tsx` | 113 | Passing threshold hidden from failing learners |
| 4 | High | `Quiz.tsx` | 331 | "Submit Anyway" uses `bg-primary` not `bg-destructive` |
| 5 | High | `Quiz.tsx` | 319 | AlertDialog panel uses page background, not card background |
| 6 | Medium | `MultipleChoiceQuestion.tsx` | runtime | RadioGroup controlled/uncontrolled React warning on navigation |
| 7 | Medium | `routes.tsx` | 125,133 | Routing inconsistency: lesson vs quiz URL structure |
| 8 | Medium | `Quiz.tsx` | runtime | LCP 15042ms (poor) on quiz page |
| 9 | Medium | `QuizResults.tsx` | 102 | `min-h-[44px]` note for future maintainers |
| 10 | Nitpick | `ScoreSummary.tsx` | 119 | Italic weight on encouraging message |
| 11 | Nitpick | `ScoreSummary.tsx` | 105 | `Circle` icon ambiguous for not-passed state |

---

## Recommendations

1. **Fix the two Blocker contrast issues first.** The `warning` and `brand` token values are close to passing (4.35 vs 4.5, 4.33 vs 4.5) — small darkening adjustments in `theme.css` will resolve both without visible design impact. Check dark mode values at the same time.

2. **Show the passing threshold unconditionally** in `ScoreSummary.tsx`. This is a one-line change and directly serves learner motivation — the single most important UX fix after the contrast issues.

3. **Add `bg-destructive` to the AlertDialog "Submit Anyway" action** for consistency with the "Start Over" dialog pattern already established in `QuizStartScreen.tsx`.

4. **Schedule a routing normalisation story** to align `courses/:courseId/lessons/:lessonId` across lesson viewer and quiz routes before more features build on this pattern.
