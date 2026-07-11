# Sub-agent model + effort matrix

Authoritative reference for which model + effort level each sub-agent uses, why, and what context it gets. Loaded on-demand when building dispatch prompts.

## Principles

- **Opus 4.7** — deep reasoning, planning, review, causal debugging, architectural decisions, adversarial critique. Expensive but worth it when the decision shapes code or catches real bugs.
- **Sonnet 4.6** — structured execution from a clear spec: applying review findings, generating PR bodies, orchestrating tool calls. Fast enough for inner loops, smart enough for multi-step recipes.
- **Haiku 4.5** — classification, pattern matching, deterministic tool running, YAML/JSON edits, summaries from clear input. Cheap and fast; use when the decision is narrow.

**Rule of thumb:** if getting it wrong means rework or bad code, use Opus. If the output is mechanical translation of a spec, use Sonnet. If the output is a 1-sentence classification, use Haiku.

## Effort + extended-thinking

Three effort levels, distinct from model choice:

- **low** — Haiku without extended thinking. Pure classification/lookup.
- **medium** — Sonnet without extended thinking, OR Opus without extended thinking when dialogue-driven. Structured work.
- **high** — Opus with extended thinking. Reasoning-heavy decisions where the extra tokens pay for themselves in better output.

**Why extended thinking matters for specific agents:**
- **plan-critic** — adversarial 5-lens review is exactly the task extended thinking was designed for
- **ce-plan** — architectural decisions benefit from deliberation
- **ce-review** — finding subtle bugs benefits from chain-of-thought
- **ce-debug** — root-cause analysis is pure reasoning

**Why NOT for others:**
- Haiku agents — thinking unavailable + work is deterministic
- **ce-work** — execution, not reasoning; thinking slows it down without improving correctness
- **ce-brainstorm** — dialogue-driven, user interrupts between turns
- **design-review** — Playwright tool results dominate; thinking adds little

## Discipline (applies to every sub-agent)

- Dispatched via `Task` with `run_in_background: true` — keeps intermediate tool output out of coordinator context.
- Prompt always appends `/auto-answer autopilot` as the last line — prevents sub-agent blocking on inferable Q&A.
- Prompt carries only the minimum context needed — not the full plan or diff.
- Returns a structured summary (JSON or ≤300-word markdown). Coordinator never reads back raw tool output.

## The matrix

