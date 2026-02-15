# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LevelUp is a personal learning platform featuring progress tracking, study streaks, course management, and achievement analytics. Originally designed from Figma wireframes, it's evolved into a comprehensive learning dashboard with seven main sections: Overview, My Class, Courses, Messages, Instructors, Reports, and Settings.

Original Figma design: https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes (design foundation)

## Development Commands

- `npm i` - Install dependencies
- `npm run dev` - Start Vite development server (default: http://localhost:5173)
- `npm run build` - Build production bundle with Vite

## Architecture

### Tech Stack

- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 6.3.5
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- **Routing**: React Router v7
- **UI Components**: shadcn/ui components (Radix UI primitives)
- **Icons**: Lucide React

### File Structure

```
src/
├── main.tsx                    # App entry point
├── app/
│   ├── App.tsx                 # Root component with RouterProvider
│   ├── routes.tsx              # React Router configuration
│   ├── components/
│   │   ├── Layout.tsx          # Main layout with sidebar + header
│   │   ├── figma/              # Custom Figma-exported components
│   │   └── ui/                 # shadcn/ui component library (~50 components)
│   └── pages/                  # Route page components
│       ├── Overview.tsx
│       ├── MyClass.tsx
│       ├── Courses.tsx
│       ├── Messages.tsx
│       ├── Instructors.tsx
│       ├── Reports.tsx
│       └── Settings.tsx
└── styles/
    ├── index.css               # Main CSS entry (imports all styles)
    ├── tailwind.css            # Tailwind v4 configuration
    ├── theme.css               # CSS custom properties for theming
    └── fonts.css               # Font definitions
```

### Import Alias

The `@` alias resolves to `./src` (configured in vite.config.ts):
```typescript
import { Button } from '@/app/components/ui/button'
```

### Routing Architecture

React Router v7 with nested routes. Layout component wraps all pages and provides:
- Left sidebar navigation with active state management
- Top header with search bar, notifications, and user profile
- Main content area via `<Outlet />`

All routes defined in [src/app/routes.tsx](src/app/routes.tsx).

### Styling System

**Tailwind CSS v4** with important distinctions from v3:
- Uses `@tailwindcss/vite` plugin (no separate PostCSS config needed)
- Source scanning via `@source` directive in [src/styles/tailwind.css](src/styles/tailwind.css)
- Custom theme tokens in [src/styles/theme.css](src/styles/theme.css) using CSS variables
- Includes `tw-animate-css` for animation utilities

**Theme System**: Uses CSS custom properties for light/dark mode with OKLCH color space. All theme tokens defined in `--color-*` variables.

**Critical Note**: React and Tailwind plugins are both required in vite.config.ts even if Tailwind isn't actively being modified - do not remove them.

### UI Component Library

50+ shadcn/ui components in [src/app/components/ui/](src/app/components/ui/) including:
- Form controls (Input, Button, Select, Checkbox, Radio, Switch, Slider)
- Layout (Card, Tabs, Accordion, Separator, Scroll Area, Resizable)
- Overlays (Dialog, Sheet, Popover, Tooltip, Hover Card, Alert Dialog, Drawer)
- Navigation (Navigation Menu, Breadcrumb, Pagination, Command)
- Data display (Avatar, Badge, Calendar, Chart, Progress, Table)
- Advanced (Date Picker with date-fns, Carousel with Embla, Toast with Sonner)

All components follow shadcn/ui patterns with Radix UI primitives and class-variance-authority for variants.

### Design Tokens

Primary colors and spacing:
- Background: `#FAF5EE` (warm off-white)
- Primary blue: `blue-600` for CTAs and active states
- Border radius: `rounded-[24px]` for cards, `rounded-xl` for buttons
- Spacing: Consistent 24px (1.5rem) margins between major sections

## Key Conventions

- Page components are route-level components in [src/app/pages/](src/app/pages/)
- Reusable UI components live in [src/app/components/ui/](src/app/components/ui/)
- Custom Figma components in [src/app/components/figma/](src/app/components/figma/)
- All styling uses Tailwind utility classes
- Icons from lucide-react
- Images primarily from Unsplash (see ATTRIBUTIONS.md)

## Design Review Workflow

### Automated Design Quality Assurance

This project uses an automated design review workflow to ensure UI/UX consistency, accessibility compliance, and adherence to design standards. The workflow leverages Claude Code agents and Playwright browser automation for comprehensive visual testing.

### When to Use Design Review

**Required Before Merge:**
- Any changes to UI components (`.tsx` files in `components/`)
- Page-level modifications (`src/app/pages/`)
- Styling changes (`tailwind.css`, `theme.css`, component styles)
- New component additions or significant refactors

**How to Trigger:**
1. **Manual Review**: Run `/design-review` slash command in Claude Code
2. **Automated PR Review**: GitHub Actions automatically reviews PRs with UI changes

### Design Review Process

After implementing UI changes, the design review agent:

1. **Analyzes Changes**: Reviews `git diff` to identify modified files
2. **Loads Standards**: Consults [.claude/workflows/design-review/design-principles.md](.claude/workflows/design-review/design-principles.md)
3. **Live Testing**: Uses Playwright to test at mobile (375px), tablet (768px), desktop (1440px)
4. **Interaction Testing**: Verifies hover, focus, active states work correctly
5. **Accessibility Audit**: Validates WCAG 2.1 AA+ compliance (contrast, keyboard nav, ARIA)
6. **Responsive Validation**: Ensures layouts work across all breakpoints
7. **Code Quality**: Reviews React/TypeScript best practices and Tailwind usage
8. **Generates Report**: Provides severity-triaged findings (Blockers → Nitpicks)

### Design Standards Reference

**Core Design Principles** (see [design-principles.md](.claude/workflows/design-review/design-principles.md) for full details):

- **Background**: Always `#FAF5EE` (warm off-white) - never hardcode
- **Primary Color**: `blue-600` for CTAs and active states
- **Spacing**: 8px base grid (use multiples of 0.5rem via Tailwind)
- **Border Radius**: `rounded-[24px]` for cards, `rounded-xl` for buttons/inputs
- **Typography**: System fonts, line-height 1.5-1.7, no center-aligned body text
- **Accessibility**: WCAG 2.1 AA+ minimum (4.5:1 contrast for text, keyboard navigable, proper ARIA)
- **Responsive**: Mobile-first design, breakpoints at 640px, 1024px, 1536px
- **Component States**: All interactive elements need hover, focus, active, disabled states

### Design Review Checklist

Before creating PRs with UI changes, verify:

**Visual Consistency:**
- [ ] Uses theme tokens from `theme.css` (no hardcoded colors)
- [ ] Follows 8px spacing grid
- [ ] Border radius matches component type
- [ ] Typography hierarchy clear

**Interaction Quality:**
- [ ] All interactive elements have hover states
- [ ] Focus indicators visible for keyboard navigation
- [ ] Active/pressed states provide feedback
- [ ] Animations smooth (150-500ms) and respect `prefers-reduced-motion`

**Accessibility (WCAG 2.1 AA+):**
- [ ] Text contrast ≥4.5:1 (3:1 for large text)
- [ ] All functionality keyboard accessible
- [ ] ARIA labels on icon-only buttons
- [ ] Form labels properly associated with inputs
- [ ] Semantic HTML (nav, main, button vs div)

**Responsive Design:**
- [ ] Tested at 375px (mobile), 768px (tablet), 1440px (desktop)
- [ ] No horizontal scroll on mobile
- [ ] Touch targets ≥44x44px
- [ ] Sidebar behavior correct (persistent desktop, collapsible mobile)

**Code Quality:**
- [ ] TypeScript interfaces for props
- [ ] No console errors or warnings
- [ ] Tailwind utilities (no inline styles or hardcoded values)
- [ ] Imports use `@/` alias
- [ ] Components in correct directory

### Using the `/design-review` Command

```bash
# In Claude Code, run:
/design-review

# The agent will:
# 1. Check git status and diff
# 2. Launch Playwright browser automation
# 3. Test affected pages at all viewports
# 4. Generate comprehensive report with:
#    - Severity-triaged findings (🔴 Blockers → ⚪ Nitpicks)
#    - Screenshots at 1440px desktop viewport
#    - Specific file paths and line numbers
#    - Accessibility audit results
#    - Responsive design verification
#    - Prioritized recommendations
```

### GitHub Actions Integration

PRs with UI changes are automatically reviewed via `.github/workflows/design-review.yml`. The workflow:
- Triggers on PRs modifying `.tsx`, `.css`, or styling files
- Runs Playwright tests in headless mode
- Posts review findings as PR comment
- Tags PR with severity labels (blocker, high-priority, etc.)

### Resources

- **Design Principles**: [.claude/workflows/design-review/design-principles.md](.claude/workflows/design-review/design-principles.md)
- **Agent Config**: [.claude/workflows/design-review/agent-config.md](.claude/workflows/design-review/agent-config.md)
- **Slash Command Skill**: [.claude/skills/design-review.md](.claude/skills/design-review.md)
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

### Best Practices

1. **Run Early**: Use `/design-review` during development, not just before PR
2. **Address Blockers**: Fix all 🔴 Blocker findings before requesting review
3. **Learn Patterns**: Review `design-principles.md` to internalize standards
4. **Iterate**: Use agent feedback to improve, then re-review
5. **Include Screenshots**: Add generated screenshots to PR descriptions
