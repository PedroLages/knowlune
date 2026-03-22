---
name: finish-story
description: Use when a EduVi story is ready to ship. Validates, creates PR. Auto-runs reviews if /review-story was not already run. Use after implementing and optionally reviewing a story.
argument-hint: "[E##-S##]"
disable-model-invocation: true
---

# Finish Story

Adaptive shipping skill. Detects whether `/review-story` was already run and adjusts accordingly.

## Usage

```
/finish-story E01-S03
/finish-story          # derives story ID from branch name
```

## Workflow Modes

**Comprehensive mode** (reviews already done):
```
/start-story → implement → /review-story → fix → /finish-story (lightweight)
```

**Streamlined mode** (reviews inline):
```
/start-story → implement → /finish-story (auto-runs reviews)
```

## Orchestrator Discipline

The orchestrator (main session) should:
- **Read state**: story file, sprint status, git status
- **Make decisions**: resumed? reviewed? UI changes?
- **Dispatch agents**: via Task tool (parallel when independent)
- **Collect results**: extract key data from agent returns
- **Update state**: frontmatter, sprint status, TodoWrite
- **Run git ops**: branch, commit, push, PR
- **Communicate**: completion output, AskUserQuestion

The orchestrator should NOT:
- Do deep code analysis (delegate to agents)
- Retain raw build/lint/test output beyond error messages
- Read large files for exploration (dispatch Explore agents instead)
- Perform review reasoning (agents handle this)

## Steps

1. **Identify story**: Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

1.5. **Detect worktree and resolve base path**: Before reading story files, detect if the current branch belongs to a git worktree and resolve the correct base path for file operations.

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

   All file path references in subsequent steps must use `${BASE_PATH}/` prefix.

2. **Verify story file**: Check `${BASE_PATH}/docs/implementation-artifacts/{key}.md` exists. Missing → STOP with error.

3. **Check reviewed status**: Read story file frontmatter `reviewed` field. Three possible states:

   - **`reviewed: true`** → comprehensive mode (step 5)
   - **`reviewed: in-progress`** → interrupted review mode (step 4a)
   - **`reviewed: false`** → streamlined mode (step 4b)

   **Dynamic TodoWrite** — create the appropriate todo list based on review status:

   **If already reviewed (comprehensive mode):**
   ```
   [ ] Identify story and check status
   [ ] Validate: build + lint + type-check + tests
   [ ] Cross-check unresolved blockers
   [ ] Update story file and sprint status
   [ ] Commit, push, create PR
   [ ] Post-merge cleanup
   ```

   **If NOT reviewed (streamlined mode) — expanded:**
   ```
   [ ] Identify story and check status
   [ ] Pre-checks: build, lint, type-check, format, tests
   [ ] Design review (Agent)
   [ ] Code review — architecture (Agent)
   [ ] Code review — testing (Agent)
   [ ] Consolidate review findings
   [ ] Update story file and sprint status
   [ ] Commit, push, create PR
   [ ] Post-merge cleanup
   ```

   Mark "Identify story and check status" → `completed` (already done).

3a. **Pre-finish commit gate** (if reviews will run inline):

   If `reviewed: false` (streamlined mode — reviews will run inline):

   ```bash
   git status --porcelain
   ```

   If uncommitted changes found, STOP and inform:
   ```
   ❌ Uncommitted changes detected.

   /finish-story in streamlined mode runs reviews inline, which analyze
   committed changes via `git diff main...HEAD`. Uncommitted changes will
   NOT be reviewed.

   Commit your changes first:
     git add -A && git commit -m "feat(E##-S##): ..."

   Then re-run /finish-story.
   ```

   If `reviewed: in-progress` or `reviewed: true`:
   Skip this check (reviews already done or resuming — validation in Step 5 handles it).

4a. **If `reviewed: in-progress`** (interrupted review):
   - Inform the user: "Previous `/review-story` was interrupted. Checking what completed."
   - Read `review_gates_passed` from frontmatter. Check for existing report files.
   - **If agent reviews completed** (`design-review` or `design-review-skipped`, `code-review`, and `code-review-testing` all in gates, reports exist):
     - Treat as comprehensive mode — run blocker cross-check + lightweight validation (step 5).
   - **If agent reviews incomplete**:
     - Inform the user: "Review was interrupted before completion. Running full review inline."
     - Run the full review pipeline with resumption — same as `/review-story` steps 3-7 (respecting `review_gates_passed` to skip completed agent reviews). Dispatch all non-skipped review agents (design-review, code-review, code-review-testing) **in a single message** for maximum parallelism.
     - If **Blockers** found → STOP with fix instructions.
     - If no blockers → continue to step 6.

