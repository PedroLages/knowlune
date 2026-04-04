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

2. **Check status** in `docs/implementation-artifacts/sprint-status.yaml`. Warn if not `backlog` or `ready-for-dev`.
   - **ID normalization**: `E01-S03` → strip leading zeros → key `1-3-organize-courses-by-topic`.
   - If status is already `in-progress`: this is a **resumed start**. Inform the user and skip to the resumption check in step 3.

   **TodoWrite**: Mark "Look up story and validate sprint status" → `completed`.

3. **Derive branch name**: `feature/` + lowercase story ID + slugified name. Strip `& ( ) , .` and filler words (and, the, a, with, for, of). Lowercase. Hyphens between words.
   - Example: `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

4. **Enforce clean working tree** (unless resuming):

   First, check if this is a resumed start:
   - If story status in sprint-status.yaml is already `in-progress` AND branch exists: **ALLOW** dirty tree (user is continuing work on this story)
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

   For resumed stories (status already `in-progress`):
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
   - **File does not exist**: Create using the template at `docs/implementation-artifacts/story-template.md`. Populate frontmatter (`story_id`, `story_name`, `status: in-progress`, `started: YYYY-MM-DD`, `reviewed: false`, `review_started:`, `review_gates_passed: []`) and fill in Story, Acceptance Criteria, and Tasks from the epic.

   **TodoWrite**: Mark "Set up branch and story file" → `in_progress`.

7. **Update sprint status** (idempotent):
   - Check current status in `docs/implementation-artifacts/sprint-status.yaml`.
   - **Already `in-progress`**: Skip update. Inform user: "Sprint status already in-progress."
   - **Not `in-progress`**: Set story → `in-progress`. If this is the first story in the epic, set epic → `in-progress`.

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

8b. **Design guidance suggestion** (idempotent):
   - Check if `## Design Guidance` section already exists in story file.
   - **Section exists**: Skip design guidance suggestion. Inform user: "Design guidance already exists in story file."
   - **Section does not exist**: Analyze story content to detect if this is a UI story:

     **Detection algorithm:**
     1. **Read acceptance criteria** from the story file (created in Step 6)
     2. **Check for UI keywords** in ACs (case-insensitive):
        - Layout/structure: "page", "component", "layout", "modal", "dialog", "sheet", "panel", "sidebar", "header", "footer"
        - Interactive elements: "button", "form", "input", "select", "dropdown", "checkbox", "radio", "slider", "switch"
        - Visual behavior: "display", "show", "hide", "render", "click", "hover", "focus", "visible", "scroll"
        - Content presentation: "card", "list", "table", "grid", "carousel", "accordion", "tab", "badge"
     3. **Check affected files** in epic context:
        - Read the story section from `docs/planning-artifacts/epics.md` (using story ID from `$ARGUMENTS`)
        - Look for tasks/subtasks mentioning files in `src/app/pages/` or `src/app/components/`
        - If no explicit file mentions, check if any tasks reference "create page", "add component", "update UI", or "style"
     4. **UI story if**: EITHER (a) 2+ UI keywords found in ACs, OR (b) affected files include `.tsx` files in `src/app/pages/` or `src/app/components/`

     **If UI story detected**:

     Use AskUserQuestion to offer design guidance:

     ```
     This story involves UI changes — frontend design guidance can help shape the implementation plan before coding starts.

     Design guidance provides:
     - Layout approach and responsive considerations
     - Component structure and composition patterns
     - Design system token usage (colors, spacing, typography)
     - Accessibility requirements (WCAG 2.1 AA+)
     - Mobile-first vs desktop-first strategy

     Would you like to generate design guidance now?

     Options:
     - "Generate design guidance (Recommended)" — AI agent analyzes ACs and suggests design approach
     - "Skip for now" — Continue without design guidance (can add manually later)
     ```

     **If user selects "Generate design guidance (Recommended)"**:
     1. Invoke the `/frontend-design` skill via Skill tool:
        ```
        Skill({
          skill: "frontend-design",
          args: "E##-S## --story-file=docs/implementation-artifacts/{story-key}.md"
        })
        ```
        The skill should receive:
        - Story ID
        - Story description from epic
        - Acceptance criteria (UI-related ACs emphasized)
        - Affected files (if known from epic)
        - Context: This guidance will be used in Step 10 plan mode

     2. **Wait for skill completion**: The `/frontend-design` skill returns design guidance in markdown format

     3. **Save guidance to story file**:
        - Read current story file from `docs/implementation-artifacts/{story-key}.md`
        - Insert new section `## Design Guidance` AFTER `## Tasks / Subtasks` and BEFORE `## Implementation Notes`
        - Content from `/frontend-design` skill output
        - Write updated story file

     4. **Verify insertion**: Re-read story file to confirm section exists

     5. **Error handling**:
        - If `/frontend-design` skill fails (skill not found, timeout, error):
          - Log error to user: "Design guidance skill failed: {error message}"
          - Inform user: "Continuing without design guidance. You can add design notes manually to the `## Design Guidance` section in the story file."
          - Mark todo completed (don't block workflow)
        - If story file write fails:
          - Log error: "Could not save design guidance to story file: {error}"
          - Display guidance in chat output
          - Inform user: "Please add the guidance manually to `docs/implementation-artifacts/{story-key}.md` under `## Design Guidance`"

     **If user selects "Skip for now"**:
     - Inform user: "Skipping design guidance. You can add design notes manually to the story file under `## Design Guidance` section if needed during implementation."
     - Continue to next step

     **If NOT a UI story**:
     - Skip design guidance suggestion (no AskUserQuestion)
     - Inform user: "No UI changes detected — skipping design guidance suggestion."
     - Continue to next step

   **TodoWrite**: Mark "Suggest design guidance" → `completed`. Mark all 3 research agent todos → `in_progress` simultaneously.

9. **Launch 3 parallel Explore agents** via Task tool (dispatch all in a single message).

   **Important**: Feed each agent the specific ACs and affected file paths from Step 1, not generic search mandates. Targeted context produces 40% fewer errors and 55% faster task completion (Anthropic 2026 Agentic Coding report).

   - **Agent 1 — Story context**: Read story ACs, dependencies, related stories in `docs/planning-artifacts/epics.md`. Check if dependent stories are `done` in sprint-status. **Provide**: the exact AC text and dependency list from Step 1.
   - **Agent 2 — Existing code audit + patterns**: Search affected source directories (`src/app/pages/`, `src/app/components/`, `src/stores/`, `src/db/`, `src/lib/`) for relevant patterns, types, and utilities. **Provide**: the specific ACs and task descriptions so the agent searches for exact matches (e.g., "AC says 'persist quiz results' — find existing Dexie.js quiz stores"). **Important: explicitly identify pre-existing code that already implements parts of the story** — search for store actions, type definitions, and components that overlap with the story's tasks. Report what already exists vs. what needs building. (See `docs/engineering-patterns.md` § "Inventory Existing Code Before Story Planning".)
   - **Agent 3 — Test patterns + UX specs**: Read test patterns from `tests/` and `tests/support/`, plus UX design specs from `docs/planning-artifacts/ux-design-specification.md` for relevant sections. **Provide**: the affected route(s) from the route map so the agent finds existing E2E tests for those specific pages.

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

9c. **Selective web research** (conditional — skipped if no external signals detected):

   **Detection**: Scan the story's acceptance criteria, task descriptions, and implementation notes (from Steps 1 and 9) for signals that web research would add value. This is pure text matching — no network calls.

   **Signal categories:**

   | Category | Patterns |
   |----------|----------|
   | New packages | Library/package names not already in `package.json` dependencies |
   | External APIs | "REST", "GraphQL", "OAuth", "webhook", "endpoint", "API key" |
   | Named technologies | "Supabase", "Stripe", "Playwright", "Firebase", "Auth0", "Prisma", "Drizzle", or any proper-noun technology name not part of the existing stack |
   | Integration keywords | "integrate", "migrate", "upgrade", "third-party", "SDK", "authentication" |
   | Security concerns | "CVE", "vulnerability", "encryption", "CORS", "CSP", "OWASP" |
   | Version-specific | "v2", "v3", "latest version", "breaking changes", "deprecat" |

   **Decision logic:**
   - Count signal matches across all story text (ACs + tasks + implementation notes + agent research summaries)
   - If 0 signals detected: skip silently, inform user "No external dependencies detected — skipping web research.", mark todo `completed`, proceed to step 10
   - If 1+ signals detected: proceed to user prompt

   **User prompt** (via AskUserQuestion):
   ```
   Detected external dependencies/technologies in this story:
   - {signal 1: e.g., "Supabase" (named technology)}
   - {signal 2: e.g., "OAuth" (external API)}
   - {signal 3: e.g., "migrate" (integration keyword)}

   Want me to research latest versions, breaking changes, and best practices?

   Options:
   - Yes — run web research before planning
   - No — skip and proceed to plan mode
   ```

   **If user declines (or no signals):** Mark todo `completed`. Proceed to step 10.

   **If user accepts:** Dispatch a single `general-purpose` agent via Task tool with WebSearch and WebFetch access:

   ```
   Task(general-purpose):
   "Research the following external dependencies/technologies for story E##-S##:
   - {detected signals list}

   For each, find:
   1. Latest stable version (as of today)
   2. Breaking changes from commonly-used previous versions
   3. Security advisories or known vulnerabilities
   4. Best practices and common pitfalls
   5. API documentation specifics relevant to: {brief AC summary}

   Search queries to try:
   - '{technology} latest version {current year}'
   - '{technology} migration guide breaking changes'
   - '{technology} security advisory'
   - '{technology} best practices {use case from ACs}'

   Return: Structured markdown summary with source links. Group by technology.
   Keep findings concise — focus on actionable information for implementation."
   ```

   **Output integration:** When the agent returns:
   1. Read the current story file at `docs/implementation-artifacts/{story-key}.md`
   2. Insert a `## Web Research` section AFTER `## Design Guidance` (or after `## Tasks / Subtasks` if no design guidance) and BEFORE `## Implementation Notes`
   3. Content: the agent's structured findings
   4. If story file write fails: display findings in chat output and inform user to add manually

   **Error handling:**
   - If agent fails or times out: log warning "Web research agent failed: {error}. Continuing without web research." Mark todo `completed`. Do not block workflow.
   - If WebSearch/WebFetch tools are unavailable: inform user "Web tools not available in this session. Skipping web research." Mark todo `completed`. Continue.

   **TodoWrite**: Mark "Web research (if external deps detected)" → `completed`. Mark "Enter plan mode" → `in_progress`.

10. **Enter plan mode** with gathered context. Combine research from all 3 agents into a plan. Include:
    - Story overview and ACs
    - Dependencies and their status
    - Relevant existing patterns to follow
    - Suggested implementation approach
    - UX design references (if applicable)
    - Web research findings (if Step 9c produced results): version constraints, breaking changes, security notes
    - **Risk Assessment** (include when complexity estimate is HIGH):
      - What could go wrong? (identify top 2-3 risks)
      - What is the rollback plan? (can changes be reverted cleanly?)
      - What existing patterns apply? (reference `docs/engineering-patterns.md`)
      - Are there dependencies between this story and others in the sprint?
    - Note: during implementation, make granular commits after each small task as save points

   **TodoWrite**: Mark "Enter plan mode" → `completed`. Mark "Link plan, commit, and output" → `in_progress`.

11. **Optional elicitation** (complex stories only): After `ExitPlanMode` returns (plan approved), check if the story warrants a refinement pass using `bmad-advanced-elicitation`.

    Offer elicitation when ANY of:
    - Story has 4+ tasks in the plan
    - Story touches 3+ areas of the codebase
    - Story has complex/ambiguous acceptance criteria (4+ ACs or ACs with unclear scope)

    If triggered, ask the user:
    > "The plan is approved. This story has [reason — e.g. 5 tasks / 4 ACs]. Want me to run a quick elicitation pass to stress-test the plan before you start? (y/N)"

    If yes → invoke `bmad-advanced-elicitation` skill, passing the plan content as context. Incorporate any meaningful changes into the saved plan file.
    If no (or story does not meet criteria) → skip, proceed to Step 12.

12. **Link plan to story file**: After `ExitPlanMode` returns (plan approved), save the plan to `docs/implementation-artifacts/plans/{plan-filename}.md`, then append an `## Implementation Plan` section to the story file so the developer can find the plan in a later session. If the section already exists, skip.

    Format:
    ```markdown
    ## Implementation Plan

    See [plan](plans/{plan-filename}.md) for implementation approach.
    ```

    Use the actual plan filename (relative to `docs/implementation-artifacts/`) from the current session.

13. **Assess workflow recommendation**: Based on research from Steps 9-10, determine which shipping workflow to recommend:

    **Recommend "Review first"** (`/review-story` → `/finish-story`) when ANY of:
    - Story involves UI changes (pages, components, styles in affected files)
    - Story has 3 or more tasks
    - Story creates new components or pages
    - Story has complex acceptance criteria (4+ ACs)
    - Story touches multiple areas of the codebase (store + component + page)

    **Recommend "Quick ship"** (`/finish-story`) when ALL of:
    - Story has 1-2 tasks
    - No UI changes (config, data, refactoring only)
    - Simple acceptance criteria (1-3 ACs)
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
    | Sprint status    | Updated to `in-progress`                  |
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
    3. When done, ship it:

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

## Route Map

Map changed files to routes for design review context:

| Source file pattern | Route | Page |
|---|---|---|
| `pages/Overview.tsx` | `/` | Dashboard overview |
| `pages/MyClass.tsx` | `/my-class` | Current class |
| `pages/Courses.tsx` | `/courses` | Course library |
| `pages/CourseDetail.tsx` | `/courses/:courseId` | Course detail |
| `pages/LessonPlayer.tsx` | `/courses/:courseId/:lessonId` | Lesson player |
| `pages/Library.tsx` | `/library` | Content library |
| `pages/Messages.tsx` | `/messages` | Messages |
| `pages/Instructors.tsx` | `/instructors` | Instructors |
| `pages/Reports.tsx` | `/reports` | Reports & analytics |
| `pages/Settings.tsx` | `/settings` | Settings |

## Knowlune Stack Patterns

| Story content | Pattern |
|---|---|
| UI pages/routes | React Router v7 + lazy loading in `routes.tsx` |
| Local storage | Dexie.js (IndexedDB) — `src/db/` |
| State management | Zustand stores — `src/stores/` |
| UI components | shadcn/ui (Radix) — `src/app/components/ui/` |
| Custom components | `src/app/components/figma/` |
| Styling | Tailwind CSS v4 utilities + `theme.css` tokens |
| Icons | Lucide React |
| File access | File System Access API — `src/lib/fileSystem.ts` |

## Branch Naming

| Story ID | Branch |
|---|---|
| E01-S03 | `feature/e01-s03-organize-courses-by-topic` |
| E02-S01 | `feature/e02-s01-lesson-player-page-video-playback` |

## Common Mistakes

- **Not branching from main**: Always `git checkout main && git pull` first.
- **Story already in-progress**: Check sprint-status.yaml first.
- **Wrong branch format**: `feature/e##-s##-slug` — all lowercase.
- **Uncommitted changes**: Commit or stash before switching.

## Recovery

All steps are idempotent — re-running `/start-story` after an interruption safely resumes:
- **Steps 1-2 fail** (lookup/status): Nothing changed. Fix and re-run.
- **Step 4 fail** (uncommitted changes): Commit or stash, re-run.
- **Step 5** (branch): If branch exists, switches to it instead of failing.
- **Step 6** (story file): If file exists, keeps it instead of overwriting.
- **Step 7** (sprint status): If already in-progress, skips update.
- **Step 8** (ATDD tests): If test file exists, skips suggestion.
- **Step 9c** (web research): If agent failed, re-run `/start-story` — detection re-runs, user can accept again.
- **Step 11** (plan link): If `## Implementation Plan` section exists, skips.
- **Step 13** (initial commit): If commit exists, skips.
- **General cleanup** (if needed):
  - **Main workspace**: `git checkout main && git branch -D feature/e##-s##-slug`
  - **Worktree**: `worktree-cleanup {story-key-lower}` (removes worktree and deletes branch)
