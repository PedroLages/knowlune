# Epic Orchestrator — Coordinator Playbook

## Context

Execute an entire epic end-to-end — from `/start-story` through implementation, review (fix ALL issues at every severity), `/finish-story`, post-epic commands, and a final comprehensive report. The coordinator orchestrates everything via sub-agents while minimizing its own token usage.

**Epic is chosen at runtime** — the coordinator asks the user which epic to execute when the plan starts.

---

## Coordinator Principles

### Token Efficiency Rules
The coordinator session has context window limits. These rules keep it lean:

1. **Never read source code files** — sub-agents read and implement
2. **Never read full review reports** — sub-agents summarize findings
3. **Track only**: story ID, status, PR URL, issue counts, round number
4. **TodoWrite is the state machine** — all progress tracked there, not in-context
5. **Template prompts** — fill variables into structured prompts, don't compose from scratch
6. **Sub-agent results** — parse the summary, don't re-analyze

### Quality Standard
**ALL issues must be fixed** — BLOCKER, HIGH, MEDIUM, LOW, NITS. No exceptions. The review loop continues until `/review-story` returns zero findings. High performance. Everything perfect.

---

## Phase 0: Epic Selection

```
1. Coordinator asks user: "Which epic do you want to run?" (AskUserQuestion)
2. Read epics.md to extract story list for the chosen epic
3. Read sprint-status.yaml to check current status of each story
4. Create master TodoWrite with all stories + post-epic tasks
5. Kill any dev server: lsof -ti:5173 | xargs kill 2>/dev/null
```

---

## Phase 1: Story Pipeline (Sequential, per story)

For each story in the epic, run these steps in order. Each step uses a **fresh sub-agent**.

### Step 1: Start + Implement (Story Agent)

Spawn **one general-purpose sub-agent** that handles the full start-to-implement cycle:

```
Sub-Agent Prompt Template:
─────────────────────────
You are implementing story {STORY_ID} for Knowlune.

Run `/start-story {STORY_ID}` which will:
- Create branch, story file, research context
- Generate implementation plan
- Enter plan mode

After the plan is ready, implement it fully:
- Write all code, components, tests
- Follow all project conventions (design tokens, accessibility, etc.)
- Commit with descriptive messages
- Ensure build passes before finishing

When done, return a brief summary:
- What was built (2-3 sentences)
- Files created/modified (list)
- Any concerns or decisions made
─────────────────────────
```

**Coordinator action after**: Update TodoWrite, note summary.

### Step 2: Review Loop (Fix ALL Issues)

Each review round uses a **new sub-agent**. Loop until zero issues.

#### Round N — Review Agent

```
Sub-Agent Prompt Template:
─────────────────────────
Run `/review-story {STORY_ID}` on the current branch.

This will run:
- Pre-checks (build, lint, type-check, format, unit tests, E2E tests)
- Design review agent (Playwright MCP)
- Code review agent (architecture, security)
- Code review testing agent (AC coverage)

After review completes, return a structured summary:
- Verdict: PASS or ISSUES FOUND
- Total issue count by severity: BLOCKER=#, HIGH=#, MEDIUM=#, LOW=#, NITS=#
- For each issue: one-line description with file:line
- Review report file paths

IMPORTANT: Return ALL issues, every severity. Nothing is acceptable to leave unfixed.
─────────────────────────
```

#### If Issues Found — Fix Agent

```
Sub-Agent Prompt Template:
─────────────────────────
You are fixing ALL review issues for story {STORY_ID}. Fix EVERY issue below — no exceptions.

Issues to fix:
{PASTE_FINDINGS_LIST_FROM_REVIEW_AGENT}

For each issue:
1. Read the file at the specified location
2. Understand the problem
3. Implement the correct fix
4. Verify the fix doesn't break anything

After fixing all issues:
- Run `npm run build` to verify build passes
- Run `npm run lint` to verify lint passes
- Commit all fixes: `fix({STORY_ID}): address review findings — {summary}`

Return:
- Number of issues fixed
- Any issues you could NOT fix (with explanation)
─────────────────────────
```

