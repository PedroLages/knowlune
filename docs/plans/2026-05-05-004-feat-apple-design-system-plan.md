---
title: feat: Apple design system as 4th color scheme
type: feat
status: active
date: 2026-05-05
origin: DESIGN-apple.md
supersedes: docs/plans/2026-05-04-004-feat-stitch-apple-redesign-plan.md
---

# feat: Apple design system as 4th color scheme

## Overview

Add `.apple` as a 4th color scheme — additive, not replacing Professional, Vibrant, or Clean. The implementation is primarily CSS token overrides in `theme.css` using the existing CSS cascade pattern (`:root` → `.vibrant` → `.clean` → `.apple`), with 3 component radius refactors to use CSS custom property hooks instead of hardcoded Tailwind radius classes. The DESIGN-apple.md spec (photography-first, Action Blue #0066cc, Apple radius scale, SF Pro typography, no decorative shadows) is the source of truth.

**Supersedes** `2026-05-04-004-feat-stitch-apple-redesign-plan.md` — the Clean-activation approach is replaced by this comprehensive `.apple` scheme implementation.

## Problem Frame

The Clean theme scheme (Apple-inspired blue/Inter) was a partial step. The DESIGN-apple.md spec defines a comprehensive design system — non-linear radius scale (5/8/11/18/9999px), Action Blue (#0066cc) as the single accent, 17px body copy, SF Pro typography with negative letter-spacing, surface-color-based section rhythm, and exactly one product shadow. The Clean scheme uses different blue (#005bc1), derived-from-base radius tokens, and 16px body — it's directionally Apple but not the real system.

This plan implements the full DESIGN-apple.md spec as a new `.apple` scheme. Users select it in Settings → Appearance alongside the existing three schemes.

## Requirements Trace

- **R1.** `.apple` is a selectable 4th color scheme alongside Professional, Vibrant, and Clean
- **R2.** All DESIGN-apple.md color tokens are mapped to CSS custom properties in `.apple` (light) and `.dark.apple` (dark)
- **R3.** Apple radius scale (5/8/11/18/9999px) applies to all components when `.apple` is active
- **R4.** Font tokens: Inter (SF Pro substitute) for body and headings, 17px base, weight 600 for medium (not 500)
- **R5.** Grain overlay texture is suppressed when `.apple` is active
- **R6.** Button active state uses `scale(0.95)` press effect (Apple's system-wide micro-interaction)
- **R7.** Shadow suppression: colored shadows (`--shadow-brand`, `--shadow-warm`, `--shadow-gold`) are neutralized
- **R8.** Dark mode renders coherently with Apple-derived dark tokens
- **R9.** Professional, Vibrant, and Clean schemes are visually unchanged (radius refactors use defaults matching current values)
- **R10.** Settings UI shows 4 scheme options with Apple preview colors
- **R11.** All implementation uses semantic tokens — zero hardcoded colors

## Scope Boundaries

- Adding one CSS scheme block + 3 component refactors + type plumbing + settings UI update
- Existing `.clean` scheme is preserved unchanged (different blue, different radius scale)
- No per-page layout changes — this is a token-level scheme, not a page redesign
- No Stitch screens generated (the DESIGN-apple.md spec is the design source)
- No behavior or data model changes
- Scheme switching is instant (no crossfade/transition) — matches existing Professional↔Vibrant↔Clean behavior; animated transitions are a separate concern
- Existing `.clean` scheme is preserved (not migrated to `.apple`) — removing it would require migrating existing Clean users' preferences with no telemetry to verify zero adoption

### Deferred to Separate Tasks

- Per-variant button radius hooks matching DESIGN-apple.md's button grammar (8px utility, 11px pearl, 9999px pill, 50% circular) — v1 uses a single `--button-radius` hook for all variants
- Component-level Apple variants beyond the core radius refactor (e.g., Apple-style button variants, card layouts matching product tiles)
- Per-page Apple-style refinements (hero sections, alternating tile sections)
- Apple product shadow usage on specific imagery components
- Scheme transition animations on scheme switch (currently instant, matching Professional↔Vibrant↔Clean behavior)

## Context & Research

### Relevant Code and Patterns

- **Color scheme infrastructure**: CSS cascade `:root` → `.vibrant` → `.clean` blocks in `src/styles/theme.css`, bridged to Tailwind v4 via `@theme inline` (lines 650-742)
- **ColorScheme type**: `src/stores/useEngagementPrefsStore.ts:6`, `src/lib/settings.ts:41`, runtime validation at `settings.ts:453`
- **useColorScheme hook**: `src/hooks/useColorScheme.ts` — applies/removes CSS classes on `<html>`, listens for `settingsUpdated` events
- **Grain overlay**: `src/styles/index.css:272-285` — scoped via `html:not(.clean) .grain-overlay::after`; the `grain-overlay` class is on the root div in `src/app/components/Layout.tsx:487`
- **Radius tokens**: `@theme inline` block (lines 679-683) — all derived from `--radius: 0.625rem` via `calc()`; Apple's non-linear scale (5/8/11/18/9999px) requires overriding each derived token individually
- **Settings UI**: `src/app/components/settings/ColorSchemePicker.tsx` — 3 `schemeOptions` in `grid-cols-3`
- **Tests**: `src/hooks/__tests__/useColorScheme.test.ts` — covers `'professional'` and `'vibrant'` (not `'clean'` or `'apple'`)

### Institutional Learnings

- **Additive token pattern**: From `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md` — define in `:root` first with current-behavior defaults, then override in scheme blocks
- **Design token enforcement**: ESLint `design-tokens/no-hardcoded-colors` blocks hardcoded Tailwind colors at save-time; all new tokens must use the `--color-*` bridge

### External References

- **DESIGN-apple.md** (project root) — comprehensive Apple design system spec: colors, typography, spacing, elevation, components
- Apple HIG: SF Pro font stack, 44px touch targets, negative letter-spacing at display sizes

## Key Technical Decisions

- **Add `.apple` as a 4th scheme, not replace `.clean`.** The Clean scheme uses #005bc1 (Apple blue variant) and derived radius tokens — it serves users who want the cool-white aesthetic without the full Apple system. Apple is a distinct scheme with its own token values.
- **CSS custom property indirection for component radii.** Rather than overriding `--radius-xl` globally (which would pill-ify every `rounded-xl` element including badges, progress bars, etc.), create component-scoped tokens (`--button-radius`, `--card-radius`, `--input-radius`) that default to the current Tailwind token value. Only components that should change shape under Apple are wired to these hooks.
- **Override individual radius tokens in `.apple`.** Apple's 5/8/11/18/9999px scale is non-linear — it cannot derive from a single `--radius` base via `calc()`. The `.apple` block sets explicit px values for `--radius-sm`, `--radius-md`, `--radius`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, overriding the calc-derived defaults.
- **Apple dark mode: derive from existing dark tile tokens.** DESIGN-apple.md documents `surface-tile-1` (#272729), `surface-tile-2` (#2a2a2c), `surface-tile-3` (#252527), `primary-on-dark` (#2997ff), and `body-on-dark` (#ffffff). These anchor the dark palette. Remaining tokens (muted surfaces, borders, sidebar) are derived from these anchors using the same lightness-ratio approach as the existing Professional dark mode.
- **Weight 600 for `--font-weight-medium`.** Apple's typographic ladder is 300/400/600/700 — weight 500 is deliberately absent. Setting `--font-weight-medium: 600` in `.apple` propagates to all buttons, labels, and emphasized text via the existing `@layer base` rules.

## Open Questions

### Resolved During Planning

- **Should `.apple` suppress grain?** Yes — Apple aesthetic has zero texture overlays. Update `html:not(.clean)` to `html:not(.clean):not(.apple)` in both grain selectors.
- **Does changing `--font-size` to 17px break layout?** No — Tailwind v4 uses `rem` units which are based on the root font size. Changing from 16px to 17px slightly scales all rem-based spacing. Apple's "reading not scanning" pace is the intent.

### Deferred to Implementation

- **Exact dark-mode token values for muted surfaces and borders.** Derived from the documented dark tile anchors during implementation; the plan specifies the approach and anchors, but exact hex values are finalized in code. Dark-mode semantic colors (success #5cc08a, warning #e0a850, destructive #e86868, info #2997ff) ARE specified in Unit 2 and are not deferred. During implementation, ALL dark tokens (including the deferred muted surfaces/borders) MUST be verified for WCAG AA 4.5:1 contrast ratio against the `--background` (#1a1a1c) and `--card` (#2a2a2c) backgrounds.
- **Whether additional shadcn/ui components need Apple-specific radius overrides beyond button/card/input.** Discovered during visual audit after Unit 3 lands.

## Implementation Units

- [ ] **Unit 1: Add 'apple' to ColorScheme type system**

**Goal:** Make `'apple'` a valid `ColorScheme` across all type definitions, runtime validators, the hook, and the store. After this unit, `'apple'` is a recognized value but has no visual effect (no CSS tokens yet).

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/stores/useEngagementPrefsStore.ts` (line 6: type union; line 65: validator array)
- Modify: `src/lib/settings.ts` (line 41: interface union; line 453: `validSchemes` array)
- Modify: `src/hooks/useColorScheme.ts` (line 15: type; lines 22,30: classList calls; add `else if` for `'apple'`)

**Approach:**
- Extend the `ColorScheme` type union in both files: `'professional' | 'vibrant' | 'clean' | 'apple'`
- Add `'apple'` to the `validSchemes` runtime validator in `settings.ts`
- In `useColorScheme.ts`, add `'apple'` to both `classList.remove()` calls, and add an `else if (colorScheme === 'apple')` branch that adds the `.apple` class — mirroring the existing `.vibrant` and `.clean` branches exactly
- Sync `useEngagementPrefsStore` default to `'clean'` to match the `settings.ts` default (currently `'professional'` at line 48 — these two defaults diverged when the superseded plan changed settings.ts but not the store)
  - **Justification**: This is housekeeping to fix a pre-existing divergence between the store and settings.ts. Keeping them out of sync would cause inconsistent behavior: the hook reads from the store, but validation/routing reads from settings.ts. Bundling this fix in Unit 1 is appropriate because it touches the same files as the type-union extension.
  - **User impact**: Existing users without saved colorScheme preferences will see the Clean scheme (cool blue-white, Inter font) instead of Professional (warm cream, DM Sans) after this change. Users who have already selected a scheme (or who have a saved preference in localStorage) are unaffected — the default only applies when no preference is persisted.

**Patterns to follow:**
- Existing `'clean'` addition pattern — search `git log` for when `'clean'` was added to these same files
- `src/hooks/useColorScheme.ts:22-27` — the exact branch structure to mirror

**Test scenarios:**
- Happy path: `ColorScheme` type accepts `'apple'` — `npx tsc --noEmit` passes
- Happy path: `validSchemes` includes `'apple'` — persisted `'apple'` value is accepted on load
- Edge case: Invalid colorScheme value still defaults to `'professional'`

**Verification:**
- `npx tsc --noEmit` passes with zero errors
- `npm run lint` passes (no new warnings)

---

- [ ] **Unit 2: Add `.apple` and `.dark.apple` CSS token blocks**

**Goal:** Define the full Apple design token set as CSS custom property overrides in `theme.css`. After this unit, toggling `.apple` on `<html>` visually transforms the app.

**Requirements:** R2, R3, R4, R6, R7

**Dependencies:** Unit 1 (types exist, `.apple` class can be applied)

**Files:**
- Modify: `src/styles/theme.css` — add 3 additions:
  1. New component hook tokens in `:root` block (~10 lines)
  2. `html.apple { ... }` block after the existing `.clean` block
  3. `.dark.apple { ... }` block after the `.dark.clean` block

**Approach:**

*Component hook tokens (add to `:root`)* — defaults that match current behavior:
- `--button-radius: var(--radius-xl)` (currently 14px via calc)
- `--button-press-scale: 1` (no-op default; overridden to 0.95 in `.apple`)
- `--card-radius: var(--radius-2xl)` (currently 16px via calc)
- `--input-radius: var(--radius-md)` (currently 8px via calc)

*`.apple` light block:*
- **Colors**: Mapping from DESIGN-apple.md colors section. `--background: #ffffff`, `--brand: #0066cc`, `--foreground: #1d1d1f`, `--muted: #f5f5f7`, `--muted-foreground: #7a7a7a`, `--card: #ffffff`, `--border: rgba(0, 0, 0, 0.08)`, `--input-background: #f5f5f7`, `--ring: #0066cc`, `--focus-ring: #0071e3`, `--sidebar: #f5f5f7`, `--sidebar-foreground: #1d1d1f`, `--sidebar-accent: #fafafc`, plus full semantic color set (success, warning, destructive, info, gold, accent-violet, momentum tiers, chart colors, resource badges, brand-soft/hover/muted variants)
- **Surface tokens**: `--surface-elevated: #ffffff`, `--surface-sunken: #f5f5f7`, `--brand-soft: #dbe9f7`, `--brand-soft-foreground: #0055aa`, `--brand-muted: #c4ddf5`, `--success-soft: #e8f5ed`
- **Radius overrides**: `--radius: 11px`, `--radius-sm: 5px`, `--radius-md: 8px`, `--radius-lg: 18px`, `--radius-xl: 18px`, `--radius-2xl: 18px` — explicit values, not calc-derived. The global `--radius-xl` stays at 18px (Apple's `lg`), not 9999px — only component-scoped hooks (`--button-radius`, `--input-radius`) go to 9999px pill, preventing unintended pill-ification of badges, progress bars, tabs, and other non-button/non-input elements
- **Component hooks**: `--button-radius: 9999px`, `--card-radius: 18px`, `--input-radius: 9999px`, `--button-press-scale: 0.95`
- **Fonts**: `--font-body: 'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif`, `--font-heading` same as body (Apple uses SF Pro for both), `--font-size: 17px`, `--font-weight-medium: 600`, `--font-weight-normal: 400`
- **Shadow suppression**: `--shadow-brand: none`, `--shadow-warm: none`, `--shadow-gold: none`
- **Apple-specific tokens**: `--apple-product-shadow: rgba(0, 0, 0, 0.22) 3px 5px 30px 0`, `--apple-hairline-color: #e0e0e0` — defined now to complete the token set per DESIGN-apple.md; consumed by the deferred imagery component work

*`.dark.apple` block:*
- **Colors**: `--background: #1a1a1c`, `--foreground: #f5f5f7`, `--card: #2a2a2c`, `--muted: #2a2a2c`, `--muted-foreground: #98989d`, `--brand: #2997ff` (Sky Link Blue for dark), `--brand-hover: #4da8ff`, `--brand-foreground: #0a1520`, `--ring: #2997ff`, `--focus-ring: #2997ff`, `--border: rgba(255, 255, 255, 0.08)`, `--input-background: #242426`, `--sidebar: #1e1e20`, `--sidebar-foreground: #f5f5f7`, `--sidebar-accent: #2a2a2c`
- **Surface tokens**: Dark-mode derivations of the light surface tokens
- **Radius/font/shadow**: Same overrides as light `.apple`
- **Semantic colors**: Dark-variant values for success (#5cc08a), warning (#e0a850), destructive (#e86868), info (#2997ff), plus momentum tiers, chart colors, resource badges, gold, accent-violet

**Patterns to follow:**
- `.clean` block structure (`theme.css:421-506`) — same token categories, same ordering
- `.dark.clean` block structure (`theme.css:508-633`) — same token categories, same ordering
- Additive migration pattern from `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`

**Test scenarios:**
- Happy path: `.apple` class on `<html>` applies all color, radius, font tokens
- Happy path: `.dark.apple` overrides tokens correctly when both classes are present
- Happy path: Removing `.apple` class restores Professional/Vibrant/Clean tokens
- Edge case: `prefers-color-scheme: dark` with `.apple` + system theme — dark tokens apply
- Edge case: `--button-press-scale: 0.95` only active in `.apple` — Professional gets `1` (no-op)

**Verification:**
- `npm run build` passes (CSS is valid, no unknown @theme references)
- Visual check: `npm run dev`, manually add `.apple` to `<html>`, verify light and dark modes
- WCAG contrast check: `--foreground` (#f5f5f7) against `--background` (#1a1a1c) and `--card` (#2a2a2c) in `.dark.apple` achieves >= 4.5:1 for normal text
- Visual regression: Spot-check all 7 key route pages (Overview, Courses, My Class, Reports, Authors, Settings, library read page) in Apple scheme at desktop (1536px) and mobile (640px) — verify no text overflow, clipping, or layout breakage from the 17px base font size (~6.25% rem-scale increase). Post-merge, add a Playwright visual regression test that screenshots each route at both breakpoints in the Apple scheme, comparing against a post-merge baseline to catch future 17px-induced layout regressions.
- `--radius` audit: Run `grep -r 'var(--radius)' src/ --include='*.css' --include='*.tsx'` to identify components referencing the base `--radius` token (11px in Apple) directly. Any matches will receive an unexpected radius change in the Apple scheme — each must be evaluated: either add an Apple-specific override or confirm the 11px value is acceptable. Document findings in the implementation notes for Unit 2.
- `npm run lint` passes

---

- [ ] **Unit 3: Refactor button, card, and input radii to use CSS custom properties**

**Goal:** Replace hardcoded Tailwind radius classes in button, card, and input with CSS custom property hooks so the Apple scheme can control component shapes via token overrides. For non-Apple schemes, the visual result is pixel-identical.

**Requirements:** R3, R6, R9

**Dependencies:** Unit 2 (component hook tokens defined in `:root` and overridden in `.apple`)

**Files:**
- Modify: `src/app/components/ui/button.tsx` (replace `rounded-xl` with `rounded-[var(--button-radius)]`, add active scale)
- Modify: `src/app/components/ui/card.tsx` (replace `rounded-2xl` with `rounded-[var(--card-radius)]`)
- Modify: `src/app/components/ui/input.tsx` (replace `rounded-md` with `rounded-[var(--input-radius)]`)

**Approach:**
- **button.tsx**: In the `cva` base classes string (line 8), replace `rounded-xl` with `rounded-[var(--button-radius)]`. In the `size` variants, replace 3 occurrences of `rounded-xl` (in `sm`, `lg`, `icon`; the base class has the 4th). Add `motion-safe:active:scale-[var(--button-press-scale)]` to the base classes for the Apple micro-interaction — defaults to `1` (no-op), Apple overrides to `0.95`. The `motion-safe:` prefix (Tailwind v4) wraps the utility in `@media (prefers-reduced-motion: no-preference)`, so users with reduced-motion preference do not receive the scale transform.
  - **Known limitation**: The single `--button-radius` hook applies 9999px pill to ALL 9 button variants including destructive (delete/remove). Pill shapes conventionally signal "safe, affirming" actions. Per-variant radius hooks (matching DESIGN-apple.md's button grammar: 8px utility, 11px pearl, 9999px pill, 50% circular) are deferred to a follow-up task.
- **card.tsx**: Line 10 — replace `rounded-2xl` with `rounded-[var(--card-radius)]`
- **input.tsx**: Line 11 — replace `rounded-md` with `rounded-[var(--input-radius)]`

**Execution note:** Verify each component renders with identical border-radius in Professional (default), Vibrant, and Clean schemes before and after the change. The CSS variable defaults must match the current hardcoded values exactly.

**Patterns to follow:**
- Existing arbitrary value syntax in the codebase: `[&_svg:not([class*='size-'])]:size-4` (button.tsx line 8) — Tailwind v4 arbitrary value pattern

**Test scenarios:**
- Happy path: Button renders with `border-radius: 14px` in Professional (current behavior preserved)
- Happy path: Button renders with `border-radius: 9999px` in Apple (pill shape)
- Happy path: Button active state scales to 0.95 in Apple, 0.98 in Professional
- Happy path: Card renders with `border-radius: 16px` in Professional, `18px` in Apple
- Happy path: Input renders with `border-radius: 8px` in Professional, `9999px` (pill) in Apple
- Edge case: Disabled buttons do not animate on press
- Edge case: `prefers-reduced-motion` — `motion-safe:` prefix (applied in the approach) suppresses the active scale transform. Verify by emulating `prefers-reduced-motion: reduce` in DevTools and confirming no scale animation fires on button press.

**Verification:**
- `npm run build` passes
- `npx tsc --noEmit` passes (arbitrary values are valid Tailwind)
- Visual comparison: Professional/Vibrant/Clean — no visual change
- Visual comparison: `.apple` — buttons are pill-shaped, cards have 18px radius, inputs are pill-shaped

---

- [ ] **Unit 4: Suppress grain overlay in Apple scheme**

**Goal:** Extend the existing grain-overlay suppression (currently `html:not(.clean)`) to also exclude Apple. The Apple aesthetic has zero texture overlays.

**Requirements:** R5

**Dependencies:** None (independent CSS change)

**Files:**
- Modify: `src/styles/index.css` (lines 272 and 282 — two selectors)

**Approach:**
- Line 272: Change `html:not(.clean) .grain-overlay::after` to `html:not(.clean):not(.apple) .grain-overlay::after`
- Line 282: Change `html:not(.clean).dark .grain-overlay::after` to `html:not(.clean):not(.apple).dark .grain-overlay::after`

**Patterns to follow:**
- Existing `:not(.clean)` pattern — just chaining an additional `:not()`

**Test scenarios:**
- Happy path: Grain overlay visible in Professional and Vibrant
- Happy path: Grain overlay absent in Clean
- Happy path: Grain overlay absent in Apple
- Edge case: Switching from Apple to Professional restores grain

**Verification:**
- `npm run build` passes
- Visual: toggle between schemes, grain only appears in Professional/Vibrant
- `npm run lint` passes

---

- [ ] **Unit 5: Add Apple option to ColorSchemePicker**

**Goal:** Add the Apple scheme as a selectable option in the Settings → Appearance page, with accurate preview colors and a 4-column grid layout.

**Requirements:** R1, R10

**Dependencies:** Unit 1 (types include `'apple'`)

**Files:**
- Modify: `src/app/components/settings/ColorSchemePicker.tsx`
- Test: `src/app/components/settings/__tests__/ColorSchemePicker.test.tsx` (create if absent, or add to existing)

**Approach:**
- Add `apple` entry to `schemePreviewColors` with colors matching the Apple light theme: `bg: '#ffffff'`, `sidebar: '#f5f5f7'`, `brand: '#0066cc'`, `muted: '#f5f5f7'`, `text: '#7a7a7a'`
- Add `{ value: 'apple', label: 'Apple', description: 'Photography-first, Action Blue' }` to `schemeOptions`
- Change grid from `grid-cols-3` to `grid-cols-2 lg:grid-cols-4` so 4 options render evenly
- The `RadioGroup` `onValueChange` already casts to `ColorScheme`, so the type union handles validation

**Patterns to follow:**
- Existing `schemePreviewColors` structure — same keys, Apple-accurate values
- Existing `schemeOptions` entries — same shape

**Test scenarios:**
- Happy path: Apple option renders in the picker grid
- Happy path: Selecting Apple calls `setPreference('colorScheme', 'apple')`
- Happy path: Check mark appears on Apple when Apple is selected
- Happy path: 4 options display in a 2-col (mobile) / 4-col (desktop) grid
- Edge case: Keyboard navigation cycles through all 4 options
- Edge case: Apple option shows correct preview colors in the thumbnail

**Verification:**
- `npm run dev`, navigate to Settings → Appearance, verify 4 options render
- Select Apple → verify `.apple` class appears on `<html>`
- `npm run build` passes, `npm run lint` passes

---

- [ ] **Unit 6: Add test coverage for Apple scheme**

**Goal:** Extend existing tests to cover the Apple scheme for class application, event handling, and cleanup. Also add ColorSchemePicker test coverage if absent.

**Requirements:** R1, R9

**Dependencies:** Units 1, 2, 5 (implementation must exist before tests validate it)

**Files:**
- Modify: `src/hooks/__tests__/useColorScheme.test.ts`
- Create (if no existing test): `src/app/components/settings/__tests__/ColorSchemePicker.test.tsx`

**Approach:**
- Expand `mockColorScheme` type in test to include `'clean' | 'apple'`
- Add test cases for `'apple'` scheme: applies `.apple` class, removes on unmount, responds to `settingsUpdated` events
- Add test cases for `'clean'` scheme (currently untested — the test file only covers `'professional'` and `'vibrant'`)
- Add explicit `classList.remove` assertions for both `'vibrant'` and `'clean'` classes when switching to `'apple'` (only one scheme active at a time)
- For ColorSchemePicker: render with mock store state, verify all 4 options display, verify `setPreference` is called with `'apple'` on selection

**Patterns to follow:**
- Existing test structure in `useColorScheme.test.ts` — mock `getSettings`, renderHook, assert classList
- Existing component test patterns in the codebase for Zustand store mocking

**Test scenarios:**
- Happy path: `useColorScheme` returns `'apple'` when settings have `colorScheme: 'apple'`
- Happy path: Adds `.apple` class to `<html>` when Apple is active
- Happy path: Removes `.apple` class on unmount
- Happy path: Responds to `settingsUpdated` event — switches to Apple when settings change
- Happy path: Switches from Apple back to Professional on settings update
- Edge case: Only one scheme class active at a time (`.vibrant` and `.clean` removed when `.apple` added)
- Edge case: `defaults to 'professional'` when colorScheme is undefined
- Integration: ColorSchemePicker renders Apple option and dispatches correct value on selection

**Verification:**
- `npm run test:unit` passes — all new and existing tests green
- `npm run test:unit -- --coverage` — coverage does not decrease

## System-Wide Impact

- **Interaction graph:** The `useColorScheme` hook runs in the app root and affects every rendered component via CSS cascade. The 3 component files (button, card, input) are used by 50+ components across all pages.
- **Error propagation:** No changes to error handling. CSS token resolution failures (e.g., missing `--button-radius`) are silent degradation to browser default `border-radius`, not application errors.
- **State lifecycle risks:** Existing users with `'clean'`, `'vibrant'`, or `'professional'` saved preferences are unaffected. The `validSchemes` array validates on load — unknown values default to `'professional'`. New `'apple'` value is accepted by the expanded validator.
- **API surface parity:** The `ColorScheme` type is exported from `useEngagementPrefsStore` and consumed by `settings.ts`. Both are updated in Unit 1.
- **Integration coverage:** The `settingsUpdated` event bridges the Zustand store and the `useColorScheme` hook — covered by existing event-dispatch tests (Unit 6 extends them for Apple).
- **Unchanged invariants:** All route paths, navigation structure, component APIs, data fetching, business logic, and the Professional/Vibrant/Clean visual output. The `default` colorScheme in both `settings.ts` and `useEngagementPrefsStore` is synced to `'clean'` (Unit 1 fixes a divergence where the store had `'professional'` while settings.ts already had `'clean'`).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Button radius refactor breaks existing button variants (12 variants × 5 sizes) | The CSS variable default (`var(--radius-xl)`) resolves to the exact same value as the hardcoded `rounded-xl`. Visual regression test across all variants in Professional before marking complete. |
| Apple dark mode tokens have insufficient contrast | WCAG 2.1 AA requires 4.5:1 for normal text. Verify `--foreground` (#f5f5f7) against `--background` (#1a1a1c) and `--card` (#2a2a2c) during implementation. |
| `grid-cols-2 lg:grid-cols-4` breaks existing ColorSchemePicker layout on tablet | The current `grid-cols-3` works because 3 items in 3 columns. 4 items in 3 columns leaves an orphan. New grid: 2 columns below `lg`, 4 columns at `lg+`. Verify at 768px (tablet): 2×2 grid. |
| Arbitrary value syntax `rounded-[var(--button-radius)]` is not supported by the Tailwind v4 Vite plugin version | The codebase already uses Tailwind v4 arbitrary values (e.g., `[&_svg:not([class*='size-'])]:size-4`). The `var()` function inside arbitrary brackets is standard CSS — Tailwind passes it through. Verify with build. |

## Sources & References

- **Origin document:** [DESIGN-apple.md](DESIGN-apple.md) (project root)
- **Superseded plan:** [docs/plans/2026-05-04-004-feat-stitch-apple-redesign-plan.md](docs/plans/2026-05-04-004-feat-stitch-apple-redesign-plan.md)
- **User draft plan:** `/Users/pedro/.claude/plans/lets-check-the-design-apple-md-purring-nest.md`
- Clean theme tokens: `src/styles/theme.css:421-633`
- ColorScheme type: `src/stores/useEngagementPrefsStore.ts:6`
- useColorScheme hook: `src/hooks/useColorScheme.ts`
- ColorSchemePicker: `src/app/components/settings/ColorSchemePicker.tsx`
- Grain overlay: `src/styles/index.css:272-285`
- Additive token pattern: `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`
