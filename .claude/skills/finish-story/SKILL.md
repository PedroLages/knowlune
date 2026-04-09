---
name: finish-story
description: Use when a Knowlune story is ready to ship. Validates, creates PR. Auto-runs reviews if /review-story was not already run. Use after implementing and optionally reviewing a story.
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

**See:** [../_shared/orchestrator-principles.md](../_shared/orchestrator-principles.md)

## Steps

1. **Identify story**: Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

1.5. **Detect worktree and resolve base path**: Before reading story files, detect if the current branch belongs to a git worktree and resolve the correct base path for file operations.

   **See:** [../start-story/docs/worktree-detection.md](../start-story/docs/worktree-detection.md) for worktree detection logic and BASE_PATH resolution.

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
   [ ] Validate all required gates present
   [ ] Update story file and sprint status
   [ ] Commit, push, create PR
   [ ] Post-merge cleanup
   ```

   **If NOT reviewed (streamlined mode) — expanded:**
   ```
   [ ] Identify story and check status
   [ ] Pre-checks: dependency audit, format, lint, type-check, build, bundle analysis, tests
   [ ] Design review (Agent)
   [ ] Code review — architecture (Agent)
   [ ] Code review — testing (Agent)
   [ ] Performance benchmark (Agent)
   [ ] Security review (Agent)
   [ ] Exploratory QA (Agent) [if UI changes]
   [ ] Consolidate review findings
   [ ] Validate all required gates present
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
   - **If agent reviews completed** (`design-review` or `design-review-skipped`, `code-review`, `code-review-testing`, `performance-benchmark` or `performance-benchmark-skipped`, `security-review`, and `exploratory-qa` or `exploratory-qa-skipped` all in gates, reports exist):
     - Treat as comprehensive mode — run blocker cross-check + lightweight validation (step 5).
   - **If agent reviews incomplete**:
     - Inform the user: "Review was interrupted before completion. Running full review inline."
     - Run the full review pipeline with resumption — same as `/review-story` steps 3-7 (respecting `review_gates_passed` to skip completed agent reviews). Dispatch all non-skipped review agents (design-review, code-review, code-review-testing) **in a single message** for maximum parallelism.
     - If **Blockers** found → STOP with fix instructions.
     - If no blockers → continue to step 6.

4b. **If NOT reviewed** (streamlined mode):

   **See:** [docs/streamlined-mode.md](docs/streamlined-mode.md) for complete streamlined mode workflow.

   **Summary:**
   - Set `reviewed: in-progress`, `review_started: YYYY-MM-DD`, `review_gates_passed: []`
   - **Lessons Learned Gate**: Check for placeholder text (documented in streamlined-mode.md)
   - Run pre-checks via `./scripts/workflow/run-prechecks.sh --mode=full`
   - Run burn-in validation if applicable (E2E spec exists, tests passed, not already validated)
   - Dispatch all review agents in parallel (design-review, code-review, code-review-testing)
   - If **Blockers** found → STOP with fix instructions
   - If no blockers → set `reviewed: true`, continue to step 6

5. **If already reviewed** (comprehensive mode):

   **See:** [docs/comprehensive-mode.md](docs/comprehensive-mode.md) for complete comprehensive mode workflow.

   **Summary:**
   - **5a. Blocker cross-check**: Run `./scripts/workflow/validate-blockers.sh` or manually check code review report. If unresolved blockers found → STOP.
   - **5b. Lightweight validation**: Run `./scripts/workflow/run-prechecks.sh --mode=lightweight --skip-commit-check`. If any fail → STOP.

6. **Validate all required gates**: Before proceeding to PR creation, check that `review_gates_passed` contains all 12 canonical gates (base or `-skipped` variant):
   - `build`, `lint` (or `lint-skipped`), `type-check`, `format-check`
   - `unit-tests` (or `unit-tests-skipped`), `e2e-tests` (or `e2e-tests-skipped`)
   - `design-review` (or `design-review-skipped`), `code-review`, `code-review-testing`
   - `performance-benchmark` (or `performance-benchmark-skipped`), `security-review`, `exploratory-qa` (or `exploratory-qa-skipped`)

   **Missing gates** → STOP with error:
   ```
   ❌ Cannot create PR — missing required gates: [list]

   [For each missing gate, explain why and how to fix]

   Re-run /finish-story after fixing.
   ```

   **All gates present** → Continue to step 7.

