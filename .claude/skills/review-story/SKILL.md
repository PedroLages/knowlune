---
name: review-story
description: Use when running quality gates on a Knowlune story before shipping. Runs build/lint/tests, dispatches design review (Playwright MCP) and adversarial code review agents, generates consolidated report. Use after implementing a story to catch issues before /finish-story.
argument-hint: "[E##-S##]"
disable-model-invocation: true
---

# Review Story

Runs all quality gates: pre-checks, design review, code review, and test quality review. Produces a consolidated severity-triaged report. Supports resumption — interrupted reviews skip already-completed gates on re-run.

## Usage

```
/review-story E01-S03
/review-story          # derives story ID from branch name
```

## Gate Configuration

**All gate definitions are now in `config/gates.json`** (single source of truth). This includes canonical names, required/skip conditions, and validation rules.

See: `.claude/skills/review-story/config/gates.json`

## Orchestrator Discipline

The orchestrator (main session) should:
- **Call scripts** for deterministic work (state mgmt, validation, reports)
- **Make decisions**: resumed? reviewed? UI changes? lightweight?
- **Dispatch agents** via Task tool (parallel when independent)
- **Interactive work stays inline**: AskUserQuestion, LLM generation, agent dispatch

The orchestrator should NOT:
- Do deep code analysis (delegate to agents)
- Retain raw build/lint/test output beyond error messages
- Perform review reasoning (agents handle this)
- **Output text when individual agents complete** — no "X review complete" messages

## Context Discipline (Output Suppression)

This skill runs in a forked context. To protect the user's conversation from context flood:

**NEVER emit:**
- Successful raw command output (build logs, lint output, passing test results)
- Per-agent completion chatter ("Design review complete", "Code review finished")
- Manual inline summaries of agent findings (consolidated report handles this)
- Manual verdict text outside the completion templates in reporting.md
- Progress narration ("Now running code review...", "Waiting for agents...")

**ONLY emit to user:**
1. **Pre-dispatch banner** (Step 6): one line listing dispatched agents
2. **Blocking failure output** (Steps 2–5): raw output ONLY when a gate fails
3. **AskUserQuestion prompts** (Steps 3, 5): interactive decisions only
4. **Final summary** (Step 8): completion template from reporting.md

**Error output rule:** Show raw command output ONLY on failure (`exit_code != 0`). On success, consume silently and update state.

**No manual aggregation rule:** The orchestrator must NOT:
- Parse agent prose or regex-scrape findings
- Count blockers manually
- Write or rewrite consolidated findings inline
- Set `reviewed: true` before `validate-gates.py` passes (enforced by `finalize-review.sh`)
- Produce multiple conflicting summaries

Consolidation happens ONLY through `finalize-review.sh` → downstream scripts.

## Steps

**Immediately create TodoWrite** to give the user full visibility:

```
[ ] Identify story and detect resumption
[ ] Detect review tier (lite/standard/full)
[ ] Pre-checks (via run-prechecks.sh)
[ ] Burn-in validation (if applicable)
[ ] Lessons learned gate
[ ] Deduplication scan (optional)
[ ] Design review (Agent) [if tier >= standard + UI changes]
[ ] Code review — architecture (Agent)
[ ] Code review — testing (Agent) [if tier >= standard]
[ ] Performance benchmark (Agent) [if tier == full]
[ ] Security review (Agent)
[ ] Exploratory QA (Agent) [if tier == full + UI changes]
[ ] OpenAI adversarial review (Agent) [if tier == full + available]
[ ] GLM adversarial review (Agent) [if tier == full + available]
[ ] Consolidate findings and verdict
```

Mark the first todo as `in_progress` and proceed:

### 1. Identify story and detect resumption

Call `review-state.sh` — it handles story ID resolution, worktree detection, state
load/normalize, frontmatter update, sprint-status sync, and log directory creation:

```bash
STORY_ID="${ARGUMENTS:-}"  # from skill argument, or empty to derive from branch

INIT=$(bash scripts/workflow/review-state.sh \
  ${STORY_ID:+--story-id=$STORY_ID})

STORY_ID=$(echo "$INIT" | jq -r '.story_id')
STORY_FILE=$(echo "$INIT" | jq -r '.story_file')
BASE_PATH=$(echo "$INIT" | jq -r '.base_path')
RESUMING=$(echo "$INIT" | jq -r '.resuming')
GATES_PASSED=$(echo "$INIT" | jq -r '.gates_already_passed | join(",")')
LOG_DIR=$(echo "$INIT" | jq -r '.log_dir')
```

If `resuming == true`: inform "Resuming interrupted review. Previously passed gates: [list]."
If `previous_status == true`: inform "Story already reviewed — re-running full review."

TodoWrite: Mark "Identify story and detect resumption" → `completed`. Mark "Pre-checks" → `in_progress`.

### 1b. Detect review tier

Detect diff scope to select the right review tier — skips unnecessary agents on small changes:

```bash
DIFF_LINES=$(git diff main --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
UI_FILE_COUNT=$(git diff main --name-only 2>/dev/null | grep -cE '\.(tsx|css)$' || echo "0")
SECURITY_FILE_COUNT=$(git diff main --name-only 2>/dev/null | grep -cE '(auth|api|env|config|hook|payment|stripe)' || echo "0")
NEW_PAGES=$(git diff main --name-only 2>/dev/null | grep -cE 'src/app/pages/' || echo "0")
```

**Tier selection:**

| Condition | Tier | Agents dispatched |
|-----------|------|-------------------|
| `DIFF_LINES < 50` AND `UI_FILE_COUNT == 0` | **lite** | code-review + security-review |
| `DIFF_LINES < 300` AND `NEW_PAGES == 0` | **standard** | code-review + code-review-testing + security-review + design-review (if UI) |
| Otherwise | **full** | All 6 required + optional external |

**Override conditions** — always use `full`:
- `SECURITY_FILE_COUNT > 0` (auth/payment changes need security + full review regardless of size)
- Resuming an interrupted review (use previous tier)

```bash
# Determine tier
if [ "$SECURITY_FILE_COUNT" -gt 0 ] || [ "$NEW_PAGES" -gt 1 ]; then
  REVIEW_SCOPE="full"
elif [ "$DIFF_LINES" -lt 50 ] && [ "$UI_FILE_COUNT" -eq 0 ]; then
  REVIEW_SCOPE="lite"
elif [ "$DIFF_LINES" -lt 300 ] && [ "$NEW_PAGES" -eq 0 ]; then
  REVIEW_SCOPE="standard"
else
  REVIEW_SCOPE="full"
fi
```

**Confirm with user for non-full tiers:**

```
AskUserQuestion({
  question: "Diff scope: ${DIFF_LINES} lines, ${UI_FILE_COUNT} UI files. Review tier: [TIER]. Proceed?",
  options: [
    { label: "Proceed with [TIER] tier (${agent_count} agents)", description: "..." },
    { label: "Upgrade to full review (all 6 agents)", description: "Maximum coverage" }
  ]
})
```

Pass `REVIEW_SCOPE` to `prepare-dispatch.py` in Step 6.

### 2. Pre-checks (via run-prechecks.sh)

Run the unified pre-check script which handles build, lint, type-check, format, tests, and validation.
Passing `--log-dir` keeps all gate output on disk (silent mode) — orchestrator only sees errors:

```bash
PRECHECK_OUTPUT=$(bash scripts/workflow/run-prechecks.sh \
  --mode=full --story-id=$STORY_ID --base-path=$BASE_PATH \
  --log-dir="${BASE_PATH}/${LOG_DIR}")
PRECHECK_EXIT=$?
```

**If pre-checks failed** (`$PRECHECK_EXIT != 0`): STOP with error output from script. Keep `reviewed=in-progress`.

**Extract precheck results for downstream use**:

```bash
HAS_UI_CHANGES=$(echo "$PRECHECK_OUTPUT" | jq -r '.ui_changes // false')
TEST_PATTERN_FINDINGS=$(echo "$PRECHECK_OUTPUT" | jq -r '.test_pattern_findings // ""')
```

**Update gates_passed_list from precheck results** (parse from run-prechecks.sh JSON output).

**Carried debt reminder** (Epic 16 retro): Extract epic number from story ID, find previous epic's retro, scan for HIGH/MEDIUM debt items, display as non-blocking reminder.

TodoWrite: Mark all pre-check todos → `completed`. Mark "Burn-in validation" (if applicable) → `in_progress`.

### 3. Burn-in validation (if E2E spec exists and anti-patterns detected)

**Same interactive logic as original SKILL.md** — this stays inline because it requires AskUserQuestion.

If HIGH confidence (anti-patterns detected):
```
AskUserQuestion({
  question: "E2E tests passed but anti-patterns detected. Run burn-in validation?",
  header: "Burn-in test",
  options: [
    { label: "Run burn-in — 10 iterations (Recommended)", description: "..." },
    { label: "Skip — proceed to reviews", description: "..." }
  ]
})
```

If burn-in selected: run `npx playwright test ... --repeat-each=10 --project=chromium`, handle flakiness per original logic (quarantine vs stop).

TodoWrite: Mark "Burn-in validation" → `completed`. Mark "Lessons learned gate" → `in_progress`.

### 4. Lessons learned gate

**Same auto-population logic as original SKILL.md** — stays inline because it requires LLM generation.

Check for placeholder text or <50 words of substantive content in "Challenges and Lessons Learned" section. If found, auto-populate using git log/diff context, commit changes.

TodoWrite: Mark "Lessons learned gate" → `completed`. Mark "Deduplication scan" → `in_progress`.

### 5. Deduplication scan (optional)

**Same interactive logic as original SKILL.md** — stays inline because it requires AskUserQuestion.

Run `/techdebt` Phase 1-2 (harvest + scan). If duplicates found:
```
AskUserQuestion({
  question: "Deduplication scan found N duplicate patterns. Extract shared modules before code review?",
  header: "Deduplication scan",
  options: [
    { label: "Extract duplicates (Recommended)", description: "..." },
    { label: "Skip — proceed to reviews", description: "..." }
  ]
})
```

