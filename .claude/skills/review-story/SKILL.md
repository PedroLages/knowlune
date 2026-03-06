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

The `-skipped` suffix indicates the gate was intentionally skipped (no lint script, no test files, no UI changes). Both the base name and `-skipped` variant satisfy the requirement.

## Steps

1. **Identify story**: Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

2. **Read story file** from `docs/implementation-artifacts/`. Extract acceptance criteria, tasks, current status, and **review tracking fields** (`reviewed`, `review_started`, `review_gates_passed`).

3. **Detect resumption**: Check if this is a resumed review:

   - If `reviewed: in-progress` and `review_gates_passed` is non-empty:
     - Inform the user: "Resuming interrupted review. Previously passed gates: [list]. Re-running pre-checks (code may have changed), then skipping already-completed agent reviews."
     - Set `resuming = true` and note which gates passed.
   - If `reviewed: true`:
     - Inform the user: "Story already reviewed. Re-running full review to validate current state."
     - Reset: set `reviewed: in-progress`, clear `review_gates_passed`, update `review_started`.
   - If `reviewed: false` (fresh review):
     - Set `reviewed: in-progress`, `review_started: YYYY-MM-DD`, `review_gates_passed: []` in story frontmatter.

4. **Pre-checks** (always run — fast, validates current state):

   Run these sequentially — stop on first failure:

   a. `npm run build` — STOP on failure with build errors.
   b. `npm run lint` — STOP on failure with lint errors (if lint script exists, otherwise skip).
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
      npx playwright test tests/e2e/navigation.spec.ts tests/e2e/overview.spec.ts tests/e2e/courses.spec.ts tests/e2e/story-{id}.spec.ts --project=chromium
      ```
      If the current story has no spec file in `tests/e2e/`, run smoke specs only. STOP on failure. Do NOT run `tests/design-review.spec.ts` or `tests/e2e/regression/` specs here — those are separate.

   If any pre-check fails: show the error output, suggest fixes, and STOP. Do not proceed to reviews. Keep `reviewed: in-progress` so next run resumes.

   On success: update `review_gates_passed` using canonical gate names:
   - Always add: `build`
   - Add `lint` if lint ran and passed, or `lint-skipped` if no lint script exists
   - Add `type-check` (always runs — auto-fixes branch-changed files if needed)
   - Add `format-check` (always runs — auto-formats all files if needed)
   - Add `unit-tests` if tests ran and passed, or `unit-tests-skipped` if no test files
   - Add `e2e-tests` if tests ran and passed, or `e2e-tests-skipped` if no test files

5. **Design review** (conditional, skippable on resume):

   **Skip condition**: If resuming AND `design-review` is already in `review_gates_passed` AND the report file `docs/reviews/design/design-review-*-{story-id}.md` exists — skip with message: "Design review already completed. Report: [path]".

   **No UI changes**: If `git diff --name-only main...HEAD` shows NO changes in `src/app/` (pages, components, styles):
   - Add `design-review-skipped` to `review_gates_passed`.
   - Note in consolidated report: "Skipped — no UI changes."

   **UI changes detected**: Run the design review:

   a. Check dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`.
      - Not reachable → start `npm run dev` in background via Bash (`npm run dev &`), wait up to 30s.
      - Still unreachable → **do NOT skip silently**. Warn the user: "Dev server unreachable. Design review cannot run." Do NOT add `design-review` to gates. The review stays incomplete — this blocks `reviewed: true`.
   b. Dispatch to `design-review` agent via Task tool:
      ```
      Task({
        subagent_type: "design-review",
        prompt: "Review story E##-S## changes. Affected routes: [mapped from files]. Focus on: [ACs that involve UI]. Git diff summary: [key changes].",
        description: "Design review E##-S##"
      })
      ```
   c. **Validate agent result**: If the agent returns an error, empty report, or the report lacks the expected severity sections:
      - Warn the user: "Design review agent failed. Likely cause: Playwright MCP tools unavailable."
      - Do NOT add `design-review` to `review_gates_passed`.
      - Note in consolidated report: "**FAILED** — agent error. Re-run after fixing MCP configuration."
      - Continue to code reviews (design review failure does not block other gates).
   d. On success: save report to `docs/reviews/design/design-review-{YYYY-MM-DD}-{story-id}.md`
   e. Parse severity from returned report.
   f. Update `review_gates_passed` to include `design-review`.

