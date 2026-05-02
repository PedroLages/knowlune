---
title: "feat(a11y): WCAG 2.4.11 Focus Not Obscured (E66-S03)"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e66-s03-focus-not-obscured-requirements.md
---

# feat(a11y): WCAG 2.4.11 Focus Not Obscured (E66-S03)

## Overview

Ensure no keyboard-focused element is fully obscured by sticky/floating UI (WCAG 2.4.11 AA). Three concrete changes: scroll-padding so browser auto-scroll clears the mobile BottomNav; reposition Sonner toasts to a non-conflicting corner; audit and harden focus management on `ImportProgressOverlay`. Plus an E2E spec that programmatically detects bounding-box overlap between `:focus-visible` and any fixed/sticky element.

## Problem Frame

Knowlune has a fixed `BottomNav` (h-14 = 56px + `env(safe-area-inset-bottom)`) on mobile, a Sonner toaster currently positioned `bottom-right` (collides with BottomNav), and an `ImportProgressOverlay` rendered with `role="status"` (live region — not a dialog with focus trap). Without scroll padding, browsers' native `scrollIntoView`-on-focus places focused inputs/buttons under the BottomNav. Without focus traps, Tab can leak behind modal overlays.

Origin requirements doc: see `docs/brainstorms/2026-04-25-e66-s03-focus-not-obscured-requirements.md`.

## Requirements Trace

- R1 (AC1, AC6): Mobile scroll-padding clears BottomNav so focused element is fully visible.
- R2 (AC2): Reading-mode scroll-padding rules added preemptively for E65.
- R3 (AC3): Toasts do not fully obscure focused elements (reposition + auto-dismiss verified).
- R4 (AC4): OnboardingOverlay focus-trap requirement — *deferred* (no component exists yet, see Scope Boundaries).
- R5 (AC5): ImportProgressOverlay traps focus when blocking (role=dialog/aria-modal, `inert` background, Esc).
- R6 (AC7): E2E test asserts no `:focus-visible` element is fully obscured by a `position: fixed`/`position: sticky` element on key pages at mobile viewport.

## Scope Boundaries

- WCAG 2.4.11 (AA) only — not 2.4.12 (AAA).
- Modify Sonner Toaster position; do not redesign toast styling.
- ImportProgressOverlay: audit + add focus trap if missing; do not rewrite the component.
- E2E spec covers Library, Reports, Settings, Overview at mobile viewport (375x667).

### Deferred to Separate Tasks

