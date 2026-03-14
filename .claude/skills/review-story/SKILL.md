---
name: review-story
description: Use when running quality gates on a LevelUp story before shipping. Runs build/lint/tests, dispatches design review (Playwright MCP) and adversarial code review agents, generates consolidated report. Use after implementing a story to catch issues before /finish-story.
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

## Review Gates

**See:** [docs/review-gates.md](docs/review-gates.md) for:
- Canonical gate names (10 gates: build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines)
- `-skipped` variant logic
- Resumption detection algorithm
- Gate validation before marking `reviewed: true`

## Orchestrator Discipline

**See:** [../_shared/orchestrator-principles.md](../_shared/orchestrator-principles.md)

## Steps

**Immediately create TodoWrite** to give the user full visibility:

```
[ ] Identify story and detect resumption
[ ] Pre-checks: build
[ ] Pre-checks: lint
[ ] Pre-checks: type-check
[ ] Pre-checks: format-check
[ ] Pre-checks: unit tests
[ ] Pre-checks: E2E tests
[ ] Optional: burn-in validation (if applicable)
[ ] Lessons learned gate
[ ] Design review (Agent)
[ ] Code review — architecture (Agent)
[ ] Code review — testing (Agent)
[ ] Web design guidelines review (Agent)
[ ] Consolidate findings and verdict
```

Mark the first todo as `in_progress` and proceed:

1. **Identify story**: Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

2. **Detect worktree and resolve base path**:

   Before reading story files, detect if the current branch belongs to a git worktree and resolve the correct base path for file operations.

   ```bash
   # Get current git context
   CURRENT_BRANCH=$(git branch --show-current)
   CURRENT_ROOT=$(git rev-parse --show-toplevel)

   # Check if current branch belongs to a worktree
   WORKTREE_PATH=$(git worktree list --porcelain 2>/dev/null | awk '
     /^worktree / { path=$2 }
     /^branch / {
       if ($2 == "refs/heads/'"$CURRENT_BRANCH"'") {
         print path
         exit
       }
     }
   ')

   # Determine base path for file operations
   if [ -n "$WORKTREE_PATH" ] && [ "$WORKTREE_PATH" != "$CURRENT_ROOT" ]; then
     # Branch has a worktree, but we're in the main workspace
     BASE_PATH="$WORKTREE_PATH"

     echo "⚠️  Worktree detected" >&2
     echo "This story was started in a git worktree." >&2
     echo "📍 Worktree: $WORKTREE_PATH" >&2
     echo "📂 Current:  $CURRENT_ROOT" >&2
     echo "Using worktree path for file operations." >&2
     echo "" >&2
   else
     # Either no worktree, or we're already in it
     BASE_PATH="$CURRENT_ROOT"
   fi
   ```

   **All file path references in subsequent steps must use `${BASE_PATH}/` prefix.**

3. **Read story file** from `${BASE_PATH}/docs/implementation-artifacts/`. Extract acceptance criteria, tasks, current status, and **review tracking fields** (`reviewed`, `review_started`, `review_gates_passed`, `burn_in_validated`).

4. **Detect resumption**: **See:** [docs/review-gates.md](docs/review-gates.md#resumption-detection) for state machine logic (`reviewed` field: false → in-progress → true) and resumption conditions.

   **TodoWrite**: Mark "Identify story and detect resumption" → `completed`. Mark "Pre-checks: build" → `in_progress`.

5. **Pre-checks**: **See:** [docs/pre-checks-pipeline.md](docs/pre-checks-pipeline.md) for:
   - Unified pre-check script execution (`scripts/workflow/run-prechecks.sh`)
   - JSON output parsing (gates, UI changes, test patterns, auto-fixes)
   - Exit code handling (0=pass, 1=fail, 2=anti-patterns)
   - Burn-in suggestion logic (HIGH/MEDIUM/low confidence)
   - Burn-in execution and flakiness reporting

6. **Lessons Learned Gate** (automated documentation quality check):

   After pre-checks pass, validate that the story's "Challenges and Lessons Learned" section is properly documented before dispatching expensive review agents.

   a. Read the story file's "Challenges and Lessons Learned" section (typically at the end of the file).

   b. Check for placeholder text indicating incomplete documentation:
      - `[Document issues, solutions, and patterns worth remembering]`
      - `[Populated by /review-story — Playwright MCP findings]`
      - `[Populated by /review-story — adversarial code review findings]`
      - `[Architecture decisions, patterns used, dependencies added]`
      - Any other bracketed placeholder text in this section

   c. If placeholders found:
      - STOP the review and display clear error:
        ```
        ❌ Lessons Learned Gate FAILED

        The "Challenges and Lessons Learned" section in your story file has placeholder text.

        Placeholder text found:
        - [Document issues, solutions, and patterns worth remembering]

        Why this matters:
        - Epic 8 retrospective showed only 2/5 stories documented lessons learned
        - Undocumented lessons lead to repeated mistakes across stories
        - This gate enforces the 100% compliance that manual reminders failed to achieve

        What to do:
        1. Open ${BASE_PATH}/docs/implementation-artifacts/{story-id}.md
        2. Replace placeholder text with actual lessons learned:
           - Implementation challenges you faced
           - Solutions you discovered
           - Patterns worth remembering for future stories
        3. Commit your changes
        4. Re-run /review-story

        See story 8-1-study-time-analytics.md for excellent examples of lessons learned documentation.
        ```
      - Do NOT proceed to review agents
      - Keep `reviewed: in-progress`
      - Do NOT add any review gates to `review_gates_passed` (pre-checks passed but review didn't start)

   d. If no placeholders (lessons learned properly filled):
      - Continue to step 7 (review agent swarm)
      - Note in output: "✅ Lessons Learned Gate passed — documentation complete"

   **Rationale**: This automated gate addresses Epic 8 retrospective finding that only 2/5 stories documented lessons learned despite manual reminders. Automated enforcement achieves 100% compliance where manual processes achieved 40%.

7. **Review agent swarm**: **See:** [docs/agent-dispatcher.md](docs/agent-dispatcher.md) for:
   - Pre-dispatch skip conditions (resumption, UI changes)
   - Dev server health check (design review prerequisite)
   - Parallel Task dispatch (single message: design-review, code-review, code-review-testing)
   - Result validation and gate tracking
   - Report locations and finding deduplication

8-11. **Consolidated Reporting**: **See:** [docs/reporting.md](docs/reporting.md) for:
   - Test quality findings merge (from code-review-testing agent)
   - Consolidated report structure (severity-triaged findings)
   - Verdict determination (PASS vs BLOCKED)
   - Gate validation before marking `reviewed: true`
   - Completion output templates (PASS and BLOCKED)

After fixing issues, re-run `/review-story` — completed agent reviews are preserved and reused.

## Reference Tables

**See:** [docs/reference-tables.md](docs/reference-tables.md) for:
- Route map (source file pattern → React Router route)
- Receiving code review feedback principles
- Recovery procedures (pre-check failures, agent failures, interruptions, stale reviews)