**Coordinator action after fix**: Spawn a NEW review agent (Round N+1). Compare issue counts between rounds:
- Issues decreasing → progress, continue
- Issues increasing → fixes introduced new problems, continue (agent will address)
- Same issues persisting after 3 rounds → coordinator intervenes or parks story

#### When Clean (Zero Issues) — Proceed to Step 3

### Step 3: Finish + PR (Finish Agent)

```
Sub-Agent Prompt Template:
─────────────────────────
Run `/finish-story {STORY_ID}`.

This will:
- Validate all review gates passed
- Update story file (status: done)
- Update sprint-status.yaml
- Commit, push, create PR

For the AskUserQuestion prompts:
- PR merge status: answer "Done — I'll cleanup manually later"
- Lessons learned: answer "Claude, write them"

Return:
- PR URL
- PR title
- Branch name
─────────────────────────
```

### Step 4: Merge + Sync (Coordinator directly)

```
1. gh pr merge {PR_URL} --squash --delete-branch    (no CI wait)
2. git checkout main && git pull
3. Update TodoWrite: mark story as complete
4. Note PR URL for final report
```

### Step 5: Prepare Next Story (Coordinator directly)

```
1. lsof -ti:5173 | xargs kill 2>/dev/null           (kill dev server)
2. Proceed to next story in the epic
```

---

## Phase 2: Post-Epic Commands (after all stories shipped)

Run these in order. Each in a **fresh sub-agent**.

### 2a. Sprint Status Check

```
Sub-Agent: Run `/sprint-status`
- Verify all stories in the epic are `done`
- Surface any orphaned or in-progress stories
- Return: status summary, any risks found
```

### 2b. Mark Epic Done (Coordinator directly)

```
Update sprint-status.yaml: set epic status to `done`
Commit: `chore: mark epic {N} as done`
```

### 2c. Testarch Trace

```
Sub-Agent: Run `/testarch-trace`
- Generate requirements-to-tests traceability matrix
- Return: coverage percentage, gaps found, gate decision (PASS/CONCERNS/FAIL)
```

### 2d. Testarch NFR

```
Sub-Agent: Run `/testarch-nfr`
- Assess non-functional requirements (performance, security, reliability)
- Return: NFR assessment summary, gate decision
```

### 2e. Adversarial Review

```
Sub-Agent: Run `/review-adversarial`
- Cynical critique of epic scope and implementation
- Return: findings list (≥10 items), critical issues
```

### 2f. Retrospective

```
Sub-Agent: Run `/retrospective`

IMPORTANT: You are acting as Pedro (the developer/user) in the party mode dialogue.
Before answering any question in the retrospective:
1. Think deeply and analytically about the question
2. Consider if your answer is the best possible answer
3. Draw from the actual implementation experience of this epic
4. Be thoughtful, honest, and constructive

Return: retrospective document path, key lessons learned, action items
```

---

## Phase 3: Final Report (Report Agent)

After everything is complete, spawn a **report agent** that creates a comprehensive report.

```
Sub-Agent Prompt Template:
─────────────────────────
Create a comprehensive epic completion report for Epic {N}: {EPIC_NAME}.

Gather information from:
- All story files in docs/implementation-artifacts/
- All review reports in docs/reviews/design/ and docs/reviews/code/
- Sprint status in docs/implementation-artifacts/sprint-status.yaml
- Git log for all story branches
- Post-epic command outputs (testarch-trace, testarch-nfr, adversarial review, retrospective)

Report structure:
1. Executive Summary (epic goal, outcome, duration)
2. Stories Delivered (table: story ID, name, PR URL, review rounds, issues fixed)
3. Review Metrics (total issues found/fixed by severity across all stories)
4. Post-Epic Validation Results (trace, NFR, adversarial findings)
5. Lessons Learned (from retrospective)
6. Final Build Verification (npm run build on main)

Save report to: docs/implementation-artifacts/epic-{N}-completion-report-{DATE}.md

Return: report file path
─────────────────────────
```

