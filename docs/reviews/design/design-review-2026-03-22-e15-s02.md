# Design Review Report — E15-S02: Configure Timer Duration and Accommodations

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E15-S02 — Configure Timer Duration and Accommodations
**Branch**: feature/e15-s02-configure-timer-duration-accommodations

**Changed Files Reviewed**:
- `src/app/components/quiz/TimerAccommodationsModal.tsx` (NEW)
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/components/quiz/QuizTimer.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/pages/Quiz.tsx`

**Affected Routes Tested**: `/courses/1/lessons/lesson-1/quiz`

---

## Executive Summary

E15-S02 delivers a well-structured accessibility accommodations flow for quiz timers. The `TimerAccommodationsModal` component is architecturally sound, uses correct design tokens throughout, and the 4-option RadioGroup with card-style selection follows the established E14 pattern precisely. Two issues require attention before merge: the "Accessibility Accommodations" trigger button is 20px tall (touch target violation), and modal close does not return focus to the trigger button (keyboard navigation regression). A minor React hooks lint issue also exists in `QuizTimer.tsx`.

---

## What Works Well

1. **Design token discipline**: No hardcoded colors in any changed file. All tokens (`bg-brand-soft`, `text-brand-soft-foreground`, `text-muted-foreground`, `border-brand`, `bg-card`, `bg-muted`) are used correctly and consistently with the design spec.

2. **Radio card pattern**: The card-style radio options follow the E14 pattern exactly — `min-h-12` (48px) touch targets, `rounded-xl` border radius, `border-brand bg-brand-soft` selected state with `transition-colors duration-200`, `hover:border-brand/50` unselected hover. All 4 radio labels measured at 48×399px — well above the 44px minimum.

3. **Badge state differentiation**: The time limit badge correctly switches from `bg-muted text-muted-foreground` to `bg-brand-soft text-brand-soft-foreground` when an accommodation is selected, providing a clear visual signal that the timer has been adjusted. This is an elegant progressive disclosure pattern.

4. **Persistence with Zod validation**: `loadSavedAccommodation()` in `Quiz.tsx` uses `TimerAccommodationEnum.safeParse()` to validate localStorage values, gracefully falling back to `'standard'` on tampered or corrupted data. Confirmed working via live testing — `"150%"` persisted and reloaded correctly across page navigation.

5. **Timer annotation rendering**: The `(Extended Time)` annotation renders at `text-xs font-sans font-normal` with `text-muted-foreground` coloring, correctly subordinate to the timer digits. Contrast checked at 5.57:1 against the card background in light mode — above the 4.5:1 WCAG AA threshold. The annotation is also included in the 25% threshold screen reader announcement.

6. **Modal ARIA structure**: `DialogTitle` ("Timer Accommodations"), `DialogDescription`, and `aria-label="Timer accommodation"` on the RadioGroup are all correctly set. Radix provides `aria-labelledby` and `aria-describedby` automatically. Close button has `aria-label="Close"` via Radix's built-in implementation.

7. **Responsive layout**: No horizontal scroll at any breakpoint. The quiz card (`max-w-2xl`) and modal (`sm:max-w-md`) scale correctly. At 375px mobile, the timer annotation remains visible and the header row (h1 + timer with `ml-auto`) correctly separates without overlap.

8. **Untimed guard**: The `currentProgress.timerAccommodation !== 'untimed'` guard at `Quiz.tsx:254-255` correctly prevents timer initialization for untimed mode. `QuizHeader` only renders `QuizTimer` when `timeRemaining !== null`, so the timer is fully hidden for untimed quizzes.

9. **Mobile navigation**: At mobile viewport, the layout switches to the bottom tab navigation correctly. The sidebar collapses and the full-width main content is accessible.

10. **Performance**: LCP consistently 400-500ms (good), FCP 130-220ms (good), CLS 0.00-0.06 (good). No layout shift from the badge state change.

---

## Findings by Severity

### Blockers (Must fix before merge)

**BLOCKER-1: Accommodations trigger button touch target is 20px tall**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:102`
- **Evidence**: `getBoundingClientRect().height = 20` measured live in browser. WCAG 2.5.5 requires minimum 44×44px touch targets.
- **Root cause**: `className="mt-3 text-brand-soft-foreground p-0 h-auto"` overrides the shadcn `size="sm"` variant's `h-8` (32px) with `h-auto`, collapsing the button height to line-height only. `p-0` removes all padding.
- **Impact**: On touch devices, this link is nearly impossible to tap precisely. Learners with motor impairments are particularly affected. This is the primary control for accessing the feature.
- **Suggestion**: Remove `h-auto` and `p-0` from the className, or switch to `size="sm"` without height overrides, keeping a minimum `h-11` (44px). If the design requires an inline link appearance without the height, add `min-h-[44px]` alongside `h-auto` to provide the WCAG-compliant tap area while maintaining the visual link style.

