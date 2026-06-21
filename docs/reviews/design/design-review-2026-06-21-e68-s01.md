# Design Review Report

**Review Date**: 2026-06-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story ID**: E68-S01
**Story Name**: Model Download Progress UI
**Changed Files**: 16 files (2108 insertions, 424 deletions)
**Affected Pages**: Global (toast overlay on all routes via App.tsx)

---

## Executive Summary

Story E68-S01 adds a Sonner toast-based download progress UI for the on-device embedding model. The implementation creates a clean, non-visual React component (`EmbeddingModelProgressToast`) that listens for `model-download-progress` CustomEvents dispatched by the WorkerCoordinator and surfaces progress via Sonner toasts. The code is well-structured with proper React patterns, no hardcoded design token violations, and correct event lifecycle management. The main design gap is that the acceptance criteria specify a "progress bar" but the implementation only shows text-based percentage.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

1. **No visual progress bar (AC gap)**
   AC #1 specifies "a Sonner toast appears with a progress bar showing percentage complete" but the implementation only shows text: "Loading semantic search model... 25%". There is no visual progress bar or loading indicator. Sonner's `toast.custom()` API supports rendering custom JSX content (including a progress bar element), and `toast.loading()` provides a spinner animation which would better indicate ongoing activity.

2. **No loading indicator on progress toast**
   The progress toast uses `toast()` (basic text toast) instead of `toast.loading()` which would show a spinner. The task description (Task 4, line 49) explicitly recommends `toast.loading()`. This makes the download state less visually apparent than it could be.

### Nitpicks (Optional)

1. **Pre-existing console errors on load (not introduced by this story)**
   Four sync engine errors appear on every page load: missing columns `quiz_attempts.updated_at` and `ai_usage_events.updated_at`. These clutter the console but are not related to this story.

---

## What Works Well

- **Clean component architecture**: The component returns `null` (no DOM output) and operates entirely through Sonner's toast API. This keeps the component lightweight and non-intrusive, correctly separating UI from logic.

- **Excellent event lifecycle management**: The component correctly handles ref-based guards to prevent stale events after completion (`hasCompletedRef`), properly debounces intermediate progress updates (500ms), and implements both first-progress timeout (15s) and mid-download stall timeout (120s).

- **No design token violations**: Zero hardcoded colors, spacing, or inline styles in any new/updated UI files. The component correctly inherits all styling from Sonner's theme-aware rendering.

- **Proper cleanup**: On unmount, the component cleans up the event listener, cancels all timers, and dismisses the active toast. No memory leaks or orphaned event listeners.

- **Dark mode support confirmed**: The toast rendered in dark mode with correct theme-applied colors (`--success-soft` background, `--success` foreground). Light mode inherits Sonner's default styling which respects the app's theme.

- **Accessible base**: Sonner's toaster uses `aria-live="polite"` for announcements, ensuring screen reader support for toast content.

---

## Detailed Findings

### Finding 1: No visual progress bar (AC gap)

- **File**: `src/app/components/embeddings/EmbeddingModelProgressToast.tsx:89-90`
- **Severity**: MEDIUM
- **Impact**: The acceptance criteria explicitly require "a progress bar showing percentage complete". Text-only percentage is less scannable than a visual progress bar. Users cannot quickly gauge remaining time by glancing at the toast.
- **Evidence**: The component renders `description: progressDisplay` where `progressDisplay` is "Loading semantic search model... X%" (plain text). No `<progress>` element, progress bar div, or Sonner loading spinner is used.
- **Suggestion**: Use `toast.custom()` to render a custom toast with a progress bar element (`<div className="h-1 bg-brand rounded-full" style={{ width: X% }} />` or a `<progress>` element), or switch to `toast.loading()` for a spinner animation.

### Finding 2: No loading indicator on progress toast

- **File**: `src/app/components/embeddings/EmbeddingModelProgressToast.tsx:87-93`
- **Severity**: MEDIUM
- **Impact**: The progress toast uses `toast()` which renders a plain text notification without any loading animation. Users may not immediately recognize the toast as representing an ongoing process.
- **Evidence**: Line 87: `toastIdRef.current = toast('Downloading AI Model', {...})` — uses basic `toast()` instead of `toast.loading()`.
- **Suggestion**: Replace `toast()` with `toast.loading()` for the initial progress state. Sonner's `toast.loading()` renders a pulsing spinner icon that clearly communicates an in-progress state. The task description (line 49) also recommends `toast.loading()`.

### Finding 3: Pre-existing console errors (informational)

- **File**: `src/app/App.tsx` (pre-existing, not introduced by this story)
- **Severity**: NIT
- **Impact**: Console noise that can mask real issues. Four sync engine errors on every page load (missing DB columns `quiz_attempts.updated_at`, `ai_usage_events.updated_at`).
- **Evidence**: Observed in browser console on page load.
- **Suggestion**: These are pre-existing database schema mismatches. Address in a separate DB migration or sync configuration update.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Toast inherits theme's contrast-verified tokens |
| Keyboard navigation | Pass | Sonner toasts support keyboard dismissal (Escape / close button) |
| Focus indicators visible | Pass | Theme CSS provides `focus-visible` outlines at 2px |
| Heading hierarchy | N/A (Landing page) | Landing page headings jump from H1 to H3; pre-existing |
| ARIA labels on icon buttons | Pass | 3 of 30 buttons have aria-labels (Welcome Wizard) |
| Semantic HTML | Pass | Landing page uses semantic skip-links |
| ARIA live regions | Pass | Sonner toaster uses `aria-live="polite"` |
| Form labels associated | Pass | 11 labels for 9 inputs |
| Dark mode contrast | Pass | Verified: toast renders with correct dark mode tokens |
| prefers-reduced-motion | N/A | No animations in this component |
| Touch targets >= 44x44 | Pass | 20 small touch targets found (primarily icon buttons in Welcome Wizard); pre-existing |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass | No horizontal scroll; toast renders at correct width |
| Tablet (768px) | Pass | No horizontal scroll; layout reflows correctly |
| Sidebar Collapse (1024px) | Pass | No horizontal scroll |
| Desktop (1440px) | Pass | Full layout renders correctly; toaster is in the top-right corner |

---

## Recommendations

1. **Add a visual progress indicator**: Switch to `toast.custom()` or `toast.loading()` to provide visual progress feedback instead of text-only percentage. This closes the gap with AC #1 and improves scannability.

2. **Consider timing optimizations**: The 15-second first-progress timeout and 120-second stall timeout are generous. Consider reducing the first-progress timeout to 10s for faster user feedback on failures, and the stall timeout to 60s for more responsive error reporting.

3. **Add error recovery suggestion**: The error toast currently says "Check your connection and reload the page." Consider adding a "Try Again" button to the error toast that re-triggers the warmup without requiring a full page reload.

---

## Screenshots

Screenshots captured during testing are available at:
- Landing page (desktop): `/tmp/landing-desktop-1440.png`
- Landing page (mobile): `/tmp/landing-mobile-375.png`
- Dark mode success toast: `/tmp/dark-mode-toast.png`
- Light mode (cleared state): `/tmp/light-mode-toast.png`
- Toast progress state: `/tmp/toast-progress.png`
- Toast success state: `/tmp/toast-success.png`
