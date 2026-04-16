---
name: start-story
description: Use when beginning work on a Knowlune story, when user says "start story E##-S##", or when picking the next story from sprint-status.yaml. Creates branch, story file, suggests ATDD tests, gathers context, enters plan mode.
argument-hint: "[E##-S##]"
disable-model-invocation: true
---

# Start Story

Automates story setup: feature branch, sprint tracking, ATDD test suggestion, contextual research, and plan mode entry.

## Usage

```
/start-story E01-S03
/start-story          # picks next backlog story
```

## Orchestrator Discipline

The orchestrator (main session) should:
- **Read state**: story file, sprint status, git status
- **Make decisions**: resumed? reviewed? UI changes?
- **Dispatch agents**: via Task tool (parallel when independent)
- **Collect results**: extract key data from agent returns
- **Update state**: frontmatter, sprint status, TodoWrite
- **Run git ops**: branch, commit, push, PR
- **Communicate**: completion output, AskUserQuestion

The orchestrator should NOT:
- Do deep code analysis (delegate to agents)
- Retain raw file contents beyond what's needed for decisions
- Read large files for exploration (dispatch Explore agents instead)

## Steps

When invoked with a story ID (e.g., `E01-S03`):

**Immediately create TodoWrite** to give the user full visibility of what will happen:

```
[ ] Look up story and validate sprint status
[ ] Set up branch and story file
[ ] Environment pre-flight check
[ ] Carried debt reminder
[ ] Suggest ATDD tests
[ ] Suggest design guidance
[ ] Research: story context (Agent)
[ ] Research: code patterns (Agent)
[ ] Research: test + UX patterns (Agent)
[ ] Complexity estimate
[ ] Web research (if external deps detected)
[ ] Enter plan mode
[ ] Link plan, commit, and output
```

Mark the first todo as `in_progress` and proceed:

0. **Git worktree setup** (optional): Offer the user a choice to create an isolated git worktree for this story.

   **Ask the user via AskUserQuestion**:
   ```
   Would you like to create a git worktree for this story?

   ✅ Recommended for:
   - Multi-day stories
   - Features requiring testing in parallel
   - When you want to keep main workspace stable

   ❌ Skip for:
   - Quick hotfixes (1-2 hours)
   - Simple documentation updates
   - Experiments or spike work
   ```

   **If user selects YES**:
   - Extract story key from `$ARGUMENTS` (e.g., `E01-S04`)
   - Extract story name from epic lookup (slugified, lowercase)
   - Invoke the superpowers worktree skill:
     ```
     Skill tool: skill="superpowers:using-git-worktrees", args="E##-S## story-title"
     ```
   - The superpowers skill will:
     - Create worktree with proper isolation
     - Set up branch: `feature/${STORY_KEY_LOWER}-${STORY_SLUG}`
     - Provide directory path and cleanup instructions
   - After skill completes, change working directory to the worktree path (provided in skill output)
   - **Important**: All subsequent steps (1-14) will execute in the worktree directory

   **If user selects NO**:
   - Continue in main workspace (current directory)
   - Proceed to Step 1

1. **Look up story** in `docs/planning-artifacts/epics.md`. Extract name, description, acceptance criteria, dependencies, technical notes. If `$ARGUMENTS` is empty, read `docs/implementation-artifacts/sprint-status.yaml` and find the first `backlog` story, then confirm with the user via AskUserQuestion.

2. **Check status** in `docs/implementation-artifacts/sprint-status.yaml`. Warn if not `backlog`, `ready-for-dev`, or `in-progress`.
   - **ID normalization**: `E01-S03` → strip leading zeros → key `1-3-organize-courses-by-topic`.
   - If status is already `in-progress` or `ready-for-dev`: this is a **resumed start**. Inform the user and skip to the resumption check in step 3.

   **TodoWrite**: Mark "Look up story and validate sprint status" → `completed`.

