# Design Review Report — E12-S04: Quiz Route and QuizPage Component

**Review Date**: 2026-03-17
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E12-S04 — Create quiz route and QuizPage component
**Branch**: feature/e12-s04-create-quiz-route-and-quizpage-component

**Changed Files Reviewed**:
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/app/components/quiz/QuizHeader.tsx`

**Affected Route**: `/courses/:courseId/lessons/:lessonId/quiz`

**Viewports Tested**: Desktop (1280px), Tablet (768px), Mobile (375px)

---

## Executive Summary

The quiz page delivers a clean, focused "Academic Clarity" aesthetic that fits well within the LevelUp design language. All four acceptance criteria pass functionally. The card layout, badge system, active quiz header, resume flow, and error state all render correctly. Two contrast ratio failures and a missing `cursor-pointer` on interactive buttons are the most significant findings — both fixable in minutes.

---

## What Works Well

- **Card structure is consistent across all states**: loading skeleton, start screen, active quiz, and error state all use the same `bg-card rounded-[24px] shadow-sm` shell — learners get a predictable, contained experience.
- **Responsive behavior is excellent**: buttons correctly stack to `flex-col` (full-width) at mobile, switch to `flex-row` at the `sm` breakpoint (640px+), and the card hits `max-w-2xl` exactly at tablet. No horizontal overflow at any viewport.
- **ARIA implementation in QuizHeader is thorough**: `aria-live="polite"` on the timer, descriptive `aria-label` that includes the formatted time string, `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` all present.
- **Focus rings on quiz buttons are visible and on-brand**: `outline: 2px solid rgb(139, 146, 218)` at `offset: 2px` — clearly perceivable for keyboard users.
- **Zero console errors** across all navigated states (start, active quiz, resume, error). Only one pre-existing meta tag deprecation warning.
- **Design token discipline**: no hardcoded hex colors or inline `style=` attributes found in any of the three changed files.
- **Touch targets meet the 44px minimum**: both buttons render at 48px height on all viewports, including stacked mobile layout.
- **Mobile bottom navigation clearance**: `padding-bottom: 80px` on `<main>` correctly prevents content from being clipped by the mobile nav bar.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

**H1 — Contrast failure: white button text on `--brand` background (3.12:1)**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:42`, `57`
- **Evidence**: Computed contrast ratio of `rgb(255, 255, 255)` on `rgb(139, 146, 218)` = **3.12:1**. WCAG AA requires 4.5:1 for normal text (the button label is 14–16px at `font-medium`, not large text).
- **Impact**: Learners with low vision or viewing on bright/outdoor screens may struggle to read "Start Quiz" or "Resume Quiz" button labels — the most critical CTAs on the page.
- **Scope**: This is a `--brand` token value issue in dark mode. The same contrast gap likely affects other `bg-brand` buttons elsewhere in the app. The quiz surface has surfaced it clearly.
- **Suggestion**: In `theme.css`, darken the dark-mode `--brand` value by ~10–15 lightness points (e.g. from `#8b92da` toward `#6a72c8`) so white text reads at ≥4.5:1. Verify the fix doesn't break the hover state (`--brand-hover: #7078c8` is already darker and reads at ~4.1:1 — it would need the same adjustment).

**H2 — Contrast failure: muted badge text on muted background (3.80:1)**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:27–32` (the "30 min" and "70% to pass" badges)
- **Evidence**: `rgb(138, 141, 160)` on `rgb(50, 51, 74)` = **3.80:1**. Fails AA for 14px normal-weight text; passes only for large text (≥18px or ≥14px bold).
- **Impact**: Quiz metadata that learners need before starting (time limit, passing score) is harder to read than it should be for low-vision users.
- **Scope**: Same `--muted` / `--muted-foreground` pairing used throughout the app in dark mode.
- **Suggestion**: Either lighten `--muted-foreground` in dark mode to improve contrast on `--muted` backgrounds, or switch the badge text to `text-foreground` (12.72:1) and keep the muted pill as a background-only treatment.

### Medium Priority (Fix when possible)

**M1 — Missing `cursor-pointer` on all quiz `<button>` elements**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:39–62`
- **Evidence**: `getComputedStyle(button).cursor` returns `"default"` for all three buttons (Start Quiz, Resume Quiz, Start Over). Confirmed this is a Tailwind v4 behavior — `<button>` elements do not automatically get `cursor: pointer` without an explicit class.
- **Impact**: Sighted mouse users lose a key affordance signal. When hovering over a primary CTA and seeing a default arrow cursor, the clickability is ambiguous — particularly noticeable on the "Start Over" secondary button whose border is near-invisible in dark mode.
- **Suggestion**: Add `cursor-pointer` to the className string on all three `<button>` elements in `QuizStartScreen.tsx`. The shadcn `Button` component also lacks this — consider adding it to `buttonVariants` base in `button.tsx` as a one-line fix that propagates app-wide.

