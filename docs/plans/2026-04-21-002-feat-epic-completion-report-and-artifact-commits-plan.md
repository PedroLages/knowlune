---
title: "feat: Epic completion report + artifact commits in ce-orchestrator"
type: feat
status: active
date: 2026-04-21
---

# feat: Epic completion report + artifact commits in ce-orchestrator

## Overview

Two related gaps in the `ce-orchestrator` epic-loop pipeline:

1. **Epic completion report** — after all stories in an epic merge, the orchestrator prints a terminal banner but saves no durable report file. In auto/unattended mode the user never sees this output; the only post-run artifact is the gitignored tracking file. Adding a `report-generator` sub-agent that writes a structured `docs/implementation-artifacts/epic-{N}-completion-report-{YYYY-MM-DD}.md` file (in the established 8-section format) makes every epic's results inspectable after the fact.

2. **Artifact commits during runs** — brainstorm requirements documents and plan files produced mid-pipeline are never committed to git. They are written to `docs/brainstorms/` and `docs/plans/` but never staged or pushed. In auto mode these artifacts accumulate uncommitted; if the session ends before a PR lands, they are effectively lost. Committing artifacts at the moment they are written (brainstorm → commit, plan → commit) makes the paper trail durable and visible in git history.

## Problem Frame

Pedro runs `/ce-orchestrator E##` in autopilot/unattended mode for full epics — up to 8+ stories sequentially without watching the terminal. When the run ends, there is no file to read that summarises what happened: which stories shipped, how many review rounds each took, what findings the agents surfaced, what action items the retrospective produced, and what to watch for in the next epic. The existing epic tracking file (`.context/compound-engineering/ce-runs/epic-E##-*.md`) is gitignored and contains only YAML frontmatter without narrative. The brainstorm and plan files also accumulate uncommitted, creating a gap between "the pipeline ran" and "git history reflects that."

## Requirements Trace

- R1. After every epic-loop run, a completion report file exists at `docs/implementation-artifacts/epic-{N}-completion-report-{YYYY-MM-DD}.md`
- R2. The report follows the established 8-section format used by `epic-{N}-completion-report-*.md` files already in the repo
- R3. The report is committed to `main` by the report sub-agent, not left uncommitted
- R4. The report is still produced in unattended/headless mode (zero interactive prompts)
- R5. If the report agent fails, the epic closeout continues — never halts
- R6. Brainstorm requirements documents are committed to git immediately after they are written in Phase 1.1
- R7. Plan files are committed to git immediately after they are written in Phase 1.2
- R8. The terminal state banner and tracking file frontmatter include the report path

## Scope Boundaries

- Does not change the `bmad-retrospective` output or format — that is a separate document for a different audience
- Does not add a completion report to single-story (non-epic) runs — report only meaningful after multi-story epics
- Does not retroactively generate reports for past epics
- Does not change the existing tracking file gitignore contract — tracking files remain gitignored
- Artifact commit discipline (R6, R7) applies to `ce-orchestrator` only — not to `ce:plan` or `ce:brainstorm` invoked standalone

### Deferred to Separate Tasks

- `scripts/finalize-ce-run.sh` — referenced in SKILL.md Phase 3.3 but does not exist; creating it is a separate chore
- `--force-report` flag for regenerating a report that already exists — deferred to a later iteration

## Context & Research

### Relevant Code and Patterns

- `.claude/skills/ce-orchestrator/SKILL.md` — Phase 0.7 step 6 is the epic closeout sequence; terminal banner is in step 7; this is where the report agent dispatch and artifact-commit steps are added
- `.claude/skills/ce-orchestrator/references/sub-agent-prompts.md` — 17-agent indexed registry; new `report-generator` sub-agent prompt goes here as Section 18
- `.claude/skills/ce-orchestrator/references/sub-agent-models.md` — model + effort matrix; new row for `report-generator` (Sonnet, medium, no extended thinking)
- `.claude/skills/ce-orchestrator/references/tracking-file-schema.md` — defines frontmatter fields; needs `artifacts.reportPath` and extended `closeoutStatus` values
- `docs/implementation-artifacts/epic-62-completion-report-2026-04-14.md` — canonical format reference; 8-section structure
- `.claude/skills/epic-orchestrator/docs/phase-3-final-report.md` — the spec for the epic-orchestrator's equivalent; defines the 8 sections and per-section data sources
- `.context/compound-engineering/ce-runs/epic-E##-*.md` — epic tracking file; primary input for the report agent
- `docs/implementation-artifacts/sprint-status.yaml` — per-story metadata (title, status, PR URL, dates)
- `docs/known-issues.yaml` — known issues with `discovered_by: E##-S##` tags
- `docs/engineering-patterns.md` — pattern count baseline pre-retro (for "patterns extracted" metric)