If "Extract" selected: run `/techdebt` Phase 3-5, commit or skip as per original logic.

TodoWrite: Mark "Deduplication scan" → `completed`. Mark "Design review" → `in_progress`.

### 6. Review bundle and agent dispatch

**Generate review bundle** and build dispatch manifest in one sequence:

```bash
# Generate bundle (emits output path to stdout)
BUNDLE_PATH=$(bash scripts/workflow/make-review-bundle.sh \
  --story-id=$STORY_ID --base-path=$BASE_PATH)

# Build dispatch manifest (evaluate skip logic, resolve paths)
OPENAI_AVAILABLE=$([ -n "${OPENAI_API_KEY:-}" ] && echo "yes" || echo "no")
ZAI_AVAILABLE=$([ -n "${ZAI_API_KEY:-}" ] && echo "yes" || echo "no")

MANIFEST=$(python3 scripts/workflow/prepare-dispatch.py \
  --story-id=$STORY_ID \
  --base-path=$BASE_PATH \
  --has-ui-changes=$HAS_UI_CHANGES \
  --review-scope=$REVIEW_SCOPE \
  --gates-already-passed="$GATES_PASSED" \
  --resuming=$RESUMING \
  --gates-config=.claude/skills/review-story/config/gates.json)

# Start dev server if any dispatched agent needs it
DEV_SERVER_NEEDED=$(echo "$MANIFEST" | jq -r '.dev_server_needed')
if [ "$DEV_SERVER_NEEDED" = "true" ]; then
  DEV_STATUS=$(bash scripts/workflow/ensure-dev-server.sh --base-path=$BASE_PATH)
  if [ "$(echo "$DEV_STATUS" | jq -r '.status')" != "running" ]; then
    echo "⚠️  Dev server unreachable — design/performance/QA reviews will be skipped" >&2
  fi
fi
```

**Output pre-dispatch banner** (the ONLY visible output before final report):

```
Running N reviews in background... (list dispatched agents from manifest)
```

**TodoWrite**: Mark all non-skipped agent todos → `in_progress` simultaneously.

**Dispatch all agents with `dispatch: true` from manifest in a single message with `run_in_background: true`**.

For each agent in `manifest.agents` where `dispatch == true`, dispatch:
```
Task({
  subagent_type: "[agent.agent]",
  run_in_background: true,
  prompt: "Story $STORY_ID. Bundle: $BUNDLE_PATH. Save report to [agent.report_path]. Write JSON result to [agent.output_json_path] following agent-output.schema.json. Keep session return to one confirmation line only.",
  description: "[agent.gate] $STORY_ID"
})
```

Also dispatch `openai-code-review` if `$OPENAI_AVAILABLE == "yes"` and `glm-code-review` if `$ZAI_AVAILABLE == "yes"` (these are in the manifest as `phase: external`).

### 7. Collect results and consolidate

**After ALL agents complete** (batch collection):

For each completed agent, write its structured JSON return to the output_json_path from the manifest:
```bash
# Each agent writes its own JSON to output_json_path (agent-output.schema.json)
# If an agent returns unstructured text, parse it as a fallback:
echo "$AGENT_RETURN" | jq '.' > "${BASE_PATH}/.claude/state/review-story/agent-results/{gate}-${STORY_ID}.json"
```

Then call `finalize-review.sh` — it handles schema validation, merge, report generation, gate validation, verdict, and frontmatter sync:

```bash
FINAL=$(bash scripts/workflow/finalize-review.sh \
  --story-id=$STORY_ID --base-path=$BASE_PATH)

VERDICT=$(echo "$FINAL" | jq -r '.verdict')
REPORT_PATH=$(echo "$FINAL" | jq -r '.report_path')
SUMMARY=$(echo "$FINAL" | jq -r '.summary')
INVALID_AGENTS=$(echo "$FINAL" | jq -r '.invalid_agents | join(", ")')
```

If `invalid_agents` is non-empty, warn: "Agent contract failure: [list]. These reviews were excluded from the consolidated report."

**TodoWrite**: Mark all agent todos and "Consolidate findings and verdict" → `completed`.

### 8. Completion output

**Same output format as original SKILL.md** — this stays inline because it's the final user-facing output.

If `verdict == PASS`: show gate table, verdict, high-priority findings. If `verdict == BLOCKED`: show blockers and fix instructions.

## Recovery

- **Pre-checks fail**: Fix errors, re-run `/review-story`. Agent reviews already completed are preserved.
- **Review agent(s) fail**: Check dev server (design review) or git diff (code reviews). Re-run `/review-story`. Only failed gate(s) re-run.
- **Interrupted mid-review**: `checkpoint.sh` preserves state. Re-run resumes from where it left off.
- **Stale review after code changes**: Pre-checks validate new code. Completed agent reviews are reused unless you manually reset.

## Route Map

(Use original SKILL.md route map or reference from docs/reviews/)

## Known Issues Register

(Same as original SKILL.md — log pre-existing issues to docs/known-issues.yaml)

## When Review Agents Find Issues

Apply `receiving-code-review` principles: verify findings technically before implementing, don't blindly implement suggestions, use `systematic-debugging` for complex issues.
