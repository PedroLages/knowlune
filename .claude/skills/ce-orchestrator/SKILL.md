---
name: ce-orchestrator
description: Use when driving a single feature, fix, or refactor end-to-end through the Compound Engineering pipeline — brainstorm → plan → work → review → demo-reel → PR with compound reminder. Triggered by requests to "ship this idea", "run the CE pipeline", "orchestrate compound engineering for X", or when the user wants the full every.to-style workflow (plan approval gate included) instead of invoking /ce-brainstorm, /ce-plan, /ce-work, /ce-review, /ce-git-commit-push-pr manually. Prefer this over /lfg when the work needs upstream brainstorming or the Knowlune-specific safety gates; /lfg is narrower (plan → work → review only).
color: red
memory: project
background: true
effort: medium
argument-hint: "[idea | docs/plans/*-plan.md | docs/brainstorms/*-requirements.md | docs/implementation-artifacts/stories/E##-S##*.md | E## (epic-loop) | bug description] [--cross-model] [--autopilot] [--headless] [--epic-closeout=standard|full|skip]"
---

# CE Orchestrator

Drives a single unit of work end-to-end through the Compound Engineering pipeline with one hard human gate at **plan approval**. Terminal state: **PR created + auto-merged** (via `gh pr merge --merge --admin`). `ce:compound` runs automatically post-merge.

**Status:** v4 — epic-loop runner (`/ce-orchestrator E##`) + auto-merge PR + auto-run compound. Builds on v3 (adaptive entry, tracking file, headless JSON, BMAD story-file bridge, `--autopilot`, supporting-skill integrations).

## Usage

```text
/ce-orchestrator "add keyboard shortcut help modal"                # bare idea → full pipeline
/ce-orchestrator docs/plans/2026-04-15-002-feat-search-plan.md     # existing plan → plan-approval gate → rest
/ce-orchestrator docs/implementation-artifacts/E116-S01*.md        # single story (BMAD bridge)
/ce-orchestrator E116                                              # epic-loop: run all remaining stories in E116 sequentially (v4)
/ce-orchestrator "<input>" --cross-model                           # add Knowlune review-story swarm in parallel (v1)
/ce-orchestrator "<input>" --autopilot                             # auto-answer cosmetic choices; plan + R3 gates stay hard (v3)
/ce-orchestrator --headless "<input>"                              # no AskUserQuestion; returns single-line JSON (v2)
```

Full input shape matrix in Phase 0.4 classifier table.

## Headless Mode Defaults (v4)

When `runMode == unattended` (i.e., `--headless`), every AskUserQuestion in the pipeline becomes an automatic decision logged to the tracking file. Exhaustive list so there are no surprise deadlocks:

| Gate | Phase | Interactive default | Headless default | Rationale |
| --- | --- | --- | --- | --- |
| Tracking file resume vs fresh | 0.1b | Prompt | `Start fresh` (archive previous) | Avoids silently resuming stale state |
| Low-confidence classifier fallback | 0.4 | Prompt with top-2 guesses | Pick classifier's top guess, log confidence | If classifier top guess is wrong, pipeline will surface via plan-critic anyway |
| Epic pre-flight (run all / first / abort) | 0.7 step 3 | Prompt | `Run all` | User opted into unattended — they want all |
| Inter-story halt (after abort/revert/escalate) | 0.7 step 4 | Prompt | Auto-continue to next story; append to `abortedStories[]` | Deadlock-free; full audit in tracking file |
| Plan-approval gate | 1.3 | Prompt | Assert `confidenceScore >= 85 && verdict == approve && blockers == 0` — else abort story | Critic is the human proxy; threshold is the contract |
| Plan deepen loop unresolved notes (round 2 exhausted) | 1.3 step 5 | Prompt | `Abort` this story | Don't ship a plan the critic couldn't sign off on |
| Techdebt extract duplicates | 2.1.5 | Prompt | `Extract if safe` (same as `--autopilot`) | Cosmetic; safe extractions improve the codebase |
| R3 review escalation | 2.3 | Prompt | `Halt (preserve state)` + story abort | Never ship a red tree; safe default |

