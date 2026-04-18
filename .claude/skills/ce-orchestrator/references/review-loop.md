# Review loop semantics

Detailed behavior of Phase 2.3's zero-tolerance review loop. Loaded on-demand by the coordinator when dispatching review-related sub-agents.

## Inputs

- `planPath` — passed to `/ce:review` as `plan:<path>` for requirements verification.
- `lastGreenSha` — captured in Phase 0.2 via `git rev-parse HEAD`. Required for the R3 revert option.
- `branch` — current working branch from Phase 2.1.
- `--cross-model` flag (optional) — enable parallel Knowlune adversarial review on R1 only.

## Severity bar

| Severity | Blocks loop exit | Feeds fixer | Final disposition |
|---|---|---|---|
| BLOCKER | ✅ | ✅ | R3 residual → failure-recovery gate |
| HIGH | ✅ | ✅ | R3 residual → failure-recovery gate |
| MEDIUM | ✅ | ✅ | R3 residual → failure-recovery gate |
| LOW | ❌ | ❌ | Logged to `docs/known-issues.yaml` |
| NIT | ❌ | ❌ | Logged to `docs/known-issues.yaml` |

MEDIUM blocks because in `/ce:review`'s taxonomy it means "subtle bug / missed edge case / maintainability hazard" — not style. Shipping MEDIUM silently is the slow-motion version of shipping a BLOCKER.

## Round structure

### Round 1 (R1)

1. (Optional `--cross-model`) dispatch Knowlune's `code-review` subagent in parallel via Task (not through `/ce:review`). Merge its findings into R1 only.
2. Dispatch `ce-review-dispatcher` with `mode:headless plan:<planPath>`.
3. `/ce:review` applies `safe_auto` fixes silently (its own single-pass behavior) and returns structured findings.
4. Parse: `{runId, blockers, high, medium, low, nit, findings}`.
5. Evaluate exit condition: `blockers == 0 && high == 0 && medium == 0` → loop done, go to Phase 2.4.
6. Else → R2.

### Round 2 (R2)

1. Dispatch `review-fixer` with findings filtered to BLOCKER + HIGH + MEDIUM.
2. Fixer applies edits via Edit tool, returns `{fixedCount, skippedCount, skippedReasons}`.
3. Commit the fixes: `git add -A && git commit -m "fix(ce-review-R2): apply review-fixer changes"` — coordinator runs this directly, not fixer, so commit discipline stays with the coordinator.
4. Re-dispatch `ce-review-dispatcher` with same args.
5. Evaluate same exit condition → loop done or R3.

### Round 3 (R3)

1. Same as R2 (dispatch fixer → commit → re-review).
2. Evaluate exit:
   - Green → loop done.
   - Residual BLOCKER/HIGH/MEDIUM → **failure-recovery gate**.

## Failure-recovery gate (R3 escalation)

**AskUserQuestion** with 3 options:

```text
Question: "R3 review still has {N} residual blockers/highs/mediums. How to proceed?"

Options:
  1. Halt (preserve state)
  2. Revert to last-green commit ({lastGreenSha})
  3. Escalate — open PR with ⚠️ REVIEW-ESCALATED banner
```

### Option 1 — Halt

```bash
# No git action. Tree stays as-is (with R3 fixes applied).
```

- Tracking stage: `review-escalated`.
- Print summary: residual findings + file paths.
- Exit with non-zero code in headless mode; clean exit otherwise.
- User can fix manually and re-invoke (v2 resume will pick up from review stage).

### Option 2 — Revert to last-green

```bash
git reset --hard <lastGreenSha>
```

- Tracking stage: `reverted`.
- Print confirmation: commit SHA reset to, files restored.
- Exit. User may re-invoke with a new input or refined plan.
- **Safety note:** revert is destructive. Warn explicitly in the AskUserQuestion description text: "This discards all commits since Phase 2 entry, including fixer changes from R1–R3."

### Option 3 — Escalate to PR with banner

- Proceed to Phase 2.5 (PR creation) normally, but:
  - Prepend to PR body:

    ```text
    ⚠️ REVIEW-ESCALATED — R3 review loop exited with residual findings

    Residual:
    - BLOCKER: {N}
    - HIGH: {N}
    - MEDIUM: {N}

    Human review required before merge. See `.context/compound-engineering/ce-review/<runId>/` for full findings.
    ```

- Tracking stage: `pr-created-escalated`.
- Exit with non-zero in headless mode to signal the escalation.

## LOW/NIT disposition (after loop exits green or via Escalate)