3. **Derive branch name**: `feature/` + lowercase story ID + slugified name. Strip `& ( ) , .` and filler words (and, the, a, with, for, of). Lowercase. Hyphens between words.
   - Example: `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

4. **Enforce clean working tree** (unless resuming):

   First, check if this is a resumed start:
   - If story status in sprint-status.yaml is already `ready-for-dev` or `in-progress` AND branch exists: **ALLOW** dirty tree (user is continuing work on this story)
   - Otherwise (new story): **REQUIRE** clean tree

   For new stories:
   ```bash
   git status --porcelain
   ```

   If uncommitted changes found:
   ```
   ❌ Uncommitted changes detected.

   Starting a new story requires a clean working tree to:
   - Ensure proper branch switching
   - Avoid mixing old and new work
   - Enable clean git history

   Options:
   1. Commit changes:  git add -A && git commit -m "..."
   2. Stash changes:   git stash push -u -m "WIP before E##-S##"

   Cannot proceed with dirty working tree.
   ```
   STOP — do NOT create branch or story file.

   For resumed stories (status already `ready-for-dev` or `in-progress`):
   Allow uncommitted changes — user is continuing work on this story.

5. **Create branch** (idempotent):
   - **If worktree was created in Step 0**: Skip this step entirely. The branch was already created by the superpowers worktree skill. Inform user: "Branch created by worktree setup, skipping."
   - **Otherwise**:
     - Check if branch already exists: `git branch --list feature/e##-s##-slug`.
     - **Branch exists**: Switch to it (`git checkout feature/e##-s##-slug`). Inform user: "Branch already exists, switching to it."
     - **Branch does not exist**: `git checkout main && git pull && git checkout -b feature/e##-s##-slug`. Skip pull if no remote.

6. **Create story file** (idempotent):
   - Check if `docs/implementation-artifacts/{key}.md` already exists.
   - **File exists**: Skip creation. Inform user: "Story file already exists, keeping it."
   - **File does not exist**: Create using the template at `docs/implementation-artifacts/story-template.md`. Populate frontmatter (`story_id`, `story_name`, `status: ready-for-dev`, `started: YYYY-MM-DD`, `reviewed: false`, `review_started:`, `review_gates_passed: []`) and fill in Story, Acceptance Criteria, and Tasks from the epic.

   **TodoWrite**: Mark "Set up branch and story file" → `in_progress`.

6b. **Load session checkpoint** (resumption only — skip for new stories):

   If this is a **resumed start** (status was already `ready-for-dev` or `in-progress` from Step 2):

   Check if checkpoint file exists:
   ```bash
   ls docs/implementation-artifacts/sessions/{story-id}-checkpoint.md 2>/dev/null
   ```

   **If checkpoint exists:**
   1. Read the checkpoint file
   2. Display summary to user:
      ```
      Session checkpoint found (saved {saved_at}):
      - Completed: {N}/{M} tasks
      - Key decisions: {first 2-3 bullet points from Key Decisions}
      - Last commit: {most recent line from Implementation Progress}
      - Current state: {clean / N uncommitted files}
      ```
   3. Check for staleness: compare checkpoint `saved_at` against latest commit timestamp (`git log -1 --format=%ci`). If commits exist after the checkpoint was saved, warn:
      ```
      Note: {N} commits were made after this checkpoint was saved. The checkpoint may be partially stale.
      ```
   4. **Skip Step 9 (3 parallel Explore agents)** — the checkpoint already contains implementation context. Exploration is for initial research; a resumed story already has that context.
   5. **Skip Step 9c (Web research)** — same reasoning.
   6. Proceed to Step 10 (Enter plan mode) with checkpoint content injected as additional context. The plan should reference the checkpoint's remaining tasks, key decisions, and failed approaches.

   **If no checkpoint exists** (resumed but no checkpoint saved):
   Inform user: "No session checkpoint found. Running full exploration."
   Continue to Step 7 normally (existing behavior).

7. **Update sprint status** (idempotent):
   - Check current status in `docs/implementation-artifacts/sprint-status.yaml`.
   - **Already `ready-for-dev` or `in-progress`**: Skip update. Inform user: "Sprint status already {current-status}."
   - **Not `ready-for-dev` or `in-progress`**: Set story → `ready-for-dev`. If this is the first story in the epic, set epic → `in-progress`.

   **TodoWrite**: Mark "Set up branch and story file" → `completed`.

7b. **Environment pre-flight check** (fast validation that dev environment is healthy):

   ```bash
   npm install --prefer-offline 2>&1 | tail -3
   npm run build 2>&1 | tail -5
   ```

   - If `npm install` fails: warn "Dependencies may be stale — check package.json changes" but continue (non-blocking)
   - If `npm run build` fails: STOP — "Build broken on new branch. Fix build errors before starting implementation." This catches issues inherited from main before the developer writes any code.
   - If both pass: note "Environment healthy — build passes on branch" and continue