**Rule:** any gate not in this table MUST NOT use AskUserQuestion — otherwise headless mode deadlocks. When adding a new gate, add its row here first.

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
7. Phase 3 — compound gate + finalize + exit

### 0.1b Tracking file init or resume (v2)

Full spec: [references/tracking-file-schema.md](references/tracking-file-schema.md).

1. Compute slug (from plan filename if plan-path input, else short hash of input text).
2. Check if `.context/compound-engineering/ce-runs/{slug}-{YYYY-MM-DD}.md` exists.
3. **If exists with non-terminal `status`:**
   - AskUserQuestion (skipped in `--headless`, defaults to `Start fresh`):
     - `Resume from <stage>` (Recommended)
     - `Start fresh (archive previous as .abandoned.md)`
     - `Abort`
   - Resume: read frontmatter, rehydrate TodoWrite from `stagesCompleted`, jump to `stage`, skip sub-agents whose output artifacts already exist.
   - Start fresh: `git mv` old file to `{slug}-{date}.abandoned.md`, create new.
4. **If no existing file (or terminal status):** write fresh tracking file with `status: active`, `stage: phase-0`, `startedAt: <ISO now>`, `schemaVersion: 1`.

### 0.1c Update tracking file on every phase boundary

After each sub-agent returns success, coordinator updates frontmatter (`stage`, `updatedAt`, `artifacts.*`, `stagesCompleted`) and appends a short `## Phase N.N — <name>` body section. Must happen before dispatching the next sub-agent — protects against context compaction dropping state.

### 0.2 Capture last-green SHA

Before any stage can mutate the tree, record the current commit as `lastGreenSha` (persisted in coordinator context for the R3 failure-recovery revert option):

```bash
git rev-parse HEAD
```

### 0.3 Banner the run

Print a one-shot banner before dispatching anything:

```text
╭─────────────────────────────────────────────╮
│ CE Orchestrator — v4                        │
│ Input:        <input, truncated to 60ch>    │
│ Mode:         <interactive|autopilot|unattended>│
│ Terminal:     PR merged + ce:compound run   │
│ Est. tokens:  ~500k–1M per story            │
╰─────────────────────────────────────────────╯
```

### 0.3b Mode-select prompt (v4)

**If no explicit flag was passed** (`--autopilot`, `--headless`, or both), dispatch AskUserQuestion once before proceeding:

```text
Question: "How do you want to run this?"
Options:
  1. Interactive (Recommended) — pause at every gate for review
  2. Autopilot — auto-answer cosmetic choices; plan-gate still pauses unless plan-critic scores ≥85 with no blockers
  3. Unattended (autopilot + headless) — fully automated; critic gates plan approval; aborted stories roll into next; safe to close terminal
```

Set internal flags based on selection:
- Option 1 → `autopilot=false, headless=false`
- Option 2 → `autopilot=true, headless=false`
- Option 3 → `autopilot=true, headless=true`

Tracking file records the chosen mode in `runMode`. If flags were passed explicitly on the CLI, skip this prompt and log `runMode: explicit-flag`.

**Why ask up front:** the commitment is hours (epic-loop: hours × N stories). One prompt up-front beats N prompts mid-run. Also makes unattended mode discoverable — many users don't know `--headless` exists.

### 0.4 Classify (v2 adaptive classifier)

Dispatch `input-classifier` sub-agent (model: haiku) with the user's `$ARGUMENTS` string and repo root. Full prompt in [references/sub-agent-prompts.md § 1](references/sub-agent-prompts.md). Returns:

```json
{
  "stage": "brainstorm" | "brainstorm-from-ideation" | "plan" | "plan-approval" | "story-to-brief" | "debug" | "epic-loop",
  "resumeArtifact": "<path or null>",
  "rationale": "<one sentence>",
  "confidence": "high | medium | low"
}
```

**Classification matrix:**

