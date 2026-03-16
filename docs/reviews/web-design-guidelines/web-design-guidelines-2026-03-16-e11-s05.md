# Web Design Guidelines Review: E11-S05 Interleaved Review Mode

**Date:** 2026-03-16
**Story:** E11-S05 — Interleaved Review Mode
**Reviewer:** Claude (automated)
**Files Reviewed:**
- `src/app/pages/InterleavedReview.tsx`
- `src/app/components/figma/InterleavedCard.tsx`
- `src/app/components/figma/InterleavedSummary.tsx`
- `src/app/components/figma/RatingButtons.tsx` (dependency)

---

## Summary

Overall the implementation is solid with good accessibility foundations (ARIA labels, keyboard shortcuts, reduced-motion support, live regions). The main issues are around semantic HTML landmarks, focus management after card transitions, and a few accessibility gaps in the summary view. No BLOCKERs found.

**Findings by severity:**
| Severity | Count |
|----------|-------|
| BLOCKER  | 0     |
| HIGH     | 3     |
| MEDIUM   | 5     |
| LOW      | 5     |

---

## 1. Semantic HTML

### 1.1 Missing landmark elements on page-level wrapper
**Severity:** MEDIUM
**File:** `InterleavedReview.tsx`
**Lines:** 208, 230, 256, 280

The top-level `<div>` for each phase should be a `<main>` element (or use `role="main"`) since this is the primary content area of the page. Currently all phases render bare `<div>` wrappers, which means screen readers have no landmark to navigate to.

**Recommendation:** Replace the outermost `<div data-testid="interleaved-review">` with `<main data-testid="interleaved-review">` in all phase renders. Note: if the `Layout.tsx` already wraps the outlet in `<main>`, use `<section aria-labelledby="...">` instead to avoid duplicate landmarks.

### 1.2 PageHeader heading level is correct
**Severity:** PASS
**File:** `InterleavedReview.tsx:357`

The `<h1>` for "Interleaved Review" is appropriate as the page title. The summary uses `<h2>` (line 40 of InterleavedSummary.tsx), which correctly reflects the hierarchy.

### 1.3 Front face uses role="button" appropriately
**Severity:** PASS
**File:** `InterleavedCard.tsx:98`

The front face of the card uses `role="button"` with `tabIndex` and keyboard handlers, which is correct for a clickable div.

---

## 2. Accessibility

### 2.1 No focus management when card advances to next note
**Severity:** HIGH
**File:** `InterleavedReview.tsx:150-156`

After rating a card, focus is moved to `[data-testid="interleaved-card-front"]` via `requestAnimationFrame`. However, this targets the front face element which is inside a `motion.div` that is mid-animation (rotateY transitioning from 180 to 0). Depending on timing, the focus may land on an element that is still `aria-hidden="true"` or has `visibility: hidden`, causing the focus to silently fail.

