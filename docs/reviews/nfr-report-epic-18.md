# Non-Functional Requirements Report: Epic 18 — Accessible and Integrated Quiz Experience

**Date:** 2026-03-26
**Stories Assessed:** E18-S01 through E18-S11 (all 11 stories)
**Focus Stories:** E18-S02 (ARIA Live Regions), E18-S03 (Semantic HTML and ARIA Attributes)
**Overall Assessment:** PASS

---

## Scope

| Story   | Feature                                     | Key Files                                                                  |
|---------|---------------------------------------------|---------------------------------------------------------------------------|
| E18-S01 | Keyboard navigation                         | `Quiz.tsx`, `QuizActions.tsx`, `QuestionGrid.tsx`, question components     |
| E18-S02 | ARIA live regions for dynamic content        | `useAriaLiveAnnouncer.ts`, `TimerWarnings.tsx`, `QuizTimer.tsx`, question components |
| E18-S03 | Semantic HTML and ARIA attributes           | `Quiz.tsx`, `QuizHeader.tsx`, `QuizNavigation.tsx`, `AnswerFeedback.tsx`, question components |
| E18-S04 | Contrast ratios and touch targets           | All quiz components (min-h-[44px], focus-visible rings, design tokens)    |
| E18-S05 | Quiz completion + study streaks             | `useQuizStore.ts`, `studyLog.ts`                                          |
| E18-S06 | Quiz performance on Overview dashboard      | `QuizPerformanceCard.tsx`                                                  |
| E18-S07 | Quiz analytics in Reports                   | `QuizAnalyticsDashboard.tsx`, `QuizAnalyticsTab.tsx`                      |
| E18-S08 | Quiz availability badges on Courses page    | `QuizBadge.tsx`, `useQuizScoresForCourse.ts`, `ModuleAccordion.tsx`       |
| E18-S09 | Quiz preferences in Settings                | `QuizPreferencesForm.tsx`, `quizPreferences.ts`                           |
| E18-S10 | Export quiz results                         | `QuizExportCard.tsx`, `quizExport.ts`                                     |
| E18-S11 | Track quiz progress in content completion   | `useQuizStore.ts`, content completion integration                         |

---

## 1. Accessibility (WCAG 2.1 AA+)

### ARIA Live Regions (E18-S02) — PASS

- **Tiered announcement system:** Three levels implemented correctly:
  - `aria-live="polite"` for non-interrupting updates (25% time warning, answer selection, question navigation)
  - `aria-live="assertive"` for urgent alerts (10% and 1-minute timer thresholds)
  - `aria-live="off"` on `role="timer"` to prevent constant countdown noise
- **`useAriaLiveAnnouncer` hook:** Handles consecutive identical messages by appending incrementing zero-width spaces (`\u200B`), forcing screen readers to re-announce. Auto-clears after 5s to prevent stale text in the accessibility tree. Timer cleanup on unmount prevents leaks.
- **TimerWarnings component:** Cleanly separates polite and assertive regions. Clears stale polite region when escalating to assertive (prevents dual-announcement).
- **Per-component coverage:** All 4 question types (MC, TF, MS, FIB), QuizHeader, MarkForReview, QuizStartScreen, ScoreSummary, and AnswerFeedback all have dedicated `aria-live` regions.
- **Unit test coverage:** 26 dedicated tests across `useAriaLiveAnnouncer.test.ts`, `QuizHeader.test.tsx`, `TrueFalseQuestion.test.tsx`, `MultipleChoiceQuestion.test.tsx`, `MultipleSelectQuestion.test.tsx`, `MarkForReview.test.tsx`, and `ScoreSummary.test.tsx` verify live region presence and attributes.
- **Code review R2:** All 5 Round 1 issues resolved, zero new issues. Verdict: PASS.

### Semantic HTML and ARIA Attributes (E18-S03) — PASS