6. **Code reviews** (parallel, skippable on resume):

   Two agents run in parallel: `code-review` (architecture/security/correctness) and `code-review-testing` (AC coverage/test quality).

   **Skip conditions** (checked independently):
   - Skip `code-review` if: resuming AND `code-review` in `review_gates_passed` AND report file `docs/reviews/code/code-review-*-{story-id}.md` exists.
   - Skip `code-review-testing` if: resuming AND `code-review-testing` in `review_gates_passed` AND report file `docs/reviews/code/code-review-testing-*-{story-id}.md` exists.

   For each agent not skipped, dispatch via Task tool **in parallel** (both in the same message):
   ```
   Task({
     subagent_type: "code-review",
     prompt: "Review story E##-S## at docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes. Focus on architecture, security, correctness, silent failures, and LevelUp stack patterns. Score each finding with confidence (0-100).",
     description: "Code review E##-S##"
   })

   Task({
     subagent_type: "code-review-testing",
     prompt: "Review test coverage for story E##-S## at docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes. Map every acceptance criterion to its tests. Review test quality, isolation, and edge case coverage. Score each finding with confidence (0-100).",
     description: "Test coverage review E##-S##"
   })
   ```

   Save reports:
   - `docs/reviews/code/code-review-{YYYY-MM-DD}-{story-id}.md`
   - `docs/reviews/code/code-review-testing-{YYYY-MM-DD}-{story-id}.md`

   Parse severity from both reports.

   **Deduplicate**: If both agents flag the same file:line, keep the finding with the higher confidence score. Prefix deduplicated findings with their source agent.

   Update `review_gates_passed` to include `code-review` and `code-review-testing` as each completes.

7. **Merge test quality findings**:

   The `code-review-testing` agent replaces the previous inline test quality checks. Extract its AC Coverage Table and test quality findings for the consolidated report. No additional inline checks needed — the agent handles test isolation, selector quality, factory usage, and AC coverage.

8. **Consolidated report**:

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
   Report: docs/reviews/design/design-review-{date}-{id}.md

   ### Code Review (Architecture)
   [Summary with finding counts by severity or "Reused from previous run — [path]"]
   Report: docs/reviews/code/code-review-{date}-{id}.md

   ### Code Review (Testing)
   [AC coverage summary: N/N ACs covered, N gaps. Finding counts by severity or "Reused from previous run — [path]"]
   Report: docs/reviews/code/code-review-testing-{date}-{id}.md

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

9. **Mark reviewed** (with gate validation):

   **Validate all required gates** before marking `reviewed: true`. Check that `review_gates_passed` contains one entry (base or `-skipped` variant) for each of the 9 canonical gates: `build`, `lint`, `type-check`, `format-check`, `unit-tests`, `e2e-tests`, `design-review`, `code-review`, `code-review-testing`.

   - **All gates present**: Set `reviewed: true`. Set `review_gates_passed` to the full list. Append review summary to `## Design Review Feedback` and `## Code Review Feedback` sections.
   - **Missing gates**: Do NOT set `reviewed: true`. Keep `reviewed: in-progress`. Warn the user:
     ```
     Cannot mark as reviewed — missing gates: [list].
     [For each missing gate, explain why it's missing and how to fix.]
     Re-run /review-story after fixing.
     ```

10. **Completion output**: Display the following summary to the user:

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
    - `docs/reviews/design/design-review-{date}-{id}.md`
    - `docs/reviews/code/code-review-{date}-{id}.md`
    - `docs/reviews/code/code-review-testing-{date}-{id}.md`

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
- **Design review agent fails**: Check dev server, check Playwright MCP tools available, re-run. Only the failed gate re-runs.
- **Code review agent(s) fail**: Check git diff is accessible, re-run. Only the failed gate(s) re-run — `code-review` and `code-review-testing` are tracked independently.
- **Interrupted mid-review**: Story stays `reviewed: in-progress` with `review_gates_passed` tracking progress. Re-run resumes from where it left off — pre-checks always re-run (fast), completed agent reviews are skipped.
- **Stale review after code changes**: If you fix blockers and re-run, pre-checks validate the new code. Agent reviews from the previous run are reused unless you want a fresh review — in that case, manually set `reviewed: false` and clear `review_gates_passed: []` in the story frontmatter.
