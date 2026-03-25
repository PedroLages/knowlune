# Orchestrator Principles

**Shared reference for all story workflow skills** (`/start-story`, `/review-story`, `/finish-story`)

## What the Orchestrator Should Do

The orchestrator (main session) is responsible for:

- **Read state**: story file, sprint status, git status
- **Make decisions**: resumed? reviewed? UI changes?
- **Dispatch agents**: via Task tool (parallel when independent)
- **Collect results**: extract key data from agent returns
- **Update state**: frontmatter, sprint status, TodoWrite
- **Run git ops**: branch, commit, push, PR
- **Communicate**: completion output, AskUserQuestion

## What the Orchestrator Should NOT Do

The orchestrator should avoid:

- Deep code analysis (delegate to agents)
- Retaining raw build/lint/test output beyond error messages
- Reading large files for exploration (dispatch Explore agents instead)
- Performing review reasoning (agents handle this)

## Key Principles

### 1. Lightweight Orchestration
The orchestrator coordinates work but doesn't do heavy lifting. Complex analysis should be delegated to specialized agents.

### 2. Parallel Dispatch
When multiple agents can work independently, dispatch them in a **single message** for maximum parallelism:

```
Task({ subagent_type: "design-review", ... })
Task({ subagent_type: "code-review", ... })
Task({ subagent_type: "code-review-testing", ... })
```

### 3. State Management
Maintain story state (frontmatter fields) and sprint status consistently:
- `status: backlog | in-progress | done`
- `reviewed: false | in-progress | true`
- `review_gates_passed: []` (canonical gate names only)
- `burn_in_validated: false | true`

### 4. Idempotency
Design all operations to be safely re-runnable:
- Check before creating (branches, files, commits)
- Resume from interruption points
- Preserve completed work (gates, reports)

### 5. Clear Communication
Provide actionable feedback:
- Show what was done, what's next
- Include file paths and commands
- Explain blockers with fix instructions
- Use TodoWrite to show progress visibility

### 6. Noise Reduction
Sub-agents generate heavy tool call output that floods the conversation. Reduce noise by:
- **Always use `run_in_background: true`** when dispatching sub-agents via the Agent tool
- **Output a status banner** before and after each agent dispatch (see epic-orchestrator Output Discipline)
- **Print the progress dashboard** after each story/step status change
- **Never run high-output commands directly** (git diff, npm run build, lint) — delegate these to sub-agents where the verbose output stays isolated
- **Extract only structured data** from agent returns (counts, verdicts, paths) — never retain raw output
