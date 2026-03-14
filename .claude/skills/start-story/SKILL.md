---
name: start-story
description: Use when beginning work on a LevelUp story, when user says "start story E##-S##", or when picking the next story from sprint-status.yaml. Creates branch, story file, suggests ATDD tests, gathers context, enters plan mode.
argument-hint: "[E##-S##]"
disable-model-invocation: true
---

# Start Story

Automates story setup: feature branch, sprint tracking, ATDD test suggestion, contextual research, and plan mode entry.

## Configuration

```typescript
const PATHS = {
  // Planning and tracking
  epics: "docs/planning-artifacts/epics.md",
  sprintStatus: "docs/implementation-artifacts/sprint-status.yaml",
  uxDesignSpec: "docs/planning-artifacts/ux-design-specification.md",

  // Story artifacts
  storyTemplate: "docs/implementation-artifacts/story-template.md",
  implementationArtifacts: "docs/implementation-artifacts",
  plans: "docs/implementation-artifacts/plans",

  // Testing
  e2eTests: "tests/e2e",
  testSupport: "tests/support",
  tests: "tests",

  // Source code
  pages: "src/app/pages",
  components: "src/app/components",
  stores: "src/stores",
  db: "src/db",
  lib: "src/lib"
}

const FILE_TEMPLATES = {
  storyFile: (key: string) => `${PATHS.implementationArtifacts}/${key}.md`,
  atddTest: (id: string) => `${PATHS.e2eTests}/story-${id}.spec.ts`,
  planFile: (filename: string) => `${PATHS.plans}/${filename}.md`
}
```

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
[ ] Suggest ATDD tests
[ ] Suggest design guidance
[ ] Research: story context (Agent)
[ ] Research: code patterns (Agent)
[ ] Research: test + UX patterns (Agent)
[ ] Enter plan mode
[ ] Link plan, commit, and output
```

Mark the first todo as `in_progress` and proceed:

### 0. Git Worktree Setup (Optional)

Offer the user a choice to create an isolated git worktree for this story.

**See:** [docs/worktree-setup.md](docs/worktree-setup.md) for complete worktree logic (existing worktree recovery, creation, cleanup).

**Key decision**: Resume existing worktree, delete and recreate, or skip worktree.

### 1. Look Up Story

Look up story in `${PATHS.epics}`. Extract name, description, acceptance criteria, dependencies, technical notes.

If `$ARGUMENTS` is empty, read `${PATHS.sprintStatus}` and find the first `backlog` story, then confirm with the user via AskUserQuestion.

### 2. Check Status and Validate Consistency

Check status in `${PATHS.sprintStatus}`. Warn if not `backlog` or `ready-for-dev`.

**ID normalization**: `E01-S03` → strip leading zeros → key `1-3-organize-courses-by-topic`.

**See:** [docs/status-validation.md](docs/status-validation.md) for sprint status vs branch sync validation logic.

**Key states**:
- `status=backlog AND branch exists` → STALE STATE (3 recovery options)
- `status=in-progress AND branch missing` → STALE STATE (2 recovery options)
- `status=in-progress AND branch exists` → RESUMED STORY (happy path)

**TodoWrite**: Mark "Look up story and validate sprint status" → `completed`.

### 3. Derive Branch Name

`feature/` + lowercase story ID + slugified name. Strip `& ( ) , .` and filler words (and, the, a, with, for, of). Lowercase. Hyphens between words.

**Example**: `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

### 4. Enforce Clean Working Tree (Idempotent)

**Determine if this is a resumed story**:
- Check story status in `${PATHS.sprintStatus}`: `grep "E##-S##" | awk '{print $2}'`
- Check if branch exists: `git branch --list feature/e##-s##-slug`

**If both status=in-progress AND branch exists → RESUMED STORY**:

Inform user:
```
✅ Resuming story E##-S## (already in-progress)

Branch: feature/e##-s##-slug
Status: in-progress

Uncommitted changes are allowed when resuming. Continuing with existing setup.
```

Skip clean tree check. Proceed to Step 5.

---

**If status≠in-progress OR branch missing → NEW STORY**:

Check working tree status:
```bash
git status --porcelain
```

**If uncommitted changes found**:
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

**If clean**: Continue to Step 5.

### 5. Create Branch (Idempotent)

