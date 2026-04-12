# Automated Quality Enforcement

**This file is always loaded (universal rule - no path restrictions).**

Knowlune uses 11 automated mechanisms to enforce code quality and process compliance at three stages: **save-time** (IDE feedback), **commit-time** (git hooks), and **review-time** (AI agents). These catch issues early, reducing review rounds from 2-3 (Epic 7 baseline) to 1-2 (Epic 8+ target).

**Status Report:** See [automation-infrastructure-status-2026-03-13.md](../../../docs/implementation-artifacts/automation-infrastructure-status-2026-03-13.md) for verification, test results, and effectiveness metrics.

## 🔴 Save-Time Enforcement (ESLint - Real-Time IDE Feedback)

These rules provide **instant feedback** as you type/save — catching issues before commit or review.

| Rule | What It Catches | Severity | File |
|------|----------------|----------|------|
| `design-tokens/no-hardcoded-colors` | Hardcoded colors: `bg-blue-600` → suggests `bg-brand` | ERROR | [eslint-plugin-design-tokens.js](../../../eslint-plugin-design-tokens.js) |
| `test-patterns/deterministic-time` | `Date.now()`, `new Date()` in tests → suggests `FIXED_DATE` | ERROR | [eslint-plugin-test-patterns.js](../../../eslint-plugin-test-patterns.js) |
| `test-patterns/no-hard-waits` | `waitForTimeout()` without justification comment | WARNING | [eslint-plugin-test-patterns.js](../../../eslint-plugin-test-patterns.js) |
| `test-patterns/use-seeding-helpers` | Manual IndexedDB seeding → suggests shared helpers | WARNING | [eslint-plugin-test-patterns.js](../../../eslint-plugin-test-patterns.js) |
| `react-hooks-async/async-cleanup` | Missing `await` in useEffect cleanup functions | ERROR | [eslint-plugin-react-hooks-async.js](../../../eslint-plugin-react-hooks-async.js) |
| `import-paths/correct-utils-import` | Wrong import path for `cn()` utility | ERROR | [eslint-plugin-import-paths.js](../../../eslint-plugin-import-paths.js) |
| `react-best-practices/no-inline-styles` | Inline style objects → suggests Tailwind utilities | WARNING | [eslint-plugin-react-best-practices.js](../../../eslint-plugin-react-best-practices.js) |
| `error-handling/no-silent-catch` | Catch blocks without `toast.error()` or visible user feedback | WARNING | [eslint-plugin-error-handling.js](../../../eslint-plugin-error-handling.js) |

**Configuration:** [eslint.config.js](../../../eslint.config.js) — See [automation-details.md](automation-details.md) for test commands and metrics.

## 🔵 Always-On Hooks (Claude Code Settings)

Session-scoped hooks that warn before destructive operations. Active in every Claude Code session via `.claude/settings.json`.

| Hook | What It Catches | Response | File |
|------|----------------|----------|------|
| `safety-guardrail` | `rm -rf` (non-build), `DROP TABLE`, `git push --force`, `git reset --hard`, `git checkout .`, `git clean -f` | ASK (user confirms) | [.claude/hooks/safety-guardrail.sh](../../hooks/safety-guardrail.sh) |

**Safe exceptions** (allowed without warning): `rm -rf` of build artifacts (node_modules, dist, .next, .cache, build, .turbo, coverage, playwright-report, test-results).

**Configuration:** [.claude/settings.json](../../settings.json)

## 🟡 Commit-Time Enforcement (Git Hooks)

These hooks **block operations** if quality gates fail — ensuring clean working tree and committed code.

| Hook | What It Blocks | Installation | File |
|------|---------------|--------------|------|
| `pre-review` | `/review-story` if uncommitted changes or untracked files | Manual (see below) | [scripts/git-hooks/pre-review](../../../scripts/git-hooks/pre-review) |
| `pre-push` | `git push` if working tree is dirty | Manual (see below) | [scripts/git-hooks/pre-push](../../../scripts/git-hooks/pre-push) |

**Installation & emergency bypass**: See [automation-details.md](automation-details.md).

