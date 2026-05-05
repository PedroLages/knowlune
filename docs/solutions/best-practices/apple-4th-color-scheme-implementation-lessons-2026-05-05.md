---
title: "Implementation lessons from adding .apple as 4th color scheme"
date: 2026-05-05
category: best-practices
module: theming
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - "Adding a new CSS-based theme variant to an existing multi-scheme design system"
  - "Working with CSS custom property overrides that must coexist with inline-style hooks"
  - "Changing a store default that affects preference persistence and fallback logic"
tags:
  - css-cascade
  - design-tokens
  - color-scheme
  - theme-css
  - font-scale
  - accessibility-font
  - radius-audit
  - store-defaults
---

# Implementation lessons from adding .apple as 4th color scheme

## Context

Knowlune's design system had three color schemes (Professional, Vibrant, Clean) managed via CSS cascade: `:root` (Professional defaults) -> `.vibrant` -> `.clean`, each block overriding CSS custom properties. Adding a fourth `.apple` scheme with significantly different token values (pure white backgrounds, Action Blue #0066cc brand, Inter Variable font, 17px base font size, non-linear radius scale 5/8/11/18/9999px, zero grain texture) exposed several non-obvious interactions between the CSS cascade, React inline-style hooks, and the Zustand store persistence layer.

The implementation is documented in the plan at `docs/plans/2026-05-05-004-feat-apple-design-system-plan.md` and the PR at <https://github.com/PedroLages/knowlune/pull/513>.

## Guidance

### Lesson 1: CSS cascade block order is load-bearing

The `.apple` CSS block in `theme.css` must appear AFTER the `.clean` block to ensure cascade priority. The cascade order is:

```css
:root { /* Professional defaults */ }
.vibrant { /* override block */ }
.clean { /* override block */ }
.apple { /* override block — must be last in source order */ }
.dark { /* dark Professional defaults */ }
.dark.vibrant { /* dark override */ }
.dark.clean { /* dark override */ }
.dark.apple { /* dark override — must be last */ }
```

This is because all scheme blocks have equal CSS specificity (single class selector). When two blocks define the same custom property, the one that appears last in source order wins. Placing `.apple` before `.clean` would cause Clean's values to win over Apple's when `.apple` is active on `<html>`.

**Non-obvious consequence**: The `.apple` block must redefine EVERY token it wants to override, even tokens that are the "same" as another scheme. You cannot chain scheme inheritance (e.g., "Apple inherits from Clean and overrides X").

### Lesson 2: Inline style hooks block the CSS cascade for scheme-specific values

Two hooks were setting inline styles on `document.documentElement` that prevented the Apple scheme's CSS custom property overrides from taking effect:

**`useFontScale.ts`** was unconditionally setting `--font-size` via inline style for ALL font size choices, including the default `'medium'`:

```typescript
// Before (broken in Apple scheme):
function applyFontScale() {
  const settings = getSettings()
  const fontSize: FontSize = settings.fontSize ?? 'medium'
  const px = FONT_SIZE_PX[fontSize] ?? 16
  document.documentElement.style.setProperty('--font-size', `${px}px`)
}
```

This set `--font-size: 16px` via inline style, which has higher priority than the CSS cascade value of `17px` set by `.apple { --font-size: 17px }`. Fix:

```typescript
// After (CSS cascade can resolve Apple's 17px):
function applyFontScale() {
  const settings = getSettings()
  const fontSize: FontSize = settings.fontSize ?? 'medium'
  if (fontSize === 'medium') {
    document.documentElement.style.removeProperty('--font-size')
    return
  }
  const px = FONT_SIZE_PX[fontSize] ?? 16
  document.documentElement.style.setProperty('--font-size', `${px}px`)
}
```

Key insight: for the default `'medium'` size, remove the inline property entirely so the CSS cascade (which varies by scheme) determines the value. Only set inline for non-default choices that represent an explicit user override.

**`accessibilityFont.ts`** was hardcoding the DM Sans font stack when restoring from the accessibility font:

```typescript
// Before (broken in Apple scheme):
const DEFAULT_FONT_FAMILY = "'DM Sans', system-ui, -apple-system, sans-serif"
export function unloadAccessibilityFont(): void {
  document.documentElement.style.setProperty('--font-body', DEFAULT_FONT_FAMILY)
}

// After (CSS cascade resolves correct font per scheme):
export function unloadAccessibilityFont(): void {
  document.documentElement.style.removeProperty('--font-body')
}
```

This pattern (removeProperty instead of hardcoding a default) ensures the CSS cascade resolves the correct value for the active scheme. It applies to any inline-style hook that manages CSS custom properties a scheme might want to override.

### Lesson 3: Radius audit must check `calc()` derivations, not just direct token references

The plan prescribed running `grep -r 'var(--radius)' src/` to find components that reference the base `--radius` token directly. This found `input-group.tsx` with three usages of `calc(var(--radius) - 5px)`:

