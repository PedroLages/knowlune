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

1. **Look up story** in `docs/planning-artifacts/epics.md`. Extract name, description, acceptance criteria, dependencies, technical notes. If `$ARGUMENTS` is empty, read `docs/implementation-artifacts/sprint-status.yaml` and find the first `backlog` story, then confirm with the user via AskUserQuestion.

2. **Check status** in `docs/implementation-artifacts/sprint-status.yaml`. Warn if not `backlog` or `ready-for-dev`.
   - **ID normalization**: `E01-S03` → strip leading zeros → key `1-3-organize-courses-by-topic`.

3. **Derive branch name**: `feature/` + lowercase story ID + slugified name. Strip `& ( ) , .` and filler words (and, the, a, with, for, of). Lowercase. Hyphens between words.
   - Example: `E01-S03` "Organize Courses by Topic" → `feature/e01-s03-organize-courses-by-topic`

4. **Check working tree**: `git status`. Warn if uncommitted changes. Suggest commit or stash.

5. **Create branch**: `git checkout main && git pull && git checkout -b feature/e##-s##-slug`. Skip pull if no remote.

6. **Create story file**: Create `docs/implementation-artifacts/{key}.md` using the template at `docs/implementation-artifacts/story-template.md`. Populate frontmatter (`story_id`, `story_name`, `status: in-progress`, `started: YYYY-MM-DD`, `reviewed: false`) and fill in Story, Acceptance Criteria, and Tasks from the epic.

7. **Update sprint status**: In `docs/implementation-artifacts/sprint-status.yaml`, set story → `in-progress`. If this is the first story in the epic, set epic → `in-progress`.

8. **ATDD test suggestion**: Analyze the acceptance criteria content:
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

11. **Initial commit**: `git add docs/implementation-artifacts/{story-key}.md docs/implementation-artifacts/sprint-status.yaml` (and `tests/e2e/story-{id}.spec.ts` if ATDD tests were created). Commit: `chore: start story E##-S##`.

12. **Completion output**: Display the following summary to the user:

    ```markdown
    ---

    ## Story Started: E##-S## — [Story Name]

    | Item             | Status                                    |
    | ---------------- | ----------------------------------------- |
    | Branch           | `feature/e##-s##-slug`                    |
    | Story file       | `docs/implementation-artifacts/{key}.md`  |
    | Sprint status    | Updated to `in-progress`                  |
    | ATDD tests       | [Created N tests / Skipped]               |
    | Initial commit   | `chore: start story E##-S##`              |

    ### Next Steps

    1. **Implement the story** following the approved plan
    2. Make **granular commits** after each task as save points
    3. When done, choose your workflow:
       - **Quick ship**: `/finish-story` (auto-runs all reviews)
       - **Review first**: `/review-story` → fix issues → `/finish-story`

    ---
    ```

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

If the workflow fails mid-run:
- **Steps 1-2 fail** (lookup/status): Nothing changed. Fix and re-run.
- **Step 4 fail** (uncommitted changes): Commit or stash, re-run.
- **Step 5 fail** (branch creation): Check if branch exists (`git branch -a`), delete if partial, re-run.
- **Steps 6-7 fail** (file creation/status update): Delete partial files, re-run.
- **General cleanup**: `git checkout main && git branch -D feature/e##-s##-slug`
