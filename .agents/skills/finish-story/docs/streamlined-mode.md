# Streamlined Mode (Reviews Inline)

This mode applies when `reviewed: false` in story frontmatter — `/review-story` was NOT run separately.

**Use case:** Quick changes, config updates, or when developer wants to ship in one command.

## Pre-Flight Check: Lessons Learned Gate

**Before running any reviews**, validate documentation quality:

```bash
# Read story file's "Challenges and Lessons Learned" section
grep -A 20 "## Challenges and Lessons Learned" ${STORY_FILE}
```

Check for placeholder text:
- `[Document issues, solutions, and patterns worth remembering]`
- `[Populated by /review-story — Playwright MCP findings]`
- `[Populated by /review-story — adversarial code review findings]`
- `[Architecture decisions, patterns used, dependencies added]`
- Any other bracketed placeholder text

**If placeholders found:**
```
❌ Lessons Learned Gate FAILED

The "Challenges and Lessons Learned" section has placeholder text.

Placeholder found:
- [Document issues, solutions, and patterns worth remembering]

Why this matters:
- Undocumented lessons lead to repeated mistakes across stories
- This gate enforces 100% documentation compliance
- Epic 8 retrospective showed only 2/5 stories documented lessons

What to do:
1. Open ${STORY_FILE}
2. Replace placeholder text with actual lessons:
   - Implementation challenges you faced
   - Solutions you discovered
   - Patterns worth remembering
3. Commit your changes
4. Re-run /finish-story

See story 8-1-study-time-analytics.md for excellent documentation examples.
```

**STOP** — do NOT proceed to pre-checks or agents.

**If no placeholders:**
Continue to pre-checks.

## Steps

### 1. Set Review State

Update story frontmatter:
```yaml
reviewed: in-progress
review_started: YYYY-MM-DD
review_gates_passed: []
```

### 2. Pre-Checks (Full Suite)

Run unified pre-check script:

```bash
./scripts/workflow/run-prechecks.sh \
  --mode=full \
  --story-id=${STORY_ID} \
  --base-path=${BASE_PATH}
```

Parse JSON output:
- Extract `gates` object → update `review_gates_passed` array
- Extract `ui_changes` → set `HAS_UI_CHANGES` for agent dispatch
- Extract `test_pattern_findings` → use for burn-in suggestion
- Extract `auto_fixes` → note in output

**Exit code handling:**
- `0` - All pre-checks passed → continue to burn-in
- `1` - Pre-check failed → STOP with error
- `2` - Test pattern validation failed → STOP with validation output

**On failure:**
Keep `reviewed: in-progress` so next run resumes. Do NOT proceed to agents.

**On success:**
Update `review_gates_passed` with gates from JSON output. Continue to burn-in validation.

### 3. Burn-In Validation (Conditional)

**Check conditions:**
- Story has E2E spec file: `${BASE_PATH}/tests/e2e/story-{id}.spec.ts`
- E2E tests passed (in pre-checks)
- `burn_in_validated` is NOT `true` in frontmatter

**If all conditions met**, analyze `test_pattern_findings` from pre-checks:

**🔴 HIGH confidence** (`low-severity-detected`):
- Suggest burn-in as **first option** marked "(Recommended)"
- LOW severity issues detected by validator

**🟡 MEDIUM confidence** (timing-sensitive features):
- Offer burn-in as **second option**
- Imports from `test-time.ts`
- Uses `page.addInitScript()` for Date mocking
- Contains animation-related waits
- Story ACs mention "real-time", "polling", etc.

**✅ Low-risk** (`clean`):
- Skip burn-in suggestion entirely

**If burn-in selected:**
```bash
npx playwright test ${BASE_PATH}/tests/e2e/story-{id}.spec.ts \
  --repeat-each=10 \
  --project=chromium
```

**All pass** → set `burn_in_validated: true`, continue to agents

**Any fail** → STOP with flakiness report, keep `reviewed: in-progress`

### 4. Review Agent Swarm (Parallel Dispatch)

Dispatch ALL applicable agents in a **single message** for maximum parallelism:

```
Task({ subagent_type: "design-review", ... })
Task({ subagent_type: "code-review", ... })
Task({ subagent_type: "code-review-testing", ... })
Task({ subagent_type: "performance-benchmark", ... })
Task({ subagent_type: "security-review", ... })
Task({ subagent_type: "exploratory-qa", ... })
```

**Skip conditions:**
- **Design review**: Skip if no UI changes (`git diff --name-only main...HEAD` has no `src/app/` files). Add `design-review-skipped` to gates.
- **Code review**: Never skip
- **Test coverage**: Never skip
- **Performance benchmark**: Skip page metrics if lightweight review. Bundle analysis runs in pre-checks regardless.
- **Security review**: Never skip (secrets scan always relevant)
- **Exploratory QA**: Skip if no UI changes. Add `exploratory-qa-skipped` to gates.

**As each agent returns:**
- Validate result (check for errors, empty reports)
- Save report to `${BASE_PATH}/docs/reviews/{type}/`
- Parse severity sections
- Update `review_gates_passed`

### 5. Consolidated Report

Combine findings into severity-triaged view. See `/review-story` step 9 for template.

**If BLOCKERS found:**
```
❌ Review BLOCKED — Fix [N] blocker(s):

1. [Source — file:line]: [Description]

Re-run /finish-story after fixing. Completed gates are preserved.
```

**STOP** — do NOT create PR.

**If no blockers:**
Set `reviewed: true`, continue to PR creation (step 6+).

## When to Use This Mode

Use streamlined mode when:
- `reviewed: false` in story frontmatter
- Developer wants single-command shipping
- Story is simple (1-2 tasks, no major UI changes)
- Reviews weren't run separately via `/review-story`

## Advantages

- **Convenience** - One command from implementation to PR
- **Fast** - No context switching between `/review-story` and `/finish-story`
- **Complete** - Same validation as comprehensive workflow

## Disadvantages

- **Slower** - Runs full review pipeline (adds 2-5 min)
- **Less iterative** - Can't fix review feedback, re-review, then ship
- **Higher failure risk** - More gates to pass in one run

## Recommendation

Use streamlined mode for:
- ✅ Config changes, data updates, simple refactors
- ✅ Stories with 1-2 tasks, no UI changes
- ✅ Quick fixes with clear acceptance criteria

Use comprehensive mode (`/review-story` → `/finish-story`) for:
- ✅ UI changes (pages, components, styles)
- ✅ Stories with 3+ tasks
- ✅ Complex features with multiple areas touched
- ✅ When you want review feedback before PR creation
