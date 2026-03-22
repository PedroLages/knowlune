# Design Review Report — E15-S02 v2 (Re-Review After Fixes)

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Review Type**: Re-review — verifying fixes from v1 blockers + scanning for regressions
**Story**: E15-S02 — Configure Timer Duration and Accommodations
**Changed Files**:
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/components/quiz/QuizTimer.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/components/quiz/TimerAccommodationsModal.tsx` (refactored — Dialog wrapper removed)
- `src/app/pages/Quiz.tsx`

---

## Executive Summary

Both v1 blockers are fixed and verified live in the browser. All four previously-flagged items
(2 blockers, 1 high, 1 medium) are resolved. The core accommodation flow — opening the modal,
selecting an option, saving, and observing the badge update — works correctly across desktop,
tablet, and mobile viewports. One pre-existing contrast issue is noted for awareness, but it
predates this story and is a systemic token concern, not a regression.

---

## Previous Findings — Verification Status

| Finding | Severity | Status | Evidence |
|---------|----------|--------|---------|
| Touch target 20px on trigger button | BLOCKER | FIXED | Computed height: 43.99px; `min-height: 44px` confirmed via `getComputedStyle` |
| Focus returns to `<body>` on modal close | BLOCKER | FIXED | `document.activeElement.textContent === "Accessibility Accommodations"` after both Escape and Save |
| `annotation` missing from `useEffect` deps | HIGH | FIXED | `QuizTimer.tsx:55` — `}, [timeRemaining, totalTime, annotation])` |
| Explanation text after radio options | MEDIUM | FIXED | `DialogDescription` in `DialogHeader` precedes `RadioGroup` in DOM; `description.compareDocumentPosition(radiogroup) & DOCUMENT_POSITION_FOLLOWING` returns true |
| Question count badge `text-brand` token | MEDIUM | FIXED | Badge now renders `text-brand-soft-foreground` (rgb(94, 106, 210)); class confirmed |

---

## What Works Well

- The `DialogTrigger asChild` refactor is clean — the Button component IS the trigger, no wrapper
  div, no extra DOM element. Radix handles focus restoration automatically and correctly.
- The `TimerAccommodationsModal` Dialog wrapper removal (now provided by `QuizStartScreen`) is the
  right architectural decision. The component is now a pure `DialogContent` fragment, composable
  and easier to test in isolation.
- The modal state pattern — local `selected` state that only commits on Save — correctly prevents
  side effects from exploratory radio changes. Verified by selecting 150%, escaping without saving,
  reopening, and confirming the state is still the last saved value.
- Time badge updates reactively and its styling switches from `bg-muted` to `bg-brand-soft` when an
  accommodation is active, providing a clear visual signal that time has been adjusted.
- `localStorage` persistence works — `quiz-accommodation-{lessonId}` key is written immediately on
  Save. Verified `localStorage.getItem` returns `"150%"` after saving.
- Responsive layout is solid at all three breakpoints. No horizontal overflow on mobile. Radio
  option touch targets are 48px on mobile — above the 44px minimum.
- Zero console errors from the `TimerAccommodationsModal` or `QuizStartScreen` at any viewport.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None new. All prior HIGH findings are resolved.

### Medium Priority (Fix when possible)

**M1 — Pre-existing: `text-brand-soft-foreground` on `bg-brand-soft` fails WCAG AA at 14px**

- **Location**: `QuizStartScreen.tsx:83` (question count badge), `QuizStartScreen.tsx:90` (adjusted
  time badge). Also present in `CourseCard.tsx`, `AISummaryPanel.tsx`, `Layout.tsx` — systemic.
- **Evidence**: Computed contrast ratio 3.16:1. WCAG AA requires 4.5:1 for 14px normal-weight text.
  - Foreground: rgb(94, 106, 210) — `--brand-soft-foreground: #5e6ad2` (light mode)
  - Background: rgb(208, 210, 238) — `bg-brand-soft`
  - Measured: 3.16:1. Required: 4.5:1. Gap: 1.34 ratio points.
- **Important context**: This story's previous review recommended switching FROM `text-brand` TO
  `text-brand-soft-foreground`. The developer followed that guidance correctly. The token pair
  itself is the problem — it is used in at least 6 locations across the codebase. This is NOT a
  regression introduced by this story.
- **Impact**: Small-text badges may be difficult to read for users with low vision. The badges convey
  quiz metadata (question count, time) that learners need before starting.
- **Suggestion**: This warrants a dedicated token fix in a separate story. Options:
  1. Darken `--brand-soft-foreground` to achieve 4.5:1 on `--brand-soft` (e.g., `#3d47b8`)
  2. Use `text-foreground` (dark neutral) on `bg-brand-soft` for small text — sacrifices brand
     colour but guarantees contrast
  3. Make the badge text larger (≥18.67px bold or ≥24px normal counts as "large text" needing 3:1)
  The fix should be applied to `theme.css` and will benefit all 6+ usages simultaneously.

### Nitpicks (Optional)

