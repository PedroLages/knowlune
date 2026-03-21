## Design Review — E13-S06 (2026-03-21)

**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E13-S06 — Handle localStorage Quota Exceeded Gracefully
**Review Date**: 2026-03-21
**Branch**: `feature/e13-s06-handle-localstorage-quota-exceeded-gracefully`

**Changed Files Reviewed**:
- `src/app/pages/Quiz.tsx` — sessionStorage fallback in `loadSavedProgress` and `beforeunload` handler
- `src/lib/quotaResilientStorage.ts` — new Zustand `StateStorage` adapter (no UI surface)
- `src/lib/toastHelpers.ts` — new `toastWarning.storageQuota` helper
- `src/stores/useQuizStore.ts` — wired quota-resilient storage into persist middleware

**Affected Routes Tested**: `/courses/course-1/lessons/lesson-1/quiz`
**Viewports Tested**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

E13-S06 adds graceful localStorage quota handling: a quota-resilient Zustand storage adapter falls back to sessionStorage when localStorage is full, and a warning toast notifies the user. The UI surface area of this story is narrow — the primary change in `Quiz.tsx` is a two-line fallback read in `loadSavedProgress` and a guarded `beforeunload` write. The quiz page functions correctly with no visual regressions. The toast infrastructure is well-structured using established theme tokens and the Sonner component. One pre-existing React warning (`Cannot update a component while rendering`) in `QuizHeader.tsx` is noted for awareness but is out of scope for this story.

---

## What Works Well

1. **Zero visual regressions** — The quiz start screen, active quiz view, navigation, and submit dialog all render correctly at all three breakpoints. The `loadSavedProgress` fallback is purely a data-layer change with no UI side-effects.

2. **Toast copy is clear and actionable** — "Storage limit reached. Quiz progress will be saved for this session only. Try clearing browser data to fix this." explains the consequence, sets expectations, and provides a recovery action — following the design principle that error messages must be specific and actionable.

3. **Toast duration respects WCAG 2.2.1** — `TOAST_DURATION.LONG` (8 seconds) gives users adequate reading time. The Sonner `closeButton={true}` configuration means the toast is also manually dismissable, which is best practice for longer messages.

4. **Throttle prevents toast flooding** — The 30-second throttle in `quotaResilientStorage.ts` ensures the warning appears at most twice per minute even though Zustand persist fires `setItem` on every state change. Without this, a user with a full storage could see dozens of toasts during a quiz.

5. **Correct design token usage throughout** — No hardcoded hex colours, Tailwind colour utilities, or inline styles were found in any changed file. All classes use the established token system (`bg-card`, `bg-brand`, `text-muted-foreground`, `bg-destructive`, etc.).

6. **Touch targets maintained** — Navigation buttons (Previous, Next/Submit, question markers) all remain at exactly 44px height at mobile viewport. The quiz card has appropriate 24px margins on a 375px screen. No horizontal overflow was detected at any breakpoint.

7. **Responsive layout unaffected** — Mobile (375px) uses bottom nav with 80px bottom padding clearance. Tablet (768px) collapses the sidebar. Desktop (1440px) shows the persistent 72px icon sidebar. All three pass with no layout breakage.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

None.

### Nitpicks (Optional)

**1. Toast warning position relative to quiz content**

The `Toaster` component is configured with `position="bottom-right"`. On mobile (375px) the quiz navigation bar sits at the bottom of the viewport. If the quota toast fires during an active quiz session on mobile, it could overlap with the "Submit Quiz" / "Next" button area at the bottom of the content. The overlap is not a blocker (the toast is closeable and auto-dismisses) but a future improvement could consider `position="top-center"` during active quiz sessions, or ensuring the mobile nav clears the toast area.

- **Location**: `src/app/components/ui/sonner.tsx:13`
- **Impact**: Low — the quiz card scrolls, so the toast is still reachable and readable. Users can dismiss it with the close button.
- **Suggestion**: Consider a context-aware toast position or increase the mobile nav bottom padding to `88px` to guarantee toast clearance. No action required for this story.

**2. `beforeunload` fallback silently swallows sessionStorage quota exceeded**

In `Quiz.tsx` line 208-211, the `beforeunload` handler catches `localStorage.setItem` failure and falls back to `sessionStorage.setItem`, but if `sessionStorage` also throws (both storages full), the error is silently swallowed with no console warning at the call site. The outer `catch (e)` at line 214 logs a warning, but only if both the inner try and the `sessionStorage.setItem` throw together.

- **Location**: `src/app/pages/Quiz.tsx:207-215`
- **Impact**: Very low — both storages being simultaneously full during an unload event is an extreme edge case. Progress is already synced by the Zustand subscriber before `beforeunload` fires, so this is a defense-in-depth path only.
- **Suggestion**: Optionally log a `console.warn` inside the sessionStorage catch block for easier debugging. Not worth blocking the story.

---

## Pre-existing Issue (Out of Scope)

**React state-during-render warning from `QuizHeader.tsx`**

Console error: `Cannot update a component (Quiz) while rendering a different component (QuizHeader)`.

