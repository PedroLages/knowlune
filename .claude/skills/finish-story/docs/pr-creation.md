# PR Creation

Template and guidelines for creating pull requests via `gh pr create`.

## Template

```bash
gh pr create \
  --title "feat(E##-S##): [Story name]" \
  --body "$(cat <<'EOF'
## Summary

- [Bullet 1: What changed and why]
- [Bullet 2: Key implementation details]
- [Bullet 3: Notable decisions or trade-offs]

## Verification

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
| Performance benchmark  | passed / N warnings / skipped |
| Security review        | passed / N warnings         |
| Exploratory QA         | passed / N warnings / skipped |

## Test Plan

- [ ] [Manual verification step 1 from acceptance criteria]
- [ ] [Manual verification step 2 from acceptance criteria]
- [ ] [Manual verification step 3 from acceptance criteria]

[## Known Issues — include only if HIGH findings exist; omit section entirely otherwise]
[> Unresolved HIGH findings from review — non-blocking, flagged for reviewer awareness]
[- [source-agent] `file.ts:line` — finding description]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Writing Guidelines

Apply `writing-clearly-and-concisely` rules:

### Summary Bullets

**DO:**
- ✅ "Added course tagging UI with filter sidebar and search"
- ✅ "Implemented streak calculation with timezone-aware date handling"
- ✅ "Refactored dashboard cards to use shared StatsCard component"

**DON'T:**
- ❌ "Updated the CourseCard component to add new functionality for tags"
- ❌ "Made changes to the store to support the new feature"
- ❌ "Improved the user experience by adding various enhancements"

**Rules:**
- Start with strong verbs (Added, Implemented, Refactored, Fixed)
- Focus on WHAT and WHY, not HOW
- Be specific (name components, features, benefits)
- Omit needless words ("in order to", "the purpose of")

### Verification Table

Fill in actual results from the review process:

- **passed** - Gate completed successfully, no issues
- **skipped** - Gate intentionally skipped (no files, no UI changes)
- **auto-fixed** - Gate passed after automatic fixes applied
- **N warnings** - Gate passed but has non-blocking warnings
- **N/N ACs covered** - Test coverage: all ACs have tests
- **passed (N)** - Passed with N test cases

### Test Plan

Derive from acceptance criteria. Make it actionable:

**DO:**
- ✅ "Navigate to Courses, click 'React' tag, verify filtered list shows only React courses"
- ✅ "Study for 3 days, skip 1 day, verify flame icon shows on Study Streak calendar"
- ✅ "Complete lesson 5 of React course, verify progress bar shows 50%"

**DON'T:**
- ❌ "Test the filtering"
- ❌ "Verify streak calculation works"
- ❌ "Check progress tracking"

## Known Issues Extraction

Before constructing the PR body, extract HIGH findings from review reports to populate the `## Known Issues` section.

**Step 1 — locate reports** (glob, may not all exist):
```
${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md       → [code-review]
${BASE_PATH}/docs/reviews/design/design-review-*-{story-id}.md   → [design-review]
${BASE_PATH}/docs/reviews/code/code-review-testing-*-{story-id}.md → [code-review-testing]
${BASE_PATH}/docs/reviews/security/security-review-*-{story-id}.md → [security-review]
```

**Step 2 — extract HIGH section from each report** (same approach `validate-blockers.sh` uses for blockers):
```bash
sed -n '/^#### High Priority/,/^####/p' "$REPORT_FILE" | grep -v '^####'
```

**Step 3 — filter and format**:
- Strip blank lines and lines containing only "None" (case-insensitive)
- Prefix each surviving line with the source agent: `- [code-review] original line text`
- Collect findings from all three reports into a single list

**Step 4 — include or omit**:
- If the collected list is **non-empty**: include the `## Known Issues` section with the blockquote and findings
- If the list is **empty**: omit the `## Known Issues` section entirely — do not include a placeholder

**Example output (non-empty)**:
```markdown
## Known Issues
> Unresolved HIGH findings from review — non-blocking, flagged for reviewer awareness

- [code-review] `src/stores/useOnboardingStore.ts:42` — missing error boundary for failed DB writes
- [design-review] `OnboardingWizard.tsx:118` — focus trap not implemented (WCAG 2.4.3)
```

## Validation Before Creation

Check these before running `gh pr create`:

1. **All gates passed or skipped**
   ```bash
   # Verify review_gates_passed has all 12 canonical gates
   grep "review_gates_passed:" ${STORY_FILE}
   ```

2. **Story file updated**
   ```yaml
   status: done
   completed: YYYY-MM-DD
   reviewed: true
   ```

3. **Sprint status updated**
   ```yaml
   E##-S##: done
   ```

4. **Review reports exist**
   ```bash
   ls ${BASE_PATH}/docs/reviews/design/design-review-*-{story-id}.md
   ls ${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md
   ls ${BASE_PATH}/docs/reviews/code/code-review-testing-*-{story-id}.md
   ```

5. **Branch pushed to remote**
   ```bash
   git push -u origin feature/e##-s##-slug
   ```

## Example PR Body

```markdown
## Summary

- Added course tagging system with 8 predefined topics (React, TypeScript, Design, etc.)
- Implemented filter sidebar with multi-select tag chips
- Added tag search with instant filtering and empty state

## Verification

| Check                  | Result                      |
| ---------------------- | --------------------------- |
| Dependency audit       | clean                       |
| Format check           | passed                      |
| Lint                   | passed                      |
| Type check             | passed                      |
| Build                  | passed                      |
| Unit tests             | passed (12)                 |
| E2E tests              | passed (8)                  |
| Design review          | passed                      |
| Code review            | passed                      |
| Code review (testing)  | 5/5 ACs covered             |
| Performance benchmark  | passed                      |
| Security review        | passed                      |
| Exploratory QA         | skipped                     |

## Test Plan

- [ ] Navigate to Courses, click "React" tag, verify only React courses shown
- [ ] Select multiple tags, verify courses matching ANY tag are displayed
- [ ] Clear all filters, verify all courses return
- [ ] Type "Type" in search, verify TypeScript courses appear
- [ ] Verify empty state shows when no courses match selected tags

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Recovery

**If `gh pr create` fails:**

1. **Not authenticated:**
   ```bash
   gh auth status
   gh auth login
   ```

2. **Remote not set:**
   ```bash
   git remote -v
   git remote add origin <repo-url>
   ```

3. **Branch not pushed:**
   ```bash
   git push -u origin feature/e##-s##-slug
   ```

4. **PR already exists:**
   ```bash
   gh pr list --head feature/e##-s##-slug
   # Use existing PR URL instead of creating new one
   ```

## Post-Creation

After PR is created:

1. **Print PR URL** for the user
2. **Ask about merge status** (see [../SKILL.md](../SKILL.md) step 12)
3. **Wait for user** to review/merge the PR
4. **Clean up worktree** if PR is merged (see [worktree-cleanup.md](worktree-cleanup.md))