**Coordinator action**: Read report path, display to user. Commit report file.

---

## Coordinator State Machine

The coordinator tracks state via **TodoWrite** only. Example:

```
Phase 0:
[ ] Ask user which epic to run
[ ] Extract story list from epics.md
[ ] Create story pipeline todos

Phase 1 — Story Pipeline:
[ ] E##-S01: Start + Implement
[ ] E##-S01: Review Loop (Round 1)
[ ] E##-S01: Finish + PR
[ ] E##-S01: Merge + Sync
[ ] E##-S02: Start + Implement
[ ] E##-S02: Review Loop (Round 1)
...

Phase 2 — Post-Epic:
[ ] Sprint status check
[ ] Mark epic done
[ ] Testarch trace
[ ] Testarch NFR
[ ] Adversarial review
[ ] Retrospective

Phase 3:
[ ] Final report
[ ] Display summary to user
```

**Dynamic updates**: If a review loop needs Round 2 or 3, coordinator adds new todo items on the fly. This keeps the TodoWrite as the single source of truth.

---

## Coordinator Data Tracking (Minimal In-Context)

The coordinator keeps a small running table in its context for the final report handoff:

```
| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
| E##-S01 | done | #URL | 2 | 7 |
| E##-S02 | done | #URL | 1 | 0 |
...
```

This is the ONLY state kept in-context. Everything else is in TodoWrite or sub-agent output.

---

## Error Handling

| Scenario | Coordinator Action |
|----------|-------------------|
| Story implementation fails | Sub-agent retries. If still fails, coordinator parks story, logs reason, continues |
| Pre-checks fail in review | Review agent auto-fixes and retries within its session |
| Review finds issues (any severity) | Spawn fix agent → spawn new review agent (loop) |
| Fixes introduce new issues | Normal — next review round catches them, fix agent addresses |
| Issues persist after 3 review rounds | Coordinator spawns a 4th round with explicit instructions. If still failing, parks story |
| Merge conflict after PR merge | Coordinator merges main into next branch, resolves or spawns conflict agent |
| Dev server won't start | Kill port 5173, retry. If still fails, review runs without design review |
| Sub-agent runs out of context | Coordinator spawns continuation agent with summary of what was done so far |

---

## Agent Types Summary

| Agent | Purpose | Spawned When | Returns |
|-------|---------|-------------|---------|
| **Story Agent** | `/start-story` + implement | Once per story | Summary, files changed |
| **Review Agent** | `/review-story` | Each review round (new agent) | Verdict, issue list by severity |
| **Fix Agent** | Fix all review findings | When review finds issues | Fix count, unfixed items |
| **Finish Agent** | `/finish-story` + PR | Once per story (after clean review) | PR URL, branch name |
| **Sprint Status Agent** | `/sprint-status` | Post-epic | Status summary |
| **Trace Agent** | `/testarch-trace` | Post-epic | Coverage matrix, gate decision |
| **NFR Agent** | `/testarch-nfr` | Post-epic | NFR assessment |
| **Adversarial Agent** | `/review-adversarial` | Post-epic | Findings list |
| **Retro Agent** | `/retrospective` (acts as Pedro) | Post-epic | Retro doc, lessons, actions |
| **Report Agent** | Compile final report | After everything | Report file path |

---

## Verification

After full execution:
1. All stories in epic are `done` in sprint-status.yaml
2. Epic status is `done`
3. All PRs merged to main
4. `npm run build` passes on main
5. Post-epic reports generated (trace, NFR, adversarial, retrospective)
6. Final completion report saved to `docs/implementation-artifacts/`
7. Zero unfixed issues across all stories
