# Review Agent Dispatcher

This module orchestrates the parallel dispatch of review agents (design-review, code-review, code-review-testing) with skip logic and pre-dispatch health checks.

## Overview

After pre-checks pass, dispatch ALL applicable review agents **in a single message** for maximum parallelism. Design review, code review, and test coverage review are fully independent — they use different tools (Playwright MCP vs git diff) and analyze different aspects.

**State Inputs**: `HAS_UI_CHANGES`, `resuming` flag, `review_gates_passed` array, `test_pattern_findings` from pre-checks
**State Outputs**: Agent report paths, updated `review_gates_passed` array

## Pre-Dispatch Checks

**Determine which agents to dispatch by checking skip conditions:**

### Design Review Skip Conditions

Skip if **ANY** of:
- (a) Resuming AND `design-review` in `review_gates_passed` AND report file exists at `${BASE_PATH}/docs/reviews/design/design-review-*-{story-id}.md`
- (b) No UI changes detected (no changes in `src/app/` from `git diff --name-only main...HEAD`)

**If skipping for no UI changes**: Add `design-review-skipped` to `review_gates_passed`

### Code Review Skip Conditions

Skip if resuming AND `code-review` in `review_gates_passed` AND report file exists at `${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md`

### Code Review Testing Skip Conditions

Skip if resuming AND `code-review-testing` in `review_gates_passed` AND report file exists at `${BASE_PATH}/docs/reviews/code/code-review-testing-*-{story-id}.md`

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
   - Continue dispatching other agents (code-review, code-review-testing)

## Parallel Agent Dispatch

**TodoWrite**: Mark all non-skipped agent todos → `in_progress` simultaneously.

**Dispatch all non-skipped agents in a single message:**

```typescript
// All dispatched together — they run concurrently:

Task({
  subagent_type: "design-review",
  run_in_background: true,
  prompt: "Review story E##-S## changes. Affected routes: [mapped from files]. Focus on: [ACs that involve UI]. Git diff summary: [key changes]. Return only: STATUS (PASS/WARNINGS/FAIL), blocker count, high count, report file path.",
  description: "Design review E##-S##"
})

Task({
  subagent_type: "code-review",
  run_in_background: true,
  prompt: "Review story E##-S## at ${BASE_PATH}/docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes.

Test anti-patterns detected (step g validation):
[Insert validation findings if any LOW severity issues were found, or 'No anti-patterns detected' if clean]

Focus on architecture, security, correctness, silent failures, test anti-patterns (section 5.5), and Knowlune stack patterns. Score each finding with confidence (0-100). Return only: STATUS (PASS/WARNINGS/FAIL), blocker count, high count, total findings, report file path.",
  description: "Code review E##-S##"
})

Task({
  subagent_type: "code-review-testing",
  run_in_background: true,
  prompt: "Review test coverage for story E##-S## at ${BASE_PATH}/docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes. Map every acceptance criterion to its tests. Review test quality, isolation, and edge case coverage. Score each finding with confidence (0-100). Return only: STATUS, AC coverage ratio, blocker count, high count, report file path.",
  description: "Test coverage review E##-S##"
})
```

**Note**: The code-review agent has selective WebFetch access for deprecated APIs, security issues, and framework bugs. It will use this sparingly (max 1-2 fetches) for high-severity findings only. This may add 10-30s to code review time but provides authoritative fix guidance.

## Result Handling

**As each background agent completes** (silent — no visible output):

1. TodoWrite: mark its todo → `completed`
2. Parse the agent's minimal return (STATUS, counts, report path)
3. If agent failed:
   - Note in internal failure list (surfaced in consolidated report only — no immediate user output)
   - Do NOT add its gate to `review_gates_passed`
4. If agent succeeds:
   - Verify report file exists at expected location
   - Add gate to `review_gates_passed`

**After ALL agents complete** (batch collection):

1. Read each report file from disk
2. Parse severity sections (Blockers, High, Medium, Low/Nits)
3. Run deduplication with consensus scoring (see below)
4. Proceed to consolidated report

## Report Locations

**Design review:**
`${BASE_PATH}/docs/reviews/design/design-review-{YYYY-MM-DD}-{story-id}.md`

**Code review:**
`${BASE_PATH}/docs/reviews/code/code-review-{YYYY-MM-DD}-{story-id}.md`

**Test coverage review:**
`${BASE_PATH}/docs/reviews/code/code-review-testing-{YYYY-MM-DD}-{story-id}.md`

## Finding Deduplication with Consensus Scoring

**If 2+ agents flag the same file:line:**
- Keep the finding with the higher confidence score
- **Boost severity by one level** (Nit→Medium, Medium→High, High→Blocker) — independent agents converging on the same location is stronger signal than a single detection
- Tag as `[Consensus: N agents]` in the consolidated report
- Prefix with source agents (e.g., "[code-review + code-review-testing]")

**Example:**
```
Finding: Hardcoded color in StatsCard.tsx:42
Source: code-review (confidence: 95), code-review-testing (confidence: 78)
Original Severity: HIGH → Boosted to: BLOCKER [Consensus: 2 agents]
Keeping: code-review finding (higher confidence)
```

## State Updates

After all agents complete:
- `review_gates_passed`: Updated with `design-review` (or `design-review-skipped`), `code-review`, `code-review-testing`
- Report files saved to `${BASE_PATH}/docs/reviews/`
- Findings deduplicated and ready for consolidated report
