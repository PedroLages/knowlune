# Design Token Cheat Sheet

**Quick Reference:** Always use these design tokens instead of hardcoded Tailwind colors.

---

## 🎨 Background Colors

| Use Case | ❌ Hardcoded | ✅ Design Token | Light Value | Dark Value |
|----------|-------------|----------------|-------------|------------|
| Primary brand | `bg-blue-600` | `bg-brand` | #2563eb | #3b82f6 |
| Soft brand accent | `bg-blue-100` | `bg-brand-soft` | #eff6ff | oklch(0.2 0.05 250) |
| Brand hover state | `bg-blue-700` | `bg-brand-hover` | #1d4ed8 | #2563eb |
| Success state | `bg-green-500` | `bg-success` | #16a34a | #22c55e |
| Success subtle | `bg-green-50` | `bg-success/10` | rgba(22,163,74,0.1) | rgba(34,197,94,0.1) |
| Warning state | `bg-orange-500` | `bg-warning` | #d97706 | #f59e0b |
| Error state | `bg-red-600` | `bg-destructive` | #d4183d | oklch(0.396 0.141 25.723) |
| Error subtle | `bg-red-50` | `bg-destructive/10` | rgba(212,24,61,0.1) | rgba(255,107,107,0.1) |
| Muted gray | `bg-gray-50` | `bg-muted` | #ececf0 | oklch(0.269 0 0) |
| Gold accent | `bg-amber-400` | `bg-gold` | #f59e0b | #fbbf24 |
| Gold subtle | `bg-amber-50` | `bg-gold-muted` | #fef3c7 | #451a03 |

---

## ✍️ Text Colors

| Use Case | ❌ Hardcoded | ✅ Design Token | Light Value | Dark Value |
|----------|-------------|----------------|-------------|------------|
| Primary brand text | `text-blue-600` | `text-brand` | #2563eb | #3b82f6 |
| Text on brand bg | `text-white` | `text-brand-foreground` | #ffffff | #ffffff |
| Success message | `text-green-600` | `text-success` | #16a34a | #22c55e |
| Warning message | `text-orange-600` | `text-warning` | #d97706 | #f59e0b |
| Error message | `text-red-600` | `text-destructive` | #d4183d | oklch(0.637 0.237 25.331) |
| Secondary text | `text-gray-500` | `text-muted-foreground` | #5b6a7d | oklch(0.708 0 0) |
| Gold text | `text-amber-500` | `text-gold` | #f59e0b | #fbbf24 |

---

## 🔲 Border Colors

| Use Case | ❌ Hardcoded | ✅ Design Token | Notes |
|----------|-------------|----------------|-------|
| Brand border | `border-blue-200` | `border-brand` | Auto-adapts to theme |
| Success border | `border-green-200` | `border-success` | Use with success states |
| Error border | `border-red-200` | `border-destructive` | Use with error states |
| Default border | `border-gray-200` | `border` | Standard UI borders |
| Gold border | `border-amber-200` | `border-gold` | Accent borders |

---

## 🌐 Special Purpose Tokens

### Momentum Tiers (Study Streak System)

| Use Case | Token | Light | Dark |
|----------|-------|-------|------|
| Hot streak (fire) | `bg-momentum-hot` | #c2410c | #fb923c |
| Hot streak bg | `bg-momentum-hot-bg` | #fff7ed | oklch(0.2 0.05 50) |
| Warm streak | `bg-momentum-warm` | #b45309 | #fbbf24 |
| Warm streak bg | `bg-momentum-warm-bg` | #fffbeb | oklch(0.2 0.05 85) |
| Cold streak (ice) | `bg-momentum-cold` | #1d4ed8 | #60a5fa |
| Cold streak bg | `bg-momentum-cold-bg` | #eff6ff | oklch(0.2 0.05 250) |

### At-Risk Course Indicators

| Use Case | Token | Light | Dark |
|----------|-------|-------|------|
| At-risk indicator | `bg-at-risk` | #c2410c | #fdba74 |
| At-risk background | `bg-at-risk-bg` | #fff7ed | oklch(0.2 0.05 50) |

---

## 🚫 Anti-Patterns (Never Do This)

```tsx
// ❌ WRONG - Hardcoded colors with dark mode variants
<div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
  Brand content
</div>

// ✅ CORRECT - Single token, dark mode handled automatically
<div className="bg-brand-soft text-brand">
  Brand content
</div>

// ❌ WRONG - Multiple color shades for state
<button className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800">
  Click me
</button>

// ✅ CORRECT - Use Button variant (preferred)
<Button variant="brand">Click me</Button>
<Button variant="brand-outline">Secondary</Button>
<Button variant="brand-ghost">Tertiary</Button>

// ✅ CORRECT - Token classes (for non-Button elements)
<button className="bg-brand hover:bg-brand-hover text-brand-foreground">
  Click me
</button>

// ❌ WRONG - Hardcoded success/error colors
<Alert className="bg-green-50 text-green-600">Success!</Alert>
<Alert className="bg-red-50 text-red-600">Error!</Alert>

// ✅ CORRECT - Semantic tokens
<Alert className="bg-success/10 text-success">Success!</Alert>
<Alert className="bg-destructive/10 text-destructive">Error!</Alert>
```

---

## 🔧 Common Patterns

### Loading States

```tsx
// ❌ Wrong
<Skeleton className="bg-gray-200 animate-pulse" />

// ✅ Correct
<Skeleton className="bg-muted animate-pulse" />
```

### Badges

```tsx
// ❌ Wrong
<Badge className="bg-blue-100 text-blue-800">New</Badge>

// ✅ Correct
<Badge className="bg-brand-soft text-brand">New</Badge>
```

