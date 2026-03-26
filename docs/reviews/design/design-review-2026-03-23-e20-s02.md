# Design Review — E20-S02: Flashcard System with Spaced Repetition

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story Branch**: `feature/e20-s02-flashcard-system-spaced-repetition`
**Changed UI Files**:
- `src/app/pages/Flashcards.tsx` (551 lines, new)
- `src/app/components/figma/FlashcardReviewCard.tsx` (new)
- `src/app/components/figma/RatingButtons.tsx` (new)
- `src/app/components/notes/BubbleMenuBar.tsx` (modified — added Create Flashcard button)
- `src/app/components/notes/CreateFlashcardDialog.tsx` (new)
- `src/app/components/Layout.tsx` (modified — sidebar nav entry)

**Affected Routes Tested**: `/flashcards`, `/notes`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1280px (desktop)
**Theme Tested**: Dark mode (active in browser session), light mode code verified via tokens

---

## Executive Summary

The flashcard system is a well-crafted addition to the platform. The implementation is clean and thoughtful: it uses design tokens throughout, respects `prefers-reduced-motion` via `MotionConfig`, provides an ARIA live region for screen reader announcements during card flip, and achieves excellent keyboard accessibility in the review flow. Two medium-priority layout issues exist (stat cards on mobile, ghost button touch targets in review mode), and one nitpick around cross-platform keyboard shortcut labeling. No blockers.

---

## What Works Well

1. **Exemplary keyboard accessibility in review flow** — The flip card uses `role="button"` with a clear `aria-label`, a visible 2px solid focus ring in brand color, and supports Space/Enter for flipping and 1/2/3 for rating. This is textbook accessible rich interaction.

2. **ARIA live region on card flip** — `<span aria-live="polite">Answer revealed. Rate your recall.</span>` announces the state change to screen readers without visual disruption. This is exactly the right pattern for dynamic content.

3. **Design token discipline** — All new files use `bg-brand-soft`, `text-brand-soft-foreground`, `bg-success-soft`, `text-success`, `bg-muted/50`, `text-muted-foreground` throughout. Zero hardcoded Tailwind color classes. The ESLint `design-tokens/no-hardcoded-colors` rule would pass clean.

4. **Reduced motion support** — All three animated components (`Flashcards.tsx` dashboard and summary phases, `FlashcardReviewCard.tsx`) wrap with `<MotionConfig reducedMotion="user">`, correctly delegating to the user's OS preference.

5. **Inline styles are justified** — The three 3D CSS properties (`perspective`, `transformStyle`, `backfaceVisibility`) in `FlashcardReviewCard.tsx` have no Tailwind equivalents. The eslint-disable comment is scoped precisely, and a code comment explains the reason. The `RatingBar` dynamic `width` is likewise correct.

6. **Session summary card** — Uses `rounded-[24px]` (matching the card design token), shows all three AC-required fields (total reviewed, next review date, rating distribution), and both action buttons meet the 44px touch target minimum.

7. **Zero console errors** — Throughout all testing phases across all three viewports.

---

## Findings by Severity

### Blockers
None.

### High Priority

**H1 — Ghost buttons in review header below 44px touch target on mobile**

- **Location**: `src/app/pages/Flashcards.tsx:360–368` (the `← Back` and `End Session` buttons in the review phase header)
- **Evidence**: Measured at 375px viewport — both buttons are 32px tall (`size="sm"` renders `h-8`)
- **Impact**: The 44px minimum touch target is a WCAG 2.5.8 requirement (AA in WCAG 2.2). Users with motor impairments relying on touch will struggle to tap these during an active review session, when they most need reliable control to exit or navigate.
- **Suggestion**: Use `size="default"` (44px) instead of `size="sm"` (32px) for these buttons on mobile, or add `min-h-[44px]` via responsive class. Alternatively, consider a bottom sheet or different layout for the review header controls on small screens.

### Medium Priority

**M1 — 3-column stats grid stays 3 columns at 375px, producing 82px cards**

