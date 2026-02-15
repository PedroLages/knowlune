# Design Review Workflow

Automated design quality assurance for the LevelUp e-learning platform. Uses **Playwright MCP** for live, interactive browser testing — the agent navigates pages, clicks elements, resizes viewports, and captures screenshots directly.

## Architecture

**Dual-mode system:**

1. **Playwright MCP Agent** (interactive) — Claude Code subagent controls a live browser via MCP tools. Used for on-demand `/design-review` reviews during development.
2. **Playwright Test Specs** (CI) — Pre-written `tests/design-review.spec.ts` runs in GitHub Actions for automated PR checks.

### File Structure

```text
.claude/
├── agents/
│   └── design-review.md              # MCP-powered agent definition (core)
├── skills/
│   └── design-review/
│       └── SKILL.md                   # /design-review slash command (dispatcher)
└── workflows/
    └── design-review/
        ├── README.md                  # This file
        ├── design-principles.md       # Project-tailored design standards
        └── agent-config.md            # Architecture + MCP tool reference

tests/
└── design-review.spec.ts             # Automated Playwright tests for CI
```

## Setup

### 1. Install Playwright MCP Server

```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```

Verify it registered:

```bash
claude mcp list
# Should show "playwright" with browser_navigate, browser_screenshot, etc.
```

### 2. Permissions

The MCP tools are already allowed in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__playwright__*"
    ]
  }
}
```

### 3. Start Dev Server

```bash
npm run dev
# Verify: http://localhost:5173 loads the app
```

## Usage

### On-Demand Review (Development)

```bash
/design-review
```

The agent will:

1. Check `git diff` for changed UI files
2. Load design standards from `design-principles.md`
3. Navigate to affected pages in a live browser
4. Test interactions (click, hover, type, keyboard navigation)
5. Resize viewport to 1440px, 768px, 375px and screenshot each
6. Audit accessibility (ARIA tree, contrast, focus indicators)
7. Search code for anti-patterns (hardcoded colors, missing types)
8. Generate a severity-triaged report

### CI Pipeline (Pull Requests)

GitHub Actions runs the pre-written test specs:

```bash
npx playwright test tests/design-review.spec.ts --project=chromium
```

This covers fixed checks: viewport screenshots, horizontal scroll, touch targets, heading hierarchy, ARIA labels, console errors, and background color.

## What the Agent Tests

### Visual Consistency

- Background color matches `#FAF5EE`
- Border radius follows component rules (`rounded-[24px]` cards, `rounded-xl` buttons)
- Spacing uses 8px grid (multiples of 0.5rem)
- No hardcoded hex colors in source code

### Responsive Design

- **Desktop (1440px)**: 3-4 column grid, persistent sidebar
- **Tablet (768px)**: 2-column grid, collapsible sidebar
- **Mobile (375px)**: Single column, no horizontal scroll, touch targets >= 44px

### Accessibility (WCAG 2.1 AA+)

- Text contrast >= 4.5:1 (3:1 for large text)
- Keyboard navigation via Tab/Enter/Escape
- ARIA labels on icon-only buttons
- Semantic HTML (nav, main, article, heading hierarchy)
- `prefers-reduced-motion` respected

### Interaction Quality

- Hover, focus, active, disabled states on interactive elements
- Loading states for async operations
- Error states with recovery guidance
- Form validation with specific error messages

### Code Health

- TypeScript props interfaces defined
- `@/` import alias used consistently
- Tailwind utilities (no inline styles)
- No console errors or React warnings

## Report Format

The agent generates a structured report with:

- **Executive Summary**: 2-3 sentence overview
- **Severity-triaged findings**:
  - Blockers — must fix before merge (WCAG violations, broken layouts)
  - High — should fix (missing states, hardcoded tokens, console errors)
  - Medium — fix when possible (minor inconsistencies)
  - Nitpicks — optional polish
- **What works well**: Positive feedback first
- **Detailed findings**: File paths, line numbers, screenshots, suggestions
- **Accessibility checklist**: Pass/fail table
- **Responsive verification**: Status at each viewport
- **Recommendations**: Prioritized next steps

## Troubleshooting

### "Playwright MCP tools not available"

```bash
# Verify MCP server is registered
claude mcp list

# If missing, add it
claude mcp add playwright -- npx @playwright/mcp@latest
```

### "Cannot connect to localhost:5173"

```bash
# Start the dev server
npm run dev

# Or check if another process is using port 5173
lsof -ti:5173
```

### "Permission denied for MCP tools"

Add to `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": ["mcp__playwright__*"]
  }
}
```

### "CI tests failing but MCP review works"

CI uses `tests/design-review.spec.ts` (different from MCP agent). Check:

```bash
npx playwright test tests/design-review.spec.ts --project=chromium --reporter=list
```

## Customization

### Design Standards

Edit [design-principles.md](design-principles.md) to update project standards. The agent loads this file at the start of every review.

### Agent Behavior

Edit [.claude/agents/design-review.md](../../agents/design-review.md) to modify:

- Review phases and methodology
- Design token quick reference
- Severity triage rules
- Report template

### Slash Command

Edit [.claude/skills/design-review/SKILL.md](../../skills/design-review/SKILL.md) to change dispatch behavior or pre-flight checks.

## Resources

- [Design Principles](design-principles.md) — Full design standards
- [Agent Config](agent-config.md) — Architecture and MCP tool reference
- [Playwright MCP](https://github.com/anthropics/claude-code) — MCP server documentation
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

---

**Version**: 2.0.0
**Last Updated**: 2026-02-15
**Architecture**: Playwright MCP (interactive) + Playwright Test (CI)
