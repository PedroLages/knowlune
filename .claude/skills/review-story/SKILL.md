---
name: review-story
description: Use when running quality gates on a EduVi story before shipping. Runs build/lint/tests, dispatches design review (Playwright MCP) and adversarial code review agents, generates consolidated report. Use after implementing a story to catch issues before /finish-story.
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

## Canonical Gate Names

All gates must use these exact names in `review_gates_passed`. No variants (e.g., `test` instead of `unit-tests`).

| Gate | When added | Required for `reviewed: true` |
|------|-----------|-------------------------------|
| `build` | Pre-checks pass | Yes |
| `lint` | Pre-checks pass (or skipped if no script) | Yes (or `lint-skipped`) |
| `type-check` | Pre-checks pass | Yes |
| `format-check` | Pre-checks pass | Yes |
| `unit-tests` | Pre-checks pass (or skipped if no tests) | Yes (or `unit-tests-skipped`) |
| `e2e-tests` | Pre-checks pass (or skipped if no tests) | Yes (or `e2e-tests-skipped`) |
| `design-review` | Design review agent completes | Yes (or `design-review-skipped` if no UI changes) |
| `code-review` | Code review agent completes | Yes |
| `code-review-testing` | Test coverage agent completes | Yes |
| `web-design-guidelines` | Web design guidelines agent completes | Yes (or `web-design-guidelines-skipped` if no UI changes) |

The `-skipped` suffix indicates the gate was intentionally skipped (no lint script, no test files, no UI changes). Both the base name and `-skipped` variant satisfy the requirement.

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

4. **Detect resumption**: Check if this is a resumed review:

   - If `reviewed: in-progress` and `review_gates_passed` is non-empty:
     - Inform the user: "Resuming interrupted review. Previously passed gates: [list]. Re-running pre-checks (code may have changed), then skipping already-completed agent reviews."
     - Set `resuming = true` and note which gates passed.
   - If `reviewed: true`:
     - Inform the user: "Story already reviewed. Re-running full review to validate current state."
     - Reset: set `reviewed: in-progress`, clear `review_gates_passed`, update `review_started`.
   - If `reviewed: false` (fresh review):
     - Set `reviewed: in-progress`, `review_started: YYYY-MM-DD`, `review_gates_passed: []` in story frontmatter.

   **TodoWrite**: Mark "Identify story and detect resumption" → `completed`. Mark "Pre-checks: build" → `in_progress`.

