# Phase 2: Post-Epic Commands

## Overview

After all stories are shipped and merged, run post-epic validation commands in order. Each command runs in a **fresh sub-agent**. These validate the epic's quality, coverage, and capture lessons learned.

**All 5 post-epic commands are mandatory** — sprint-status, testarch-trace, testarch-nfr, adversarial review, and retrospective. Fix any blocking issues (trace gaps, NFR failures) before generating the final report.

**Exception:** `/review-adversarial` is optional — only dispatched when the user explicitly requests it or the epic orchestrator is invoked with adversarial review enabled.

Commands with gate decisions (`/testarch-trace`, `/testarch-nfr`) include a **fix-then-revalidate cycle** — aligned with [BMad TEA's official guidance](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-trace/).

## Command Sequence

Run in this exact order (each depends on prior context):

### 1. Sprint Status Check (Sub-Agent)

**Prompt**: Use Sprint Status Agent template from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`**. **Use `model: "sonnet"`**.

**Purpose**: Verify all stories are `done`, no orphaned work remains.

**Coordinator after**: Output completion banner with status summary. If issues found, resolve before proceeding.

### 2. Mark Epic Done (Coordinator Directly)

After sprint status confirms all stories done:

```bash
# Edit sprint-status.yaml: change epic status to done
# Example: epic-20: done

git add docs/implementation-artifacts/sprint-status.yaml
git commit -m "chore: mark Epic {N} as done"
git push
```

### 3. Testarch Trace — with Fix-Revalidate Cycle (Sub-Agent)

**Prompt**: Use Testarch Trace Agent template from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`** for all agents in this cycle (trace, fix, revalidation). **Use `model: "sonnet"`** for all agents in this cycle.

**Purpose**: Generate requirements-to-tests traceability matrix. Identifies coverage gaps.

**Gate decisions**: `PASS` / `CONCERNS` / `FAIL`

**Fix-Revalidate cycle** (per [BMad TEA guidance](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/how-to/workflows/run-trace/)):

```dot
digraph trace_cycle {
  rankdir=TB;
  node [shape=box];

  run [label="Run /testarch-trace\n(Create mode — Phase 1)"];
  gate [label="Gate decision?" shape=diamond];
  fix [label="Fix Agent: write\nmissing tests"];
  rerun [label="Re-run /testarch-trace\n(Phase 1 refresh + Phase 2 gate)"];
  pass [label="Proceed to NFR"];
  report [label="Log remaining gaps\nin final report"];

  run -> gate;
  gate -> pass [label="PASS"];
  gate -> fix [label="CONCERNS\nor FAIL"];
  fix -> rerun;
  rerun -> gate;
  gate -> report [label="CONCERNS after\n2 fix rounds"];
}
```

**Coordinator actions:**
- If `PASS` → note coverage %, proceed to NFR
- If `CONCERNS` or `FAIL` → spawn **Fix Agent** to write missing tests for P0/P1 gaps
- After fix → spawn **new Trace Agent** to re-run Phase 1 (refresh coverage) + Phase 2 (gate decision)
- Max 2 fix rounds. If still `CONCERNS` after 2 rounds → accept and log remaining gaps in final report
- `FAIL` that persists after 2 rounds → log as critical gap in final report

### 4. Testarch NFR — with Fix-Revalidate Cycle (Sub-Agent)

**Prompt**: Use Testarch NFR Agent template from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`** for all agents in this cycle. **Use `model: "sonnet"`** for all agents in this cycle.

**Purpose**: Assess non-functional requirements (performance, security, reliability, maintainability).

**Gate decisions**: `PASS` / `CONCERNS` / `FAIL`

**Fix-Revalidate cycle** (per [BMad TEA tri-modal design](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/blob/main/README.md)):

**Coordinator actions:**
- If `PASS` → note assessment, proceed to adversarial review
- If `CONCERNS` or `FAIL` → classify findings:
  - **Fixable** (code-level: missing error handling, security patches, performance fixes) → spawn **Fix Agent**
  - **Architectural** (design changes, infrastructure) → log in final report as deferred
- After fix → spawn **new NFR Agent** in Validate mode to re-evaluate against checklist
- Max 2 fix rounds. If still `CONCERNS` after 2 rounds → accept and log remaining issues
- `FAIL` that persists → log as critical issue in final report

### 5. Adversarial Review (Sub-Agent) — Optional, Report Only

**Prompt**: Use Adversarial Review Agent template from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`**. **Use `model: "sonnet"`**.

**Purpose**: Cynical critique of epic scope and implementation. Identifies at least 10 issues.

**Optional** — only dispatched when the user explicitly requests it or the epic is invoked with adversarial review enabled. Skip by default.

**No fix cycle** — findings are informational. They represent opinions and scope critiques, not pass/fail gates.

**Coordinator after**: Output completion banner with findings count. Include in final report.

### 6. Retrospective (Sub-Agent) — Report Only

**Prompt**: Use Retrospective Agent template from [agent-prompt-templates.md](agent-prompt-templates.md). **Use `run_in_background: true`**. **Use `model: "sonnet"`**.

**Purpose**: Post-epic review with lessons learned and action items for next epic.

**No fix cycle** — this is a reflective conversation, not a validation gate.

**Critical**: The retrospective agent acts as Pedro (the developer) in the party mode dialogue. It must:
- Think analytically before each answer
- Consider if the answer is the best possible
- Draw from actual implementation experience
- Be honest and constructive

**Coordinator after**: Output completion banner with retro document path and key action items. Mark `epic-{N}-retrospective: done` in `sprint-status.yaml`.

### 7. Known Issues Register Update (Coordinator Directly)

After all post-epic commands complete, the coordinator updates `docs/known-issues.yaml` with genuinely NEW pre-existing issues discovered during this epic.

**Input:** The `NEW PRE-EXISTING ISSUES` list accumulated during Phase 1 review loops.

**Steps:**

1. Re-read `docs/known-issues.yaml` to get the current last KI number (may have changed if another process updated it).
2. For each NEW pre-existing issue, append a YAML entry:
   ```yaml
   - id: KI-{NEXT_NUMBER}
     type: {type}           # test | lint | typecheck | build | design | code
     summary: "{summary}"
     file: "{file:line}"
     severity: {severity}
     discovered_by: {STORY_ID_THAT_FOUND_IT}
     discovered_on: {TODAY_DATE}
     status: open
     scheduled_for: null
     fixed_by: null
     notes: "Discovered during Epic {N} orchestrated run."
   ```
3. Commit the updated register:
   ```bash
   git add docs/known-issues.yaml
   git commit -m "chore(Epic {N}): add {COUNT} new known issues (KI-{FIRST} to KI-{LAST})"
   git push
   ```

**Skip conditions:**
- If the NEW pre-existing issues list is empty, skip this step entirely.
- If an issue was already added to `known-issues.yaml` by a `/review-story` sub-agent (check by file path and summary), do not duplicate it.

**Coordination with /review-story:** The standalone `/review-story` skill has its own known-issues logging workflow. When running inside the epic orchestrator, review agents classify issues as KNOWN, NEW PRE-EXISTING, or STORY-RELATED — the coordinator handles all register writes in this single Phase 2 step to prevent concurrent modification and ensure proper KI-NNN sequencing.

## Post-Epic TodoWrite Updates

```
[x] Sprint status check — all stories done
[x] Mark epic done — committed
[x] Testarch trace — coverage: {N}%, gate: {DECISION}
[x] Testarch trace fix round 1 — {N} tests added (if needed)
[x] Testarch trace revalidation — gate: {DECISION} (if needed)
[x] Testarch NFR — gate: {DECISION}
[x] Testarch NFR fix round 1 — {N} issues fixed (if needed)
[x] Testarch NFR revalidation — gate: {DECISION} (if needed)
[x] Adversarial review — {N} findings
[x] Retrospective — {path}
[x] Known issues register — {N} new issues added (KI-{FIRST} to KI-{LAST})
```

## Commit Post-Epic Artifacts

After all post-epic commands complete (including any fix rounds):

```bash
git add docs/implementation-artifacts/ docs/reviews/ docs/known-issues.yaml tests/
git commit -m "docs(Epic {N}): add post-epic validation reports and test coverage fixes"
git push
```

After each post-epic command completes, **update the tracking file** Post-Epic Validation table with status, result, and notes.

## Parallel Dispatch Option

**Default:** Sequential (current behavior — safe, commands may depend on prior results).

**When user requests parallel execution** ("run post-epic in parallel where possible"):

| Group | Commands | Constraint |
|-------|----------|-----------|
| A (sequential) | Sprint Status → Mark Epic Done → Known Issues Register | Must confirm done and have all findings before writing |
| B (sequential) | Testarch Trace (+ fix cycle) → Testarch NFR (+ fix cycle) | Trace fixes may add tests NFR evaluates |
| C (independent) | Adversarial Review, Retrospective | No dependencies on each other |

**Parallel strategy:** Run Group A first. Then dispatch Group B and Group C concurrently (up to 3 agents simultaneously). Within each group, commands remain sequential.
