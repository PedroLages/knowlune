# Headless mode — JSON I/O contract

`--headless` turns `ce-orchestrator` into a programmatic subroutine. No AskUserQuestion prompts; the plan-approval gate becomes an assertion; stdout returns a single JSON object.

## When to use

- Invocation from another orchestrator (a future epic-level CE runner, CI hook, or scheduled job).
- Shell automation: `result=$(/ce-orchestrator --headless "$input"); jq -r .prUrl <<<"$result"`.
- Testing: deterministic exit codes for integration tests.

Never use interactively. Headless disables the safety rails that protect human users from silent bad states.

## Invocation

```text
/ce-orchestrator --headless "<input>"                          # bare idea
/ce-orchestrator --headless "docs/plans/...-plan.md"           # plan path
/ce-orchestrator --headless --cross-model "<input>"            # add cross-model review
```

Input semantics identical to interactive mode — the adaptive classifier (v2) handles all five input shapes. Only difference: no clarifying AskUserQuestion on `confidence: low`.

## Gate transformations

| Interactive mode | Headless mode |
|---|---|
| Plan-approval gate (AskUserQuestion) | Assertion: `confidenceScore >= 85` from ce:plan. Below threshold → abort. |
| Plan refinement loop (max 2) | Skipped entirely. Plan is either accepted or run aborts. |
| R3 failure-recovery gate (Halt/Revert/Escalate) | Default: `Halt`. No destructive revert without human. Returns with non-zero status. |
| Demo-reel tier prompt | Classifier picks tier automatically; user prompt skipped. |
| `/techdebt` extraction prompt (v3) | Default: `Skip extraction` (never destroy work silently). |
| Compound gate (Defer/Run-now/Skip, Phase 3.1) | Default: `Defer`. Caller owns post-merge compound. |
| Resume prompt (tracking file exists) | Default: `Start fresh`. Previous run treated as abandoned. |

## stdout contract

Always valid JSON on a single final line. Anything written to stderr is diagnostic; stdout is machine-readable only.

### Success shape

```json
{
  "status": "pr-created",
  "slug": "keyboard-help",
  "runId": "20260418-a1b2c3",
  "input": {
    "raw": "add keyboard shortcut help modal",
    "shape": "brainstorm",
    "confidence": "high"
  },
  "artifacts": {
    "brainstorm": "docs/brainstorms/2026-04-18-keyboard-help-requirements.md",
    "plan": "docs/plans/2026-04-18-001-feat-keyboard-help-plan.md",
    "reviewRunId": ".context/compound-engineering/ce-review/20260418-142233-abc/",
    "demoUrl": "https://storage.example/ce-demo-reel/keyboard-help.gif",
    "prUrl": "https://github.com/mindsetsphere/knowlune/pull/42",
    "solutionPath": null
  },
  "review": {
    "rounds": 2,
    "residual": { "low": 1, "nit": 0 },
    "escalated": false,
    "lastGreenSha": "a1b2c3d4"
  },
  "compound": { "status": "deferred" },
  "tracking": ".context/compound-engineering/ce-runs/keyboard-help-2026-04-18.md",
  "durationSeconds": 2847,
  "exitCode": 0
}
```

### Terminal failure shape

```json
{
  "status": "aborted",
  "reason": "plan-confidence-too-low",
  "confidenceScore": 72,
  "confidenceThreshold": 85,
  "slug": "keyboard-help",
  "artifacts": {
    "brainstorm": "docs/brainstorms/2026-04-18-keyboard-help-requirements.md",
    "plan": "docs/plans/2026-04-18-001-feat-keyboard-help-plan.md"
  },
  "tracking": ".context/compound-engineering/ce-runs/keyboard-help-2026-04-18.md",
  "durationSeconds": 403,
  "exitCode": 2
}
```

### Review-escalated shape

