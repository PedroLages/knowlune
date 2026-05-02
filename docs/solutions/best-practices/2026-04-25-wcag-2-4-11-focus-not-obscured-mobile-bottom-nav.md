---
title: WCAG 2.4.11 Focus Not Obscured — scroll-padding for fixed mobile bottom nav
date: 2026-04-25
module: a11y
tags: [a11y, wcag, focus, mobile, bottom-nav, scroll-padding, css]
problem_type: best_practice
category: best-practices
status: validated
related_story: E66-S03
---

# WCAG 2.4.11 Focus Not Obscured — Mobile Bottom Nav Pattern

## Context

Knowlune has a `position: fixed` mobile `BottomNav` (`h-14` = 56px + `env(safe-area-inset-bottom)`). Without intervention, the browser's native auto-scroll-to-focus places focused inputs/buttons under the BottomNav, violating WCAG 2.4.11 (AA in WCAG 2.2). E66-S03 implemented the fix; these are the durable lessons.

## Guidance

### 1. The canonical fix is one CSS rule on `:root`

```css
@media (max-width: 1023px) {
  :root {
    scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom));
  }
}
```

- Use `:root` (not `main`) — the document is the scroll container in most apps; this matches WCAG's intent.
- Scope to mobile breakpoint only (Tailwind `lg` = 1024px) so anchor-link UX on desktop is untouched.
- The literal value should be `nav-height + small buffer`. For Knowlune, BottomNav is 56px, plus 8px buffer → 64px.
- Always include `env(safe-area-inset-bottom)` — notched devices (iPhone X+) push the nav up.

### 2. Place toasts where they cannot collide with fixed chrome

Sonner's default `position="bottom-right"` collides with mobile BottomNav. Switching to `position="top-right"` is cleaner than maintaining a bottom `offset` value that has to track BottomNav height changes.

```tsx
<Sonner
  position="top-right"   // never conflicts with bottom chrome
  closeButton={true}
  duration={4000}
/>
```

### 3. Floating non-modal cards: use `bottom-[calc(...)]` per breakpoint

For elements like `ImportProgressOverlay` that are bottom-pinned cards (not modals), use a calc-based bottom offset on mobile and revert on `lg`:

```tsx
className="fixed right-4 z-50
  bottom-[calc(72px+env(safe-area-inset-bottom))]
  lg:bottom-4"
```

The 72px = 56px (nav) + 16px (gap). Tailwind v4 supports arbitrary `calc()` values inside square-bracket syntax.

## Why This Matters

- **WCAG 2.4.11 is AA** in WCAG 2.2 — required for accessibility compliance, not optional polish.
- One CSS rule on `:root` fixes the issue across the entire app — no per-page work, no JS, no risk of missing a route.
- Auto-scroll for focus is a free browser feature; we just have to tell it the size of our chrome.

## Process Lessons (Story-to-Implementation Gaps)

These bit during E66-S03 — verify before committing to a plan:

1. **Story said BottomNav was 64px; actual was `h-14` (56px).** Always inspect the source file before lifting numbers from a story description. The story's 64px was already inclusive of buffer, but it could just as easily have been wrong in the other direction.

2. **Story listed OnboardingOverlay as in-scope; the component does not exist in the repo.** Run `find src -name "Onboarding*"` (or equivalent) before drafting focus-trap audit tasks. Defer focus-trap requirements for components that don't exist yet — note it in the plan as deferred and let the future story enforce it when the component lands.

3. **"Overlay" suffix does not imply modal.** `ImportProgressOverlay` turned out to be a non-blocking live region (`role="status"`, `w-96` corner card, no backdrop) — NOT a full-screen modal. Read the component before deciding whether it needs a focus trap. The right ARIA contract for a non-blocking progress notification is `role="status"` + `aria-live="polite"`, not `role="dialog"`.

4. **A `requirements.md` plus a `plan.md` does not guarantee correctness.** The plan still needs source-file inspection during `ce:work` to validate assumptions. The plan-critic agent can't catch "this component doesn't exist" — that's an implementation-time discovery.

## When to Apply

- Any app with `position: fixed` chrome (top status bar, bottom nav, floating action buttons) at any viewport.
- Reading-mode / immersive UI patterns — add `scroll-padding-top`/`scroll-padding-bottom` rules under a class selector that is inert until the mode is active.
- Toast/notification systems — pick a corner that doesn't share the screen edge with fixed nav.

## Examples

**Reading-mode preemptive rules (gated by class):**

```css
/* Inert until <html class="reading-mode"> is applied */
html.reading-mode {
  scroll-padding-top: 48px;     /* status bar */
  scroll-padding-bottom: 56px;  /* floating toolbar */
}
```

**E2E audit for regressions** — full spec at `tests/audit/focus-not-obscured.spec.ts`. Core idea: tab through every focusable element on each route, and assert no `:focus-visible` element's bounding rect is *fully contained* by any `position: fixed`/`sticky` element's rect. Use **full containment**, not "any overlap" — partial overlap with tooltips/focus rings is fine and would otherwise flake.

## References

- WCAG 2.4.11: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- MDN `scroll-padding`: https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding
- Implementation: PR #444, commit e1085a77
- Plan: `docs/plans/2026-04-25-001-feat-e66-s03-focus-not-obscured-plan.md`