- **OnboardingOverlay**: file does not exist in the repo (story assumed it; verified absent via `find src -name "Onboarding*"`). When the component is created (likely Epic 91/92 onboarding work), it must be built with Radix Dialog or `inert` + `aria-modal`. Add a TODO comment in the requirements section of the story file referencing this. Do not stub a file.
- **Reading-mode toolbar/status bar visuals** (E65-S01): only the CSS scroll-padding rule is added now, gated by a `html.reading-mode` selector that is inert until E65 lands.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/ui/sonner.tsx` — Sonner Toaster wrapper. Currently `position="bottom-right"`. Change to `position="top-right"` (safest per story Design Guidance) and add `mobileOffset` if needed.
- `src/app/components/navigation/BottomNav.tsx` — fixed `bottom-0`, height `h-14` (56px) + `pb-[env(safe-area-inset-bottom)]`. Real bottom inset = `56px + env(safe-area-inset-bottom)`.
- `src/app/components/figma/ImportProgressOverlay.tsx` — currently `role="status"`. When blocking and dismissible, should add `role="dialog"`, `aria-modal="true"`, focus trap, and Escape handler. When non-dismissible (progress must complete), keep focus inside the overlay only.
- `src/styles/index.css` — main CSS entry; place new global scroll-padding rules here.
- Existing Radix UI Dialog primitives in `src/app/components/ui/dialog.tsx` provide a reference pattern for `aria-modal` + focus trap.

### Institutional Learnings

- ES2020 target (`reference_es2020_constraints.md`) — `inert` and `scroll-padding-*` are CSS/HTML, not JS, so transpilation is irrelevant.
- E2E tests should follow `tests/audit/` patterns (see existing audit specs) and use deterministic time / proper context isolation per `.claude/rules/testing/`.

### External References

- WCAG 2.4.11 SC: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- MDN `scroll-padding`: https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding
- MDN `inert`: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert

## Key Technical Decisions

- **Use `scroll-padding-bottom` on `html` (or `:root`)** rather than on `main`. The browser uses the nearest scroll container's scroll-padding; `html` is the document scroll container in this app and matches WCAG's intent.
- **BottomNav height is 56px** (h-14), not 64px as stated in the story. Use `calc(56px + env(safe-area-inset-bottom))` and a small breathing-room buffer (8px) → final value: `calc(64px + env(safe-area-inset-bottom))`. The story's 64px was already inclusive of breathing room.
- **Mobile breakpoint**: Tailwind's `lg` is 1024px; BottomNav is shown below `lg`. Use `@media (max-width: 1023px)` to scope the scroll-padding rule.
- **Toaster reposition**: change `bottom-right` → `top-right`. Top-right does not conflict with BottomNav and is Sonner's documented safe default.
- **ImportProgressOverlay**: if it is purely a non-blocking progress notification (live region), keep `role="status"` and ensure z-index does not cover focus. If it blocks interaction (modal backdrop), upgrade to `role="dialog"` + `aria-modal="true"` + focus trap. Inspection during implementation determines which path.
- **`inert` over `tabindex="-1"`**: per story Implementation Notes — `inert` removes focus and interaction in one declarative attribute and has full modern-browser support.

## Open Questions

### Resolved During Planning

- BottomNav real height: 56px (`h-14`) + safe area, confirmed in source. Use 64px effective (with buffer) for scroll-padding.
- Sonner current position: `bottom-right` (conflicts) — confirmed in `src/app/components/ui/sonner.tsx:13`.
- OnboardingOverlay existence: does not exist. Excluded from scope.

### Deferred to Implementation

- Whether `ImportProgressOverlay` is fully blocking (modal backdrop) or a non-blocking toast-style live region — determines whether focus-trap retrofit is needed or just z-index/positioning verification.
- Exact buffer above the BottomNav in scroll-padding (8px vs 12px) — adjust during manual mobile-viewport tabbing if focus rings still feel cramped.

## Implementation Units

- [ ] **Unit 1: Add global scroll-padding rules**

**Goal:** Browser auto-scroll for focus accounts for fixed BottomNav (mobile) and reading-mode status/toolbar (preemptive for E65).

**Requirements:** R1, R2, R6

**Dependencies:** None

**Files:**
- Modify: `src/styles/index.css`

**Approach:**
- Add a new section `/* WCAG 2.4.11 — Focus Not Obscured */` near the bottom of `src/styles/index.css`.
- Mobile rule (under `@media (max-width: 1023px)`): set `scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom))` on `:root`.
- Reading-mode rules (preemptive, gated by `html.reading-mode`): `scroll-padding-top: 48px` and `scroll-padding-bottom: 56px`. Add `/* E65-S01 reading-mode integration — these rules are inert until the .reading-mode class is applied */` comment.
- Keep rules CSS-only (no JS).

**Patterns to follow:**
- Existing global rules in `src/styles/index.css`.

**Test scenarios:**
- Happy path: Tab to a button just above the BottomNav on mobile viewport — viewport auto-scrolls so the button's bottom edge sits at least the buffer above the BottomNav top edge.
- Edge case: Tab through a list with the focused row at the very bottom of a scroll container — element's bounding box does not intersect BottomNav's bounding box.
- Integration: With `html.reading-mode` toggled (manual test), `scroll-padding-top` rule applies (verify via DevTools computed styles).

**Verification:**
- DevTools shows `scroll-padding-bottom` on `:root` at mobile viewport.
- Manual tab-through on Library page (mobile) — last focusable element fully visible above BottomNav.

- [ ] **Unit 2: Reposition Sonner Toaster**

**Goal:** Toasts no longer share screen real estate with the mobile BottomNav.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `src/app/components/ui/sonner.tsx`

**Approach:**
- Change `position="bottom-right"` → `position="top-right"`.
- Verify Sonner's default auto-dismiss (`duration` ~4s) and close button (`closeButton` prop) — set `closeButton` to `true` if not already.
- Confirm no consumer of `<Toaster />` overrides position.

**Patterns to follow:**
- Sonner default config in shadcn/ui.

**Test scenarios:**
- Happy path: Trigger any toast (e.g., a save action) on mobile — toast appears top-right, BottomNav fully visible and interactive below.
- Error path: Trigger long-running toast — close button dismisses it; auto-dismiss occurs after duration elapses.
- Integration: Toast does not overlap with focused element on Settings page mobile viewport.

**Verification:**
- Snapshot search confirms no other `position` overrides exist.
- Manual mobile test: toast renders top-right, does not block BottomNav or focus.

- [ ] **Unit 3: Audit and harden ImportProgressOverlay focus management**

**Goal:** When `ImportProgressOverlay` blocks the screen, keyboard focus is trapped inside it; otherwise it does not interfere with focus.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportProgressOverlay.tsx`

**Approach:**
- Inspect the component to determine: (a) does it render a full-screen backdrop that blocks interaction? (b) is it dismissible by the user, or does it auto-close on completion?
- If blocking + non-dismissible: keep visible until done; add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to the heading; on mount, move focus to a heading or live status; render with `inert` on `<main>` (or use Radix Dialog primitive). No Escape handler (cannot cancel).
- If blocking + dismissible: as above, plus Escape key handler that calls existing dismiss callback.
- If non-blocking (live region): keep `role="status"`, ensure z-index does not visually cover focused elements (add bottom margin if positioned at bottom), and confirm no focus interference.
- Reuse the existing Radix `Dialog` primitive from `src/app/components/ui/dialog.tsx` if a heavier rewrite is warranted; otherwise patch in place.