**N1 — `useEffect([value])` in `TimerAccommodationsModal` is harmless but technically redundant**

- **Location**: `TimerAccommodationsModal.tsx:50-52`
- **Evidence**: Radix Dialog unmounts `DialogContent` on close by default (confirmed — `role="dialog"`
  element absent from DOM after close). The `useState(value)` initializer therefore already handles
  state reset on each open. The `useEffect` provides a safety net for a future `keepMounted` prop,
  but adds a read-after-mount render cycle unnecessarily.
- **Impact**: None observable. Zero visual or functional difference.
- **Suggestion**: Either remove it with a comment explaining unmount semantics, or keep it for
  defensive safety. Either choice is acceptable.

**N2 — Radio accessible name computed via label wrapping, not `for`/`id` association**

- **Location**: `TimerAccommodationsModal.tsx:86-101`
- **Evidence**: `<label>` wraps `<RadioGroupItem>` (a `<button role="radio">`). No `for` attribute,
  no `id` on the button. Playwright accessibility tree shows names like `"Standard time(15 minutes)"`
  — name is derived from label content via implicit association (label wrapping a labelable element).
- **Impact**: Functionally correct per HTML spec — `<button>` is a labelable element. The wrapping
  label does provide the accessible name and the accessibility snapshot confirms it. However,
  `for`/`id` association would be more explicit and universally supported.
- **Suggestion**: This was flagged in v1 as a concern — the label wrapping approach works and is
  standard Radix practice. No action required unless AT testing reveals issues.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Partial | Badge text (3.16:1) — pre-existing token issue, not a regression |
| Text contrast ≥3:1 (large text) | Pass | All other text elements pass |
| Keyboard navigation | Pass | Tab reaches all interactive elements; arrow keys navigate radio options |
| Focus trapped in dialog | Pass | `dialogContainsFocus: true` verified via JS evaluation |
| Focus returns to trigger on close | Pass | Returns to "Accessibility Accommodations" button on both Escape and Save |
| Focus indicators visible | Pass | Radix default focus ring present on all interactive elements |
| Heading hierarchy | Pass | H1 (quiz title) → H2 (modal title) — correct nesting |
| ARIA labels on icon buttons | Pass | Clock icon has `aria-hidden="true"`; Close button has sr-only text |
| Semantic HTML | Pass | `role="dialog"`, `role="radiogroup"`, `aria-label="Timer accommodation"` |
| Form labels associated | Pass | Labels wrap RadioGroupItems; accessible name computed correctly |
| `DialogTitle` present | Pass | `<DialogTitle>Timer Accommodations</DialogTitle>` present in DOM |
| `DialogDescription` present | Pass | Explanation text rendered as `<DialogDescription>` |
| `prefers-reduced-motion` | Not tested | Animation is Radix default (CSS-based); assumed compliant |
| Touch targets ≥44px (mobile) | Pass | Accommodations button: 44px; radio options: 48px; Start Quiz: 48px |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — Single column, bottom tab navigation, no horizontal scroll
  (`scrollWidth: 404 < clientWidth: 416`), touch targets all ≥44px. Modal opens and radio options
  stack correctly at 48px height each.
- **Tablet (768px)**: Pass — Hamburger menu in header, quiz content correct, all elements present.
  Pre-existing sidebar Sheet console warning (`DialogTitle` missing) is unrelated to this story.
- **Desktop (1440px)**: Pass — Persistent sidebar, quiz card centered at `max-w-2xl`, badges row
  wraps correctly, modal opens at `sm:max-w-md`.

---

## Interaction Flow Verification

The following end-to-end flow was exercised in the browser:

1. Navigate to quiz start screen — quiz metadata badges visible, "15 min" badge shown
2. Click "Accessibility Accommodations" — modal opens, Standard time pre-selected, focus inside dialog
3. Press Escape — modal closes, focus returns to trigger button (BLOCKER 2: FIXED)
4. Click button again — modal reopens (still at Standard time)
5. Click "150% extended time" radio — option becomes checked
6. Click Save — modal closes, focus returns to trigger, time badge updates to "22 min 30 sec" with
   brand-soft styling
7. Verify `localStorage.getItem('quiz-accommodation-lesson-design-review-e15s02') === '150%'` (PASS)
8. Reopen modal — "150% extended time" is pre-selected from saved preference (PASS)
9. Press Escape — focus returns correctly again (PASS)

---

## Recommendations

1. **Ship this story** — both blockers are fixed, no new blockers or high-priority issues. The
   implementation is clean and all acceptance criteria are met.

2. **File a dedicated token contrast story** for `--brand-soft-foreground` / `--brand-soft`. The
   3.16:1 contrast issue affects 6+ locations and should be fixed at the token level in `theme.css`
   rather than piecemeal in each component. Suggested title: "Fix brand-soft-foreground contrast
   ratio for WCAG AA compliance (4.5:1 at normal text sizes)".

3. **Track the sidebar Sheet `DialogTitle`** pre-existing warning — it appears in the console
   whenever the tablet sidebar opens. Not part of this story but worth a separate ticket.

