# Web Design Guidelines Review: E15-S02 Configure Timer Duration and Accommodations

**Date:** 2026-03-22
**Reviewer:** Claude Opus 4.6 (automated)
**Branch:** `feature/e15-s02-configure-timer-duration-accommodations`

## Files Reviewed

| File | Status |
|------|--------|
| `src/app/components/quiz/TimerAccommodationsModal.tsx` | NEW |
| `src/app/components/quiz/QuizStartScreen.tsx` | MODIFIED |
| `src/app/components/quiz/QuizTimer.tsx` | MODIFIED |
| `src/app/components/quiz/QuizHeader.tsx` | MODIFIED |
| `src/app/pages/Quiz.tsx` | MODIFIED |

---

## Summary

Overall quality is **HIGH**. The implementation demonstrates strong accessibility awareness, proper use of design tokens, correct semantic HTML, and good responsive patterns. A few minor issues are noted below.

**Verdict: PASS** (2 MEDIUM, 3 LOW findings)

---

## Findings

### MEDIUM-1: Badge uses `text-brand` on `bg-brand-soft` (contrast risk)

**File:** `QuizStartScreen.tsx:79`
```tsx
<span className="bg-brand-soft text-brand rounded-full px-3 py-1 text-sm">
  {questionCount} {questionLabel}
</span>
```

**Issue:** The project styling rules explicitly state: "Use `text-brand-soft-foreground` (not `text-brand`) on `bg-brand-soft` backgrounds" because `text-brand` (`#5e6ad2`) on `bg-brand-soft` (`#d0d2ee`) fails WCAG AA 4.5:1 contrast in dark mode. The time badge on line 85 correctly uses `text-brand-soft-foreground`, but the question-count badge on line 79 uses `text-brand`.

**Fix:** Change `text-brand` to `text-brand-soft-foreground` on line 79.

---

### MEDIUM-2: RadioGroup labels lack explicit `htmlFor`/`id` pairing

**File:** `TimerAccommodationsModal.tsx:87-101`

The `<label>` wraps the `<RadioGroupItem>`, which is valid HTML association. However, the Radix `RadioGroupItem` renders a `<button role="radio">` internally, not an `<input>`. Wrapping a `<button>` in a `<label>` does not create an implicit association in all screen readers. Some assistive technologies (JAWS, older NVDA) may not announce the label text when the radio button receives focus.

**Mitigation:** The `RadioGroup` already has `aria-label="Timer accommodation"`, and each option's visible text is adjacent. This is functional but not ideal.

**Recommended fix:** Add an `id` to each `RadioGroupItem` and use `aria-labelledby` or verify Radix's built-in labeling is sufficient for the target screen readers. Alternatively, test with VoiceOver to confirm the label association works.

---

### LOW-1: Missing `annotation` dependency in QuizTimer useEffect

**File:** `QuizTimer.tsx:55`
```tsx
}, [timeRemaining, totalTime])
```

The `annotation` variable is referenced inside the effect (line 46) but is not listed in the dependency array. This is a React hooks exhaustive-deps violation. If `annotation` changes (e.g., user modifies accommodation mid-quiz), the stale closure would use the old value for the 25% threshold announcement.

**Impact:** Low — accommodation changes mid-quiz are unlikely, and the visual display is correct regardless. But the screen reader announcement could reference stale data.

**Fix:** Add `annotation` to the dependency array.

---

### LOW-2: Save button in modal has no Cancel/Close affordance beyond the X

**File:** `TimerAccommodationsModal.tsx:111-113`

The modal has a single "Save" button and relies on the Dialog's built-in close button (X icon) or Escape key for cancellation. While this is functionally correct (Radix Dialog handles Escape and overlay click), an explicit "Cancel" button would be clearer for users who may not notice the X or know about Escape.

**Impact:** Low — Radix Dialog provides Escape, overlay-click-to-close, and the X button. Focus trap is handled by Radix.

---

### LOW-3: `role="group"` on metadata badges div should have `role="list"`

**File:** `QuizStartScreen.tsx:78`
```tsx
<div className="flex flex-wrap gap-2 mt-6" aria-label="Quiz details" role="group">
```

A `role="group"` is semantically correct for grouping related elements. However, `role="list"` with `role="listitem"` on each badge would give screen readers a count ("Quiz details, list, 3 items") which is more informative. This is a minor enhancement, not a violation.

---

## Accessibility Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Semantic HTML | PASS | `<h1>`, `<p>`, `<label>`, proper Dialog/AlertDialog usage |
| Keyboard navigation | PASS | Radix Dialog/RadioGroup provide full keyboard support (Tab, Arrow keys, Escape) |
| Focus management | PASS | Deferred focus on resume button (line 63-67), auto-focus after answer selection |
| Focus trapping in modals | PASS | Radix Dialog handles focus trap automatically |
| ARIA roles | PASS | `role="timer"`, `role="status"`, `role="alert"`, `aria-live="polite"`, `aria-busy` |
| Screen reader announcements | PASS | Live region for timer (minute boundaries + threshold crossings), sr-only resume announcement |
| Color contrast | MEDIUM | One badge uses `text-brand` on `bg-brand-soft` (see MEDIUM-1) |
| Touch targets | PASS | Buttons use `h-12` (48px), radio labels use `min-h-12`, link uses `min-h-[44px]` |
| Reduced motion | PASS | `transition-colors duration-200/300` is subtle; no distracting animations |

## Design Token Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| No hardcoded colors | PASS | All colors use design tokens (`text-muted-foreground`, `bg-brand-soft`, `text-destructive`, etc.) |
| Brand button variant | PASS | Uses `variant="brand"` on `<Button>`, never manual `bg-brand` overrides |
| Border tokens | PASS | `border-border`, `border-brand` |
| Card backgrounds | PASS | `bg-card` consistently used |
| Destructive actions | PASS | Uses `bg-destructive text-destructive-foreground` |

## Responsive Design

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (<640px) | PASS | `p-4`, `w-full` buttons, `flex-col` CTA layout, `text-sm` timer |
| Tablet/Desktop (>=640px) | PASS | `sm:p-8`, `sm:w-auto` buttons, `sm:flex-row` CTA layout, `sm:text-base` timer |
| Modal responsiveness | PASS | `sm:max-w-md` on Dialog, default full-width with 1rem margin |

## Component Architecture

| Aspect | Status | Notes |
|--------|--------|-------|
| Separation of concerns | PASS | Modal is a standalone component with clear props interface |
| State management | PASS | Local state synced on open via useEffect; accommodation persisted to localStorage |
| Error handling | PASS | Zod validation on loaded data, graceful fallback to 'standard' |
| Type safety | PASS | `TimerAccommodation` union type, Zod schema validation |

---

## Positive Highlights

1. **Excellent timer accessibility**: The `role="timer"` with `aria-label`, combined with a separate `aria-live="polite"` region that announces at minute boundaries and threshold crossings (25%, 10%), is a well-thought-out pattern that avoids overwhelming screen readers while keeping users informed.

2. **Proper modal state reset**: The `useEffect` that syncs `selected` state when `open` changes prevents stale selections from persisting across modal open/close cycles.

3. **Deferred focus pattern**: Using `requestAnimationFrame` for focus management gives assistive technology time to process DOM changes before focus moves.

4. **Graceful storage handling**: The accommodation persistence uses try/catch with silent fallback, preventing storage errors from breaking the UI.

5. **Proper guard against race conditions**: The `isSubmittingRef` guard prevents concurrent submit calls from timer expiry and manual submission.
