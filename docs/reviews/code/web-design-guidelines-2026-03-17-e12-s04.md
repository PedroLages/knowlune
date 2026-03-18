# Web Interface Guidelines Review — E12-S04 Quiz UI

**Date:** 2026-03-17
**Story:** E12-S04 — Create Quiz Route and QuizPage Component
**Reviewer:** web-design-guidelines skill (Vercel Web Interface Guidelines)
**Files reviewed:**
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/components/quiz/QuizHeader.tsx`

---

## Findings

### src/app/pages/Quiz.tsx

**MEDIUM — Quiz.tsx:102–112** — Loading skeleton container has no `role="status"` or `aria-busy="true"`. Screen readers receive no signal that content is loading.

**MEDIUM — Quiz.tsx:119–130** — Error state rendered in a plain `<div>` with no `role="alert"` or `aria-live` region. Dynamic error content injected after mount is not announced to screen readers.

**LOW — Quiz.tsx:127** — Back link uses a raw `←` arrow character (`← Back to course`). Prefer a lucide-react `<ArrowLeft>` icon with `aria-hidden="true"` plus visible text, or wrap the arrow in `<span aria-hidden="true">` to prevent screen readers from reading "left-pointing arrow" or similar character descriptions.

---

### src/app/components/quiz/QuizStartScreen.tsx

**HIGH — QuizStartScreen.tsx:49–52** — "Start Over" discards saved quiz progress (a destructive action) with no confirmation dialog. Per guidelines, destructive actions require user confirmation before proceeding.

---

### src/app/components/quiz/QuizHeader.tsx

**MEDIUM — QuizHeader.tsx:43** — Timer `<span>` uses `aria-live="polite"`, which fires an announcement every second as the countdown ticks. This is excessively chatty for screen reader users. The live region should either be `aria-live="off"` with a summary announced at meaningful intervals (e.g., every minute, or at the 1-minute warning), or the update frequency should be throttled.

**LOW — QuizHeader.tsx:39** — During the active quiz view (when `isQuizActive` is true), the page renders `QuizHeader` but no `<h1>`. The `<h1>` lives in `QuizStartScreen`, which is not rendered in this state. The active quiz view has no page-level heading, breaking heading hierarchy for screen reader navigation.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| HIGH     | 1     | "Start Over" destructive action lacks confirmation |
| MEDIUM   | 3     | Loading skeleton missing `role="status"`; error state missing `role="alert"`; timer `aria-live` fires every second |
| LOW      | 2     | Raw `←` arrow character in back link; missing `<h1>` in active quiz view |

## Passing

- Buttons use semantic `<button type="button">` elements throughout. ✓
- No `outline-none` without replacement detected. ✓
- No `transition: all` detected. ✓
- No hardcoded colors — design tokens used consistently. ✓
- Timer has `aria-label` with human-readable value. ✓
- Progress bar has `aria-label="Quiz progress"`. ✓
- Loading `ignore` flag prevents race conditions on unmount. ✓
- No zoom-disabling viewport settings. ✓
