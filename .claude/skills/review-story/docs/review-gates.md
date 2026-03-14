# Review Gates

This module defines the canonical gate names, resumption detection logic, and gate validation rules for the review workflow.

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

**Validate all required gates** before marking `reviewed: true`. Check that `review_gates_passed` contains one entry (base or `-skipped` variant) for each of the 10 canonical gates: `build`, `lint`, `type-check`, `format-check`, `unit-tests`, `e2e-tests`, `design-review`, `code-review`, `code-review-testing`, `web-design-guidelines`.

- **All gates present**: Set `reviewed: true`. Set `review_gates_passed` to the full list. Append review summary to `## Design Review Feedback` and `## Code Review Feedback` sections.
- **Missing gates**: Do NOT set `reviewed: true`. Keep `reviewed: in-progress`. Warn the user:
  ```
  Cannot mark as reviewed — missing gates: [list].
  [For each missing gate, explain why it's missing and how to fix.]
  Re-run /review-story after fixing.
  ```

**State Inputs**: `review_gates_passed` array
**State Outputs**: `reviewed: true` (if all gates pass) or warning message (if gates missing)
