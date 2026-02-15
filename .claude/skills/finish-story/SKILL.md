---
name: finish-story
description: Use when a LevelUp story is ready to ship. Validates, creates PR. Auto-runs reviews if /review-story was not already run. Use after implementing and optionally reviewing a story.
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

## Steps

1. **Identify story**: Parse ID from `$ARGUMENTS` or from branch name (`git branch --show-current` → `feature/e01-s03-...` → `E01-S03`).

2. **Verify story file**: Check `docs/implementation-artifacts/{key}.md` exists. Missing → STOP with error.

3. **Check reviewed status**: Read story file frontmatter `reviewed` field.

4. **If NOT reviewed** (streamlined mode):
   - Run the full review pipeline inline — same steps as `/review-story` steps 3-7:
     a. Pre-checks: build, lint, unit tests, E2E tests
     b. Design review (if UI changes)
     c. Code review
     d. Consolidated report
   - If **Blockers** found → STOP with fix instructions. Developer fixes and re-runs `/finish-story`.
   - If no blockers → continue to step 6.

5. **If already reviewed** (comprehensive mode):
   - Run lightweight validation only:
     a. `npm run build` — STOP on failure.
     b. `npm run lint` — STOP on failure (if script exists).
     c. `npm run test:unit -- --run` — STOP on failure (if tests exist).
     d. `npx playwright test tests/e2e/` — STOP on failure (if tests exist).
   - If any fail → STOP. Developer fixes and re-runs.

6. **Update story file**:
   - Set `status: done` and `completed: YYYY-MM-DD` in frontmatter.
   - Set `reviewed: true` if not already.

7. **Update sprint status**: In `docs/implementation-artifacts/sprint-status.yaml`, set story → `done`.

8. **Commit**: Stage story file, sprint-status.yaml, and any review reports.
   Apply `writing-clearly-and-concisely` rules to the commit message — active voice, omit needless words:
   ```
   git commit -m "feat(E##-S##): [concise description of what the story delivers]"
   ```

9. **Push branch**: `git push -u origin feature/e##-s##-slug`.

10. **Create PR** via `gh pr create`:

    Apply `writing-clearly-and-concisely` to PR title and body. Active voice, no AI puffery, no filler.

    ```bash
    gh pr create --title "feat(E##-S##): [Story name]" --body "$(cat <<'EOF'
    ## Summary
    - [1-3 bullet points of what changed and why]

    ## Verification
    - Build: passed
    - Lint: {passed/skipped}
    - Unit tests: {passed/skipped} ({N} tests)
    - E2E tests: {passed/skipped} ({N} tests)
    - Design review: {passed/skipped/warnings} ([report link])
    - Code review: {passed/warnings} ([report link])

    ## Test Plan
    - [ ] [Manual verification steps derived from acceptance criteria]

    🤖 Generated with [Claude Code](https://claude.com/claude-code)
    EOF
    )"
    ```

    Print the PR URL.

11. **Lessons learned** (optional): Ask the developer via AskUserQuestion if there are patterns worth capturing in the story's "Challenges and Lessons Learned" section. If yes, append them.

12. **Completion output**: Display the following summary to the user:

    ```markdown
    ---

    ## Story Shipped: E##-S## — [Story Name]

    | Item           | Result                                   |
    | -------------- | ---------------------------------------- |
    | Build          | passed                                   |
    | Lint           | [passed/skipped]                         |
    | Unit tests     | [passed (N tests)/skipped]               |
    | E2E tests      | [passed (N tests)/skipped]               |
    | Design review  | [passed/N warnings/skipped]              |
    | Code review    | [passed/N warnings]                      |
    | Story status   | done                                     |
    | Sprint status  | updated                                  |
    | PR             | [PR URL]                                 |

    ### What Happened

    - [Mode used]: [Comprehensive (reviews pre-done) / Streamlined (reviews inline)]
    - Branch: `feature/e##-s##-slug`
    - Review reports: `docs/reviews/design/` + `docs/reviews/code/`

    [If epic NOT complete:]
    ### Next Story

    The next backlog story in this epic is **E##-S##: [Name]**.
    Run `/start-story E##-S##` when ready.

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
- **Step 4 fail** (inline review blockers): Fix issues, re-run.
- **Step 9 fail** (push): Check `git remote -v`, fix remote config, re-run.
- **Step 10 fail** (PR): Check `gh auth status`, authenticate if needed, re-run.

## Common Mistakes

- **Running without implementation**: `/finish-story` is for completed stories. Implement first.
- **Ignoring Blockers**: Fix all blockers before re-running. They will not go away.
- **Auto-merging**: This creates a PR for human review. Do NOT auto-merge.
