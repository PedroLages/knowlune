---
name: ce-orchestrator
description: Use when driving a single feature, fix, or refactor end-to-end through the Compound Engineering pipeline — brainstorm → plan → work → review → demo-reel → PR with compound reminder. Triggered by requests to "ship this idea", "run the CE pipeline", "orchestrate compound engineering for X", or when the user wants the full every.to-style workflow (plan approval gate included) instead of invoking /ce-brainstorm, /ce-plan, /ce-work, /ce-review, /ce-git-commit-push-pr manually. Prefer this over /lfg when the work needs upstream brainstorming or the Knowlune-specific safety gates; /lfg is narrower (plan → work → review only).
color: red
memory: project
background: true
effort: medium
argument-hint: "[idea | docs/plans/*-plan.md] [--cross-model] [--autopilot (v3)] [--headless (v2)]"
---

# CE Orchestrator

Drives a single unit of work end-to-end through the Compound Engineering pipeline with one hard human gate at **plan approval**. Terminal state: **PR created** (not merged). After merge, run `/ce-compound` to close the loop.

**Status:** v1 — happy-path only. Adaptive entry, story-file bridge, tracking file, headless mode, `--autopilot`, and supporting-skill integrations land in v2–v3. See [plan](../../../../Users/pedro/.claude/plans/want-you-to-majestic-rabin.md).

## Usage

```text
/ce-orchestrator "add keyboard shortcut help modal"                # bare idea → full pipeline
/ce-orchestrator docs/plans/2026-04-15-002-feat-search-plan.md     # existing plan → plan-approval gate → rest
/ce-orchestrator "<input>" --cross-model                           # add Knowlune review-story swarm in parallel (v1)
```

Inputs outside v1 scope error with a friendly message pointing to the manual CE skills.

## Orchestrator Discipline

**See:** [../\_shared/orchestrator-principles.md](../_shared/orchestrator-principles.md)

**Additional rules for this skill (non-negotiable):**

1. **Coordinator never reads source code.** Sub-agents read and act.
2. **Coordinator never reads full plan or review reports.** Sub-agents return ≤300-word summaries or structured JSON.
3. **Every sub-agent dispatched via `Task` with `run_in_background: true`.** Keeps intermediate output out of coordinator context.
4. **Every sub-agent prompt ends with `/auto-answer autopilot`.** Prevents sub-agents blocking on inferable Q&A.
5. **Coordinator itself NEVER auto-answers the plan-approval gate.** That is the sacred human checkpoint (every.to: "silence is not approval").
6. **Coordinator tracks only**: input type, stage, plan path, review run-id, review rounds, last-green SHA, PR URL.
7. **Model per sub-agent is fixed by [references/sub-agent-models.md](references/sub-agent-models.md).** Do not downgrade an Opus dispatcher to Sonnet for cost — degrades every downstream step.
8. **Canonical skill names use `ce:` colon prefix** (`ce:plan`, `ce:work`, `ce:review`, `ce:brainstorm`, `ce:demo-reel`, `ce:git-commit-push-pr`). Sub-agents invoke via the Skill tool using these exact names.

## Phase 0 — Classify & Initialize

### 0.1 Create TodoWrite scaffold

Immediately create the v1 todo list, first item `in_progress`:

1. Classify input
2. Phase 1 — upstream (plan)
3. Phase 1 — plan-approval gate
4. Phase 2 — /ce:work
5. Phase 2 — pre-checks + /ce:review loop
6. Phase 2 — demo-reel + PR
7. Phase 3 — compound reminder + exit

### 0.2 Capture last-green SHA

Before any stage can mutate the tree, record the current commit as `lastGreenSha` (persisted in coordinator context for the R3 failure-recovery revert option):

```bash
git rev-parse HEAD
```

### 0.3 Banner the run

Print a one-shot banner before dispatching anything:

```text
╭─────────────────────────────────────────────╮
│ CE Orchestrator — v1 happy-path             │
│ Input:        <input, truncated to 60ch>    │
│ Plan gate:    HARD (human approval required)│
│ Terminal:     PR created (not merged)       │
│ Est. tokens:  ~500k–1M (see refs for breakdown) │
╰─────────────────────────────────────────────╯
```

