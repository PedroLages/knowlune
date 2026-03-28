# Comprehensive Mode (Reviews Already Done)

This mode applies when `reviewed: true` in story frontmatter — `/review-story` was already run and passed.

## Steps

### 5a. Blocker Cross-Check

Read the latest code review report at `${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md`.

Parse the `#### Blockers` section. If blockers exist:

**Option A: Automated validation script** (recommended):
```bash
./scripts/workflow/validate-blockers.sh \
  --report=${BASE_PATH}/docs/reviews/code/code-review-*-{story-id}.md \
  --base-path=${BASE_PATH}
```

Exit codes:
- `0` - No blockers or all blockers resolved
- `1` - Unresolved blockers found
- `2` - Script error (missing report, invalid format)

**Option B: Manual check** (fallback if script doesn't exist):

For each blocker listed in the report:
1. Extract `file:line` reference and description
2. Check current code: `git show HEAD:path/to/file`
3. If code at that location still matches the blocker description → STOP:
   ```
   ❌ Cannot ship — [N] unresolved blocker(s) from code review:

   1. [file:line]: [Description]
   2. [file:line]: [Description]

   Fix these and re-run /finish-story.
   ```
4. If code has changed at those locations (likely fixed):
   ```
   ℹ️  Code review had [N] blockers; code at those locations has changed since review.
   Proceeding with validation.
   ```

### 5b. Lightweight Validation

Run unified pre-check script in lightweight mode:

```bash
./scripts/workflow/run-prechecks.sh \
  --mode=lightweight \
  --story-id=${STORY_ID} \
  --base-path=${BASE_PATH} \
  --skip-commit-check
```

**Lightweight mode** runs:
- Build verification (fast — checks compilation only)
- Lint check (with auto-fix)
- Type check (with auto-fix)
- Format check (with auto-fix)

**Does NOT run** (already validated by `/review-story`):
- Full test suite (unit + E2E)
- Review agents (design, code, testing)
- Burn-in validation

Parse JSON output. On failure (exit 1), STOP with error. Note any auto-fixes in output.

**If any check fails:**
```
❌ Validation failed:

[Show specific error from script output]

Fix the issue and re-run /finish-story.
```

**If all pass:**
Continue to Step 6 (Update story file).

## When to Use This Mode

Use comprehensive mode when:
- `reviewed: true` in story frontmatter
- Reviews were completed in a previous session
- Story file has review reports saved
- All 12 required gates are present in `review_gates_passed` (including performance-benchmark, security-review, exploratory-qa)

## Advantages

- **Fast** - Only runs essential checks (no full test suite, no agent reviews)
- **Safe** - Cross-checks blockers weren't introduced after review
- **Efficient** - Trusts previous review work, validates current state only