7. **Update story file**:
   - Set `reviewed: true` if not already.
   - **DO NOT** set `status: done` yet — this happens AFTER merge.

8. **Update sprint status**: In `${BASE_PATH}/docs/implementation-artifacts/sprint-status.yaml`, set story → `review`.
   - **DO NOT** set to `done` yet — this happens AFTER merge.
   **Merge conflict prevention**: Before editing, pull the latest version from main to avoid stale statuses for other stories:
   ```bash
   git checkout main -- docs/implementation-artifacts/sprint-status.yaml
   ```
   Then apply the story status change on top of the fresh copy.

9. **Commit**: Stage story file, sprint-status.yaml, and any review reports.
   Apply `writing-clearly-and-concisely` rules to the commit message — active voice, omit needless words:
   ```
   git commit -m "feat(E##-S##): [concise description of what the story delivers]"
   ```

10. **Archive story spec**: If `${BASE_PATH}/tests/e2e/story-*.spec.ts` exists for this story, move it to `${BASE_PATH}/tests/e2e/regression/`:
   ```
   git mv ${BASE_PATH}/tests/e2e/story-{id}.spec.ts ${BASE_PATH}/tests/e2e/regression/
   ```
   **Post-move import fix (REQUIRED):** Moving a spec one directory deeper breaks relative imports. After the `git mv`, fix all `../support/` and `../utils/` imports in the moved file to `../../support/` and `../../utils/`:
   ```
   sed -i '' "s|from '\.\./support/|from '../../support/|g" ${BASE_PATH}/tests/e2e/regression/story-{id}.spec.ts
   sed -i '' "s|from '\.\./utils/|from '../../utils/|g" ${BASE_PATH}/tests/e2e/regression/story-{id}.spec.ts
   ```
   Verify the moved spec compiles: `RUN_REGRESSION=1 npx playwright test tests/e2e/regression/story-{id}.spec.ts --list`
   ```
   git commit -m "chore: archive E##-S## spec to regression"
   ```
   If no story spec exists in `${BASE_PATH}/tests/e2e/`, skip this step.

11. **Push branch**:

   **PR size check** (informational warning before push):
   ```bash
   git diff main...HEAD --stat | tail -1
   ```
   If total lines changed > 400, warn:
   ```
   ⚠️ Large PR: {N} lines changed. PRs over 400 LOC have 84% finding rate vs 31% for small PRs.
   Consider splitting into stacked PRs if changes are logically separable.
   ```
   This is a warning only — does not block push.

   `git push -u origin feature/e##-s##-slug`.

12. **Create PR**:

   **See:** [docs/pr-creation.md](docs/pr-creation.md) for PR template, writing guidelines, and Known Issues extraction (HIGH findings from review reports).

   Print the PR URL.

13. **Merge PR to main**: Ask the developer via AskUserQuestion:

   ```
   What would you like to do next?

   Options:
   1. "Merge to main" (Recommended)
      Description: "Merge the PR now and switch to main — prevents stale PR conflicts"
   2. "Keep working — make additional changes"
      Description: "Keep branch active for additional commits, re-run /finish-story later"
   3. "Skip merge — I'll merge manually later"
      Description: "Exit without merging (risk: unmerged PRs cause conflicts for subsequent stories)"
   ```

13a. **If "Merge to main"** (recommended):

   Merge the PR, then clean up:
   ```bash
   gh pr merge {PR_NUMBER} --merge
   ```

   If merge fails (e.g., branch protection rules), inform the user and fall back to manual merge.

   **After successful merge**, update story and sprint status to `done`:
   - Update story file: Set `status: done` and `completed: YYYY-MM-DD` in frontmatter.
   - Update sprint status: In `${BASE_PATH}/docs/implementation-artifacts/sprint-status.yaml`, set story → `done`.
   - Commit the status updates:
     ```bash
     git add docs/implementation-artifacts/{key}.md docs/implementation-artifacts/sprint-status.yaml
     git commit -m "chore: mark E##-S## done"
     ```

   Then proceed with cleanup:
   - Detect if running in a worktree: Check if `$(git rev-parse --show-toplevel)` contains `-worktrees/`.
   - **If in worktree**: Run `worktree-cleanup "${STORY_KEY}"`, switch to main workspace, checkout main, pull.
     **See:** [docs/worktree-cleanup.md](docs/worktree-cleanup.md) for complete worktree cleanup logic.
   - **If NOT in worktree**: `git checkout main && git pull`.
   - **Stale branch cleanup**: Prune remote-tracking refs and delete local branches whose upstream is gone:
     ```bash
     git fetch --prune
     GONE_BRANCHES=$(git branch -vv | grep ': gone]' | awk '{print $1}')
     if [ -n "$GONE_BRANCHES" ]; then
       echo "$GONE_BRANCHES" | xargs git branch -D
     fi
     ```
     This is silent if no stale branches exist. If branches are cleaned, output: "Cleaned up N stale branches: [list]".
   - **Checkpoint cleanup**: Delete the session checkpoint file if it exists:
     ```bash
     rm -f ${BASE_PATH}/docs/implementation-artifacts/sessions/{story-id}-checkpoint.md
     ```
     This is silent — no user notification needed. The checkpoint is no longer relevant after the story is shipped.
   - Continue to step 14.

