# Design Review Agent Configuration

## Architecture Overview

The design review system uses a **dual-mode architecture**:

1. **Playwright MCP Agent** — Interactive browser testing via Claude Code subagent (on-demand reviews)
2. **Playwright Test Specs** — Pre-written automated tests for CI pipeline (GitHub Actions)

```text
┌─────────────────────────────────────────────────┐
│                  /design-review                  │
│              (Slash Command Skill)               │
│        .claude/skills/design-review/SKILL.md     │
└──────────────────────┬──────────────────────────┘
                       │ dispatches to
                       ▼
┌─────────────────────────────────────────────────┐
│             design-review Agent                  │
│         .claude/agents/design-review.md          │
│                                                  │
│  Uses Playwright MCP to control live browser:    │
│  • Navigate pages, click, hover, type            │
│  • Resize viewports, take screenshots            │
│  • Evaluate JS, check accessibility tree         │
│  • Read console messages                         │
└──────────────────────┬──────────────────────────┘
                       │ references
                       ▼
┌─────────────────────────────────────────────────┐
│            Design Principles                     │
│  .claude/workflows/design-review/                │
│  └── design-principles.md                        │
│                                                  │
│  Project-tailored standards:                     │
│  • Colors, spacing, typography tokens            │
│  • Accessibility requirements (WCAG 2.1 AA+)    │
│  • Responsive breakpoints                        │
│  • Component state requirements                  │
└─────────────────────────────────────────────────┘

CI Pipeline (separate path):
┌─────────────────────────────────────────────────┐
│          tests/design-review.spec.ts             │
│                                                  │
│  Pre-written Playwright test specs that run via  │
│  `npx playwright test` in GitHub Actions.        │
│  Fixed checks: screenshots, scroll, touch        │
│  targets, heading hierarchy, ARIA, console.      │
└─────────────────────────────────────────────────┘
```

## Agent Identity

- **Name**: `design-review`
- **Location**: `.claude/agents/design-review.md`
- **Model**: Claude Sonnet 4.5
- **Color**: Pink
- **Persona**: Senior Design QA Engineer — systematic, constructive, evidence-based

## Playwright MCP Tools by Phase

The agent uses these MCP tools during its 7-phase review:

### Phase 0: Context Gathering

| Tool        | Purpose                      |
| ----------- | ---------------------------- |
| `Bash`      | `git status`, `git diff`     |
| `Read`      | Load `design-principles.md`  |
| `TodoWrite` | Create review checklist      |

### Phase 1: Interactive Testing

| Tool                                    | Purpose                       |
| --------------------------------------- | ----------------------------- |
| `mcp__playwright__browser_navigate`     | Go to affected routes         |
| `mcp__playwright__browser_click`        | Test buttons, links, cards    |
| `mcp__playwright__browser_hover`        | Verify hover states           |
| `mcp__playwright__browser_type`         | Test form inputs, search      |
| `mcp__playwright__browser_screenshot`   | Capture visual evidence       |

### Phase 2: Responsive Testing

| Tool                                    | Purpose                                  |
| --------------------------------------- | ---------------------------------------- |
| `mcp__playwright__browser_resize`       | Switch between 1440px, 768px, 375px      |
| `mcp__playwright__browser_screenshot`   | Capture each viewport                    |
| `mcp__playwright__browser_evaluate`     | Check for horizontal scroll              |

### Phase 3: Visual Polish

| Tool                                    | Purpose                                          |
| --------------------------------------- | ------------------------------------------------ |
| `mcp__playwright__browser_evaluate`     | Read computed styles (colors, spacing, radius)    |
| `Grep`                                  | Find hardcoded hex colors, pixel values in code   |

### Phase 4: Accessibility

| Tool                                    | Purpose                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| `mcp__playwright__browser_press_key`    | Tab navigation testing                                   |
| `mcp__playwright__browser_snapshot`     | ARIA tree / semantic HTML audit                          |
| `mcp__playwright__browser_evaluate`     | Contrast ratio computation                               |
| `Grep`                                  | Find `<div onClick>`, missing `alt`, missing `aria-label` |

### Phase 5: Robustness

