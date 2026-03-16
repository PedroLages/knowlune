# Design Review Report — E11-S05: Interleaved Review Mode

**Review Date**: 2026-03-16
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E11-S05 — Interleaved Review Mode
**Changed Files**:
- `src/app/pages/InterleavedReview.tsx` (new page, 362 lines)
- `src/app/components/figma/InterleavedCard.tsx` (new component, 195 lines)
- `src/app/components/figma/InterleavedSummary.tsx` (new component, 165 lines)
- `src/app/pages/ReviewQueue.tsx` (modified — added Interleaved Mode entry point link)

**Affected Routes**: `/review/interleaved` (new), `/review` (modified)
**Viewport Sizes Tested**: 1280px (desktop), 768px (tablet), 375px (mobile)

---

## Executive Summary

E11-S05 delivers a well-structured interleaved review mode with a focused single-card layout, a polished 3D card-flip animation, correct design token usage throughout, and strong ARIA scaffolding. The five acceptance criteria are all functionally implemented. Two medium-priority issues stand out: the keyboard shortcut hint is shown at all viewport sizes including mobile (where `Space` does not exist), and the `aria-live` announcement on card flip announces raw note content rather than a brief instructional cue. No blockers were found.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

**M1 — Keyboard hint visible on mobile/touch viewports**
**M2 — aria-live flip announcement lacks instructional context**
**M3 — AlertDialog title deviates from design spec**

### Nitpicks (Optional)

**N1 — "Unknown Course" in summary badge with test data**
**N2 — Rating button border-radius (14px) is inconsistent with design token**

---

## What Works Well

1. **Correct design token usage throughout**: No hardcoded hex colours found across all three new files. `bg-brand-soft`, `text-brand`, `bg-destructive/10`, `text-destructive`, `bg-success-soft`, `text-success`, `bg-muted`, `text-muted-foreground` are all used exactly as specified in the story's Design Token Usage table.

2. **3D card-flip animation is solid**: `MotionConfig reducedMotion="user"` correctly delegates `prefers-reduced-motion` to the browser preference on both `InterleavedCard` and `InterleavedSummary`. The `backfaceVisibility: hidden` + `transformStyle: preserve-3d` inline styles are correctly ESLint-suppressed with a comment explaining why Tailwind has no equivalent utilities for these CSS 3D transform properties.

3. **Touch targets comfortably exceed minimum**: Rating buttons measured at exactly 44px height on desktop. The Interleaved Mode link on the ReviewQueue header measured 56px height at 375px mobile — well above the 44px minimum. Action buttons in the summary measured 44px height.

4. **No horizontal overflow at any breakpoint**: Verified `scrollWidth <= clientWidth` at 375px, 768px, and 1280px. The `max-w-lg` card constraint and `px-4` padding correctly contain content at all sizes.

5. **Progress bar ARIA is complete and accurate**: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a computed `aria-label` (e.g., "0% complete") are all present and correct.

6. **Card ARIA state management is correct**: When the card is in front-face state, `aria-hidden="true"` is applied to the back face and `tabIndex={-1}` removes it from tab order. On flip, these swap correctly. `aria-label="Flip card to reveal answer"` is present on the front face button.

7. **Heading hierarchy is clean**: H1 ("Interleaved Review") → H2 ("Session Complete" in summary, "No notes due for review" in empty state). No heading levels are skipped.

8. **CLS score is 0.00**: No cumulative layout shift logged by the performance monitor across all navigations. The `min-h-[280px]` on the motion container successfully prevents layout shift during card flip.

9. **Zero console errors**: Only one pre-existing warning present (`apple-mobile-web-app-capable` meta tag deprecation) — unrelated to E11-S05 changes.

---

## Detailed Findings

### M1 — Keyboard hint shown at all viewport sizes including mobile

- **Location**: `src/app/pages/InterleavedReview.tsx:305–326`
- **Evidence**: The `<span>` containing "Press Space to flip" with `<kbd>` elements has no responsive modifier. At 375px mobile the text is visible and advises pressing `Space`, a key that does not exist on touch-only devices. The `Tap to reveal` hint on the card front is correct for mobile, but the supplementary progress-area hint conflicts with it.
- **Impact**: Touch-only learners see an instruction they cannot follow (`Space` to flip). This creates confusion about how to interact with the card — they may attempt to find a `Space` key or assume the interface is broken.
- **Suggestion**: Hide the keyboard shortcut hint on touch viewports using `hidden sm:inline` (or a similar Tailwind responsive modifier). Alternatively, detect pointer type with a media query class: `hidden md:inline` would suppress it below tablet breakpoint. The `Tap to reveal` hint already present on the card front is the correct affordance for mobile.

