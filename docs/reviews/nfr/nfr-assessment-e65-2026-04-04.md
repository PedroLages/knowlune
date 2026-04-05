---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-assess-and-score', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-04'
workflowType: 'testarch-nfr-assess'
inputDocuments:
  - _bmad/tea/testarch/knowledge/nfr-criteria.md
  - docs/implementation-artifacts/stories/E65-S01 through E65-S05
  - src/hooks/useReadingMode.ts
  - src/hooks/useFocusMode.ts
  - src/lib/focusModeState.ts
  - src/lib/focusModeEvents.ts
  - src/lib/notificationPiercing.ts
  - src/app/components/figma/FocusOverlay.tsx
  - src/app/components/figma/ReadingToolbar.tsx
  - src/app/components/settings/ReadingFocusModesSection.tsx
---

# NFR Assessment — Epic 65: Reading & Focus Modes

**Date:** 2026-04-04
**Epic:** E65 (5 stories: S01–S05)
**Epic Theme:** Distraction-free reading mode and focus mode overlay for lesson content
**Overall Status:** PASS with advisories

---

> Note: This assessment is based on static code analysis, story artifact review, and architectural inspection. No live performance benchmarks or automated security scan artifacts exist for E65 — those were not produced during story reviews.

---

## Executive Summary

**Assessment:** 3 PASS, 1 CONCERNS, 0 FAIL

**Blockers:** 0

**High Priority Open Issues:** 2
1. Module-level mutable singleton (`_isFocusModeActive` in `focusModeState.ts`) is not React-state-managed — desync risk in concurrent rendering
2. E65-S03 has no E2E spec (see Traceability Report for detail)

---

## NFR Category Assessments

---

### 1. Security — PASS

**Thresholds:**
- No PII stored in localStorage without user consent
- No sensitive data exposed in DOM or logs
- No XSS attack vectors introduced

**Evidence:**
- `useReadingMode`: CSS class toggle on `document.documentElement` — no DOM injection, no eval, no innerHTML
- `useFocusMode`: uses `setAttribute('inert', '')` / `removeAttribute('inert')` on DOM elements — safe attribute manipulation
- `focusModeState.ts`: module-level flag (`let _isFocusModeActive = false`) — no PII, boolean only
- `notificationPiercing.ts`: queues notification metadata (title, message, type) in memory array — not persisted, no PII
- localStorage usage: `focus-auto-tooltip-dismissed` (boolean string "true") and `reading-mode-tooltip-dismissed` (boolean string "true") — no PII, user-visible UX flags only
- Custom events (`focus-request`, `focus-release`, `exit-reading-mode`) use structured `CustomEvent` — no unvalidated external data
- No new API endpoints introduced — feature is entirely client-side

**Issues:** None

**Decision:** PASS

---

### 2. Performance — PASS with advisories

**Thresholds:**
- No new blocking main-thread operations >16ms
- No re-render storms from state changes
- Animations respect `prefers-reduced-motion`

**Evidence:**

**Positive findings:**
- CSS-class-driven mode switching (`.reading-mode` on `<html>`) is the correct architecture — browser handles layout recalculation, no JS layout thrashing
- Scroll restoration uses double `requestAnimationFrame` (nested) to ensure DOM reflow completes before `scrollTo` — correct race condition handling
- `useReducedMotion` hook applied in `useFocusMode` — motion preferences respected
- `inert` attribute applied to body children in a single loop — O(n) DOM children traversal, minimal in typical page structure
- Event listeners properly cleaned up in `useEffect` return functions — no listener accumulation

**Advisory findings:**

| ID | Finding | Severity | Recommendation |
|----|---------|----------|----------------|
| P-01 | `applyInert` traverses `document.body.children` on every `activateFocusMode` call. For deeply nested SPAs, this could touch 10–30 top-level elements. | LOW | Acceptable for typical Layout structure. If body children grow beyond 50, consider selector-scoped traversal. |
| P-02 | `flushSuppressedNotifications` fires all queued toasts sequentially in a `forEach` with `setTimeout(0)`. If many notifications queued (>10), toast queue may saturate. | LOW | `suppressedQueue` is capped at `MAX_INDIVIDUAL_TOASTS = 5` — mitigated. |
| P-03 | `focusModeState.ts` singleton (`_isFocusModeActive`) is read synchronously from `notificationPiercing.ts`. Under React 18 concurrent mode, the module-level flag may be stale during render batching. | MEDIUM | Consider exposing via React context or Zustand slice if focus mode ever drives render-path logic. Currently only used in notification service — acceptable but watch for drift. |

**Decision:** PASS (advisories noted, no blockers)

---

### 3. Reliability — CONCERNS

**Thresholds:**
- State cleanup on unmount
- Error boundaries around new components
- Graceful degradation when DOM elements not found

**Evidence:**

**Positive findings:**
- `useFocusMode` has a dedicated cleanup `useEffect` that calls `removeInert()` and resets target element styles on unmount — correct
- `useReadingMode` cleanup removes `.reading-mode` class on unmount
- All keyboard event listeners use cleanup functions
- `window.addEventListener` / `removeEventListener` pairs are symmetric
- Graceful guard: `if (!targetEl)` in `activateFocusMode` → shows toast and returns (no crash)
- Graceful guard: `if (!isReadingMode) return` in `exitReadingMode`

