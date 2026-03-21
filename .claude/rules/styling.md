# Styling System

**This file is always loaded (universal rule - no path restrictions).**

## Tailwind CSS v4

**Important distinctions from v3:**
- Uses `@tailwindcss/vite` plugin (no separate PostCSS config needed)
- Source scanning via `@source` directive in [src/styles/tailwind.css](../../../src/styles/tailwind.css)
- Custom theme tokens in [src/styles/theme.css](../../../src/styles/theme.css) using CSS variables
- Includes `tw-animate-css` for animation utilities

**Theme System**: Uses CSS custom properties for light/dark mode with OKLCH color space. All theme tokens defined in `--color-*` variables.

**Critical Note**: React and Tailwind plugins are both required in vite.config.ts even if Tailwind isn't actively being modified - do not remove them.

## Design Token System

**CRITICAL:** Never use hardcoded Tailwind colors. Always use design tokens from [src/styles/theme.css](../../../src/styles/theme.css).

### Quick Reference

| Use Case | ❌ Wrong | ✅ Correct |
|----------|---------|-----------|
| Primary brand color | `bg-blue-600` | `bg-brand` |
| Hover state | `hover:bg-blue-700` | `hover:bg-brand-hover` |
| Soft background | `bg-blue-100` | `bg-brand-soft` |
| Success states | `text-green-600` | `text-success` |
| Error states | `text-red-500` | `text-destructive` |
| Muted text | `text-gray-500` | `text-muted-foreground` |
| Warning states | `text-orange-500` | `text-warning` |
| Brand text on soft bg | `text-brand` on `bg-brand-soft` | `text-brand-soft-foreground` on `bg-brand-soft` |

**Brand Color Contrast Rules (WCAG AA):**
- **Buttons**: Use `variant="brand"` — never `className="bg-brand"` on `<Button>` (missing foreground token)
- **Soft badges/labels**: Use `text-brand-soft-foreground` (not `text-brand`) on `bg-brand-soft` backgrounds
- **Why separate tokens**: `--brand` is dark enough for white text buttons but too dark for text-on-dark-soft backgrounds. `--brand-soft-foreground` is a lighter variant that passes 4.5:1 contrast on `bg-brand-soft` in dark mode.

**Why Design Tokens Matter:**
- Support automatic light/dark mode switching
- Enable theme consistency across the app
- Allow global color changes from a single location
- Prevent tech debt accumulation

**Enforcement:**
- ESLint rule `design-tokens/no-hardcoded-colors` blocks hardcoded colors at save-time
- See [automation.md](automation.md) for complete enforcement details
- References:
  - [design-token-cheat-sheet.md](../../../docs/implementation-artifacts/design-token-cheat-sheet.md)
  - [design-token-enforcement-strategy.md](../../../docs/implementation-artifacts/design-token-enforcement-strategy.md)

## UI Component Library

50+ shadcn/ui components in [src/app/components/ui/](../../../src/app/components/ui/) including:
- Form controls (Input, Button, Select, Checkbox, Radio, Switch, Slider)
- Layout (Card, Tabs, Accordion, Separator, Scroll Area, Resizable)
- Overlays (Dialog, Sheet, Popover, Tooltip, Hover Card, Alert Dialog, Drawer)
- Navigation (Navigation Menu, Breadcrumb, Pagination, Command)
- Data display (Avatar, Badge, Calendar, Chart, Progress, Table)
- Advanced (Date Picker with date-fns, Carousel with Embla, Toast with Sonner)

All components follow shadcn/ui patterns with Radix UI primitives and class-variance-authority for variants.

**Brand Button Variants**: Use `variant="brand"` instead of manual `bg-brand` className overrides on `<Button>`:
- `variant="brand"` — solid brand CTA (Submit, Start, primary actions)
- `variant="brand-outline"` — outlined brand (secondary actions paired with brand CTA)
- `variant="brand-ghost"` — ghost brand (tertiary actions)
- For non-Button elements, use classes directly: `bg-brand text-brand-foreground hover:bg-brand-hover`

## Design Principles

**Core spacing and styling:**
- Background: `#FAF5EE` (warm off-white) - never hardcode
- Primary blue: `blue-600` for CTAs and active states
- Border radius: `rounded-[24px]` for cards, `rounded-xl` for buttons
- Spacing: 8px base grid (use multiples of 0.5rem via Tailwind)
- Typography: System fonts, line-height 1.5-1.7
- Consistent 24px (1.5rem) margins between major sections

**Accessibility Requirements:**
- WCAG 2.1 AA+ minimum
- 4.5:1 contrast for text, 3:1 for large text
- Keyboard navigable, proper ARIA labels
- Semantic HTML (nav, main, button vs div)

**Responsive Design:**
- Mobile-first approach
- Breakpoints: 640px, 1024px, 1536px
- Touch targets ≥44x44px on mobile