### 0.4 Classify (v1 minimal classifier)

- If `$ARGUMENTS` matches `docs/plans/*-plan.md` AND the path exists → stage = `plan-approval`, `planPath = <arg>`, skip brainstorm+plan.
- Else if `$ARGUMENTS` is a non-empty string → stage = `brainstorm`, feed the string to `/ce:brainstorm`.
- Else → surface error: `"Input required. Pass an idea string or a path to docs/plans/*-plan.md."` and exit.

Everything else (ideation docs, brainstorm docs, bug descriptions, BMAD story paths) returns a friendly v2-landing-pad message and exits:

```text
Input shape "{shape}" is supported in v2. For now:
  • Bug? → run /ce:debug manually, then pass the resulting plan here.
  • Existing brainstorm? → run /ce:plan manually, then pass the resulting plan here.
  • BMAD story? → synthesize a plan via /ce:plan first.
```

## Phase 1 — Upstream (brainstorm → plan → approval)

### 1.1 Brainstorm (skip if input was a plan path)

Dispatch `ce-brainstorm-dispatcher` sub-agent:

- **Model:** opus (per [sub-agent-models.md](references/sub-agent-models.md))
- **Prompt shape:**

```text
You are dispatching the ce:brainstorm skill for the CE orchestrator.

Input idea: "<user input>"

Steps:
1. Use the Skill tool to invoke ce:brainstorm with the input above.
2. Let it run its dialogue and produce docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md.
3. Return ONLY a structured result: `{"requirementsPath": "<absolute-or-repo-relative-path>"}`.
4. If ce:brainstorm errors or does not produce a file, return `{"error": "<reason>"}`.

Do not read back the requirements content. Coordinator does not need it.

/auto-answer autopilot
```

- **Returns:** `{requirementsPath}` or `{error}`. On error, halt with user-visible message.

### 1.2 Plan

Dispatch `ce-plan-dispatcher` sub-agent:

- **Model:** opus
- **Input:** the `requirementsPath` from 1.1 (or the plan path if user supplied one — but in that case this stage is skipped entirely, not re-run).
- **Prompt shape:**

```text
You are dispatching the ce:plan skill for the CE orchestrator.

Requirements doc: <path>

Steps:
1. Use the Skill tool to invoke ce:plan with argument: <path>.
2. Let it run its planning workflow, including confidence check and document review.
3. Return ONLY: `{"planPath": "<path>", "confidenceScore": <0-100 or null>}`.
4. If ce:plan asks a blocking question that stops it from producing a plan, return `{"error": "blocked", "question": "<question>"}`.

Do not read back the plan content.

/auto-answer autopilot
```

- **Returns:** `{planPath, confidenceScore?}`.

### 1.3 Plan-approval gate (HARD human checkpoint)

The single sacred checkpoint. Every.to: "silence is not approval" — default option must be an explicit Approve click, never a timeout-approve.

