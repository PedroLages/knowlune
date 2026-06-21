# Design Review Report

**Review Date**: 2026-06-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E68-S01 — Model Download Progress UI
**Changed Files**: 21 files (2878 insertions, 406 deletions)
**Affected Pages**: None (non-route UI — Sonner global toast system)

## Executive Summary

Story E68-S01 introduces an EmbeddingModelProgressToast component that monitors AI model download progress and surfaces it as a Sonner toast. The core implementation is solid: the progress bar renders with correct ARIA attributes, dark mode contrast passes WCAG AA, axe-core reports zero violations, and there is no horizontal scroll at any breakpoint. However, a significant interaction bug affects the indeterminate-to-determinate transition path (AC4 edge case): when `total=0` triggers a loading toast that later transitions to actual progress, the Skip button, Close button, and progress bar all disappear, leaving the user with an undismissable toast.

## Findings by Severity

### Blockers

None. All WCAG AA contrast ratios pass, keyboard navigation works on the primary flow, and no layouts break.

### High Priority (Should fix before merge)

1. **Skip button lost on indeterminate-to-determinate toast transition** (affects AC2 + AC4)
2. **Close button and progress bar also lost in the same transition path**

### Medium Priority (Fix when possible)

3. **Worker crash error toast retains "Skip" action button from progress toast**

### Low Priority

4. **Individual toasts lack explicit `role="status"`**

### Nitpicks

5. **Debounce opacity: progress value can appear stale during rapid updates** (documented tradeoff)

## What Works Well

1. **Progress bar accessibility**: The Radix Progress primitive renders with full ARIA — `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label="60% complete"`. Tested at 25%, 30%, 50%, 60%, and 72%.

2. **Dark mode contrast passes**: All text elements pass WCAG AA across both modes:
   - Dark mode: primary text (9.6:1), muted description text (5.1:1)
   - Light mode: primary text (13.5:1), muted description text (passes AA)

3. **axe-core scan**: 0 violations, 29 passes — the page has no structural accessibility issues.

4. **Responsive layout**: No horizontal scroll at any breakpoint (375px, 768px, 1024px, 1440px). The toast system uses Sonner's positioned overlay, which handles viewport changes correctly.

5. **Debounce works correctly**: Rapid progress updates within the 500ms window are properly coalesced, preventing visual thrashing.

6. **Skip button works on primary path**: Direct determinate progress toasts have a functional Skip button that dismisses the toast on click.

7. **Completion flow is clean**: Progress toast is replaced with a "AI search ready!" success toast confirming the model is loaded.

8. **Error handling**: Worker crash events trigger an immediate error toast with descriptive messaging. The stall timeout (120s) provides fallback error handling for mid-download hangs.

## Detailed Findings

### Finding 1: HIGH — Indeterminate-to-determinate transition breaks toast interactivity

**Issue**: When the download starts in indeterminate state (`total=0`, per AC4/EC5), a `toast.loading()` call creates a loading spinner toast. When progress later becomes determinate, the component calls `toast('Downloading AI Model', { id: toastIdRef.current, description: buildDescription(progress) })` to update the existing toast. This Sonner update call:

1. Does NOT include the `action: { label: 'Skip', ... }` option — the Skip button is lost
2. Does NOT make the Close button appear — `toast.loading()` creates a structurally different toast that ignores the global `closeButton={true}` config
3. Does NOT render the updated description with progress bar — the loading spinner persists, showing only "Downloading AI model..." without a percentage or progress bar

**Evidence** (Playwright test):
- Direct determinate progress at 30%: `buttonCount: 2` (Close toast + Skip), progress bar present
- Indeterminate at -1% then determinate at 50%: `buttons: []`, `dataType: "loading"`, `hasProgress: false`, text shows stale "Downloading AI model..." without percentage

**Location**: `src/app/components/embeddings/EmbeddingModelProgressToast.tsx:112-186` (the useEffect that handles progress updates)

**Impact on learners**:
- AC4 documents `total=0` as a known edge case for Transformers.js
- If a learner encounters this path, they cannot dismiss, skip, or even see progress — the toast becomes a persistent, unresponsive UI element
- Keyboard-only users are most affected (no buttons available to focus)

**Suggestion**: There are two viable approaches:

A. **(Recommended) Use `toast()` for all states with a custom icon**: Replace `toast.loading()` with a regular `toast()` call that includes the action button. For the indeterminate state, a `toast()` with a custom indeterminate icon/spinner via `icon:` option keeps the Skip button present from the start.

B. **Recreate toast on transition**: When transitioning from indeterminate to determinate, call `toast.dismiss(toastIdRef.current)` followed by a fresh `toast(...)` call. This creates a new toast with the correct structure. The brief dismiss/reappear flash is acceptable for edge-case transitions.

**autofix_class**: `manual` — requires design decision on which Sonner API pattern to use

---

### Finding 2: MEDIUM — Error toast from worker crash retains "Skip" button

**Issue**: When the worker-crash handler updates an existing progress toast using `toast.error('Semantic search unavailable', { id: toastIdRef.current, description })`, the Skip action button from the original progress toast persists. Users see "Semantic search unavailable... The AI model download failed: Connection lost... Skip" — where "Skip" as an action label on an error toast is semantically confusing.

**Evidence**: Tested with `worker-crash` event dispatching error "Connection lost" — resulting toast shows "Skip" button alongside error messaging.

