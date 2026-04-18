# Autonomy boundary & supporting-skill integrations (v3)

Defines exactly what `--autopilot` does and does not skip, and documents the five supporting skills wired into the pipeline at phase boundaries.

## `--autopilot` — scope

**Intent:** Let solo-dev runs flow without interruption on choices that don't materially change the result. Preserve every safety gate.

### What `--autopilot` DOES auto-answer

| Prompt | Default under `--autopilot` | Normal default |
|---|---|---|
| Demo-reel tier selection (`/ce:demo-reel`) | `browser-reel` for UI diffs, `terminal` for CLI diffs, `screenshot` for single-screen UI, `none` for docs-only | Ask |
| `/ce:review mode` choice | `autofix` | Ask |
| `/techdebt` extraction prompt (Phase 2.1.5) | `Extract if safe, skip if risky` (delegates to `/techdebt`'s own safety logic) | Ask |
| Resume-vs-start-fresh at stale tracking file (v2) | `Resume from <stage>` if `status` recoverable, else `Start fresh` | Ask |
| Low-confidence classifier fallback (v2) | Take classifier's top guess, proceed | Ask |

### What `--autopilot` does NOT skip (never)

| Gate | Why it stays hard |
|---|---|
| **Plan-approval gate (Phase 1.3)** | every.to: "silence is not approval". The sacred human checkpoint. |
| **R3 failure-recovery gate (Phase 2.3)** | Halt vs. Revert vs. Escalate touches destructive `git reset --hard`. Never automate. |
| **Phase 3 compound gate (Phase 3.1)** | Defer vs. Run-now vs. Skip changes what gets written to `docs/solutions/`. Cheap to ask; mistakes are costly to unwind. |
| **Any `gh` authentication prompt** | Credential-scoped; auth flow must be interactive. |
| **Any destructive command confirmation** | Knowlune's `safety-guardrail.sh` hook fires regardless of orchestrator flags. |

**Implementation invariant:** Every AskUserQuestion in SKILL.md must be tagged in source comments as either `# autopilot: auto-answer <default>` or `# autopilot: HARD — never skip`. Future maintainers can audit at a glance.

## Supporting-skill integration points

Five skills, five phase insertions. Each one is **additive** — failure of a supporting skill never blocks the main pipeline; it logs a warning and continues.

### 0.5 Episodic-memory context recall (Phase 0, before brainstorm)

**When:** After classifier returns, before dispatching any stage sub-agent.

**Why:** `/ce:brainstorm` and `/ce:plan` benefit from knowing whether the user has tackled this problem before. Prior failed approaches, prior decisions, prior sessions with context that got compacted away.

**Dispatch:** `episodic-memory-searcher` sub-agent (model: haiku), see prompt §13 in [sub-agent-prompts.md](sub-agent-prompts.md#13-episodic-memory-searcher-v3).

**Returns:** `{relatedSessions: [{date, summary, relevance}], topMatch: "<one-line digest>"}` or `{relatedSessions: []}`.

**Failure behavior:** If episodic-memory tools are unavailable or return errors, log `supporting-skill: episodic-memory unavailable` to tracking file and continue silently. Brainstorm/plan will run without this context — exactly like v2.

**Tracking file:** Append `relatedSessions` array to frontmatter under a new `supportingSkills.episodicMemory` key.

**Surface to user:** One-line banner after classifier output: `◆ Found 2 prior sessions on this topic (most recent: 2026-03-21). Dispatched brainstorm with context.`

### 2.1.5 Techdebt pre-review dedup scan (Phase 2, between /ce:work and /ce:review)

**When:** After `ce-work-dispatcher` returns green, before `pre-checks-runner`.

**Why:** `/ce:work` may have duplicated logic that already exists elsewhere. `/ce:review` catches some duplicates but not all; `/techdebt` is purpose-built for cross-codebase duplication detection. Running it before review means duplicates get extracted (if safe) before reviewers see the code — reducing review rounds.

**Dispatch:** `techdebt-dedup-dispatcher` sub-agent (model: sonnet), see prompt §14.

**Returns:** `{duplicatesFound: <count>, summary: "<one line per duplicate>", autoExtracted: <bool>, filesChanged: [...]}`.

**Decision tree:**

- `duplicatesFound == 0` → silent pass, proceed to pre-checks.
- `duplicatesFound > 0` AND `--autopilot` → delegate to `/techdebt`'s own `auto` mode. If it extracts, coordinator commits the extraction (same rule as review-fixer: coordinator commits).
- `duplicatesFound > 0` AND **not** `--autopilot` → AskUserQuestion:
  - `Extract duplicates now (Recommended if /techdebt flagged as safe)`
  - `Skip — leave for review agents to catch`
  - `Abort run — I want to rethink`

**Failure behavior:** `/techdebt` unavailable or errors → log warning, proceed to pre-checks. Never halts pipeline.

**Tracking file:** Append `supportingSkills.techdebt: {duplicatesFound, autoExtracted, filesChanged}` to frontmatter.

### 2.3b Parallel design-review dispatch (Phase 2, alongside /ce:review)

**When:** During Round 1 of the review loop, in parallel with `ce-review-dispatcher`.

**Why:** `/ce:review` is code-focused (logic, tests, types). Knowlune's `/design-review` agent uses Playwright MCP to actually open the app, click through the changed UI, and test accessibility + responsive design. Running them in parallel gives cross-perspective coverage; findings merge before the fix loop evaluates counts.

**Precondition:** Only fires if `modifiedFiles` from Phase 2.1 contains any of: `src/**/*.tsx`, `src/**/*.css`, `src/app/pages/**`, `src/app/components/**`.

**Dispatch:** `design-review-dispatcher` sub-agent (model: opus — UI judgment needs deep reasoning), see prompt §15.

**Runs:** Only on **Round 1** of the review loop. Subsequent rounds don't re-dispatch design-review (too expensive — each run opens a browser). If R1 design findings require fixes, they go into the R1 fixer pass along with `/ce:review` findings.

**Returns:** `{findings: [{id, severity, screenshotPath, description, suggestedFix}], reportPath: "docs/reviews/design/..."}`.

**Merge:** Coordinator concatenates `/ce:review` and `/design-review` findings arrays, then evaluates the severity bar. Fixer receives the union in Round 1.

**Failure behavior:** Playwright MCP unavailable, dev server fails to start, browser crashes → log warning, continue with `/ce:review` findings only. Never halts.

**Tracking file:** Append `supportingSkills.designReview: {reportPath, findingsCount}` to frontmatter.

### Phase boundary checkpoints (via /checkpoint)

**When:** After each of: classifier (0.4), plan-approval (1.3), work (2.1), review loop exit (2.3), PR creation (2.5), compound gate decision (3.1).

**Why:** Multi-day runs (large plans, deep review loops) need resume points that survive IDE close, machine restart, context compaction. The tracking file is the primary source of truth — `/checkpoint` is additional belt-and-suspenders that also captures TodoWrite state and in-session discoveries.

**Dispatch:** `checkpoint-dispatcher` sub-agent (model: haiku), see prompt §16. Fire-and-forget — coordinator does not wait for response; continues to next phase.

**Returns (asynchronously):** `{checkpointPath: "..."}`. If it never returns, that's fine — next phase is already proceeding.

**Contract:** Checkpoint captures: slug, phase completed, stage reached, artifact paths, tracking-file path, any user-visible blockers.

**Failure behavior:** `/checkpoint` unavailable or errors → silent. Tracking file already has the state; `/checkpoint` is redundant.

**Tracking file:** `supportingSkills.checkpoints: [{phase, path, at}]` — appended, not replaced.

### Bug path: superpowers:systematic-debugging (Phase 0.4 `debug` stage)

**When:** Classifier returns `stage: debug`. Replaces direct `/ce:debug` dispatch with a composite sub-agent that first invokes `superpowers:systematic-debugging`.

**Why:** Bug reports submitted to `ce-orchestrator` are often symptom descriptions ("streak resets at midnight"). `/ce:debug` jumps to reproduction; `superpowers:systematic-debugging` first does root-cause analysis (observation → hypothesis → test → refine), which produces a better plan for `/ce:plan` to turn into a fix.

**Dispatch:** `ce-debug-dispatcher` sub-agent (model: opus), see prompt §17.

**Flow inside the sub-agent:**

1. Invoke `superpowers:systematic-debugging` skill with the bug description.
2. Emit a root-cause hypothesis doc (`docs/brainstorms/YYYY-MM-DD-debug-<slug>-requirements.md`) structured as a CE brief — hypothesis as the "problem frame", reproduction steps as AC, scope explicitly bounded to the root cause.
3. Return `{requirementsPath}` — pipeline then runs `/ce:plan` on this brief exactly like the story-to-brief path.

**Failure behavior:** `superpowers:systematic-debugging` unavailable → fall back to v2's direct `/ce:debug` dispatch with a logged warning.

**Tracking file:** Record `bugRoutedViaSystematicDebugging: true` and the requirements path.

## Dispatch order when multiple supporting skills fire

At any single phase boundary, supporting skills dispatch in this order:

1. **Synchronous dependencies first** (sequential): episodic-memory (0.5) → classifier consumption, techdebt (2.1.5) → pre-checks consumption, design-review (2.3b) → round-1 fixer consumption, systematic-debugging (0.4-debug) → plan-input consumption.
2. **Fire-and-forget last** (parallel, no wait): `/checkpoint` dispatched after every upstream supporting skill returns.

Coordinator never waits on `/checkpoint` — it's additive durability, not pipeline logic.

## Token budget delta (v3 vs v2)

Each supporting skill adds token cost:

| Skill | Per-run cost (est.) | When incurred |
|---|---|---|
| episodic-memory | ~5–15k | Every run, Phase 0.5 |
| techdebt | ~30–100k | Every run with code changes, Phase 2.1.5 |
| design-review | ~50–150k | UI diffs only, R1 parallel |
| checkpoint | ~2–5k per boundary | 5–6 boundaries per run |
| systematic-debugging | ~20–60k | Bug input only |

**Baseline v2:** ~500k–1M tokens per run.
**v3 with all supporting skills:** +100–350k tokens, stays under 1.5M.
**v3 with `--autopilot` and no UI:** +10–50k tokens, close to v2 baseline.

**Mitigation:** Every supporting skill respects per-phase timeout. If a skill takes >90s, coordinator moves on and logs `supporting-skill: <name> timed out`.

## Why not integrate /ce-slack-research?

Explicitly out of scope per plan. Knowlune is solo-dev — no team Slack workspace, no cross-team decisions to pull in. The skill would fire, find nothing, and add tokens. If Knowlune later gets a team Slack, re-evaluate.

## Why these five and not others?

Considered and rejected for v3:

| Skill | Reason rejected |
|---|---|
| `/auto-answer` explicit invocation | Already tail-appended to every sub-agent prompt (discipline). Standalone invocation adds nothing. |
| `/design-iterator` | Overlaps `/design-review` and is iterative — blocks the pipeline waiting for convergence. Better invoked manually pre-pipeline. |
| `/ui-diff-check` | Unclear value for non-designer-led features. Revisit if UI regressions become a theme. |
| `/testarch-*` suite | Epic-level quality gates. `epic-orchestrator` dispatches these. Story-level pipeline doesn't need them. |

## Summary

v3 turns `ce-orchestrator` from a pipeline driver into a pipeline driver with context awareness, duplication hygiene, cross-perspective review, durable resume, and rigorous debug entry. `--autopilot` is the knob that lets solo-dev runs benefit from all of it without constant Q&A — while keeping the plan gate and R3 gate sacred.