4b. **If NOT reviewed** (streamlined mode):
   - Set `reviewed: in-progress`, `review_started: YYYY-MM-DD`, `review_gates_passed: []` in story frontmatter.
   - Run the full review pipeline inline — same steps as `/review-story` steps 5-7:
     a. **Pre-checks**: Run unified pre-check script:
        ```bash
        ./scripts/workflow/run-prechecks.sh \
          --mode=full \
          --story-id=${STORY_ID} \
          --base-path=${BASE_PATH}
        ```
        Parse JSON output, update `review_gates_passed`, extract `HAS_UI_CHANGES`. On failure (exit 1 or 2), STOP with error.
     b. Review agent swarm: dispatch all applicable agents (design-review, code-review, code-review-testing) **in a single message** for maximum parallelism. Mark all dispatched agent todos as `in_progress` simultaneously.
     c. Consolidated report
   - Update `review_gates_passed` after each gate completes.
   - If **Blockers** found → STOP with fix instructions. Developer fixes and re-runs `/finish-story`. Completed gates are preserved.
   - If no blockers → continue to step 6.

5. **If already reviewed** (comprehensive mode):
   - **5a. Blocker cross-check**: Read the latest code review report at `${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md`. Parse the `#### Blockers` section. If blockers exist:
     - Check each blocker's file:line against the current code (`git show HEAD:path/to/file`). If the code at that location still matches the blocker description (issue not fixed), STOP:
       ```
       Cannot ship — [N] unresolved blocker(s) from code review:
       1. [file:line]: [Description]
       2. [file:line]: [Description]
       Fix these and re-run /finish-story.
       ```
     - If the code has changed at those locations (likely fixed), note: "Code review had [N] blockers; code at those locations has changed since review. Proceeding with validation."
   - **5b. Lightweight validation**:
     Run unified pre-check script in lightweight mode:
     ```bash
     ./scripts/workflow/run-prechecks.sh \
       --mode=lightweight \
       --story-id=${STORY_ID} \
       --base-path=${BASE_PATH} \
       --skip-commit-check
     ```
     Parse JSON output. On failure (exit 1), STOP with error. Note any auto-fixes in output.
   - If any fail → STOP. Developer fixes and re-runs.

6. **Update story file**:
   - Set `status: done` and `completed: YYYY-MM-DD` in frontmatter.
   - Set `reviewed: true` if not already.

7. **Update sprint status**: In `${BASE_PATH}/docs/implementation-artifacts/sprint-status.yaml`, set story → `done`.

8. **Commit**: Stage story file, sprint-status.yaml, and any review reports.
   Apply `writing-clearly-and-concisely` rules to the commit message — active voice, omit needless words:
   ```
   git commit -m "feat(E##-S##): [concise description of what the story delivers]"
   ```

9. **Archive story spec**: If `${BASE_PATH}/tests/e2e/story-*.spec.ts` exists for this story, move it to `${BASE_PATH}/tests/e2e/regression/`:
   ```
   git mv ${BASE_PATH}/tests/e2e/story-{id}.spec.ts ${BASE_PATH}/tests/e2e/regression/
   git commit -m "chore: archive E##-S## spec to regression"
   ```
   If no story spec exists in `${BASE_PATH}/tests/e2e/`, skip this step.

10. **Push branch**: `git push -u origin feature/e##-s##-slug`.

11. **Create PR** via `gh pr create`:

    Apply `writing-clearly-and-concisely` to PR title and body. Active voice, no AI puffery, no filler.

    ```bash
    gh pr create --title "feat(E##-S##): [Story name]" --body "$(cat <<'EOF'
    ## Summary
    - [1-3 bullet points of what changed and why]

    ## Verification
    - Build: passed
    - Lint: {passed/skipped}
    - Type check: {passed/auto-fixed}
    - Format check: {passed/auto-fixed N files}
    - Unit tests: {passed/skipped} ({N} tests)
    - E2E tests: {passed/skipped} ({N} tests)
    - Design review: {passed/skipped/warnings} ([report link])
    - Code review: {passed/warnings} ([report link])
    - Code review (testing): {N/N ACs covered/warnings} ([report link])

    ## Test Plan
    - [ ] [Manual verification steps derived from acceptance criteria]

    🤖 Generated with [Claude Code](https://claude.com/claude-code)
    EOF
    )"
    ```

    Print the PR URL.

12. **Check PR merge status**: Ask the developer via AskUserQuestion:

    ```
    Has the PR been merged?

    [Yes] - Cleanup worktree and complete story
    [No]  - Keep worktree for additional changes
    ```

13a. **If PR NOT merged**:
    - Inform the user:
      ```
      👍 Keeping worktree active.

      You can:
      • Make additional changes and commit them
      • Run /finish-story again after PR is merged
      • Or manually cleanup: worktree-cleanup {story-key-lower}

      [If in worktree, show:]
      Worktree location: {worktree-path}
      ```
    - **STOP here**. Exit workflow. User will re-run `/finish-story` after merge.

