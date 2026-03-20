# Design Review Report — E13-S01: Navigate Between Questions (Re-run)

**Review Date**: 2026-03-20
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E13-S01 — Navigate Between Questions
**Branch**: `feature/e13-s02-mark-questions-for-review`
**Changed Files**:
- `src/app/components/quiz/QuizActions.tsx`
- `src/app/components/quiz/QuestionGrid.tsx`
- `src/app/components/quiz/QuizNavigation.tsx`
- `src/app/pages/Quiz.tsx`

**Affected Pages**: `/courses/:courseId/lessons/:lessonId/quiz`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)
**Theme at time of review**: Dark mode

---

## Executive Summary

The quiz navigation implementation for E13-S01 delivers a well-structured layout with correct component hierarchy, clean responsive behaviour, and solid semantic markup. All acceptance criteria are visually met: Previous is disabled on Q1, Submit Quiz replaces Next on the last question, and the three-state bubble system (current / answered / unanswered) renders correctly. However, there are two issues that must be addressed before this is considered fully complete: the current-question bubble number fails WCAG AA contrast at 2.91:1, and the bubble buttons carry no hover or focus-visible styles, leaving keyboard and mouse users without interactive feedback.

---

## What Works Well

- **Responsive layout is correct at all three breakpoints.** The `flex-col sm:flex-row` on `QuizNavigation` stacks correctly at mobile (<640px) and goes row at tablet and desktop. No horizontal overflow at any viewport (confirmed via `scrollWidth > clientWidth`).
- **Touch targets meet the 44x44px minimum.** All bubble buttons and Previous/Next/Submit buttons measure exactly 44x44px on mobile and desktop via `min-w-[44px] min-h-[44px]`. This is well-handled with inline override of the visual `w-8 h-8` size.
- **Semantic markup is strong.** The nav uses `<nav aria-label="Quiz navigation">`, the radio group is labelled via `aria-labelledby` resolving to the question text, the Mark for Review checkbox has a proper `<label>` associated by id, and all bubble buttons have `aria-label="Question N"` with `aria-current="true"` on the active question.
- **Design token usage is consistent.** No hardcoded hex colours, no inline styles, no relative `../` imports — the codebase cleanly uses `bg-brand`, `bg-brand-soft`, `bg-card`, `text-muted-foreground`, `border-border`, and `text-brand-foreground` throughout.
- **Mobile content clearance is correctly handled.** The main element has `padding-bottom: 80px` which perfectly clears the bottom mobile navigation bar (57px tall, top at 755px = card bottom at 771px is safely within view).
- **Card structure follows design standards.** `rounded-[24px]`, `shadow-sm`, `p-4 sm:p-8` responsive padding, `max-w-2xl mx-auto` centring — all match the LevelUp design system conventions.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — Current bubble number fails WCAG AA contrast (2.91:1)**

- **Location**: `src/app/components/quiz/QuestionGrid.tsx:41`
- **Evidence**: Computed contrast ratio = 2.91:1. Foreground: `rgb(255,255,255)` (`text-brand-foreground`). Background: `rgb(139,146,218)` (`bg-brand`, dark-mode value `#8b92da`). WCAG AA requires 4.5:1 for normal text (the number "1", "2", "3" at 14px is normal text).
- **Impact**: Learners with low vision or in bright-light conditions cannot reliably read which question is currently active. This is the most critical state indicator in the grid — it must be distinguishable.
- **Suggestion**: Change the current-bubble text colour from `text-brand-foreground` (white) to a dark foreground that contrasts against the brand blue, e.g. `text-[#1a1b26]` (the dark-mode background colour). Or swap the approach: use a dark navy fill with white text only when the brand blue provides sufficient contrast, which it does in light mode but not in dark mode. A theme-aware solution would use a dedicated token like `text-brand-contrast` that maps to dark in dark-mode and white in light-mode. At minimum, verify both themes before shipping.

---

### High Priority (Should fix before merge)

**H1 — Bubble buttons have no hover or focus-visible styles**

- **Location**: `src/app/components/quiz/QuestionGrid.tsx:37-45`
- **Evidence**: The `className` on each bubble button contains no `hover:` or `focus-visible:` Tailwind modifiers. Browser default `outline` is present but it uses the browser's default styling, not the platform's design system ring (`focus-visible:ring-[3px]`). Confirmed via computed style: `outlineStyle: none` at rest (focus ring is provided by browser default only when focus-visible is triggered, but without explicit `focus-visible:` classes it is unstyled).
- **Impact**: Mouse users get no visual feedback when hovering a bubble, making it unclear the bubbles are clickable. Keyboard users cannot distinguish which bubble is focused from which is simply the current question (aria-current handles screen readers, but visually they look the same).
- **Suggestion**: Add explicit interaction classes. For example:
  ```
  'hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-opacity'
  ```
  Or use state-specific hover targets (e.g. `hover:bg-brand/80` for current, `hover:bg-brand-soft/80` for answered, `hover:bg-accent` for unanswered) to maintain the state colour while signalling interactivity.

**H2 — Submit Quiz button hover state renders near-white in dark mode**