**M2 — Pluralization bug in question count badge: "1 questions"**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:25`
- **Evidence**: Badge renders `{quiz.questions.length} questions` unconditionally. With a single-question quiz this renders "1 questions".
- **Impact**: Minor but visible copy error that undermines trust in a learning platform. Learners notice grammar mistakes in content they are about to be assessed on.
- **Suggestion**: Replace with a ternary: `` `${quiz.questions.length} ${quiz.questions.length === 1 ? 'question' : 'questions'}` ``. The same pattern applies to the Resume button label at line 44: "1 of 1 answered" is grammatically correct as-is, but worth auditing if the noun is used elsewhere.

### Nitpicks (Optional)

**N1 — Error state lacks card wrapper, unlike all other states**

- **Location**: `src/app/pages/Quiz.tsx:119–130`
- **Evidence**: The error state renders a plain `<div className="text-center py-12">` while every other state (loading skeleton, start screen, active quiz) uses `bg-card rounded-[24px] shadow-sm`. The result is that on a not-found URL, the content floats unsheltered in the main area background.
- **Impact**: Very minor visual inconsistency. The "Academic Clarity" aesthetic benefits from containing all quiz states in the same card shell — it gives the error state the same authority and polish as the others.
- **Suggestion**: Wrap the error content in the same `bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-3 sm:mx-auto shadow-sm` div used by the start/active states.

**N2 — `transition: all` on buttons has no explicit duration**

- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:42`, `49`, `57`
- **Evidence**: Buttons get `transition: all` from a global reset but no `duration-*` class — browser default is 0ms unless overridden, meaning the hover color change is instant. In practice this works, but design principles call for 150–200ms on quick interactive actions.
- **Suggestion**: Add `transition-colors duration-150` to each button's className if a smooth hover feel is desired. Low priority — instant transitions are not harmful.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Fail | H1 title: 12.72:1 PASS. Description: 4.63:1 PASS. Muted badge text: 3.80:1 FAIL. Button label on brand: 3.12:1 FAIL. |
| Text contrast ≥3:1 (large text / UI) | Pass | All elements pass the large-text threshold |
| Keyboard navigation reachable | Pass | Tab reaches both quiz buttons; Enter activates them |
| Focus indicators visible | Pass | 2px solid brand-color outline at 2px offset on all quiz buttons |
| Heading hierarchy | Pass | H1 on start screen; QuizHeader uses `<span>` (presentational title, not a heading — acceptable for active quiz context) |
| ARIA labels on interactive elements | Pass | Timer: `aria-live="polite"` + descriptive `aria-label`. Progress: `aria-label="Quiz progress"` + valuemin/max/now |
| Semantic HTML | Pass | `<button type="button">` used correctly throughout; no `<div onClick>` patterns found |
| Form labels associated | N/A | No form inputs in this story |
| `prefers-reduced-motion` | Pass | Handled globally in `src/styles/index.css:306` and `tailwind.css:47` |
| No console errors | Pass | Zero errors across all quiz page states |
| Alt text on images | N/A | No images in quiz components |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Mobile (375px) | Pass | No horizontal overflow. Card: `mx-3` (12px margins), `p-4` (16px padding). Buttons stack `flex-col`, full-width at 260px. Both buttons 48px tall (≥44px touch target). Bottom nav cleared with `pb-20`. |
| Tablet (768px) | Pass | No horizontal overflow. Card hits `max-w-2xl` (672px), centered. Buttons switch to `flex-row` at `sm` breakpoint. Padding upgrades to `sm:p-8` (32px). |
| Desktop (1280px) | Pass | Card centered at 672px with adequate whitespace either side. `py-6` outer wrapper provides breathing room. No layout overflow. |

