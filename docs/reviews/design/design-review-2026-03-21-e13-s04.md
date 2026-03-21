# Design Review Report — E13-S04: Unlimited Quiz Retakes

**Review Date**: 2026-03-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E13-S04 — Unlimited Quiz Retakes
**Branch**: feature/e13-s04-unlimited-quiz-retakes
**Changed Files**:
- `src/app/components/quiz/ScoreSummary.tsx` (improvement display)
- `src/app/components/quiz/QuizStartScreen.tsx` (conditional "Retake Quiz" label)
- `src/app/pages/QuizResults.tsx` (compute previousBest, swap button variants)
- `src/app/pages/Quiz.tsx` (query attempt count for QuizStartScreen)

**Test Environment**: `http://localhost:5173`, dark mode active, Chromium

---

## Executive Summary

E13-S04 delivers a clean, learner-positive retake experience. The conditional "Retake Quiz" label on the start screen, the promoted brand-primary Retake button on the results screen, and the improvement summary are all implemented correctly against the story's design guidance. One medium-priority accessibility issue was found (`aria-disabled` on a non-interactive `<span>`), and one low-priority gap exists in the focus management story. No design token violations, no hardcoded colours, no console errors.

---

## What Works Well

1. **Design token discipline is perfect.** All four changed files use only semantic tokens (`text-success`, `text-muted-foreground`, `text-brand`, `variant="brand"`, `variant="brand-outline"`). Zero hardcoded hex values or raw Tailwind colour primitives.

2. **Button hierarchy is exactly right.** "Retake Quiz" uses `variant="brand"` (solid brand CTA) and "Review Answers" uses `variant="brand-outline"` (secondary). This matches the story's design guidance and creates an immediately scannable action hierarchy for learners.

3. **Improvement summary tone is learner-positive.** The negative delta case correctly renders only `text-muted-foreground` text (no `text-destructive`, no discouraging language). The positive delta renders `text-success font-semibold` with a "+" prefix. The neutral "Same as best" case is de-emphasised correctly.

4. **`aria-live` region is fully populated.** The screen reader announcement (`"Quiz score: 100 percent. 3 of 3 correct. Passed. Same as previous best of 100 percent."`) provides complete context including the improvement data — learners using assistive technology get the full picture.

5. **`motion-reduce:transition-none` is present** on the score ring SVG animation (`ScoreSummary.tsx:90`). This honours the `prefers-reduced-motion` user preference correctly.

6. **Touch targets are consistently 44px.** Both result action buttons use `min-h-[44px]`, the "Back to Lesson" link uses `min-h-[44px]`, and the "View All Attempts" placeholder uses `min-h-[44px]` (measured: 44px height at all viewports).

7. **Responsive behaviour is correct.** Mobile (375px): buttons stack vertically, no horizontal scroll. Tablet (768px): buttons render side-by-side. Desktop (1440px): no overflow. All breakpoints verified by live measurement.

8. **No limit/cooldown messaging.** Verified by text search against live page content — the word "cooldown", "limit", "wait", and "attempt limit" do not appear anywhere in the rendered output.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

#### M1 — `aria-disabled` on non-interactive `<span>` is semantically invalid

**File**: `src/app/pages/QuizResults.tsx:146–152`
**Evidence**:
```tsx
<span
  className="text-muted-foreground text-sm inline-flex items-center gap-1 min-h-[44px] cursor-default"
  aria-disabled="true"
>
  <History className="size-4" aria-hidden="true" />
  View All Attempts (Coming Soon)
</span>
```
**Impact**: `aria-disabled` is only meaningful on elements with interactive ARIA roles (button, link, checkbox, etc.). On a plain `<span>`, screen readers treat it as decorative text and ignore the `aria-disabled` attribute entirely — the "disabled" semantic is not communicated to assistive technology users. The element also has no `role` attribute, so it has no accessible role at all.

Additionally, `cursor-default` and `min-h-[44px]` together imply the element is meant to look interactive (44px height suggests a touch target) but cannot be focused, which may confuse sighted users who try to click it.

