# Review Agent Dispatcher

This module orchestrates the parallel dispatch of review agents with skip logic and pre-dispatch health checks.

## Overview

After pre-checks pass, dispatch ALL applicable review agents **in a single message** for maximum parallelism. Design review, code review, and test coverage review are fully independent — they use different tools (Playwright MCP vs git diff) and analyze different aspects.

**State Inputs**: `HAS_UI_CHANGES`, `resuming` flag, `review_gates_passed` array, `test_pattern_findings` from pre-checks
**State Outputs**: Agent report paths, updated `review_gates_passed` array

## Pre-Dispatch Checks

**Determine which agents to dispatch** by checking `config/gates.json` for skip conditions:

### Design Review Skip Conditions

From `gates.json`:

- `skip_condition`: "no files matching src/app/(pages|components)/*.tsx in diff"
- `skip_suffix`: "design-review-skipped"

Skip if **ANY** of:

- Resuming AND `design-review` in `review_gates_passed` AND report file exists
- No UI changes detected (per skip condition in gates.json)

### Code Review Skip Conditions

From `gates.json`:

- `skip_condition`: null (never auto-skips)
- `skip_suffix`: null

Skip only if resuming AND already completed.

### Code Review Testing Skip Conditions

From `gates.json`:

- `skip_condition`: null (never auto-skips)
- `skip_suffix`: null

Skip only if resuming AND already completed.

## Design Review Pre-Requisite

**Only if design review will run**, check dev server health:

1. Check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
2. If NOT reachable (status ≠ 200):
   - Start dev server: `npm run dev &` (background process)
   - Wait up to 30s for server to become reachable
   - Re-check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
3. If still unreachable:
   - Warn the user: "Dev server unreachable. Design review cannot run."
   - Do NOT add `design-review` to gates
   - Continue dispatching other agents

## Parallel Agent Dispatch

**TodoWrite**: Mark all non-skipped agent todos → `in_progress` simultaneously.

**Generate review bundle** for agents:

```bash
BUNDLE_PATH=$(bash scripts/workflow/make-review-bundle.sh --story-id=$STORY_ID --base-path=$BASE_PATH --output=-)
```

**Dispatch all non-skipped agents in a single message:**

```typescript
// All dispatched together — they run concurrently:

Task({
  subagent_type: "design-review",
  run_in_background: true,
  prompt: "Story $STORY_ID. Bundle: $BUNDLE_PATH. Save report to docs/reviews/design/design-review-{date}-{story-id}.md. Return structured format: STATUS, FINDINGS, COUNTS, REPORT path.",
  description: "Design review $STORY_ID"
})

Task({
  subagent_type: "code-review",
  run_in_background: true,
  prompt: "Story $STORY_ID. Bundle: $BUNDLE_PATH. Test patterns: $TEST_PATTERN_FINDINGS. Save report to docs/reviews/code/code-review-{date}-{story-id}.md. Return structured format.",
  description: "Code review $STORY_ID"
})

Task({
  subagent_type: "code-review-testing",
  run_in_background: true,
  prompt: "Story $STORY_ID. Bundle: $BUNDLE_PATH. Save report to docs/reviews/code/code-review-testing-{date}-{story-id}.md. Return structured format.",
  description: "Test coverage review $STORY_ID"
})
```

## Agent Return Format

**All agents must return structured JSON** (see [schemas/agent-output.schema.json](../schemas/agent-output.schema.json)):

```json
{
  "schema_version": 1,
  "producer": "agent-name",
  "created_at": "2026-04-09T12:00:00Z",
  "story_id": "E01-S03",
  "agent": "code-review",
  "gate": "code-review",
  "status": "PASS|WARNINGS|FAIL|SKIPPED|ERROR",
  "counts": {
    "blocker": 0,
    "high": 2,
    "medium": 5,
    "low": 3
  },
  "findings": [...],
  "report_path": "docs/reviews/code/code-review-2026-04-09-E01-S03.md"
}
```

## Result Handling

**As each background agent completes** (silent — no visible output):

1. TodoWrite: mark its todo → `completed`
2. Parse the agent's structured JSON return
3. Store agent output to `.claude/state/review-story/agent-results/{agent-name}.json`
4. If agent failed:
   - Note in internal failure list (surfaced in consolidated report)
   - Do NOT add its gate to `review_gates_passed`
5. If agent succeeds:
   - Verify report file exists at expected location
   - Add gate to `review_gates_passed`

**After ALL agents complete** (batch collection):

1. Run merge script to consolidate findings:

```bash
python3 scripts/workflow/merge-agent-results.py \
  --agent-results-dir=.claude/state/review-story/agent-results/ \
  --output=.claude/state/review-story/consolidated-findings-$STORY_ID.json
```

2. Proceed to consolidated report generation

## Report Locations

**All report path templates are in `config/gates.json`:**

- Design review: `docs/reviews/design/design-review-{date}-{story-id}.md`
- Code review: `docs/reviews/code/code-review-{date}-{story-id}.md`
- Test coverage: `docs/reviews/code/code-review-testing-{date}-{story-id}.md`

## Finding Deduplication with Consensus Scoring

**The `merge-agent-results.py` script handles deduplication:**

- Proximity match: same file:line within 5-line window
- Consensus boost: +10 confidence score (NOT severity boost)
- Cross-architecture bonus: additional +10 for agents with different perspectives (e.g., code-review + security-review)
- Sort order: (severity_rank, -consensus_score)

**Example:**

```
Finding: Hardcoded color in StatsCard.tsx:42
Source: code-review (confidence: 95), code-review-testing (confidence: 78)
Consensus score: 95 + 10 = 105
Keeping: code-review finding (higher base confidence)
```

## State Updates

After all agents complete:

- `review_gates_passed`: Updated with `design-review` (or `design-review-skipped`), `code-review`, `code-review-testing`
- Agent JSON outputs saved to `.claude/state/review-story/agent-results/`
- Consolidated findings JSON created for report generation
