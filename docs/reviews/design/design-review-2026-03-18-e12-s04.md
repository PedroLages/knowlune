# Design Review — E12-S04: Create Quiz Route and QuizPage Component

**Review Date**: 2026-03-18 (re-review after fixes)
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e12-s04-create-quiz-route-and-quizpage-component`
**Changed Files**:
- `src/app/pages/Quiz.tsx`
- `src/app/components/quiz/QuizHeader.tsx`
- `src/app/components/quiz/QuizStartScreen.tsx`
- `src/styles/theme.css` (dark mode brand contrast fix)

**Affected Route**: `/courses/course-001/lessons/lesson-001/quiz`
**Previous Review**: 2026-03-17 (commits 12207ed, ebf19dc fix round)

---

## Executive Summary

This re-review verifies fixes applied in commits `12207ed` and `ebf19dc` following the 2026-03-17 initial review. The dark mode brand contrast blocker, pluralization bug, and missing `console.error` have all been resolved. The quiz route loads correctly, renders the error state cleanly with proper ARIA semantics, and passes responsive layout checks at all three breakpoints. One new high-priority finding emerges: the "Back to course" link's 20px tap target height is below the 44px minimum, which is a mobile usability concern for learners navigating after a failed quiz load. A pre-existing systemic issue with `--muted-foreground` contrast in light mode on white cards is documented for team awareness.

---

## What Works Well

- **Dark mode contrast fix is correct.** `--brand` raised to `#8b92da` yields 5.18:1 on the dark card background (`rgb(36,37,54)`) — comfortably above AA 4.5:1. `--muted-foreground` in dark mode achieves 7.42:1. Both pass.
- **ARIA semantics are solid.** `role="alert"` on the error container, `role="status" aria-busy="true"` on the loading skeleton, `<main>` landmark present, `aria-live="polite"` on the timer announcement region. The accessibility tree is clean and intentional.
- **Keyboard navigation works correctly.** Tab reaches the "Back to course" link in logical order, and `:focus-visible` is true on focus. The global focus indicator (`outline: 2px solid var(--brand); outline-offset: 2px`) applies correctly.
- **Pluralization fix confirmed.** `QuizStartScreen.tsx:27` has `questionCount === 1 ? 'question' : 'questions'` and `QuizHeader.tsx:19` has `minutes === 1 ? 'minute' : 'minutes'`.
- **Error logging fix confirmed.** `Quiz.tsx:83` has `console.error('[Quiz] Failed to load quiz:', err)` and line 94 chains `.catch(console.error)` on `startQuiz`.
- **No hardcoded colors or inline styles.** All three changed files use design tokens exclusively. No `text-white`, no hex literals, no `style={}`.
- **Responsive layout — no horizontal overflow.** Confirmed clean at 375px (mobile), 768px (tablet), and 1280px (desktop). `scrollWidth <= clientWidth` at all breakpoints.
- **Progress component handles reduced motion.** `motion-reduce:transition-none` and `motion-safe:transition-all` are present in the Progress bar — the only animated element in the active quiz header.
- **Console is clean.** Zero errors, one pre-existing `<meta apple-mobile-web-app-capable>` deprecation warning unrelated to this story.
- **Light mode brand link contrast passes.** `--brand` (#5e6ad2) on white card achieves 4.70:1 — above the 4.5:1 AA threshold.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### H1 — "Back to course" link has 20px tap target height (below 44px minimum)

- **Location**: `src/app/pages/Quiz.tsx:142-148`
- **Evidence**: Computed `getBoundingClientRect().height = 20px` at both 375px and 768px viewports. The link is `inline-flex items-center gap-1 text-sm` — the icon and text set the intrinsic height to one line of 14px font + line-height.
- **Impact**: On a touch device, learners who hit the error state (e.g., navigating to a lesson that has no quiz assigned yet) will struggle to tap "Back to course". This is the only recovery action available — a missed tap leaves them stranded with no visible way back.
- **Suggestion**: Add `min-h-[44px]` and `items-center` to the link, or wrap it in a container with the minimum height. Using the shadcn `Button` component with `variant="link"` and `size="sm"` would automatically provide the correct touch target and consistent styling:
  ```tsx
  // Option A: Tailwind utility
  className="text-brand hover:underline mt-4 inline-flex items-center gap-1 text-sm min-h-[44px]"

  // Option B: Button component (already used in QuizStartScreen)
  <Button asChild variant="link" size="sm" className="mt-4">
    <Link to={`/courses/${courseId}`}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to course
    </Link>
  </Button>
  ```

---

### Medium Priority (Fix when possible)

#### M1 — Pre-existing: `--muted-foreground` fails WCAG AA on white cards in light mode

- **Location**: `src/styles/theme.css:16` (`--muted-foreground: #7d8190`)
- **Evidence**:
  - `--muted-foreground` (#7d8190 = `rgb(125,129,144)`) on `--card` (#ffffff) = **3.88:1** — fails AA (requires 4.5:1 for 16px normal text).
  - Same token on `--background` (#faf5ee) = **3.58:1** — also fails.
  - This affects the error message paragraph: `Quiz.tsx:141` uses `text-muted-foreground` for "No quiz found for this lesson."
- **Impact**: This is a systemic theme-level issue pre-dating this story. It affects the quiz error message text and any other `text-muted-foreground` text on white cards across the app. Learners with reduced contrast sensitivity will find these descriptive/secondary texts unreadable.
- **Scope**: This is NOT a quiz-specific regression — it exists on cards throughout the app. It should be tracked as a separate theme token issue. For the quiz specifically, consider using `text-foreground` for the error message since "No quiz found" is primary informational content, not decorative secondary text. `--foreground` (#1c1d2b) on white achieves ~16:1.
- **Note for this story**: Since the muted-foreground token is app-wide and was not introduced by this story, this is classified Medium (not Blocker) for the quiz review. A dedicated token audit issue is recommended.

#### M2 — `mx-3` on error card is additive with `<main>`'s `p-6` padding at mobile

- **Location**: `src/app/pages/Quiz.tsx:139` and `src/app/components/quiz/QuizStartScreen.tsx:30`
- **Evidence**: At 375px viewport, `<main>` has `p-6` (24px all sides), and both the error card and start screen card add `mx-3` (12px each side) on top of that. Effective card width: 292px = 375 - 11px (icon sidebar) - 48px (main padding) - 24px (card margins). The `mx-3` is the mobile fallback for `sm:mx-auto`, but inside an already-padded main it creates tighter-than-intended content width.
- **Impact**: Minor — no overflow occurs and content is readable. But the card appears more constrained than the design intent at mobile. Both cards use the same `mx-3 sm:mx-auto` pattern, so fixing one would need to fix both consistently.
- **Suggestion**: If `<main>` provides its own horizontal padding, `mx-0 sm:mx-auto` (no side margin on mobile) would let the card use the full content width. Alternatively, `mx-auto` at all sizes with `w-full max-w-2xl` is sufficient. Not urgent given no overflow, but worth aligning.

---

### Nitpicks (Optional)

#### N1 — Error message text could be more specific

- **Location**: `src/app/pages/Quiz.tsx:141`
- **Current text**: "No quiz found for this lesson."
- **Suggestion**: "No quiz is available for this lesson yet." is slightly friendlier and hints the quiz may be added later rather than implying a broken state. This is entirely optional — the current text is functional and accurate.

---

## Verification of Previous Review Findings

| Previous Finding | Status | Evidence |
|-----------------|--------|---------|
| Dark mode `--brand` contrast <4.5:1 (BLOCKER) | **Fixed** | `--brand: #8b92da` → 5.18:1 on dark card background. Confirmed in `theme.css:148`. |
| `--brand-soft` contrast in dark mode (BLOCKER) | **Fixed** | `--brand-soft: #2a2c48` → improved. Badge text (`text-brand` on `bg-brand-soft`) now uses brand (#8b92da) on #2a2c48 = 4.85:1. |
| Missing `cursor-pointer` on quiz buttons | **Fixed** | shadcn `Button` component handles cursor internally. No inline `cursor-pointer` needed. |
| Pluralization bug "1 questions" | **Fixed** | `QuizStartScreen.tsx:27` confirmed. |
| Pluralization bug "1 minutes" in timer announcement | **Fixed** | `QuizHeader.tsx:19` confirmed. |
| Silent Dexie catch (missing console.error) | **Fixed** | `Quiz.tsx:83` confirmed. |
| `text-white` hardcoded in destructive button | **Fixed** | Changed to `text-destructive-foreground`. |
| Missing Zod safeParse for localStorage | **Fixed** | `Quiz.tsx:26-33` uses `QuizProgressSchema.safeParse()`. |
| Timer not cleared at 0 | **Fixed** | `QuizHeader.tsx:50-53`: `clearInterval` called when `s <= 0`. |
| `startQuiz` errors not surfaced to UI | **Fixed** | `Quiz.tsx:55` subscribes to `selectError`, rendered at line 135. |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (dark mode) | Pass | muted-fg: 7.42:1, brand link: 5.18:1 on dark card |
| Text contrast ≥4.5:1 (light mode, error msg) | Fail | `text-muted-foreground` (#7d8190) on white = 3.88:1 — pre-existing systemic token issue (M1) |
| Text contrast ≥4.5:1 (light mode, brand link) | Pass | `--brand` (#5e6ad2) on white = 4.70:1 |
| Keyboard navigation | Pass | Tab reaches "Back to course" link; `:focus-visible` true |
| Focus indicators visible | Pass | Global `outline: 2px solid var(--brand); outline-offset: 2px` applies |
| Heading hierarchy | Pass | Single `<h1>` in error state (none needed — no heading shown); start screen has `<h1>` for quiz title |
| ARIA landmarks | Pass | `<main>`, `<nav>` (Main navigation), `<aside>` (Sidebar), `<banner>` (header) all present |
| ARIA role on error container | Pass | `role="alert"` correctly used |
| ARIA role on loading skeleton | Pass | `role="status" aria-busy="true"` correctly used |
| ARIA on timer | Pass | Visual timer `aria-hidden="true"`; live region `aria-live="polite" aria-atomic="true"` for per-minute announcement |
| ARIA labels on icon buttons | Pass (in scope) | "Back to course" link has visible text; ArrowLeft icon has `aria-hidden="true"` |
| Form labels associated | N/A | No forms in current state |
| prefers-reduced-motion | Pass | Progress bar uses `motion-reduce:transition-none motion-safe:transition-all` |
| Touch targets ≥44px | Fail | "Back to course" link: 20px height (H1) |
| No horizontal scroll at mobile | Pass | `scrollWidth (364) <= clientWidth (375)` at 375px |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass with caveat. No horizontal scroll. Card renders at 292px — readable and usable. Touch target issue (H1) applies here most critically. `p-4` padding correctly applied at mobile (not `sm:p-8`).
- **Tablet (768px)**: Pass. Card renders at 672px (max-w-2xl), centered, full 32px padding. Layout is clean.
- **Desktop (1280px)**: Pass. Card renders centered within the main content area. Sidebar, header, and content coexist without overlap.

---

## Recommendations

1. **Fix the tap target (H1)** before merge. This is the only high-priority item and requires a one-line Tailwind addition (`min-h-[44px]`) to the "Back to course" link in `Quiz.tsx:144`. Using the `Button` component as used in `QuizStartScreen` would be the most consistent approach.

2. **Raise `--muted-foreground` in light mode (M1)** as a separate, team-tracked issue. The token (#7d8190) fails on white cards throughout the app. Raising it to ~#6b6f7e would achieve 4.5:1 on white while remaining visually subdued. This is outside the scope of E12-S04 but should be filed.

3. **Consider `mx-0` at mobile for quiz cards (M2)** when time permits. The `mx-3 sm:mx-auto` pattern creates double-indentation inside the already-padded `<main p-6>`. Low urgency — no overflow occurs.

4. **The quiz components are well-structured and production-quality** in all other respects. The timer architecture (live region, minute-boundary announcements, sync-on-visibility, interval cleanup) is thoughtfully built for both accessibility and correctness. Approve after H1 is addressed.
