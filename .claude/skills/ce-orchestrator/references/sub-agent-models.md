# Sub-agent model + dispatch matrix

Authoritative reference for which model each sub-agent uses, why, and what context it gets. Loaded on-demand when building Unit 2+ dispatch prompts.

## Principles

- **Opus 4.7** — deep reasoning, planning, review, causal debugging, architectural decisions. Expensive but worth it when the decision shapes code or catches real bugs.
- **Sonnet 4.6** — structured execution from a clear spec: applying review findings, generating PR bodies, orchestrating tool calls. Fast enough for inner loops, smart enough for multi-step recipes.
- **Haiku 4.5** — classification, pattern matching, summaries from clear input, deterministic tool running. Cheap and fast; use when the decision is narrow.

**Rule of thumb:** if getting it wrong means rework or bad code, use Opus. If the output is mechanical translation of a spec, use Sonnet. If the output is a 1-sentence classification, use Haiku.

## Discipline (applies to every sub-agent)

- Dispatched via `Task` with `run_in_background: true` — keeps intermediate tool output out of coordinator context.
- Prompt always appends `/auto-answer autopilot` as the last line — prevents sub-agent blocking on inferable Q&A.
- Prompt carries only the minimum context needed (plan path, diff summary, branch name) — not the full plan or diff.
- Returns a structured summary (JSON or ≤300-word markdown). Coordinator never reads back raw tool output.

## The matrix

| # | Sub-agent | Phase | Model | Rationale | Context in | Returns |
|---|---|---|---|---|---|---|
| 1 | `input-classifier` | 0 | Haiku | Simple pattern match: input path extension, string heuristics, file existence checks. | User input string + `ls docs/{ideation,brainstorms,plans}/` output | `{stage, resumeArtifact, rationale}` |
| 2 | `episodic-memory-searcher` (v3) | 0 | Haiku | Fires `episodic-memory:search-conversations`. Returns summary of related prior sessions. | Topic keyword | `{relatedSessions: [{id, summary}]}` |
| 3 | `ce-ideate-dispatcher` | 1 | Opus | `/ce-ideate` generates and ranks improvement ideas — divergent + evaluative reasoning. | Focus hint | `{ideationPath}` |
| 4 | `ce-brainstorm-dispatcher` | 1 | Opus | `/ce-brainstorm` runs a multi-turn dialogue to produce requirements. Needs context retention + domain reasoning. | Idea or ideation path | `{requirementsPath}` |
| 5 | `ce-plan-dispatcher` | 1 | Opus | `/ce-plan` is the hardest reasoning step. Plan quality compounds downstream. Worth the cost. | Requirements path | `{planPath, confidenceScore}` |
| 6 | `plan-summarizer` | 1 | Haiku | Reads plan → ≤300-word digest (goal, units, risks, terminal deliverable). Clean input, narrow output. | Plan path | `{summary: string}` |
| 7 | `ce-plan-deepen-dispatcher` | 1 | Opus | Re-runs `/ce-plan` in deepen mode with user change notes. Reasoning again. | Plan path + user notes | `{planPath}` |
| 8 | `story-to-brief` (v2) | 0→1 | Sonnet | Translates BMAD story AC → CE requirements doc. Mechanical mapping with some judgment. | Story path | `{requirementsPath}` |
| 9 | `ce-debug-dispatcher` | 1→2 | Opus | `/ce-debug` does causal-chain reasoning. Haiku would miss subtle root causes. v3 prepends `superpowers:systematic-debugging`. | Bug description or failing test | `{diagnosisPath?, planPath?}` |
| 10 | `ce-work-dispatcher` | 2 | Opus | `/ce-work` writes code; architectural + API decisions. Cost follows quality. | Plan path, branch name | `{commitShas: [], modifiedFiles: []}` |
| 11 | `pre-checks-runner` | 2 | Haiku | Runs deterministic checks: build, lint, tsc, bundle, port-5173 cleanup. Pure tool choreography, no reasoning. | Repo root | `{passed: bool, failures: [{check, details}]}` |
| 12 | `techdebt-scanner` (v3) | 2 | Sonnet | `/techdebt` Phase 1-2 — pattern match for duplicates, extract candidates. Structured analysis, not deep reasoning. | Recent diff | `{duplicates: [{pattern, occurrences}]}` |
| 13 | `ce-review-dispatcher` | 2 | Opus | `/ce-review` is the last line of defense before PR. Use opus per memory `feedback_review_agent_model.md` — sonnet runs out of context on deep reviews. | Branch, plan path | `{runId, blockers, high, medium, low}` |
| 14 | `design-review-dispatcher` (v3) | 2 | Opus | Playwright-MCP-driven UI review; accessibility + visual regression analysis. Same depth bar as code review. | Route(s) changed | `{findings: [{severity, description}]}` |
| 15 | `review-fixer` | 2 | Sonnet | Applies specific blocker/high findings. Mechanical: read finding → edit file → verify. Opus would be overkill. | Review findings JSON | `{fixedCount, skippedCount, notes}` |
| 16 | `demo-reel-classifier` | 2 | Haiku | Runs `git diff --stat`, pattern-matches `.tsx|.css|routes|CLI entry`. Pure classification. | Commit range | `{shouldCapture: bool, tier, rationale}` |
| 17 | `ce-demo-reel-dispatcher` | 2 | Sonnet | Orchestrates Playwright / terminal-record / screenshot tools. Structured recipe, not reasoning. | Feature description, tier | `{url, tier}` |
| 18 | `ce-git-commit-push-pr-dispatcher` | 2→3 | Sonnet | Calls `/ce-git-commit-push-pr`. Orchestrates git + gh CLI + PR body synthesis. Structured. | Branch, demo URL (if any), compound-reminder text | `{prUrl}` |
| 19 | `checkpoint-writer` (v3) | 0-3 | Haiku | Writes tracking file update. Pure I/O. | Stage name + state blob | `{checkpointPath}` |