| Input shape | Detection rule | → Stage | Next dispatch |
|---|---|---|---|
| Empty / whitespace | — | ERROR | Exit with friendly message |
| Matches `^E\d+$` (epic id, no story suffix) | regex | `epic-loop` | Phase 0.7 epic-loop runner |
| Matches `docs/ideation/*-YYYY-MM-DD.md` (path exists) | glob + file test | `brainstorm-from-ideation` | `ce-brainstorm-dispatcher` with ideation path |
| Matches `docs/brainstorms/YYYY-MM-DD-*-requirements.md` (path exists) | glob + file test | `plan` | `ce-plan-dispatcher` with requirements path |
| Matches `docs/plans/YYYY-MM-DD-NNN-*-plan.md` (path exists) | glob + file test | `plan-approval` | `plan-summarizer`, skip to gate |
| Matches `docs/implementation-artifacts/stories/E##-S##*.md` (path exists) | regex + file test | `story-to-brief` | `story-to-brief` sub-agent → `ce-plan-dispatcher` |
| Non-path string with bug signal (keywords: `bug\|error\|broken\|fails\|crashes\|regression\|reset`, or starts with `fix\|debug\|diagnose`) | heuristic match | `debug` | `ce-debug-dispatcher` (prompt instructs systematic-debugging) |
| Non-path string, any other content | fallthrough | `brainstorm` | `ce-brainstorm-dispatcher` with idea |

**Low-confidence fallback:** if classifier returns `confidence: low`, surface to user via AskUserQuestion with the classifier's top-2 guesses + `None — abort and rethink`. User disambiguates in one click.

**Story-file path handling (`stage: story-to-brief`):**

