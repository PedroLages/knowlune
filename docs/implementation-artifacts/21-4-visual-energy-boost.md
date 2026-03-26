---
story_id: E21-S04
story_name: "Visual Energy Boost (Color Saturation)"
status: done
started: 2026-03-23
completed: 2026-03-24
reviewed: true
review_started: 2026-03-24
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing]
burn_in_validated: false
---

# Story 21.4: Visual Energy Boost

## Story

As a Gen Z learner,
I want vibrant, high-contrast colors in the UI,
so that the platform feels modern and energizing.

## Acceptance Criteria

**Given** the user enables "Vibrant" color scheme (via E21-S05 preference or direct toggle)
**When** the vibrant theme is active
**Then** brand color saturation is increased by ~15%
**And** success/achievement colors are more vivid
**And** momentum badges (HOT/WARM/COLD) use colorful variants
**And** WCAG 2.1 AA+ compliance is maintained (4.5:1 text, 3:1 large text)

**Given** the vibrant color scheme is active
**When** viewing any page with brand-colored elements
**Then** the colors feel noticeably more saturated and energetic vs. the default "Professional" scheme
**And** all interactive elements remain clearly distinguishable

**Given** the vibrant color scheme is NOT active (default "Professional" mode)
**When** viewing the UI
**Then** all existing colors remain unchanged from their current values
**And** no regression in existing visual appearance

**Given** the user has `prefers-reduced-motion` enabled
**When** switching between Professional and Vibrant modes
**Then** the color transition is instant (no animation)

## Tasks / Subtasks

- [ ] Task 1: Define vibrant color token set in theme.css (AC: 1, 2)
  - [ ] 1.1 Create `:root.vibrant` / `.dark.vibrant` CSS custom property overrides
  - [ ] 1.2 Increase brand color saturation ~15% in OKLCH space
  - [ ] 1.3 Create vibrant variants for success, warning, momentum tiers
  - [ ] 1.4 Validate all vibrant colors against WCAG 2.1 AA (4.5:1 contrast)
- [ ] Task 2: Create color scheme state management (AC: 1, 3)
  - [ ] 2.1 Add `colorScheme: 'professional' | 'vibrant'` to settings
  - [ ] 2.2 Create `useColorScheme` hook for reading/applying the preference
  - [ ] 2.3 Apply `.vibrant` class to `<html>` element based on preference
- [ ] Task 3: Wire up color scheme in App.tsx (AC: 1, 3, 4)
  - [ ] 3.1 Read color scheme preference on mount
  - [ ] 3.2 Apply/remove `.vibrant` class on `<html>` element
  - [ ] 3.3 Respect prefers-reduced-motion for transitions
- [ ] Task 4: Update MomentumBadge with colorful vibrant variants (AC: 1)
  - [ ] 4.1 Ensure momentum badge colors respond to vibrant token overrides
- [ ] Task 5: Unit tests (AC: all)
  - [ ] 5.1 Test color scheme toggle applies/removes .vibrant class
  - [ ] 5.2 Test default is 'professional' (no visual regression)
  - [ ] 5.3 Test settings persistence
- [ ] Task 6: E2E tests (AC: all)
  - [ ] 6.1 Toggle vibrant mode → verify CSS custom properties change
  - [ ] 6.2 Verify momentum badges render with vibrant colors
  - [ ] 6.3 Verify professional mode is unchanged

## Design Guidance

**Approach:** CSS custom property override layer. The `.vibrant` class on `<html>` overrides design tokens from theme.css without changing the default Professional palette. This is a zero-runtime-cost approach — CSS cascade handles the switching.

**Color Strategy (OKLCH):**
- Increase chroma (saturation) by ~15% for brand, success, warning tokens
- Keep lightness values stable to preserve contrast ratios
- Validate with axe DevTools or manual contrast checker

**Responsive:** No responsive-specific changes — this is a global theme modifier.

**Accessibility:**
- All vibrant colors must pass WCAG 2.1 AA+ (4.5:1 for text, 3:1 for large text/icons)
- prefers-reduced-motion: instant color transitions (no animation)

## Implementation Notes

**Plan:** [e21-s04-visual-energy-boost-plan.md](plans/e21-s04-visual-energy-boost-plan.md)

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

1. **OKLCH chroma-only modifications preserve contrast ratios.** By increasing only the chroma (C) channel in OKLCH while keeping lightness (L) and hue (H) stable, vibrant colors are more saturated without shifting contrast ratios against foreground colors. This makes WCAG AA compliance straightforward — no lightness recalculation needed.

2. **Composable `.vibrant` class approach enables zero-runtime-cost theming.** Using a CSS class on `<html>` that overrides design tokens via the cascade means no JavaScript runs at render time for color switching. The browser's CSS engine handles the override natively, and the `.dark.vibrant` compound selector cleanly composes dark mode with vibrant mode.

3. **Dark mode chroma reduction prevents neon fatigue.** Vibrant chroma values that look energizing on light backgrounds become uncomfortably neon on dark backgrounds. The `.dark.vibrant` block uses ~10-15% less chroma than `.vibrant` to maintain visual energy without causing eye strain during extended dark-mode sessions.

4. **`hsl(var(...) / alpha)` breaks with OKLCH token values.** The heatmap tokens originally used `hsl(var(--success) / 0.3)` which assumes the token contains HSL channel values. When `.vibrant` overrides `--success` with an `oklch()` value, the `hsl()` wrapper computes invalid CSS. Replaced with `color-mix(in oklch, var(--success) 30%, transparent)` which works with any color format.

5. **E2E contrast ratio validation is feasible via Playwright.** Using `getComputedStyle()` with a probe element to resolve CSS custom properties to `rgb()`, then calculating WCAG relative luminance in the test, provides programmatic WCAG AA verification without external tools.