## Cost sanity check

Per full v3 run (all supporting skills on), rough token budget:

| Model | Sub-agents | Est. tokens/run | Rationale |
|---|---|---|---|
| Opus | 7 (ideate, brainstorm, plan, plan-deepen?, debug?, work, review, design-review?) | 400k–700k | Deep-reasoning agents, big context windows. The cost driver. |
| Sonnet | 5 (story-to-brief, techdebt, fixer, demo-reel, PR) | 100k–200k | Inner-loop execution. |
| Haiku | 5 (classifier, episodic, summarizer, pre-checks, demo-classifier, checkpoint) | 20k–50k | Rounding error. |
| **Total** | 17 | **~500k–1M** | Matches the risk-table estimate. |

**Implication:** v1 should surface this estimate in a pre-run banner so the user isn't surprised. v3 can add a hard cap + confirmation prompt.

## When to override

- **Force Opus on a fixer** — if the review finding is architectural ("refactor this module"), Sonnet will fumble. Coordinator can pass `escalateToOpus: true` in the fixer prompt when the finding category matches architectural patterns.
- **Force Sonnet on classifier** — only if the input is ambiguous enough that Haiku pattern-matching is unreliable (rare; `--autopilot` off should be the first escape hatch, letting the user disambiguate).
- **Force Haiku on a dispatcher** — never. The CE skills themselves are built expecting Opus-class reasoning; downgrading the host model degrades every downstream step.

## Task tool parameter shape

When dispatching:

```text
Task(
  description: "<short label>",
  subagent_type: "general-purpose",  # or named agent if one fits
  model: "opus" | "sonnet" | "haiku",
  prompt: "<lean prompt + /auto-answer autopilot>",
  run_in_background: true
)
```

**Never** pass `isolation: "worktree"` unless the sub-agent actually needs a clean workspace (only `/ce-work` does, and only when the orchestrator is invoked on a dirty tree — a v2 consideration).