- **Form controls:** All 4 question types wrapped in `<fieldset>` with `<legend>`. Radio inputs have associated `<label>` elements. Logical grouping via `<fieldset>` + `aria-describedby`.
- **Heading hierarchy:** `<h1>` for quiz title (QuizHeader), sr-only `<h2>` for current question context, `<h3>` for feedback (AnswerFeedback). No heading skips (h4 blocker from Round 1 was fixed to h3).
- **Landmark structure:** Layout provides `<main>`, Quiz uses `<section aria-label="...">` for quiz header, question area. `<nav aria-label="Quiz navigation">` wraps QuestionGrid + QuizActions. No nested `<main>` elements.
- **ARIA roles:** `role="status"` on AnswerFeedback, `role="alert"` on timer assertive warnings and error states, `role="timer"` with `aria-live="off"` on countdown, `role="progressbar"` with correct `aria-valuenow/min/max` for both visual and sr-only progress bars, `role="toolbar"` on QuestionGrid, `role="group"` on QuizActions.
- **Accessible names:** All icon-only buttons have `aria-label` (Previous/Next question, Submit Quiz). Decorative icons use `aria-hidden="true"`. Question grid buttons include review state in label (`"Question 3, marked for review"`).
- **Code review R2:** All 4 Round 1 findings resolved. One cosmetic nit remains (duplicate "Quiz actions" aria-label in QuizResults). Verdict: PASS.

### Contrast and Touch Targets (E18-S04) — PASS

- **Touch targets:** All interactive elements use `min-h-[44px]` (buttons, radio options, checkboxes, question grid circles at `size-11` = 44px).
- **Focus indicators:** `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` applied consistently. Dark mode variant uses `dark:focus-visible:ring-white` on brand backgrounds.
- **Reduced motion:** `motion-reduce:transition-none` on all option transitions. `motion-reduce:animate-none` on AnswerFeedback slide-in. Charts check `prefers-reduced-motion` media query.
- **Design tokens:** Zero hardcoded colors in quiz components (verified by ESLint `design-tokens/no-hardcoded-colors` rule — 0 errors).
- **axe-core integration:** E2E test `story-e18-s04.spec.ts` runs `AxeBuilder` scans on quiz pages.

### Keyboard Navigation (E18-S01) — PASS

- **Roving tabindex** on QuestionGrid (Arrow keys move focus, Home/End jump).
- **Number key shortcuts** for MC/TF options (1-9 keys select answers).
- **Arrow key selection-follows-focus** in RadioGroup (WAI-ARIA radio group spec compliance via rAF-based DOM read).
- **Programmatic focus management** on question change (`tabIndex={-1}` container, `.focus()` in useEffect).
- **Tab order preserved:** Quiz controls follow logical document order. No tabIndex > 0 values.

### Remaining Accessibility Nit

- `QuizResults.tsx:194-198` — duplicate `aria-label="Quiz actions"` on both a `<section>` and inner `<div role="group">`. Cosmetic; does not affect functionality. Tracked in E18-S03 R2 review report.

---

## 2. Performance

### Build
- **Production build:** 14.39s — no regression from Epic 18 changes
- **TypeScript:** `tsc --noEmit` passes cleanly
- **Bundle size:** No new heavyweight dependencies. Quiz components ship in existing code-split chunks. `react-markdown` (used by MarkdownRenderer for quiz explanations) was already in the bundle from earlier epics.

### Rendering
- **QuizTimer:** Uses `Date.now()`-anchored countdown with wall-clock drift correction on `visibilitychange`. Does not rely on `setInterval` accuracy. Cleanup on unmount.
- **useAriaLiveAnnouncer:** Auto-clear timer prevents memory leaks. Ref-based cleanup on unmount.
- **QuestionGrid:** Roving tabindex uses local state + refs, no re-renders of the full grid on focus changes.
- **QuizHeader:** sr-only progressbar is a lightweight `<div>` — zero rendering cost.
- **useQuizScoresForCourse (E18-S08):** Batch Dexie query via `where().anyOf()` + stable `useMemo` key prevents redundant fetches.
- **QuizExportCard (E18-S10):** Async `ignore` flag pattern prevents stale state on unmount.

### Verdict: PASS

---

## 3. Security

- **No `dangerouslySetInnerHTML`:** MarkdownRenderer uses `react-markdown` with `remarkGfm` only. Explicitly does NOT use `rehype-raw` — raw HTML is stripped. Documented in comments.
- **Links disabled in quiz context:** MarkdownRenderer renders `<a>` as plain `<span>` to prevent navigation away from quiz.
- **Zod validation on all external data:**
  - `QuizProgressSchema.safeParse()` validates localStorage quiz progress
  - `TimerAccommodationEnum.safeParse()` validates accommodation settings
  - `QuizPreferencesSchema.safeParse()` validates preferences from storage
