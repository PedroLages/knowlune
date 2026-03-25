# Story Development Workflow

**This file is always loaded (universal rule - no path restrictions).**

Per-story development loop with integrated quality gates. Three slash commands orchestrate the full cycle from branch creation to PR.

## Commands

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `/start-story E##-S##`  | Create branch, story file, optional ATDD tests, enter plan mode  |
| `/review-story E##-S##` | Run all quality gates: build, lint, tests, design review, code review |
| `/finish-story E##-S##` | Validate, create PR. Auto-runs reviews if not already done       |
| `/design-review`        | Standalone design review via Playwright MCP (also used by `/review-story`) |

## Workflow Modes

**Streamlined** (2 commands):

```text
/start-story E##-S##  →  implement  →  /finish-story
                                       (auto-runs reviews)
```

**Comprehensive** (3 commands):

```text
/start-story E##-S##  →  implement  →  /review-story  →  fix  →  /finish-story
                                       (dedicated)        loop    (lightweight)
```

## Git Working Tree Requirements

Story workflow skills require clean working tree to ensure reviews analyze committed code:

**Why commits are required:**
- Code review agents analyze `git diff` (committed changes)
- Uncommitted changes are not reviewed
- Reviews would pass but analyze nothing

**If blocked by uncommitted changes:**
```bash
# Option 1: Commit your work
git add -A
git commit -m "feat(E##-S##): descriptive message"

# Option 2: Stash your work (not recommended)
git stash push -u -m "WIP before E##-S##"
```

## Quality Gates

`/review-story` runs these gates in sequence:

1. **Pre-checks** (fast validation):
   - Build (`npm run build`)
   - Lint (`npm run lint` with auto-fix)
   - Type check (`npx tsc --noEmit` with auto-fix)
   - Format check (`npx prettier --check` with auto-fix)
   - Unit tests (`npm run test:unit`)
   - E2E tests (Chromium only: smoke specs + current story spec)

2. **Lessons learned gate**: Blocks if placeholder text remains

3. **Review agent swarm** (parallel dispatch):
   - Design review agent (Playwright MCP - UI/UX/accessibility)
   - Code review agent (architecture, security, silent failures)
   - Test coverage agent (AC mapping, edge cases, test quality)

## Burn-In Testing (Optional)

Auto-suggested if test anti-patterns detected (Date.now(), waitForTimeout(), manual IDB seeding).
Runs 10 iterations to validate stability. Blocks review if flakiness detected.

## Branch Naming

Format: `feature/e##-s##-slug` (lowercase, hyphens, no filler words)

**Example:** `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

## After Epic Completion

When all stories in an epic are done, run in order:

1. `/sprint-status` — Verify epic is fully complete, surface any orphaned or in-progress stories *(pre-gate)*
2. `/testarch-trace` — Requirements-to-tests traceability matrix
3. `/testarch-nfr` — Non-functional requirements validation
4. `/review-adversarial` — Optional: cynical critique of the epic's scope and implementation *(skip if low-risk epic)*
5. `/retrospective` — Lessons learned and pattern extraction
6. **Known issues triage** — Review `docs/known-issues.yaml` for `open` items discovered during this epic. For each: schedule for a future epic, mark `wont-fix`, or fix now as a chore commit.

## Key Files

| File                                              | Purpose                                      |
| ------------------------------------------------- | -------------------------------------------- |
| `.claude/skills/start-story/SKILL.md`             | Story setup orchestrator                     |
| `.claude/skills/review-story/SKILL.md`            | Quality gate hub                             |
| `.claude/skills/finish-story/SKILL.md`            | Adaptive shipping skill                      |
| `.claude/agents/code-review.md`                   | Adversarial code reviewer (Opus, with memory) |
| `.claude/agents/design-review.md`                 | Playwright MCP design reviewer               |
| `docs/implementation-artifacts/story-template.md` | Story file template                          |
| `docs/implementation-artifacts/sprint-status.yaml` | Sprint tracking                             |
| `docs/reviews/design/`                            | Design review reports                        |
| `docs/reviews/code/`                              | Code review reports                          |