13b. **If "Keep working" or "Skip merge"**:

   - Inform the user:
     ```
     👍 Keeping branch active.
     Story remains in `review` state.

     You can:
     • Make additional changes and commit them
     • Run /finish-story again to merge later
     • Or merge manually: gh pr merge {PR_NUMBER} --merge

     [If in worktree, show:]
     Worktree location: {worktree-path}
     ```
   - **STOP here**. Exit workflow. User will re-run `/finish-story` later.
   - **IMPORTANT**: Story and sprint status remain `review` (not `done`) since merge hasn't happened yet.

13c. **Doc sync** (optional, non-blocking): After successful merge (step 13a), dispatch the `doc-sync` agent in the background to check documentation consistency:

   ```
   Agent(
     subagent_type: "doc-sync",
     run_in_background: true,
     prompt: """
     Story: ${STORY_KEY}
     Story file: ${STORY_FILE_PATH}
     Changed files: $(git diff --name-only main...HEAD)

     Check engineering patterns, known issues, and sprint status
     for documentation drift after this story shipped.
     """
   )
   ```

   - This is **non-blocking** — do not wait for results before continuing to step 14.
   - When the agent completes, append its suggestions to the completion output (step 15).
   - If the agent finds 0 suggestions, omit it from output.

14. **Lessons learned** (optional): Ask the developer via AskUserQuestion with these options:

   - **"Claude, write them"** — Auto-generate lessons learned by analyzing the story's git log, review reports, and any blocker/fix cycles encountered during implementation. Write concise, actionable bullets covering: patterns discovered, pitfalls avoided, decisions made and why. Append to the story's "Challenges and Lessons Learned" section.
   - **"Yes, let me share"** — Wait for the developer to provide lessons, then append them.
   - **"Skip"** — No lessons to capture. Continue.