**Suggestion**: Since this is a "coming soon" placeholder that is intentionally inert, the simplest correct solution is to drop `aria-disabled` entirely and let the visual text "(Coming Soon)" communicate the state. Alternatively, if the intent is to convey "this will be a button one day", use a `<button>` with `disabled` attribute (which browsers communicate natively to screen readers) and style it appropriately:
```tsx
<button
  disabled
  className="text-muted-foreground text-sm inline-flex items-center gap-1 min-h-[44px] cursor-default opacity-60"
>
  <History className="size-4" aria-hidden="true" />
  View All Attempts (Coming Soon)
</button>
```
The `(Coming Soon)` suffix in the text label already provides the necessary context — either approach (remove `aria-disabled` from `<span>`, or convert to a `<button disabled>`) resolves the semantic issue.

### Nitpicks (Optional)

#### N1 — Focus not managed to results heading or Retake button after submission

**File**: `src/app/pages/QuizResults.tsx`
**Evidence**: After quiz submission, `document.activeElement` was `document.body` (no managed focus). The story's design guidance specifies: "after results load, focus the heading or score ring (existing pattern)." Keyboard users who submit the quiz will need to Tab through the entire page to reach the "Retake Quiz" button.

**Impact**: Low — the tab order itself is logical (Question Breakdown → Retake Quiz → Review Answers → Back to Lesson), so keyboard users can still navigate. But the initial focus placement means extra Tab presses after the page transition. Screen reader users get the `aria-live` announcement automatically, which mitigates some of this.

**Suggestion**: A `useEffect` that fires after `lastAttempt` is populated could focus the `<h1>` heading or the "Retake Quiz" button:
```tsx
const retakeBtnRef = useRef<HTMLButtonElement>(null)
useEffect(() => {
  if (lastAttempt) retakeBtnRef.current?.focus()
}, [!!lastAttempt])
```

#### N2 — Improvement summary paragraph has no semantic grouping with the score ring

**File**: `src/app/components/quiz/ScoreSummary.tsx:155–167`
**Evidence**: The improvement line (`<p data-testid="improvement-summary">`) is rendered as a standalone `<p>` with no association to the score ring or the `aria-live` region in the DOM. The `aria-live` region (`.sr-only`) does include the improvement text for screen readers, so screen reader users do receive it — but the visual `<p>` has no `aria-describedby` or similar link back to the live region.

**Impact**: Negligible for most users — the `aria-live` region fully covers screen reader needs. This is a very minor structural observation.