```typescript
// input-group.tsx:
"[&>kbd]:rounded-[calc(var(--radius)-5px)]"
xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2"
'icon-xs': 'size-6 rounded-[calc(var(--radius)-5px)] p-0'
```

Under Apple's 11px `--radius` base, these produce 6px (`calc(11px - 5px)`) instead of the Professional default of ~9px (`calc(14px - 5px)`). This is a tight inline radius — acceptable for Apple's aesthetic but must be explicitly evaluated rather than discovered post-merge.

**Lesson**: A radius audit must also search for `calc(*var(--radius)*)` to catch derivations, not just direct `var(--radius)` references. The same applies to other token derivations.

### Lesson 4: Store default changes require auditing all fallback paths

When changing the `defaults.colorScheme` from `'professional'` to `'clean'` in `useEngagementPrefsStore`, the `loadPersistedPrefs` function had a hardcoded fallback:

```typescript
// Before (hardcoded fallback — hidden divergence):
colorScheme: ['professional', 'vibrant', 'clean', 'apple'].includes(parsed.colorScheme)
  ? parsed.colorScheme
  : 'professional',  // <-- hardcoded, does not reference defaults.colorScheme

// After (references defaults — sync maintained):
colorScheme: ['professional', 'vibrant', 'clean', 'apple'].includes(parsed.colorScheme)
  ? parsed.colorScheme
  : defaults.colorScheme,  // <-- references the defaults object
```

This was a pre-existing bug exposed by the default change. The original code used `'professional'` as fallback because that happened to match the defaults at the time. When the default changed, the hardcoded fallback became inconsistent with `defaults.colorScheme`.

**Rule**: Every fallback value in persistence logic should reference the canonical defaults object rather than hardcoding a value. This prevents silent divergences when defaults are updated.

## Why This Matters

1. **CSS cascade ordering** is easy to get wrong when adding a new scheme block to a growing list. Each new scheme increases the chance of ordering mistakes. The fix is structural: comment headers marking block order, and a review checklist item for scheme source order.

2. **Inline styles that manage the same CSS custom properties a scheme wants to override** create a silent priority war. The inline style always wins (higher specificity), but it looks correct in the "default" scheme. The bug only manifests when switching to a scheme that overrides those properties. The `removeProperty` pattern is the fix: for default values, remove the inline style and let CSS cascade resolve.

3. **`calc()` token derivations** in component classes are invisible to grep patterns that only search for the base token. The radius audit must use both patterns: `var(--radius)` and `calc(*var(--radius)*)`.

4. **Hardcoded fallbacks** in persistence code are a ticking time bomb. They work perfectly until the default changes, at which point users with corrupt/missing localStorage get a different default than new users. Always reference the canonical defaults object.

## When to Apply

- When adding a new CSS scheme block to a multi-scheme system: verify it is the LAST block in both light and dark sections
- When writing React hooks that set CSS custom properties via inline style: use `removeProperty` instead of `setProperty` for default values so the CSS cascade can resolve scheme-specific values
- When changing any token value that has `calc()` derivations elsewhere: search for both the raw token and all `calc()` patterns referencing it
- When modifying a default value in a Zustand store: audit every fallback path in the persistence layer to ensure it references `defaults` rather than a hardcoded value

## Examples

### Before/after: Inline style cascade blocking

```typescript
// Before — inline style blocks scheme cascade for --font-size and --font-body
function applyFontScale() {
  const px = FONT_SIZE_PX[fontSize] ?? 16
  document.documentElement.style.setProperty('--font-size', `${px}px`)  // blocks .apple's 17px
}

function unloadAccessibilityFont() {
  document.documentElement.style.setProperty('--font-body', "'DM Sans', ...")  // blocks .apple's Inter
}

// After — inline styles removed for default values, cascade resolves correctly
function applyFontScale() {
  if (fontSize === 'medium') {
    document.documentElement.style.removeProperty('--font-size')  // cascade wins
    return
  }
  // ... setProperty only for non-default choices
}

function unloadAccessibilityFont() {
  document.documentElement.style.removeProperty('--font-body')  // cascade wins
}
```

### Check for radius audit completeness

```bash
# Must check BOTH patterns:
grep -rn 'var(--radius)' src/ --include='*.tsx' --include='*.css'
grep -rn 'calc.*var(--radius)' src/ --include='*.tsx' --include='*.css'
```

## Related

- Plan: `docs/plans/2026-05-05-004-feat-apple-design-system-plan.md`
- PR: <https://github.com/PedroLages/knowlune/pull/513>
- Additive focus-ring token pattern: `docs/solutions/2026-04-25-focus-ring-token-additive-migration.md`
- Engagement prefs bridge checklist: `docs/solutions/best-practices/2026-04-25-engagement-prefs-bridge-checklist.md`
- Theme tokens: `src/styles/theme.css`
- `useFontScale` hook: `src/hooks/useFontScale.ts`
- `accessibilityFont` module: `src/lib/accessibilityFont.ts`
- `useEngagementPrefsStore`: `src/stores/useEngagementPrefsStore.ts`