### Institutional Learnings

- The `epic-orchestrator` (separate skill) already has a full Phase 3 Final Report pipeline producing the same format — reuse that sub-agent prompt structure
- The retrospective (`bmad-retrospective`) uses fictional dialogue personas (Bob/Alice/Charlie) and is a conversational lessons-learned document — not the same artifact as the completion report
- CE review artifacts for recent epics (E92+) live at `.context/compound-engineering/ce-review/<runId>/` in JSON format — NOT in `docs/reviews/consolidated-review-*.md`; the report agent needs a two-level lookup
- Previous epic retro lookup must use glob-sort by mtime (not N-1 arithmetic) because epic numbers are non-contiguous and executed out-of-order
- All closeout sub-agent dispatches must be `run_in_background: true` and end with `/auto-answer autopilot` — non-negotiable per orchestrator discipline
- The `closeoutStatus` field in the epic tracking file is the idempotency signal — "already terminal = no-op"

### External References

- Existing 40+ completion reports in `docs/implementation-artifacts/` establish the de facto 8-section schema

## Key Technical Decisions

- **Report agent model: Sonnet** — mechanical synthesis from structured inputs (tracking file + sprint-status + known-issues); not deep reasoning. Consistent with `ce-git-commit-push-pr-dispatcher` (also Sonnet, also structured output from clear inputs)
- **Artifact commits via inline coordinator git calls, not a sub-agent** — brainstorm and plan commits are single-file, deterministic operations (one file written → one `git add` + `git commit` + `git push`). Delegating to a sub-agent adds unnecessary overhead. The coordinator makes the commit call directly after the sub-agent returns the artifact path
- **Report commit: `git checkout main && git pull --ff-only` first** — all story PRs are already merged to main; the coordinator's working tree may be on a deleted feature branch. The report agent must switch to main before writing and committing
- **Idempotency: skip if report file already exists** — log path and continue. No overwrite. Re-runs that need a fresh report require manual deletion
- **Ordering: report agent runs after `known-issues-triage`, before `retrospective-dispatcher`** — this preserves the "retro runs last" invariant while letting the retro reference the committed report path. The retrospective can then cite the report file rather than duplicating its synthesis
- **`closeoutStatus` values extended** — new values: `report-in-progress`, `report-committed`, `report-failed`, `complete` (set after retro). The coordinator checks for `report-committed` or `complete` before deciding to skip re-generation
- **Report agent output contract: structured JSON** — `{"reportPath": "<repo-relative-path>", "committed": true|false, "commitSha": "<sha or null>"}`. Coordinator records `artifacts.reportPath` without reading the file

## Open Questions

### Resolved During Planning

- **Which branch does the report commit land on?** → `main`. The report agent runs `git checkout main && git pull --ff-only` before writing. If that fails, it writes the file to disk (without commit) and returns `committed: false` — engineer commits manually
- **CE review JSON vs. consolidated review files?** → Two-level lookup: (1) check `docs/reviews/consolidated-review-{date}-{epic}-{story}.md`; (2) if not found, check `.context/compound-engineering/ce-review/` using `reviewRunId` from tracking file; (3) if neither, mark row as "CE-review (no report file)"
- **Previous epic retro lookup?** → Glob-sort `docs/implementation-artifacts/epic-*-retro-*.md` by mtime descending; take most recent not matching current epic number
- **Report agent output for single-story epic?** → Generates normally; cross-story pattern sections emit "Single-story epic — not applicable"
- **Artifact commit scope?** → Brainstorm file commit after Phase 1.1 returns; plan file commit after Phase 1.2 returns. Commit message format: `docs: add <brainstorm|plan> artifact for <slug>`. Push after each commit (not batched)

### Deferred to Implementation

