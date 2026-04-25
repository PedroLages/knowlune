# E66-S03 — Focus Not Obscured (WCAG 2.4.11) — Requirements

**Story file:** `docs/implementation-artifacts/stories/E66-S03-focus-not-obscured.md`
**Date:** 2026-04-25
**Status:** ready-for-dev

## Title
Focus Not Obscured — keyboard-focused elements must never be fully hidden behind sticky/floating UI (WCAG 2.4.11 AA).

## User Story
As a keyboard user, I want focused elements to never be hidden behind sticky or floating UI so that I can always see where my keyboard focus is.

## Acceptance Criteria

1. **Mobile BottomNav**: When focus moves to an element near the bottom of the viewport on mobile, the focused element scrolls into view above the fixed BottomNav and is fully visible.
2. **Reading-mode floating toolbar**: When focus moves to a content element behind the reading-mode toolbar, the content scrolls so the focused element is visible above the toolbar.
3. **Toasts**: A displayed toast must not fully obscure the focused element. Toasts auto-dismiss or are dismissible to reveal focus.
4. **OnboardingOverlay**: When the overlay is open, keyboard focus is trapped within it (not allowed behind it). Has proper focus management (`role="dialog"`, `aria-modal="true"`, `inert` on background or focus trap).
5. **ImportProgressOverlay**: Same focus-trap behavior as Onboarding.
6. **Scroll padding**: `scroll-padding-bottom` (≥ `64px + env(safe-area-inset-bottom)`) is applied so browser auto-scroll for focus accounts for BottomNav height.
7. **Global**: Tabbing through any page produces no fully obscured focus rings (verified by E2E test that compares bounding boxes of `:focus-visible` element vs every fixed/sticky element).

## Context / Why

WCAG 2.4.11 (Focus Not Obscured, Minimum) is AA in WCAG 2.2. Knowlune uses a fixed mobile `BottomNav` (64px + safe area), Sonner toasts, and two full-screen overlays (Onboarding, ImportProgress). Without scroll padding, the browser's auto-scroll-to-focus places focused inputs/buttons under the BottomNav; without focus traps, Tab can leak behind overlays.

This is one of three WCAG 2.2 AA stories in Epic 66 (Accessibility Polish).

## In Scope (must implement)

- CSS `scroll-padding-bottom` on the scrollable root for mobile breakpoint accounting for BottomNav (64px + `env(safe-area-inset-bottom)`).
- CSS `scroll-padding-top` / `scroll-padding-bottom` for reading mode (preemptive — E65 may not be live yet; comment-reference).
- Audit and (if missing) add focus-trap + `aria-modal="true"` + `inert`-on-background to:
  - `src/app/components/onboarding/OnboardingOverlay.tsx`
  - `src/app/components/figma/ImportProgressOverlay.tsx`
- Verify Sonner `<Toaster>` position is `top-right` (or otherwise non-conflicting) and that toasts auto-dismiss / have a close button.
- Add E2E test `tests/audit/focus-not-obscured.spec.ts` that tabs through key pages on mobile viewport (375x667) and asserts no `:focus-visible` element is fully covered by any `position: fixed`/`position: sticky` element.

## Out of Scope

- Implementing the reading-mode toolbar/status bar themselves (E65 work). Only the scroll-padding rule is added preemptively.
- Refactoring existing dialog/sheet primitives that already implement Radix focus traps (just verify, don't rewrite).
- WCAG 2.4.12 (Focus Not Obscured, Enhanced — AAA).
- Visual focus-ring redesign (separate story if needed).

## Dependencies

- BottomNav: `src/app/components/navigation/BottomNav.tsx` (height 64px + safe area).
- Sonner Toaster: rendered in `src/app/App.tsx` or `Layout.tsx`.
- Existing CSS entry: `src/styles/index.css` / `src/styles/tailwind.css`.
- E66 sibling stories already merged (S01, S02 a11y polish).

## Non-Functional Requirements

- No bundle-size regression > 25%.
- No visual regression on desktop (scroll-padding only applies at mobile breakpoint).
- E2E test must run in Chromium under 30s.
- Modern-browser-only CSS (`scroll-padding-*`, `inert`) — both have full support per story notes; no fallback needed.

## Test Strategy

1. **Manual**: On mobile viewport, tab through long pages (Library, Reports, Settings); confirm last focusable element is visible above BottomNav.
2. **E2E**: New `tests/audit/focus-not-obscured.spec.ts` iterates routes, presses Tab, asserts bounding-box of focused element is not fully contained by any fixed/sticky element's bounding box.
3. **Overlay**: Open OnboardingOverlay (clear localStorage) and ImportProgressOverlay (trigger via import flow); Tab N+1 times and assert focused element stays inside the overlay.

## Risks

- `inert` on the entire `<main>` could interfere with screen-reader announcements during overlay if not coupled with `aria-modal="true"`. Mitigation: add both.
- Reading-mode CSS rules added preemptively could become stale if E65 changes heights. Mitigation: comment with E65-S01 reference.
- Sonner default position may differ from current Knowlune usage; verify before changing.

## Definition of Done

- All seven AC verified manually + via new E2E spec.
- `npm run build`, `npm run lint`, `npx tsc --noEmit` all clean.
- Story file `status: done`, `reviewed: true`.
- Sprint-status updated, PR merged.