| # | Sub-agent | Phase | Model | Effort | Thinking | Rationale |
|---|---|---|---|---|---|---|
| 1 | `input-classifier` | 0.4 | Haiku | low | off | Pattern match on input shape + existence checks |
| 2 | `episodic-memory-searcher` | 0.5 | Haiku | low | off | Fires `episodic-memory:search-conversations`; returns summary |
| 3 | `epic-story-resolver` (v4) | 0.7 | Haiku | low | off | Reads sprint-status.yaml, filters stories, returns list |
| 4 | `ce-ideate-dispatcher` | 1 | Opus | medium | off | Divergent idea generation; dialogue-driven |
| 5 | `ce-brainstorm-dispatcher` | 1 | Opus | medium | off | Multi-turn dialogue for requirements; user interrupts |
| 6 | `story-to-brief` | 0→1 | Sonnet | medium | off | Mechanical BMAD→CE translation with some judgment |
| 7 | `ce-plan-dispatcher` | 1.2 | Opus | **high** | **on** | Hardest reasoning step; plan quality compounds downstream |
| 8 | `plan-summarizer` | 1.3 | Haiku | low | off | Plan → ≤300-word digest; clean input, narrow output |
| 9 | **`plan-critic`** (v4) | 1.3 | Opus | **high** | **on** | Adversarial 5-lens review; where thinking earns its cost |
| 10 | `ce-plan-deepener` | 1.3 | Opus | **high** | **on** | Re-plans against user notes + critic blockers |
| 11 | `ce-debug-dispatcher` | 1→2 | Opus | **high** | **on** | Causal-chain reasoning; prepends `superpowers:systematic-debugging` |
| 12 | `ce-work-dispatcher` | 2.1 | Opus | medium | off | Writes code; thinking slows execution without improving correctness |
| 13 | `techdebt-dedup-dispatcher` | 2.1.5 | Sonnet | medium | off | Pattern match for duplicates; structured analysis |
| 14 | `sprint-status-updater` (v4) | 0+2.5 | Haiku | low | off | Pure YAML edit; mirrors `/start-story`/`/finish-story` |
| 15 | `pre-checks-runner` | 2.2 | Haiku | low | off | Tool choreography: build, lint, tsc, bundle |
| 16 | `ce-review-dispatcher` | 2.3 | Opus | **high** | **on** | Last line of defense; memory `feedback_review_agent_model.md` |
| 17 | `design-review-dispatcher` | 2.3 | Opus | medium | off | Playwright-driven UI review; tool output dominates |
| 18 | `review-fixer` | 2.3 | Sonnet | medium | off | Mechanical: read finding → edit → verify |
| 19 | `demo-reel-classifier` | 2.4 | Haiku | low | off | `git diff --stat` pattern match |
| 20 | `ce-demo-reel-dispatcher` | 2.4 | Sonnet | medium | off | Orchestrates recording tools; structured recipe |
| 21 | `ce-git-commit-push-pr-dispatcher` | 2.5 | Sonnet | medium | off | Git + gh CLI + PR body synthesis |
| 22 | `ce-compound-dispatcher` | 3.1 | Opus | **high** | **on** | Lesson extraction; must surface the non-obvious |
| 23 | `checkpoint-dispatcher` | boundaries | Haiku | low | off | Pure I/O; writes tracking file update |
| 24 | `sprint-status-checker` (v4) | closeout | Haiku | low | off | Reads sprint-status.yaml, prints summary of completed epic |
| 25 | `retrospective-dispatcher` | closeout | Opus | **high** | **on** | Reviews entire epic output; extracts patterns that compound into next run |
| 26 | `known-issues-triage` | closeout | Haiku | low | off | Lists `open` items added during epic, categorizes (schedule/wont-fix/fix-now) |
| 27 | `testarch-trace-dispatcher` | closeout (full) | Sonnet | medium | off | Generates requirements-to-tests traceability matrix |
| 28 | `testarch-nfr-dispatcher` | closeout (full) | Sonnet | medium | off | Non-functional requirements validation |
| 29 | `review-adversarial-dispatcher` | closeout (full) | Opus | **high** | **on** | Cynical critique of epic scope + implementation |
| 30 | `report-generator` (v4) | 0.7 closeout | Sonnet | medium | off | Mechanical synthesis from structured inputs (tracking file, sprint-status, review artifacts); not deep reasoning |

## Cost sanity check

Per full v4 run (all supporting skills + plan-critic on, single story):

| Model | Count | Est. tokens/run |
|---|---|---|
| Opus (thinking on) | 4–6 (plan, critic, deepen?, review, debug?, compound) | 500k–800k |
| Opus (no thinking) | 2–3 (brainstorm, work, design-review?) | 200k–400k |
| Sonnet | 4–5 (story-to-brief?, techdebt, fixer, demo, PR) | 100k–200k |
| Haiku | 6–8 (classifier, episodic, summarizer, pre-checks, demo-classifier, sprint-status, checkpoints) | 30k–60k |
| **Total per story** | ~20 agents | **~800k–1.5M** |

Epic-loop: multiply story cost × N stories + ~200k for closeout.

## When to override

- **Force extended thinking on a fixer** — never by default; the finding contract is already specific. Only override when review finding category is `architectural` (user flag).
- **Force Opus on classifier** — only if classifier confidence is `low` on repeat inputs. Rare.
- **Force Haiku on a dispatcher** — never. CE skills expect Opus-class reasoning; downgrading degrades every downstream step.

## Task tool parameter shape

```text
Task(
  description: "<short label>",
  subagent_type: "general-purpose",
  model: "opus" | "sonnet" | "haiku",
  prompt: "<lean prompt + /auto-answer autopilot>",
  run_in_background: true
)
```

Extended thinking is enabled in the prompt body (`<think>` delimiter or explicit instruction) rather than as a Task parameter — the harness respects model defaults.

**Never** pass `isolation: "worktree"` unless the sub-agent actually needs a clean workspace (only `ce-work` does, and only when invoked on a dirty tree).