- `QuizHeader.tsx` was not modified in this branch (confirmed via `git log`)
- This is a pre-existing issue in the `syncToStore` function inside `QuizHeader`, which calls `useQuizStore.setState()` inside a `setRemainingSeconds` updater — a pattern that triggers the React warning because the state update crosses component boundaries during render
- **Not introduced by E13-S06** — this warning appears to pre-date this story

This is noted for awareness and should be addressed in a dedicated story. Recommended fix: move the `useQuizStore.setState` call into a `useEffect` dependency or use a `ref` to queue the cross-store update outside the render cycle.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Heading `rgb(232,233,240)` on card `rgb(36,37,54)` — strong contrast in dark mode. Warning token `#daa860` on dark background is an established theme pair. |
| Keyboard navigation — Skip link | Pass | "Skip to content" link is the first focusable element, correctly styled with `sr-only focus:not-sr-only`. |
| Keyboard navigation — Quiz controls | Pass | Previous, Next/Submit, question number markers all reachable via Tab. Focus ring uses compound box-shadow (`oklch(0.45 0.05 270)` with white offset) — clearly visible. |
| Focus indicators visible | Pass | Radio option containers show a 2px white offset + 4px brand ring on `focus-within`. Navigation buttons show the standard ring on focus. |
| Heading hierarchy | Pass | Single `H1` ("JavaScript Fundamentals Quiz") on the quiz page. No skipped levels. |
| ARIA labels on icon buttons | Pass | Submit button has full accessible description: "Submit Quiz — ends the quiz and shows your results". Question markers include state: "Question 2, marked for review". |
| Semantic HTML — landmarks | Pass | `main`, `nav` (×2: sidebar + quiz navigation), `header` (`role="banner"`), `complementary` (`role="complementary"` on sidebar) all present. |
| Semantic HTML — form controls | Pass | Answer options use `role="radiogroup"` + `role="radio"` pattern inside `<label>` wrappers. Mark for Review uses native `<input type="checkbox">` with `aria-labelledby`. |
| Alert dialog focus trap | Pass | On dialog open, focus moved to "Continue Reviewing" button. Escape key closes the dialog (Radix `AlertDialog` behavior). |
| ARIA live region for timer | Pass | Timer uses `aria-hidden="true"` on visual display and a separate `aria-live="polite"` `sr-only` span for minute-boundary announcements — prevents per-second screen reader noise. |
| Loading state ARIA | Pass | Loading skeleton has `role="status" aria-busy="true" aria-label="Loading quiz"`. Error state has `role="alert"`. |
| prefers-reduced-motion | Pass | Handled globally in `src/styles/index.css` and `src/styles/animations.css`. Toast animations inherit browser motion preference via Sonner. |
| No clickable divs (should be buttons) | Pass | No `div[onclick]` or `span[onclick]` patterns found in the DOM. |
| Images have alt text | Pass | All `<img>` elements have `alt` attributes. |
| Toast close button | Pass | `closeButton={true}` on Toaster ensures the warning toast can be dismissed without waiting 8 seconds. |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal overflow (`scrollWidth <= clientWidth`). Quiz card: 356px wide with 24px margins. Bottom nav present with 80px padding clearance. All nav buttons: 44px height. |
| Tablet (768px) | Pass | No horizontal overflow. Sidebar collapsed. Quiz card: 672px wide. Layout intact. |
| Desktop (1440px) | Pass | No horizontal overflow. Sidebar visible at 72px (icon-only collapsed state). Quiz card: 672px (`max-w-2xl`) centered with appropriate left offset from sidebar. 24px main padding. |

---

## Code Health Notes

- No hardcoded hex colours detected in any changed file (`#[0-9A-Fa-f]{6}` grep returned zero matches)
- No hardcoded Tailwind colour utilities (no `bg-blue-`, `text-red-`, etc. in changed files)
- No inline `style={}` attributes in Quiz.tsx UI code
- All token usage confirmed: `bg-card`, `bg-brand`, `text-brand`, `bg-destructive`, `text-destructive-foreground`, `text-muted-foreground`, `border-border`, `bg-accent`, `text-foreground`
- `toastWarning.storageQuota` correctly uses `TOAST_DURATION.LONG` (8s), consistent with other warning/error helpers in the same file
- The 30-second toast throttle is well-chosen: long enough to prevent flooding, short enough that a second occurrence (e.g., after user clears some storage) would still be announced

---

## Recommendations

1. **Address the pre-existing QuizHeader React warning** in a follow-up story. The `syncToStore` pattern inside `setRemainingSeconds` calls `useQuizStore.setState` during a React state updater function, which crosses the component update boundary. Move the store sync into a `useEffect` or a `ref`-queued callback.

2. **Consider mobile toast placement** during active quiz sessions. The bottom-right position works well on desktop but may visually conflict with the quiz navigation area on small screens. A low-effort improvement would be a CSS media query that positions the Toaster at `top-center` on viewports below 640px, or increasing the nav clearance padding.

3. **The quota resilience pattern is complete and correct** — no further follow-up needed for the storage adapter itself. The three-phase fallback strategy (localStorage → cleanup + retry → sessionStorage → error toast) is a solid implementation that handles the realistic failure modes gracefully.

---

*Review conducted via live Playwright MCP browser session against `http://localhost:5173`. All findings are evidence-based from computed styles, accessibility tree snapshots, and keyboard interaction testing.*
