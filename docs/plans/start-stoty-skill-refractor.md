You are acting as a senior workflow refactoring engineer inside the Knowlune repo.

Your task is to IMPLEMENT the agreed workflow changes across the story lifecycle so that:

1. BMAD keeps using durable lifecycle state in `docs/implementation-artifacts/sprint-status.yaml`
2. detailed review/runtime state stays in story frontmatter + review artifacts + `.claude/state/...`
3. `start-story`, `review-story`, and `finish-story` align with this lifecycle:

- `backlog` — story only exists in epic file
- `ready-for-dev` — story file created in stories folder, setup/planning complete
- `in-progress` — developer actively working on implementation
- `review` — ready for code review / currently in review
- `done` — PR merged and story completed

`review-story` has already been refactored and is now the anchor contract.
Do not redesign it from scratch.
Instead:
- verify its current contract
- fix small mismatches if required
- update `start-story`, `finish-story`, and BMAD YAML/config to align with it

You must make the necessary code and doc changes directly in the repo.

---

## Critical workflow contract

### BMAD durable lifecycle source of truth
BMAD should depend on:
- `docs/implementation-artifacts/sprint-status.yaml`

BMAD must NOT depend on:
- `.claude/state/review-story/...`
- other runtime cache/state paths that may be regenerated or lost

### Review/shipping detail state
Detailed review state should remain in:
- story frontmatter fields such as:
  - `reviewed`
  - `review_started`
  - `review_gates_passed`
  - `burn_in_validated`
- durable review artifacts in `docs/reviews/...`
- runtime/cache state in `.claude/state/review-story/...`

### Lifecycle mapping to implement
- `/start-story` should move a story to `ready-for-dev`, not `in-progress`
- actual implementation work should correspond to `in-progress`
- `/review-story` should move a story to `review`
- `/finish-story` should move a story to `done` ONLY after PR merge succeeds
- if PR is created but not merged, sprint status must remain `review`

---

## Current repo facts you must respect

### New `review-story` contract
The new `review-story` already uses:
- `config/gates.json` as single source of truth for gates
- structured agent output schema
- runtime review-run state schema
- checkpoint save/restore
- bundle-based agent dispatch
- consolidated reporting and gate validation scripts

You must inspect and preserve that architecture.

### Required gates
The required gate contract currently includes 12 required gates:
- `build`
- `lint`
- `type-check`
- `format-check`
- `unit-tests`
- `e2e-tests`
- `design-review`
- `code-review`
- `code-review-testing`
- `performance-benchmark`
- `security-review`
- `exploratory-qa`

Do not introduce a second gate contract elsewhere.

### Current lifecycle mismatches to fix
From the existing skills:
- `start-story` currently treats `in-progress` as the setup completion state and writes `status: in-progress` too early
- `finish-story` currently sets story/frontmatter status and sprint status to `done` before merge
- `finish-story` also supports “keep working” / “skip merge”, so `done` before merge is wrong
- review/runtime details must not leak into BMAD’s lifecycle contract

### Review-story caution
Verify whether the new `review-story` restore path conflates runtime state `status` with story frontmatter `reviewed`.
If there is a mismatch, fix it safely and minimally.

---

## Primary implementation goals

### Goal 1 — Update BMAD workflow config/YAML
Find the BMAD YAML/config that models story lifecycle and update it to the 5-state lifecycle:

- `backlog`
- `ready-for-dev`
- `in-progress`
- `review`
- `done`

Update any comments, descriptions, transitions, and validation rules to match.

Do not point BMAD to `.claude/state`.

### Goal 2 — Refactor `start-story` lifecycle behavior
Update `start-story` so that:

- creation/setup/planning completion maps to `ready-for-dev`
- it no longer treats setup completion as `in-progress`
- resumed logic supports `ready-for-dev` as a valid state
- stale-state/status validation logic treats `ready-for-dev` as first-class, not as an unexpected warning-only case
- completion output reflects `ready-for-dev`
- any story frontmatter `status:` written during setup is aligned with this change
- idempotency remains intact

Be careful not to break:
- worktree behavior
- checkpoint behavior
- ATDD/design guidance suggestions
- current branch/file idempotency

### Goal 3 — Update `review-story` only where necessary
Do NOT do a big rewrite.

Only make targeted changes needed to align with the lifecycle contract, such as:
- setting sprint-status to `review` when review begins
- preserving `review` through retries / blocker-fix loops
- ensuring required gate usage stays tied to `gates.json`
- fixing any runtime-state vs frontmatter mismatches if present
- avoiding any BMAD dependency on `.claude/state`

### Goal 4 — Refactor `finish-story` lifecycle behavior
Update `finish-story` so that:

- it consumes the new `review-story` contract cleanly
- it validates required gates using the canonical review contract
- it does NOT mark story frontmatter `status: done` before merge
- it does NOT mark sprint-status `done` before merge
- when inline reviews run, sprint status becomes `review`
- if PR is created but not merged, sprint status remains `review`
- only after successful merge:
  - sprint status becomes `done`
  - story frontmatter `status: done`
  - completion timestamp is written
- cleanup behavior remains intact
- rerun/recovery behavior remains intact

### Goal 5 — Keep the separation of concerns clean
End state should be:

#### BMAD owns:
- durable lifecycle state in sprint-status

#### Story frontmatter owns:
- review/shipping metadata

#### Review system owns:
- gate config
- structured outputs
- consolidated findings
- runtime review cache/state

---

## Files to inspect and update

You must inspect the real repo before changing anything, especially:

### Story skills
- `.claude/skills/start-story/`
- `.claude/skills/review-story/`
- `.claude/skills/finish-story/`

### Review-story contract files
- `.claude/skills/review-story/config/gates.json`
- `.claude/skills/review-story/schemas/agent-output.schema.json`
- `.claude/skills/review-story/schemas/review-run.schema.json`
- related module docs and scripts

### Start-story supporting docs
- worktree detection docs
- status validation docs
- recovery docs
- design guidance docs
- any related templates or helper scripts

### Finish-story supporting docs
- streamlined mode docs
- comprehensive mode docs
- PR creation docs
- worktree cleanup docs
- recovery docs

### BMAD files
Find the BMAD YAML/config files that define or consume story status lifecycle and update them.

### Shared workflow artifacts
- `docs/implementation-artifacts/sprint-status.yaml`
- story templates
- story frontmatter conventions
- `docs/reviews/...`

---

## Implementation rules

### 1. Use TodoWrite
At the start, create a TodoWrite plan with concrete execution steps and keep it updated as you work.

### 2. Make the smallest correct change set
Do not redesign everything.
Preserve the new `review-story` architecture and adapt the surrounding workflow.

### 3. Keep contracts explicit
If a field means BMAD lifecycle status, keep it in sprint-status.
If a field means review progress, keep it out of BMAD lifecycle state.

### 4. Preserve idempotency and resumability
Do not break:
- rerunning `start-story`
- rerunning `review-story`
- rerunning `finish-story`
- interrupted review recovery
- post-PR reruns when merge has not happened yet

### 5. Keep worktree behavior correct
Any lifecycle changes must still work whether the story is in the main workspace or a worktree.

### 6. Update docs along with behavior
When behavior changes, update the relevant skill docs, helper docs, and comments so they match reality.

### 7. Prefer canonical references over duplicated rule lists
If a file currently hardcodes a stale rule/gate list, either:
- update it to match the canonical source, or
- replace the duplicated list with a reference to the canonical source

---

## Specific changes you should strongly expect to make

### In `start-story`
Likely changes include:
- story frontmatter default status
- sprint-status transition target
- completion output table/status text
- recovery docs
- status validation logic
- any references that assume setup ends at `in-progress`

### In `review-story`
Likely changes include:
- sprint-status transition to `review`
- possible fix for runtime state `status` vs frontmatter `reviewed`
- any stale docs that still describe the old shorter gate set
- any handoff docs for `/finish-story`

### In `finish-story`
Likely changes include:
- timing of `done` updates
- merge-dependent story/sprint state transitions
- consumption of canonical gate contract
- streamlined/comprehensive mode docs
- recovery docs
- completion output / merge logic / rerun behavior

### In BMAD config/YAML
Likely changes include:
- lifecycle states
- transition semantics
- any validation or downstream assumptions tied to old statuses

---

## Validation you must perform

After making changes, verify all of the following:

### A. Contract checks
- `review-story` still uses `gates.json` as the canonical gate contract
- `finish-story` expects the same required gates
- BMAD does not depend on `.claude/state`

### B. Lifecycle checks
- `/start-story` results in `ready-for-dev`
- developer implementation lifecycle corresponds to `in-progress`
- `/review-story` moves story to `review`
- `/finish-story` keeps story in `review` until merge
- `/finish-story` sets `done` only after merge succeeds

### C. Recovery / rerun checks
- interrupted start still resumes safely
- interrupted review still resumes safely
- interrupted finish still resumes safely
- “keep working” / “skip merge” leaves lifecycle in the correct state

### D. Documentation checks
- skill docs match actual behavior
- no obvious stale references to old lifecycle semantics
- no stale 9-gate docs if the canonical contract is 12 required gates

### E. If tests/scripts exist
Run the relevant validation scripts or add/update small tests where needed.

---

## Deliverable at the end

After implementing, give me a concise summary with:

1. files changed
2. lifecycle changes made
3. BMAD/YAML changes made
4. any review-story contract fixes made
5. any remaining risks or follow-up items

Do not stop at a plan.
Inspect the repo, implement the changes, validate them, and then summarize the result.