---

## Detailed Findings

### Finding H1: Button label contrast failure

- **Issue**: White button text on `--brand` background reads at 3.12:1 in dark mode — below the 4.5:1 WCAG AA threshold for normal text.
- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:42`, `57`; root cause in `src/styles/theme.css` dark-mode `--brand` value (`#8b92da`).
- **Evidence**: Computed colors: text `rgb(255, 255, 255)`, background `rgb(139, 146, 218)`. Contrast ratio: 3.12:1.
- **Impact**: The "Start Quiz" button is the single most important interactive element on the page. A contrast failure here directly impedes learners with low vision from confidently identifying and activating the primary CTA.
- **Suggestion**: Darken `--brand` in the `.dark` theme block (e.g. to `#6b72c8` or similar) until white text achieves ≥4.5:1. Test with the contrast checker at each step.

### Finding H2: Muted badge contrast failure

- **Issue**: `--muted-foreground` text on `--muted` badge background reads at 3.80:1 — fails AA for 14px normal-weight text.
- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:27–32`
- **Evidence**: Text `rgb(138, 141, 160)` on background `rgb(50, 51, 74)`. Contrast ratio: 3.80:1.
- **Impact**: Quiz metadata badges ("30 min", "70% to pass") are informational content learners rely on to decide whether to start. Under-contrast text increases cognitive effort for users with low vision.
- **Suggestion**: Lighten `--muted-foreground` in dark mode, or use `text-foreground` (`rgb(232, 233, 240)`, 12.72:1) for badge text and keep the `--muted` pill as background-only.

### Finding M1: Missing cursor-pointer

- **Issue**: All `<button>` elements in `QuizStartScreen.tsx` compute `cursor: default` — no clickability affordance for mouse users.
- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:39`, `49`, `55`
- **Evidence**: `getComputedStyle(button).cursor === "default"` confirmed live. Neither Tailwind v4 nor the browser provides automatic `cursor: pointer` for `<button>`.
- **Impact**: On the start screen where all interaction is button-driven, the default cursor creates uncertainty. This matters most for the "Start Over" secondary button whose near-invisible border already makes it look less interactive.
- **Suggestion**: Add `cursor-pointer` to each button's className in `QuizStartScreen.tsx`. Consider also adding it to the `buttonVariants` base string in `src/app/components/ui/button.tsx` line 8 to prevent recurrence across the app.

### Finding M2: Pluralization bug

- **Issue**: `{quiz.questions.length} questions` always renders "questions", producing "1 questions" for single-question quizzes.
- **Location**: `src/app/components/quiz/QuizStartScreen.tsx:25`
- **Evidence**: Live render with the seeded single-question quiz confirmed "1 questions".
- **Impact**: Grammatical errors reduce perceived quality of educational software. On a quiz page, where content accuracy signals trust, small copy errors stand out.
- **Suggestion**: `` `${n} ${n === 1 ? 'question' : 'questions'}` ``

---

## Recommendations

1. **Fix contrast tokens before the next story (E12-S05)**: The `--brand` and `--muted-foreground` dark-mode contrast gaps will affect the question display UI too. Fixing the tokens now means S05 inherits correct contrast rather than compounding the issue.

2. **Add `cursor-pointer` to `buttonVariants` base**: A one-line change in `button.tsx` fixes this for all shadcn `Button` usages. Separately add it to the raw `<button>` elements in `QuizStartScreen.tsx` for this story.

3. **Pluralization helper utility**: If question counts appear elsewhere in the quiz flow (results screen, progress summaries), extract a `pluralize(count, singular, plural)` helper to avoid per-site fixes.

4. **Consider a shared quiz card wrapper component**: With three states all using the same `bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-3 sm:mx-auto shadow-sm` div (and the error state being the outlier), a tiny `<QuizCard>` wrapper component would enforce consistency and make the error state deviation impossible to miss.