7c. **Carried debt reminder** (shift-left from /review-story):

   Extract the epic number from the story ID (e.g., E16-S03 → epic 16). Find the most recent retrospective file matching `docs/implementation-artifacts/epic-*-retro-*.md` for the PREVIOUS epic (epic number - 1). If found, scan the "Technical Debt" or "Technical Debt Resolution" section for items marked HIGH or MEDIUM priority. If any exist, display a non-blocking reminder:

   ```
   📋 Carried Debt Reminder (from Epic {N-1} retro):
   - [HIGH] {debt item description}
   - [MEDIUM] {debt item description}
   Tip: If this story touches related files, consider addressing these items during implementation.
   ```

   This is informational only — does NOT block story setup. Its purpose is to surface debt when it can still influence the implementation plan (shift-left from /review-story's debt reminder).

   If no retro file found or no debt items: skip silently.

7d. **Known issues warning** (shift-left from /review-story):

   Read `docs/known-issues.yaml`. If the file exists and has `open` issues, get the list of files this story will likely touch (from epic tasks/subtasks or the story file). Cross-reference against the `file` field of open known issues. If any match:

   ```
   ⚠️ Known Issues in Files You May Touch:
   - [KI-NNN] [severity] file:line — summary
   - [KI-NNN] [severity] file:line — summary
   Tip: Consider fixing these during implementation. Mark as fixed_by: E##-S## in known-issues.yaml.
   ```

   If no open issues or no file overlap: skip silently.

   Mark "Suggest ATDD tests" → `in_progress`.

8. **ATDD test suggestion** (idempotent):
   - Check if `tests/e2e/story-{id}.spec.ts` already exists.
   - **File exists**: Skip ATDD suggestion. Inform user: "ATDD tests already exist."
   - **File does not exist**: Analyze the acceptance criteria content:
     - If ACs mention UI elements ("page", "button", "display", "show", "component", "render", "modal", "form", "input", "click"), suggest generating ATDD tests with reasoning: "ACs describe user-facing behavior — failing E2E tests help validate implementation."
     - If ACs are about config, refactoring, data, or infrastructure, suggest skipping with reasoning: "ACs are technical/internal — unit tests during implementation are more appropriate."
     - Present the suggestion to the user via AskUserQuestion. User makes the final decision.
     - If user accepts: Generate failing acceptance tests in `tests/e2e/story-{id}.spec.ts` using existing Playwright fixture patterns from `tests/support/`. Tests should follow RED-GREEN-REFACTOR: write minimal failing tests that map to acceptance criteria.
     - If user declines: Continue without tests.

   **TodoWrite**: Mark "Suggest ATDD tests" → `completed`. Mark "Suggest design guidance" → `in_progress`.

8b. **Design guidance suggestion** (idempotent): Follow the algorithm in `.claude/skills/start-story/docs/design-guidance.md`. Summary:
   - Skip if `## Design Guidance` section already exists in story file
   - Detect if UI story: 2+ UI keywords in ACs OR `.tsx` files in `src/app/pages/` or `src/app/components/`
   - If UI story: AskUserQuestion to offer design guidance → invoke `/frontend-design` skill → insert `## Design Guidance` after Tasks section
   - If not UI story or user skips: inform and continue

   **TodoWrite**: Mark "Suggest design guidance" → `completed`. Mark all 3 research agent todos → `in_progress` simultaneously.

9. **Launch 3 parallel Explore agents** via Task tool (dispatch all in a single message). Use `model: "sonnet"` for all three — Opus is reserved for the Plan agent in Step 10.

   **Important**: Feed each agent the specific ACs and affected file paths from Step 1, not generic search mandates. Targeted context produces 40% fewer errors and 55% faster task completion (Anthropic 2026 Agentic Coding report).

   - **Agent 1 — Story context** (`model: "sonnet"`): Read story ACs, dependencies, related stories in `docs/planning-artifacts/epics.md`. Check if dependent stories are `done` in sprint-status. **Provide**: the exact AC text and dependency list from Step 1.
   - **Agent 2 — Existing code audit + patterns** (`model: "sonnet"`): Search affected source directories (`src/app/pages/`, `src/app/components/`, `src/stores/`, `src/db/`, `src/lib/`) for relevant patterns, types, and utilities. **Provide**: the specific ACs and task descriptions so the agent searches for exact matches (e.g., "AC says 'persist quiz results' — find existing Dexie.js quiz stores"). **Important: explicitly identify pre-existing code that already implements parts of the story** — search for store actions, type definitions, and components that overlap with the story's tasks. Report what already exists vs. what needs building. (See `docs/engineering-patterns.md` § "Inventory Existing Code Before Story Planning".)
   - **Agent 3 — Test patterns + UX specs** (`model: "sonnet"`): Read test patterns from `tests/` and `tests/support/`, plus UX design specs from `docs/planning-artifacts/ux-design-specification.md` for relevant sections. **Provide**: the affected route(s) from the route map so the agent finds existing E2E tests for those specific pages.

   As each agent returns, mark its corresponding todo → `completed`. Wait for all 3 to complete before proceeding.

   **TodoWrite**: Mark all 3 research todos → `completed`.

9b. **Complexity estimate** (informational — output after exploration completes):

   Based on research from the 3 agents, output a brief complexity signal:
   ```
   Complexity estimate: [LOW / MEDIUM / HIGH]
   - {N} ACs ({breakdown: N UI, N data, N test})
   - Touches {N} existing files + {N} new
   - {Similar to E##-S## if a comparable story exists, or "No close precedent"}
   ```

   Criteria:
   - **LOW**: 1-2 ACs, 1-2 tasks, single area of codebase, existing patterns cover it
   - **MEDIUM**: 3-4 ACs, 3-4 tasks, touches 2 areas, some new patterns needed
   - **HIGH**: 5+ ACs, 5+ tasks, touches 3+ areas, new architecture or patterns required

   This is informational only — no gates. Purpose is to calibrate expectations and help the workflow recommendation in Step 13.

   **Red Flags Check**: After outputting the complexity signal, scan the story context for common risk indicators and surface any that apply:

   - Does this story touch a module with NO existing tests? → Flag: "⚠ No test coverage in [module] — consider writing tests first"
   - Does this story introduce a new npm dependency (not already in `package.json`)? → Flag: "⚠ New dependency — verify bundle impact and license"
   - Does this story cross 3+ architectural boundaries (pages, components, stores, styles, routes)? → Flag: "⚠ Wide blast radius — plan carefully, review thoroughly"
   - Does this story have 4+ ACs with unclear priority? → Flag: "⚠ Large AC count — clarify acceptance priority with user"
   - Does this story touch security-sensitive areas (auth, BYOK, API keys, localStorage)? → Flag: "⚠ Security-sensitive — security-review agent will scrutinize this"

   Output red flags as a bullet list after the complexity signal. If no flags trigger, output "No red flags detected ✓".

   **TodoWrite**: Mark "Web research (if external deps detected)" → `in_progress`.

9c. **Selective web research** (conditional): Scan ACs + tasks + agent findings for external signals (new packages, named technologies like "Supabase"/"Stripe", integration keywords like "migrate"/"upgrade", version-specific terms). If 0 signals: skip silently. If 1+ signals: AskUserQuestion offering web research.

   If user accepts: dispatch `general-purpose` agent (`model: "sonnet"`) to research technologies — latest versions, breaking changes, best practices relevant to the ACs. Insert findings as `## Web Research` section in story file after Design Guidance.

   **TodoWrite**: Mark "Web research (if external deps detected)" → `completed`. Mark "Enter plan mode" → `in_progress`.

10. **Generate implementation plan via Plan agent** (model adapts to complexity).

    The orchestrator assembles all gathered context into a structured prompt and dispatches a Plan agent. Model selection is based on the complexity estimate from Step 9b:

    | Complexity | Plan Model | Rationale |
    |------------|-----------|-----------|
    | **LOW** | `sonnet` | Straightforward stories — Sonnet produces equivalent plans at lower cost |
    | **MEDIUM** | `opus` | Multiple areas — Opus architectural reasoning helps |
    | **HIGH** | `opus` | Complex stories — Opus needed for quality trade-off analysis |

    Do NOT use `EnterPlanMode` — the plan is generated by the agent and written by the orchestrator.

    **10a. Assemble context prompt**: Combine the following into a single agent prompt:

    ```
    Agent(subagent_type: "Plan", model: "[sonnet or opus per complexity table above]"):

    "You are planning the implementation of story {STORY_ID} — {STORY_NAME} for the Knowlune project.

    ## Story
    {story overview, ACs, dependencies from Step 1}

    ## Research Findings

    ### Story Context
    {summary from Explore agent 1}

    ### Existing Code & Patterns
    {summary from Explore agent 2}

    ### Test & UX Patterns
    {summary from Explore agent 3}

    ### Design Guidance
    {from Step 8b, if generated — otherwise omit this section}

    ### Web Research
    {from Step 9c, if generated — otherwise omit this section}

    ## Complexity
    {estimate and red flags from Step 9b}

    ## Constraints
    - Follow existing patterns from docs/engineering-patterns.md
    - Use design tokens from src/styles/theme.css (never hardcoded Tailwind colors)
    - Reuse existing utilities and components identified in research
    - Plan granular commits after each small task as save points
    - shadcn/ui components in src/app/components/ui/, custom in src/app/components/figma/
    - Zustand stores in src/stores/, Dexie.js DB in src/db/

    ## Instructions
    Produce a detailed implementation plan with:
    1. **Context** section: why this change is needed, what problem it solves
    2. **Implementation steps** (ordered): specific file paths to create/modify, which existing code to reuse
    3. For each step: what to create/modify, what to reuse, estimated scope
    4. **Verification** section: how to test end-to-end (dev server, E2E tests, manual checks)
    5. **Risk assessment** (include when complexity is HIGH): top 2-3 risks, rollback plan, pattern references

    Output the plan in markdown format, ready to be saved as-is to a file."
    ```

    **10b. Write plan file**: When the agent returns, write the plan to `docs/implementation-artifacts/plans/{plan-filename}.md`. The filename should follow the pattern: `plan-{story-id-lower}-{slugified-story-name}.md` (e.g., `plan-e107-s05-sync-reader-themes.md`).

    **10c. User approval** (via `AskUserQuestion`): Display a summary and ask for approval:

    ```
    Plan generated (Opus) and saved to:
    docs/implementation-artifacts/plans/{plan-filename}.md

    Summary:
    - {2-4 line summary of the plan's approach}
    - {N} implementation steps
    - Estimated scope: {files to create/modify count}

    Options:
    - "Approve" — proceed with this plan
    - "Changes needed: {your feedback}" — I'll refine with your feedback
    ```

    **10d. Refinement loop** (if user requests changes):
    - Dispatch a new Plan agent (`model: "opus"`) with the original context + user feedback + the previous plan
    - Overwrite the plan file with the refined version
    - Ask for approval again via `AskUserQuestion`
    - Maximum 2 refinement rounds. After round 2, save as-is and append user's unresolved notes to the plan file under a `## Open Questions` section.

    **TodoWrite**: Mark "Enter plan mode" → `completed`. Mark "Link plan, commit, and output" → `in_progress`.

11. **Optional elicitation** (HIGH complexity only): After the user approves the plan (Step 10c), check if the story warrants a refinement pass using `bmad-advanced-elicitation`.

    **Skip entirely if complexity is LOW or MEDIUM** — elicitation adds ceremony without proportional value for straightforward stories.

    Offer elicitation only when complexity is **HIGH** AND ANY of:
    - Story has 4+ tasks in the plan
    - Story touches 3+ areas of the codebase
    - Story has complex/ambiguous acceptance criteria (4+ ACs or ACs with unclear scope)

    If triggered, ask the user:
    > "The plan is approved. This story has [reason — e.g. 5 tasks / 4 ACs]. Want me to run a quick elicitation pass to stress-test the plan before you start? (y/N)"

    If yes → invoke `bmad-advanced-elicitation` skill, passing the plan content as context. Incorporate any meaningful changes into the saved plan file.
    If no (or story does not meet criteria) → skip, proceed to Step 12.

12. **Link plan to story file**: After the user approves the plan (Step 10c), append an `## Implementation Plan` section to the story file so the developer can find the plan in a later session. The plan file was already written in Step 10b. If the section already exists, skip.

    Format:
    ```markdown
    ## Implementation Plan

    See [plan](plans/{plan-filename}.md) for implementation approach.
    ```

    Use the actual plan filename (relative to `docs/implementation-artifacts/`) from the current session.

13. **Assess workflow recommendation**: Use the complexity estimate from Step 9b as the primary signal:

    | Complexity | Recommendation | Rationale |
    |------------|---------------|-----------|
    | **LOW** | Quick ship (`/finish-story`) | Simple stories — inline reviews sufficient |
    | **MEDIUM** | Review first if UI changes, otherwise quick ship | UI changes benefit from design review; non-UI medium stories ship fine inline |
    | **HIGH** | Review first (`/review-story` → `/finish-story`) | Complex stories need dedicated review pass |

    **Override to "Review first"** regardless of complexity when ANY of:
    - Story creates new pages or routes
    - Story touches security-sensitive areas (auth, API keys, payments)

    **Override to "Quick ship"** regardless of complexity when ALL of:
    - Story has 1-2 tasks
    - No UI changes
    - Changes confined to a single area

14. **Initial commit** (idempotent):
    - Check if an initial commit already exists: `git log --oneline --grep="chore: start story E##-S##"`.
    - **Commit exists**: Skip. Inform user: "Initial commit already made."
    - **Commit does not exist**: `git add docs/implementation-artifacts/{story-key}.md docs/implementation-artifacts/sprint-status.yaml` (and `tests/e2e/story-{id}.spec.ts` if ATDD tests were created). Commit: `chore: start story E##-S##`.

15. **Completion output**: Display the following summary to the user:

    ```markdown
    ---

    ## Story Started: E##-S## — [Story Name]

    | Item             | Status                                    |
    | ---------------- | ----------------------------------------- |
    | Worktree         | [Path to worktree / "Main workspace"]    |
    | Branch           | `feature/e##-s##-slug`                    |
    | Story file       | `docs/implementation-artifacts/{key}.md`  |
    | Sprint status    | Updated to `ready-for-dev`                |
    | ATDD tests       | [Created N tests / Skipped]               |
    | Web research     | [Researched: {technologies} / Skipped (no signals) / Declined] |
    | Initial commit   | `chore: start story E##-S##`              |

    ### Next Steps

    1. **Implement the story** (new session recommended):
       [If worktree was used:]
       ```
       Implement E##-S## in worktree ${PROJECT_NAME}-worktrees/${STORY_KEY_LOWER} following the plan at docs/implementation-artifacts/plans/{plan-filename}.md
       ```
       [If no worktree:]
       ```
       Implement E##-S## following the plan at docs/implementation-artifacts/plans/{plan-filename}.md
       ```
    2. Make **granular commits** after each task as save points
    3. Before ending your session, run `/checkpoint` to save implementation context for next time
    4. When done, ship it:

       **Recommended: [Review first / Quick ship]**
       [reason — bold the criterion that triggered the recommendation. E.g., "This story has **UI changes** across **4 tasks** — a design review will catch visual regressions before shipping." or "**1 task**, no UI changes — reviews run inline during finish."]

       | Workflow | Command | When to use |
       |----------|---------|-------------|
       | Review first | `/review-story` → fix → `/finish-story` | UI changes, complex stories, 3+ tasks |
       | Quick ship | `/finish-story` (auto-runs reviews) | Simple changes, config, 1-2 tasks |

    [If worktree was used, add:]
    4. **After PR is merged**: Clean up the worktree:
       ```
       worktree-cleanup {story-key-lower}
       ```

    ---
    ```

    **IMPORTANT**: After displaying this completion output, STOP. Do not begin implementing the story. The developer chooses when and how to implement. The next action is theirs.

**Without arguments**: Read sprint-status.yaml + epics.md, find first `backlog` story, confirm with user via AskUserQuestion, then proceed from step 1.

## References

- **Route map & stack patterns**: `.claude/skills/start-story/docs/reference-tables.md`
- **Common mistakes & recovery**: `.claude/skills/start-story/docs/recovery-and-gotchas.md`
- **Worktree setup details**: `.claude/skills/start-story/docs/worktree-setup.md`
- **Status validation scenarios**: `.claude/skills/start-story/docs/status-validation.md`
- **Design guidance algorithm**: `.claude/skills/start-story/docs/design-guidance.md`