14b. **Pattern extraction** (after lessons captured — skip if Step 14 was skipped):

   Evaluate whether any discovery from this story warrants promotion to a reusable project artifact. This creates a continuous feedback loop — the system improves with each story rather than waiting for epic retrospectives.

   **Gather context:**
   - Read the story's "Challenges and Lessons Learned" section (just written in Step 14)
   - Read review reports if they exist (scan for files matching the story ID):
     - `${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md`
     - `${BASE_PATH}/docs/reviews/design/design-review-*-{story-id}.md`
     - `${BASE_PATH}/docs/reviews/code/code-review-testing-*-{story-id}.md`
     - `${BASE_PATH}/docs/reviews/security/security-review-*-{story-id}.md`
   - Read current `docs/engineering-patterns.md` (for deduplication)

   **Deduplication check:**
   - Extract all `##` headings from `docs/engineering-patterns.md`
   - For each candidate pattern, check:
     - Does the candidate topic match an existing heading? (case-insensitive substring match)
     - Does the candidate overlap >60% in keywords with an existing pattern's first 50 words?
   - Skip candidates that match existing patterns — only suggest genuinely new ones

   **Evaluate each substantive lesson** (skip trivial items like "used library X"):

   | Promotion Target | Criteria | Format |
   |-----------------|----------|--------|
   | **Engineering pattern** (`docs/engineering-patterns.md`) | Reusable coding pattern, architectural gotcha, or decision that applies across stories | `##` heading + explanation + code example (match format of existing 18 patterns) |
   | **Rule** (`.claude/rules/{area}.md`) | Process enforcement, quality constraint, or workflow rule that should be checked automatically | Append to existing rule file or create new file |
   | **Memory entry** | Project-specific context not generalizable enough for patterns/rules | Write via auto-memory system |

   **If no candidates found:** Inform user "No new patterns detected" and proceed to Step 15.

   **If candidates found:** Present via AskUserQuestion:

   ```
   Pattern extraction from E##-S## lessons:

   1. [pattern] "Pattern Title" → docs/engineering-patterns.md
      Preview: {2-line summary of what the pattern captures}

   2. [rule] "Rule Title" → .claude/rules/{area}/{file}.md
      Preview: {2-line summary of the rule}

   Options:
   - "Approve all" — apply all suggestions
   - "Review each" — approve/reject individually
   - "Skip" — no pattern extraction
   ```

   **If "Review each":** Iterate through suggestions with AskUserQuestion for each (Approve / Reject / Edit).

   **Apply approved suggestions:**
   - **Patterns**: Append to end of `docs/engineering-patterns.md` using the existing format:
     ```markdown
     ## Pattern Title

     [Explanation of the pattern, when to use it, and why]

     [Code example if applicable]

     **Case study**: E##-S## — [brief description of how this was discovered]
     ```
   - **Rules**: Append to the most relevant existing rule file in `.claude/rules/`, or create a new file if no existing file fits
   - **Memory**: Write memory entry using the auto-memory system (frontmatter format to `~/.claude/projects/.../memory/`)

   **Commit** (if any suggestions were applied):
   ```bash
   git add docs/engineering-patterns.md .claude/rules/
   git commit -m "docs: extract patterns from E##-S## implementation lessons

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
   ```

   This step is **non-blocking**. If user skips or no candidates found, proceed to Step 15.

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
   | Dependency audit       | clean / N warnings          |
   | Format check           | passed / auto-fixed N files |
   | Lint                   | passed / skipped            |
   | Type check             | passed / auto-fixed         |
   | Build                  | passed                      |
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

   [If epic IS complete — output ALL 5 steps exactly as written, do not abbreviate or omit any:]
   ### Epic Complete!

   All stories in Epic ## are done. Recommended next steps:
   1. `/sprint-status` — Verify all stories are done, surface risks
   2. `/testarch-trace` — Requirements-to-tests traceability
   3. `/testarch-nfr` — Non-functional requirements validation
   4. `/review-adversarial` — (Optional) Cynical epic-level critique
   5. `/retrospective` — Lessons learned and pattern extraction

   ---
   ```

**Without arguments**: Parse ID from current branch, run steps above.

## Reference Documentation

- **[Streamlined Mode](docs/streamlined-mode.md)** — Step 4b: reviews run inline, lessons learned gate, burn-in validation
- **[Comprehensive Mode](docs/comprehensive-mode.md)** — Step 5: blocker cross-check, lightweight validation
- **[Worktree Cleanup](docs/worktree-cleanup.md)** — Step 13b: automatic cleanup after PR merge
- **[PR Creation](docs/pr-creation.md)** — Step 12: template and writing guidelines
- **[Recovery Guide](docs/recovery.md)** — Troubleshooting all failure points
- **[Orchestrator Principles](../_shared/orchestrator-principles.md)** — Shared orchestration guidelines

## Scripts

- `./scripts/workflow/run-prechecks.sh` — Unified pre-check script (full or lightweight mode)
- `./scripts/workflow/validate-blockers.sh` — Blocker cross-check automation

## Recovery

**See:** [docs/recovery.md](docs/recovery.md) for comprehensive recovery guide.

**Quick reference:**
- **Steps 1-2 fail** (lookup): Nothing changed. Fix and re-run.
- **Steps 3-5 fail** (validation): Fix errors, re-run `/finish-story`.
- **Step 4a/4b fail** (inline review): Story stays `reviewed: in-progress` with `review_gates_passed` tracking progress. Re-run resumes.
- **Step 10 fail** (push): Check `git remote -v`, fix remote config, re-run.
- **Step 12 fail** (PR): Check `gh auth status`, authenticate if needed, re-run.
- **Step 13 (merge fails)**: Check branch protection rules or merge conflicts. Try `gh pr merge {number} --merge` manually.
- **Step 13a fail** (worktree cleanup): Manual cleanup: `git worktree remove {path} && git branch -D {branch}`.

## Common Mistakes

- **Running without implementation**: `/finish-story` is for completed stories. Implement first.
- **Ignoring Blockers**: Fix all blockers before re-running. They will not go away.
- **Skipping merge**: Unmerged PRs accumulate conflicts (sprint-status.yaml, schema.ts, shared files). Always merge promptly — "Merge to main" is the recommended default.