**Concerns:**

| ID | Finding | Severity | Recommendation |
|----|---------|----------|----------------|
| R-01 | `deactivateFocusMode` calls `flushSuppressedNotifications()` synchronously before focus restoration. If `flushSuppressedNotifications` throws (e.g., Sonner not mounted), focus restoration is skipped. | MEDIUM | Wrap in try/catch or move `flushSuppressedNotifications` after focus restoration. |
| R-02 | `portalContainerRef.current` is set inside `getPortalContainer()` — if the ref is stale on re-render, a new div is appended to `document.body` on each call. The `document.getElementById('focus-mode-portal')` fallback prevents duplicates, but only if the ID is still present. After cleanup, the container div may be removed from the DOM while the ref still holds a stale reference. | MEDIUM | Add null-check: verify `portalContainerRef.current` is still attached to the DOM before returning it. |
| R-03 | `focusModeState.ts` singleton `_isFocusModeActive` is module-level mutable state not managed by React. If component unmounts without calling `deactivateFocusMode` (e.g., navigation during focus mode via back button), the singleton remains `true` while no focus mode is active in React state — causing notification suppression to persist until page reload. | HIGH | Emit `focus-release` from route change handler, or add router navigation listener in `useFocusMode` cleanup. |

**Decision:** CONCERNS (R-03 is HIGH — persistent notification suppression on navigation edge case)

---

### 4. Maintainability — PASS

**Thresholds:**
- Clear module responsibilities, no God objects
- Consistent patterns with existing codebase
- JSDoc on public APIs

**Evidence:**

**Positive findings:**
- Architecture follows established pattern: CSS-class on `<html>` → layout (same as `useContentDensity`, theater mode)
- Custom event pattern (`focus-request`, `focus-release`) consistent with `settingsUpdated` event pattern
- Module responsibilities are clear:
  - `focusModeState.ts` — singleton readable from non-React contexts (notification service)
  - `focusModeEvents.ts` — dispatch helpers (quiz/flashcard components use these)
  - `notificationPiercing.ts` — notification routing logic
  - `useFocusMode.ts` / `useReadingMode.ts` — React lifecycle hooks
- JSDoc present on all public modules and exported functions
- `COMPONENT_LABELS` record provides O(1) lookup with type safety

**Minor observations:**

| ID | Finding | Severity |
|----|---------|----------|
| M-01 | `useReadingMode` and `useFocusMode` both declare `useAriaLiveAnnouncer` — shared dependency that could be extracted into a shared `useModeAnnouncer` wrapper, but this is cosmetic. | LOW |
| M-02 | `notificationPiercing.ts` hardcodes `CRITICAL_TYPES` and `NON_CRITICAL_TYPES` as module-level constants. As notification types expand, these will need updating manually. | LOW |

**Decision:** PASS

---

## NFR Summary Table

| Category | Decision | Blockers | High | Medium | Low |
|----------|----------|----------|------|--------|-----|
| Security | PASS | 0 | 0 | 0 | 0 |
| Performance | PASS | 0 | 0 | 1 | 2 |
| Reliability | CONCERNS | 0 | 1 | 2 | 0 |
| Maintainability | PASS | 0 | 0 | 0 | 2 |
| **Overall** | **PASS with advisories** | **0** | **1** | **3** | **4** |

---

## Open Issues — Action Required

### HIGH: R-03 — Singleton state desync on navigation during focus mode

**File:** `src/lib/focusModeState.ts`
**Impact:** If user navigates away (e.g., browser back) while focus mode is active, `_isFocusModeActive` remains `true`. Non-critical notifications will be silently suppressed indefinitely until page reload.
**Recommendation:** Add a router navigation listener in `useFocusMode` that calls `deactivateFocusMode()` (or at minimum `setFocusModeInactive()`) on route change. Alternatively, hook into React Router's `useBeforeUnload` / `useEffect` on pathname change.
**Owner:** E65 follow-up chore
**Priority:** Schedule before E65 next sprint cycle

### MEDIUM: R-01 — `flushSuppressedNotifications` may block focus restoration

**File:** `src/hooks/useFocusMode.ts` in `deactivateFocusMode`
**Recommendation:** Move `flushSuppressedNotifications()` call to after `savedEl.focus()` / fallback focus, wrapped in try/catch.

### MEDIUM: R-02 — Portal container ref stale after cleanup

**File:** `src/hooks/useFocusMode.ts` in `getPortalContainer`
**Recommendation:** Add `if (portalContainerRef.current && document.body.contains(portalContainerRef.current))` guard before returning ref.

---

## Waivers

| Waiver | Category | Finding | Reason | Expiry |
|--------|----------|---------|--------|--------|
| W-01 | Performance | No live performance benchmark data | E65 is client-side only with no new API calls or data-fetching paths. CSS transitions and DOM attribute changes are browser-native — no measurable regression expected. | 2026-07-04 |
| W-02 | Security | No automated security scan run | No new auth flows, no API endpoints, no data persistence beyond two boolean localStorage flags. Risk surface is negligible. | 2026-07-04 |