- **If worktree was created in Step 0**: Skip this step entirely. The branch was already created by the superpowers worktree skill. Inform user: "Branch created by worktree setup, skipping."
- **Otherwise**:
  - Check if branch already exists: `git branch --list feature/e##-s##-slug`.
  - **Branch exists**: Switch to it (`git checkout feature/e##-s##-slug`). Inform user: "Branch already exists, switching to it."
  - **Branch does not exist**: `git checkout main && git pull && git checkout -b feature/e##-s##-slug`. Skip pull if no remote.

### 6. Create Story File (Idempotent)

- Check if `${FILE_TEMPLATES.storyFile(key)}` already exists.
- **File exists**: Skip creation. Inform user: "Story file already exists, keeping it."
- **File does not exist**: Create using the template at `${PATHS.storyTemplate}`. Populate frontmatter (`story_id`, `story_name`, `status: in-progress`, `started: YYYY-MM-DD`, `reviewed: false`, `review_started:`, `review_gates_passed: []`) and fill in Story, Acceptance Criteria, and Tasks from the epic.

**TodoWrite**: Mark "Set up branch and story file" → `in_progress`.

### 7. Update Sprint Status (Idempotent)

- Check current status in `${PATHS.sprintStatus}`.
- **Already `in-progress`**: Skip update. Inform user: "Sprint status already in-progress."
- **Not `in-progress`**: Set story → `in-progress`. If this is the first story in the epic, set epic → `in-progress`.

**TodoWrite**: Mark "Set up branch and story file" → `completed`. Mark "Suggest ATDD tests" → `in_progress`.

### 8. ATDD Test Suggestion (Idempotent)

Check if `${FILE_TEMPLATES.atddTest(id)}` exists.

**If file exists**:
- Verify it contains actual test cases:
  ```bash
  grep -q "test(" ${FILE_TEMPLATES.atddTest(id)} || grep -q "test.describe(" ${FILE_TEMPLATES.atddTest(id)}
  ```

**If file exists AND contains tests**:
- Count test cases: `grep -c "^\s*test(" ${FILE_TEMPLATES.atddTest(id)}`
- Inform user: "ATDD tests already exist (N test cases found)."
- Skip ATDD suggestion.

**If file exists BUT is empty/incomplete**:
- Present options via AskUserQuestion:
  ```
  ⚠️ ATDD test file exists but appears incomplete.

  File: ${FILE_TEMPLATES.atddTest(id)}
  Status: No test cases found (file may be empty or corrupted)

  This can happen if:
  - Previous run created the file but didn't complete test generation
  - File was manually created as a placeholder
  - File was corrupted or truncated

  Options:
  1. Regenerate tests (Recommended) — Delete file and generate new tests
  2. Keep existing file — Continue without regenerating (you can add tests manually)
  ```
- If "Regenerate tests" selected:
  - Delete file: `rm ${FILE_TEMPLATES.atddTest(id)}`
  - Inform user: "Deleted incomplete test file. Proceeding with ATDD generation..."
  - Continue with ATDD generation (see "File does not exist" below)
- If "Keep existing file" selected:
  - Inform user: "Keeping existing test file. You can add tests manually during implementation."
  - Skip ATDD suggestion.

**If file does not exist**:
- Analyze the acceptance criteria content:
  - If ACs mention UI elements ("page", "button", "display", "show", "component", "render", "modal", "form", "input", "click"), suggest generating ATDD tests with reasoning: "ACs describe user-facing behavior — failing E2E tests help validate implementation."
  - If ACs are about config, refactoring, data, or infrastructure, suggest skipping with reasoning: "ACs are technical/internal — unit tests during implementation are more appropriate."
  - Present the suggestion to the user via AskUserQuestion. User makes the final decision.
  - If user accepts: Generate failing acceptance tests in `${FILE_TEMPLATES.atddTest(id)}` using existing Playwright fixture patterns from `${PATHS.testSupport}/`. Tests should follow RED-GREEN-REFACTOR: write minimal failing tests that map to acceptance criteria.
  - If user declines: Continue without tests.

**TodoWrite**: Mark "Suggest ATDD tests" → `completed`. Mark "Suggest design guidance" → `in_progress`.

### 8b. Design Guidance Suggestion (Idempotent)

Detect UI stories and offer frontend design guidance before plan mode.

**See:** [docs/design-guidance.md](docs/design-guidance.md) for UI detection algorithm and guidance generation logic.

**Key detection criteria**:
- 2+ UI keywords in ACs (page, button, form, display, etc.)
- OR affected files include `.tsx` files in `${PATHS.pages}/` or `${PATHS.components}/`

