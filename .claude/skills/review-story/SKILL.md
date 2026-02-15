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
   c. `npm run test:unit -- --run` — STOP on failure. If no unit test script or no test files, note and continue.
   d. `npx playwright test tests/e2e/` — STOP on failure. If no E2E test files, note and continue. Do NOT run `tests/design-review.spec.ts` here — that's separate.

   If any pre-check fails: show the error output, suggest fixes, and STOP. Do not proceed to reviews. Keep `reviewed: in-progress` so next run resumes.

   On success: update `review_gates_passed` to include `build`, `lint`, `unit-tests`, `e2e-tests` as applicable.

5. **Design review** (conditional, skippable on resume):

   **Skip condition**: If resuming AND `design-review` is already in `review_gates_passed` AND the report file `docs/reviews/design/design-review-*-{story-id}.md` exists — skip with message: "Design review already completed. Report: [path]".

   Otherwise, only run if `git diff --name-only main...HEAD` shows changes in `src/app/` (pages, components, styles):

   a. Check dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`.
      - Not reachable → start `npm run dev` in background via Bash (`npm run dev &`), wait up to 30s. Still unreachable → warn and skip.
   b. Dispatch to `design-review` agent via Task tool:
      ```
      Task({
        subagent_type: "design-review",
        prompt: "Review story E##-S## changes. Affected routes: [mapped from files]. Focus on: [ACs that involve UI]. Git diff summary: [key changes].",
        description: "Design review E##-S##"
      })
      ```
   c. Save report: `docs/reviews/design/design-review-{YYYY-MM-DD}-{story-id}.md`
   d. Parse severity from returned report.
   e. Update `review_gates_passed` to include `design-review`.

6. **Code review** (skippable on resume):

   **Skip condition**: If resuming AND `code-review` is already in `review_gates_passed` AND the report file `docs/reviews/code/code-review-*-{story-id}.md` exists — skip with message: "Code review already completed. Report: [path]".

   Otherwise:

   Dispatch to `code-review` agent via Task tool:
   ```
   Task({
     subagent_type: "code-review",
     prompt: "Review story E##-S## at docs/implementation-artifacts/{key}.md. Run git diff main...HEAD for changes. Focus on acceptance criteria coverage, architecture, security, and LevelUp stack patterns.",
     description: "Code review E##-S##"
   })
   ```
   Save report: `docs/reviews/code/code-review-{YYYY-MM-DD}-{story-id}.md`
   Parse severity from returned report.
   Update `review_gates_passed` to include `code-review`.

7. **Test quality review** (conditional):

   Only if `git diff --name-only main...HEAD` shows new or changed test files (`*.test.ts`, `*.spec.ts`):

   - Check test isolation (no shared mutable state)
   - Check selector quality in E2E tests (prefer `data-testid`, roles over CSS classes)
   - Check factory/fixture usage from `tests/support/`
   - Check AC coverage completeness
   - Apply `systematic-debugging` patterns if test failures were found

8. **Consolidated report**:

   Combine all findings into a single severity-triaged view:

   ```markdown
   ## Review Summary: E##-S## — [Story Name]

   ### Pre-checks
   - Build: [pass/fail]
   - Lint: [pass/fail/skipped]
   - Unit tests: [pass/fail/skipped] ([N] tests)
   - E2E tests: [pass/fail/skipped] ([N] tests)

   ### Design Review
   [Summary or "Skipped — no UI changes" or "Reused from previous run — [path]"]
   Report: docs/reviews/design/design-review-{date}-{id}.md

   ### Code Review
   [Summary with finding counts by severity or "Reused from previous run — [path]"]
   Report: docs/reviews/code/code-review-{date}-{id}.md

   ### Test Quality
   [Summary or "Skipped — no test changes"]

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

9. **Mark reviewed**: Update story file frontmatter:
   - Set `reviewed: true`
   - Set `review_gates_passed` to the full list of completed gates
   - Append review summary to `## Design Review Feedback` and `## Code Review Feedback` sections.

10. **Completion output**: Display the following summary to the user:

    **If PASS (no blockers)**:

    ```markdown
    ---

    ## Review Complete: E##-S## — [Story Name]

    | Gate           | Result                    |
    | -------------- | ------------------------- |
    | Build          | [pass/fail]               |
    | Lint           | [pass/fail/skipped]       |
    | Unit tests     | [pass (N tests)/skipped]  |
    | E2E tests      | [pass (N tests)/skipped]  |
    | Design review  | [pass/N warnings/skipped] |
    | Code review    | [pass/N warnings]         |

    **Verdict: PASS** — Story is ready to ship.

    ### Next Step

    Run `/finish-story` to create the PR (lightweight — reviews already done).

    Reports saved:
    - `docs/reviews/design/design-review-{date}-{id}.md`
    - `docs/reviews/code/code-review-{date}-{id}.md`

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
- **Code review agent fails**: Check git diff is accessible, re-run. Only the failed gate re-runs.
- **Interrupted mid-review**: Story stays `reviewed: in-progress` with `review_gates_passed` tracking progress. Re-run resumes from where it left off — pre-checks always re-run (fast), completed agent reviews are skipped.
- **Stale review after code changes**: If you fix blockers and re-run, pre-checks validate the new code. Agent reviews from the previous run are reused unless you want a fresh review — in that case, manually set `reviewed: false` and clear `review_gates_passed: []` in the story frontmatter.
