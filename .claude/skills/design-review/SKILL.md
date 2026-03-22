---
name: design-review
description: Use when reviewing UI/UX changes to React components, pages, or styles to validate design consistency, accessibility compliance (WCAG 2.1 AA+), responsive behavior, and adherence to design system standards through live Playwright MCP browser testing
---

# design-review

Comprehensive design review for front-end UI changes in the Knowlune e-learning platform.

## Behavior

When invoked, dispatch to the `design-review` agent which uses **Playwright MCP** to interactively test the live application in a real browser.

### What the Agent Does

1. **Git Analysis**: Runs `git status` and `git diff` to identify changed UI files
2. **Loads Standards**: Reads `.claude/workflows/design-review/design-principles.md`
3. **Live Browser Testing**: Navigates to `http://localhost:5173`, clicks elements, hovers, types — directly controlling the browser via Playwright MCP
4. **Responsive Validation**: Resizes the browser to 1440px, 768px, and 375px — takes screenshots at each
5. **Accessibility Audit**: Tests keyboard navigation (Tab, Enter, Escape), checks ARIA tree via snapshots, evaluates contrast ratios
6. **Code Health**: Searches for anti-patterns (hardcoded colors, missing types, accessibility gaps)
7. **Generates Report**: Severity-triaged findings (Blockers → Nitpicks) with screenshots, line numbers, and actionable suggestions

### Dispatch Instructions

Use the Task tool to invoke the agent:

```
Task({
  subagent_type: "design-review",
  prompt: "<context about what changed and what to focus on>",
  description: "Design review"
})
```

### Pre-Flight Checklist

Before dispatching, verify:

1. **Dev server running**: Check `lsof -ti:5173` — if not running, start with `npm run dev &`
2. **Playwright MCP available**: The `mcp__playwright__browser_navigate` tool must be accessible
3. **Git changes exist**: Run `git status` to confirm there are UI changes to review

### Providing Context

When dispatching, include relevant context in the prompt:

- Which files changed (from `git diff --name-only`)
- Which routes are affected (map files → routes using the agent's route map)
- Any specific focus areas the user mentioned (e.g., "focus on accessibility" or "check mobile layout")

### Output

The agent returns a structured markdown report with:

- Executive summary
- Severity-triaged findings (Blockers, High, Medium, Nitpicks)
- What works well (positive feedback)
- Detailed findings with file paths, line numbers, screenshots, and suggestions
- Accessibility checklist (pass/fail table)
- Responsive verification at 3 viewports
- Prioritized recommendations

## Example Usage

```
User: /design-review

# Claude Code:
# 1. Checks git status for changed files
# 2. Verifies dev server is running
# 3. Dispatches to design-review agent via Task tool
# 4. Agent controls live browser, takes screenshots, tests interactions
# 5. Returns comprehensive design review report
```

## Architecture

- **Agent definition**: `.claude/agents/design-review.md` — full methodology and MCP tool usage
- **Design standards**: `.claude/workflows/design-review/design-principles.md` — project-tailored tokens and rules
- **Agent config**: `.claude/workflows/design-review/agent-config.md` — architecture documentation
- **CI test specs**: `tests/design-review.spec.ts` — automated Playwright tests for CI pipeline (separate from MCP agent)

## Notes

- The agent uses **Playwright MCP** (live browser control), not `npx playwright test` (pre-written specs)
- CI pipeline continues to use `tests/design-review.spec.ts` for automated checks
- The dev server must be running at `http://localhost:5173` before the agent starts
- Screenshots are taken interactively — the agent decides what to capture based on what it finds