1. Check if `docs/known-issues.yaml` exists.
2. If yes: append entries with format:

    ```yaml
    - id: ce-review-{runId}-{findingId}
      severity: {LOW|NIT}
      source: ce-orchestrator
      discovered: {ISO timestamp}
      description: {finding.description}
      file: {finding.file}
      line: {finding.line}
      status: open
    ```

3. If no: surface LOW/NIT inline in Phase 3 output block:

    ```text
    Residual LOW/NIT ({count}) — docs/known-issues.yaml not found, logging here:
      - [LOW] path/to/file:42 — description
      - [NIT] path/to/file:99 — description
    ```

## Cross-model dispatch (optional)

When `--cross-model` flag is set on orchestrator invocation, during R1 only:

- Dispatch Knowlune's `code-review` subagent via Task (model: opus) with prompt targeting the same diff `/ce:review` is evaluating.
- Dispatch runs **in parallel** with `ce-review-dispatcher` — both Task calls in the same message.
- When both return, merge findings:
  - Dedupe by `{file, line, message-hash}`.
  - Take max severity if same finding appears at different severities.
  - Preserve `source` field so the fixer can prioritize consensus findings.
- R2 and R3 use `ce-review-dispatcher` only — cross-model doesn't repeat. (One pass of cross-model is enough; further rounds would double token cost with diminishing returns.)

Cost impact: R1 with cross-model ≈ +80k tokens (one extra opus review). Worth it when the work touches security, payments, or user data. Not worth it for internal refactors.

## Pre-checks → review transition

The coordinator runs pre-checks (Phase 2.2) before entering R1 of the review loop. Pre-check failures halt **before** `/ce:review` is dispatched — don't waste opus tokens on a review when the build is broken.

## `safe_auto` vs outer fixer

`/ce:review mode:headless` applies its own `safe_auto` fixes in a single pass per invocation. That's orthogonal to our outer fix loop:

- **`safe_auto`** (inside `/ce:review`): mechanical fixes with high confidence (e.g., missing semicolon, unused import). Applied silently. Reflected in next-round review counts automatically.
- **Outer `review-fixer`** (between rounds): applies BLOCKER/HIGH/MEDIUM findings that require judgment. Runs as a separate sub-agent, commits explicitly.

No double-work: `/ce:review`'s safe_auto runs inside each round's review call; outer fixer runs between rounds on the findings that remain.

## Commit discipline

Coordinator commits after every round's fixer pass, not the fixer itself. Reasons:

1. Coordinator has full visibility — can write a meaningful message (`fix(ce-review-R2): apply review-fixer changes`).
2. Fixer sub-agents get context on what round they're in via the prompt.
3. `lastGreenSha` stays pristine (never advances mid-loop) so the revert option always lands at pre-Phase-2 state.

**Never squash these commits before PR.** The PR history should show the fix rounds so reviewers can audit.

## Edge cases

| Case | Behavior |
|---|---|
| `/ce:review` returns zero findings on R1 | Loop exits immediately, no fixer dispatch, no extra commits. |
| `/ce:review` returns "Review failed (headless mode). Reason: no diff scope detected." | Halt pre-R1 with clear error. User likely invoked from detached HEAD or empty branch. |
| `review-fixer` returns `fixedCount: 0, skippedCount > 0` | All findings were un-fixable by mechanical patch. Skip to next round if R < 3; otherwise failure-recovery gate with skip reasons in banner. |
| Fixer creates uncommitted changes but coordinator's `git commit` fails | Fatal. Halt, surface git error. User resolves manually (likely hook failure or pre-commit). Do not loop. |
| `git reset --hard` fails during revert | Fatal. Halt, tracking stage `revert-failed`. User must resolve git state manually before re-invoking. |
| New files added by fixer outside tracked paths | Coordinator `git add -A` catches them. No special handling. |
| `docs/known-issues.yaml` exists but has malformed YAML | Log to stderr, surface LOW/NIT inline in Phase 3 output instead. Do not overwrite. |

## Token budget (v1 review loop alone)

| Scenario | Rounds | Est. tokens |
|---|---|---|
| R1 green | 1 | ~80k (ce:review alone) |
| R1 → R2 green | 2 | ~140k (2× review + 1× fixer) |
| R1 → R2 → R3 green | 3 | ~210k |
| R3 escalation | 3 + gate | ~220k |
| R1 with `--cross-model` | 1+ | ~160k (double review on R1 only) |

Plan surfaces these estimates in the Phase 0.3 banner.
