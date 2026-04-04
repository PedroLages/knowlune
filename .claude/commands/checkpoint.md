# Checkpoint — Save Implementation Context

Save a session checkpoint for the current story, capturing cognitive state (completed tasks, remaining work, key decisions, approaches tried) for seamless resumption in future sessions.

## Usage

```
/checkpoint
/checkpoint E01-S03   # explicit story ID
```

## Steps

1. **Detect story**: Parse story ID from `$ARGUMENTS` if provided. Otherwise derive from current branch name (`feature/e##-s##-*` → `E##-S##`). If not on a story branch, ask the user.

2. **Resolve paths**:
   - Derive story key: `E01-S03` → strip leading zeros → `1-3-*` → find matching file in `docs/implementation-artifacts/`
   - Set `CHECKPOINT_PATH`: `docs/implementation-artifacts/sessions/{story-id}-checkpoint.md` (lowercase, e.g., `e01-s03-checkpoint.md`)

3. **Create sessions directory** if it doesn't exist:
   ```bash
   mkdir -p docs/implementation-artifacts/sessions
   ```

4. **Gather context**:
   - Read story file → extract tasks (lines with `- [x]` and `- [ ]`)
   - Run `git log main...HEAD --oneline` → implementation progress
   - Run `git diff main...HEAD --stat` → files changed summary
   - Run `git status --short` → current uncommitted state
   - Read story file's "Implementation Notes" section (if exists) → key decisions
   - Read story file's "Challenges and Lessons Learned" section (if exists) → approaches tried

5. **Write checkpoint file** to `CHECKPOINT_PATH`:

   ```markdown
   ---
   story_id: E##-S##
   saved_at: YYYY-MM-DD HH:MM
   branch: feature/e##-s##-slug
   ---

   ## Completed Tasks

   [Tasks marked [x] from story file, as bullet list]

   ## Remaining Tasks

   [Tasks marked [ ] from story file, as bullet list]

   ## Implementation Progress

   [git log main...HEAD --oneline output]

   ## Key Decisions

   [Content from Implementation Notes section, or "No implementation notes recorded yet."]

   ## Approaches Tried / What Didn't Work

   [Content from Challenges and Lessons Learned section, or "No challenges documented yet."]

   ## Current State

   [git status --short output, or "Working tree clean"]

   ## Files Changed

   [git diff main...HEAD --stat output]
   ```

6. **Confirm** to user:
   ```
   Checkpoint saved for E##-S## — N/M tasks complete, saved at HH:MM
   File: docs/implementation-artifacts/sessions/{story-id}-checkpoint.md

   Tip: This checkpoint will be auto-loaded next time you run /start-story on this story.
   ```
