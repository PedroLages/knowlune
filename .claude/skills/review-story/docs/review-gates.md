# Review Gates

This module defines the canonical gate names, resumption detection logic, and gate validation rules for the review workflow.

## Single Source of Truth

**All gate definitions are now in `config/gates.json`** — this is the authoritative source for:
- Canonical gate names (no variants)
- Required vs optional gates
- Skip conditions and skip suffixes
- Agent mappings and report path templates
- Dev server requirements

See: [config/gates.json](../config/gates.json)

## Canonical Gate Names

Gates must use the exact names from `config/gates.json`. The `-skipped` suffix indicates the gate was intentionally skipped (e.g., no lint script, no test files, no UI changes). Both the base name and `-skipped` variant satisfy the requirement.

**Required for `reviewed: true`** (12 gates from `config/gates.json`):
- `build`, `lint`, `type-check`, `format-check`
- `unit-tests`, `e2e-tests`
- `design-review`, `code-review`, `code-review-testing`
- `performance-benchmark`, `security-review`, `exploratory-qa`

## Resumption Detection

**Check if this is a resumed review:**

- If `reviewed: in-progress` and `review_gates_passed` is non-empty:
  - Inform the user: "Resuming interrupted review. Previously passed gates: [list]. Re-running pre-checks (code may have changed), then skipping already-completed agent reviews."
  - Set `resuming = true` and note which gates passed.
- If `reviewed: true`:
  - Inform the user: "Story already reviewed. Re-running full review to validate current state."
  - Reset: set `reviewed: in-progress`, clear `review_gates_passed`, update `review_started`.
- If `reviewed: false` (fresh review):
- Set `reviewed: in-progress`, `review_started: YYYY-MM-DD`, `review_gates_passed: []` in story frontmatter.

**State Inputs**: `reviewed` field, `review_gates_passed` array from story frontmatter
**State Outputs**: `resuming` flag, reset review state if `reviewed: true`

## Gate Validation

**Use the `validate-gates.py` script** to validate all required gates before marking `reviewed: true`:

```bash
python3 scripts/workflow/validate-gates.py \
  --gates-config=.claude/skills/review-story/config/gates.json \
  --run-state=.claude/state/review-story/review-run-{STORY_ID}.json
```

**Returns JSON with:**

- `valid`: true if all required gates present (base or `-skipped` variant)
- `missing_gates`: array of gate names not found
- `present_gates`: array of gate names found
- `can_mark_reviewed`: true if `valid` is true

**State Inputs**: `review_gates_passed` array, `gates.json` config
**State Outputs**: `reviewed: true` (if valid) or warning message (if gates missing)

## State Management

**Use the `checkpoint.sh` script** to save/restore review state between sessions:

```bash
# Save state
bash scripts/workflow/checkpoint.sh save --story-id=E01-S03 --story-file=PATH

# Restore state
bash scripts/workflow/checkpoint.sh restore --story-id=E01-S03
```

**State file:** `.claude/state/review-story/review-run-{STORY_ID}.json`

- Stores `gates_passed_list`, `gates` object with statuses, `verdict`, `events` audit trail
- Syncs to/from story frontmatter on save/restore

See: [schemas/review-run.schema.json](../schemas/review-run.schema.json)
