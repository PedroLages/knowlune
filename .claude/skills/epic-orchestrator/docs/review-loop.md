# Review Loop: Zero-Tolerance Quality Cycle

## Overview

The review loop ensures **every issue** found by `/review-story` is fixed — BLOCKER, HIGH, MEDIUM, LOW, and NITS. No exceptions. Each round uses a **fresh sub-agent** for clean context.

## Why Fresh Agents Per Round

- Fresh context window — no stale state from prior analysis
- Review agents see actual current code, not cached diffs
- Each `/review-story` invocation re-runs all gates against committed code
- Prevents accumulated context from biasing the review

## Loop Flow

```dot
digraph review_loop {
  rankdir=TB;
  node [shape=box];

  review [label="Round N: Review Agent\n(fresh sub-agent)\nRuns /review-story"];
  parse [label="Coordinator: Parse findings\nCount by severity"];
  issues [label="Any issues?" shape=diamond];
  fix [label="Fix Agent\n(fresh sub-agent)\nFixes ALL issues"];
  commit [label="Fix Agent commits:\nfix({ID}): address review findings"];
  compare [label="Coordinator: Compare\nRound N vs N-1"];
  max [label="Round > 3?" shape=diamond];
  escalate [label="Escalate: Park story\nor manual intervention"];
  done [label="Proceed to\n/finish-story"];

  review -> parse;
  parse -> issues;
  issues -> done [label="zero issues"];
  issues -> fix [label="any severity"];
  fix -> commit;
  commit -> compare;
  compare -> max;
  max -> review [label="no (continue)"];
  max -> escalate [label="yes"];
}
```

## Round N: Review Agent

Spawn a **new general-purpose sub-agent** with the Review Agent prompt from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`** to keep review output (build, lint, test, agent reports) out of the main conversation. **Use `model: "sonnet"`** — orchestrates review agents that have their own model settings.

Before dispatch, output the status banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2/4: Reviewing {STORY_ID} — Round {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The review agent runs `/review-story {STORY_ID}` which executes:
1. Pre-checks (build, lint, type-check, format, unit tests, E2E tests)
2. Design review agent (Playwright MCP — needs dev server on 5173)
3. Code review agent (architecture, security, silent failures)
4. Code review testing agent (AC coverage, test quality)

The review agent returns a structured summary:
```
Verdict: PASS or ISSUES FOUND
BLOCKER: {count}
HIGH: {count}
MEDIUM: {count}
LOW: {count}
NITS: {count}

STORY-RELATED ISSUES (in files changed by this story):
- [SEVERITY] description — file:line
- [SEVERITY] description — file:line

PRE-EXISTING ISSUES (in files NOT changed by this story):
- [SEVERITY] description — file:line
- [SEVERITY] description — file:line