- **Location**: `src/app/pages/Flashcards.tsx:270`, `Flashcards.tsx:497–516` (StatCard component)
- **Evidence**: At 375px viewport, `gridCols: "82.3px 82.3px 82.3px"`. The "Next Review" value "In 2 days" renders as a 9-character string at `text-2xl` font-size inside an 80px content area. It will wrap or clip.
- **Impact**: The most informative stat card — "Next Review" — shows a multi-word value that won't fit cleanly at 24px size inside 80px. Learners glancing at their stats on mobile may not be able to read the next review date without it wrapping awkwardly.
- **Suggestion**: Switch the grid to `grid-cols-2 sm:grid-cols-3` (2-column on mobile, 3-column from 640px up), or reduce the stat value font size to `text-xl` on mobile using `text-xl sm:text-2xl`.

**M2 — Rating button tinted backgrounds are near-invisible in dark mode**

- **Location**: `src/app/components/figma/RatingButtons.tsx:14–28`
- **Evidence**: Computed `backgroundColor: "oklab(0.999994 ... / 0.0176471)"` — approximately 1.76% opacity. The `bg-destructive/10`, `bg-brand-soft`, and `bg-success-soft` tokens produce near-transparent fills against the dark card background `rgb(36, 37, 54)`. The border color is similarly near-invisible at `rgba(255,255,255,0.06)`.
- **Impact**: The visual distinction between Hard (red-tinted), Good (blue-tinted), and Easy (green-tinted) rating buttons — which is the primary UX affordance communicating rating severity — is lost in dark mode. Users can still read the button labels and see the text color differences, but the color-coded background reinforcement is absent.
- **Suggestion**: The `bg-brand-soft` token works correctly for Good because it's designed for dark mode. For Hard and Easy, consider using `bg-destructive/20` (higher opacity) and `bg-success/20` respectively, or switch to a solid token approach. Test both themes before finalizing. Note that color alone should not be the sole indicator (the labels "Hard", "Good", "Easy" remain legible), so this is medium not high priority.

### Nitpicks

**N1 — "← Back" uses a Unicode arrow character instead of a Lucide icon**

- **Location**: `src/app/pages/Flashcards.tsx:360`
- **Evidence**: Button renders `← Back` using the Unicode left arrow `←` as a raw text character.
- **Impact**: Minor visual inconsistency — the rest of the app uses Lucide icons exclusively. A screen reader will announce "left-pointing arrow Back" depending on the browser, which is redundant.
- **Suggestion**: Replace with `<ArrowLeft className="size-4" />` from lucide-react with an `aria-hidden="true"` attribute, matching the pattern used by `ChevronRight` on the Start Review button.

**N2 — `⌘↵` keyboard hint is Mac-only in CreateFlashcardDialog**

- **Location**: `src/app/components/notes/CreateFlashcardDialog.tsx:73`
- **Evidence**: `DialogDescription` text reads "Press ⌘↵ to save." but the handler at line 56 correctly supports `e.metaKey || e.ctrlKey` for both Mac and Windows/Linux.
- **Impact**: Windows and Linux users pressing `Ctrl+Enter` will see a hint that says `⌘↵` — technically incorrect but functionally working. Minor cognitive friction.
- **Suggestion**: Use a platform-aware hint: `Press {isMac ? '⌘' : 'Ctrl'}+↵ to save`, or use the more universal "Cmd/Ctrl+↵ to save".

**N3 — "Due Today" stat card contrast is marginal in dark mode**

