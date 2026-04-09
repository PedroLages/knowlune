# Consolidated Reporting

This module defines finding aggregation, deduplication, severity triage, verdict determination, and completion output templates.

## Overview

After all agents complete, consolidate findings into a single severity-triaged report that drives the PASS/BLOCKED decision.

**State Inputs**: All agent report paths, `review_gates_passed` array
**State Outputs**: `blocker_count` integer, `verdict` (PASS/BLOCKED), consolidated report markdown

## Report Generation

**Use the `generate-report.py` script** for template-driven report generation:

```bash
python3 scripts/workflow/generate-report.py \
  --findings=.claude/state/review-story/consolidated-findings-$STORY_ID.json \
  --run-state=.claude/state/review-story/review-run-$STORY_ID.json \
  --gates-config=.claude/skills/review-story/config/gates.json \
  --output=docs/reviews/consolidated-review-{date}-$STORY_ID.md
```

**Input files:**

- `consolidated-findings-$STORY_ID.json`: Output from `merge-agent-results.py` with deduplicated findings
- `review-run-$STORY_ID.json`: Runtime state from `checkpoint.sh` with gate statuses
- `gates.json`: Canonical gate definitions for validation

**Output:** Severity-triaged markdown report with all agent sections.

## Consolidated Report Structure

The generated report includes:

```markdown
## Review Summary: E##-S## — [Story Name]

### Pre-checks
- Dependency audit: [clean/N warnings]
- Format check: [pass/auto-fixed N files/fail]
- Lint: [pass/fail/skipped]
- Type check: [pass/auto-fixed/fail]
- Build: [pass/fail]
- Unit tests: [pass/fail/skipped] ([N] tests)
- E2E tests: [pass/fail/skipped] ([N] tests)

### Design Review
[Summary or "Skipped — no UI changes" or "Reused from previous run — [path]"]
Report: docs/reviews/design/design-review-{date}-{id}.md

### Code Review (Architecture)
[Summary with finding counts by severity or "Reused from previous run — [path]"]
Report: docs/reviews/code/code-review-{date}-{id}.md

### Code Review (Testing)
[AC coverage summary: N/N ACs covered, N gaps. Finding counts by severity or "Reused from previous run — [path]"]
Report: docs/reviews/code/code-review-testing-{date}-{id}.md

### Consolidated Findings

#### Blockers (must fix)
- [Source]: [Finding]

#### High Priority (should fix)
- [Source]: [Finding]

#### Medium (fix when possible)
- [Source]: [Finding]

#### Nits (optional)
- [Source]: [Finding]

### Verdict
[PASS — ready for /finish-story | BLOCKED — fix [N] blockers first]
```

## Verdict Determination

**Verdict Logic:**

- **PASS** (no blockers):
  - 0 Blocker findings across all agents
  - Story is ready to ship
  - Next step: `/finish-story` (lightweight — reviews already done)

- **BLOCKED** (1+ blockers):
  - ≥1 Blocker findings from any agent
  - Must fix blockers before shipping
  - Next step: Fix blockers, re-run `/review-story` (pre-checks re-run, agent reviews reused)

**Finding Severity Hierarchy:**

1. **Blockers (BLOCKER/CRITICAL)**: Must fix before ship. Examples:
   - Security vulnerabilities (XSS, SQL injection, exposed credentials)
   - Silent error suppression (empty catch blocks)
   - Broken functionality (missing API validation)
   - Accessibility violations (WCAG AA minimum)
   - Hardcoded values that break in production

2. **High Priority (HIGH)**: Should fix. Examples:
   - Architecture anti-patterns (prop drilling, tight coupling)
   - Performance issues (N+1 queries, memory leaks)
   - Test coverage gaps (missing edge cases)
   - Design inconsistencies (wrong tokens, broken responsive)

3. **Medium (MEDIUM)**: Fix when possible. Examples:
   - Code style violations (magic numbers, long functions)
   - Missing error messages
   - Suboptimal implementations (could be more efficient)

4. **Nits (LOW/NIT)**: Optional. Examples:
   - Naming suggestions
   - Comment improvements
   - Refactoring opportunities

## Completion Output Templates

### PASS Template (No Blockers)

```markdown
---

## Review Complete: E##-S## — [Story Name]

| Gate                  | Result                    |
| --------------------- | ------------------------- |
| Build                 | [pass/fail]               |
| Lint                  | [pass/fail/skipped]       |
| Type check            | [pass/auto-fixed/fail]    |
| Format check          | [pass/auto-fixed N files/fail] |
| Unit tests            | [pass (N tests)/skipped]  |
| E2E tests             | [pass (N tests)/skipped]  |
| Design review         | [pass/N warnings/skipped] |
| Code review           | [pass/N warnings]         |
| Code review (testing) | [N/N ACs covered/N warnings] |

**Verdict: PASS** — Story is ready to ship.

**High-priority findings** (N): [1-line each, only if N > 0 — omit section if 0]

Full report: `docs/reviews/consolidated-review-{date}-{story-id}.md`
Next: `/finish-story`

---
```

**Save consolidated report to file**: `docs/reviews/consolidated-review-{YYYY-MM-DD}-{story-id}.md`
This file contains the full report including medium/nit findings. The in-conversation output shows only the gate table, verdict, and high-priority findings.

### BLOCKED Template (Blockers Found)

```markdown
---

## Review Blocked: E##-S## — [Story Name]

**Verdict: BLOCKED** — Fix [N] blocker(s) before shipping.

### Blockers to Fix

1. [Source — file:line]: [Description]
2. [Source — file:line]: [Description]

### After Fixing

Re-run `/review-story` to validate fixes. Pre-checks will re-run; completed agent reviews will be reused.

---
```

## Gate Validation Before Marking Reviewed

**Use the `validate-gates.py` script** to validate all required gates before marking `reviewed: true`:

```bash
python3 scripts/workflow/validate-gates.py \
  --gates-config=.claude/skills/review-story/config/gates.json \
  --run-state=.claude/state/review-story/review-run-$STORY_ID.json
```

**Returns JSON with:**

- `valid`: true if all required gates present (base or `-skipped` variant)
- `missing_gates`: array of gate names not found
- `present_gates`: array of gate names found
- `can_mark_reviewed`: true if `valid` is true

**If all gates present:**

- Set `reviewed: true`
- Set `review_gates_passed` to the full list
- Append review summary to `## Design Review Feedback` and `## Code Review Feedback` sections in story file

**If gates missing:**

- Do NOT set `reviewed: true`
- Keep `reviewed: in-progress`
- Warn the user with missing gates and fix instructions

## State Outputs

After consolidation:

- `blocker_count`: Integer count of BLOCKER findings
- `verdict`: "PASS" or "BLOCKED"
- Consolidated report: Markdown file with all findings triaged by severity
- Story frontmatter updated: `reviewed: true` (if all gates pass)
- Review feedback appended to story file sections