5. **Pre-checks** (always run — fast, validates current state):

   **Pre-review commit gate:** Before running any checks, verify working tree is clean:
   ```
   git status --porcelain
   ```
   If there are uncommitted changes, STOP and warn the user: "Uncommitted changes detected. Commit all changes before review — code review runs against the committed snapshot, not the working tree. Run `git add -A && git commit` first." Do NOT proceed until working tree is clean.

   **UI change detection** (after pre-review commit gate, before build):

   Detect if this story involves UI changes to determine which review agents to dispatch:
   ```bash
   git diff --name-only main...HEAD | grep -E 'src/app/(pages|components)/.*\.tsx'
   ```

   Store the result as `HAS_UI_CHANGES` (boolean) for use in Step 7 (review agent swarm).

   - If matches found → `HAS_UI_CHANGES=true` (dispatch design-review + web-design-guidelines)
   - If no matches → `HAS_UI_CHANGES=false` (skip both agents, add `-skipped` suffix to gates)

   Run these sequentially — stop on first failure:

   a. `npm run build` — STOP on failure with build errors.
   b. **Lint** — `npm run lint`. If lint errors found (if lint script exists, otherwise skip):
      - Auto-fix: run `npx eslint . --fix` to fix auto-fixable issues (unused vars, import order, etc.).
      - Re-run `npm run lint` to verify. If errors remain, STOP with error output and suggest manual fixes.
      - Note in output: "Auto-fixed N ESLint issues."
   c. **Type check** — `npx tsc --noEmit`. If errors found:
      - Auto-fix: attempt to resolve type errors in files changed by the current branch (`git diff --name-only main...HEAD`). Only fix errors in branch-changed files — do not fix pre-existing errors in other files.
      - Re-run `npx tsc --noEmit`. If errors remain only in files NOT changed by the branch, note them as pre-existing and continue. If errors remain in branch-changed files, STOP with error output.
   d. **Format check** — `npx prettier --check "src/**/*.{ts,tsx,js,jsx,css,md}" "tests/**/*.{ts,tsx}"`. If formatting issues found:
      - Auto-fix: run `npx prettier --write "src/**/*.{ts,tsx,js,jsx,css,md}" "tests/**/*.{ts,tsx}"` to format all files.
      - Re-run the check to verify. If still failing, STOP with error output.
      - Note in output: "Auto-formatted N files with Prettier."
   e. `npm run test:unit -- --run` — STOP on failure. If no unit test script or no test files, note and continue.
   f. E2E tests — run smoke specs + current story's spec on Chromium only:
      ```
      npx playwright test ${BASE_PATH}/tests/e2e/navigation.spec.ts ${BASE_PATH}/tests/e2e/overview.spec.ts ${BASE_PATH}/tests/e2e/courses.spec.ts ${BASE_PATH}/tests/e2e/story-{id}.spec.ts --project=chromium
      ```
      If the current story has no spec file in `${BASE_PATH}/tests/e2e/`, run smoke specs only. STOP on failure. Do NOT run `tests/design-review.spec.ts` or `${BASE_PATH}/tests/e2e/regression/` specs here — those are separate.

   g. **Test pattern validation** (after E2E tests pass):

      If the story has an E2E spec file, run the test pattern validator:
      ```
      node scripts/validate-test-patterns.js ${BASE_PATH}/tests/e2e/story-{id}.spec.ts
      ```

      **Exit code handling:**
      - Exit 1 (HIGH/MEDIUM anti-patterns) → STOP review with findings:
        ```
        Test anti-patterns detected — must fix before review:

        [Show validator output with severity and specific line numbers]

        These patterns cause flakiness. Fix them, then re-run /review-story.
        ```
        Keep `reviewed: in-progress`. Do NOT proceed to burn-in or agent reviews.

      - Exit 0 (clean or LOW-only) → Continue to burn-in suggestion. Store findings in memory for code review agent context.

   h. **Burn-in test suggestion** (after E2E tests and pattern validation pass):

      If the story has an E2E spec file AND E2E tests passed AND `burn_in_validated` is NOT already `true` in story frontmatter, analyze whether burn-in testing would be valuable:

      **Use validator findings from step g to determine confidence level:**

      - 🔴 **HIGH confidence** (LOW severity findings detected) — recommend burn-in:
        - Validator reported LOW severity issues (testFileSize, missingTestTimeImport, todoComments, debugConsole)
        - These suggest complexity or timing-sensitive patterns worth validating

      - 🟡 **Timing-sensitive features** (MEDIUM confidence — offer burn-in):
        - Imports from `test-time.ts` (indicates date/time calculations)
        - Uses `page.addInitScript()` for Date mocking (e.g., momentum calculations)
        - Contains `requestAnimationFrame` or animation-related waits
        - Story acceptance criteria mention "real-time", "polling", "debounce", "throttle"
        - This is the first story in the epic (E##-S01)

      - ✅ **Low-risk patterns** (do NOT suggest burn-in):
        - Simple UI-only tests (clicks, form fills, navigation)
        - Tests use standard Playwright waits (`expect().toBeVisible()`)
        - No timing logic detected
        - Story already marked `burn_in_validated: true`

      **If HIGH confidence** (anti-patterns found):
      - Use `AskUserQuestion` with burn-in as **first option** marked "(Recommended)":
        ```
        Question: "E2E tests passed but anti-patterns detected. Run burn-in validation?"
        Header: "Burn-in test"
        Options:
          1. "Run burn-in — 10 iterations (Recommended)"
             Description: "Anti-pattern detected: [specific issue]. Burn-in validates stability despite timing risks."
          2. "Skip — proceed to reviews"
             Description: "Tests may have flakiness risk. Consider fixing anti-patterns first."
        ```

      **If MEDIUM confidence** (timing-sensitive):
      - Use `AskUserQuestion` with skip as **first option**:
        ```
        Question: "E2E tests passed. Run optional burn-in validation?"
        Header: "Burn-in test"
        Options:
          1. "Skip — proceed to reviews"
             Description: "Tests follow deterministic patterns. Standard validation sufficient."
          2. "Run burn-in — 10 iterations"
             Description: "Validates stability for timing-sensitive logic (adds ~2 min)."
        ```

      **If burn-in selected**:
      - Run: `npx playwright test ${BASE_PATH}/tests/e2e/story-{id}.spec.ts --repeat-each=10 --project=chromium`
      - If **all iterations pass**: set `burn_in_validated: true` in story frontmatter, continue to reviews
      - If **any iteration fails**: STOP with flakiness report:
        ```
        Burn-in FAILED: X/80 tests failed (flakiness detected)

        Failed tests:
        - [Test name]: Failed on iterations [N, M, ...]

        This indicates non-deterministic behavior. Review:
        1. Time dependencies (use FIXED_DATE, not Date.now())
        2. Hard waits (use expect().toBeVisible(), not waitForTimeout())
        3. Race conditions (use shared helpers with retry logic)

        Fix anti-patterns and re-run /review-story.
        ```
        Keep `reviewed: in-progress`, do NOT add `e2e-tests` to gates (burn-in is part of E2E validation).

   If any pre-check fails: show the error output, suggest fixes, and STOP. Do not proceed to reviews. Keep `reviewed: in-progress` so next run resumes.

   On success: update `review_gates_passed` using canonical gate names:
   - Always add: `build`
   - Add `lint` if lint ran and passed, or `lint-skipped` if no lint script exists
   - Add `type-check` (always runs — auto-fixes branch-changed files if needed)
   - Add `format-check` (always runs — auto-formats all files if needed)
   - Add `unit-tests` if tests ran and passed, or `unit-tests-skipped` if no test files
   - Add `e2e-tests` if tests ran and passed, or `e2e-tests-skipped` if no test files

   **TodoWrite**: Mark all pre-check todos → `completed`. Update each pre-check todo individually as it passes during execution.

6. **Lessons Learned Gate** (automated documentation quality check):

   After pre-checks pass, validate that the story's "Challenges and Lessons Learned" section is properly documented before dispatching expensive review agents.

   a. Read the story file's "Challenges and Lessons Learned" section (typically at the end of the file).

   b. Check for placeholder text indicating incomplete documentation:
      - `[Document issues, solutions, and patterns worth remembering]`
      - `[Populated by /review-story — Playwright MCP findings]`
      - `[Populated by /review-story — adversarial code review findings]`
      - `[Architecture decisions, patterns used, dependencies added]`
      - Any other bracketed placeholder text in this section

   c. If placeholders found — **auto-populate** from implementation context:

      1. Gather context by running:
         - `git log main...HEAD --oneline` (commit history for the story branch)
         - `git diff main...HEAD --stat` (files changed, scope of work)
         - Read the story file's acceptance criteria and technical notes
      2. Generate lessons learned content covering (use bullet points, match the style of `8-1-study-time-analytics.md`):
         - **Implementation challenges faced** — what was harder than expected, what broke
         - **Solutions discovered** — how challenges were resolved, workarounds applied
         - **Patterns worth remembering** — reusable approaches for future stories
         - **Decisions and trade-offs** — choices made and their rationale
      3. Replace ALL placeholder text in the "Challenges and Lessons Learned" section with the generated content
      4. Commit the change: `docs: populate lessons learned for {story-id}`
      5. Output: `✅ Lessons Learned Gate — auto-populated from implementation context`
      6. Continue to step 7 (review agent swarm)

   d. If no placeholders (lessons learned properly filled):
      - Continue to step 7 (review agent swarm)
      - Note in output: "✅ Lessons Learned Gate passed — documentation complete"

   **Rationale**: This automated gate addresses Epic 8 retrospective finding that only 2/5 stories documented lessons learned despite manual reminders. Since Claude Code performs the implementation, it has full context to auto-generate meaningful lessons learned — achieving 100% compliance without blocking the review workflow.

7. **Review agent swarm** (parallel dispatch — design + code + testing):

   After pre-checks pass, dispatch ALL applicable review agents **in a single message** for maximum parallelism. Design review, code review, and test coverage review are fully independent — they use different tools (Playwright MCP vs git diff) and analyze different aspects.

   **Pre-dispatch checks** (determine which agents to dispatch):

   For each agent, check skip conditions:
   - **Design review**: Skip if (a) resuming AND `design-review` in `review_gates_passed` AND report file exists, OR (b) no UI changes in `git diff --name-only main...HEAD` (no changes in `src/app/`). If skipping for no UI changes, add `design-review-skipped` to gates.
   - **Code review**: Skip if resuming AND `code-review` in `review_gates_passed` AND report file exists.
   - **Code review testing**: Skip if resuming AND `code-review-testing` in `review_gates_passed` AND report file exists.
   - **Edge case review**: Skip if resuming AND `edge-case-review` in `review_gates_passed` AND report file exists.

   **Design review pre-requisite** (only if design review will run):
   - Check dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`.
   - Not reachable → start `npm run dev` in background via Bash (`npm run dev &`), wait up to 30s.
   - Still unreachable → warn the user, do NOT add `design-review` to gates, but continue dispatching other agents.

   **TodoWrite**: Mark all non-skipped agent todos → `in_progress` simultaneously.

   **Dispatch all non-skipped agents in a single message**:

   ```
   // All dispatched together — they run concurrently:

   Task({
     subagent_type: "design-review",
     prompt: "Review story E##-S## changes. Affected routes: [mapped from files]. Focus on: [ACs that involve UI]. Git diff summary: [key changes].",
     description: "Design review E##-S##"
   })

   Task({
     subagent_type: "code-review",
     prompt: "Review story E##-S## at ${BASE_PATH}/docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes.

Test anti-patterns detected (step g validation):
[Insert validation findings if any LOW severity issues were found, or 'No anti-patterns detected' if clean]

Focus on architecture, security, correctness, silent failures, test anti-patterns (section 5.5), and EduVi stack patterns. Score each finding with confidence (0-100).",
     description: "Code review E##-S##"
   })

   Task({
     subagent_type: "code-review-testing",
     prompt: "Review test coverage for story E##-S## at ${BASE_PATH}/docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes. Map every acceptance criterion to its tests. Review test quality, isolation, and edge case coverage. Score each finding with confidence (0-100).",
     description: "Test coverage review E##-S##"
   })

   Task({
     subagent_type: "general-purpose",
     prompt: "Use the bmad-review-edge-case-hunter skill on story E##-S##. Run `git diff main...HEAD` to get the changed code. Pass the diff as the content to review. After the skill completes, format the JSON findings into a markdown report saved to ${BASE_PATH}/docs/reviews/code/edge-case-review-{YYYY-MM-DD}-{story-id}.md using this format:\n\n## Edge Case Review — E##-S## ({YYYY-MM-DD})\n\n### Unhandled Edge Cases\n\nFor each finding:\n**[location]** — `[trigger_condition]`\n> Consequence: [potential_consequence]\n> Guard: `[guard_snippet]`\n\n---\n**Total:** N unhandled edge cases found.",
     description: "Edge case review E##-S##"
   })
   ```

   **Note**: The code-review agent has selective WebFetch access for deprecated APIs, security issues, and framework bugs. It will use this sparingly (max 1-2 fetches) for high-severity findings only. This may add 10-30s to code review time but provides authoritative fix guidance.

   **As each agent returns**:
   - Mark its todo → `completed`
   - Validate the result (check for errors, empty reports, missing severity sections)
   - If an agent fails: warn the user, do NOT add its gate to `review_gates_passed`, note in consolidated report
   - If successful: save report, parse severity, update `review_gates_passed`

   **Report locations**:
   - `${BASE_PATH}/docs/reviews/design/design-review-{YYYY-MM-DD}-{story-id}.md`
   - `${BASE_PATH}/docs/reviews/code/code-review-{YYYY-MM-DD}-{story-id}.md`
   - `${BASE_PATH}/docs/reviews/code/code-review-testing-{YYYY-MM-DD}-{story-id}.md`
   - `${BASE_PATH}/docs/reviews/code/edge-case-review-{YYYY-MM-DD}-{story-id}.md`

   **Deduplicate**: If code-review and code-review-testing flag the same file:line, keep the finding with the higher confidence score. Prefix deduplicated findings with their source agent. Edge case review findings are additive (different format — location + trigger condition), so include them in the consolidated report under a dedicated "Edge Cases" section. Treat each edge case finding as HIGH severity for blocker assessment.

8. **Merge test quality findings**:

   The `code-review-testing` agent replaces the previous inline test quality checks. Extract its AC Coverage Table and test quality findings for the consolidated report. No additional inline checks needed — the agent handles test isolation, selector quality, factory usage, and AC coverage.

   **TodoWrite**: Mark "Consolidate findings and verdict" → `in_progress`.

9. **Consolidated report**:

   Combine all findings into a single severity-triaged view:

   ```markdown
   ## Review Summary: E##-S## — [Story Name]

   ### Pre-checks
   - Build: [pass/fail]
   - Lint: [pass/fail/skipped]
   - Type check: [pass/auto-fixed/fail]
   - Format check: [pass/auto-fixed N files/fail]
   - Unit tests: [pass/fail/skipped] ([N] tests)
   - E2E tests: [pass/fail/skipped] ([N] tests)

   ### Design Review
   [Summary or "Skipped — no UI changes" or "Reused from previous run — [path]"]
   Report: ${BASE_PATH}/docs/reviews/design/design-review-{date}-{id}.md

   ### Code Review (Architecture)
   [Summary with finding counts by severity or "Reused from previous run — [path]"]
   Report: ${BASE_PATH}/docs/reviews/code/code-review-{date}-{id}.md

   ### Code Review (Testing)
   [AC coverage summary: N/N ACs covered, N gaps. Finding counts by severity or "Reused from previous run — [path]"]
   Report: ${BASE_PATH}/docs/reviews/code/code-review-testing-{date}-{id}.md

   ### Consolidated Findings

   #### Blockers (must fix)
   - [Source]: [Finding]

   #### High Priority (should fix)
   - [Source]: [Finding]

   #### Medium (fix when possible)
   - [Source]: [Finding]

   #### Nits (optional)
   - [Source]: [Finding]

   ### Verdict
   [PASS — ready for /finish-story | BLOCKED — fix [N] blockers first]
   ```

   - **Blocker/Critical findings** → STOP with specific fix instructions and file:line references.
   - **Non-blocking findings** → listed as warnings. Story can proceed to `/finish-story`.

10. **Mark reviewed** (with gate validation):

   **Validate all required gates** before marking `reviewed: true`. Check that `review_gates_passed` contains one entry (base or `-skipped` variant) for each of the 9 canonical gates: `build`, `lint`, `type-check`, `format-check`, `unit-tests`, `e2e-tests`, `design-review`, `code-review`, `code-review-testing`.

   - **All gates present**: Set `reviewed: true`. Set `review_gates_passed` to the full list. Append review summary to `## Design Review Feedback` and `## Code Review Feedback` sections.
   - **Missing gates**: Do NOT set `reviewed: true`. Keep `reviewed: in-progress`. Warn the user:
     ```
     Cannot mark as reviewed — missing gates: [list].
     [For each missing gate, explain why it's missing and how to fix.]
     Re-run /review-story after fixing.
     ```

   **TodoWrite**: Mark "Consolidate findings and verdict" → `completed`.

11. **Completion output**: Display the following summary to the user:

    **If PASS (no blockers)**:

    ```markdown
    ---

    ## Review Complete: E##-S## — [Story Name]

    | Gate                  | Result                    |
    | --------------------- | ------------------------- |
    | Build                 | [pass/fail]               |
    | Lint                  | [pass/fail/skipped]       |
    | Type check            | [pass/auto-fixed/fail]    |
    | Format check          | [pass/auto-fixed N files/fail] |
    | Unit tests            | [pass (N tests)/skipped]  |
    | E2E tests             | [pass (N tests)/skipped]  |
    | Design review         | [pass/N warnings/skipped] |
    | Code review           | [pass/N warnings]         |
    | Code review (testing) | [N/N ACs covered/N warnings] |

    **Verdict: PASS** — Story is ready to ship.

    ### Next Step

    Run `/finish-story` to create the PR (lightweight — reviews already done).

    Reports saved:
    - `${BASE_PATH}/docs/reviews/design/design-review-{date}-{id}.md`
    - `${BASE_PATH}/docs/reviews/code/code-review-{date}-{id}.md`
    - `${BASE_PATH}/docs/reviews/code/code-review-testing-{date}-{id}.md`

    ---
    ```

    **If BLOCKED (blockers found)**:

    ```markdown
    ---

    ## Review Blocked: E##-S## — [Story Name]

    **Verdict: BLOCKED** — Fix [N] blocker(s) before shipping.

    ### Blockers to Fix

    1. [Source — file:line]: [Description]
    2. [Source — file:line]: [Description]

    ### After Fixing

    Re-run `/review-story` to validate fixes. Pre-checks will re-run; completed agent reviews will be reused.

    ---
    ```

After fixing issues, re-run `/review-story` — completed agent reviews are preserved and reused.

## Route Map

| Source file pattern | Route |
|---|---|
| `pages/Overview.tsx` | `/` |
| `pages/MyClass.tsx` | `/my-class` |
| `pages/Courses.tsx` | `/courses` |
| `pages/CourseDetail.tsx` | `/courses/:courseId` |
| `pages/LessonPlayer.tsx` | `/courses/:courseId/:lessonId` |
| `pages/Library.tsx` | `/library` |
| `pages/Messages.tsx` | `/messages` |
| `pages/Instructors.tsx` | `/instructors` |
| `pages/Reports.tsx` | `/reports` |
| `pages/Settings.tsx` | `/settings` |

## When Review Agents Find Issues

Apply `receiving-code-review` principles when processing review feedback:
- Verify findings technically before implementing fixes
- Don't blindly implement every suggestion — assess whether each applies
- Apply `systematic-debugging` for complex issues: 4-phase root cause analysis before any fixes

## Recovery

- **Pre-checks fail**: Fix errors, re-run `/review-story`. Agent reviews already completed are preserved.
- **Review agent(s) fail**: Check dev server (design review) or git diff (code reviews). Re-run `/review-story`. Only the failed gate(s) re-run — `design-review`, `code-review`, and `code-review-testing` are tracked independently in `review_gates_passed`.
- **Interrupted mid-review**: Story stays `reviewed: in-progress` with `review_gates_passed` tracking progress. Re-run resumes from where it left off — pre-checks always re-run (fast), completed agent reviews are skipped.
- **Stale review after code changes**: If you fix blockers and re-run, pre-checks validate the new code. Agent reviews from the previous run are reused unless you want a fresh review — in that case, manually set `reviewed: false` and clear `review_gates_passed: []` in the story frontmatter.