```json
{
  "status": "review-escalated",
  "reason": "r3-residual-blockers",
  "review": {
    "rounds": 3,
    "residual": { "blocker": 2, "high": 1, "medium": 0, "low": 0, "nit": 0 },
    "lastGreenSha": "a1b2c3d4",
    "findingsPath": ".context/compound-engineering/ce-review/20260418-142233-abc/findings.json"
  },
  "artifacts": { "plan": "...", "prUrl": null },
  "tracking": "...",
  "exitCode": 3
}
```

Note: branch is left with uncommitted fix-loop commits. Caller must decide: revert (`git reset --hard <lastGreenSha>`) or investigate manually.

## Exit code table

| Code | Status | Meaning |
|---|---|---|
| 0 | `pr-created` | Happy path, PR opened |
| 0 | `pr-created-escalated` | PR opened but has `⚠️ REVIEW-ESCALATED` banner |
| 2 | `aborted` | Plan-approval assertion failed (confidence-too-low or classifier-ERROR) |
| 3 | `review-escalated` | R3 residual BLOCKER/HIGH/MEDIUM, headless defaulted to Halt |
| 4 | `halted-at-<stage>` | Sub-agent error at a specific stage |
| 5 | `reverted` | Not reachable in headless (revert requires user consent); reserved |
| 10 | `internal-error` | Coordinator-level bug (malformed sub-agent response, schema mismatch, etc.) |

Callers should branch on `exitCode` first, then inspect `status` and `reason`.

## Concurrency

`--headless` is **not safe for concurrent runs on the same checkout**. `/ce:work` mutates files, `/ce:review mode:headless` applies `safe_auto` fixes. Two concurrent ce-orchestrator runs will corrupt each other.

Run concurrent headless invocations only in separate worktrees (see [superpowers:using-git-worktrees](../../_shared/orchestrator-principles.md) via orchestrator-principles reference).

## Stderr semantics

stderr is free-form diagnostic output. Safe to ignore in production scripts but useful for debugging:

- Phase banners (same as interactive mode Phase 0.3)
- Sub-agent dispatch notifications
- Warnings (low-confidence classifier, missing `docs/known-issues.yaml`, etc.)
- Git command outputs from internal `git add`/`git commit` (fix-loop rounds)

Never echo secrets, PR body content, or full review findings to stderr. Those live in artifact files referenced by the stdout JSON.

## Assertions (replacing gates)

### Plan-confidence assertion

```text
if compound_engineering.ce_plan.confidenceScore < 85:
    return {"status": "aborted", "reason": "plan-confidence-too-low", ...}
```

Threshold `85` is the default. Override with `--plan-confidence-min=<N>` flag (v3, not v2).

Rationale: headless can't judge plan quality interactively. The confidence score from `ce:plan`'s built-in check is the best proxy. Below 85 usually means the plan has unresolved questions or weak grounding — running `ce:work` on it is high-risk.

### Diff-scope assertion

```text
if ce_review returns "Review failed (headless mode). Reason: no diff scope detected.":
    return {"status": "halted-at-review", "reason": "no-diff-scope", ...}
```

Happens when the coordinator's invocation has no commits yet (e.g., main branch unchanged). `/ce:review mode:headless` refuses and coordinator surfaces.

### Compound-skip default

Headless never runs `/ce:compound`. `compound.status` is always `"deferred"` in success shape. Caller is responsible for post-merge compound doc if wanted.

## Caller patterns

### Shell (with jq)

```bash
#!/usr/bin/env bash
set -euo pipefail

result=$(/ce-orchestrator --headless "add keyboard help modal")
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
  pr_url=$(jq -r .artifacts.prUrl <<<"$result")
  echo "Opened: $pr_url"
elif [[ $exit_code -eq 2 ]]; then
  echo "Aborted at plan: $(jq -r .reason <<<"$result")"
  exit 1
elif [[ $exit_code -eq 3 ]]; then
  echo "Review escalated: $(jq -r .review.rounds <<<"$result") rounds"
  exit 1
else
  echo "Unexpected: $result"
  exit 2
fi
```

### Future epic orchestrator

A future `ce-epic-orchestrator` would invoke `/ce-orchestrator --headless <story-path>` for each story in an epic, parse the JSON, aggregate results, and produce an epic-level report. The JSON contract is the seam.