**Patterns to follow:**
- `src/app/components/ui/dialog.tsx` (Radix Dialog primitive, already implements focus trap).
- Existing `aria-live` usage in the component.

**Test scenarios:**
- Happy path (blocking modal): With overlay open, Tab cycles within overlay only — focus never lands on background elements (verify via E2E checking `document.activeElement` during a tab loop).
- Edge case: Open overlay → background `<main>` has `inert` (or focus-trap intercepts) → click on background does nothing.
- Error path: If dismissible — Escape key closes overlay and returns focus to the trigger element.
- Integration: Screen reader announces overlay role/title on open (manual VoiceOver/NVDA spot-check, documented in story).

**Verification:**
- Component renders with correct ARIA attributes (assert via component test or DOM snapshot).
- E2E from Unit 4 confirms no focus leaks behind the overlay.

- [ ] **Unit 4: E2E focus-not-obscured audit spec**

**Goal:** Programmatic guard against future regressions across all key pages.

**Requirements:** R6

**Dependencies:** Units 1–3

**Files:**
- Create: `tests/audit/focus-not-obscured.spec.ts`

**Approach:**
- Set viewport to 375x667 (mobile) before navigation.
- For each route in `['/library', '/reports', '/settings', '/']`: navigate, then loop pressing `Tab` up to N times (N = count of focusable elements, capped at ~50).
- After each Tab: read `document.activeElement.getBoundingClientRect()` and the bounding rects of every `position: fixed` / `position: sticky` element on the page. Assert the focused element is not *fully contained* within any fixed/sticky element's rect (allow partial overlap to avoid flakiness with tooltips, but full obscurity = fail).
- Skip elements with size 0×0 or visibility hidden.
- Use Playwright's `page.evaluate` for the rect computation; assertions in test code.
- Fail with a helpful message naming the route, element selector, and obscuring element.

**Patterns to follow:**
- Existing audit specs in `tests/audit/` (deterministic time, proper context isolation per `.claude/rules/testing/test-cleanup.md`).

**Test scenarios:**
- Happy path: All key routes pass the no-full-obscurity invariant.
- Edge case: A route with a long list — focus on the last item is not under the BottomNav.
- Integration: Open the import wizard to trigger ImportProgressOverlay, then tab — focus stays inside the overlay (covers Unit 3 in E2E).

**Verification:**
- Spec runs in Chromium, completes under 30s, passes on the implemented branch.

## System-Wide Impact

- **Interaction graph:** CSS scroll-padding affects every scroll-into-view call (focus, hash navigation, JS `scrollIntoView`). Verify hash-link scrolls (e.g., anchor jumps in Settings) still feel correct.
- **Error propagation:** None — pure CSS + ARIA + test additions.
- **State lifecycle risks:** ImportProgressOverlay focus trap must release focus on unmount; Radix Dialog primitive handles this if used. If patched manually, ensure cleanup on unmount.
- **API surface parity:** None.
- **Integration coverage:** New E2E spec covers the cross-cutting invariant.
- **Unchanged invariants:** No existing dialogs, sheets, or popovers are modified — they already use Radix focus traps.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `scroll-padding-bottom` interferes with anchor-link UX on desktop | Scope rule to `@media (max-width: 1023px)` only |
| Toaster reposition surprises users used to bottom-right | Acceptable trade-off; documented in story; bottom-right collided with BottomNav anyway |
| ImportProgressOverlay rewrite scope creep | If component is non-blocking live region, no rewrite — only verify; document inspection result in story |
| E2E flake from focus-ring-vs-tooltip overlap | Assert *full containment*, not any overlap; cap Tab iterations |
| Reading-mode CSS becomes stale before E65 ships | Comment with E65-S01 reference; rules are inert without `.reading-mode` class |

## Documentation / Operational Notes

- Story `Challenges and Lessons Learned` section: document what `ImportProgressOverlay` actually was (blocking vs non-blocking) and which path was taken.
- No deployment, no migration, no monitoring impact.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-e66-s03-focus-not-obscured-requirements.md](../brainstorms/2026-04-25-e66-s03-focus-not-obscured-requirements.md)
- Story: `docs/implementation-artifacts/stories/E66-S03-focus-not-obscured.md`
- Related code: `src/app/components/ui/sonner.tsx`, `src/app/components/navigation/BottomNav.tsx`, `src/app/components/figma/ImportProgressOverlay.tsx`, `src/styles/index.css`
- WCAG 2.4.11: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