- **Location**: `src/app/components/quiz/QuizActions.tsx:41-48`
- **Evidence**: The `Button` component's base variant includes `hover:bg-primary/90`. In dark mode, `--primary` resolves to `#e8e9f0` (near-white). When the Submit Quiz button is hovered, this `hover:bg-primary/90` class wins over `bg-brand` because it comes later in the shadcn base class list. Confirmed via `isHovered: true` check showing computed `oklab(0.935...)` background.
- **Impact**: On hover, Submit Quiz button appears to flash to a near-white/light background in dark mode, breaking visual consistency and making the text unreadable (white text on white-ish background).
- **Suggestion**: Add an explicit `hover:bg-brand-hover` to the Submit Quiz button's className to override the default variant hover behaviour:
  ```tsx
  className="bg-brand text-brand-foreground hover:bg-brand-hover rounded-xl min-h-[44px]"
  ```
  This token (`--brand-hover: #7a82d0`) is already defined in the theme and used correctly in `QuizStartScreen.tsx`. The fix is consistent with existing practice in the same file.

**H3 — Persistent RadioGroup controlled/uncontrolled React warning**

- **Location**: `src/app/pages/Quiz.tsx` (QuestionDisplay/MultipleChoiceQuestion component)
- **Evidence**: Console shows 6+ warnings: `"RadioGroup is changing from uncontrolled to controlled"` and `"from controlled to uncontrolled"` on every question navigation. Captured in browser console across the full quiz session.
- **Impact**: These warnings indicate a prop management issue in the `MultipleChoiceQuestion` component — likely that `value` prop is being passed as `undefined` on first render (uncontrolled) then transitions to a string value (controlled). While this doesn't break functionality in the current test data, it can cause unpredictable behaviour when answers are pre-filled (e.g. on resume), and it creates console noise that masks real issues.
- **Suggestion**: In `MultipleChoiceQuestion`, ensure the `value` prop always starts as an empty string `""` rather than `undefined` when no answer is recorded. Pass `value={currentAnswer ?? ''}` (with empty string fallback) from `Quiz.tsx:244`.

---

### Medium Priority (Fix when possible)

**M1 — "undefined min" shown in quiz start screen time badge**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:42`
- **Evidence**: The badge reads `undefined min` when `quiz.timeLimit` is `undefined`. The condition `quiz.timeLimit !== null` passes through when the value is `undefined`, so the string interpolation produces `"undefined min"`.
- **Impact**: Learners see "undefined min" instead of "Untimed" — this erodes trust in the platform's polish and feels like an unfinished product.
- **Suggestion**: Change the guard to check for both `null` and `undefined`:
  ```tsx
  {quiz.timeLimit != null ? `${quiz.timeLimit} min` : 'Untimed'}
  ```
  Using `!= null` (loose equality) catches both `null` and `undefined` in one check.

**M2 — QuizNavigation `items-center` on mobile misaligns actions and grid**

- **Location**: `src/app/components/quiz/QuizNavigation.tsx:25`
- **Evidence**: At mobile (<640px), the nav stacks vertically (`flex-col`) with `items-center`. This centres both the button group and the bubble grid horizontally. For 3 bubbles this looks fine, but for quizzes with 8-10 questions the grid wraps into multiple rows that are each centred individually, creating a ragged centre-aligned layout rather than a left-aligned grid.
- **Impact**: Quizzes with more questions will feel misaligned. Left-aligning (`items-start`) is the standard for wrapped content per the design principles ("left-aligned body text").
- **Suggestion**: Change to `items-start` on mobile and `items-center` only on sm+:
  ```tsx
  className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
  ```

---

### Nitpicks (Optional)

**N1 — QuizHeader h1 font size is `text-lg` (18px), smaller than expected for a page title**

- **Location**: `src/app/components/quiz/QuizHeader.tsx:114`
- **Evidence**: `font-size: 18px` via computed style. The quiz start screen uses `text-2xl` (24px) for the same title. Once the quiz starts, the header drops to `text-lg`.
- **Note**: This may be intentional to give more vertical space to the question content. The distinction is reasonable as a design choice — just worth confirming it was deliberate rather than a copy-paste size.

**N2 — Progress bar `progressValue` counts the current question, not completed questions**

- **Location**: `src/app/components/quiz/QuizHeader.tsx:26-27`
- **Evidence**: `progressValue = Math.round((currentQuestion / totalQuestions) * 100)`. On Q1 this shows 33% complete (1/3). A learner on Q1 has completed 0 questions, so 0% would be more accurate. On Q3 with 3 questions it shows 100%, implying completion before the quiz is submitted.
- **Note**: This is a UX convention debate (showing position vs completion), not a bug. Worth discussing with product — many quiz tools show position-based progress, so this may be intentional.

---

## Detailed Findings

### Finding B1: Current bubble contrast

| Token | Dark-mode value | Role |
|-------|-----------------|------|
| `bg-brand` | `#8b92da` = `rgb(139,146,218)` | Background of current bubble |
| `text-brand-foreground` | `#ffffff` = `rgb(255,255,255)` | Number text colour |

