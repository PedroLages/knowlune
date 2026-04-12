---
description: Detailed automation verification commands, effectiveness metrics, and guide for adding new automation. Loaded only when working with automation infrastructure.
paths:
  - "eslint-plugin-*.js"
  - "scripts/git-hooks/**"
  - "scripts/workflow/**"
  - ".claude/agents/**"
  - ".claude/skills/review-story/**"
  - ".claude/hooks/**"
---

# Automation Details

Extended reference for automation infrastructure. Core catalog is in [automation.md](automation.md).

## Verification Commands

```bash
# Test ESLint design token rule
echo 'export const Test = () => <div className="bg-blue-600">Test</div>' > test.tsx
npx eslint test.tsx
# Expected: ERROR - Hardcoded color "bg-blue-600" detected. Use bg-brand...
rm test.tsx

# Run all ESLint checks
npm run lint

# Test safety guardrail hook
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf src/"}}' | bash .claude/hooks/safety-guardrail.sh
# Expected: {"decision":"ask","reason":"..."}

# Install git hooks (one-time, hooks not version-controlled)
cp scripts/git-hooks/pre-review .git/hooks/pre-review && chmod +x .git/hooks/pre-review
cp scripts/git-hooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push
.git/hooks/pre-review  # Expected: ✅ Working tree is clean

# Emergency bypass (document reason if used)
SKIP_PRE_REVIEW=1 /review-story
```

## Agent Report Locations

- Design reviews: `docs/reviews/design/design-review-{date}-{story-id}.md`
- Code reviews: `docs/reviews/code/code-review-{date}-{story-id}.md`
- Test coverage: `docs/reviews/code/code-review-testing-{date}-{story-id}.md`
- Performance: `docs/reviews/performance/performance-benchmark-{date}-{story-id}.md`
- Security: `docs/reviews/security/security-review-{date}-{story-id}.md`
- Exploratory QA: `docs/reviews/qa/exploratory-qa-{date}-{story-id}.md`

## Effectiveness Metrics

**Industry Baseline** (Easy Agile research):
- Manual compliance: 40-50% follow-through
- Automated enforcement: 65% (+45% improvement)

**Knowlune Baseline (Epic 7):** Hardcoded colors 80%, empty lessons learned 40%, avg 2-3 review rounds.
**Target (Epic 8+):** Hardcoded colors <10%, avg 1-2 review rounds.

**Full Status Report:** [automation-infrastructure-status-2026-03-13.md](../../../docs/implementation-artifacts/automation-infrastructure-status-2026-03-13.md)

## Adding New Automation

1. **Choose stage**: Save-time (ESLint, instant), Commit-time (git hook, high friction), Review-time (agent, moderate friction)
2. **Document**: Add row to table in `automation.md`, include test command
3. **Verify**: Track metric before/after, measure across 2-3 epics
4. **Update**: Add to `automation-infrastructure-status-*.md` and `engineering-patterns.md` if pattern-based