| Tool                                          | Purpose                              |
| --------------------------------------------- | ------------------------------------ |
| `mcp__playwright__browser_type`               | Test form validation with bad input  |
| `mcp__playwright__browser_console_messages`   | Capture JS errors and warnings       |
| `mcp__playwright__browser_wait`               | Check for layout shifts              |

### Phase 6: Code Health

| Tool   | Purpose                                        |
| ------ | ---------------------------------------------- |
| `Grep` | Find `any` types, wrong imports, inline styles |
| `Read` | Review changed component files                 |
| `Glob` | Find related files                             |

### Phase 7: Report Generation

| Tool         | Purpose                                          |
| ------------ | ------------------------------------------------ |
| Agent output | Structured markdown report with severity triage  |

## Design Standards

All standards are defined in [design-principles.md](design-principles.md). Key tokens:

| Token            | Value            | Usage                            |
| ---------------- | ---------------- | -------------------------------- |
| Background       | `#FAF5EE`        | Page backgrounds (use theme var) |
| Primary          | `blue-600`       | CTAs, active states              |
| Card radius      | `rounded-[24px]` | Card components                  |
| Button radius    | `rounded-xl`     | Buttons                          |
| Input radius     | `rounded-lg`     | Form inputs                      |
| Grid base        | 8px (0.5rem)     | All spacing                      |
| Section gap      | 24px (1.5rem)    | Between major sections           |
| Min touch target | 44x44px          | Mobile interactive elements      |
| Text contrast    | ≥4.5:1           | WCAG AA (3:1 for large text)     |

## Severity Triage

| Level        | When                                                                                       | Action                   |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------ |
| **Blocker**  | WCAG AA violation, broken layout, wrong background color, non-functional elements          | Must fix before merge    |
| **High**     | Missing states, inconsistent spacing, hardcoded tokens, console errors, small touch targets | Should fix before merge  |
| **Medium**   | Minor inconsistencies, suboptimal organization, non-critical perf                          | Fix when possible        |
| **Nitpick**  | Minor tweaks, alternative approaches, future ideas                                         | Optional                 |

## Communication Standards

- **Constructive**: Assume good intent — improvement, not criticism
- **Educational**: Explain *why* issues affect the learning experience
- **Evidence-based**: Screenshots, computed values, line numbers
- **Prioritized**: Severity triage so developers know what matters
- **Positive opening**: Always acknowledge what works before listing issues

## Setup Requirements

### 1. Install Playwright MCP Server

```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```

This registers the Playwright MCP server with Claude Code, making `mcp__playwright__browser_*` tools available.

### 2. Start Development Server

```bash
npm run dev
# Verify: http://localhost:5173 is accessible
```

### 3. Verify MCP Connection

In Claude Code, the agent should be able to call `mcp__playwright__browser_navigate` to open the dev server URL. If tools are not available, check:

```bash
claude mcp list
# Should show "playwright" in the list
```

### 4. Permissions

Add to `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__playwright__*"
    ]
  }
}
```

## Invocation

### Via Slash Command (Recommended)

```bash
/design-review
```

### Via Task Tool (Programmatic)

```typescript
Task({
  subagent_type: "design-review",
  prompt: "Review changes to CourseCard.tsx. Focus on hover states and mobile layout.",
  description: "Design review of course cards"
})
```

### In GitHub Actions (CI Mode)

CI uses the pre-written test specs, not the MCP agent:

```bash
npx playwright test tests/design-review.spec.ts --project=chromium
```

## File Map

| File                                                  | Purpose                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| `.claude/agents/design-review.md`                     | Agent definition with MCP tools and methodology  |
| `.claude/skills/design-review/SKILL.md`               | `/design-review` slash command (thin dispatcher)  |
| `.claude/workflows/design-review/agent-config.md`     | This file — architecture documentation           |
| `.claude/workflows/design-review/design-principles.md` | Project-tailored design standards               |
| `.claude/workflows/design-review/README.md`           | Workflow documentation and setup guide           |
| `tests/design-review.spec.ts`                         | Automated Playwright test specs for CI           |
| `.github/workflows/design-review.yml`                 | GitHub Actions workflow                          |

---

**Version**: 2.0.0
**Last Updated**: 2026-02-15
**Architecture**: Playwright MCP (interactive) + Playwright Test (CI)
