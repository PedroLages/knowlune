# Design Review — E15-S06: Track Time-to-Completion for Each Attempt

**Review Date**: 2026-03-22  
**Reviewed By**: Claude Sonnet 4.6 (design-review agent via Playwright MCP)  
**Branch**: `feature/e15-s06-track-time-to-completion-for-each-attempt`  
**Changed Files**:
- `src/app/components/quiz/ScoreSummary.tsx`
- `src/app/components/quiz/PerformanceInsights.tsx`
- `src/app/pages/QuizResults.tsx`

**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz/results` (QuizResults page)

---

## Executive Summary

E15-S06 adds time-to-completion display and previous-attempt time comparison to the ScoreSummary component on the QuizResults page. The core feature works correctly — time data renders as expected in both single and multi-attempt scenarios, and untimed quizzes correctly suppress the time display. One blocker was found: the "Previous: Xm Ys" comparison text fails WCAG AA contrast in both light and dark mode due to `text-muted-foreground/70` (70% opacity). Two medium-priority issues were identified around screen reader coverage and a very minor visual grouping gap.

---

## What Works Well

- **Design token discipline is excellent.** Zero hardcoded hex colors, zero inline style attributes across all changed files. Every color uses semantic tokens (`text-muted-foreground`, `text-success`, `text-destructive`, `text-brand`, etc.).
- **Card border radius is correct.** `rounded-[24px]` resolves to exactly 24px (verified via `getComputedStyle`), matching the design system spec for cards.
- **Responsive layout is solid across all three breakpoints.** No horizontal overflow at 375px, 768px, or 1440px. The card padding correctly drops from `p-8` (32px) to `p-4` (16px) at mobile. Action buttons correctly switch from `flex-row` at tablet/desktop to `flex-col` at mobile.
- **Touch targets meet the 44px minimum.** Retake Quiz (44px), Review Answers (44px), and Back to Lesson (44px) all pass. The `min-h-[44px]` pattern is applied correctly.
- **`prefers-reduced-motion` is respected.** The SVG score ring uses `motion-reduce:transition-none` — learners with motion sensitivity are protected.
- **Untimed quiz correctly hides time display.** The `showTimeSpent={currentQuiz.timeLimit != null && lastAttempt.timerAccommodation !== 'untimed'}` logic cleanly gates the feature.
- **Visual hierarchy between "Completed in" and "Previous:" is clear.** The primary line is 14px, the comparison is 12px — size differentiation communicates relative importance without relying solely on color.
- **No console errors.** Only one pre-existing browser warning about a deprecated meta tag (unrelated to this story).
- **`tabular-nums` is applied throughout.** Both time strings (`Completed in 8m 32s`, `Previous: 10m 15s`) use `tabular-nums`, preventing number width jitter when values change.

---

## Findings by Severity

### Blockers (Must fix before merge)

**[Blocker] WCAG AA contrast failure on "Previous: Xm Ys" text — both light and dark mode**

The previous-attempt time comparison line uses `text-muted-foreground/70` (70% opacity). This fails the 4.5:1 WCAG AA requirement for 12px normal-weight text in both colour modes:

| Mode | Text Color (blended) | Background | Contrast | Required | Result |
|------|----------------------|------------|----------|----------|--------|
| Dark | `rgb(135, 138, 156)` | `rgb(36, 37, 54)` | **4.41:1** | 4.5:1 | FAIL |
| Light | `rgb(147, 149, 155)` | `rgb(255, 255, 255)` | **2.99:1** | 4.5:1 | FAIL |

The light mode failure (2.99:1) is severe. Because the text communicates meaningful data — the previous attempt's duration — it cannot be treated as decorative.

The opacity modifier is being used to create visual de-emphasis, which is the right design intent (secondary information, subordinate to "Completed in"). However, the mechanism breaks contrast. The solution is to use a token that achieves the intended quietness without relying on opacity:

- Remove `/70` — use plain `text-muted-foreground` (7.42:1 dark, 5.57:1 light, both pass)
- Or use `text-xs` at `text-muted-foreground` — the smaller size already communicates secondary importance

**Location**: `src/app/components/quiz/ScoreSummary.tsx:165`  
```
className="text-xs text-muted-foreground/70 tabular-nums"
```

---

### High Priority (Should fix before merge)

None identified.

---

### Medium Priority (Fix when possible)

**[Medium] Screen reader live region does not announce time-to-completion data**

The `aria-live="polite"` region in ScoreSummary announces score, pass/fail, and previous-best percentage — but does not include the time data added by this story. Screen readers will not announce "Completed in 8m 32s" or "Previous: 10m 15s" to users who rely on assistive technology.

Current SR announcement (verbatim from DOM):
> "Quiz score: 0 percent. NaN of NaN correct. Not passed. Previous best was 100 percent."

The time information is essential for the feature's purpose — tracking personal performance — and should be included in the announcement.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:146-149`

The `improvementSrText` pattern already exists and works well for score comparison. A parallel `timeSpentSrText` variable should be constructed and appended to the announcement string only when `showTimeSpent` is true:

```
// Example structure only — not prescriptive
const timeSpentSrText = showTimeSpent
  ? ` Completed in ${formatDuration(Math.max(timeSpent, 1000))}.`
    + (previousAttemptTimeSpent != null
      ? ` Previous attempt: ${formatDuration(Math.max(previousAttemptTimeSpent, 1000))}.`
      : '')
  : ''
```

---

**[Medium] 4px gap between "Completed in" and "Previous:" is too tight for visual breathing room**

The two time lines are separated by only `gap-1` (4px). Measured in the live DOM: 3.99px. Given that the surrounding ScoreSummary container uses `gap-4` (16px) between all its major elements, the time sub-section feels collapsed compared to everything around it.

This is a minor polish issue — it does not break anything — but a `gap-2` (8px) would better align with the 8px base grid and give the comparison line room to breathe as a distinct data point.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:160`  
```
className="flex flex-col items-center gap-1"
```

---

### Nitpicks (Optional)

**[Nit] Middle-dot separator in "Previous best: 100% · Keep practicing!" has no space before the dot**

In the DOM the text reads `Previous best: 100%· Keep practicing!` — the middle-dot runs directly against the percentage sign with no space. This is because the "same as best" and "keep practicing" spans use `ml-1.5` for left margin, but the preceding `&middot;` in the "delta < 0" branch is rendered directly inside the span without the middle-dot separator, while the delta-zero branch uses `&middot;` inline. It is subtle but inconsistent with the `score · passingScore` line above which uses proper spacing.

**Location**: `src/app/components/quiz/ScoreSummary.tsx:179-182`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 (normal text) | FAIL | "Previous: Xm Ys" fails in both modes: 4.41:1 dark, 2.99:1 light |
| Text contrast ≥ 4.5:1 ("Completed in") | Pass | 7.42:1 dark, 5.57:1 light |
| Keyboard navigation | Pass | All interactive elements reachable via Tab; focus-visible ring present on all active elements |
| Focus indicators visible | Pass | `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements including Back to Lesson link |
| Heading hierarchy | Pass | Single H1 "Results"; no sub-sections require H2 in this content |
| ARIA labels on icon-only buttons | Pass | No icon-only buttons; all buttons have visible text labels |
| Semantic HTML | Pass | `<button>` for actions, `<a>` for navigation, `<main>`, `<nav>`, `aria-live` for dynamic content |
| Form labels associated | N/A | No forms on results page |
| `prefers-reduced-motion` | Pass | SVG ring uses `motion-reduce:transition-none`; duration-700 animation suppressed |
| Screen reader time announcement | FAIL | `aria-live` region omits time-to-completion and previous-attempt time data |
| Touch targets ≥ 44px | Pass | All interactive elements: 44px height confirmed (Retake Quiz, Review Answers, Back to Lesson) |

---

## Responsive Design Verification

| Breakpoint | Overflow | Layout | Padding | Actions | Status |
|------------|----------|--------|---------|---------|--------|
| Mobile 375px | None | Single column, card fills viewport | 16px (`p-4`) | `flex-col` stack | Pass |
| Tablet 768px | None | Card 672px wide, centered | 32px (`p-8`) | `flex-row` side-by-side | Pass |
| Desktop 1440px | None | Card max-w-2xl, sidebar visible | 32px (`p-8`) | `flex-row` side-by-side | Pass |

All three viewports pass. No horizontal scrolling. The `sm:p-8` / `sm:size-44` responsive classes activate correctly at the 640px breakpoint.

---

## Code Health (Static Analysis)

- **No hardcoded hex colors** in any changed file (confirmed via Grep and live computed style inspection)
- **No inline `style=` attributes** in any changed file
- **Design tokens used exclusively**: `text-muted-foreground`, `text-success`, `text-brand`, `text-destructive`, `text-warning`, `text-foreground`, `bg-card`, `bg-muted`
- **TypeScript interface is well-typed**: `ScoreSummaryProps` covers all new props (`showTimeSpent`, `previousAttemptTimeSpent`) with correct optional typing
- **`formatDuration` utility** is clean and covers hours/minutes/seconds correctly, with a `Math.max(ms, 1000)` guard at the call site to handle zero-duration edge cases

---

## Recommendations

1. **Fix the contrast blocker first.** Replace `text-muted-foreground/70` with `text-muted-foreground` on the "Previous:" line (line 165 of `ScoreSummary.tsx`). The 12px size alone is enough to communicate secondary importance, no opacity needed.

2. **Add time data to the SR announcement.** Extend the existing `aria-live` string construction to include `Completed in Xm Ys` and `Previous attempt: Xm Ys` when `showTimeSpent` is true. The pattern for `improvementSrText` is already established — this is a low-effort, high-impact accessibility improvement that completes the feature's purpose for assistive technology users.

3. **Increase the gap inside the time sub-section.** Change `gap-1` to `gap-2` on the time container div (line 160) to align with the 8px grid and improve visual separation.

4. **The NaN score display** seen during review testing is a test-setup artifact caused by the design review's manual IDB seeding not including `pointsPossible` on the answer objects. This is NOT a production bug from E15-S06 — the actual scoring engine (`calculateQuizScore`) correctly populates this field during quiz submission.

---

*Design review conducted via live browser automation (Playwright MCP). All contrast ratios computed from actual `getComputedStyle` values, not static color approximations.*
