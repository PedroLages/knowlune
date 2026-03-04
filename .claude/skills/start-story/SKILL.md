---
name: start-story
description: Use when beginning work on a LevelUp story, when user says "start story E##-S##", or when picking the next story from sprint-status.yaml. Creates branch, story file, suggests ATDD tests, gathers context, enters plan mode.
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

## Steps

When invoked with a story ID (e.g., `E01-S03`):

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
   - Detect project root: `PROJECT_ROOT=$(git rev-parse --show-toplevel)`
   - Detect project name: `PROJECT_NAME=$(basename "$PROJECT_ROOT")`
   - Calculate worktree base: `WORKTREE_BASE=$(dirname "$PROJECT_ROOT")/${PROJECT_NAME}-worktrees`
   - Run: `worktree-story ${STORY_KEY} "${STORY_TITLE}"`
     - This creates:
       - Worktree at: `${WORKTREE_BASE}/${STORY_KEY_LOWER}/`
       - Branch: `feature/${STORY_KEY_LOWER}-${STORY_SLUG}`
   - Change working directory: `cd "${WORKTREE_BASE}/${STORY_KEY_LOWER}"`
   - Inform user:
     ```
     ✨ Worktree created successfully!

     📍 Location: ${WORKTREE_BASE}/${STORY_KEY_LOWER}
     🌿 Branch: feature/${STORY_KEY_LOWER}-${STORY_SLUG}

     📝 All story files will be created here.
     🧑‍💻 You can develop in isolation without affecting your main workspace.

     🧹 When done: worktree-cleanup ${STORY_KEY_LOWER}
     ```
   - **Important**: All subsequent steps (1-14) will execute in the worktree directory

   **If user selects NO**:
   - Continue in main workspace (current directory)
   - Proceed to Step 1

1. **Look up story** in `docs/planning-artifacts/epics.md`. Extract name, description, acceptance criteria, dependencies, technical notes. If `$ARGUMENTS` is empty, read `docs/implementation-artifacts/sprint-status.yaml` and find the first `backlog` story, then confirm with the user via AskUserQuestion.

2. **Check status** in `docs/implementation-artifacts/sprint-status.yaml`. Warn if not `backlog` or `ready-for-dev`.
   - **ID normalization**: `E01-S03` → strip leading zeros → key `1-3-organize-courses-by-topic`.
   - If status is already `in-progress`: this is a **resumed start**. Inform the user and skip to the resumption check in step 3.

3. **Derive branch name**: `feature/` + lowercase story ID + slugified name. Strip `& ( ) , .` and filler words (and, the, a, with, for, of). Lowercase. Hyphens between words.
   - Example: `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

4. **Check working tree**: `git status`. Warn if uncommitted changes. Suggest commit or stash.

5. **Create branch** (idempotent):
   - **If worktree was created in Step 0**: Skip this step entirely. The branch was already created by `worktree-story`. Inform user: "Branch created by worktree setup, skipping."
   - **Otherwise**:
     - Check if branch already exists: `git branch --list feature/e##-s##-slug`.
     - **Branch exists**: Switch to it (`git checkout feature/e##-s##-slug`). Inform user: "Branch already exists, switching to it."
     - **Branch does not exist**: `git checkout main && git pull && git checkout -b feature/e##-s##-slug`. Skip pull if no remote.

6. **Create story file** (idempotent):
   - Check if `docs/implementation-artifacts/{key}.md` already exists.
   - **File exists**: Skip creation. Inform user: "Story file already exists, keeping it."
   - **File does not exist**: Create using the template at `docs/implementation-artifacts/story-template.md`. Populate frontmatter (`story_id`, `story_name`, `status: in-progress`, `started: YYYY-MM-DD`, `reviewed: false`, `review_started:`, `review_gates_passed: []`) and fill in Story, Acceptance Criteria, and Tasks from the epic.

7. **Update sprint status** (idempotent):
   - Check current status in `docs/implementation-artifacts/sprint-status.yaml`.
   - **Already `in-progress`**: Skip update. Inform user: "Sprint status already in-progress."
   - **Not `in-progress`**: Set story → `in-progress`. If this is the first story in the epic, set epic → `in-progress`.

8. **ATDD test suggestion** (idempotent):
   - Check if `tests/e2e/story-{id}.spec.ts` already exists.
   - **File exists**: Skip ATDD suggestion. Inform user: "ATDD tests already exist."
   - **File does not exist**: Analyze the acceptance criteria content:
     - If ACs mention UI elements ("page", "button", "display", "show", "component", "render", "modal", "form", "input", "click"), suggest generating ATDD tests with reasoning: "ACs describe user-facing behavior — failing E2E tests help validate implementation."
     - If ACs are about config, refactoring, data, or infrastructure, suggest skipping with reasoning: "ACs are technical/internal — unit tests during implementation are more appropriate."
     - Present the suggestion to the user via AskUserQuestion. User makes the final decision.
     - If user accepts: Generate failing acceptance tests in `tests/e2e/story-{id}.spec.ts` using existing Playwright fixture patterns from `tests/support/`. Tests should follow RED-GREEN-REFACTOR: write minimal failing tests that map to acceptance criteria.
     - If user declines: Continue without tests.

9. **Launch 3 parallel Explore agents** via Task tool:
   - **Agent 1 — Story context**: Read story ACs, dependencies, related stories in `docs/planning-artifacts/epics.md`. Check if dependent stories are `done` in sprint-status.
   - **Agent 2 — Existing code patterns**: Search affected source directories (`src/app/pages/`, `src/app/components/`, `src/stores/`, `src/db/`, `src/lib/`) for relevant patterns, types, and utilities.
   - **Agent 3 — Test patterns + UX specs**: Read test patterns from `tests/` and `tests/support/`, plus UX design specs from `docs/planning-artifacts/ux-design-specification.md` for relevant sections.

10. **Enter plan mode** with gathered context. Combine research from all 3 agents into a plan. Include:
    - Story overview and ACs
    - Dependencies and their status
    - Relevant existing patterns to follow
    - Suggested implementation approach
    - UX design references (if applicable)
    - Note: during implementation, make granular commits after each small task as save points

11. **Link plan to story file**: After `ExitPlanMode` returns (plan approved), save the plan to `docs/implementation-artifacts/plans/{plan-filename}.md`, then append an `## Implementation Plan` section to the story file so the developer can find the plan in a later session. If the section already exists, skip.

    Format:
    ```markdown
    ## Implementation Plan

    See [plan](plans/{plan-filename}.md) for implementation approach.
    ```

    Use the actual plan filename (relative to `docs/implementation-artifacts/`) from the current session.

12. **Assess workflow recommendation**: Based on research from Steps 9-10, determine which shipping workflow to recommend:

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

13. **Initial commit** (idempotent):
    - Check if an initial commit already exists: `git log --oneline --grep="chore: start story E##-S##"`.
    - **Commit exists**: Skip. Inform user: "Initial commit already made."
    - **Commit does not exist**: `git add docs/implementation-artifacts/{story-key}.md docs/implementation-artifacts/sprint-status.yaml` (and `tests/e2e/story-{id}.spec.ts` if ATDD tests were created). Commit: `chore: start story E##-S##`.

14. **Completion output**: Display the following summary to the user:

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

## LevelUp Stack Patterns

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
- **Step 11** (plan link): If `## Implementation Plan` section exists, skips.
- **Step 13** (initial commit): If commit exists, skips.
- **General cleanup** (if needed):
  - **Main workspace**: `git checkout main && git branch -D feature/e##-s##-slug`
  - **Worktree**: `worktree-cleanup {story-key-lower}` (removes worktree and deletes branch)