Report paths: {paths}
```

## Classifying Issues: Story vs Known vs New Pre-Existing

Review agents analyze `git diff main...HEAD` to determine which files the story changed. Issues are classified as:

- **Story-related**: Found in files that the story branch modified. These **must be fixed** before shipping.
- **Pre-existing**: Found in files the story did NOT touch — these exist on `main` already. These are **reported to the coordinator** for inclusion in the final report but do NOT block the story.
- **Known (already tracked)**: Pre-existing issues that match an entry in the `{KNOWN_ISSUES_SUMMARY}` passed to the review agent. These are acknowledged in the return but require no coordinator action beyond logging the match. They do NOT appear in the "NEW PRE-EXISTING ISSUES" list — they're already in `docs/known-issues.yaml`.

**The fix agent only fixes story-related issues.** Pre-existing issues are collected by the coordinator and passed to the Report Agent in Phase 3.

### Coordinator pre-existing issue tracking

The coordinator maintains a running list of pre-existing issues across all stories:

```
KNOWN ISSUES MATCHED (already in known-issues.yaml — no action needed):
- KI-016: ImportWizardDialog test failures (matched during E##-S##)
- KI-029: Unit test coverage below 70% (matched during E##-S##)
...

NEW PRE-EXISTING ISSUES (to add to known-issues.yaml in Phase 2):
- [MEDIUM] Missing error boundary in Layout.tsx — src/app/components/Layout.tsx:45 (found during E##-S##)
- [LOW] Unused import in Overview.tsx — src/app/pages/Overview.tsx:3 (found during E##-S##)
...
```

**Deduplication**: When a review agent reports a pre-existing issue, the coordinator checks it against `{KNOWN_ISSUES_SUMMARY}`. Match by file path or by issue category (e.g., "ESLint parsing errors in scripts/" matches KI-026). If matched → add to KNOWN list with KI-NNN. If no match → add to NEW list.

**Cross-story deduplication**: If a NEW pre-existing issue was already reported by a previous story in this same epic, do not duplicate it. The first story that discovers it gets credit.

This list is passed to the Report Agent to include in the final completion report as "Deferred Issues for Future Fix."

## Classifying Non-Issues

When the Fix Agent reports an item as "could NOT be fixed" with explanation that it's a false positive, or when a subsequent Review round does not re-flag the same item, classify it as NON-ISSUE.

Track separately from real issues:
```
NON-ISSUES (false positives):
- [ORIGINAL_SEVERITY] description — reason it's not an issue (found during E##-S##)
```

**NON-ISSUES do NOT count toward the "zero issues" threshold.** The review loop targets zero *real* issues, not zero flagged items. Non-issues are included in the final report for transparency.

## Update Tracking File

After each review/fix round, update the persistent tracking file (`docs/implementation-artifacts/epic-{N}-tracking-{DATE}.md`):
- Story status (reviewing, fixing)
- Review findings counts per round
- Fixes applied with descriptions
- Non-issues identified
- Any errors encountered

## If Story-Related Issues Found: Fix Agent

Spawn a **new general-purpose sub-agent** with the Fix Agent prompt from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`**. **Use `model: "sonnet"`** — targeted fixes, not creative work.

Before dispatch, output the status banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX: Resolving {N} issues — {STORY_ID} Round {R}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The fix agent receives the **story-related findings only** and must:
1. Read each file at the specified location
2. Understand the problem
3. Implement the correct fix
4. Verify build and lint pass
5. Commit all fixes

**Critical**: Pass the FULL story-related findings list to the fix agent. Don't filter by severity — every story-related issue gets fixed. Pre-existing issues are excluded (they'll go in the final report).

## Coordinator Between Rounds

After each fix agent completes, the coordinator:

1. **Compares issue counts** between Round N and Round N-1:
   - Issues decreasing → progress, continue
   - Issues increasing → fixes may have introduced new problems (normal, next round catches them)
   - Same issues persisting → may need different approach

2. **Checks round count**:
   - Round 1-3: Normal loop, spawn new review agent
   - Round 4+: Escalation decision:
     - If only LOW/NITS remain and count is stable → accept and proceed
     - If BLOCKER/HIGH persist → park story, log reason, move to next
     - Optionally spawn a 4th round with explicit escalated instructions

3. **Adds dynamic TodoWrite items**:
   ```
   [ ] {STORY_ID}: Review Loop (Round 2)
   [ ] {STORY_ID}: Fix Round 2 findings
   ```

## When Clean (Zero Issues)

When the review agent returns `Verdict: PASS` with zero issues across all severities:

1. Coordinator notes: `Review Rounds: {N}, Issues Fixed: {total}`
2. Updates tracking table
3. Marks review TodoWrite items as complete
4. Proceeds to Step 3: Finish + PR

## Edge Cases

### Pre-check failures (build/lint/types)
The review agent handles these within its `/review-story` run — auto-fixes are applied for lint and format. If build fails, the review agent reports it and stops.

### Design review skipped (no UI changes)
If the story has no `.tsx` changes, design review is automatically skipped by `/review-story`. The `design-review-skipped` gate is added instead.

### Fix agent can't fix an issue
The fix agent returns a list of unfixed items with explanations. The coordinator includes these in the next review agent's context so it can verify if the issue is real or a false positive.