- **QuotaExceeded handling:** `beforeunload` handler falls back to `sessionStorage` on `QuotaExceededError`. Non-quota storage errors are silently skipped during unload (best-effort).
- **No sensitive data exposure:** Quiz data is all local (IndexedDB via Dexie). No API calls to external services. Export generates CSV/PDF client-side.
- **Input sanitization:** GFM task list checkboxes are disabled (`<input {...props} disabled />`).

### Verdict: PASS

---

## 4. Reliability

- **Concurrent submit guard:** `isSubmittingRef` prevents double-submit from manual click + timer expiry race condition.
- **Saved progress validation:** `loadSavedProgress()` validates via Zod schema; corrupted data is logged and discarded. `handleResume()` validates that `questionOrder` IDs still match current quiz questions.
- **Error boundaries:** Loading state uses `role="status" aria-busy="true"`. Error state uses `role="alert"`. Store errors surface via toast. Fetch failures are caught with proper cleanup (`ignore` flags).
- **Streak integration (E18-S05):** Quiz submission is fire-and-forget for streak logging — streak failure cannot block quiz submission (AC4 explicitly tested in E2E).
- **Timer resilience:** `useQuizTimer` recalculates from wall clock on `visibilitychange` (handles tab backgrounding, laptop sleep). `formatTime` clamps negative values to `00:00` and handles `NaN`/`Infinity`.
- **Cross-tab sync (E18-S09):** `QuizPreferencesForm` listens for both `CustomEvent('quiz-preferences-updated')` (same-tab) and native `StorageEvent` (cross-tab).
- **Pre-existing test failures:** 4 unit test failures in `MyClass.test.tsx` are inherited from E17 (not caused by E18). Documented in review reports.

### Verdict: PASS

---

## 5. Maintainability

- **Component decomposition:** Quiz feature is well-factored into 18+ components with clear responsibilities:
  - Page-level: `Quiz.tsx`, `QuizResults.tsx`, `QuizReview.tsx`
  - Layout: `QuizHeader.tsx`, `QuizNavigation.tsx`, `QuizActions.tsx`, `QuestionGrid.tsx`
  - Questions: 4 type-specific components in `questions/` directory
  - Feedback: `AnswerFeedback.tsx`, `TimerWarnings.tsx`, `QuizTimer.tsx`
  - Analytics: `ScoreSummary.tsx`, `ScoreTrajectoryChart.tsx`, `ImprovementChart.tsx`, etc.
  - Shared hook: `useAriaLiveAnnouncer.ts` (reused across 5+ components)
- **Test coverage:** 255 unit tests across 26 test files for quiz components (all passing). 9 E2E spec files covering all 11 stories. ARIA live regions, semantic HTML, keyboard navigation, and accessibility all have dedicated test coverage.
- **Design token compliance:** Zero ESLint errors (0 hardcoded colors). 9 warnings are intentional silent-catch blocks for non-critical localStorage operations.
- **Documentation:** All 11 story files include implementation notes, challenges/lessons learned, and review feedback. Code review reports (R1 + R2) exist for both focus stories.
- **Separation of concerns:** Timer announcements split between `QuizTimer` (per-minute boundaries) and `TimerWarnings` (threshold crossings). Visual progress bar and sr-only progress bar are independent (different value scales). Toast notifications fired imperatively in callback (not via state) to avoid React batching issues.

### Verdict: PASS

---

## Summary

| Category        | Assessment | Key Evidence                                                              |
|-----------------|------------|---------------------------------------------------------------------------|
| Accessibility   | PASS       | Complete ARIA live region system, semantic HTML, landmarks, keyboard nav, motion-reduce, 44px touch targets, axe-core scans |
| Performance     | PASS       | No bundle regression, drift-corrected timer, batch queries, cleanup patterns |
| Security        | PASS       | Zod validation on all storage reads, no raw HTML rendering, no external API calls |
| Reliability     | PASS       | Concurrent submit guard, progress validation, fire-and-forget streak, wall-clock timer |
| Maintainability | PASS       | 18+ focused components, 255 unit tests, 9 E2E specs, zero ESLint errors, reusable announcer hook |

**Overall: PASS**

One cosmetic nit tracked: duplicate `aria-label="Quiz actions"` in `QuizResults.tsx`. Not a blocker.
