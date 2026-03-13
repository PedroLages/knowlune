---
paths:
  - "src/app/pages/**/*.tsx"
  - "src/app/components/**/*.tsx"
  - "src/styles/**/*.css"
  - "src/styles/**/*.ts"
  - ".claude/workflows/design-review/**/*.md"
---

# Design Review Workflow

**This file is loaded ONLY when working with UI code (path-specific rule).**

Automated UI/UX quality assurance using Playwright browser automation.

## When Required

- Any changes to UI components (`.tsx` files in `components/`)
- Page-level modifications (`src/app/pages/`)
- Styling changes (`tailwind.css`, `theme.css`, component styles)
- New component additions or significant refactors

## How to Trigger

1. **Manual Review**: Run `/design-review` slash command in Claude Code
2. **Automated PR Review**: GitHub Actions automatically reviews PRs with UI changes

## Process

After implementing UI changes, the design review agent:

1. **Analyzes Changes**: Reviews `git diff` to identify modified files
2. **Loads Standards**: Consults [.claude/workflows/design-review/design-principles.md](../../workflows/design-review/design-principles.md)
3. **Live Testing**: Uses Playwright to test at mobile (375px), tablet (768px), desktop (1440px)
4. **Interaction Testing**: Verifies hover, focus, active states work correctly
5. **Accessibility Audit**: Validates WCAG 2.1 AA+ compliance (contrast, keyboard nav, ARIA)
6. **Responsive Validation**: Ensures layouts work across all breakpoints
7. **Code Quality**: Reviews React/TypeScript best practices and Tailwind usage
8. **Generates Report**: Provides severity-triaged findings (Blockers → Nitpicks)

## Quick Checklist

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

## Resources

- **Design Principles**: [.claude/workflows/design-review/design-principles.md](../../workflows/design-review/design-principles.md)
- **Agent Config**: [.claude/workflows/design-review/agent-config.md](../../workflows/design-review/agent-config.md)
- **Slash Command Skill**: [.claude/skills/design-review.md](../../skills/design-review.md)
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

## Best Practices

1. **Run Early**: Use `/design-review` during development, not just before PR
2. **Address Blockers**: Fix all 🔴 Blocker findings before requesting review
3. **Learn Patterns**: Review `design-principles.md` to internalize standards
4. **Iterate**: Use agent feedback to improve, then re-review
5. **Include Screenshots**: Add generated screenshots to PR descriptions