```tsx
// Before: always visible
<span className="text-xs">
  Press <kbd>Space</kbd> to flip ...
</span>

// After: desktop-only
<span className="hidden sm:inline text-xs">
  Press <kbd>Space</kbd> to flip ...
</span>
```

---

### M2 — aria-live region announces full note content rather than a brief flip cue

- **Location**: `src/app/components/figma/InterleavedCard.tsx:179`
- **Evidence**: `<div aria-live="polite" className="flex-1">` wraps the full `getFullExcerpt(note.content)` output — up to 200 characters of note text. When the card flips, a screen reader will announce all 200 characters. The design spec specified: *"After flip: aria-live='polite' region announces 'Answer revealed. Rate your recall.'"*
- **Impact**: Screen reader users on VoiceOver/NVDA hear a potentially long, unannounced text wall before they understand the UI state has changed. The missing instructional context ("Rate your recall") leaves them without a cue to use the rating buttons below.
- **Suggestion**: Prepend a brief, visually hidden status message to the live region, or use a separate dedicated announcement element. The note content can remain in the live region — just add the prefix:

```tsx
<div aria-live="polite" className="flex-1">
  <span className="sr-only">Answer revealed. Rate your recall.</span>
  <p className="text-sm leading-relaxed text-foreground">
    {getFullExcerpt(note.content)}
  </p>
</div>
```

---

### M3 — AlertDialog title deviates from design spec

- **Location**: `src/app/pages/InterleavedReview.tsx:235`
- **Evidence**: The dialog renders with title "Single Course Detected". The story design guidance specifies: *"Title: 'Interleaved Review Works Best with Multiple Courses'"*. The description text is correct and matches the spec.
- **Impact**: Minor — the current title is concise and clear. However, the spec title more explicitly communicates the *recommendation* (what the user should do / aspire to), whereas "Single Course Detected" reads as a diagnostic message. For a learning platform, the motivational framing is more aligned with the learning-first design principle.
- **Suggestion**: Align the title with the spec: `"Interleaved Review Works Best with Multiple Courses"`. This may require an `sm:text-base` font-size check if the title wraps awkwardly on small dialogs, but the shadcn AlertDialog handles this gracefully.

---

### N1 — "Unknown Course" displayed in session summary badge

- **Location**: `src/app/components/figma/InterleavedSummary.tsx:67–70`, `src/app/pages/InterleavedReview.tsx:146`
- **Evidence**: During testing, the Courses Covered stat showed "1" with a badge reading "Unknown Course". This occurs because the seed/test note has a `courseId` that doesn't match any entry in `allCourses` (the static course list). The `buildCourseNameMap` function correctly merges static + imported courses, so this will resolve with real user data.
- **Impact**: This is a test data artifact, not a production bug. Real users' notes will have `courseId` values that match enrolled courses. No code change required, but worth noting for the test data setup.
- **Suggestion**: Confirm that E2E test fixtures use a `courseId` matching one of the entries in `src/data/courses.ts`, or update `buildCourseNameMap` to also surface the fallback gracefully with a different label (e.g., "Unenrolled Course") that doesn't look like a broken reference.

---

### N2 — Rating buttons border-radius is 14px instead of design-system 12px (rounded-xl)

