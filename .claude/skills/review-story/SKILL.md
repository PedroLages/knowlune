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

## Steps

**Immediately create TodoWrite** to give the user full visibility:

```
[ ] Identify story and detect resumption
[ ] Pre-checks (via run-prechecks.sh)
[ ] Burn-in validation (if applicable)
[ ] Lessons learned gate
[ ] Deduplication scan (optional)
[ ] Design review (Agent)
[ ] Code review — architecture (Agent)
[ ] Code review — testing (Agent)
[ ] Performance benchmark (Agent)
[ ] Security review (Agent)
[ ] Exploratory QA (Agent) [if UI changes]
[ ] OpenAI adversarial review (Agent) [if available]
[ ] GLM adversarial review (Agent) [if available]
[ ] Consolidate findings and verdict
```

Mark the first todo as `in_progress` and proceed:

### 1. Identify story and detect resumption

Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

**Detect worktree and resolve base path**:

```bash
CURRENT_BRANCH=$(git branch --show-current)
CURRENT_ROOT=$(git rev-parse --show-toplevel)
WORKTREE_PATH=$(git worktree list --porcelain 2>/dev/null | awk '
  /^worktree / { path=$2 }
  /^branch / {
    if ($2 == "refs/heads/'"$CURRENT_BRANCH"'") {
      print path
      exit
    }
  }
')

if [ -n "$WORKTREE_PATH" ] && [ "$WORKTREE_PATH" != "$CURRENT_ROOT" ]; then
  BASE_PATH="$WORKTREE_PATH"
  echo "⚠️  Worktree detected — using $WORKTREE_PATH" >&2
else
  BASE_PATH="$CURRENT_ROOT"
fi
```

**All file path references in subsequent steps must use `${BASE_PATH}/` prefix.**

**Load/restore review state**:

```bash
STATE_JSON=$(bash scripts/workflow/checkpoint.sh restore --story-id=$STORY_ID --base-path=$BASE_PATH 2>/dev/null)
if [ -n "$STATE_JSON" ]; then
  # Parse state from JSON
  REVIEWED=$(echo "$STATE_JSON" | jq -r '.status')
  GATES_PASSED=$(echo "$STATE_JSON" | jq -r '.gates_passed_list[]')
  STORY_FILE=$(echo "$STATE_JSON" | jq -r '.story_file')
else
  # Fallback: find story file and parse frontmatter
  STORY_FILE=$(find "${BASE_PATH}/docs/implementation-artifacts" -name "*$(echo $STORY_ID | tr '[:upper:]' '[:lower:]')*.md" 2>/dev/null | head -1)
  # Parse frontmatter fields using awk/grep
  REVIEWED=$(awk '/^reviewed:/{print $2; exit}' "$STORY_FILE")
  GATES_PASSED=$(awk '/^review_gates_passed:/{for(;i<=NF;i++)print $i; exit}' "$STORY_FILE | tr -d '[],' | grep -v '^$' || echo "")
fi
```

**Detect resumption and handle reset**:

- If `reviewed: in-progress` and `review_gates_passed` non-empty:
  - Inform: "Resuming interrupted review. Previously passed gates: [list]. Re-running pre-checks..."
  - Set `resuming=true`
- If `reviewed: true`:
  - Inform: "Story already reviewed. Re-running full review."
  - Reset: set `reviewed=in-progress`, clear `review_gates_passed`, update `review_started`
- If `reviewed: false`:
  - Set `reviewed=in-progress`, `review_started=YYYY-MM-DD`, `review_gates_passed=[]` in story frontmatter

**Save state and mark todo completed**:

```bash
bash scripts/workflow/checkpoint.sh save --story-id=$STORY_ID --story-file=$STORY_FILE --base-path=$BASE_PATH >/dev/null
```

TodoWrite: Mark "Identify story and detect resumption" → `completed`. Mark "Pre-checks" → `in_progress`.

### 2. Pre-checks (via run-prechecks.sh)

Run the unified pre-check script which handles build, lint, type-check, format, tests, and validation:

```bash
PRECHECK_OUTPUT=$(bash scripts/workflow/run-prechecks.sh --mode=full --story-id=$STORY_ID --base-path=$BASE_PATH)
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

**Generate review bundle** (summary-first artifact for agents):

```bash
BUNDLE_PATH=$(bash scripts/workflow/make-review-bundle.sh --story-id=$STORY_ID --base-path=$BASE_PATH --output=-)
echo "$BUNDLE_PATH" | jq -r '.artifact_paths.bundle_path' > /tmp/bundle_path.txt
BUNDLE_PATH=$(cat /tmp/bundle_path.txt)
```

**Pre-dispatch checks** (determine which agents to dispatch — same logic as original SKILL.md):

```bash
OPENAI_AVAILABLE=$(printenv OPENAI_API_KEY >/dev/null 2>&1 && echo "yes" || echo "no")
ZAI_AVAILABLE=$(printenv ZAI_API_KEY >/dev/null 2>&1 && echo "yes" || echo "no")
```

**Check dev server** for design review: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`. Start if needed.

**Output pre-dispatch banner** (the ONLY visible output before final report):

```
Running N reviews in background... (design, code, testing, performance, security, QA)
```

**TodoWrite**: Mark all non-skipped agent todos → `in_progress` simultaneously.

**Dispatch all non-skipped agents in a single message with `run_in_background: true`**:

```
// Agents read bundle at $BUNDLE_PATH instead of inline context
// STRUCTURED RETURN FORMAT: STATUS, FINDINGS, COUNTS, REPORT path
Task({
  subagent_type: "design-review",
  run_in_background: true,
  prompt: "Story $STORY_ID. Bundle: $BUNDLE_PATH. Save report to docs/reviews/design/design-review-{date}-{story-id}.md. Return structured format: STATUS, FINDINGS, COUNTS, REPORT path.",
  description: "Design review $STORY_ID"
})

Task({
  subagent_type: "code-review",
  run_in_background: true,
  prompt: "Story $STORY_ID. Bundle: $BUNDLE_PATH. Test patterns: $TEST_PATTERN_FINDINGS. Save report to docs/reviews/code/code-review-{date}-{story-id}.md. Return structured format.",
  description: "Code review $STORY_ID"
})

// ... other agents (code-review-testing, performance-benchmark, security-review, exploratory-qa, openai-code-review if $OPENAI_AVAILABLE == "yes", glm-code-review if $ZAI_AVAILABLE == "yes")
```

### 7. Collect results and consolidate

**After ALL agents complete** (batch collection):

For each agent, parse structured return (STATUS/FINDINGS/COUNTS/REPORT). Store agent JSON outputs to `agent-results/` directory:

```bash
# For each agent return, write JSON following agent-output.schema.json
echo "$AGENT_RETURN" | jq '.' > .claude/state/review-story/agent-results/{agent-name}.json
```

**Merge findings with consensus scoring**:

```bash
python3 scripts/workflow/merge-agent-results.py \
  --agent-results-dir=.claude/state/review-story/agent-results/ \
  --output=.claude/state/review-story/consolidated-findings-$STORY_ID.json
```

**Generate final report**:

```bash
python3 scripts/workflow/generate-report.py \
  --findings=.claude/state/review-story/consolidated-findings-$STORY_ID.json \
  --run-state=.claude/state/review-story/review-run-$STORY_ID.json \
  --gates-config=.claude/skills/review-story/config/gates.json \
  --output=docs/reviews/consolidated-review-{date}-$STORY_ID.md
```

**Validate gates**:

```bash
VALIDATION=$(python3 scripts/workflow/validate-gates.py \
  --gates-config=.claude/skills/review-story/config/gates.json \
  --run-state=.claude/state/review-story/review-run-$STORY_ID.json)

VALID=$(echo "$VALIDATION" | jq -r '.valid')
CAN_MARK=$(echo "$VALIDATION" | jq -r '.can_mark_reviewed')
```

**Update state and story frontmatter**:

```bash
# Update review-run state with verdict
jq --arg verdict "$(echo "$VALIDATION" | jq -r '.verdict')" '.verdict = $verdict' \
  .claude/state/review-story/review-run-$STORY_ID.json > /tmp/state.json && \
  mv /tmp/state.json .claude/state/review-story/review-run-$STORY_ID.json

# Sync to story frontmatter (update reviewed field, review_gates_passed, etc.)
# ... (parse updated gates_passed_list from state, write to story frontmatter using awk/sed)
```

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