## 🟢 Review-Time Enforcement (Claude Agents)

These agents provide **deep analysis** during `/review-story` — catching issues ESLint can't detect (architecture, UX, edge cases).

| Agent | What It Reviews | Severity Levels | File |
|-------|----------------|----------------|------|
| `design-review` | UI/UX via Playwright browser automation (mobile/tablet/desktop) | BLOCKER/HIGH/MEDIUM/LOW | [.claude/agents/design-review.md](../../agents/design-review.md) |
| `code-review` | Architecture, security, silent failures, test anti-patterns | BLOCKER/HIGH/MEDIUM/LOW | [.claude/agents/code-review.md](../../agents/code-review.md) |
| `code-review-testing` | Acceptance criteria coverage, test quality, edge cases | ADVISORY (gaps reported) | [.claude/agents/code-review-testing.md](../../agents/code-review-testing.md) |
| `performance-benchmark` | Real browser page metrics (TTFB, FCP, LCP, DOM Complete) via Playwright MCP | HIGH/MEDIUM (regressions) | [.claude/agents/performance-benchmark.md](../../agents/performance-benchmark.md) |
| `security-review` | OWASP Top 10, secrets scan, STRIDE, attack surface (diff-scoped) | BLOCKER/HIGH/MEDIUM/INFO | [.claude/agents/security-review.md](../../agents/security-review.md) |
| `exploratory-qa` | Functional QA via Playwright MCP — buttons, forms, flows, console errors | BLOCKER/HIGH/MEDIUM/LOW | [.claude/agents/exploratory-qa.md](../../agents/exploratory-qa.md) |
| `techdebt-scan` | Deduplication scan via `/techdebt` Phase 1-2 (optional — user confirms extraction) | ADVISORY (opportunities reported) | [.claude/skills/techdebt/SKILL.md](../../../.claude/skills/techdebt/SKILL.md) |
| `openai-code-review` | Adversarial review via OpenAI Codex CLI (optional — requires Codex CLI + OPENAI_API_KEY) | BLOCKER/HIGH/MEDIUM/NIT | [.claude/agents/openai-code-review.md](../../agents/openai-code-review.md) |
| `glm-code-review` | Adversarial review via GLM/z.ai GLM-5.1 (optional — requires ZAI_API_KEY) | BLOCKER/HIGH/MEDIUM/NIT | [.claude/agents/glm-code-review.md](../../agents/glm-code-review.md) |

**Trigger:** `/review-story` dispatches all agents in parallel (tiered by diff scope). Reports saved to `docs/reviews/{type}/`. See [automation-details.md](automation-details.md) for full report locations.

## 📊 Automation Coverage Summary

| Stage | Rules | Catches | When |
|-------|-------|---------|------|
| **Save-Time** | 8 ESLint rules | Hardcoded colors, test anti-patterns, async cleanup, imports, silent catches | As you type/save in IDE |
| **Always-On** | 1 Claude Code hook | Destructive commands (rm -rf, force push, hard reset) | Every Claude Code session |
| **Commit-Time** | 2 git hooks | Dirty working tree, uncommitted changes | Before `/review-story` or `git push` |
| **Review-Time** | 6 Claude agents + 1 optional dedup scan + 2 optional external model agents | Architecture, UX, accessibility, edge cases, AC coverage, performance, security, functional QA, deduplication, cross-model consensus | During `/review-story` workflow |
| **Total** | **20 mechanisms** | 11 automated + 6 required agents + 3 optional agents | Multi-layered enforcement |

## 📚 References

- **Verification commands & metrics**: [automation-details.md](automation-details.md)
- **Full Status Report:** [automation-infrastructure-status-2026-03-13.md](../../../docs/implementation-artifacts/automation-infrastructure-status-2026-03-13.md)
- **Engineering Patterns:** [engineering-patterns.md](../../../docs/engineering-patterns.md)
- **Design Token Cheat Sheet:** [design-token-cheat-sheet.md](../../../docs/implementation-artifacts/design-token-cheat-sheet.md)
- **Test Quality Standards:** [_bmad/tea/testarch/knowledge/test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md)