**Full flow spec:** [references/sub-agent-prompts.md § Plan-approval gate flow](references/sub-agent-prompts.md#plan-approval-gate-flow-phase-13-full-spec). Summary below.

1. Dispatch `plan-summarizer` (model: haiku) on `planPath` → get ≤300-word digest.
2. Display digest in terminal. Use **AskUserQuestion**:
   - `Approve (Recommended)` → Phase 2
   - `Request changes` → enter deepen loop
   - `Abort` → tracking.status = `aborted`, exit
3. **Deepen loop** (max 2 rounds):
   - Prompt for user notes via AskUserQuestion free-text.
   - Dispatch `ce-plan-deepener` (model: opus) with `{planPath, userNotes}` → ce:plan runs in interactive deepening mode and mutates the plan in place.
   - Re-dispatch `plan-summarizer` → fresh digest.
   - Ask again: `Approve` / `Request more changes (if round < 2)` / `Abort`.
4. After 2 rounds without approval: offer `Proceed with unresolved notes (appended to plan)` or `Abort`.

**Never bypass this gate in v1.** `--headless` treatment (gate → confidence assertion) lands in v2. `--autopilot` flag (v3) explicitly does NOT skip this gate — only cosmetic choices.

**Why max 2 rounds:** if a plan needs 3+ refinements, the original requirements were likely wrong — better to abort and re-brainstorm than force a bad plan through.

### 1.4 TodoWrite update

Mark items 2–3 complete; item 4 in_progress.

## Phase 2 — Execution (work → pre-checks → review loop → demo-reel → PR)

### 2.1 Work

Dispatch `ce-work-dispatcher` sub-agent:

- **Model:** opus
- **Prompt shape:**

```text
You are dispatching the ce:work skill for the CE orchestrator.

Plan: <planPath>
Branch policy: If current branch is main or matches ^(main|master|develop)$, create feature/ce-YYYY-MM-DD-<slug-from-plan-filename> and switch to it. Otherwise use current branch.

Steps:
1. Use the Skill tool to invoke ce:work with argument: <planPath>.
2. Let it execute the plan to completion.
3. Return ONLY: `{"commitShas": ["<sha1>", "<sha2>", ...], "branch": "<branch-name>", "modifiedFiles": ["<path>", ...]}`.
4. On failure: `{"error": "<reason>", "partialCommits": ["<sha>"]}`.

Do not read back code. Do not read back full diffs.

/auto-answer autopilot
```

- **Returns:** `{commitShas, branch, modifiedFiles}`.
- **Guardrail:** `/ce:work` does NOT invoke `/ce:review` internally (verified 2026-04-18). Outer review loop is safe, not a double-run.

### 2.2 Pre-checks (Knowlune gates)

Dispatch `pre-checks-runner` sub-agent:

- **Model:** haiku
- **Prompt shape:**

```text
Run Knowlune pre-checks from /Volumes/SSD/Dev/Apps/Knowlune. Do not make code changes.

Checks (run in order, halt on first failure):
1. Kill any process on port 5173: `lsof -ti:5173 | xargs kill 2>/dev/null || true`
2. `npm run build` — must succeed.
3. `npm run lint` — must succeed (ESLint; design-tokens rule is ERROR level).
4. `npx tsc --noEmit` — must succeed.
5. Bundle-size regression check: compare against docs/implementation-artifacts/performance-baseline.json if it exists; flag if dist increases >25%.

Return ONLY: `{"passed": true}` OR `{"passed": false, "failedCheck": "<name>", "details": "<one-line summary>"}`.

/auto-answer autopilot
```

- **On failure:** halt with `failedCheck` + `details`. Tracking stage = `halted-at-pre-checks`.

### 2.3 Review loop (max 3 rounds, zero-tolerance on BLOCKER/HIGH/MEDIUM)

Full semantics land in Unit 4 (including `references/review-loop.md`). v1 contract:

**Severity bar** (matches Knowlune story-workflow per memory `feedback_review_loop_max_rounds.md`):

| Severity | Behavior in loop |
|---|---|
| BLOCKER | Must be 0 to exit loop. R3 residual → failure-recovery gate. |
| HIGH | Must be 0 to exit loop. R3 residual → failure-recovery gate. |
| MEDIUM | Must be 0 to exit loop. R3 residual → failure-recovery gate. |
| LOW | Non-blocking. Append to `docs/known-issues.yaml` after loop exits. |
| NIT | Non-blocking. Append to `docs/known-issues.yaml` after loop exits. |

**Round R (1 → 3):**

1. Dispatch `ce-review-dispatcher` (model: opus):

    ```text
    Invoke ce:review via the Skill tool with arguments:
      mode:headless plan:<planPath>

    ce:review will apply safe_auto fixes in a single pass and return structured findings.
    Parse its structured output and return ONLY:
      {"runId": "<id>", "blockers": <count>, "high": <count>, "medium": <count>, "low": <count>, "nit": <count>,
       "findings": [{"id": "...", "severity": "...", "autofixClass": "...", "owner": "...", "suggestedFix": "..."}]}

    /auto-answer autopilot
    ```

2. If `blockers == 0 && high == 0 && medium == 0`: loop done; proceed to 2.4. LOW + NIT are logged, not blocked.
3. Else if R < 3: dispatch `review-fixer` (model: sonnet) with `findings` filtered to BLOCKER + HIGH + MEDIUM and re-enter step 1 of Round R+1.
4. Else (R == 3 with residual BLOCKER/HIGH/MEDIUM): **failure-recovery gate** — AskUserQuestion:
    - `Halt (preserve state)` → tracking stage = `review-escalated`, exit.
    - `Revert to last-green` → `git reset --hard <lastGreenSha>` → exit with `reverted` status.
    - `Escalate (open PR with ⚠️ REVIEW-ESCALATED banner)` → skip to 2.5, prepend warning banner to PR body including residual-findings summary.

After the loop exits green (or escalated), append residual LOW/NIT to `docs/known-issues.yaml` if it exists; otherwise surface them in the Phase 3 output block.

**Why MEDIUM blocks:** in `/ce-review`'s taxonomy, MEDIUM findings typically indicate subtle bugs, missed edge cases, or maintainability hazards — not style. Shipping them silently is the slow-motion version of shipping a BLOCKER. LOW + NIT are where stylistic/formatting nits live and are safe to defer.

**Optional `--cross-model`:** run Knowlune's `code-review` subagent (via Task, not `/ce-review`) in parallel with step 1 of Round 1 only. Merge findings before evaluating counts. Not re-run on R2/R3.

### 2.4 Demo-reel classifier → conditional capture

Dispatch `demo-reel-classifier` sub-agent:

- **Model:** haiku
- **Prompt:**

```text
Run: git diff --stat <lastGreenSha> HEAD
Classify whether this diff contains observable UI/CLI behavior changes.

UI signals: .tsx, .css, route files under src/app/routes/, new files in src/app/pages/
CLI signals: bin/, scripts/ entry points with #!/usr/bin/env
Observable-negative: tests/**, docs/**, *.md only

Return ONLY: `{"shouldCapture": true|false, "suggestedTier": "browser-reel"|"terminal"|"screenshot"|"none", "rationale": "<one line>"}`.

/auto-answer autopilot
```

If `shouldCapture`, dispatch `ce-demo-reel-dispatcher` (model: sonnet):

```text
Invoke ce:demo-reel via Skill tool. Tier hint: <suggestedTier>.
Capture a reel demonstrating the feature introduced since <lastGreenSha>.

Return ONLY: `{"url": "<public-url>", "tier": "<tier>"}` or `{"error": "<reason>"}`.

/auto-answer autopilot
```

On error: do not halt — skip capture, continue to 2.5 (demo is optional).

### 2.5 PR creation

Dispatch `ce-git-commit-push-pr-dispatcher` sub-agent:

- **Model:** sonnet
- **Prompt shape:**

```text
Invoke ce:git-commit-push-pr via Skill tool.

Context to include in PR body:
- Demo reel URL (if any): <url or "none">
- Compound reminder: After merge, run: /ce-compound <slug-from-plan>
- Escalation banner (if applicable): ⚠️ REVIEW-ESCALATED — R3 review loop exited with residual blockers. Human review required before merge.

Return ONLY: `{"prUrl": "<url>"}`.

/auto-answer autopilot
```

## Phase 3 — Close out

### 3.1 Compound gate (decide timing)

Use **AskUserQuestion**:

```text
Question: "Run /ce:compound now to document lessons, or defer to post-merge?"

Options:
  1. Defer to post-merge (Recommended) — lessons from shipped code are most durable; PR body has a checkbox reminder
  2. Run /ce:compound now — capture implementation lessons before review may change them
  3. Skip — this PR has no surprising lessons worth compounding
```

Branch:

- **Defer** → proceed to 3.2 with `compoundStatus: deferred`.
- **Run now** → dispatch `ce-compound-dispatcher` (model: opus) before 3.2:

  ```text
  Invoke ce:compound via the Skill tool.

  Context to pass to ce:compound:
  - Plan: <planPath>
  - PR URL: <prUrl>
  - Branch: <branch>
  - Focus: implementation lessons from this run — what was non-obvious, what approaches failed, what invariants the solution relies on.

  Let ce:compound run its normal interview + write docs/solutions/<category>/<slug>-YYYY-MM-DD.md.

  Return ONLY: `{"solutionPath": "<path>"}` or `{"skipped": "<reason>"}`.

  /auto-answer autopilot
  ```

  Set `compoundStatus: run-pre-merge`, `solutionPath` tracked.

- **Skip** → `compoundStatus: skipped`, no doc, no reminder.

### 3.2 Final output

Print to user based on `compoundStatus`:

```text
✓ PR created: <prUrl>
Demo:         <demoUrl or "—">
Review:       R<rounds> (<blockers|high|medium> → 0)
Residual:     <N> LOW/NIT (see <location>)
Branch:       <branch>
Last-green:   <lastGreenSha>

Compound:     <see table below>
```

| compoundStatus | Compound line | PR body addition |
|---|---|---|
| `deferred` | `Deferred — after merge, run: /ce:compound <slug>` | Unchecked checkbox task (current default) |
| `run-pre-merge` | `Captured pre-merge → <solutionPath>` | No additional reminder (already done) |
| `skipped` | `Skipped by user` | No reminder |

### 3.3 Exit

Mark all TodoWrite items complete. Exit with code 0 (or return JSON in headless mode — v2).

**Why the gate exists:** every.to's philosophy says compound is the step that produces compound gains — but only when the lessons are durable. Defer-by-default preserves durability (lessons come from shipped code), while "Run now" handles the case where implementation lessons were the point (e.g., the PR is about proving an approach, not shipping a feature).

## Error recovery summary

| Failure | Action |
|---|---|
| Input unrecognized (v1 scope) | Surface friendly v2-landing-pad message, exit. |
| Brainstorm fails | Halt. Tracking `halted-at-brainstorm`. |
| Plan fails or blocks on question | Halt with question surfaced. User resolves manually and re-runs. |
| User aborts at plan gate | Clean exit, `status: aborted`. |
| Pre-checks fail | Halt with failed check name. User fixes and re-runs (v2 will auto-resume from this stage). |
| Review R3 escalation | AskUserQuestion: Halt / Revert / Escalate-to-PR-with-banner. |
| `/ce:work` fails mid-execution | Halt. Partial commits noted. User decides revert vs. continue. |
| `gh` not authenticated at PR stage | Halt. Commits preserved on branch. User runs `gh auth login` and re-invokes. |

## References

- Sub-agent model matrix: [references/sub-agent-models.md](references/sub-agent-models.md)
- Plan (full design): [`want-you-to-majestic-rabin.md`](../../../../Users/pedro/.claude/plans/want-you-to-majestic-rabin.md)
- Primary template: [`../epic-orchestrator/SKILL.md`](../epic-orchestrator/SKILL.md)
- Shared discipline: [`../_shared/orchestrator-principles.md`](../_shared/orchestrator-principles.md)
- CE plugin narrower peer: `/lfg` (plan → work → review → todo-resolve → test-browser)
- CE plugin source: `/Users/pedro/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/2.65.0/skills/`
- Every.to philosophy: https://every.to/guides/compound-engineering

## v1 → v2 → v3 checklist

- **v1 (this file):** bare idea | plan path → pipeline → PR. Plan gate hard. Review loop zero-tolerance. Demo-reel conditional. Compound reminder. `--cross-model` flag.
- **v2 (Unit 2 full + Unit 6):** adaptive classifier adds ideation/brainstorm/bug/story-file entries. Persistent tracking file. Resume semantics. `--headless` JSON mode.
- **v3 (Units 7–8):** `episodic-memory:search-conversations` Phase 0. `/techdebt` pre-review scan. `/design-review` parallel dispatch for UI. `/checkpoint` at phase boundaries. `superpowers:systematic-debugging` on bug path. `--autopilot` flag (cosmetic choices only). Skill-creator evals + description optimization.