**Recommendation:** Use a more robust focus strategy: wait for the flip animation to complete (use motion's `onAnimationComplete` callback) before focusing, or focus a stable parent container and use `aria-live` to announce the new card content.

### 2.2 Back face content not announced to screen readers on flip
**Severity:** HIGH
**File:** `InterleavedCard.tsx:179`

The back face has `aria-live="polite"` on the content paragraph, which is good. However, the entire back face starts as `aria-hidden="true"` and `visibility: hidden`. When flipped, `aria-hidden` changes to `false`, but the `aria-live` region was already in the DOM when hidden. Some screen readers may not announce content that was present before the live region became visible.

**Recommendation:** Either (a) conditionally render the back face content only when `isFlipped` is true so the live region insertion triggers the announcement, or (b) move the `aria-live="polite"` to a wrapper that is always visible and inject the content text into it upon flip.

### 2.3 Keyboard shortcut hints not accessible to screen readers
**Severity:** MEDIUM
**File:** `InterleavedReview.tsx:305-325`

The keyboard hints ("Press Space to flip, 1 2 3 to rate") use `<kbd>` elements which is semantically correct. However, this hint area has no `aria-label` and is presented as visual-only helper text. Screen reader users will hear "Press Space to flip" naturally, so this is acceptable, but the `<kbd>` elements at `text-[10px]` may be hard to read at that size for low-vision users.

**Recommendation:** Increase `<kbd>` font size to at least `text-xs` (12px) for better readability.

### 2.4 Retention badge uses color alone for status indication
**Severity:** MEDIUM
**File:** `InterleavedCard.tsx:166-175`

The retention badge shows a percentage with color coding (destructive < 50%, warning < 80%, success >= 80%). It does have `aria-label="Predicted retention: ${retention}%"` which conveys the value. However, sighted users who cannot distinguish colors have no secondary indicator (icon, text label like "Low"/"High") to differentiate retention levels.

**Recommendation:** Add a text label or icon alongside the percentage to indicate the retention level (e.g., "72% Fair" or a warning icon for low retention).

### 2.5 Alert dialog auto-opens without focus trap verification
**Severity:** LOW
**File:** `InterleavedReview.tsx:232`

The `AlertDialog` with `open` prop is used for the single-course prompt. Radix UI's AlertDialog should handle focus trapping automatically. This appears correct. Verified: Radix AlertDialog manages focus trap, initial focus, and return focus on close.

**Severity reclassified:** PASS

---

## 3. Responsive Design

### 3.1 Card max-width constrains well on all breakpoints
**Severity:** PASS

The card uses `max-w-lg` (32rem / 512px) with `w-full`, which works well across all breakpoints. The `min-h-[280px]` ensures consistent card height.

### 3.2 Summary grid may be cramped on narrow screens
**Severity:** MEDIUM
**File:** `InterleavedSummary.tsx:45`

The stats grid uses `grid-cols-2` with no responsive breakpoint. On very narrow screens (< 320px), the two-column layout with `p-4` padding may cause content overflow, especially the course name badges inside "Courses Covered".

**Recommendation:** Consider `grid-cols-1 sm:grid-cols-2` to stack on the smallest screens, or verify with testing that the badges wrap correctly at 320px.

### 3.3 No horizontal overflow risks detected
**Severity:** PASS

All containers use `max-w-lg`, `min-w-0`, and `truncate` where appropriate. The `flex-wrap` on course name badges in the summary prevents overflow.

---

## 4. Performance

### 4.1 Animation uses transform only (GPU-accelerated)
**Severity:** PASS
**File:** `InterleavedCard.tsx:90`

The card flip animation uses `rotateY` (a transform property), which is GPU-composited and does not trigger layout or paint. The transition easing `[0.16, 1, 0.3, 1]` is a smooth ease-out curve.

### 4.2 Skeleton loading prevents layout shifts
**Severity:** PASS
**File:** `InterleavedReview.tsx:199-200`

The loading state uses `Skeleton` components with explicit dimensions matching the card (`h-[280px] w-full max-w-lg`), preventing CLS when content loads.

### 4.3 RatingBar inline style for width
**Severity:** LOW
**File:** `InterleavedSummary.tsx:158`

The `RatingBar` component uses `style={{ width: \`${pct}%\` }}` for dynamic bar width. This is acceptable for dynamic values, but each render will trigger a style recalculation. For the small number of bars (3), this is negligible.

---

## 5. Progressive Enhancement

### 5.1 Reduced motion support is excellent
**Severity:** PASS
**Files:** `InterleavedCard.tsx:84`, `InterleavedSummary.tsx:25`

Both components wrap animations in `<MotionConfig reducedMotion="user">`, which respects `prefers-reduced-motion` at the OS level. The `RatingButtons` component also uses `motion-safe:hover:scale-[1.02]` (Tailwind's motion-safe variant). This is best-practice implementation.

### 5.2 Card is functional without animations
**Severity:** PASS

The card flip uses `visibility: hidden/visible` as a fallback alongside the 3D transform. Even if animations are disabled, the content switches correctly between front and back faces.

---

## 6. Color and Contrast

### 6.1 Design tokens used correctly throughout
**Severity:** PASS

All colors use design tokens (`text-muted-foreground`, `bg-brand-soft`, `text-destructive`, `text-success`, `text-warning`, `bg-muted`, `text-foreground`). No hardcoded color values detected.

### 6.2 Retention percentage relies on color to convey meaning
**Severity:** MEDIUM (duplicate of 2.4)

See finding 2.4. The retention badge uses color-coded text without a secondary non-color indicator.

### 6.3 10px font sizes may have contrast issues
**Severity:** LOW
**Files:** `InterleavedReview.tsx:307,314-318`, `InterleavedSummary.tsx:68,113,161`

Multiple elements use `text-[10px]` which is 10px — below the WCAG threshold for "large text" (18px or 14px bold). At this size, the required contrast ratio is 4.5:1. The `text-muted-foreground` token should meet this against the background, but the small size itself is a readability concern for low-vision users.

**Recommendation:** Use `text-xs` (12px) as the minimum font size for better readability. Reserve 10px only for truly supplementary decorative text.

---

## 7. Touch Targets

### 7.1 Rating buttons meet minimum size
**Severity:** PASS
**File:** `RatingButtons.tsx:41`

Rating buttons use `size="default"` (36px height in shadcn) with `flex-1` for width. In a `max-w-lg` container with 3 buttons, each button is approximately 160px wide. The height of 36px is slightly below the 44px recommendation, but with the outline border and padding the effective touch target is adequate.

### 7.2 Rating button height is 36px, below 44px recommendation
**Severity:** LOW
**File:** `RatingButtons.tsx:41`

The default shadcn button height is `h-9` (36px). While the tap area is expanded by padding and margin, the actual interactive element is 36px tall.

**Recommendation:** Consider using `size="lg"` (44px) for rating buttons on mobile, or add `min-h-[44px]` to ensure the touch target meets WCAG 2.5.5 (AAA) / 2.5.8 guidelines.

### 7.3 Back button meets minimum size
**Severity:** PASS
**File:** `InterleavedReview.tsx:350`

The back button uses `size="icon"` which renders at 36x36px with adequate padding. Combined with the ghost variant's extended hit area, this is acceptable.

---

## 8. Typography

### 8.1 Heading hierarchy is correct
**Severity:** PASS

- `<h1>` "Interleaved Review" in `PageHeader`
- `<h2>` "Session Complete" in `InterleavedSummary`
- No heading level skips detected

### 8.2 Line heights are appropriate
**Severity:** PASS

Content text uses `leading-relaxed` (1.625 line-height), which provides comfortable readability. The prompt excerpt uses `text-lg font-medium leading-relaxed` for emphasis.

### 8.3 Line lengths are controlled
**Severity:** PASS

The `max-w-lg` constraint keeps line lengths to approximately 65-70 characters, which is within the recommended 45-75 character range.

---

## 9. State Management

### 9.1 All states are handled
**Severity:** PASS
**File:** `InterleavedReview.tsx:35`

The `SessionPhase` type covers: `loading`, `single-course-prompt`, `reviewing`, `summary`, `empty`. Each phase has a dedicated render path. This is comprehensive.

### 9.2 Loading state uses aria-busy
**Severity:** PASS
**File:** `InterleavedReview.tsx:198`

The loading skeleton wrapper includes `aria-busy="true"` and `aria-label="Loading interleaved review"`.

### 9.3 Error state is missing
**Severity:** HIGH
**File:** `InterleavedReview.tsx:86-88`

The data loading `Promise.all` has a `.catch(console.error)` but no error state in the UI. If `loadReviews()`, `loadNotes()`, or `loadImportedCourses()` fails, the component will remain in the `loading` phase indefinitely (the `DelayedFallback` skeleton will display forever).

**Recommendation:** Add an `'error'` phase to `SessionPhase` and set it in the catch handler. Display a user-friendly error message with a retry action:
```tsx
type SessionPhase = 'loading' | 'error' | 'single-course-prompt' | 'reviewing' | 'summary' | 'empty'
```

---

## 10. Internationalization Readiness

### 10.1 Hardcoded strings are in JSX only
**Severity:** PASS

All user-facing strings are in JSX templates, not embedded in component logic or utility functions. The string patterns ("Tap to reveal", "Session Complete", "Notes Reviewed", etc.) are all in render functions, making them straightforward to extract for i18n.

### 10.2 Number formatting not locale-aware
**Severity:** LOW
**File:** `InterleavedSummary.tsx:53,64,105,109`

Numbers like `summary.totalReviewed`, `summary.coursesCount`, and percentages are rendered directly without `Intl.NumberFormat`. For small numbers this is fine, but percentages may need locale-specific formatting (e.g., comma vs period decimal separator).

**Recommendation:** When i18n is implemented, use `Intl.NumberFormat` for all numeric displays.

---

## Findings Summary

| # | Finding | Severity | File | Status |
|---|---------|----------|------|--------|
| 1.1 | Missing `<main>` landmark on page wrapper | MEDIUM | InterleavedReview.tsx | Open |
| 2.1 | Focus management unreliable during card flip animation | HIGH | InterleavedReview.tsx | Open |
| 2.2 | Back face `aria-live` region may not announce on flip | HIGH | InterleavedCard.tsx | Open |
| 2.3 | Keyboard hint `<kbd>` elements at 10px too small | MEDIUM | InterleavedReview.tsx | Open |
| 2.4 | Retention badge relies on color alone | MEDIUM | InterleavedCard.tsx | Open |
| 3.2 | Summary 2-col grid may cramp at < 320px | MEDIUM | InterleavedSummary.tsx | Open |
| 6.3 | Multiple 10px font sizes below readability threshold | LOW | Multiple files | Open |
| 7.2 | Rating button height 36px below 44px touch target | LOW | RatingButtons.tsx | Open |
| 9.3 | No error state for failed data loading | HIGH | InterleavedReview.tsx | Open |
| 10.2 | Numbers not locale-formatted | LOW | InterleavedSummary.tsx | Open |
| 4.3 | RatingBar inline style (negligible perf) | LOW | InterleavedSummary.tsx | Open |

---

## Recommended Priority

1. **Fix first (HIGH):** Error state for data loading (9.3) — silent infinite loading is a broken user experience
2. **Fix first (HIGH):** Focus management after card advance (2.1) — keyboard users may lose their place
3. **Fix first (HIGH):** aria-live announcement on flip (2.2) — screen reader users miss the answer reveal
4. **Address soon (MEDIUM):** Add `<main>` landmark (1.1)
5. **Address soon (MEDIUM):** Retention badge non-color indicator (2.4)
6. **Address soon (MEDIUM):** Keyboard hint font size (2.3)
7. **Address soon (MEDIUM):** Summary grid responsive breakpoint (3.2)
8. **Backlog (LOW):** Touch target sizes, font sizes, locale formatting
