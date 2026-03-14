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
  prompt: "Review story E##-S## changes. Affected routes: [mapped from files]. Focus on: [ACs that involve UI]. Git diff summary: [key changes].",
  description: "Design review E##-S##"
})

Task({
  subagent_type: "code-review",
  prompt: "Review story E##-S## at ${BASE_PATH}/docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes.

Test anti-patterns detected (step g validation):
[Insert validation findings if any LOW severity issues were found, or 'No anti-patterns detected' if clean]

Focus on architecture, security, correctness, silent failures, test anti-patterns (section 5.5), and LevelUp stack patterns. Score each finding with confidence (0-100).",
  description: "Code review E##-S##"
})

Task({
  subagent_type: "code-review-testing",
  prompt: "Review test coverage for story E##-S## at ${BASE_PATH}/docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes. Map every acceptance criterion to its tests. Review test quality, isolation, and edge case coverage. Score each finding with confidence (0-100).",
  description: "Test coverage review E##-S##"
})
```

**Note**: The code-review agent has selective WebFetch access for deprecated APIs, security issues, and framework bugs. It will use this sparingly (max 1-2 fetches) for high-severity findings only. This may add 10-30s to code review time but provides authoritative fix guidance.

## Result Handling

**As each agent returns**:

1. Mark its todo → `completed`
2. Validate the result:
   - Check for errors in agent output
   - Verify report file exists
   - Ensure report has required severity sections
3. If agent fails:
   - Warn the user with specific error message
   - Do NOT add its gate to `review_gates_passed`
   - Note failure in consolidated report
4. If agent succeeds:
   - Save report to appropriate location (see below)
   - Parse severity sections (Blockers, High, Medium, Low/Nits)
   - Add gate to `review_gates_passed`

## Report Locations

**Design review:**
`${BASE_PATH}/docs/reviews/design/design-review-{YYYY-MM-DD}-{story-id}.md`

**Code review:**
`${BASE_PATH}/docs/reviews/code/code-review-{YYYY-MM-DD}-{story-id}.md`

**Test coverage review:**
`${BASE_PATH}/docs/reviews/code/code-review-testing-{YYYY-MM-DD}-{story-id}.md`

## Finding Deduplication

**If code-review and code-review-testing flag the same file:line:**
- Keep the finding with the higher confidence score
- Prefix deduplicated findings with their source agent (e.g., "[code-review]" or "[code-review-testing]")
- Include both agent names in the consolidated report's "Source" field

**Example:**
```
Finding: Hardcoded color in StatsCard.tsx:42
Source: code-review (confidence: 95), code-review-testing (confidence: 78)
Severity: HIGH
Keeping: code-review finding (higher confidence)
```

## State Updates

After all agents complete:
- `review_gates_passed`: Updated with `design-review` (or `design-review-skipped`), `code-review`, `code-review-testing`
- Report files saved to `${BASE_PATH}/docs/reviews/`
- Findings deduplicated and ready for consolidated report
