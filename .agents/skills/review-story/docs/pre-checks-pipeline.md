# Pre-Checks Pipeline

This module defines the pre-check script execution, JSON parsing, exit code handling, and burn-in test suggestion logic.

## Overview

Pre-checks always run (even on resumed reviews) because they:
- Validate the current code state (may have changed since last run)
- Are fast (~2-3 min for full pipeline)
- Detect UI changes for agent dispatch logic
- Identify test anti-patterns for burn-in suggestion

**State Inputs**: `STORY_ID`, `BASE_PATH`, `resuming` flag
**State Outputs**: `review_gates_passed` array (updated), `HAS_UI_CHANGES` flag, `burn_in_validated` status

## Pre-Check Script Execution

**Run unified pre-check script with `--log-dir` for silent mode:**

```bash
./scripts/workflow/run-prechecks.sh \
  --mode=full \
  --story-id=${STORY_ID} \
  --base-path=${BASE_PATH} \
  --log-dir="${BASE_PATH}/${LOG_DIR}"
```

**`--log-dir` contract**: When provided, all gate output (build logs, lint output, test results) is written to disk files under `LOG_DIR/` instead of stderr. The orchestrator only sees errors on failure. Gate log paths are included in the JSON output under `log_paths`.

**Script output:** JSON object with gate results, UI change detection, test pattern findings, and `log_paths` (if `--log-dir` was passed).

**Parse results:**
- Extract `gates` object → update `review_gates_passed` array
- Extract `ui_changes` → set `HAS_UI_CHANGES` for agent dispatch logic (Step 7)
- Extract `test_pattern_findings` → use for burn-in suggestion (see below)
- Extract `auto_fixes.lint` and `auto_fixes.format` → note in output

**Exit code handling:**
- Exit 0: All pre-checks passed → continue to burn-in suggestion
- Exit 1: Pre-check failed (build, lint, type-check, format, or tests) → STOP with error
- Exit 2: Test pattern validation failed (HIGH/MEDIUM anti-patterns) → STOP with validation output

**On failure (exit 1):**
- Display error output from script (stderr)
- Keep `reviewed: in-progress` so next run resumes
- STOP — do NOT proceed to burn-in or agent reviews

**On test anti-pattern failure (exit 2):**
```
Test anti-patterns detected — must fix before review:

[Show validator output with severity and specific line numbers]

These patterns cause flakiness. Fix them, then re-run /review-story.
```
Keep `reviewed: in-progress`. Do NOT proceed to burn-in or agent reviews.

**On success (exit 0):**
- Update `review_gates_passed` with gates from JSON output
- Note any auto-fixes in output: "Auto-fixed N ESLint issues" or "Auto-formatted N files with Prettier"
- **TodoWrite**: Mark all pre-check todos → `completed`
- Continue to burn-in suggestion

## Burn-In Test Suggestion

**When to consider burn-in:**
If the story has an E2E spec file AND E2E tests passed AND `burn_in_validated` is NOT already `true` in story frontmatter, analyze whether burn-in testing would be valuable.

**Use `test_pattern_findings` from script output to determine confidence level:**

### 🔴 HIGH Confidence (Recommend Burn-In)

**Trigger:** `test_pattern_findings: "low-severity-detected"`

**Rationale:** Validator reported LOW severity issues (testFileSize, missingTestTimeImport, todoComments, debugConsole). These suggest complexity or timing-sensitive patterns worth validating.

**AskUserQuestion template:**
```
Question: "E2E tests passed but anti-patterns detected. Run burn-in validation?"
Header: "Burn-in test"
Options:
  1. "Run burn-in — 10 iterations (Recommended)"
     Description: "Anti-pattern detected: [specific issue]. Burn-in validates stability despite timing risks."
  2. "Skip — proceed to reviews"
     Description: "Tests may have flakiness risk. Consider fixing anti-patterns first."
```

### 🟡 MEDIUM Confidence (Offer Burn-In)

**Triggers:**
- Imports from `test-time.ts` (indicates date/time calculations)
- Uses `page.addInitScript()` for Date mocking (e.g., momentum calculations)
- Contains `requestAnimationFrame` or animation-related waits
- Story acceptance criteria mention "real-time", "polling", "debounce", "throttle"
- This is the first story in the epic (E##-S01)

**AskUserQuestion template:**
```
Question: "E2E tests passed. Run optional burn-in validation?"
Header: "Burn-in test"
Options:
  1. "Skip — proceed to reviews"
     Description: "Tests follow deterministic patterns. Standard validation sufficient."
  2. "Run burn-in — 10 iterations"
     Description: "Validates stability for timing-sensitive logic (adds ~2 min)."
```

### ✅ Low-Risk Patterns (Do NOT Suggest)

**Triggers:**
- `test_pattern_findings: "clean"`
- Simple UI-only tests (clicks, form fills, navigation)
- Tests use standard Playwright waits (`expect().toBeVisible()`)
- No timing logic detected
- Story already marked `burn_in_validated: true`

**Action:** Skip burn-in suggestion, continue to agent reviews.

## Burn-In Execution

**If burn-in selected:**

Run: `npx playwright test ${BASE_PATH}/tests/e2e/story-{id}.spec.ts --repeat-each=10 --project=chromium`

**If all iterations pass:**
- Set `burn_in_validated: true` in story frontmatter
- Continue to reviews

**If any iteration fails:**
STOP with flakiness report:
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

## State Outputs

After successful pre-checks and optional burn-in:
- `review_gates_passed`: Updated with: `build`, `lint`, `type-check`, `format-check`, `unit-tests`, `e2e-tests` (with `-skipped` variants where applicable)
- `HAS_UI_CHANGES`: Boolean flag for agent dispatch logic
- `burn_in_validated`: `true` if burn-in passed, otherwise absent