**Suggestion**: No action required. The current implementation is functionally correct; this is noted for awareness only.

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1a | "Retake Quiz" button prominently displayed on results screen | Pass | Button rendered with `variant="brand"` (solid brand blue), verified by computed style: `rgb(139, 146, 218)` bg, `rgb(255, 255, 255)` text |
| AC1b | No limit/cooldown messaging | Pass | Regex search `/cooldown\|limit\|wait\|attempt limit/i` against live page body returned `false` |
| AC1c | Clicking "Retake Quiz" starts new attempt immediately | Pass | Button navigates to quiz start via `retakeQuiz()` store action — no dialog, no confirmation |
| AC3a | Results screen shows current score | Pass | "Design Review Test Quiz — Results" H1, score ring shows 100% / EXCELLENT |
| AC3b | Improvement summary shows previous best vs current | Pass | `data-testid="improvement-summary"` rendered: "Previous best: 100% · Same as best" |
| AC3c | Positive delta uses green styling | Pass | `text-success font-semibold` confirmed in source; `text-success` resolves correctly in computed styles |
| AC3d | Negative delta uses neutral styling (not red) | Pass | Code path: when `delta < 0`, neither success nor muted span renders — only "Previous best: X%" shows; no `text-destructive` |
| AC3e | Same score shows neutral styling | Pass | "· Same as best" in `text-muted-foreground` confirmed live |
| AC4a | Start screen shows "Retake Quiz" for completed quizzes | Pass | Live app shows "Retake Quiz" button text when prior attempts exist in Dexie |
| AC4b | "Start Quiz" for first-time users | Pass | Code: `{hasCompletedBefore ? 'Retake Quiz' : 'Start Quiz'}` at `QuizStartScreen.tsx:106` |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Dark mode: brand blue `rgb(139,146,218)` on dark bg — meets AA; white text on brand button — meets AA; `text-muted-foreground` on dark card bg — meets AA |
| Keyboard navigation | Pass | Tab sequence is logical: Question Breakdown → Retake Quiz → Review Answers → Back to Lesson. All interactive elements reachable |
| Focus indicators visible | Pass | Focus ring implemented via `box-shadow` (`focus-visible:ring-2 focus-visible:ring-ring`) — verified by computed style on "Back to Lesson" link |
| Heading hierarchy | Pass | Single H1 ("Design Review Test Quiz — Results") — no skipped levels |
| ARIA labels on icon buttons | Pass | All Lucide icon SVGs have `aria-hidden="true"`; icons are decorative within labelled buttons/links |
| Semantic HTML | Partial | "View All Attempts" uses `<span aria-disabled="true">` — invalid semantic (see M1). All other elements use correct tags |
| Form labels associated | N/A | No forms on results page |
| `prefers-reduced-motion` | Pass | Score ring: `motion-reduce:transition-none` present at `ScoreSummary.tsx:90` |
| `aria-live` region | Pass | Region present, `aria-atomic="true"`, `.sr-only` class, full score + improvement text included |
| Screen reader announcement on load | Partial | `aria-live="polite"` fires on mount with full score text. Focus not moved to heading/button after navigation (see N1) |

---

## Responsive Design Verification

| Viewport | Status | Measurements |
|----------|--------|-------------|
| Mobile (375px) | Pass | No horizontal scroll (scrollWidth 404 < clientWidth 416). Buttons stacked vertically (top: 692 vs 748). Both 44px height. Button width 312px (fills container) |
| Tablet (768px) | Pass | No horizontal scroll. Buttons side-by-side (same top: 664). Correct `sm:flex-row` breakpoint behaviour |
| Desktop (1440px) | Pass | No horizontal scroll. Card `max-w-2xl mx-auto` centres correctly. Improvement text 14px (readable) |

---

## Code Quality Observations

- **Zero hardcoded colours** in all four changed files (grep confirmed: no `#[0-9A-Fa-f]{3,6}` matches, no raw Tailwind colour primitives like `bg-blue-600` or `text-green-500`)
- **Zero inline style attributes** (grep confirmed: no `style={` in changed files)
- **Zero TypeScript `any` types** in changed page files
- **Zero console errors** during the complete quiz flow (start → answer → submit → results)
- **One pre-existing console warning** (deprecated `apple-mobile-web-app-capable` meta tag) — not related to E13-S04

---

## Recommendations

1. **Fix M1 (medium priority)**: Remove `aria-disabled="true"` from the "View All Attempts" `<span>`, or convert the element to a `<button disabled>` at `src/app/pages/QuizResults.tsx:146`. The visual `(Coming Soon)` text already communicates the state to sighted users; this change closes the screen reader gap.

2. **Consider N1 (optional, low effort)**: Add a `useRef` + `useEffect` to move focus to the "Retake Quiz" button after the results page loads. This would complete the focus management pattern described in the story's accessibility requirements and make the retake flow feel faster for keyboard users.

3. **Positive signal — improvement summary negative path**: The decision to show only "Previous best: X%" (no delta indicator) when `delta < 0` is the correct learner-positive approach. This is well-implemented and should be preserved in future iterations.

4. **Story 16.1 placeholder is clean**: The "View All Attempts (Coming Soon)" element is visually appropriate — muted styling, History icon, clear affordance that this is future functionality. Once M1 is addressed, this placeholder will be fully accessible.
