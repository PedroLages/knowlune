---
name: review-story
description: Use when running quality gates on a LevelUp story before shipping. Runs build/lint/tests, dispatches design review (Playwright MCP) and adversarial code review agents, generates consolidated report. Use after implementing a story to catch issues before /finish-story.
argument-hint: "[E##-S##]"
disable-model-invocation: true
---

# Review Story

Runs all quality gates: pre-checks, design review, code review, and test quality review. Produces a consolidated severity-triaged report.

## Usage

```
/review-story E01-S03
/review-story          # derives story ID from branch name
```

## Steps

1. **Identify story**: Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

2. **Read story file** from `docs/implementation-artifacts/`. Extract acceptance criteria, tasks, and current status.

3. **Pre-checks** (fast fail before slow reviews):

   Run these sequentially — stop on first failure:

   a. `npm run build` — STOP on failure with build errors.
   b. `npm run lint` — STOP on failure with lint errors (if lint script exists, otherwise skip).
   c. `npm run test:unit -- --run` — STOP on failure. If no unit test script or no test files, note and continue.
   d. `npx playwright test tests/e2e/` — STOP on failure. If no E2E test files, note and continue. Do NOT run `tests/design-review.spec.ts` here — that's separate.

   If any pre-check fails: show the error output, suggest fixes, and STOP. Do not proceed to reviews.

4. **Design review** (conditional):

   Only run if `git diff --name-only main...HEAD` shows changes in `src/app/` (pages, components, styles):

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

5. **Code review**:

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

6. **Test quality review** (conditional):

   Only if `git diff --name-only main...HEAD` shows new or changed test files (`*.test.ts`, `*.spec.ts`):

   - Check test isolation (no shared mutable state)
   - Check selector quality in E2E tests (prefer `data-testid`, roles over CSS classes)
   - Check factory/fixture usage from `tests/support/`
   - Check AC coverage completeness
   - Apply `systematic-debugging` patterns if test failures were found

7. **Consolidated report**:

   Combine all findings into a single severity-triaged view:

   ```markdown
   ## Review Summary: E##-S## — [Story Name]

   ### Pre-checks
   - Build: [pass/fail]
   - Lint: [pass/fail/skipped]
   - Unit tests: [pass/fail/skipped] ([N] tests)
   - E2E tests: [pass/fail/skipped] ([N] tests)

   ### Design Review
   [Summary or "Skipped — no UI changes"]
   Report: docs/reviews/design/design-review-{date}-{id}.md

   ### Code Review
   [Summary with finding counts by severity]
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

8. **Mark reviewed**: Update story file frontmatter `reviewed: true`. Append review summary to `## Design Review Feedback` and `## Code Review Feedback` sections.

9. **Completion output**: Display the following summary to the user:

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

    Re-run `/review-story` to validate fixes.

    ---
    ```

After fixing issues, re-run `/review-story` until clean.

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

- **Pre-checks fail**: Fix errors, re-run `/review-story`.
- **Design review agent fails**: Check dev server, check Playwright MCP tools available, re-run.
- **Code review agent fails**: Check git diff is accessible, re-run.
- **Partial completion**: Reports already saved are preserved. Re-run executes all steps from scratch.
