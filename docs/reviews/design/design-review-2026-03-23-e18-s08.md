# Design Review Report — E18-S08

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E18-S08 — Display Quiz Availability Badges on Courses Page
**Branch**: `feature/e18-s08-display-quiz-availability-badges-courses-page`
**Changed Files Reviewed**:
- `src/app/components/courses/QuizBadge.tsx`
- `src/app/components/figma/ModuleAccordion.tsx`
- `src/hooks/useQuizScoresForCourse.ts`

---

## Executive Summary

E18-S08 adds quiz availability badges to lesson rows in the ModuleAccordion component. The implementation is clean and well-structured: both badge states ("Take Quiz" and "Quiz: X%") render correctly, text contrast passes WCAG AA across light and dark mode, keyboard navigation reaches the badge and an aria-label is present. One HIGH severity finding requires attention before merge: the focus ring on the badge button does not meet the WCAG 2.4.7 / 2.4.11 minimum 3:1 contrast threshold. A pre-existing heading hierarchy skip on CourseDetail (h1 → h3 → h2) is noted as MEDIUM; it was not introduced by this story. All other checks pass.

---

## What Works Well

1. **Both badge states render correctly and immediately.** "Take Quiz" (muted) and "Quiz: 85%" (success green) display as intended. The no-quiz lesson correctly shows no badge. The conditional rendering in `ModuleAccordion.tsx:167` using `quizScoreMap.has()` is a clean, efficient guard.

2. **Text contrast is excellent across light and dark mode.** Success green (`#3a7553`) achieves 5.46:1 on white card and 5.03:1 on the body background — well above the 4.5:1 WCAG AA requirement. Muted foreground (`#656870`) achieves 5.57:1 on white. Dark mode success green (`#6ab888`) achieves 6.34:1 on the dark card. All pass comfortably.

3. **Touch target meets WCAG 2.5.5.** The badge measures 102×44px at all three breakpoints (1440px, 768px, 375px). The `min-h-[44px]` class override on the `size="sm"` button correctly ensures the 44px minimum even though `size="sm"` is `h-8` (32px) by default.

4. **Accessible by keyboard.** The badge is reachable at tab stop 8 in the lesson list flow, after the status indicator button and lesson link — a logical order. The element is a native `<button>` (correct semantic element, not a `div`). The `aria-label` is descriptive: `"Quiz score: 85% for Lesson With Quiz"` / `"Take quiz for Lesson With Quiz"`.

5. **Design token discipline is complete.** Zero hardcoded hex colors, zero inline styles. `text-success`, `text-muted-foreground`, and `variant="outline"` all resolve through the theme token system, ensuring automatic light/dark mode switching. ESLint passes cleanly on all three changed files.

6. **Responsive layout holds at all breakpoints.** No horizontal scroll at 768px or 375px. The badge's `shrink-0` class prevents it from collapsing on narrow viewports. Badge text does not truncate or wrap.

7. **Batch query performance is thoughtful.** `useQuizScoresForCourse` uses a single Dexie query per course (not N+1 per lesson), with stable memoization via `lessonIdKey` to avoid unnecessary re-fetches.

---

## Findings by Severity

### HIGH (Should fix before merge)

#### H1 — Focus ring fails WCAG 2.4.7 / 2.4.11 minimum contrast

The badge button inherits the shared `Button` component's `focus-visible:ring-ring/50 focus-visible:ring-[3px]` styles. When keyboard-focused, the rendered ring is `oklab(0.708 0 0)` at approximately 25% effective opacity (after compositing), producing a box-shadow of `1.5px` spread. The computed contrast of this ring against the body background (`#faf5ee`) is **1.19:1** — far below the WCAG 2.4.7 "Focus Visible" requirement of 3:1 for non-text focus indicators.

High-resolution screenshots confirm the difference between rest and focus states is imperceptible to sighted keyboard users:

- Rest state: thin border at `rgba(0,0,0,0.07)`
- Focused state: border changes to `--ring` color plus a ~1.5px box-shadow at 25% opacity

The border-ring itself (focused border color, `oklch(0.708 0 0)` at full opacity) achieves only **2.19:1** against the body background — also below 3:1.

**Location**: `src/app/components/courses/QuizBadge.tsx:23` — the button uses `variant="outline" size="sm"` and inherits the shared button focus ring, which is the underlying issue. The root is `src/app/components/ui/button.tsx:8`.

**Impact**: Keyboard-only users and users with low vision cannot reliably perceive which element has focus. This matters acutely on an e-learning platform where many learners have accessibility needs and may navigate via keyboard.

**Note**: This is a **shared Button component issue** that affects all `variant="outline"` buttons across the app, not unique to QuizBadge. However, it is observable here and should be addressed. The fix could be applied to the Button component globally or targeted via a `className` override.