Contrast: (1.0 + 0.05) / (0.2759 + 0.05) = **2.91:1** — fails WCAG AA (4.5:1 required).

By comparison, the answered bubble (`text-brand` on `bg-brand-soft`) = **4.65:1** — passes.

The fix is to ensure the current bubble number uses a dark colour against the light brand blue, specifically in dark mode where brand resolves to a lighter purple-blue. A token like `--brand-on-brand` that maps to `#1a1b26` in dark mode and `#ffffff` in light mode would solve this cleanly across both themes.

### Finding H1: Missing hover/focus styles on bubble buttons

Current button class string (from `QuestionGrid.tsx`):
```
relative flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium min-w-[44px] min-h-[44px] bg-brand text-brand-foreground
```

The shadcn `Button` component (used for Previous/Next/Submit) receives `focus-visible:ring-[3px] focus-visible:ring-ring/50` from its base class. The raw `<button>` in `QuestionGrid` does not inherit these — they must be added manually.

### Finding H2: Submit Quiz hover override

The shadcn Button base class chain includes `hover:bg-primary/90` from the default variant. When `bg-brand` is added as a custom class, specificity between Tailwind utility classes is determined by source order. Since `hover:bg-primary/90` comes from the shadcn base and `bg-brand` is added after in `className`, the hover state uses `--primary` (`#e8e9f0`) rather than `--brand`. The quick fix is to explicitly include `hover:bg-brand-hover` which raises specificity deterministically.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 (normal text) | Fail | Current bubble: 2.91:1 (white on brand blue in dark mode) — all other text passes |
| Text contrast ≥ 3:1 (large text / UI components) | Pass | All button labels and badge text pass ≥ 3:1 |
| Keyboard navigation | Pass | All quiz controls are reachable via Tab in logical order: radio group → Mark for Review → Previous → Submit/Next → Q1 bubble → Q2 → Q3 |
| Focus indicators visible | Partial | Previous/Next/Submit use shadcn's `focus-visible:ring-[3px]`; bubble buttons rely on browser default only |
| Heading hierarchy | Pass | Single H1 per page (quiz title), no skipped levels |
| ARIA labels on icon buttons | Pass | All quiz nav buttons have visible text labels; icon-only buttons elsewhere in the layout have aria-labels |
| Semantic HTML | Pass | `<nav aria-label="Quiz navigation">`, `<button>` for all interactive elements (no clickable divs in quiz code), `role="radiogroup"` with `aria-labelledby` |
| Form labels associated | Pass | Mark for Review checkbox has `<label for="mark-review-{questionId}">` correctly associated |
| `prefers-reduced-motion` | Pass | CSS contains reduced-motion media query; transition durations reduce to 0s |
| Screen reader live region | Pass | Quiz header includes `aria-live="polite"` for timer announcements (when timed) |
| Touch targets ≥ 44x44px | Pass | All interactive elements measure 44x44px at mobile (enforced via `min-w-[44px] min-h-[44px]`) |
| Color not sole indicator | Pass | Bubble states use both colour and border; `aria-current="true"` supplements colour for current state |

---

## Responsive Design Verification

**Mobile (375px)**: Pass with caveat
- No horizontal overflow (scrollWidth 364px < clientWidth 375px)
- Card: 305px wide with ~24px margins each side
- QuizNavigation: stacks to `flex-col`, bubble grid wraps correctly
- Bottom mobile nav does not overlap (80px padding-bottom on main)
- Caveat: `items-center` on the column stack will look ragged on quizzes with many questions (M2 above)

**Tablet (768px)**: Pass
- No horizontal overflow
- QuizNavigation: renders as `flex-row` (sm+ breakpoint = 640px, so 768px gets row layout)
- Card fits at max-width 672px with correct 32px padding
- Sidebar collapses to hamburger at this viewport (correct behaviour)

**Desktop (1440px)**: Pass
- No horizontal overflow (scrollWidth 1429px)
- Card centred at max-width 672px within 1333px main area
- QuizNavigation renders as row with actions + bubbles side by side
- All computed spacings follow 8px grid

---

## Recommendations

1. **Fix bubble contrast immediately (B1)** — This is a WCAG AA blocker. The simplest targeted fix is adding `dark:text-[#1a1b26]` to the current bubble class in `QuestionGrid.tsx`. The longer-term solution is a dedicated theme token.

2. **Add hover and focus-visible to bubble buttons (H1)** — These are interactive navigation elements; they need the same quality of interactive states as the Previous/Next buttons. Add at minimum `hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50` to the bubble `className`.

3. **Fix Submit Quiz hover state (H2)** — One-line fix in `QuizActions.tsx`: add `hover:bg-brand-hover` to the Submit Quiz button's className. This token is already used in `QuizStartScreen.tsx` for the exact same button variant.

4. **Fix the `undefined min` display (M1)** — Change `!== null` to `!= null` in `QuizStartScreen.tsx:42`. Two-character fix, zero risk.

---

*Review conducted via live browser inspection using Playwright MCP. All computed style values, contrast ratios, and element dimensions were measured against the live application at `http://localhost:5173`.*