- **Location**: `src/app/components/figma/RatingButtons.tsx:46–49` (existing component, not modified in this story)
- **Evidence**: Computed `border-radius: 14px` on rating buttons. The design system specifies `rounded-xl` (12px) for buttons.
- **Impact**: Very minor visual inconsistency. 14px vs 12px is imperceptible in normal use.
- **Suggestion**: Pre-existing issue in `RatingButtons.tsx`, not introduced by this story. Can be addressed in a future polish pass.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Pass | Dark mode: foreground `#e8e9f0` on background `#1a1b26` — high contrast. Muted text `#8a8da0` on `#1a1b26` ≈ 4.8:1 — passes AA |
| Text contrast ≥3:1 (large text) | Pass | H1 and H2 headings use full foreground colour |
| Keyboard navigation | Pass | Tab order is logical (Back button → card front → End Session). Space/Enter flip card. 1/2/3 rate after flip |
| Focus indicators visible | Pass | shadcn Button components apply `focus-visible:ring-[3px]` focus ring |
| Heading hierarchy (H1→H2→H3) | Pass | H1 "Interleaved Review" → H2 "Session Complete" / "No notes due" |
| ARIA labels on icon buttons | Pass | Back button: `aria-label="Back to review queue"`. Card front: `aria-label="Flip card to reveal answer"` |
| Rating buttons labelled | Pass | Each rating button has a descriptive `aria-label` with interval context |
| Semantic HTML | Pass | `role="button"` on card front div (necessary for interactive `div`). `role="group"` on rating buttons. `role="progressbar"` on progress |
| Progress bar ARIA | Pass | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` all present |
| aria-live flip announcement | Partial | Live region present and announces content, but lacks "Answer revealed" instructional prefix (see M2) |
| Form labels associated | N/A | No form inputs in this feature |
| prefers-reduced-motion | Pass | `MotionConfig reducedMotion="user"` on both InterleavedCard and InterleavedSummary — delegates to OS preference |
| Keyboard hint mobile appropriateness | Fail | "Press Space to flip" shown at all viewports including touch-only mobile (see M1) |
| Skip link target | Pass | `#main-content` target exists in the DOM |
| AlertDialog keyboard trap | Pass | Radix AlertDialog correctly traps focus. Return to Review Queue button has `[active]` state |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass with one caveat — no horizontal scroll, empty state correctly centred, bottom navigation touch targets at 56px. The keyboard shortcut hint (M1) is visible but the core card interaction (tap) works correctly. Main content area correctly fills 316px within the 364px content column.

- **Tablet (768px)**: Pass — no horizontal scroll, main content area 757px (correct for sidebar-collapsed state), empty state centred. The `max-w-lg` (512px) card constraint leaves comfortable margins on either side.

- **Desktop (1280px)**: Pass — persistent sidebar present, card centred at `max-w-lg` (512px), progress bar aligned to same `max-w-lg` container, `End Session` button correctly positioned in top-right of the header row. 2-column stats grid in summary renders as `223px 223px` — symmetric and correct.

---

## Code Health Observations

1. **No hardcoded hex colours**: Grep across all three new files returned zero matches. Full token compliance confirmed.

2. **Inline styles are justified and suppressed**: The four inline style properties in `InterleavedCard.tsx` (`perspective`, `transformStyle`, `backfaceVisibility`, `visibility`) and the one in `InterleavedSummary.tsx` (dynamic `width` for rating bar fill) are all cases where Tailwind v4 has no equivalent utility. The `/* eslint-disable react-best-practices/no-inline-styles */` suppression comment is correctly scoped and includes a prose explanation.

3. **Import paths use `@/` alias**: All imports in new files use `@/` — no relative `../` paths found.

4. **MotionConfig scope is correct**: `MotionConfig reducedMotion="user"` wraps the entire card component tree, not just the animation element, ensuring nested motion components also respect the preference.

5. **RatingBar `style={{ width }}` pattern**: The inline `style={{ width: \`${pct}%\` }}` in `InterleavedSummary.tsx:158` is the correct approach for dynamic percentage widths — Tailwind's JIT cannot generate arbitrary `w-[X%]` values from computed runtime numbers.

---

## Recommendations

1. **Fix M1 (keyboard hint at mobile) before next sprint**: Add `hidden sm:inline` to the keyboard shortcut `<span>` in `InterleavedReview.tsx:305`. This is a one-line change with high UX impact for mobile learners.

2. **Fix M2 (aria-live announcement) before next sprint**: Add `<span className="sr-only">Answer revealed. Rate your recall.</span>` as the first child of the `aria-live` div in `InterleavedCard.tsx:179`. This is a two-line change that significantly improves screen reader comprehension.

3. **Consider M3 (dialog title) for polish pass**: Align with spec title "Interleaved Review Works Best with Multiple Courses" to reinforce motivational framing.

4. **Verify E2E fixture courseId values**: Ensure test note fixtures in `tests/` use a `courseId` from `src/data/courses.ts` to avoid "Unknown Course" in test runs (N1).