- Whether to add `previousEpicId` to epic tracking file frontmatter vs. relying on glob-sort — either approach works; implementer chooses at write time
- Exact CE review JSON field names within `review-synthesis.json` — implementer reads the actual file to determine round count and severity counts

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
ce-orchestrator epic-loop closeout sequence (Phase 0.7 step 6) — after last story merges:

  [existing] sprint-status-checker (haiku)
      ↓
  [existing] known-issues-triage (haiku)
      ↓
  [full only] testarch-trace + testarch-nfr + review-adversarial (existing)
      ↓
  [NEW] report-generator (sonnet) ─────── reads: epic tracking file
      │                                           sprint-status.yaml
      │                                           known-issues.yaml (filtered)
      │                                           ce-review JSON or consolidated-review md
      │                                           prev epic retro (mtime glob)
      │                        writes: docs/implementation-artifacts/epic-{N}-completion-report-{date}.md
      │                        commits: git checkout main && git add && git commit && git push
      │                        returns: {"reportPath": "...", "committed": true, "commitSha": "..."}
      ↓
  coordinator: update tracking file artifacts.reportPath, set closeoutStatus: report-committed
      ↓
  [existing] retrospective-dispatcher (opus, extended thinking) — runs last, can reference report
      ↓
  coordinator: set closeoutStatus: complete
      ↓
  terminal banner (updated with "Report: <path>")


Phase 1.1 — Brainstorm returns artifact path:
  coordinator: git add <brainstorm-path> && git commit -m "docs: add brainstorm artifact for <slug>" && git push

Phase 1.2 — Plan returns artifact path:
  coordinator: git add <plan-path> && git commit -m "docs: add plan artifact for <slug>" && git push
```

## Implementation Units

- [ ] **Unit 1: Extend epic tracking file schema for report fields**

**Goal:** Add `artifacts.reportPath` field and extended `closeoutStatus` values to the tracking file schema spec so the coordinator and report agent share a clear contract.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `.claude/skills/ce-orchestrator/references/tracking-file-schema.md`

**Approach:**
- Add `artifacts.reportPath: null` to the frontmatter example block under the `artifacts:` section
- Add new `closeoutStatus` values: `report-in-progress`, `report-committed`, `report-failed`, `complete` to the Status values section
- Document that `complete` is set only after the retrospective-dispatcher returns, not after the report commit alone
- Add a note on idempotency: coordinator checks for `closeoutStatus: report-committed | complete` before dispatching the report agent again

**Patterns to follow:**
- Existing `artifacts.prUrl`, `artifacts.solutionPath` field documentation style
- Existing status value table format in tracking-file-schema.md

**Test scenarios:**
- Test expectation: none — pure schema documentation; behavior is validated by the integration scenarios in Units 3 and 4

**Verification:**
- Schema file documents the new fields and status values
- Example frontmatter block reflects the new fields

---

- [ ] **Unit 2: Add `report-generator` to sub-agent model matrix**

**Goal:** Register the new sub-agent in the authoritative model + effort matrix so the coordinator uses the correct model.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `.claude/skills/ce-orchestrator/references/sub-agent-models.md`

**Approach:**
- Add row 18: `report-generator | 0.7 closeout | Sonnet | medium | off | Mechanical synthesis from structured inputs (tracking file, sprint-status, review artifacts); not deep reasoning`
- Append to the matrix after the existing 17 rows

**Patterns to follow:**
- Existing matrix row format: `| # | Sub-agent | Phase | Model | Effort | Thinking | Rationale |`

**Test scenarios:**
- Test expectation: none — registry entry; correctness validated by integration

**Verification:**
- Row 18 exists in the matrix with correct model (Sonnet), effort (medium), thinking (off)

---

- [ ] **Unit 3: Write `report-generator` sub-agent prompt**

**Goal:** Add Section 18 to `sub-agent-prompts.md` with the complete prompt template the coordinator passes to the Sonnet report agent. This is the core behavioral specification for the new feature.

**Requirements:** R1, R2, R3, R4, R5, R8

**Dependencies:** Unit 1 (schema defines the output contract fields)

**Files:**
- Modify: `.claude/skills/ce-orchestrator/references/sub-agent-prompts.md`

**Approach:**

The prompt template must specify:

1. **Role statement**: "You are the report-generator sub-agent for the CE orchestrator epic closeout pipeline."