**Location**: `src/app/components/embeddings/EmbeddingModelProgressToast.tsx:244-256`

**Impact on learners**: The "Skip" label on the error toast may confuse learners about what action they are taking. They might think skipping dismisses the error, which it does, but the label doesn't communicate that clearly.

**Suggestion**: When the error handler runs, set `toastIdRef.current = null` before calling `toast.error(...)` to create a fresh toast without action buttons, or use `toast.dismiss(id)` then `toast.error(...)` to split the dismiss and error display.

**autofix_class**: `manual` — requires deciding between dismiss-then-create or clearing the ref

---

### Finding 3: LOW — Individual toast elements lack explicit `role="status"`

**Issue**: The Sonner section container provides `aria-live="polite"` with `aria-atomic="false"` and `aria-relevant="additions text"`, which is correct for the notifications region. However, individual toast `<li>` elements don't carry `role="status"` or `role="alert"`.

**Evidence**: 
- Section: `aria-live="polite"`, `aria-label="Notifications alt+T"`
- Individual toasts: `role: null`, `ariaLive: null`

**Location**: Global Sonner Toaster behavior — not specific to this component

**Impact on learners**: Screen readers should still receive announcements through the container's `aria-live` region. The lack of individual roles may affect how specific screen readers announce updates (some may not distinguish between toast appearance and other live region changes).

**Suggestion**: This is a Sonner library default. If screen reader testing reveals issues, consider configuring the `role` through Sonner's toast options. For now, this is advisory priority — the `aria-live="polite"` container provides adequate coverage.

**autofix_class**: `advisory`

---

### Finding 4: NIT — Progress value can appear stale during rapid updates

**Issue**: The 500ms debounce prevents visual thrashing but means the displayed progress value may lag behind the actual download. In testing, sending updates at 5%, 15%, 35% within 100ms resulted in the toast showing 5% (the last non-debounced value) rather than 35%.

**Evidence**: Rapid-fire progression (5%, 15%, 35% within 100ms, 700ms wait) → toast showed 5%.

**Location**: `src/app/components/embeddings/EmbeddingModelProgressToast.tsx:179-181`

**Impact on learners**: Minor — the displayed value is slightly behind. On download completion, the 'done' event bypasses the debounce entirely and replaces the toast, so the final state is always accurate.

**Suggestion**: This is an intentional design tradeoff documented in the code comments. Consider storing the latest value in a ref and flushing it when the debounce timer fires, but this is low priority.

**autofix_class**: `advisory`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Verified in both light and dark modes. Primary text: 9.6:1 (dark), 13.5:1 (light). Muted description: 5.1:1 (dark) |
| Keyboard navigation | Partial | Direct determinate path: Pass (Tab to Close, Tab to Skip). Indeterminate->determinate: FAIL — no reachable buttons |
| Focus indicators visible | Pass | Sonner toast buttons have default browser focus styles |
| Heading hierarchy | N/A | Toast system has no headings |
| ARIA labels on icon buttons | Pass | Close button has `aria-label="Close toast"` |
| Semantic HTML | Pass | Sonner uses `<section>` with proper aria-live and `<li>` for toasts |
| Form labels associated | N/A | No form elements in this component |
| prefers-reduced-motion | Pass | MotionConfig is set globally from `useReducedMotion()` hook |
| aria-live region for dynamic content | Pass | Sonner container has `aria-live="polite"` |

## Responsive Design Verification

- **Mobile (375px)**: Pass — toast overlays correctly, no horizontal scroll, touch targets >= 44px (Close and Skip buttons)
- **Tablet (768px)**: Pass — toast positioned at top-right, visible and readable
- **Sidebar Collapse (1024px)**: Pass — no layout shift
- **Desktop (1440px)**: Pass — toast displays correctly with progress bar

## Dark Mode Verification

- **Pass**: Both progress toasts and error toasts display correctly in dark mode
- Theme tokens resolve correctly: `--popover` = `rgb(30, 37, 48)`, `--popover-foreground` = `rgb(228, 232, 239)`
- Progress bar indicator: `bg-primary` resolves to `rgb(228, 232, 239)`
- No artifacts remain when toggling back to light mode

## Console Errors

5 console errors detected, all pre-existing (not introduced by this story):
- 404 for a resource (likely a missing favicon or asset)
- Sync engine errors for `quiz_attempts` and `ai_usage_events` (missing `updated_at` columns — unrelated Supabase schema issue)
- No errors from the toast component or embedding system

## Recommendations

1. **Fix the indeterminate-to-determinate transition bug** (HIGH): This is the most impactful issue. The toast becomes non-interactive for a documented edge case (AC4). Use `toast()` with a custom icon instead of `toast.loading()`, or recreate the toast on transition.

2. **Clean up the error toast action button** (MEDIUM): The "Skip" label on error toasts is confusing. Dismiss the old toast before showing the error, or create a fresh error toast without the action.

3. **Monitor for Sonner API issues** (LOW): The `role="status"` gap on individual toasts and the loading-toast structural persistence are Sonner library behaviors. Watch for upstream fixes or configure through Sonner options if screen reader issues arise.

4. **Consider storing latest progress in a ref** (NIT): Enhance the debounce to flush the latest value when the timer fires, so displayed progress is always as current as the debounce window allows.