**Suggestion**: Replace the `ring-ring/50` focus token with `ring-brand` (the brand blue `#5e6ad2` has ~7:1 contrast on the body background), or add `focus-visible:outline-brand` instead of relying solely on the ring. The global `*:focus-visible` rule in `theme.css:325` already sets `outline: 2px solid var(--brand)` — but the Button's `outline-none` class overrides it. Removing `outline-none` from the Button base class and relying on the global rule would be the most consistent fix.

---

### MEDIUM (Fix when possible)

#### M1 — "Take Quiz" state: icon color does not semantically signal "incomplete"

The ClipboardCheck icon inherits the button's `text-foreground` (`#1c1d2b`, near-black) while the adjacent text reads `text-muted-foreground` (`#656870`, medium gray). This means the icon appears darker and more prominent than the text label — a minor visual inconsistency. For a "not yet attempted" state, an icon in `text-muted-foreground` (matching the label) or in `text-brand` (to signal it's actionable) would communicate status more clearly than a dark foreground icon next to lighter muted text.

**Location**: `src/app/components/courses/QuizBadge.tsx:35` — `<ClipboardCheck className="size-3.5" aria-hidden="true" />`

**Impact**: Minor cognitive inconsistency — the icon weight does not match the muted label weight, which could make the badge feel unpolished to detail-oriented users.

**Suggestion**: Consider `<ClipboardCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />` for the Take Quiz state, or use the icon color conditionally based on `bestScore` state.

#### M2 — Pre-existing heading hierarchy skip on CourseDetail (not introduced by this story)

The DOM reading order on `/courses/:courseId` is: `h1` (course title) → `h3` (Your Progress sidebar) → `h2` (Course Content) → `h3` (module name). The skip from `h1` to `h3` before `h2` violates WCAG 1.3.1 (Info and Relationships). Screen readers rely on heading order for document navigation.

**Location**: `src/app/pages/CourseDetail.tsx:142` — `<h3 className="...">Your Progress</h3>`

**Impact**: Screen reader users who navigate by heading level will hear "Your Progress" as an `h3` before any `h2` has been announced, creating a confusing outline. For learners using NVDA or VoiceOver on the course detail page, this disrupts the mental model of page structure.

**Suggestion**: Change "Your Progress" to `h2` (it is a top-level section alongside "Course Content"), or if visual styling requires `h3` sizing, use `<h2 className="text-sm font-semibold ...">` and let Tailwind control the visual size independently of semantic level.

**Attribution**: This issue predates E18-S08 and exists in `CourseDetail.tsx`. It is noted here for completeness but should be tracked against the CourseDetail component, not this story.

---

### LOW / NITPICKS

#### L1 — Success state: missing `success-soft` background token for visual hierarchy

The completed quiz badge (`Quiz: 85%`) uses `variant="outline"` with `text-success` for the score span. This produces dark green text inside a plain outlined box. Comparable "completed/success" patterns in the app (e.g., completion badges) typically use a `bg-success-soft` background (`#eef5f0`) to create a filled "success chip" feel.

**Location**: `src/app/components/courses/QuizBadge.tsx:36-39`

**Impact**: The current style is correct and accessible. This is a visual polish observation — a success-soft background would make the completed state feel more visually rewarding and distinct from the muted "Take Quiz" state, reinforcing the achievement signal.

**Suggestion**: Consider `className="... bg-success-soft border-success/20"` for the completed variant. If this direction is taken, verify that `text-success` on `bg-success-soft` maintains 4.5:1 contrast (current measurement: success `#3a7553` on success-soft `#eef5f0` ≈ 4.3:1 — **barely below** threshold; use `text-success-soft-foreground` or darken the success color if applied to a soft background).

#### L2 — Badge renders inside a `<Link>` wrapper but stops propagation

The `QuizBadge` component calls `e.stopPropagation()` to prevent the containing `<Link>` from also navigating. The badge is positioned after the `</Link>` closing tag in `ModuleAccordion.tsx:167`, so it is actually **outside** the link — `stopPropagation` on the badge click is therefore a no-op. This is harmless but adds unnecessary code.

**Location**: `src/app/components/courses/QuizBadge.tsx:28-29`