13b. **If PR IS merged** (cleanup if in worktree):
    - Detect if running in a worktree: Check if `$(git rev-parse --show-toplevel)` contains `-worktrees/`.
    - **If in worktree**:
      - Extract story key: `STORY_KEY=$(basename $(pwd))`
      - Save current worktree path: `WORKTREE_PATH=$(pwd)`
      - Switch to main workspace:
        ```bash
        PROJECT_NAME=$(git remote get-url origin | sed 's/.*\///' | sed 's/.git$//')
        MAIN_WORKSPACE=$(dirname "$(git rev-parse --show-toplevel)" | sed 's/-worktrees$//')
        cd "$MAIN_WORKSPACE"
        ```
      - Clean up worktree:
        ```bash
        worktree-cleanup "${STORY_KEY}"
        ```
      - Checkout main and pull:
        ```bash
        git checkout main
        git pull
        ```
      - Inform user:
        ```
        ✅ Worktree cleanup complete!
        📂 You're now in main workspace
        🌿 On branch: main
        ```
    - **If NOT in worktree**:
      - Just switch to main and pull:
        ```bash
        git checkout main
        git pull
        ```
    - Continue to step 14.

14. **Lessons learned** (optional): Ask the developer via AskUserQuestion with these options:

    - **"Claude, write them"** — Auto-generate lessons learned by analyzing the story's git log, review reports, and any blocker/fix cycles encountered during implementation. Write concise, actionable bullets covering: patterns discovered, pitfalls avoided, decisions made and why. Append to the story's "Challenges and Lessons Learned" section.
    - **"Yes, let me share"** — Wait for the developer to provide lessons, then append them.
    - **"Skip"** — No lessons to capture. Continue.

15. **Completion output**: Display the following summary to the user.

    **Preparation** (not shown to user): Read the story file's acceptance criteria, tasks, and the git diff for the branch to understand what was delivered.

    **Writing guidelines** (not shown to user):
    - "What's New" bullets must describe what the user can now DO, not implementation details. Plain, non-technical language. 2-5 bullets.
      - Good: "You can now tag courses with topics like React or TypeScript and filter your library by subject"
      - Bad: "Added updateCourseTags method to Zustand store"
    - "Try It" steps must be concrete — name the page, the button, the expected result. 2-4 steps derived from acceptance criteria.
    - Apply `writing-clearly-and-concisely` rules throughout — active voice, no filler, no AI puffery.

    **Output template** (this is what the user sees):

    ```markdown
    ---

    ## Story Shipped: E##-S## — [Story Name]

    **PR**: [PR URL]

    ### What's New

    - [bullet 1]
    - [bullet 2]
    - [bullet 3]

    ### Try It

    1. [step 1]
    2. [step 2]
    3. [step 3]

    ---

    <details>
    <summary>Verification</summary>

    | Check                  | Result                      |
    | ---------------------- | --------------------------- |
    | Build                  | passed                      |
    | Lint                   | passed / skipped            |
    | Type check             | passed / auto-fixed         |
    | Format check           | passed / auto-fixed N files |
    | Unit tests             | passed (N) / skipped        |
    | E2E tests              | passed (N) / skipped        |
    | Design review          | passed / N warnings         |
    | Code review            | passed / N warnings         |
    | Code review (testing)  | N/N ACs covered / N warnings |

    - Mode: Comprehensive / Streamlined
    - Branch: `feature/e##-s##-slug`
    - Worktree: [Cleaned up / Main workspace]
    - Reports: `${BASE_PATH}/docs/reviews/design/` + `${BASE_PATH}/docs/reviews/code/`

    </details>

    ---

    [If epic NOT complete:]
    **Next up** — **E##-S##: [Name]**. Run `/start-story E##-S##` when ready.

    [If epic IS complete:]
    ### Epic Complete!

    All stories in Epic ## are done. Recommended next steps:
    1. `/testarch-trace` — Requirements-to-tests traceability
    2. `/testarch-nfr` — Non-functional requirements validation
    3. `/retrospective` — Lessons learned

    ---
    ```

**Without arguments**: Parse ID from current branch, run steps above.

## Recovery

- **Steps 1-2 fail** (lookup): Nothing changed. Fix and re-run.
- **Steps 3-5 fail** (validation): Fix errors, re-run `/finish-story`.
- **Step 4a/4b fail** (inline review): Story stays `reviewed: in-progress` with `review_gates_passed` tracking progress. Re-run `/finish-story` resumes — pre-checks re-run, completed agent reviews are skipped.
- **Step 9 fail** (push): Check `git remote -v`, fix remote config, re-run.
- **Step 10 fail** (PR): Check `gh auth status`, authenticate if needed, re-run.
- **Step 12 (PR not merged yet)**: Re-run `/finish-story` after merge. Worktree stays active for additional changes.
- **Step 13b fail** (worktree cleanup): If `worktree-cleanup` fails, manually remove: `git worktree remove {path} && git branch -D {branch}`.

## Common Mistakes

- **Running without implementation**: `/finish-story` is for completed stories. Implement first.
- **Ignoring Blockers**: Fix all blockers before re-running. They will not go away.
- **Auto-merging**: This creates a PR for human review. Do NOT auto-merge.