**If UI story detected**: Offer to invoke `/frontend-design` skill to generate design guidance.

**TodoWrite**: Mark "Suggest design guidance" → `completed`. Mark all 3 research agent todos → `in_progress` simultaneously.

### 9. Launch 3 Parallel Explore Agents

Dispatch all in a single message via Task tool:

- **Agent 1 — Story context**: Read story ACs, dependencies, related stories in `${PATHS.epics}`. Check if dependent stories are `done` in sprint-status.
- **Agent 2 — Existing code patterns**: Search affected source directories (`${PATHS.pages}/`, `${PATHS.components}/`, `${PATHS.stores}/`, `${PATHS.db}/`, `${PATHS.lib}/`) for relevant patterns, types, and utilities.
- **Agent 3 — Test patterns + UX specs**: Read test patterns from `${PATHS.tests}/` and `${PATHS.testSupport}/`, plus UX design specs from `${PATHS.uxDesignSpec}` for relevant sections.

As each agent returns, mark its corresponding todo → `completed`. Wait for all 3 to complete before proceeding.

**TodoWrite**: Mark all 3 research todos → `completed`. Mark "Enter plan mode" → `in_progress`.

### 10. Enter Plan Mode

Combine research from all 3 agents into a plan. Include:
- Story overview and ACs
- Dependencies and their status
- Relevant existing patterns to follow
- Suggested implementation approach
- UX design references (if applicable)
- Note: during implementation, make granular commits after each small task as save points

**TodoWrite**: Mark "Enter plan mode" → `completed`. Mark "Link plan, commit, and output" → `in_progress`.

### 11. Link Plan to Story File

After `ExitPlanMode` returns (plan approved), save the plan to `${FILE_TEMPLATES.planFile(filename)}`, then append an `## Implementation Plan` section to the story file so the developer can find the plan in a later session. If the section already exists, skip.

Format:
```markdown
## Implementation Plan

See [plan](plans/{plan-filename}.md) for implementation approach.
```

Use the actual plan filename (relative to `${PATHS.implementationArtifacts}/`) from the current session.

### 12. Assess Workflow Recommendation

Based on research from Steps 9-10, determine which shipping workflow to recommend:

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

### 13. Initial Commit (Idempotent)

- Check if an initial commit already exists: `git log --oneline --grep="chore: start story E##-S##"`.
- **Commit exists**: Skip. Inform user: "Initial commit already made."
- **Commit does not exist**: `git add ${FILE_TEMPLATES.storyFile(key)} ${PATHS.sprintStatus}` (and `${FILE_TEMPLATES.atddTest(id)}` if ATDD tests were created). Commit: `chore: start story E##-S##`.

### 14. Completion Output

Display the following summary to the user:

```markdown
---

## Story Started: E##-S## — [Story Name]

| Item             | Status                                    |
| ---------------- | ----------------------------------------- |
| Worktree         | [Path to worktree / "Main workspace"]    |
| Branch           | `feature/e##-s##-slug`                    |
| Story file       | `${FILE_TEMPLATES.storyFile(key)}`        |
| Sprint status    | Updated to `in-progress`                  |
| ATDD tests       | [Created N tests / Skipped]               |
| Initial commit   | `chore: start story E##-S##`              |

### Next Steps

1. **Implement the story** (new session recommended):
   [If worktree was used:]
   ```
   Implement E##-S## in worktree ${PROJECT_NAME}-worktrees/${STORY_KEY_LOWER} following the plan at ${FILE_TEMPLATES.planFile(filename)}
   ```
   [If no worktree:]
   ```
   Implement E##-S## following the plan at ${FILE_TEMPLATES.planFile(filename)}
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

---

**Without arguments**: Read `${PATHS.sprintStatus}` + `${PATHS.epics}`, find first `backlog` story, confirm with user via AskUserQuestion, then proceed from step 1.

## Reference Documentation

- **[Worktree Setup Logic](docs/worktree-setup.md)** — Step 0: existing worktree recovery, creation, cleanup
- **[Status Validation](docs/status-validation.md)** — Step 2: sprint status vs branch sync validation with stale state recovery
- **[Design Guidance](docs/design-guidance.md)** — Step 8b: UI story detection and frontend design guidance generation
- **[Recovery & Gotchas](docs/recovery-and-gotchas.md)** — Idempotency guarantees, common mistakes, cleanup
- **[Reference Tables](docs/reference-tables.md)** — Route map, stack patterns, branch naming conventions