- **Location**: `src/app/pages/Flashcards.tsx:506–510` (StatCard with `highlight` prop)
- **Evidence**: Contrast ratio computed at 4.65:1 — just above the 4.5:1 WCAG AA minimum. The `text-brand-soft-foreground` on `bg-brand-soft` in dark mode produces this narrow margin.
- **Impact**: Just passing, but any slight theme variation or display calibration could push it below threshold. Low risk but worth noting.
- **Suggestion**: This is a design token issue. If the `--brand-soft-foreground` token can be slightly lightened in dark mode without breaking the light mode contrast, that would add margin. Not urgent.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Pass | Body text 12.45:1; "Due Today" highlight 4.65:1 (marginal but passing) |
| Text contrast ≥3:1 (large text) | Pass | All heading text well above threshold |
| Keyboard navigation — dashboard | Pass | Tab reaches Start Review button; skip link works |
| Keyboard navigation — review (Space to flip) | Pass | Space key flips card when front is focused |
| Keyboard navigation — review (1/2/3 to rate) | Pass | Number keys trigger rating from any focus position |
| Focus indicators visible | Pass | Flip card: 2px solid brand-color outline. Buttons: 3px box-shadow ring |
| ARIA live region on card flip | Pass | `aria-live="polite"` announces "Answer revealed. Rate your recall." |
| Heading hierarchy | Pass | H1 "Flashcards" → H2 "Upcoming Reviews" — logical and correct |
| `main` landmark with skip link target | Pass | `id="main-content"` matches skip link `href="#main-content"` |
| ARIA labels on icon-only buttons | Pass | Flip card: `aria-label="Flip card to reveal answer"`. Rating buttons: descriptive `aria-label` per button |
| Role on interactive div | Pass | Flip card `div` has `role="button"` and `tabIndex={0}` |
| `aria-hidden` on non-active card face | Pass | `aria-hidden={isFlipped}` on front, `aria-hidden={!isFlipped}` on back |
| Semantic HTML in dialog | Pass | Dialog uses `DialogTitle`, `DialogDescription`, `Label` + `htmlFor` associations |
| `prefers-reduced-motion` respected | Pass | All animated components use `<MotionConfig reducedMotion="user">` |
| Touch targets ≥44px (mobile) | Partial | Rating buttons: 44px (pass). Review header Back/End Session: 32px (fail — H1) |
| No horizontal scroll (mobile 375px) | Pass | `scrollWidth === clientWidth` verified |
| Bottom nav does not obscure rating buttons | Pass | Rating group ends at 489px; bottom nav starts at 755px |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1280px) | Pass | Dashboard, review, and summary all render correctly. 3-column stat grid is comfortable at 197px per card. |
| Tablet (768px) | Pass | Sidebar collapses to hamburger correctly. No horizontal scroll. Content width 672px, stat cards 197px each. |
| Mobile (375px) | Partial | No horizontal scroll. Bottom nav present with labels. Rating buttons accessible (44px, not obscured). Stats grid at 82px per card produces tight layout for multi-word "Next Review" value. Back/End Session buttons are 32px tall (below 44px minimum). |

---

## AC Coverage Verification (UI-relevant only)

| AC | Status | Evidence |
|----|--------|---------|
| AC1: Create Flashcard dialog opens pre-filled with selected text | Pass (code) | `openFlashcardDialog` reads `editor.state.doc.textBetween(from, to)` and passes to `defaultFront`. Dialog syncs on open via `useEffect`. Not browser-testable without seeded note. |
| AC2: Flashcards page shows review queue with cards due today | Pass | "Start Review" button appears with count. Review session correctly queues due cards. |
| AC3: Hard/Good/Easy rating buttons during review | Pass | Rating buttons visible after flip, correct ARIA labels, keyboard shortcuts 1/2/3 work, each advances to next card. |
| AC4: Completion message with stats when no cards remain | Pass | "Session Complete" card renders with `totalReviewed`, `nextReviewDate`, rating distribution bars. Both action buttons functional. |
| AC6: Stats section showing total cards, due today, upcoming schedule | Pass | StatCard grid shows Total/Due Today/Next Review. Upcoming Reviews card shows per-day breakdown for next 7 days. |

---

## Recommendations

1. **Fix the review header touch targets (H1)** — Change `size="sm"` to `size="default"` on the Back and End Session buttons in the reviewing phase. This is a one-line change per button and directly impacts motor-accessibility for touch users.

2. **Add mobile breakpoint to stats grid (M1)** — Add `grid-cols-2 sm:grid-cols-3` to the stats grid container. Consider also switching `Next Review` stat value to `text-xl sm:text-2xl`. This prevents layout degradation on the most common screen size.

3. **Increase rating button opacity in dark mode (M2)** — The tinted background affordance disappears in dark mode. Try `bg-destructive/20 dark:bg-destructive/15` and `bg-success/20 dark:bg-success/15` to restore the visual differentiation. The text color distinction still exists as a non-color backup, so this is a polish improvement.

4. **Replace `←` with Lucide `ArrowLeft` (N1)** — Small consistency fix that also resolves potential screen reader verbosity. Import is already available throughout the codebase.