2. **Inputs the coordinator passes**:
   - `epicId` (e.g., `E97`)
   - `epicTrackingPath` (repo-relative path to `.context/compound-engineering/ce-runs/epic-E##-*.md`)
   - `reportDate` (today's date `YYYY-MM-DD`)

3. **Steps the agent executes**:
   - Check if `docs/implementation-artifacts/epic-{epicId lower}-completion-report-{reportDate}.md` already exists → if yes, return `{"reportPath": "<existing-path>", "committed": false, "commitSha": null, "skipped": true}`
   - Run `git checkout main && git pull --ff-only` → if fails, set `commitOnFail: true` flag (write file but skip commit)
   - Read the epic tracking file (frontmatter + body)
   - Read `docs/implementation-artifacts/sprint-status.yaml` filtered to this epic's story IDs
   - Read `docs/known-issues.yaml` filtered to `discovered_by` matching any story in this epic
   - For each story: look up review metrics via two-level lookup (consolidated-review md → CE review JSON fallback)
   - Find previous epic retro: glob-sort `docs/implementation-artifacts/epic-*-retro-*.md` by mtime descending, take first not matching current epic number
   - Generate the 8-section completion report using the template (see below)
   - Write file to `docs/implementation-artifacts/epic-{epicId lower}-completion-report-{reportDate}.md`
   - If `commitOnFail` not set: `git add <path> && git commit -m "docs(E##): add epic completion report" && git push` → capture commit SHA
   - Return structured JSON

4. **8-section template specification** (embedded in prompt):
   - §1 Executive Summary: epic number, name (from sprint-status), goal, outcome (X of N stories shipped), date range (first story started → last merged)
   - §2 Stories Delivered: table — Story ID | Name | PR URL | Review Rounds | Status (completed/aborted)
   - §3 Review Metrics: aggregate findings by severity across all stories; first-pass rate; round efficiency. Source: CE review JSON or consolidated review files. If neither found, note "review artifacts not available"
   - §4 Deferred Issues: known-issues items added during this epic, categorized by `schedule-future | wont-fix | fix-now-chore` from `known-issues-triage` output in tracking file
   - §5 Post-Epic Validation: testarch trace, NFR, adversarial review results if `--full` closeout was run; otherwise "standard closeout — validation not run"
   - §6 Lessons Learned: from previous epic retro action item follow-through (were prior action items addressed?) + any patterns noted in story tracking bodies
   - §7 Suggestions for Next Epic: derived from deferred issues + lessons learned
   - §8 Build Verification: confirm `npm run build` still passes on main (run it; report result)

5. **Error handling in prompt**: for each missing data source, emit a placeholder row/note rather than failing. Agent never halts on missing data.

6. **Output**: `{"reportPath": "<repo-relative>", "committed": true|false, "commitSha": "<sha or null>", "skipped": false}`

7. Prompt ends with `/auto-answer autopilot`

**Patterns to follow:**
- Existing sub-agent prompt sections (e.g., `ce-git-commit-push-pr-dispatcher` Section 11 for commit mechanics, `plan-summarizer` Section 3 for strict output format)
- The 8-section structure from `docs/implementation-artifacts/epic-62-completion-report-2026-04-14.md`

**Test scenarios:**
- Happy path: Epic E97, 5 stories all completed, CE review JSONs exist → report file written with all 8 sections populated, committed to main, returns `committed: true`
- Edge case: Report file already exists at target path → agent returns `skipped: true` without overwriting
- Edge case: `git checkout main` fails (e.g., dirty tree) → agent writes file to disk, returns `committed: false`, no error halt
- Edge case: No CE review JSON and no consolidated review file for a story → Section 3 shows "review artifacts not available" for that story
- Edge case: Single-story epic → report generates; §6 cross-story note says "single-story epic — not applicable"
- Edge case: No previous epic retro file found → §6 "Previous epic comparison: no prior retro found"
- Edge case: Partial epic (2 of 5 stories aborted) → §2 shows aborted stories with status "aborted", §7 suggestions reference the incomplete stories
- Error path: sprint-status.yaml missing or unparseable → agent uses tracking file `prUrls[]` and story IDs as fallback; notes data gap in §1
- Integration: Report agent reads `known-issues-triage` summary from tracking file body → §4 populated without re-reading `known-issues.yaml` entries directly

**Verification:**
- Section 18 exists in `sub-agent-prompts.md` with the complete prompt template
- Prompt covers all 8 sections and specifies per-section data sources
- Prompt covers all edge/error paths with fallback text
- Prompt ends with `/auto-answer autopilot`
- Index table at top of `sub-agent-prompts.md` has row 18 for `report-generator`

---

- [ ] **Unit 4: Wire report-generator dispatch into SKILL.md Phase 0.7 step 6**

**Goal:** Insert the report-generator dispatch into the epic closeout sequence and update the terminal banner to include the report path.

**Requirements:** R1, R3, R4, R5, R8

**Dependencies:** Units 1–3

**Files:**
- Modify: `.claude/skills/ce-orchestrator/SKILL.md`

**Approach:**

In Phase 0.7 step 6 **Standard** closeout block, after `known-issues-triage` and after any `--full` optional agents, insert:

```
- `report-generator` (sonnet) → dispatched after known-issues-triage (and after full-closeout agents if --full). Coordinator passes epicId + epicTrackingPath + reportDate. On success, update tracking file: artifacts.reportPath = returned path, closeoutStatus: report-committed. On failure, log warning to tracking file errors[]: append {stage, time, message}, set closeoutStatus: report-failed, continue to retrospective. Never halts.
```

Update the terminal banner (step 7) to add:
```
Report:       <reportPath or "[generation failed]">
```

Add a row to the Headless Mode Defaults table:
```
| Report generation | 0.7 closeout | N/A (no gate) | Runs automatically, no prompt | Fully automated sub-agent |
```

**Patterns to follow:**
- Existing closeout dispatcher descriptions: `sprint-status-checker`, `known-issues-triage`, `retrospective-dispatcher`
- Terminal banner format (existing `✓ PR created` block in Phase 3.2)
- Headless mode table format in Phase 0 header section

**Test scenarios:**
- Happy path: standard closeout with 5-story epic → `report-generator` dispatched after `known-issues-triage`, tracking file updated with `reportPath` and `closeoutStatus: report-committed`, then `retrospective-dispatcher` runs last, terminal banner shows Report line
- Error path: report-generator returns error → warning added to `errors[]`, `closeoutStatus: report-failed`, retrospective-dispatcher still runs, terminal banner shows `[generation failed]`
- Edge case: `--epic-closeout=full` → report-generator runs after the adversarial-review-dispatcher, before retrospective-dispatcher
- Edge case: `--epic-closeout=skip` → report-generator is skipped entirely (closeout is skipped)
- Integration: retrospective-dispatcher runs after report-generator returns; retro has access to committed report file on main

**Verification:**
- Phase 0.7 step 6 shows `report-generator` dispatch in both Standard and Full closeout sequences
- Terminal banner includes `Report:` line
- Headless mode table has row for report generation (no gate, always automatic)
- Error recovery summary table updated with `report-generator fails → log warning, continue` row

---

- [ ] **Unit 5: Add artifact commit steps to Phase 1.1 (brainstorm) and Phase 1.2 (plan)**

**Goal:** After the brainstorm sub-agent writes a requirements file and after the plan sub-agent writes a plan file, the coordinator immediately commits and pushes the artifact to git.

**Requirements:** R6, R7

**Dependencies:** None (independent of Units 1–4)

**Files:**
- Modify: `.claude/skills/ce-orchestrator/SKILL.md`

**Approach:**

In Phase 1.1 (Brainstorm), after the `ce-brainstorm-dispatcher` returns and the coordinator updates the tracking file with `artifacts.brainstorm`, add:

```
Artifact commit: immediately after the brainstorm file is confirmed written, coordinator runs:
  git add <brainstorm-path>
  git commit -m "docs: add brainstorm artifact for <slug>"
  git push
If the commit fails, log warning to tracking file and continue — never halt on artifact commit failure.
```

In Phase 1.2 (Plan), after the `ce-plan-dispatcher` returns and the coordinator updates the tracking file with `artifacts.plan`, add the same pattern:

```
Artifact commit: immediately after the plan file is confirmed written, coordinator runs:
  git add <plan-path>
  git commit -m "docs: add plan artifact for <slug>"
  git push
If the commit fails, log warning and continue.
```

**Why inline coordinator git calls (not a sub-agent):** These are deterministic single-file commits with no decision logic. Delegating to a sub-agent would add a Task dispatch overhead for a 3-line git operation. The coordinator makes these calls directly, consistent with how the existing `git add / git commit / git push` pattern already appears in Phase 2.5 for PR creation.

**Patterns to follow:**
- Phase 2.5 `ce-git-commit-push-pr-dispatcher` (coordinator receives branch + PR URL, not full diff)
- Error recovery summary table at the bottom of SKILL.md (add artifact commit failure row)

**Test scenarios:**
- Happy path: brainstorm completes, requirements file written to `docs/brainstorms/`, coordinator commits and pushes, tracking file `stagesCompleted` has `phase-1.1-artifact-committed`
- Happy path: plan completes, plan file written to `docs/plans/`, coordinator commits and pushes, tracking file updated
- Error path: `git push` fails on brainstorm commit (e.g., network error) → warning logged, pipeline continues to plan stage (brainstorm file is still on disk, just not pushed)
- Edge case: epic-loop run (`/ce-orchestrator E##`) — per-story brainstorm and plan artifacts are committed after each story's Phase 1.1 and 1.2 complete, not batched at end of epic
- Edge case: plan was passed as direct input (coordinator entered at plan-approval gate) → no brainstorm artifact to commit; Phase 1.1 is skipped; only the plan artifact commit applies if the plan file does not already have a git commit

**Verification:**
- Phase 1.1 section of SKILL.md includes artifact commit step after sub-agent dispatch
- Phase 1.2 section includes artifact commit step after sub-agent dispatch
- Error recovery table has row for artifact commit failure

## System-Wide Impact

- **Interaction graph:** Phase 0.7 step 6 closeout sequence gains a new sequential step; the `retrospective-dispatcher` ordering invariant ("runs last") is preserved by placing `report-generator` before it
- **Error propagation:** report-generator failures append to `errors[]` in the tracking file and set `closeoutStatus: report-failed`; they do not propagate to the retrospective-dispatcher or halt the epic
- **State lifecycle risks:** report file must be committed to main before the session ends, or it will be lost if the user closes the terminal; the report agent's `committed: true` return value is the signal that the file is durable
- **Unchanged invariants:** the retrospective (`bmad-retrospective`) output format and location are unchanged; the tracking file gitignore contract is unchanged; the plan-approval gate remains the sole hard human checkpoint; single-story runs do not receive epic completion reports
- **Integration coverage:** the report agent reads gitignored CE review JSON files — these may not exist on a re-run or on a different machine; the two-level lookup with graceful fallback is the safety mechanism

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `git checkout main` in report agent fails due to uncommitted local changes on the coordinator's branch | Agent detects exit code, writes file to disk, returns `committed: false`; coordinator logs warning; engineer commits manually after the run |
| CE review JSON artifacts gitignored — not available on fresh clone or after `.context/` is deleted | Two-level lookup with explicit "review artifacts not available" fallback in §3 of the report |
| Previous epic retro glob returns wrong file (epics run out of order, duplicate dates) | Glob-sort by mtime is best-effort; if wrong file is picked, the §6 comparison section will reference wrong data but will not fail; this is a low-severity cosmetic issue |
| Report file written but not committed (push fails) | `committed: false` surfaced in banner; engineer can `git push` manually after the run |
| Brainstorm/plan artifact commits add git noise to main for short-lived ideas that don't ship | Accepted — the commits are small, descriptive, and make the pipeline's paper trail auditable. The alternative (uncommitted artifacts) is worse in unattended mode |
| Headless mode deadlock if report agent uses `AskUserQuestion` | Prompt template explicitly ends with `/auto-answer autopilot`; no interactive gates are defined in the prompt |

## Documentation / Operational Notes

- After this plan lands, `docs/brainstorms/` and `docs/plans/` will have small "docs: add brainstorm/plan artifact" commits interleaved with story commits in git log — this is expected and intentional
- The completion report can serve as the input to a future "epic health dashboard" or reporting tool; the consistent 8-section format across all epics is its durable contract
- The `closeoutStatus` value `complete` now requires both the report commit AND the retrospective to succeed — earlier values (`report-committed`) allow distinguishing "report done, retro pending" from "both done"

## Sources & References

- Related code: `.claude/skills/ce-orchestrator/SKILL.md` (Phase 0.7 steps 6–7)
- Related code: `.claude/skills/ce-orchestrator/references/sub-agent-prompts.md`
- Related code: `.claude/skills/ce-orchestrator/references/sub-agent-models.md`
- Related code: `.claude/skills/ce-orchestrator/references/tracking-file-schema.md`
- Format reference: `docs/implementation-artifacts/epic-62-completion-report-2026-04-14.md`
- Format spec: `.claude/skills/epic-orchestrator/docs/phase-3-final-report.md`