**Suggestion**: Remove `e.stopPropagation()` since the badge is not nested inside the lesson `<Link>`. The `e.preventDefault()` is similarly unnecessary for a `<button>` (buttons don't have a default action to prevent). Only `navigate(...)` is needed.

#### L3 — `size="sm"` overridden by `min-h-[44px]` produces an unusual combination

The badge uses `size="sm"` (which sets `h-8 = 32px`) but immediately overrides it with `min-h-[44px]`. This reliance on utility override works correctly (verified: computed height is 44px), but it uses an explicit pixel value (`44px`) rather than Tailwind's semantic `size="touch"` or `size="touch-icon"` variants that exist in the Button component for exactly this purpose.

**Location**: `src/app/components/courses/QuizBadge.tsx:32`

**Suggestion**: Use `size="touch"` (defined as `h-11 px-4 py-2` in `button.tsx:29`, which is 44px) and adjust padding manually if needed — or register a `"compact-touch"` size variant that gives 44px height with the tighter `px-2 text-xs` padding the badge needs.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast 4.5:1 (normal text) | Pass | Success `#3a7553` on white: 5.46:1. Muted `#656870` on white: 5.57:1 |
| Text contrast in dark mode | Pass | Success `#6ab888` on dark card: 6.34:1. Muted `#b2b5c8`: 7.42:1 |
| Focus indicator visible | Fail | Ring contrast: 1.19:1 (need 3:1). Border-ring: 2.19:1. See H1. |
| Keyboard navigation | Pass | Badge reached at tab stop 8. Logical order. |
| ARIA labels on badge button | Pass | `aria-label="Quiz score: 85% for Lesson With Quiz"` / `"Take quiz for..."` |
| Semantic HTML (`<button>` not `<div>`) | Pass | `tagName: BUTTON`, no `role` override needed |
| Icon marked aria-hidden | Pass | `<ClipboardCheck ... aria-hidden="true" />` |
| Touch target 44x44px | Pass | Measured 102×44px at all breakpoints |
| Heading hierarchy on page | Fail | Pre-existing: h1 → h3 → h2 skip in CourseDetail.tsx:142. Not in scope of E18-S08. |
| Color is not sole indicator | Pass | Icon + text used; badge is present for both states |
| prefers-reduced-motion supported | Pass | CSS includes reduced-motion media query |
| Form labels associated | N/A | No form inputs in this feature |
| No horizontal scroll | Pass | Both 768px and 375px: no horizontal overflow |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass — Badge appears right-aligned in lesson row, compact (102×44px), does not dominate. Module accordion expands correctly. Both badge states visible and correct.
- **Tablet (768px)**: Pass — No horizontal scroll. Badge visible and correctly sized. Layout adapts appropriately, sidebar sidebar-sheet dismissed via Escape key pattern.
- **Mobile (375px)**: Pass — No horizontal scroll. Badge visible at same 102×44px. Text reads "Quiz: 85%" without truncation. Bottom navigation bar present; course content accessible via scroll.

---

## Detailed Visual Evidence

### Badge "Take Quiz" state — lesson row (desktop)
Lesson row shows: status indicator button (circle) → "Lesson With Quiz / 5m" left-aligned → video icon + "Take Quiz" button right-aligned. The badge is compact (98px wide, 44px tall) and uses `text-muted-foreground` gray. Appropriate visual weight — does not dominate the row.

### Badge "Quiz: 85%" state — lesson row (desktop)
Same layout. Score text `Quiz: 85%` in success green (`rgb(58, 117, 83)`). The ClipboardCheck icon remains in foreground color (dark). Clean visual hierarchy between lesson title and badge.

### Dark mode
Both badge states visible on dark card (`#242536`). Success green transitions to `#6ab888` (lighter for dark bg contrast). Border uses `rgba(255,255,255,0.06)`. Visually consistent.

### Focus ring — critical finding
High-resolution comparison (3x deviceScaleFactor):
- Rest state: subtle gray border (border-color: `rgba(0,0,0,0.07)`)
- Keyboard-focused state: border changes to `oklch(0.708 0 0)` + 1.5px box-shadow at ~25% opacity
- Difference is imperceptible in practice — the ring blends into the warm `#faf5ee` background

---

## Recommendations

1. **Fix the focus ring contrast before merge.** The Button component's `focus-visible:ring-ring/50` resolves to a 1.19:1 contrast ring. The most targeted fix for QuizBadge is to add `focus-visible:ring-brand focus-visible:ring-2 focus-visible:ring-offset-1` to the badge's `className` — this overrides the shared ring with the brand blue, which has ~7:1 contrast on all backgrounds. A global Button fix is also worth tracking.

2. **Remove unnecessary `stopPropagation` and `preventDefault`.** The badge sits outside the lesson `<Link>`, so neither call does anything. Removing both simplifies the handler: `onClick={() => navigate(...)}`.

3. **Consider the icon color for "Take Quiz" state.** Aligning the icon color with `text-muted-foreground` would make the badge visually cohesive when the quiz is not yet attempted.

4. **Track heading hierarchy fix to CourseDetail separately.** The h1 → h3 skip predates this story; open a separate ticket against `CourseDetail.tsx` to fix "Your Progress" to `h2`.