When the classifier returns this stage, dispatch the `story-to-brief` sub-agent (model: sonnet — see [sub-agent-prompts.md § 12](references/sub-agent-prompts.md#12-story-to-brief-v2)) with the story path. It:

1. Reads the BMAD story file.
2. Extracts title, AC, context, dependencies, out-of-scope.
3. Writes `docs/brainstorms/YYYY-MM-DD-e##-s##-<slug>-requirements.md` in the CE brainstorm format.
4. Returns `{requirementsPath}`.

Pipeline then continues from Phase 1.2 (`/ce:plan`) with that requirements path — same as if the user had run `/ce:brainstorm` themselves on the idea behind the story. The original BMAD story file is **not modified** — it remains the strategic source of truth.

**Sprint-status tracking (v4):** immediately after `story-to-brief` returns, dispatch `sprint-status-updater` (haiku) to mark the story `in-progress` in `docs/implementation-artifacts/sprint-status.yaml`. Mirrors what `/start-story` does. Prompt:

```text
Update docs/implementation-artifacts/sprint-status.yaml.
Find the entry for story id "<E##-S##>". Set:
  status: in-progress
  startedAt: <ISO now>
  branch: <current branch name from `git branch --show-current`>
If the entry doesn't exist, return `{"error": "story not in sprint-status"}` — do NOT create a new entry.
Return ONLY: `{"updated": true}` or `{"error": "<reason>"}`.

/auto-answer autopilot
```

On error: log warning, proceed. Sprint tracking is additive bookkeeping — never halts the pipeline.

### 0.5 Episodic-memory context recall (v3)

After classifier returns, before any Phase 1 dispatch: dispatch `episodic-memory-searcher` (haiku) to retrieve prior sessions on this topic. See [references/autonomy-boundary.md § 0.5](references/autonomy-boundary.md#05-episodic-memory-context-recall-phase-0-before-brainstorm) and [references/sub-agent-prompts.md § 13](references/sub-agent-prompts.md#13-episodic-memory-searcher-v3).

- **Returns:** `{relatedSessions, topMatch}` — append to tracking `supportingSkills.episodicMemory`.
- **If `topMatch` non-null:** pass as a 1-line context hint in the next `ce-brainstorm-dispatcher` or `ce-plan-dispatcher` prompt body.
- **Failure:** log warning, proceed silently. Never halts.

### 0.6 Bug path — systematic-debugging handoff (v3)

When classifier returns `stage: debug`, dispatch `ce-debug-dispatcher` (opus) instead of invoking `/ce:debug` directly. The dispatcher runs `superpowers:systematic-debugging` first, then synthesizes a CE requirements brief the pipeline can plan against. See [references/autonomy-boundary.md § Bug path](references/autonomy-boundary.md#bug-path-superpowerssystematic-debugging-phase-04-debug-stage) and [sub-agent-prompts.md § 17](references/sub-agent-prompts.md#17-ce-debug-dispatcher-v3).

Returns `{requirementsPath, rootCause}`. Pipeline continues from Phase 1.2 `/ce:plan` using the brief — identical to the story-to-brief flow.

### 0.7 Epic-loop runner (v4)

When classifier returns `stage: epic-loop` (input matches `^E\d+$`), run all stories in the epic sequentially — one `ce-orchestrator` pass per story.

**Flow:**

1. Dispatch `epic-story-resolver` sub-agent (model: haiku):

   ```text
   Read docs/implementation-artifacts/sprint-status.yaml. Find the epic with id "<E##>".

   Return a JSON array of stories in execution order, filtered to status != done:
   [
     {"id": "E##-S##", "title": "...", "status": "planned|in-progress", "storyPath": "<path or null>"}
   ]

   Resolve storyPath by checking both:
   - docs/implementation-artifacts/stories/<id>*.md
   - docs/implementation-artifacts/<id>*.md (flat layout)

   If no stories remain, return `{"empty": true, "reason": "epic already complete"}`.

   /auto-answer autopilot
   ```

2. **Banner the epic:** print list of stories with count + estimated total token cost (per-story estimate × count).

3. **Pre-flight gate (single AskUserQuestion):**

   ```text
   Question: "Run all <N> remaining stories in <E##>? Each story will still pause at its own plan-approval gate."
   Options:
     1. Run all (Recommended)
     2. Run only first story (preview)
     3. Abort
   ```

   In `--headless` mode: skip prompt, run all.

4. **Sequential loop** — for each story in order:
   - If `storyPath` exists: recursively invoke ce-orchestrator with that path (goes through Phase 0.4 classifier → `story-to-brief` stage → rest of pipeline with its own plan gate).
   - If `storyPath` is null: dispatch `bmad-create-story` sub-agent first to materialize the story file, then proceed.
   - After each story: read its tracking file status. Handle non-green terminal status:
     - **Interactive / autopilot mode** → AskUserQuestion: `Continue to next story | Halt epic | Revert all + halt`.
     - **Unattended (headless) mode** → auto-continue to next story; append the abort reason to the epic tracking file's `abortedStories[]` array. Epic keeps running. Rationale: headless runs are unattended by definition — blocking on a prompt deadlocks the whole epic. The abort is recorded with full audit trail for post-run triage.
   - PRs auto-merge per 2.5, so each story's changes land on main before the next story starts — preserving story dependencies.

5. **Epic tracking file:** write `.context/compound-engineering/ce-runs/epic-<E##>-<YYYY-MM-DD>.md` with frontmatter `type: epic-loop, storiesTotal, storiesCompleted, storiesAborted, prUrls[]`. Updated after each story completes.

6. **Epic closeout (v4)** — runs after the final story merges. Mode controlled by `--epic-closeout=standard|full|skip` (default `standard`). Skipped entirely for single-story input (closeout only makes sense after an epic).

   **Standard (default):**
   - `sprint-status-checker` (haiku) → verifies epic fully complete, surfaces orphaned/in-progress stories.
   - `known-issues-triage` (haiku) → lists `open` items added to `docs/known-issues.yaml` during this epic; categorizes each as `schedule-future | wont-fix | fix-now-chore` based on severity + scope. Writes summary to epic tracking file.
   - `retrospective-dispatcher` (opus, extended thinking) → runs `bmad-retrospective` to extract patterns into `docs/engineering-patterns.md`, update memory files, and emit `docs/solutions/` entries where applicable. **Runs last** so it reviews final epic state including closeout results.

   **Full** (`--epic-closeout=full`) — adds before retrospective:
   - `testarch-trace-dispatcher` (sonnet) → requirements-to-tests traceability matrix.
   - `testarch-nfr-dispatcher` (sonnet) → non-functional requirements validation.
   - `review-adversarial-dispatcher` (opus, extended thinking) → cynical critique of epic scope + implementation.

   **Skip** (`--epic-closeout=skip`) — bypasses entire closeout. Tracking file marks `closeoutStatus: skipped`.

   All closeout dispatches are sequential (not parallel) and additive — failures log warnings and continue, never halt. In unattended mode, closeout runs with zero prompts (haiku/sonnet/opus all return structured output).

   **Why closeout compounds the next run:** `bmad-retrospective` writes patterns to `docs/engineering-patterns.md` → next epic's `/ce:plan` reads them via repo-research-analyst; memory updates surface via Phase 0.5 `episodic-memory-searcher`; `docs/solutions/` entries inform `/ce:compound` and future plan critics. Without closeout, each epic starts cold.

7. **Terminal state:** after closeout completes (or is skipped), print summary banner:

   ```text
   Epic <E##> — <X> of <N> stories shipped
   PRs merged: <list>
   Aborted/escalated: <list>
   Closeout: <standard|full|skipped>
   Patterns extracted: <count from retrospective>
   Next epic will start warmer thanks to this run's compounding.
   ```

**Plan-gate preservation:** each story still pauses at its own plan approval — epic-loop never batch-approves. If you want a single approval for the whole epic, that's a future feature (deferred).

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

1. **Dispatch in parallel:**
   - `plan-summarizer` (model: haiku) on `planPath` → ≤300-word digest.
   - `plan-critic` (model: opus) on `planPath` + origin doc → adversarial multi-lens review (v4).
2. **plan-critic** runs `compound-engineering:document-review` internally across 5 lenses — Coherence, Feasibility, Scope-alignment, Testability, AC-traceability — and returns:

   ```json
   {
     "confidenceScore": 0-100,
     "verdict": "approve | request-changes | reject",
     "blockers": [{"lens": "...", "issue": "...", "severity": "high|medium"}],
     "strengths": ["..."],
     "summary": "<=150 words"
   }
   ```

3. Display digest + critic verdict together. Use **AskUserQuestion**:
   - `Approve (Recommended)` → Phase 2
   - `Request changes` → deepen loop
   - `Abort` → tracking.status = `aborted`, exit
4. **Deepen loop** (max 2 rounds):
   - Prompt for user notes via AskUserQuestion free-text. If `plan-critic` returned blockers, pre-fill notes with the blocker list so the deepener addresses them.
   - Dispatch `ce-plan-deepener` (model: opus) with `{planPath, userNotes}` → ce:plan runs in interactive deepening mode and mutates the plan in place.
   - Re-dispatch `plan-summarizer` + `plan-critic` → fresh digest + verdict.
   - Ask again: `Approve` / `Request more changes (if round < 2)` / `Abort`.
5. After 2 rounds without approval: offer `Proceed with unresolved notes (appended to plan)` or `Abort`.

**Autopilot auto-approve path (v4):** when `--autopilot` is set AND `plan-critic.confidenceScore >= 85` AND `plan-critic.blockers.length == 0` AND `plan-critic.verdict == "approve"` → coordinator bypasses the AskUserQuestion step and proceeds to Phase 2. Tracking marks `planApproval: auto-approved-by-critic`. All other autopilot cases still require the human click.

**Never bypass this gate without critic consent.** `--headless` treatment asserts `confidenceScore >= 85` and aborts if the critic says reject. The sacred property (every.to: "silence is not approval") holds: approval is always explicit — either human click or critic-authorized with full audit trail.

**Why max 2 rounds:** if a plan needs 3+ refinements, the original requirements were likely wrong — better to abort and re-brainstorm than force a bad plan through.

**Why 85 threshold:** leaves headroom for the critic's own uncertainty. 100 would require perfection; below 80 would approve plans with material gaps. 85 empirically splits "ship with confidence" from "human judgment needed" on our sample runs.

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

### 2.1.5 Techdebt pre-review dedup scan (v3)

Between `/ce:work` and pre-checks: dispatch `techdebt-dedup-dispatcher` (sonnet). See [references/autonomy-boundary.md § 2.1.5](references/autonomy-boundary.md#215-techdebt-pre-review-dedup-scan-phase-2-between-cework-and-cereview) and [sub-agent-prompts.md § 14](references/sub-agent-prompts.md#14-techdebt-dedup-dispatcher-v3).

- `duplicatesFound == 0` → proceed silently to pre-checks.
- `--autopilot` → auto-extract safe duplicates; coordinator commits the extraction (`chore(ce-techdebt): …`) before proceeding.
- Non-autopilot → AskUserQuestion `Extract | Skip | Abort`. `Extract` runs `/techdebt` in auto mode; coordinator commits.
- Failure → log warning, proceed. Never halts.

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
4. `npx tsc --noEmit` — must succeed. Non-optional: esbuild performs type-erasure, not type-checking, so `npm run build` can pass while types are broken. Skipping this gate is how type regressions reach main.
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

**Parallel `/design-review` for UI diffs (v3):** if `modifiedFiles` contains `src/**/*.tsx`, `src/**/*.css`, `src/app/pages/**`, or `src/app/components/**`, dispatch `design-review-dispatcher` (opus) in parallel with step 1 of Round 1 only. Merge its findings into the R1 fixer input. See [autonomy-boundary.md § 2.3b](references/autonomy-boundary.md#23b-parallel-design-review-dispatch-phase-2-alongside-cereview) and [sub-agent-prompts.md § 15](references/sub-agent-prompts.md#15-design-review-dispatcher-v3). Playwright unavailable → log warning, continue with `/ce:review` only.

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

### 2.5 PR creation + immediate merge

Dispatch `ce-git-commit-push-pr-dispatcher` sub-agent:

- **Model:** sonnet
- **Prompt shape:**

```text
Invoke ce:git-commit-push-pr via Skill tool.

Context to include in PR body:
- Demo reel URL (if any): <url or "none">
- Compound reminder: After merge, run: /ce-compound <slug-from-plan>
- Escalation banner (if applicable): ⚠️ REVIEW-ESCALATED — R3 review loop exited with residual blockers. Human review required before merge.

After ce:git-commit-push-pr completes and returns the PR URL, immediately run:
  gh pr merge --merge --admin

This bypasses GitHub Actions CI. Local quality gates already ran during the review loop —
GitHub CI is redundant. Do not wait for CI to finish before merging.

Return ONLY: `{"prUrl": "<url>", "merged": true}` or `{"prUrl": "<url>", "merged": false, "mergeError": "<reason>"}`.

/auto-answer autopilot
```

**Sprint-status tracking — post-merge (v4):** if the original input was a story file (`storyId` recorded in tracking), dispatch `sprint-status-updater` (haiku) after the merge returns `merged: true`:

```text
Update docs/implementation-artifacts/sprint-status.yaml.
Find story "<E##-S##>". Set:
  status: done
  finishedAt: <ISO now>
  prUrl: <prUrl>
  mergedAt: <ISO now>
Return ONLY: `{"updated": true}` or `{"error": "<reason>"}`.

/auto-answer autopilot
```

On error: log warning, do NOT halt — the merge succeeded; sprint tracking is additive. Non-story inputs (bare ideas, bug descriptions) skip this dispatch — nothing to update.

### 2.6 Phase-boundary checkpoints (v3)

Fire-and-forget `checkpoint-dispatcher` (haiku) at each completed phase: post-classifier, post-plan-approval, post-work, post-review-loop, post-PR, post-compound-gate. Coordinator does **not** await the response — tracking file is the primary source of truth; checkpoint is additive durability for multi-day runs. See [autonomy-boundary.md § Phase boundary checkpoints](references/autonomy-boundary.md#phase-boundary-checkpoints-via-checkpoint) and [sub-agent-prompts.md § 16](references/sub-agent-prompts.md#16-checkpoint-dispatcher-v3).

## Phase 3 — Close out

### 3.1 Compound — run automatically post-merge

Since the PR was merged immediately in 2.5, dispatch `ce-compound-dispatcher` (model: opus) now — no user prompt needed:

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

Set `compoundStatus: run-post-merge`, `solutionPath` tracked. On error: log warning, set `compoundStatus: skipped`, proceed to 3.2.

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

### 3.3 Finalize tracking file (v2)

Run `scripts/finalize-ce-run.sh <tracking-path> [--json]`:

- Without `--json`: updates tracking frontmatter (`status: done`, appends summary section). Prints nothing to stdout.
- With `--json` (headless mode only): emits a single-line JSON envelope to stdout matching the success shape in [references/headless-mode.md](references/headless-mode.md).

### 3.4 Exit

- **Interactive mode:** mark all TodoWrite items complete. Exit with code 0.
- **Headless mode:** ensure the `finalize-ce-run.sh --json` output is the last thing written to stdout. Exit with code from [headless-mode.md exit code table](references/headless-mode.md#exit-code-table):
  - `0` — `pr-created` or `pr-created-escalated`
  - `2` — `aborted` (plan-confidence assertion failed)
  - `3` — `review-escalated`
  - `4` — `halted-at-<stage>`
  - `10` — `internal-error`

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
- Sub-agent dispatch templates: [references/sub-agent-prompts.md](references/sub-agent-prompts.md) — input-classifier, plan-summarizer, plan-deepener, review-fixer, story-to-brief
- Review loop semantics: [references/review-loop.md](references/review-loop.md)
- Compound gate: [references/compound-reminder.md](references/compound-reminder.md)
- Tracking file schema (v2): [references/tracking-file-schema.md](references/tracking-file-schema.md)
- Headless mode (v2): [references/headless-mode.md](references/headless-mode.md)
- Autonomy boundary + supporting-skill integrations (v3): [references/autonomy-boundary.md](references/autonomy-boundary.md)
- Finalize script (v2): [scripts/finalize-ce-run.sh](scripts/finalize-ce-run.sh)
- Plan (full design): [`want-you-to-majestic-rabin.md`](../../../../Users/pedro/.claude/plans/want-you-to-majestic-rabin.md)
- Primary template: [`../epic-orchestrator/SKILL.md`](../epic-orchestrator/SKILL.md)
- Shared discipline: [`../_shared/orchestrator-principles.md`](../_shared/orchestrator-principles.md)
- CE plugin narrower peer: `/lfg` (plan → work → review → todo-resolve → test-browser)
- CE plugin source: `/Users/pedro/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/2.65.0/skills/`
- Every.to philosophy: https://every.to/guides/compound-engineering

## v1 → v2 → v3 checklist

- **v1 (this file):** bare idea | plan path → pipeline → PR. Plan gate hard. Review loop zero-tolerance. Demo-reel conditional. Compound reminder. `--cross-model` flag.
- **v2 (Unit 2 full + Unit 6):** adaptive classifier adds ideation/brainstorm/bug/story-file entries. Persistent tracking file. Resume semantics. `--headless` JSON mode.
- **v3 (Units 7–8, this file):** `episodic-memory:search-conversations` at Phase 0.5. `/techdebt` pre-review dedup scan at Phase 2.1.5. `/design-review` parallel dispatch at Phase 2.3b for UI diffs. `/checkpoint` at Phase 2.6 boundaries (fire-and-forget). `superpowers:systematic-debugging` on bug path at Phase 0.6. `--autopilot` flag auto-answers cosmetic prompts only (plan gate + R3 gate remain hard — see [autonomy-boundary.md](references/autonomy-boundary.md)). Expanded eval coverage.