### Cards with Accents

```tsx
// ❌ Wrong
<Card className="border-l-4 border-green-500">...</Card>

// ✅ Correct
<Card className="border-l-4 border-success">...</Card>
```

### Status Indicators

```tsx
// ❌ Wrong
const statusColors = {
  success: 'text-green-600',
  warning: 'text-orange-500',
  error: 'text-red-600'
}

// ✅ Correct
const statusColors = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive'
}
```

---

## 📚 Full Token List

### All Available Background Tokens

```
bg-background         // Page background (#faf5ee)
bg-card               // Card backgrounds (#ffffff)
bg-muted              // Muted gray (#ececf0)
bg-accent             // Accent backgrounds (#e9ebef)
bg-brand              // Primary brand (#2563eb)
bg-brand-soft         // Soft brand (#eff6ff)
bg-brand-muted        // Muted brand (#bfdbfe)
bg-brand-hover        // Brand hover (#1d4ed8)
bg-success            // Success green (#16a34a)
bg-warning            // Warning orange (#d97706)
bg-destructive        // Error red (#d4183d)
bg-gold               // Gold accent (#f59e0b)
bg-gold-muted         // Muted gold (#fef3c7)
bg-info               // Info blue (#3b82f6)
bg-accent-violet      // Violet accent (#7c3aed)
bg-surface-elevated   // Elevated surface (#ffffff)
bg-surface-sunken     // Sunken surface (oklch)
```

### All Available Text Tokens

```
text-foreground           // Default text (dark in light mode)
text-muted-foreground     // Secondary text (#5b6a7d)
text-brand                // Brand text (#2563eb)
text-brand-foreground     // Text on brand backgrounds
text-success              // Success text (#16a34a)
text-success-foreground   // Text on success backgrounds
text-warning              // Warning text (#d97706)
text-warning-foreground   // Text on warning backgrounds
text-destructive          // Error text (#d4183d)
text-destructive-foreground // Text on error backgrounds
text-gold                 // Gold text (#f59e0b)
text-gold-foreground      // Text on gold backgrounds
text-info                 // Info text (#3b82f6)
text-accent-violet        // Violet text (#7c3aed)
```

---

## 🎯 Decision Tree

**When choosing a color token, ask:**

1. **Is this a semantic state?**
   - Success → `bg-success` / `text-success`
   - Error → `bg-destructive` / `text-destructive`
   - Warning → `bg-warning` / `text-warning`

2. **Is this brand-related?**
   - Primary CTA → `<Button variant="brand">` (or `bg-brand` for non-Button elements)
   - Secondary brand → `<Button variant="brand-outline">` (or `border-brand text-brand`)
   - Tertiary brand → `<Button variant="brand-ghost">` (or `text-brand`)
   - Brand accents → `bg-brand-soft`
   - Hover states → `hover:bg-brand-hover` (built into variants)

3. **Is this neutral/muted?**
   - Gray backgrounds → `bg-muted`
   - Secondary text → `text-muted-foreground`

4. **Is this special purpose?**
   - Study streaks → `bg-momentum-*`
   - Gold achievements → `bg-gold`
   - Violet accents → `bg-accent-violet`

5. **If none above, check theme.css**
   - Browse `src/styles/theme.css` for full token list
   - Create new token if truly needed (rare)

## Color Scheme Variants

Tokens adapt automatically based on the active color scheme class on `<html>`:

| Token | Professional (default) | Vibrant | Clean |
| ----- | -------------------- | ------- | ----- |
| `bg-background` | `#faf5ee` (warm cream) | inherited | `#f9f9fe` (cool blue-white) |
| `bg-brand` | `#5e6ad2` (purple-blue) | oklch 0.19 chroma | `#005bc1` (Apple blue) |
| `bg-brand-soft` | `#d0d2ee` | oklch 0.08 chroma | `#d8e2ff` |
| `bg-sidebar` | `oklch(0.985)` | inherited | `#ebeef7` (cool gray) |
| `text-foreground` | `#1c1d2b` | inherited | `#2c333d` |
| `text-muted-foreground` | `#656870` | inherited | `#595f6a` |
| Font | DM Sans + Space Grotesk | inherited | Inter |

**Note:** Clean scheme is light-mode only. In dark mode, it inherits the default dark tokens regardless of scheme selection. No code changes needed — just use design tokens and they adapt automatically.

---

## ⚡ Quick Fixes

**Convert existing code:**

```bash
# Find all hardcoded blue colors
grep -r "bg-blue-" src/

# Replace with tokens (example)
# bg-blue-600 → bg-brand
# text-blue-700 → text-brand
# bg-blue-100 → bg-brand-soft
```

**Lint check before commit:**

```bash
npm run lint | grep "design-tokens/no-hardcoded-colors"
```

**Auto-fix safe violations (use with caution):**

```bash
# Not recommended - manual review better
npx eslint src/ --fix --rule 'design-tokens/no-hardcoded-colors: error'
```

---

## 📖 Resources

- **Theme Source:** [src/styles/theme.css](../../src/styles/theme.css)
- **Enforcement Strategy:** [design-token-enforcement-strategy.md](./design-token-enforcement-strategy.md)
- **ESLint Plugin:** [eslint-plugin-design-tokens.js](../../eslint-plugin-design-tokens.js)
- **Project Guidelines:** [CLAUDE.md](../../CLAUDE.md)

---

**Last Updated:** 2026-04-05
**Migration Status:** ✅ All 186 hardcoded colors migrated to design tokens