```tsx
// Current (broken)
className="mt-3 text-brand-soft-foreground p-0 h-auto"

// Option A — keep link style, add tap area
className="mt-3 text-brand-soft-foreground p-0 h-auto min-h-[44px] inline-flex items-center"

// Option B — use size="sm" as designed (32px, still below 44px but closer)
// Combined with px-2 py-2 to hit 44px min
className="mt-3 text-brand-soft-foreground px-0 py-2"
// and remove size="sm" override
```

**BLOCKER-2: Modal close does not return focus to the trigger button**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:98-107` (trigger button, no `ref`)
- **Evidence**: After clicking Save (or Escape), `document.activeElement` = `<body>` instead of the "Accessibility Accommodations" button. Tested live: focus observed on `BODY` after modal close.
- **Root cause**: Radix Dialog's focus return mechanism requires the trigger element to be focusable at the time of close. The `p-0 h-auto` override may cause Radix's internal focus guard to skip the element, or the `variant="link"` button may not be receiving focus correctly before open. Radix `<Dialog.Trigger>` wrapper is not used — instead the Dialog is opened manually via `onClick`, which means Radix has no record of the trigger element and cannot return focus automatically.
- **Impact**: After closing the modal via keyboard (Escape or Enter on Save), keyboard users lose their position in the page. They must Tab from the beginning of the document to find their place again. This is a WCAG 2.1 AA failure (SC 2.4.3 Focus Order, SC 3.2.2 On Input).
- **Suggestion**: Either wrap the trigger button in a `<Dialog.Trigger asChild>` from Radix (which gives Radix the trigger reference for focus return), or add a `ref` to the button and call `triggerRef.current?.focus()` in the `onOpenChange(false)` callback.

```tsx
// Option A — use Dialog.Trigger (cleanest)
import { DialogTrigger } from '@/app/components/ui/dialog'

<DialogTrigger asChild>
  <Button variant="link" size="sm" className="mt-3 text-brand-soft-foreground">
    <Clock className="size-4 mr-1" aria-hidden="true" />
    Accessibility Accommodations
  </Button>
</DialogTrigger>

// Option B — manual ref
const accBtnRef = useRef<HTMLButtonElement>(null)
// In TimerAccommodationsModal onOpenChange prop:
onOpenChange={(open) => {
  setModalOpen(open)
  if (!open) accBtnRef.current?.focus()
}}
```

---

### High Priority (Should fix before merge)

**HIGH-1: `annotation` missing from `useEffect` dependency array in `QuizTimer.tsx`**

- **Location**: `src/app/components/quiz/QuizTimer.tsx:55`
- **Evidence**: `useEffect` at line 34-55 uses `annotation` (line 46) to build the 25% threshold announcement, but `[timeRemaining, totalTime]` dependency array omits it.
- **Impact**: If `annotation` changes while a quiz is active (e.g., edge case where accommodation is modified mid-session), the stale closure would announce without the extended time suffix. The `react-hooks/exhaustive-deps` ESLint rule would flag this. Low runtime risk since annotation is stable per quiz session, but causes ESLint/TypeScript noise and is a correctness issue.
- **Suggestion**: Add `annotation` to the dependency array: `}, [timeRemaining, totalTime, annotation])`.

---

### Medium Priority (Fix when possible)

**MEDIUM-1: `variant="link"` button with `size="sm"` override is semantically inconsistent**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:100-102`
- **Evidence**: `variant="link"` applies `text-primary underline-offset-4 hover:underline` styling, but the `className` override applies `text-brand-soft-foreground` which overrides the `text-primary` token. The result looks correct visually but uses two competing style sources.
- **Impact**: Minor — purely a code clarity issue. The `variant="link"` token intent (primary link color) is overridden, making it harder to understand the intended styling at a glance.
- **Suggestion**: Consider `variant="ghost"` with explicit color class, or `variant="brand-ghost"` if that aligns with the desired style. Alternatively, document the intentional override with a comment.

