# Tracking file schema

Persistent run state for `ce-orchestrator`. Survives context compaction, enables resume, feeds headless-mode JSON output. TodoWrite is presentation; this file is source of truth.

## Location

`.context/compound-engineering/ce-runs/{slug}-{YYYY-MM-DD}.md`

- `slug`: derived from plan filename (or idea hash if no plan yet) — e.g., `keyboard-help`, `search-refactor`, `e92-s03-sync`.
- `YYYY-MM-DD`: run start date (NOT current date — lets mid-run invocations find the same file).
- Path is gitignored by default (session-scoped). Add to `.gitignore` if not already: `.context/compound-engineering/ce-runs/`.

## File format

Markdown with YAML frontmatter.

```markdown
---
schemaVersion: 1
slug: keyboard-help
runId: 20260418-a1b2c3
startedAt: 2026-04-18T14:32:00Z
updatedAt: 2026-04-18T14:48:15Z
status: plan-approved          # see §Status values below
stage: phase-2.1               # current phase.subphase
input:
  raw: "add keyboard shortcut help modal"
  shape: brainstorm            # classifier's stage decision
  confidence: high
flags:
  crossModel: false
  autopilot: false             # v3
  headless: false
artifacts:
  ideation: null
  brainstorm: docs/brainstorms/2026-04-18-keyboard-help-requirements.md
  plan: docs/plans/2026-04-18-001-feat-keyboard-help-plan.md
  bmadStoryId: null            # set if input was story-file path
  reviewRunId: null            # set at Phase 2.3 R1
  prUrl: null                  # set at Phase 2.5
  demoUrl: null                # set at Phase 2.4 if captured
  solutionPath: null           # set at Phase 3.1 if Run-now chosen
review:
  rounds: 0
  lastGreenSha: a1b2c3d4        # captured at Phase 0.2
  escalated: false
  residualLowNit: 0
compound:
  status: null                 # null | deferred | run-pre-merge | skipped
stagesCompleted:
  - phase-0
  - phase-1.1
  - phase-1.2
  - phase-1.3
errors: []                     # append-only list of {stage, time, message}
---

# Run: keyboard-help (2026-04-18)

## Phase 0 — Classified
- Input shape: `brainstorm` (confidence: high)
- Last-green SHA captured: `a1b2c3d4`

## Phase 1.1 — Brainstorm
- Dispatched 14:32:10, returned 14:34:02
- Requirements: `docs/brainstorms/2026-04-18-keyboard-help-requirements.md`

## Phase 1.2 — Plan
- Dispatched 14:34:05, returned 14:40:55
- Plan: `docs/plans/2026-04-18-001-feat-keyboard-help-plan.md`
- Confidence score: 92

## Phase 1.3 — Plan approval
- User picked: Approve (R0 — no refinement rounds)

## Phase 2.1 — Work
- In progress...
```

## Status values

Progression is one-way for successful runs: `active → plan-approved → review-green → pr-created → done`. Terminal states (`aborted`, `review-escalated`, `reverted`, `halted-at-<stage>`) stop the pipeline without reaching `done`.

| Status | Meaning | Recoverable? |
|---|---|---|
| `active` | Run is in progress, no gate reached yet | Yes — resume from `stage` |
| `plan-approved` | Phase 1.3 cleared, Phase 2 in progress | Yes — resume from `stage` |
| `review-green` | Phase 2.3 exited green, Phase 2.4/2.5 pending | Yes |
| `pr-created` | Phase 2.5 returned successfully | Yes (resume goes to Phase 3) |
| `done` | Phase 3 complete, clean exit | No — closed run |
| `aborted` | User picked Abort at plan gate | No — start fresh |
| `review-escalated` | R3 escalation, user picked Halt | Yes — manual fixes then resume |
| `reverted` | R3 escalation, user picked Revert to last-green | No — start fresh, tree was reset |
| `pr-created-escalated` | R3 escalation, user picked Escalate-to-PR with banner | Terminal like `pr-created` |
| `halted-at-<stage>` | Sub-agent error at named stage | Investigate, then resume or abort |

## Lifecycle

### 0. Create (Phase 0.1)

Coordinator computes slug (from plan filename if plan-path input, else a short hash of idea text). Checks if `{slug}-{today}.md` already exists. If yes, enter Resume flow. Else, write fresh file with `status: active`, `stage: phase-0`, `startedAt: <ISO now>`.

### 1. Update (every phase boundary)

After each sub-agent returns with a successful result, coordinator:
1. Reads current frontmatter.
2. Updates `stage`, `updatedAt`, relevant `artifacts.*` field, appends to `stagesCompleted`.
3. Writes back. Must be atomic-enough for single-process use (no flock needed; coordinator is the only writer).

Per-stage body sections are appended with short `## Phase N.N — <name>` blocks. Keep entries lean — they're status, not reports.

### 2. Finalize (Phase 3.3)

Coordinator calls `scripts/finalize-ce-run.sh <tracking-path>`. Script:
1. Reads frontmatter.
2. Sets `status: done` (or terminal state).
3. Writes summary section with final counts.
4. Emits JSON to stdout if `--json` flag (headless mode uses this).

### 3. Archive (manual)

User decides whether to commit tracking files to git or leave them gitignored. Recommend gitignore — they're session artifacts, not durable knowledge. `/ce:compound` is where durable lessons go.

## Resume semantics

On invocation, if `{slug}-{today}.md` exists with non-terminal `status`:

1. AskUserQuestion (unless `--headless`):
   - `Resume from <stage>` (Recommended if `status in {active, plan-approved, review-green, pr-created, review-escalated}`)
   - `Start fresh (archive this run as <slug>-{today}.abandoned.md)`
   - `Abort`

2. **Resume:** Read all state, reconstruct TodoWrite from `stagesCompleted`, jump to `stage`. Skip any sub-agent dispatches whose output artifacts already exist and match tracking file (e.g., if `artifacts.plan` exists, skip Phase 1.2).

3. **Start fresh:** Rename existing file to `<slug>-{today}.abandoned.md`, create new with current timestamp.

### Resume edge cases

| Scenario | Behavior |
|---|---|
| Tracking file exists but `status: done` | Treat as "start fresh" automatically — the run was already closed. |
| Tracking file exists with `status: reverted` | Start fresh — tree was reset, no state worth preserving. |
| Artifact path in tracking but file missing on disk | Log warning, re-dispatch that stage's sub-agent. Don't fail. |
| Multiple runs same day, same slug | Tracking filename collides; append `-2`, `-3` suffix or use timestamp: `{slug}-{YYYY-MM-DD-HHMM}.md`. v2 uses simple day-granularity; v3 may switch to timestamp. |
| Schema version mismatch | Surface to user: `Tracking file uses schemaVersion X, current is 1. Migrate manually or start fresh.` Halt. |

## Interaction with TodoWrite

- **TodoWrite is the UI** — fast, visual, in-context.
- **Tracking file is the truth** — durable, resumable, headless-readable.

When coordinator updates one, it updates the other. If they diverge (e.g., after context compaction drops TodoWrite), tracking file wins on the next invocation.

## Fields not in v2

These land in v3:
- `supportingSkills: {checkpointPaths: [], techDebtScan: {...}, episodicMemoryMatches: [...]}`
- `designReviewRunId` (from parallel `/design-review` dispatch)
- `autopilotChoicesMade: [{choice, value}]` (audit trail for `--autopilot`)