**MEDIUM-2: Explanation text placement in modal is after the RadioGroup, not before**

- **Location**: `src/app/components/quiz/TimerAccommodationsModal.tsx:106-109`
- **Evidence**: The story spec requires explanation text ("Extended time is available for learners who need additional time due to disabilities or other needs."). This text is rendered *after* the radio options, meaning learners encounter the options before understanding the context.
- **Impact**: Learners with cognitive disabilities benefit from context before choices. Having the explanation below the options means it may be missed by users who proceed directly to selecting. The `DialogDescription` already provides a shorter intro ("Choose a time accommodation that suits your learning needs.") but the fuller accessibility-specific explanation should appear before the options.
- **Suggestion**: Move the `<p>` explanation above the `<RadioGroup>`, or integrate it into the `DialogDescription` as a second sentence.

---

### Nitpicks (Optional)

**NITPICK-1: `aria-label` on the `role="group"` badges container is missing a description of interactivity**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:78`
- **Evidence**: `aria-label="Quiz details"` with `role="group"` is appropriate. However the time badge has no indication to screen readers that it changes dynamically when accommodation is selected. An `aria-live="polite"` on the time badge specifically would announce the change.
- **Suggestion**: Wrap the time badge span in an `aria-live="polite"` region so screen readers announce when the time changes from "5 min" to "7 min 30 sec" after modal save. This is low-priority since the modal itself provides context.

**NITPICK-2: `useEffect` for modal sync could use a note about why it doesn't use `key` prop**

- **Location**: `src/app/components/quiz/TimerAccommodationsModal.tsx:54-56`
- **Evidence**: The `useEffect` syncing `selected` state from `value` prop on open is a valid pattern, but a comment in the story notes "Resyncs from prop on reopen without `useEffect`" — this contradicts the code which does use `useEffect`. The comment in the story file is slightly misleading.
- **Suggestion**: Update the story's Lessons Learned to note that `useEffect` is used (the `[open, value]` dependency correctly handles the resync).

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|---------|
| 1 | Start screen shows default time limit and Accommodations link | Pass | "5 min" badge + button visible at desktop 1440px |
| 2 | Modal shows 4 radio options with explanation text | Pass | All 4 options visible with correct durations (5min/7min30sec/10min/No limit) |
| 3 | Selected accommodation updates timer with "(Extended Time)" annotation | Pass | Timer showed "07:30 (Extended Time)" after 150% selection |
| 4 | Untimed mode hides timer completely | Pass (code-verified) | `Quiz.tsx:254-255` guard confirmed; `QuizHeader:24` conditional confirmed |
| 5 | Accommodation preference persists | Pass | `localStorage["quiz-accommodation-lesson-1"] = "150%"` confirmed; reloads with 150% pre-selected |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | Timer muted-fg: 5.57:1, annotation: 5.57:1, heading: 16.67:1 |
| Text contrast (dark mode) | Pass | Dark mode: muted-fg `rgb(178,181,200)` vs card `rgb(36,37,54)` — estimated ~5:1 |
| Keyboard navigation in modal | Pass | ArrowDown moves between radio options; Tab moves to Save; Escape closes |
| Focus lands on first radio on modal open | Pass | `document.activeElement` = Standard radio on open |
| Focus returns to trigger after modal close | FAIL | Focus returns to `<body>` — see BLOCKER-2 |
| Focus indicators visible | Pass | Radix provides `focus-visible:ring-[3px]` on all interactive elements |
| Heading hierarchy | Pass | Single H1 ("JavaScript Fundamentals Quiz") in quiz card |
| ARIA labels on icon buttons | Pass | Clock icon `aria-hidden="true"`, RadioGroupItem labels via parent label/RadioGroup |
| RadioGroup has aria-label | Pass | `aria-label="Timer accommodation"` on RadioGroup |
| Dialog has aria-labelledby | Pass | Radix sets `aria-labelledby` pointing to DialogTitle |
| Semantic HTML — no div onClick | Pass | No `<div onClick>` patterns found |
| Form labels associated | Pass | Radio options via `<label>` wrapper; checkbox via 44px parent div |
| Touch targets ≥44px (modal) | Pass | Radio labels: 48px, Save button: 48px |
| Touch targets ≥44px (trigger) | FAIL | Accommodations button: 20px — see BLOCKER-1 |
| prefers-reduced-motion | Pass | Global `@media (prefers-reduced-motion: reduce)` in `tailwind.css:47` and `index.css:306` suppresses `transition-colors duration-200` |
| Live regions for timer | Pass | `aria-live="polite" aria-atomic="true"` sr-only region announces per-minute and at thresholds |
| No console errors (quiz page) | Pass | 0 errors on `/courses/1/lessons/lesson-1/quiz` at 1440px |

---

## Responsive Design Verification

| Breakpoint | Layout | Horizontal Scroll | Touch Targets | Notes |
|-----------|--------|-------------------|---------------|-------|
| Desktop (1440px) | Pass | No | Pass | Card `max-w-2xl` centered, modal `sm:max-w-md` (448px wide) |
| Tablet (768px) | Pass | No | Pass | Card scales to 672px, sidebar collapses, no overflow |
| Mobile (375px) | Pass | No | Pass (modal) / Fail (trigger) | Timer `text-sm` (14px), annotation visible, nav switches to bottom tabs |

---

## Code Health Observations

- No hardcoded colors in any changed file (ESLint `design-tokens/no-hardcoded-colors` would pass)
- No inline `style={}` attributes
- All imports use `@/` alias — no relative `../` paths
- TypeScript interfaces fully typed — no `any` usage
- `formatDuration` and `formatTimeBadge` helper functions are clean pure functions with no side effects
- `ACCOMMODATION_OPTIONS` constant array is declared outside the component — no unnecessary re-creation on render
- `useCallback` used correctly in `Quiz.tsx` for `handleAccommodationChange` and `handleStart`
- Modal local state pattern (commit-on-save) is clean and prevents premature side effects

---

## Recommendations

1. **Fix BLOCKER-1 first** (touch target): Use `DialogTrigger asChild` from Radix, which simultaneously fixes both BLOCKER-1 (Radix wraps with proper focus management) and BLOCKER-2 (focus return). This is a one-line change that removes the manual `onClick={() => setModalOpen(true)}` and the `modalOpen` state entirely if using `<Dialog>` in uncontrolled mode.

2. **Add `annotation` to deps** (HIGH-1): One-character fix — add `annotation` to the `useEffect` dependency array in `QuizTimer.tsx:55`. Run `npm run lint` after to confirm no ESLint warnings remain.

3. **Move explanation text above radio options** (MEDIUM-2): Promotes context-before-choice for cognitive accessibility. Simple DOM reorder with no logic changes.

4. **Consider `aria-live` on the time badge** (NITPICK-1): Would make the accommodation change announcement more robust for screen reader users who may not be watching the badge area.

---

*Report generated by Claude Code design-review agent (Playwright MCP) on 2026-03-22.*
